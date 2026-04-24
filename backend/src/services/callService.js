const { sendMetaWhatsAppMessage } = require("./messagingService");
const { createNotification } = require("./notificationService");
const { prisma } = require("./prisma");

/**
 * Gère un appel entrant manqué
 * - Envoie un message au client expliquant qu'il peut utiliser vocal/texte
 * - Crée une notification pour les admins
 * 
 * @param {string} tenantId - ID du tenant
 * @param {string} fromPhoneNumber - Numéro du client qui a appelé
 * @param {string} phoneNumberId - ID du numéro WhatsApp Business
 * @param {object} callData - Données de l'appel (optionnel)
 * @returns {Promise<{messageSent: boolean, notificationCreated: boolean}>}
 */
async function handleMissedCall({ tenantId, fromPhoneNumber, phoneNumberId, callData = null }) {
  try {
    console.log(`[CALL] 📞 Appel manqué détecté - Client: ${fromPhoneNumber}, Tenant: ${tenantId}`);

    // Message à envoyer au client
    const messageToClient = `Bonjour 👋

Je vois que vous avez tenté de nous appeler. Actuellement, notre connexion n'est pas optimale pour les appels vocaux, mais je suis disponible pour vous aider via :

📝 **Message texte** : Écrivez-moi directement votre question
🎤 **Message vocal** : Envoyez-moi un message vocal et je le transcrirai pour vous répondre

Je reste à votre disposition pour répondre à toutes vos questions ! 😊`;

    // Envoyer le message au client
    let messageSent = false;
    try {
      await sendMetaWhatsAppMessage({
        to: fromPhoneNumber,
        body: messageToClient,
        tenantId,
      });
      messageSent = true;
      console.log(`[CALL] ✅ Message envoyé au client ${fromPhoneNumber}`);
    } catch (err) {
      console.error(`[CALL] ❌ Erreur envoi message au client:`, err.message);
    }

    // Récupérer les informations du tenant pour la notification
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        name: true,
        companyName: true,
      },
    });

    // Créer une notification pour les admins
    let notificationCreated = false;
    try {
      const tenantName = tenant?.companyName || tenant?.name || "le service";
      const notificationMessage = `Un client (${fromPhoneNumber}) a tenté d'appeler ${tenantName} mais l'appel n'a pas pu être pris. L'IA a envoyé un message automatique pour rediriger vers les messages texte/vocal.`;
      
      const { createNotification } = require("./notificationService");
      await createNotification({
        tenantId,
        type: "call",
        title: "Appel manqué",
        message: notificationMessage,
        data: {
          customerHandle: fromPhoneNumber,
          phoneNumberId,
          callData,
        },
      });
      
      notificationCreated = true;
      console.log(`[CALL] ✅ Notification créée pour les admins du tenant ${tenantId}`);
    } catch (err) {
      console.error(`[CALL] ❌ Erreur création notification:`, err.message);
    }

    // Optionnel : Enregistrer l'événement d'appel dans la base de données
    // (si vous voulez tracker les appels manqués)
    try {
      // Vous pouvez créer un modèle Call dans Prisma si nécessaire
      // Pour l'instant, on log juste
      console.log(`[CALL] 📊 Événement d'appel manqué enregistré pour ${fromPhoneNumber}`);
    } catch (err) {
      console.warn(`[CALL] ⚠️ Impossible d'enregistrer l'événement d'appel:`, err.message);
    }

    return {
      messageSent,
      notificationCreated,
    };
  } catch (error) {
    console.error(`[CALL] ❌ Erreur traitement appel manqué:`, error);
    throw error;
  }
}

/**
 * Détecte si le payload contient un événement d'appel
 * @param {object} payload - Payload du webhook WhatsApp
 * @returns {object|null} - Données de l'appel ou null
 */
function detectCallEvent(payload) {
  try {
    const entry = payload.entry?.[0];
    if (!entry) return null;
    
    const changes = entry.changes?.[0];
    if (!changes) return null;
    
    const value = changes.value;
    if (!value) return null;

    // WhatsApp peut envoyer des événements d'appel dans différents formats
    // Vérifier plusieurs structures possibles
    
    // Structure 1: Événement d'appel direct dans value.call
    if (value.call) {
      console.log(`[CALL] 📞 Structure 1 détectée: value.call`);
      return {
        type: "call",
        callId: value.call.id,
        from: value.call.from,
        timestamp: value.call.timestamp,
        status: value.call.status || "missed", // "ringing", "answered", "missed", "ended"
        duration: value.call.duration,
      };
    }

    // Structure 2: Événement dans statuses (appel manqué)
    if (value.statuses && Array.isArray(value.statuses)) {
      const callStatus = value.statuses.find(s => 
        s.type === "call" || 
        s.status === "missed" || 
        s.status === "failed" ||
        (s.conversation && s.conversation.origin?.type === "call")
      );
      if (callStatus) {
        console.log(`[CALL] 📞 Structure 2 détectée: statuses avec appel`);
        return {
          type: "call",
          callId: callStatus.id,
          from: callStatus.recipient_id || callStatus.from,
          timestamp: callStatus.timestamp,
          status: callStatus.status || "missed",
        };
      }
    }

    // Structure 3: Vérifier le champ "field" pour les appels
    if (changes.field === "call") {
      console.log(`[CALL] 📞 Structure 3 détectée: field === "call"`);
      return {
        type: "call",
        from: value.from || value.recipient_id,
        timestamp: value.timestamp || Date.now(),
        status: value.status || "missed",
        callId: value.id || value.call_id,
      };
    }

    // Structure 4: Vérifier dans metadata si c'est un événement d'appel
    if (value.metadata && value.metadata.event_type === "call") {
      console.log(`[CALL] 📞 Structure 4 détectée: metadata.event_type === "call"`);
      return {
        type: "call",
        from: value.from || value.recipient_id,
        timestamp: value.timestamp || Date.now(),
        status: "missed",
      };
    }

    // Log pour debug si on reçoit un payload suspect
    if (!value.messages && !value.statuses && changes.field) {
      console.log(`[CALL] 🔍 Payload suspect (pas de messages/statuses, field=${changes.field}):`, JSON.stringify(payload, null, 2).substring(0, 500));
    }

    return null;
  } catch (error) {
    console.error(`[CALL] ❌ Erreur détection événement d'appel:`, error);
    return null;
  }
}

module.exports = {
  handleMissedCall,
  detectCallEvent,
};
