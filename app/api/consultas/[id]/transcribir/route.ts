import { NextResponse } from "next/server";
import OpenAI from "openai";
import { toFile } from "openai/uploads";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { generarBorradorConsulta } from "@/lib/generar-borrador-consulta";


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function extraerPathStorage(audioUrl: string) {
  const marker = "/storage/v1/object/public/audios-consultas/";
  const idx = audioUrl.indexOf(marker);

  if (idx === -1) {
    throw new Error("No se pudo extraer el path del audio");
  }

  return audioUrl.slice(idx + marker.length);
}

function obtenerMimeTypeDesdePath(path: string) {
  const extension = path.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "mp3":
      return "audio/mpeg";
    case "wav":
      return "audio/wav";
    case "m4a":
      return "audio/mp4";
    case "webm":
      return "audio/webm";
    case "ogg":
      return "audio/ogg";
    default:
      return "application/octet-stream";
  }
}

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
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  let id = "";

  try {
    console.log("🔥 endpoint transcribir llamado");

    const params = await context.params;
    id = params.id;

    const user = await obtenerUsuarioAutenticado(request);
    const usuarioActivo = await validarUsuarioActivo(user.id);

    if (!usuarioActivo) {
      return NextResponse.json(
        {
          ok: false,
          error: "Usuario inactivo. No autorizado para procesar consultas.",
        },
        { status: 403 }
      );
    }

    const { data: consultaBase, error: consultaBaseError } = await supabaseAdmin
      .from("consultas")
      .select("id, paciente_id, audio_url")
      .eq("id", id)
      .single();

    if (consultaBaseError || !consultaBase) {
      throw new Error("No se encontró la consulta.");
    }

    const { data: pacienteBase, error: pacienteBaseError } = await supabaseAdmin
      .from("pacientes")
      .select("id, user_id")
      .eq("id", consultaBase.paciente_id)
      .single();

    if (pacienteBaseError || !pacienteBase) {
      throw new Error("No se encontró el paciente asociado a la consulta.");
    }

    if (pacienteBase.user_id !== user.id) {
      return NextResponse.json(
        {
          ok: false,
          error: "No autorizado para procesar esta consulta.",
        },
        { status: 403 }
      );
    }

    if (!consultaBase.audio_url) {
      throw new Error("No hay audio");
    }

    const { error: estadoError } = await supabaseAdmin
      .from("consultas")
      .update({
        transcripcion_estado: "procesando",
        transcripcion_error: null,
        estado_proceso: "transcribiendo",
        error_proceso: null,
      })
      .eq("id", id);

    if (estadoError) {
      console.error("ERROR ACTUALIZANDO ESTADO INICIAL:", estadoError);
    }

    const path = consultaBase.audio_url;

    const { data: file, error: downloadError } = await supabaseAdmin.storage
      .from("audios-consultas")
      .download(path);

    if (downloadError || !file) {
      throw new Error("Error descargando audio");
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const nombreArchivo = path.split("/").pop() || "audio.webm";
    const mimeTypeReal = file.type || obtenerMimeTypeDesdePath(path);

    console.log("PATH STORAGE:", path);
    console.log("NOMBRE ARCHIVO:", nombreArchivo);
    console.log("MIME TYPE REAL:", mimeTypeReal);

    const audioFile = await toFile(buffer, nombreArchivo, {
      type: mimeTypeReal,
    });

    const result = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "gpt-4o-transcribe",
    });

    console.log("TRANSCRIPCIÓN:", result.text);

    const texto = result.text || "";

    const { error: updateError } = await supabaseAdmin
      .from("consultas")
      .update({
        transcripcion_texto: texto,
        transcripcion_estado: "ok",
        transcripcion_error: null,
      })
      .eq("id", id);

    if (updateError) {
      console.error("ERROR GUARDANDO EN BD:", updateError);
      throw updateError;
    } else {
      console.log("✅ GUARDADO CORRECTO EN BD");
    }

   let borradorResultado: string | null = null;

try {
  borradorResultado = await generarBorradorConsulta({
    consultaId: id,
    userId: user.id,
  });

  console.log("✅ BORRADOR GENERADO");
} catch (borradorError: any) {
  console.error("ERROR GENERANDO BORRADOR:", borradorError);
  throw borradorError;
}

    return NextResponse.json({
      ok: true,
      texto,
      borrador: borradorResultado,
    });
  } catch (err: any) {
    console.error("❌ ERROR EN TRANSCRIBIR:", err);

    if (id) {
      const { error: estadoFinalError } = await supabaseAdmin
        .from("consultas")
        .update({
          transcripcion_estado: "error",
          transcripcion_error: err?.message || "Error desconocido",
          estado_proceso: "error",
          error_proceso: err?.message || "Error desconocido",
        })
        .eq("id", id);

      if (estadoFinalError) {
        console.error(
          "ERROR ACTUALIZANDO transcripcion_estado=error:",
          estadoFinalError
        );
      }
    }

    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Error desconocido",
      },
      { status: 500 }
    );
  }
}