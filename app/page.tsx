"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function HomePage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState<"ok" | "error" | null>(null);
  const [cargando, setCargando] = useState(false);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setCargando(true);
    setMensaje("");
    setTipoMensaje(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setTipoMensaje("error");
      setMensaje(`Error al iniciar sesión: ${error.message}`);
      setCargando(false);
      return;
    }

    setTipoMensaje("ok");
    setMensaje("Sesión iniciada correctamente.");

    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="bg-white shadow-lg rounded-xl p-10 w-full max-w-xl space-y-6">
        
        {/* LOGO + SUBTÍTULO */}
        <div className="text-center space-y-4">
         <div className="flex justify-center pt-2">
  <img
    src="/logo-nexaro-medix.png"
    alt="Nexaro Medix"
    className="w-56 max-w-full h-auto"
  />
</div>

          <p className="text-gray-600">
            Asistente clínico con IA para consultas médicas.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleLogin}>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none"
              placeholder="tuemail@ejemplo.com"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none"
              placeholder="Tu contraseña"
              required
            />
          </div>

          <div className="flex justify-center">
            <button
              type="submit"
              disabled={cargando}
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-60"
            >
              {cargando ? "Ingresando..." : "Ingresar"}
            </button>
          </div>
        </form>

        {mensaje && (
          <div
            className={`rounded-xl px-4 py-3 ${
              tipoMensaje === "ok"
                ? "border border-green-300 bg-green-50 text-green-800"
                : "border border-red-300 bg-red-50 text-red-800"
            }`}
          >
            {mensaje}
          </div>
        )}
      </div>
    </main>
  );
}