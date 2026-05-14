import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageHeader, MetricCard, EmptyState } from "@/components/shopos/Bits";
import { Plus, Receipt, Trash2, Pencil, IndianRupee, Calendar, Tag, ListChecks } from "lucide-react";
import { inr, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip } from "recharts";

const CATS = ["Rent", "Electricity", "Purchase", "Salary", "Other"] as const;
const COLORS = ["#6366f1", "#0ea5e9", "#f59e0b", "#10b981", "#94a3b8"];
type Cat = (typeof CATS)[number] | string;

export const Route = createFileRoute("/_authenticated/expenses")({ component: Expenses });

function Expenses() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [cat, setCat] = useState<string>("All");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [sortKey, setSortKey] = useState<"date" | "amount">("date");

  const { data, isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").order("date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Expense deleted");
    },
  });

  const all = data ?? [];
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const yearStart = new Date(new Date().getFullYear(), 0, 1);

  const monthTotal = all.filter((e) => new Date(e.date) >= monthStart).reduce((s, e) => s + Number(e.amount), 0);
  const yearTotal = all.filter((e) => new Date(e.date) >= yearStart).reduce((s, e) => s + Number(e.amount), 0);
  const byCatAll: Record<string, number> = {};
  all.forEach((e) => {
    byCatAll[e.category] = (byCatAll[e.category] ?? 0) + Number(e.amount);
  });
  const largestCat = Object.entries(byCatAll).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  // Month-only donut
  const monthByCat = useMemo(() => {
    const m: Record<string, number> = {};
    all
      .filter((e) => new Date(e.date) >= monthStart)
      .forEach((e) => {
        m[e.category] = (m[e.category] ?? 0) + Number(e.amount);
      });
    return Object.entries(m).map(([name, value], i) => ({
      name,
      value,
      color: COLORS[i % COLORS.length],
    }));
  }, [all]);

  const filtered = all
    .filter((e) => (cat === "All" ? true : e.category === cat))
    .sort((a, b) => {
      const av = sortKey === "amount" ? Number(a.amount) : new Date(a.date).getTime();
      const bv = sortKey === "amount" ? Number(b.amount) : new Date(b.date).getTime();
      return sortDir === "asc" ? av - bv : bv - av;
    });

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle="Track business spending"
        actions={
          <Dialog
            open={open || !!editing}
            onOpenChange={(o) => {
              if (!o) {
                setOpen(false);
                setEditing(null);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={() => setOpen(true)}>
                <Plus className="size-4 mr-1" />
                Add expense
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit expense" : "New expense"}</DialogTitle>
              </DialogHeader>
              <ExpenseForm
                initial={editing}
                onDone={() => {
                  setOpen(false);
                  setEditing(null);
                  qc.invalidateQueries({ queryKey: ["expenses"] });
                }}
              />
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        <MetricCard label="This month" value={inr(monthTotal)} icon={IndianRupee} tone="warning" />
        <MetricCard label="This year" value={inr(yearTotal)} icon={Calendar} />
        <MetricCard label="Largest category" value={largestCat} icon={Tag} />
        <MetricCard label="Entries" value={all.length} icon={ListChecks} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {["All", ...CATS].map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`rounded-full border px-3 py-1 text-xs ${
              cat === c
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card hover:bg-accent"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">This month by category</h3>
          {monthByCat.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={monthByCat} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75}>
                    {monthByCat.map((_, i) => (
                      <Cell key={i} fill={monthByCat[i].color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => inr(Number(v))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">No data</p>
          )}
        </div>

        <div className="lg:col-span-2 overflow-x-auto rounded-lg border bg-card">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <EmptyState icon={Receipt} title="No expenses logged" description="Use Add expense to record your first one." />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th
                    className="px-3 py-2 text-left cursor-pointer select-none"
                    onClick={() => {
                      if (sortKey === "date") setSortDir(sortDir === "asc" ? "desc" : "asc");
                      else {
                        setSortKey("date");
                        setSortDir("desc");
                      }
                    }}
                  >
                    Date {sortKey === "date" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                  </th>
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-left">Notes</th>
                  <th
                    className="px-3 py-2 text-right cursor-pointer select-none"
                    onClick={() => {
                      if (sortKey === "amount") setSortDir(sortDir === "asc" ? "desc" : "asc");
                      else {
                        setSortKey("amount");
                        setSortDir("desc");
                      }
                    }}
                  >
                    Amount {sortKey === "amount" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                  </th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => {
                  const colorIdx = CATS.indexOf(e.category as any);
                  const c = colorIdx >= 0 ? COLORS[colorIdx] : COLORS[4];
                  return (
                    <tr key={e.id} className="border-t">
                      <td className="px-3 py-2 text-muted-foreground">{fmtDate(e.date)}</td>
                      <td className="px-3 py-2">
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                          style={{ background: `${c}20`, color: c }}
                        >
                          {e.category}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{e.notes ?? "—"}</td>
                      <td className="px-3 py-2 text-right font-semibold">{inr(Number(e.amount))}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <Button variant="ghost" size="icon" onClick={() => setEditing(e)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDelId(e.id)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (delId) del.mutate(delId);
                setDelId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ExpenseForm({ initial, onDone }: { initial?: any; onDone: () => void }) {
  const [f, setF] = useState({
    category: (initial?.category as Cat) ?? "Purchase",
    amount: Number(initial?.amount ?? 0),
    date: initial?.date ?? new Date().toISOString().slice(0, 10),
    notes: initial?.notes ?? "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    let receipt_url: string | null | undefined = undefined;
    if (file) {
      const path = `${u.user!.id}/${Date.now()}-${file.name}`;
      const { error: ue } = await supabase.storage.from("receipts").upload(path, file);
      if (ue) {
        setSaving(false);
        return toast.error(ue.message);
      }
      receipt_url = path;
    }
    if (initial?.id) {
      const payload: any = { ...f };
      if (receipt_url !== undefined) payload.receipt_url = receipt_url;
      const { error } = await supabase.from("expenses").update(payload).eq("id", initial.id);
      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }
      toast.success("Expense updated");
    } else {
      const { error } = await supabase
        .from("expenses")
        .insert({ ...f, user_id: u.user!.id, receipt_url: receipt_url ?? null });
      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }
      toast.success("Expense added");
    }
    setSaving(false);
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Category</Label>
          <select
            className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
            value={f.category}
            onChange={(e) => setF({ ...f, category: e.target.value })}
          >
            {CATS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>Amount</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            required
            value={f.amount}
            onChange={(e) => setF({ ...f, amount: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label>Date</Label>
          <Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </div>
        <div>
          <Label>Receipt (optional)</Label>
          <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
      </div>
      <div>
        <Label>Notes</Label>
        <Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      </div>
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "Saving…" : initial?.id ? "Update" : "Save"}
      </Button>
    </form>
  );
}
