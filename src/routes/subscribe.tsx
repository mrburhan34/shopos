/**
 * SHOPOS ACTIVATION FLOW (manual UPI payment)
 * ───────────────────────────────────────────
 * 1. Customer's 7-day free trial expires → app routes them here.
 * 2. They tap the UPI deep link
 *    and pay ₹499 to UPI ID: syedsaqibburhanuddin@fam
 * 3. They tap the WhatsApp button which opens chat with owner (OWNER_WHATSAPP)
 *    pre-filled with their email. They paste the UPI transaction reference.
 * 4. Owner verifies the payment manually (PhonePe / GPay txn list).
 * 5. Owner replies on WhatsApp with an activation code from the
 *    server-side `activation_codes` table.
 * 6. Customer pastes the code on this page → server function validates,
 *    marks the code used (atomic), and grants 30 days of access.
 * 7. Repeat monthly.
 *
 * To add new activation codes: INSERT into public.activation_codes (server only).
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, Copy, MessageCircle, Store } from "lucide-react";
import { useSubscription } from "@/hooks/use-subscription";
import {
  activateWithCode,
  daysLeft,
  OWNER_WHATSAPP,
  PRICE,
  UPI_ID,
} from "@/lib/subscription";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/subscribe")({ component: SubscribePage });

const FEATURES = [
  "Unlimited invoices & customers",
  "Inventory & low-stock alerts",
  "Sales ledger & analytics",
  "Expense tracking",
  "WhatsApp invoice sharing",
  "AI business insights",
  "Email support",
];

function SubscribePage() {
  const { data: sub } = useSubscription();
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [activating, setActivating] = useState(false);

  const status = sub?.status;
  const headerTitle =
    status === "expired"
      ? "Your trial has ended"
      : status === "active"
      ? "You're subscribed 🎉"
      : `Subscribe to ShopOS — ${daysLeft(sub)} days left`;
  const headerSub =
    status === "expired"
      ? "Subscribe at ₹499/month to restore access to your shop."
      : status === "active"
      ? `Active until ${sub?.expires_at ? new Date(sub.expires_at).toLocaleDateString("en-IN") : "—"}`
      : "Pay ₹499/month via UPI to continue after your trial.";

  const upiDeepLink = `upi://pay?pa=${UPI_ID}&pn=ShopOS&am=${PRICE}&cu=INR&tn=ShopOS+Monthly+Subscription`;
  const whatsappText = encodeURIComponent(
    `Hi, I have paid ₹${PRICE} for ShopOS subscription. My registered email is ${user?.email ?? ""} and UPI ref is `,
  );
  const whatsappUrl = `https://wa.me/${OWNER_WHATSAPP}?text=${whatsappText}`;

  const onActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Please sign in first.");
      return;
    }
    if (!code.trim()) return toast.error("Enter your activation code");
    setActivating(true);
    try {
      await activateWithCode(code);
      toast.success("Payment verified! Welcome to ShopOS 🎉");
      qc.invalidateQueries({ queryKey: ["subscription"] });
      nav({ to: "/dashboard" });
    } catch (err: any) {
      if (err?.message === "used") {
        toast.error("This code has already been used. Please use a different code.");
      } else {
        toast.error("Invalid code. Please contact ShopOS support.");
      }
    } finally {
      setActivating(false);
    }
  };

  const copyUpi = async () => {
    await navigator.clipboard.writeText(UPI_ID);
    toast.success("UPI ID copied");
  };

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="mx-auto w-full max-w-[460px]">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Store className="size-5" />
          </div>
          <span className="text-lg font-semibold">ShopOS</span>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h1 className="text-xl font-semibold">{headerTitle}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{headerSub}</p>

          {!user && (
            <div className="mt-3 rounded-md border bg-muted/40 p-3 text-xs">
              Please <Link to="/login" className="text-primary underline">sign in</Link> to activate after payment.
            </div>
          )}

          <div className="mt-5 rounded-lg border bg-muted/40 p-4 text-center">
            <div className="text-3xl font-bold">₹{PRICE}<span className="text-sm font-normal text-muted-foreground">/month</span></div>
          </div>

          <ul className="mt-4 space-y-2 text-sm">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-indigo-500" />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          <div className="my-6 h-px bg-border" />

          <h2 className="text-sm font-semibold">Step 1 — Pay ₹{PRICE} via UPI</h2>
          <p className="mt-1 text-xs text-muted-foreground">Use any UPI app (PhonePe, GPay, Paytm) to send exactly ₹{PRICE}.</p>
          <div className="mt-3 flex items-center gap-2">
            <Input value={UPI_ID} readOnly className="text-sm" />
            <Button type="button" variant="outline" size="icon" onClick={copyUpi} aria-label="Copy UPI ID">
              <Copy className="size-4" />
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Amount: ₹{PRICE} exactly</p>

          <div className="mt-3">
            <a href={upiDeepLink}>
              <Button type="button" variant="outline" className="w-full">
                Open in PhonePe / GPay
              </Button>
            </a>
          </div>

          <div className="my-6 h-px bg-border" />

          <h2 className="text-sm font-semibold">Step 2 — Send payment proof on WhatsApp</h2>
          <a href={whatsappUrl} target="_blank" rel="noreferrer">
            <Button type="button" className="mt-2 w-full bg-green-600 hover:bg-green-700">
              <MessageCircle className="size-4 mr-1" />
              Message on WhatsApp
            </Button>
          </a>

          <div className="my-6 h-px bg-border" />

          <h2 className="text-sm font-semibold">Step 3 — Enter activation code</h2>
          <p className="mt-1 text-xs text-muted-foreground">You'll receive this from ShopOS support after payment.</p>
          <form onSubmit={onActivate} className="mt-3 space-y-2">
            <Label htmlFor="code">Activation code</Label>
            <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. SHOPOS2025" autoCapitalize="characters" />
            <Button type="submit" className="w-full" disabled={activating}>
              {activating ? "Activating…" : "Activate my account"}
            </Button>
          </form>
        </div>

        <div className="mt-6 text-center text-xs text-muted-foreground">
          <a href={whatsappUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
            Need help? WhatsApp us
          </a>
          <div className="mt-1">ShopOS · Anantapur, Andhra Pradesh</div>
        </div>
      </div>
    </div>
  );
}
