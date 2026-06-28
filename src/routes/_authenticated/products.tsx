import { humanizeError } from "@/lib/errors";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PageHeader, EmptyState } from "@/components/shopos/Bits";
import { Plus, Package, AlertTriangle, Trash2, Pencil } from "lucide-react";
import { inr } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({
    meta: [
      { title: "Products — ShopOS" },
      { name: "description", content: "Manage your product catalogue, pricing, GST rates, and low-stock alerts in ShopOS." },
      { property: "og:title", content: "Products — ShopOS" },
      { property: "og:description", content: "Manage your product catalogue, pricing, GST rates, and low-stock alerts in ShopOS." },
      { property: "og:url", content: "https://shopos.lovable.app/products" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://shopos.lovable.app/products" }],
  }),
  component: Products,
});

function Products() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("products").delete().eq("id", id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); toast.success("Deleted"); },
  });

  const lowStock = (data ?? []).filter((p) => Number(p.qty) <= Number(p.threshold));

  return (
    <div>
      <PageHeader
        title="Products" subtitle="Inventory and pricing"
        actions={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEdit(null); }}>
            <DialogTrigger asChild><Button><Plus className="size-4 mr-1" />Add product</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{edit ? "Edit product" : "New product"}</DialogTitle></DialogHeader>
              <ProductForm initial={edit} onDone={() => { setOpen(false); setEdit(null); qc.invalidateQueries({ queryKey: ["products"] }); }} />
            </DialogContent>
          </Dialog>
        }
      />

      {lowStock.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <AlertTriangle className="size-4 text-destructive" />
          <span><b>{lowStock.length}</b> product{lowStock.length > 1 ? "s" : ""} below threshold: {lowStock.slice(0, 3).map((p) => p.name).join(", ")}{lowStock.length > 3 ? "…" : ""}</span>
        </div>
      )}

      {isLoading ? <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Loading…</div> :
        !data || data.length === 0 ? <EmptyState icon={Package} title="No products yet" description="Add your first product to track stock and prices." action={<Button onClick={() => setOpen(true)}><Plus className="size-4 mr-1"/>Add product</Button>} /> :
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr><th className="px-3 py-2 text-left">Name</th><th className="px-3 py-2 text-left">Category</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Price</th><th className="px-3 py-2 text-right">GST</th><th className="px-3 py-2"></th></tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{p.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{p.category ?? "—"}</td>
                  <td className={`px-3 py-2 text-right ${Number(p.qty) <= Number(p.threshold) ? "text-destructive font-semibold" : ""}`}>{p.qty} {p.unit}</td>
                  <td className="px-3 py-2 text-right">{inr(Number(p.selling_price))}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{p.gst}%</td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="ghost" size="icon" onClick={() => { setEdit(p); setOpen(true); }}><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => del.mutate(p.id)}><Trash2 className="size-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
    </div>
  );
}

function ProductForm({ initial, onDone }: { initial?: any; onDone: () => void }) {
  const [f, setF] = useState({
    name: initial?.name ?? "", category: initial?.category ?? "",
    qty: initial?.qty ?? 0, unit: initial?.unit ?? "pcs",
    selling_price: initial?.selling_price ?? 0, purchase_price: initial?.purchase_price ?? 0,
    gst: initial?.gst ?? 18, threshold: initial?.threshold ?? 5,
  });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: u } = await supabase.auth.getUser();
    if (initial) {
      const { error } = await supabase.from("products").update(f).eq("id", initial.id);
      if (error) return toast.error(humanizeError(error));
    } else {
      const { error } = await supabase.from("products").insert({ ...f, user_id: u.user!.id });
      if (error) return toast.error(humanizeError(error));
    }
    toast.success("Saved");
    onDone();
  };
  const upd = (k: string, v: any) => setF({ ...f, [k]: v });
  return (
    <form onSubmit={submit} className="space-y-3">
      <div><Label>Name</Label><Input required value={f.name} onChange={(e) => upd("name", e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Category</Label><Input value={f.category} onChange={(e) => upd("category", e.target.value)} /></div>
        <div><Label>Unit</Label><Input value={f.unit} onChange={(e) => upd("unit", e.target.value)} /></div>
        <div><Label>Quantity</Label><Input type="number" value={f.qty} onChange={(e) => upd("qty", Number(e.target.value))} /></div>
        <div><Label>Low stock threshold</Label><Input type="number" value={f.threshold} onChange={(e) => upd("threshold", Number(e.target.value))} /></div>
        <div><Label>Purchase ₹</Label><Input type="number" value={f.purchase_price} onChange={(e) => upd("purchase_price", Number(e.target.value))} /></div>
        <div><Label>Selling ₹</Label><Input type="number" value={f.selling_price} onChange={(e) => upd("selling_price", Number(e.target.value))} /></div>
        <div><Label>GST %</Label><Input type="number" value={f.gst} onChange={(e) => upd("gst", Number(e.target.value))} /></div>
      </div>
      <Button type="submit" className="w-full">Save</Button>
    </form>
  );
}
