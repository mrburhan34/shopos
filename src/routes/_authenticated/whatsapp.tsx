import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shopos/Bits";
import { MessageCircle, CheckCircle2, Send } from "lucide-react";
import { inr } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/whatsapp")({ component: WA });

const COMMANDS = [
  { cmd: "sales today", desc: "Today's revenue and invoice count" },
  { cmd: "low stock", desc: "Products at or below threshold" },
  { cmd: "pending dues", desc: "Customers with unpaid balances" },
  { cmd: "top product", desc: "Highest revenue product this month" },
  { cmd: "profit this month", desc: "Revenue − expenses this month" },
];

function WA() {
  const qc = useQueryClient();
  const { data: cfg } = useQuery({
    queryKey: ["whatsapp_config"],
    queryFn: async () => {
      const { data } = await supabase.from("whatsapp_config").select("*").maybeSingle();
      return data;
    },
  });

  return (
    <div>
      <PageHeader title="WhatsApp Bot" subtitle="Let customers query your business via WhatsApp" />

      {cfg?.phone ? (
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-[color:var(--success)]/15 px-3 py-1 text-sm text-[color:var(--success)]">
          <CheckCircle2 className="size-4" />
          Connected · {cfg.phone}
        </div>
      ) : (
        <div className="mb-4 rounded-lg border bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          Bot is not connected yet. Fill the setup form below to enable.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <SetupCard
          cfg={cfg}
          onSaved={() => qc.invalidateQueries({ queryKey: ["whatsapp_config"] })}
        />
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <MessageCircle className="size-5 text-primary" />
            <h3 className="font-semibold">Twilio sandbox setup</h3>
          </div>
          <ol className="ml-4 list-decimal space-y-2 text-sm text-muted-foreground">
            <li>Sign in to Twilio Console → Messaging → Try it out → WhatsApp.</li>
            <li>Join your sandbox number by sending the join code from your phone.</li>
            <li>Copy your Account SID and Auth Token into the setup form.</li>
            <li>Set the inbound webhook URL on Twilio to the URL shown below.</li>
            <li>Test by sending one of the commands listed.</li>
          </ol>
          <div className="mt-3 rounded-md border bg-muted/40 p-2 font-mono text-xs break-all">
            {typeof window !== "undefined"
              ? `${window.location.origin}/api/public/whatsapp-webhook`
              : "/api/public/whatsapp-webhook"}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            You can also wire this through Make.com or n8n — point your scenario's webhook to the
            Twilio inbound message and forward responses through the Twilio API.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Supported commands</h3>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left py-1">Command</th>
                <th className="text-left py-1">What it does</th>
              </tr>
            </thead>
            <tbody>
              {COMMANDS.map((c) => (
                <tr key={c.cmd} className="border-t">
                  <td className="py-1 font-mono text-xs">{c.cmd}</td>
                  <td className="py-1 text-muted-foreground">{c.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TestPanel />
      </div>
    </div>
  );
}

function SetupCard({ cfg, onSaved }: { cfg: any; onSaved: () => void }) {
  const [f, setF] = useState({
    phone: cfg?.phone ?? "",
    twilio_account_sid: cfg?.twilio_account_sid ?? "",
    twilio_auth_token: cfg?.twilio_auth_token ?? "",
    twilio_sender: cfg?.twilio_sender ?? "",
    webhook_url: cfg?.webhook_url ?? "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const userId = u.user!.id;
    const payload = { ...f, user_id: userId, updated_at: new Date().toISOString() };
    const { error } = await supabase.from("whatsapp_config").upsert(payload, { onConflict: "user_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Bot configuration saved");
    onSaved();
  };

  return (
    <form onSubmit={submit} className="rounded-lg border bg-card p-4 space-y-3">
      <h3 className="font-semibold">Setup</h3>
      <div>
        <Label>Your WhatsApp business number</Label>
        <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+91…" />
      </div>
      <div>
        <Label>Twilio Account SID</Label>
        <Input value={f.twilio_account_sid} onChange={(e) => setF({ ...f, twilio_account_sid: e.target.value })} />
      </div>
      <div>
        <Label>Twilio Auth Token</Label>
        <Input
          type="password"
          value={f.twilio_auth_token}
          onChange={(e) => setF({ ...f, twilio_auth_token: e.target.value })}
        />
      </div>
      <div>
        <Label>Twilio sender (whatsapp:+…)</Label>
        <Input value={f.twilio_sender} onChange={(e) => setF({ ...f, twilio_sender: e.target.value })} />
      </div>
      <div>
        <Label>Webhook URL (optional)</Label>
        <Input value={f.webhook_url} onChange={(e) => setF({ ...f, webhook_url: e.target.value })} />
      </div>
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "Saving…" : cfg ? "Update setup" : "Save setup"}
      </Button>
    </form>
  );
}

function TestPanel() {
  const [cmd, setCmd] = useState("sales today");
  const [reply, setReply] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    const c = cmd.trim().toLowerCase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    try {
      if (c === "sales today") {
        const { data } = await supabase
          .from("invoices")
          .select("total")
          .gte("date", today.toISOString().slice(0, 10));
        const sum = (data ?? []).reduce((s, i) => s + Number(i.total), 0);
        setReply(`📊 Sales today: ${inr(sum)} across ${(data ?? []).length} invoices.`);
      } else if (c === "low stock") {
        const { data } = await supabase.from("products").select("name,qty,threshold");
        const low = (data ?? []).filter((p) => Number(p.qty) <= Number(p.threshold));
        setReply(
          low.length === 0
            ? "✅ No low-stock items."
            : `⚠️ Low stock:\n${low.map((p) => `• ${p.name} (${p.qty})`).join("\n")}`
        );
      } else if (c === "pending dues") {
        const { data } = await supabase.from("customers").select("name,dues").gt("dues", 0).order("dues", { ascending: false }).limit(10);
        setReply(
          (data ?? []).length === 0
            ? "✅ No pending dues."
            : `💰 Pending dues:\n${(data ?? []).map((c) => `• ${c.name}: ${inr(Number(c.dues))}`).join("\n")}`
        );
      } else if (c === "top product") {
        const { data } = await supabase
          .from("invoice_items")
          .select("name,amount,invoices!inner(date)")
          .gte("invoices.date", monthStart.toISOString().slice(0, 10));
        const agg: Record<string, number> = {};
        (data ?? []).forEach((it: any) => {
          agg[it.name] = (agg[it.name] ?? 0) + Number(it.amount);
        });
        const top = Object.entries(agg).sort((a, b) => b[1] - a[1])[0];
        setReply(top ? `🏆 Top product this month: ${top[0]} — ${inr(top[1])}` : "No sales this month.");
      } else if (c === "profit this month") {
        const [inv, exp] = await Promise.all([
          supabase.from("invoices").select("total").gte("date", monthStart.toISOString().slice(0, 10)),
          supabase.from("expenses").select("amount").gte("date", monthStart.toISOString().slice(0, 10)),
        ]);
        const rev = (inv.data ?? []).reduce((s, i) => s + Number(i.total), 0);
        const ex = (exp.data ?? []).reduce((s, e) => s + Number(e.amount), 0);
        setReply(`📈 Profit this month: ${inr(rev - ex)} (Revenue ${inr(rev)} − Expenses ${inr(ex)})`);
      } else {
        setReply("Unknown command. Try one from the list.");
      }
    } catch (e: any) {
      setReply("Error: " + e.message);
    }
    setBusy(false);
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">Test bot</h3>
      <div className="flex gap-2">
        <Input value={cmd} onChange={(e) => setCmd(e.target.value)} placeholder="Type a command…" />
        <Button onClick={run} disabled={busy}>
          <Send className="size-4 mr-1" />
          Send
        </Button>
      </div>
      <div className="mt-3 min-h-[120px] rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-line">
        {reply ?? <span className="text-muted-foreground">Bot reply will appear here…</span>}
      </div>
    </div>
  );
}
