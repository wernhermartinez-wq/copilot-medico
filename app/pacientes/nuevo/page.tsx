"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function NuevoPacientePage() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [telefono, setTelefono] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState<"ok" | "error" | null>(null);
  const [guardando, setGuardando] = useState(false);

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
    router.push(`/pacientes/${data.id}`);

    setNombre("");
    setApellido("");
    setFechaNacimiento("");
    setTelefono("");
    setObservaciones("");
    setGuardando(false);
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Nuevo paciente</h1>
          <p className="text-gray-600">Registrar nuevo paciente</p>
        </header>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Nombre
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none"
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
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none"
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
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none"
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
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none"
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
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none"
                rows={4}
                placeholder="Observaciones clínicas o generales"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={guardando}
                className="rounded-xl bg-black px-5 py-3 text-white disabled:opacity-60"
              >
                {guardando ? "Guardando..." : "Guardar paciente"}
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