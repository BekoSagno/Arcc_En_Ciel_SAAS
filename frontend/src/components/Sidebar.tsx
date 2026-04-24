"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  Database,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Shield,
  TestTube,
  X,
  Megaphone,
  Link2,
} from "lucide-react";
import clsx from "clsx";
import Button from "./ui/Button";
import BrandWordmark from "./BrandWordmark";

const navItems = [
  { href: "/dashboard", label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: "/entreprise", label: "Entreprise", icon: Shield },
  { href: "/stats", label: "Analytiques", icon: BarChart3 },
  { href: "/usage", label: "Usage IA", icon: Activity },
  { href: "/sources", label: "RAG", icon: Database },
  { href: "/test-rag", label: "Test RAG", icon: TestTube },
  { href: "/catalogue", label: "Catalogue", icon: Database },
  { href: "/annonces", label: "Annonces", icon: Megaphone },
  { href: "/integrations", label: "Intégrations", icon: Link2 },
  { href: "/conversations", label: "Conversations", icon: MessageSquare },
  { href: "/tickets", label: "Tickets humains", icon: Activity },
  // Page Canaux désactivée côté client : configuration gérée par le superadmin
  // { href: "/channels", label: "Canaux", icon: Shield },
  { href: "/billing", label: "Facturation", icon: BarChart3 },
  { href: "/settings", label: "Paramètres", icon: Settings },
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
            <BrandWordmark className="text-xs" />
            <div className="mt-2 text-lg font-semibold text-white">Console</div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            className="lg:hidden"
            icon={<X className="h-4 w-4" />}
          />
        </div>

        <nav className="mt-10 flex flex-col gap-2">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <Link
                  href={item.href}
                  className={clsx(
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ease-in-out transform",
                    isActive
                      ? "bg-indigo-600/20 text-indigo-200 shadow-lg shadow-indigo-500/20 scale-100 border-l-2 border-indigo-500"
                      : "text-slate-300 hover:bg-white/10 hover:text-white hover:scale-105 hover:translate-x-1 border-l-2 border-transparent"
                  )}
                >
                  <motion.div
                    animate={isActive ? { scale: 1.1 } : { scale: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Icon className="h-4 w-4 transition-colors group-hover:text-indigo-300" />
                  </motion.div>
                  <span className="text-aurora">{item.label}</span>
                </Link>
              </motion.div>
            );
          })}
        </nav>

        <div className="mt-auto rounded-2xl border border-slate-800 bg-[#161b22] p-4 text-xs text-slate-400">
          Version 2.1 · Modern Dark SaaS
        </div>
      </aside>
      {isOpen ? (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
          type="button"
        />
      ) : null}
    </>
  );
}
