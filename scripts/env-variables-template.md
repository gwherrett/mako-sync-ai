# Environment Variables Configuration for Phase 4

## Supabase Dashboard Configuration

Navigate to: **Supabase Dashboard → Settings → Edge Functions → Environment Variables**

### Required Environment Variables

```bash
# Spotify API Credentials
SPOTIFY_CLIENT_ID=your_spotify_app_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_app_client_secret_here

# Database Connection (for edge functions)
SUPABASE_DB_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
```

## How to Get These Values

### 1. Spotify Credentials

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Log in with your Spotify account
3. Click "Create App"
4. Fill in app details:
   - **App Name**: Mako Sync (or your preferred name)
   - **App Description**: Music library synchronization tool
   - **Redirect URI**: `https://your-domain.com/spotify-callback`
   - **APIs Used**: Web API
5. After creating the app:
   - Copy **Client ID** → Use as `SPOTIFY_CLIENT_ID`
   - Click "Show Client Secret" → Copy **Client Secret** → Use as `SPOTIFY_CLIENT_SECRET`

### 2. Database Connection String

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `bzzstdpfmyqttnzhgaoa`
3. Navigate to **Settings → Database**
4. Scroll down to **Connection string**
5. Select **Direct connection**
6. Copy the connection string (it will look like):
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.bzzstdpfmyqttnzhgaoa.supabase.co:5432/postgres
   ```
7. Replace `[YOUR-PASSWORD]` with your actual database password
8. Use this as `SUPABASE_DB_URL`

## Setting Environment Variables in Supabase

### Method 1: Supabase Dashboard (Recommended)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/bzzstdpfmyqttnzhgaoa)
2. Navigate to **Settings → Edge Functions**
3. Scroll down to **Environment Variables**
4. Click **Add Variable** for each:

   **Variable 1:**
   - Name: `SPOTIFY_CLIENT_ID`
   - Value: `your_actual_client_id`

   **Variable 2:**
   - Name: `SPOTIFY_CLIENT_SECRET`
   - Value: `your_actual_client_secret`

   **Variable 3:**
   - Name: `SUPABASE_DB_URL`
   - Value: `your_actual_connection_string`

5. Click **Save** after adding each variable

### Method 2: Supabase CLI

```bash
# Set environment variables via CLI
supabase secrets set SPOTIFY_CLIENT_ID=your_actual_client_id
supabase secrets set SPOTIFY_CLIENT_SECRET=your_actual_client_secret
supabase secrets set SUPABASE_DB_URL=your_actual_connection_string
```

## Verification

After setting the environment variables:

1. **Redeploy edge functions** to pick up new variables:
   ```bash
   supabase functions deploy spotify-sync-liked
   ```

2. **Test environment variables** are accessible:
   ```bash
   # Test with a simple function call
   curl -X POST "https://bzzstdpfmyqttnzhgaoa.supabase.co/functions/v1/spotify-sync-liked" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"health_check": true}'
   ```

## Security Notes

⚠️ **Important Security Considerations:**

1. **Never commit secrets to version control**
2. **Use different credentials for development vs production**
3. **Rotate credentials regularly**
4. **Monitor access logs for suspicious activity**
5. **Use Supabase Vault for additional token storage**

## Troubleshooting

### Common Issues:

1. **"Environment variable not found" error:**
   - Verify variables are set in Supabase Dashboard
   - Redeploy edge functions after setting variables
   - Check variable names match exactly (case-sensitive)

2. **"Invalid client credentials" error:**
   - Verify Spotify Client ID and Secret are correct
   - Check if Spotify app is properly configured
   - Ensure redirect URIs match your domain

3. **"Database connection failed" error:**
   - Verify database password in connection string
   - Check if database is accessible
   - Ensure connection string format is correct

### Verification Commands:

```bash
# List current environment variables (won't show values for security)
supabase secrets list

# Test database connectivity
supabase db ping

# Check function deployment status
supabase functions list
```

## Example Configuration

Here's what your environment variables should look like (with example values):

```bash
SPOTIFY_CLIENT_ID=3bac088a26d64ddfb49d57fb5d451d71
SPOTIFY_CLIENT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
SUPABASE_DB_URL=postgresql://postgres:your_db_password@db.bzzstdpfmyqttnzhgaoa.supabase.co:5432/postgres
```

**Note:** Replace with your actual values. The Spotify Client ID shown above is already configured in your `.env` file for frontend use.