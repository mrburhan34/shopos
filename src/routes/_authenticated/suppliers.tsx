import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PageHeader, EmptyState } from "@/components/shopos/Bits";
import { Plus, Truck, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/suppliers")({ component: Suppliers });

function Suppliers() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("suppliers").delete().eq("id", id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); toast.success("Deleted"); },
  });

  return (
    <div>
      <PageHeader title="Suppliers" subtitle="Your supplier contacts"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="size-4 mr-1" />Add supplier</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New supplier</DialogTitle></DialogHeader>
              <SupForm onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["suppliers"] }); }} />
            </DialogContent>
          </Dialog>
        } />
      {isLoading ? <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Loading…</div> :
        !data || data.length === 0 ? <EmptyState icon={Truck} title="No suppliers" description="Track your wholesale and inventory suppliers here." /> :
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((s) => (
            <div key={s.id} className="rounded-lg border bg-card p-4">
              <div className="flex justify-between">
                <div>
                  <div className="font-semibold">{s.name}</div>
                  {s.phone && <div className="text-xs text-muted-foreground">{s.phone}</div>}
                  {s.address && <div className="text-xs text-muted-foreground">{s.address}</div>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => del.mutate(s.id)}><Trash2 className="size-4" /></Button>
              </div>
              {s.notes && <p className="mt-2 text-xs text-muted-foreground">{s.notes}</p>}
            </div>
          ))}
        </div>}
    </div>
  );
}

function SupForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ name: "", phone: "", address: "", notes: "" });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("suppliers").insert({ ...f, user_id: u.user!.id });
    if (error) return toast.error(error.message);
    toast.success("Saved"); onDone();
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <div><Label>Name</Label><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <div><Label>Phone</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
      <div><Label>Address</Label><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
      <div><Label>Notes</Label><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
      <Button type="submit" className="w-full">Save</Button>
    </form>
  );
}
