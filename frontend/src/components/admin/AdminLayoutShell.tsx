"use client";

import { ReactNode, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Wifi, WifiOff } from "lucide-react";
import AdminNotificationSummary from "./AdminNotificationSummary";

type Props = {
  children: ReactNode;
};

export default function AdminLayoutShell({ children }: Props) {
  const { data: session } = useSession();
  const [isOnline, setIsOnline] = useState(true);
  const [lastSync, setLastSync] = useState<Date>(new Date());

  useEffect(() => {
    // Vérifier la connexion
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Mettre à jour le timestamp de synchronisation
    const syncInterval = setInterval(() => {
      setLastSync(new Date());
    }, 10000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(syncInterval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-10">
        <header className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-rose-300">
                Super Admin
              </div>
              <h1 className="text-3xl font-bold text-transparent bg-gradient-to-r from-white to-slate-400 bg-clip-text">
                Centre de supervision
              </h1>
              <p className="text-sm text-slate-400">
                Monitoring multi-tenant, sécurité et opérations en temps réel.
                {session?.user?.email && (
                  <span className="ml-2 text-slate-500">
                    Connecté en tant que {session.user.email}
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <AdminNotificationSummary />
              <div className="flex items-center gap-3 text-xs text-slate-400">
                {isOnline ? (
                  <>
                    <Wifi className="h-4 w-4 text-emerald-400" />
                    <span className="text-emerald-400">Synchronisation active</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-4 w-4 text-rose-400" />
                    <span className="text-rose-400">Hors ligne</span>
                  </>
                )}
                <span className="text-slate-500">
                  · Dernière sync: {lastSync.toLocaleTimeString("fr-FR")}
                </span>
              </div>
            </div>
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}
