"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";

type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export default function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: Props) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
    >
      <div className="space-y-3">
        {eyebrow ? (
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400 text-aurora">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="text-3xl font-bold leading-tight text-aurora">
          {title}
        </h1>
        {subtitle ? (
          <p className="text-base leading-relaxed text-slate-300 text-aurora">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex gap-3">{actions}</div> : null}
    </motion.header>
  );
}
