import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, MetricCard, StatusBadge, EmptyState } from "@/components/shopos/Bits";
import { Download, IndianRupee, FileText, BookOpen } from "lucide-react";
import { inr, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/ledger")({ component: Ledger });

function Ledger() {
  const start = new Date(); start.setDate(start.getDate() - 30);
  const [from, setFrom] = useState(start.toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const { data, isLoading } = useQuery({
    queryKey: ["ledger", from, to],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices")
        .select("*").gte("date", from).lte("date", to).order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const total = (data ?? []).reduce((s, i) => s + Number(i.total), 0);
  const paid = (data ?? []).filter((i) => i.status === "Paid").reduce((s, i) => s + Number(i.total), 0);
  const due = total - paid;

  const exportCsv = () => {
    if (!data) return;
    const rows = [
      ["Number", "Date", "Customer", "Total", "Status", "Payment"],
      ...data.map((i) => [i.number, i.date, i.customer_name, i.total, i.status, i.payment_mode]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `ledger-${from}-${to}.csv`; a.click();
  };

  return (
    <div>
      <PageHeader title="Sales Ledger" subtitle="All invoices in date range"
        actions={<Button variant="outline" onClick={exportCsv}><Download className="size-4 mr-1" />Export CSV</Button>} />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div><label className="text-xs text-muted-foreground">From</label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label className="text-xs text-muted-foreground">To</label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <MetricCard label="Total sales" value={inr(total)} icon={IndianRupee} tone="success" />
        <MetricCard label="Collected" value={inr(paid)} icon={FileText} />
        <MetricCard label="Outstanding" value={inr(due)} icon={BookOpen} tone="warning" />
      </div>
      {isLoading ? <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Loading…</div> :
        !data || data.length === 0 ? <EmptyState icon={BookOpen} title="No transactions in range" /> :
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Number</th><th className="px-3 py-2 text-left">Customer</th><th className="px-3 py-2">Mode</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Status</th></tr>
            </thead>
            <tbody>
              {data.map((i) => (
                <tr key={i.id} className="border-t">
                  <td className="px-3 py-2 text-muted-foreground">{fmtDate(i.date)}</td>
                  <td className="px-3 py-2 font-medium">{i.number}</td>
                  <td className="px-3 py-2">{i.customer_name}</td>
                  <td className="px-3 py-2 text-center text-muted-foreground">{i.payment_mode}</td>
                  <td className="px-3 py-2 text-right font-semibold">{inr(Number(i.total))}</td>
                  <td className="px-3 py-2 text-center"><StatusBadge status={i.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
    </div>
  );
}
