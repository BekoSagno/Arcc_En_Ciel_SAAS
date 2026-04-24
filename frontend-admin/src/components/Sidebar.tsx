"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Database,
  LayoutDashboard,
  Settings,
  Shield,
  X,
} from "lucide-react";
import clsx from "clsx";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/stats", label: "Analytics", icon: BarChart3 },
  { href: "/sources", label: "RAG", icon: Database },
  { href: "/channels", label: "Channels", icon: Shield },
  { href: "/settings", label: "Settings", icon: Settings },
];

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function Sidebar({ isOpen, onClose }: Props) {
  const pathname = usePathname();

  return (
    <>
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-800 bg-[#0b101d] px-6 py-8 transition lg:static lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              Arcc En Ciel
            </div>
            <div className="mt-2 text-lg font-semibold text-white">Console</div>
          </div>
          <button
            className="rounded-lg border border-slate-800 bg-[#0b101d] p-2 text-slate-200 lg:hidden"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="mt-10 flex flex-col gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                  isActive
                    ? "bg-indigo-600/20 text-indigo-200 shadow-[0_10px_30px_rgba(79,70,229,0.15)]"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-2xl border border-slate-800 bg-[#161b22] p-4 text-xs text-slate-400">
          Version 2.1 · Modern Dark SaaS
        </div>
      </aside>
      {isOpen ? (
        <button
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
          type="button"
        />
      ) : null}
    </>
  );
}
