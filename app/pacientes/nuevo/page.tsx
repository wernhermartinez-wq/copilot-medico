import { Suspense } from "react";
import NuevoPacientePageClient from "./NuevoPacientePageClient";

export default function NuevoPacientePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-100 p-8">
          <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-gray-600">Verificando sesión...</p>
          </div>
        </main>
      }
    >
      <NuevoPacientePageClient />
    </Suspense>
  );
}