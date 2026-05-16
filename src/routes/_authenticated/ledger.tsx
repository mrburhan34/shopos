import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, MetricCard, StatusBadge, EmptyState } from "@/components/shopos/Bits";
import { Download, IndianRupee, FileText, BookOpen, TrendingUp, Receipt } from "lucide-react";
import { inr, fmtDate } from "@/lib/format";
import { parseISO } from "date-fns";
import { buildProductCostMap, computeGrossProfit } from "@/lib/profit";

export const Route = createFileRoute("/_authenticated/ledger")({ component: Ledger });

function Ledger() {
  const start = new Date(); start.setDate(start.getDate() - 30);
  const [from, setFrom] = useState(start.toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const { data, isLoading } = useQuery({
    queryKey: ["ledger", from, to],
    queryFn: async () => {
      const [invs, exps, prods] = await Promise.all([
        supabase
          .from("invoices")
          .select("*, invoice_items(id,name,qty,rate,amount,gst,product_id)")
          .order("date", { ascending: false }),
        supabase.from("expenses").select("amount,date"),
        supabase.from("products").select("id,name,purchase_price"),
      ]);
      if (invs.error) throw invs.error;
      return {
        invs: invs.data ?? [],
        exps: exps.data ?? [],
        prods: prods.data ?? [],
      };
    },
  });

  const inRange = (dateStr: string) => {
    const t = parseISO(dateStr).getTime();
    const s = parseISO(from); s.setHours(0, 0, 0, 0);
    const e = parseISO(to); e.setHours(23, 59, 59, 999);
    return t >= s.getTime() && t <= e.getTime();
  };

  const invs = (data?.invs ?? []).filter((i: any) => inRange(i.date));
  const exps = (data?.exps ?? []).filter((e: any) => inRange(e.date));
  const prods = data?.prods ?? [];

  const total = invs.reduce((s: number, i: any) => s + Number(i.total), 0);
  const expensesTotal = exps.reduce((s: number, e: any) => s + Number(e.amount), 0);

  // Gross profit from Paid invoices' line items
  const costMap = buildProductCostMap(prods as any);
  const paidItems = invs
    .filter((i: any) => i.status === "Paid")
    .flatMap((i: any) => (i.invoice_items ?? []) as any[]);
  const grossProfit = computeGrossProfit(paidItems, costMap);

  const exportCsv = () => {
    if (!invs.length) return;
    const rows = [
      ["Date", "Number", "Customer", "Amount", "GST", "Grand Total", "Payment", "Status"],
      ...invs.map((i: any) => [
        i.date,
        i.number,
        i.customer_name,
        i.subtotal,
        Number(i.cgst) + Number(i.sgst),
        i.total,
        i.payment_mode,
        i.status,
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
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total Revenue" value={inr(total)} icon={IndianRupee} tone="success" />
        <MetricCard label="Total Expenses" value={inr(expensesTotal)} icon={Receipt} tone="danger" />
        <MetricCard label="Gross Profit" value={inr(grossProfit)} icon={TrendingUp} tone={grossProfit >= 0 ? "success" : "danger"} hint="selling − purchase cost" />
        <MetricCard label="Transactions" value={invs.length} icon={FileText} />
      </div>
      {isLoading ? <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Loading…</div> :
        invs.length === 0 ? <EmptyState icon={BookOpen} title="No transactions in range" /> :
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">INV number</th>
                <th className="px-3 py-2 text-left">Customer</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-right">GST</th>
                <th className="px-3 py-2 text-right">Grand Total</th>
                <th className="px-3 py-2 text-center">Payment</th>
                <th className="px-3 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {invs.map((i: any) => {
                const gst = Number(i.cgst) + Number(i.sgst);
                return (
                  <tr key={i.id} className="border-t">
                    <td className="px-3 py-2 text-muted-foreground">{fmtDate(i.date)}</td>
                    <td className="px-3 py-2 font-medium">{i.number}</td>
                    <td className="px-3 py-2">{i.customer_name}</td>
                    <td className="px-3 py-2 text-right">{inr(Number(i.subtotal))}</td>
                    <td className="px-3 py-2 text-right">{inr(gst)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{inr(Number(i.total))}</td>
                    <td className="px-3 py-2 text-center text-muted-foreground">{i.payment_mode}</td>
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
