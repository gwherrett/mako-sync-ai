-- Migration: Encrypt Spotify tokens using Supabase Vault
-- This migration adds vault secret references and migrates existing plain text tokens

-- Step 1: Add new columns for vault secret IDs (keeping old columns temporarily for migration)
ALTER TABLE public.spotify_connections 
  ADD COLUMN IF NOT EXISTS access_token_secret_id uuid REFERENCES vault.secrets(id),
  ADD COLUMN IF NOT EXISTS refresh_token_secret_id uuid REFERENCES vault.secrets(id);

-- Step 2: Create a security definer function to store tokens in vault
CREATE OR REPLACE FUNCTION public.store_spotify_token_in_vault(
  p_user_id uuid,
  p_token_name text,
  p_token_value text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret_id uuid;
BEGIN
  -- Insert the token into vault.secrets
  INSERT INTO vault.secrets (secret, description)
  VALUES (
    p_token_value,
    format('Spotify %s for user %s', p_token_name, p_user_id)
  )
  RETURNING id INTO v_secret_id;
  
  RETURN v_secret_id;
END;
$$;

-- Step 3: Create a security definer function to retrieve tokens from vault
CREATE OR REPLACE FUNCTION public.get_spotify_token_from_vault(
  p_secret_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
BEGIN
  -- Retrieve the decrypted token from vault
  SELECT decrypted_secret INTO v_token
  FROM vault.decrypted_secrets
  WHERE id = p_secret_id;
  
  RETURN v_token;
END;
$$;

-- Step 4: Create a security definer function to update tokens in vault
CREATE OR REPLACE FUNCTION public.update_spotify_token_in_vault(
  p_secret_id uuid,
  p_new_token_value text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update the token in vault.secrets
  UPDATE vault.secrets
  SET secret = p_new_token_value,
      updated_at = now()
  WHERE id = p_secret_id;
END;
$$;

-- Step 5: Migrate existing tokens to vault (one-time operation)
-- This function will be called by the edge function to migrate existing connections
CREATE OR REPLACE FUNCTION public.migrate_connection_to_vault(
  p_connection_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_connection record;
  v_access_token_secret_id uuid;
  v_refresh_token_secret_id uuid;
BEGIN
  -- Get the connection with plain text tokens
  SELECT * INTO v_connection
  FROM public.spotify_connections
  WHERE id = p_connection_id
    AND access_token_secret_id IS NULL; -- Only migrate if not already migrated
  
  IF NOT FOUND THEN
    RETURN; -- Already migrated or doesn't exist
  END IF;
  
  -- Store access token in vault
  IF v_connection.access_token IS NOT NULL THEN
    v_access_token_secret_id := public.store_spotify_token_in_vault(
      v_connection.user_id,
      'access_token',
      v_connection.access_token
    );
  END IF;
  
  -- Store refresh token in vault
  IF v_connection.refresh_token IS NOT NULL THEN
    v_refresh_token_secret_id := public.store_spotify_token_in_vault(
      v_connection.user_id,
      'refresh_token',
      v_connection.refresh_token
    );
  END IF;
  
  -- Update the connection with vault references and clear plain text tokens
  UPDATE public.spotify_connections
  SET 
    access_token_secret_id = v_access_token_secret_id,
    refresh_token_secret_id = v_refresh_token_secret_id,
    access_token = '***MIGRATED_TO_VAULT***', -- Mark as migrated
    refresh_token = '***MIGRATED_TO_VAULT***',
    updated_at = now()
  WHERE id = p_connection_id;
END;
$$;

-- Step 6: Fix artist_genres public exposure - restrict to authenticated users only
DROP POLICY IF EXISTS "Users can view artist genres" ON public.artist_genres;
DROP POLICY IF EXISTS "Users can insert artist genres" ON public.artist_genres;
DROP POLICY IF EXISTS "Users can update artist genres" ON public.artist_genres;

CREATE POLICY "Authenticated users can view artist genres"
  ON public.artist_genres
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert artist genres"
  ON public.artist_genres
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update artist genres"
  ON public.artist_genres
  FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Step 7: Create an index for faster vault lookups
CREATE INDEX IF NOT EXISTS idx_spotify_connections_vault_secrets 
  ON public.spotify_connections(access_token_secret_id, refresh_token_secret_id);

-- Add helpful comments
COMMENT ON COLUMN public.spotify_connections.access_token_secret_id IS 'Reference to encrypted access token in vault.secrets';
COMMENT ON COLUMN public.spotify_connections.refresh_token_secret_id IS 'Reference to encrypted refresh token in vault.secrets';
COMMENT ON FUNCTION public.store_spotify_token_in_vault IS 'Stores a Spotify token securely in vault and returns the secret ID';
COMMENT ON FUNCTION public.get_spotify_token_from_vault IS 'Retrieves a decrypted Spotify token from vault by secret ID';
COMMENT ON FUNCTION public.update_spotify_token_in_vault IS 'Updates an existing token in vault';
COMMENT ON FUNCTION public.migrate_connection_to_vault IS 'One-time migration function to move plain text tokens to vault';