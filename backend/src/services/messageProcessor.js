const { prisma } = require("./prisma");

// Message unique utilisé lorsque la conversation est transmise à un humain.
// IMPORTANT: cette phrase doit rester strictement identique partout
// (prompts IA, détection de handoff, etc.).
const HANDOFF_MESSAGE =
  "Je passe la main à mon supérieur qui vous reviendra sous peu de temps.";

const isHandoffResponse = (answer) => {
  if (!answer) return true;
  
  // Vérification exacte (message standard)
  if (answer.trim() === HANDOFF_MESSAGE) {
    return true;
  }
  
  // Détection intelligente : chercher des phrases clés qui indiquent un handoff
  // IMPORTANT: On ne détecte un handoff que si l'IA dit explicitement qu'elle "passe la main"
  // Les mots comme "notre équipe" ou "vous recontacter" seuls ne suffisent pas
  const lowerAnswer = answer.toLowerCase();
  
  // Mots-clés STRICTS qui indiquent un handoff explicite
  const strictHandoffPhrases = [
    "je passe la main",
    "je passe le relais",
    "je passe à mon supérieur",
    "je passe à un humain",
    "je passe à un opérateur",
    "je passe à un agent",
    "passer la main à mon supérieur",
    "passer le relais à mon supérieur",
    "passer la main à un humain",
    "passer le relais à un humain",
    "mon supérieur vous reviendra",
    "un supérieur vous reviendra",
    "un humain vous reviendra",
    "un opérateur vous reviendra",
  ];
  
  // Vérifier si le message contient une phrase de handoff explicite
  const hasStrictHandoffPhrase = strictHandoffPhrases.some(phrase => lowerAnswer.includes(phrase));
  if (hasStrictHandoffPhrase) {
    console.log(`[HANDOFF] Détection intelligente: phrase de handoff explicite détectée`);
    return true;
  }
  
  // Détection combinée : "passer la main" ou "passer le relais" + "supérieur/humain/opérateur" + "reviendra/recontacter"
  // Cette combinaison indique clairement un handoff
  const hasPassAction = lowerAnswer.includes("passer la main") || lowerAnswer.includes("passer le relais");
  const hasRecipient = lowerAnswer.includes("supérieur") || lowerAnswer.includes("humain") || lowerAnswer.includes("opérateur") || lowerAnswer.includes("agent");
  const hasReturnPromise = lowerAnswer.includes("reviendra") || lowerAnswer.includes("recontacter") || lowerAnswer.includes("recontactera");
  
  if (hasPassAction && hasRecipient && hasReturnPromise) {
    console.log(`[HANDOFF] Détection intelligente: combinaison de handoff détectée (action + destinataire + promesse de retour)`);
    return true;
  }
  
  return false;
};

/**
 * Supprime toutes les anciennes conversations d'un numéro de téléphone
 * qui appartiennent à d'autres tenants. Utilisé quand un numéro est mappé
 * à un nouveau tenant pour éviter la confusion entre différents services.
 * 
 * @param {string} phoneNumber - Numéro de téléphone (externalThreadId)
 * @param {string} currentTenantId - Tenant actuel auquel le numéro est mappé
 * @param {string} channel - Canal de communication (WHATSAPP, etc.)
 */
const cleanupOldConversationsForPhoneNumber = async (phoneNumber, currentTenantId, channel = "WHATSAPP") => {
  if (!phoneNumber || !currentTenantId) {
    return;
  }

  try {
    // Trouver toutes les conversations de ce numéro avec d'autres tenants
    const oldConversations = await prisma.conversation.findMany({
      where: {
        externalThreadId: phoneNumber,
        channel: channel,
        tenantId: {
          not: currentTenantId, // Exclure le tenant actuel
        },
      },
      select: {
        id: true,
        tenantId: true,
        status: true,
        createdAt: true,
      },
    });

    if (oldConversations.length === 0) {
      console.log(`[CLEANUP] Aucune ancienne conversation trouvée pour ${phoneNumber}`);
      return;
    }

    console.log(`[CLEANUP] 🗑️ Suppression de ${oldConversations.length} ancienne(s) conversation(s) pour ${phoneNumber}`);
    
    for (const conv of oldConversations) {
      console.log(`[CLEANUP]   - Conversation ${conv.id} (tenant: ${conv.tenantId}, statut: ${conv.status}, créée: ${conv.createdAt})`);
    }

    // Supprimer tous les messages de ces conversations
    const conversationIds = oldConversations.map(c => c.id);
    const deletedMessages = await prisma.message.deleteMany({
      where: {
        conversationId: {
          in: conversationIds,
        },
      },
    });

    console.log(`[CLEANUP]   ✅ ${deletedMessages.count} message(s) supprimé(s)`);

    // Supprimer les conversations elles-mêmes
    const deletedConversations = await prisma.conversation.deleteMany({
      where: {
        id: {
          in: conversationIds,
        },
      },
    });

    console.log(`[CLEANUP]   ✅ ${deletedConversations.count} conversation(s) supprimée(s)`);
    console.log(`[CLEANUP] ✅ Nettoyage terminé pour ${phoneNumber} - Nouveau tenant: ${currentTenantId}`);
  } catch (error) {
    console.error(`[CLEANUP] ❌ Erreur lors du nettoyage des anciennes conversations:`, error);
    // Ne pas bloquer le traitement si le nettoyage échoue
  }
};

const ensureConversation = async ({
  tenantId,
  channel,
  externalThreadId,
  customerHandle,
}) => {
  // IMPORTANT: Nettoyer les anciennes conversations de ce numéro avec d'autres tenants
  // avant de créer/retrouver la conversation actuelle
  // Cela garantit qu'un numéro ne garde que les conversations de son tenant actuel
  if (externalThreadId && tenantId) {
    await cleanupOldConversationsForPhoneNumber(externalThreadId, tenantId, channel);
  }

  return prisma.conversation.upsert({
    where: {
      tenantId_externalThreadId: {
        tenantId,
        externalThreadId,
      },
    },
    create: {
      tenantId,
      channel,
      externalThreadId,
      customerHandle,
      lastMessageAt: new Date(),
      lastInboundAt: new Date(),
    },
    update: {
      customerHandle,
      lastMessageAt: new Date(),
      lastInboundAt: new Date(),
    },
  });
};

const createInboundMessage = async ({
  tenantId,
  conversationId,
  externalMessageId,
  fromHandle,
  toHandle,
  body,
  rawPayload,
}) => {
  const message = await prisma.message.create({
    data: {
      tenantId,
      conversationId,
      direction: "INBOUND",
      externalMessageId,
      fromHandle,
      toHandle,
      body,
      rawPayload,
      costUsd: 0,
      tokenUsage: 0,
    },
  });

  // Émettre un événement Socket.io pour le nouveau message
  try {
    const { broadcastToTenant } = require("./websocket");
    const socketPayload = {
      conversationId,
      message: {
        id: message.id,
        direction: message.direction,
        body: message.body,
        createdAt: message.createdAt,
        fromHandle: message.fromHandle,
        toHandle: message.toHandle,
      },
    };
    broadcastToTenant(tenantId, "new_message", socketPayload);
    console.log(`[MESSAGE PROCESSOR] ✅ Événement Socket.io 'new_message' émis pour conversation ${conversationId}, message ID: ${message.id}`);
  } catch (error) {
    console.error("[MESSAGE PROCESSOR] Erreur émission Socket.io (inbound):", error);
  }

  return message;
};

const createOutboundMessage = async ({
  tenantId,
  conversationId,
  externalMessageId,
  fromHandle,
  toHandle,
  body,
  rawPayload,
  costUsd,
  tokenUsage,
}) => {
  console.log(`[MESSAGE PROCESSOR] Création message OUTBOUND:`, {
    tenantId,
    conversationId,
    bodyLength: body?.length || 0,
    bodyPreview: body?.substring(0, 50) || "",
  });
  
  const message = await prisma.message.create({
    data: {
      tenantId,
      conversationId,
      direction: "OUTBOUND",
      externalMessageId,
      fromHandle,
      toHandle,
      body,
      rawPayload,
      costUsd: costUsd ?? 0,
      tokenUsage: tokenUsage ?? 0,
    },
  });
  
  console.log(`[MESSAGE PROCESSOR] Message OUTBOUND créé avec ID: ${message.id}`);

  // Émettre un événement Socket.io pour le nouveau message
  try {
    const { broadcastToTenant } = require("./websocket");
    broadcastToTenant(tenantId, "new_message", {
      conversationId,
      message: {
        id: message.id,
        direction: message.direction,
        body: message.body,
        createdAt: message.createdAt,
        fromHandle: message.fromHandle,
        toHandle: message.toHandle,
      },
    });
  } catch (error) {
    console.error("[MESSAGE PROCESSOR] Erreur émission Socket.io (outbound):", error);
  }

  return message;
};

const updateInboundTimestamp = async (conversationId) => {
  return prisma.conversation.update({
    where: { id: conversationId },
    data: { lastInboundAt: new Date(), lastMessageAt: new Date() },
  });
};

const updateOutboundTimestamp = async (conversationId) => {
  return prisma.conversation.update({
    where: { id: conversationId },
    data: { lastOutboundAt: new Date(), lastMessageAt: new Date() },
  });
};

const markConversationManual = async (conversationId) => {
  // Quand on passe en mode manuel (handoff), on désactive l'IA pour cette conversation
  // L'IA ne répondra plus tant qu'un humain ne réactive pas manuellement
  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: { 
      status: "MANUAL_MODE",
      isAiEnabled: false, // Désactiver l'IA pour cette conversation
    },
  });

  // Émettre un événement Socket.io pour mettre à jour les tickets en temps réel
  try {
    const { broadcastToTenant } = require("./websocket");
    broadcastToTenant(updated.tenantId, "conversation_updated", {
      conversationId: updated.id,
      conversation: updated,
    });
    console.log(`[HANDOFF] ✅ Conversation ${conversationId} passée en MANUAL_MODE, événement Socket.io émis`);
  } catch (error) {
    console.error("[HANDOFF] Erreur émission Socket.io:", error);
  }

  return updated;
};

module.exports = {
  HANDOFF_MESSAGE,
  isHandoffResponse,
  ensureConversation,
  createInboundMessage,
  createOutboundMessage,
  updateInboundTimestamp,
  updateOutboundTimestamp,
  markConversationManual,
  cleanupOldConversationsForPhoneNumber,
};
