import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { generarBorradorConsulta } from "@/lib/generar-borrador-consulta";

const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function obtenerUsuarioAutenticado(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "").trim();

  if (!token) {
    throw new Error("No se recibió token de autenticación.");
  }

  const { data, error } = await supabaseAuth.auth.getUser(token);

  if (error || !data.user) {
    throw new Error("No se pudo validar el usuario autenticado.");
  }

  return data.user;
}

async function validarUsuarioActivo(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("usuarios")
    .select("id, activo")
    .eq("id", userId)
    .single();

  if (error || !data) {
    throw new Error("No se pudo validar el perfil del usuario.");
  }

  if (data.activo === false) {
    return false;
  }

  return true;
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  let id = "";

  try {
    const params = await context.params;
    id = params.id;

    if (!id) {
      return NextResponse.json(
        { error: "Falta el id de la consulta." },
        { status: 400 }
      );
    }

    const user = await obtenerUsuarioAutenticado(req);
    const usuarioActivo = await validarUsuarioActivo(user.id);

    if (!usuarioActivo) {
      return NextResponse.json(
        {
          error: "Usuario inactivo. No autorizado para generar borradores.",
        },
        { status: 403 }
      );
    }

    const borrador = await generarBorradorConsulta({
      consultaId: id,
      userId: user.id,
    });

    return NextResponse.json({
      ok: true,
      borrador_clinico: borrador,
    });
  } catch (error: any) {
    const consultaId =
      id ||
      (() => {
        try {
          const url = new URL(req.url);
          const parts = url.pathname.split("/");
          return parts[parts.length - 2];
        } catch {
          return null;
        }
      })();

    if (consultaId) {
      await supabaseAdmin
        .from("consultas")
        .update({
          borrador_estado: "error",
          borrador_error:
            error?.message || "Error desconocido al generar borrador.",
          estado_proceso: "error",
          error_proceso:
            error?.message || "Error desconocido al generar borrador.",
        })
        .eq("id", consultaId);
    }

    return NextResponse.json(
      {
        error: error?.message || "Error al generar borrador clínico.",
      },
      { status: 500 }
    );
  }
}