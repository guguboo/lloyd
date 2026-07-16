// Delivery attestation — the only fact in the system that is not on-chain.
//
// Nothing in x402 or a2a-pay records whether the work was delivered, so Lloyd cannot
// observe it. Instead the burden sits with the party that both knows the answer and can
// prove it cryptographically: the PROVIDER signs, with the same wallet that received the
// job payment, a statement bound to this one policy.
//
//   provider signs before the deadline  -> job delivered, coverage lapses, no claim
//   no signature by the deadline        -> non-delivery, the buyer's claim pays
//
// A buyer cannot forge it (they don't hold the provider's key) and it cannot be replayed
// onto another policy (the policy id and job tx are inside the signed message).
import { verifyMessage } from 'viem';

export function attestationMessage(policyId: string, jobTx: string): string {
  return `Lloyd delivery attestation\npolicy: ${policyId}\njob: ${jobTx.toLowerCase()}`;
}

// Provider self-registration uses the same mechanic: signing this message with a wallet
// proves the registrant controls the payout address they are listing. Binding the
// provider id into the message stops one signature registering under other names.
export function registrationMessage(providerId: string, wallet: string): string {
  return `Lloyd provider registration\nprovider: ${providerId}\nwallet: ${wallet.toLowerCase()}`;
}

export async function verifyRegistration(a: {
  providerId: string;
  wallet: string;
  signature: string;
}): Promise<boolean> {
  try {
    return await verifyMessage({
      address: a.wallet as `0x${string}`,
      message: registrationMessage(a.providerId, a.wallet),
      signature: a.signature as `0x${string}`,
    });
  } catch {
    return false;
  }
}

/** True iff `signature` is the provider wallet's signature over this policy's attestation. */
export async function verifyDeliveryAttestation(a: {
  policyId: string;
  jobTx: string;
  providerWallet: string;
  signature: string;
}): Promise<boolean> {
  try {
    return await verifyMessage({
      address: a.providerWallet as `0x${string}`,
      message: attestationMessage(a.policyId, a.jobTx),
      signature: a.signature as `0x${string}`,
    });
  } catch {
    return false; // malformed signature/address — not an attestation
  }
}
