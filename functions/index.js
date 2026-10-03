const functions = require("firebase-functions");
const admin = require("firebase-admin");
const https = require("https");

admin.initializeApp();

// Telegram Notification Trigger on new Firestore Order creation
// Chat ID: 8360138661
exports.sendTelegramOrderNotification = functions.firestore
  .document("orders/{orderId}")
  .onCreate(async (snap, context) => {
    const orderData = snap.data();
    const orderId = context.params.orderId;

    // Retrieve bot token from environment config or placeholder
    // Set via CLI: firebase functions:config:set telegram.bot_token="YOUR_TELEGRAM_BOT_TOKEN"
    const botToken = functions.config().telegram
      ? functions.config().telegram.bot_token
      : "YOUR_TELEGRAM_BOT_TOKEN_PLACEHOLDER";

    const chatId = "8360138661";

    if (!botToken || botToken === "YOUR_TELEGRAM_BOT_TOKEN_PLACEHOLDER") {
      console.log("Telegram Bot Token not configured yet. Skipping message notification.");
      return null;
    }

    const customerName = orderData.customerInfo ? orderData.customerInfo.name : "Customer";
    const customerPhone = orderData.customerInfo ? orderData.customerInfo.phone : "N/A";
    const totalAmount = orderData.totalAmount || 0;
    const paymentMethod = orderData.paymentMethod ? orderData.paymentMethod.toUpperCase() : "COD";
    const district = orderData.shippingAddress ? orderData.shippingAddress.district : "Kushtia";

    const message = `🛍️ *NEW ORDER PLACED on Market Koro!* 🛍️\n\n` +
      `📦 *Order ID:* \`${orderId}\`\n` +
      `👤 *Customer:* ${customerName}\n` +
      `📞 *Phone:* ${customerPhone}\n` +
      `📍 *Location:* ${district}\n` +
      `💳 *Payment:* ${paymentMethod}\n` +
      `💰 *Total Amount:* ৳${totalAmount}\n\n` +
      `⚡ Check Admin Panel to process this order!`;

    const postData = JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: "Markdown"
    });

    const options = {
      hostname: "api.telegram.org",
      port: 443,
      path: `/bot${botToken}/sendMessage`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData)
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let responseBody = "";
        res.on("data", (chunk) => { responseBody += chunk; });
        res.on("end", () => {
          console.log("Telegram API Response:", responseBody);
          resolve(true);
        });
      });

      req.on("error", (e) => {
        console.error("Telegram API Request Error:", e);
        reject(e);
      });

      req.write(postData);
      req.end();
    });
  });
