-- Fix vault permissions for token storage functions
-- Grant necessary permissions to use vault encryption

-- Recreate store function with proper grants
DROP FUNCTION IF EXISTS public.store_spotify_token_in_vault(uuid, text, text);

CREATE OR REPLACE FUNCTION public.store_spotify_token_in_vault(p_user_id uuid, p_token_name text, p_token_value text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_secret_id uuid;
BEGIN
  -- Insert the token into vault.secrets with explicit schema qualification
  INSERT INTO vault.secrets (secret, description)
  VALUES (
    p_token_value,
    format('Spotify %s for user %s', p_token_name, p_user_id)
  )
  RETURNING id INTO v_secret_id;
  
  RETURN v_secret_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.store_spotify_token_in_vault(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.store_spotify_token_in_vault(uuid, text, text) TO service_role;

-- Recreate get function with proper grants
DROP FUNCTION IF EXISTS public.get_spotify_token_from_vault(uuid);

CREATE OR REPLACE FUNCTION public.get_spotify_token_from_vault(p_secret_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_token text;
BEGIN
  -- Retrieve the decrypted token from vault with explicit schema
  SELECT decrypted_secret INTO v_token
  FROM vault.decrypted_secrets
  WHERE id = p_secret_id;
  
  RETURN v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_spotify_token_from_vault(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_spotify_token_from_vault(uuid) TO service_role;

-- Recreate update function with proper grants
DROP FUNCTION IF EXISTS public.update_spotify_token_in_vault(uuid, text);

CREATE OR REPLACE FUNCTION public.update_spotify_token_in_vault(p_secret_id uuid, p_new_token_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
BEGIN
  -- Update the token in vault.secrets with explicit schema
  UPDATE vault.secrets
  SET secret = p_new_token_value,
      updated_at = now()
  WHERE id = p_secret_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_spotify_token_in_vault(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_spotify_token_in_vault(uuid, text) TO service_role;

-- Recreate migration function with proper grants
DROP FUNCTION IF EXISTS public.migrate_connection_to_vault(uuid);

CREATE OR REPLACE FUNCTION public.migrate_connection_to_vault(p_connection_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
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
  IF v_connection.access_token IS NOT NULL 
     AND v_connection.access_token NOT LIKE '%VAULT%' 
     AND v_connection.access_token NOT LIKE '%ENCRYPTED%'
     AND v_connection.access_token NOT LIKE '%MIGRATED%' THEN
    v_access_token_secret_id := public.store_spotify_token_in_vault(
      v_connection.user_id,
      'access_token',
      v_connection.access_token
    );
  END IF;
  
  -- Store refresh token in vault
  IF v_connection.refresh_token IS NOT NULL 
     AND v_connection.refresh_token NOT LIKE '%VAULT%' 
     AND v_connection.refresh_token NOT LIKE '%ENCRYPTED%'
     AND v_connection.refresh_token NOT LIKE '%MIGRATED%' THEN
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

GRANT EXECUTE ON FUNCTION public.migrate_connection_to_vault(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.migrate_connection_to_vault(uuid) TO service_role;