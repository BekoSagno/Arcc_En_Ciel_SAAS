"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";

export interface Notification {
  id: string;
  tenantId: string;
  userId: string | null;
  type: string;
  title: string;
  message: string;
  data: any;
  read: boolean;
  createdAt: string;
  readAt: string | null;
}

export function useNotifications() {
  const { data: session } = useSession();
  const tenantId = session?.user?.tenantId;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

  // Charger les notifications initiales
  const loadNotifications = useCallback(async () => {
    if (!tenantId) return;

    try {
      const [notificationsRes, countRes] = await Promise.all([
        fetch(`${backendUrl}/api/notifications?limit=50`, {
          headers: {
            "x-tenant-id": tenantId,
          },
        }),
        fetch(`${backendUrl}/api/notifications/unread/count`, {
          headers: {
            "x-tenant-id": tenantId,
          },
        }),
      ]);

      if (notificationsRes.ok) {
        const data = await notificationsRes.json();
        setNotifications(data);
      }

      if (countRes.ok) {
        const { count } = await countRes.json();
        setUnreadCount(count);
      }
    } catch (error) {
      console.error("[NOTIFICATIONS] Erreur chargement:", error);
    } finally {
      setLoading(false);
    }
  }, [tenantId, backendUrl]);

  // Marquer une notification comme lue
  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!tenantId) return;

      try {
        const res = await fetch(`${backendUrl}/api/notifications/${notificationId}/read`, {
          method: "PATCH",
          headers: {
            "x-tenant-id": tenantId,
          },
        });

        if (res.ok) {
          setNotifications((prev) =>
            prev.map((n) => (n.id === notificationId ? { ...n, read: true, readAt: new Date().toISOString() } : n))
          );
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      } catch (error) {
        console.error("[NOTIFICATIONS] Erreur marquage lu:", error);
      }
    },
    [tenantId, backendUrl]
  );

  // Marquer toutes comme lues
  const markAllAsRead = useCallback(async () => {
    if (!tenantId) return;

    try {
      const res = await fetch(`${backendUrl}/api/notifications/read-all`, {
        method: "PATCH",
        headers: {
          "x-tenant-id": tenantId,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, read: true, readAt: new Date().toISOString() }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error("[NOTIFICATIONS] Erreur marquage multiple:", error);
    }
  }, [tenantId, backendUrl]);

  // Écouter les notifications en temps réel via SSE
  useEffect(() => {
    if (!tenantId) return;

    // Charger les notifications initiales
    loadNotifications();

    // Utiliser fetch avec stream pour supporter les headers (tenantId)
    const connectSSE = async () => {
      try {
        const response = await fetch(`${backendUrl}/api/notifications/stream`, {
          headers: {
            "x-tenant-id": tenantId,
          },
        });

        if (!response.ok) {
          console.error("[NOTIFICATIONS] Erreur connexion SSE:", response.status);
          return;
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) return;

        const readStream = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value);
              const lines = chunk.split("\n");

              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    if (data.type === "notification" && data.notification) {
                      const newNotification = data.notification;
                      setNotifications((prev) => [newNotification, ...prev]);
                      if (!newNotification.read) {
                        setUnreadCount((prev) => prev + 1);
                      }
                    }
                  } catch (e) {
                    // Ignorer les erreurs de parsing
                  }
                }
              }
            }
          } catch (error) {
            console.error("[NOTIFICATIONS] Erreur lecture stream:", error);
            // Reconnexion après 5 secondes
            setTimeout(connectSSE, 5000);
          }
        };

        readStream();
      } catch (error) {
        console.error("[NOTIFICATIONS] Erreur connexion SSE:", error);
        // Reconnexion après 5 secondes
        setTimeout(connectSSE, 5000);
      }
    };

    connectSSE();

    // Nettoyage : la fermeture du stream sera gérée automatiquement
    return () => {
      // Le stream sera fermé lors du démontage du composant
    };
  }, [tenantId, backendUrl, loadNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refresh: loadNotifications,
  };
}
