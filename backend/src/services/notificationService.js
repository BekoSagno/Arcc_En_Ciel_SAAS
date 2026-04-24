const { prisma } = require("./prisma");
const { broadcastNotification } = require("../routes/notifications");

/**
 * Créer une notification et la broadcaster en temps réel
 */
async function createNotification({ tenantId, userId = null, type, title, message, data = null }) {
  try {
    const notification = await prisma.notification.create({
      data: {
        tenantId,
        userId,
        type,
        title,
        message,
        data,
      },
    });

    // Broadcaster en temps réel
    broadcastNotification(tenantId, notification);

    return notification;
  } catch (error) {
    console.error("[NOTIFICATION SERVICE] Erreur création:", error);
    throw error;
  }
}

/**
 * Créer une notification pour un nouveau message
 */
async function notifyNewMessage({ tenantId, conversationId, messageId, customerHandle, messagePreview }) {
  return createNotification({
    tenantId,
    type: "message",
    title: "Nouveau message",
    message: `Nouveau message de ${customerHandle || "un client"}: ${messagePreview?.substring(0, 50) || ""}`,
    data: {
      conversationId,
      messageId,
      customerHandle,
    },
  });
}

/**
 * Créer une notification pour une nouvelle conversation
 */
async function notifyNewConversation({ tenantId, conversationId, customerHandle, channel }) {
  return createNotification({
    tenantId,
    type: "conversation",
    title: "Nouvelle conversation",
    message: `Nouvelle conversation ${channel} avec ${customerHandle || "un client"}`,
    data: {
      conversationId,
      customerHandle,
      channel,
    },
  });
}

/**
 * Créer une notification pour un handoff (passage à un humain)
 */
async function notifyHandoff({ tenantId, conversationId, customerHandle, reason }) {
  return createNotification({
    tenantId,
    type: "conversation",
    title: "Passage à un humain requis",
    message: `La conversation avec ${customerHandle || "un client"} nécessite une intervention humaine. ${reason || ""}`,
    data: {
      conversationId,
      customerHandle,
      reason,
    },
  });
}

/**
 * Créer une notification pour une source RAG indexée
 */
async function notifyRAGIndexed({ tenantId, sourceId, title, status }) {
  return createNotification({
    tenantId,
    type: "rag",
    title: status === "indexed" ? "Document indexé" : "Erreur d'indexation",
    message: status === "indexed" 
      ? `Le document "${title}" a été indexé avec succès.`
      : `Erreur lors de l'indexation du document "${title}".`,
    data: {
      sourceId,
      title,
      status,
    },
  });
}

/**
 * Créer une notification système
 */
async function notifySystem({ tenantId, title, message, data = null }) {
  return createNotification({
    tenantId,
    type: "system",
    title,
    message,
    data,
  });
}

module.exports = {
  createNotification,
  notifyNewMessage,
  notifyNewConversation,
  notifyHandoff,
  notifyRAGIndexed,
  notifySystem,
};
