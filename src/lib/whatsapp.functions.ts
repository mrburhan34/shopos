import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * WhatsApp config server functions.
 *
 * The `whatsapp_config` table has no client RLS policies — only the
 * service role can read or write it. We expose a redacted GET (no auth
 * token returned to the browser) and a SAVE that accepts a new token
 * only when provided, otherwise keeps the existing one.
 */

export type WhatsappPublicConfig = {
  phone: string | null;
  twilio_account_sid: string | null;
  twilio_sender: string | null;
  webhook_url: string | null;
  has_auth_token: boolean;
};

export const getWhatsappConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WhatsappPublicConfig | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("whatsapp_config")
      .select("phone, twilio_account_sid, twilio_sender, webhook_url, twilio_auth_token")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!data) return null;
    return {
      phone: data.phone,
      twilio_account_sid: data.twilio_account_sid,
      twilio_sender: data.twilio_sender,
      webhook_url: data.webhook_url,
      has_auth_token: Boolean(data.twilio_auth_token),
    };
  });

export const saveWhatsappConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    phone?: string;
    twilio_account_sid?: string;
    twilio_auth_token?: string; // only forwarded when non-empty
    twilio_sender?: string;
    webhook_url?: string;
  }) => input ?? {})
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: {
      user_id: string;
      phone: string | null;
      twilio_account_sid: string | null;
      twilio_sender: string | null;
      webhook_url: string | null;
      updated_at: string;
      twilio_auth_token?: string;
    } = {
      user_id: context.userId,
      phone: data.phone ?? null,
      twilio_account_sid: data.twilio_account_sid ?? null,
      twilio_sender: data.twilio_sender ?? null,
      webhook_url: data.webhook_url ?? null,
      updated_at: new Date().toISOString(),
    };
    if (data.twilio_auth_token && data.twilio_auth_token.length > 0) {
      payload.twilio_auth_token = data.twilio_auth_token;
    }
    const { error } = await supabaseAdmin
      .from("whatsapp_config")
      .upsert(payload, { onConflict: "user_id" });
    if (error) {
      console.error("[whatsapp] save failed", error);
      throw new Error("Could not save configuration. Please try again.");
    }
    return { ok: true };
  });
