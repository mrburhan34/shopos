# Plan — 13 surgical fixes + UPI subscription system (Supabase-backed)

Per user direction: **all subscription state lives in Supabase**, not localStorage. Same for shop name + logout (read shop from `profiles`, sign out via `supabase.auth.signOut()`).

---

## Schema migration (new)

New table `public.subscriptions`:

```
id              uuid PK default gen_random_uuid()
user_id         uuid NOT NULL UNIQUE
status          text NOT NULL default 'trial'   -- trial | active | expired
trial_start_date timestamptz NOT NULL default now()
trial_days      int NOT NULL default 7
activated_at    timestamptz
expires_at      timestamptz
payment_ref     text
created_at      timestamptz default now()
updated_at      timestamptz default now()
```

- RLS enabled. Policy `subscriptions_all_own`: `auth.uid() = user_id` for ALL.
- Extend `handle_new_user()` trigger to also `INSERT INTO subscriptions (user_id) VALUES (new.id) ON CONFLICT DO NOTHING` so every new signup gets a 7-day trial automatically.
- One-shot backfill: `INSERT INTO subscriptions (user_id) SELECT id FROM auth.users ON CONFLICT DO NOTHING` so existing users start a fresh 7-day trial.

---

## PART A — Bug fixes

### [1] Invoice date range filter — `src/routes/_authenticated/invoices.tsx`

Add `dateFrom`/`dateTo` `useState` + two `<Input type="date">`. In `filtered`, when set, parse with `parseISO` from `date-fns`; compare `invDate.getTime() >= startOfDay(parseISO(dateFrom))` and `<= endOfDay(parseISO(dateTo))` (using `setHours(23,59,59,999)`). Empty bound = unbounded. Reactive via `onChange`.

### [2] Net profit consistency — `analytics.tsx`, `ledger.tsx`, `dashboard.tsx`

Define everywhere: `Revenue = Σ invoices.total WHERE status='Paid'`; `Expenses = Σ expenses.amount`; `Net = Revenue − Expenses`.

- `analytics.tsx`: filter monthRev/yearRev to `status==='Paid'` (also fetch status column). Net cards already use the formula; verify tone.
- `ledger.tsx`: split current `total` into `revenuePaid` (Paid only) for the Revenue card; `net = revenuePaid − expensesTotal`. Keep Collected/Outstanding unchanged.
- `dashboard.tsx`: add a `Net profit today` MetricCard = `revenuePaidToday − expensesToday`, green/red.

### [3] Dashboard widgets — `dashboard.tsx`

- **Outstanding**: filter `status !== 'Paid'`, sum `max(0, total − paid_amount)`, count distinct `customer_name`. Card shows `inr(outstanding)` + `${n} customers`. Zero unpaid → ₹0 + hint "All dues cleared ✓" (`tone="success"`).
- **Top products**: extend dashboard query to fetch `invoice_items` joined with `invoices!inner(user_id)`. Aggregate by `name` → `{revenue: Σ qty*rate, qty: Σ qty}`. Guard `if (!Array.isArray(items))`. Sort revenue desc, top 5. Replace BarChart with a list: name + CSS bar (`width: revenue/max*100%`, `bg-primary` over `bg-muted`) + `inr(revenue)`. Empty → "No sales data yet".

### [4] PDF download + print — `invoices.tsx` + `styles.css`

- `bun add jspdf html2canvas`.
- `InvoicePreview`: only the invoice content goes inside `<div id="invoice-print-area" style={{background:'#ffffff', color:'#1a1a18', padding:'32px', maxWidth:'480px', margin:'0 auto', fontFamily:'sans-serif'}}>`. All inner text uses hardcoded hex (`#1a1a18`, `#5c5c58`). Action buttons (Print / Download / Close) wrapped in `.no-print`, OUTSIDE that div.
- `downloadInvoicePDF` exactly per brief, file = `${invoice.number}.pdf`.
- Append print CSS to `styles.css` exactly per brief (replace the current minimal `@media print`).

### [5] Invoice modal width — `invoices.tsx`

Print-preview `<DialogContent className="max-w-[480px] sm:max-w-[480px] p-4 sm:p-6">`. Inner card already capped at 480px from item [4].

### [6] Sidebar logout — `Sidebar.tsx`

- Card row: indigo avatar circle (initials) | email + shop name (from `profiles.shop_name` via `useQuery`) | `LogOut` icon button.
- Outer card: `border-t pt-3 hover:bg-accent/40 rounded-md transition-colors`.
- Icon click opens shadcn `AlertDialog` "Are you sure you want to logout?" Cancel + Logout.
- Confirm: `await supabase.auth.signOut()` (clears Supabase session storage), `toast.success("You have been logged out")`, `navigate({to:'/login'})`.

---

## PART B — Subscription paywall (Supabase-backed)

### [7] Server functions + helpers — new `src/lib/subscription.functions.ts` and `src/lib/subscription.ts`

- Constants in `subscription.ts`: `OWNER_WHATSAPP='919704209360'`, `VALID_CODES=['SHOPOS2025','ACTIVATE499','SAQIB001']`, `UPI_ID='syedsaqibburhanuddin@fam'`, `PRICE=499`, plus a `daysLeft(sub)` pure helper.
- `subscription.functions.ts` (createServerFn + `requireSupabaseAuth`):
  - `getMySubscription`: SELECT row for `userId`; if missing INSERT a fresh trial (handles backfill edge); evaluate status — trial → expired if `daysUsed >= trial_days`; active → expired if `expires_at < now`. Persist any state change. Return row.
  - `activateSubscription({ code })`: validate code (trim, uppercase) against `VALID_CODES` server-side; on match UPDATE row with `status='active'`, `activated_at=now()`, `expires_at=now()+30d`, `payment_ref=code`. Return row or throw "Invalid code".
- React Query hook `useSubscription()` wraps `getMySubscription` (queryKey `['subscription']`).

### [8] Trial banner — new `src/components/shopos/TrialBanner.tsx`

Reads via `useSubscription()`. Renders only when `status==='trial'`. 36px tall, `style={{background:'#FEF3C7', color:'#92400E', fontSize:'12px'}}`. Text `⏳ {daysLeft} days left in your free trial · Subscribe at ₹499/month to keep access` + `<Link to="/subscribe">Subscribe now →</Link>`. Mounted in `_authenticated.tsx` ABOVE `<Navbar />`.

### [9] `/subscribe` page — new `src/routes/subscribe.tsx`

PUBLIC top-level route (outside `_authenticated`). Top-of-file comment block from item [11]. White card `max-w-[460px] mx-auto` on `bg-background`.

- Header copy switches on `status` from `useSubscription()` (expired vs trial).
- Pricing block ₹499/month + 7-item ✓ feature list (indigo `Check`).
- **Option A — QR**: `<img src="/upi-qr.png" alt="UPI QR" />` (placeholder file in `public/upi-qr.png` — owner replaces with FamPay QR). Copyable UPI id field with `Copy` button. "Amount: ₹499 exactly".
- **Option B — Deep link**: `<a href="upi://pay?pa=syedsaqibburhanuddin@fam&pn=ShopOS&am=499&cu=INR&tn=ShopOS+Monthly+Subscription">Open in PhonePe / GPay</a>`.
- WhatsApp button: `https://wa.me/${OWNER_WHATSAPP}?text=Hi%2C+I+have+paid+%E2%82%B9499+for+ShopOS+subscription.+My+registered+email+is+${user.email}+and+UPI+ref+is+`.
- Activation form: Input + button → `activateSubscription` server fn; success → toast "Payment verified! Welcome to ShopOS 🎉" + invalidate `['subscription']` + `navigate({to:'/dashboard'})`. Failure → toast.error "Invalid code. Please contact ShopOS support."
- Footer with WhatsApp + "ShopOS · Anantapur, Andhra Pradesh".
- Page is reachable when logged out too (shows generic message + "Sign in" link if no session).

### [10] Subscription tab in Settings — `settings.tsx`

Add `<TabsTrigger value="subscription">Subscription</TabsTrigger>` + content panel using `useSubscription()`:

- Trial → amber badge `Trial · {daysRemaining} days remaining` + Link "Subscribe now".
- Active → green badge `Active`, `Valid until: {fmtDate(expires_at)}`, "Renew" button.
- Expired → red badge `Expired` + "Resubscribe" button.
- Show `payment_ref` if present.

### [11] Owner activation comment block

Top of `subscribe.tsx`, with WhatsApp/UPI/codes lines pointing to `VALID_CODES` in `subscription.ts`.

---

## PART C — Polish

### [12] Public route whitelist

Subscription gate lives in `_authenticated.tsx`. After session check (existing `beforeLoad`), the layout component runs `useSubscription()`; if `status==='expired'` → `navigate({to:'/subscribe'})`. `/login`, `/register`, `/subscribe` are top-level public routes — never enter `_authenticated`, so the guard cannot loop.

### [13] Existing-user backfill

Two-pronged:

1. Migration backfill seeds rows for current `auth.users` (above).
2. Server-side `getMySubscription` ALSO inserts a fresh trial row on miss, so anyone slipping past the trigger still gets 7 days from first call instead of being kicked to `/subscribe`.

---

## Build order

1. Migration: `subscriptions` table + RLS + trigger update + backfill insert.
2. `bun add jspdf html2canvas`.
3. Create `src/lib/subscription.ts`, `src/lib/subscription.functions.ts`.
4. Create `public/upi-qr.png` placeholder (1×1 PNG; owner replaces).
5. Create `TrialBanner.tsx`, `routes/subscribe.tsx`.
6. Edit `_authenticated.tsx` — mount banner + expired guard.
7. Edit `settings.tsx` — Subscription tab.
8. Edit `Sidebar.tsx` — confirmation dialog + shop name from `profiles`.
9. Edit `invoices.tsx` — date filter, dialog width, `invoice-print-area`, `downloadInvoicePDF`.
10. Edit `analytics.tsx`, `ledger.tsx`, `dashboard.tsx` — Paid-only revenue, outstanding, top products, net profit today.
11. Edit `styles.css` — print CSS block.
12. Verify build.