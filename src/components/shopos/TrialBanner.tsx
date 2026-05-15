import { Link } from "@tanstack/react-router";
import { useSubscription } from "@/hooks/use-subscription";
import { daysLeft } from "@/lib/subscription";

export function TrialBanner() {
  const { data: sub } = useSubscription();
  if (!sub || sub.status !== "trial") return null;
  const days = daysLeft(sub);
  return (
    <div
      className="flex h-9 items-center justify-center gap-2 px-4 text-xs"
      style={{ background: "#FEF3C7", color: "#92400E" }}
    >
      <span>
        ⏳ {days} day{days === 1 ? "" : "s"} left in your free trial · Subscribe at ₹499/month to keep access
      </span>
      <Link to="/subscribe" className="font-semibold underline underline-offset-2">
        Subscribe now →
      </Link>
    </div>
  );
}
