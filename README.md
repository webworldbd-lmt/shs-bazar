# Market Koro — E-commerce Website

"Market Koro" is a mobile-responsive e-commerce platform designed specifically for the Kushtia, Bangladesh market.

## Tech Stack & Architecture
- **Frontend**: Plain HTML5, CSS3, JavaScript (Vanilla ESM Modules — No build step, framework, or Node.js runtime required).
- **Backend / DB**: Firebase (Authentication, Firestore Database, Firebase Storage).
- **Functions**: Firebase Cloud Functions (Node.js) for Telegram Bot order notifications.
- **Deploy**: Firebase Hosting via GitHub Actions CI/CD on every push to `main`.

---

## Brand Colors & Theme
- **Primary Color**: Deep Green (`#0B4D3C`)
- **Accent Color**: Orange (`#F5820A`)
- **Background**: Light Gray / White (`#F4F6F8` / `#FFFFFF`)
- **Tagline**: `"কুষ্টিয়ার সেরা অনলাইন শপিং গন্তব্য"`

---

## Project Structure
```text
├── .github/workflows/deploy.yml   # GitHub Actions automated Firebase deployment
├── assets/
│   ├── css/style.css             # Main stylesheet & mobile-first UI components
│   ├── images/logo.png           # Market Koro Logo
│   └── js/
│       ├── firebase-config.js    # Firebase initialization module
│       ├── auth.js               # Firebase Auth & Super Admin role auto-detection
│       ├── products.js           # Firestore products fetching & rendering logic
│       ├── app.js                # Core UI events, search, floating cart, drawer
│       ├── locations.js          # Bangladesh division, district, thana data
│       ├── cart-checkout.js      # Cart management & checkout order placement
│       ├── admin.js              # Super admin management actions
│       └── invoice.js            # Printable PDF invoice generator
├── functions/
│   ├── index.js                  # Cloud function for Telegram notifications
│   └── package.json
├── firebase.json                 # Firebase Hosting & Firestore rules config
├── firestore.rules               # Firestore Security Rules
├── storage.rules                 # Firebase Storage Rules
├── index.html                    # Homepage (Hero carousel, search, product sections)
├── shop.html                     # Product catalog with category filter tabs
├── product-detail.html           # Product details view
├── cart.html                     # Cart summary & quantity management
├── checkout.html                 # Address cascading & payment options (COD / bKash)
├── order-success.html            # Confirmation view
├── login.html                    # Email & Google OAuth login
├── profile.html                  # Profile & printable order invoice history
├── admin.html                    # Super Admin dashboard (banglabazaroffical@gmail.com)
└── README.md
```

---

## 🔑 Firebase Setup Instructions

1. **Create Firebase Project**:
   - Go to [Firebase Console](https://console.firebase.google.com/) and create a new project named `bangla-bazar-kushtia` (or custom name).
   - Enable **Firebase Authentication** with **Email/Password** AND **Google Sign-In**.
   - Create a **Firestore Database** in production mode.
   - Enable **Firebase Storage** for media uploads.

2. **Configure Frontend**:
   - Edit `assets/js/firebase-config.js` and update `firebaseConfig` keys with your Firebase Web App credentials.

3. **Super Admin Account**:
   - Any user signing up or logging in with `banglabazaroffical@gmail.com` is automatically assigned `admin` role and granted access to `admin.html`.

---

## 🚀 GitHub Actions CI/CD Setup

To enable automated Firebase Hosting deployment:
1. Generate a Firebase Service Account Key from Firebase Console:
   - Go to `Project Settings` -> `Service accounts` -> `Generate new private key`.
2. Go to your GitHub Repository -> `Settings` -> `Secrets and variables` -> `Actions`.
3. Add a New Secret:
   - **Name**: `FIREBASE_SERVICE_ACCOUNT_BANGLA_BAZAR_KUSHTIA`
   - **Value**: Paste the full JSON key content.
4. Push to `main` branch to trigger automated deployment!

---

## 🤖 Telegram Bot Configuration

1. **Bot Token Setup**:
   - Create a bot via [@BotFather](https://t.me/botfather) on Telegram to get your HTTP API bot token.
2. **Environment Secret Setup**:
   - Set the Firebase Function secret using Firebase CLI:
     ```bash
     firebase functions:config:set telegram.bot_token="YOUR_TELEGRAM_BOT_TOKEN"
     ```
   - Alternatively, edit `functions/index.js` placeholder `YOUR_TELEGRAM_BOT_TOKEN_PLACEHOLDER`.
3. Target Telegram Chat ID: `8360138661`.

---

## 📞 Support & Socials
- **Phone / WhatsApp**: `01342697743`
- **Email**: `saripofficialsupport@gmail.com`
- **Location**: Kushtia, Bangladesh
- **Telegram Channel**: [https://t.me/marketkoroofficial](https://t.me/marketkoroofficial)
- **Telegram Support**: `@shsaripofficial`
- **Facebook**: [https://facebook.com/marketkoroofficial](https://facebook.com/marketkoroofficial)
- **TikTok**: [https://tiktok.com/@marketkoroofficial](https://tiktok.com/@marketkoroofficial)
