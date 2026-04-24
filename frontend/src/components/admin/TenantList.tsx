"use client";

import { useState, useEffect } from "react";
import SectionCard from "@/src/components/ui/SectionCard";
import StatusBadge from "@/src/components/ui/StatusBadge";
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
  const [updatingSubscription, setUpdatingSubscription] = useState(false);

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
        // Rafraîchir immédiatement après modification
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

  const handleActivateSubscription = async (tenant: any) => {
    const planType = prompt(
      `Plan pour ${tenant.name} (starter, pro, enterprise):`,
      tenant.planType || "starter",
    );
    if (!planType) return;

    const billingCycle = prompt(
      "Cycle de facturation (monthly, annual):",
      "monthly",
    );
    if (!billingCycle) return;

    const priceInput = prompt(
      "Montant payé (en GNF) pour cet abonnement (ex: 150000):",
      "0",
    );
    const priceGnf = priceInput ? parseFloat(priceInput) : 0;

    setUpdatingSubscription(true);
    try {
      const response = await fetch(
        `${backendUrl}/api/admin/tenants/${tenant.id}/subscription`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-email": session?.user?.email || "",
            "x-user-role": session?.user?.role || "",
          },
          body: JSON.stringify({
            planType,
            billingCycle,
            priceGnf: isNaN(priceGnf) ? 0 : priceGnf,
          }),
        },
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        console.error(
          "Erreur activation abonnement:",
          err.error || "inconnue",
        );
        alert(
          err.error ||
            "Erreur lors de l'activation de l'abonnement pour ce tenant.",
        );
      } else {
        alert("Abonnement activé / mis à jour avec succès.");
        await loadTenants();
      }
    } catch (error) {
      console.error("Erreur activation abonnement:", error);
      alert(
        "Erreur lors de l'activation de l'abonnement. Vérifiez votre connexion.",
      );
    } finally {
      setUpdatingSubscription(false);
    }
  };

  if (loading) {
    return <div className="text-slate-400">Chargement des tenants...</div>;
  }

  return (
    <>
      <SectionCard
        title="Gestion des Tenants"
        action={
          <button
            onClick={() => {
              setEditingTenant(null);
              setShowForm(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Nouveau tenant
          </button>
        }
      >
        <div className="space-y-3">
          {tenants.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              Aucun tenant enregistré. Créez-en un pour commencer.
            </div>
          ) : (
            tenants.map((tenant) => (
              <div
                key={tenant.id}
                className="rounded-xl border border-slate-800 bg-[#161b22] px-4 py-3"
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
                        {tenant.planType && (
                          <>
                            <span className="text-slate-600">·</span>
                            <span className="text-slate-400">
                              Plan: {tenant.planType}
                            </span>
                          </>
                        )}
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
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleViewUsers(tenant.id)}
                        className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-300 transition hover:bg-slate-700 hover:text-white"
                        title="Gérer les utilisateurs"
                      >
                        <Users className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(tenant)}
                        className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-300 transition hover:bg-slate-700 hover:text-white"
                        title="Modifier"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <select
                        value={tenant.status}
                        onChange={(e) => handleStatusChange(tenant.id, e.target.value)}
                        className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300 transition hover:bg-slate-700"
                      >
                        <option value="active">Actif</option>
                        <option value="suspended">Suspendu</option>
                        <option value="inactive">Inactif</option>
                      </select>
                      <button
                        onClick={() => handleActivateSubscription(tenant)}
                        className="rounded-lg border border-emerald-600 bg-emerald-700/20 px-2 py-1 text-xs font-medium text-emerald-300 transition hover:bg-emerald-600/40"
                        disabled={updatingSubscription}
                        title="Activer / modifier l'abonnement"
                      >
                        {updatingSubscription ? "Abonnement..." : "Abonnement"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
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
    </>
  );
}
