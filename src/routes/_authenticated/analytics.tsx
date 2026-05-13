import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, MetricCard } from "@/components/shopos/Bits";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, PieChart, Pie, Cell, Legend } from "recharts";
import { inr } from "@/lib/format";
import { TrendingUp, ShoppingBag, Users, IndianRupee } from "lucide-react";

export const Route = createFileRoute("/_authenticated/analytics")({ component: Analytics });

function Analytics() {
  const { data } = useQuery({
    queryKey: ["analytics"],
    queryFn: async () => {
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 29);
      const [inv, cust] = await Promise.all([
        supabase.from("invoices").select("date,total,payment_mode").gte("date", cutoff.toISOString().slice(0, 10)),
        supabase.from("customers").select("id,created_at"),
      ]);
      const invs = inv.data ?? [];
      // last 30 days
      const days: Record<string, number> = {};
      for (let d = 0; d < 30; d++) {
        const dt = new Date(); dt.setDate(dt.getDate() - (29 - d));
        days[dt.toISOString().slice(0, 10)] = 0;
      }
      invs.forEach((i) => { days[i.date] = (days[i.date] || 0) + Number(i.total); });
      const series = Object.entries(days).map(([d, v]) => ({ d: d.slice(5), v }));

      const modes: Record<string, number> = {};
      invs.forEach((i) => { modes[i.payment_mode] = (modes[i.payment_mode] || 0) + Number(i.total); });
      const modeData = Object.entries(modes).map(([name, value]) => ({ name, value }));

      const revenue = invs.reduce((s, i) => s + Number(i.total), 0);
      const aov = invs.length ? revenue / invs.length : 0;
      const newCust = (cust.data ?? []).filter((c) => new Date(c.created_at) >= cutoff).length;

      return { series, modeData, revenue, aov, invoiceCount: invs.length, newCust };
    },
  });

  const colors = ["var(--chart-1)","var(--chart-2)","var(--chart-3)","var(--chart-4)","var(--chart-5)"];

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Last 30 days" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Revenue (30d)" value={inr(data?.revenue ?? 0)} icon={IndianRupee} tone="success" />
        <MetricCard label="Invoices" value={data?.invoiceCount ?? 0} icon={ShoppingBag} />
        <MetricCard label="Avg order" value={inr(data?.aov ?? 0)} icon={TrendingUp} />
        <MetricCard label="New customers" value={data?.newCust ?? 0} icon={Users} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-4 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold">Revenue trend</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={data?.series ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="d" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
                <Line type="monotone" dataKey="v" stroke="var(--primary)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Payment methods</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data?.modeData ?? []} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70}>
                  {(data?.modeData ?? []).map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
