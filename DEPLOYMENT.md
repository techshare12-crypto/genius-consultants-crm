# Production Deployment & Infrastructure Guide — Genius Consultancy CRM

## 1. Prerequisites & System Requirements

- **Node.js**: v20.x LTS or higher
- **PostgreSQL**: v15.x or higher (AWS RDS, Supabase, Neon, or self-hosted Ubuntu PostgreSQL)
- **Memory**: Minimum 2 GB RAM (4 GB recommended for high-volume Excel imports)
- **Disk**: 20 GB SSD storage

---

## 2. Environment Variables (`.env`)

```env
# Application Configuration
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_APP_URL=https://crm.geniusconsultancy.com

# PostgreSQL Connection Strings
DATABASE_URL="postgresql://genius_admin:StrongPasswordHere@postgres-host:5432/genius_crm_prod?schema=public&sslmode=prefer"
DIRECT_DATABASE_URL="postgresql://genius_admin:StrongPasswordHere@postgres-host:5432/genius_crm_prod?schema=public&sslmode=prefer"

# Security & Authentication
JWT_SECRET="GENIUS_CONSULTANCY_SECURE_JWT_PRODUCTION_SECRET_KEY_MIN_64_CHARS_2026_XYZ"
JWT_EXPIRES_IN="7d"

# Operational Defaults
NEXT_PUBLIC_DEFAULT_TIMEZONE="Asia/Kolkata"
```

---

## 3. Deployment Steps (Ubuntu VPS / Linux Server)

### Step 1: Clone Repository & Install Dependencies
```bash
git clone https://github.com/genius-consultancy/crm.git /var/www/genius-crm
cd /var/www/genius-crm
npm install --frozen-lockfile
```

### Step 2: Configure Environment
```bash
cp .env.example .env
nano .env  # Enter production PostgreSQL credentials and JWT secret
```

### Step 3: Run Database Migrations & Seeding
```bash
# Push schema or apply migrations
npx prisma migrate deploy

# Seed initial admin and standard roles
npm run prisma:seed
```

### Step 4: Build Production Next.js Bundle
```bash
npm run build
```

### Step 5: Process Management via PM2
```bash
npm install -g pm2
pm2 start npm --name "genius-crm" -- start
pm2 save
pm2 startup
```

---

## 4. Nginx Reverse Proxy & SSL Configuration

```nginx
server {
    listen 80;
    server_name crm.geniusconsultancy.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name crm.geniusconsultancy.com;

    ssl_certificate /etc/letsencrypt/live/crm.geniusconsultancy.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/crm.geniusconsultancy.com/privkey.pem;

    client_max_body_size 50M; # Accommodates large multi-sheet Excel files

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 5. Health Check & Diagnostics

- **Health Endpoint**: `GET /api/auth/me` returns `200 OK` when authenticated or `401 Unauthorized` when unauthenticated.
- **Log Inspection**: `pm2 logs genius-crm`
- **Database Connectivity**: `npx prisma db pull` or test query.
