import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase-admin";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generarBorradorConsulta(params: {
  consultaId: string;
  userId: string;
}) {
  const { consultaId, userId } = params;

  const { data: consultaBase, error: consultaBaseError } = await supabaseAdmin
    .from("consultas")
    .select("id, paciente_id, transcripcion_texto")
    .eq("id", consultaId)
    .single();

  if (consultaBaseError || !consultaBase) {
    throw new Error("Consulta no encontrada.");
  }

  const { data: pacienteBase, error: pacienteBaseError } = await supabaseAdmin
    .from("pacientes")
    .select("id, user_id")
    .eq("id", consultaBase.paciente_id)
    .single();

  if (pacienteBaseError || !pacienteBase) {
    throw new Error("Paciente asociado no encontrado.");
  }

  if (pacienteBase.user_id !== userId) {
    throw new Error("No autorizado para generar borrador sobre esta consulta.");
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
      .eq("id", consultaId);

    throw new Error("La consulta no tiene transcripción para procesar.");
  }

  const { data: historialPrevio } = await supabaseAdmin
    .from("consultas")
    .select(
      "id, created_at, motivo_consulta, transcripcion_texto, borrador_clinico"
    )
    .eq("paciente_id", consultaBase.paciente_id)
    .neq("id", consultaId)
    .order("created_at", { ascending: false })
    .limit(3);

  const historialTexto = (historialPrevio || [])
    .map((consulta, index) => {
      return `
Consulta previa ${index + 1}
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
    .eq("id", consultaId);

  const promptSistema = `
Eres un asistente de documentación clínica para apoyo al médico.

Tu tarea es convertir una transcripción de consulta en un borrador clínico breve, claro, útil y profesional, listo para revisión y edición por parte del médico.

REGLAS GENERALES:
- No inventes datos.
- No afirmes exploración física, antecedentes, medicación, pruebas o diagnósticos si no aparecen en la transcripción o no pueden inferirse con prudencia clínica.
- Si falta información, indícalo con una frase breve como:
  "Información insuficiente en la transcripción."
- No escribas texto excesivo ni repitas ideas.
- No uses emojis.
- No escribas introducciones largas ni explicaciones sobre lo que vas a hacer.
- Usa español clínico claro y natural.
- El resultado debe parecer un borrador médico real, no una respuesta de chatbot.

USO DEL HISTORIAL PREVIO:
- Usa el historial solo si aporta contexto clínico relevante para la consulta actual.
- Si hay consultas previas claramente no relacionadas, no las desarrolles.
- Si hay patrones repetidos o evolución del mismo cuadro, resúmelo de forma breve y útil.
- Si el historial no aporta valor claro, dilo en una sola línea y céntrate en la consulta actual.

ESTILO:
- Sé concreto.
- Prioriza utilidad clínica.
- Evita listas interminables.
- Evita diagnóstico diferencial muy amplio o especulativo.
- Si procede, menciona diagnóstico orientativo o hipótesis principales, pero sin sobreafirmar.

FORMATO OBLIGATORIO DE SALIDA:
Debes devolver SIEMPRE el texto exactamente con estas secciones, en este orden, usando encabezados Markdown con ###:

### Resumen de la consulta
Redacta un resumen breve y clínico de lo referido en la consulta actual.

### Antecedentes o contexto relevante
Incluye solo antecedentes o contexto longitudinal clínicamente útiles para entender esta consulta. Si no hay información útil, indícalo brevemente.

### Evaluación clínica
Organiza aquí, de forma sobria y útil:
- síntomas principales
- evolución temporal si se menciona
- signos de alarma si aparecen
- factores de riesgo si aparecen
- hallazgos o datos clínicos mencionados
No inventes exploración física.

### Impresión diagnóstica orientativa
Incluye 1 a 3 hipótesis o interpretaciones clínicas razonables, ordenadas por probabilidad o relevancia.
Para cada una, explica brevemente por qué se considera.
Si no hay base suficiente, indícalo expresamente.

### Plan y recomendaciones
Incluye próximos pasos razonables según lo mencionado en la consulta:
- seguimiento
- ampliación anamnéstica
- pruebas
- tratamiento mencionado o posible enfoque
- derivación, si realmente está sugerida por el caso
No inventes prescripciones exactas si no hay base.

### Preguntas o datos a completar
Incluye entre 3 y 6 puntos breves con información que el médico debería confirmar, ampliar o verificar antes de cerrar la consulta.

### Aviso
Escribe exactamente este texto:

Este borrador ha sido generado como apoyo documental a partir de la transcripción de la consulta. Debe ser revisado, corregido y validado por el profesional responsable antes de su uso clínico definitivo.
  `.trim();

  const promptUsuario = `
HISTORIAL PREVIO DEL PACIENTE
${historialTexto || "Sin consultas previas registradas."}

TRANSCRIPCIÓN DE LA CONSULTA ACTUAL
${consultaBase.transcripcion_texto}

INSTRUCCIÓN FINAL
Redacta un borrador clínico útil para práctica real. Prioriza claridad, brevedad y utilidad médica. No sobreanalices ni rellenes con contenido genérico.
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
    .eq("id", consultaId);

  if (errorGuardar) {
    throw errorGuardar;
  }

  return borrador;
}