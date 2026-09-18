# Tailor Management System V1 ? Production Deployment Guide

## 1. System Requirements & Prerequisites
- **Operating System**: Ubuntu 22.04 LTS / Debian 12 (or Windows Server 2022)
- **Node.js**: v18.18.0 LTS or v20.x
- **Database**: PostgreSQL 15+ (PostgreSQL 18 tested and fully supported)
- **Process Manager**: PM2 (`npm install -g pm2`)
- **Reverse Proxy**: Nginx 1.22+
- **SSL**: Let's Encrypt Certbot

---

## 2. Environment Variables Configuration

Create `.env` in `backend/`:
```env
# Server
PORT=5000
NODE_ENV=production

# Database (PostgreSQL Connection String)
DATABASE_URL="postgresql://tailor_user:secure_password@localhost:5432/tailor_db?schema=public&connection_limit=25"

# Security & Tokens
JWT_SECRET="YOUR_RANDOM_256_BIT_SECRET_KEY_HEX_OR_BASE64"
JWT_EXPIRES_IN="24h"

# Application Domains
CORS_ORIGIN="https://atelier.yourdomain.com,https://portal.yourdomain.com"
STORAGE_DRIVER="local"
STORAGE_PATH="./uploads"
```

Create `.env` in `frontend/`:
```env
VITE_API_BASE_URL="https://api.yourdomain.com/api/v1"
```

---

## 3. Database Migration & Initialization

Run the production migration and seed the baseline master tenants and catalogs:
```bash
cd backend
npm install --omit=dev
npx prisma migrate deploy
npm run seed
```

---

## 4. Production Compilation

### Backend Build
```bash
cd backend
npm run build
# Outputs compiled JavaScript into backend/dist/
```

### Frontend Build
```bash
cd frontend
npm install --omit=dev
npm run build
# Outputs optimized static bundle into frontend/dist/
```

---

## 5. PM2 Process Manager Configuration

Create `backend/ecosystem.config.js`:
```javascript
module.exports = {
  apps: [
    {
      name: 'tailor-backend',
      script: './dist/server.js',
      cwd: './backend',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    }
  ]
};
```

Launch with PM2:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## 6. Nginx Reverse Proxy Configuration

Create `/etc/nginx/sites-available/tailor-management.conf`:
```nginx
server {
    listen 80;
    server_name atelier.yourdomain.com api.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl http2;
    server_name atelier.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/atelier.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/atelier.yourdomain.com/privkey.pem;

    root /var/www/tailor-frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Static asset caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Service worker & manifest must have immediate revalidation
    location ~* (sw\.js|manifest\.json)$ {
        expires -1;
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }
}
```

Enable site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/tailor-management.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 7. Render Cloud Deployment (PostgreSQL + Backend + Frontend)

The project includes pre-configured Render infrastructure ([render.yaml](file:///c:/Users/Reshma/Desktop/Tailor%20system%20application/render.yaml)), baseline database migrations, SPA rewrite rules, and dynamic environment handling.

### Managed Database: Render PostgreSQL
- **Name**: `tailor-management-db`
- **Database**: `tailor_db`
- **User**: `tailor_admin`
- **Connection URL**:
  - **Internal Database URL** (for Render backend): `postgres://tailor_admin:PASSWORD@dpg-xxxxxx-a:5432/tailor_db`
  - **External Database URL** (for local/tools): `postgres://tailor_admin:PASSWORD@dpg-xxxxxx-a.oregon-postgres.render.com/tailor_db?sslmode=require`

### Backend: Render Web Service
- **Root Directory**: `backend`
- **Build Command**: `npm install && npm run build` (runs `prisma generate && tsc`)
- **Start Command**: `npx prisma migrate deploy && npm start` (applies all 30+ table migrations automatically, then boots Express)
- **Health Check Path**: `/health`
- **Required Environment Variables**:
  - `NODE_ENV`: `production`
  - `PORT`: Automatically set by Render (or `10000`)
  - `DATABASE_URL`: Internal PostgreSQL connection string from Render PostgreSQL
  - `JWT_SECRET`: Secure 32+ character random string
  - `JWT_REFRESH_SECRET`: Secure 32+ character random string
  - `CORS_ORIGIN`: Your deployed frontend Render URL (e.g., `https://tailor-frontend.onrender.com`)
  - `DEFAULT_TENANT_SLUG`: `royal-bespoke`

### Frontend: Render Static Site
- **Root Directory**: `frontend`
- **Build Command**: `npm install && npm run build`
- **Publish Directory**: `dist`
- **SPA Rewrite Rule**: Automatically handled via `frontend/public/_redirects` (`/* /index.html 200`) and `render.yaml`
- **Required Environment Variables**:
  - `VITE_API_URL`: Your deployed backend Render URL (e.g., `https://tailor-backend.onrender.com`)

### Seed Initial Data on Render
In the Render dashboard, open the **Shell** tab for `tailor-management-backend` and execute:
```bash
npm run seed
```


