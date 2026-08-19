# 💧 WaterBoi

> **Next-Generation Water Refilling Station Operations, Inventory & Logistics Platform**

[![PWA Ready](https://img.shields.io/badge/PWA-Ready-00B4D8?logo=pwa&logoColor=white)](https://waterboi-767ff.web.app)
[![Firebase](https://img.shields.io/badge/Backend-Firebase%20%7C%20Firestore-FFA000?logo=firebase&logoColor=white)](https://firebase.google.com/)
[![License](https://img.shields.io/badge/License-MIT-06D6A0)](LICENSE)
[![Status](https://img.shields.io/badge/Deployment-Live-0077B6)](https://waterboi-767ff.web.app)

WaterBoi is an offline-first Progressive Web Application (PWA) tailored for water refilling stations in the Philippines. It digitizes physical jug inventory tracking, automates real-time staff commission payouts, supports instant offline delivery logging with automatic background sync, and provides management analytics for station owners.

🌐 **Live Production Application:** [https://waterboi-767ff.web.app](https://waterboi-767ff.web.app)

---

## 🌟 Key Features

### 🚚 1. Offline-First Field Delivery Logging
- **0ms Zero-Latency Execution**: Field drivers can log deliveries offline without network lag. Deliveries are safely stored in a local IndexedDB queue.
- **Smart Jug De-selection**: Assigned jug numbers are immediately removed from the available in-stock pool across the application, preventing duplicate delivery logs even before internet reconnects.
- **Automatic Background Synchronization**: Upon reconnection, pending orders and inventory statuses seamlessly sync to Cloud Firestore.

### 📦 2. Smart Physical Jug Numbering Inventory (Pool 1–500)
- **Individual Physical Jug Tracking**: Assign physical number tags (`#001`, `#002`, etc.) to track every jug's lifecycle (`In Stock`, `Out for Delivery`, `With Customer`, `Damaged`).
- **Batch Registration Wizard**: Register up to 500 numbered jugs into shop stock with real-time range selectors (1-100, 101-200, etc.).
- **Rapid Return to Shop**: One-tap return modal to mark empty jugs returned by customers back to *In Stock (Refilled)* status.

### 💰 3. Automated Commission & Payout Engine
- **Configurable Multi-Tier Rates**: Configurable per-service commission rates (default 27%) with live price/commission calculation.
- **Dedicated Driver History & Receipts**: Instant receipt generator with printable/PDF export capabilities.
- **Admin Settlement Tracker**: Mark payouts as paid/unpaid with historical audit trails.

### 🏆 4. Gamified Milestones & Career Avatars
- **Progressive Role-Based Avatars**: Dynamic avatar unlocks for both delivery staff and station owners based on career deliveries, total jugs delivered, and revenue milestones.
- **Challenging Progression Tiers**: From *Newbie Station Trainee* up to *God of Hydration* (10,000+ jugs delivered / ₱100,000 commission).

### 🛡️ 5. Enterprise Security & Auditability
- **Role-Based Access Control (RBAC)**: Permanent Cloud Firestore security rules preventing privilege escalation or unauthorized price/payout edits.
- **Immutable Audit Logging**: Every price change, employee account creation, inventory adjustment, and payout settlement writes an append-only audit trail.

---

## 🛠️ Tech Stack

| Layer | Technology | Description |
|---|---|---|
| **Frontend UI** | HTML5, Modern CSS (Design Tokens, Glassmorphism), Vanilla JavaScript | Ultra-fast, zero-dependency client architecture |
| **Build System** | [Vite](https://vitejs.dev/) | High-speed compilation & module bundling |
| **Offline & PWA** | [Vite PWA Plugin](https://vite-pwa-org.netlify.app/), Workbox, IndexedDB | Service Worker precaching & offline persistence |
| **Database & Auth** | Google Cloud Firestore & Firebase Auth | Real-time NoSQL database & secure credential management |
| **Icons & Media** | [Lucide Icons](https://lucide.dev/) | 100% vector SVG icons |
| **Hosting** | Firebase Hosting CDN | Worldwide CDN edge deployment with HTTPS |

---

## 📐 System Architecture

```
┌────────────────────────────────────────────────────────┐
│               Google Cloud Firebase Backend            │
│  ┌───────────────────────┐  ┌───────────────────────┐  │
│  │ Firebase Auth (JWT)   │  │ Cloud Firestore (RBAC)│  │
│  └───────────┬───────────┘  └───────────┬───────────┘  │
│              │                          │              │
│  ┌───────────┴──────────────────────────┴───────────┐  │
│  │             Firebase Hosting (Global CDN)        │  │
│  └──────────────────────────┬───────────────────────┘  │
└─────────────────────────────┼──────────────────────────┘
                              │
               ┌──────────────┼──────────────┐
               │                             │
    ┌──────────┴──────────┐       ┌──────────┴──────────┐
    │  Station Owner UI   │       │  Field Driver PWA   │
    │  (Desktop / Tablet) │       │  (Mobile Offline)   │
    │  • Full Analytics   │       │  • Log Deliveries   │
    │  • Price & Payouts  │       │  • Offline Cache    │
    │  • Audit Trail      │       │  • Auto-Sync        │
    └─────────────────────┘       └─────────────────────┘
```

---

## 🚀 Getting Started Locally

### Prerequisites
- Node.js 18+ ([Download](https://nodejs.org/))
- Git

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/cuadrodennisleonardo-web/WaterBoi.git
   cd WaterBoi
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Copy the `.env.example` template:
   ```bash
   cp .env.example .env
   ```
   Fill in your Firebase credentials in `.env`.

4. **Start Local Dev Server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

5. **Build for Production:**
   ```bash
   npm run build
   ```

---

## 🔒 Security & Database Rules

The application uses production-hardened Cloud Firestore security rules with granular access controls:

- **Users (`/users/{uid}`)**: Authenticated staff can read crew lists; only Station Owners can modify roles and administrative privileges.
- **Deliveries (`/deliveries/{id}`)**: Drivers can read and log deliveries; only Station Owners can delete records.
- **Jugs Inventory (`/jugs/{id}`)**: Staff can update statuses (`in_stock`, `out_for_delivery`); only Station Owners can delete inventory.
- **Audit Log (`/auditLog/{id}`)**: Append-only collection; updates and deletions are strictly rejected.

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
