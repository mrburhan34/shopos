import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Server-side activation: validates the code against the server-only
 * `activation_codes` table, marks it used atomically, and flips the
 * caller's subscription to active for 30 days using the service role.
 *
 * All checks happen here — the client cannot bypass them by clearing
 * localStorage or calling Supabase directly (subscriptions UPDATE is
 * service-role only).
 */
export const activateSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { code: string }) => {
    if (!data || typeof data.code !== "string") throw new Error("invalid_input");
    return { code: data.code.trim().toUpperCase() };
  })
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { code } = data;
    if (!code) throw new Error("invalid");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Atomic claim: only succeeds if the code exists AND is unused.
    const { data: claimed, error: claimErr } = await supabaseAdmin
      .from("activation_codes")
      .update({ used_by: userId, used_at: new Date().toISOString() })
      .eq("code", code)
      .is("used_by", null)
      .select("code")
      .maybeSingle();

    if (claimErr) throw new Error("server_error");
    if (!claimed) {
      // Distinguish invalid vs used by re-reading.
      const { data: existing } = await supabaseAdmin
        .from("activation_codes")
        .select("used_by")
        .eq("code", code)
        .maybeSingle();
      if (!existing) throw new Error("invalid");
      throw new Error("used");
    }

    const now = new Date();
    const expires = new Date(now.getTime() + 30 * 86400000);
    const { data: sub, error: subErr } = await supabaseAdmin
      .from("subscriptions")
      .update({
        status: "active",
        activated_at: now.toISOString(),
        expires_at: expires.toISOString(),
        payment_ref: code,
      })
      .eq("user_id", userId)
      .select()
      .single();
    if (subErr) throw new Error("server_error");
    return sub;
  });
