require("dotenv").config();

const { Worker } = require("bullmq");
const { isRedisEnabled } = require("./queues/messageQueue");
const {
  extractMetaWhatsAppMessageId,
  extractMetaWhatsAppThreadId,
  extractMetaMessageId,
  extractMetaThreadId,
} = require("./utils/extractors");
const {
  ensureConversation,
  createInboundMessage,
  markConversationManual,
  HANDOFF_MESSAGE,
  isHandoffResponse,
  updateInboundTimestamp,
} = require("./services/messageProcessor");
const { findRelevantContext } = require("./services/ragService");
const { generateAnswer } = require("./services/aiService");
const { reminderQueue } = require("./queues/reminderQueue");
const { sendResponse } = require("./services/messagingService");
const { downloadMetaMedia } = require("./services/messagingService");
const { transcribeAndAnalyze } = require("./services/audioService");
const { analyzeImage } = require("./services/imageService");
const {
  detectTopicChange,
  filterContextByTopic,
  filterConversationHistory,
} = require("./services/contextFilter");
const { learnWhenConversationClosed, isConversationLearnable } = require("./services/conversationLearner");
const { notifyNewMessage, notifyNewConversation, notifyHandoff } = require("./services/notificationService");
const { canRespond, consumeConversation, getBlockedMessage } = require("./services/quotaService");

const connection = {
  url: process.env.REDIS_URL || "redis://localhost:6379",
};

if (!isRedisEnabled) {
  // eslint-disable-next-line no-console
  console.log("Redis desactive, worker arrete.");
  process.exit(0);
}

const processor = async (job) => {
  const { channel, payload, tenantId } = job.data;

  if (!tenantId) {
    return { skipped: true, reason: "tenant_missing" };
  }

  let externalMessageId = null;
  let externalThreadId = null;
  let fromHandle = null;
  let body = "";
  let detectedLanguage = "fr";
  let mediaPayload = null;

  if (channel === "WHATSAPP") {
    // Meta WhatsApp webhook structure
    const entry = payload.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages?.[0];
    const contacts = value?.contacts?.[0];
    
    externalMessageId = extractMetaWhatsAppMessageId(payload);
    externalThreadId = extractMetaWhatsAppThreadId(payload);
    fromHandle = contacts?.wa_id || messages?.from || null;
    const messageType = messages?.type || "text";

    if (messageType === "audio" && messages?.audio?.id) {
      try {
        const mediaId = messages.audio.id;
        console.log(`[WORKER] 📥 Détection audio - mediaId: ${mediaId}`);
        
        // Étape 1: Télécharger le média depuis Meta
        const { buffer: audioBuffer, mimeType } = await downloadMetaMedia({ tenantId, mediaId });
        console.log(`[WORKER] ✅ Média téléchargé - taille: ${audioBuffer.length} bytes, mimeType: ${mimeType}`);
        
        // Étape 2: Transcrire et analyser avec Gemini
        const transcript = await transcribeAndAnalyze(audioBuffer, mimeType);
        body = transcript.text || "";
        detectedLanguage = transcript.language || "unknown";
        mediaPayload = { mediaId, type: "audio", mimeType };
        console.log(`[WORKER] ✅ Audio transcrit - transcription="${body}" lang=${detectedLanguage} mime=${mimeType}`);
        
        // Log détaillé si transcription vide
        if (!body || body.trim().length === 0) {
          console.warn("[WORKER] ⚠️ Transcription vide - objet complet:", JSON.stringify(transcript, null, 2));
        }
      } catch (err) {
        console.error("[WORKER] ❌ Erreur traitement audio:", {
          error: err.message,
          stack: err.stack,
          mediaId: messages.audio.id,
          mimeType: messages.audio.mime_type
        });
        body = "";
        detectedLanguage = "unknown";
        mediaPayload = { mediaId: messages.audio.id, error: err.message };
      }
    } else if (messageType === "image" && messages?.image?.id) {
      try {
        const mediaId = messages.image.id;
        console.log(`[WORKER] 📷 Détection image - mediaId: ${mediaId}`);
        
        // Étape 1: Télécharger le média depuis Meta
        const { buffer: imageBuffer, mimeType } = await downloadMetaMedia({ tenantId, mediaId });
        console.log(`[WORKER] ✅ Média téléchargé - taille: ${imageBuffer.length} bytes, mimeType: ${mimeType}`);
        
        // Étape 2: Analyser avec Gemini Vision
        // Si le client a envoyé du texte avec l'image, l'utiliser comme question
        const question = messages?.text?.body || messages?.caption || null;
        
        const analysis = await analyzeImage(imageBuffer, mimeType, question);
        
        // Vérifier si les services mentionnés dans l'image sont dans la base de connaissance
        const { findRelevantContext } = require("./services/ragService");
        let ragContext = [];
        let hasRAGMatch = false;
        
        // Construire une requête de recherche RAG à partir de l'analyse de l'image
        const searchQuery = analysis.text || analysis.description || analysis.analysis || "";
        if (searchQuery && searchQuery.trim().length > 0) {
          console.log(`[WORKER] 🔍 Vérification RAG pour l'image: "${searchQuery.substring(0, 100)}..."`);
          ragContext = await findRelevantContext({
            tenantId,
            question: searchQuery,
            topK: 5,
          });
          hasRAGMatch = ragContext && ragContext.length > 0;
          console.log(`[WORKER] 📚 Résultat RAG: ${ragContext.length} correspondances trouvées`);
        }
        
        // Si des services sont identifiés dans l'image, vérifier aussi avec eux
        if (analysis.services && Array.isArray(analysis.services) && analysis.services.length > 0) {
          console.log(`[WORKER] 🔍 Services identifiés dans l'image: ${analysis.services.join(", ")}`);
          for (const service of analysis.services) {
            if (service && service.trim().length > 0) {
              const serviceContext = await findRelevantContext({
                tenantId,
                question: service,
                topK: 3,
              });
              if (serviceContext && serviceContext.length > 0) {
                hasRAGMatch = true;
                ragContext = [...ragContext, ...serviceContext];
                console.log(`[WORKER] ✅ Service "${service}" trouvé dans la base de connaissance`);
              } else {
                console.log(`[WORKER] ⚠️ Service "${service}" NON trouvé dans la base de connaissance`);
              }
            }
          }
        }
        
        // Construire le texte à partir de l'analyse
        if (question && question.trim().length > 0) {
          if (hasRAGMatch) {
            // Les informations sont dans la base de connaissance → répondre normalement
            body = `[Image] Question: ${question}\n\nAnalyse: ${analysis.analysis || analysis.description || ""}`;
          } else {
            // Les informations ne sont PAS dans la base → indiquer et proposer les services disponibles
            body = `[Image] Question: ${question}\n\nAnalyse: ${analysis.analysis || analysis.description || ""}\n\n⚠️ Vérification RAG: Les services mentionnés dans l'image ne font pas partie de notre base de connaissance.`;
          }
        } else {
          if (hasRAGMatch) {
            // Les informations sont dans la base → répondre normalement
            const parts = [];
            if (analysis.description) parts.push(`Description: ${analysis.description}`);
            if (analysis.text) parts.push(`Texte extrait: ${analysis.text}`);
            if (analysis.analysis) parts.push(`Analyse: ${analysis.analysis}`);
            body = parts.length > 0 ? parts.join("\n\n") : "[Image reçue - analyse en cours]";
          } else {
            // Les informations ne sont PAS dans la base → préparer pour réponse spéciale
            const parts = [];
            if (analysis.description) parts.push(`Description: ${analysis.description}`);
            if (analysis.text) parts.push(`Texte extrait: ${analysis.text}`);
            if (analysis.analysis) parts.push(`Analyse: ${analysis.analysis}`);
            body = parts.length > 0 ? parts.join("\n\n") : "[Image reçue - analyse en cours]";
            body += `\n\n⚠️ Vérification RAG: Les services mentionnés dans l'image ne font pas partie de notre base de connaissance.`;
          }
        }
        
        detectedLanguage = "fr"; // Par défaut pour les images
        mediaPayload = { 
          mediaId, 
          type: "image", 
          mimeType,
          analysis: analysis,
          hasRAGMatch: hasRAGMatch,
          ragContextCount: ragContext.length
        };
        console.log(`[WORKER] ✅ Image analysée - description="${analysis.description?.substring(0, 100)}..." texte="${analysis.text?.substring(0, 50)}..." mime=${mimeType}`);
        
        // Log détaillé si analyse vide
        if (!analysis.description && !analysis.text && !analysis.analysis) {
          console.warn("[WORKER] ⚠️ Analyse d'image vide - objet complet:", JSON.stringify(analysis, null, 2));
        }
      } catch (err) {
        console.error("[WORKER] ❌ Erreur traitement image:", {
          error: err.message,
          stack: err.stack,
          mediaId: messages.image.id,
          mimeType: messages.image.mime_type
        });
        body = "[Image reçue mais erreur lors de l'analyse]";
        detectedLanguage = "fr";
        mediaPayload = { mediaId: messages.image.id, error: err.message };
      }
    } else {
      body = messages?.text?.body || messages?.body || "";
    }
    
    // Debug: vérifier les valeurs extraites
    console.log("[WORKER] WhatsApp payload extrait:", {
      fromHandle,
      phoneNumberId: value?.metadata?.phone_number_id,
      body: body.substring(0, 50),
      messageId: externalMessageId,
    });
    
    // Validation: s'assurer que fromHandle n'est pas notre numéro
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (fromHandle && phoneNumberId && fromHandle.trim() === phoneNumberId.trim()) {
      console.error("[WORKER] ERREUR: fromHandle est égal au phone number ID!", {
        fromHandle,
        phoneNumberId,
      });
      return { skipped: true, reason: "invalid_from_handle" };
    }
  } else if (channel === "FACEBOOK_COMMENT") {
    const change = payload.entry?.[0]?.changes?.[0]?.value;
    externalMessageId = change?.comment_id || null;
    externalThreadId = change?.post_id || change?.comment_id || null;
    fromHandle = change?.from?.id || null;
    body = change?.message || "";
  } else {
    externalMessageId = extractMetaMessageId(payload);
    externalThreadId = extractMetaThreadId(payload);
    const entry = payload.entry?.[0];
    const messaging = entry?.messaging?.[0];
    fromHandle = messaging?.sender?.id || null;
    body = messaging?.message?.text || "";
  }

  const conversation = await ensureConversation({
    tenantId,
    channel,
    externalThreadId: externalThreadId || `${channel}-${fromHandle || "unknown"}`,
    customerHandle: fromHandle,
  });

  // Vérifier si c'est une nouvelle conversation (créée il y a moins de 2 secondes)
  const isNewConversation = conversation.createdAt && (new Date() - new Date(conversation.createdAt)) < 2000;
  if (isNewConversation) {
    notifyNewConversation({
      tenantId,
      conversationId: conversation.id,
      customerHandle: fromHandle,
      channel,
    }).catch(err => console.error("[WORKER] Erreur notification nouvelle conversation:", err));
  }

  const message = await createInboundMessage({
    tenantId,
    conversationId: conversation.id,
    externalMessageId,
    fromHandle,
    toHandle: null,
    body,
    rawPayload: mediaPayload ? { ...payload, audio: mediaPayload } : payload,
  });
  await updateInboundTimestamp(conversation.id);

  // Notification pour nouveau message (en arrière-plan, ne pas bloquer)
  notifyNewMessage({
    tenantId,
    conversationId: conversation.id,
    messageId: message.id,
    customerHandle: fromHandle,
    messagePreview: body,
  }).catch(err => console.error("[WORKER] Erreur notification nouveau message:", err));

  // Si l'IA est désactivée (au niveau tenant ou conversation), vérifier si on doit la réactiver
  try {
    // Désactivation uniquement au niveau de la conversation (pas global par tenant)
    if (conversation.isAiEnabled === false) {
      // Vérifier si c'est un retour après une longue pause (plus de 24h)
      // Si oui, réactiver automatiquement l'IA pour permettre une nouvelle conversation
      const { prisma } = require("./services/prisma");
      const lastOutboundMessage = await prisma.message.findFirst({
        where: { 
          tenantId, 
          conversationId: conversation.id,
          direction: "OUTBOUND"
        },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      
      const lastOutboundAt = lastOutboundMessage?.createdAt || conversation.lastOutboundAt;
      const now = new Date();
      const hoursElapsed = lastOutboundAt ? (now - new Date(lastOutboundAt)) / (1000 * 60 * 60) : 999;
      
      // Réactiver l'IA si :
      // 1. Message audio bien transcrit (le client fait un effort pour communiquer) - PRIORITÉ
      // 2. Pause > 1h (retour après absence)
      const hasTranscribedAudio = mediaPayload && body && body.trim().length > 0;
      const shouldReactivate = hasTranscribedAudio || hoursElapsed >= 1;
      
      console.log(`[WORKER] 🔍 Détails réactivation:`, {
        hasTranscribedAudio,
        hoursElapsed: hoursElapsed.toFixed(1),
        bodyLength: body?.length || 0,
        shouldReactivate
      });
      
      if (shouldReactivate) {
        console.log(
          `[WORKER] 🔄 Réactivation automatique de l'IA pour conversation ${conversation.id} (pause: ${hoursElapsed.toFixed(1)}h${mediaPayload && body ? ' ou audio transcrit' : ''})`
        );
        
        // Réactiver l'IA et remettre en mode OPEN
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { 
            isAiEnabled: true,
            status: "OPEN"
          },
        });
        
        console.log(`[WORKER] ✅ IA réactivée pour conversation ${conversation.id}`);
        // Continuer le traitement normal
      } else {
      console.log(
        `[WORKER] IA désactivée (conversation=${conversation.id}) - aucun appel Gemini, pas de réponse auto`
      );
      return { processed: true, aiDisabled: true };
      }
    }
  } catch (aiFlagError) {
    console.error("[WORKER] Erreur lors de la vérification du flag IA:", aiFlagError);
    // En cas d'erreur de lecture du flag, on continue comme avant pour ne pas bloquer le service.
  }

  // Si audio et langue != fr : réponse polie de traduction
  if (mediaPayload && detectedLanguage && detectedLanguage !== "fr") {
    const polite =
      "Merci pour votre message audio. Pouvez-vous fournir une version en français ou une traduction ? Je serai ravi d'aider dès que possible.";
    await sendResponse({
      conversation,
      answer: polite,
      customerHandle: fromHandle,
    });
    return { processed: true, reason: "non_french_audio" };
  }

  // VÉRIFICATION DES QUOTAS AVANT DE RÉPONDRE
  const quotaCheck = await canRespond(tenantId);
  if (!quotaCheck.allowed) {
    console.log(`[WORKER] ⚠️ Quota épuisé pour tenant ${tenantId}. Blocage de la réponse.`);
    const blockedMessage = getBlockedMessage();
    await sendResponse({
      conversation,
      answer: blockedMessage,
      customerHandle: fromHandle,
    });
    return { blocked: true, reason: quotaCheck.reason, reply: blockedMessage };
  }

  // Consommer une conversation si nécessaire (session 24h)
  try {
    const consumeResult = await consumeConversation(tenantId, conversation.id, fromHandle || "unknown");
    if (consumeResult.consumed) {
      console.log(`[WORKER] ✅ Conversation consommée pour tenant ${tenantId}. Quota: ${consumeResult.quotaUsage?.conversationsUsed}/${consumeResult.quotaUsage?.conversationsLimit}`);
    }
  } catch (error) {
    console.error("[WORKER] Erreur consommation conversation:", error);
    // On continue quand même, pour ne pas bloquer le service
  }

  let answer = "";
  let usage = null;
  let context = [];
  let shouldHandoff = false;
  
  try {
    if (body) {
      // Récupérer la date du dernier message OUTBOUND pour déterminer si c'est un retour après longue pause
      const { prisma } = require("./services/prisma");
      const lastOutboundMessage = await prisma.message.findFirst({
        where: { 
          tenantId, 
          conversationId: conversation.id,
          direction: "OUTBOUND"
        },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      
      const lastOutboundAt = lastOutboundMessage?.createdAt || conversation.lastOutboundAt;
      
      // Déterminer si c'est un retour après longue pause (plus d'1h)
      const now = new Date();
      const lastOutbound = lastOutboundAt ? new Date(lastOutboundAt) : null;
      const hoursElapsed = lastOutbound ? (now - lastOutbound) / (1000 * 60 * 60) : 0;
      const isLongPause = hoursElapsed >= 1;
      
      // Récupérer l'historique : plus de messages si c'est un retour après longue pause
      const messageLimit = isLongPause ? 30 : 10; // 30 messages si pause > 1h, sinon 10
      console.log(`[WORKER] Récupération de ${messageLimit} messages (pause: ${hoursElapsed.toFixed(1)}h)`);
      
      const recentMessages = await prisma.message.findMany({
        where: { tenantId, conversationId: conversation.id },
        orderBy: { createdAt: "desc" },
        take: messageLimit,
        select: { direction: true, body: true, createdAt: true },
      });
      
      // Construire l'historique au format attendu (du plus ancien au plus récent)
      let conversationHistory = recentMessages
        .reverse()
        .map(msg => ({
          role: msg.direction === "INBOUND" ? "user" : "assistant",
          content: msg.body,
        }));

      // Détecter le changement de sujet
      const topicChange = await detectTopicChange(body, conversationHistory);
      
      // Si changement de sujet détecté, filtrer l'historique pour éviter le mélange
      if (topicChange.changed) {
        console.log(`[WORKER] Changement de sujet détecté: ${topicChange.previousTopic} -> ${topicChange.newTopic}`);
        // Réinitialiser l'historique pour ne garder que les messages pertinents au nouveau sujet
        conversationHistory = filterConversationHistory(conversationHistory, topicChange.newTopic);
        console.log(`[WORKER] Historique filtré: ${conversationHistory.length} messages conservés`);
      }

      // Récupérer le contexte RAG
      context = await findRelevantContext({
        tenantId,
        question: body,
        topK: 5,
      });

      // Filtrer le contexte par sujet pour éviter le mélange
      if (topicChange.newTopic) {
        context = await filterContextByTopic(context, topicChange.newTopic, tenantId);
        console.log(`[WORKER] Contexte filtré: ${context.length} contextes conservés pour le sujet ${topicChange.newTopic}`);
      }
      
      // lastOutboundAt déjà récupéré ci-dessus
      
      // Récupérer les informations du tenant pour personnaliser certains messages (ex: message de bienvenue)
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          name: true,
          companyName: true,
          industry: true,
        },
      });
      
      // Vérifier si c'est une image sans correspondance RAG
      const isImageWithoutRAG = mediaPayload?.type === "image" && mediaPayload?.hasRAGMatch === false;
      const imageAnalysis = mediaPayload?.type === "image" ? mediaPayload?.analysis : null;
      
      const response = await generateAnswer({ 
        question: body, 
        context,
        conversationHistory,
        currentTopic: topicChange.newTopic,
        lastOutboundAt,
        tenant,
        isImageWithoutRAG,
        imageAnalysis,
      });
      
      answer = response.text;
      usage = response.usage;
      shouldHandoff = response.shouldHandoff || false;
    }
  } catch (error) {
    console.error("[WORKER] ❌ Erreur génération réponse:", error.message);
    console.error("[WORKER] Stack:", error.stack);
    
    // Si c'est une erreur d'embedding (connexion, timeout, etc.), envoyer un message d'erreur explicite
    if (error.message.includes("embedding") || error.message.includes("Connexion échouée") || error.message.includes("Timeout") || error.message.includes("fetch failed")) {
      console.error("[WORKER] 🚨 Erreur d'embedding détectée - Envoi d'un message d'erreur au lieu du handoff");
      answer = "Désolé, je rencontre actuellement un problème technique avec mon système d'intelligence. Veuillez réessayer dans quelques instants ou contacter directement notre équipe.";
      shouldHandoff = false; // Ne pas marquer comme handoff pour ce type d'erreur
    } else {
      // Pour les autres erreurs, utiliser le handoff standard
      answer = HANDOFF_MESSAGE;
      shouldHandoff = true;
    }
    usage = null;
  }

  // Handoff si détecté ou si réponse est le message de handoff
  if (shouldHandoff || isHandoffResponse(answer)) {
    await markConversationManual(conversation.id);
    
    // Notification pour handoff
    notifyHandoff({
      tenantId,
      conversationId: conversation.id,
      customerHandle: fromHandle,
      reason: "L'IA a demandé un passage à un humain",
    }).catch(err => console.error("[WORKER] Erreur notification handoff:", err));
    
    await sendResponse({
      conversation,
      answer: HANDOFF_MESSAGE,
      customerHandle: fromHandle,
    });
    return { handoff: true, reply: HANDOFF_MESSAGE };
  }

  const responseResult = await sendResponse({
    conversation,
    answer,
    customerHandle: fromHandle,
    usage,
  });
  
  // Apprentissage automatique: vérifier si la conversation est devenue "apprenable"
  // (après plusieurs échanges significatifs, même si pas encore fermée)
  try {
    const learnable = await isConversationLearnable(conversation.id);
    if (learnable) {
      // Apprendre en arrière-plan (ne pas bloquer la réponse)
      learnWhenConversationClosed(conversation.id).catch(err => {
        console.error(`[WORKER] Erreur apprentissage conversation ${conversation.id}:`, err.message);
      });
    }
  } catch (error) {
    // Ne pas faire échouer le worker si l'apprentissage échoue
    console.error(`[WORKER] Erreur vérification apprentissage:`, error.message);
  }

  // Enregistrer l'utilisation des APIs pour la facturation
  try {
    const { recordAPIUsage } = require("./services/billingService");
    const messageCount = responseResult?.sent ? 1 : 0; // 1 message envoyé si succès
    const tokenCount = usage?.total_tokens || 0;
    const costUsd = responseResult?.costUsd || 0;

    // Enregistrer l'utilisation par provider
    if (channel === "WHATSAPP") {
      // Meta WhatsApp est gratuit dans la fenêtre 24h
      await recordAPIUsage(tenantId, channel, "meta", messageCount, 0, 0);
    } else {
      // Meta pour Messenger/Commentaires (gratuit)
      await recordAPIUsage(tenantId, channel, "meta", messageCount, 0, 0);
    }

    // Enregistrer aussi l'utilisation OpenAI si des tokens ont été utilisés
    if (tokenCount > 0) {
      const openAICost = (tokenCount / 1000) * 0.00015; // $0.00015 par 1k tokens
      await recordAPIUsage(tenantId, channel, "openai", 0, tokenCount, openAICost);
    }
  } catch (error) {
    console.error("[WORKER] Erreur enregistrement utilisation API:", error);
  }

  if (conversation.channel === "WHATSAPP") {
    const reminderJobId = `reminder-${conversation.id}`;
    try {
      await reminderQueue.remove(reminderJobId);
    } catch (error) {
      // ignore if not exists
    }
    const delayMs =
      Number(process.env.REMINDER_DELAY_MS) || 24 * 60 * 60 * 1000;
    const nextReminderAt = new Date(Date.now() + delayMs);
    await require("./services/prisma").prisma.conversation.update({
      where: { id: conversation.id },
      data: { nextReminderAt },
    });
    await reminderQueue.add(
      "whatsapp-utility-reminder",
      { conversationId: conversation.id },
      { jobId: reminderJobId, delay: delayMs, removeOnComplete: true }
    );
  }

  return { processed: true, reply: answer };
};

const worker = new Worker("incoming-messages", processor, {
  connection,
  concurrency: 5,
});

worker.on("failed", (job, err) => {
  // eslint-disable-next-line no-console
  console.error("Job failed", job?.id, err);
});

worker.on("completed", (job, result) => {
  // eslint-disable-next-line no-console
  console.log("Job completed", job?.id, result);
});
