import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// HTML escape function to prevent XSS attacks
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

serve(async (req) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  console.log('Spotify callback received:', { 
    hasCode: !!code, 
    hasState: !!state, 
    hasError: !!error 
  });

  if (error) {
    // Escape error message to prevent XSS
    const safeError = escapeHtml(error);
    
    return new Response(`
      <html>
        <body>
          <h1>Spotify Connection Failed</h1>
          <p>Error: ${safeError}</p>
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
    // Validate code and state format (basic validation)
    if (!/^[a-zA-Z0-9_-]+$/.test(code)) {
      console.error('Invalid code parameter format');
      return new Response('Invalid code parameter', { status: 400 });
    }
    
    if (state && !/^[a-zA-Z0-9_-]+$/.test(state)) {
      console.error('Invalid state parameter format');
      return new Response('Invalid state parameter', { status: 400 });
    }

    // Use JSON.stringify to safely encode the data for postMessage
    const messageData = JSON.stringify({
      type: 'spotify-auth',
      code: code,
      state: state || ''
    });

    return new Response(`
      <html>
        <body>
          <h1>Connecting to Spotify...</h1>
          <script>
            try {
              const messageData = ${messageData};
              if (window.opener) {
                // Use window.location.origin for the target origin
                // This is safer than '*' but still allows the parent to receive the message
                window.opener.postMessage(messageData, window.location.origin);
              }
              window.close();
            } catch (e) {
              console.error('Failed to send auth data:', e);
              window.close();
            }
          </script>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' },
    })
  }

  return new Response('Invalid request', { status: 400 })
})
