-- Real premium collection + on-chain job proof + delivery attestation.
--
-- Context: OKX's payment rails (x402 / a2a-pay) settle INSTANTLY and hold nothing in
-- escrow — there is no on-chain job state a third party can observe. So Lloyd anchors a
-- policy in the two facts that ARE on-chain (the buyer paid the provider; the buyer paid
-- Lloyd) and takes delivery as a signed attestation from the provider's own key.
--
-- Fraud controls enforced HERE, as constraints, not application logic:
--   premium reuse      -> unique(premium_tx)   one on-chain premium payment backs one policy
--   double-insurance   -> unique(job_tx)       one job payment can be insured exactly once

-- Provider payout address: the recipient the job payment must actually have gone to.
-- Without it we cannot verify a job exists, so an unwalleted provider is not insurable
-- once on-chain proof is required.
alter table provider_dossiers add column wallet text;

alter table policies
  add column premium_tx   text,        -- buyer -> Lloyd treasury (the collected premium)
  add column job_tx       text,        -- buyer -> provider (the x402 job settlement)
  add column delivered_at timestamptz, -- set when the provider attests delivery
  add column delivery_sig text;        -- the provider's EIP-191 signature over the attestation

create unique index policies_premium_tx_uniq on policies (lower(premium_tx)) where premium_tx is not null;
create unique index policies_job_tx_uniq     on policies (lower(job_tx))     where job_tx is not null;
