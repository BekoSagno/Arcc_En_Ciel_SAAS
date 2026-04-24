"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Activity, Bot, MessageSquare, Users } from "lucide-react";
import SectionCard from "../ui/SectionCard";
import StatCard from "../ui/StatCard";
import StatusBadge from "../ui/StatusBadge";
import PageHeader from "../ui/PageHeader";

// Données par défaut pour l'initialisation - remplacées par les données réelles du backend
const defaultStats = [
  { label: "Conversations actives", value: "0", icon: <Users size={16} /> },
  { label: "Messages aujourd'hui", value: "0", icon: <MessageSquare size={16} /> },
  { label: "Taux de réponse IA", value: "0%", icon: <Bot size={16} /> },
  { label: "Tickets humains", value: "0", icon: <Activity size={16} /> },
];

export default function DashboardOverview() {
  const { data: session } = useSession();
  const [stats, setStats] = useState(defaultStats);
  const [recent, setRecent] = useState<Array<{
    title: string;
    description: string;
    time: string;
    tone: "warning" | "success" | "info";
  }>>([]);
  const [aiIndicators, setAiIndicators] = useState({
    manualConversations: 0,
    avgResponseTimeSeconds: 0,
    reminders24h: 0,
    ragAccuracy: 0,
  });
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
  const tenantLabel =
    session?.user?.tenantName ||
    (session?.user?.tenantId
      ? `Tenant ${session.user.tenantId.slice(0, 8)}`
      : "Votre boutique");

  const tenantId = session?.user?.tenantId;

  useEffect(() => {
    if (!tenantId) return;

    const load = async () => {
      try {
        const headers = {
          "x-tenant-id": tenantId,
        };

        const [metricsRes, recentRes, aiIndicatorsRes] = await Promise.all([
          fetch(`${backendUrl}/api/metrics/overview`, { headers }),
          fetch(`${backendUrl}/api/conversations/recent`, { headers }),
          fetch(`${backendUrl}/api/metrics/ai-indicators`, { headers }),
        ]);

        if (metricsRes.ok) {
          const metrics = await metricsRes.json();
          const data = metrics.data;
          setStats([
            {
              label: "Conversations actives",
              value: String(data.activeConversations ?? 0),
              icon: <Users size={16} />,
            },
            {
              label: "Messages aujourd'hui",
              value: String(data.messagesToday ?? 0),
              icon: <MessageSquare size={16} />,
            },
            {
              label: "Taux de réponse IA",
              value: `${data.responseRate ?? 0}%`,
              icon: <Bot size={16} />,
            },
            {
              label: "Tickets humains",
              value: String(data.manualConversations ?? 0),
              icon: <Activity size={16} />,
            },
          ]);
        }

        if (recentRes.ok) {
          const recentJson = await recentRes.json();
          const items = recentJson.data || [];
          if (items.length) {
            setRecent(
              items.map((item) => ({
                title: `${item.channel} · ${item.customerHandle || "Client"}`,
                description: item.lastMessage || "Nouveau message",
                time: item.lastMessageAt
                  ? new Date(item.lastMessageAt).toLocaleString("fr-FR")
                  : "A l'instant",
                tone: item.status === "MANUAL_MODE" ? "warning" : "info",
              }))
            );
          } else {
            setRecent([]);
          }
        }

        if (aiIndicatorsRes.ok) {
          const aiData = await aiIndicatorsRes.json();
          setAiIndicators(aiData.data);
        }
      } catch (error) {
        console.error("Erreur chargement données:", error);
      }
    };

    load();
    
    // Rafraîchissement automatique toutes les 10 secondes
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [tenantId, backendUrl]);

  const [showWelcome, setShowWelcome] = useState(true);
  const [tenantInfo, setTenantInfo] = useState<{
    name: string;
    email: string;
  } | null>(null);

  useEffect(() => {
    if (session?.user) {
      setTenantInfo({
        name: session.user.tenantName || "Votre boutique",
        email: session.user.email || "",
      });
    }
  }, [session]);

  return (
    <>
      {showWelcome && tenantInfo && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 p-8"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <h2 className="text-2xl font-semibold text-white">
                Bienvenue, {tenantInfo.name} ! 🎉
              </h2>
              <p className="text-base text-slate-300 leading-relaxed">
                Votre dashboard est prêt. Votre IA est configurée et opérationnelle.
              </p>
              <div className="flex flex-wrap gap-6 pt-2 text-sm text-slate-400">
                <span className="flex items-center gap-2">
                  <span className="font-medium text-slate-500">Email :</span>
                  <span className="text-slate-300">{tenantInfo.email}</span>
                </span>
                {session?.user?.tenantId && (
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-slate-500">ID :</span>
                    <span className="text-slate-300">{session.user.tenantId.slice(0, 8)}...</span>
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowWelcome(false)}
              className="ml-4 rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            >
              ✕
            </button>
          </div>
        </motion.div>
      )}

      <PageHeader
        eyebrow="Dashboard Client"
        title={`Vue d'ensemble - ${tenantLabel}`}
        subtitle="Supervision des conversations, performances IA et canaux."
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mt-8 space-y-8"
      >
        <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <StatCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              icon={<span className="text-slate-500">{stat.icon}</span>}
            />
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SectionCard title="Activité récente">
              <div className="space-y-4">
                {recent.length === 0 ? (
                  <div className="py-6 text-sm text-slate-400 text-center">
                    Aucune activité récente.
                  </div>
                ) : (
                  recent.map((item, index) => (
                    <motion.div
                      key={`${item.title}-${index}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className="rounded-xl border border-slate-800 bg-[#161b22] px-5 py-4 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium text-white">
                          {item.title}
                        </div>
                        <StatusBadge label={item.tone} tone={item.tone} />
                      </div>
                      <div className="text-sm text-slate-300 mb-1">
                        {item.description}
                      </div>
                      <div className="text-xs text-slate-500">
                        {item.time}
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </SectionCard>
          </div>
          <SectionCard title="Indicateurs IA">
            <ul className="space-y-4 text-sm text-slate-300">
              <li className="flex items-center justify-between">
                <span>Mode manuel actif</span>
                <span className="font-semibold text-indigo-400">
                  {aiIndicators.manualConversations} conversation{aiIndicators.manualConversations !== 1 ? "s" : ""}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span>Temps moyen de réponse</span>
                <span className="font-semibold text-emerald-400">
                  {aiIndicators.avgResponseTimeSeconds > 0 ? `${aiIndicators.avgResponseTimeSeconds}s` : "N/A"}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span>Relances après 24h</span>
                <span className="font-semibold text-amber-400">
                  {aiIndicators.reminders24h}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span>Précision RAG</span>
                <span className="font-semibold text-purple-400">
                  {aiIndicators.ragAccuracy}%
                </span>
              </li>
            </ul>
          </SectionCard>
        </section>
      </motion.div>
    </>
  );
}
