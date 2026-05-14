import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, MetricCard, StatusBadge, EmptyState } from "@/components/shopos/Bits";
import { Download, IndianRupee, FileText, BookOpen, TrendingUp, Receipt } from "lucide-react";
import { inr, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/ledger")({ component: Ledger });

function Ledger() {
  const start = new Date(); start.setDate(start.getDate() - 30);
  const [from, setFrom] = useState(start.toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const { data, isLoading } = useQuery({
    queryKey: ["ledger", from, to],
    queryFn: async () => {
      const [invs, exps] = await Promise.all([
        supabase.from("invoices").select("*").gte("date", from).lte("date", to).order("date", { ascending: false }),
        supabase.from("expenses").select("amount,date").gte("date", from).lte("date", to),
      ]);
      if (invs.error) throw invs.error;
      return { invs: invs.data ?? [], exps: exps.data ?? [] };
    },
  });

  const invs = data?.invs ?? [];
  const exps = data?.exps ?? [];
  const total = invs.reduce((s, i) => s + Number(i.total), 0);
  const collected = invs.reduce((s, i) => s + Number(i.paid_amount ?? 0), 0);
  const outstanding = invs.reduce((s, i) => s + Math.max(0, Number(i.total) - Number(i.paid_amount ?? 0)), 0);
  const expensesTotal = exps.reduce((s, e) => s + Number(e.amount), 0);
  const net = total - expensesTotal;

  const exportCsv = () => {
    if (!invs.length) return;
    const rows = [
      ["Number", "Date", "Customer", "Total", "Paid", "Due", "Status", "Payment"],
      ...invs.map((i) => [
        i.number, i.date, i.customer_name, i.total,
        i.paid_amount ?? 0,
        Math.max(0, Number(i.total) - Number(i.paid_amount ?? 0)),
        i.status, i.payment_mode,
      ]),
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
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="Revenue" value={inr(total)} icon={IndianRupee} tone="success" />
        <MetricCard label="Collected" value={inr(collected)} icon={FileText} />
        <MetricCard label="Outstanding" value={inr(outstanding)} icon={BookOpen} tone="warning" />
        <MetricCard label="Expenses" value={inr(expensesTotal)} icon={Receipt} tone="danger" />
        <MetricCard label="Net" value={inr(net)} icon={TrendingUp} tone={net >= 0 ? "success" : "danger"} hint={`${invs.length} invoices`} />
      </div>
      {isLoading ? <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Loading…</div> :
        invs.length === 0 ? <EmptyState icon={BookOpen} title="No transactions in range" /> :
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Number</th>
                <th className="px-3 py-2 text-left">Customer</th>
                <th className="px-3 py-2 text-center">Mode</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">Paid</th>
                <th className="px-3 py-2 text-right">Due</th>
                <th className="px-3 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {invs.map((i) => {
                const due = Math.max(0, Number(i.total) - Number(i.paid_amount ?? 0));
                return (
                  <tr key={i.id} className="border-t">
                    <td className="px-3 py-2 text-muted-foreground">{fmtDate(i.date)}</td>
                    <td className="px-3 py-2 font-medium">{i.number}</td>
                    <td className="px-3 py-2">{i.customer_name}</td>
                    <td className="px-3 py-2 text-center text-muted-foreground">{i.payment_mode}</td>
                    <td className="px-3 py-2 text-right font-semibold">{inr(Number(i.total))}</td>
                    <td className="px-3 py-2 text-right">{inr(Number(i.paid_amount ?? 0))}</td>
                    <td className="px-3 py-2 text-right">
                      {due > 0 ? <span className="text-destructive font-medium">{inr(due)}</span> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2 text-center"><StatusBadge status={i.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>}
    </div>
  );
}
