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
    const { title, artist, album, mix, spotifyGenre, libraryContext } = await req.json();

    console.log('AI Genre Suggest Request:', { title, artist, album, mix, spotifyGenre, hasLibraryContext: !!libraryContext });

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

    // Build library context string if provided
    let libraryContextString = '';
    if (libraryContext) {
      libraryContextString = `\n\nUSER'S LIBRARY PATTERNS (use this to inform your decision):`;
      
      // Artist patterns
      if (libraryContext.artistPatterns && libraryContext.artistPatterns.length > 0) {
        libraryContextString += `\n\nThis artist appears ${libraryContext.artistPatterns.length} times in their library with these genres:`;
        libraryContext.artistPatterns.slice(0, 5).forEach((pattern: any) => {
          libraryContextString += `\n- "${pattern.track}": ${pattern.genre} → ${pattern.super_genre}`;
        });
        if (libraryContext.artistPatterns.length > 5) {
          libraryContextString += `\n... and ${libraryContext.artistPatterns.length - 5} more tracks`;
        }
      }
      
      // Genre patterns
      if (libraryContext.genrePatterns && Object.keys(libraryContext.genrePatterns).length > 0) {
        libraryContextString += `\n\nUser's common genre mappings:`;
        Object.entries(libraryContext.genrePatterns).slice(0, 10).forEach(([spotifyGenre, superGenre]) => {
          libraryContextString += `\n- ${spotifyGenre} → ${superGenre}`;
        });
      }

      // Similar tracks
      if (libraryContext.similarTracks && libraryContext.similarTracks.length > 0) {
        libraryContextString += `\n\nSimilar tracks in their library:`;
        libraryContext.similarTracks.slice(0, 3).forEach((track: any) => {
          libraryContextString += `\n- "${track.title}" by ${track.artist}: ${track.genre} → ${track.super_genre}`;
        });
      }
    }

    const systemPrompt = `You are a music genre classification expert. Your task is to analyze track information and recommend the most appropriate super-genre from this list:

${SUPER_GENRES.join(', ')}

Consider these factors (in priority order):
1. **User's Library Patterns** - If the user has similar tracks or this artist already classified, strongly prefer their existing choices for consistency
2. If there's a remix/mix credit, the REMIXER's style often defines the genre more than the original artist
3. Mix descriptors like "Club Mix", "House Mix", "Dubstep Remix" are strong indicators
4. Artist names and their known musical styles
5. Spotify genre metadata when available
6. Album context

IMPORTANT: Be consistent with the user's existing library patterns when similar tracks exist. Users want consistency in their classifications.

Respond with a JSON object using this exact structure:
{
  "suggestedGenre": "Genre Name",
  "confidence": "high" | "medium" | "low",
  "reasoning": "Brief explanation of why this genre fits, mentioning if you used their library patterns (max 100 words)"
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
          { role: 'user', content: context + libraryContextString }
        ],
        temperature: 0.2, // Lower temperature for more consistent classification with user patterns
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
