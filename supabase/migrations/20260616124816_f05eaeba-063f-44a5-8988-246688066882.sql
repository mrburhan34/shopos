CREATE TABLE IF NOT EXISTS public.activation_codes (
  code text PRIMARY KEY,
  used_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.activation_codes TO service_role;
ALTER TABLE public.activation_codes ENABLE ROW LEVEL SECURITY;
-- No policies for anon/authenticated: only service_role can access.

DROP POLICY IF EXISTS subscriptions_all_own ON public.subscriptions;
CREATE POLICY subscriptions_select_own ON public.subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY subscriptions_insert_own ON public.subscriptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS whatsapp_config_all_own ON public.whatsapp_config;
-- RLS stays enabled with no client policies; all access via server functions.
