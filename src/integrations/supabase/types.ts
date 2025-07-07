export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
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
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          onboarding_completed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          onboarding_completed?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          onboarding_completed?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          danceability: number | null
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
          danceability?: number | null
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
          danceability?: number | null
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
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _user_id: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
