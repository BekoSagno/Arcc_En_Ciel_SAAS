const { prisma } = require("./prisma");

// Map en mémoire pour stocker les timers de debounce par conversation
// Structure: { conversationId: { timer, messages: [], tenantId } }
const typingTimers = new Map();

// Délai pour détecter que le client a FINI d'écrire (en millisecondes)
// Si aucun message n'arrive pendant ce délai, on considère que le client a fini d'écrire
const TYPING_DETECTION_DELAY = Number(process.env.TYPING_DETECTION_DELAY_MS || 10000); // 10 secondes

// Délai avant de traiter les messages APRÈS que le client a fini d'écrire (en millisecondes)
// Attendre 5 secondes après la fin d'écriture pour voir si d'autres messages arrivent
const TYPING_DEBOUNCE_DELAY = Number(process.env.TYPING_DEBOUNCE_DELAY_MS || 5000); // 5 secondes

// Délai maximum pour éviter d'attendre trop longtemps (en millisecondes)
// Si le client continue d'écrire pendant plus de 5 minutes, traiter quand même
const MAX_WAIT_DELAY = Number(process.env.TYPING_MAX_WAIT_DELAY_MS || 300000); // 5 minutes

/**
 * Ajoute un message à la file d'attente de traitement pour une conversation.
 * Si un timer existe déjà, il est réinitialisé.
 * Après le délai de debounce, tous les messages en attente sont traités.
 * 
 * @param {string} conversationId - ID de la conversation
 * @param {string} tenantId - ID du tenant
 * @param {object} messageData - Données du message (body, mediaPayload, etc.)
 * @param {function} processCallback - Fonction à appeler pour traiter les messages
 */
async function queueMessageForProcessing(conversationId, tenantId, messageData, processCallback) {
  console.log(`[TYPING] 📝 Message reçu pour conversation ${conversationId}`);
  
  // Récupérer ou créer l'entrée pour cette conversation
  let conversationQueue = typingTimers.get(conversationId);
  
  if (!conversationQueue) {
    conversationQueue = {
      conversationId,
      tenantId,
      messages: [],
      typingTimer: null,      // Timer pour détecter la fin d'écriture
      debounceTimer: null,    // Timer de 5 secondes après la fin d'écriture
      startTime: Date.now(),
      lastMessageTime: Date.now(),
      isProcessing: false,
      isTyping: true,         // Le client est considéré comme "en train d'écrire"
    };
    typingTimers.set(conversationId, conversationQueue);
    console.log(`[TYPING] 🆕 Nouvelle file créée - Le client est en train d'écrire`);
  }
  
  // Vérifier si la file est en cours de traitement
  if (conversationQueue.isProcessing) {
    console.log(`[TYPING] ⏳ File en cours de traitement, attente de 1 seconde avant d'ajouter le message...`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const updatedQueue = typingTimers.get(conversationId);
    if (updatedQueue && updatedQueue.isProcessing) {
      // Ajouter le message à la file existante même si elle est en traitement
      updatedQueue.messages.push({
        ...messageData,
        receivedAt: Date.now(),
      });
      console.log(`[TYPING] 📝 Message ajouté à la file en cours de traitement (${updatedQueue.messages.length} message(s) en attente)`);
      return;
    } else if (updatedQueue) {
      conversationQueue = updatedQueue;
    }
  }
  
  // Ajouter le message à la file d'attente
  conversationQueue.messages.push({
    ...messageData,
    receivedAt: Date.now(),
  });
  conversationQueue.lastMessageTime = Date.now();
  conversationQueue.isTyping = true; // Le client est en train d'écrire
  
  console.log(`[TYPING] ✍️ Client détecté comme "en train d'écrire" - ${conversationQueue.messages.length} message(s) en attente`);
  
  // Annuler le timer de détection de fin d'écriture s'il existe
  if (conversationQueue.typingTimer) {
    clearTimeout(conversationQueue.typingTimer);
    conversationQueue.typingTimer = null;
    console.log(`[TYPING] ⏱️ Timer de détection de fin d'écriture annulé - Le client continue d'écrire`);
  }
  
  // Annuler le timer de debounce s'il existe (car le client est toujours en train d'écrire)
  if (conversationQueue.debounceTimer) {
    clearTimeout(conversationQueue.debounceTimer);
    conversationQueue.debounceTimer = null;
    console.log(`[TYPING] ⏱️ Timer de debounce annulé - Le client continue d'écrire`);
  }
  
  // Vérifier si on a dépassé le délai maximum
  const elapsed = Date.now() - conversationQueue.startTime;
  if (elapsed >= MAX_WAIT_DELAY) {
    console.log(`[TYPING] ⏰ Délai maximum atteint (${Math.round(elapsed/1000)}s), traitement immédiat pour conversation ${conversationId}`);
    return processQueuedMessages(conversationId, processCallback);
  }
  
  // Lancer le timer pour détecter la fin d'écriture
  // Si aucun message n'arrive pendant TYPING_DETECTION_DELAY, on considère que le client a fini d'écrire
  conversationQueue.typingTimer = setTimeout(() => {
    const detectionSeconds = Math.round(TYPING_DETECTION_DELAY / 1000);
    console.log(`[TYPING] ✅ ${detectionSeconds} secondes sans nouveau message - Le client a FINI d'écrire`);
    console.log(`[TYPING] 🚀 Lancement du timer de ${Math.round(TYPING_DEBOUNCE_DELAY / 1000)} secondes pour regrouper d'éventuels messages supplémentaires`);
    
    // Le client a fini d'écrire, maintenant lancer le timer de 5 secondes
    conversationQueue.isTyping = false;
    conversationQueue.typingTimer = null;
    
    // Lancer le timer de debounce de 5 secondes
    conversationQueue.debounceTimer = setTimeout(async () => {
      const debounceSeconds = Math.round(TYPING_DEBOUNCE_DELAY / 1000);
      console.log(`[TYPING] ✅ ${debounceSeconds} secondes écoulées sans nouveau message après la fin d'écriture`);
      console.log(`[TYPING] 🚀 Traitement de tous les messages regroupés pour conversation ${conversationId}`);
      await processQueuedMessages(conversationId, processCallback);
    }, TYPING_DEBOUNCE_DELAY);
    
    console.log(`[TYPING] ⏳ Timer de debounce lancé: ${Math.round(TYPING_DEBOUNCE_DELAY / 1000)} secondes pour conversation ${conversationId}`);
  }, TYPING_DETECTION_DELAY);
  
  const detectionSeconds = Math.round(TYPING_DETECTION_DELAY / 1000);
  console.log(`[TYPING] ⏳ Timer de détection de fin d'écriture: ${detectionSeconds} secondes (${conversationQueue.messages.length} message(s) en attente)`);
}

/**
 * Traite tous les messages en attente pour une conversation.
 * Combine les messages en un seul texte et appelle le callback de traitement.
 * 
 * @param {string} conversationId - ID de la conversation
 * @param {function} processCallback - Fonction à appeler pour traiter les messages
 */
async function processQueuedMessages(conversationId, processCallback) {
  const conversationQueue = typingTimers.get(conversationId);
  
  if (!conversationQueue || conversationQueue.messages.length === 0) {
    console.log(`[TYPING] ⚠️ Aucun message en attente pour conversation ${conversationId}`);
    return;
  }
  
  // Nettoyer les timers
  if (conversationQueue.typingTimer) {
    clearTimeout(conversationQueue.typingTimer);
    conversationQueue.typingTimer = null;
  }
  if (conversationQueue.debounceTimer) {
    clearTimeout(conversationQueue.debounceTimer);
    conversationQueue.debounceTimer = null;
  }
  
  // IMPORTANT: Copier les messages AVANT de supprimer la file
  // pour éviter qu'un nouveau message qui arrive pendant le traitement crée une nouvelle file
  const messages = [...conversationQueue.messages];
  const tenantId = conversationQueue.tenantId;
  
  // Marquer la file comme "en cours de traitement" pour éviter qu'elle soit réutilisée
  // mais ne pas la supprimer tout de suite au cas où un nouveau message arrive
  conversationQueue.isProcessing = true;
  conversationQueue.messages = []; // Vider les messages pour éviter les doublons
  
  console.log(`[TYPING] 🚀 Traitement de ${messages.length} message(s) en attente pour conversation ${conversationId}`);
  
  // Combiner les messages en un seul texte
  // Si plusieurs messages texte, les combiner avec des sauts de ligne
  // Si un message contient du média (audio/image), le traiter séparément
  const textMessages = messages.filter(m => !m.mediaPayload || m.mediaPayload.type === "text");
  const mediaMessages = messages.filter(m => m.mediaPayload && m.mediaPayload.type !== "text");
  
  // Combiner les messages texte
  let combinedBody = textMessages
    .map(m => m.body || m.bodyText || "")
    .filter(text => text && text.trim().length > 0)
    .join("\n\n");
  
  // Si on a des messages média, on les traite séparément
  // Pour l'instant, on traite le dernier message média si présent
  const lastMediaMessage = mediaMessages.length > 0 ? mediaMessages[mediaMessages.length - 1] : null;
  
  // Préparer les données pour le callback
  const messageData = {
    conversationId,
    tenantId,
    body: combinedBody || (lastMediaMessage ? lastMediaMessage.body : ""),
    mediaPayload: lastMediaMessage ? lastMediaMessage.mediaPayload : null,
    detectedLanguage: messages[0]?.detectedLanguage || "fr",
    messageCount: messages.length,
    messages: messages, // Garder tous les messages pour référence
  };
  
  try {
    await processCallback(messageData);
    console.log(`[TYPING] ✅ Messages traités avec succès pour conversation ${conversationId}`);
  } catch (error) {
    console.error(`[TYPING] ❌ Erreur lors du traitement des messages pour conversation ${conversationId}:`, error);
    throw error;
  } finally {
    // Nettoyer la file d'attente APRÈS le traitement
    // Vérifier si de nouveaux messages sont arrivés pendant le traitement
    const currentQueue = typingTimers.get(conversationId);
    if (currentQueue && currentQueue.isProcessing && currentQueue.messages.length === 0) {
      // Aucun nouveau message n'est arrivé, supprimer la file
      typingTimers.delete(conversationId);
      console.log(`[TYPING] 🧹 File d'attente supprimée après traitement pour conversation ${conversationId}`);
    } else if (currentQueue && currentQueue.isProcessing && currentQueue.messages.length > 0) {
      // De nouveaux messages sont arrivés pendant le traitement, relancer le timer
      const delaySeconds = Math.round(TYPING_DEBOUNCE_DELAY / 1000);
      console.log(`[TYPING] 📝 ${currentQueue.messages.length} nouveau(x) message(s) arrivé(s) pendant le traitement`);
      console.log(`[TYPING] 🔄 Relance du timer de ${delaySeconds} secondes pour regrouper tous les messages`);
      currentQueue.isProcessing = false;
      currentQueue.startTime = Date.now();
      
      // Réinitialiser les timers existants
      if (currentQueue.typingTimer) {
        clearTimeout(currentQueue.typingTimer);
        currentQueue.typingTimer = null;
      }
      if (currentQueue.debounceTimer) {
        clearTimeout(currentQueue.debounceTimer);
        currentQueue.debounceTimer = null;
      }
      
      // Le client est de nouveau en train d'écrire
      currentQueue.isTyping = true;
      currentQueue.lastMessageTime = Date.now();
      
      // Relancer le timer de détection de fin d'écriture
      const detectionSeconds = Math.round(TYPING_DETECTION_DELAY / 1000);
      currentQueue.typingTimer = setTimeout(() => {
        console.log(`[TYPING] ✅ ${detectionSeconds} secondes sans nouveau message - Le client a FINI d'écrire`);
        currentQueue.isTyping = false;
        currentQueue.typingTimer = null;
        
        // Lancer le timer de debounce de 5 secondes
        currentQueue.debounceTimer = setTimeout(async () => {
          const debounceSeconds = Math.round(TYPING_DEBOUNCE_DELAY / 1000);
          console.log(`[TYPING] ✅ ${debounceSeconds} secondes écoulées sans nouveau message après la fin d'écriture`);
          console.log(`[TYPING] 🚀 Traitement de tous les messages regroupés pour conversation ${conversationId}`);
          await processQueuedMessages(conversationId, processCallback);
        }, TYPING_DEBOUNCE_DELAY);
        
        console.log(`[TYPING] ⏳ Timer de debounce lancé: ${Math.round(TYPING_DEBOUNCE_DELAY / 1000)} secondes`);
      }, TYPING_DETECTION_DELAY);
      
      console.log(`[TYPING] 🔄 Timer de détection de fin d'écriture relancé: ${detectionSeconds} secondes (${currentQueue.messages.length} message(s) en attente)`);
    } else if (currentQueue && currentQueue.isProcessing) {
      // Marquer comme non en traitement
      currentQueue.isProcessing = false;
    }
  }
}

/**
 * Annule le traitement en attente pour une conversation (si nécessaire).
 * 
 * @param {string} conversationId - ID de la conversation
 */
function cancelTypingTimer(conversationId) {
  const conversationQueue = typingTimers.get(conversationId);
  
  if (conversationQueue) {
    if (conversationQueue.typingTimer) {
      clearTimeout(conversationQueue.typingTimer);
    }
    if (conversationQueue.debounceTimer) {
      clearTimeout(conversationQueue.debounceTimer);
    }
    typingTimers.delete(conversationId);
    console.log(`[TYPING] ❌ Timers annulés pour conversation ${conversationId}`);
  }
}

/**
 * Vérifie si une conversation a des messages en attente de traitement.
 * 
 * @param {string} conversationId - ID de la conversation
 * @returns {boolean} - True si des messages sont en attente
 */
function hasPendingMessages(conversationId) {
  const conversationQueue = typingTimers.get(conversationId);
  return conversationQueue && conversationQueue.messages.length > 0;
}

/**
 * Obtient le nombre de messages en attente pour une conversation.
 * 
 * @param {string} conversationId - ID de la conversation
 * @returns {number} - Nombre de messages en attente
 */
function getPendingMessageCount(conversationId) {
  const conversationQueue = typingTimers.get(conversationId);
  return conversationQueue ? conversationQueue.messages.length : 0;
}

module.exports = {
  queueMessageForProcessing,
  processQueuedMessages,
  cancelTypingTimer,
  hasPendingMessages,
  getPendingMessageCount,
  TYPING_DETECTION_DELAY,
  TYPING_DEBOUNCE_DELAY,
  MAX_WAIT_DELAY,
};
