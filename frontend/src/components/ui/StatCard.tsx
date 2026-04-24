"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";

type Props = {
  label: string;
  value: string;
  delta?: string;
  icon?: ReactNode;
};

export default function StatCard({ label, value, delta, icon }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -3 }}
      className="group interactive-glow interactive-raise rounded-2xl border border-slate-800/80 bg-[#0b101d] p-6 shadow-[0_20px_60px_rgba(2,6,23,0.45)] transition hover:border-indigo-500/30"
    >
      <div className="flex items-center justify-between mb-4 text-xs font-medium uppercase tracking-[0.15em] text-slate-400">
        {label}
        <span className="text-slate-500 transition group-hover:text-indigo-300">
          {icon}
        </span>
      </div>
      <div className="mb-2 text-3xl font-bold text-white">{value}</div>
      {delta ? (
        <div className="mt-3 text-xs font-medium text-emerald-400">{delta}</div>
      ) : null}
    </motion.div>
  );
}
