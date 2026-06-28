import { humanizeError } from "@/lib/errors";
import { createFileRoute, useNavigate, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { Store, Sparkles, BarChart3, MessageCircle, Receipt } from "lucide-react";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) nav({ to: "/dashboard" });
    });
    return () => sub.subscription.unsubscribe();
  }, [nav]);

  const onEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast.error(humanizeError(error));
    else toast.success("Welcome back");
  };

  const onGoogle = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/dashboard" });
    if (r.error) toast.error("Google sign-in failed");
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="hidden bg-primary text-primary-foreground p-10 lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary-foreground/15">
            <Store className="size-5" />
          </div>
          <span className="text-lg font-semibold">ShopOS</span>
        </div>
        <div>
          <h2 className="text-3xl font-semibold leading-tight">Run your shop smarter</h2>
          <p className="mt-2 text-primary-foreground/80">మీ షాపును స్మార్ట్‌గా నడపండి</p>
          <ul className="mt-8 space-y-4 text-sm">
            {[
              { i: Receipt, t: "Invoices with auto GST" },
              { i: BarChart3, t: "Daily revenue & analytics" },
              { i: Sparkles, t: "AI insights in Telugu & English" },
              { i: MessageCircle, t: "WhatsApp customer alerts" },
            ].map((f, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-md bg-primary-foreground/15">
                  <f.i className="size-4" />
                </span>
                {f.t}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-primary-foreground/70">Made for shops in Anantapur, Andhra Pradesh</p>
      </aside>

      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Store className="size-5" />
            </div>
            <span className="text-lg font-semibold">ShopOS</span>
          </div>
          <h1 className="text-2xl font-semibold">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to continue managing your shop.</p>

          <Button variant="outline" className="mt-6 w-full h-11" onClick={onGoogle}>
            <GoogleIcon /> Continue with Google
          </Button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> OR <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={onEmail} className="space-y-3">
            <div>
              <Label htmlFor="e">Email</Label>
              <Input id="e" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 h-11" />
            </div>
            <div>
              <div className="flex justify-between">
                <Label htmlFor="p">Password</Label>
                <Link to="/reset-password" className="text-xs text-primary hover:underline">Forgot?</Link>
              </div>
              <Input id="p" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 h-11" />
            </div>
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            New to ShopOS? <Link to="/register" className="text-primary font-medium hover:underline">Create account</Link>
          </p>
        </div>
      </main>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 mr-2" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.96h5.52c-.24 1.44-1.68 4.2-5.52 4.2-3.36 0-6.12-2.76-6.12-6.12S8.64 6.12 12 6.12c1.92 0 3.18.84 3.9 1.5l2.64-2.58C16.92 3.6 14.7 2.64 12 2.64 6.84 2.64 2.64 6.84 2.64 12S6.84 21.36 12 21.36c6.96 0 9.6-4.86 9.6-9 0-.6-.06-1.08-.12-1.56H12z" />
    </svg>
  );
}
