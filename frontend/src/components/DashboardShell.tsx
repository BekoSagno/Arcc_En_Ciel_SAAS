"use client";

import { ReactNode, useState } from "react";
import { motion } from "framer-motion";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";
import Button from "./ui/Button";
import NotificationBell from "./NotificationBell";
import UserProfile from "./UserProfile";
import BrandWordmark from "./BrandWordmark";

type Props = {
  children: ReactNode;
};

export default function DashboardShell({ children }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-0 top-0 h-64 w-64 rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="absolute right-0 top-20 h-72 w-72 rounded-full bg-emerald-400/10 blur-[140px]" />
      </div>
      <div className="relative flex min-h-screen">
        <Sidebar isOpen={open} onClose={() => setOpen(false)} />
        <div className="flex-1">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-800/60 bg-[#020617]/90 px-6 py-4 backdrop-blur">
            <div className="lg:hidden">
              <BrandWordmark className="text-[10px]" />
            </div>
            <div className="ml-auto flex items-center gap-3">
              <NotificationBell />
              <UserProfile />
            <Button
              variant="secondary"
              size="sm"
              icon={<Menu className="h-5 w-5" />}
              onClick={() => setOpen(true)}
                className="p-2 lg:hidden"
            />
            </div>
          </header>
          <main className="px-6 py-8 lg:px-10">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                {children}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
