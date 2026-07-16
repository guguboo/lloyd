// Bind-time fraud controls.
//
// The attack this system has to survive is not a hacker — it's a buyer agent that can
// mint counterparties at will. The threat model and where each attack dies:
//
//   fake job          invent a job_ref, let it "time out", collect
//                     -> killed onchain: job_tx must be a real USDT transfer to the
//                        provider's real wallet (lib/payment-proof.ts)
//   free coverage     bind without ever paying the premium
//                     -> killed onchain: premium_tx must be a real transfer to treasury
//   double-insurance  buy N policies against one job, collect N times
//                     -> killed in the DB: unique(job_tx)
//   premium reuse     one premium payment, many policies
//                     -> killed in the DB: unique(premium_tx)
//   false claim       claim on a job the provider DID deliver
//                     -> killed by the provider's signed attestation (lib/attestation.ts)
//   self-dealing      buyer and provider are the same entity: pay yourself, "fail",
//                     collect coverage; the job payment is a wash, costing only gas
//                     -> killed HERE
//   claim farming     an agent whose business model is claiming
//                     -> killed HERE
//
// Self-dealing is the one that actually pays, so it gets the most surface. Note the
// onchain proof already blunts it: a self-dealer must move the FULL job value to a wallet
// Lloyd can see, and coverage is only 80% of it — so a successful self-deal against a
// correctly-priced book still loses money unless the two wallets are the same pocket.
// These checks make sure they aren't.

export interface FraudContext {
  buyerWallet: string;
  providerWallet: string | null; // dossier payout address; null = unknown
  linkedToBuyer: boolean; // curated/known linkage between this provider and this buyer
  requireOnchainProof: boolean; // off in fixture mode, where no value moves
  pairPaidClaims: number; // paid claims ever between this exact buyer+provider pair
  buyerPolicies: number; // policies this buyer has ever bound
  buyerPaidClaims: number; // of those, how many paid out
}

export type FraudVerdict = { ok: true } | { ok: false; reason: string };

const no = (reason: string): FraudVerdict => ({ ok: false, reason });

// A buyer with a normal book loses most policies (jobs get delivered). One whose policies
// keep converting to payouts is either only insuring jobs they know will fail, or is the
// provider. Needs a few policies before it means anything.
const MIN_POLICIES_FOR_RATE = 3;
const MAX_CLAIM_RATE = 0.5;

export function assessFraud(ctx: FraudContext): FraudVerdict {
  const buyer = ctx.buyerWallet.toLowerCase();
  const provider = ctx.providerWallet?.toLowerCase() ?? null;

  // Can't verify a payment to a provider we have no address for → not insurable.
  if (ctx.requireOnchainProof && !provider) return no('provider_wallet_unknown');

  if (provider && provider === buyer) return no('self_dealing_same_wallet');
  if (ctx.linkedToBuyer) return no('linked_wallets');

  // The strongest self-dealing signature we can see without an oracle: this exact pair has
  // already produced a payout. Honest pairs re-hire after a success, not after a loss.
  if (ctx.pairPaidClaims > 0) return no('pair_prior_loss');

  if (ctx.buyerPolicies >= MIN_POLICIES_FOR_RATE && ctx.buyerPaidClaims / ctx.buyerPolicies > MAX_CLAIM_RATE)
    return no('abnormal_claim_rate');

  return { ok: true };
}
