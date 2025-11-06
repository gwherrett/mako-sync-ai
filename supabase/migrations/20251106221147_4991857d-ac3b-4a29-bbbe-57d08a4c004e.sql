-- Drop the flawed RPC functions that cannot access vault encryption functions
DROP FUNCTION IF EXISTS public.store_spotify_token_in_vault(uuid, text, text);
DROP FUNCTION IF EXISTS public.get_spotify_token_from_vault(uuid);
DROP FUNCTION IF EXISTS public.update_spotify_token_in_vault(uuid, text);

-- Note: The spotify_connections table already has the vault reference columns
-- (access_token_secret_id, refresh_token_secret_id) from the previous migration
-- Edge functions will now access vault.secrets directly using service role client