import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PageHeader, EmptyState, StatusBadge } from "@/components/shopos/Bits";
import { Plus, FileText, Trash2, Printer } from "lucide-react";
import { inr, fmtDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/invoices")({ component: Invoices });

type Item = { name: string; qty: number; rate: number; gst: number };

function Invoices() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState<any>(null);

  const { data: invs, isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, invoice_items(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoices"] }); toast.success("Deleted"); },
  });

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle="Create and manage your sales invoices."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="size-4 mr-1" />New Invoice</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>New Invoice</DialogTitle></DialogHeader>
              <InvoiceForm onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["invoices"] }); }} />
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading ? (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Loading…</div>
      ) : !invs || invs.length === 0 ? (
        <EmptyState icon={FileText} title="No invoices yet" description="Create your first invoice to start tracking sales." />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-hidden rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Number</th>
                  <th className="px-3 py-2 text-left">Customer</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {invs.map((i: any) => (
                  <tr key={i.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{i.number}</td>
                    <td className="px-3 py-2">{i.customer_name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{fmtDate(i.date)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{inr(Number(i.total))}</td>
                    <td className="px-3 py-2"><StatusBadge status={i.status} /></td>
                    <td className="px-3 py-2 text-right">
                      <Button variant="ghost" size="icon" onClick={() => setPrintOpen(i)}><Printer className="size-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => del.mutate(i.id)}><Trash2 className="size-4" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {invs.map((i: any) => (
              <div key={i.id} className="rounded-lg border bg-card p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">{i.number}</div>
                    <div className="font-medium">{i.customer_name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{inr(Number(i.total))}</div>
                    <StatusBadge status={i.status} />
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{fmtDate(i.date)}</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setPrintOpen(i)}><Printer className="size-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => del.mutate(i.id)}><Trash2 className="size-4" /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Dialog open={!!printOpen} onOpenChange={(o) => !o && setPrintOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Invoice {printOpen?.number}</DialogTitle></DialogHeader>
          {printOpen && <InvoicePreview inv={printOpen} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InvoiceForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [status, setStatus] = useState("Paid");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Item[]>([{ name: "", qty: 1, rate: 0, gst: 18 }]);
  const [saving, setSaving] = useState(false);

  const updateItem = (i: number, k: keyof Item, v: any) => {
    const c = [...items]; (c[i] as any)[k] = v; setItems(c);
  };
  const subtotal = items.reduce((s, it) => s + Number(it.qty) * Number(it.rate), 0);
  const totalGst = items.reduce((s, it) => s + (Number(it.qty) * Number(it.rate) * Number(it.gst)) / 100, 0);
  const cgst = totalGst / 2, sgst = totalGst / 2;
  const total = subtotal + totalGst;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Customer name is required");
    if (items.some((i) => !i.name.trim())) return toast.error("All item names required");
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const userId = u.user!.id;
    const number = "INV-" + Date.now().toString().slice(-6);
    const { data: inv, error } = await supabase.from("invoices").insert({
      user_id: userId, number, customer_name: name, customer_phone: phone || null,
      date, subtotal, cgst, sgst, total, payment_mode: paymentMode, status, notes: notes || null,
    }).select().single();
    if (error) { setSaving(false); return toast.error(error.message); }

    const itemsRows = items.map((it) => ({
      invoice_id: inv.id, name: it.name, qty: it.qty, rate: it.rate, gst: it.gst,
      amount: it.qty * it.rate * (1 + it.gst / 100),
    }));
    await supabase.from("invoice_items").insert(itemsRows);

    // auto-link/create customer if phone provided
    if (phone) {
      const { data: existing } = await supabase.from("customers").select("id").eq("phone", phone).maybeSingle();
      if (!existing) {
        await supabase.from("customers").insert({ user_id: userId, name, phone, last_visit: new Date().toISOString() });
      }
    }
    setSaving(false);
    toast.success("Invoice created");
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Customer name *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter customer's name" required />
        </div>
        <div>
          <Label>Customer phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
        </div>
        <div>
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label>Payment mode</Label>
          <select className="flex h-9 w-full rounded-md border bg-background px-3 text-sm" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
            {["Cash","UPI","Card","Credit"].map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label>Line items</Label>
          <Button type="button" size="sm" variant="outline" onClick={() => setItems([...items, { name: "", qty: 1, rate: 0, gst: 18 }])}>
            <Plus className="size-3 mr-1" /> Add item
          </Button>
        </div>
        <div className="space-y-2">
          {items.map((it, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2">
              <Input className="col-span-12 sm:col-span-5" placeholder="Item name" value={it.name} onChange={(e) => updateItem(idx, "name", e.target.value)} />
              <Input className="col-span-3 sm:col-span-2" type="number" min={1} placeholder="Qty" value={it.qty} onChange={(e) => updateItem(idx, "qty", Number(e.target.value))} />
              <Input className="col-span-4 sm:col-span-2" type="number" min={0} placeholder="Rate" value={it.rate} onChange={(e) => updateItem(idx, "rate", Number(e.target.value))} />
              <Input className="col-span-3 sm:col-span-2" type="number" min={0} placeholder="GST%" value={it.gst} onChange={(e) => updateItem(idx, "gst", Number(e.target.value))} />
              <Button type="button" variant="ghost" size="icon" className="col-span-2 sm:col-span-1" onClick={() => setItems(items.filter((_, i) => i !== idx))}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Status</Label>
          <select className="flex h-9 w-full rounded-md border bg-background px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
            {["Paid","Unpaid","Partial","Draft"].map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <Label>Notes</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
        </div>
      </div>

      <div className="rounded-lg border bg-muted/40 p-3 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{inr(subtotal)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">CGST</span><span>{inr(cgst)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">SGST</span><span>{inr(sgst)}</span></div>
        <div className="mt-2 flex justify-between border-t pt-2 text-base font-semibold"><span>Total</span><span>{inr(total)}</span></div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Generate Invoice"}</Button>
      </div>
    </form>
  );
}

function InvoicePreview({ inv }: { inv: any }) {
  return (
    <div>
      <div className="rounded-lg border bg-white p-6 text-black print:border-0">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold">Tax Invoice</h2>
            <p className="text-sm text-gray-600">{inv.number}</p>
          </div>
          <div className="text-right text-sm">
            <div className="font-semibold">ShopOS</div>
            <div className="text-gray-600">Anantapur, AP</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-500">Bill to</div>
            <div className="font-medium">{inv.customer_name}</div>
            {inv.customer_phone && <div className="text-gray-600">{inv.customer_phone}</div>}
          </div>
          <div className="text-right">
            <div className="text-gray-500">Date</div>
            <div>{fmtDate(inv.date)}</div>
          </div>
        </div>
        <table className="mt-4 w-full text-sm">
          <thead className="border-b text-xs uppercase text-gray-500">
            <tr><th className="text-left py-1">Item</th><th className="text-right">Qty</th><th className="text-right">Rate</th><th className="text-right">GST</th><th className="text-right">Amount</th></tr>
          </thead>
          <tbody>
            {(inv.invoice_items ?? []).map((it: any) => (
              <tr key={it.id} className="border-b"><td className="py-1">{it.name}</td><td className="text-right">{it.qty}</td><td className="text-right">{inr(Number(it.rate))}</td><td className="text-right">{it.gst}%</td><td className="text-right">{inr(Number(it.amount))}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 ml-auto w-full max-w-xs text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{inr(Number(inv.subtotal))}</span></div>
          <div className="flex justify-between"><span>CGST</span><span>{inr(Number(inv.cgst))}</span></div>
          <div className="flex justify-between"><span>SGST</span><span>{inr(Number(inv.sgst))}</span></div>
          <div className="mt-1 flex justify-between border-t pt-1 font-semibold"><span>Total</span><span>{inr(Number(inv.total))}</span></div>
        </div>
        <div className="mt-6 text-xs text-gray-500">Payment: {inv.payment_mode} · Status: {inv.status}</div>
      </div>
      <div className="mt-3 flex justify-end no-print">
        <Button onClick={() => window.print()}><Printer className="size-4 mr-1" /> Print / PDF</Button>
      </div>
    </div>
  );
}
