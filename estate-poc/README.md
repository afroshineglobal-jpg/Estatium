# 🏢 GreenVille Estate Management System — POC

A full-featured Estate Management PWA for a single society (up to 100 households), built with Node.js + SQLite + React.

---

## 🚀 Quick Start (3 Steps)

### Prerequisites
- Node.js v18+ 
- npm v9+

### Step 1 — Clone & Install
```bash
cd estate-poc
npm install           # installs concurrently
npm run setup         # installs all deps + creates DB + seeds data
```

### Step 2 — Start Development
```bash
npm run dev
```
- **Backend**: http://localhost:3001
- **Frontend**: http://localhost:3000

### Step 3 — Open & Login
Go to **http://localhost:3000** and use any demo account below.

---

## 🔐 Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@estate.com | Admin@123 |
| Security Admin | security@estate.com | Security@123 |
| Finance Admin | finance@estate.com | Finance@123 |
| Maintenance Manager | maintenance@estate.com | Maint@123 |
| Guard | guard@estate.com | Guard@123 |
| Resident | chidi@email.com | Resident@123 |
| Resident 2 | amaka@email.com | Resident@123 |

---

## 📱 Modules (All 14)

| Module | Path | Who Can Access |
|--------|------|----------------|
| Dashboard | `/` | All roles |
| Residents | `/residents` | Admin, Security, Finance |
| Visitors (VMS) | `/visitors` | Admin, Security, Resident, Guard |
| Parcels | `/parcels` | Admin, Security, Resident, Guard |
| Amenities | `/amenities` | Admin, Resident |
| Billing & Payments | `/billing` | Admin, Finance, Resident |
| Vehicles | `/vehicles` | Admin, Security, Resident, Guard |
| Staff | `/staff` | Admin, Security, Maintenance |
| Maintenance | `/maintenance` | Admin, Maintenance, Resident |
| Emergency (SOS) | `/emergency` | All roles |
| Communication | `/communication` | All roles |
| Analytics | `/analytics` | Admin, Finance, Security |
| Ads & Banners | `/advertisements` | Admin, Finance, Resident |
| Settings | `/settings` | Admin |

---

## 🏗️ Project Structure

```
estate-poc/
├── server/                    # Node.js + Express backend
│   ├── prisma/
│   │   ├── schema.prisma      # All 20+ database models
│   │   └── seed.js            # Sample data seeder
│   └── src/
│       ├── app.js             # Main entry point + Socket.io
│       ├── config/prisma.js   # DB client singleton
│       ├── middleware/auth.js  # JWT + RBAC middleware
│       ├── utils/
│       │   ├── firebase.js    # FCM push notifications
│       │   └── notify.js      # Notification helper
│       └── modules/           # 14 feature modules
│           ├── auth/
│           ├── residents/
│           ├── visitors/
│           ├── parcels/
│           ├── amenities/
│           ├── billing/
│           ├── vehicles/
│           ├── staff/
│           ├── maintenance/
│           ├── emergency/
│           ├── communication/
│           ├── analytics/
│           ├── advertisements/
│           └── settings/
│
└── client/                    # React PWA frontend
    └── src/
        ├── App.jsx            # Router + layout
        ├── pages/             # 14 module pages
        ├── components/
        │   └── layout/        # Sidebar + Header
        ├── hooks/
        │   ├── useAuth.jsx    # Auth context
        │   └── useSocket.jsx  # Socket.io context
        └── utils/api.js       # Axios client
```

---

## 🔔 Firebase Push Notifications Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a project → Project Settings → Service Accounts
3. Generate new private key (downloads a JSON file)
4. Copy values to `server/.env`:

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@project.iam.gserviceaccount.com
```

5. In your React app, add Firebase config to `client/src/firebase/config.js`

---

## 📊 Database (SQLite)

View and edit data with Prisma Studio:
```bash
cd server && npx prisma studio
```
Opens at http://localhost:5555

---

## 🔑 Key Features Implemented

### Visitor Management (VMS)
- ✅ Pre-approved visitors with 5-digit entry code + QR
- ✅ Walk-in visitors with real-time resident notification
- ✅ Resident approve/deny from app
- ✅ Guard entry/exit logging
- ✅ Delivery with "Leave at Gate" option

### Security & Access
- ✅ Role-based access control (6 roles)
- ✅ JWT authentication
- ✅ QR codes for vehicles and staff
- ✅ OTP-based parcel collection

### Real-time
- ✅ Socket.io for live visitor alerts
- ✅ Emergency SOS broadcast to all guards
- ✅ Real-time community chat

### Billing
- ✅ Individual and bulk bill creation
- ✅ Payment recording with method tracking
- ✅ Revenue analytics dashboard

### Emergency
- ✅ SOS panic button for residents
- ✅ Immediate broadcast to all guards/admins
- ✅ Incident tracking and resolution

---

## 🚀 Upgrading to Production (SaaS)

When ready to scale:

| POC (Now) | Production |
|-----------|-----------|
| SQLite | PostgreSQL + Row-Level Security |
| Local file uploads | AWS S3 / Cloudflare R2 |
| Single server | Kubernetes + horizontal scaling |
| No event queue | Apache Kafka |
| Single society | Multi-tenant (estate_id on all tables) |
| React PWA | Flutter apps (iOS/Android) |

The modular architecture means each module can be extracted to a microservice with minimal changes.

---

## 📝 API Documentation

Base URL: `http://localhost:3001/api`

All protected routes require: `Authorization: Bearer <token>`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /auth/login | Login |
| GET | /auth/me | Current user |
| GET | /residents | List residents |
| POST | /residents | Add resident |
| GET | /visitors | List visitors |
| POST | /visitors/pre-approve | Pre-approve visitor |
| POST | /visitors/walkin | Log walk-in |
| PUT | /visitors/:id/entry | Confirm entry |
| GET | /billing | List bills |
| POST | /billing/bulk | Bulk bill all residents |
| POST | /emergency | Trigger SOS |
| GET | /analytics/dashboard | Dashboard stats |

---

Built with ❤️ for GreenVille Estate
