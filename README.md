<div align="center">

# 📲 OTP Gateway System

**A full-stack, SIM-based OTP delivery platform — no SMS API costs, ever.**

[![Node.js](https://img.shields.io/badge/Node.js-v20+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Flutter](https://img.shields.io/badge/Flutter-3.x-02569B?style=flat-square&logo=flutter&logoColor=white)](https://flutter.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-RTDB-FFCA28?style=flat-square&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://mongodb.com/)
[![Redis](https://img.shields.io/badge/Redis-Cache-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue?style=flat-square)](https://opensource.org/licenses/ISC)

</div>

---

## 📌 Overview

**OTP Gateway** is a production-grade, multi-tenant OTP delivery system that routes one-time passwords through **real Android SIM cards** instead of paid SMS gateway APIs. Businesses register, receive an API key, and start sending OTPs — while an Android device running the companion Flutter app listens for requests and physically sends the SMS.

> Think of it as your own private SMS gateway — powered by Firebase Realtime Database as the coordination layer.

---

## 🚀 Features

- 🏢 **Multi-tenant** — Each business gets an isolated API key and daily OTP quota
- 📡 **SIM-based SMS delivery** — No Twilio, no cost per SMS
- ⚡ **Real-time coordination** — Firebase RTDB dispatches OTP requests to the Android device instantly
- 🔒 **Secure OTP flow** — SHA-256 hashed OTPs stored in Redis, device-ID binding, brute-force protection
- 🔁 **Retry logic** — Failed SIM sends are retried automatically
- 🧹 **Auto-cleanup** — Stale RTDB entries purged every 5 minutes
- 📊 **Admin panel** — Web UI to manage businesses, view logs, and monitor usage
- 🛡️ **Rate limiting** — Per-IP and per-mobile request throttling
- 📱 **Flutter SIM app** — Android companion app with setup wizard and live activity dashboard

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **API Backend** | Node.js (Express v5), Mongoose, Joi validation |
| **Mobile App** | Flutter (Dart), Firebase SDK, Android SMS Platform Channel |
| **Client Demo** | Node.js (lightweight proxy app) |
| **OTP Storage** | Redis (TTL-based, atomic NX operations) |
| **Database** | MongoDB Atlas (business accounts, OTP logs) |
| **Real-time Bus** | Firebase Realtime Database |
| **Auth** | API Key (`x-api-key` header) + Admin token |
| **Security** | Helmet, CORS, express-rate-limit, bcrypt, SHA-256 |
| **Logging** | Winston |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Your Application                         │
│              (any backend using REST API)                       │
└───────────────────────┬─────────────────────────────────────────┘
                        │  POST /api/otp/generate  (x-api-key)
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    OTP Backend  (otpback)                        │
│  Express + MongoDB + Redis + Firebase Admin SDK                  │
│                                                                 │
│  1. Validates API key → identifies business                     │
│  2. Rate-limits per mobile number (Redis NX)                    │
│  3. Generates OTP → SHA-256 hash → stores in Redis (TTL 60s)   │
│  4. Pushes OTP request to Firebase RTDB                         │
└───────────────────────┬─────────────────────────────────────────┘
                        │  Firebase RTDB: otp_requests/{businessId}
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│               Flutter SIM App  (otpappflutter)                  │
│  Listens to Firebase RTDB → claims request via transaction      │
│  → sends SMS via Android native channel → updates status        │
└─────────────────────────────────────────────────────────────────┘
                        │  SMS delivered to end user
                        ▼
                  📱 End User's Phone
```

---

## ⚙️ How It Works

1. **Business onboarding** — Admin creates a business via the admin panel; an API key is issued.
2. **OTP Request** — Client calls `POST /api/otp/generate` with `mobile_number` + `device_id`.
3. **Rate check** — Backend checks Redis for per-mobile cooldown and daily business quota.
4. **OTP generated** — A 6-digit OTP is generated, SHA-256 hashed, and stored in Redis with a 60-second TTL.
5. **Firebase push** — The OTP request (with recipient + message) is written to Firebase RTDB under `otp_requests/{businessId}`.
6. **SIM app picks up** — The Flutter app on an Android device listens via `onChildAdded`. It claims the request using an atomic Firebase transaction (preventing duplicate sends).
7. **SMS sent** — The app calls the native Android SMS channel to physically send the SMS from the device SIM.
8. **Status update** — On success/failure, the app updates the RTDB record (`sent` / `failed`).
9. **OTP validation** — Client calls `POST /api/otp/validate` with `mobile_number` + `otp` + `device_id`. Backend verifies against Redis with brute-force protection (max 5 attempts).
10. **Cleanup** — Validated/failed OTPs are cleared from Redis; RTDB entries older than 5 minutes are auto-purged.

---

## 📁 Project Structure

```
otp/
├── otpback/               # Core OTP Gateway API
│   ├── src/
│   │   ├── config/        # DB, Redis, Firebase init
│   │   ├── controllers/   # otp, auth, admin
│   │   ├── middleware/    # API key auth, rate limit, error handler
│   │   ├── models/        # Business, MobileNumber, OtpLog (Mongoose)
│   │   ├── routes/        # /api/otp, /api/auth, /api/admin
│   │   ├── services/      # otp.service, sms.service, redis.service
│   │   └── utils/         # OTP generator, logger, API key gen
│   ├── public/            # Admin web UI (admin.html)
│   ├── .env.example
│   └── server.js
│
├── otpappflutter/         # Android SIM companion app
│   ├── lib/
│   │   ├── screens/       # SetupScreen, DashboardScreen
│   │   └── services/      # OtpListenerService, SmsChannel, HeartbeatService
│   └── android/           # Native SMS sending via PlatformChannel
│
├── otpapp/                # Minimal Node.js client demo
│   └── server.js          # /send-otp and /verify-otp proxy routes
│
└── .gitignore
```

---

## 🔧 Installation & Setup

### Prerequisites

- Node.js v20+
- Flutter 3.x + Android Studio
- MongoDB Atlas cluster
- Redis instance (Upstash recommended)
- Firebase project with Realtime Database enabled

---

### 1️⃣ Backend (`otpback`)

```bash
cd otpback
npm install
cp .env.example .env
# Fill in your MONGO_URL, REDIS_URL, Firebase credentials, and ADMIN credentials
npm run dev
```

**Environment variables:**

| Variable | Description |
|---|---|
| `MONGO_URL` | MongoDB Atlas connection string |
| `REDIS_URL` | Redis connection URL |
| `FIREBASE_DATABASE_URL` | Firebase RTDB URL |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Path to `serviceAccountKey.json` |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Admin panel credentials |
| `ADMIN_TOKEN` | Bearer token for admin API |

---

### 2️⃣ Flutter SIM App (`otpappflutter`)

```bash
cd otpappflutter
flutter pub get
# Add your google-services.json to android/app/
flutter run
```

On first launch, the app walks you through:
1. Entering your `businessId` from the admin panel
2. Selecting the SIM card to use for sending
3. Starting the listener — the app is now live

---

### 3️⃣ Client Demo (`otpapp`)

```bash
cd otpapp
npm install
# Create .env:
# OTP_SERVICE_URL=http://localhost:5001
# OTP_API_KEY=your-business-api-key
node server.js
```

Test endpoints:
```
GET /send-otp?mobile=+919876543210&device_id=browser123
GET /verify-otp?mobile=+919876543210&otp=123456&device_id=browser123
```

---

## 🔌 API Reference

### Send OTP
```http
POST /api/otp/generate
x-api-key: <your-api-key>
Content-Type: application/json

{ "mobile_number": "+919876543210", "device_id": "browser123" }
```

### Verify OTP
```http
POST /api/otp/validate
x-api-key: <your-api-key>
Content-Type: application/json

{ "mobile_number": "+919876543210", "otp": "123456", "device_id": "browser123" }
```

---

## 🔮 Future Improvements

- [ ] Multi-SIM load balancing across multiple Android devices
- [ ] WebSocket-based real-time admin dashboard
- [ ] Webhook callbacks on OTP status change
- [ ] WhatsApp OTP delivery as fallback channel
- [ ] iOS support via CallKit / alternative delivery
- [ ] Docker Compose setup for one-command deployment
- [ ] Usage analytics and business billing module

---

## 👨‍💻 Author

Built by **Saurabh** — [GitHub](https://github.com/saurabh12r)

---

<div align="center">
  <sub>If this helped you, give it a ⭐ on GitHub!</sub>
</div>
