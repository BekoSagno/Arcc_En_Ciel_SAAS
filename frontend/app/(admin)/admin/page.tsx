"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import SectionCard from "@/src/components/ui/SectionCard";
import StatusBadge from "@/src/components/ui/StatusBadge";
import AdminStatsCards from "@/src/components/admin/AdminStatsCards";
import TenantList from "@/src/components/admin/TenantList";
import SystemLogs from "@/src/components/admin/SystemLogs";
import { Users, Building2, MessageSquare, Database, Plus } from "lucide-react";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"overview" | "tenants" | "logs">("overview");
  const [stats, setStats] = useState<any>(null);
  const [iaConsumption, setIaConsumption] = useState<
    Array<{ tenantId: string; tenantName: string; messages: number; tokens: number; costUsd: number }>
  >([]);
  const [iaQuotas, setIaQuotas] = useState<
    Array<{ tenantId: string; tenantName: string; quota: number | null; used: number; remaining: number | null; percent: number | null }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const loadStats = useCallback(async () => {
    try {
      const response = await fetch(`${backendUrl}/api/admin/stats`, {
        headers: {
          "x-user-email": session?.user?.email || "",
          "x-user-role": session?.user?.role || "",
        },
        cache: "no-store",
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
      }

      // Consommation IA globale
      const iaRes = await fetch(`${backendUrl}/api/admin/metrics/ia-consumption?days=30`, {
        headers: {
          "x-user-email": session?.user?.email || "",
          "x-user-role": session?.user?.role || "",
        },
        cache: "no-store",
      });
      if (iaRes.ok) {
        const json = await iaRes.json();
        setIaConsumption(json.data || []);
      }

      // Quotas IA par tenant
      const quotaRes = await fetch(`${backendUrl}/api/admin/metrics/ia-quotas`, {
        headers: {
          "x-user-email": session?.user?.email || "",
          "x-user-role": session?.user?.role || "",
        },
        cache: "no-store",
      });
      if (quotaRes.ok) {
        const json = await quotaRes.json();
        setIaQuotas(json.data || []);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des stats:", error);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.email, session?.user?.role]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated" && session?.user?.role !== "SUPERADMIN") {
      router.push("/dashboard");
      return;
    }

    if (status === "authenticated") {
      loadStats();

      // Polling automatique toutes les 10 secondes pour synchronisation en temps réel
      const interval = setInterval(() => {
        loadStats();
        setLastUpdate(new Date());
      }, 10000); // 10 secondes

      return () => clearInterval(interval);
    }
  }, [status, session, router, loadStats]);

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-slate-400">Chargement...</div>
      </div>
    );
  }

  if (session?.user?.role !== "SUPERADMIN") {
    return null;
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Tableau de bord Super Admin</h2>
          <p className="mt-1 text-sm text-slate-400">
            Gestion complète du système multi-tenant
            {lastUpdate && (
              <span className="ml-2 text-xs text-slate-500">
                · Dernière mise à jour: {lastUpdate.toLocaleTimeString("fr-FR")}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("overview")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === "overview"
                ? "bg-indigo-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            Vue d'ensemble
          </button>
          <button
            onClick={() => setActiveTab("tenants")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === "tenants"
                ? "bg-indigo-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            Tenants
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === "logs"
                ? "bg-indigo-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            Logs système
          </button>
          </div>
        </div>
      </div>

      {activeTab === "overview" && (
        <>
          <AdminStatsCards stats={stats} />
          {iaConsumption.length > 0 && (
            <SectionCard title="Consommation IA (30 jours) – Top tenants">
              <div className="space-y-3">
                {iaConsumption.map((t) => (
                  <div
                    key={t.tenantId}
                    className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#161b22] px-4 py-3 text-sm text-slate-200"
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold text-white">{t.tenantName}</span>
                      <span className="text-xs text-slate-500">{t.tenantId}</span>
                    </div>
                    <div className="flex gap-4 text-xs">
                      <span className="text-white font-semibold">{t.messages} msg IA</span>
                      <span className="text-slate-400">{t.tokens} tokens</span>
                      <span className="text-slate-500">${t.costUsd?.toFixed(4) || "0.0000"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
          {iaQuotas.length > 0 && (
            <SectionCard title="Quotas IA par tenant (mois en cours)">
              <div className="space-y-3">
                {iaQuotas.map((t) => (
                  <div
                    key={t.tenantId}
                    className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#161b22] px-4 py-3 text-sm text-slate-200"
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold text-white">{t.tenantName}</span>
                      <span className="text-xs text-slate-500">{t.tenantId}</span>
                    </div>
                    <div className="flex flex-col items-end text-xs">
                      <span className="text-white font-semibold">
                        {t.used}
                        {t.quota ? ` / ${t.quota}` : " (illimité)"}
                      </span>
                      {t.percent !== null && (
                        <div className="w-32 h-2 mt-1 rounded bg-slate-800 overflow-hidden">
                          <div
                            className="h-2 rounded bg-indigo-500"
                            style={{ width: `${t.percent}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
          {stats?.topTenants && stats.topTenants.length > 0 && (
            <SectionCard title="Top 10 Tenants par activité">
              <div className="space-y-3">
                {stats.topTenants.map((tenant: any) => (
                  <div
                    key={tenant.id}
                    className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#161b22] px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <Building2 className="h-4 w-4 text-indigo-400" />
                      <div>
                        <div className="text-sm font-semibold text-white">{tenant.name}</div>
                        <div className="text-xs text-slate-400">
                          {tenant.conversations} conversations · {tenant.messages} messages ·{" "}
                          {tenant.users} utilisateurs
                        </div>
                      </div>
                    </div>
                    <StatusBadge
                      label={tenant.status}
                      tone={tenant.status === "active" ? "success" : "warning"}
                    />
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </>
      )}

      {activeTab === "tenants" && <TenantList session={session} />}

      {activeTab === "logs" && <SystemLogs />}
    </>
  );
}
