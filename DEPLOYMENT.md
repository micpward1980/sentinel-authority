# Sentinel Authority - Deployment Guide

## Quick Deployment Options

### Option 1: Railway (Recommended - Fastest)

**Time: ~5 minutes | Cost: Free tier available**

1. Go to [railway.app](https://railway.app) and sign in with GitHub

2. Click "New Project" → "Deploy from GitHub repo"

3. Push this code to a GitHub repo first:
   ```bash
   cd sentinel-authority
   git init
   git add .
   git commit -m "Initial commit"
   gh repo create sentinel-authority --private --push
   ```

4. Select your repo in Railway

5. Railway auto-detects the services. Add these:
   - Click "New" → "Database" → "PostgreSQL"
   - Click "New" → "Database" → "Redis"

6. Set environment variables for the API service:
   ```
   DATABASE_URL = ${{Postgres.DATABASE_URL}}
   REDIS_URL = ${{Redis.REDIS_URL}}
   SECRET_KEY = (click generate)
   ENVIRONMENT = production
   ```

7. Deploy! Railway gives you URLs like:
   - `sentinel-api-production.up.railway.app`
   - `sentinel-frontend-production.up.railway.app`

---

### Option 2: Render

**Time: ~10 minutes | Cost: Free tier available**

1. Push code to GitHub (see above)

2. Go to [render.com](https://render.com) → "New" → "Blueprint"

3. Connect your GitHub repo - Render reads `render.yaml` automatically

4. Click "Apply" - it creates all services

5. After deploy, run the database schema:
   - Go to your PostgreSQL service
   - Click "Shell"
   - Run: `psql -f /path/to/schema.sql`

---

### Option 3: Vercel (Frontend) + Fly.io (Backend) + Supabase (Database)

**Best for: Production with custom domains**

#### Frontend on Vercel:

```bash
cd frontend
npm i -g vercel
vercel login
vercel --prod
```

Set environment variable:
```
VITE_API_URL = https://sentinel-api.fly.dev
```

#### Backend on Fly.io:

```bash
cd backend

# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login and deploy
fly auth login
fly launch  # Accept defaults, say YES to Postgres
fly secrets set SECRET_KEY=$(openssl rand -hex 32)
fly secrets set CORS_ORIGINS=https://your-vercel-url.vercel.app
fly deploy
```

#### Database on Supabase (Alternative):

1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Go to SQL Editor → paste `schema.sql`
4. Copy connection string to Fly secrets:
   ```bash
   fly secrets set DATABASE_URL="postgresql://..."
   ```

---

### Option 4: DigitalOcean App Platform

**Time: ~15 minutes | Cost: $5/mo minimum**

1. Go to [cloud.digitalocean.com](https://cloud.digitalocean.com)

2. Create → App Platform → GitHub

3. Add components:
   - **Web Service**: `/backend` folder, Python, Dockerfile
   - **Static Site**: `/frontend` folder, Build: `npm run build`, Output: `dist`
   - **Database**: PostgreSQL (Dev Database = free)

4. Set env vars and deploy

---

### Option 5: AWS (Production Grade)

**For: Enterprise deployment with full control**

```bash
# Using AWS Copilot (simplest AWS path)
brew install aws/tap/copilot-cli

cd sentinel-authority
copilot init --app sentinel --name api --type "Load Balanced Web Service"
copilot env init --name production
copilot deploy --env production
```

Or use the full AWS stack:
- **ECS Fargate** for containers
- **RDS PostgreSQL** for database
- **ElastiCache Redis** for caching
- **CloudFront + S3** for frontend
- **Route 53** for DNS

---

## Custom Domain Setup

After deploying, connect your domain:

### For sentinelauthority.org:

1. **API subdomain** (api.sentinelauthority.org):
   - Add CNAME record pointing to your backend URL
   - Example: `api` → `sentinel-api-production.up.railway.app`

2. **App subdomain** (app.sentinelauthority.org):
   - Add CNAME record pointing to your frontend URL
   - Example: `app` → `sentinel-frontend-production.up.railway.app`

3. **Update CORS** in backend:
   ```
   CORS_ORIGINS=https://app.sentinelauthority.org,https://sentinelauthority.org
   ```

4. **Update API URL** in frontend:
   ```
   VITE_API_URL=https://api.sentinelauthority.org
   ```

---

## Post-Deployment Checklist

- [ ] Database schema applied
- [ ] Environment variables set
- [ ] CORS origins configured
- [ ] SSL/HTTPS working
- [ ] Health check passing (`/health` returns 200)
- [ ] Can create test account via API
- [ ] Frontend loads and can login
- [ ] Custom domain configured (optional)

---

## Estimated Costs (Monthly)

| Platform | Free Tier | Production |
|----------|-----------|------------|
| Railway | $5 credit/mo | ~$20-50/mo |
| Render | Limited free | ~$25-50/mo |
| Fly.io | 3 VMs free | ~$15-30/mo |
| Vercel | Generous free | ~$20/mo |
| DigitalOcean | None | ~$20-40/mo |
| AWS | 12mo free tier | ~$50-100/mo |

---

## Quick Test After Deploy

```bash
# Check health
curl https://your-api-url.com/health

# Create test account (replace with your URL)
curl -X POST https://your-api-url.com/accounts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"name": "Test Company", "account_type": "applicant"}'

# Verify public endpoint works (no auth needed)
curl https://your-api-url.com/verify/ODDC-2026-00001
```

---

## Need Help?

The fastest path for you specifically:

1. **Railway** - Push to GitHub, connect, deploy in 5 minutes
2. Use the free PostgreSQL and Redis add-ons
3. Point `api.sentinelauthority.org` to the Railway URL
4. You're live

Want me to walk you through any specific platform?
