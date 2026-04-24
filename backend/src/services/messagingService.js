const { prisma } = require("./prisma");
const {
  createOutboundMessage,
  updateOutboundTimestamp,
} = require("./messageProcessor");
const { decryptToken } = require("./cryptoService");
const https = require("https");

const estimateWhatsAppCost = () => 0; // Meta WhatsApp est gratuit dans la fenêtre 24h
const estimateTokenCostUsd = (usage) => {
  if (!usage?.total_tokens) return 0;
  const costPer1k = 0.00015; // placeholder pour GPT-4o-mini
  return (usage.total_tokens / 1000) * costPer1k;
};

/**
 * Récupère la configuration Meta WhatsApp pour un tenant donné.
 * On lit en priorité la table ChannelConfig (credentials JSON),
 * puis on retombe sur les variables d'environnement pour compatibilité.
 */
const getMetaWhatsAppConfig = async (tenantId) => {
  let phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || null;
  let accessToken = process.env.META_ACCESS_TOKEN || null;
  let wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || null;

  if (!tenantId) {
    console.log("[META WHATSAPP] ⚠️ Pas de tenantId, utilisation des variables .env uniquement");
    return { phoneNumberId, accessToken, wabaId };
  }

  try {
    const config = await prisma.channelConfig.findFirst({
      where: { tenantId, channel: "WHATSAPP" },
    });

    if (config && config.credentials) {
      const creds = config.credentials;
      
      const configPhoneNumberId = creds.phoneNumberId || creds.whatsapp_phone_number_id || creds.whatsappNumber;
      const rawToken = creds.accessToken || creds.meta_access_token || creds.authToken;
      const configAccessToken = rawToken ? decryptToken(rawToken) : null;
      const configWabaId = creds.wabaId || creds.whatsapp_waba_id;

      // Utiliser la config du tenant si disponible, sinon fallback sur .env
      phoneNumberId = configPhoneNumberId || phoneNumberId;
      accessToken = configAccessToken || accessToken;
      wabaId = configWabaId || wabaId;

      console.log(`[META WHATSAPP] Configuration trouvée pour tenant ${tenantId}:`, {
        hasPhoneNumberId: !!phoneNumberId,
        hasAccessToken: !!accessToken,
        tokenLength: accessToken?.length || 0,
        tokenSource: configAccessToken ? "ChannelConfig" : ".env",
      });
    } else {
      console.log(`[META WHATSAPP] Aucune configuration ChannelConfig pour tenant ${tenantId}, utilisation des variables .env`);
    }
  } catch (error) {
    console.error("[META WHATSAPP] Erreur chargement configuration:", error);
    console.log("[META WHATSAPP] Fallback sur les variables .env");
  }

  return { phoneNumberId, accessToken, wabaId };
};

const sendMetaWhatsAppMessage = async ({ to, body, tenantId }) => {
  let { phoneNumberId, accessToken } = await getMetaWhatsAppConfig(tenantId);
  const fallbackToken = process.env.META_ACCESS_TOKEN;
  const fallbackPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!phoneNumberId || !accessToken) {
    console.error("[META WHATSAPP] Configuration manquante:", {
      hasPhoneNumberId: !!phoneNumberId,
      hasAccessToken: !!accessToken,
    });
    
    // Essayer avec les valeurs de fallback
    if (!accessToken && fallbackToken) {
      console.log("[META WHATSAPP] ⚠️ Utilisation du token de fallback (.env)");
      accessToken = fallbackToken;
    }
    if (!phoneNumberId && fallbackPhoneId) {
      console.log("[META WHATSAPP] ⚠️ Utilisation du Phone Number ID de fallback (.env)");
      phoneNumberId = fallbackPhoneId;
    }
    
    if (!phoneNumberId || !accessToken) {
      return { messageId: null, sent: false, phoneNumberId };
    }
  }

  // Debug: vérifier le format du token (afficher seulement les 10 premiers caractères pour sécurité)
  console.log("[META WHATSAPP] Token détecté:", {
    length: accessToken?.length || 0,
    startsWith: accessToken?.substring(0, 10) || "N/A",
    hasSpaces: accessToken?.includes(" ") || false,
    hasNewlines: accessToken?.includes("\n") || false,
    phoneNumberId,
  });

  // Validation : s'assurer que "to" n'est pas vide
  if (!to || !to.trim()) {
    console.error("[META WHATSAPP] Numéro destinataire vide ou invalide:", { to });
    return { messageId: null, sent: false, phoneNumberId };
  }

  // Normaliser le numéro (enlever "whatsapp:" si présent, garder juste le numéro)
  let normalizedTo = to.trim().replace(/^whatsapp:/i, "").replace(/\s+/g, "");

  try {
    const apiUrl = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    const requestPayload = {
      messaging_product: "whatsapp",
      to: normalizedTo,
      type: "text",
      text: {
        body: body,
      },
    };

    console.log("[META WHATSAPP] 📤 Envoi du message:", {
      url: apiUrl,
      to: normalizedTo,
      phoneNumberId,
      messageLength: body.length,
      tokenLength: accessToken?.length || 0,
      tokenPrefix: accessToken?.substring(0, 15) + "...",
    });

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(requestPayload),
    });

    const data = await response.json();

    console.log("[META WHATSAPP] 📥 Réponse reçue:", {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      hasError: !!data.error,
      errorCode: data.error?.code,
      errorType: data.error?.type,
      errorMessage: data.error?.message?.substring(0, 200),
    });

    if (!response.ok) {
      const errorCode = data.error?.code;
      const errorMessage = data.error?.message || "Erreur inconnue";
      const errorType = data.error?.type || "";
      const errorSubcode = data.error?.error_subcode;
      const fbtraceId = data.error?.fbtrace_id;
      
      // LOG COMPLET DE L'ERREUR
      console.error("=".repeat(80));
      console.error("❌ [META WHATSAPP] ERREUR D'ENVOI - DÉTAILS COMPLETS:");
      console.error("=".repeat(80));
      console.error("   Code HTTP:", response.status);
      console.error("   Code erreur Meta:", errorCode);
      console.error("   Type:", errorType);
      console.error("   Sous-code:", errorSubcode || "N/A");
      console.error("   Message:", errorMessage);
      console.error("   fbtrace_id:", fbtraceId || "N/A");
      console.error("   URL appelée:", apiUrl);
      console.error("   Destinataire:", normalizedTo);
      console.error("   Phone Number ID:", phoneNumberId);
      console.error("   Payload envoyé:", JSON.stringify(requestPayload, null, 2));
      console.error("   Réponse complète:", JSON.stringify(data, null, 2));
      console.error("=".repeat(80));

      // Détecter spécifiquement l'expiration du token
      const isOAuth =
        errorCode === 190 ||
        errorType === "OAuthException" ||
        errorMessage.includes("expired") ||
        errorMessage.includes("Session has expired");

      if (isOAuth) {
        console.error("❌ [META WHATSAPP] TOKEN EXPIRÉ / OAuthException détectée !");
        console.error("   Le META_ACCESS_TOKEN a expiré ou est invalide. Reconnecter le compte Meta.");
        console.error("   Dashboard: https://developers.facebook.com/apps/");
        console.error("   Erreur complète:", errorMessage);

        // Marquer le tenant comme à reconnecter et notifier
        if (tenantId) {
          try {
            await prisma.tenant.update({
              where: { id: tenantId },
              data: { metaNeedsReconnect: true },
            });
            const { notifySystem } = require("./notificationService");
            await notifySystem({
              tenantId,
              title: "Compte WhatsApp à reconnecter",
              message:
                "Votre connexion WhatsApp Business a expiré ou a été révoquée. Merci de la reconnecter depuis votre tableau de bord.",
            });
          } catch (metaFlagError) {
            console.error("[META WHATSAPP] Erreur lors du flag metaNeedsReconnect:", metaFlagError);
          }
        }
      } else if (
        errorMessage.includes("could not be decrypted") ||
        errorMessage.includes("decrypt")
      ) {
        console.error("❌ [META WHATSAPP] TOKEN INVALIDE !");
        console.error("   Le META_ACCESS_TOKEN ne peut pas être décrypté. Vérifie que :");
        console.error("   1. Le token est correctement copié dans le fichier .env ou dans ChannelConfig");
        console.error("   2. Il n'y a pas d'espaces ou de retours à la ligne dans le token");
        console.error("   3. Le token est bien un System User Token Meta");
        console.error("   Erreur complète:", errorMessage);
      } else if (
        errorMessage.includes("API access blocked") ||
        errorType === "OAuthException" ||
        errorCode === 200
      ) {
        console.error("❌ [META WHATSAPP] ACCÈS API BLOQUÉ avec le token actuel !");
        
        // ESSAYER AVEC LE TOKEN DE FALLBACK (.env) si différent
        if (fallbackToken && fallbackToken !== accessToken && fallbackPhoneId && fallbackPhoneId !== phoneNumberId) {
          console.log("[META WHATSAPP] 🔄 Tentative avec le token de fallback (.env)...");
          
          try {
            const fallbackResponse = await fetch(
              `https://graph.facebook.com/v18.0/${fallbackPhoneId}/messages`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${fallbackToken}`,
                },
                body: JSON.stringify({
                  messaging_product: "whatsapp",
                  to: normalizedTo,
                  type: "text",
                  text: {
                    body: body,
                  },
                }),
              }
            );

            const fallbackData = await fallbackResponse.json();

            if (fallbackResponse.ok) {
              console.log("[META WHATSAPP] ✅ Succès avec le token de fallback !");
              return {
                messageId: fallbackData.messages?.[0]?.id || null,
                sent: true,
                phoneNumberId: fallbackPhoneId,
              };
            } else {
              console.error("[META WHATSAPP] ❌ Le token de fallback a aussi échoué:", fallbackData.error?.message);
            }
          } catch (fallbackError) {
            console.error("[META WHATSAPP] Erreur avec le token de fallback:", fallbackError.message);
          }
        }
        
        console.error("   Le token d'accès Meta WhatsApp est bloqué ou invalide.");
        console.error("");
        console.error("   🔧 SOLUTIONS POSSIBLES :");
        console.error("");
        console.error("   1. VÉRIFIER LE TOKEN D'ACCÈS :");
        console.error("      - Va sur https://developers.facebook.com/apps/");
        console.error("      - Sélectionne ton application Meta");
        console.error("      - Va dans 'WhatsApp' > 'Configuration API'");
        console.error("      - Vérifie que le token d'accès est valide et non expiré");
        console.error("");
        console.error("   2. GÉNÉRER UN NOUVEAU TOKEN :");
        console.error("      - Dans le dashboard Meta, va dans 'Outils' > 'Token d'accès'");
        console.error("      - Génère un nouveau 'System User Token' avec les permissions WhatsApp");
        console.error("      - Copie le token dans ton fichier .env : META_ACCESS_TOKEN=ton_nouveau_token");
        console.error("");
        console.error("   3. VÉRIFIER LES PERMISSIONS :");
        console.error("      - Le token doit avoir les permissions : whatsapp_business_messaging, whatsapp_business_management");
        console.error("      - Vérifie que le numéro WhatsApp est bien vérifié et approuvé");
        console.error("");
        console.error("   4. VÉRIFIER LE NUMÉRO DE TÉLÉPHONE :");
        console.error("      - Assure-toi que WHATSAPP_PHONE_NUMBER_ID dans .env correspond au bon numéro");
        console.error("      - Le numéro doit être vérifié dans Meta Business Manager");
        console.error("");
        console.error("   📋 DÉTAILS DE L'ERREUR :");
        console.error("      Code:", errorCode);
        console.error("      Type:", errorType);
        console.error("      Message:", errorMessage);
        console.error("      fbtrace_id:", data.error?.fbtrace_id || "N/A");
        console.error("      Token utilisé:", accessToken?.substring(0, 10) + "...");
      } else {
        // Erreur non catégorisée - afficher tous les détails
        console.error("[META WHATSAPP] Erreur non catégorisée lors de l'envoi du message");
        console.error("   Réponse complète:", JSON.stringify(data, null, 2));
      }
      return { messageId: null, sent: false, phoneNumberId };
    }

    console.log("[META WHATSAPP] ✅ Message envoyé avec succès:", {
      messageId: data.messages?.[0]?.id || null,
      phoneNumberId,
    });

    return {
      messageId: data.messages?.[0]?.id || null,
      sent: true,
      phoneNumberId,
    };
  } catch (error) {
    console.error("=".repeat(80));
    console.error("❌ [META WHATSAPP] EXCEPTION LORS DE L'ENVOI:");
    console.error("=".repeat(80));
    console.error("   Message:", error.message);
    console.error("   Stack:", error.stack);
    console.error("   Destinataire:", normalizedTo);
    console.error("   Phone Number ID:", phoneNumberId);
    console.error("=".repeat(80));
    return { messageId: null, sent: false, phoneNumberId };
  }
};

const sendWhatsAppUtility = async ({ tenantId, conversationId, to, body }) => {
  const payload = { type: "utility", body };
  const costUsd = estimateWhatsAppCost();

  let messageId = null;
  let sent = false;
  let fromPhoneNumberId = null;
  try {
    const result = await sendMetaWhatsAppMessage({ to, body, tenantId });
    messageId = result.messageId;
    sent = result.sent;
    fromPhoneNumberId = result.phoneNumberId || null;
  } catch (error) {
    sent = false;
  }

  try {
    await createOutboundMessage({
      tenantId,
      conversationId,
      externalMessageId: messageId,
      fromHandle: fromPhoneNumberId,
      toHandle: to,
      body,
      rawPayload: payload,
      costUsd,
      tokenUsage: 0,
    });
    await updateOutboundTimestamp(conversationId);
    console.log(`[WHATSAPP UTILITY] Message OUTBOUND enregistré pour conversation ${conversationId}`);
  } catch (error) {
    console.error(`[WHATSAPP UTILITY] Erreur enregistrement message OUTBOUND:`, error);
    // On continue même si l'enregistrement échoue
  }

  if (!sent) {
    // eslint-disable-next-line no-console
    console.log("Meta WhatsApp non configure ou envoi echoue.");
  }

  return { sent };
};

const isWithinServiceWindow = (conversation) => {
  if (!conversation?.lastInboundAt) return false;
  const lastInbound = new Date(conversation.lastInboundAt).getTime();
  return Date.now() - lastInbound <= 24 * 60 * 60 * 1000;
};

const sendWhatsAppReply = async ({
  tenantId,
  conversation,
  conversationId,
  to,
  body,
  usage,
}) => {
  if (!isWithinServiceWindow(conversation)) {
    const fallback =
      "Bonjour ! Nous revenons vers vous. Souhaitez-vous toujours nos informations ?";
    return sendWhatsAppUtility({ tenantId, conversationId, to, body: fallback });
  }

  const payload = { type: "reply", body };
  const costUsd = estimateWhatsAppCost() + estimateTokenCostUsd(usage);
  const tokenUsage = usage?.total_tokens || (typeof body === "string" ? body.length : 0);

  let messageId = null;
  let sent = false;
  let fromPhoneNumberId = null;
  try {
    const result = await sendMetaWhatsAppMessage({ to, body, tenantId });
    messageId = result.messageId;
    sent = result.sent;
    fromPhoneNumberId = result.phoneNumberId || null;
  } catch (error) {
    sent = false;
  }

  try {
    await createOutboundMessage({
      tenantId,
      conversationId,
      externalMessageId: messageId,
      fromHandle: fromPhoneNumberId,
      toHandle: to,
      body,
      rawPayload: payload,
      costUsd,
      tokenUsage,
    });
    await updateOutboundTimestamp(conversationId);
    console.log(`[WHATSAPP REPLY] Message OUTBOUND enregistré pour conversation ${conversationId}`);
  } catch (error) {
    console.error(`[WHATSAPP REPLY] Erreur enregistrement message OUTBOUND:`, error);
    // On continue même si l'enregistrement échoue
  }

  if (!sent) {
    // eslint-disable-next-line no-console
    console.log("Meta WhatsApp non configure ou envoi echoue.");
  }

  return { sent, costUsd, tokenUsage };
};

const sendMessengerReply = async ({ tenantId, conversationId, to, body, usage }) => {
  const payload = { channel: "MESSENGER", type: "reply", body };
  const costUsd = estimateTokenCostUsd(usage);
  const tokenUsage = usage?.total_tokens || (typeof body === "string" ? body.length : 0);
  await createOutboundMessage({
    tenantId,
    conversationId,
    externalMessageId: null,
    fromHandle: null,
    toHandle: to,
    body,
    rawPayload: payload,
    costUsd,
    tokenUsage,
  });
  await updateOutboundTimestamp(conversationId);
  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
    // eslint-disable-next-line no-console
    console.log("Meta non configure, reply Messenger loggee uniquement.");
    return { sent: false, costUsd, tokenUsage };
  }
  return { sent: true, costUsd, tokenUsage };
};

const sendFacebookCommentReply = async ({
  tenantId,
  conversationId,
  commentId,
  body,
  type = "public_reply",
}) => {
  const payload = { channel: "FACEBOOK_COMMENT", type, body };
  await createOutboundMessage({
    tenantId,
    conversationId,
    externalMessageId: null,
    fromHandle: null,
    toHandle: commentId,
    body,
    rawPayload: payload,
    costUsd: 0,
    tokenUsage: 0,
  });
  await updateOutboundTimestamp(conversationId);
  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
    // eslint-disable-next-line no-console
    console.log("Meta non configure, reply Commentaire loggee uniquement.");
    return { sent: false, costUsd: 0, tokenUsage: 0 };
  }
  return { sent: true, costUsd: 0, tokenUsage: 0 };
};

const shouldOpenMessengerTunnel = (text) => {
  if (!text) return true;
  const lower = text.toLowerCase();
  const publicKeywords = [
    "prix",
    "tarif",
    "livraison",
    "disponible",
    "stock",
    "horaire",
  ];
  const privateKeywords = [
    "contact",
    "telephone",
    "tel",
    "adresse",
    "paiement",
    "commande",
    "mp",
    "prive",
    "whatsapp",
  ];
  if (privateKeywords.some((kw) => lower.includes(kw))) return true;
  return !publicKeywords.some((kw) => lower.includes(kw));
};

const sendResponse = async ({ conversation, answer, customerHandle, usage }) => {
  if (!conversation) return { sent: false };
  const channel = conversation.channel;

  if (channel === "WHATSAPP") {
    // S'assurer qu'on a un numéro de destinataire valide
    const to = customerHandle || conversation.customerHandle;
    if (!to || !to.trim()) {
      console.error("[WHATSAPP] Impossible d'envoyer: numéro destinataire manquant", {
        customerHandle,
        conversationCustomerHandle: conversation.customerHandle,
        conversationId: conversation.id,
      });
      return { sent: false };
    }

    return sendWhatsAppReply({
      tenantId: conversation.tenantId,
      conversation,
      conversationId: conversation.id,
      to: to.trim(),
      body: answer,
      usage,
    });
  }

  if (channel === "MESSENGER") {
    return sendMessengerReply({
      tenantId: conversation.tenantId,
      conversationId: conversation.id,
      to: customerHandle || conversation.customerHandle || "",
      body: answer,
      usage,
    });
  }

  if (channel === "FACEBOOK_COMMENT") {
    const goToMessenger = shouldOpenMessengerTunnel(answer);
    if (goToMessenger) {
      await sendFacebookCommentReply({
        tenantId: conversation.tenantId,
        conversationId: conversation.id,
        commentId: conversation.externalThreadId || "",
        body: "Je viens de vous envoyer les details en message prive !",
        type: "tunnel_public",
      });
      return sendMessengerReply({
        tenantId: conversation.tenantId,
        conversationId: conversation.id,
        to: customerHandle || conversation.customerHandle || "",
        body: answer,
        usage,
      });
    }

    return sendFacebookCommentReply({
      tenantId: conversation.tenantId,
      conversationId: conversation.id,
      commentId: conversation.externalThreadId || "",
      body: answer,
    });
  }

  return { sent: false };
};

const shouldSendUtility = (conversation) => {
  if (!conversation?.lastInboundAt) return false;
  if (conversation.status !== "OPEN") return false;

  const lastInbound = new Date(conversation.lastInboundAt).getTime();
  const lastOutbound = conversation.lastOutboundAt
    ? new Date(conversation.lastOutboundAt).getTime()
    : 0;
  const silenceMs = Date.now() - lastInbound;
  const hasNewerOutbound = lastOutbound > lastInbound;

  if (hasNewerOutbound) return false;
  return silenceMs >= 24 * 60 * 60 * 1000;
};

const sendUtilityIfNeeded = async ({ conversationId }) => {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) return { sent: false, reason: "missing" };
  if (!shouldSendUtility(conversation)) return { sent: false, reason: "not_due" };

  if (conversation.channel !== "WHATSAPP") {
    return { sent: false, reason: "channel_not_supported" };
  }

  const body =
    process.env.WHATSAPP_UTILITY_TEMPLATE ||
    "Bonjour ! Je reviens vers vous pour savoir si vous avez besoin d'aide. Nous restons a votre disposition.";

  return sendWhatsAppUtility({
    tenantId: conversation.tenantId,
    conversationId,
    to: conversation.customerHandle || "",
    body,
  });
};

/**
 * Télécharge un média WhatsApp (audio, image, etc.) via Meta Graph API.
 * Retourne { buffer, mimeType }.
 */
const downloadMetaMedia = async ({ tenantId, mediaId }) => {
  if (!mediaId) throw new Error("mediaId requis pour téléchargement");

  let { accessToken } = await getMetaWhatsAppConfig(tenantId);
  if (!accessToken && process.env.META_ACCESS_TOKEN) {
    accessToken = process.env.META_ACCESS_TOKEN;
  }
  if (!accessToken) {
    throw new Error("META_ACCESS_TOKEN manquant pour télécharger le média");
  }

  // Étape 1: récupérer l'URL de téléchargement + mime_type
  const metaUrl = `https://graph.facebook.com/v18.0/${mediaId}`;
  const metaResp = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!metaResp.ok) {
    const err = await metaResp.text();
    throw new Error(`Erreur meta media metadata: ${metaResp.status} ${err}`);
  }
  const metaData = await metaResp.json();
  const downloadUrl = metaData?.url;
  const metaMime = metaData?.mime_type;
  if (!downloadUrl) {
    throw new Error("URL de téléchargement manquante dans la réponse Meta");
  }

  // Étape 2: télécharger le binaire (Buffer)
  const { buffer, contentType } = await new Promise((resolve, reject) => {
    https
      .get(
        downloadUrl,
        { headers: { Authorization: `Bearer ${accessToken}` } },
        (res) => {
          const data = [];
          res.on("data", (chunk) => data.push(chunk));
          res.on("end", () =>
            resolve({
              buffer: Buffer.concat(data),
              contentType: res.headers["content-type"],
            })
          );
        }
      )
      .on("error", reject);
  });

  return { buffer, mimeType: metaMime || contentType || "audio/ogg" };
};

module.exports = {
  sendMetaWhatsAppMessage,
  sendWhatsAppUtility,
  sendWhatsAppReply,
  sendMessengerReply,
  sendFacebookCommentReply,
  sendResponse,
  sendUtilityIfNeeded,
  shouldSendUtility,
  estimateTokenCostUsd,
  downloadMetaMedia,
};
