"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import SectionCard from "@/src/components/ui/SectionCard";
import StatusBadge from "@/src/components/ui/StatusBadge";
import Button from "@/src/components/ui/Button";
import AdminStatsCards from "@/src/components/admin/AdminStatsCards";
import TenantList from "@/src/components/admin/TenantList";
import BillingOverview from "@/src/components/admin/BillingOverview";
import SystemLogs from "@/src/components/admin/SystemLogs";
import { Building2 } from "lucide-react";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"overview" | "tenants" | "billing" | "logs">("overview");
  const [stats, setStats] = useState<any>(null);
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
      router.push("/");
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
          <Button
            variant={activeTab === "overview" ? "primary" : "secondary"}
            size="md"
            icon="📊"
            onClick={() => setActiveTab("overview")}
          >
            Vue d'ensemble
          </Button>
          <Button
            variant={activeTab === "tenants" ? "primary" : "secondary"}
            size="md"
            icon="🏢"
            onClick={() => setActiveTab("tenants")}
          >
            Tenants
          </Button>
          <Button
            variant={activeTab === "billing" ? "primary" : "secondary"}
            size="md"
            icon="💰"
            onClick={() => setActiveTab("billing")}
          >
            Facturation
          </Button>
          <Button
            variant={activeTab === "logs" ? "primary" : "secondary"}
            size="md"
            icon="📋"
            onClick={() => setActiveTab("logs")}
          >
            Logs système
          </Button>
        </div>
      </div>

      {activeTab === "overview" && (
        <>
          <AdminStatsCards stats={stats} />
          {stats?.topTenants && stats.topTenants.length > 0 && (
            <SectionCard title="Top 10 Tenants par activité">
              <div className="space-y-3">
                {stats.topTenants.map((tenant: any, index: number) => (
                  <motion.div
                    key={tenant.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#161b22] px-4 py-3 hover:border-slate-700 transition-all duration-200"
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
                  </motion.div>
                ))}
              </div>
            </SectionCard>
          )}
        </>
      )}

      {activeTab === "tenants" && <TenantList session={session} />}

      {activeTab === "billing" && <BillingOverview session={session} />}

      {activeTab === "logs" && <SystemLogs />}
    </>
  );
}
