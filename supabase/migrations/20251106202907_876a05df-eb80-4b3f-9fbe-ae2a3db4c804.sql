-- Drop and recreate the vault functions with proper permissions
-- This fixes the "permission denied for function _crypto_aead_det_noncegen" error

DROP FUNCTION IF EXISTS public.store_spotify_token_in_vault(uuid, text, text);
DROP FUNCTION IF EXISTS public.get_spotify_token_from_vault(uuid);
DROP FUNCTION IF EXISTS public.update_spotify_token_in_vault(uuid, text);

-- Recreate store function with proper vault access
CREATE OR REPLACE FUNCTION public.store_spotify_token_in_vault(
  p_user_id uuid,
  p_token_name text,
  p_token_value text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
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

-- Recreate get function with proper vault access
CREATE OR REPLACE FUNCTION public.get_spotify_token_from_vault(p_secret_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
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

-- Recreate update function with proper vault access
CREATE OR REPLACE FUNCTION public.update_spotify_token_in_vault(
  p_secret_id uuid,
  p_new_token_value text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
BEGIN
  -- Update the token in vault.secrets
  UPDATE vault.secrets
  SET secret = p_new_token_value,
      updated_at = now()
  WHERE id = p_secret_id;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.store_spotify_token_in_vault(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_spotify_token_from_vault(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_spotify_token_in_vault(uuid, text) TO authenticated;