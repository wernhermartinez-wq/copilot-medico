import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";

type UpdateUserBody = {
  nombre: string;
  rol: "admin" | "medico";
  activo?: boolean;
  nombre_profesional?: string;
  numero_colegiado?: string;
  email_profesional?: string;
  telefono_profesional?: string;
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

async function validarAdmin(req: Request) {
  const authHeader = req.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.replace("Bearer ", "").trim()
    : null;

  if (!accessToken) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "No autorizado: falta token de sesión." },
        { status: 401 }
      ),
    };
  }

  const supabaseServer = getSupabaseServerClient(accessToken);

  const {
    data: { user },
    error: userError,
  } = await supabaseServer.auth.getUser();

  if (userError || !user) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "No autorizado: sesión inválida." },
        { status: 401 }
      ),
    };
  }

  const { data: adminProfile, error: profileError } = await supabaseAdmin
    .from("usuarios")
    .select("id, rol")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !adminProfile) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "No se pudo validar el perfil del usuario." },
        { status: 403 }
      ),
    };
  }

  if (adminProfile.rol !== "admin") {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Acceso denegado: solo un administrador puede gestionar usuarios." },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true as const,
  };
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const validacion = await validarAdmin(req);
    if (!validacion.ok) return validacion.response;

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "ID de usuario no válido." },
        { status: 400 }
      );
    }

    const body = (await req.json()) as UpdateUserBody;

    const nombre = body.nombre?.trim();
    const rol = body.rol;
    const activo = body.activo;
    const nombre_profesional = body.nombre_profesional?.trim() || null;
    const numero_colegiado = body.numero_colegiado?.trim() || null;
    const email_profesional = body.email_profesional?.trim() || null;
    const telefono_profesional = body.telefono_profesional?.trim() || null;

    if (!nombre) {
      return NextResponse.json(
        { error: "El nombre es obligatorio." },
        { status: 400 }
      );
    }

    if (rol !== "admin" && rol !== "medico") {
      return NextResponse.json(
        { error: "Rol inválido." },
        { status: 400 }
      );
    }

    const payload: Record<string, unknown> = {
      nombre,
      rol,
      nombre_profesional,
      numero_colegiado,
      email_profesional,
      telefono_profesional,
    };

    if (typeof activo === "boolean") {
      payload.activo = activo;
    }

    const { error: updateError } = await supabaseAdmin
      .from("usuarios")
      .update(payload)
      .eq("id", id);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || "No se pudo actualizar el usuario." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      user: {
        id,
        nombre,
        rol,
        activo,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error interno del servidor.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const validacion = await validarAdmin(req);
    if (!validacion.ok) return validacion.response;

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "ID de usuario no válido." },
        { status: 400 }
      );
    }

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
      data: { user: authUser },
      error: userError,
    } = await supabaseServer.auth.getUser();

    if (userError || !authUser) {
      return NextResponse.json(
        { error: "No autorizado: sesión inválida." },
        { status: 401 }
      );
    }

    if (authUser.id === id) {
      return NextResponse.json(
        { error: "No puedes eliminar tu propio usuario." },
        { status: 403 }
      );
    }

    const { count: pacientesCount, error: pacientesError } = await supabaseAdmin
      .from("pacientes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", id);

    if (pacientesError) {
      return NextResponse.json(
        { error: "Error al verificar datos asociados." },
        { status: 500 }
      );
    }

    if (pacientesCount && pacientesCount > 0) {
      return NextResponse.json(
        { error: "No se puede eliminar un usuario con datos clínicos asociados" },
        { status: 409 }
      );
    }

    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(id);

    if (deleteAuthError && !deleteAuthError.message.toLowerCase().includes("user not found")) {
      return NextResponse.json(
        { error: deleteAuthError.message || "No se pudo eliminar el usuario de Auth." },
        { status: 500 }
      );
    }

    const { error: deleteDbError } = await supabaseAdmin
      .from("usuarios")
      .delete()
      .eq("id", id);

    if (deleteDbError) {
      return NextResponse.json(
        { error: deleteDbError.message || "No se pudo eliminar el usuario de la base de datos." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error interno del servidor.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}