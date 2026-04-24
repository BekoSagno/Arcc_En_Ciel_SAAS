"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { io, Socket } from "socket.io-client";
import SectionCard from "@/src/components/ui/SectionCard";
import PageHeader from "@/src/components/ui/PageHeader";

type DayRow = { date: string; messages: number; tokens: number; costUsd: number };

export default function UsagePage() {
  const { data: session } = useSession();
  const tenantId = session?.user?.tenantId;
  const backendUrl = useMemo(
    () => process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000",
    []
  );
  const socketRef = useRef<Socket | null>(null);

  const [rows, setRows] = useState<DayRow[]>([]);
  const [totals, setTotals] = useState<{ messages: number; tokens: number; costUsd: number } | null>(null);
  const [loading, setLoading] = useState(true);
const TOKEN_TO_FNG = 0.0001; // 100 tokens = 0.01 FNG

  const loadUsage = useCallback(async () => {
    if (!tenantId) return;
    const headers = { "x-tenant-id": tenantId };
    try {
      const res = await fetch(`${backendUrl}/api/metrics/ia-usage?days=30`, { headers, cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
      const list = json.data.byDay || [];
      // Afficher le plus récent en haut
      setRows(list.slice().reverse());
      setTotals(json.data.totals || null);
      }
    } catch (err) {
      console.error("[USAGE] erreur chargement:", err);
    } finally {
      setLoading(false);
    }
  }, [backendUrl, tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    loadUsage();
  }, [tenantId, loadUsage]);

  // Temps réel via Socket.io : on recharge l'usage dès qu'un nouveau message est émis
  useEffect(() => {
    if (!tenantId) return;
    const socket = io(backendUrl, {
      transports: ["websocket"],
      query: { tenantId },
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[USAGE] Socket.io connecté", socket.id);
    });

    socket.on("new_message", async () => {
      await loadUsage();
    });

    socket.on("disconnect", () => {
      console.log("[USAGE] Socket.io déconnecté");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [tenantId, backendUrl, loadUsage]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400">
        Chargement de l'usage...
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Facturation & Usage"
        title="Usage IA et Tokens"
        subtitle="Suivi détaillé quotidien (messages IA, tokens, coût estimé en FNG)."
      />

      <div className="mt-8 space-y-6">
        <SectionCard title="Totaux sur 30 jours">
          {totals ? (
            <div className="grid grid-cols-3 gap-4 text-sm text-slate-200">
              <div className="rounded-xl border border-slate-800 bg-[#161b22] p-4">
                <div className="text-slate-400 text-xs uppercase">Messages IA</div>
                <div className="text-xl font-semibold text-white">{totals.messages}</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-[#161b22] p-4">
                <div className="text-slate-400 text-xs uppercase">Tokens</div>
                <div className="text-xl font-semibold text-white">{totals.tokens}</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-[#161b22] p-4">
                <div className="text-slate-400 text-xs uppercase">Coût estimé (FNG)</div>
                <div className="text-xl font-semibold text-white">
                  {(totals.tokens * TOKEN_TO_FNG || 0).toFixed(4)} FNG
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-400">Aucune donnée.</div>
          )}
        </SectionCard>

        <SectionCard title="Détail quotidien (30 jours)">
          {rows.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-400">Aucune donnée.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-slate-200">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2 text-left">Date</th>
                    <th className="py-2 text-right">Messages IA</th>
                    <th className="py-2 text-right">Tokens</th>
                    <th className="py-2 text-right">Coût estimé (FNG)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.date} className="border-b border-slate-900">
                      <td className="py-2">{r.date}</td>
                      <td className="py-2 text-right">{r.messages}</td>
                      <td className="py-2 text-right">{r.tokens}</td>
                      <td className="py-2 text-right">
                        {( (r.tokens || 0) * TOKEN_TO_FNG ).toFixed(4)} FNG
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </>
  );
}
