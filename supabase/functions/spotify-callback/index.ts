
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  if (error) {
    return new Response(`
      <html>
        <body>
          <h1>Spotify Connection Failed</h1>
          <p>Error: ${error}</p>
          <script>
            window.close();
          </script>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' },
    })
  }

  if (code) {
    return new Response(`
      <html>
        <body>
          <h1>Connecting to Spotify...</h1>
          <script>
            window.opener.postMessage({ 
              type: 'spotify-auth', 
              code: '${code}', 
              state: '${state}' 
            }, '*');
            window.close();
          </script>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' },
    })
  }

  return new Response('Invalid request', { status: 400 })
})
