import { supabase } from "@/integrations/supabase/client";

export const OWNER_WHATSAPP = "919704209360";
export const VALID_CODES = ["SHOPOS2025", "ACTIVATE499", "SAQIB001"];
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

/** Fetch sub for current user; create trial row if missing; persist expiry transitions. */
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
  let nextStatus: SubscriptionStatus = sub.status as SubscriptionStatus;
  if (sub.status === "trial") {
    const used = Math.floor((now - new Date(sub.trial_start_date).getTime()) / 86400000);
    if (used >= (sub.trial_days ?? 7)) nextStatus = "expired";
  } else if (sub.status === "active" && sub.expires_at) {
    if (new Date(sub.expires_at).getTime() < now) nextStatus = "expired";
  }
  if (nextStatus !== sub.status) {
    const { data: updated } = await supabase
      .from("subscriptions")
      .update({ status: nextStatus })
      .eq("user_id", userId)
      .select()
      .single();
    sub = (updated as any) ?? sub;
  }
  return sub as Subscription;
}

export async function activateWithCode(code: string): Promise<Subscription> {
  const normalized = code.trim().toUpperCase();
  if (!VALID_CODES.includes(normalized)) throw new Error("Invalid code");
  const { data: u } = await supabase.auth.getUser();
  const userId = u.user?.id;
  if (!userId) throw new Error("Not signed in");
  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 86400000);
  const { data, error } = await supabase
    .from("subscriptions")
    .update({
      status: "active",
      activated_at: now.toISOString(),
      expires_at: expires.toISOString(),
      payment_ref: normalized,
    })
    .eq("user_id", userId)
    .select()
    .single();
  if (error) throw error;
  return data as Subscription;
}

export async function ensureTrialForCurrentUser() {
  const { data: u } = await supabase.auth.getUser();
  const userId = u.user?.id;
  if (!userId) return;
  await supabase.from("subscriptions").insert({ user_id: userId }).select();
  // ignore conflict errors silently — trigger may have already inserted
}
