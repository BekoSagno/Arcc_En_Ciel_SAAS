const express = require("express");
const { prisma } = require("../services/prisma");
const { resolveTenantId } = require("../services/tenantContext");

const router = express.Router();

router.get("/conversations/recent", async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant introuvable." });
    }

    const conversations = await prisma.conversation.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    const data = conversations.map((conversation) => ({
      id: conversation.id,
      channel: conversation.channel,
      status: conversation.status,
      customerHandle: conversation.customerHandle,
      lastMessageAt: conversation.lastMessageAt,
      lastInboundAt: conversation.lastInboundAt,
      lastOutboundAt: conversation.lastOutboundAt,
      nextReminderAt: conversation.nextReminderAt,
      // Par défaut, l'IA est considérée comme activée si le champ est null/undefined
      isAiEnabled: conversation.isAiEnabled ?? true,
      lastMessage: conversation.messages[0]?.body || "",
    }));

    return res.status(200).json({ data });
  } catch (error) {
    return next(error);
  }
});

router.get("/conversations", async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant introuvable." });
    }

    const status = req.query.status;
    const limit = Number(req.query.limit || 20);

    const conversations = await prisma.conversation.findMany({
      where: {
        tenantId,
        ...(status ? { status: String(status) } : {}),
      },
      orderBy: { lastMessageAt: "desc" }, // Trier par dernier message plutôt que updatedAt
      take: Math.min(limit, 100),
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });

    const data = conversations.map((conversation) => ({
      id: conversation.id,
      channel: conversation.channel,
      status: conversation.status,
      customerHandle: conversation.customerHandle,
      lastMessageAt: conversation.lastMessageAt,
      lastInboundAt: conversation.lastInboundAt,
      lastOutboundAt: conversation.lastOutboundAt,
      nextReminderAt: conversation.nextReminderAt,
      isAiEnabled: conversation.isAiEnabled ?? true,
      lastMessage: conversation.messages[0]?.body?.substring(0, 100) || "Nouveau message", // Limiter à 100 caractères
      messageCount: conversation._count.messages,
    }));

    return res.status(200).json({ data });
  } catch (error) {
    return next(error);
  }
});

router.get("/conversations/:id/messages", async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant introuvable." });
    }

  const conversationId = req.params.id;
  const rawMessages = await prisma.message.findMany({
    where: { tenantId, conversationId },
    // On récupère les 200 plus récents puis on remet en ordre chronologique
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      direction: true,
      body: true,
      createdAt: true,
      fromHandle: true,
      toHandle: true,
    },
  });

  const messages = rawMessages.reverse();

  // Log pour debug : vérifier les messages récupérés
  console.log(`[CONVERSATIONS] Messages récupérés pour conversation ${conversationId}:`, {
    total: messages.length,
    inbound: messages.filter((m) => m.direction === "INBOUND").length,
    outbound: messages.filter((m) => m.direction === "OUTBOUND").length,
    newestAt: messages[messages.length - 1]?.createdAt,
  });

  return res.status(200).json({ data: messages });
  } catch (error) {
    return next(error);
  }
});

router.get("/conversations/:id/logs", async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant introuvable." });
    }

    const conversationId = req.params.id;
    const messages = await prisma.message.findMany({
      where: { tenantId, conversationId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const logs = messages.map((message) => {
      const payloadType = message.rawPayload?.type;
      const isTunnel =
        payloadType === "tunnel_public" ||
        (message.body &&
          message.body.toLowerCase().includes("message prive"));
      return {
        id: message.id,
        createdAt: message.createdAt,
        type: isTunnel ? "tunnel" : message.direction.toLowerCase(),
        summary:
          message.direction === "INBOUND"
            ? "Message client recu"
            : "Reponse envoyee",
        detail: message.body,
      };
    });

    return res.status(200).json({ data: logs });
  } catch (error) {
    return next(error);
  }
});

router.patch("/conversations/:id/status", async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant introuvable." });
    }

    const conversationId = req.params.id;
    const { status } = req.body || {};
    if (!status) {
      return res.status(400).json({ error: "Status requis." });
    }

    // Si on repasse en OPEN, réactiver l'IA pour cette conversation
    const updateData = { status };
    if (status === "OPEN") {
      updateData.isAiEnabled = true;
    }

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: updateData,
    });

    // Émettre un événement Socket.io pour la mise à jour de conversation
    try {
      const { broadcastToTenant } = require("../services/websocket");
      broadcastToTenant(tenantId, "conversation_updated", {
        conversationId,
        conversation: updated,
      });
    } catch (error) {
      console.error("[CONVERSATIONS] Erreur émission Socket.io (status update):", error);
    }

    return res.status(200).json({ data: updated });
  } catch (error) {
    return next(error);
  }
});

router.post("/conversations/:id/messages", async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant introuvable." });
    }

    const conversationId = req.params.id;
    const { body: messageBody } = req.body || {};

    if (!messageBody || !messageBody.trim()) {
      return res.status(400).json({ error: "Message requis." });
    }

    // Vérifier que la conversation existe et appartient au tenant
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation introuvable." });
    }

    // Vérifier que le canal est WhatsApp (pour l'instant, on supporte seulement WhatsApp)
    if (conversation.channel !== "WHATSAPP") {
      return res.status(400).json({
        error: "L'envoi manuel de messages n'est actuellement supporté que pour WhatsApp.",
      });
    }

    if (!conversation.customerHandle) {
      return res.status(400).json({
        error: "Numéro client introuvable pour cette conversation.",
      });
    }

    // Envoyer le message via Meta WhatsApp
    const { sendMetaWhatsAppMessage } = require("../services/messagingService");
    const sendResult = await sendMetaWhatsAppMessage({
      to: conversation.customerHandle,
      body: messageBody.trim(),
      tenantId,
    });

    if (!sendResult.sent) {
      return res.status(500).json({
        error: "Erreur lors de l'envoi du message. Vérifiez la configuration Meta WhatsApp.",
      });
    }

    // Enregistrer le message en base
    const { createOutboundMessage, updateOutboundTimestamp } = require("../services/messageProcessor");
    const message = await createOutboundMessage({
      tenantId,
      conversationId: conversation.id,
      externalMessageId: sendResult.messageId || `manual-${Date.now()}`,
      fromHandle: null,
      toHandle: conversation.customerHandle,
      body: messageBody.trim(),
      rawPayload: { type: "manual", messageId: sendResult.messageId },
      costUsd: 0, // Meta WhatsApp est gratuit dans la fenêtre 24h
      tokenUsage: 0,
    });

    // Mettre à jour les timestamps de la conversation
    await updateOutboundTimestamp(conversation.id);

    // Émettre un événement Socket.io pour le nouveau message (déjà fait dans createOutboundMessage, mais on émet aussi un événement de conversation mise à jour)
    try {
      const { broadcastToTenant } = require("../services/websocket");
      const updatedConversation = await prisma.conversation.findUnique({
        where: { id: conversation.id },
      });
      broadcastToTenant(tenantId, "conversation_updated", {
        conversationId: conversation.id,
        conversation: updatedConversation,
      });
    } catch (error) {
      console.error("[CONVERSATIONS] Erreur émission Socket.io (message manuel):", error);
    }

    return res.status(201).json({ data: message });
  } catch (error) {
    console.error("[CONVERSATIONS] Erreur envoi message manuel:", error);
    return next(error);
  }
});

// Activer / désactiver l'IA pour une conversation précise
router.patch("/conversations/:id/ai", async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant introuvable." });
    }

    const conversationId = req.params.id;
    const { isAiEnabled } = req.body || {};

    if (typeof isAiEnabled !== "boolean") {
      return res.status(400).json({ error: "isAiEnabled (booléen) est requis." });
    }

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: { isAiEnabled },
    });

    // Émettre un événement Socket.io pour la mise à jour
    try {
      const { broadcastToTenant } = require("../services/websocket");
      broadcastToTenant(tenantId, "conversation_updated", {
        conversationId,
        conversation: updated,
      });
    } catch (error) {
      console.error("[CONVERSATIONS] Erreur émission Socket.io (ai toggle):", error);
    }

    return res.status(200).json({ data: updated });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
