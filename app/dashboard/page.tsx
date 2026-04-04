"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getUserProfile, type UserProfile } from "@/lib/get-user-profile";
import AppHeader from "@/components/AppHeader";

type Paciente = {
  id: string;
  nombre: string;
  apellido: string;
  created_at: string;
};

type ConsultaResumen = {
  id: string;
  paciente_id: string;
  created_at: string | null;
  motivo_consulta: string | null;
};

type PacienteConUltimaConsulta = Paciente & {
  ultimaConsulta: ConsultaResumen | null;
};

export default function DashboardPage() {
  const router = useRouter();

  const [pacientes, setPacientes] = useState<PacienteConUltimaConsulta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [mensajeError, setMensajeError] = useState("");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    async function cargarPacientes() {
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

      const { data: pacientesData, error: pacientesError } = await supabase
        .from("pacientes")
        .select("id, nombre, apellido, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (pacientesError) {
        setMensajeError(`Error al cargar pacientes: ${pacientesError.message}`);
        setCargando(false);
        return;
      }

      const pacientesBase = pacientesData || [];

      if (pacientesBase.length === 0) {
        setPacientes([]);
        setCargando(false);
        return;
      }

      const pacienteIds = pacientesBase.map((p) => p.id);

      const { data: consultasData, error: consultasError } = await supabase
        .from("consultas")
        .select("id, paciente_id, created_at, motivo_consulta")
        .in("paciente_id", pacienteIds)
        .order("created_at", { ascending: false });

      if (consultasError) {
        setMensajeError(
          `Error al cargar últimas consultas: ${consultasError.message}`
        );
        setCargando(false);
        return;
      }

      const mapaUltimaConsulta = new Map<string, ConsultaResumen>();

      (consultasData || []).forEach((consulta) => {
        if (!mapaUltimaConsulta.has(consulta.paciente_id)) {
          mapaUltimaConsulta.set(consulta.paciente_id, consulta);
        }
      });

      const pacientesConUltimaConsulta: PacienteConUltimaConsulta[] =
        pacientesBase.map((paciente) => ({
          ...paciente,
          ultimaConsulta: mapaUltimaConsulta.get(paciente.id) || null,
        }));

      setPacientes(pacientesConUltimaConsulta);
      setCargando(false);
    }

    cargarPacientes();
  }, [router]);

  const pacientesFiltrados = pacientes.filter((paciente) => {
    const texto = `${paciente.nombre} ${paciente.apellido}`.toLowerCase();
    return texto.includes(busqueda.toLowerCase().trim());
  });

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <AppHeader
        titulo="Panel de pacientes"
        subtitulo="Gestión clínica"
        nombreProfesional={userProfile?.nombre_profesional || undefined}
        nombreUsuario={userProfile?.nombre || undefined}
        rol={userProfile?.rol}
      />

      <div className="mx-auto max-w-5xl">
        <section className="mb-6 rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="shrink-0">
              <Link
                href="/pacientes/nuevo"
                className="inline-block rounded-xl bg-black px-4 py-3 text-sm font-medium text-white hover:bg-gray-800"
              >
                Nuevo paciente
              </Link>
            </div>

            <div className="flex-1">
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre o apellido"
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-400"
              />
            </div>

            <div className="shrink-0 text-sm text-gray-500 md:text-right">
              {busqueda.trim()
                ? `${pacientesFiltrados.length} ${
                    pacientesFiltrados.length === 1 ? "resultado" : "resultados"
                  }`
                : `${pacientes.length} ${
                    pacientes.length === 1 ? "paciente" : "pacientes"
                  }`}
            </div>
          </div>

          {userProfile?.rol === "admin" && (
            <div className="mt-4">
              <Link
                href="/admin/usuarios"
                className="inline-block rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-800 hover:bg-gray-50"
              >
                Administrar usuarios
              </Link>
            </div>
          )}
        </section>

        {cargando && (
          <div className="rounded-xl bg-white p-4 shadow">
            <p className="text-gray-600">Cargando pacientes...</p>
          </div>
        )}

        {!cargando && mensajeError && (
          <div className="rounded-xl bg-red-50 p-4 shadow">
            <p className="text-red-600">{mensajeError}</p>
          </div>
        )}

        {!cargando && !mensajeError && pacientes.length === 0 && (
          <div className="rounded-xl bg-white p-4 shadow">
            <p className="text-gray-600">No hay pacientes cargados.</p>
          </div>
        )}

        {!cargando &&
          !mensajeError &&
          pacientes.length > 0 &&
          pacientesFiltrados.length === 0 && (
            <div className="rounded-xl bg-white p-4 shadow">
              <p className="text-gray-600">
                No se encontraron pacientes para esa búsqueda.
              </p>
            </div>
          )}

        {!cargando && !mensajeError && pacientesFiltrados.length > 0 && (
          <div className="space-y-4">
            {pacientesFiltrados.map((paciente) => (
              <div
                key={paciente.id}
                className="rounded-2xl bg-white p-5 shadow transition hover:shadow-md"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <Link
                    href={`/pacientes/${paciente.id}`}
                    className="block min-w-0 flex-1"
                  >
                    <h2 className="text-xl font-semibold text-gray-900">
                      {paciente.nombre} {paciente.apellido}
                    </h2>

                    {paciente.ultimaConsulta ? (
                      <>
                        <p className="mt-1 text-sm text-gray-600">
                          Última consulta:{" "}
                          {paciente.ultimaConsulta.created_at
                            ? new Date(
                                paciente.ultimaConsulta.created_at
                              ).toLocaleDateString("es-ES")
                            : "Fecha no informada"}
                        </p>

                        <p className="mt-1 text-sm text-gray-500">
                          Motivo:{" "}
                          {paciente.ultimaConsulta.motivo_consulta ||
                            "Sin motivo informado"}
                        </p>
                      </>
                    ) : (
                      <p className="mt-1 text-sm text-gray-500">
                        Sin consultas registradas por ahora
                      </p>
                    )}

                    <p className="mt-2 text-xs text-gray-400">
                      Alta: {new Date(paciente.created_at).toLocaleString("es-ES")}
                    </p>
                  </Link>

                  <div className="flex shrink-0 flex-wrap gap-3">
                    <Link
                      href={`/pacientes/${paciente.id}`}
                      className="inline-block rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
                    >
                      Ver ficha
                    </Link>

                    <Link
                      href={`/pacientes/${paciente.id}/nueva-consulta`}
                      className="inline-block rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                    >
                      Nueva consulta
                    </Link>

                    {paciente.ultimaConsulta && (
                      <Link
                        href={`/pacientes/${paciente.id}/consultas/${paciente.ultimaConsulta.id}`}
                        className="inline-block rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
                      >
                        Última consulta
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}