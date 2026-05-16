## Surgical fixes — 7 changes

### [1] Sales Ledger date range filter (`src/routes/_authenticated/ledger.tsx`)
Current query uses raw string `gte/lte` on `date` column. Replace with parsed-date client-side filter:
- Drop `gte/lte` from the Supabase query (fetch a wide window, e.g. last 2 years), or keep but additionally filter client-side using `parseISO`.
- Filter: `const t = parseISO(i.date).getTime(); const s = parseISO(from); s.setHours(0,0,0,0); const e = parseISO(to); e.setHours(23,59,59,999); return t >= s.getTime() && t <= e.getTime();`. Re-runs reactively because `from`/`to` are in the `useQuery` key.
- Replace table columns with brief's spec: **Date, INV number, Customer, Amount (subtotal), GST (`cgst + sgst`), Grand Total, Payment mode, Status**.
- Summary cards recalculated from filtered set: **Total Revenue, Total Expenses, Gross Profit (see [4]), Transaction count**.

### [2] + [3] Activation codes — 1000-code list + one-time-use
- Generate `src/lib/activation-codes.ts` containing `export const VALID_CODES: string[] = [...]` from the uploaded `activation_codes.txt` (regex `[0-9A-Z]{6}(-[0-9A-Z]{6}){3}`, deduped, ~1000 entries).
- In `src/lib/subscription.ts`:
  - Import `VALID_CODES` from the new file (replace inline array).
  - Add `getUsedCodes(): string[]` and `markCodeUsed(code: string)` reading/writing `localStorage['shopos_used_codes']` (SSR-safe with `typeof window !== 'undefined'`).
  - Rewrite `activateWithCode(code)`:
    1. `const c = code.trim().toUpperCase();`
    2. If `!VALID_CODES.includes(c)` → `throw new Error('invalid')`.
    3. If `getUsedCodes().includes(c)` → `throw new Error('used')`.
    4. Update Supabase subscription (status=active, expires_at=+30d, payment_ref=c).
    5. `markCodeUsed(c)`.
- In `src/routes/subscribe.tsx` `onActivate` catch: branch on `err.message`:
  - `'used'` → toast: "This code has already been used. Please use a different code."
  - else → toast: "Invalid code. Please contact ShopOS support."

### [4] Gross Profit using product purchase_price
Formula: per line item, `(rate − product.purchase_price) × qty`. If product not found, `purchase_price = 0`.

- New `src/lib/profit.ts` exporting `computeGrossProfit(items, productMap)` and a Supabase-fetch helper.
- **`analytics.tsx`**: extend `invoice_items` select to include `rate,invoices!inner(date,status,user_id)`; fetch `products(id,name,purchase_price)`. Filter items to those whose invoice `status === 'Paid'` and in the month/year window. Replace both `Net Profit` cards with **`Gross Profit (selling − purchase cost)`** — colored green/red.
- **`dashboard.tsx`**: query today's `invoice_items` joined with paid invoices + products. Add `Gross Profit today` MetricCard (green/red).
- **`ledger.tsx`**: include `invoice_items(name,qty,rate,product_id)` in the existing `invoices` select; compute gross profit from items belonging to filtered Paid invoices, using a products map. Replace the existing `Net` card with **Gross Profit**.

Lookup: build `productsByName` (lowercased name → product) and `productsById`. Match by `item.product_id` first, else by name.

Note: brief says "localStorage products array" but products live in Supabase in this app — that's the authoritative source. Using Supabase `products.purchase_price`.

### [5] Remove PDF download, fix Print to invoice-only
`src/routes/_authenticated/invoices.tsx`:
- Remove imports `jsPDF`, `html2canvas`, `Download` icon; delete `downloadInvoicePDF` and its prop wiring.
- In `InvoicePreview`: remove "Download PDF" button. Print button = `onClick={() => window.print()}`.
- Wrap **only** invoice content (shop header, "Tax Invoice" + INV number, Bill To block, items table, subtotal/CGST/SGST/Grand Total, payment mode + status) in:
  ```tsx
  <div id="invoice-print-area" style={{ background:'#ffffff', color:'#1a1a18', padding:'32px', maxWidth:'480px', margin:'0 auto', fontFamily:'sans-serif' }}>
  ```
  Action buttons + dialog chrome stay outside.
- Run `bun remove jspdf html2canvas`.

`src/styles.css` — replace prior `@media print` block with exact CSS from brief:
```css
@media print {
  body * { visibility: hidden !important; }
  #invoice-print-area, #invoice-print-area * { visibility: visible !important; }
  #invoice-print-area {
    position: fixed !important; top: 0 !important; left: 0 !important;
    width: 100% !important; background: white !important; padding: 40px !important;
    z-index: 99999 !important; box-shadow: none !important; border-radius: 0 !important;
  }
}
```

### [6] Remove "Edit with Lovable" badge
The badge is the Lovable preview overlay — not a component in `src/`. It's toggled by publish-settings. Action: call `publish_settings--set_badge_visibility { hide_badge: true }`. **Requires Pro plan**; on free plan the API call fails and the badge stays. I'll attempt and report. No source change.

### [7] Greeting uses Settings owner name (`src/routes/_authenticated/dashboard.tsx`)
- Add `useQuery(['profile'])` selecting `full_name, shop_name` from Supabase `profiles` (this is what the Settings "Owner name" field writes).
- Resolution order:
  1. `profile?.full_name`
  2. `localStorage['shopos_shop']` → `.owner` or `.ownerName` (if either exists — kept for compatibility with brief)
  3. `localStorage['shopos_user']?.name`
  4. `user.email.split('@')[0]`
  5. `"there"`
- Time-of-day:
  - 5–11 → "Good morning"
  - 12–16 → "Good afternoon"
  - 17–21 → "Good evening"
  - 22–4 → "Good night"
- Format: `` `${tod}, ${name} 👋` ``.

---

### Execution order
1. Generate `src/lib/activation-codes.ts` from the uploaded file (~1000 codes).
2. Edit `src/lib/subscription.ts` (import codes, add used-code helpers, rewrite `activateWithCode`).
3. Edit `src/routes/subscribe.tsx` (branched error messages).
4. Edit `src/routes/_authenticated/ledger.tsx` (parsed-date filter, new columns, Gross Profit card).
5. Create `src/lib/profit.ts`. Edit `analytics.tsx` + `dashboard.tsx` (gross profit + greeting).
6. Edit `src/routes/_authenticated/invoices.tsx` (drop PDF, wrap print area). `bun remove jspdf html2canvas`.
7. Edit `src/styles.css` print block.
8. Call `publish_settings--set_badge_visibility { hide_badge: true }`.

No DB migration. No new routes. No auth changes.
