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
  userSexo?: string | null;
};

export default function AppHeader({
  titulo,
  subtitulo,
  paciente,
  backHref,
  backLabel = "Volver",
  acciones,
  userSexo,
}: AppHeaderProps) {
  const router = useRouter();

  const backgroundImage = userSexo?.toLowerCase() === "mujer"
    ? "url('/premium-medica.png')"
    : "url('/premium-medico.png')";

  async function handleLogout() {
    const { supabase } = await import("@/lib/supabase");
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="relative mb-0 w-full">
      <div className="relative w-full overflow-hidden min-h-[260px] sm:min-h-[320px]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage,
            backgroundSize: "110%",
            backgroundPosition: "70% top",
            backgroundRepeat: "no-repeat",
          }}
        />

        <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-b from-transparent via-[#f8fafc]/35 to-[#f8fafc]" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#f8fafc]/70 to-transparent" />

        <div className="relative w-full px-4 pb-24 pt-10 sm:px-6 sm:pb-16 sm:pt-8">
          <button
            onClick={handleLogout}
            className="absolute right-4 top-6 rounded-xl border border-white/20 bg-white/8 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur-sm transition hover:bg-white/12 hover:text-white sm:right-6 sm:top-8"
          >
            Salir
          </button>

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
          </div>
        </div>
      </div>
    </header>
  );
}