The user wants the QR code removed from the payment page (`/subscribe`).

Changes:
1. In `src/routes/subscribe.tsx`:
   - Remove the `<img src="/upi-qr.png" ...>` element.
   - Remove the "Scan with any UPI app" helper text that only described the QR.
   - Keep the UPI ID copy field and the "Open in PhonePe / GPay" deep-link button.
   - Update the Step 1 copy from "Pay via UPI" framing to match the remaining controls (e.g. "Pay ₹499 via UPI").

No backend, database, or routing changes are needed. The existing payment flow remains intact.