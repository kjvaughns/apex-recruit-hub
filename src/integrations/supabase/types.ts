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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      applicant_activities: {
        Row: {
          actor_id: string | null
          applicant_id: string
          created_at: string
          data: Json | null
          event_type: string
          id: string
          summary: string | null
        }
        Insert: {
          actor_id?: string | null
          applicant_id: string
          created_at?: string
          data?: Json | null
          event_type: string
          id?: string
          summary?: string | null
        }
        Update: {
          actor_id?: string | null
          applicant_id?: string
          created_at?: string
          data?: Json | null
          event_type?: string
          id?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applicant_activities_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applicant_activities_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "applicants"
            referencedColumns: ["id"]
          },
        ]
      }
      applicant_sources: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          slug?: string
        }
        Relationships: []
      }
      applicants: {
        Row: {
          address: string | null
          archived_at: string | null
          assigned_manager_id: string | null
          assigned_recruiter_id: string | null
          calendly_scheduled_at: string | null
          calendly_url_used: string | null
          city: string | null
          confirmation_token: string | null
          consent_contact: boolean
          created_at: string
          current_stage_id: string | null
          date_of_birth: string | null
          email: string
          evaluation_completed_at: string | null
          first_name: string
          id: string
          last_contacted_at: string | null
          last_name: string
          licensed: boolean
          licensing_status: string | null
          next_follow_up_at: string | null
          original_recruiter_id: string | null
          phone: string | null
          priority: string
          ref_slug: string | null
          referred_by_name: string | null
          referred_by_profile_id: string | null
          scheduled_event_end: string | null
          scheduled_event_id: string | null
          scheduled_event_start: string | null
          scheduled_event_url: string | null
          scheduled_invitee_id: string | null
          scheduling_status: string
          source_details: string | null
          source_id: string | null
          stage_entered_at: string
          state: string | null
          status: string
          success_page_type: string | null
          team_id: string | null
          updated_at: string
          why_text: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          archived_at?: string | null
          assigned_manager_id?: string | null
          assigned_recruiter_id?: string | null
          calendly_scheduled_at?: string | null
          calendly_url_used?: string | null
          city?: string | null
          confirmation_token?: string | null
          consent_contact?: boolean
          created_at?: string
          current_stage_id?: string | null
          date_of_birth?: string | null
          email: string
          evaluation_completed_at?: string | null
          first_name: string
          id?: string
          last_contacted_at?: string | null
          last_name: string
          licensed?: boolean
          licensing_status?: string | null
          next_follow_up_at?: string | null
          original_recruiter_id?: string | null
          phone?: string | null
          priority?: string
          ref_slug?: string | null
          referred_by_name?: string | null
          referred_by_profile_id?: string | null
          scheduled_event_end?: string | null
          scheduled_event_id?: string | null
          scheduled_event_start?: string | null
          scheduled_event_url?: string | null
          scheduled_invitee_id?: string | null
          scheduling_status?: string
          source_details?: string | null
          source_id?: string | null
          stage_entered_at?: string
          state?: string | null
          status?: string
          success_page_type?: string | null
          team_id?: string | null
          updated_at?: string
          why_text?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          archived_at?: string | null
          assigned_manager_id?: string | null
          assigned_recruiter_id?: string | null
          calendly_scheduled_at?: string | null
          calendly_url_used?: string | null
          city?: string | null
          confirmation_token?: string | null
          consent_contact?: boolean
          created_at?: string
          current_stage_id?: string | null
          date_of_birth?: string | null
          email?: string
          evaluation_completed_at?: string | null
          first_name?: string
          id?: string
          last_contacted_at?: string | null
          last_name?: string
          licensed?: boolean
          licensing_status?: string | null
          next_follow_up_at?: string | null
          original_recruiter_id?: string | null
          phone?: string | null
          priority?: string
          ref_slug?: string | null
          referred_by_name?: string | null
          referred_by_profile_id?: string | null
          scheduled_event_end?: string | null
          scheduled_event_id?: string | null
          scheduled_event_start?: string | null
          scheduled_event_url?: string | null
          scheduled_invitee_id?: string | null
          scheduling_status?: string
          source_details?: string | null
          source_id?: string | null
          stage_entered_at?: string
          state?: string | null
          status?: string
          success_page_type?: string | null
          team_id?: string | null
          updated_at?: string
          why_text?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applicants_assigned_manager_id_fkey"
            columns: ["assigned_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applicants_assigned_recruiter_id_fkey"
            columns: ["assigned_recruiter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applicants_current_stage_id_fkey"
            columns: ["current_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applicants_original_recruiter_id_fkey"
            columns: ["original_recruiter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applicants_referred_by_profile_id_fkey"
            columns: ["referred_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applicants_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "applicant_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applicants_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          answers: Json
          applicant_id: string | null
          created_at: string
          email: string
          id: string
          matched: boolean
        }
        Insert: {
          answers?: Json
          applicant_id?: string | null
          created_at?: string
          email: string
          id?: string
          matched?: boolean
        }
        Update: {
          answers?: Json
          applicant_id?: string | null
          created_at?: string
          email?: string
          id?: string
          matched?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "applicants"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          color: string
          created_at: string
          id: string
          is_archived: boolean
          is_completed_stage: boolean
          is_lost_stage: boolean
          name: string
          position: number
          slug: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          is_completed_stage?: boolean
          is_lost_stage?: boolean
          name: string
          position: number
          slug: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          is_completed_stage?: boolean
          is_lost_stage?: boolean
          name?: string
          position?: number
          slug?: string
        }
        Relationships: []
      }
      presenters: {
        Row: {
          created_at: string
          id: string
          initials: string
          is_active: boolean
          name: string
          role: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          initials: string
          is_active?: boolean
          name: string
          role?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          initials?: string
          is_active?: boolean
          name?: string
          role?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          can_invite_agents: boolean
          can_invite_leaders: boolean
          can_manage_resources: boolean
          can_receive_applicants: boolean
          can_schedule_licensed: boolean
          created_at: string
          organization_path: string | null
          parent_user_id: string | null
          status: string
          email: string | null
          first_name: string | null
          full_name: string | null
          id: string
          is_active: boolean
          last_name: string | null
          licensed_calendly_updated_at: string | null
          licensed_calendly_url: string | null
          manager_id: string | null
          phone: string | null
          recruiting_slug: string | null
          team_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          can_invite_agents?: boolean
          can_invite_leaders?: boolean
          can_manage_resources?: boolean
          can_receive_applicants?: boolean
          can_schedule_licensed?: boolean
          created_at?: string
          organization_path?: string | null
          parent_user_id?: string | null
          status?: string
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          last_name?: string | null
          licensed_calendly_updated_at?: string | null
          licensed_calendly_url?: string | null
          manager_id?: string | null
          phone?: string | null
          recruiting_slug?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          can_invite_agents?: boolean
          can_invite_leaders?: boolean
          can_manage_resources?: boolean
          can_receive_applicants?: boolean
          can_schedule_licensed?: boolean
          created_at?: string
          organization_path?: string | null
          parent_user_id?: string | null
          status?: string
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          licensed_calendly_updated_at?: string | null
          licensed_calendly_url?: string | null
          manager_id?: string | null
          phone?: string | null
          recruiting_slug?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_links: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          position: number
          sub: string | null
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          position?: number
          sub?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          position?: number
          sub?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      recordings: {
        Row: {
          audio: boolean
          created_at: string
          description: string | null
          duration: string | null
          id: string
          is_published: boolean
          position: number
          presenter_id: string
          recorded_on: string | null
          title: string
          topic: string | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          audio?: boolean
          created_at?: string
          description?: string | null
          duration?: string | null
          id?: string
          is_published?: boolean
          position?: number
          presenter_id: string
          recorded_on?: string | null
          title: string
          topic?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          audio?: boolean
          created_at?: string
          description?: string | null
          duration?: string | null
          id?: string
          is_published?: boolean
          position?: number
          presenter_id?: string
          recorded_on?: string | null
          title?: string
          topic?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recordings_presenter_id_fkey"
            columns: ["presenter_id"]
            isOneToOne: false
            referencedRelation: "presenters"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          body: string | null
          category: string
          created_at: string
          created_by: string | null
          cta: string | null
          description: string | null
          display_date: string | null
          id: string
          is_published: boolean
          kind: string
          long: string | null
          meta: string | null
          position: number
          tags: string[]
          title: string
          type: string
          updated_at: string
          url: string | null
        }
        Insert: {
          body?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          cta?: string | null
          description?: string | null
          display_date?: string | null
          id?: string
          is_published?: boolean
          kind?: string
          long?: string | null
          meta?: string | null
          position?: number
          tags?: string[]
          title: string
          type?: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          body?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          cta?: string | null
          description?: string | null
          display_date?: string | null
          id?: string
          is_published?: boolean
          kind?: string
          long?: string | null
          meta?: string | null
          position?: number
          tags?: string[]
          title?: string
          type?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          applicant_id: string | null
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          due_at: string | null
          id: string
          notes: string | null
          priority: string
          title: string
          updated_at: string
        }
        Insert: {
          applicant_id?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          id?: string
          notes?: string | null
          priority?: string
          title: string
          updated_at?: string
        }
        Update: {
          applicant_id?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          id?: string
          notes?: string | null
          priority?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "applicants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_recruiter_by_slug: {
        Args: { _slug: string }
        Returns: {
          avatar_url: string
          full_name: string
          id: string
          recruiting_slug: string
          team_name: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      mark_applicant_scheduled: { Args: { _email: string }; Returns: Json }
      mark_licensed_fallback: { Args: { _token: string }; Returns: Json }
      mark_scheduled_by_token: { Args: { _token: string }; Returns: Json }
      resolve_scheduling_context: { Args: { _token: string }; Returns: Json }
      search_recruiters: {
        Args: { _q: string }
        Returns: {
          avatar_url: string
          full_name: string
          id: string
          recruiting_slug: string
          team_name: string
        }[]
      }
      submit_application: { Args: { payload: Json }; Returns: Json }
      submit_evaluation: { Args: { payload: Json }; Returns: Json }
    }
    Enums: {
      app_role: "agent" | "leader" | "manager" | "admin" | "super_admin"
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
      app_role: ["agent", "manager", "admin", "super_admin"],
    },
  },
} as const
