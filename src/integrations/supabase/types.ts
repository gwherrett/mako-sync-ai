export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      local_mp3s: {
        Row: {
          album: string | null
          artist: string | null
          bpm: number | null
          comment: string | null
          created_at: string | null
          date_added: string | null
          file_path: string
          genre: string | null
          hash: string | null
          id: string
          key: string | null
          last_modified: string | null
          play_count: number | null
          rating: number | null
          title: string | null
          year: number | null
        }
        Insert: {
          album?: string | null
          artist?: string | null
          bpm?: number | null
          comment?: string | null
          created_at?: string | null
          date_added?: string | null
          file_path: string
          genre?: string | null
          hash?: string | null
          id?: string
          key?: string | null
          last_modified?: string | null
          play_count?: number | null
          rating?: number | null
          title?: string | null
          year?: number | null
        }
        Update: {
          album?: string | null
          artist?: string | null
          bpm?: number | null
          comment?: string | null
          created_at?: string | null
          date_added?: string | null
          file_path?: string
          genre?: string | null
          hash?: string | null
          id?: string
          key?: string | null
          last_modified?: string | null
          play_count?: number | null
          rating?: number | null
          title?: string | null
          year?: number | null
        }
        Relationships: []
      }
      metadata_sync_log: {
        Row: {
          fields_updated: Json | null
          id: string
          mp3_id: string | null
          notes: string | null
          sync_status: string | null
          synced_at: string | null
        }
        Insert: {
          fields_updated?: Json | null
          id?: string
          mp3_id?: string | null
          notes?: string | null
          sync_status?: string | null
          synced_at?: string | null
        }
        Update: {
          fields_updated?: Json | null
          id?: string
          mp3_id?: string | null
          notes?: string | null
          sync_status?: string | null
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "metadata_sync_log_mp3_id_fkey"
            columns: ["mp3_id"]
            isOneToOne: false
            referencedRelation: "local_mp3s"
            referencedColumns: ["id"]
          },
        ]
      }
      spotify_connections: {
        Row: {
          access_token: string
          created_at: string | null
          display_name: string | null
          email: string | null
          expires_at: string
          id: string
          refresh_token: string | null
          scope: string | null
          spotify_user_id: string
          token_type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          expires_at: string
          id?: string
          refresh_token?: string | null
          scope?: string | null
          spotify_user_id: string
          token_type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          expires_at?: string
          id?: string
          refresh_token?: string | null
          scope?: string | null
          spotify_user_id?: string
          token_type?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      spotify_liked: {
        Row: {
          added_at: string | null
          album: string | null
          artist: string
          bpm: number | null
          created_at: string | null
          id: string
          key: string | null
          spotify_id: string
          title: string
          user_id: string | null
          year: number | null
        }
        Insert: {
          added_at?: string | null
          album?: string | null
          artist: string
          bpm?: number | null
          created_at?: string | null
          id?: string
          key?: string | null
          spotify_id: string
          title: string
          user_id?: string | null
          year?: number | null
        }
        Update: {
          added_at?: string | null
          album?: string | null
          artist?: string
          bpm?: number | null
          created_at?: string | null
          id?: string
          key?: string | null
          spotify_id?: string
          title?: string
          user_id?: string | null
          year?: number | null
        }
        Relationships: []
      }
      track_matches: {
        Row: {
          id: string
          is_confirmed: boolean | null
          match_confidence: number | null
          match_method: string | null
          matched_at: string | null
          mp3_id: string
          spotify_track_id: string
        }
        Insert: {
          id?: string
          is_confirmed?: boolean | null
          match_confidence?: number | null
          match_method?: string | null
          matched_at?: string | null
          mp3_id: string
          spotify_track_id: string
        }
        Update: {
          id?: string
          is_confirmed?: boolean | null
          match_confidence?: number | null
          match_method?: string | null
          matched_at?: string | null
          mp3_id?: string
          spotify_track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "track_matches_mp3_id_fkey"
            columns: ["mp3_id"]
            isOneToOne: false
            referencedRelation: "local_mp3s"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "track_matches_spotify_track_id_fkey"
            columns: ["spotify_track_id"]
            isOneToOne: false
            referencedRelation: "spotify_liked"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
