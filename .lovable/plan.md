# ShopOS — Build Plan

AI-powered shop management web app for small businesses in Andhra Pradesh. Built on TanStack Start + React 19 + Tailwind v4, with **Lovable Cloud** for database + auth, **real Google OAuth**, and fully responsive layouts (desktop, tablet, mobile).

## Stack & key decisions

- **Lovable Cloud** for backend (Postgres + Auth + RLS) — enabled before any code is written
- **Auth**: Email/Password + **real Google OAuth** only. No Outlook button anywhere.
- `lucide-react`, `recharts`, `sonner`, `react-hook-form` + `zod`
- CSS tokens in `src/styles.css` matching spec (indigo `#4F46E5`, bg `#FAFAF8`/`#111110`, cards `#FFFFFF`/`#1A1A18`, borders `#E5E5E0`/`#2A2A28`, flat, no gradients)
- Inter font via Google Fonts
- Dark mode toggle on `<html>`, persisted to `localStorage`
- Language toggle EN / తెలుగు via `src/lib/i18n.ts`
- Fully responsive: sidebar → Sheet drawer below `md`; tables → stacked cards on mobile; navbar search collapses to icon; min 44px tap targets

## Database schema (Supabase migrations)

```text
profiles          (id=auth.uid, full_name, shop_name, phone, address, gstin, logo_url)
products          (id, user_id, name, category, qty, unit, purchase_price, selling_price, gst, threshold)
customers         (id, user_id, name, phone, address, total_purchases, dues, last_visit)
suppliers         (id, user_id, name, phone, address, notes)
invoices          (id, user_id, number, customer_name, customer_phone, customer_id (nullable),
                   date, subtotal, cgst, sgst, total, payment_mode, status, notes)
invoice_items     (id, invoice_id, product_id, name, qty, rate, gst, amount)
expenses          (id, user_id, category, amount, date, notes, receipt_url)
settings          (user_id PK, lang, theme, currency, low_stock_default, gst_default,
                   invoice_prefix, payment_terms, whatsapp_alerts)
```

- RLS on every table: `user_id = auth.uid()` for all CRUD
- DB trigger `handle_new_user()` → creates `profiles` + `settings` on signup
- Storage bucket `receipts` (private) for expense receipts and shop logos

## Routing (TanStack file-based)

```text
src/routes/
  __root.tsx                  Inter font, theme bootstrap, Sonner, QueryClient
  login.tsx                   email + Google only
  register.tsx                email + Google only
  reset-password.tsx
  _authenticated.tsx          beforeLoad guard
  _authenticated/index.tsx    Dashboard
  _authenticated/invoices.tsx
  _authenticated/invoices.new.tsx
  _authenticated/customers.tsx
  _authenticated/products.tsx
  _authenticated/suppliers.tsx
  _authenticated/ledger.tsx
  _authenticated/expenses.tsx
  _authenticated/analytics.tsx
  _authenticated/ai.tsx
  _authenticated/whatsapp.tsx
  _authenticated/settings.tsx
```

Data via `createServerFn` + `requireSupabaseAuth` middleware; mutations via `useServerFn` + React Query.

## Login / Register

Split layout — left indigo panel (logo, Telugu tagline, 4 feature bullets, Anantapur footer); right form. Buttons:
- **Continue with Google** (real Supabase Google OAuth)
- Email + password (sign in / sign up)
- Forgot password link

No Outlook / Microsoft button anywhere.

## Invoice form (key change)

The "New Invoice" form will use a **plain text input** for customer name — no dropdown / no customer selector. Fields:

- **Customer name** — free-text `<Input>` (required)
- **Customer phone** — free-text `<Input>` (optional)
- **Date** — date picker, defaults to today
- **Line items** — repeating rows: item name, qty, rate, GST%, auto-calculated amount
- **Auto totals** — subtotal, CGST/SGST split, grand total
- **Payment mode** — Cash / UPI / Card / Credit
- **Status** — Paid / Unpaid / Partial
- **Notes** — textarea
- Actions: Save Draft, Generate Invoice, Print (styled HTML print view → `window.print()` for "PDF")

On save, the invoice is stored with `customer_name` + `customer_phone` directly. If a customer with the same phone already exists in the user's customer list, we link `customer_id` automatically (silent — user never sees a picker). If not, we optionally create a new customer row in the background so totals/dues still aggregate on the Customers page. (Tell me if you'd rather skip the auto-create and keep invoices fully decoupled from the Customers table.)

## Pages

1. **Dashboard** — greeting + date + city, 4 metric cards, Recent Activity, Top Products bar chart, AI insight banner
2. **Invoices** — list + filters + status badges; New Invoice as above; printable preview
3. **Customers** — card grid, search + filters, side panel with purchase history (still useful even though invoice form is free-text)
4. **Products** — low-stock strip, table, add/edit modal, stock adjustment dialog with reason
5. **Sales Ledger** — date range, summary cards, transaction table, CSV export
6. **Expenses** — add form (with receipt upload to Storage), filterable table, monthly donut
7. **Analytics** — recharts: 30-day revenue line, top-10 bar, payment-method pie, customer acquisition; KPI cards
8. **AI Insights** — chat UI; quick prompts; intent matcher in `src/lib/ai.ts` reads user data via server fns; answers in EN or Telugu
9. **WhatsApp Bot** — informational page with mock chat preview (real send out of scope)
10. **Settings** — Shop profile, Appearance, Notifications, Invoice settings, Data export/import JSON, Subscription (display)

## Shared components (`src/components/shopos/`)

`Sidebar`, `Navbar`, `MetricCard`, `StatusBadge`, `EmptyState`, `PageHeader`, `ThemeToggle`, `LangToggle`, `InvoiceForm` (free-text customer), `InvoicePreview`, `ProductForm`, `CustomerForm`, `ExpenseForm`, `AIChat`, `MobileNav` (Sheet).

## Responsive behavior

- `≥ lg`: sidebar 220px + content
- `md`–`lg`: collapsible icon sidebar
- `< md`: hamburger → Sheet; tables → stacked cards; metric cards 2-col → 1-col; navbar search → search icon opening a sheet
- Bottom safe-area padding on mobile

## Cross-cutting

- `sonner` toasts for all CRUD
- `react-hook-form` + `zod` validation with inline errors
- Loading skeletons + empty states with CTA buttons
- All UI text routed through `t(key)` for EN/Telugu

## Build order

1. Enable Lovable Cloud, create migrations + RLS + signup trigger + storage bucket
2. Theme tokens + Inter font + dark mode + Sonner in `__root.tsx`
3. i18n dictionary
4. Login / Register / Reset (email/password + Google OAuth)
5. `_authenticated` guard + responsive Sidebar + Navbar
6. Dashboard
7. Products → Customers → Invoices (free-text customer) → Ledger → Expenses
8. Analytics → AI Insights → Settings → WhatsApp page
9. Mobile polish + empty/loading states pass

## Out of scope

- Outlook / Microsoft OAuth (removed per your request)
- Real WhatsApp message sending
- Real PDF library — invoice "PDF" is styled print view via `window.print()`
