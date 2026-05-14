import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { Store } from "lucide-react";

export const Route = createFileRoute("/register")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: RegisterPage,
});

const schema = z
  .object({
    fullName: z.string().min(1, "Full name is required"),
    shop: z.string().min(1, "Shop name is required"),
    email: z.string().email("Enter a valid email"),
    phone: z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "Passwords do not match",
  });

function RegisterPage() {
  const nav = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    shop: "",
    email: "",
    phone: "",
    password: "",
    confirm: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        errs[i.path[0] as string] = i.message;
      });
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: window.location.origin + "/dashboard",
        data: {
          full_name: form.fullName,
          shop_name: form.shop,
          phone: form.phone,
        },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created! Welcome to ShopOS 🎉");
    if (data.session) nav({ to: "/dashboard" });
    else {
      toast.info("Check your email to verify your account.");
      nav({ to: "/login" });
    }
  };

  const onGoogle = async () => {
    const r = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/dashboard",
    });
    if (r.error) toast.error("Google sign-in failed");
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Store className="size-5" />
          </div>
          <span className="text-lg font-semibold">ShopOS</span>
        </div>
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Start running your shop in minutes.
        </p>

        <Button variant="outline" className="mt-6 w-full h-11" onClick={onGoogle}>
          Continue with Google
        </Button>
        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> OR{" "}
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <Field label="Full name" id="n" error={errors.fullName}>
            <Input
              id="n"
              value={form.fullName}
              onChange={(e) => set("fullName", e.target.value)}
              className="mt-1 h-11"
            />
          </Field>
          <Field label="Shop name" id="s" error={errors.shop}>
            <Input
              id="s"
              value={form.shop}
              onChange={(e) => set("shop", e.target.value)}
              className="mt-1 h-11"
            />
          </Field>
          <Field label="Email" id="e" error={errors.email}>
            <Input
              id="e"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              className="mt-1 h-11"
            />
          </Field>
          <Field label="Phone (10 digits)" id="ph" error={errors.phone}>
            <Input
              id="ph"
              inputMode="numeric"
              maxLength={10}
              value={form.phone}
              onChange={(e) => set("phone", e.target.value.replace(/\D/g, ""))}
              className="mt-1 h-11"
            />
          </Field>
          <Field label="Password" id="p" error={errors.password}>
            <Input
              id="p"
              type="password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              className="mt-1 h-11"
            />
          </Field>
          <Field label="Confirm password" id="pc" error={errors.confirm}>
            <Input
              id="pc"
              type="password"
              value={form.confirm}
              onChange={(e) => set("confirm", e.target.value)}
              className="mt-1 h-11"
            />
          </Field>
          <Button type="submit" className="w-full h-11" disabled={loading}>
            {loading ? "Creating…" : "Create account"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  id,
  error,
  children,
}: {
  label: string;
  id: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
