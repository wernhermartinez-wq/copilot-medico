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
      <main className="min-h-screen bg-gray-100 p-8">
        <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-gray-600">Verificando sesión...</p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        titulo="Buscar paciente"
        subtitulo="Selecciona un paciente para asignarlo a la nueva consulta."
        nombreProfesional={userProfile?.nombre_profesional || undefined}
        nombreUsuario={userProfile?.nombre || undefined}
        rol={userProfile?.rol}
      />

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Buscar paciente</h1>
          <p className="mt-2 text-sm text-gray-600">
            Escribe nombre o apellido y selecciona el paciente para asignarlo a
            la nueva consulta.
          </p>
        </div>

        <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
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
            placeholder="Ej.: Juan o Pérez"
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none transition focus:border-blue-500"
          />

          <div className="mt-3 flex flex-wrap gap-3">
            <Link
              href={returnTo}
              className="inline-flex items-center rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
            >
              Volver
            </Link>

            <button
              type="button"
              onClick={() => setBusqueda("")}
              className="inline-flex items-center rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
            >
              Limpiar
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-800">Resultados</h2>
          </div>

          {loading ? (
            <div className="px-4 py-6 text-sm text-gray-600">
              Cargando pacientes...
            </div>
          ) : error ? (
            <div className="px-4 py-6 text-sm text-red-600">{error}</div>
          ) : pacientesFiltrados.length === 0 ? (
            <div className="px-4 py-6 text-sm text-gray-600">
              No se encontraron pacientes con esa búsqueda.
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {pacientesFiltrados.map((paciente) => (
                <button
                  key={paciente.id}
                  type="button"
                  onClick={() => handleSeleccionarPaciente(paciente)}
                  disabled={seleccionandoId === paciente.id}
                  className="flex w-full flex-col items-start gap-2 px-4 py-4 text-left transition hover:bg-gray-50 disabled:opacity-60"
                >
                  <div className="text-base font-semibold text-gray-900">
                    {paciente.nombre} {paciente.apellido}
                  </div>

                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
                    <span>
                      <strong>Tel:</strong> {paciente.telefono?.trim() || "—"}
                    </span>
                    <span>
                      <strong>F. nac.:</strong> {paciente.fecha_nacimiento || "—"}
                    </span>
                  </div>

                  <div className="text-sm font-medium text-blue-600">
                    {seleccionandoId === paciente.id
                      ? "Asignando..."
                      : "Asignar a nueva consulta"}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}