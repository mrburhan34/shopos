import { humanizeError } from "@/lib/errors";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({ component: ResetPage });

function ResetPage() {
  const [email, setEmail] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash.includes("type=recovery")) setRecovery(true);
  }, []);

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });
    if (error) toast.error(humanizeError(error));
    else toast.success("Reset link sent. Check your inbox.");
  };
  const updatePwd = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    if (error) toast.error(humanizeError(error));
    else toast.success("Password updated. Sign in.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold">{recovery ? "Set a new password" : "Reset password"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {recovery ? "Enter a new password for your account." : "We'll email you a reset link."}
        </p>
        {recovery ? (
          <form onSubmit={updatePwd} className="mt-6 space-y-3">
            <div>
              <Label htmlFor="np">New password</Label>
              <Input id="np" type="password" required minLength={6} value={newPwd} onChange={(e) => setNewPwd(e.target.value)} className="mt-1 h-11" />
            </div>
            <Button type="submit" className="w-full h-11">Update password</Button>
          </form>
        ) : (
          <form onSubmit={sendLink} className="mt-6 space-y-3">
            <div>
              <Label htmlFor="re">Email</Label>
              <Input id="re" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 h-11" />
            </div>
            <Button type="submit" className="w-full h-11">Send reset link</Button>
          </form>
        )}
        <p className="mt-6 text-center text-sm">
          <Link to="/login" className="text-primary hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
