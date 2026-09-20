# J & D Beach House — Development Roadmap & Phased Releases

This roadmap organizes the 14 unfinished/mock features identified in [`UNFINISHED_FEATURES.txt`](../../UNFINISHED_FEATURES.txt) into clear, incremental release phases.

---

## Phase 1: Core Guest Checkout & Payments (Target: v1.1.0)

| Feature | Scope | Status |
| :--- | :--- | :--- |
| **Philippine Payment Gateway** | Integrate PayMongo / Maya / GCash API webhooks for online reservation downpayment and full payment. | 📋 Planned |
| **Physical Room Numbers** | Create `room_units` table (Room 101, Cottage #3) and assign specific units upon check-in. | 📋 Planned |
| **Walk-in Receptionist Form** | Front desk interface to create on-the-spot walk-in bookings and collect cash/card. | 📋 Planned |

---

## Phase 2: Invoicing, Taxation & Financial Audit (Target: v1.2.0)

| Feature | Scope | Status |
| :--- | :--- | :--- |
| **Official Receipt (OR) Generator** | Automatic PDF invoice generator with 12% VAT, 10% Service Charge, and SC/PWD discounts. | 📋 Planned |
| **Live Database Ledger** | Real `transactions` table replacing static mock CSV rows in the Accounting portal. | 📋 Planned |
| **Department Inventory CRUD** | Endpoints and UI to add items, restock quantities, and trigger low-stock alerts. | 📋 Planned |

---

## Phase 3: Conversational AI & Messaging (Target: v1.3.0)

| Feature | Scope | Status |
| :--- | :--- | :--- |
| **LLM AI Assistant** | Upgrade `J & D Bot` with Google Gemini API for intelligent, contextual conversation. | 📋 Planned |
| **Operator-to-Guest Live Chat** | Two-way persistent messaging between staff and guests via `chat_messages` table and Socket.io. | 📋 Planned |
| **Transactional Email Engine** | Resend / SendGrid integration for booking confirmations and PDF receipts alongside SMS. | 📋 Planned |

---

## Phase 4: Security, Hardware & Mobile Passes (Target: v1.4.0)

| Feature | Scope | Status |
| :--- | :--- | :--- |
| **Self-Service Password Reset** | Supabase Auth password reset link flow via email. | 📋 Planned |
| **Two-Factor Authentication (2FA)** | TOTP authenticator app verification or Twilio SMS OTP verification for admin staff. | 📋 Planned |
| **Cloudinary Direct Upload** | Server-side or unsigned direct browser uploads to Cloudinary CDN. | 📋 Planned |
| **Smart Door Lock / Pass Integration** | Apple Wallet / Google Wallet pass generator (`.pkpass`) and electronic lock API sync. | 📋 Planned |
| **Review Moderation Portal** | Admin panel to approve, reject, and publish official replies to guest reviews. | 📋 Planned |
