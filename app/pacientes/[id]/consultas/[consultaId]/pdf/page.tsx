"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUserProfile, type UserProfile } from "@/lib/get-user-profile";

type Paciente = {
  nombre: string;
  apellido: string;
  fecha_nacimiento: string | null;
  telefono: string | null;
};

type Consulta = {
  created_at: string | null;
  motivo_consulta: string;
  borrador_clinico: string | null;
};

function renderBorradorClinico(texto: string | null) {
  if (!texto || !texto.trim()) {
    return <p className="text-gray-500">Sin borrador clínico.</p>;
  }

  const lineas = texto.split("\n").map((linea) => linea.trim());

  const elementos: ReactNode[] = [];
  let itemsLista: string[] = [];
  let parrafoActual: string[] = [];

  const cerrarLista = () => {
    if (itemsLista.length > 0) {
      elementos.push(
        <ul
          key={`lista-${elementos.length}`}
          className="mb-6 ml-5 list-disc space-y-2.5 rounded-lg border border-gray-100 bg-gray-50 px-5 py-4 text-[15px] leading-7 text-gray-900"
        >
          {itemsLista.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      );
      itemsLista = [];
    }
  };

  const cerrarParrafo = () => {
    if (parrafoActual.length > 0) {
      elementos.push(
        <p
          key={`parrafo-${elementos.length}`}
          className="mb-5 text-[15px] leading-8 text-gray-800"
        >
          {parrafoActual.join(" ")}
        </p>
      );
      parrafoActual = [];
    }
  };

  for (const linea of lineas) {
    if (!linea) {
      cerrarLista();
      cerrarParrafo();
      continue;
    }

    if (linea === "---") {
      cerrarLista();
      cerrarParrafo();
      elementos.push(
        <div key={`sep-${elementos.length}`} className="my-8">
          <div className="h-px bg-gray-200" />
        </div>
      );
      continue;
    }

    if (linea.startsWith("###")) {
      cerrarLista();
      cerrarParrafo();
      elementos.push(
        <div
          key={`titulo-${elementos.length}`}
          className="mb-5 mt-8 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
        >
          <h3 className="text-base font-bold uppercase tracking-wide text-gray-900">
            {linea.replace(/^###\s*/, "")}
          </h3>
        </div>
      );
      continue;
    }

    if (linea.startsWith("- ")) {
      cerrarParrafo();
      itemsLista.push(linea.replace(/^- /, ""));
      continue;
    }

    parrafoActual.push(linea);
  }

  cerrarLista();
  cerrarParrafo();

  return <div>{elementos}</div>;
}

export default function ConsultaPdfPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const consultaId = params.consultaId as string;

  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [consulta, setConsulta] = useState<Consulta | null>(null);
  const [loading, setLoading] = useState(true);
  const [mensajeError, setMensajeError] = useState("");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    async function cargarDatos() {
      setLoading(true);
      setMensajeError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setMensajeError("No se pudo obtener el usuario autenticado.");
        setLoading(false);
        return;
      }

      const profile = await getUserProfile();
      setUserProfile(profile);

      if (profile && profile.activo === false) {
        setMensajeError("Tu usuario está desactivado. Contacta al administrador.");
        setLoading(false);
        await supabase.auth.signOut();
        router.push("/");
        return;
      }

      const { data: pacienteData, error: pacienteError } = await supabase
        .from("pacientes")
        .select("nombre, apellido, fecha_nacimiento, telefono")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (pacienteError || !pacienteData) {
        console.error(pacienteError);
        setMensajeError("No se pudo cargar el paciente o no tienes acceso.");
        setLoading(false);
        return;
      }

      const { data: consultaData, error: consultaError } = await supabase
        .from("consultas")
        .select("created_at, motivo_consulta, borrador_clinico")
        .eq("id", consultaId)
        .eq("paciente_id", id)
        .single();

      if (consultaError || !consultaData) {
        console.error(consultaError);
        setMensajeError("No se pudo cargar la consulta para exportación.");
        setLoading(false);
        return;
      }

      setPaciente(pacienteData);
      setConsulta(consultaData);
      setLoading(false);
    }

    cargarDatos();
  }, [id, consultaId, router]);

  const fechaConsulta = consulta?.created_at
    ? new Date(consulta.created_at).toLocaleDateString("es-ES")
    : "No informada";

  const horaConsulta = consulta?.created_at
    ? new Date(consulta.created_at).toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "No informada";

  const fechaEmision = new Date().toLocaleDateString("es-ES");
  const horaEmision = new Date().toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5f7fa] p-6 text-black md:p-8">
        <div className="mx-auto max-w-4xl rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <p className="text-gray-600">Cargando informe...</p>
        </div>
      </main>
    );
  }

  if (mensajeError || !consulta || !paciente) {
    return (
      <main className="min-h-screen bg-[#f5f7fa] p-6 text-black md:p-8">
        <div className="mx-auto max-w-4xl rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-red-700">
            Consulta no encontrada
          </h1>
          <p className="mt-2">
            {mensajeError || "No se pudo cargar la consulta para exportación."}
          </p>

          <div className="mt-6 print:hidden">
            <Link
              href={`/pacientes/${id}/consultas/${consultaId}`}
              className="inline-block rounded-xl border border-gray-300 px-4 py-2 text-gray-800"
            >
              Volver a consulta
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f7fa] p-4 text-black md:p-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-[900px]">
        <div className="mb-6 flex flex-wrap gap-3 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl bg-black px-4 py-2 text-white"
          >
            Imprimir / Guardar PDF
          </button>

          <Link
            href={`/pacientes/${id}/consultas/${consultaId}`}
            className="inline-block rounded-xl border border-gray-300 px-4 py-2 text-gray-800"
          >
            Volver a consulta
          </Link>

          <Link
            href="/dashboard"
            className="inline-block rounded-xl border border-gray-300 px-4 py-2 text-gray-800"
          >
            Volver al panel de pacientes
          </Link>
        </div>

        <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm print:mx-0 print:max-w-none print:rounded-none print:border-0 print:shadow-none">
          <header className="border-b border-gray-300 px-8 py-8 print:px-6 print:py-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="flex items-start gap-5">
                <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-3">
                  <img
                    src="/logo-nexaro-medix.png"
                    alt="NEXARO MEDIX"
                    className="h-16 w-auto object-contain"
                  />
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gray-500">
                    Informe clínico
                  </p>

                  <h1 className="mt-3 text-2xl font-bold text-gray-900">
                    Resumen de consulta médica
                  </h1>

                  <p className="mt-3 text-sm leading-6 text-gray-600">
                    Documento generado para revisión profesional, seguimiento
                    clínico y archivo del paciente.
                  </p>
                </div>
              </div>

              <div className="min-w-[260px] rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm print:break-inside-avoid">
                <p className="text-sm font-bold uppercase tracking-wide text-gray-800">
                  Emisión del informe
                </p>
                <p className="mt-2 text-gray-700">
                  <span className="font-medium">Fecha:</span> {fechaEmision}
                </p>
                <p className="text-gray-700">
                  <span className="font-medium">Hora:</span> {horaEmision}
                </p>
                <p className="mt-3 border-t border-gray-200 pt-3 text-xs uppercase tracking-wide text-gray-500">
                  NEXARO · MEDIX
                </p>
              </div>
            </div>
          </header>

          <section className="grid gap-6 border-b border-gray-200 px-8 py-6 md:grid-cols-2 print:break-inside-avoid print:px-6 print:py-5">
            <div className="rounded-xl border border-gray-200 p-5 print:break-inside-avoid">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-700">
                Datos del paciente
              </h2>

              <div className="space-y-3 text-sm leading-6">
                <p>
                  <span className="font-semibold text-gray-800">
                    Nombre completo:
                  </span>{" "}
                  {paciente.nombre} {paciente.apellido}
                </p>
                <p>
                  <span className="font-semibold text-gray-800">
                    Fecha de nacimiento:
                  </span>{" "}
                  {paciente.fecha_nacimiento || "No informada"}
                </p>
                <p>
                  <span className="font-semibold text-gray-800">Teléfono:</span>{" "}
                  {paciente.telefono || "No informado"}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 p-5 print:break-inside-avoid">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-700">
                Datos de la consulta
              </h2>

              <div className="space-y-3 text-sm leading-6">
                <p>
                  <span className="font-semibold text-gray-800">
                    Fecha de consulta:
                  </span>{" "}
                  {fechaConsulta}
                </p>
                <p>
                  <span className="font-semibold text-gray-800">
                    Hora de consulta:
                  </span>{" "}
                  {horaConsulta}
                </p>
                <p className="break-all">
                  <span className="font-semibold text-gray-800">
                    ID consulta:
                  </span>{" "}
                  {consultaId}
                </p>
              </div>
            </div>
          </section>

          <section className="border-b border-gray-200 px-8 py-6 print:break-inside-avoid print:px-6 print:py-5">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-700">
              Motivo de consulta
            </h2>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-[15px] leading-7 text-gray-900 print:break-inside-avoid">
              {consulta.motivo_consulta || "No informado"}
            </div>
          </section>

          <section className="px-8 py-6 print:break-before-page print:px-6 print:py-5">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700">
                Informe / borrador clínico
              </h2>

              <p className="text-xs uppercase tracking-wide text-gray-500">
                Documento para revisión médica
              </p>
            </div>

            <div className="min-h-[320px] rounded-xl border border-gray-300 bg-white p-7 print:min-h-0 print:break-inside-auto print:p-0">
              {renderBorradorClinico(consulta.borrador_clinico)}
            </div>
          </section>

          <footer className="border-t border-gray-300 px-8 py-8 print:break-inside-avoid print:px-6 print:py-6">
            <div className="flex flex-col gap-8">
              <div className="flex flex-col gap-8 print:break-inside-avoid md:flex-row md:items-end md:justify-between">
                <div className="max-w-xl text-xs leading-5 text-gray-500">
                  <p className="font-medium text-gray-700">NEXARO · MEDIX</p>
                  <p>Plataforma de asistencia clínica digital</p>
                  <p className="mt-2">
                    Este informe ha sido generado para revisión profesional y
                    puede requerir validación adicional por parte del médico
                    responsable antes de su uso definitivo.
                  </p>
                </div>

                <div className="min-w-[320px] text-right">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    Profesional responsable
                  </p>

                  <div className="mb-4 ml-auto h-px w-56 bg-gray-400" />

                  <p className="text-sm font-semibold text-gray-800">
                    {userProfile?.nombre_profesional ||
                      userProfile?.nombre ||
                      "Profesional médico"}
                  </p>

                  <p className="text-sm text-gray-600">
                    Médico clínico · Nº colegiado{" "}
                    {userProfile?.numero_colegiado || "No informado"}
                  </p>

                  <p className="mt-2 text-xs text-gray-500">
                    {userProfile?.email_profesional ||
                      userProfile?.email ||
                      "Email no informado"}
                  </p>

                  <p className="text-xs text-gray-500">
                    {userProfile?.telefono_profesional || "Teléfono no informado"}
                  </p>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4 text-[11px] leading-5 text-gray-500 print:break-inside-avoid">
                <p>
                  Emitido el {fechaEmision} a las {horaEmision}.
                </p>
                <p className="mt-1">
                  Documento generado por plataforma de asistencia clínica digital
                  para apoyo profesional. Su contenido debe ser revisado,
                  validado y firmado por el profesional responsable antes de su
                  uso clínico definitivo.
                </p>
              </div>
            </div>
          </footer>
        </article>
      </div>
    </main>
  );
}