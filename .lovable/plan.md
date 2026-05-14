# ShopOS — 18 Surgical Improvements + Partial Payments

All data continues to flow through Supabase. The "shared data layer" requirement is met by centralizing reads in React Query and invalidating affected query keys after every mutation, so every mounted tab refetches automatically. Real Supabase auth on Register; Outlook stays removed.

## Section 1 — Navigation & Layout
1. **Remove notification bell** in `Navbar.tsx` (button + import).
2. **Remove global search** from navbar (desktop input + mobile search icon).
3. **Invoice tab search** — controlled `<Input>` at top of `invoices.tsx` filtering by `number` (case-insensitive `includes`).

## Section 2 — Auth
4. **Fix Register** (`register.tsx`):
   - Fields: full name, shop name, email, phone, password, confirm password.
   - Zod validation with inline errors (email format, phone exactly 10 digits, password ≥ 6, passwords match, no empty fields).
   - Real `supabase.auth.signUp` with `data: { full_name, shop_name, phone }` (existing trigger creates profile/settings).
   - Success toast "Account created! Welcome to ShopOS 🎉"; auto-redirect to `/dashboard` if session returned, else `/login` with info toast.
   - Google button uses real `lovable.auth.signInWithOAuth("google")`. No Outlook.

## Section 3 — Invoices
5. **Customer combobox** — replace free-text customer field with `Command`/`Popover` searchable list of `customers` (filter by name or phone). Selecting autofills phone + address. Typing a new name allowed; created on submit.
6. **Item combobox with autofill** — line-item name becomes searchable list of `products`. Selecting autofills `rate`, `gst`, unit. Qty defaults 1; amount = qty × rate; GST + line total live. Custom names still allowed.
7. **Shop header on invoice** — `InvoicePreview` reads `profiles` (shop_name, address, phone, gstin) and renders above customer details. Fallback: "Set your shop details in Settings."
8. **Auto inventory deduction** — after invoice insert, decrement `products.qty` for each matched item. Toast low-stock warning when new qty ≤ threshold; allow negative with warning. Invalidate `["products","dashboard","analytics"]`.

### NEW — Partial payments
- Status `Partial` already exists. When the user picks `Partial` (or `Unpaid`) the form reveals an **Amount paid** input (`paid_amount`) with auto-computed **Balance due** = `total − paid_amount` (read-only, red).
  - `Paid` → `paid_amount = total`, due = 0.
  - `Unpaid` → `paid_amount = 0`, due = total.
  - `Partial` → user enters amount; validation: `0 < paid_amount < total`, otherwise auto-flip status to Paid/Unpaid.
- Schema: add `paid_amount numeric not null default 0` to `invoices` (a generated `due_amount` is computed in the UI from `total − paid_amount`).
- **Record payment** action on existing invoices (row menu + preview): dialog to add an additional payment; updates `paid_amount`, recomputes status (Paid when `paid_amount ≥ total`, else Partial).
- Invoice list shows due amount as a sub-line under total when status ≠ Paid; status badge already color-codes Partial.
- Invoice preview/print shows **Paid** and **Balance due** lines in the totals block.
- Customers `dues` aggregate uses `total − paid_amount` (see [10]).
- Ledger gets a "Collected (in range)" card based on `sum(paid_amount)` and an "Outstanding (in range)" based on `sum(total − paid_amount)`.

## Section 4 — Customers
9. **Remove Dashboard search** — confirm Dashboard has none (no-op if absent).
10. **Auto-sync customers from invoices** — on invoice save, look up customer by lowercased name (or phone). Insert if missing; otherwise update `total_purchases += total` and `dues += (total − paid_amount)`. Set `invoices.customer_id`. Invalidate `["customers"]`. Same logic runs on Record-payment to decrement dues.

## Section 5 — Analytics
11. **Profit Overview** — two rows of metric cards (Month / Year): Revenue, Expenses, Net Profit (green ≥0, red <0). Combined `ComposedChart`: bars=monthly revenue, line=monthly expenses, last 12 months.
12. **Most Ordered Items** — replace "Avg order" card with top-10 list aggregated from `invoice_items` by qty: rank, name, total qty, total revenue.
13. **Improved Top Products** — horizontal `BarChart` (top 10 by revenue) with revenue label at bar end; toggle to sort by units sold; show units + invoice count.

## Section 6 — Sales Ledger
14. **Fix date range** — keep `gte/lte` (already inclusive); ensure invoice `date` saved as `yyyy-MM-dd`. Columns: Date, INV #, Customer, Items summary, Subtotal, GST, Grand Total, Paid, Due, Payment, Status. Summary cards recompute on filter: Total Revenue, Collected, Outstanding, Net (Revenue − Expenses in range), Transaction count.

## Section 7 — Expenses
15. **Rebuild expenses tab**:
   - Summary: This month, This year, Largest category, Entry count.
   - Category filter pills: All, Rent, Electricity, Purchase, Salary, Other.
   - Sortable table (Date, Amount) with color-coded badge, notes, amount.
   - Inline/modal Add Expense form (date default today, category dropdown, amount, notes).
   - Donut chart of current-month spend by category.
   - Edit + Delete actions (delete behind confirm dialog).

## Section 8 — WhatsApp Bot
16. Rebuild as setup + dashboard page using a new `whatsapp_config` table (user_id unique, phone, twilio_account_sid, twilio_auth_token, twilio_sender, webhook_url):
   - **Setup panel** (no row): inputs (Auth Token masked) + numbered Twilio sandbox steps + placeholder webhook URL.
   - **After setup**: green "Connected · {number}" badge; commands reference table (`sales today`, `low stock`, `pending dues`, `top product`, `profit this month`); "Test Bot" simulates the response from Supabase data; Make.com / n8n hookup notes.
   - No real Twilio call this iteration.

## Section 9 — Ecosystem & Polish
17. **Shared reactive layer** — `src/lib/queries.ts` with query-key constants + `invalidate(...)` helper; `useRealtimeSync()` hook subscribes to Postgres changes for `invoices`, `invoice_items`, `products`, `customers`, `expenses`, `profiles` and invalidates matching keys. Mounted in `_authenticated.tsx`. Dashboard footer shows "Last updated HH:mm".
18. **Final polish**:
   - `EmptyState` on every empty table.
   - Success toast on every save; confirm `AlertDialog` on every destructive action.
   - `inr()` retains lakh formatting (`en-IN`); set `maximumFractionDigits: 2` for partial amounts.
   - `fmtDate` outputs `DD MMM YYYY`.
   - Audit hardcoded colors → tokens / `dark:` variants.
   - Mobile: tables in `overflow-x-auto`; verify Sidebar Sheet.
   - Consistent `PageHeader` (title left, action right).

## Migrations

```sql
-- Partial payments
alter table public.invoices add column paid_amount numeric not null default 0;
update public.invoices set paid_amount = total where status = 'Paid';

-- WhatsApp config
create table public.whatsapp_config (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  phone text, twilio_account_sid text, twilio_auth_token text,
  twilio_sender text, webhook_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.whatsapp_config enable row level security;
create policy whatsapp_config_all_own on public.whatsapp_config
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

## Out of scope
- Real Twilio sending (UI + config storage only).
- Real PDF library (continue styled `window.print()`).

## Build order
Migration → shared queries/realtime hook → Navbar (1,2) → Register (4) → Invoice form (5,6,7,8,partial) + tab search (3) → Customer sync (10) → Ledger (14) → Analytics (11,12,13) → Expenses (15) → WhatsApp (16) → Polish (17,18).
