-- Drop the wrapper functions that cannot work due to permission issues
-- These will be replaced with direct Postgres driver access from edge functions

DROP FUNCTION IF EXISTS public.vault_create_secret(text, text, text);
DROP FUNCTION IF EXISTS public.vault_read_secret(uuid);
DROP FUNCTION IF EXISTS public.vault_update_secret(uuid, text);