# PAYONE Server-to-Server (Standalone API) Integration — Ecom Europa Demo 🛍️💳

An e-commerce storefront (fictional brand **"Ecom Europa"**) built to learn and demonstrate PAYONE's **Server-to-Server (S2S) API** combined with the **Hosted Tokenization Page (HTP)** iframe — the standalone / direct-API integration pattern on PAYONE's Global Online Payments platform (Worldline GOP, `developer.payone.com`).

Built this after finishing the sibling [`payone-hosted-checkout`](https://github.com/IamHamud/payone-hosted-checkout) repo — same fictional store, different integration pattern.

---

## 🎯 Purpose

Personal learning project. Everything runs against the **PAYONE preprod sandbox** — no live traffic, no real orders. The goal is to show how a merchant runs the full S2S flow while keeping PCI scope at **SAQ A-EP** (card data never touches the merchant server):

- Frontend embeds PAYONE's tokenizer iframe (Hosted Tokenization Page)
- Customer enters card details **inside PAYONE's iframe** — PAN never hits this origin
- Iframe returns a `hostedTokenizationId` — a short-lived token
- Backend uses that token in a direct `CreatePayment` call to PAYONE's API
- Handles 3-D Secure 2.x challenge redirects, polls final status via `GetPayment`

This is the pattern used when a merchant wants **full control of the checkout UI** but still wants iframe-level PCI scope reduction. Compare with the redirect-based hosted checkout in the sibling repo.

---

## 🚀 Features

- ✅ Static Zalando-inspired storefront (product cards, cart drawer, checkout)
- 🛒 Shopping cart via `localStorage`
- 🔒 **PCI scope stays at SAQ A-EP** — PAN only lives inside PAYONE's iframe origin
- 💳 PAYONE Hosted Tokenization iframe + Server-to-Server `CreatePayment`
- 🛡️ 3-D Secure 2.x with `browserData` device fingerprint
- 🎨 Tailwind CDN, no build step
- 📦 Node.js + Express 5 backend using the official [`onlinepayments-sdk-nodejs`](https://www.npmjs.com/package/onlinepayments-sdk-nodejs) SDK

---

## 🛠️ Tech Stack

**Frontend**
- HTML, CSS, JavaScript (vanilla)
- [Tailwind CSS](https://tailwindcss.com) via CDN
- PAYONE `tokenizer.min.js` (loaded from `payment.preprod.payone.com` with an SRI hash)

**Backend**
- Node.js + Express 5
- [`onlinepayments-sdk-nodejs`](https://www.npmjs.com/package/onlinepayments-sdk-nodejs) v9.1 (official PAYONE / Worldline SDK, HMAC-SHA256 signing)
- dotenv, cors

**PAYONE APIs used**
- `CreateHostedTokenization` — open a tokenization session
- `CreatePayment` — direct S2S charge using `hostedTokenizationId`
- `GetPayment` — fetch the final status after a 3-DS redirect

---

## 📌 How It Works

1️⃣ Customer adds products to the cart on the storefront

2️⃣ Clicks **Checkout** — `checkout.html` loads

3️⃣ Frontend POSTs to `/api/hosted-tokenization` — backend calls `CreateHostedTokenization` → returns `{ hostedTokenizationId, hostedTokenizationUrl, sri }`

4️⃣ Frontend loads PAYONE's `tokenizer.min.js` with `integrity="<sri>"`, then `new Tokenizer(hostedTokenizationUrl, "div-hosted-tokenization", opts).initialize()` renders the iframe

5️⃣ Customer enters PAN / expiry / CVV **inside PAYONE's iframe** — nothing crosses to this origin

6️⃣ On **Pay securely**, `tokenizer.submitTokenization()` posts the card to PAYONE cross-origin and resolves with a `hostedTokenizationId`

7️⃣ Frontend POSTs `{ hostedTokenizationId, amount, currency, browserData, returnUrl }` to `/api/payments`

8️⃣ Backend calls `CreatePayment` with `hostedTokenizationId` at the **top level** of the request (sibling to `order`) plus `cardPaymentMethodSpecificInput.threeDSecure.redirectionData.returnUrl` and `order.customer.device.browserData.*`

9️⃣ Branch on `merchantAction.actionType`:
   - `REDIRECT` ➡️ browser navigates to `merchantAction.redirectData.redirectURL` for 3-DS challenge, then lands on `return.html`
   - `null` ➡️ payment already resolved, check `statusCode` directly

🔟 `return.html` reads `paymentId` from `sessionStorage` and calls `/api/payments/:id` → backend calls `GetPayment` → renders final status (5 = authorised, 9 = captured/paid)

---

## 🏃 Quick Start

### 1️⃣ Clone the repo

```bash
git clone https://github.com/IamHamud/payone-server-to-server-integration.git
cd payone-server-to-server-integration
```

### 2️⃣ Install backend dependencies

```bash
cd backend
npm install
```

### 3️⃣ Create your `.env` file

```bash
cp .env.example .env
```

Then fill in the sandbox credentials from Merchant Portal → Developer → Payment API:

```env
PAYONE_API_KEY_ID=your_api_key_id
PAYONE_API_SECRET=your_secret_api_key
PAYONE_MERCHANT_ID=your_pspid
PORT=3000
```

### 4️⃣ Start the server

```bash
npm start
```

### 5️⃣ Open the store

Visit 🌐 **http://localhost:3000/index.html**

> ⚠️ Node does NOT hot-reload — after any change to `backend/server.js` you must `Ctrl+C` and `npm start` again, otherwise the browser keeps hitting the stale process.

---

## 💳 Verified Sandbox Test Card

End-to-end verified on this project (Visa · 3-DS challenge → `CAPTURED`):

| Number | Expiry | CVV | Cardholder |
|---|---|---|---|
| `4874 9706 8667 2022` | `12/36` | `123` | `John Doe` |

Full test-case matrix (frictionless / challenge fail / decline / technical error / other schemes) at **developer.payone.com → Resources → Testing → Test cases**. Don't guess PANs — sandbox ACS behavior is bound to specific numbers.

---

## 📁 Project Structure

```
payone-server-to-server-integration/
├── backend/
│   ├── server.js          Express + PAYONE SDK: 3 routes
│   ├── package.json       onlinepayments-sdk-nodejs ^9.1.0
│   ├── .env.example       Template — copy to .env
│   └── .gitignore
├── src/
│   ├── pages/
│   │   ├── checkout.html  Hosts <div id="div-hosted-tokenization"> for PAYONE iframe
│   │   ├── return.html    Reads paymentId → GetPayment
│   │   ├── product.html
│   │   └── cart.html
│   ├── js/
│   │   ├── checkout.js    Tokenizer load + init + submitTokenization + /api/payments
│   │   └── main.js        Cart + product logic
│   ├── css/style.css
│   └── images/            ecom-europa-logo + product photos
├── docs/
│   └── PAYONE_S2S_REFERENCE.md   Verified snippets + past-mistake log
├── index.html             Storefront landing
├── README.md
└── LICENSE
```

---

## 🐛 Things That Bit Me (Documented So You Don't Repeat Them)

1. **`hostedTokenizationId` is a top-level field of `CreatePaymentRequest`** — sibling to `order` and `cardPaymentMethodSpecificInput`, **NOT** nested inside `cardPaymentMethodSpecificInput`. Confirmed via the SDK's own JSON schema at `node_modules/onlinepayments-sdk-nodejs/lib/cjs/schemas/createPaymentRequest.js`. Nesting it triggers `instance.cardPaymentMethodSpecificInput is not allowed to have the additional property "hostedTokenizationId"`.

2. **`token` (permanent Card-on-File token) IS nested** inside `cardPaymentMethodSpecificInput.token`. Different field from `hostedTokenizationId`, different placement.

3. **Iframe uses `tokenizer.min.js` + the `Tokenizer` class**, not a raw redirect. The `partialRedirectUrl` field on the tokenization response is marked `@deprecated` in the SDK types — don't use it.

4. **Sandbox host is `payment.preprod.payone.com`** — the Worldline / GOP flavor at `developer.payone.com`. NOT `secure.pay1.de` / `docs.payone.com`, which is Classic PAYONE, a different product entirely with a different SDK.

5. **3-DS challenge in sandbox is served by Worldline's ACS simulator** at `v2-sim.preprod.psp-solutions.com`. The outcome is bound to the test PAN and auto-approves without OTP. Real issuer ACS only in production. Same EMV 3-DS 2.x protocol.

6. **`browserData.screen*` and `timezoneOffsetUtcMinutes` must be strings** (only `colorDepth` stays a number). Common source of validation errors.

Full field reference and error playbook in [`docs/PAYONE_S2S_REFERENCE.md`](docs/PAYONE_S2S_REFERENCE.md).

---

## 📖 References

- PAYONE Developer Docs: <https://developer.payone.com>
- S2S guide: <https://developer.payone.com/en/integration/basic-integration-methods/server-to-server>
- Hosted Tokenization Page guide: <https://developer.payone.com/en/integration/basic-integration-methods/hosted-tokenization-page>
- API Reference: <https://developer.payone.com/en/api-reference>
- API Explorer: <https://explorer.payone.com>
- Merchant Portal (sandbox): <https://portal.preprod.payone.com>
- Node SDK on npm: <https://www.npmjs.com/package/onlinepayments-sdk-nodejs>

---

## ⚠️ Disclaimer

This is a **personal, non-commercial learning demo**. Not affiliated with, endorsed by, or officially connected to **PAYONE GmbH**, **Worldline**, or any other company. "Ecom Europa" is a fictional brand invented for this project — no products exist, no orders are fulfilled. All third-party trademarks (PAYONE, Worldline, Visa, Mastercard, etc.) belong to their respective owners. Sandbox credentials only.

Use **your own PAYONE sandbox credentials** to experiment. Never commit real keys.

---

## 📩 Contribute

Issues and PRs welcome — open one on GitHub.
