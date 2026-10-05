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
      ingestion_events: {
        Row: {
          error: string | null
          event_type: string
          external_run_id: string | null
          id: string
          idempotency_key: string | null
          payload_hash: string | null
          processed_at: string | null
          received_at: string
          run_id: string | null
          source_id: string | null
          status: string
        }
        Insert: {
          error?: string | null
          event_type: string
          external_run_id?: string | null
          id?: string
          idempotency_key?: string | null
          payload_hash?: string | null
          processed_at?: string | null
          received_at?: string
          run_id?: string | null
          source_id?: string | null
          status?: string
        }
        Update: {
          error?: string | null
          event_type?: string
          external_run_id?: string | null
          id?: string
          idempotency_key?: string | null
          payload_hash?: string | null
          processed_at?: string | null
          received_at?: string
          run_id?: string | null
          source_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingestion_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "ingestion_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingestion_events_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "source_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      ingestion_runs: {
        Row: {
          accepted: number
          duplicates: number
          duration_ms: number | null
          error: string | null
          errors: Json
          expired: number
          fetched: number
          finished_at: string | null
          id: string
          idempotency_key: string | null
          inserted: number
          needs_verification: number
          rejected: number
          source_id: string | null
          started_at: string
          status: string
          trigger: string
          updated: number
        }
        Insert: {
          accepted?: number
          duplicates?: number
          duration_ms?: number | null
          error?: string | null
          errors?: Json
          expired?: number
          fetched?: number
          finished_at?: string | null
          id?: string
          idempotency_key?: string | null
          inserted?: number
          needs_verification?: number
          rejected?: number
          source_id?: string | null
          started_at?: string
          status?: string
          trigger?: string
          updated?: number
        }
        Update: {
          accepted?: number
          duplicates?: number
          duration_ms?: number | null
          error?: string | null
          errors?: Json
          expired?: number
          fetched?: number
          finished_at?: string | null
          id?: string
          idempotency_key?: string | null
          inserted?: number
          needs_verification?: number
          rejected?: number
          source_id?: string | null
          started_at?: string
          status?: string
          trigger?: string
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
          application_url: string | null
          canonical_url: string
          city: string | null
          content_hash: string
          deadline: string | null
          description: string | null
          duration: string | null
          eligibility: string[]
          end_date: string | null
          evidence_json: Json | null
          fee: number | null
          first_seen_at: string
          id: string
          kind: string
          last_change_at: string | null
          last_change_summary: string | null
          last_checked_at: string
          location: string | null
          mode: string | null
          normalized_organizer: string
          normalized_title: string
          openings: number | null
          organizer: string
          posted_at: string | null
          prize_pool: number | null
          raw_source_hash: string | null
          relevance_score: number | null
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
          verification_reasons: string[]
          verification_status: string
        }
        Insert: {
          application_url?: string | null
          canonical_url: string
          city?: string | null
          content_hash: string
          deadline?: string | null
          description?: string | null
          duration?: string | null
          eligibility?: string[]
          end_date?: string | null
          evidence_json?: Json | null
          fee?: number | null
          first_seen_at?: string
          id?: string
          kind: string
          last_change_at?: string | null
          last_change_summary?: string | null
          last_checked_at?: string
          location?: string | null
          mode?: string | null
          normalized_organizer: string
          normalized_title: string
          openings?: number | null
          organizer: string
          posted_at?: string | null
          prize_pool?: number | null
          raw_source_hash?: string | null
          relevance_score?: number | null
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
          verification_reasons?: string[]
          verification_status?: string
        }
        Update: {
          application_url?: string | null
          canonical_url?: string
          city?: string | null
          content_hash?: string
          deadline?: string | null
          description?: string | null
          duration?: string | null
          eligibility?: string[]
          end_date?: string | null
          evidence_json?: Json | null
          fee?: number | null
          first_seen_at?: string
          id?: string
          kind?: string
          last_change_at?: string | null
          last_change_summary?: string | null
          last_checked_at?: string
          location?: string | null
          mode?: string | null
          normalized_organizer?: string
          normalized_title?: string
          openings?: number | null
          organizer?: string
          posted_at?: string | null
          prize_pool?: number | null
          raw_source_hash?: string | null
          relevance_score?: number | null
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
          verification_reasons?: string[]
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
      opportunity_changes: {
        Row: {
          change_type: string
          created_at: string
          id: string
          new_value: string | null
          old_value: string | null
          opportunity_id: string | null
          run_id: string | null
        }
        Insert: {
          change_type: string
          created_at?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          opportunity_id?: string | null
          run_id?: string | null
        }
        Update: {
          change_type?: string
          created_at?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          opportunity_id?: string | null
          run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_changes_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_changes_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "ingestion_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      source_registry: {
        Row: {
          actor_id: string | null
          adapter_config: Json
          allowed_start_urls: string[]
          consecutive_empty_runs: number
          default_kind: string | null
          discovery_method: string
          enabled: boolean
          endpoint: string | null
          field_mapping: Json
          id: string
          kind: string
          last_counts: Json | null
          last_error: string | null
          last_manual_run_at: string | null
          last_run_at: string | null
          last_success_at: string | null
          name: string
          next_run_at: string | null
          official_domains: string[]
          poll_interval_minutes: number
          priority: number
          requirement: string | null
          status: string
          supports_webhook: boolean
          updated_at: string
        }
        Insert: {
          actor_id?: string | null
          adapter_config?: Json
          allowed_start_urls?: string[]
          consecutive_empty_runs?: number
          default_kind?: string | null
          discovery_method?: string
          enabled?: boolean
          endpoint?: string | null
          field_mapping?: Json
          id: string
          kind: string
          last_counts?: Json | null
          last_error?: string | null
          last_manual_run_at?: string | null
          last_run_at?: string | null
          last_success_at?: string | null
          name: string
          next_run_at?: string | null
          official_domains?: string[]
          poll_interval_minutes?: number
          priority?: number
          requirement?: string | null
          status?: string
          supports_webhook?: boolean
          updated_at?: string
        }
        Update: {
          actor_id?: string | null
          adapter_config?: Json
          allowed_start_urls?: string[]
          consecutive_empty_runs?: number
          default_kind?: string | null
          discovery_method?: string
          enabled?: boolean
          endpoint?: string | null
          field_mapping?: Json
          id?: string
          kind?: string
          last_counts?: Json | null
          last_error?: string | null
          last_manual_run_at?: string | null
          last_run_at?: string | null
          last_success_at?: string | null
          name?: string
          next_run_at?: string | null
          official_domains?: string[]
          poll_interval_minutes?: number
          priority?: number
          requirement?: string | null
          status?: string
          supports_webhook?: boolean
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
      opportunity_counts: {
        Args: never
        Returns: {
          n: number
          status: string
          verification_status: string
        }[]
      }
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
