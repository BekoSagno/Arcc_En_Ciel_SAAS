"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Activity, Bot, MessageSquare, Users } from "lucide-react";
import clsx from "clsx";
import SectionCard from "../ui/SectionCard";
import StatCard from "../ui/StatCard";
import StatusBadge from "../ui/StatusBadge";

const tabs = ["Overview", "RAG", "Channels", "Settings"] as const;

const stats = [
  { label: "Conversations actives", value: "26", icon: <Users size={16} /> },
  { label: "Messages aujourd'hui", value: "342", icon: <MessageSquare size={16} /> },
  { label: "Taux reponse IA", value: "92%", icon: <Bot size={16} /> },
  { label: "Tickets humains", value: "4", icon: <Activity size={16} /> },
];

const activity = [
  {
    title: "WhatsApp · Boutique A",
    description: "Demande de prix, suivi en manuel",
    time: "Il y a 5 min",
    tone: "warning" as const,
  },
  {
    title: "Messenger · Boutique B",
    description: "IA a repondu sur le catalogue",
    time: "Il y a 12 min",
    tone: "success" as const,
  },
  {
    title: "Facebook Commentaire",
    description: "Transition vers DM",
    time: "Il y a 38 min",
    tone: "info" as const,
  },
];

export default function DashboardOverview() {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Overview");

  return (
    <>
      <header className="flex flex-col gap-3">
        <div className="text-xs uppercase tracking-[0.3em] text-indigo-300">
          Dashboard Client
        </div>
        <h1 className="text-3xl font-bold text-transparent bg-gradient-to-r from-white to-slate-400 bg-clip-text">
          Vue d&apos;ensemble intelligente
        </h1>
        <p className="text-sm text-slate-400">
          Supervision des conversations, performances IA et canaux.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={clsx(
              "rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition",
              activeTab === tab
                ? "border-indigo-500/50 bg-indigo-600/20 text-indigo-200"
                : "border-slate-800 text-slate-400 hover:border-indigo-500/30"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        {activeTab === "Overview" ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                <SectionCard title="Activite recente">
                  <div className="space-y-4">
                    {activity.map((item) => (
                      <div
                        key={item.title}
                        className="rounded-xl border border-slate-800 bg-[#161b22] px-4 py-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium text-white">
                            {item.title}
                          </div>
                          <StatusBadge label={item.tone} tone={item.tone} />
                        </div>
                        <div className="text-xs text-slate-400">
                          {item.description}
                        </div>
                        <div className="mt-2 text-[11px] text-slate-500">
                          {item.time}
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </div>
              <SectionCard title="Indicateurs IA">
                <ul className="space-y-3 text-sm text-slate-300">
                  <li>Mode manuel actif: 4 conversations</li>
                  <li>Temps moyen reponse: 9s</li>
                  <li>Relances apres 24h: 6</li>
                  <li>Precision RAG: 94%</li>
                </ul>
              </SectionCard>
            </section>
          </>
        ) : null}

        {activeTab === "RAG" ? (
          <SectionCard title="Memoire active">
            <div className="grid gap-4 md:grid-cols-3">
              <StatCard label="Sources indexees" value="12" delta="+3 cette semaine" />
              <StatCard label="Chunks" value="4 820" delta="Derniere sync: 2h" />
              <StatCard label="Precision RAG" value="94%" />
            </div>
          </SectionCard>
        ) : null}

        {activeTab === "Channels" ? (
          <SectionCard title="Canaux connectes">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-[#161b22] px-4 py-3">
                <div className="text-sm font-semibold text-white">WhatsApp</div>
                <div className="text-xs text-slate-400">Actif</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-[#161b22] px-4 py-3">
                <div className="text-sm font-semibold text-white">Messenger</div>
                <div className="text-xs text-slate-400">Actif</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-[#161b22] px-4 py-3">
                <div className="text-sm font-semibold text-white">Facebook</div>
                <div className="text-xs text-slate-400">En attente</div>
              </div>
            </div>
          </SectionCard>
        ) : null}

        {activeTab === "Settings" ? (
          <SectionCard title="Configuration">
            <div className="space-y-3 text-sm text-slate-300">
              <div>Mode IA: GPT-4o-mini</div>
              <div>Handoff humain: actif</div>
              <div>Timezone: Africa/Conakry</div>
            </div>
          </SectionCard>
        ) : null}
      </motion.div>
    </>
  );
}
