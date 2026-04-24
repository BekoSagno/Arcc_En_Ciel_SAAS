const express = require("express");
const { messageQueue } = require("../queues/messageQueue");
const { verifyMetaSignature } = require("../middleware/metaSignature");
const {
  extractMetaWhatsAppMessageId,
  extractMetaMessageId,
} = require("../utils/extractors");
const { resolveTenantId } = require("../services/tenantResolver");
const { resolveTenantFromSenderPhone } = require("../services/senderPhoneResolver");
const { prisma } = require("../services/prisma");

const router = express.Router();

// Route GET pour la vérification Meta (comme dans le fichier de référence)
// NOTE: Cette route est sur /api/webhook, mais Meta appelle /webhook (défini dans app.js)
router.get("/webhook", async (req, res) => {
  console.log("⚠️ [WEBHOOK ROUTES] GET /api/webhook appelé (Meta devrait appeler /webhook directement)");
  const verifyToken = process.env.META_VERIFY_TOKEN || "arcc-meta-verify";
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token && verifyToken && token === verifyToken) {
    console.log("✅ Webhook validé par Meta !");
    return res.status(200).send(challenge);
  } else {
    console.log("❌ [WEBHOOK ROUTES] Vérification échouée");
    return res.sendStatus(403);
  }
});

// Route POST pour recevoir les messages (comme dans le fichier de référence)
router.post("/webhook", verifyMetaSignature, async (req, res, next) => {
  try {
    const body = req.body;
    console.log("📩 Nouveau message reçu :", JSON.stringify(body, null, 2));

    // Important : Toujours répondre 200 OK rapidement à Meta
    res.status(200).send("EVENT_RECEIVED");

    // Traitement en arrière-plan (comme notre système actuel)
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    // Récupérer le numéro de l'expéditeur (senderPhoneNumber)
    const messages = value?.messages?.[0];
    const contacts = value?.contacts?.[0];
    const senderPhoneNumber = contacts?.wa_id || messages?.from || null;

    if (!senderPhoneNumber) {
      console.error("[WEBHOOK WHATSAPP] Numéro expéditeur manquant dans le payload");
      return;
    }

    // Résolution du tenant UNIQUEMENT depuis le numéro de l'expéditeur (TestNumberMapping)
    // CRITIQUE: Chaque numéro doit être explicitement mappé à un tenant
    const tenantId = await resolveTenantFromSenderPhone(senderPhoneNumber);

    if (!tenantId) {
      console.error(
        "[WEBHOOK WHATSAPP] ❌ Message ignoré - Numéro non autorisé:",
        senderPhoneNumber
      );
      console.error(
        "[WEBHOOK WHATSAPP] 🔒 Pour des raisons de confidentialité, seuls les numéros explicitement mappés peuvent envoyer des messages."
      );
      console.error(
        `[WEBHOOK WHATSAPP] 💡 Pour autoriser ce numéro, utilise: node src/scripts/manage_test_mappings.js add ${senderPhoneNumber} <tenant_email|tenant_id>`
      );
      return;
    }

    console.log(
      `[WEBHOOK WHATSAPP] ✅ Tenant résolu: ${tenantId} (depuis numéro expéditeur: ${senderPhoneNumber})`
    );

    const messageId = extractMetaWhatsAppMessageId(body);
    await messageQueue.add(
      "whatsapp-inbound",
      {
        channel: "WHATSAPP",
        payload: body,
        tenantId,
      },
      {
        jobId: messageId || undefined,
        attempts: 3,
        removeOnComplete: true,
        removeOnFail: 1000,
      }
    );
  } catch (error) {
    console.error("[WEBHOOK WHATSAPP] Erreur:", error);
    // On ne renvoie pas d'erreur car on a déjà répondu 200 OK à Meta
  }
});

router.post(
  "/webhooks/whatsapp",
  verifyMetaSignature,
  async (req, res, next) => {
  try {
    // Meta WhatsApp envoie les webhooks avec une structure différente
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    
    // Récupérer le numéro de l'expéditeur (senderPhoneNumber)
    const messages = value?.messages?.[0];
    const contacts = value?.contacts?.[0];
    const senderPhoneNumber = contacts?.wa_id || messages?.from || null;

    if (!senderPhoneNumber) {
      console.error("[WEBHOOK WHATSAPP] Numéro expéditeur manquant dans le payload");
      return res.status(400).json({ error: "Numéro expéditeur manquant" });
    }

    // Résolution du tenant UNIQUEMENT depuis le numéro de l'expéditeur (TestNumberMapping)
    // CRITIQUE: Chaque numéro doit être explicitement mappé à un tenant
    const tenantId = await resolveTenantFromSenderPhone(senderPhoneNumber);

    if (!tenantId) {
      console.error(
        "[WEBHOOK WHATSAPP] ❌ Message ignoré - Numéro non autorisé:",
        senderPhoneNumber
      );
      console.error(
        "[WEBHOOK WHATSAPP] 🔒 Pour des raisons de confidentialité, seuls les numéros explicitement mappés peuvent envoyer des messages."
      );
      console.error(
        `[WEBHOOK WHATSAPP] 💡 Pour autoriser ce numéro, utilise: node src/scripts/manage_test_mappings.js add ${senderPhoneNumber} <tenant_email|tenant_id>`
      );
      return res.status(403).json({ 
        error: "Numéro non autorisé",
        message: "Ce numéro n'est pas mappé à un tenant. Utilisez manage_test_mappings.js pour l'ajouter."
      });
    }

    console.log(
      `[WEBHOOK WHATSAPP] ✅ Tenant résolu: ${tenantId} (depuis numéro expéditeur: ${senderPhoneNumber})`
    );

    const messageId = extractMetaWhatsAppMessageId(req.body);
    await messageQueue.add(
      "whatsapp-inbound",
      {
        channel: "WHATSAPP",
        payload: req.body,
        tenantId,
      },
      {
        jobId: messageId || undefined,
        attempts: 3,
        removeOnComplete: true,
        removeOnFail: 1000,
      }
    );

    return res.status(200).json({ received: true });
  } catch (error) {
    return next(error);
  }
});

router.get("/webhooks/facebook", async (req, res) => {
  const verifyToken = process.env.META_VERIFY_TOKEN;
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token && verifyToken && token === verifyToken) {
    return res.status(200).send(challenge);
  }
  return res.status(403).json({ error: "Verification echouee." });
});

// Route GET alternative pour /webhooks/whatsapp (compatibilité)
router.get("/webhooks/whatsapp", async (req, res) => {
  const verifyToken = process.env.META_VERIFY_TOKEN || "arcc-meta-verify";
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token && verifyToken && token === verifyToken) {
    console.log("✅ Webhook validé par Meta !");
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

router.post(
  "/webhooks/facebook",
  verifyMetaSignature,
  async (req, res, next) => {
  try {
    const pageId = req.body.entry?.[0]?.id || "";
    const isMessenger = Boolean(req.body.entry?.[0]?.messaging?.length);
    const channel = isMessenger ? "MESSENGER" : "FACEBOOK_COMMENT";
    let tenantId = await resolveTenantId({
      channel,
      externalId: pageId,
    });
    if (!tenantId && channel === "FACEBOOK_COMMENT") {
      tenantId = await resolveTenantId({
        channel: "MESSENGER",
        externalId: pageId,
      });
    }

    const messageId = extractMetaMessageId(req.body);
    await messageQueue.add(
      "facebook-inbound",
      {
        channel,
        payload: req.body,
        tenantId,
      },
      {
        jobId: messageId || undefined,
        attempts: 3,
        removeOnComplete: true,
        removeOnFail: 1000,
      }
    );

    return res.status(200).json({ received: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
