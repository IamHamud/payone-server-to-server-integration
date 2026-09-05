// S2S + Hosted Tokenization Page — using PAYONE's tokenizer.min.js Tokenizer class.
// Flow:
//  1. Backend opens a HostedTokenization session -> returns { hostedTokenizationUrl, sri, hostedTokenizationId }.
//  2. We inject <script src=".../tokenizer.min.js" integrity="{sri}"> from payment.preprod.payone.com.
//  3. new Tokenizer(hostedTokenizationUrl, "div-hosted-tokenization", {...}).initialize() renders the iframe.
//  4. On "Pay securely": tokenizer.submitTokenization() -> { success, hostedTokenizationId, error }.
//  5. POST that id + browserData to /api/payments -> handle 3-DS challenge or final status.

const API_BASE = `${window.location.protocol}//${window.location.host}`;
const TOKENIZER_HOST = "https://payment.preprod.payone.com";

const collectBrowserData = () => ({
  acceptHeader:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  locale: navigator.language || "en_GB",
  timezoneOffsetUtcMinutes: -new Date().getTimezoneOffset(),
  userAgent: navigator.userAgent,
  colorDepth: window.screen.colorDepth,
  javaEnabled: navigator.javaEnabled ? navigator.javaEnabled() : false,
  screenHeight: window.screen.height,
  screenWidth: window.screen.width,
});

const loadTokenizerScript = (sri) =>
  new Promise((resolve, reject) => {
    if (window.Tokenizer) return resolve();
    const s = document.createElement("script");
    s.src = `${TOKENIZER_HOST}/hostedtokenization/js/client/tokenizer.min.js`;
    if (sri) {
      s.integrity = sri;
      s.crossOrigin = "anonymous";
    }
    s.onload = () => resolve();
    s.onerror = (e) => reject(new Error("Failed to load PAYONE tokenizer.min.js"));
    document.head.appendChild(s);
  });

document.addEventListener("DOMContentLoaded", async () => {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const amountMinor = Math.round(totalAmount * 100) || 1000;
  const currency = "EUR";

  const statusEl = document.getElementById("payment-status");
  const totalEl = document.getElementById("cart-total");
  const btn = document.getElementById("submit-payment");
  const loadingEl = document.getElementById("tokenizer-loading");

  if (totalEl) totalEl.innerText = `€${(amountMinor / 100).toFixed(2)}`;

  let tokenizer = null;
  let sessionTokenizationId = null;

  try {
    const res = await fetch(`${API_BASE}/api/hosted-tokenization`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: "en_GB" }),
    });
    if (!res.ok) throw new Error(`Tokenization session failed: HTTP ${res.status}`);
    const data = await res.json();
    sessionTokenizationId = data.hostedTokenizationId;

    await loadTokenizerScript(data.sri);

    if (typeof window.Tokenizer !== "function") {
      throw new Error("Tokenizer class not found on window after script load");
    }

    tokenizer = new window.Tokenizer(
      data.hostedTokenizationUrl,
      "div-hosted-tokenization",
      {
        hideCardholderName: false,
        validationCallback: (result) => {
          btn.disabled = !result.valid;
        },
      }
    );

    await tokenizer.initialize();
    loadingEl?.remove();
    btn.disabled = false;
    statusEl.innerText = "Enter card details above, then click Pay securely.";
  } catch (err) {
    console.error("Tokenizer init error:", err);
    if (loadingEl) loadingEl.innerText = `Could not load secure card form: ${err.message}`;
    statusEl.innerText = "Refresh to try again.";
    return;
  }

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    statusEl.innerText = "Tokenizing card…";

    let hostedTokenizationId = sessionTokenizationId;
    try {
      const result = await tokenizer.submitTokenization();
      if (!result.success) {
        const msg = result.error?.message || "Tokenization failed";
        statusEl.innerText = `Card tokenization failed: ${msg}`;
        btn.disabled = false;
        return;
      }
      hostedTokenizationId = result.hostedTokenizationId || hostedTokenizationId;
    } catch (err) {
      console.error("submitTokenization error:", err);
      statusEl.innerText = `Tokenization error: ${err.message}`;
      btn.disabled = false;
      return;
    }

    statusEl.innerText = "Processing payment…";
    try {
      const res = await fetch(`${API_BASE}/api/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostedTokenizationId,
          amount: amountMinor,
          currency,
          browserData: collectBrowserData(),
          returnUrl: `${API_BASE}/src/pages/return.html`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const apiMsg = data.error?.errors?.[0]?.message || data.error?.message || data.error || `HTTP ${res.status}`;
        throw new Error(apiMsg);
      }

      if (data.merchantAction?.actionType === "REDIRECT") {
        sessionStorage.setItem("payone.paymentId", data.paymentId);
        window.location.href = data.merchantAction.redirectData.redirectURL;
        return;
      }

      sessionStorage.setItem("payone.paymentId", data.paymentId);
      if (data.statusCode === 5 || data.statusCode === 9) {
        statusEl.innerText = `Payment successful — status ${data.status} (code ${data.statusCode}). Redirecting…`;
        localStorage.removeItem("cart");
        setTimeout(() => (window.location.href = `${API_BASE}/src/pages/return.html`), 800);
      } else {
        statusEl.innerText = `Payment not completed — status ${data.status || "unknown"} (code ${data.statusCode ?? "n/a"}).`;
        btn.disabled = false;
      }
    } catch (err) {
      console.error("createPayment error:", err);
      statusEl.innerText = `Payment error: ${err.message}`;
      btn.disabled = false;
    }
  });
});
