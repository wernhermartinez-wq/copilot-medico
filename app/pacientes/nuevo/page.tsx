import { Suspense } from "react";
import AppHeader from "@/components/AppHeader";
import NuevoPacientePageClient from "./NuevoPacientePageClient";

export default function NuevoPacientePage() {
  return (
    <Suspense
      fallback={
        <>
          <AppHeader titulo="Nuevo paciente" subtitulo="Cargando..." />
          <main className="min-h-screen bg-gray-100 p-8">
            <div className="mx-auto max-w-3xl">
              <section className="rounded-2xl bg-white p-6 shadow-sm">
                <p className="text-gray-600">Cargando nuevo paciente...</p>
              </section>
            </div>
          </main>
        </>
      }
    >
      <NuevoPacientePageClient />
    </Suspense>
  );
}