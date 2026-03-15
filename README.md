# 🍽️ Deekshita Food Court – WhatsApp Chatbot

A production-ready WhatsApp food ordering chatbot built with **Node.js**, **Twilio**, and **Razorpay**.

---

## 📁 Project Structure

```
deekshita-food-court/
├── server.js                  # Entry point
├── menu.json                  # Food menu data
├── package.json
├── railway.json               # Railway deployment config
├── .env.example               # Environment variable template
├── config/
│   └── index.js               # Centralised config with env validation
├── routes/
│   ├── botRoutes.js           # POST /webhook  (Twilio)
│   ├── paymentRoutes.js       # POST /payment/webhook  (Razorpay)
│   └── adminRoutes.js         # GET  /admin/orders
├── controllers/
│   ├── botController.js       # WhatsApp conversation state machine
│   └── paymentController.js   # Razorpay webhook + redirect handler
├── services/
│   ├── twilioService.js       # Send WhatsApp messages
│   ├── razorpayService.js     # Create payment links + verify signatures
│   ├── menuService.js         # Menu lookup + formatting
│   └── orderStore.js          # In-memory sessions + JSON order persistence
├── middleware/
│   └── rawBody.js             # Capture raw body for Razorpay HMAC
└── data/
    └── orders.json            # Auto-created; persists all orders
```

---

## 🤖 Bot Conversation Flow

```
User sends any message
        │
        ▼
Welcome message + Menu
        │
User replies with item number (e.g. "2")
        │
        ▼
"You selected Chicken Biryani (Non-Veg) – ₹180
 Reply CONFIRM to proceed to payment."
        │
User replies "CONFIRM"
        │
        ▼
Razorpay payment link generated & sent
        │
User pays via link
        │
        ▼  (Razorpay webhook fires)
"Payment successful ✅ Your order has been confirmed!"
```

---

## ⚙️ Local Setup

### 1. Clone & install

```bash
git clone <your-repo-url>
cd deekshita-food-court
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in all values in .env
```

### 3. Expose local server (for webhook testing)

```bash
# Install ngrok: https://ngrok.com
ngrok http 3000
# Copy the https URL (e.g. https://abc123.ngrok.io)
# Set BASE_URL=https://abc123.ngrok.io in .env
```

### 4. Run the bot

```bash
npm run dev   # development (with nodemon)
npm start     # production
```

---

## 🌐 Railway Deployment

### Step 1 – Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/deekshita-food-court.git
git push -u origin main
```

### Step 2 – Create Railway project

1. Go to [railway.app](https://railway.app) → **New Project**
2. Select **Deploy from GitHub repo**
3. Choose your repository

### Step 3 – Add environment variables

In Railway → your service → **Variables**, add:

| Variable | Value |
|---|---|
| `PORT` | `3000` |
| `NODE_ENV` | `production` |
| `BASE_URL` | `https://YOUR-APP.up.railway.app` |
| `TWILIO_ACCOUNT_SID` | From Twilio Console |
| `TWILIO_AUTH_TOKEN` | From Twilio Console |
| `TWILIO_WHATSAPP_NUMBER` | `whatsapp:+14155238886` |
| `RAZORPAY_KEY_ID` | From Razorpay Dashboard |
| `RAZORPAY_KEY_SECRET` | From Razorpay Dashboard |
| `RAZORPAY_WEBHOOK_SECRET` | Set in Razorpay webhook settings |
| `RESTAURANT_NAME` | `Deekshita Food Court` |
| `RESTAURANT_PHONE` | Your restaurant phone |
| `ADMIN_API_KEY` | Any secret string (protects /admin/orders) |

### Step 4 – Get your Railway URL

After deploy, Railway gives you a public URL like:
`https://deekshita-food-court.up.railway.app`

Set this as `BASE_URL`.

---

## 📱 Twilio Configuration

1. Log in to [console.twilio.com](https://console.twilio.com)
2. Go to **Messaging → Try it out → Send a WhatsApp message**
3. Under **Sandbox Settings**, set the **When a message comes in** webhook to:

```
https://YOUR-APP.up.railway.app/webhook
```

Method: `HTTP POST`

4. For production, configure a WhatsApp Business Sender and update `TWILIO_WHATSAPP_NUMBER`.

---

## 💳 Razorpay Configuration

1. Log in to [dashboard.razorpay.com](https://dashboard.razorpay.com)
2. **Settings → API Keys** → Generate Key ID and Secret
3. **Settings → Webhooks → Add New Webhook**:
   - URL: `https://YOUR-APP.up.railway.app/payment/webhook`
   - Secret: any strong random string (save as `RAZORPAY_WEBHOOK_SECRET`)
   - Active Events: ✅ `payment_link.paid`, ✅ `payment_link.cancelled`, ✅ `payment.failed`

---

## 📋 API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Health check + service info |
| `GET` | `/health` | Simple health probe |
| `POST` | `/webhook` | Twilio WhatsApp webhook |
| `POST` | `/payment/webhook` | Razorpay payment events |
| `GET` | `/payment/success` | Post-payment redirect page |
| `GET` | `/admin/orders` | All orders (requires `x-api-key` header) |

---

## 🍽️ Customising the Menu

Edit `menu.json`. Each item must have:

```json
{
  "id": 1,
  "name": "Dish Name",
  "type": "Veg",        // "Veg" or "Non-Veg"
  "price": 120,
  "description": "Short description"
}
```

No server restart needed — changes take effect automatically (menu is loaded at startup).

---

## 📦 Order Storage

Orders are stored in `data/orders.json` and include:

```json
{
  "id": "uuid",
  "phone": "whatsapp:+919876543210",
  "item": { "id": 2, "name": "Chicken Biryani", "type": "Non-Veg", "price": 180 },
  "paymentLinkId": "plink_xxxxx",
  "paymentLinkUrl": "https://rzp.io/i/xxxxx",
  "paymentStatus": "PAID",
  "createdAt": "2024-01-01T10:00:00.000Z",
  "updatedAt": "2024-01-01T10:05:00.000Z"
}
```

---

## 🔐 Security Notes

- Razorpay webhooks are verified with HMAC-SHA256 signature
- Admin orders endpoint is protected by `x-api-key` header
- Never commit `.env` to version control
- Use Railway's environment variable manager for all secrets

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 18+ |
| Framework | Express.js 4 |
| WhatsApp API | Twilio |
| Payments | Razorpay Payment Links |
| Storage | JSON file (orders) + in-memory sessions |
| Deployment | Railway |
