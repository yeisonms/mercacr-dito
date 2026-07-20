/**
 * usuarioService.ts
 * Gestión de usuarios del ERP: consulta y creación via Supabase Auth + tabla pública.
 *
 * PREREQUISITO en Supabase Dashboard (Settings → Auth → Providers → Email):
 *   • Deshabilitar "Confirm email" para que los empleados puedan entrar de inmediato.
 *
 * RLS requerida en la tabla `usuarios`:
 *   • INSERT: solo usuarios con rol Administrador pueden insertar.
 *   • SELECT: usuarios autenticados pueden leer.
 */
import { supabase, supabaseSecondary } from "@/lib/supabase";
import type { RolNombre } from "@/context/AuthContext";

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface UsuarioRow {
  id: string;
  nombre_completo: string;
  email: string;
  estado: "Activo" | "Inactivo";
  fecha_creacion: string;
  rol: RolNombre;
  rol_id: number;
}

export interface CrearUsuarioInput {
  nombre_completo: string;
  email: string;
  password: string;
  rol_nombre: RolNombre;
}

// ── Queries ──────────────────────────────────────────────────────────────────

/**
 * Lista todos los usuarios del sistema con su rol.
 */
export async function obtenerUsuarios(): Promise<UsuarioRow[]> {
  const { data, error } = await supabase
    .from("usuarios")
    .select(
      "id, nombre_completo, email, estado, fecha_creacion, rol_id, roles ( nombre_rol )"
    )
    .order("fecha_creacion", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((u: any) => {
    const rolesRaw = u.roles as any;
    const rolNombre: RolNombre =
      (Array.isArray(rolesRaw)
        ? rolesRaw[0]?.nombre_rol
        : rolesRaw?.nombre_rol) ?? "Auxiliar";

    return {
      id: u.id,
      nombre_completo: u.nombre_completo,
      email: u.email,
      estado: u.estado,
      fecha_creacion: u.fecha_creacion,
      rol: rolNombre,
      rol_id: u.rol_id,
    };
  });
}

/**
 * Obtiene el ID numérico del rol por su nombre desde la tabla `roles`.
 */
async function obtenerRolId(rolNombre: RolNombre): Promise<number> {
  const { data, error } = await supabase
    .from("roles")
    .select("id")
    .eq("nombre_rol", rolNombre)
    .single();

  if (error || !data) throw new Error(`Rol '${rolNombre}' no encontrado en la base de datos.`);
  return data.id;
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Crea un nuevo empleado en Supabase Auth y lo registra en la tabla `usuarios`.
 *
 * Flujo:
 * 1. signUp → crea auth.user (sin confirmación de email si está deshabilitado)
 * 2. INSERT en public.usuarios con el UUID retornado
 */
export async function crearUsuario(input: CrearUsuarioInput): Promise<void> {
  // Paso 1: Registrar en Supabase Auth
  const { data: authData, error: authError } = await supabaseSecondary.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        nombre_completo: input.nombre_completo,
      },
    },
  });

  if (authError) throw new Error(authError.message);
  if (!authData.user) throw new Error("No se pudo crear el usuario en Auth.");

  // Paso 2: Obtener rol_id
  const rolId = await obtenerRolId(input.rol_nombre);

  // Paso 3: Insertar perfil en tabla pública
  const { error: insertError } = await supabase.from("usuarios").insert({
    id: authData.user.id,
    nombre_completo: input.nombre_completo,
    email: input.email,
    // password_hash es NOT NULL en el schema original (antes de integrar Supabase Auth)
    password_hash: "managed_by_supabase_auth",
    rol_id: rolId,
    estado: "Activo",
  });

  if (insertError) {
    // Si falla el insert del perfil, el usuario quedó huérfano en auth.users.
    // En producción se debería usar una función de base de datos (trigger).
    console.error("[usuarioService] Error al insertar perfil, usuario auth creado sin perfil:", insertError);
    throw new Error(`Error al guardar el perfil: ${insertError.message}`);
  }
}

/**
 * Activa o desactiva un usuario en la tabla pública.
 */
export async function actualizarEstadoUsuario(
  id: string,
  estado: "Activo" | "Inactivo"
): Promise<void> {
  const { error } = await supabase
    .from("usuarios")
    .update({ estado })
    .eq("id", id);

  if (error) throw error;
}
