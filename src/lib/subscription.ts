import { supabase } from "@/integrations/supabase/client";
import { activateSubscription } from "@/lib/subscription.functions";

export const OWNER_WHATSAPP = "919704209360";
export const UPI_ID = "syedsaqibburhanuddin@fam";
export const PRICE = 499;

export type SubscriptionStatus = "trial" | "active" | "expired";

export type Subscription = {
  id: string;
  user_id: string;
  status: SubscriptionStatus;
  trial_start_date: string;
  trial_days: number;
  activated_at: string | null;
  expires_at: string | null;
  payment_ref: string | null;
};

export function daysLeft(sub: Subscription | null | undefined): number {
  if (!sub) return 0;
  if (sub.status === "trial") {
    const start = new Date(sub.trial_start_date).getTime();
    const used = Math.floor((Date.now() - start) / 86400000);
    return Math.max(0, sub.trial_days - used);
  }
  if (sub.status === "active" && sub.expires_at) {
    return Math.max(0, Math.ceil((new Date(sub.expires_at).getTime() - Date.now()) / 86400000));
  }
  return 0;
}

/** Fetch sub for current user; create trial row if missing.
 *  Status transitions (trial→expired, active→expired) are computed read-side;
 *  the server-side activation function is the only path that can flip a row
 *  to "active" (clients cannot UPDATE the subscriptions table).
 */
export async function fetchAndEvaluateSubscription(): Promise<Subscription | null> {
  const { data: u } = await supabase.auth.getUser();
  const userId = u.user?.id;
  if (!userId) return null;

  let { data: sub } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!sub) {
    const { data: created } = await supabase
      .from("subscriptions")
      .insert({ user_id: userId })
      .select()
      .single();
    sub = created as any;
  }
  if (!sub) return null;

  const now = Date.now();
  let effectiveStatus: SubscriptionStatus = sub.status as SubscriptionStatus;
  if (sub.status === "trial") {
    const used = Math.floor((now - new Date(sub.trial_start_date).getTime()) / 86400000);
    if (used >= (sub.trial_days ?? 7)) effectiveStatus = "expired";
  } else if (sub.status === "active" && sub.expires_at) {
    if (new Date(sub.expires_at).getTime() < now) effectiveStatus = "expired";
  }
  return { ...(sub as Subscription), status: effectiveStatus };
}

/** Calls the server function which is the only place that can validate
 *  codes and mark a subscription active. Errors:
 *   - "invalid": code doesn't exist
 *   - "used": code already redeemed
 *   - "not_signed_in" / other: auth or server failures
 */
export async function activateWithCode(code: string): Promise<Subscription> {
  try {
    const result = await activateSubscription({ data: { code } });
    return result as Subscription;
  } catch (err: any) {
    const msg = String(err?.message ?? "").toLowerCase();
    if (msg.includes("used")) throw new Error("used");
    if (msg.includes("invalid")) throw new Error("invalid");
    if (msg.includes("unauthorized")) throw new Error("not_signed_in");
    throw err;
  }
}

export async function ensureTrialForCurrentUser() {
  const { data: u } = await supabase.auth.getUser();
  const userId = u.user?.id;
  if (!userId) return;
  await supabase.from("subscriptions").insert({ user_id: userId }).select();
  // ignore conflict errors silently — trigger may have already inserted
}
