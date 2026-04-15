"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUserProfile, type UserProfile } from "@/lib/get-user-profile";
import AppHeader from "@/components/AppHeader";

export default function NuevoPacientePageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnToParam = searchParams.get("returnTo");

  const returnTo =
    returnToParam && returnToParam.includes("/nueva-consulta")
      ? "/nueva-consulta"
      : null;

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [telefono, setTelefono] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState<"ok" | "error" | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    async function cargarPerfil() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setTipoMensaje(null);
        setMensaje("");
        setUserProfile(null);
        setAuthChecked(true);
        router.replace("/");
        return;
      }

      const profile = await getUserProfile();
      setUserProfile(profile);

      if (profile && profile.activo === false) {
        setTipoMensaje(null);
        setMensaje("");
        setAuthChecked(true);
        await supabase.auth.signOut();
        router.replace("/");
        return;
      }

      setAuthChecked(true);
    }

    cargarPerfil();
  }, [router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setGuardando(true);
    setMensaje("");

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

    const { data, error } = await supabase
      .from("pacientes")
      .insert([
        {
          nombre,
          apellido,
          fecha_nacimiento: fechaNacimiento || null,
          telefono,
          observaciones,
          user_id: user.id,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error(error);
      setTipoMensaje("error");
      setMensaje(`Error al guardar el paciente: ${error.message}`);
      setGuardando(false);
      return;
    }

    setTipoMensaje("ok");
    setMensaje("Paciente guardado correctamente en Supabase.");

    if (returnTo) {
      const query = new URLSearchParams();
      query.set("prefillBusqueda", nombre.trim());
      query.set("pacienteCreadoId", data.id);
      router.push(`${returnTo}?${query.toString()}`);
    } else {
      router.push(`/pacientes/${data.id}`);
    }

    setNombre("");
    setApellido("");
    setFechaNacimiento("");
    setTelefono("");
    setObservaciones("");
    setGuardando(false);
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
    <main className="relative isolate min-h-screen bg-[#f8fafc] px-4 py-6 sm:p-6 lg:p-8">
      <AppHeader
        titulo="Nuevo paciente"
        subtitulo="Registrar nuevo paciente"
        nombreProfesional={userProfile?.nombre_profesional || undefined}
        nombreUsuario={userProfile?.nombre || undefined}
        rol={userProfile?.rol}
        userSexo={userProfile?.sexo}
        acciones={
          <div className="flex flex-wrap items-center gap-2">
            {returnTo ? (
              <Link
                href={returnTo}
                className="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 transition"
              >
                Volver a nueva consulta
              </Link>
            ) : null}

            <Link
              href="/dashboard"
              className="inline-flex items-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
            >
              Ir a pacientes
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

      <div className="relative z-10 mx-auto max-w-4xl -mt-4">
        <section className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4 sm:p-6">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Nombre
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none transition focus:border-blue-500"
                placeholder="Ej. Ana"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Apellido
              </label>
              <input
                type="text"
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none transition focus:border-blue-500"
                placeholder="Ej. López"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Fecha de nacimiento
              </label>
              <input
                type="date"
                value={fechaNacimiento}
                onChange={(e) => setFechaNacimiento(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none transition focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Teléfono
              </label>
              <input
                type="text"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none transition focus:border-blue-500"
                placeholder="Ej. 600111222"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Observaciones
              </label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 resize-none"
                rows={4}
                placeholder="Observaciones clínicas o generales"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={guardando}
                className="w-full sm:w-auto rounded-xl bg-blue-600 px-5 py-3 text-base font-medium text-white disabled:opacity-60"
              >
                {guardando ? "Guardando..." : "Guardar paciente"}
              </button>
            </div>
          </form>

          {mensaje && (
            <div
              className={`mt-6 rounded-xl px-4 py-3 text-sm ${
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