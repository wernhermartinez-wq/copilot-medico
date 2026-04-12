"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUserProfile, type UserProfile } from "@/lib/get-user-profile";
import AppHeader from "@/components/AppHeader";

type Paciente = {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  fecha_nacimiento: string | null;
};

export default function SeleccionarPacientePageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const returnTo = searchParams.get("returnTo") || "/pacientes";
  const qInicial = searchParams.get("q") || "";

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [busqueda, setBusqueda] = useState(qInicial);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [loading, setLoading] = useState(true);
  const [seleccionandoId, setSeleccionandoId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let activo = true;

    async function cargarPacientes() {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!activo) return;

      if (userError || !user) {
        setUserProfile(null);
        setPacientes([]);
        setLoading(false);
        setAuthChecked(true);
        router.replace("/");
        return;
      }

      const profile = await getUserProfile();

      if (!activo) return;

      setUserProfile(profile);

      if (profile && profile.activo === false) {
        setPacientes([]);
        setLoading(false);
        setAuthChecked(true);
        await supabase.auth.signOut();
        router.replace("/");
        return;
      }

      const { data, error } = await supabase
        .from("pacientes")
        .select("id, nombre, apellido, telefono, fecha_nacimiento")
        .eq("user_id", user.id)
        .order("apellido", { ascending: true })
        .order("nombre", { ascending: true });

      if (!activo) return;

      if (error) {
        setError("No se pudieron cargar los pacientes.");
        setPacientes([]);
        setLoading(false);
        setAuthChecked(true);
        return;
      }

      setPacientes((data as Paciente[]) || []);
      setLoading(false);
      setAuthChecked(true);
    }

    cargarPacientes();

    return () => {
      activo = false;
    };
  }, [router]);

  const pacientesFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    if (!texto) return pacientes;

    return pacientes.filter((paciente) => {
      const nombre = (paciente.nombre || "").toLowerCase();
      const apellido = (paciente.apellido || "").toLowerCase();
      const nombreCompleto = `${nombre} ${apellido}`.trim();
      const apellidoNombre = `${apellido} ${nombre}`.trim();

      return (
        nombre.includes(texto) ||
        apellido.includes(texto) ||
        nombreCompleto.includes(texto) ||
        apellidoNombre.includes(texto)
      );
    });
  }, [busqueda, pacientes]);

  function construirUrlRetorno(paciente: Paciente) {
    const params = new URLSearchParams();
    params.set("pacienteId", paciente.id);
    params.set(
      "pacienteNombre",
      `${paciente.nombre} ${paciente.apellido}`.trim()
    );

    return `${returnTo}?${params.toString()}`;
  }

  function handleSeleccionarPaciente(paciente: Paciente) {
    setSeleccionandoId(paciente.id);
    router.push(construirUrlRetorno(paciente));
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

  return (
    <main className="min-h-screen bg-[#f8fafc] px-4 py-6 sm:p-6 lg:p-8">
      <AppHeader
        titulo="Seleccionar paciente"
        subtitulo="Busca y selecciona un paciente para la nueva consulta."
        nombreProfesional={userProfile?.nombre_profesional || undefined}
        nombreUsuario={userProfile?.nombre || undefined}
        rol={userProfile?.rol}
      />

      <div className="mx-auto max-w-4xl">
        <section className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4 sm:p-6 mb-6">
          <div className="mb-4">
            <label
              htmlFor="busqueda-paciente"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Nombre o apellido
            </label>

            <input
              id="busqueda-paciente"
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Ej: Juan o Pérez"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none transition focus:border-blue-500"
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            <Link
              href={returnTo}
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Volver
            </Link>

            <button
              type="button"
              onClick={() => setBusqueda("")}
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Limpiar
            </button>
          </div>
        </section>

        <section className="space-y-4">
          {loading ? (
            <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-6 text-center">
              <p className="text-sm text-gray-500">Cargando pacientes...</p>
            </div>
          ) : error ? (
            <div className="rounded-2xl bg-white border border-red-200 shadow-sm p-6 text-center">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          ) : pacientesFiltrados.length === 0 ? (
            <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-6 text-center">
              <p className="text-sm text-gray-500">No se encontraron pacientes con esa búsqueda.</p>
            </div>
          ) : (
            pacientesFiltrados.map((paciente) => (
              <button
                key={paciente.id}
                type="button"
                onClick={() => handleSeleccionarPaciente(paciente)}
                disabled={seleccionandoId === paciente.id}
                className="w-full rounded-2xl bg-white border border-gray-200 shadow-sm p-4 text-left transition hover:bg-gray-50 disabled:opacity-60"
              >
                <div className="flex flex-col gap-3">
                  <div className="text-lg font-semibold text-gray-950">
                    {paciente.nombre} {paciente.apellido}
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                    <span>
                      <span className="text-gray-500">Tel:</span> {paciente.telefono?.trim() || "—"}
                    </span>
                    <span>
                      <span className="text-gray-500">F. nac.:</span> {paciente.fecha_nacimiento || "—"}
                    </span>
                  </div>

                  <div className="text-sm font-medium text-blue-600">
                    {seleccionandoId === paciente.id
                      ? "Asignando..."
                      : "Asignar a nueva consulta"}
                  </div>
                </div>
              </button>
            ))
          )}
        </section>
      </div>
    </main>
  );
}