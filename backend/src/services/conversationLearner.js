const { prisma } = require("./prisma");
const { ingestSource } = require("./ragIngestor");

/**
 * Extrait et formate une conversation en texte pour l'apprentissage
 * Format: Q&A (Question du client / Réponse de l'IA)
 * Amélioration: Filtre les salutations simples pour ne garder que le contenu utile
 */
const formatConversationForLearning = (messages) => {
  if (!messages || messages.length === 0) return "";
  
  // Trier les messages par date (du plus ancien au plus récent)
  const sortedMessages = [...messages].sort((a, b) => 
    new Date(a.createdAt) - new Date(b.createdAt)
  );
  
  const formattedLines = [];
  const greetingPattern = /^(bonjour|salut|bonsoir|hey|hi|hello|ok|merci|d'accord)$/i;
  
  for (const msg of sortedMessages) {
    if (msg.direction === "INBOUND") {
      // Message du client (question)
      const body = (msg.body || "").trim();
      // Ignorer les salutations simples isolées (mais garder si elles sont suivies d'une question)
      if (body && !greetingPattern.test(body) && body.length > 5) {
        formattedLines.push(`Question client: ${body}`);
      } else if (body && body.length > 5) {
        // Si c'est une salutation mais qu'elle fait partie d'un message plus long, la garder
        formattedLines.push(`Question client: ${body}`);
      }
    } else if (msg.direction === "OUTBOUND") {
      // Réponse de l'IA - toujours garder (même les salutations de retour sont utiles)
      const body = (msg.body || "").trim();
      if (body && body.length > 0) {
        formattedLines.push(`Réponse: ${body}`);
        formattedLines.push(""); // Ligne vide pour séparer les échanges
      }
    }
  }
  
  const result = formattedLines.join("\n").trim();
  
  // Vérifier que le résultat contient au moins du contenu utile (pas seulement des salutations)
  if (result.length < 50) {
    return ""; // Trop court, probablement juste des salutations
  }
  
  return result;
};

/**
 * Détermine si une conversation est "apprenable" (utile pour enrichir la base de connaissances)
 * Critères améliorés:
 * - La conversation est fermée (CLOSED) OU
 * - La conversation a au moins 3 échanges (questions/réponses) ET
 * - La conversation n'a pas été marquée comme "handoff" (pas de HANDOFF_MESSAGE)
 * - La conversation contient des informations utiles (pas seulement des salutations)
 */
const isConversationLearnable = async (conversationId) => {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
  
  if (!conversation || !conversation.messages || conversation.messages.length === 0) {
    return false;
  }
  
  // Vérifier si la conversation contient le message de handoff
  const hasHandoff = conversation.messages.some(msg => 
    msg.direction === "OUTBOUND" && 
    msg.body && 
    msg.body.includes("Je passe la main à mon supérieur")
  );
  
  if (hasHandoff) {
    console.log(`[LEARNER] Conversation ${conversationId} ignorée (handoff détecté)`);
    return false;
  }
  
  // Compter les échanges (paires question/réponse)
  const inboundMessages = conversation.messages.filter(m => m.direction === "INBOUND");
  const outboundMessages = conversation.messages.filter(m => m.direction === "OUTBOUND");
  const inboundCount = inboundMessages.length;
  const outboundCount = outboundMessages.length;
  
  // Vérifier si la conversation contient des informations utiles (pas seulement des salutations)
  const hasUsefulContent = inboundMessages.some(msg => {
    const body = (msg.body || "").toLowerCase();
    // Exclure les messages qui sont uniquement des salutations
    const isOnlyGreeting = /^(bonjour|salut|bonsoir|hey|hi|hello|ok|merci|d'accord)$/i.test(body.trim());
    return !isOnlyGreeting && body.length > 10; // Au moins 10 caractères et pas juste une salutation
  });
  
  if (!hasUsefulContent && inboundCount > 0) {
    console.log(`[LEARNER] Conversation ${conversationId} ignorée (pas de contenu utile, seulement salutations)`);
    return false;
  }
  
  // Au moins 2 questions et 2 réponses (conversation significative)
  // OU conversation fermée avec au moins 1 échange
  const isSignificant = inboundCount >= 2 && outboundCount >= 2;
  const isClosedWithContent = conversation.status === "CLOSED" && inboundCount >= 1 && outboundCount >= 1;
  
  // La conversation est apprenable si:
  // - Elle est fermée (CLOSED) avec au moins 1 échange utile, OU
  // - Elle est significative (au moins 2 échanges utiles)
  const isLearnable = isClosedWithContent || isSignificant;
  
  if (isLearnable) {
    console.log(`[LEARNER] Conversation ${conversationId} est apprenable (status: ${conversation.status}, échanges: ${inboundCount}Q/${outboundCount}R, contenu utile: ${hasUsefulContent})`);
  }
  
  return isLearnable;
};

/**
 * Apprend d'une conversation spécifique
 * Extrait les messages, les formate, et les indexe dans Pinecone comme source RAG
 */
const learnFromConversation = async (conversationId) => {
  try {
    console.log(`[LEARNER] Début apprentissage conversation ${conversationId}`);
    
    // Vérifier si la conversation est déjà apprise (éviter les doublons)
    const existingSource = await prisma.rAGSource.findFirst({
      where: {
        type: "TEXT",
        title: {
          contains: `conversation-${conversationId}`,
        },
      },
    });
    
    if (existingSource) {
      console.log(`[LEARNER] Conversation ${conversationId} déjà apprise (source: ${existingSource.id})`);
      return { alreadyLearned: true, sourceId: existingSource.id };
    }
    
    // Récupérer la conversation avec ses messages
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });
    
    if (!conversation || !conversation.messages || conversation.messages.length === 0) {
      throw new Error(`Conversation ${conversationId} introuvable ou vide`);
    }
    
    // Formater la conversation en texte
    const conversationText = formatConversationForLearning(conversation.messages);
    
    if (!conversationText || conversationText.trim().length < 50) {
      console.log(`[LEARNER] Conversation ${conversationId} trop courte pour être apprise`);
      return { skipped: true, reason: "too_short" };
    }
    
    // Créer une source RAG pour cette conversation
    const source = await prisma.rAGSource.create({
      data: {
        tenantId: conversation.tenantId,
        type: "TEXT",
        title: `Conversation apprise - ${conversation.customerHandle || "Client"} - ${new Date(conversation.createdAt).toLocaleDateString()}`,
        sourceUrl: null,
        status: "active",
      },
    });
    
    console.log(`[LEARNER] Source RAG créée: ${source.id} pour conversation ${conversationId}`);
    
    // Ingérer la conversation dans Pinecone
    await ingestSource({
      tenantId: conversation.tenantId,
      sourceId: source.id,
      namespace: conversation.tenantId, // Utiliser tenantId comme namespace
      content: conversationText,
    });
    
    console.log(`[LEARNER] ✅ Conversation ${conversationId} apprise avec succès (source: ${source.id})`);
    
    return { 
      success: true, 
      sourceId: source.id,
      chunksCount: conversation.messages.length,
    };
  } catch (error) {
    console.error(`[LEARNER] ❌ Erreur apprentissage conversation ${conversationId}:`, error);
    throw error;
  }
};

/**
 * Apprend automatiquement des conversations fermées récentes
 * Appelé périodiquement ou après qu'une conversation soit fermée
 */
const learnFromRecentConversations = async (tenantId, limit = 10) => {
  try {
    console.log(`[LEARNER] Recherche conversations récentes à apprendre pour tenant ${tenantId}`);
    
    // Récupérer les conversations fermées récentes qui n'ont pas encore été apprises
    const closedConversations = await prisma.conversation.findMany({
      where: {
        tenantId,
        status: "CLOSED",
        updatedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Dernières 7 jours
        },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: 1, // Juste pour vérifier qu'il y a des messages
        },
      },
    });
    
    console.log(`[LEARNER] ${closedConversations.length} conversations fermées trouvées`);
    
    const results = [];
    
    for (const conversation of closedConversations) {
      // Vérifier si la conversation est apprenable
      const learnable = await isConversationLearnable(conversation.id);
      
      if (learnable) {
        try {
          const result = await learnFromConversation(conversation.id);
          results.push({ conversationId: conversation.id, ...result });
        } catch (error) {
          console.error(`[LEARNER] Erreur apprentissage conversation ${conversation.id}:`, error.message);
          results.push({ conversationId: conversation.id, error: error.message });
        }
      }
    }
    
    console.log(`[LEARNER] ✅ Apprentissage terminé: ${results.length} conversations traitées`);
    
    return results;
  } catch (error) {
    console.error(`[LEARNER] ❌ Erreur apprentissage conversations récentes:`, error);
    throw error;
  }
};

/**
 * Apprend automatiquement d'une conversation quand elle est fermée
 * À appeler depuis le worker ou un endpoint
 */
const learnWhenConversationClosed = async (conversationId) => {
  try {
    const learnable = await isConversationLearnable(conversationId);
    
    if (learnable) {
      console.log(`[LEARNER] Conversation ${conversationId} fermée et apprenable, démarrage apprentissage...`);
      await learnFromConversation(conversationId);
    } else {
      console.log(`[LEARNER] Conversation ${conversationId} fermée mais non apprenable (ignorée)`);
    }
  } catch (error) {
    // Ne pas faire échouer le processus principal si l'apprentissage échoue
    console.error(`[LEARNER] Erreur apprentissage automatique conversation ${conversationId}:`, error.message);
  }
};

module.exports = {
  formatConversationForLearning,
  isConversationLearnable,
  learnFromConversation,
  learnFromRecentConversations,
  learnWhenConversationClosed,
};
