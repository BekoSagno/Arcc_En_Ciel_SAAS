"use client";

import { useState } from "react";
import SectionCard from "@/src/components/ui/SectionCard";
import { X } from "lucide-react";

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
    isAiEnabled: tenant?.isAiEnabled ?? true,
    adminName: "",
    adminEmail: "",
    adminPassword: "",
    whatsappNumber: "",
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
            isAiEnabled: formData.isAiEnabled,
          }
        : {
            name: formData.name,
            adminName: formData.adminName,
            adminEmail: formData.adminEmail,
            adminPassword: formData.adminPassword,
            status: formData.status,
            timezone: formData.timezone,
            whatsappNumber: formData.whatsappNumber.trim() || undefined,
            isAiEnabled: formData.isAiEnabled,
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
        // Attendre un peu pour que la DB se synchronise
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto">
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

          <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800 px-3 py-2">
            <div>
              <div className="text-sm text-slate-200 font-medium">Activer l'IA pour ce client</div>
              <p className="text-xs text-slate-400">
                Quand ce réglage est désactivé, aucune réponse automatique n'est générée par l'IA
                pour les conversations WhatsApp de ce tenant.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setFormData((prev) => ({ ...prev, isAiEnabled: !prev.isAiEnabled }))
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                formData.isAiEnabled ? "bg-emerald-500" : "bg-slate-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  formData.isAiEnabled ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {!tenant && (
            <>
              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  Nom complet du client (administrateur)
                </label>
                <input
                  type="text"
                  value={formData.adminName}
                  onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                  placeholder="Nom complet du client"
                />
              </div>

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

              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  Numéro WhatsApp Business du client
                </label>
                <input
                  type="tel"
                  value={formData.whatsappNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, whatsappNumber: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                  placeholder="+224 6xx xx xx xx"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Ce numéro sera utilisé comme numéro WhatsApp Business de la boutique
                  (ChannelIdentity + configuration de canal seront créés automatiquement).
                </p>
              </div>
            </>
          )}

          {error && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-sm text-rose-400">
              {error}
            </div>
          )}

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? "En cours..." : tenant ? "Modifier" : "Créer"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-700"
              >
                Annuler
              </button>
            </div>
          </form>
        </SectionCard>
      </div>
    </div>
  );
}
