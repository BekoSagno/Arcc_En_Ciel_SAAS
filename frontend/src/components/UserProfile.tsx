"use client";

import { useState, useRef, useEffect } from "react";
import { User, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession, signOut } from "next-auth/react";
import ProfileModal from "./ProfileModal";

export default function UserProfile() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fermer le dropdown si on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleOpenModal = () => {
    setIsModalOpen(true);
    setIsOpen(false);
  };

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  const userInitials = session?.user?.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : session?.user?.email?.[0].toUpperCase() || "U";

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-white/10 transition-colors"
        aria-label="Profil utilisateur"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
          {userInitials}
        </div>
        <div className="hidden md:block text-left">
          <div className="text-xs font-medium text-white">
            {session?.user?.name || "Utilisateur"}
          </div>
          <div className="text-xs text-slate-400">
            {session?.user?.email}
          </div>
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-slate-800 bg-[#0b101d] shadow-2xl z-50"
          >
            <div className="p-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-lg font-semibold text-white">
                  {userInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">
                    {session?.user?.name || "Utilisateur"}
                  </div>
                  <div className="text-xs text-slate-400 truncate">
                    {session?.user?.email}
                  </div>
                  {session?.user?.tenantName && (
                    <div className="text-xs text-slate-500 mt-1">
                      {session.user.tenantName}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-2 space-y-1">
              <button
                onClick={handleOpenModal}
                className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-white/10 transition-colors"
              >
                <User className="h-4 w-4" />
                <span>Mon profil</span>
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Se déconnecter</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ProfileModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
