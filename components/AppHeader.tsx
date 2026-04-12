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
  backHref,
  backLabel = "Volver",
  acciones,
}: AppHeaderProps) {
  const router = useRouter();

  async function handleLogout() {
    const { supabase } = await import("@/lib/supabase");
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="relative mb-0 w-full">
      <div className="relative w-full overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url('/premium-medical.png')",
            backgroundSize: "cover",
            backgroundPosition: "center top",
            backgroundRepeat: "no-repeat",
          }}
        />

        <div className="absolute inset-0 bg-gradient-to-r from-[#0f2f7a]/78 via-[#2563eb]/26 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent via-white/18 to-[#f8fafc]" />

        <div className="relative w-full px-4 pb-14 pt-6 sm:px-6 sm:pb-16 sm:pt-8">
          <div className="mt-6 max-w-[180px] sm:max-w-[270px]">
            {backHref ? (
              <div className="mb-2">
                <Link
                  href={backHref}
                  className="text-xs text-white/80 transition hover:text-white"
                >
                  ← {backLabel}
                </Link>
              </div>
            ) : null}

            <h1 className="text-[2.15rem] font-bold leading-[0.95] tracking-[-0.03em] text-white sm:text-5xl">
              {titulo}
            </h1>

            {subtitulo ? (
              <p className="mt-3 text-sm leading-6 text-white/90 sm:text-lg">
                {subtitulo}
              </p>
            ) : null}

            {paciente ? (
              <p className="mt-3 text-[11px] uppercase tracking-[0.16em] text-white/75">
                Paciente: {paciente}
              </p>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-start gap-2 sm:justify-end">
            {acciones ? <div className="min-w-0 flex items-center gap-2">{acciones}</div> : null}

            <button
              onClick={handleLogout}
              className="shrink-0 rounded-2xl border border-white/25 bg-white/10 px-3 py-2 text-sm font-medium text-white backdrop-blur-md transition hover:bg-white/15"
            >
              <span className="sm:hidden">Salir</span>
              <span className="hidden sm:inline">Cerrar sesión</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}