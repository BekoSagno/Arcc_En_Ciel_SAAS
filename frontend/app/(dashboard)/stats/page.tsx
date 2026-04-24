"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { io, Socket } from "socket.io-client";
import SectionCard from "@/src/components/ui/SectionCard";
import StatCard from "@/src/components/ui/StatCard";
import PageHeader from "@/src/components/ui/PageHeader";

export default function StatsPage() {
  const { data: session } = useSession();
  const tenantId = session?.user?.tenantId;
  const backendUrl = useMemo(
    () => process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000",
    []
  );
  const socketRef = useRef<Socket | null>(null);

  const [kpis, setKpis] = useState([
    { label: "Messages resolus par IA", value: "0" },
    { label: "Temps moyen reponse", value: "0s" },
    { label: "Revenu potentiel", value: "0 GNF" },
  ]);
  const [channels, setChannels] = useState<Array<{ name: string; value: string }>>([]);
  const [aiQuality, setAiQuality] = useState({
    ragAccuracy: 0,
    escalades: 0,
    conversions: 0,
  });
  const [iaConsumption, setIaConsumption] = useState<
    Array<{ date: string; messages: number; tokens: number; costUsd: number }>
  >([]);
  const [quota, setQuota] = useState<{ quota: number | null; used: number; percent: number | null } | null>(null);
  const [iaToday, setIaToday] = useState<{ messagesToday: number; tokensToday: number }>({
    messagesToday: 0,
    tokensToday: 0,
  });
  const [loading, setLoading] = useState(true);
  const TOKEN_TO_FNG = 0.0001; // 100 tokens = 0.01 FNG

  const loadStats = useCallback(async () => {
    if (!tenantId) return;
    try {
      const headers = {
        "x-tenant-id": tenantId,
      };

      const [metricsRes, channelsRes, aiIndicatorsRes, iaConsumptionRes, iaQuotaRes, iaTodayRes] = await Promise.all([
        fetch(`${backendUrl}/api/metrics/overview`, { headers, cache: "no-store" }),
        fetch(`${backendUrl}/api/metrics/channels`, { headers, cache: "no-store" }),
        fetch(`${backendUrl}/api/metrics/ai-indicators`, { headers, cache: "no-store" }),
        fetch(`${backendUrl}/api/metrics/ia-consumption?days=30`, { headers, cache: "no-store" }),
        fetch(`${backendUrl}/api/metrics/ia-quota`, { headers, cache: "no-store" }),
        fetch(`${backendUrl}/api/metrics/ia-today`, { headers, cache: "no-store" }),
      ]);

      if (metricsRes.ok) {
        const metrics = await metricsRes.json();
        const data = metrics.data;
        const resolvedMessages = data.messagesToday || 0;
        const responseTime = data.responseRate
          ? `${Math.max(5, 15 - Math.round(data.responseRate / 10))}s`
          : "0s";

        setKpis([
          { label: "Messages resolus par IA", value: String(resolvedMessages) },
          { label: "Temps moyen reponse", value: responseTime },
          { label: "Revenu potentiel", value: "0 GNF" },
        ]);
      }

      if (channelsRes.ok) {
        const channelData = await channelsRes.json();
        const items = channelData.data || [];
        const total = items.reduce((sum: number, item: any) => sum + (item.count || 0), 0);
        const mapped = total
          ? items.map((item: any) => ({
              name: item.channel,
              value: `${Math.round((item.count / total) * 100)}%`,
            }))
          : [];
        setChannels(mapped);
      }

      if (aiIndicatorsRes.ok) {
        const aiData = await aiIndicatorsRes.json();
        setAiQuality({
          ragAccuracy: aiData.data.ragAccuracy || 0,
          escalades: aiData.data.manualConversations || 0,
          conversions: 0, // À calculer si nécessaire
        });
      }

      if (iaConsumptionRes.ok) {
        const json = await iaConsumptionRes.json();
        const list = json.data || [];
        // Afficher le plus récent en haut
        setIaConsumption(list.slice().reverse());
      }

      if (iaQuotaRes.ok) {
        const json = await iaQuotaRes.json();
        setQuota({
          quota: json.data.quota === 0 ? null : json.data.quota,
          used: json.data.used || 0,
          percent: json.data.percent,
        });
      }

      if (iaTodayRes.ok) {
        const json = await iaTodayRes.json();
        setIaToday({
          messagesToday: json.data.messagesToday || 0,
          tokensToday: json.data.tokensToday || 0,
        });
      }
    } catch (error) {
      console.error("Erreur chargement stats:", error);
    } finally {
      setLoading(false);
    }
  }, [backendUrl, tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    loadStats();
  }, [tenantId, loadStats]);

  // Temps réel via Socket.io : rafraîchir dès qu'un nouveau message arrive ou qu'une conversation est mise à jour
  useEffect(() => {
    if (!tenantId) return;
    const socket = io(backendUrl, {
      transports: ["websocket"],
      query: { tenantId },
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[STATS] Socket.io connecté", socket.id);
    });

    const refresh = async () => {
      await loadStats();
    };

    socket.on("new_message", refresh);
    socket.on("conversation_updated", refresh);

    socket.on("disconnect", () => {
      console.log("[STATS] Socket.io déconnecté");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [tenantId, backendUrl, loadStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-400">Chargement des statistiques...</div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Analytiques"
        title="Statistiques & Monitoring"
        subtitle="Suivi des performances multi-canaux et impact commercial (coût estimé en FNG)."
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mt-8 space-y-8"
      >
        <section className="grid gap-4 lg:grid-cols-3">
          {kpis.map((kpi, index) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <StatCard label={kpi.label} value={kpi.value} />
            </motion.div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SectionCard title="Répartition des canaux">
              <div className="space-y-3">
                {channels.length === 0 ? (
                  <div className="py-6 text-sm text-slate-400 text-center">
                    Aucune donnée de canal disponible.
                  </div>
                ) : (
                  channels.map((channel, index) => (
                    <motion.div
                      key={channel.name}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#161b22] px-4 py-3 text-sm text-slate-200 hover:border-slate-700 transition-colors"
                    >
                      <span>{channel.name}</span>
                      <span className="font-semibold text-white">
                        {channel.value}
                      </span>
                    </motion.div>
                  ))
                )}
              </div>
            </SectionCard>
          </div>
          <SectionCard title="Qualité IA">
            <ul className="space-y-4 text-sm text-slate-300">
              <li className="flex items-center justify-between">
                <span>Précision RAG</span>
                <span className="font-semibold text-purple-400">
                  {aiQuality.ragAccuracy}%
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span>Escalades humaines</span>
                <span className="font-semibold text-amber-400">
                  {aiQuality.escalades}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span>Conversions issues IA</span>
                <span className="font-semibold text-emerald-400">
                  {aiQuality.conversions}
                </span>
              </li>
            </ul>
          </SectionCard>
        </section>

        <SectionCard title="Consommation IA (30 derniers jours)">
          {iaConsumption.length === 0 ? (
            <div className="py-6 text-sm text-slate-400 text-center">
              Aucune donnée disponible pour l'instant.
            </div>
          ) : (
            <>
              {/* Graphiques simples (sans dépendance externe) */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Graphe Messages */}
                <div className="rounded-xl border border-slate-800 bg-[#0f1424] p-4">
                  <div className="text-sm font-semibold text-white mb-3">Messages IA</div>
                  <div className="space-y-2">
                    {(() => {
                      const asc = iaConsumption.slice().reverse();
                      const max = Math.max(...asc.map((d) => d.messages || 0), 1);
                      return asc.map((d) => {
                        const pct = Math.max(2, Math.round(((d.messages || 0) / max) * 100));
                        return (
                          <div key={`msg-${d.date}`} className="space-y-1">
                            <div className="flex justify-between text-xs text-slate-400">
                              <span>{d.date}</span>
                              <span className="text-slate-200 font-semibold">{d.messages} msg</span>
                            </div>
                            <div className="h-2 rounded bg-slate-900 overflow-hidden">
                              <div
                                className="h-2 bg-gradient-to-r from-indigo-500 to-cyan-400"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Graphe Tokens */}
                <div className="rounded-xl border border-slate-800 bg-[#0f1424] p-4">
                  <div className="text-sm font-semibold text-white mb-3">Tokens (≈ coût FNG)</div>
                  <div className="space-y-2">
                    {(() => {
                      const asc = iaConsumption.slice().reverse();
                      const max = Math.max(...asc.map((d) => d.tokens || 0), 1);
                      return asc.map((d) => {
                        const pct = Math.max(2, Math.round(((d.tokens || 0) / max) * 100));
                        const costFng = ((d.tokens || 0) * TOKEN_TO_FNG).toFixed(4);
                        return (
                          <div key={`tok-${d.date}`} className="space-y-1">
                            <div className="flex justify-between text-xs text-slate-400">
                              <span>{d.date}</span>
                              <span className="text-slate-200 font-semibold">
                                {d.tokens} tok · {costFng} FNG
                              </span>
                            </div>
                            <div className="h-2 rounded bg-slate-900 overflow-hidden">
                              <div
                                className="h-2 bg-gradient-to-r from-emerald-500 to-lime-400"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>

              {/* Liste détaillée (plus récent en haut) */}
              <div className="mt-6 space-y-2 text-sm text-slate-200">
                {iaConsumption.map((d) => (
                  <div
                    key={d.date}
                    className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#161b22] px-4 py-2"
                  >
                    <span className="text-slate-300">{d.date}</span>
                    <div className="flex gap-4 text-xs">
                      <span className="text-white font-semibold">{d.messages} msg IA</span>
                      <span className="text-slate-400">{d.tokens} tokens</span>
                      <span className="text-slate-500">
                        {( (d.tokens || 0) * TOKEN_TO_FNG ).toFixed(4)} FNG
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </SectionCard>

        <SectionCard title="Quota IA">
          {quota ? (
            <div className="space-y-2 text-sm text-slate-200">
              <div className="flex items-center justify-between">
                <span>Consommé</span>
                <span className="font-semibold text-white">
                  {quota.used}
                  {quota.quota ? ` / ${quota.quota}` : " (illimité)"}
                </span>
              </div>
              {quota.percent !== null && (
                <div className="w-full h-2 rounded bg-slate-800 overflow-hidden">
                  <div
                    className="h-2 rounded bg-indigo-500 transition-all"
                    style={{ width: `${quota.percent}%` }}
                  />
                </div>
              )}
              {quota.percent !== null && (
                <div className="text-xs text-slate-400">Utilisation : {quota.percent}%</div>
              )}
            </div>
          ) : (
            <div className="py-6 text-sm text-slate-400 text-center">Aucun quota configuré (illimité).</div>
          )}
        </SectionCard>

        <SectionCard title="Aujourd'hui">
          <div className="flex flex-col gap-2 text-sm text-slate-200">
            <div className="flex items-center justify-between">
              <span>Messages IA envoyés</span>
              <span className="font-semibold text-white">{iaToday.messagesToday}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Tokens consommés</span>
              <span className="font-semibold text-white">{iaToday.tokensToday}</span>
            </div>
          </div>
        </SectionCard>
      </motion.div>
    </>
  );
}
