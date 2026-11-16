// GENERATED — do not edit by hand. Regenerate after every migration: `npm run db:types`.
// Only the public ut_* functions matter here: the app talks to the database through them.

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
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ut_add_comparison: {
        Args: {
          p_item_a_id: string
          p_item_b_id: string
          p_participant_token: string
          p_ranking?: string[]
          p_slug: string
          p_winner_id: string
        }
        Returns: Json
      }
      ut_add_items: {
        Args: { p_host_token: string; p_labels: string[]; p_slug: string }
        Returns: number
      }
      ut_create_list: {
        Args: {
          p_criterion: string
          p_criterion_detail?: string
          p_device_id?: string
          p_host_name?: string
          p_items: string[]
          p_locale?: string
          p_method?: string
          p_title: string
        }
        Returns: Json
      }
      ut_delete_item: {
        Args: { p_host_token: string; p_item_id: string; p_slug: string }
        Returns: undefined
      }
      ut_delete_list: {
        Args: { p_host_token: string; p_slug: string }
        Returns: undefined
      }
      ut_get_list: { Args: { p_slug: string }; Returns: Json }
      ut_get_list_as_host: {
        Args: { p_host_token: string; p_slug: string }
        Returns: Json
      }
      ut_join_list: {
        Args: { p_device_id?: string; p_name: string; p_slug: string }
        Returns: Json
      }
      ut_open_participant: {
        Args: {
          p_device_id?: string
          p_participant_token: string
          p_slug: string
        }
        Returns: Json
      }
      ut_remove_participant: {
        Args: { p_host_token: string; p_participant_id: string; p_slug: string }
        Returns: undefined
      }
      ut_reset_comparisons: {
        Args: { p_participant_token: string; p_slug: string }
        Returns: undefined
      }
      ut_suggest_item: {
        Args: { p_label: string; p_participant_token: string; p_slug: string }
        Returns: string
      }
      ut_undo_comparison: {
        Args: { p_participant_token: string; p_slug: string }
        Returns: undefined
      }
      ut_update_list: {
        Args: {
          p_criterion: string
          p_criterion_detail?: string
          p_host_token: string
          p_slug: string
          p_title: string
        }
        Returns: undefined
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
