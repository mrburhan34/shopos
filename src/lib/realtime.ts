import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const TABLES = ["invoices", "invoice_items", "products", "customers", "expenses", "profiles", "settings"];

const KEYS_BY_TABLE: Record<string, string[]> = {
  invoices: ["invoices", "dashboard", "ledger", "analytics", "customers"],
  invoice_items: ["invoices", "analytics", "dashboard"],
  products: ["products", "dashboard", "analytics"],
  customers: ["customers", "dashboard"],
  expenses: ["expenses", "ledger", "analytics", "dashboard"],
  profiles: ["profile"],
  settings: ["settings"],
};

export function useRealtimeSync() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase.channel("shopos-realtime");
    TABLES.forEach((table) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          (KEYS_BY_TABLE[table] ?? [table]).forEach((k) =>
            qc.invalidateQueries({ queryKey: [k] })
          );
        }
      );
    });
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
