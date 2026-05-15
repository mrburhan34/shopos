import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shopos/Bits";
import { toast } from "sonner";
import { getTheme, setTheme } from "@/lib/theme";
import { Link } from "@tanstack/react-router";
import { useSubscription } from "@/hooks/use-subscription";
import { daysLeft } from "@/lib/subscription";

export const Route = createFileRoute("/_authenticated/settings")({ component: SettingsPage });

function SettingsPage() {
  const qc = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data } = await supabase.from("profiles").select("*").eq("id", u.user!.id).maybeSingle();
      return data;
    },
  });
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data } = await supabase.from("settings").select("*").eq("user_id", u.user!.id).maybeSingle();
      return data;
    },
  });

  return (
    <div>
      <PageHeader title="Settings" subtitle="Shop profile, appearance, and more" />
      <Tabs defaultValue="shop" className="max-w-3xl">
        <TabsList>
          <TabsTrigger value="shop">Shop</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="invoice">Invoice</TabsTrigger>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
        </TabsList>
        <TabsContent value="shop"><ShopForm profile={profile} onSaved={() => qc.invalidateQueries({ queryKey: ["profile"] })} /></TabsContent>
        <TabsContent value="appearance"><Appearance /></TabsContent>
        <TabsContent value="invoice"><InvoiceSettings settings={settings} onSaved={() => qc.invalidateQueries({ queryKey: ["settings"] })} /></TabsContent>
        <TabsContent value="subscription"><SubscriptionPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

function SubscriptionPanel() {
  const { data: sub } = useSubscription();
  if (!sub) return <div className="mt-4 rounded-lg border bg-card p-4 text-sm text-muted-foreground">Loading…</div>;
  const status = sub.status;
  const badge =
    status === "trial"
      ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">Trial · {daysLeft(sub)} days remaining</span>
      : status === "active"
      ? <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">Active</span>
      : <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800">Expired</span>;
  const cta =
    status === "trial" ? "Subscribe now" : status === "active" ? "Renew" : "Resubscribe";
  return (
    <div className="mt-4 space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <Label>Status</Label>
          <div className="mt-1">{badge}</div>
        </div>
        <Link to="/subscribe"><Button>{cta}</Button></Link>
      </div>
      {status === "active" && sub.expires_at && (
        <div className="text-sm text-muted-foreground">Valid until: {new Date(sub.expires_at).toLocaleDateString("en-IN")}</div>
      )}
      {sub.payment_ref && (
        <div className="text-xs text-muted-foreground">Payment ref: {sub.payment_ref}</div>
      )}
    </div>
  );
}

function ShopForm({ profile, onSaved }: { profile: any; onSaved: () => void }) {
  const [f, setF] = useState({ shop_name: "", full_name: "", phone: "", address: "", gstin: "" });
  useEffect(() => { if (profile) setF({
    shop_name: profile.shop_name ?? "", full_name: profile.full_name ?? "",
    phone: profile.phone ?? "", address: profile.address ?? "", gstin: profile.gstin ?? "",
  }); }, [profile]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("profiles").update(f).eq("id", u.user!.id);
    if (error) return toast.error(error.message);
    toast.success("Saved"); onSaved();
  };
  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-lg border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>Shop name</Label><Input value={f.shop_name} onChange={(e) => setF({ ...f, shop_name: e.target.value })} /></div>
        <div><Label>Owner name</Label><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
        <div><Label>Phone</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
        <div><Label>GSTIN</Label><Input value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value })} /></div>
      </div>
      <div><Label>Address</Label><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
      <Button type="submit">Save</Button>
    </form>
  );
}

function Appearance() {
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(getTheme() === "dark"); }, []);
  return (
    <div className="mt-4 space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <div><Label>Dark mode</Label><p className="text-xs text-muted-foreground">Switch between light and dark theme</p></div>
        <Switch checked={dark} onCheckedChange={(v) => { setDark(v); setTheme(v ? "dark" : "light"); }} />
      </div>
    </div>
  );
}

function InvoiceSettings({ settings, onSaved }: { settings: any; onSaved: () => void }) {
  const [f, setF] = useState({ invoice_prefix: "INV", gst_default: 18, payment_terms: "Due on receipt", whatsapp_alerts: false });
  useEffect(() => { if (settings) setF({
    invoice_prefix: settings.invoice_prefix, gst_default: Number(settings.gst_default),
    payment_terms: settings.payment_terms ?? "", whatsapp_alerts: settings.whatsapp_alerts,
  }); }, [settings]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("settings").update(f).eq("user_id", u.user!.id);
    if (error) return toast.error(error.message);
    toast.success("Saved"); onSaved();
  };
  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-lg border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>Invoice prefix</Label><Input value={f.invoice_prefix} onChange={(e) => setF({ ...f, invoice_prefix: e.target.value })} /></div>
        <div><Label>Default GST %</Label><Input type="number" value={f.gst_default} onChange={(e) => setF({ ...f, gst_default: Number(e.target.value) })} /></div>
      </div>
      <div><Label>Payment terms</Label><Input value={f.payment_terms} onChange={(e) => setF({ ...f, payment_terms: e.target.value })} /></div>
      <div className="flex items-center justify-between">
        <Label>WhatsApp alerts</Label>
        <Switch checked={f.whatsapp_alerts} onCheckedChange={(v) => setF({ ...f, whatsapp_alerts: v })} />
      </div>
      <Button type="submit">Save</Button>
    </form>
  );
}
