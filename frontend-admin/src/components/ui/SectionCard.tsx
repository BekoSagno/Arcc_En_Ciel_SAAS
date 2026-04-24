"use client";

import { ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
  action?: ReactNode;
};

export default function SectionCard({ title, children, action }: Props) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0b101d] shadow-[0_10px_30px_rgba(2,6,23,0.4)]">
      <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {action}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}
