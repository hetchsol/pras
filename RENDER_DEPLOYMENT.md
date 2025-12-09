# Deploying to Render.com

This guide will help you deploy the Purchase Requisition System to Render.com.

## Prerequisites

1. GitHub account with the code pushed to https://github.com/hetch-zm/pras
2. Render.com account (sign up at https://render.com)

## Deployment Steps

### 1. Sign up for Render.com
- Go to https://render.com
- Click "Get Started"
- Sign up with GitHub (recommended) or email

### 2. Connect Your GitHub Repository
- After signing in, click "New +"
- Select "Web Service"
- Click "Connect account" to connect your GitHub
- Find and select your repository: `hetch-zm/pras`

### 3. Configure the Web Service

**Basic Settings:**
- **Name:** purchase-requisition-system (or your preferred name)
- **Region:** Choose closest to your users (e.g., Oregon, Frankfurt)
- **Branch:** master
- **Root Directory:** Leave blank
- **Runtime:** Node
- **Build Command:** `cd backend && npm install`
- **Start Command:** `cd backend && npm start`

**Instance Type:**
- Select "Free" for testing

### 4. Set Environment Variables

Click "Advanced" and add these environment variables:

**Required:**
- `NODE_ENV` = `production`
- `PORT` = `10000` (Render uses this by default)
- `JWT_SECRET` = Generate a strong random string (at least 32 characters)
- `DATABASE_PATH` = `./purchase_requisition.db`

**Optional (with defaults):**
- `JWT_EXPIRES_IN` = `15m`
- `REFRESH_TOKEN_DAYS` = `7`
- `BCRYPT_ROUNDS` = `10`
- `RATE_LIMIT_WINDOW_MS` = `900000`
- `RATE_LIMIT_MAX_REQUESTS` = `100`
- `ALLOWED_ORIGINS` = `https://your-app-name.onrender.com` (update after deployment)

### 5. Deploy

- Click "Create Web Service"
- Wait for the build and deployment to complete (5-10 minutes)
- Once deployed, you'll get a URL like: `https://purchase-requisition-system.onrender.com`

### 6. Important: Update ALLOWED_ORIGINS

After deployment:
1. Copy your Render URL
2. Go to Environment tab in Render dashboard
3. Update `ALLOWED_ORIGINS` to include your Render URL
4. Click "Save Changes" (this will trigger a redeploy)

### 7. Initialize Database

**Important:** On first deployment, your database will be empty. You need to:
1. Access your app URL
2. The application should create the database automatically on first run
3. Default admin credentials: `admin` / `admin123`

## Important Notes

⚠️ **Database Persistence:**
- Render's free tier has **ephemeral storage**
- Your SQLite database will be **deleted on each redeploy**
- For production use, consider upgrading to:
  - Render's paid tier with persistent disks ($7/month)
  - PostgreSQL database add-on (free tier available)

⚠️ **Cold Starts:**
- Free tier apps sleep after 15 minutes of inactivity
- First request after sleep takes 30-60 seconds to wake up
- Consider upgrading to paid tier for always-on service

## Troubleshooting

### Build Fails
- Check that `backend/package.json` exists
- Verify all dependencies are listed in package.json

### App Won't Start
- Check the logs in Render dashboard
- Verify environment variables are set correctly
- Ensure PORT is set to 10000

### Database Issues
- Remember: Database resets on each deployment
- Consider using PostgreSQL for production

### CORS Errors
- Update ALLOWED_ORIGINS to include your Render URL
- Format: `https://your-app-name.onrender.com`

## Upgrading to Persistent Storage

To keep your database between deployments:

1. In Render dashboard, go to your service
2. Click "Disks" in the left menu
3. Add a new disk:
   - **Name:** data
   - **Mount Path:** `/data`
   - **Size:** 1GB (free on paid plans)
4. Update `DATABASE_PATH` env var to `/data/purchase_requisition.db`

## Support

For issues with deployment, check:
- Render documentation: https://render.com/docs
- Render community: https://community.render.com
