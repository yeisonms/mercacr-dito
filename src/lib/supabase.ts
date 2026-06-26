import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase centralizado para Mercacrédito.
 *
 * IMPORTANTE: Configura tus credenciales en un archivo `.env` en la raíz del
 * proyecto (copia `.env.example`). Las variables DEBEN empezar con `VITE_`
 * para que Vite las exponga al cliente:
 *
 *   VITE_SUPABASE_URL=https://xxxxx.supabase.co
 *   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
 *
 * Solo se usa la `anon key` pública. La `service_role` NUNCA va en el frontend.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase: SupabaseClient = createClient(
  SUPABASE_URL ?? "http://localhost:54321",
  SUPABASE_ANON_KEY ?? "public-anon-key-placeholder",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);

if (!isSupabaseConfigured && typeof window !== "undefined") {
  // eslint-disable-next-line no-console
  console.warn(
    "[Mercacrédito] Supabase no está configurado. Crea un archivo .env con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.",
  );
}
