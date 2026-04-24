"use client";

import { Building2, Users, MessageSquare, Database, TrendingUp, AlertTriangle } from "lucide-react";
import SectionCard from "@/src/components/ui/SectionCard";

type Props = {
  stats: any;
};

export default function AdminStatsCards({ stats }: Props) {
  const overview = stats?.overview || {};

  const cards = [
    {
      label: "Tenants totaux",
      value: overview.totalTenants || 0,
      icon: Building2,
      color: "indigo",
      subtitle: `${overview.activeTenants || 0} actifs${overview.suspendedTenants ? ` · ${overview.suspendedTenants} suspendus` : ""}`,
    },
    {
      label: "Utilisateurs actifs",
      value: overview.totalUsers || 0,
      icon: Users,
      color: "emerald",
      subtitle: "Tous les tenants",
    },
    {
      label: "Messages (24h)",
      value: overview.recentMessages || 0,
      icon: MessageSquare,
      color: "rose",
      subtitle: `${overview.totalMessages || 0} au total · ${overview.totalConversations || 0} conversations`,
    },
    {
      label: "Sources RAG",
      value: overview.totalRAGSources || 0,
      icon: Database,
      color: "amber",
      subtitle: "Documents indexés",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const colorClasses = {
          indigo: "text-indigo-400 bg-indigo-500/10 border-indigo-500/30",
          emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
          rose: "text-rose-400 bg-rose-500/10 border-rose-500/30",
          amber: "text-amber-400 bg-amber-500/10 border-amber-500/30",
        };

        return (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-800 bg-[#0b101d] p-5 transition hover:border-slate-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-400">
                  {card.label}
                </div>
                <div className="mt-2 text-3xl font-bold text-white">{card.value}</div>
                <div className="mt-1 text-xs text-slate-500">{card.subtitle}</div>
              </div>
              <div
                className={`rounded-xl border p-3 ${colorClasses[card.color as keyof typeof colorClasses]}`}
              >
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
