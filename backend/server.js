const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");
const onlinePaymentsSdk = require("onlinepayments-sdk-nodejs");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const projectRoot = path.resolve(__dirname, "..");
app.use(express.static(projectRoot));

const directSdk = onlinePaymentsSdk.init({
  integrator: "EcomEuropa-PAYONE-S2S-Demo",
  host: "payment.preprod.payone.com",
  scheme: "https",
  enableLogging: true,
  apiKeyId: process.env.PAYONE_API_KEY_ID,
  secretApiKey: process.env.PAYONE_API_SECRET,
});

const MERCHANT_ID = process.env.PAYONE_MERCHANT_ID;
const PORT = process.env.PORT || 3000;

const generateReference = () => `ORDER-${Date.now()}`;
const originFromReq = (req) => `${req.protocol}://${req.get("host")}`;

// 1) POST /api/hosted-tokenization
//    Creates a Hosted Tokenization session -> returns iframe URL + hostedTokenizationId.
app.post("/api/hosted-tokenization", async (req, res) => {
  try {
    const sdkResponse = await directSdk.hostedTokenization.createHostedTokenization(
      MERCHANT_ID,
      {
        locale: req.body?.locale || "en_GB",
        askConsumerConsent: false,
        paymentProductFilters: {
          restrictTo: { products: [1, 2, 3] },
        },
      },
      {}
    );

    if (!sdkResponse.isSuccess) {
      return res.status(sdkResponse.status || 500).json({ error: sdkResponse.body });
    }

    const body = sdkResponse.body;
    res.status(200).json({
      hostedTokenizationId: body.hostedTokenizationId,
      hostedTokenizationUrl: body.hostedTokenizationUrl,
      // SRI hash for the tokenizer.min.js <script integrity="..."> tag.
      sri: body.sri,
    });
  } catch (error) {
    console.error("PAYONE hosted tokenization error:", error);
    res.status(500).json({ error: error.message || "Hosted tokenization session creation failed" });
  }
});

// 2) POST /api/payments
//    Charges using either hostedTokenizationId (recommended) or a permanent token.
app.post("/api/payments", async (req, res) => {
  try {
    const {
      hostedTokenizationId,
      token,
      amount,
      currency,
      browserData,
      returnUrl,
    } = req.body;

    if (!hostedTokenizationId && !token) {
      return res.status(400).json({ error: "hostedTokenizationId or token is required" });
    }

    const origin = originFromReq(req);

    const createPaymentRequest = {
      cardPaymentMethodSpecificInput: {
        authorizationMode: "SALE",
        threeDSecure: {
          skipAuthentication: false,
          redirectionData: {
            returnUrl: returnUrl || `${origin}/src/pages/return.html`,
          },
        },
      },
      order: {
        amountOfMoney: {
          amount: amount || 1000,
          currencyCode: currency || "EUR",
        },
        references: {
          merchantReference: generateReference(),
        },
        customer: {
          device: {
            acceptHeader: browserData?.acceptHeader || req.get("accept") || "*/*",
            locale: browserData?.locale || "en_GB",
            timezoneOffsetUtcMinutes: String(browserData?.timezoneOffsetUtcMinutes ?? "0"),
            userAgent: browserData?.userAgent || req.get("user-agent") || "",
            browserData: {
              colorDepth: browserData?.colorDepth ?? 24,
              javaScriptEnabled: true,
              javaEnabled: browserData?.javaEnabled ?? false,
              screenHeight: String(browserData?.screenHeight ?? "1080"),
              screenWidth: String(browserData?.screenWidth ?? "1920"),
            },
          },
        },
      },
    };

    if (hostedTokenizationId) {
      // Top-level per SDK schema (createPaymentRequest.js), not nested under cardPaymentMethodSpecificInput.
      createPaymentRequest.hostedTokenizationId = hostedTokenizationId;
    } else {
      createPaymentRequest.cardPaymentMethodSpecificInput.token = token;
    }

    const sdkResponse = await directSdk.payments.createPayment(MERCHANT_ID, createPaymentRequest, {});

    if (!sdkResponse.isSuccess) {
      return res.status(sdkResponse.status || 500).json({ error: sdkResponse.body });
    }

    const body = sdkResponse.body;
    const payment = body.payment || body.createdPaymentOutput?.payment;
    const merchantAction = body.merchantAction || null;

    res.status(200).json({
      paymentId: payment?.id,
      status: payment?.status,
      statusCode: payment?.statusOutput?.statusCode,
      merchantAction,
      raw: body,
    });
  } catch (error) {
    console.error("PAYONE createPayment error:", error);
    res.status(500).json({ error: error.message || "Payment creation failed" });
  }
});

// 3) GET /api/payments/:id
//    Fetch final status after the customer returns from a 3-D Secure challenge redirect.
app.get("/api/payments/:id", async (req, res) => {
  try {
    const sdkResponse = await directSdk.payments.getPayment(MERCHANT_ID, req.params.id, {});
    if (!sdkResponse.isSuccess) {
      return res.status(sdkResponse.status || 500).json({ error: sdkResponse.body });
    }
    const payment = sdkResponse.body;
    res.status(200).json({
      paymentId: payment.id,
      status: payment.status,
      statusCode: payment.statusOutput?.statusCode,
      raw: payment,
    });
  } catch (error) {
    console.error("PAYONE getPayment error:", error);
    res.status(500).json({ error: error.message || "Fetching payment status failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Backend + storefront running on http://localhost:${PORT}`);
  console.log(`Open: http://localhost:${PORT}/index.html`);
});
