"use client";

import clsx from "clsx";

type Props = {
  label: string;
  tone?: "success" | "warning" | "danger" | "info";
};

const toneClasses = {
  success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  warning: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  danger: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  info: "bg-indigo-500/10 text-indigo-300 border-indigo-500/30",
};

export default function StatusBadge({ label, tone = "info" }: Props) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-medium uppercase tracking-[0.2em]",
        toneClasses[tone]
      )}
    >
      {label}
    </span>
  );
}
