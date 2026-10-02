export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ingestion_runs: {
        Row: {
          error: string | null
          expired: number
          fetched: number
          finished_at: string | null
          id: string
          inserted: number
          rejected: number
          source_id: string | null
          started_at: string
          status: string
          updated: number
        }
        Insert: {
          error?: string | null
          expired?: number
          fetched?: number
          finished_at?: string | null
          id?: string
          inserted?: number
          rejected?: number
          source_id?: string | null
          started_at?: string
          status?: string
          updated?: number
        }
        Update: {
          error?: string | null
          expired?: number
          fetched?: number
          finished_at?: string | null
          id?: string
          inserted?: number
          rejected?: number
          source_id?: string | null
          started_at?: string
          status?: string
          updated?: number
        }
        Relationships: [
          {
            foreignKeyName: "ingestion_runs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "source_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          canonical_url: string
          city: string | null
          content_hash: string
          deadline: string | null
          description: string | null
          duration: string | null
          eligibility: string[]
          end_date: string | null
          fee: number | null
          first_seen_at: string
          id: string
          kind: string
          last_checked_at: string
          location: string | null
          mode: string | null
          normalized_organizer: string
          normalized_title: string
          openings: number | null
          organizer: string
          posted_at: string | null
          prize_pool: number | null
          role: string | null
          source_id: string
          source_name: string
          source_url: string
          start_date: string | null
          status: string
          stipend: number | null
          summary: string | null
          tags: string[]
          team_size: string | null
          title: string
          updated_at: string
          verification_status: string
        }
        Insert: {
          canonical_url: string
          city?: string | null
          content_hash: string
          deadline?: string | null
          description?: string | null
          duration?: string | null
          eligibility?: string[]
          end_date?: string | null
          fee?: number | null
          first_seen_at?: string
          id?: string
          kind: string
          last_checked_at?: string
          location?: string | null
          mode?: string | null
          normalized_organizer: string
          normalized_title: string
          openings?: number | null
          organizer: string
          posted_at?: string | null
          prize_pool?: number | null
          role?: string | null
          source_id: string
          source_name: string
          source_url: string
          start_date?: string | null
          status?: string
          stipend?: number | null
          summary?: string | null
          tags?: string[]
          team_size?: string | null
          title: string
          updated_at?: string
          verification_status?: string
        }
        Update: {
          canonical_url?: string
          city?: string | null
          content_hash?: string
          deadline?: string | null
          description?: string | null
          duration?: string | null
          eligibility?: string[]
          end_date?: string | null
          fee?: number | null
          first_seen_at?: string
          id?: string
          kind?: string
          last_checked_at?: string
          location?: string | null
          mode?: string | null
          normalized_organizer?: string
          normalized_title?: string
          openings?: number | null
          organizer?: string
          posted_at?: string | null
          prize_pool?: number | null
          role?: string | null
          source_id?: string
          source_name?: string
          source_url?: string
          start_date?: string | null
          status?: string
          stipend?: number | null
          summary?: string | null
          tags?: string[]
          team_size?: string | null
          title?: string
          updated_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "source_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      source_registry: {
        Row: {
          enabled: boolean
          id: string
          kind: string
          last_error: string | null
          last_success_at: string | null
          name: string
          requirement: string | null
          status: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          id: string
          kind: string
          last_error?: string | null
          last_success_at?: string | null
          name: string
          requirement?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          id?: string
          kind?: string
          last_error?: string | null
          last_success_at?: string | null
          name?: string
          requirement?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      expire_opportunities: { Args: never; Returns: number }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
