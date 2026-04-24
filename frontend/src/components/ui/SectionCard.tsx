"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";

type Props = {
  title: string;
  children: ReactNode;
  action?: ReactNode;
};

export default function SectionCard({ title, children, action }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      whileHover={{ y: -2 }}
      className="interactive-glow interactive-raise rounded-2xl border border-slate-800/80 bg-[#0b101d] shadow-[0_20px_60px_rgba(2,6,23,0.45)] transition hover:border-indigo-500/30"
    >
      <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {action}
      </div>
      <div className="px-6 py-5">{children}</div>
    </motion.div>
  );
}
