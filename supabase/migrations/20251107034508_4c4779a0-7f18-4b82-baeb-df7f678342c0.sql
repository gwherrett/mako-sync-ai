-- Add missing Spotify genres to base mapping
INSERT INTO spotify_genre_map_base (spotify_genre, super_genre) VALUES
('hard house', 'House'),
('bikutsi', 'World'),
('melodic techno', 'Electronic'),
('moombahton', 'Electronic')
ON CONFLICT (spotify_genre) DO NOTHING;