import { useSyncExternalStore } from "react";

type Lang = "en" | "te";

const KEY = "shopos.lang";
const listeners = new Set<() => void>();
let current: Lang =
  (typeof window !== "undefined" && (localStorage.getItem(KEY) as Lang)) || "en";

export function setLang(l: Lang) {
  current = l;
  if (typeof window !== "undefined") localStorage.setItem(KEY, l);
  listeners.forEach((fn) => fn());
}
export function getLang(): Lang {
  return current;
}
export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => "en",
  );
}

const dict: Record<string, { en: string; te: string }> = {
  appName: { en: "ShopOS", te: "షాప్ ఓఎస్" },
  tagline: { en: "Run your shop smarter", te: "మీ షాపును స్మార్ట్‌గా నడపండి" },
  dashboard: { en: "Dashboard", te: "డాష్‌బోర్డ్" },
  invoices: { en: "Invoices", te: "ఇన్‌వాయిస్‌లు" },
  customers: { en: "Customers", te: "కస్టమర్లు" },
  products: { en: "Products", te: "ఉత్పత్తులు" },
  suppliers: { en: "Suppliers", te: "సరఫరాదారులు" },
  ledger: { en: "Sales Ledger", te: "విక్రయాల లెడ్జర్" },
  expenses: { en: "Expenses", te: "ఖర్చులు" },
  analytics: { en: "Analytics", te: "విశ్లేషణ" },
  ai: { en: "AI Insights", te: "AI అంతర్దృష్టులు" },
  whatsapp: { en: "WhatsApp Bot", te: "వాట్సాప్ బాట్" },
  settings: { en: "Settings", te: "సెట్టింగ్‌లు" },
  signIn: { en: "Sign in", te: "సైన్ ఇన్" },
  signUp: { en: "Create account", te: "ఖాతా సృష్టించు" },
  signOut: { en: "Sign out", te: "సైన్ అవుట్" },
  email: { en: "Email", te: "ఈమెయిల్" },
  password: { en: "Password", te: "పాస్‌వర్డ్" },
  continueGoogle: { en: "Continue with Google", te: "Googleతో కొనసాగండి" },
  newInvoice: { en: "New Invoice", te: "కొత్త ఇన్‌వాయిస్" },
  customerName: { en: "Customer name", te: "కస్టమర్ పేరు" },
  customerPhone: { en: "Customer phone", te: "ఫోన్ నంబర్" },
  add: { en: "Add", te: "జోడించు" },
  save: { en: "Save", te: "సేవ్" },
  cancel: { en: "Cancel", te: "రద్దు" },
  delete: { en: "Delete", te: "తొలగించు" },
  edit: { en: "Edit", te: "సవరించు" },
  search: { en: "Search…", te: "శోధన…" },
  total: { en: "Total", te: "మొత్తం" },
  revenueToday: { en: "Revenue today", te: "నేటి ఆదాయం" },
  invoicesToday: { en: "Invoices today", te: "నేటి ఇన్‌వాయిస్‌లు" },
  lowStock: { en: "Low stock", te: "తక్కువ స్టాక్" },
  outstanding: { en: "Outstanding", te: "బకాయి" },
};

export function t(key: keyof typeof dict): string {
  return dict[key]?.[current] ?? String(key);
}
