import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { MetricCard, PageHeader } from "@/components/shopos/Bits";
import { IndianRupee, FileText, AlertTriangle, Wallet, Sparkles, TrendingUp } from "lucide-react";
import { inr } from "@/lib/format";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { buildProductCostMap, computeGrossProfit } from "@/lib/profit";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

function Dashboard() {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name,shop_name").maybeSingle();
      return data;
    },
  });

  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const iso = today.toISOString();
      const [inv, prod, exp, items] = await Promise.all([
        supabase.from("invoices").select("id,total,status,customer_name,date,created_at").order("created_at", { ascending: false }).limit(50),
        supabase.from("products").select("id,name,qty,threshold,selling_price,purchase_price"),
        supabase.from("expenses").select("amount,date").gte("date", iso.slice(0, 10)),
        supabase
          .from("invoice_items")
          .select("name,qty,rate,product_id,invoices!inner(status,created_at)"),
      ]);
      const invs = inv.data ?? [];
      const today_inv = invs.filter((i) => new Date(i.created_at) >= today);
      const revenue = today_inv.reduce((s, i) => s + Number(i.total || 0), 0);
      const outstanding = invs.filter((i) => i.status !== "Paid").reduce((s, i) => s + Number(i.total || 0), 0);
      const lowStock = (prod.data ?? []).filter((p) => Number(p.qty) <= Number(p.threshold)).length;
      const top = (prod.data ?? []).slice(0, 5).map((p) => ({ name: p.name, value: Number(p.selling_price) }));

      // Gross profit today (paid invoices only)
      const costMap = buildProductCostMap((prod.data ?? []) as any);
      const todayPaidItems = ((items.data ?? []) as any[]).filter((it) => {
        const inv = it.invoices;
        return inv && inv.status === "Paid" && new Date(inv.created_at) >= today;
      });
      const grossProfitToday = computeGrossProfit(todayPaidItems, costMap);

      return {
        revenue,
        invoiceCount: today_inv.length,
        outstanding,
        lowStock,
        recent: invs.slice(0, 6),
        top,
        expensesToday: (exp.data ?? []).reduce((s, e) => s + Number(e.amount || 0), 0),
        grossProfitToday,
      };
    },
  });

  const greeting = (() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return "Good morning";
    if (h >= 12 && h < 17) return "Good afternoon";
    if (h >= 17 && h < 22) return "Good evening";
    return "Good night";
  })();

  const ownerName = (() => {
    if (profile?.full_name) return profile.full_name as string;
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem("shopos_shop");
        if (raw) {
          const s = JSON.parse(raw);
          if (s?.owner) return s.owner;
          if (s?.ownerName) return s.ownerName;
        }
        const u = window.localStorage.getItem("shopos_user");
        if (u) {
          const su = JSON.parse(u);
          if (su?.name) return su.name;
        }
      } catch { /* ignore */ }
    }
    if (user?.email) return user.email.split("@")[0];
    return "there";
  })();

  const profitTone = (data?.grossProfitToday ?? 0) >= 0 ? "success" : "danger";

  return (
    <div>
      <PageHeader
        title={`${greeting}, ${ownerName} 👋`}
        subtitle={`${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} · ${profile?.shop_name ?? "Anantapur"}`}
      />

      <div className="mb-4 flex items-start gap-3 rounded-lg border bg-accent/40 p-4">
        <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Sparkles className="size-4" />
        </div>
        <div className="text-sm">
          <div className="font-medium">AI insight</div>
          <div className="text-muted-foreground">
            {data && data.lowStock > 0
              ? `You have ${data.lowStock} product${data.lowStock > 1 ? "s" : ""} running low on stock. Reorder soon to avoid lost sales.`
              : "All systems healthy. Add invoices and products to see personalized insights."}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Revenue today" value={inr(data?.revenue ?? 0)} icon={IndianRupee} tone="success" />
        <MetricCard label="Gross profit today" value={inr(data?.grossProfitToday ?? 0)} icon={TrendingUp} tone={profitTone} hint="selling − purchase cost" />
        <MetricCard label="Invoices today" value={data?.invoiceCount ?? 0} icon={FileText} />
        <MetricCard label="Outstanding" value={inr(data?.outstanding ?? 0)} icon={Wallet} tone="warning" />
        <MetricCard label="Low stock items" value={data?.lowStock ?? 0} icon={AlertTriangle} tone="danger" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-4 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold">Top products</h3>
          {data?.top && data.top.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.top}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
                  <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">No products yet.</p>
          )}
        </div>
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Recent activity</h3>
          {data?.recent && data.recent.length > 0 ? (
            <ul className="space-y-3">
              {data.recent.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{r.customer_name}</div>
                    <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("en-IN")}</div>
                  </div>
                  <div className="text-sm font-semibold">{inr(Number(r.total))}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No invoices yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
