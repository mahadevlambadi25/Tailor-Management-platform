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

The active service worker (`frontend/public/sw.js`) implements tailored caching policies:

### 3.1 App Shell & Static Assets: Stale-While-Revalidate
- Static JavaScript chunks, CSS stylesheets, SVGs, and web fonts are served directly from the Cache Storage API for instantaneous load times (< 200ms).
- In the background, the Service Worker checks for updated hashes and populates the cache for subsequent visits.

### 3.2 API Requests: Network-First with Offline Cache Fallback
- For requests targeting `/api/v1/customers`, `/api/v1/orders`, and `/api/v1/measurements`:
  1. The worker first attempts a direct network fetch.
  2. If network succeeds, it writes a clone of the response into `tailor-api-cache-v1`.
  3. If network fails (e.g. offline workshop scenario), it serves the cached response, preventing blank screens or crash states.

---

## 4. Offline Synchronization State & UX

When network connectivity drops:
1. `window.addEventListener('offline')` triggers inside `OfflineSyncContext.tsx`.
2. A high-contrast amber banner informs the staff: *"Working in Offline Mode. Cached records available."*
3. All write operations (e.g. taking measurements or drafting an order) are stored locally in IndexedDB / LocalStorage queue.
4. When connectivity returns (`online` event), pending mutations are replayed sequentially to the backend server with idempotency headers, ensuring zero duplicate bookings.
