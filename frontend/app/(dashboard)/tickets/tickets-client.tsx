"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
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
  lastMessage: string;
};

type Message = {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  body: string;
  createdAt: string;
};

export default function TicketsClient() {
  const { data: session } = useSession();
  const tenantId = session?.user?.tenantId;
  const [tickets, setTickets] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [manualMessage, setManualMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const backendUrl = useMemo(
    () => process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000",
    []
  );

  const loadTickets = async () => {
    if (!tenantId) return;
    
    const response = await fetch(
      `${backendUrl}/api/conversations?status=MANUAL_MODE`,
      {
        headers: {
          "x-tenant-id": tenantId,
        },
      }
    );
    if (response.ok) {
      const json = await response.json();
      setTickets(json.data || []);
    }
  };

  useEffect(() => {
    if (tenantId) {
      loadTickets();
    }
  }, [tenantId, backendUrl]);

  // Temps réel via Socket.io
  useEffect(() => {
    if (!tenantId) return;

    const socket = io(backendUrl, {
      transports: ["websocket"],
      query: { tenantId },
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[TICKETS] Socket.io connecté", socket.id);
    });

    // Écouter les nouveaux messages en temps réel
    socket.on("new_message", async (payload: any) => {
      try {
        if (!payload || !payload.conversationId || !payload.message) return;
        const { conversationId, message } = payload;

        // Si le ticket ouvert correspond, recharger les messages pour être sûr d'avoir tout
        if (selected && selected.id === conversationId) {
          console.log("[TICKETS] Nouveau message reçu pour le ticket ouvert, rechargement des messages");
          await loadMessages(conversationId);
          
          // Scroll automatique vers le bas après chargement
          setTimeout(() => {
            const container = document.getElementById("messages-container");
            if (container) {
              container.scrollTop = container.scrollHeight;
            }
          }, 200);
        }

        // Rafraîchir la liste des tickets
        await loadTickets();
      } catch (err) {
        console.error("[TICKETS] Erreur traitement new_message socket:", err);
      }
    });

    // Écouter les mises à jour de conversation
    socket.on("conversation_updated", async (payload: any) => {
      try {
        if (!payload || !payload.conversationId) return;
        const { conversation } = payload;
        
        // Si la conversation passe en MANUAL_MODE, recharger la liste des tickets
        if (conversation && conversation.status === "MANUAL_MODE") {
          console.log("[TICKETS] Nouvelle conversation en MANUAL_MODE détectée, rechargement de la liste");
          await loadTickets();
        }
      } catch (err) {
        console.error("[TICKETS] Erreur traitement conversation_updated socket:", err);
      }
    });

    // Écouter les notifications (notamment les handoffs)
    socket.on("notification", async (payload: any) => {
      try {
        if (!payload || payload.type !== "notification" || !payload.notification) return;
        const notif = payload.notification;
        
        // Si c'est une notification de handoff, recharger la liste des tickets
        if (notif.type === "conversation" && notif.title && notif.title.includes("humain")) {
          console.log("[TICKETS] Notification de handoff reçue, rechargement de la liste");
          await loadTickets();
        }
      } catch (err) {
        console.error("[TICKETS] Erreur traitement notification socket:", err);
      }
    });

    socket.on("disconnect", () => {
      console.log("[TICKETS] Socket.io déconnecté");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [tenantId, backendUrl, loadTickets, selected]);

  const loadMessages = useCallback(async (conversationId: string) => {
    if (!tenantId) return;
    
    try {
      const response = await fetch(
        `${backendUrl}/api/conversations/${conversationId}/messages`,
        {
          headers: {
            "x-tenant-id": tenantId,
          },
        }
      );
      if (response.ok) {
        const json = await response.json();
        setMessages(json.data || []);
      }
    } catch (error) {
      console.error("Erreur chargement messages:", error);
    }
  }, [backendUrl, tenantId]);

  const openTicket = async (item: Conversation) => {
    setSelected(item);
    setManualMessage("");
    await loadMessages(item.id);
  };

  const updateStatus = async (conversationId: string, status: string) => {
    if (!tenantId) return;
    
    await fetch(`${backendUrl}/api/conversations/${conversationId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-tenant-id": tenantId,
      },
      body: JSON.stringify({ status }),
    });
    await loadTickets();
    if (selected?.id === conversationId) {
      setSelected(null);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Handoff humain"
        title="Tickets a traiter"
        subtitle="Conversations escaladees par l'IA."
      />

      <SectionCard title="Files prioritaires">
        <div className="divide-y divide-slate-800">
          {tickets.length === 0 ? (
            <div className="py-6 text-sm text-slate-400">
              Aucun ticket humain en attente.
            </div>
          ) : null}
          {tickets.map((item, index) => (
            <Dialog.Root key={item.id}>
              <Dialog.Trigger asChild>
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="flex w-full items-center justify-between py-4 hover:bg-slate-900/30 transition-colors rounded-lg px-2 text-left interactive-glow interactive-raise"
                  onClick={() => openTicket(item)}
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
                  <div className="flex items-center gap-2">
                    <StatusBadge label="manual" tone="warning" />
                    <span className="text-xs text-slate-500">Cliquer pour voir</span>
                  </div>
                </motion.button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40" />
                <Dialog.Content className="fixed left-1/2 top-1/2 max-h-[85vh] w-[95vw] max-w-4xl -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-800 bg-[#0b101d] shadow-[0_20px_60px_rgba(0,0,0,0.4)] z-50 flex flex-col p-6">
                  <Dialog.Title className="sr-only">
                    Ticket {selected?.channel} · {selected?.customerHandle || "Client"}
                  </Dialog.Title>
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-lg font-semibold text-white">
                      {selected?.channel} · {selected?.customerHandle || "Client"}
                    </div>
                    <Dialog.Close className="text-slate-400 hover:text-white">
                      Fermer
                    </Dialog.Close>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <StatusBadge label="manual" tone="warning" />
                    <Button
                      variant="success"
                      size="sm"
                      icon="🤖"
                      onClick={() => selected && updateStatus(selected.id, "OPEN")}
                    >
                      Reprendre IA
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="🔒"
                      onClick={() => selected && updateStatus(selected.id, "CLOSED")}
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
                                await loadTickets();
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
                  <div className="flex-1 overflow-y-auto mt-4" style={{ maxHeight: "calc(85vh - 300px)" }}>
                    {messages.length === 0 ? (
                      <div className="py-12 text-sm text-slate-400 text-center">
                        Aucun message dans cette conversation.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {messages.map((message) => (
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
                                {message.direction === "INBOUND" ? "👤 Client" : "🤖 IA/Opérateur"}
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
                  </div>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          ))}
        </div>
      </SectionCard>
    </>
  );
}
