import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard, FileText, Users, Package, Truck, BookOpen,
  Receipt, BarChart3, Sparkles, MessageCircle, Settings, Store, LogOut,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const sections: { label: string; items: { to: string; icon: any; key: any }[] }[] = [
  { label: "MAIN", items: [
    { to: "/dashboard", icon: LayoutDashboard, key: "dashboard" },
  ]},
  { label: "BUSINESS", items: [
    { to: "/invoices", icon: FileText, key: "invoices" },
    { to: "/customers", icon: Users, key: "customers" },
    { to: "/products", icon: Package, key: "products" },
    { to: "/suppliers", icon: Truck, key: "suppliers" },
  ]},
  { label: "FINANCE", items: [
    { to: "/ledger", icon: BookOpen, key: "ledger" },
    { to: "/expenses", icon: Receipt, key: "expenses" },
    { to: "/analytics", icon: BarChart3, key: "analytics" },
  ]},
  { label: "TOOLS", items: [
    { to: "/ai", icon: Sparkles, key: "ai" },
    { to: "/whatsapp", icon: MessageCircle, key: "whatsapp" },
    { to: "/settings", icon: Settings, key: "settings" },
  ]},
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const initial = (user?.email || "?")[0].toUpperCase();

  return (
    <aside className="flex h-full w-[220px] flex-col border-r bg-sidebar">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Store className="size-4" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">{t("appName")}</span>
          <span className="text-[10px] text-muted-foreground">Anantapur</span>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {sections.map((s) => (
          <div key={s.label} className="mb-3">
            <div className="px-2 pb-1 pt-2 text-[10px] font-semibold tracking-wider text-muted-foreground">
              {s.label}
            </div>
            {s.items.map((it) => {
              const active = pathname === it.to || pathname.startsWith(it.to + "/");
              const Icon = it.icon;
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors min-h-[40px]",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground/80 hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span>{t(it.key)}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="border-t p-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-full bg-accent text-sm font-medium text-accent-foreground">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium">{user?.email}</div>
            <div className="text-[10px] text-muted-foreground">Shop owner</div>
          </div>
          <button
            aria-label="Sign out"
            onClick={() => supabase.auth.signOut()}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
