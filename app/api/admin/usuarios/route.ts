import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";

type CreateUserBody = {
  nombre: string;
  email: string;
  password: string;
  rol: "admin" | "medico";
  nombre_profesional?: string;
  numero_colegiado?: string;
  email_profesional?: string;
  telefono_profesional?: string;
  sexo?: string;
};

function getSupabaseServerClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  );
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const accessToken = authHeader?.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "").trim()
      : null;

    if (!accessToken) {
      return NextResponse.json(
        { error: "No autorizado: falta token de sesión." },
        { status: 401 }
      );
    }

    const supabaseServer = getSupabaseServerClient(accessToken);

    const {
      data: { user },
      error: userError,
    } = await supabaseServer.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "No autorizado: sesión inválida." },
        { status: 401 }
      );
    }

    const { data: adminProfile, error: profileError } = await supabaseAdmin
      .from("usuarios")
      .select("id, rol")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !adminProfile) {
      return NextResponse.json(
        { error: "No se pudo validar el perfil del usuario." },
        { status: 403 }
      );
    }

    if (adminProfile.rol !== "admin") {
      return NextResponse.json(
        { error: "Acceso denegado: solo un administrador puede listar usuarios." },
        { status: 403 }
      );
    }

    const { data: usuarios, error: usuariosError } = await supabaseAdmin
      .from("usuarios")
      .select(
        "id, nombre, email, rol, activo, nombre_profesional, numero_colegiado, email_profesional, telefono_profesional"
      )
      .order("nombre");

    if (usuariosError) {
      return NextResponse.json(
        { error: usuariosError.message || "No se pudo listar usuarios." },
        { status: 500 }
      );
    }

    return NextResponse.json({ usuarios: usuarios || [] });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error interno del servidor.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const accessToken = authHeader?.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "").trim()
      : null;

    if (!accessToken) {
      return NextResponse.json(
        { error: "No autorizado: falta token de sesión." },
        { status: 401 }
      );
    }

    const supabaseServer = getSupabaseServerClient(accessToken);

    const {
      data: { user },
      error: userError,
    } = await supabaseServer.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "No autorizado: sesión inválida." },
        { status: 401 }
      );
    }

    const { data: adminProfile, error: profileError } = await supabaseAdmin
      .from("usuarios")
      .select("id, rol")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !adminProfile) {
      return NextResponse.json(
        { error: "No se pudo validar el perfil del usuario." },
        { status: 403 }
      );
    }

    if (adminProfile.rol !== "admin") {
      return NextResponse.json(
        { error: "Acceso denegado: solo un administrador puede crear usuarios." },
        { status: 403 }
      );
    }

    const body = (await req.json()) as CreateUserBody;

    const nombre = body.nombre?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password?.trim();
    const rol = body.rol;
    const nombre_profesional = body.nombre_profesional?.trim() || null;
    const numero_colegiado = body.numero_colegiado?.trim() || null;
    const email_profesional = body.email_profesional?.trim() || null;
    const telefono_profesional = body.telefono_profesional?.trim() || null;
    const sexo = body.sexo?.trim() || null;

    if (!nombre) {
      return NextResponse.json(
        { error: "El nombre es obligatorio." },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: "El email es obligatorio." },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres." },
        { status: 400 }
      );
    }

    if (rol !== "admin" && rol !== "medico") {
      return NextResponse.json(
        { error: "Rol inválido." },
        { status: 400 }
      );
    }

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || "No se pudo crear el usuario en Auth." },
        { status: 400 }
      );
    }

    const userId = authData.user.id;

    const { error: insertError } = await supabaseAdmin.from("usuarios").insert({
      id: userId,
      email,
      nombre,
      rol,
      activo: true,
      sexo,
      nombre_profesional,
      numero_colegiado,
      email_profesional,
      telefono_profesional,
    });

    if (insertError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);

      return NextResponse.json(
        { error: insertError.message || "No se pudo crear el perfil del usuario." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: userId,
        email,
        nombre,
        rol,
        activo: true,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error interno del servidor.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}