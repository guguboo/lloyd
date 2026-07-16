import { describe, it, expect } from 'vitest';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import {
  attestationMessage, registrationMessage, verifyDeliveryAttestation, verifyRegistration,
} from '@/lib/attestation';

// Real keys, real signatures, no network: delivery is the one fact Lloyd cannot read
// onchain, so the signature check IS the anti-fraud control. If a buyer could forge it,
// they could dodge every payout; if it replayed across policies, one delivery would clear
// them all.
const provider = privateKeyToAccount(generatePrivateKey());
const buyer = privateKeyToAccount(generatePrivateKey());

const POLICY = '11111111-1111-1111-1111-111111111111';
const OTHER_POLICY = '22222222-2222-2222-2222-222222222222';
const JOB_TX = '0xabc123';

const sign = (acct: typeof provider, policyId: string, jobTx: string) =>
  acct.signMessage({ message: attestationMessage(policyId, jobTx) });

describe('delivery attestation', () => {
  it('the provider’s own signature attests delivery', async () => {
    const signature = await sign(provider, POLICY, JOB_TX);
    expect(await verifyDeliveryAttestation({
      policyId: POLICY, jobTx: JOB_TX, providerWallet: provider.address, signature,
    })).toBe(true);
  });

  it('the buyer cannot forge the provider’s delivery', async () => {
    const signature = await sign(buyer, POLICY, JOB_TX);
    expect(await verifyDeliveryAttestation({
      policyId: POLICY, jobTx: JOB_TX, providerWallet: provider.address, signature,
    })).toBe(false);
  });

  it('an attestation does not replay onto another policy', async () => {
    const signature = await sign(provider, OTHER_POLICY, JOB_TX);
    expect(await verifyDeliveryAttestation({
      policyId: POLICY, jobTx: JOB_TX, providerWallet: provider.address, signature,
    })).toBe(false);
  });

  it('the job tx is bound into the message too', async () => {
    const signature = await sign(provider, POLICY, '0xdifferent');
    expect(await verifyDeliveryAttestation({
      policyId: POLICY, jobTx: JOB_TX, providerWallet: provider.address, signature,
    })).toBe(false);
  });

  it('garbage is not an attestation (never throws)', async () => {
    expect(await verifyDeliveryAttestation({
      policyId: POLICY, jobTx: JOB_TX, providerWallet: provider.address, signature: 'not-a-signature',
    })).toBe(false);
  });

  it('the signed message is case-stable on the job tx', () => {
    expect(attestationMessage(POLICY, '0xABC')).toBe(attestationMessage(POLICY, '0xabc'));
  });
});

describe('provider registration signature', () => {
  it('only the wallet holder can register that wallet', async () => {
    const signature = await provider.signMessage({
      message: registrationMessage('okx:agent:bob', provider.address),
    });
    expect(await verifyRegistration({
      providerId: 'okx:agent:bob', wallet: provider.address, signature,
    })).toBe(true);
    // someone else's signature over the same registration is rejected
    const forged = await buyer.signMessage({
      message: registrationMessage('okx:agent:bob', provider.address),
    });
    expect(await verifyRegistration({
      providerId: 'okx:agent:bob', wallet: provider.address, signature: forged,
    })).toBe(false);
  });

  it('a signature does not transfer to a different provider id', async () => {
    const signature = await provider.signMessage({
      message: registrationMessage('okx:agent:bob', provider.address),
    });
    expect(await verifyRegistration({
      providerId: 'okx:agent:eve', wallet: provider.address, signature,
    })).toBe(false);
  });
});
