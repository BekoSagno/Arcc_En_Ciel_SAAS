"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion } from "framer-motion";
import { io, Socket } from "socket.io-client";
import SectionCard from "@/src/components/ui/SectionCard";
import StatusBadge from "@/src/components/ui/StatusBadge";
import PageHeader from "@/src/components/ui/PageHeader";
import Button from "@/src/components/ui/Button";

type Conversation = {
  id: string;
  channel: string;
  status: string;
  customerHandle: string | null;
  lastMessageAt: string | null;
  lastInboundAt?: string | null;
  lastOutboundAt?: string | null;
  nextReminderAt?: string | null;
  lastMessage: string;
  isAiEnabled?: boolean;
};

type Message = {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  body: string;
  createdAt: string;
};

type LogEntry = {
  id: string;
  type: "inbound" | "outbound" | "tunnel";
  summary: string;
  detail: string;
  createdAt: string;
};

export default function ConversationsClient() {
  const { data: session } = useSession();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [tab, setTab] = useState<"history" | "logs">("history");
  const [loading, setLoading] = useState(false);
  const [manualMessage, setManualMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const backendUrl = useMemo(
    () => process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000",
    []
  );

  const tenantId = session?.user?.tenantId;

  const loadConversations = useCallback(async () => {
    if (!tenantId) return;
    
    try {
      // Charger toutes les conversations (limite backend = 100)
      // Utiliser cache: "no-store" pour éviter le cache et avoir les données à jour
      const response = await fetch(`${backendUrl}/api/conversations?limit=100`, {
        headers: {
          "x-tenant-id": tenantId,
        },
        cache: "no-store", // Désactiver le cache pour synchronisation en temps réel
      });
      if (response.ok) {
        const json = await response.json();
        setConversations(json.data || []);
      }
    } catch (error) {
      console.error("Erreur chargement conversations:", error);
    }
  }, [backendUrl, tenantId]);

  const loadMessages = useCallback(async (conversationId: string) => {
    if (!tenantId) return;
    
    try {
      const response = await fetch(
        `${backendUrl}/api/conversations/${conversationId}/messages`,
        {
          headers: {
            "x-tenant-id": tenantId,
          },
          cache: "no-store", // Désactiver le cache pour synchronisation en temps réel
        }
      );
      if (response.ok) {
        const json = await response.json();
        const messagesData = json.data || [];
        // Les messages sont triés du plus ancien au plus récent (ordre chronologique)
        console.log(`[CONVERSATIONS] Messages chargés:`, {
          total: messagesData.length,
          inbound: messagesData.filter((m: Message) => m.direction === "INBOUND").length,
          outbound: messagesData.filter((m: Message) => m.direction === "OUTBOUND").length,
          messages: messagesData.map((m: Message) => ({
            id: m.id,
            direction: m.direction,
            bodyPreview: m.body?.substring(0, 50),
          })),
        });
        setMessages(messagesData);
        
        // Scroll automatique vers le bas après chargement
        setTimeout(() => {
          const container = document.getElementById("messages-container");
          if (container) {
            container.scrollTop = container.scrollHeight;
          }
        }, 100);
      }
    } catch (error) {
      console.error("Erreur chargement messages:", error);
    }
  }, [backendUrl, tenantId]);

  const loadLogs = useCallback(async (conversationId: string) => {
    if (!tenantId) return;
    
    try {
      const response = await fetch(
        `${backendUrl}/api/conversations/${conversationId}/logs`,
        {
          headers: {
            "x-tenant-id": tenantId,
          },
        }
      );
      if (response.ok) {
        const json = await response.json();
        setLogs(json.data || []);
      }
    } catch (error) {
      console.error("Erreur chargement logs:", error);
    }
  }, [backendUrl, tenantId]);

  // Chargement initial des conversations
  useEffect(() => {
    if (tenantId) {
      loadConversations();
    }
  }, [tenantId, loadConversations]);

  // Temps réel via Socket.io (notifications -> rafraîchissement ciblé)
  useEffect(() => {
    if (!tenantId) return;

    const socket = io(backendUrl, {
      transports: ["websocket"],
      query: { tenantId },
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[CONVERSATIONS] Socket.io connecté", socket.id);
    });

    // Écouter les nouveaux messages en temps réel
    socket.on("new_message", async (payload: any) => {
      try {
        if (!payload || !payload.conversationId || !payload.message) return;
        const { conversationId, message } = payload;

        // Si la conversation ouverte correspond, recharger les messages pour être sûr d'avoir tout
        if (selected && selected.id === conversationId) {
          console.log("[CONVERSATIONS] Nouveau message reçu pour la conversation ouverte, rechargement des messages");
          await loadMessages(conversationId);
          
          // Scroll automatique vers le bas après chargement
          setTimeout(() => {
            const container = document.getElementById("messages-container");
            if (container) {
              container.scrollTop = container.scrollHeight;
            }
          }, 200);
        }

        // Toujours rafraîchir la liste des conversations (pour le dernier message)
        await loadConversations();
      } catch (err) {
        console.error("[CONVERSATIONS] Erreur traitement new_message socket:", err);
      }
    });

    // Écouter les mises à jour de conversation (statut, isAiEnabled, etc.)
    socket.on("conversation_updated", async (payload: any) => {
      try {
        if (!payload || !payload.conversationId || !payload.conversation) return;
        const { conversationId, conversation } = payload;

        // Rafraîchir la liste des conversations
        await loadConversations();

        // Si la conversation ouverte correspond, mettre à jour l'objet sélectionné
        if (selected && selected.id === conversationId) {
          setSelected((prev) => prev ? { ...prev, ...conversation } : null);
        }
      } catch (err) {
        console.error("[CONVERSATIONS] Erreur traitement conversation_updated socket:", err);
      }
    });

    // Écouter les notifications (pour compatibilité avec l'ancien système)
    socket.on("notification", async (payload: any) => {
      try {
        if (!payload || payload.type !== "notification" || !payload.notification) return;
        const notif = payload.notification;
        const data = notif.data || {};
        const conversationId = data.conversationId as string | undefined;

        // Toujours rafraîchir la liste (compteur, aperçu, statut…)
        await loadConversations();

        // Si une conversation est ouverte et correspond, recharger messages + logs
        if (conversationId && selected && selected.id === conversationId) {
          await Promise.all([loadMessages(conversationId), loadLogs(conversationId)]);
        }
      } catch (err) {
        console.error("[CONVERSATIONS] Erreur traitement notification socket:", err);
      }
    });

    socket.on("disconnect", () => {
      console.log("[CONVERSATIONS] Socket.io déconnecté");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [tenantId, backendUrl, loadConversations, loadMessages, loadLogs, selected]);

  const openConversation = async (item: Conversation) => {
    setSelected(item);
    setManualMessage(""); // Réinitialiser le champ de message
    await Promise.all([
      loadMessages(item.id),
      loadLogs(item.id),
    ]);
    setTab("history");
    // Scroll automatique vers le bas après chargement des messages
    setTimeout(() => {
      const container = document.getElementById("messages-container");
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 200);
  };

  const isWithinWindow = (conversation?: Conversation | null) => {
    if (!conversation?.lastInboundAt) return false;
    const lastInbound = new Date(conversation.lastInboundAt).getTime();
    return Date.now() - lastInbound <= 24 * 60 * 60 * 1000;
  };

  const getReminderLabel = (conversation?: Conversation | null) => {
    if (!conversation?.nextReminderAt) return "aucune";
    const ms = new Date(conversation.nextReminderAt).getTime() - Date.now();
    if (ms <= 0) return "imminent";
    const hours = Math.round(ms / (60 * 60 * 1000));
    return `dans ${hours}h`;
  };

  return (
    <>
      <PageHeader
        eyebrow="Conversations"
        title="Inbox client"
        subtitle="Suivez les conversations multi-canaux et le mode manuel."
      />

      <SectionCard title="Liste des conversations">
        {loading && conversations.length === 0 ? (
          <div className="py-6 text-sm text-slate-400">Chargement...</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {conversations.length === 0 ? (
              <div className="py-6 text-sm text-slate-400">
                Aucune conversation disponible.
              </div>
            ) : null}
          {conversations.map((item) => (
            <Dialog.Root key={item.id}>
              <Dialog.Trigger asChild>
                <button
                  className="flex w-full items-center justify-between py-4 text-left interactive-glow interactive-raise rounded-xl px-3"
                  onClick={() => openConversation(item)}
                  type="button"
                >
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {item.channel} · {item.customerHandle || "Client"}
                    </div>
                    <div className="text-xs text-slate-400">
                      {item.lastMessage || "Nouveau message"}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge
                      label={item.status.toLowerCase()}
                      tone={item.status === "MANUAL_MODE" ? "warning" : "info"}
                    />
                    {item.channel === "WHATSAPP" ? (
                      <StatusBadge
                        label={
                          item.lastInboundAt &&
                          Date.now() - new Date(item.lastInboundAt).getTime() <=
                            24 * 60 * 60 * 1000
                            ? "24h"
                            : "24h+"
                        }
                        tone={
                          item.lastInboundAt &&
                          Date.now() - new Date(item.lastInboundAt).getTime() <=
                            24 * 60 * 60 * 1000
                            ? "success"
                            : "warning"
                        }
                      />
                    ) : null}
                    <span className="text-xs text-slate-500">
                      {item.lastMessageAt
                        ? new Date(item.lastMessageAt).toLocaleString("fr-FR")
                        : "--"}
                    </span>
                  </div>
                </button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40" />
                <Dialog.Content className="fixed left-1/2 top-1/2 max-h-[85vh] w-[95vw] max-w-4xl -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-800 bg-[#0b101d] shadow-[0_20px_60px_rgba(0,0,0,0.4)] z-50 flex flex-col">
                  <Dialog.Title className="sr-only">
                    Conversation {selected?.channel} · {selected?.customerHandle || "Client"}
                  </Dialog.Title>
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-semibold text-white">
                      {selected?.channel} · {selected?.customerHandle || "Client"}
                    </div>
                    <Dialog.Close className="text-slate-400 hover:text-white">
                      Fermer
                    </Dialog.Close>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <StatusBadge
                      label={isWithinWindow(selected) ? "fenetre 24h" : "hors fenetre"}
                      tone={isWithinWindow(selected) ? "success" : "warning"}
                    />
                    {selected?.channel === "WHATSAPP" ? (
                      <StatusBadge
                        label={`relance ${getReminderLabel(selected)}`}
                        tone={selected.nextReminderAt ? "info" : "warning"}
                      />
                    ) : null}
                    <span>
                      Dernier inbound:{" "}
                      {selected?.lastInboundAt
                        ? new Date(selected.lastInboundAt).toLocaleString("fr-FR")
                        : "--"}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant={tab === "history" ? "primary" : "secondary"}
                      size="md"
                      onClick={() => setTab("history")}
                      icon="📜"
                    >
                      Historique
                    </Button>
                    <Button
                      variant={tab === "logs" ? "primary" : "secondary"}
                      size="md"
                      onClick={() => setTab("logs")}
                      icon="📋"
                    >
                      Logs
                    </Button>
                    {selected?.channel === "FACEBOOK_COMMENT" ? (
                      <StatusBadge label="tunnel" tone="info" />
                    ) : null}
                  </div>
                  <div className="mt-4 flex items-center gap-3 flex-wrap">
                    {/* Toggle IA pour cette conversation (pour le client) */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/50">
                      <label className="text-xs font-semibold text-slate-300 cursor-pointer flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selected?.isAiEnabled ?? true}
                          onChange={async (e) => {
                            if (!selected || !tenantId) return;
                            const newValue = e.target.checked;
                            try {
                              const response = await fetch(
                                `${backendUrl}/api/conversations/${selected.id}/ai`,
                                {
                                  method: "PATCH",
                                  headers: {
                                    "Content-Type": "application/json",
                                    "x-tenant-id": tenantId,
                                  },
                                  body: JSON.stringify({ isAiEnabled: newValue }),
                                }
                              );
                              if (response.ok) {
                                const json = await response.json();
                                setSelected((prev) => prev ? { ...prev, isAiEnabled: json.data.isAiEnabled } : null);
                                await loadConversations();
                              }
                            } catch (error) {
                              console.error("Erreur toggle IA:", error);
                            }
                          }}
                          className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-indigo-600 focus:ring-indigo-500 focus:ring-2"
                        />
                        <span>IA activée</span>
                      </label>
                    </div>
                    <Button
                      variant="success"
                      size="md"
                      icon="🤖"
                      onClick={async () => {
                        if (!selected || !tenantId) return;
                        await fetch(
                          `${backendUrl}/api/conversations/${selected.id}/status`,
                          {
                            method: "PATCH",
                            headers: {
                              "Content-Type": "application/json",
                              "x-tenant-id": tenantId,
                            },
                            body: JSON.stringify({ status: "OPEN" }),
                          }
                        );
                        await loadConversations();
                        // Recharger la conversation sélectionnée pour avoir les dernières données
                        if (selected) {
                          const updated = conversations.find(c => c.id === selected.id);
                          if (updated) setSelected(updated);
                        }
                      }}
                    >
                      Reprendre IA
                    </Button>
                    <Button
                      variant="secondary"
                      size="md"
                      icon="🔒"
                      onClick={async () => {
                        if (!selected || !tenantId) return;
                        await fetch(
                          `${backendUrl}/api/conversations/${selected.id}/status`,
                          {
                            method: "PATCH",
                            headers: {
                              "Content-Type": "application/json",
                              "x-tenant-id": tenantId,
                            },
                            body: JSON.stringify({ status: "CLOSED" }),
                          }
                        );
                        await loadConversations();
                        // Recharger la conversation sélectionnée pour avoir les dernières données
                        if (selected) {
                          const updated = conversations.find(c => c.id === selected.id);
                          if (updated) setSelected(updated);
                        }
                      }}
                    >
                      Clôturer
                    </Button>
                  </div>
                  {/* Zone d'envoi de message manuel */}
                  {selected?.channel === "WHATSAPP" && (
                    <div className="mt-4 border-t border-slate-800 pt-4">
                      <div className="text-xs font-semibold text-slate-400 mb-2">
                        Répondre manuellement
                      </div>
                      <div className="flex gap-2">
                        <textarea
                          value={manualMessage}
                          onChange={(e) => setManualMessage(e.target.value)}
                          placeholder="Tapez votre message ici..."
                          className="flex-1 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none resize-none"
                          rows={3}
                          disabled={sendingMessage}
                        />
                        <Button
                          variant="primary"
                          size="md"
                          icon="📤"
                          loading={sendingMessage}
                          onClick={async () => {
                            if (!selected || !tenantId || !manualMessage.trim()) return;
                            setSendingMessage(true);
                            try {
                              const response = await fetch(
                                `${backendUrl}/api/conversations/${selected.id}/messages`,
                                {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                    "x-tenant-id": tenantId,
                                  },
                                  body: JSON.stringify({ body: manualMessage.trim() }),
                                }
                              );
                              if (response.ok) {
                                setManualMessage("");
                                // Le message sera ajouté automatiquement via Socket.io
                                // Mais on recharge quand même pour être sûr
                                await loadMessages(selected.id);
                                await loadConversations();
                              } else {
                                const error = await response.json().catch(() => ({}));
                                alert(error.error || "Erreur lors de l'envoi du message.");
                              }
                            } catch (error) {
                              console.error("Erreur envoi message:", error);
                              alert("Erreur lors de l'envoi du message.");
                            } finally {
                              setSendingMessage(false);
                            }
                          }}
                          disabled={!manualMessage.trim() || sendingMessage}
                        >
                          Envoyer
                        </Button>
                      </div>
                    </div>
                  )}
                  {/* Zone scrollable pour les messages */}
                  <div 
                    id="messages-container"
                    className="flex-1 overflow-y-auto p-4" 
                    style={{ maxHeight: "calc(85vh - 250px)" }}
                  >
                    <motion.div
                      key={tab}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                      className="space-y-3"
                    >
                      {tab === "history" ? (
                        <>
                          {messages.length === 0 ? (
                            <div className="py-12 text-sm text-slate-400 text-center">
                              Aucun message dans cette conversation.
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {messages.map((message, index) => (
                                <div
                                  key={message.id}
                                  className={`rounded-lg px-4 py-3 ${
                                    message.direction === "INBOUND"
                                      ? "bg-slate-800/50 text-slate-200 border-l-2 border-blue-500"
                                      : "bg-indigo-600/20 text-indigo-100 border-l-2 border-indigo-500"
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold uppercase text-slate-400">
                                      {message.direction === "INBOUND" ? "👤 Client" : "🤖 IA"}
                                    </span>
                                    <span className="text-xs text-slate-500">
                                      {new Date(message.createdAt).toLocaleString("fr-FR", {
                                        day: "2-digit",
                                        month: "2-digit",
                                        year: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                  </div>
                                  <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                                    {message.body}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="rounded-lg border border-slate-800 bg-black/40 p-4">
                          {logs.length === 0 ? (
                            <div className="text-sm text-slate-400 text-center py-6">
                              Aucun log disponible.
                            </div>
                          ) : (
                            <div className="space-y-2 font-mono text-xs text-emerald-400">
                              {logs.map((log) => (
                                <div key={log.id} className="leading-6 border-b border-slate-800/50 pb-2 last:border-0">
                                  <span className="text-slate-500">
                                    [{new Date(log.createdAt).toLocaleString("fr-FR")}]
                                  </span>{" "}
                                  <span className="uppercase font-semibold">{log.type}</span> · {log.summary}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  </div>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          ))}
          </div>
        )}
      </SectionCard>
    </>
  );
}
