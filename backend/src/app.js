const express = require("express");
const cors = require("cors");
const path = require("path");
const webhookRoutes = require("./routes/webhooks");
const authRoutes = require("./routes/auth");
const ragRoutes = require("./routes/rag");
const debugRoutes = require("./routes/debug");
const metricsRoutes = require("./routes/metrics");
const conversationsRoutes = require("./routes/conversations");
const channelsRoutes = require("./routes/channels");
const adminRoutes = require("./routes/admin");
const adminMetricsRoutes = require("./routes/admin-metrics");
const cronRoutes = require("./routes/cron");
const billingRoutes = require("./routes/billing");
const subscriptionRoutes = require("./routes/subscription");
const onboardingRoutes = require("./routes/onboarding");
const otpRoutes = require("./routes/otp");
const testRagRoutes = require("./routes/test-rag");
const socialPostsRoutes = require("./routes/social-posts");
const socialAccountsRoutes = require("./routes/social-accounts");
const uploadsRoutes = require("./routes/uploads");
const tenantsRoutes = require("./routes/tenants");
const { router: notificationsRoutes } = require("./routes/notifications");
const { errorHandler } = require("./middleware/error");

const app = express();

// LOGGING TRÈS TÔT - AVANT TOUT AUTRE MIDDLEWARE
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\n🔵 [${timestamp}] ${req.method} ${req.path}`);
  console.log(`   IP: ${req.ip || req.connection.remoteAddress}`);
  console.log(`   User-Agent: ${req.headers["user-agent"] || "N/A"}`);
  console.log(`   Content-Type: ${req.headers["content-type"] || "N/A"}`);
  if (req.path === "/webhook" || req.path === "/") {
    console.log(`   ⚠️ WEBHOOK/ROOT DÉTECTÉ - Headers complets:`, JSON.stringify(req.headers, null, 2));
  }
  next();
});

const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : "*",
    credentials: true,
  })
);

// Meta envoie application/json pour WhatsApp.
// On garde le parsing urlencoded pour compatibilité avec d'autres webhooks.
app.use(
  express.urlencoded({
    extended: false,
  })
);

app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Fichiers statiques pour les uploads (images d'annonces, etc.)
// Accessible via: /uploads/...
app.use(
  "/uploads",
  express.static(path.join(__dirname, "..", "uploads"))
);

// Middleware de logging pour toutes les requêtes (DIAGNOSTIC)
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.path} - User-Agent: ${req.headers["user-agent"] || "N/A"}`);
  if (req.method === "POST" && req.path === "/webhook") {
    console.log(`[REQUEST] 📩 POST /webhook détecté - Headers:`, {
      "x-hub-signature-256": req.headers["x-hub-signature-256"] ? "présent" : "absent",
      "content-type": req.headers["content-type"],
      "user-agent": req.headers["user-agent"],
    });
  }
  next();
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Route racine pour diagnostiquer les appels GET /
app.get("/", (req, res) => {
  console.log("⚠️ [ROOT] GET / appelé - Requête non attendue");
  console.log("[ROOT] Headers:", JSON.stringify(req.headers, null, 2));
  console.log("[ROOT] Query:", JSON.stringify(req.query, null, 2));
  console.log("[ROOT] User-Agent:", req.headers["user-agent"]);
  
  // Si c'est Meta qui appelle, rediriger vers /webhook
  const userAgent = req.headers["user-agent"] || "";
  if (userAgent.includes("facebookexternalhit") || userAgent.includes("Meta")) {
    console.log("[ROOT] ⚠️ Meta a appelé / au lieu de /webhook - Redirection...");
    return res.redirect(301, "/webhook?" + new URLSearchParams(req.query).toString());
  }
  
  res.status(404).json({ 
    error: "Route non trouvée",
    message: "Utilisez /webhook pour les webhooks Meta WhatsApp",
    availableRoutes: ["/webhook", "/health", "/api/*"]
  });
});

// Routes webhook à la racine (comme dans le fichier de référence Meta)
// Ces routes correspondent exactement au fichier indexs.js fourni
app.get("/webhook", async (req, res) => {
  console.log("=".repeat(80));
  console.log("🟢 [WEBHOOK] GET /webhook appelé - Vérification Meta");
  console.log("=".repeat(80));
  
  const verifyToken = process.env.META_VERIFY_TOKEN || "arcc-meta-verify";
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("[WEBHOOK] 📋 PARAMÈTRES REÇUS:");
  console.log("   hub.mode:", mode || "❌ MANQUANT");
  console.log("   hub.verify_token:", token ? `✅ Présent (${token.substring(0, 10)}...)` : "❌ MANQUANT");
  console.log("   hub.challenge:", challenge || "❌ MANQUANT");
  console.log("");
  console.log("[WEBHOOK] 📋 CONFIGURATION ATTENDUE:");
  console.log("   META_VERIFY_TOKEN:", verifyToken ? `✅ ${verifyToken}` : "❌ MANQUANT");
  console.log("");

  // Vérifications détaillées
  const checks = {
    modeOk: mode === "subscribe",
    tokenPresent: !!token,
    verifyTokenPresent: !!verifyToken,
    tokensMatch: token === verifyToken,
  };

  console.log("[WEBHOOK] 🔍 VÉRIFICATIONS:");
  console.log("   Mode === 'subscribe':", checks.modeOk ? "✅" : "❌");
  console.log("   Token présent:", checks.tokenPresent ? "✅" : "❌");
  console.log("   VerifyToken présent:", checks.verifyTokenPresent ? "✅" : "❌");
  console.log("   Tokens correspondent:", checks.tokensMatch ? "✅" : "❌");
  console.log("");

  if (checks.modeOk && checks.tokenPresent && checks.verifyTokenPresent && checks.tokensMatch) {
    console.log("✅ [WEBHOOK] Webhook validé par Meta !");
    console.log("   Challenge renvoyé:", challenge);
    console.log("=".repeat(80));
    return res.status(200).send(challenge);
  } else {
    console.log("❌ [WEBHOOK] Vérification échouée - Raisons:");
    if (!checks.modeOk) console.log("   - Mode incorrect (attendu: 'subscribe', reçu:", mode, ")");
    if (!checks.tokenPresent) console.log("   - Token manquant dans la requête");
    if (!checks.verifyTokenPresent) console.log("   - META_VERIFY_TOKEN manquant dans .env");
    if (!checks.tokensMatch) {
      console.log("   - Tokens ne correspondent pas");
      console.log("     Reçu:", token);
      console.log("     Attendu:", verifyToken);
    }
    console.log("=".repeat(80));
    return res.sendStatus(403);
  }
});

app.post("/webhook", async (req, res) => {
  // Log immédiat pour confirmer que la route est appelée
  console.log("🔵 [WEBHOOK] POST /webhook appelé - Début traitement");
  
  // Important : Toujours répondre 200 OK rapidement à Meta
  res.status(200).send("EVENT_RECEIVED");
  console.log("✅ [WEBHOOK] Réponse 200 OK envoyée à Meta");

  // Traitement en arrière-plan avec logique IA native Meta
  try {
    const body = req.body;
    console.log("📩 [WEBHOOK] Nouveau message reçu :", JSON.stringify(body, null, 2));

    // ============================================
    // EXTRACTION DES DONNÉES META
    // ============================================
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    // Vérifier si c'est un événement d'appel AVANT de vérifier les messages
    const { detectCallEvent, handleMissedCall } = require("./services/callService");
    const callEvent = detectCallEvent(body);
    
    if (callEvent) {
      console.log(`[WEBHOOK] 📞 Événement d'appel détecté:`, callEvent);
      
      // Résoudre le tenant depuis le numéro de l'appelant
      const { resolveTenantFromSenderPhone } = require("./services/senderPhoneResolver");
      const callerPhone = callEvent.from;
      const tenantId = await resolveTenantFromSenderPhone(callerPhone);
      
      if (!tenantId) {
        console.error(`[WEBHOOK] ❌ Appel ignoré - Numéro non autorisé: ${callerPhone}`);
        return;
      }
      
      // Récupérer le phoneNumberId depuis le payload
      const phoneNumberId = value?.metadata?.phone_number_id || null;
      
      // Si l'appel est manqué ou terminé sans réponse
      if (callEvent.status === "missed" || callEvent.status === "ended") {
        console.log(`[WEBHOOK] 📞 Appel manqué/terminé - Traitement...`);
        await handleMissedCall({
          tenantId,
          fromPhoneNumber: callerPhone,
          phoneNumberId,
          callData: callEvent,
        });
      }
      
      // Répondre rapidement à Meta
      return;
    }

    // Vérifier que c'est un message (pas un status update)
    if (!value?.messages || value.messages.length === 0) {
      console.log("[WEBHOOK] Pas de message dans le payload (peut être un status update)");
      return;
    }

    // Extraire les données du message
    const message = value.messages[0];
    const contact = value.contacts?.[0];

    const messageType = message.type || "text";
    let bodyText = message.text?.body || message.body || "";
    let detectedLanguage = "fr";
    let mediaPayload = null;
    const fromPhoneNumber = contact?.wa_id || message.from || null;
    const externalMessageId = message.id || null;
    // Important : on ne dépend plus du .env pour identifier le numéro,
    // on utilise uniquement le phone_number_id fourni par Meta.
    const phoneNumberId = value.metadata?.phone_number_id || null;

    console.log("[WEBHOOK] Données extraites:", {
      fromPhoneNumber,
      messageText: bodyText.substring(0, 50),
      messageId: externalMessageId,
      phoneNumberId,
      messageType,
    });

    if (!fromPhoneNumber || !phoneNumberId) {
      console.error("[WEBHOOK] Données manquantes:", {
        hasFromPhoneNumber: !!fromPhoneNumber,
        hasPhoneNumberId: !!phoneNumberId,
      });
      return;
    }

    // ============================================
    // RÉSOLUTION DU TENANT (ROUTAGE MULTI-TENANT STRICT)
    // ============================================
    // Mode sécurité : Seuls les numéros explicitement mappés sont autorisés
    // Pas de tenant par défaut pour garantir la confidentialité
    const { resolveTenantFromSenderPhone } = require("./services/senderPhoneResolver");

    // Résoudre le tenant depuis le numéro de l'expéditeur (sans fallback)
    const tenantId = await resolveTenantFromSenderPhone(fromPhoneNumber);

    if (!tenantId) {
      console.error("[WEBHOOK] ❌ Message ignoré - Numéro non autorisé:", {
        senderPhone: fromPhoneNumber,
        phoneNumberId,
      });
      console.error("[WEBHOOK] 🔒 Pour des raisons de confidentialité, seuls les numéros explicitement mappés peuvent envoyer des messages.");
      console.error("[WEBHOOK] 💡 Pour autoriser ce numéro, utilise:");
      console.error(`[WEBHOOK]    node src/scripts/manage_test_mappings.js add ${fromPhoneNumber} <tenant_email|tenant_id>`);
      return;
    }

    console.log(`[WEBHOOK] ✅ Tenant résolu: ${tenantId} (depuis numéro expéditeur: ${fromPhoneNumber})`);

    // Gestion audio : transcription + langue (après résolution tenant pour récupérer config Meta)
    if (messageType === "audio" && message.audio?.id) {
      try {
        const { downloadMetaMedia } = require("./services/messagingService");
        const { transcribeAudio } = require("./services/audioService");
        const { buffer, mimeType } = await downloadMetaMedia({
          tenantId,
          mediaId: message.audio.id,
        });
        const transcript = await transcribeAudio(buffer, mimeType);
        bodyText = transcript.text || "";
        detectedLanguage = transcript.language || "unknown";
        mediaPayload = { mediaId: message.audio.id, mimeType: message.audio.mime_type };
        
        // Log détaillé pour diagnostic
        console.log(`[WEBHOOK] Audio reçu - transcription="${bodyText}" lang=${detectedLanguage} mime=${mimeType}`);
        if (!bodyText || bodyText.trim().length === 0) {
          console.warn("[WEBHOOK] ⚠️ Transcription vide - objet complet:", JSON.stringify(transcript, null, 2));
        }
      } catch (err) {
        console.error("[WEBHOOK] ❌ Erreur traitement audio:", {
          error: err.message,
          stack: err.stack,
          mediaId: message.audio.id,
          mimeType: message.audio.mime_type,
          transcriptResult: transcript || "non disponible"
        });
        bodyText = "";
        detectedLanguage = "unknown";
        mediaPayload = { mediaId: message.audio.id, error: err.message };
      }
    } else if (messageType === "image" && message.image?.id) {
      // Gestion image : analyse avec Gemini Vision
      try {
        const { downloadMetaMedia } = require("./services/messagingService");
        const { analyzeImage } = require("./services/imageService");
        const { buffer, mimeType } = await downloadMetaMedia({
          tenantId,
          mediaId: message.image.id,
        });
        
        // Si le client a envoyé du texte avec l'image, l'utiliser comme question
        const question = message.text?.body || message.caption || null;
        
        const analysis = await analyzeImage(buffer, mimeType, question);
        
        // Vérifier si les services mentionnés dans l'image sont dans la base de connaissance
        const { findRelevantContext } = require("./services/ragService");
        let ragContext = [];
        let hasRAGMatch = false;
        
        // Construire une requête de recherche RAG à partir de l'analyse de l'image
        const searchQuery = analysis.text || analysis.description || analysis.analysis || "";
        if (searchQuery && searchQuery.trim().length > 0) {
          console.log(`[WEBHOOK] 🔍 Vérification RAG pour l'image: "${searchQuery.substring(0, 100)}..."`);
          ragContext = await findRelevantContext({
            tenantId,
            question: searchQuery,
            topK: 5,
          });
          hasRAGMatch = ragContext && ragContext.length > 0;
          console.log(`[WEBHOOK] 📚 Résultat RAG: ${ragContext.length} correspondances trouvées`);
        }
        
        // Si des services sont identifiés dans l'image, vérifier aussi avec eux
        if (analysis.services && Array.isArray(analysis.services) && analysis.services.length > 0) {
          console.log(`[WEBHOOK] 🔍 Services identifiés dans l'image: ${analysis.services.join(", ")}`);
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
                console.log(`[WEBHOOK] ✅ Service "${service}" trouvé dans la base de connaissance`);
              } else {
                console.log(`[WEBHOOK] ⚠️ Service "${service}" NON trouvé dans la base de connaissance`);
              }
            }
          }
        }
        
        // Construire le texte à partir de l'analyse
        // Si le client a posé une question, utiliser l'analysis, sinon combiner description + text
        if (question && question.trim().length > 0) {
          if (hasRAGMatch) {
            // Les informations sont dans la base de connaissance → répondre normalement
            bodyText = `[Image] Question: ${question}\n\nAnalyse: ${analysis.analysis || analysis.description || ""}`;
          } else {
            // Les informations ne sont PAS dans la base → indiquer et proposer les services disponibles
            bodyText = `[Image] Question: ${question}\n\nAnalyse: ${analysis.analysis || analysis.description || ""}\n\n⚠️ Vérification RAG: Les services mentionnés dans l'image ne font pas partie de notre base de connaissance.`;
          }
        } else {
          if (hasRAGMatch) {
            // Les informations sont dans la base → répondre normalement
            const parts = [];
            if (analysis.description) parts.push(`Description: ${analysis.description}`);
            if (analysis.text) parts.push(`Texte extrait: ${analysis.text}`);
            if (analysis.analysis) parts.push(`Analyse: ${analysis.analysis}`);
            bodyText = parts.length > 0 ? parts.join("\n\n") : "[Image reçue - analyse en cours]";
          } else {
            // Les informations ne sont PAS dans la base → préparer pour réponse spéciale
            const parts = [];
            if (analysis.description) parts.push(`Description: ${analysis.description}`);
            if (analysis.text) parts.push(`Texte extrait: ${analysis.text}`);
            if (analysis.analysis) parts.push(`Analyse: ${analysis.analysis}`);
            bodyText = parts.length > 0 ? parts.join("\n\n") : "[Image reçue - analyse en cours]";
            bodyText += `\n\n⚠️ Vérification RAG: Les services mentionnés dans l'image ne font pas partie de notre base de connaissance.`;
          }
        }
        
        // Stocker le résultat de la vérification RAG dans mediaPayload
        mediaPayload = { 
          mediaId: message.image.id, 
          mimeType: message.image.mime_type || mimeType,
          type: "image",
          analysis: analysis,
          hasRAGMatch: hasRAGMatch,
          ragContextCount: ragContext.length
        };
        
        detectedLanguage = "fr"; // Par défaut pour les images
        mediaPayload = { 
          mediaId: message.image.id, 
          mimeType: message.image.mime_type || mimeType,
          type: "image",
          analysis: analysis
        };
        
        console.log(`[WEBHOOK] Image reçue - description="${analysis.description?.substring(0, 100)}..." texte="${analysis.text?.substring(0, 50)}..." mime=${mimeType}`);
        if (!analysis.description && !analysis.text && !analysis.analysis) {
          console.warn("[WEBHOOK] ⚠️ Analyse d'image vide - objet complet:", JSON.stringify(analysis, null, 2));
        }
      } catch (err) {
        console.error("[WEBHOOK] ❌ Erreur traitement image:", {
          error: err.message,
          stack: err.stack,
          mediaId: message.image.id,
          mimeType: message.image.mime_type,
        });
        bodyText = "[Image reçue mais erreur lors de l'analyse]";
        detectedLanguage = "fr";
        mediaPayload = { mediaId: message.image.id, error: err.message };
      }
    } else {
      bodyText = message.text?.body || message.body || "";
    }

    // ============================================
    // GESTION DE LA CONVERSATION
    // ============================================
const {
  ensureConversation,
  createInboundMessage,
  createOutboundMessage,
  updateInboundTimestamp,
  updateOutboundTimestamp,
  HANDOFF_MESSAGE,
  isHandoffResponse,
  markConversationManual,
} = require("./services/messageProcessor");

    const externalThreadId = fromPhoneNumber; // Utiliser le numéro comme thread ID
    const conversation = await ensureConversation({
      tenantId,
      channel: "WHATSAPP",
      externalThreadId,
      customerHandle: fromPhoneNumber,
    });

    // Enregistrer le message entrant (TOUJOURS, même en mode manuel)
    const inboundMessage = await createInboundMessage({
      tenantId,
      conversationId: conversation.id,
      externalMessageId,
      fromHandle: fromPhoneNumber,
      toHandle: phoneNumberId,
      body: bodyText,
      rawPayload: mediaPayload ? { ...body, audio: mediaPayload } : body,
    });
    await updateInboundTimestamp(conversation.id);
    console.log(`[WEBHOOK] ✅ Message entrant enregistré (ID: ${inboundMessage.id}) pour conversation ${conversation.id}, mode manuel: ${conversation.isAiEnabled === false}`);

    // ============================================
    // DÉSACTIVATION DE L'IA (TENANT + CONVERSATION)
    // ============================================
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
        // 3. Pause > 24h (retour après longue absence)
        // 4. Plusieurs messages récents (le client est actif et veut communiquer)
        const hasTranscribedAudio = mediaPayload && mediaPayload.type === "audio" && bodyText && bodyText.trim().length > 0;
        
        // Vérifier s'il y a eu plusieurs messages récents (dans les 5 dernières minutes)
        const recentMessages = await prisma.message.count({
          where: {
            tenantId,
            conversationId: conversation.id,
            direction: "INBOUND",
            createdAt: {
              gte: new Date(Date.now() - 5 * 60 * 1000) // 5 dernières minutes
            }
          }
        });
        const hasMultipleRecentMessages = recentMessages >= 2; // Au moins 2 messages récents
        
        const shouldReactivate = hasTranscribedAudio || hoursElapsed >= 1 || hasMultipleRecentMessages;
        
        console.log(`[WEBHOOK] 🔍 Détails réactivation:`, {
          hasTranscribedAudio,
          hoursElapsed: hoursElapsed.toFixed(1),
          bodyTextLength: bodyText?.length || 0,
          shouldReactivate
        });
        
        console.log(`[WEBHOOK] 🔍 Vérification réactivation IA:`, {
          conversationId: conversation.id,
          isAiEnabled: conversation.isAiEnabled,
          hoursElapsed: hoursElapsed.toFixed(1),
          hasTranscribedAudio,
          shouldReactivate
        });
        
        if (shouldReactivate) {
          console.log(
            `[WEBHOOK] 🔄 Réactivation automatique de l'IA pour conversation ${conversation.id} (pause: ${hoursElapsed.toFixed(1)}h${mediaPayload && bodyText ? ' ou audio transcrit' : ''})`
          );
          
          // Réactiver l'IA et remettre en mode OPEN
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: { 
              isAiEnabled: true,
              status: "OPEN"
            },
          });
          
          console.log(`[WEBHOOK] ✅ IA réactivée pour conversation ${conversation.id}`);
          // Continuer le traitement normal
        } else {
          console.log(
            `[WEBHOOK] IA désactivée pour la conversation ${conversation.id} - notification seulement`
          );
          try {
            const { notifyNewMessage } = require("./services/notificationService");
            await notifyNewMessage({
              tenantId,
              conversationId: conversation.id,
              messageId: externalMessageId,
              customerHandle: fromPhoneNumber,
              messagePreview: bodyText,
            });
          } catch (notifyError) {
            console.error("[WEBHOOK] Erreur notification nouveau message (IA désactivée):", notifyError);
          }
          // Continuer le flux pour permettre le debounce même si l'IA est désactivée
          // La vérification finale se fera dans processMessagesAndRespond
        }
      }
    } catch (aiFlagError) {
      console.error("[WEBHOOK] Erreur lors de la vérification du flag IA:", aiFlagError);
      // En cas d'erreur, on continue le flux normal pour ne pas bloquer le service.
    }

    // Vérification du quota IA (mensuel) avant d'appeler l'IA
    try {
      const { canRespond, getBlockedMessage, consumeConversation } = require("./services/quotaService");
      const quotaCheck = await canRespond(tenantId);

      if (!quotaCheck.allowed) {
        console.log(`[QUOTA] Forfait IA épuisé pour tenant ${tenantId}. Motif: ${quotaCheck.reason}`);
        const { sendMetaWhatsAppMessage } = require("./services/messagingService");
        const blockedMessage = getBlockedMessage();
        await sendMetaWhatsAppMessage({
          to: fromPhoneNumber,
          body: blockedMessage,
          tenantId,
        });
        return;
      }

      // Consommer une conversation (session 24h) pour suivre le quota
      try {
        const consumeResult = await consumeConversation(tenantId, conversation.id, fromPhoneNumber || "unknown");
        if (consumeResult.consumed) {
          console.log(
            `[QUOTA] Conversation consommée pour tenant ${tenantId}. Quota: ${consumeResult.quotaUsage?.conversationsUsed}/${consumeResult.quotaUsage?.conversationsLimit}`
          );
        }
      } catch (consumeErr) {
        console.error("[QUOTA] Erreur consommation conversation:", consumeErr);
      }
    } catch (quotaError) {
      console.error("[QUOTA] Erreur lors de la vérification du quota IA (webhook):", quotaError);
    }

    // ============================================
    // GESTION DU TYPING (DEBOUNCE) - Attendre que le client finisse d'écrire
    // ============================================
    const { queueMessageForProcessing } = require("./services/typingService");
    
    // Préparer les données du message pour la file d'attente
    const messageData = {
      body: bodyText,
      bodyText: bodyText,
      mediaPayload,
      detectedLanguage,
      fromPhoneNumber,
      externalMessageId,
      messageType,
    };
    
    // Ajouter le message à la file d'attente avec debounce
    // Le callback sera appelé après le délai d'inactivité
    await queueMessageForProcessing(
      conversation.id,
      tenantId,
      messageData,
      async (processedData) => {
        // Ce callback sera exécuté après le délai de debounce
        // Passer aussi les informations nécessaires pour les vérifications
        await processMessagesAndRespond(
          processedData, 
          conversation, 
          tenantId, 
          fromPhoneNumber,
          phoneNumberId
        );
      }
    );
    
    // Retourner immédiatement (le traitement se fera après le délai)
    return;
  } catch (error) {
    console.error("[WEBHOOK] ❌ Erreur globale:", error);
    next(error);
  }
});

/**
 * Fonction qui traite les messages en attente et génère une réponse
 * Appelée après le délai de debounce
 */
async function processMessagesAndRespond(processedData, conversation, tenantId, fromPhoneNumber, phoneNumberId) {
  const { body, mediaPayload, detectedLanguage, messageCount } = processedData;
  
  console.log(`[WEBHOOK] 🚀 Traitement de ${messageCount} message(s) combiné(s) pour conversation ${conversation.id}`);
  
  try {
    // ============================================
    // VÉRIFICATIONS PRÉLIMINAIRES (IA, QUOTA)
    // ============================================
    const { prisma } = require("./services/prisma");
    
    // Recharger la conversation pour avoir les dernières données
    const updatedConversation = await prisma.conversation.findUnique({
      where: { id: conversation.id },
      select: { id: true, isAiEnabled: true, status: true },
    });
    
    // Vérifier si l'IA est activée
    if (updatedConversation && updatedConversation.isAiEnabled === false) {
      console.log(`[WEBHOOK] IA désactivée pour la conversation ${conversation.id} - aucun appel Gemini`);
      const { notifyNewMessage } = require("./services/notificationService");
      await notifyNewMessage({
        tenantId,
        conversationId: conversation.id,
        messageId: null,
        customerHandle: fromPhoneNumber,
        messagePreview: body.substring(0, 50),
      });
      return;
    }
    
    // Vérification du quota IA
    const { canRespond, getBlockedMessage, consumeConversation } = require("./services/quotaService");
    const quotaCheck = await canRespond(tenantId);
    
    if (!quotaCheck.allowed) {
      console.log(`[QUOTA] Forfait IA épuisé pour tenant ${tenantId}. Motif: ${quotaCheck.reason}`);
      const { sendMetaWhatsAppMessage } = require("./services/messagingService");
      const blockedMessage = getBlockedMessage();
      await sendMetaWhatsAppMessage({
        to: fromPhoneNumber,
        body: blockedMessage,
        tenantId,
      });
      return;
    }
    
    // Consommer une conversation pour suivre le quota
    try {
      const consumeResult = await consumeConversation(tenantId, conversation.id, fromPhoneNumber || "unknown");
      if (consumeResult.consumed) {
        console.log(
          `[QUOTA] Conversation consommée pour tenant ${tenantId}. Quota: ${consumeResult.quotaUsage?.conversationsUsed}/${consumeResult.quotaUsage?.conversationsLimit}`
        );
      }
    } catch (consumeErr) {
      console.error("[QUOTA] Erreur consommation conversation:", consumeErr);
    }
    
    // ============================================
    // TRAITEMENT IA (RAG + GÉNÉRATION)
    // ============================================
    const { findRelevantContext } = require("./services/ragService");
    const { generateAnswer } = require("./services/aiService");
    const {
      sendMetaWhatsAppMessage,
      estimateTokenCostUsd,
    } = require("./services/messagingService");
    const { HANDOFF_MESSAGE, isHandoffResponse, markConversationManual, createOutboundMessage, updateOutboundTimestamp } = require("./services/messageProcessor");
    const { notifyHandoff } = require("./services/notificationService");

    // Si audio non transcrit
    if (mediaPayload && mediaPayload.type === "audio" && !body) {
      const polite =
        "Merci pour votre audio. Je n'ai pas pu le transcrire. Pouvez-vous le ré-enregistrer clairement en français ou l'écrire en texte ?";
      await sendMetaWhatsAppMessage({
        to: fromPhoneNumber,
        body: polite,
        tenantId,
      });
      return;
    }

    // Si audio non-français : demander une version FR avant toute IA
    if (mediaPayload && mediaPayload.type === "audio" && detectedLanguage && detectedLanguage !== "fr") {
      const polite =
        "Merci pour votre message audio. Pouvez-vous fournir une version en français ou une traduction ? Je serai ravi d'aider dès que possible.";
      await sendMetaWhatsAppMessage({
        to: fromPhoneNumber,
        body: polite,
        tenantId,
      });
      return;
    }

    // ============================================
    // GESTION SPÉCIALE DES MESSAGES PRINCIPALEMENT EN EMOJIS
    // ============================================
    if (body && typeof body === "string") {
      const rawText = body.trim();
      const withoutSpaces = rawText.replace(/\s+/g, "");
      const letterMatches = rawText.match(/[A-Za-zÀ-ÖØ-öø-ÿ0-9]/g) || [];
      const letterCount = letterMatches.length;
      const totalChars = withoutSpaces.length;

      // Considérer que le message est "principalement emoji" s'il a très peu de lettres/chiffres
      // et au moins 1 caractère non-espace
      const isMostlyEmojis = totalChars > 0 && letterCount <= 2;

      if (isMostlyEmojis) {
        console.log("[WEBHOOK] 😊 Message principalement composé d'emojis détecté:", rawText);

        const positiveEmojiRegex = /[😀😁😂🤣😃😄😅😆😉😊🙂😍😘😜🤩😎❤️💖💙💚💛💜👍👌👏🙏]/u;
        const negativeEmojiRegex = /[😢😭😞😔😕🙁☹️😡😠🤬😣😖😫😩😰😨😱💔👎]/u;

        let emojiAnswer;
        if (negativeEmojiRegex.test(rawText)) {
          emojiAnswer =
            "Je vois que quelque chose ne va pas 😔. Tu peux m’expliquer ce qui te dérange ou ce qui s’est passé ? Je suis là pour t’aider.";
        } else if (positiveEmojiRegex.test(rawText)) {
          emojiAnswer =
            "Je vois que ça te fait plaisir 😄 ! Dis‑moi en un peu plus sur ce que tu aimerais savoir ou sur ton besoin, que je puisse t’aider au mieux.";
        } else {
          emojiAnswer =
            "Je vois bien ta réaction 😊. Peux‑tu m’écrire en quelques mots ce que tu souhaites exactement, pour que je puisse te répondre clairement ?";
        }

        await sendMetaWhatsAppMessage({
          to: fromPhoneNumber,
          body: emojiAnswer,
          tenantId,
        });

        console.log("[WEBHOOK] ✅ Réponse spéciale emojis envoyée, pas d'appel RAG/Gemini nécessaire pour ce message.");
        return;
      }
    }

    let answer = "";
    let usage = null;
    let context = [];

    // Récupérer l'historique récent de la conversation pour aider l'IA à suivre le contexte
    // prisma est déjà déclaré au début de la fonction, pas besoin de le redéclarer
    const recentMessages = await prisma.message.findMany({
      where: { tenantId, conversationId: conversation.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { direction: true, body: true },
    });

    const conversationHistory = recentMessages
      .reverse()
      .map((msg) => ({
        role: msg.direction === "INBOUND" ? "user" : "assistant",
        content: msg.body,
      }));

    try {
      // Recherche du contexte RAG
      context = await findRelevantContext({
        tenantId,
        question: body,
        topK: 5,
      });

      console.log(`[WEBHOOK] 📚 Contexte RAG récupéré: ${context.length} extraits`);
      if (context.length === 0) {
        console.warn(`[WEBHOOK] ⚠️ Aucun contexte RAG trouvé pour: "${body}"`);
      }

      // Génération de la réponse IA (avec éventuel usage de la recherche web)
      // Récupérer les informations du tenant pour personnaliser certains messages
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
        tenant,
        isImageWithoutRAG,
        imageAnalysis,
      });
      answer = response.text;
      usage = response.usage;
      
      console.log(`[WEBHOOK] 🤖 Réponse IA générée (${answer.length} caractères): "${answer.substring(0, 150)}..."`);
      console.log(`[WEBHOOK] 🔄 Handoff détecté: ${response.shouldHandoff || false}`);
      
      // Si handoff et contexte vide, logger pour diagnostic
      if (response.shouldHandoff && context.length === 0) {
        console.warn(`[WEBHOOK] ⚠️ Handoff avec contexte vide - Question: "${body}"`);
      }
    } catch (error) {
      console.error("[WEBHOOK] ❌ Erreur traitement IA:", error.message);
      console.error("[WEBHOOK] Stack:", error.stack);
      
      // Si c'est une erreur d'embedding (connexion, timeout, etc.), envoyer un message d'erreur explicite
      if (error.message.includes("embedding") || error.message.includes("Connexion échouée") || error.message.includes("Timeout") || error.message.includes("fetch failed")) {
        console.error("[WEBHOOK] 🚨 Erreur d'embedding détectée - Envoi d'un message d'erreur au lieu du handoff");
        answer = "Désolé, je rencontre actuellement un problème technique avec mon système d'intelligence. Veuillez réessayer dans quelques instants ou contacter directement notre équipe.";
      } else {
        // Pour les autres erreurs, utiliser le handoff standard
        answer = HANDOFF_MESSAGE;
      }
      usage = null;
    }

    // ============================================
    // GESTION DU HANDOFF
    // ============================================
    if (isHandoffResponse(answer)) {
      console.log(`[WEBHOOK] 🔄 Handoff détecté pour conversation ${conversation.id}`);
      await markConversationManual(conversation.id);
      
      // Notification pour handoff
      try {
        const { notifyHandoff } = require("./services/notificationService");
        await notifyHandoff({
          tenantId,
          conversationId: conversation.id,
          customerHandle: fromPhoneNumber,
          reason: "L'IA a demandé un passage à un humain",
        });
      } catch (notifyError) {
        console.error("[WEBHOOK] Erreur notification handoff:", notifyError);
      }
      
      answer = HANDOFF_MESSAGE;
    }

    // ============================================
    // POST-TRAITEMENT DE LA RÉPONSE (salutations + concision)
    // ============================================
    try {
      // prisma est déjà déclaré au début de la fonction
      const outboundCount = await prisma.message.count({
        where: {
          conversationId: conversation.id,
          direction: "OUTBOUND",
        },
      });

      // Si ce n'est pas le premier message sortant, éviter de répéter les "Bonjour" au début
      if (outboundCount > 0 && typeof answer === "string") {
        let trimmed = answer.trimStart();
        // Supprimer une salutation de type "Bonjour..." en tout début de message
        trimmed = trimmed.replace(/^bonjour[^.\n]*[.\n]+\s*/i, "").trimStart();
        if (trimmed.length > 0) {
          answer = trimmed;
        }
      }

      // Couper les réponses trop longues (sécurité) à ~500 caractères
      if (typeof answer === "string" && answer.length > 600) {
        const shortened = answer.slice(0, 550);
        // Essayer de couper à la fin d'une phrase
        const lastDot = shortened.lastIndexOf(".");
        const lastQuestion = shortened.lastIndexOf("?");
        const cutIndex = Math.max(lastDot, lastQuestion);
        answer = (cutIndex > 0 ? shortened.slice(0, cutIndex + 1) : shortened).trim();
      }
    } catch (postProcessError) {
      console.error("[WEBHOOK] Erreur post-traitement réponse:", postProcessError);
    }

    // ============================================
    // ENVOI DE LA RÉPONSE VIA META API
    // ============================================
    const result = await sendMetaWhatsAppMessage({
      to: fromPhoneNumber,
      body: answer,
      tenantId,
    });

    // Enregistrer le message sortant
    const costUsd = estimateTokenCostUsd(usage);
    // Fallback : 1 caractère = 1 token si l'API ne renvoie rien
    const tokenUsage = usage?.total_tokens || (typeof answer === "string" ? answer.length : 0);

    await createOutboundMessage({
      tenantId,
      conversationId: conversation.id,
      externalMessageId: result.messageId,
      fromHandle: phoneNumberId,
      toHandle: fromPhoneNumber,
      body: answer,
      rawPayload: { type: "reply", body: answer },
      costUsd,
      tokenUsage,
    });
    await updateOutboundTimestamp(conversation.id);

    // Enregistrer l'utilisation pour la facturation
    try {
      const { recordAPIUsage } = require("./services/billingService");
      await recordAPIUsage(tenantId, "WHATSAPP", "meta", 1, 0, 0);
      if (tokenUsage > 0) {
        const openAICost = (tokenUsage / 1000) * 0.00015;
        await recordAPIUsage(tenantId, "WHATSAPP", "openai", 0, tokenUsage, openAICost);
      }
    } catch (error) {
      console.error("[WEBHOOK] Erreur enregistrement utilisation:", error);
    }

    console.log("[WEBHOOK] Message traité et réponse envoyée avec succès");
  } catch (error) {
    console.error("[WEBHOOK] ❌ Erreur dans processMessagesAndRespond:", error);
    console.error("[WEBHOOK] Stack:", error.stack);
    // Ne pas bloquer, juste logger l'erreur
  }
}

// Route handler se termine ici

app.use("/api", webhookRoutes);
app.use("/api", authRoutes);
app.use("/api", ragRoutes);
app.use("/api", metricsRoutes);
app.use("/api", conversationsRoutes);
app.use("/api", channelsRoutes);
app.use("/api", adminRoutes);
app.use("/api", adminMetricsRoutes);
app.use("/api", cronRoutes);
app.use("/api", billingRoutes);
app.use("/api", subscriptionRoutes);
app.use("/api", onboardingRoutes);
app.use("/api", otpRoutes);
app.use("/api", tenantsRoutes);
app.use("/api", notificationsRoutes);
app.use("/api", socialPostsRoutes);
app.use("/api", socialAccountsRoutes);
app.use("/api", uploadsRoutes);
// Routes de test RAG - disponibles en développement et pour le debugging
app.use("/api", testRagRoutes);
if (process.env.NODE_ENV === "development") {
  app.use("/api/debug", debugRoutes);
}

app.use(errorHandler);

module.exports = { app };
