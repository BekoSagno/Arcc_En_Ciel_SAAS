"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import SectionCard from "@/src/components/ui/SectionCard";
import StatusBadge from "@/src/components/ui/StatusBadge";
import Button from "@/src/components/ui/Button";
import { Users, Plus, X } from "lucide-react";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

type Props = {
  tenantId: string;
  session: any;
  onClose: () => void;
};

export default function UserManagement({ tenantId, session, onClose }: Props) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  useEffect(() => {
    loadUsers();
  }, [tenantId]);

  const loadUsers = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/admin/tenants/${tenantId}/users`, {
        headers: {
          "x-user-email": session?.user?.email || "",
          "x-user-role": session?.user?.role || "",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.data || []);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des utilisateurs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (userId: string, newStatus: string) => {
    try {
      const response = await fetch(`${backendUrl}/api/admin/users/${userId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": session?.user?.email || "",
          "x-user-role": session?.user?.role || "",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        await loadUsers();
      }
    } catch (error) {
      console.error("Erreur lors de la modification du statut:", error);
    }
  };

  if (loading) {
    return <div className="text-slate-400">Chargement...</div>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <SectionCard
        title="Gestion des utilisateurs"
        action={
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="md"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => {
                setEditingUser(null);
                setShowForm(true);
              }}
            >
              Nouvel utilisateur
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<X className="h-4 w-4" />}
              onClick={onClose}
              className="p-1.5"
            />
          </div>
        }
      >
        <div className="max-h-[60vh] space-y-3 overflow-y-auto">
          {users.length === 0 ? (
            <div className="py-8 text-center text-slate-400">Aucun utilisateur</div>
          ) : (
            users.map((user, index) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#161b22] px-4 py-3 hover:border-slate-700 transition-all duration-200"
              >
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-indigo-400" />
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {user.name || user.email}
                    </div>
                    <div className="text-xs text-slate-400">{user.email}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Rôle: {user.role} · Créé le{" "}
                      {new Date(user.createdAt).toLocaleDateString("fr-FR")}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge
                    label={user.status}
                    tone={user.status === "active" ? "success" : "danger"}
                  />
                  <select
                    value={user.status}
                    onChange={(e) => handleStatusChange(user.id, e.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300 transition hover:bg-slate-700"
                  >
                    <option value="active">Actif</option>
                    <option value="inactive">Inactif</option>
                  </select>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </SectionCard>

      {showForm && (
        <UserForm
          tenantId={tenantId}
          user={editingUser}
          session={session}
          onClose={() => {
            setShowForm(false);
            setEditingUser(null);
            loadUsers();
          }}
        />
      )}
    </div>
  );
}

function UserForm({ tenantId, user, session, onClose }: any) {
  const [formData, setFormData] = useState({
    email: user?.email || "",
    name: user?.name || "",
    password: "",
    role: user?.role || "TENANT_ADMIN",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const url = user
        ? `${backendUrl}/api/admin/users/${user.id}`
        : `${backendUrl}/api/admin/tenants/${tenantId}/users`;
      const method = user ? "PUT" : "POST";

      const body = user
        ? {
            email: formData.email,
            name: formData.name,
            role: formData.role,
            ...(formData.password && { password: formData.password }),
          }
        : {
            email: formData.email,
            name: formData.name,
            password: formData.password,
            role: formData.role,
          };

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-user-email": session?.user?.email || "",
          "x-user-role": session?.user?.role || "",
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        onClose();
      } else {
        const data = await response.json();
        setError(data.error || "Une erreur est survenue");
      }
    } catch (err) {
      setError("Erreur de connexion au serveur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
      >
        <SectionCard title={user ? "Modifier l'utilisateur" : "Nouvel utilisateur"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-slate-300">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-300">Nom</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-300">Rôle</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="TENANT_ADMIN">Administrateur Tenant</option>
              <option value="SUPERADMIN">Super Admin</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-300">
              {user ? "Nouveau mot de passe (laisser vide pour ne pas changer)" : "Mot de passe"}
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required={!user}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-sm text-rose-400">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={loading}
              icon={loading ? undefined : user ? "✏️" : "➕"}
              className="flex-1"
            >
              {loading ? "Traitement..." : user ? "Modifier" : "Créer"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="md"
              icon="❌"
              onClick={onClose}
            >
              Annuler
            </Button>
          </div>
        </form>
      </SectionCard>
      </motion.div>
    </motion.div>
  );
}
