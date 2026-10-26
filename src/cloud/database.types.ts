// Generated from the local Supabase schema. Regenerate after SQL changes.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      account_deletion_jobs: {
        Row: {
          cleanup_token: string;
          completed_at: string | null;
          last_error: string | null;
          owner_id: string;
          requested_at: string;
          status: string;
        };
        ComputedFields: never;
        Insert: {
          cleanup_token: string;
          completed_at?: string | null;
          last_error?: string | null;
          owner_id: string;
          requested_at?: string;
          status?: string;
        };
        Update: {
          cleanup_token?: string;
          completed_at?: string | null;
          last_error?: string | null;
          owner_id?: string;
          requested_at?: string;
          status?: string;
        };
        Relationships: [];
      };
      card_progress: {
        Row: {
          baseline: NonNullable<Json>;
          id: string;
          kind: string;
          manual_progress: Json | null;
          owner_id: string;
        };
        ComputedFields: never;
        Insert: {
          baseline?: NonNullable<Json>;
          id: string;
          kind?: string;
          manual_progress?: Json | null;
          owner_id: string;
        };
        Update: {
          baseline?: NonNullable<Json>;
          id?: string;
          kind?: string;
          manual_progress?: Json | null;
          owner_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "card_progress_owner_id_kind_id_fkey";
            columns: ["owner_id", "kind", "id"];
            isOneToOne: false;
            referencedRelation: "sync_record_data";
            referencedColumns: ["owner_id", "kind", "record_id"];
          },
          {
            foreignKeyName: "card_progress_owner_id_kind_id_fkey";
            columns: ["owner_id", "kind", "id"];
            isOneToOne: false;
            referencedRelation: "sync_records";
            referencedColumns: ["owner_id", "kind", "record_id"];
          },
        ];
      };
      catalog_keys: {
        Row: {
          id: string;
          kind: string;
          language: string;
        };
        ComputedFields: never;
        Insert: {
          id: string;
          kind: string;
          language?: string;
        };
        Update: {
          id?: string;
          kind?: string;
          language?: string;
        };
        Relationships: [];
      };
      image_cleanup_locks: {
        Row: {
          owner_id: string;
          started_at: string;
          token: string;
        };
        ComputedFields: never;
        Insert: {
          owner_id: string;
          started_at?: string;
          token?: string;
        };
        Update: {
          owner_id?: string;
          started_at?: string;
          token?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar: string;
          display_name: string;
          id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          avatar?: string;
          display_name?: string;
          id: string;
          updated_at?: string;
        };
        Update: {
          avatar?: string;
          display_name?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sync_receipts: {
        Row: {
          created_at: string;
          keys: NonNullable<Json>;
          operation_id: string;
          owner_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          keys: NonNullable<Json>;
          operation_id: string;
          owner_id: string;
        };
        Update: {
          created_at?: string;
          keys?: NonNullable<Json>;
          operation_id?: string;
          owner_id?: string;
        };
        Relationships: [];
      };
      sync_record_data: {
        Row: {
          data: Json | null;
          deleted: boolean;
          kind: string;
          owner_id: string;
          record_id: string;
          revision: number;
        };
        ComputedFields: never;
        Insert: {
          data?: Json | null;
          deleted?: boolean;
          kind: string;
          owner_id: string;
          record_id: string;
          revision?: number;
        };
        Update: {
          data?: Json | null;
          deleted?: boolean;
          kind?: string;
          owner_id?: string;
          record_id?: string;
          revision?: number;
        };
        Relationships: [];
      };
      sync_staging: {
        Row: {
          changes: NonNullable<Json>;
          created_at: string;
          operation_id: string;
          owner_id: string;
          part_no: number;
          total_parts: number;
        };
        ComputedFields: never;
        Insert: {
          changes: NonNullable<Json>;
          created_at?: string;
          operation_id: string;
          owner_id: string;
          part_no: number;
          total_parts: number;
        };
        Update: {
          changes?: NonNullable<Json>;
          created_at?: string;
          operation_id?: string;
          owner_id?: string;
          part_no?: number;
          total_parts?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      activity_events: {
        Row: {
          data: Json | null;
          id: string;
          owner_id: string;
        };
        ComputedFields: never;
        Relationships: [];
      };
      cards: {
        Row: {
          content: Json | null;
          id: string;
          owner_id: string;
        };
        ComputedFields: never;
        Relationships: [];
      };
      review_events: {
        Row: {
          data: Json | null;
          id: string;
          owner_id: string;
        };
        ComputedFields: never;
        Relationships: [];
      };
      sync_records: {
        Row: {
          data: Json | null;
          deleted: boolean;
          kind: string;
          owner_id: string;
          record_id: string;
          revision: number;
        };
        ComputedFields: never;
        Relationships: [];
      };
    };
    Functions: {
      account_available: { Args: Record<PropertyKey, never>; Returns: boolean };
      account_deletion_pending: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      apply_sync_batch: {
        Args: { changes: Json; operation_id: string };
        Returns: Json;
      };
      begin_image_cleanup: { Args: { target_owner: string }; Returns: string };
      finish_image_cleanup: {
        Args: { cleanup_token: string; target_owner: string };
        Returns: undefined;
      };
      prune_sync_staging: { Args: Record<PropertyKey, never>; Returns: number };
      request_account_deletion: {
        Args: { target_owner: string };
        Returns: string;
      };
      stage_sync_batch: {
        Args: {
          changes: Json;
          operation_id: string;
          part_no: number;
          total_parts: number;
        };
        Returns: Json;
      };
      validate_sync_value: {
        Args: { kind: string; value: Json };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
