import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Sidebar } from "@/components/shopos/Sidebar";
import { Navbar } from "@/components/shopos/Navbar";
import { TrialBanner } from "@/components/shopos/TrialBanner";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSync } from "@/lib/realtime";
import { useSubscription } from "@/hooks/use-subscription";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: AuthLayout,
});

function AuthLayout() {
  useRealtimeSync();
  const { data: sub } = useSubscription();
  const nav = useNavigate();
  useEffect(() => {
    if (sub?.status === "expired") nav({ to: "/subscribe" });
  }, [sub?.status, nav]);

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <TrialBanner />
        <Navbar />
        <main className="flex-1 overflow-x-hidden p-4 md:p-6 pb-20 lg:pb-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
