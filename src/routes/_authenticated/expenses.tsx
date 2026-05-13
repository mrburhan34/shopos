import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PageHeader, EmptyState } from "@/components/shopos/Bits";
import { Plus, Receipt, Trash2 } from "lucide-react";
import { inr, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip } from "recharts";

const CATS = ["Inventory","Rent","Salary","Utilities","Transport","Marketing","Other"];
const COLORS = ["var(--chart-1)","var(--chart-2)","var(--chart-3)","var(--chart-4)","var(--chart-5)","#6366f1","#94a3b8"];

export const Route = createFileRoute("/_authenticated/expenses")({ component: Expenses });

function Expenses() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("expenses").delete().eq("id", id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["expenses"] }); toast.success("Deleted"); },
  });

  const byCat = CATS.map((c, i) => ({
    name: c, value: (data ?? []).filter((e) => e.category === c).reduce((s, e) => s + Number(e.amount), 0),
    color: COLORS[i],
  })).filter((x) => x.value > 0);

  return (
    <div>
      <PageHeader title="Expenses" subtitle="Track business spending"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="size-4 mr-1" />Add expense</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New expense</DialogTitle></DialogHeader>
              <ExpenseForm onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["expenses"] }); }} />
            </DialogContent>
          </Dialog>
        } />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">By category</h3>
          {byCat.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={byCat} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70}>
                    {byCat.map((_, i) => <Cell key={i} fill={byCat[i].color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="py-12 text-center text-sm text-muted-foreground">No data</p>}
        </div>

        <div className="lg:col-span-2 overflow-hidden rounded-lg border bg-card">
          {isLoading ? <p className="p-6 text-sm text-muted-foreground">Loading…</p> :
            !data || data.length === 0 ? <EmptyState icon={Receipt} title="No expenses logged" /> :
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Category</th><th className="px-3 py-2 text-left">Notes</th><th className="px-3 py-2 text-right">Amount</th><th></th></tr>
              </thead>
              <tbody>
                {data.map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="px-3 py-2 text-muted-foreground">{fmtDate(e.date)}</td>
                    <td className="px-3 py-2">{e.category}</td>
                    <td className="px-3 py-2 text-muted-foreground">{e.notes ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-semibold">{inr(Number(e.amount))}</td>
                    <td className="px-3 py-2 text-right"><Button variant="ghost" size="icon" onClick={() => del.mutate(e.id)}><Trash2 className="size-4" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>}
        </div>
      </div>
    </div>
  );
}

function ExpenseForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({
    category: "Inventory", amount: 0, date: new Date().toISOString().slice(0, 10), notes: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: u } = await supabase.auth.getUser();
    let receipt_url: string | null = null;
    if (file) {
      const path = `${u.user!.id}/${Date.now()}-${file.name}`;
      const { error: ue } = await supabase.storage.from("receipts").upload(path, file);
      if (ue) return toast.error(ue.message);
      receipt_url = path;
    }
    const { error } = await supabase.from("expenses").insert({ ...f, user_id: u.user!.id, receipt_url });
    if (error) return toast.error(error.message);
    toast.success("Expense added"); onDone();
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Category</Label>
          <select className="flex h-9 w-full rounded-md border bg-background px-3 text-sm" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            {CATS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div><Label>Amount</Label><Input type="number" required value={f.amount} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} /></div>
        <div><Label>Date</Label><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
        <div><Label>Receipt (optional)</Label><Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
      </div>
      <div><Label>Notes</Label><Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
      <Button type="submit" className="w-full">Save</Button>
    </form>
  );
}
