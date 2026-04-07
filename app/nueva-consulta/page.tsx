import { Suspense } from "react";
import AppHeader from "@/components/AppHeader";
import NuevaConsultaPageClient from "./NuevaConsultaPageClient";

export default function NuevaConsultaPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-100 p-8">
          <AppHeader titulo="Nueva consulta" subtitulo="Cargando..." />
          <div className="mx-auto max-w-4xl">
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <p className="text-gray-600">Cargando nueva consulta...</p>
            </section>
          </div>
        </main>
      }
    >
      <NuevaConsultaPageClient />
    </Suspense>
  );
}