export const MAX_POOL_UTILIZATION = 0.5;
export const MAX_PROVIDER_SHARE = 0.1;
export const MAX_PAID_CLAIMS_7D = 2;

export interface BindContext {
  poolUsdt: number;
  outstandingUsdt: number;
  providerOutstandingUsdt: number;
  newCoverageUsdt: number;
  buyerPaidClaims7d: number;
  buyerHasActivePolicyWithProvider: boolean;
  killSwitch: boolean;
}
export type BindCheck = { ok: true } | { ok: false; reason: string };

const no = (reason: string): BindCheck => ({ ok: false, reason });

export function canBind(ctx: BindContext): BindCheck {
  if (ctx.killSwitch) return no('kill_switch_active');
  if (ctx.buyerHasActivePolicyWithProvider) return no('active_policy_exists_for_pair');
  if (ctx.buyerPaidClaims7d >= MAX_PAID_CLAIMS_7D) return no('claim_velocity_limit');
  if (ctx.outstandingUsdt + ctx.newCoverageUsdt > MAX_POOL_UTILIZATION * ctx.poolUsdt)
    return no('pool_utilization_cap');
  if (ctx.providerOutstandingUsdt + ctx.newCoverageUsdt > MAX_PROVIDER_SHARE * ctx.poolUsdt)
    return no('provider_exposure_cap');
  return { ok: true };
}
