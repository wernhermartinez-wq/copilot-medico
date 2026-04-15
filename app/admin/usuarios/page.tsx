"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getUserProfile, type UserProfile } from "@/lib/get-user-profile";
import AppHeader from "@/components/AppHeader";

type Usuario = {
  id: string;
  nombre: string;
  email: string;
  rol: "admin" | "medico";
  activo: boolean;
  nombre_profesional: string | null;
  numero_colegiado: string | null;
  email_profesional: string | null;
  telefono_profesional: string | null;
};

function EstadoBadge({ activo }: { activo: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
        activo
          ? "border border-green-400 bg-green-100 text-green-700"
          : "border border-red-400 bg-red-100 text-red-700"
      }`}
    >
      {activo ? "Activo" : "Inactivo"}
    </span>
  );
}

function UsuarioItem({
  usuario,
  onUpdate,
}: {
  usuario: Usuario;
  onUpdate: () => Promise<void> | void;
}) {
  const [nombre, setNombre] = useState(usuario.nombre ?? "");
  const [rol, setRol] = useState<"admin" | "medico">(
    usuario.rol === "admin" ? "admin" : "medico"
  );
  const [nombreProfesional, setNombreProfesional] = useState(
    usuario.nombre_profesional ?? ""
  );
  const [numeroColegiado, setNumeroColegiado] = useState(
    usuario.numero_colegiado ?? ""
  );
  const [emailProfesional, setEmailProfesional] = useState(
    usuario.email_profesional ?? ""
  );
  const [telefonoProfesional, setTelefonoProfesional] = useState(
    usuario.telefono_profesional ?? ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardarCambios() {
    setLoading(true);
    setError(null);

    try {
      if (!usuario.id || typeof usuario.id !== "string") {
        throw new Error("Usuario sin ID válido.");
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error("No hay sesión activa.");
      }

      const res = await fetch(`/api/admin/usuarios/${usuario.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          nombre,
          rol,
          activo: usuario.activo,
          nombre_profesional: nombreProfesional,
          numero_colegiado: numeroColegiado,
          email_profesional: emailProfesional,
          telefono_profesional: telefonoProfesional,
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      const result = contentType.includes("application/json")
        ? await res.json()
        : { error: await res.text() };

      if (!res.ok) {
        throw new Error(result.error || "Error al actualizar usuario");
      }

      await onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActivo() {
    setLoading(true);
    setError(null);

    try {
      if (!usuario.id || typeof usuario.id !== "string") {
        throw new Error("Usuario sin ID válido.");
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error("No hay sesión activa.");
      }

      const res = await fetch(`/api/admin/usuarios/${usuario.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          nombre,
          rol,
          activo: !usuario.activo,
          nombre_profesional: nombreProfesional,
          numero_colegiado: numeroColegiado,
          email_profesional: emailProfesional,
          telefono_profesional: telefonoProfesional,
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      const result = contentType.includes("application/json")
        ? await res.json()
        : { error: await res.text() };

      if (!res.ok) {
        throw new Error(
          result.error ||
            (usuario.activo
              ? "Error al desactivar usuario"
              : "Error al activar usuario")
        );
      }

      await onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  async function eliminarUsuario() {
    const confirmado = confirm(
      "Esta acción eliminará el usuario de forma permanente. ¿Deseas continuar?"
    );

    if (!confirmado) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (!usuario.id || typeof usuario.id !== "string") {
        throw new Error("Usuario sin ID válido.");
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error("No hay sesión activa.");
      }

      const res = await fetch(`/api/admin/usuarios/${usuario.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const contentType = res.headers.get("content-type") || "";
      const result = contentType.includes("application/json")
        ? await res.json()
        : { error: await res.text() };

      if (!res.ok) {
        if (res.status === 409) {
          throw new Error(result.error || "No se puede eliminar este usuario");
        }
        throw new Error(result.error || "Error al eliminar usuario");
      }

      await onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  function resetCampos() {
    setNombre(usuario.nombre ?? "");
    setRol(usuario.rol === "admin" ? "admin" : "medico");
    setNombreProfesional(usuario.nombre_profesional ?? "");
    setNumeroColegiado(usuario.numero_colegiado ?? "");
    setEmailProfesional(usuario.email_profesional ?? "");
    setTelefonoProfesional(usuario.telefono_profesional ?? "");
    setError(null);
  }

  return (
    <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold text-gray-900">
            {usuario.nombre}
          </div>
          <div className="mt-1 text-sm text-gray-600">
            {usuario.email}
          </div>
        </div>

        <EstadoBadge activo={usuario.activo} />
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre"
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-gray-400"
        />

        <select
          value={rol}
          onChange={(e) => setRol(e.target.value as "admin" | "medico")}
          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-gray-400"
        >
          <option value="medico">Médico</option>
          <option value="admin">Admin</option>
        </select>

        <input
          value={nombreProfesional}
          onChange={(e) => setNombreProfesional(e.target.value)}
          placeholder="Nombre profesional"
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-gray-400"
        />

        <input
          value={numeroColegiado}
          onChange={(e) => setNumeroColegiado(e.target.value)}
          placeholder="Número de colegiado"
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-gray-400"
        />

        <input
          value={emailProfesional}
          onChange={(e) => setEmailProfesional(e.target.value)}
          placeholder="Email profesional"
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-gray-400"
        />

        <input
          value={telefonoProfesional}
          onChange={(e) => setTelefonoProfesional(e.target.value)}
          placeholder="Teléfono profesional"
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-gray-400"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={guardarCambios}
          disabled={loading}
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "Guardando..." : "Guardar"}
        </button>

        <button
          type="button"
          onClick={resetCampos}
          disabled={loading}
          className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          Cancelar
        </button>

        <button
          type="button"
          onClick={toggleActivo}
          disabled={loading}
          className={`rounded-xl border px-4 py-2.5 text-sm font-medium disabled:opacity-60 ${
            usuario.activo
              ? "border-red-300 bg-white text-red-600 hover:bg-red-50"
              : "border-blue-300 bg-white text-blue-600 hover:bg-blue-50"
          }`}
        >
          {usuario.activo ? "Desactivar" : "Activar"}
        </button>

        <button
          type="button"
          onClick={eliminarUsuario}
          disabled={loading}
          className="rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
        >
          Eliminar
        </button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}

export default function AdminUsuariosPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<"admin" | "medico">("medico");
  const [nombreProfesional, setNombreProfesional] = useState("");
  const [numeroColegiado, setNumeroColegiado] = useState("");
  const [emailProfesional, setEmailProfesional] = useState("");
  const [telefonoProfesional, setTelefonoProfesional] = useState("");
  const [sexo, setSexo] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cargarUsuarios() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token;

      if (!accessToken) {
        setError("No hay sesión activa.");
        return;
      }

      const res = await fetch("/api/admin/usuarios", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const contentType = res.headers.get("content-type") || "";
      const result = contentType.includes("application/json")
        ? await res.json()
        : { error: await res.text() };

      if (!res.ok) {
        setError(result.error || "Error al cargar usuarios");
        return;
      }

      setUsuarios(result.usuarios || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    }
  }

  useEffect(() => {
    async function init() {
      const perfil = await getUserProfile();
      setProfile(perfil);
      setLoadingProfile(false);
      await cargarUsuarios();
    }

    init();
  }, []);

  async function crearUsuario(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error("No hay sesión activa.");
      }

      const res = await fetch("/api/admin/usuarios", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          nombre,
          email,
          password,
          rol,
          sexo,
          nombre_profesional: nombreProfesional,
          numero_colegiado: numeroColegiado,
          email_profesional: emailProfesional,
          telefono_profesional: telefonoProfesional,
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      const result = contentType.includes("application/json")
        ? await res.json()
        : { error: await res.text() };

      if (!res.ok) {
        throw new Error(result.error || "Error al crear usuario");
      }

      setNombre("");
      setEmail("");
      setPassword("");
      setRol("medico");
      setNombreProfesional("");
      setNumeroColegiado("");
      setEmailProfesional("");
      setTelefonoProfesional("");
      setSexo("");

      await cargarUsuarios();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  if (loadingProfile) {
    return (
      <main className="min-h-screen bg-[#f8fafc] px-4 py-6 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl rounded-2xl bg-white p-4 shadow-sm sm:p-6">
          <p className="text-gray-600">Cargando panel de administración...</p>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-[#f8fafc] px-4 py-6 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl rounded-2xl bg-white p-4 shadow-sm sm:p-6">
          <p className="text-red-600">No se pudo cargar el perfil del usuario.</p>
        </div>
      </main>
    );
  }

  if (profile.rol !== "admin") {
    return (
      <main className="min-h-screen bg-[#f8fafc] px-4 py-6 sm:p-6 lg:p-8">
        <AppHeader
          titulo="Administración de usuarios"
          subtitulo="Acceso restringido"
          nombreUsuario={profile.nombre || profile.email || "Usuario"}
          rol={profile.rol}
          userSexo={profile.sexo}
          backHref="/dashboard"
          backLabel="Volver al panel"
        />
        <div className="mx-auto max-w-4xl mt-6 rounded-2xl bg-white p-4 shadow-sm sm:p-6">
          <p className="text-red-600">
            No tienes permisos para acceder a esta sección.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative isolate min-h-screen bg-[#f8fafc] px-4 py-6 sm:p-6 lg:p-8">
      <AppHeader
        titulo="Administración de usuarios"
        subtitulo="Alta, edición y control del estado de usuarios del sistema."
        nombreProfesional={profile.nombre_profesional || undefined}
        nombreUsuario={profile.nombre || profile.email || undefined}
        rol={profile.rol}
        userSexo={profile.sexo}
        backHref="/dashboard"
        backLabel="Volver al panel"
      />

      <div className="mx-auto -mt-10 max-w-4xl px-4 pb-6 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8">
        <section className="relative z-10 -mt-8 mb-6 rounded-[28px] border border-white/60 bg-white/95 p-4 shadow-[0_20px_50px_rgba(15,47,122,0.12)] backdrop-blur-sm sm:p-6">
          <form onSubmit={crearUsuario}>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Crear usuario
            </h2>

            <div className="grid gap-3 sm:grid-cols-2">
              <input
                placeholder="Nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-gray-400"
              />

              <input
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-gray-400"
              />

              <input
                placeholder="Contraseña"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-gray-400"
              />

              <select
                value={rol}
                onChange={(e) => setRol(e.target.value as "admin" | "medico")}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-gray-400"
              >
                <option value="medico">Médico</option>
                <option value="admin">Admin</option>
              </select>

              <input
                placeholder="Nombre profesional"
                value={nombreProfesional}
                onChange={(e) => setNombreProfesional(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-gray-400"
              />

              <input
                placeholder="Número de colegiado"
                value={numeroColegiado}
                onChange={(e) => setNumeroColegiado(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-gray-400"
              />

              <input
                placeholder="Email profesional"
                value={emailProfesional}
                onChange={(e) => setEmailProfesional(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-gray-400"
              />

              <input
                placeholder="Teléfono profesional"
                value={telefonoProfesional}
                onChange={(e) => setTelefonoProfesional(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-gray-400"
              />

              <select
                value={sexo}
                onChange={(e) => setSexo(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-gray-400"
              >
                <option value="">Seleccionar sexo</option>
                <option value="hombre">Hombre</option>
                <option value="mujer">Mujer</option>
              </select>
            </div>

            <div className="mt-4">
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? "Creando..." : "Crear usuario"}
              </button>
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          </form>
        </section>

        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Usuarios</h2>

          <div className="space-y-4">
            {usuarios.map((u) => (
              <UsuarioItem key={u.id} usuario={u} onUpdate={cargarUsuarios} />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}