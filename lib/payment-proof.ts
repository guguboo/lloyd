// Onchain payment proof — the trust anchor for the whole policy.
//
// OKX's agent payment rails settle instantly and escrow nothing, so there is no on-chain
// "job" object to inspect. What IS on-chain is money moving. Lloyd therefore refuses to
// insure anything it cannot see settled:
//
//   job_tx      buyer -> provider   proves the job is real, who the parties are, and what
//                                   the buyer actually has at risk (a fabricated job_ref
//                                   costs nothing; a fabricated payment is impossible)
//   premium_tx  buyer -> treasury   proves the premium was actually collected
//
// Both are verified by reading the ERC-20 Transfer logs of a mined transaction.
import { erc20Abi, formatUnits, isAddress, parseEventLogs, parseUnits } from 'viem';
import { publicClient, activeNetwork, USDT, USDT_DECIMALS } from './xlayer';

export type Proof =
  | { ok: true; amountUsdt: number; at: Date }
  | { ok: false; reason: string };

const isTxHash = (s: string) => /^0x[0-9a-fA-F]{64}$/.test(s);
const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * Verify that `txHash` is a mined USDT transfer of at least `minUsdt` from `from` to `to`
 * on the active settlement network, no older than `maxAgeHours`.
 *
 * Sums every matching Transfer log in the tx, so a payment split across logs still counts,
 * while a transfer to any other recipient contributes nothing.
 */
export async function verifyUsdtTransfer(
  txHash: string,
  opts: { from: string; to: string; minUsdt: number; maxAgeHours?: number },
): Promise<Proof> {
  const { from, to, minUsdt, maxAgeHours = 24 } = opts;
  if (!isTxHash(txHash)) return { ok: false, reason: 'malformed_tx_hash' };
  if (!isAddress(from) || !isAddress(to)) return { ok: false, reason: 'malformed_address' };

  const net = activeNetwork();
  const client = publicClient(net);

  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
  } catch {
    // Not mined, unknown to this chain, or the RPC is down. All are "unproven" — we do not
    // guess, and we never bind on an unverifiable payment.
    return { ok: false, reason: 'tx_not_found_onchain' };
  }
  if (receipt.status !== 'success') return { ok: false, reason: 'tx_reverted' };

  const transfers = parseEventLogs({ abi: erc20Abi, eventName: 'Transfer', logs: receipt.logs })
    .filter((l) => eq(l.address, USDT[net]) && eq(l.args.from, from) && eq(l.args.to, to));
  if (transfers.length === 0) return { ok: false, reason: 'no_matching_usdt_transfer' };

  const total = transfers.reduce((s, l) => s + l.args.value, BigInt(0));
  const required = parseUnits(minUsdt.toFixed(USDT_DECIMALS), USDT_DECIMALS);
  const amountUsdt = Number(formatUnits(total, USDT_DECIMALS));
  if (total < required) return { ok: false, reason: `amount_below_required (paid ${amountUsdt}, need ${minUsdt})` };

  const block = await client.getBlock({ blockNumber: receipt.blockNumber });
  const at = new Date(Number(block.timestamp) * 1000);
  const ageHours = (Date.now() - at.getTime()) / 3_600_000;
  // A job payment from last month is not the job being insured now — it's someone shopping
  // an old settlement around for free coverage.
  if (ageHours > maxAgeHours) return { ok: false, reason: 'payment_too_old' };

  return { ok: true, amountUsdt, at };
}
