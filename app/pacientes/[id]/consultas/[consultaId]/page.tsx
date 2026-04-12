"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUserProfile, type UserProfile } from "@/lib/get-user-profile";
import AppHeader from "@/components/AppHeader";

type Paciente = {
  id: string;
  nombre: string;
  apellido: string;
};

type Consulta = {
  id: string;
  created_at: string | null;
  motivo_consulta: string;
  borrador_clinico: string | null;
  audio_url: string | null;
  transcripcion_texto: string | null;
  transcripcion_estado: string | null;
  borrador_estado: string | null;
  estado_proceso: string | null;
  error_proceso: string | null;
};

async function resolverAudioUrl(
  supabaseClient: typeof supabase,
  storedAudioValue: string
) {
  if (
    storedAudioValue.startsWith("http://") ||
    storedAudioValue.startsWith("https://")
  ) {
    return storedAudioValue;
  }

  const { data, error } = await supabaseClient.storage
    .from("audios-consultas")
    .createSignedUrl(storedAudioValue, 3600);

  if (error || !data?.signedUrl) {
    throw new Error(
      error?.message || "No se pudo generar la URL firmada del audio."
    );
  }

  return data.signedUrl;
}

export default function ConsultaPage() {
  const params = useParams();
  const router = useRouter();
  const pacienteId = params.id as string;
  const consultaId = params.consultaId as string;

  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [consulta, setConsulta] = useState<Consulta | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState<"ok" | "error" | null>(null);

  const [generando, setGenerando] = useState(false);
  const [borradorEditable, setBorradorEditable] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [guardadoOK, setGuardadoOK] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [subiendoAudio, setSubiendoAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [progresoVisual, setProgresoVisual] = useState(6);

  async function cargarDatos(silencioso = false) {
    if (!silencioso) {
      setLoading(true);
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setTipoMensaje(null);
      setMensaje("");
      setPaciente(null);
      setConsulta(null);
      setUserProfile(null);
      setAudioUrl(null);
      setLoading(false);
      setAuthChecked(true);
      router.replace("/");
      return;
    }

    const profile = await getUserProfile();
    setUserProfile(profile);

    if (profile && profile.activo === false) {
      setTipoMensaje(null);
      setMensaje("");
      setPaciente(null);
      setConsulta(null);
      setAudioUrl(null);
      setLoading(false);
      setAuthChecked(true);
      await supabase.auth.signOut();
      router.replace("/");
      return;
    }

    const { data: pacienteData, error: pacienteError } = await supabase
      .from("pacientes")
      .select("id, nombre, apellido")
      .eq("id", pacienteId)
      .eq("user_id", user.id)
      .single();

    if (pacienteError || !pacienteData) {
      console.error(pacienteError);
      setTipoMensaje("error");
      setMensaje("No se pudo cargar el paciente o no tienes acceso.");
      setPaciente(null);
      setConsulta(null);
      setAudioUrl(null);
      setLoading(false);
      setAuthChecked(true);
      return;
    }

    const { data: consultaData, error: consultaError } = await supabase
      .from("consultas")
      .select(
        "id, created_at, motivo_consulta, borrador_clinico, audio_url, transcripcion_texto, transcripcion_estado, borrador_estado, estado_proceso, error_proceso"
      )
      .eq("id", consultaId)
      .eq("paciente_id", pacienteId)
      .single();

    if (consultaError || !consultaData) {
      console.error(consultaError);
      setTipoMensaje("error");
      setMensaje("No se pudo cargar la consulta seleccionada.");
      setPaciente(pacienteData);
      setConsulta(null);
      setAudioUrl(null);
      setLoading(false);
      setAuthChecked(true);
      return;
    }

    setPaciente(pacienteData);
    setConsulta(consultaData);
    setBorradorEditable(consultaData.borrador_clinico || "");

    if (consultaData.audio_url) {
      try {
        const resolvedAudioUrl = await resolverAudioUrl(
          supabase,
          consultaData.audio_url
        );
        setAudioUrl(resolvedAudioUrl);
      } catch (audioError) {
        console.error(audioError);
        setAudioUrl(null);
      }
    } else {
      setAudioUrl(null);
    }

    setLoading(false);
    setAuthChecked(true);
  }

  useEffect(() => {
    setMensaje("");
    setTipoMensaje(null);
    cargarDatos();
  }, [pacienteId, consultaId]);

  useEffect(() => {
    if (!consulta) return;

    const procesando =
      consulta.estado_proceso === "transcribiendo" ||
      consulta.estado_proceso === "generando_borrador";

    if (!procesando) return;

    const interval = setInterval(() => {
      cargarDatos(true);
    }, 3000);

    return () => clearInterval(interval);
  }, [consulta]);

  useEffect(() => {
    if (!consulta) return;

    const estado = consulta.estado_proceso || "pendiente";

    if (estado === "pendiente") {
      setProgresoVisual(6);
      return;
    }

    if (estado === "transcribiendo") {
      const interval = window.setInterval(() => {
        setProgresoVisual((prev) => {
          if (prev >= 58) return prev;
          return Math.min(prev + 4, 58);
        });
      }, 450);

      return () => window.clearInterval(interval);
    }

    if (estado === "generando_borrador") {
      const interval = window.setInterval(() => {
        setProgresoVisual((prev) => {
          if (prev < 60) return 60;
          if (prev >= 92) return prev;
          return Math.min(prev + 3, 92);
        });
      }, 400);

      return () => window.clearInterval(interval);
    }

    if (estado === "listo") {
      setProgresoVisual(100);
      return;
    }

    if (estado === "error") {
      setProgresoVisual(100);
    }
  }, [consulta]);

  async function handleGenerarBorrador() {
    if (!consulta) return;

    if (!consulta.transcripcion_texto?.trim()) {
      setTipoMensaje("error");
      setMensaje(
        consulta.estado_proceso === "transcribiendo"
          ? "La transcripción todavía se está procesando. Espera unos segundos."
          : "La consulta no tiene transcripción para procesar."
      );
      return;
    }

    setGenerando(true);
    setMensaje("");
    setTipoMensaje(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(
        `/api/consultas/${consulta.id}/generar-borrador`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${session?.access_token || ""}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(data);
        setTipoMensaje("error");
        setMensaje(data?.error || "No se pudo generar el borrador clínico.");
        return;
      }

      const borradorGenerado = data?.borrador_clinico || "";

      setConsulta({
        ...consulta,
        borrador_clinico: borradorGenerado,
        borrador_estado: "ok",
        estado_proceso: "listo",
        error_proceso: null,
      });

      setBorradorEditable(borradorGenerado);

      setTipoMensaje("ok");
      setMensaje("Borrador clínico generado y guardado correctamente.");
    } catch (error: any) {
      console.error(error);
      setTipoMensaje("error");
      setMensaje(
        error?.message || "Error inesperado al generar el borrador clínico."
      );
    } finally {
      setGenerando(false);
    }
  }

  async function handleGuardarEdicion() {
    if (!consulta) return;

    setMensaje("");
    setTipoMensaje(null);
    setGuardadoOK(false);
    setGuardando(true);

    const { error } = await supabase
      .from("consultas")
      .update({ borrador_clinico: borradorEditable })
      .eq("id", consulta.id);

    if (error) {
      console.error(error);
      setTipoMensaje("error");
      setMensaje(`Error al guardar cambios: ${error.message}`);
      setGuardando(false);
      return;
    }

    setConsulta({
      ...consulta,
      borrador_clinico: borradorEditable,
    });

    setTipoMensaje("ok");
    setMensaje("Borrador clínico guardado correctamente.");
    setGuardadoOK(true);
    setGuardando(false);

    setTimeout(() => {
      setGuardadoOK(false);
    }, 2000);
  }

  async function handleSubirAudio() {
    if (!audioFile || !consulta) return;

    setSubiendoAudio(true);
    setMensaje("");
    setTipoMensaje(null);

    if (!userProfile?.id) {
      setTipoMensaje("error");
      setMensaje("No se pudo identificar el usuario actual para guardar el audio.");
      setSubiendoAudio(false);
      return;
    }

    const extension = audioFile.name.split(".").pop()?.toLowerCase() || "webm";
    const filePath = `${userProfile.id}/${consulta.id}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("audios-consultas")
      .upload(filePath, audioFile, { upsert: true });

    if (uploadError) {
      console.error(uploadError);
      setTipoMensaje("error");
      setMensaje(`Error al subir audio: ${uploadError.message}`);
      setSubiendoAudio(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("consultas")
      .update({
        audio_url: filePath,
        transcripcion_estado: "pendiente",
        borrador_estado: null,
        transcripcion_texto: null,
        borrador_clinico: null,
        estado_proceso: "pendiente",
        error_proceso: null,
      })
      .eq("id", consulta.id);

    if (updateError) {
      console.error(updateError);
      setTipoMensaje("error");
      setMensaje(`Error al guardar la ruta del audio: ${updateError.message}`);
      setSubiendoAudio(false);
      return;
    }

    try {
      const resolvedAudioUrl = await resolverAudioUrl(supabase, filePath);
      setAudioUrl(resolvedAudioUrl);
    } catch (audioError) {
      console.error(audioError);
      setAudioUrl(null);
    }

    setConsulta((prev) =>
      prev
        ? {
            ...prev,
            audio_url: filePath,
            transcripcion_estado: "pendiente",
            borrador_estado: null,
            transcripcion_texto: null,
            borrador_clinico: null,
            estado_proceso: "pendiente",
            error_proceso: null,
          }
        : prev
    );

    setAudioFile(null);
    setTipoMensaje("ok");
    setMensaje("Audio cargado correctamente. Iniciando procesamiento...");
    setSubiendoAudio(false);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    void fetch(`/api/consultas/${consulta.id}/transcribir`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${session?.access_token || ""}`,
      },
    })
      .then(() => cargarDatos(true))
      .catch((error) => {
        console.error("Error lanzando transcripción:", error);
      });
  }

  if (!authChecked) {
    return (
      <main className="min-h-screen bg-[#f8fafc] px-4 py-6 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl rounded-2xl bg-white p-4 sm:p-6 shadow-sm">
          <p className="text-base text-gray-600">Verificando sesión...</p>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f8fafc] px-4 py-6 sm:p-6 lg:p-8">
        <AppHeader
          titulo="Detalle de la consulta"
          subtitulo="Cargando consulta"
          nombreProfesional={userProfile?.nombre_profesional || undefined}
          nombreUsuario={userProfile?.nombre || undefined}
          rol={userProfile?.rol}
          backHref={`/pacientes/${pacienteId}`}
          backLabel="Volver a la ficha"
        />

        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-6 text-center">
            <p className="text-sm text-gray-500">Cargando consulta...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!consulta) {
    return (
      <main className="min-h-screen bg-[#f8fafc] px-4 py-6 sm:p-6 lg:p-8">
        <AppHeader
          titulo="Detalle de la consulta"
          subtitulo="Consulta no encontrada"
          nombreProfesional={userProfile?.nombre_profesional || undefined}
          nombreUsuario={userProfile?.nombre || undefined}
          rol={userProfile?.rol}
          backHref={`/pacientes/${pacienteId}`}
          backLabel="Volver a la ficha"
        />
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl bg-white border border-red-200 shadow-sm p-6 text-center">
            <p className="text-sm text-red-600">No se pudo cargar la consulta seleccionada.</p>
          </div>
        </div>
      </main>
    );
  }

  const transcripcionLista = !!consulta.transcripcion_texto?.trim();
  const estadoProceso = consulta.estado_proceso || "pendiente";
  const transcripcionProcesando = estadoProceso === "transcribiendo";
  const borradorProcesando = estadoProceso === "generando_borrador";
  const procesoListo = estadoProceso === "listo";
  const procesoError = estadoProceso === "error";
  const puedeEditarBorrador = estadoProceso === "listo";
  const ocultarControlesAudio =
    transcripcionProcesando || borradorProcesando;

  let tituloProceso = "Preparando consulta...";
  let descripcionProceso =
    "Estamos iniciando el procesamiento automático de la consulta.";

  if (transcripcionProcesando) {
    tituloProceso = "🎧 Analizando el audio de la consulta";
    descripcionProceso =
      "Estamos convirtiendo el audio en texto clínico. Esta pantalla se actualizará automáticamente.";
  }

  if (borradorProcesando) {
    tituloProceso = "🧠 Generando borrador clínico";
    descripcionProceso =
      "La IA está estructurando la información médica y redactando el borrador clínico.";
  }

  if (procesoListo) {
    tituloProceso = "✅ Borrador clínico listo";
    descripcionProceso =
      "La consulta ya fue procesada y el borrador clínico está disponible para revisión.";
  }

  if (procesoError) {
    tituloProceso = "❌ Error en el procesamiento";
    descripcionProceso =
      consulta.error_proceso ||
      "Ocurrió un error durante el procesamiento automático de la consulta.";
  }

  return (
    <main className="relative isolate min-h-screen bg-[#f8fafc] px-4 py-6 sm:p-6 lg:p-8">
      <AppHeader
        titulo="Detalle de la consulta"
        subtitulo="Transcripción-borrador clínico"
        paciente={`${paciente?.nombre ?? ""} ${paciente?.apellido ?? ""}`.trim()}
        nombreProfesional={userProfile?.nombre_profesional || undefined}
        nombreUsuario={userProfile?.nombre || undefined}
        rol={userProfile?.rol}
        acciones={
          <div className="flex gap-2">
            <Link
              href={`/pacientes/${pacienteId}/consultas/${consultaId}/pdf`}
              className="inline-block rounded-xl bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Generar PDF
            </Link>
            <Link
              href={`/nueva-consulta?pacienteId=${pacienteId}`}
              className="inline-block rounded-xl bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Nueva consulta
            </Link>
          </div>
        }
      />

      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-0 h-[28vh]"
        style={{
          backgroundImage: "url('/premium-medical-soft.png')",
          backgroundSize: "cover",
          backgroundPosition: "center bottom",
          backgroundRepeat: "no-repeat",
        }}
      />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-0 h-[28vh] bg-gradient-to-t from-transparent via-white/25 to-white" />

      <div className="relative z-10 mx-auto max-w-4xl space-y-6">
        <section className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Fecha</p>
              <p className="text-lg font-semibold text-gray-950">
                {consulta.created_at
                  ? new Date(consulta.created_at).toLocaleDateString("es-ES")
                  : "No informada"}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Estado</p>
              <p className="text-lg font-semibold text-blue-600">
                {procesoListo ? "Completado" : transcripcionProcesando ? "Transcribiendo" : borradorProcesando ? "Generando" : procesoError ? "Error" : "Pendiente"}
              </p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-gray-500">
              Motivo de consulta
            </p>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-gray-900">
              {consulta.motivo_consulta}
            </div>
          </div>
        </section>

        {((estadoProceso === "pendiente" && !!consulta.audio_url) ||
          transcripcionProcesando ||
          borradorProcesando ||
          procesoListo ||
          procesoError) && (
          <section
            className={`rounded-2xl border shadow-sm p-4 sm:p-6 transition-all duration-500 ${
              procesoError
                ? "border-red-200 bg-red-50"
                : procesoListo
                ? "border-green-200 bg-green-50"
                : "border-blue-200 bg-blue-50"
            }`}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p
                  className={`text-lg font-semibold ${
                    procesoError
                      ? "text-red-800"
                      : procesoListo
                      ? "text-green-800"
                      : "text-blue-900"
                  }`}
                >
                  {tituloProceso}
                </p>

                <p
                  className={`mt-1 text-sm ${
                    procesoError
                      ? "text-red-700"
                      : procesoListo
                      ? "text-green-700"
                      : "text-blue-800"
                  }`}
                >
                  {descripcionProceso}
                </p>
              </div>

              {!procesoListo && !procesoError && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-blue-600" />
                  <span className="text-sm font-medium text-blue-700">
                    En curso
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="h-3 w-full overflow-hidden rounded-full bg-white/70">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    procesoError
                      ? "bg-red-500"
                      : procesoListo
                      ? "bg-green-500"
                      : "bg-blue-500"
                  }`}
                  style={{ width: `${progresoVisual}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <span
                  className={
                    procesoError
                      ? "text-red-700"
                      : procesoListo
                      ? "text-green-700"
                      : "text-blue-700"
                  }
                >
                  {procesoError
                    ? "Proceso interrumpido"
                    : procesoListo
                    ? "Proceso completado"
                    : "Procesamiento automático"}
                </span>

                <span
                  className={`font-semibold ${
                    procesoError
                      ? "text-red-800"
                      : procesoListo
                      ? "text-green-800"
                      : "text-blue-800"
                  }`}
                >
                  {progresoVisual}%
                </span>
              </div>
            </div>
          </section>
        )}

        <section className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4 sm:p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-800">Borrador clínico</h3>
          {consulta.borrador_clinico ? (
            <div className="space-y-4">
              <textarea
                value={borradorEditable}
                onChange={(e) => setBorradorEditable(e.target.value)}
                rows={18}
                disabled={!puedeEditarBorrador}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none transition focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500 resize-none"
              />

              {!puedeEditarBorrador && (
                <p className="text-sm text-gray-500">
                  El borrador se podrá editar cuando el procesamiento automático haya finalizado.
                </p>
              )}

              <div className="flex justify-end border-t border-gray-100 pt-4">
                <div className="text-right">
                  <button
                    onClick={handleGuardarEdicion}
                    disabled={guardando || !puedeEditarBorrador}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-base font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {guardando ? "Guardando..." : "Guardar cambios"}
                  </button>

                  {guardadoOK && (
                    <p className="mt-2 text-sm font-medium text-green-700">
                      ✔ Cambios guardados correctamente
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
              {transcripcionProcesando ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    La transcripción está en proceso. El borrador clínico se generará automáticamente al finalizar esta etapa.
                  </p>

                  <div className="space-y-2">
                    <div className="h-3 w-full animate-pulse rounded bg-gray-200" />
                    <div className="h-3 w-11/12 animate-pulse rounded bg-gray-200" />
                    <div className="h-3 w-9/12 animate-pulse rounded bg-gray-200" />
                  </div>
                </div>
              ) : borradorProcesando ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    La IA está generando el borrador clínico automáticamente. Esta pantalla se actualizará sola cuando esté listo.
                  </p>

                  <div className="space-y-2">
                    <div className="h-3 w-full animate-pulse rounded bg-gray-200" />
                    <div className="h-3 w-10/12 animate-pulse rounded bg-gray-200" />
                    <div className="h-3 w-8/12 animate-pulse rounded bg-gray-200" />
                    <div className="h-3 w-9/12 animate-pulse rounded bg-gray-200" />
                  </div>
                </div>
              ) : procesoError ? (
                <p className="text-sm text-gray-600">El proceso encontró un error. Revisa el mensaje superior.</p>
              ) : (
                <p className="text-sm text-gray-600">Aquí se mostrará el borrador clínico generado por IA a partir de la consulta.</p>
              )}
            </div>
          )}
        </section>

        {!consulta.borrador_clinico &&
          transcripcionLista &&
          !transcripcionProcesando &&
          !borradorProcesando && (
            <div className="flex justify-end">
              <button
                onClick={handleGenerarBorrador}
                disabled={generando}
                className="rounded-xl bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {generando ? "Generando borrador..." : "Generar borrador"}
              </button>
            </div>
          )}

        {mensaje && (
          <div
            className={`rounded-xl px-4 py-3 text-sm ${
              tipoMensaje === "ok"
                ? "border border-green-300 bg-green-50 text-green-800"
                : "border border-red-300 bg-red-50 text-red-800"
            }`}
          >
            {mensaje}
          </div>
        )}

        {!ocultarControlesAudio && (
          <section className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4 sm:p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-800">Audio de consulta</h3>
            
            <div className="space-y-4">
              <input
                type="file"
                accept=".mp3,.wav,.m4a,.webm,audio/*"
                onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-700"
              />

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleSubirAudio}
                  disabled={!audioFile || subiendoAudio}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {subiendoAudio ? "Subiendo audio..." : "Subir audio"}
                </button>

                {audioUrl && (
                  <a
                    href={audioUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block rounded-xl border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
                  >
                    Abrir audio
                  </a>
                )}
              </div>

              {audioFile && (
                <p className="text-sm text-gray-600">
                  Archivo seleccionado: {audioFile.name}
                </p>
              )}

              {audioUrl && (
                <audio controls className="w-full">
                  <source src={audioUrl} />
                  Tu navegador no soporta reproducción de audio.
                </audio>
              )}
            </div>
          </section>
        )}

        {consulta.transcripcion_texto && (
          <section className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4 sm:p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-800">Transcripción (referencia)</h3>
            <div className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-6 text-gray-700">
              {consulta.transcripcion_texto}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}