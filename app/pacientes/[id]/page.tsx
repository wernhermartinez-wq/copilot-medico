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
  fecha_nacimiento: string | null;
  telefono: string | null;
  observaciones: string | null;
  user_id: string;
};

type Consulta = {
  id: string;
  created_at: string | null;
  motivo_consulta: string;
};

export default function PacientePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensajeError, setMensajeError] = useState("");

  useEffect(() => {
    async function cargarFicha() {
      setCargando(true);
      setMensajeError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setMensajeError("No se pudo obtener el usuario autenticado.");
        setCargando(false);
        return;
      }

      const profile = await getUserProfile();
      setUserProfile(profile);

      if (profile && profile.activo === false) {
        setMensajeError("Tu usuario está desactivado. Contacta al administrador.");
        setCargando(false);
        await supabase.auth.signOut();
        router.push("/");
        return;
      }

      const { data: pacienteData, error: pacienteError } = await supabase
        .from("pacientes")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (pacienteError || !pacienteData) {
        setMensajeError("No se pudo cargar la ficha del paciente.");
        setCargando(false);
        return;
      }

      const { data: consultasData, error: consultasError } = await supabase
        .from("consultas")
        .select("id, created_at, motivo_consulta")
        .eq("paciente_id", id)
        .order("created_at", { ascending: false });

      if (consultasError) {
        setMensajeError("No se pudieron cargar las consultas del paciente.");
        setCargando(false);
        return;
      }

      setPaciente(pacienteData);
      setConsultas(consultasData || []);
      setCargando(false);
    }

    cargarFicha();
  }, [id, router]);

  if (cargando) {
    return (
      <main className="min-h-screen bg-gray-100 p-8">
        <AppHeader
          titulo="Ficha del paciente"
          subtitulo="Cargando información..."
          nombreProfesional={userProfile?.nombre_profesional || undefined}
          nombreUsuario={userProfile?.nombre || undefined}
          rol={userProfile?.rol}
          backHref="/dashboard"
          backLabel="Volver al panel"
        />

        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-gray-700">Cargando ficha del paciente...</p>
          </div>
        </div>
      </main>
    );
  }

  if (mensajeError || !paciente) {
    return (
      <main className="min-h-screen bg-gray-100 p-8">
        <AppHeader
          titulo="Ficha del paciente"
          subtitulo="Error al cargar"
          nombreProfesional={userProfile?.nombre_profesional || undefined}
          nombreUsuario={userProfile?.nombre || undefined}
          rol={userProfile?.rol}
          backHref="/dashboard"
          backLabel="Volver al panel"
        />

        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h1 className="mb-4 text-2xl font-bold text-red-700">
              Acceso no autorizado
            </h1>
            <p className="text-gray-700">
              {mensajeError || "No se pudo cargar la ficha del paciente."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <AppHeader
        titulo="Ficha del paciente"
        subtitulo="Detalle del paciente y consultas"
        paciente={`${paciente.nombre} ${paciente.apellido}`}
        nombreProfesional={userProfile?.nombre_profesional || undefined}
        nombreUsuario={userProfile?.nombre || undefined}
        rol={userProfile?.rol}
        backHref="/dashboard"
        backLabel="Volver al panel"
      />

      <div className="mx-auto max-w-5xl">
        <section className="mb-6 rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">
                {paciente.nombre} {paciente.apellido}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Historial y datos generales del paciente
              </p>
            </div>

            <Link
              href={`/pacientes/${id}/nueva-consulta`}
              className="inline-block rounded-xl bg-black px-4 py-3 text-sm font-medium text-white hover:bg-gray-800"
            >
              Nueva consulta
            </Link>
          </div>
        </section>

        <section className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-gray-800">
            Datos del paciente
          </h2>

          <div className="grid gap-4 text-gray-700 md:grid-cols-2">
            <p>
              <strong>Nombre:</strong> {paciente.nombre} {paciente.apellido}
            </p>
            <p>
              <strong>Fecha de nacimiento:</strong>{" "}
              {paciente.fecha_nacimiento
                ? new Date(paciente.fecha_nacimiento).toLocaleDateString("es-ES")
                : "No informada"}
            </p>
            <p>
              <strong>Teléfono:</strong> {paciente.telefono || "No informado"}
            </p>
            <p>
              <strong>Observaciones:</strong>{" "}
              {paciente.observaciones || "Sin observaciones"}
            </p>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800">
              Consultas anteriores
            </h2>
            <p className="text-sm text-gray-500">
              {consultas.length} {consultas.length === 1 ? "consulta" : "consultas"}
            </p>
          </div>

          {consultas.length > 0 ? (
            <div className="space-y-4">
              {consultas.map((consulta) => (
                <div
                  key={consulta.id}
                  className="rounded-xl border border-gray-200 bg-gray-50 p-4 transition hover:border-gray-300 hover:bg-white"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-500">
                        {consulta.created_at
                          ? new Date(consulta.created_at).toLocaleDateString("es-ES")
                          : "Fecha no informada"}
                      </p>

                      <h3 className="mt-1 text-lg font-semibold text-gray-900">
                        {consulta.motivo_consulta || "Consulta sin motivo informado"}
                      </h3>
                    </div>

                    <div className="shrink-0">
                      <Link
                        href={`/pacientes/${paciente.id}/consultas/${consulta.id}`}
                        className="inline-block rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100"
                      >
                        Ver consulta
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 px-4 py-6 text-gray-500">
              Todavía no hay consultas registradas para este paciente.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}