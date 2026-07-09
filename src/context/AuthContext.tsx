/**
 * AuthContext.tsx
 * Contexto global de autenticación para Mercacrédito ERP.
 * Usa Supabase Auth + tabla pública `usuarios` para obtener el perfil con rol.
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// ── Tipos ────────────────────────────────────────────────────────────────────

export type RolNombre =
  | "Administrador"
  | "Gerencia"
  | "Cobrador"
  | "Vendedor"
  | "Auxiliar";

export interface PerfilUsuario {
  id: string;
  nombre_completo: string;
  email: string;
  estado: string;
  rol: RolNombre;
  rol_id: number;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  perfil: PerfilUsuario | null;
  /** true mientras se resuelve la sesión inicial */
  cargando: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

// ── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Helpers ──────────────────────────────────────────────────────────────────

async function cargarPerfil(userId: string): Promise<PerfilUsuario | null> {
  const { data, error } = await supabase
    .from("usuarios")
    .select("id, nombre_completo, email, estado, rol_id, roles ( nombre_rol )")
    .eq("id", userId)
    .single();

  if (error || !data) return null;

  const rolesRaw = data.roles as any;
  const rolNombre: RolNombre =
    (Array.isArray(rolesRaw)
      ? rolesRaw[0]?.nombre_rol
      : rolesRaw?.nombre_rol) ?? "Auxiliar";

  return {
    id: data.id,
    nombre_completo: data.nombre_completo,
    email: data.email,
    estado: data.estado,
    rol: rolNombre,
    rol_id: data.rol_id,
  };
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setCargando(false);
      return;
    }

    let mounted = true;

    // Obtener sesión inicial inmediatamente
    supabase.auth.getSession().then(async ({ data: { session: initSession } }) => {
      if (!mounted) return;
      setSession(initSession);
      setUser(initSession?.user ?? null);
      
      if (initSession?.user) {
        const p = await cargarPerfil(initSession.user.id);
        if (mounted) {
          setPerfil(p);
          setCargando(false);
        }
      } else {
        if (mounted) {
          setCargando(false);
        }
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;
      
      // Solo actuar en SIGN_IN o SIGN_OUT para evitar doble carga en inicialización
      if (event === "INITIAL_SESSION") return; 

      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        const p = await cargarPerfil(newSession.user.id);
        if (mounted) {
          setPerfil(p);
          setCargando(false);
        }
      } else {
        if (mounted) {
          setPerfil(null);
          setCargando(false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setPerfil(null);
  };

  return (
    <AuthContext.Provider
      value={{ session, user, perfil, cargando, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth() debe usarse dentro de <AuthProvider>");
  return ctx;
}
