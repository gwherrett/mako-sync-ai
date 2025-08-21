export type SuperGenre = 
  | 'House'
  | 'Drum & Bass'
  | 'Garage'
  | 'Hip Hop'
  | 'Soul/R&B'
  | 'Pop'
  | 'Rock'
  | 'Jazz'
  | 'Blues'
  | 'Country/Folk'
  | 'Electronic'
  | 'Classical'
  | 'Latin'
  | 'Reggae/Dancehall'
  | 'World'
  | 'Disco'
  | 'Metal'
  | 'Other';

export const SUPER_GENRES: SuperGenre[] = [
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
  'Disco',
  'Metal',
  'Other'
];

export interface GenreMapping {
  spotify_genre: string;
  super_genre: SuperGenre | null;
  is_overridden: boolean;
}

export interface GenreMappingOverride {
  id: string;
  user_id: string;
  spotify_genre: string;
  super_genre: SuperGenre;
  updated_at: string;
}