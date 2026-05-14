import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, MetricCard, EmptyState } from "@/components/shopos/Bits";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  LabelList,
} from "recharts";
import { inr } from "@/lib/format";
import { TrendingUp, ShoppingBag, Package, IndianRupee, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/analytics")({ component: Analytics });

function Analytics() {
  const [topMode, setTopMode] = useState<"revenue" | "units">("revenue");

  const { data } = useQuery({
    queryKey: ["analytics"],
    queryFn: async () => {
      const yearAgo = new Date();
      yearAgo.setMonth(yearAgo.getMonth() - 11);
      yearAgo.setDate(1);
      const cutoff = yearAgo.toISOString().slice(0, 10);

      const monthStart = new Date();
      monthStart.setDate(1);
      const yearStart = new Date(new Date().getFullYear(), 0, 1);

      const [invs, exps, items] = await Promise.all([
        supabase.from("invoices").select("date,total,paid_amount").gte("date", cutoff),
        supabase.from("expenses").select("date,amount").gte("date", cutoff),
        supabase.from("invoice_items").select("name,qty,amount,invoice_id,invoices!inner(date,user_id)"),
      ]);

      const invD = invs.data ?? [];
      const expD = exps.data ?? [];
      const itemD = (items.data ?? []) as any[];

      const monthRev = invD
        .filter((i) => new Date(i.date) >= monthStart)
        .reduce((s, i) => s + Number(i.total), 0);
      const yearRev = invD
        .filter((i) => new Date(i.date) >= yearStart)
        .reduce((s, i) => s + Number(i.total), 0);
      const monthExp = expD
        .filter((e) => new Date(e.date) >= monthStart)
        .reduce((s, e) => s + Number(e.amount), 0);
      const yearExp = expD
        .filter((e) => new Date(e.date) >= yearStart)
        .reduce((s, e) => s + Number(e.amount), 0);

      // Last 12 months series
      const months: { key: string; label: string; rev: number; exp: number }[] = [];
      const now = new Date();
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        months.push({
          key,
          label: d.toLocaleDateString("en-IN", { month: "short" }),
          rev: 0,
          exp: 0,
        });
      }
      const idx = Object.fromEntries(months.map((m, i) => [m.key, i]));
      invD.forEach((i) => {
        const k = i.date.slice(0, 7);
        if (k in idx) months[idx[k]].rev += Number(i.total);
      });
      expD.forEach((e) => {
        const k = e.date.slice(0, 7);
        if (k in idx) months[idx[k]].exp += Number(e.amount);
      });

      // Most ordered items
      const agg: Record<string, { name: string; qty: number; revenue: number }> = {};
      itemD.forEach((it) => {
        const n = it.name as string;
        if (!agg[n]) agg[n] = { name: n, qty: 0, revenue: 0 };
        agg[n].qty += Number(it.qty);
        agg[n].revenue += Number(it.amount);
      });
      const mostOrdered = Object.values(agg)
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 10);
      const topByRev = [...Object.values(agg)]
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      return {
        monthRev,
        yearRev,
        monthExp,
        yearExp,
        months,
        mostOrdered,
        topByRev,
      };
    },
  });

  const top =
    topMode === "revenue"
      ? data?.topByRev ?? []
      : (data?.mostOrdered ?? []).map((i) => ({
          ...i,
          revenue: i.qty,
        }));

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Profit overview & top items" />

      <h2 className="mb-2 text-sm font-semibold text-muted-foreground">This month</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Revenue" value={inr(data?.monthRev ?? 0)} icon={IndianRupee} tone="success" />
        <MetricCard label="Expenses" value={inr(data?.monthExp ?? 0)} icon={Receipt} tone="danger" />
        <MetricCard
          label="Net Profit"
          value={inr((data?.monthRev ?? 0) - (data?.monthExp ?? 0))}
          icon={TrendingUp}
          tone={(data?.monthRev ?? 0) - (data?.monthExp ?? 0) >= 0 ? "success" : "danger"}
        />
      </div>

      <h2 className="mb-2 mt-6 text-sm font-semibold text-muted-foreground">This year</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Revenue" value={inr(data?.yearRev ?? 0)} icon={IndianRupee} tone="success" />
        <MetricCard label="Expenses" value={inr(data?.yearExp ?? 0)} icon={Receipt} tone="danger" />
        <MetricCard
          label="Net Profit"
          value={inr((data?.yearRev ?? 0) - (data?.yearExp ?? 0))}
          icon={TrendingUp}
          tone={(data?.yearRev ?? 0) - (data?.yearExp ?? 0) >= 0 ? "success" : "danger"}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-4 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold">Revenue vs Expenses (last 12 months)</h3>
          <div className="h-72">
            <ResponsiveContainer>
              <ComposedChart data={data?.months ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
                <Legend />
                <Bar dataKey="rev" name="Revenue" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="exp" name="Expenses" stroke="var(--destructive)" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Most ordered items</h3>
          {data?.mostOrdered && data.mostOrdered.length > 0 ? (
            <ol className="space-y-2 text-sm">
              {data.mostOrdered.map((it, i) => (
                <li key={it.name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-medium text-muted-foreground w-5">#{i + 1}</span>
                    <span className="truncate">{it.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{it.qty}</div>
                    <div className="text-xs text-muted-foreground">{inr(it.revenue)}</div>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState icon={Package} title="No items sold yet" />
          )}
        </div>
      </div>

      <div className="mt-6 rounded-lg border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Top products</h3>
          <div className="flex gap-1">
            <Button size="sm" variant={topMode === "revenue" ? "default" : "outline"} onClick={() => setTopMode("revenue")}>
              By revenue
            </Button>
            <Button size="sm" variant={topMode === "units" ? "default" : "outline"} onClick={() => setTopMode("units")}>
              By units
            </Button>
          </div>
        </div>
        {top.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer>
              <BarChart data={top} layout="vertical" margin={{ left: 40, right: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis dataKey="name" type="category" stroke="var(--muted-foreground)" fontSize={11} width={120} />
                <Tooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }}
                  formatter={(v: number) => (topMode === "revenue" ? inr(Number(v)) : `${v} units`)}
                />
                <Bar dataKey="revenue" fill="var(--primary)" radius={[0, 4, 4, 0]}>
                  <LabelList
                    dataKey="revenue"
                    position="right"
                    formatter={(v: any) => (topMode === "revenue" ? inr(Number(v)) : `${v}`)}
                    fontSize={11}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState icon={ShoppingBag} title="No data yet" />
        )}
      </div>
    </div>
  );
}
