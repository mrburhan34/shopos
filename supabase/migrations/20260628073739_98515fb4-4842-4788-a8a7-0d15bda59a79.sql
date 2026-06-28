
CREATE OR REPLACE FUNCTION public.is_subscribed(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = _user_id
      AND (
        (s.status = 'active' AND (s.expires_at IS NULL OR s.expires_at > now()))
        OR (s.status = 'trial' AND (s.trial_start_date + make_interval(days => COALESCE(s.trial_days, 7))) > now())
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_subscribed(uuid) TO authenticated, service_role;

-- Restrictive policies: writes require an active subscription or trial.
-- Reads remain permitted by existing user-scoped policies.

CREATE POLICY "subscribed_write_invoices" ON public.invoices
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_subscribed(auth.uid()))
  WITH CHECK (public.is_subscribed(auth.uid()));

CREATE POLICY "subscribed_write_invoice_items" ON public.invoice_items
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_subscribed(auth.uid()))
  WITH CHECK (public.is_subscribed(auth.uid()));

CREATE POLICY "subscribed_write_products" ON public.products
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_subscribed(auth.uid()))
  WITH CHECK (public.is_subscribed(auth.uid()));

CREATE POLICY "subscribed_write_customers" ON public.customers
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_subscribed(auth.uid()))
  WITH CHECK (public.is_subscribed(auth.uid()));

CREATE POLICY "subscribed_write_suppliers" ON public.suppliers
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_subscribed(auth.uid()))
  WITH CHECK (public.is_subscribed(auth.uid()));

CREATE POLICY "subscribed_write_expenses" ON public.expenses
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_subscribed(auth.uid()))
  WITH CHECK (public.is_subscribed(auth.uid()));
