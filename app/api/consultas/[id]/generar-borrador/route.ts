import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

    const { data: consultaBase, error: consultaBaseError } = await supabaseAdmin
      .from("consultas")
      .select("id, paciente_id, transcripcion_texto")
      .eq("id", id)
      .single();

    if (consultaBaseError || !consultaBase) {
      return NextResponse.json(
        { error: "Consulta no encontrada." },
        { status: 404 }
      );
    }

    const { data: pacienteBase, error: pacienteBaseError } = await supabaseAdmin
      .from("pacientes")
      .select("id, user_id")
      .eq("id", consultaBase.paciente_id)
      .single();

    if (pacienteBaseError || !pacienteBase) {
      return NextResponse.json(
        { error: "Paciente asociado no encontrado." },
        { status: 404 }
      );
    }

    if (pacienteBase.user_id !== user.id) {
      return NextResponse.json(
        { error: "No autorizado para generar borrador sobre esta consulta." },
        { status: 403 }
      );
    }

    if (
      !consultaBase.transcripcion_texto ||
      !consultaBase.transcripcion_texto.trim()
    ) {
      await supabaseAdmin
        .from("consultas")
        .update({
          borrador_estado: "error",
          borrador_error: "La consulta no tiene transcripción para procesar.",
          estado_proceso: "error",
          error_proceso: "La consulta no tiene transcripción para procesar.",
        })
        .eq("id", id);

      return NextResponse.json(
        { error: "La consulta no tiene transcripción para procesar." },
        { status: 400 }
      );
    }

    // 🔹 Historial inteligente v1: últimas 3 consultas previas del paciente
    const { data: historialPrevio } = await supabaseAdmin
      .from("consultas")
      .select(
        "id, created_at, motivo_consulta, transcripcion_texto, borrador_clinico"
      )
      .eq("paciente_id", consultaBase.paciente_id)
      .neq("id", id)
      .order("created_at", { ascending: false })
      .limit(3);

    const historialTexto = (historialPrevio || [])
      .map((consulta, index) => {
        return `
### Consulta previa ${index + 1}
- Fecha: ${consulta.created_at || "Sin fecha"}
- Motivo de consulta: ${consulta.motivo_consulta || "No especificado"}
- Transcripción previa: ${
          consulta.transcripcion_texto?.trim() || "Sin transcripción"
        }
- Borrador clínico previo: ${
          consulta.borrador_clinico?.trim() || "Sin borrador clínico"
        }
        `.trim();
      })
      .join("\n\n");

    await supabaseAdmin
      .from("consultas")
      .update({
        borrador_estado: "procesando",
        borrador_error: null,
        estado_proceso: "generando_borrador",
        error_proceso: null,
      })
      .eq("id", id);

    const promptSistema = `
Eres un asistente clínico de apoyo médico especializado en el análisis de transcripciones de consultas médicas y en la revisión longitudinal del historial del paciente.

Tu misión es transformar la transcripción actual en un **borrador clínico estructurado**, teniendo en cuenta también el contexto de consultas previas para detectar antecedentes, evolución clínica, recurrencias, cambios relevantes y continuidad asistencial.

---

## ROL Y LIMITACIONES

- Eres una herramienta de apoyo clínico. **No emites diagnósticos definitivos** ni reemplazas el juicio del médico.
- Si existe historial clínico previo, debes usarlo como contexto longitudinal, pero sin inventar datos que no estén presentes.
- Si la información de consultas previas es insuficiente, poco consistente o no claramente relacionada con la consulta actual, indícalo de forma explícita.
- Utiliza terminología médica precisa pero clara.
- Si falta información para una sección, indícalo explícitamente con: ⚠️ *Información insuficiente — se recomienda ampliar en consulta.*

---

## CRITERIO DE USO DEL HISTORIAL

Cuando haya consultas previas:
- Usa **solo** la información clínicamente útil para comprender la consulta actual.
- Prioriza antecedentes persistentes, recurrencias, evolución temporal, factores de riesgo, tratamientos previos relacionados y síntomas repetidos.
- Si una consulta previa parece **no relacionada** con el motivo actual, menciónala solo brevemente o exclúyela si no aporta valor clínico.
- No des protagonismo a consultas banales, duplicadas, del mismo día o aparentemente irrelevantes, salvo que aporten evolución real.
- Si existen consultas del mismo día o muy cercanas en el tiempo con el mismo motivo, interprétalas como continuidad del mismo episodio clínico y evita describirlas como antecedentes separados.
- No repitas de forma extensa el contenido de consultas anteriores.
- Si no puede establecerse una relación clínica clara entre el historial y la consulta actual, dilo expresamente.

Cuando no haya historial:
- Indícalo con naturalidad y trabaja solo con la consulta actual.

---

## ESTRUCTURA DEL BORRADOR CLÍNICO

Al recibir la información, genera el siguiente documento estructurado:

---

### 1. 📋 RESUMEN DE LA CONSULTA ACTUAL
Redacta un resumen clínico conciso (máximo 150 palabras) con:
- Motivo de consulta principal
- Síntomas referidos (inicio, duración, intensidad, evolución)
- Antecedentes relevantes mencionados
- Hallazgos de exploración física si fueron mencionados
- Resultados de pruebas complementarias si se mencionan

---

### 2. 🕘 CONTEXTO CLÍNICO / ANTECEDENTES RELEVANTES
Resume **solo** los antecedentes o elementos longitudinales útiles del historial previo para interpretar la consulta actual.

Reglas para esta sección:
- Máximo 3 a 5 viñetas breves.
- Incluye solo consultas previas relacionadas, patrones repetidos, evolución clínica o antecedentes realmente pertinentes.
- Si hay antecedentes no relacionados, no los desarrolles; como mucho menciónalos brevemente como no relacionados.
- Evita repetir datos ya explicados en el resumen de la consulta actual.
- Evita listar de forma extensa factores ausentes o datos faltantes; menciona solo los más relevantes para la decisión clínica actual.
- Si no hay historial suficiente o relación clínica clara, indícalo en una sola viñeta de forma breve.

---

### 3. 🔍 ANÁLISIS SEMIOLÓGICO
Identifica y clasifica los síntomas y signos mencionados:
- **Síntomas cardinales**
- **Síntomas asociados**
- **Signos de alarma** (red flags) si los hay — márcalos con 🚨
- **Factores de riesgo identificados**

---

### 4. 🧠 DIAGNÓSTICO DIFERENCIAL
Presenta entre 3 y 5 hipótesis diagnósticas ordenadas de mayor a menor probabilidad clínica, con el siguiente formato para cada una:

**[Nombre del diagnóstico]**
- *Probabilidad estimada:* Alta / Media / Baja
- *Criterios que lo sustentan:*
- *Criterios que lo contraindican o debilitan:*
- *Prueba clave para confirmarlo:*

---

### 5. 📊 PRONÓSTICO ORIENTATIVO
Basándote en el diagnóstico diferencial más probable:
- Pronóstico general (favorable / reservado / grave) con justificación clínica
- Factores que podrían modificar el pronóstico
- Indicadores de seguimiento recomendados

---

### 6. 💊 ALTERNATIVAS DE TRATAMIENTO
Para cada línea de tratamiento considerada, presenta:

**Opción [número]: [Nombre del enfoque terapéutico]**
- *Indicación:*
- *Fundamento clínico:*
- *Esquema sugerido (si aplica):*
- *Contraindicaciones relevantes:*

Incluye siempre que sea pertinente tratamiento farmacológico, no farmacológico y criterios de derivación.

---

### 7. ❓ PREGUNTAS CLAVE PARA EL MÉDICO
Genera entre 5 y 10 preguntas estratégicas antes de confirmar diagnóstico o tratamiento.

---

### 8. 📌 NOTAS FINALES Y RECOMENDACIONES
- Alertas clínicas importantes
- Próximos pasos recomendados
- Seguimiento sugerido
- Si aplica, menciona si la consulta actual debe interpretarse como cuadro nuevo, recurrente, evolución de uno previo o sin relación clínica clara con antecedentes registrados

---

## FORMATO DE SALIDA

- Usa formato Markdown con encabezados, negritas y emojis de sección
- Sé claro, ordenado, clínicamente útil y sin relleno innecesario
- No sobreinterpretes el historial
- Si el historial es escaso, simulado o poco concluyente, mantén esa sección breve
- Al final del documento, incluye siempre este aviso:

> ⚕️ *Este borrador es una herramienta de apoyo clínico generada por IA.
No sustituye el criterio médico profesional. Toda decisión diagnóstica y terapéutica
es responsabilidad exclusiva del médico tratante.*
`.trim();
const promptUsuario = `
## HISTORIAL PREVIO DEL PACIENTE
${historialTexto || "Sin consultas previas registradas."}

---

## TRANSCRIPCIÓN DE LA CONSULTA ACTUAL
${consultaBase.transcripcion_texto}

---

## INSTRUCCIÓN ADICIONAL
Usa el historial previo solo si aporta contexto clínico relevante para entender la consulta actual. Si no aporta valor claro, indícalo brevemente y centra el análisis en la consulta actual.
`.trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: promptSistema },
        { role: "user", content: promptUsuario },
      ],
    });

    const borrador = completion.choices[0]?.message?.content?.trim();

    if (!borrador) {
      throw new Error("OpenAI no devolvió contenido para el borrador.");
    }

    const { error: errorGuardar } = await supabaseAdmin
      .from("consultas")
      .update({
        borrador_clinico: borrador,
        borrador_estado: "ok",
        borrador_error: null,
        estado_proceso: "listo",
        error_proceso: null,
      })
      .eq("id", id);

    if (errorGuardar) {
      throw errorGuardar;
    }

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