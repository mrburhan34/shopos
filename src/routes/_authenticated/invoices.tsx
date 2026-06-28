import { humanizeError } from "@/lib/errors";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { PageHeader, EmptyState, StatusBadge } from "@/components/shopos/Bits";
import {
  Plus,
  FileText,
  Trash2,
  Printer,
  Search,
  Wallet,
  ChevronsUpDown,
} from "lucide-react";
import { inr, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { parseISO } from "date-fns";

export const Route = createFileRoute("/_authenticated/invoices")({
  head: () => ({
    meta: [
      { title: "Invoices — ShopOS" },
      { name: "description", content: "Create, search, and share GST-compliant invoices. Track partial payments and outstanding balances in ShopOS." },
      { property: "og:title", content: "Invoices — ShopOS" },
      { property: "og:description", content: "Create, search, and share GST-compliant invoices. Track partial payments and outstanding balances in ShopOS." },
      { property: "og:url", content: "https://shopos.lovable.app/invoices" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://shopos.lovable.app/invoices" }],
  }),
  component: Invoices,
});

type Item = {
  name: string;
  qty: number;
  rate: number;
  gst: number;
  product_id?: string | null;
};

function Invoices() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState<any>(null);
  const [payOpen, setPayOpen] = useState<any>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").single();
      return data;
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Invoice deleted");
    },
  });

  const filtered = (invs ?? []).filter((i: any) => {
    const matchesSearch = !search.trim()
      ? true
      : (i.number ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (i.customer_name ?? "").toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (dateFrom || dateTo) {
      const inv = parseISO(i.date).getTime();
      if (dateFrom) {
        const start = parseISO(dateFrom); start.setHours(0, 0, 0, 0);
        if (inv < start.getTime()) return false;
      }
      if (dateTo) {
        const end = parseISO(dateTo); end.setHours(23, 59, 59, 999);
        if (inv > end.getTime()) return false;
      }
    }
    return true;
  });




  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle="Create and manage your sales invoices."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4 mr-1" />
                New Invoice
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>New Invoice</DialogTitle>
              </DialogHeader>
              <InvoiceForm
                onDone={() => {
                  setOpen(false);
                  qc.invalidateQueries({ queryKey: ["invoices"] });
                  qc.invalidateQueries({ queryKey: ["customers"] });
                  qc.invalidateQueries({ queryKey: ["products"] });
                }}
              />
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by INV number or customer…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">From</label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">To</label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        {(dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); }}>Clear</Button>
        )}
      </div>

      {isLoading ? (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Loading…
        </div>
      ) : !invs || invs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No invoices yet"
          description="Create your first invoice to start tracking sales."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matches"
          description="Try a different search term."
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Number</th>
                  <th className="px-3 py-2 text-left">Customer</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Due</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i: any) => {
                  const due = Math.max(
                    0,
                    Number(i.total) - Number(i.paid_amount ?? 0)
                  );
                  return (
                    <tr key={i.id} className="border-t">
                      <td className="px-3 py-2 font-medium">{i.number}</td>
                      <td className="px-3 py-2">{i.customer_name}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {fmtDate(i.date)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {inr(Number(i.total))}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {due > 0 ? (
                          <span className="text-destructive font-medium">
                            {inr(due)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={i.status} />
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {due > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Record payment"
                            onClick={() => setPayOpen(i)}
                          >
                            <Wallet className="size-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setPrintOpen(i)}
                        >
                          <Printer className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDelId(i.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {filtered.map((i: any) => {
              const due = Math.max(
                0,
                Number(i.total) - Number(i.paid_amount ?? 0)
              );
              return (
                <div key={i.id} className="rounded-lg border bg-card p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground">
                        {i.number}
                      </div>
                      <div className="font-medium">{i.customer_name}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">
                        {inr(Number(i.total))}
                      </div>
                      {due > 0 && (
                        <div className="text-xs text-destructive">
                          Due {inr(due)}
                        </div>
                      )}
                      <StatusBadge status={i.status} />
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{fmtDate(i.date)}</span>
                    <div className="flex gap-1">
                      {due > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setPayOpen(i)}
                        >
                          <Wallet className="size-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setPrintOpen(i)}
                      >
                        <Printer className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDelId(i.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <Dialog open={!!printOpen} onOpenChange={(o) => !o && setPrintOpen(null)}>
        <DialogContent className="max-w-[480px] sm:max-w-[480px] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Invoice {printOpen?.number}</DialogTitle>
          </DialogHeader>
          {printOpen && <InvoicePreview inv={printOpen} profile={profile} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!payOpen} onOpenChange={(o) => !o && setPayOpen(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
          </DialogHeader>
          {payOpen && (
            <RecordPaymentForm
              inv={payOpen}
              onDone={() => {
                setPayOpen(null);
                qc.invalidateQueries({ queryKey: ["invoices"] });
                qc.invalidateQueries({ queryKey: ["customers"] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Customer dues will not be auto-adjusted.
            </AlertDialogDescription>
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

function InvoiceForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [status, setStatus] = useState("Paid");
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Item[]>([
    { name: "", qty: 1, rate: 0, gst: 18, product_id: null },
  ]);
  const [saving, setSaving] = useState(false);

  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("customers")
        .select("*")
        .order("name");
      return data ?? [];
    },
  });
  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*")
        .order("name");
      return data ?? [];
    },
  });

  const updateItem = (i: number, k: keyof Item, v: any) => {
    const c = [...items];
    (c[i] as any)[k] = v;
    setItems(c);
  };

  const subtotal = items.reduce(
    (s, it) => s + Number(it.qty) * Number(it.rate),
    0
  );
  const totalGst = items.reduce(
    (s, it) =>
      s + (Number(it.qty) * Number(it.rate) * Number(it.gst)) / 100,
    0
  );
  const cgst = totalGst / 2;
  const sgst = totalGst / 2;
  const total = subtotal + totalGst;
  const due = Math.max(0, total - Number(paidAmount || 0));

  // Auto-sync paid amount when status changes or total changes
  const onStatusChange = (s: string) => {
    setStatus(s);
    if (s === "Paid") setPaidAmount(total);
    else if (s === "Unpaid" || s === "Draft") setPaidAmount(0);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Customer name is required");
    if (items.some((i) => !i.name.trim()))
      return toast.error("All item names required");

    let finalStatus = status;
    let finalPaid = Number(paidAmount || 0);
    if (finalStatus === "Paid") finalPaid = total;
    else if (finalStatus === "Unpaid" || finalStatus === "Draft") finalPaid = 0;
    else if (finalStatus === "Partial") {
      if (finalPaid <= 0) finalStatus = "Unpaid";
      else if (finalPaid >= total) {
        finalStatus = "Paid";
        finalPaid = total;
      }
    }

    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const userId = u.user!.id;
    const number = "INV-" + Date.now().toString().slice(-6);

    // Resolve customer (link or create)
    let cId = customerId;
    if (!cId) {
      const lookup = (customers ?? []).find(
        (c: any) =>
          c.name.toLowerCase() === name.trim().toLowerCase() ||
          (phone && c.phone === phone)
      );
      if (lookup) cId = lookup.id;
      else {
        const { data: newCust } = await supabase
          .from("customers")
          .insert({
            user_id: userId,
            name: name.trim(),
            phone: phone || null,
            address: address || null,
            last_visit: new Date().toISOString(),
          })
          .select()
          .single();
        cId = newCust?.id ?? null;
      }
    }

    const { data: inv, error } = await supabase
      .from("invoices")
      .insert({
        user_id: userId,
        number,
        customer_id: cId,
        customer_name: name.trim(),
        customer_phone: phone || null,
        date,
        subtotal,
        cgst,
        sgst,
        total,
        paid_amount: finalPaid,
        payment_mode: paymentMode,
        status: finalStatus,
        notes: notes || null,
      })
      .select()
      .single();
    if (error) {
      setSaving(false);
      return toast.error(humanizeError(error));
    }

    const itemsRows = items.map((it) => ({
      invoice_id: inv.id,
      product_id: it.product_id ?? null,
      name: it.name,
      qty: it.qty,
      rate: it.rate,
      gst: it.gst,
      amount: it.qty * it.rate * (1 + it.gst / 100),
    }));
    await supabase.from("invoice_items").insert(itemsRows);

    // Inventory deduction
    const lowWarnings: string[] = [];
    for (const it of items) {
      if (it.product_id) {
        const p = (products ?? []).find((x: any) => x.id === it.product_id);
        if (!p) continue;
        const newQty = Number(p.qty) - Number(it.qty);
        await supabase
          .from("products")
          .update({ qty: newQty })
          .eq("id", it.product_id);
        if (newQty <= Number(p.threshold)) lowWarnings.push(p.name);
      }
    }

    // Update customer aggregates
    if (cId) {
      const existing = (customers ?? []).find((c: any) => c.id === cId);
      const prevTotal = Number(existing?.total_purchases ?? 0);
      const prevDues = Number(existing?.dues ?? 0);
      await supabase
        .from("customers")
        .update({
          total_purchases: prevTotal + total,
          dues: prevDues + (total - finalPaid),
          last_visit: new Date().toISOString(),
        })
        .eq("id", cId);
    }

    setSaving(false);
    toast.success("Invoice created");
    if (lowWarnings.length)
      toast.warning(`Low stock: ${lowWarnings.join(", ")}`);
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>Customer name *</Label>
          <CustomerCombobox
            customers={customers ?? []}
            value={name}
            onPick={(c) => {
              setName(c.name);
              setPhone(c.phone ?? "");
              setAddress(c.address ?? "");
              setCustomerId(c.id);
            }}
            onChangeText={(v) => {
              setName(v);
              setCustomerId(null);
            }}
          />
        </div>
        <div>
          <Label>Customer phone</Label>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <div>
          <Label>Date</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <Label>Address</Label>
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Optional"
          />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label>Line items</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setItems([
                ...items,
                { name: "", qty: 1, rate: 0, gst: 18, product_id: null },
              ])
            }
          >
            <Plus className="size-3 mr-1" /> Add item
          </Button>
        </div>
        <div className="space-y-2">
          {items.map((it, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2">
              <div className="col-span-12 sm:col-span-5">
                <ProductCombobox
                  products={products ?? []}
                  value={it.name}
                  onPick={(p) => {
                    const c = [...items];
                    c[idx] = {
                      name: p.name,
                      qty: c[idx].qty || 1,
                      rate: Number(p.selling_price),
                      gst: Number(p.gst),
                      product_id: p.id,
                    };
                    setItems(c);
                  }}
                  onChangeText={(v) => {
                    const c = [...items];
                    c[idx] = { ...c[idx], name: v, product_id: null };
                    setItems(c);
                  }}
                />
              </div>
              <Input
                className="col-span-3 sm:col-span-2"
                type="number"
                min={1}
                placeholder="Qty"
                value={it.qty}
                onChange={(e) => updateItem(idx, "qty", Number(e.target.value))}
              />
              <Input
                className="col-span-4 sm:col-span-2"
                type="number"
                min={0}
                placeholder="Rate"
                value={it.rate}
                onChange={(e) =>
                  updateItem(idx, "rate", Number(e.target.value))
                }
              />
              <Input
                className="col-span-3 sm:col-span-2"
                type="number"
                min={0}
                placeholder="GST%"
                value={it.gst}
                onChange={(e) => updateItem(idx, "gst", Number(e.target.value))}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="col-span-2 sm:col-span-1"
                onClick={() => setItems(items.filter((_, i) => i !== idx))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Payment mode</Label>
          <select
            className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value)}
          >
            {["Cash", "UPI", "Card", "Credit"].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>Status</Label>
          <select
            className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
          >
            {["Paid", "Partial", "Unpaid", "Draft"].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </div>
        {status === "Partial" && (
          <>
            <div>
              <Label>Amount paid</Label>
              <Input
                type="number"
                min={0}
                max={total}
                step="0.01"
                value={paidAmount}
                onChange={(e) => setPaidAmount(Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Balance due</Label>
              <Input
                readOnly
                value={inr(due)}
                className="text-destructive font-medium"
              />
            </div>
          </>
        )}
        <div className="sm:col-span-2">
          <Label>Notes</Label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
          />
        </div>
      </div>

      <div className="rounded-lg border bg-muted/40 p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{inr(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">CGST</span>
          <span>{inr(cgst)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">SGST</span>
          <span>{inr(sgst)}</span>
        </div>
        <div className="mt-2 flex justify-between border-t pt-2 text-base font-semibold">
          <span>Total</span>
          <span>{inr(total)}</span>
        </div>
        {status !== "Paid" && status !== "Draft" && (
          <>
            <div className="flex justify-between text-sm pt-1">
              <span className="text-muted-foreground">Paid</span>
              <span>
                {inr(status === "Partial" ? Number(paidAmount || 0) : 0)}
              </span>
            </div>
            <div className="flex justify-between text-sm font-semibold text-destructive">
              <span>Balance due</span>
              <span>
                {inr(
                  status === "Partial"
                    ? Math.max(0, total - Number(paidAmount || 0))
                    : total
                )}
              </span>
            </div>
          </>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Generate Invoice"}
        </Button>
      </div>
    </form>
  );
}

function CustomerCombobox({
  customers,
  value,
  onPick,
  onChangeText,
}: {
  customers: any[];
  value: string;
  onPick: (c: any) => void;
  onChangeText: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChangeText(e.target.value)}
          placeholder="Type or pick a customer"
          required
        />
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Pick customer"
          >
            <ChevronsUpDown className="size-4" />
          </Button>
        </PopoverTrigger>
      </div>
      <PopoverContent className="p-0 w-[320px]" align="start">
        <Command>
          <CommandInput placeholder="Search customer…" />
          <CommandList>
            <CommandEmpty>No customers. Type a new name above.</CommandEmpty>
            <CommandGroup>
              {customers.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.name} ${c.phone ?? ""}`}
                  onSelect={() => {
                    onPick(c);
                    setOpen(false);
                  }}
                >
                  <div>
                    <div className="font-medium">{c.name}</div>
                    {c.phone && (
                      <div className="text-xs text-muted-foreground">
                        {c.phone}
                      </div>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function ProductCombobox({
  products,
  value,
  onPick,
  onChangeText,
}: {
  products: any[];
  value: string;
  onPick: (p: any) => void;
  onChangeText: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChangeText(e.target.value)}
          placeholder="Item name"
        />
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Pick product"
          >
            <ChevronsUpDown className="size-4" />
          </Button>
        </PopoverTrigger>
      </div>
      <PopoverContent className="p-0 w-[320px]" align="start">
        <Command>
          <CommandInput placeholder="Search product…" />
          <CommandList>
            <CommandEmpty>No products. Type a custom name.</CommandEmpty>
            <CommandGroup>
              {products.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.name}
                  onSelect={() => {
                    onPick(p);
                    setOpen(false);
                  }}
                >
                  <div className="flex w-full justify-between">
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Stock: {Number(p.qty)} {p.unit}
                      </div>
                    </div>
                    <div className="text-sm">{inr(Number(p.selling_price))}</div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function RecordPaymentForm({
  inv,
  onDone,
}: {
  inv: any;
  onDone: () => void;
}) {
  const due = Math.max(0, Number(inv.total) - Number(inv.paid_amount ?? 0));
  const [amt, setAmt] = useState<number>(due);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pay = Math.min(due, Math.max(0, Number(amt)));
    if (pay <= 0) return toast.error("Amount must be greater than 0");
    setSaving(true);
    const newPaid = Number(inv.paid_amount ?? 0) + pay;
    const newStatus = newPaid >= Number(inv.total) ? "Paid" : "Partial";
    const { error } = await supabase
      .from("invoices")
      .update({ paid_amount: newPaid, status: newStatus })
      .eq("id", inv.id);
    if (error) {
      setSaving(false);
      return toast.error(humanizeError(error));
    }
    if (inv.customer_id) {
      const { data: c } = await supabase
        .from("customers")
        .select("dues")
        .eq("id", inv.customer_id)
        .single();
      if (c) {
        await supabase
          .from("customers")
          .update({ dues: Math.max(0, Number(c.dues) - pay) })
          .eq("id", inv.customer_id);
      }
    }
    setSaving(false);
    toast.success("Payment recorded");
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Invoice total</span>
          <span>{inr(Number(inv.total))}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Already paid</span>
          <span>{inr(Number(inv.paid_amount ?? 0))}</span>
        </div>
        <div className="flex justify-between font-semibold text-destructive">
          <span>Balance due</span>
          <span>{inr(due)}</span>
        </div>
      </div>
      <div>
        <Label>Payment amount</Label>
        <Input
          type="number"
          min={0}
          max={due}
          step="0.01"
          value={amt}
          onChange={(e) => setAmt(Number(e.target.value))}
          autoFocus
        />
      </div>
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "Saving…" : `Record ${inr(Math.min(due, Number(amt) || 0))}`}
      </Button>
    </form>
  );
}

function InvoicePreview({ inv, profile }: { inv: any; profile: any }) {
  const due = Math.max(0, Number(inv.total) - Number(inv.paid_amount ?? 0));
  return (
    <div>
      <div
        id="invoice-print-area"
        style={{
          background: "#ffffff",
          color: "#1a1a18",
          padding: "32px",
          maxWidth: "480px",
          margin: "0 auto",
          fontFamily: "sans-serif",
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold">Tax Invoice</h2>
            <p className="text-sm text-gray-600">{inv.number}</p>
          </div>
          <div className="text-right text-sm">
            <div className="font-semibold">{profile?.shop_name ?? "ShopOS"}</div>
            {profile?.address && (
              <div className="text-gray-600">{profile.address}</div>
            )}
            {profile?.phone && (
              <div className="text-gray-600">{profile.phone}</div>
            )}
            {profile?.gstin && (
              <div className="text-gray-600">GSTIN: {profile.gstin}</div>
            )}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-500">Bill to</div>
            <div className="font-medium">{inv.customer_name}</div>
            {inv.customer_phone && (
              <div className="text-gray-600">{inv.customer_phone}</div>
            )}
          </div>
          <div className="text-right">
            <div className="text-gray-500">Date</div>
            <div>{fmtDate(inv.date)}</div>
          </div>
        </div>
        <table className="mt-4 w-full text-sm">
          <thead className="border-b text-xs uppercase text-gray-500">
            <tr>
              <th className="text-left py-1">Item</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Rate</th>
              <th className="text-right">GST</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(inv.invoice_items ?? []).map((it: any) => (
              <tr key={it.id} className="border-b">
                <td className="py-1">{it.name}</td>
                <td className="text-right">{it.qty}</td>
                <td className="text-right">{inr(Number(it.rate))}</td>
                <td className="text-right">{it.gst}%</td>
                <td className="text-right">{inr(Number(it.amount))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 ml-auto w-full max-w-xs text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{inr(Number(inv.subtotal))}</span>
          </div>
          <div className="flex justify-between">
            <span>CGST</span>
            <span>{inr(Number(inv.cgst))}</span>
          </div>
          <div className="flex justify-between">
            <span>SGST</span>
            <span>{inr(Number(inv.sgst))}</span>
          </div>
          <div className="mt-1 flex justify-between border-t pt-1 font-semibold">
            <span>Total</span>
            <span>{inr(Number(inv.total))}</span>
          </div>
          <div className="flex justify-between text-green-700">
            <span>Paid</span>
            <span>{inr(Number(inv.paid_amount ?? 0))}</span>
          </div>
          {due > 0 && (
            <div className="flex justify-between font-semibold text-red-600">
              <span>Balance due</span>
              <span>{inr(due)}</span>
            </div>
          )}
        </div>
        <div className="mt-6 text-xs text-gray-500">
          Payment: {inv.payment_mode} · Status: {inv.status}
        </div>
        {!profile && (
          <div className="mt-3 text-xs text-amber-600">
            Set your shop details in Settings to display them here.
          </div>
        )}
      </div>
      <div className="mt-3 flex justify-end gap-2 no-print">
        <Button onClick={() => window.print()}>
          <Printer className="size-4 mr-1" /> Print
        </Button>
      </div>
    </div>
  );
}

