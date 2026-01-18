-- Create user_preferences table for slskd configuration
-- This table stores per-user preferences including slskd API configuration

CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,

  -- slskd Configuration
  slskd_api_endpoint TEXT,
  slskd_api_key TEXT,
  slskd_last_connection_test TIMESTAMPTZ,
  slskd_connection_status BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  UNIQUE(user_id)
);

-- Row Level Security
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own preferences
CREATE POLICY "Users can view own preferences"
  ON public.user_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON public.user_preferences
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON public.user_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own preferences"
  ON public.user_preferences
  FOR DELETE
  USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX idx_user_preferences_user_id ON public.user_preferences(user_id);

-- Comments for documentation
COMMENT ON TABLE public.user_preferences IS 'User-specific preferences including slskd configuration';
COMMENT ON COLUMN public.user_preferences.slskd_api_endpoint IS 'slskd REST API endpoint (e.g., http://localhost:5030)';
COMMENT ON COLUMN public.user_preferences.slskd_api_key IS 'slskd API key for authentication';
COMMENT ON COLUMN public.user_preferences.slskd_connection_status IS 'Last known connection status';
COMMENT ON COLUMN public.user_preferences.slskd_last_connection_test IS 'Timestamp of last connection test';
