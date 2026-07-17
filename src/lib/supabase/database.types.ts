/**
 * Generated-style Supabase `Database` type for this project's schema
 * (Task 10 — see `supabase/migrations/` and `supabase/README.md`).
 *
 * Hand-written to match the SQL migrations exactly, rather than run
 * `supabase gen types typescript` (which needs a live, linked Supabase
 * project this sandbox doesn't have). Once a real project is linked, this
 * file can be regenerated with:
 *
 *   npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts
 *
 * and should stay a drop-in replacement — every table/column name and type
 * here was written to match the migrations in `supabase/migrations/`
 * exactly, so a real generation run should produce an equivalent shape.
 */

export type ThemeId = "navy-gold" | "light" | "navy-emerald" | "charcoal-rosegold";
export type FontSize = "sm" | "md" | "lg";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          guest_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          guest_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          guest_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      calculator_history: {
        Row: {
          id: string;
          user_id: string;
          expression: string;
          result: string;
          label: string;
          occurred_at: string;
          created_at: string;
          /** Task 15 (History Cloud Sync) — the client's `HistoryItem.id`. Null for rows predating that migration. */
          local_id: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          expression: string;
          result: string;
          label?: string;
          occurred_at?: string;
          created_at?: string;
          local_id?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          expression?: string;
          result?: string;
          label?: string;
          occurred_at?: string;
          created_at?: string;
          local_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "calculator_history_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_settings: {
        Row: {
          user_id: string;
          theme: ThemeId;
          font_size: FontSize;
          sound_enabled: boolean;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          theme?: ThemeId;
          font_size?: FontSize;
          sound_enabled?: boolean;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          theme?: ThemeId;
          font_size?: FontSize;
          sound_enabled?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      calculator_memory: {
        Row: {
          user_id: string;
          value: string;
          has_value: boolean;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          value?: string;
          has_value?: boolean;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          value?: string;
          has_value?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "calculator_memory_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      favorites: {
        Row: {
          id: string;
          user_id: string;
          kind: "calculation" | "conversion";
          expression: string | null;
          result: string | null;
          conversion_category: "length" | "weight" | "temperature" | "currency" | null;
          from_unit: string | null;
          to_unit: string | null;
          label: string;
          created_at: string;
          /** Task 18 (Favorites Cloud Sync) — the client's `FavoriteItem.id`. Null for rows predating that migration. */
          local_id: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          kind: "calculation" | "conversion";
          expression?: string | null;
          result?: string | null;
          conversion_category?: "length" | "weight" | "temperature" | "currency" | null;
          from_unit?: string | null;
          to_unit?: string | null;
          label?: string;
          created_at?: string;
          local_id?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          kind?: "calculation" | "conversion";
          expression?: string | null;
          result?: string | null;
          conversion_category?: "length" | "weight" | "temperature" | "currency" | null;
          from_unit?: string | null;
          to_unit?: string | null;
          label?: string;
          created_at?: string;
          local_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "favorites_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

export type ProfileRow = Tables<"profiles">;
export type CalculatorHistoryRow = Tables<"calculator_history">;
export type UserSettingsRow = Tables<"user_settings">;
export type CalculatorMemoryRow = Tables<"calculator_memory">;
export type FavoriteRow = Tables<"favorites">;
