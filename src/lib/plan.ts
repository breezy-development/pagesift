export type Tier = "free" | "pro";

export interface Plan {
  tier: Tier;
  maxChars: number;
  maxColumns: number;
  savedTemplates: number;
}

export const PLANS: Record<Tier, Plan> = {
  free: { tier: "free", maxChars: 60_000, maxColumns: 12, savedTemplates: 0 },
  pro: { tier: "pro", maxChars: 120_000, maxColumns: 30, savedTemplates: 50 },
};

export type PlanSource = () => Promise<Tier>;

let source: PlanSource = async () => "free";

/** Swap in a licence check (e.g. ExtensionPay's getUser().paid) without touching callers. */
export function setPlanSource(fn: PlanSource): void {
  source = fn;
}

export async function getPlan(): Promise<Plan> {
  try {
    return PLANS[await source()] ?? PLANS.free;
  } catch {
    return PLANS.free;
  }
}
