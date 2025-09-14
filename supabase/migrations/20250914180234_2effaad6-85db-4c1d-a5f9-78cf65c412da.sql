-- Enable pgcrypto extension for encryption functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create encryption/decryption functions for sensitive data
CREATE OR REPLACE FUNCTION encrypt_sensitive_data(data text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT CASE
    WHEN data IS NULL OR data = '' THEN data
    ELSE encode(encrypt_iv(data::bytea, decode(substring(md5(current_setting('app.settings.encryption_key', true)) from 1 for 32), 'hex'), decode(substring(md5(current_setting('app.settings.encryption_key', true) || 'iv') from 1 for 32), 'hex'), 'aes'), 'base64')
  END;
$$;

CREATE OR REPLACE FUNCTION decrypt_sensitive_data(encrypted_data text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT CASE
    WHEN encrypted_data IS NULL OR encrypted_data = '' THEN encrypted_data
    ELSE convert_from(decrypt_iv(decode(encrypted_data, 'base64'), decode(substring(md5(current_setting('app.settings.encryption_key', true)) from 1 for 32), 'hex'), decode(substring(md5(current_setting('app.settings.encryption_key', true) || 'iv') from 1 for 32), 'hex'), 'aes'), 'UTF8')
  END;
$$;

-- Create a view for spotify_connections that automatically decrypts sensitive data
CREATE OR REPLACE VIEW spotify_connections_decrypted AS
SELECT 
  id,
  user_id,
  spotify_user_id,
  decrypt_sensitive_data(access_token) as access_token,
  decrypt_sensitive_data(refresh_token) as refresh_token,
  expires_at,
  scope,
  token_type,
  display_name,
  decrypt_sensitive_data(email) as email,
  created_at,
  updated_at
FROM spotify_connections;

-- Grant appropriate permissions
GRANT SELECT ON spotify_connections_decrypted TO authenticated;

-- Enable RLS on the decrypted view
ALTER VIEW spotify_connections_decrypted SET (security_barrier = true);

-- Create RLS policies for the decrypted view (same as original table)
CREATE POLICY "Users can view their own decrypted Spotify connections" 
ON spotify_connections_decrypted 
FOR SELECT 
USING (auth.uid() = user_id);

-- Add a function to safely upsert encrypted spotify connections
CREATE OR REPLACE FUNCTION upsert_encrypted_spotify_connection(
  p_user_id uuid,
  p_spotify_user_id text,
  p_access_token text,
  p_refresh_token text,
  p_expires_at timestamp with time zone,
  p_scope text,
  p_token_type text,
  p_display_name text,
  p_email text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  connection_id uuid;
BEGIN
  INSERT INTO spotify_connections (
    user_id,
    spotify_user_id,
    access_token,
    refresh_token,
    expires_at,
    scope,
    token_type,
    display_name,
    email,
    updated_at
  )
  VALUES (
    p_user_id,
    p_spotify_user_id,
    encrypt_sensitive_data(p_access_token),
    encrypt_sensitive_data(p_refresh_token),
    p_expires_at,
    p_scope,
    p_token_type,
    p_display_name,
    encrypt_sensitive_data(p_email),
    now()
  )
  ON CONFLICT (user_id) 
  DO UPDATE SET
    spotify_user_id = EXCLUDED.spotify_user_id,
    access_token = encrypt_sensitive_data(p_access_token),
    refresh_token = encrypt_sensitive_data(p_refresh_token),
    expires_at = EXCLUDED.expires_at,
    scope = EXCLUDED.scope,
    token_type = EXCLUDED.token_type,
    display_name = EXCLUDED.display_name,
    email = encrypt_sensitive_data(p_email),
    updated_at = now()
  RETURNING id INTO connection_id;
  
  RETURN connection_id;
END;
$$;

-- Add a function to safely update encrypted tokens
CREATE OR REPLACE FUNCTION update_encrypted_spotify_tokens(
  p_user_id uuid,
  p_access_token text,
  p_refresh_token text,
  p_expires_at timestamp with time zone
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE spotify_connections 
  SET 
    access_token = encrypt_sensitive_data(p_access_token),
    refresh_token = encrypt_sensitive_data(p_refresh_token),
    expires_at = p_expires_at,
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION upsert_encrypted_spotify_connection TO authenticated;
GRANT EXECUTE ON FUNCTION update_encrypted_spotify_tokens TO authenticated;