"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

type AppHeaderProps = {
  titulo: string;
  subtitulo?: string;
  paciente?: string;
  nombreUsuario?: string;
  nombreProfesional?: string;
  rol?: string;
  backHref?: string;
  backLabel?: string;
  acciones?: React.ReactNode;
};

export default function AppHeader({
  titulo,
  subtitulo,
  paciente,
  nombreUsuario,
  nombreProfesional,
  rol,
  backHref,
  backLabel = "Volver",
  acciones,
}: AppHeaderProps) {
  const router = useRouter();

  const nombreVisible =
    nombreProfesional?.trim() ||
    nombreUsuario?.trim() ||
    "Profesional";

  async function handleLogout() {
    const { supabase } = await import("@/lib/supabase");
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-start justify-between gap-4 px-6 py-4">
        <div className="flex min-w-0 items-start gap-4">
          <div className="hidden shrink-0 sm:flex">
            <img
              src="/logo-nexaro-medix.png"
              alt="Nexaro Medix"
              className="h-23 w-auto object-contain"
            />
          </div>

          <div className="min-w-0">
            {backHref ? (
              <div className="mb-2">
                <Link
                  href={backHref}
                  className="text-sm text-blue-600 hover:underline"
                >
                  ← {backLabel}
                </Link>
              </div>
            ) : null}

            <h1 className="text-2xl font-bold text-gray-900">{titulo}</h1>

            <div className="mt-1 space-y-1 text-sm text-gray-600">
              {subtitulo && <p>{subtitulo}</p>}

              {paciente && (
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  Paciente · {paciente}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {acciones ? <div>{acciones}</div> : null}

          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">
              {nombreVisible}
            </p>
            {rol && (
  <p className="text-xs uppercase tracking-wide text-gray-500">
    {rol}
  </p>
)}
          </div>

          <button
            onClick={handleLogout}
            className="cursor-pointer rounded-md border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </header>
  );
}