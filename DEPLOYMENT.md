# DeckBuilder Deployment Guide

This guide walks you through deploying the DeckBuilder application to Fly.io.

## Prerequisites

1. **Install flyctl CLI**:
   ```bash
   # Windows (PowerShell)
   powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"

   # macOS/Linux
   curl -L https://fly.io/install.sh | sh
   ```

2. **Create Fly.io account and login**:
   ```bash
   flyctl auth signup  # Create new account
   # OR
   flyctl auth login   # Login to existing account
   ```

## Step 1: Configure Database Services

### Option A: Use Fly.io Redis (Recommended)
```bash
# Create a Redis instance
flyctl redis create --name deckbuilder-redis --region sea
```

### Option B: Use MongoDB Atlas (Recommended for MongoDB)
1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Create a free cluster
3. Get the connection string
4. Add your Fly.io app IPs to the allowlist

### Option C: Self-hosted MongoDB on Fly.io
```bash
# Create a MongoDB volume and app (more complex setup)
flyctl apps create deckbuilder-mongo
flyctl volumes create mongo_data --size 10 --app deckbuilder-mongo
```

## Step 2: Set Environment Variables

Set all required secrets (replace with your actual values):

```bash
# Authentication secrets
flyctl secrets set JWT_SECRET="your-super-secret-jwt-key-minimum-32-characters"
flyctl secrets set SESSION_SECRET="your-session-secret-minimum-32-characters"

# Database connections
flyctl secrets set MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/deckbuilder"
flyctl secrets set REDIS_URL="redis://default:password@deckbuilder-redis.internal:6379"

# OAuth credentials (optional)
flyctl secrets set GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
flyctl secrets set GOOGLE_CLIENT_SECRET="your-google-client-secret"

# App URL (set after initial deploy)
flyctl secrets set CLIENT_URL="https://deckbuilder.fly.dev"

# Optional: Logging
flyctl secrets set SEQ_URL="http://localhost:5341"
flyctl secrets set SEQ_API_KEY="your-seq-api-key"
```

## Step 3: Update OAuth Redirect URIs

### Google OAuth Console
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to "APIs & Services" > "Credentials"
3. Edit your OAuth 2.0 Client
4. Add authorized redirect URI: `https://deckbuilder.fly.dev/auth/google/callback`

### Facebook App Settings
1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Select your app
3. Go to "Facebook Login" > "Settings"
4. Add valid OAuth redirect URI: `https://deckbuilder.fly.dev/auth/facebook/callback`

## Step 4: Deploy the Application

```bash
# Initialize the Fly.io app (from project root)
flyctl launch --no-deploy

# Deploy the application
flyctl deploy
```

## Step 5: Scale and Monitor

```bash
# Check deployment status
flyctl status

# View logs
flyctl logs

# Check app health
flyctl checks list

# Scale if needed (start with 1 instance)
flyctl scale count 1

# Monitor resource usage
flyctl dashboard
```

## Step 6: Custom Domain (Optional)

```bash
# Add custom domain
flyctl certs create yourdomain.com

# Update DNS records as instructed by Fly.io
# Update CLIENT_URL secret
flyctl secrets set CLIENT_URL="https://yourdomain.com"
```

## Troubleshooting

### Check Application Health
```bash
flyctl status
flyctl logs --app deckbuilder
```

### Database Connection Issues
```bash
# Test MongoDB connection
flyctl ssh console
node -e "console.log(process.env.MONGODB_URI)"

# Test Redis connection
flyctl redis connect deckbuilder-redis
```

### Worker Process Issues
```bash
# Check if both server and worker are running
flyctl ssh console
ps aux | grep node
```

### OAuth Issues
- Ensure redirect URIs are exactly: `https://your-domain/auth/google/callback`
- Check that CLIENT_URL environment variable matches your domain
- Verify OAuth credentials are correctly set

## Production Optimizations

### 1. Increase Resources (if needed)
```bash
flyctl scale memory 1024    # Increase memory to 1GB
flyctl scale cpu 2          # Increase to 2 CPUs
```

### 2. Set up Multiple Regions
```bash
flyctl regions add lax ord  # Add more regions for better performance
```

### 3. Configure Auto-scaling
```bash
flyctl autoscale standard min=1 max=3
```

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Set to "production" | ✅ |
| `PORT` | Server port (3000) | ✅ |
| `JWT_SECRET` | JWT signing secret | ✅ |
| `SESSION_SECRET` | Express session secret | ✅ |
| `MONGODB_URI` | MongoDB connection string | ✅ |
| `REDIS_URL` | Redis connection string | ✅ |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | ❌ |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | ❌ |
| `FACEBOOK_APP_ID` | Facebook app ID | ❌ |
| `FACEBOOK_APP_SECRET` | Facebook app secret | ❌ |
| `CLIENT_URL` | Frontend URL for OAuth redirects | ✅ |
| `SEQ_URL` | Seq logging server URL | ❌ |
| `SEQ_API_KEY` | Seq API key | ❌ |

## Cost Estimation

- **Fly.io App**: $0-5/month (512MB RAM, shared CPU)
- **Fly.io Redis**: $0-2/month (small instance)
- **MongoDB Atlas**: $0/month (free tier)
- **Total**: ~$0-7/month for hobby use

## Support

- [Fly.io Documentation](https://fly.io/docs/)
- [Fly.io Community](https://community.fly.io/)
- Run `flyctl doctor` for common issues