"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, AlertTriangle, CheckCircle, X } from "lucide-react";
import clsx from "clsx";

interface SystemNotification {
  id: string;
  tenantId: string;
  tenantName?: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  data?: any;
}

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export default function AdminNotificationSummary() {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Charger les notifications système importantes
  const loadNotifications = async () => {
    if (session?.user?.role !== "SUPERADMIN") return;

    try {
      const response = await fetch(`${backendUrl}/api/admin/notifications`, {
        headers: {
          "x-user-email": session?.user?.email || "",
          "x-user-role": session?.user?.role || "",
        },
        cache: "no-store",
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.data || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error("[ADMIN NOTIFICATIONS] Erreur chargement:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user?.role === "SUPERADMIN") {
      loadNotifications();
      // Rafraîchir toutes les 10 secondes
      const interval = setInterval(loadNotifications, 10000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "quota_exceeded":
        return <AlertTriangle className="h-4 w-4 text-red-400" />;
      case "quota_alert":
        return <AlertTriangle className="h-4 w-4 text-amber-400" />;
      case "system":
        return <CheckCircle className="h-4 w-4 text-blue-400" />;
      default:
        return <Bell className="h-4 w-4 text-slate-400" />;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  };

  const criticalNotifications = notifications.filter(
    (n) => n.type === "quota_exceeded" || n.type === "system"
  );
  const hasCritical = criticalNotifications.length > 0;

  // Si la session n'est pas encore chargée ou si l'utilisateur n'est pas SUPERADMIN, afficher quand même le bouton (vide)
  if (!session || session?.user?.role !== "SUPERADMIN") {
    return (
      <div className="relative">
        <button
          disabled
          className="relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium bg-slate-800 text-slate-500 cursor-not-allowed"
        >
          <Bell className="h-4 w-4" />
          <span className="hidden md:inline">Notifications</span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          "relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
          hasCritical
            ? "bg-red-500/20 text-red-300 hover:bg-red-500/30"
            : "bg-slate-800 text-slate-300 hover:bg-slate-700"
        )}
      >
        <Bell className="h-4 w-4" />
        <span className="hidden md:inline">Notifications</span>
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Overlay */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            {/* Dropdown */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute right-0 top-full mt-2 w-96 rounded-xl border border-slate-800 bg-[#0b101d] shadow-2xl z-50"
            >
              <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                <h3 className="text-sm font-semibold text-white">
                  Notifications système ({unreadCount} non lues)
                </h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="p-8 text-center text-slate-400 text-sm">Chargement...</div>
                ) : notifications.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    Aucune notification système
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800">
                    {notifications.map((notification) => (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={clsx(
                          "px-4 py-3 hover:bg-white/5 transition-colors",
                          !notification.read && "bg-indigo-500/10"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-0.5">
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <h4 className="text-sm font-medium text-white">
                                  {notification.title}
                                </h4>
                                {notification.tenantName && (
                                  <p className="text-xs text-slate-500 mt-0.5">
                                    Tenant: {notification.tenantName}
                                  </p>
                                )}
                              </div>
                              {!notification.read && (
                                <div className="h-2 w-2 rounded-full bg-indigo-500 flex-shrink-0 mt-1" />
                              )}
                            </div>
                            <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                              {notification.message}
                            </p>
                            <p className="text-xs text-slate-500 mt-2">
                              {formatTime(notification.createdAt)}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
