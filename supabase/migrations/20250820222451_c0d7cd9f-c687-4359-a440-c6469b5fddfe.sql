-- Create the super_genre enum
CREATE TYPE super_genre AS ENUM (
  'House',
  'Drum & Bass', 
  'Garage',
  'Hip Hop',
  'Soul/R&B',
  'Pop',
  'Rock',
  'Jazz',
  'Blues',
  'Country/Folk',
  'Electronic',
  'Classical',
  'Latin',
  'Reggae/Dancehall',
  'World',
  'Other'
);

-- Create base dictionary table (read-only)
CREATE TABLE public.spotify_genre_map_base (
  spotify_genre text PRIMARY KEY,
  super_genre super_genre NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create user overrides table  
CREATE TABLE public.spotify_genre_map_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  spotify_genre text NOT NULL REFERENCES public.spotify_genre_map_base(spotify_genre) ON DELETE CASCADE,
  super_genre super_genre NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, spotify_genre)
);

-- Enable RLS
ALTER TABLE public.spotify_genre_map_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spotify_genre_map_overrides ENABLE ROW LEVEL SECURITY;

-- RLS policies for base table
CREATE POLICY "read base" ON public.spotify_genre_map_base
  FOR SELECT USING (auth.role() = 'authenticated');

-- RLS policies for overrides table
CREATE POLICY "read own overrides" ON public.spotify_genre_map_overrides
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "upsert own overrides" ON public.spotify_genre_map_overrides
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update own overrides" ON public.spotify_genre_map_overrides
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete own overrides" ON public.spotify_genre_map_overrides
  FOR DELETE USING (auth.uid() = user_id);

-- Seed base mapping using deterministic rules
INSERT INTO public.spotify_genre_map_base (spotify_genre, super_genre) VALUES
  ('acid house', 'House'),
  ('chicago house', 'House'),
  ('deep house', 'House'),
  ('disco house', 'House'),
  ('french house', 'House'),
  ('funky house', 'House'),
  ('future house', 'House'),
  ('hip house', 'House'),
  ('house', 'House'),
  ('jazz house', 'House'),
  ('latin house', 'House'),
  ('lo-fi house', 'House'),
  ('rally house', 'House'),
  ('stutter house', 'House'),
  ('tech house', 'House'),
  ('afro house', 'House'),
  
  ('drum and bass', 'Drum & Bass'),
  ('jungle', 'Drum & Bass'),
  ('liquid funk', 'Drum & Bass'),
  
  ('uk garage', 'Garage'),
  ('uk funky', 'Garage'),
  ('2-step', 'Garage'),
  
  ('hip hop', 'Hip Hop'),
  ('alternative hip hop', 'Hip Hop'),
  ('cloud rap', 'Hip Hop'),
  ('crunk', 'Hip Hop'),
  ('east coast hip hop', 'Hip Hop'),
  ('experimental hip hop', 'Hip Hop'),
  ('gangster rap', 'Hip Hop'),
  ('g-funk', 'Hip Hop'),
  ('old school hip hop', 'Hip Hop'),
  ('rap', 'Hip Hop'),
  ('rap rock', 'Hip Hop'),
  ('southern hip hop', 'Hip Hop'),
  ('underground hip hop', 'Hip Hop'),
  ('west coast hip hop', 'Hip Hop'),
  ('jazz rap', 'Hip Hop'),
  ('aussie drill', 'Hip Hop'),
  
  ('soul', 'Soul/R&B'),
  ('r&b', 'Soul/R&B'),
  ('alternative r&b', 'Soul/R&B'),
  ('classic soul', 'Soul/R&B'),
  ('indie soul', 'Soul/R&B'),
  ('neo soul', 'Soul/R&B'),
  ('northern soul', 'Soul/R&B'),
  ('philly soul', 'Soul/R&B'),
  ('quiet storm', 'Soul/R&B'),
  ('retro soul', 'Soul/R&B'),
  ('soul jazz', 'Soul/R&B'),
  ('uk r&b', 'Soul/R&B'),
  ('afro soul', 'Soul/R&B'),
  ('motown', 'Soul/R&B'),
  ('new jack swing', 'Soul/R&B'),
  
  ('pop', 'Pop'),
  ('art pop', 'Pop'),
  ('baroque pop', 'Pop'),
  ('bedroom pop', 'Pop'),
  ('dance pop', 'Pop'),
  ('dream pop', 'Pop'),
  ('french indie pop', 'Pop'),
  ('hyperpop', 'Pop'),
  ('jangle pop', 'Pop'),
  ('k-pop', 'Pop'),
  ('power pop', 'Pop'),
  ('soft pop', 'Pop'),
  ('synthpop', 'Pop'),
  ('tamil pop', 'Pop'),
  
  ('rock', 'Rock'),
  ('acid rock', 'Rock'),
  ('alternative rock', 'Rock'),
  ('art rock', 'Rock'),
  ('blues rock', 'Rock'),
  ('britpop', 'Rock'),
  ('celtic rock', 'Rock'),
  ('classic rock', 'Rock'),
  ('country rock', 'Rock'),
  ('folk rock', 'Rock'),
  ('funk rock', 'Rock'),
  ('glam rock', 'Rock'),
  ('grunge', 'Rock'),
  ('hard rock', 'Rock'),
  ('indie rock', 'Rock'),
  ('krautrock', 'Rock'),
  ('neo-psychedelic', 'Rock'),
  ('noise rock', 'Rock'),
  ('post-punk', 'Rock'),
  ('post-hardcore', 'Rock'),
  ('progressive rock', 'Rock'),
  ('proto-punk', 'Rock'),
  ('psychedelic rock', 'Rock'),
  ('punk', 'Rock'),
  ('rockabilly', 'Rock'),
  ('shoegaze', 'Rock'),
  ('slowcore', 'Rock'),
  ('soft rock', 'Rock'),
  ('southern rock', 'Rock'),
  ('stoner rock', 'Rock'),
  ('yacht rock', 'Rock'),
  ('celtic punk', 'Rock'),
  ('folk punk', 'Rock'),
  ('hardcore punk', 'Rock'),
  ('horror punk', 'Rock'),
  ('indie punk', 'Rock'),
  ('riot grrrl', 'Rock'),
  
  ('jazz', 'Jazz'),
  ('acid jazz', 'Jazz'),
  ('bebop', 'Jazz'),
  ('big band', 'Jazz'),
  ('brazilian jazz', 'Jazz'),
  ('ethiopian jazz', 'Jazz'),
  ('free jazz', 'Jazz'),
  ('french jazz', 'Jazz'),
  ('hard bop', 'Jazz'),
  ('indie jazz', 'Jazz'),
  ('jazz beats', 'Jazz'),
  ('jazz blues', 'Jazz'),
  ('jazz funk', 'Jazz'),
  ('jazz fusion', 'Jazz'),
  ('latin jazz', 'Jazz'),
  ('nu jazz', 'Jazz'),
  ('smooth jazz', 'Jazz'),
  ('vocal jazz', 'Jazz'),
  ('japanese classical', 'Jazz'),
  
  ('blues', 'Blues'),
  ('doo-wop', 'Blues'),
  ('boogie-woogie', 'Blues'),
  
  ('country', 'Country/Folk'),
  ('alt country', 'Country/Folk'),
  ('bluegrass', 'Country/Folk'),
  ('cajun', 'Country/Folk'),
  ('christian country', 'Country/Folk'),
  ('classic country', 'Country/Folk'),
  ('folk', 'Country/Folk'),
  ('honky tonk', 'Country/Folk'),
  ('indie folk', 'Country/Folk'),
  ('outlaw country', 'Country/Folk'),
  ('anti-folk', 'Country/Folk'),
  
  ('ambient', 'Electronic'),
  ('big beat', 'Electronic'),
  ('breakbeat', 'Electronic'),
  ('breakcore', 'Electronic'),
  ('chillwave', 'Electronic'),
  ('downtempo', 'Electronic'),
  ('drone', 'Electronic'),
  ('drumstep', 'Electronic'),
  ('dub', 'Electronic'),
  ('dubstep', 'Electronic'),
  ('dub techno', 'Electronic'),
  ('edm', 'Electronic'),
  ('electroclash', 'Electronic'),
  ('eurodance', 'Electronic'),
  ('footwork', 'Electronic'),
  ('freestyle', 'Electronic'),
  ('grime', 'Electronic'),
  ('idm', 'Electronic'),
  ('jersey club', 'Electronic'),
  ('lo-fi beats', 'Electronic'),
  ('madchester', 'Electronic'),
  ('new rave', 'Electronic'),
  ('new wave', 'Electronic'),
  ('nu disco', 'Electronic'),
  ('post-disco', 'Electronic'),
  ('techno', 'Electronic'),
  ('trance', 'Electronic'),
  ('trip hop', 'Electronic'),
  ('vaporwave', 'Electronic'),
  ('witch house', 'Electronic'),
  ('alternative dance', 'Electronic'),
  ('acid techno', 'Electronic'),
  ('bassline', 'Electronic'),
  ('electro swing', 'Electronic'),
  ('hi-nrg', 'Electronic'),
  ('minimalism', 'Electronic'),
  ('tamil dance', 'Electronic'),
  
  ('classical', 'Classical'),
  ('opera', 'Classical'),
  ('new age', 'Classical'),
  
  ('bossa nova', 'Latin'),
  ('cha cha cha', 'Latin'),
  ('mpb', 'Latin'),
  ('reggaeton', 'Latin'),
  ('samba', 'Latin'),
  ('soca', 'Latin'),
  
  ('dancehall', 'Reggae/Dancehall'),
  ('lovers rock', 'Reggae/Dancehall'),
  ('ragga', 'Reggae/Dancehall'),
  ('reggae', 'Reggae/Dancehall'),
  ('rocksteady', 'Reggae/Dancehall'),
  ('roots reggae', 'Reggae/Dancehall'),
  ('ska', 'Reggae/Dancehall'),
  
  ('afrobeat', 'World'),
  ('afrobeats', 'World'),
  ('ballroom vogue', 'World'),
  ('celtic', 'World'),
  ('gnawa', 'World'),
  
  ('adult standards', 'Other'),
  ('aor', 'Other'),
  ('children''s music', 'Other'),
  ('christmas', 'Other'),
  ('comedy', 'Other'),
  ('disco', 'Other'),
  ('exotica', 'Other'),
  ('funk', 'Other'),
  ('glam metal', 'Other'),
  ('gospel', 'Other'),
  ('heavy metal', 'Other'),
  ('indie', 'Other'),
  ('industrial metal', 'Other'),
  ('italo disco', 'Other'),
  ('jam band', 'Other'),
  ('lo-fi indie', 'Other'),
  ('lounge', 'Other'),
  ('metal', 'Other'),
  ('musicals', 'Other'),
  ('progressive metal', 'Other'),
  ('sea shanties', 'Other'),
  ('singer-songwriter', 'Other'),
  ('sludge metal', 'Other'),
  ('spoken word', 'Other'),
  ('stoner metal', 'Other'),
  ('thrash metal', 'Other');

-- Create effective mapping view
CREATE VIEW public.v_effective_spotify_genre_map AS
SELECT
  b.spotify_genre,
  COALESCE(o.super_genre, b.super_genre) AS super_genre,
  o.user_id IS NOT NULL AS is_overridden
FROM public.spotify_genre_map_base b
LEFT JOIN public.spotify_genre_map_overrides o
  ON o.spotify_genre = b.spotify_genre
  AND o.user_id = auth.uid();