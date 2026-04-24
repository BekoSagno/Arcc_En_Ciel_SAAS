"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import SectionCard from "@/src/components/ui/SectionCard";
import Button from "@/src/components/ui/Button";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

type Props = {
  tenant: any;
  session: any;
  onClose: () => void;
  onSuccess: () => void;
};

export default function TenantForm({ tenant, session, onClose, onSuccess }: Props) {
  const [formData, setFormData] = useState({
    name: tenant?.name || "",
    status: tenant?.status || "active",
    timezone: tenant?.timezone || "Africa/Conakry",
    adminEmail: "",
    adminPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const url = tenant
        ? `${backendUrl}/api/admin/tenants/${tenant.id}`
        : `${backendUrl}/api/admin/tenants`;
      const method = tenant ? "PUT" : "POST";

      const body = tenant
        ? {
            name: formData.name,
            status: formData.status,
            timezone: formData.timezone,
          }
        : {
            name: formData.name,
            adminEmail: formData.adminEmail,
            adminPassword: formData.adminPassword,
            status: formData.status,
            timezone: formData.timezone,
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
        await new Promise((resolve) => setTimeout(resolve, 500));
        onSuccess();
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
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
        <SectionCard title={tenant ? "Modifier le tenant" : "Nouveau tenant"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-slate-300">Nom du tenant</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              placeholder="Boutique Arcc Test"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-300">Statut</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="active">Actif</option>
              <option value="suspended">Suspendu</option>
              <option value="inactive">Inactif</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-300">Timezone</label>
            <input
              type="text"
              value={formData.timezone}
              onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              placeholder="Africa/Conakry"
            />
          </div>

          {!tenant && (
            <>
              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  Email administrateur
                </label>
                <input
                  type="email"
                  value={formData.adminEmail}
                  onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                  required
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                  placeholder="admin@boutique.com"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  Mot de passe administrateur
                </label>
                <input
                  type="password"
                  value={formData.adminPassword}
                  onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                  required
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                  placeholder="••••••••"
                />
              </div>
            </>
          )}

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
              icon={loading ? undefined : tenant ? "✏️" : "➕"}
              className="flex-1"
            >
              {loading ? "Traitement..." : tenant ? "Modifier" : "Créer"}
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
