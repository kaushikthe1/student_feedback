# EduFeed Deployment Guide

This guide details how to deploy the EduFeed application to a production VPS using Docker.

## What is a Reverse Proxy?
A **reverse proxy** (like Nginx) sits in front of your web servers. When a user visits `edufeed.aiimskalyani.online`, their browser connects to Nginx on port 80 or 443 (HTTPS). Nginx checks the domain name, handles the SSL certificate, and securely forwards (proxies) the request to your Next.js application running on an internal port (e.g., 3000). 

Because you already have Nginx running in Docker, the EduFeed architecture is a perfect fit. We only need to deploy the App and Database containers, and your existing Nginx will act as the gateway.

---

## Scenario 1: Existing Nginx Setup (Recommended)
If your VPS already has Nginx running (e.g., Nginx Proxy Manager or a custom Nginx container handling domains), follow this guide.

### 1. Prerequisites
Ensure you have Docker and Docker Compose installed on your VPS.

### 2. Copy Files
Upload the entire repository to your VPS (e.g., via `git clone` or `rsync`).

### 3. Create Production `.env`
In the root directory on your VPS, create a `.env` file:
```env
# Database Credentials
POSTGRES_USER=edufeed
POSTGRES_PASSWORD=super_secure_password
POSTGRES_DB=feedback_db

# Prisma connection string pointing to the Postgres container
DATABASE_URL="postgresql://edufeed:super_secure_password@db:5432/feedback_db"

# Application Settings
NEXT_PUBLIC_APP_URL="https://edufeed.aiimskalyani.online"

# SMTP Settings
SMTP_HOST="smtp-relay.gmail.com"
SMTP_PORT=587
SMTP_USER="edufeed@aiimskalyani.edu.in"
SMTP_PASS="your-app-password"
SMTP_FROM="EduFeed <edufeed@aiimskalyani.edu.in>"
```

### 4. Start the Application
Run the following command in the root folder containing `docker-compose.yml`:
```bash
docker-compose up -d --build
```
This will start two containers: `edufeed-app` (port 3000) and `edufeed-db` (port 5432).

### 5. Run Database Migrations & Seed
Apply the schema and create the superadmin:
```bash
# Push schema
docker-compose exec app npx prisma migrate deploy

# Seed superadmin & departments
docker-compose exec app npx tsx scripts/seed_superadmin.ts
docker-compose exec app npx tsx scripts/seed_departments.ts
```

### 6. Configure your existing Nginx
Add a new proxy host to your Nginx configuration.
- **Domain:** `edufeed.aiimskalyani.online`
- **Forward IP:** The IP address of the `edufeed-app` container (if they are on the same Docker network, you can use `edufeed-app`). If you mapped port 3000 to the host, use `127.0.0.1`.
- **Forward Port:** `3000`

---

## Scenario 2: Fresh Install (No Existing Nginx)
If you are deploying to a completely blank VPS and need Nginx set up for you.

### 1. Update `docker-compose.yml`
Open `docker-compose.yml` and uncomment the `nginx` service block.

### 2. Nginx Configuration
Create `nginx/default.conf`:
```nginx
server {
    listen 80;
    server_name edufeed.aiimskalyani.online;

    location / {
        proxy_pass http://app:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. Deploy
Follow Steps 3, 4, and 5 from Scenario 1. The built-in Nginx container will automatically route traffic on port 80 to your app. For SSL, you would install `certbot` on the host machine.
