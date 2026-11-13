# Tailor Management System V1 ? PWA & Offline Guide

## 1. PWA Architecture Overview

Tailor Management System V1 is engineered as a full Progressive Web App (PWA) allowing tailor workshops and boutique floors to operate seamlessly even during intermittent internet drops or complete network outages.

Key Capabilities:
- **Standalone Mobile/Tablet Installation**: Launches without browser URL bars, providing a native app experience.
- **Service Worker Asset Caching**: Pre-caches all application shells, icons, stylesheets, and core scripts.
- **Offline Data Resiliency**: Read operations fall back to cached client-side stores; write mutations queue locally and notify the operator via the dynamic status indicator.

---

## 2. Web App Manifest Configuration

The application manifest is registered at `/manifest.json`:
```json
{
  "short_name": "TailorApp",
  "name": "Tailor Management System",
  "icons": [
    {
      "src": "/favicon.ico",
      "sizes": "64x64 32x32 24x24 16x16",
      "type": "image/x-icon"
    }
  ],
  "start_url": "/",
  "background_color": "#ffffff",
  "theme_color": "#2563eb",
  "display": "standalone",
  "orientation": "any"
}
```

---

## 3. Service Worker Caching Strategies

The active service worker (`frontend/public/sw.js`, cache `tailorpro-static-v3`) is deliberately narrow.
It only handles **same-origin GET** requests:

| Request | Strategy |
|---|---|
| Page navigations (`/`, `/login`, `/orders/123`, ...) | Network-first; offline fallback to the cached `index.html` app shell |
| Hashed build files (`/assets/*`) | Cache-first (file names change on every build, so cached copies never go stale) |
| `manifest.json`, `favicon.ico`, `pwa-*.png` | Network-first; cached copy when offline |

### 3.1 Never intercepted (always go straight to the network)
- **All non-GET requests** (registration, login, payments, any create/update/delete).
- **All backend API calls** (`/api/*`). API responses are never cached by the service worker;
  offline read resilience comes from `OfflineSyncContext` (client-side stores), not from Cache Storage.
- **Cross-origin requests** (Google Fonts, Razorpay checkout, third-party scripts).

### 3.2 Updates
- `main.tsx` registers the worker with `updateViaCache: 'none'`, and `sw.js` is deployed with
  `Cache-Control: no-cache`, so every visit checks for a new worker.
- A new worker calls `skipWaiting()` + `clients.claim()` and deletes all older `tailorpro-*` caches
  on activation. Bump `CACHE_VERSION` in `sw.js` whenever its caching behaviour changes.

---

## 4. Offline Synchronization State & UX

When network connectivity drops:
1. `window.addEventListener('offline')` triggers inside `OfflineSyncContext.tsx`.
2. A high-contrast amber banner informs the staff: *"Working in Offline Mode. Cached records available."*
3. All write operations (e.g. taking measurements or drafting an order) are stored locally in IndexedDB / LocalStorage queue.
4. When connectivity returns (`online` event), pending mutations are replayed sequentially to the backend server with idempotency headers, ensuring zero duplicate bookings.
