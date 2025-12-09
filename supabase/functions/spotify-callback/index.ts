// DISABLED: This edge function was conflicting with the React route /spotify-callback
// The React component SpotifyCallback.tsx handles the OAuth flow instead
//
// If you need this functionality, rename this function to avoid route conflicts
// For example: spotify-callback-handler or spotify-oauth-handler

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  return new Response(
    JSON.stringify({
      error: 'This endpoint is disabled to prevent conflicts with React routing',
      message: 'Spotify callback is handled by the React app at /spotify-callback'
    }),
    {
      status: 410, // Gone
      headers: { 'Content-Type': 'application/json' }
    }
  )
})
