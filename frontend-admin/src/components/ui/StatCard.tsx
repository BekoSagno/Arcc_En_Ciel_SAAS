"use client";

import { ReactNode } from "react";

type Props = {
  label: string;
  value: string;
  delta?: string;
  icon?: ReactNode;
};

export default function StatCard({ label, value, delta, icon }: Props) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0b101d] p-5 shadow-[0_10px_30px_rgba(2,6,23,0.4)] transition hover:border-indigo-500/30">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-400">
        {label}
        {icon}
      </div>
      <div className="mt-4 text-3xl font-bold text-white">{value}</div>
      {delta ? (
        <div className="mt-2 text-xs text-emerald-400">{delta}</div>
      ) : null}
    </div>
  );
}
