"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUserProfile, type UserProfile } from "@/lib/get-user-profile";
import AppHeader from "@/components/AppHeader";

type Paciente = {
  id: string;
  nombre: string;
  apellido: string;
};

function NuevaConsultaPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

const prefillBusqueda = searchParams.get("prefillBusqueda") || "";
const pacienteCreadoId = searchParams.get("pacienteCreadoId");
const pacienteIdParam = searchParams.get("pacienteId");

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [motivoConsulta, setMotivoConsulta] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [paciente, setPaciente] = useState<Paciente | null>(null);

  const [mostrarBuscadorPacientes, setMostrarBuscadorPacientes] =
    useState(false);
  const [textoBusquedaPaciente, setTextoBusquedaPaciente] =
    useState(prefillBusqueda);
  const [resultadosBusquedaPacientes, setResultadosBusquedaPacientes] =
    useState<Paciente[]>([]);
  const [buscandoPacientes, setBuscandoPacientes] = useState(false);

  const [tipoMensaje, setTipoMensaje] = useState<"ok" | "error" | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [grabando, setGrabando] = useState(false);
  const [mediaRecorderSoportado, setMediaRecorderSoportado] = useState(true);
  const [nivelAudio, setNivelAudio] = useState(0);
  const [segundosGrabacion, setSegundosGrabacion] = useState(0);

  const pacienteAsignado = !!paciente;

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  function formatearTiempo(segundosTotales: number) {
    const minutos = Math.floor(segundosTotales / 60)
      .toString()
      .padStart(2, "0");

    const segundos = (segundosTotales % 60).toString().padStart(2, "0");

    return `${minutos}:${segundos}`;
  }
  

  function obtenerMimeTypeGrabacion() {
    if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
      return "";
    }

    const candidatos = [
      "audio/mp4;codecs=mp4a.40.2",
      "audio/mp4",
      "audio/webm;codecs=opus",
      "audio/webm",
    ];

    for (const tipo of candidatos) {
      if (MediaRecorder.isTypeSupported(tipo)) {
        return tipo;
      }
    }

    return "";
  }

  function obtenerExtensionDesdeMimeType(mimeType: string) {
    if (mimeType.includes("mp4")) return "mp4";
    if (mimeType.includes("mpeg")) return "mp3";
    if (mimeType.includes("wav")) return "wav";
    if (mimeType.includes("ogg")) return "ogg";
    return "webm";
  }

  useEffect(() => {
    async function cargarPerfil() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setTipoMensaje("error");
        setMensaje("No se pudo obtener el usuario autenticado.");
        return;
      }

      const profile = await getUserProfile();
      setUserProfile(profile);

      if (profile && profile.activo === false) {
        setTipoMensaje("error");
        setMensaje("Tu usuario está desactivado. Contacta al administrador.");
        await supabase.auth.signOut();
        router.push("/");
      }
    }

    cargarPerfil();
  }, [router]);

  useEffect(() => {
  let ignore = false;

  async function prepararPacienteCreado() {
    // 🔥 1. Si viene pacienteId → selección directa
    if (pacienteIdParam) {
      const { data, error } = await supabase
        .from("pacientes")
        .select("id, nombre, apellido")
        .eq("id", pacienteIdParam)
        .single();

      if (!ignore && !error && data) {
        setPaciente(data as Paciente);
        setMostrarBuscadorPacientes(false);
        return;
      }
    }

    // 🔥 2. Caso paciente recién creado
    if (prefillBusqueda.trim() || pacienteCreadoId) {
      setPaciente(null);
    }

    if (prefillBusqueda.trim()) {
      setTextoBusquedaPaciente(prefillBusqueda);
      setMostrarBuscadorPacientes(true);
    }

    if (!pacienteCreadoId) return;

    const { data, error } = await supabase
      .from("pacientes")
      .select("id, nombre, apellido")
      .eq("id", pacienteCreadoId)
      .single();

    if (!ignore && !error && data) {
      setResultadosBusquedaPacientes([data as Paciente]);
      setMostrarBuscadorPacientes(true);
    }
  }

  prepararPacienteCreado();

  return () => {
    ignore = true;
  };
}, [prefillBusqueda, pacienteCreadoId, pacienteIdParam]);

  useEffect(() => {
    const termino = textoBusquedaPaciente.trim();

    if (!mostrarBuscadorPacientes) return;

    if (pacienteCreadoId) return;

    if (!termino) {
      setResultadosBusquedaPacientes([]);
      return;
    }

    const timeout = setTimeout(() => {
      buscarPacientes(termino);
    }, 250);

    return () => clearTimeout(timeout);
  }, [textoBusquedaPaciente, mostrarBuscadorPacientes, pacienteCreadoId]);

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      detenerAnalisisAudio();
    };
  }, []);

  useEffect(() => {
    if (!audioFile) {
      setAudioPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(audioFile);
    setAudioPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [audioFile]);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      typeof navigator !== "undefined" &&
      !window.MediaRecorder
    ) {
      setMediaRecorderSoportado(false);
    }
  }, []);

  useEffect(() => {
    if (!grabando) return;

    const intervalId = window.setInterval(() => {
      setSegundosGrabacion((prev) => prev + 1);
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [grabando]);

  const barrasVumetro = useMemo(() => {
    return Array.from({ length: 12 }, (_, index) => {
      const umbral = (index + 1) / 12;
      return nivelAudio >= umbral;
    });
  }, [nivelAudio]);

  function detenerAnalisisAudio() {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    setNivelAudio(0);
  }

  function iniciarAnalisisAudio(stream: MediaStream) {
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }).webkitAudioContext;

    if (!AudioContextClass) return;

    const audioContext = new AudioContextClass();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);

    analyser.fftSize = 256;
    source.connect(analyser);

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const medir = () => {
      if (!analyserRef.current) return;

      analyserRef.current.getByteFrequencyData(dataArray);

      let suma = 0;
      for (let i = 0; i < dataArray.length; i += 1) {
        suma += dataArray[i];
      }

      const promedio = suma / dataArray.length;
      const nivelNormalizado = Math.min(promedio / 110, 1);

      setNivelAudio(nivelNormalizado);
      animationFrameRef.current = requestAnimationFrame(medir);
    };

    medir();
  }

  async function buscarPacientes(texto: string) {
    const termino = texto.trim();

    if (!termino) {
      setResultadosBusquedaPacientes([]);
      return;
    }

    setBuscandoPacientes(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setResultadosBusquedaPacientes([]);
      setBuscandoPacientes(false);
      return;
    }

    const { data, error } = await supabase
      .from("pacientes")
      .select("id, nombre, apellido")
      .eq("user_id", user.id)
      .or(`nombre.ilike.%${termino}%,apellido.ilike.%${termino}%`)
      .order("apellido", { ascending: true })
      .order("nombre", { ascending: true });

    if (error) {
      setResultadosBusquedaPacientes([]);
      setBuscandoPacientes(false);
      return;
    }

    setResultadosBusquedaPacientes((data as Paciente[]) || []);
    setBuscandoPacientes(false);
  }

  function handleQuitarAudio() {
    setAudioFile(null);
    setAudioPreviewUrl(null);
    setMensaje("");
    setTipoMensaje(null);

    if (audioInputRef.current) {
      audioInputRef.current.value = "";
    }
  }

  async function handleToggleGrabacion() {
    if (!mediaRecorderSoportado) {
      setTipoMensaje("error");
      setMensaje("Este navegador no soporta grabación de audio.");
      return;
    }

    if (!grabando && audioFile) {
      setTipoMensaje("error");
      setMensaje(
        "Ya hay un audio seleccionado. Quítalo o reemplázalo antes de grabar uno nuevo."
      );
      return;
    }

    if (grabando) {
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      detenerAnalisisAudio();
      setGrabando(false);
      setSegundosGrabacion(0);
      return;
    }

    try {
      setMensaje("");
      setTipoMensaje(null);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      iniciarAnalisisAudio(stream);

      const mimeType = obtenerMimeTypeGrabacion();

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const tipoFinal = mediaRecorder.mimeType || mimeType || "audio/webm";
        const extension = obtenerExtensionDesdeMimeType(tipoFinal);

        const blob = new Blob(chunksRef.current, {
          type: tipoFinal,
        });

        const archivoGrabado = new File(
          [blob],
          `consulta-grabada-${Date.now()}.${extension}`,
          { type: tipoFinal }
        );

        setAudioFile(archivoGrabado);
        chunksRef.current = [];
        detenerAnalisisAudio();
      };

      setSegundosGrabacion(0);
      mediaRecorder.start();
      setGrabando(true);
    } catch (error: any) {
      console.error("Error al acceder al micrófono:", error);
      setTipoMensaje("error");
      setMensaje(
        "No se pudo acceder al micrófono. Revisa los permisos del navegador."
      );
      setGrabando(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!paciente) {
      setTipoMensaje("error");
      setMensaje("Debes seleccionar un paciente antes de guardar la consulta.");
      return;
    }

    setGuardando(true);
    setMensaje("");
    setTipoMensaje(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setTipoMensaje("error");
        setMensaje("No se pudo obtener el usuario autenticado.");
        setGuardando(false);
        return;
      }

      const profile = await getUserProfile();

      if (profile && profile.activo === false) {
        setTipoMensaje("error");
        setMensaje("Tu usuario está desactivado. Contacta al administrador.");
        setGuardando(false);
        await supabase.auth.signOut();
        router.push("/");
        return;
      }

      const { data: pacienteValido, error: pacienteError } = await supabase
        .from("pacientes")
        .select("id")
        .eq("id", paciente.id)
        .eq("user_id", user.id)
        .single();

      if (pacienteError || !pacienteValido) {
        setTipoMensaje("error");
        setMensaje("No tienes permiso para crear consultas sobre este paciente.");
        setGuardando(false);
        return;
      }

      const { data, error } = await supabase
        .from("consultas")
        .insert([
          {
            paciente_id: paciente.id,
            motivo_consulta: motivoConsulta,
          },
        ])
        .select("id")
        .single();

      if (error || !data) {
        console.error(error);
        setTipoMensaje("error");
        setMensaje(
          `Error al guardar la consulta: ${
            error?.message || "No se pudo crear la consulta."
          }`
        );
        setGuardando(false);
        return;
      }

      const consultaId = String(data.id);

      if (audioFile) {
        if (!profile?.id) {
          setTipoMensaje("error");
          setMensaje("No se pudo identificar el usuario actual para guardar el audio.");
          setGuardando(false);
          return;
        }

        const extension =
          audioFile.name.split(".").pop()?.toLowerCase() || "webm";
        const filePath = `${profile.id}/${consultaId}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from("audios-consultas")
          .upload(filePath, audioFile, { upsert: true });

        if (uploadError) {
          console.error(uploadError);
          setTipoMensaje("error");
          setMensaje(
            `La consulta se creó, pero el audio no se pudo subir: ${uploadError.message}`
          );
          setGuardando(false);
          router.replace(`/pacientes/${paciente.id}/consultas/${consultaId}`);
          return;
        }

        const { error: updateError } = await supabase
          .from("consultas")
          .update({
            audio_url: filePath,
            transcripcion_estado: "procesando",
            transcripcion_error: null,
            borrador_estado: null,
            borrador_error: null,
            estado_proceso: "transcribiendo",
            error_proceso: null,
          })
          .eq("id", consultaId);

        if (updateError) {
          console.error(updateError);
          setTipoMensaje("error");
          setMensaje(
            `La consulta se creó y el audio se subió, pero no se pudo guardar la URL: ${updateError.message}`
          );
          setGuardando(false);
          router.replace(`/pacientes/${paciente.id}/consultas/${consultaId}`);
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        void fetch(`/api/consultas/${consultaId}/transcribir`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${session?.access_token || ""}`,
          },
        }).catch((transcribirError) => {
          console.error(
            "Error lanzando transcripción automática:",
            transcribirError
          );
        });
      }

      router.replace(`/pacientes/${paciente.id}/consultas/${consultaId}`);
    } catch (err: any) {
      console.error(err);
      setTipoMensaje("error");
      setMensaje(
        `Error inesperado al guardar la consulta: ${
          err?.message || "Error desconocido."
        }`
      );
      setGuardando(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8">
     <AppHeader
  titulo="Nueva consulta"
  subtitulo="Busca o crea un paciente antes de registrar el audio de la consulta."
  nombreProfesional={userProfile?.nombre_profesional || undefined}
  nombreUsuario={userProfile?.nombre || undefined}
  rol={userProfile?.rol}
  acciones={
    <a
      href="/dashboard"
      className="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 transition"
    >
      Ir a pacientes
    </a>
  }
/>
      <div className="mx-auto max-w-4xl">
        <section className="rounded-2xl bg-white p-6 shadow-sm">
            

          <div className="mb-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-500">Paciente</p>

                {paciente ? (
                  <>
                    <p className="text-lg font-semibold text-gray-950">
                      {paciente.nombre} {paciente.apellido}
                    </p>
                    <p className="mt-1 text-sm text-green-600">
                      Paciente asignado para esta nueva consulta.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-semibold text-red-600">
                      No asignado
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      Primero usa Buscar paciente o Nuevo paciente para continuar.
                    </p>
                  </>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setMostrarBuscadorPacientes((prev) => !prev);

                    if (!mostrarBuscadorPacientes && prefillBusqueda.trim()) {
                      setTextoBusquedaPaciente(prefillBusqueda);
                    }
                  }}
                  className="rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
                >
                  Buscar paciente
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const query = new URLSearchParams();
                    query.set("returnTo", "/nueva-consulta");
                    router.push(`/pacientes/nuevo?${query.toString()}`);
                  }}
                  className="rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800"
                >
                  Nuevo paciente
                </button>
              </div>
            </div>
          </div>

          {mostrarBuscadorPacientes && (
            <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="buscar-paciente-interno"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Buscar paciente por nombre o apellido
                  </label>

                  <input
                    id="buscar-paciente-interno"
                    type="text"
                    value={textoBusquedaPaciente}
                    onChange={(e) =>
                      setTextoBusquedaPaciente(e.target.value)
                    }
                    placeholder="Escribe nombre o apellido..."
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-500"
                  />
                </div>

                {buscandoPacientes ? (
                  <p className="text-sm text-gray-500">Buscando pacientes...</p>
                ) : textoBusquedaPaciente.trim() &&
                  resultadosBusquedaPacientes.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No se encontraron pacientes con esa búsqueda.
                  </p>
                ) : resultadosBusquedaPacientes.length > 0 ? (
                  <div className="space-y-2">
                    {resultadosBusquedaPacientes.map((resultado) => (
                      <button
                        key={resultado.id}
                        type="button"
                        onClick={() => {
                          setPaciente({
                            id: resultado.id,
                            nombre: resultado.nombre,
                            apellido: resultado.apellido,
                          });

                          setMostrarBuscadorPacientes(false);
                        }}
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-left hover:bg-gray-50"
                      >
                        <span className="block font-medium text-gray-900">
                          {resultado.nombre} {resultado.apellido}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Motivo de consulta (obligatorio)
              </label>

              <textarea
                value={motivoConsulta}
                onChange={(e) => setMotivoConsulta(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none"
                rows={5}
                placeholder={
                  pacienteAsignado
                    ? "Ej: Dolor abdominal desde hace 3 días, sin fiebre..."
                    : "Primero debes buscar y asignar un paciente."
                }
                disabled={!pacienteAsignado}
              />
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-800">
                  Audio de consulta (opcional)
                </label>
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <input
                    ref={audioInputRef}
                    id="audioFile"
                    type="file"
                    accept=".mp3,.wav,.m4a,.webm,audio/*"
                    className="hidden"
                    disabled={!pacienteAsignado}
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setAudioFile(file);
                    }}
                  />

                  <label
                    htmlFor="audioFile"
                    onClick={(e) => {
                      if (!pacienteAsignado) e.preventDefault();
                    }}
                    className={`inline-flex items-center rounded-xl px-4 py-2 ${
                      !pacienteAsignado
                        ? "cursor-not-allowed bg-gray-300 text-gray-500"
                        : audioFile
                        ? "cursor-pointer bg-green-600 text-white hover:bg-green-700"
                        : "cursor-pointer bg-black text-white hover:bg-gray-800"
                    }`}
                  >
                    {audioFile ? "Reemplazar audio" : "Subir archivo"}
                  </label>

                  <span className="min-w-[220px] text-center text-sm text-gray-600">
                    {audioFile ? audioFile.name : "Ningún archivo seleccionado"}
                  </span>

                  <button
                    type="button"
                    onClick={handleToggleGrabacion}
                    disabled={!pacienteAsignado || (!grabando && !!audioFile)}
                    className={`inline-flex items-center rounded-xl px-5 py-2 font-semibold ${
                      grabando
                        ? "bg-red-600 text-white hover:bg-red-700"
                        : audioFile
                        ? "cursor-not-allowed bg-gray-200 text-gray-400"
                        : pacienteAsignado
                        ? "bg-red-600 text-white hover:bg-red-700"
                        : "cursor-not-allowed bg-gray-200 text-gray-400"
                    }`}
                  >
                    {grabando ? "DETENER" : "GRABAR"}
                  </button>
                </div>

                <div className="space-y-10">
                  {!audioFile && (
                    <p className="text-sm text-gray-500">
                      Puedes subir un archivo de audio o grabarlo directamente
                      desde la app para usarlo luego en la transcripción.
                    </p>
                  )}

                  {audioFile && !grabando && (
                    <div className="mt-3 flex justify-center">
                      <button
                        type="button"
                        onClick={handleQuitarAudio}
                        className="rounded-lg border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        Quitar audio
                      </button>
                    </div>
                  )}

                  {audioFile && !grabando && (
                    <p className="text-sm text-green-700">
                      Audio listo para procesar. Si quieres cambiarlo, sube otro
                      o graba uno nuevo.
                    </p>
                  )}

                  {grabando && (
                    <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
                        <span className="font-medium">Grabando audio...</span>

                        <span className="rounded-md bg-white/70 px-2 py-0.5 font-mono text-sm text-red-700">
                          {formatearTiempo(segundosGrabacion)}
                        </span>

                        <span className="text-red-600/80">
                          Pulsa “DETENER” para finalizar la grabación.
                        </span>
                      </div>

                      <div className="flex items-end gap-1.5">
                        {barrasVumetro.map((activa, index) => (
                          <span
                            key={index}
                            className={`w-2 rounded-sm transition-all duration-100 ${
                              activa ? "bg-red-600" : "bg-red-200"
                            }`}
                            style={{
                              height: `${12 + index * 2}px`,
                              opacity: activa ? 1 : 0.45,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {audioPreviewUrl && !grabando && (
                  <div className="rounded-xl border border-gray-200 bg-white p-3">
                    <p className="mb-2 text-sm font-medium text-gray-700">
                      Vista previa del audio
                    </p>

                    <audio
                      key={audioPreviewUrl}
                      controls
                      className="w-full"
                      src={audioPreviewUrl}
                    >
                      Tu navegador no puede reproducir este audio.
                    </audio>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!pacienteAsignado || guardando}
                className="rounded-xl bg-blue-600 px-5 py-3 text-white disabled:opacity-60"
              >
                {guardando ? "Guardando..." : "Guardar y generar borrador"}
              </button>
            </div>
          </form>

          {mensaje && (
            <div
              className={`mt-6 rounded-xl px-4 py-3 ${
                tipoMensaje === "ok"
                  ? "border border-green-300 bg-green-50 text-green-800"
                  : "border border-red-300 bg-red-50 text-red-800"
              }`}
            >
              {mensaje}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}