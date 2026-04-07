import { connection } from "next/server";
import SeleccionarPacientePageClient from "./SeleccionarPacientePageClient";

export default async function SeleccionarPacientePage() {
  await connection();
  return <SeleccionarPacientePageClient />;
}