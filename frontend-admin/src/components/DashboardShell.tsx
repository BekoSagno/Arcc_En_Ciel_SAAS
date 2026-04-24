"use client";

import { ReactNode, useState } from "react";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";

type Props = {
  children: ReactNode;
};

export default function DashboardShell({ children }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100">
      <div className="flex min-h-screen">
        <Sidebar isOpen={open} onClose={() => setOpen(false)} />
        <div className="flex-1">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-800/60 bg-[#020617]/90 px-6 py-4 backdrop-blur lg:hidden">
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              Arcc En Ciel
            </div>
            <button
              className="rounded-lg border border-slate-800 bg-[#0b101d] p-2 text-slate-200"
              onClick={() => setOpen(true)}
              type="button"
            >
              <Menu className="h-5 w-5" />
            </button>
          </header>
          <main className="px-6 py-8 lg:px-10">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
