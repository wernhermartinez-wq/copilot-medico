import { supabase } from "@/lib/supabase";

export type UserProfile = {
  id: string;
  email: string;
  nombre: string | null;
  rol: "admin" | "medico";
  activo: boolean;
  nombre_profesional: string | null;
  numero_colegiado: string | null;
  email_profesional: string | null;
  telefono_profesional: string | null;
};

export async function getUserProfile(): Promise<UserProfile | null> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const { data, error } = await supabase
    .from("usuarios")
    .select(
      "id, email, nombre, rol, activo, nombre_profesional, numero_colegiado, email_profesional, telefono_profesional"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) {
    return {
      id: user.id,
      email: user.email ?? "",
      nombre: null,
      rol: "medico",
      activo: true,
      nombre_profesional: null,
      numero_colegiado: null,
      email_profesional: null,
      telefono_profesional: null,
    };
  }

  return {
    id: data.id,
    email: data.email,
    nombre: data.nombre,
    rol: data.rol,
    activo: data.activo,
    nombre_profesional: data.nombre_profesional,
    numero_colegiado: data.numero_colegiado,
    email_profesional: data.email_profesional,
    telefono_profesional: data.telefono_profesional,
  };
}