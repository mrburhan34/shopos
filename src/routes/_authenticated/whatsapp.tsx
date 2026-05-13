import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/shopos/Bits";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/whatsapp")({ component: WA });

function WA() {
  return (
    <div>
      <PageHeader title="WhatsApp Bot" subtitle="Send invoices and reminders to customers" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2">
            <MessageCircle className="size-5 text-success" />
            <h3 className="font-semibold">How it works</h3>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>• Send invoice PDFs to customers automatically</li>
            <li>• Low-stock and dues reminders</li>
            <li>• Festival greetings in Telugu</li>
            <li>• Customers reply with order requests</li>
          </ul>
          <div className="mt-4 rounded-md bg-accent/40 p-3 text-xs">
            WhatsApp Business API integration coming soon. Connect your number from Settings.
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Preview</h3>
          <div className="space-y-2">
            <Bubble who="them" text="Hi! Your order from Sri Sai Stores is ready. Total ₹1,240." />
            <Bubble who="me" text="Thanks! UPI sent." />
            <Bubble who="them" text="Received ✅ Invoice INV-001234 attached." />
          </div>
        </div>
      </div>
    </div>
  );
}

function Bubble({ who, text }: { who: "me" | "them"; text: string }) {
  return (
    <div className={`flex ${who === "me" ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${who === "me" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
        {text}
      </div>
    </div>
  );
}
