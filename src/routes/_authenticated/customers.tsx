import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PageHeader, EmptyState } from "@/components/shopos/Bits";
import { Plus, Users, Trash2, Phone, MapPin } from "lucide-react";
import { inr } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/customers")({ component: Customers });

function Customers() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("customers").delete().eq("id", id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customers"] }); toast.success("Deleted"); },
  });

  const filtered = (data ?? []).filter((c) =>
    c.name.toLowerCase().includes(q.toLowerCase()) || (c.phone ?? "").includes(q));

  return (
    <div>
      <PageHeader title="Customers" subtitle="Your customer directory"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="size-4 mr-1" />Add customer</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New customer</DialogTitle></DialogHeader>
              <CustomerForm onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["customers"] }); }} />
            </DialogContent>
          </Dialog>
        } />

      <Input className="mb-4 max-w-sm" placeholder="Search by name or phone…" value={q} onChange={(e) => setQ(e.target.value)} />

      {isLoading ? <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Loading…</div> :
        filtered.length === 0 ? <EmptyState icon={Users} title="No customers" description="Add customers manually or they'll appear here when you create invoices with phone numbers." /> :
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <div key={c.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{c.name}</div>
                  {c.phone && <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Phone className="size-3" />{c.phone}</div>}
                  {c.address && <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="size-3" />{c.address}</div>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => del.mutate(c.id)}><Trash2 className="size-4" /></Button>
              </div>
              <div className="mt-3 flex justify-between border-t pt-2 text-xs">
                <span className="text-muted-foreground">Total: <b className="text-foreground">{inr(Number(c.total_purchases))}</b></span>
                <span className="text-muted-foreground">Dues: <b className="text-destructive">{inr(Number(c.dues))}</b></span>
              </div>
            </div>
          ))}
        </div>
      }
    </div>
  );
}

function CustomerForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ name: "", phone: "", address: "" });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("customers").insert({ ...f, user_id: u.user!.id });
    if (error) return toast.error(error.message);
    toast.success("Customer added"); onDone();
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <div><Label>Name</Label><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <div><Label>Phone</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
      <div><Label>Address</Label><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
      <Button type="submit" className="w-full">Save</Button>
    </form>
  );
}
