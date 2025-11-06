-- Create wrapper functions for Supabase Vault operations
-- These allow edge functions to interact with the vault securely

-- Function to create a secret in the vault
CREATE OR REPLACE FUNCTION public.vault_create_secret(plaintext text, secret_name text, secret_description text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  secret_id uuid;
BEGIN
  SELECT vault.create_secret(plaintext, secret_name, secret_description) INTO secret_id;
  RETURN secret_id;
END;
$$;

-- Function to read a decrypted secret from the vault
CREATE OR REPLACE FUNCTION public.vault_read_secret(secret_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  secret_value text;
BEGIN
  SELECT decrypted_secret INTO secret_value
  FROM vault.decrypted_secrets
  WHERE id = secret_id;
  
  RETURN secret_value;
END;
$$;

-- Function to update a secret in the vault
CREATE OR REPLACE FUNCTION public.vault_update_secret(secret_id uuid, new_plaintext text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
BEGIN
  -- Update the secret by setting a new value
  UPDATE vault.secrets
  SET secret = new_plaintext,
      updated_at = now()
  WHERE id = secret_id;
END;
$$;