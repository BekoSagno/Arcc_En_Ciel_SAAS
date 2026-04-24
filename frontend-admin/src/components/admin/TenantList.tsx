"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import SectionCard from "@/src/components/ui/SectionCard";
import StatusBadge from "@/src/components/ui/StatusBadge";
import Button from "@/src/components/ui/Button";
import TenantForm from "./TenantForm";
import UserManagement from "./UserManagement";
import { Building2, Plus, Edit, Users } from "lucide-react";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

type Props = {
  session: any;
};

export default function TenantList({ session }: Props) {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTenant, setEditingTenant] = useState<any>(null);
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
  const [showUsers, setShowUsers] = useState(false);
  const [metaTenant, setMetaTenant] = useState<any | null>(null);

  useEffect(() => {
    loadTenants();

    // Polling automatique toutes les 10 secondes pour synchronisation en temps réel
    const interval = setInterval(() => {
      loadTenants();
    }, 10000); // 10 secondes

    return () => clearInterval(interval);
  }, []);

  const loadTenants = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/admin/tenants`, {
        headers: {
          "x-user-email": session?.user?.email || "",
          "x-user-role": session?.user?.role || "",
        },
        cache: "no-store",
      });

      if (response.ok) {
        const data = await response.json();
        setTenants(data.data || []);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des tenants:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (tenantId: string, newStatus: string) => {
    try {
      const response = await fetch(`${backendUrl}/api/admin/tenants/${tenantId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": session?.user?.email || "",
          "x-user-role": session?.user?.role || "",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        await loadTenants();
      }
    } catch (error) {
      console.error("Erreur lors de la modification du statut:", error);
    }
  };

  const handleEdit = (tenant: any) => {
    setEditingTenant(tenant);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingTenant(null);
    loadTenants();
  };

  const handleViewUsers = (tenantId: string) => {
    setSelectedTenant(tenantId);
    setShowUsers(true);
  };

  const handleConfigureMeta = (tenant: any) => {
    setMetaTenant(tenant);
  };

  if (loading) {
    return <div className="text-slate-400">Chargement des tenants...</div>;
  }

  return (
    <>
      <SectionCard
        title="Gestion des Tenants"
        action={
          <Button
            variant="primary"
            size="md"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setEditingTenant(null);
              setShowForm(true);
            }}
          >
            Nouveau tenant
          </Button>
        }
      >
        <div className="space-y-3">
          {tenants.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              Aucun tenant enregistré. Créez-en un pour commencer.
            </div>
          ) : (
            tenants.map((tenant, index) => (
              <motion.div
                key={tenant.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="rounded-xl border border-slate-800 bg-[#161b22] px-4 py-3 hover:border-slate-700 transition-all duration-200"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-indigo-400" />
                    <div>
                      <div className="text-sm font-semibold text-white">{tenant.name}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        {tenant._count?.users || 0} utilisateurs ·{" "}
                        {tenant._count?.conversations || 0} conversations ·{" "}
                        {tenant._count?.messages || 0} messages ·{" "}
                        {tenant._count?.ragSources || 0} sources RAG
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                        <span>
                          Créé le {new Date(tenant.createdAt).toLocaleDateString("fr-FR")}
                        </span>
                        <span className="text-slate-600">·</span>
                        <span className="text-emerald-400">
                          Dernière activité: {tenant.lastActivityText || "Jamais"}
                        </span>
                        <span className="text-slate-600">·</span>
                        <span className="text-indigo-400">
                          Facturation: {tenant.billingStatus || "À configurer"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      label={tenant.status}
                      tone={
                        tenant.status === "active"
                          ? "success"
                          : tenant.status === "suspended"
                            ? "warning"
                            : "danger"
                      }
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<Users className="h-4 w-4" />}
                        onClick={() => handleViewUsers(tenant.id)}
                        className="p-2"
                      />
                      <Button
                        variant="info"
                        size="sm"
                        icon={<Edit className="h-4 w-4" />}
                        onClick={() => handleEdit(tenant)}
                        className="p-2"
                      />
                      <Button
                        variant="primary"
                        size="sm"
                        icon="⚙️"
                        onClick={() => handleConfigureMeta(tenant)}
                        className="p-2"
                      />
                      <select
                        value={tenant.status}
                        onChange={(e) => handleStatusChange(tenant.id, e.target.value)}
                        className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300 transition hover:bg-slate-700"
                      >
                        <option value="active">Actif</option>
                        <option value="suspended">Suspendu</option>
                        <option value="inactive">Inactif</option>
                      </select>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </SectionCard>

      {showForm && (
        <TenantForm
          tenant={editingTenant}
          session={session}
          onClose={handleFormClose}
          onSuccess={handleFormClose}
        />
      )}

      {showUsers && selectedTenant && (
        <UserManagement
          tenantId={selectedTenant}
          session={session}
          onClose={() => {
            setShowUsers(false);
            setSelectedTenant(null);
          }}
        />
      )}

      {metaTenant && (
        <MetaConfigModal
          tenant={metaTenant}
          session={session}
          onClose={() => setMetaTenant(null)}
          onSaved={loadTenants}
        />
      )}
    </>
  );
}

type MetaConfigProps = {
  tenant: any;
  session: any;
  onClose: () => void;
  onSaved: () => void;
};

function MetaConfigModal({ tenant, session, onClose, onSaved }: MetaConfigProps) {
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Réutilise la même URL backend que le composant parent
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

  async function handleSave() {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${backendUrl}/api/admin/tenants/${tenant.id}/meta/whatsapp`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-email": session?.user?.email || "",
            "x-user-role": session?.user?.role || "",
          },
          body: JSON.stringify({
            phoneNumberId: phoneNumberId.trim(),
            wabaId: wabaId.trim(),
            accessToken: accessToken.trim(),
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de l'enregistrement.");
      }

      setSuccess("Configuration Meta WhatsApp enregistrée.");
      onSaved();
    } catch (err: any) {
      setError(err.message || "Erreur inconnue.");
    } finally {
      setLoading(false);
    }
  }

  const maskedToken =
    accessToken && accessToken.length > 16
      ? `${accessToken.substring(0, 8)}...${accessToken.substring(
          accessToken.length - 4
        )}`
      : accessToken;

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
        <SectionCard title={`Meta WhatsApp – ${tenant.name}`}>
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Saisissez les identifiants WhatsApp Business fournis par Meta pour ce
              client. Ces valeurs ne sont visibles que par le superadmin.
            </p>

            <div>
              <label className="mb-1 block text-sm text-slate-300">
                WhatsApp Phone Number ID
              </label>
              <input
                type="text"
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                placeholder="917809738090702"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-300">
                Business Account ID (WABA)
              </label>
              <input
                type="text"
                value={wabaId}
                onChange={(e) => setWabaId(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                placeholder="892395053706370"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-300">
                Meta Access Token (System User Token)
              </label>
              <textarea
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                placeholder="EAAUfa8bZCpUkB..."
                rows={4}
              />
              {maskedToken && (
                <p className="mt-1 text-[10px] text-slate-500">
                  Aperçu token : <span className="font-mono">{maskedToken}</span>
                </p>
              )}
            </div>

            {error && (
              <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-sm text-rose-400">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-sm text-emerald-300">
                {success}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                variant="primary"
                size="md"
                loading={loading}
                icon={loading ? undefined : "💾"}
                onClick={handleSave}
                className="flex-1"
              >
                Enregistrer
              </Button>
              <Button
                variant="secondary"
                size="md"
                icon="❌"
                onClick={onClose}
              >
                Fermer
              </Button>
            </div>
          </div>
        </SectionCard>
      </motion.div>
    </motion.div>
  );
}
