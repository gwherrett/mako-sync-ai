import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPER_GENRES = [
  'House', 'Drum & Bass', 'UK Garage', 'Hip Hop', 'Urban', 'Pop', 'Rock',
  'Jazz', 'Blues', 'Country/Folk', 'Electronic', 'Classical', 'Latin',
  'Reggae/Dancehall', 'World', 'Disco', 'Metal', 'Other'
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, artist, album, mix, spotifyGenre } = await req.json();

    console.log('AI Genre Suggest Request:', { title, artist, album, mix, spotifyGenre });

    if (!title || !artist) {
      return new Response(
        JSON.stringify({ error: 'Title and artist are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Build context for AI
    let context = `Track: "${title}" by ${artist}`;
    if (album) context += `\nAlbum: ${album}`;
    if (mix) context += `\nMix/Remix: ${mix}`;
    if (spotifyGenre) context += `\nSpotify Genre: ${spotifyGenre}`;

    const systemPrompt = `You are a music genre classification expert. Your task is to analyze track information and recommend the most appropriate super-genre from this list:

${SUPER_GENRES.join(', ')}

Consider these factors:
1. If there's a remix/mix credit, the REMIXER's style often defines the genre more than the original artist
2. Mix descriptors like "Club Mix", "House Mix", "Dubstep Remix" are strong indicators
3. Artist names and their known musical styles
4. Spotify genre metadata when available
5. Album context

Respond with a JSON object using this exact structure:
{
  "suggestedGenre": "Genre Name",
  "confidence": "high" | "medium" | "low",
  "reasoning": "Brief explanation of why this genre fits (max 100 words)"
}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: context }
        ],
        temperature: 0.3, // Lower temperature for more consistent classification
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits depleted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    console.log('AI Response:', aiResponse);

    // Parse the JSON response
    let suggestion;
    try {
      // Try to extract JSON from the response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        suggestion = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      // Fallback response
      suggestion = {
        suggestedGenre: 'Other',
        confidence: 'low',
        reasoning: 'Unable to parse AI suggestion. Please review manually.'
      };
    }

    // Validate the suggested genre
    if (!SUPER_GENRES.includes(suggestion.suggestedGenre)) {
      console.warn('Invalid genre suggested:', suggestion.suggestedGenre);
      suggestion.suggestedGenre = 'Other';
      suggestion.confidence = 'low';
    }

    return new Response(
      JSON.stringify(suggestion),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ai-genre-suggest:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        suggestedGenre: 'Other',
        confidence: 'low',
        reasoning: 'An error occurred while analyzing the track.'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
