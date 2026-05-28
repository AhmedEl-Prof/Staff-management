// Placeholder for the Supabase-generated database types.
//
// Once the database schema (Phase 1) is applied, regenerate this file with:
//   npx supabase gen types typescript --project-id <id> > src/types/database.ts
//
// Until then we expose a permissive shape so the typed Supabase clients
// compile without a real schema.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
