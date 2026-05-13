import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shopos/Bits";
import { Sparkles, Send } from "lucide-react";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/ai")({ component: AIPage });

type Msg = { role: "user" | "ai"; text: string };

const PROMPTS = [
  "What's my revenue today?",
  "Which products are low on stock?",
  "Top 5 customers by purchases",
  "Outstanding dues",
];

function AIPage() {
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "ai", text: "Hi! Ask me about your sales, inventory, customers, or expenses." },
  ]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const ask = async (text: string) => {
    if (!text.trim()) return;
    setMsgs((m) => [...m, { role: "user", text }]);
    setQ(""); setBusy(true);
    const reply = await answer(text);
    setMsgs((m) => [...m, { role: "ai", text: reply }]);
    setBusy(false);
  };

  return (
    <div>
      <PageHeader title="AI Insights" subtitle="Ask about your shop in English or Telugu" />
      <div className="mx-auto max-w-3xl rounded-lg border bg-card">
        <div className="flex h-[60vh] flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {m.role === "ai" && <Sparkles className="mr-1 inline size-3" />} {m.text}
                </div>
              </div>
            ))}
            {busy && <div className="text-xs text-muted-foreground">Thinking…</div>}
          </div>
          <div className="border-t p-3">
            <div className="mb-2 flex flex-wrap gap-1">
              {PROMPTS.map((p) => (
                <Button key={p} size="sm" variant="outline" className="h-7 text-xs" onClick={() => ask(p)}>{p}</Button>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="flex gap-2">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask anything…" />
              <Button type="submit" size="icon"><Send className="size-4" /></Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

async function answer(q: string): Promise<string> {
  const lower = q.toLowerCase();
  if (lower.includes("revenue") || lower.includes("sales today") || lower.includes("today")) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { data } = await supabase.from("invoices").select("total,created_at").gte("created_at", today.toISOString());
    const total = (data ?? []).reduce((s, i) => s + Number(i.total), 0);
    return `Your revenue today is ${inr(total)} from ${data?.length ?? 0} invoices.`;
  }
  if (lower.includes("low") || lower.includes("stock")) {
    const { data } = await supabase.from("products").select("name,qty,threshold");
    const low = (data ?? []).filter((p) => Number(p.qty) <= Number(p.threshold));
    if (low.length === 0) return "All products are above their stock thresholds. ✅";
    return `${low.length} product(s) are low: ${low.map((p) => `${p.name} (${p.qty})`).join(", ")}.`;
  }
  if (lower.includes("top") && lower.includes("customer")) {
    const { data } = await supabase.from("customers").select("name,total_purchases").order("total_purchases", { ascending: false }).limit(5);
    if (!data || data.length === 0) return "No customers yet.";
    return "Top customers: " + data.map((c, i) => `${i+1}. ${c.name} (${inr(Number(c.total_purchases))})`).join(" · ");
  }
  if (lower.includes("outstanding") || lower.includes("dues") || lower.includes("unpaid")) {
    const { data } = await supabase.from("invoices").select("total,status").neq("status", "Paid");
    const total = (data ?? []).reduce((s, i) => s + Number(i.total), 0);
    return `Outstanding amount: ${inr(total)} across ${data?.length ?? 0} invoice(s).`;
  }
  if (lower.includes("expense")) {
    const { data } = await supabase.from("expenses").select("amount");
    const total = (data ?? []).reduce((s, e) => s + Number(e.amount), 0);
    return `Total expenses recorded: ${inr(total)}.`;
  }
  return "I can help with revenue, stock, customers, dues, and expenses. Try one of the suggestions above.";
}
