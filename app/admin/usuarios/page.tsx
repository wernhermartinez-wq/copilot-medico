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
      style={{
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        background: activo ? "#dcfce7" : "#fee2e2",
        color: activo ? "#166534" : "#991b1b",
        border: activo ? "1px solid #86efac" : "1px solid #fca5a5",
      }}
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
    <div
      style={{
        marginBottom: 14,
        padding: 16,
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        background: "#ffffff",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
            {usuario.nombre}
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: "#64748b" }}>
            {usuario.email}
          </div>
        </div>

        <EstadoBadge activo={usuario.activo} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre"
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            outline: "none",
          }}
        />

        <select
          value={rol}
          onChange={(e) => setRol(e.target.value as "admin" | "medico")}
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            background: "#fff",
          }}
        >
          <option value="medico">Médico</option>
          <option value="admin">Admin</option>
        </select>

        <input
          value={nombreProfesional}
          onChange={(e) => setNombreProfesional(e.target.value)}
          placeholder="Nombre profesional"
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            outline: "none",
          }}
        />

        <input
          value={numeroColegiado}
          onChange={(e) => setNumeroColegiado(e.target.value)}
          placeholder="Número de colegiado"
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            outline: "none",
          }}
        />

        <input
          value={emailProfesional}
          onChange={(e) => setEmailProfesional(e.target.value)}
          placeholder="Email profesional"
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            outline: "none",
          }}
        />

        <input
          value={telefonoProfesional}
          onChange={(e) => setTelefonoProfesional(e.target.value)}
          placeholder="Teléfono profesional"
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            outline: "none",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          justifyContent: "flex-start",
        }}
      >
        <button
          type="button"
          onClick={guardarCambios}
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "none",
            background: "#0f172a",
            color: "#fff",
            cursor: "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Guardando..." : "Guardar"}
        </button>

        <button
          type="button"
          onClick={resetCampos}
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            background: "#fff",
            color: "#334155",
            cursor: "pointer",
          }}
        >
          Cancelar
        </button>

        <button
          type="button"
          onClick={toggleActivo}
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: usuario.activo ? "1px solid #fecaca" : "1px solid #bfdbfe",
            background: "#fff",
            color: usuario.activo ? "#dc2626" : "#2563eb",
            cursor: "pointer",
          }}
        >
          {usuario.activo ? "Desactivar" : "Activar"}
        </button>
      </div>

      {error && (
        <p style={{ color: "#dc2626", marginTop: 10, fontSize: 14 }}>{error}</p>
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cargarUsuarios() {
    const { data, error } = await supabase
      .from("usuarios")
      .select(
        "id, nombre, email, rol, activo, nombre_profesional, numero_colegiado, email_profesional, telefono_profesional"
      )
      .order("nombre");

    if (error) {
      setError(error.message);
      return;
    }

    setUsuarios((data as Usuario[]) || []);
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

      await cargarUsuarios();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  if (loadingProfile) {
    return (
      <main style={{ padding: 24 }}>
        <p>Cargando panel de administración...</p>
      </main>
    );
  }

  if (!profile) {
    return (
      <main style={{ padding: 24 }}>
        <p style={{ color: "#dc2626" }}>No se pudo cargar el perfil del usuario.</p>
      </main>
    );
  }

  if (profile.rol !== "admin") {
    return (
      <main style={{ padding: 24 }}>
        <AppHeader
          titulo="Administración de usuarios"
          subtitulo="Acceso restringido"
          nombreUsuario={profile.nombre || profile.email || "Usuario"}
          rol={profile.rol}
          backHref="/dashboard"
          backLabel="Volver al panel"
        />
        <p style={{ color: "#dc2626", marginTop: 20 }}>
          No tienes permisos para acceder a esta sección.
        </p>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <AppHeader
  titulo="Administración de usuarios"
  subtitulo="Alta, edición y control del estado de usuarios del sistema."
  nombreProfesional={profile.nombre_profesional || undefined}
  nombreUsuario={profile.nombre || profile.email || undefined}
  rol={profile.rol}
  backHref="/dashboard"
  backLabel="Volver al panel"
/>

      <div
        style={{
          padding: 24,
          maxWidth: 980,
          margin: "0 auto",
        }}
      >
        <form
          onSubmit={crearUsuario}
          style={{
            marginBottom: 32,
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 14,
            padding: 20,
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 16, color: "#0f172a" }}>
            Crear usuario
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <input
              placeholder="Nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              style={{
                padding: "12px 14px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
              }}
            />

            <input
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                padding: "12px 14px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
              }}
            />

            <input
              placeholder="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                padding: "12px 14px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
              }}
            />

            <select
              value={rol}
              onChange={(e) => setRol(e.target.value as "admin" | "medico")}
              style={{
                padding: "12px 14px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                background: "#fff",
              }}
            >
              <option value="medico">Médico</option>
              <option value="admin">Admin</option>
            </select>

            <input
              placeholder="Nombre profesional"
              value={nombreProfesional}
              onChange={(e) => setNombreProfesional(e.target.value)}
              style={{
                padding: "12px 14px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
              }}
            />

            <input
              placeholder="Número de colegiado"
              value={numeroColegiado}
              onChange={(e) => setNumeroColegiado(e.target.value)}
              style={{
                padding: "12px 14px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
              }}
            />

            <input
              placeholder="Email profesional"
              value={emailProfesional}
              onChange={(e) => setEmailProfesional(e.target.value)}
              style={{
                padding: "12px 14px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
              }}
            />

            <input
              placeholder="Teléfono profesional"
              value={telefonoProfesional}
              onChange={(e) => setTelefonoProfesional(e.target.value)}
              style={{
                padding: "12px 14px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
              }}
            />
          </div>

          <div style={{ marginTop: 16 }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "12px 16px",
                borderRadius: 8,
                border: "none",
                background: "#0f172a",
                color: "#fff",
                cursor: "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Creando..." : "Crear usuario"}
            </button>
          </div>

          {error && <p style={{ color: "#dc2626", marginTop: 10 }}>{error}</p>}
        </form>

        <div>
          <h2 style={{ marginBottom: 14, color: "#0f172a" }}>Usuarios</h2>

          {usuarios.map((u) => (
            <UsuarioItem key={u.id} usuario={u} onUpdate={cargarUsuarios} />
          ))}
        </div>
      </div>
    </main>
  );
}