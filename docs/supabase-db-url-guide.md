# How to Find Your SUPABASE_DB_URL

**Purpose**: Step-by-step guide to locate the database connection string for Supabase edge functions  
**Required For**: Spotify integration vault operations in [`spotify-auth/index.ts`](../supabase/functions/spotify-auth/index.ts:238)

---

## 🔍 STEP-BY-STEP INSTRUCTIONS

### **Method 1: Supabase Dashboard (Updated Interface)**

1. **Navigate to Supabase Dashboard**
   - Go to: [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Select your project: `your-project-id`

2. **Access Project Settings**
   - Click on **"Settings"** (gear icon) in the left sidebar
   - Click on **"Configuration"** in the settings menu

3. **Find Database Connection**
   - Look for **"Database"** section
   - You should see connection details including:
     - Host: `db.your-project-id.supabase.co`
     - Port: `5432`
     - Database: `postgres`
     - User: `postgres`

4. **Alternative: Check Project API Settings**
   - If not in Configuration, try **Settings → API**
   - Look for **"Database"** or **"Connection"** information
   - The connection string format will be:
     ```
     postgresql://postgres:[YOUR-PASSWORD]@db.your-project-id.supabase.co:5432/postgres
     ```

5. **Get Your Database Password**
   - The password is the one you set when creating your Supabase project
   - If you don't remember it, go to **Settings → Database** and look for password reset options

### **Method 2: Manual Construction (Recommended if UI unclear)**

If you can't find the connection string in the dashboard, you can construct it manually:

**Format**:
```
postgresql://postgres:YOUR_DATABASE_PASSWORD@db.your-project-id.supabase.co:5432/postgres
```

**Your specific URL** (replace `YOUR_DATABASE_PASSWORD`):
```
postgresql://postgres:YOUR_DATABASE_PASSWORD@db.your-project-id.supabase.co:5432/postgres
```

**To get your database password**:
1. Go to Supabase Dashboard → Settings → Database
2. Look for "Database password" or "Reset database password"
3. If you don't remember it, reset it and use the new password

### **Method 3: Using Supabase CLI (Alternative)**

If you have Supabase CLI installed and authenticated:

```bash
# Get project info
supabase projects list

# Get database URL (requires authentication)
supabase db show-connection-string --project-ref your-project-id
```

### **Method 4: Check Environment Variables**

Sometimes the database URL is already available in your local environment:

```bash
# Check if it's already set locally
echo $SUPABASE_DB_URL

# Or check in your .env file (though it shouldn't be there for security)
grep SUPABASE_DB_URL .env
```

---

## 🔧 COMPLETE SUPABASE_DB_URL FORMAT

Your final `SUPABASE_DB_URL` should look exactly like this:

```
postgresql://postgres:YOUR_ACTUAL_PASSWORD@db.your-project-id.supabase.co:5432/postgres
```

### **Example** (with placeholder password):
```
postgresql://postgres:mySecurePassword123@db.your-project-id.supabase.co:5432/postgres
```

---

## ⚠️ IMPORTANT SECURITY NOTES

### **Password Security**
- **Never commit** the database URL with password to version control
- **Only use** in Supabase edge function environment variables
- **Keep secure** - this provides full database access

### **Where to Use**
- ✅ **Supabase Dashboard → Settings → Edge Functions → Environment Variables**
- ❌ **NOT in frontend code** (`.env` file)
- ❌ **NOT in version control** (Git repositories)

---

## 🚀 CONFIGURATION STEPS

### **Step 1: Get Your Database URL**
1. Follow Method 1 above to get the connection string
2. Replace `[YOUR-PASSWORD]` with your actual database password
3. Copy the complete URL

### **Step 2: Configure in Supabase**
1. Go to: **Supabase Dashboard → Settings → Edge Functions → Environment Variables**
2. Add new environment variable:
   - **Name**: `SUPABASE_DB_URL`
   - **Value**: `postgresql://postgres:YOUR_PASSWORD@db.your-project-id.supabase.co:5432/postgres`

### **Step 3: Verify Configuration**
Your edge function environment should now have all three required variables:
```
SPOTIFY_CLIENT_ID=your_production_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_production_spotify_client_secret
SUPABASE_DB_URL=postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_ID.supabase.co:5432/postgres
```

---

## 🔍 TROUBLESHOOTING

### **"Can't find connection string"**
- Make sure you're in the correct project (`your-project-id`)
- Check you're looking at **"Direct connection"** not "Connection pooling"
- Refresh the page if the settings don't load

### **"Don't remember database password"**
1. Go to: **Supabase Dashboard → Settings → Database**
2. Scroll to **"Database password"** section
3. Click **"Reset database password"**
4. Set a new password and update your connection string

### **"Connection string doesn't work"**
- Verify the password is correct (no typos)
- Ensure you're using the **Direct connection** string
- Check that the project ID matches: `your-project-id`

---

## ✅ VERIFICATION

### **Test the Connection String**
You can test if your database URL is correct by running this in the Supabase SQL Editor:
```sql
SELECT 'Database connection successful' as status;
```

### **Edge Function Test**
After configuring the environment variable, the [`spotify-auth`](../supabase/functions/spotify-auth/index.ts) edge function should be able to:
- Connect to the database
- Create vault secrets
- Store encrypted tokens

---

## 📋 FINAL CHECKLIST

- [ ] Found database connection string in Supabase Dashboard
- [ ] Replaced `[YOUR-PASSWORD]` with actual password
- [ ] Added `SUPABASE_DB_URL` to edge function environment variables
- [ ] Verified all three environment variables are set:
  - `SPOTIFY_CLIENT_ID`
  - `SPOTIFY_CLIENT_SECRET`  
  - `SUPABASE_DB_URL`
- [ ] Ready to test Spotify OAuth flow

---

**Next Step**: Once you have the `SUPABASE_DB_URL` configured, your Spotify integration will be **100% ready for production deployment**!

The database URL is the final piece needed for the edge functions to securely store Spotify tokens in the Supabase Vault.