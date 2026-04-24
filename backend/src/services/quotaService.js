const { prisma } = require("./prisma");
const { notifySystem } = require("./notificationService");
const { sendResponse } = require("./messagingService");
const { sendCustomEmail } = require("./emailService");
const dayjs = require("dayjs");

// Plans avec leurs limites
const PLANS = {
  starter: {
    name: "Starter",
    conversationLimit: 1000,
    pdfLimit: 1,
    channels: ["WHATSAPP"],
    priceGnfMonthly: 200000,
    priceGnfAnnual: 2000000,
  },
  business: {
    name: "Business",
    conversationLimit: 5000,
    pdfLimit: 10,
    channels: ["WHATSAPP", "MESSENGER", "FACEBOOK_COMMENT"],
    priceGnfMonthly: 500000,
    priceGnfAnnual: 5000000,
  },
  elite: {
    name: "Elite",
    conversationLimit: 20000,
    pdfLimit: null, // illimité
    channels: ["WHATSAPP", "MESSENGER", "FACEBOOK_COMMENT"],
    priceGnfMonthly: 1500000,
    priceGnfAnnual: 15000000,
  },
};

// Packs Booster
const BOOSTER_PACKS = {
  pack_100: {
    name: "Pack 100",
    conversations: 400,
    priceGnf: 50000,
  },
  pack_400: {
    name: "Pack 400",
    conversations: 1600, // 1600 conversations pour 100k GNF
    priceGnf: 100000,
  },
};

/**
 * Récupère ou crée le QuotaUsage pour le mois en cours
 */
const getOrCreateQuotaUsage = async (tenantId, subscriptionId = null) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12

  let quotaUsage = await prisma.quotaUsage.findUnique({
    where: {
      tenantId_year_month: {
        tenantId,
        year,
        month,
      },
    },
  });

  if (!quotaUsage) {
    // Récupérer la subscription active pour obtenir les limites
    const subscription = subscriptionId
      ? await prisma.subscription.findUnique({
          where: { id: subscriptionId },
        })
      : await prisma.subscription.findFirst({
          where: {
            tenantId,
            status: "active",
            endDate: { gte: now },
          },
          orderBy: { endDate: "desc" },
        });

    const plan = subscription ? PLANS[subscription.planType] : null;

    quotaUsage = await prisma.quotaUsage.create({
      data: {
        tenantId,
        subscriptionId: subscription?.id || null,
        year,
        month,
        conversationsLimit: plan?.conversationLimit || null,
        pdfLimit: plan?.pdfLimit || null,
      },
    });
  }

  return quotaUsage;
};

/**
 * Vérifie si une conversation doit être comptée (session 24h)
 * Retourne { shouldConsume: boolean, sessionId: string | null }
 */
const shouldConsumeConversation = async (tenantId, conversationId, customerHandle) => {
  const now = new Date();
  const twentyFourHoursAgo = dayjs(now).subtract(24, "hours").toDate();
  const fortyEightHoursAgo = dayjs(now).subtract(48, "hours").toDate();

  // Chercher une session active (non consommée) dans les 24 dernières heures
  const activeSession = await prisma.conversationSession.findFirst({
    where: {
      tenantId,
      conversationId,
      customerHandle,
      sessionStart: { gte: twentyFourHoursAgo },
      consumed: false,
      sessionEnd: null,
    },
    orderBy: { sessionStart: "desc" },
  });

  if (activeSession) {
    // Session active dans les 24h, ne pas consommer
    return { shouldConsume: false, sessionId: activeSession.id };
  }

  // Chercher la dernière session consommée
  const lastConsumedSession = await prisma.conversationSession.findFirst({
    where: {
      tenantId,
      conversationId,
      customerHandle,
      consumed: true,
    },
    orderBy: { sessionStart: "desc" },
  });

  if (lastConsumedSession) {
    const lastSessionStart = new Date(lastConsumedSession.sessionStart);
    const hoursSinceLastSession = dayjs(now).diff(dayjs(lastSessionStart), "hours");

    if (hoursSinceLastSession < 48) {
      // Moins de 48h depuis la dernière session, ne pas consommer
      return { shouldConsume: false, sessionId: null };
    }
  }

  // Nouvelle session à créer et consommer
  const newSession = await prisma.conversationSession.create({
    data: {
      tenantId,
      conversationId,
      customerHandle,
      sessionStart: now,
      consumed: true, // On marque directement comme consommée
    },
  });

  return { shouldConsume: true, sessionId: newSession.id };
};

/**
 * Consomme une conversation et met à jour le quota
 */
const consumeConversation = async (tenantId, conversationId, customerHandle) => {
  const { shouldConsume, sessionId } = await shouldConsumeConversation(
    tenantId,
    conversationId,
    customerHandle
  );

  if (!shouldConsume) {
    return { consumed: false, quotaUsage: null };
  }

  // Récupérer la subscription active
  const subscription = await prisma.subscription.findFirst({
    where: {
      tenantId,
      status: "active",
      endDate: { gte: new Date() },
    },
    orderBy: { endDate: "desc" },
  });

  const quotaUsage = await getOrCreateQuotaUsage(tenantId, subscription?.id || null);

  // Vérifier les packs booster actifs (seulement si on a une subscription)
  const activeBoosters = subscription?.id
    ? await prisma.boosterPack.findMany({
    where: {
          subscriptionId: subscription.id,
      status: "active",
      OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
    },
      })
    : [];

  const totalBoosterConversations = activeBoosters.reduce(
    (sum, pack) => sum + pack.conversations,
    0
  );

  // Mettre à jour le quota
  const updatedQuota = await prisma.quotaUsage.update({
    where: { id: quotaUsage.id },
    data: {
      conversationsUsed: { increment: 1 },
    },
  });

  // Vérifier les alertes et blocages
  await checkQuotaLimits(tenantId, updatedQuota, subscription);

  return { consumed: true, quotaUsage: updatedQuota, sessionId };
};

/**
 * Vérifie les limites et envoie les notifications/blocages
 */
const checkQuotaLimits = async (tenantId, quotaUsage, subscription) => {
  const limit = quotaUsage.conversationsLimit;
  if (!limit) return; // Illimité

  const used = quotaUsage.conversationsUsed;
  const percentage = (used / limit) * 100;

  // Alerte à 80%
  if (percentage >= 80 && percentage < 100) {
    const hoursSinceLastAlert = quotaUsage.lastAlertSentAt
      ? dayjs().diff(dayjs(quotaUsage.lastAlertSentAt), "hours")
      : 999;

    // Envoyer l'alerte seulement si la dernière alerte date de plus de 24h
    if (hoursSinceLastAlert >= 24) {
      await sendQuotaAlert(tenantId, quotaUsage, subscription);
      await prisma.quotaUsage.update({
        where: { id: quotaUsage.id },
        data: { lastAlertSentAt: new Date() },
      });
    }
  }

  // Blocage à 100%
  if (percentage >= 100) {
    await sendQuotaExceededNotification(tenantId, quotaUsage, subscription);
  }
};

/**
 * Envoie l'alerte à 80% (dashboard + WhatsApp)
 */
const sendQuotaAlert = async (tenantId, quotaUsage, subscription) => {
  const plan = subscription ? PLANS[subscription.planType] : null;
  const planName = plan?.name || "Votre plan";

  // Notification dashboard
  await notifySystem({
    tenantId,
    title: "Quota atteint à 80%",
    message: `Félicitations ! Votre boutique est très active. Vous avez utilisé ${quotaUsage.conversationsUsed}/${quotaUsage.conversationsLimit} conversations (${Math.round((quotaUsage.conversationsUsed / quotaUsage.conversationsLimit) * 100)}%). Pour éviter toute interruption de service, pensez à passer au plan ${planName === "Starter" ? "Business" : "Elite"} ou à acheter un pack booster.`,
    data: {
      type: "quota_alert",
      quotaUsageId: quotaUsage.id,
      percentage: Math.round((quotaUsage.conversationsUsed / quotaUsage.conversationsLimit) * 100),
    },
  });

  // Email d'alerte
  try {
    const adminUser = await prisma.user.findFirst({
      where: { tenantId, role: "TENANT_ADMIN", status: "active" },
      orderBy: { createdAt: "asc" },
    });
    if (adminUser?.email) {
      const percentage = Math.round((quotaUsage.conversationsUsed / quotaUsage.conversationsLimit) * 100);
      await sendCustomEmail({
        to: adminUser.email,
        subject: "Alerte quota IA 80% - Arcc En Ciel",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #0b101d; color: #e2e8f0;">
            <h2 style="color: #818cf8;">Alerte quota IA</h2>
            <p>Vous avez utilisé <strong>${quotaUsage.conversationsUsed}/${quotaUsage.conversationsLimit}</strong> conversations IA (${percentage}%).</p>
            <p>Pour éviter toute interruption, pensez à augmenter votre plan ou acheter un pack booster.</p>
          </div>
        `,
      });
    }
  } catch (emailError) {
    console.error("[QUOTA] Erreur envoi email alerte 80%:", emailError);
  }

  // Envoyer un message WhatsApp à l'administrateur (si configuré)
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        users: {
          where: { role: "TENANT_ADMIN", status: "active" },
          take: 1,
        },
        channelIdentities: {
          where: { channel: "WHATSAPP" },
          take: 1,
        },
      },
    });

    if (tenant?.users?.[0] && tenant?.channelIdentities?.[0]) {
      // Note: Pour envoyer un message WhatsApp, il faudrait utiliser le service de messaging
      // Pour l'instant, on log juste
      console.log(
        `[QUOTA] Alerte 80% envoyée pour tenant ${tenantId}. WhatsApp admin: ${tenant.channelIdentities[0].externalId}`
      );
    }
  } catch (error) {
    console.error("[QUOTA] Erreur envoi alerte WhatsApp:", error);
  }
};

/**
 * Envoie la notification de blocage à 100%
 */
const sendQuotaExceededNotification = async (tenantId, quotaUsage, subscription) => {
  // Notification dashboard
  await notifySystem({
    tenantId,
    title: "Service Suspendu : Quota épuisé",
    message: `Votre quota de conversations est épuisé (${quotaUsage.conversationsUsed}/${quotaUsage.conversationsLimit}). L'IA ne répondra plus aux clients jusqu'à ce que vous rechargiez via Orange Money ou MTN Mobile Money.`,
    data: {
      type: "quota_exceeded",
      quotaUsageId: quotaUsage.id,
    },
  });

  // Email blocage
  try {
    const adminUser = await prisma.user.findFirst({
      where: { tenantId, role: "TENANT_ADMIN", status: "active" },
      orderBy: { createdAt: "asc" },
    });
    if (adminUser?.email) {
      await sendCustomEmail({
        to: adminUser.email,
        subject: "Quota IA épuisé - Arcc En Ciel",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #0b101d; color: #e2e8f0;">
            <h2 style="color: #ef4444;">Quota IA épuisé</h2>
            <p>Votre quota de conversations IA est épuisé (${quotaUsage.conversationsUsed}/${quotaUsage.conversationsLimit}).</p>
            <p>L'IA est temporairement désactivée pour vos clients. Merci de recharger ou de passer à un plan supérieur.</p>
          </div>
        `,
      });
    }
  } catch (emailError) {
    console.error("[QUOTA] Erreur envoi email blocage 100%:", emailError);
  }

  // Envoyer un message WhatsApp à l'administrateur
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        users: {
          where: { role: "TENANT_ADMIN", status: "active" },
          take: 1,
        },
        channelIdentities: {
          where: { channel: "WHATSAPP" },
          take: 1,
        },
      },
    });

    if (tenant?.users?.[0] && tenant?.channelIdentities?.[0]) {
      console.log(
        `[QUOTA] Notification blocage 100% envoyée pour tenant ${tenantId}. WhatsApp admin: ${tenant.channelIdentities[0].externalId}`
      );
    }
  } catch (error) {
    console.error("[QUOTA] Erreur envoi notification WhatsApp:", error);
  }
};

/**
 * Vérifie si le tenant peut encore répondre (quota non épuisé)
 */
const canRespond = async (tenantId) => {
  // MODE DÉVELOPPEMENT : Désactiver les quotas si DEV_MODE=true
  if (process.env.DEV_MODE === "true" || process.env.NODE_ENV === "development") {
    console.log(`[QUOTA] 🛠️ Mode développement activé - Quotas désactivés pour tenant ${tenantId}`);
    return { allowed: true, reason: "dev_mode", quotaUsage: null };
  }

  const quotaUsage = await getOrCreateQuotaUsage(tenantId);
  const limit = quotaUsage.conversationsLimit;

  if (!limit) return { allowed: true, reason: "unlimited" }; // Illimité

  const used = quotaUsage.conversationsUsed;

  if (used >= limit) {
    return { allowed: false, reason: "quota_exceeded", quotaUsage };
  }

  return { allowed: true, reason: "ok", quotaUsage };
};

/**
 * Message de blocage à envoyer au client
 */
const getBlockedMessage = () => {
  return "Notre assistant automatique a atteint sa limite de service. Un conseiller humain prendra le relais dès que possible.";
};

module.exports = {
  PLANS,
  BOOSTER_PACKS,
  getOrCreateQuotaUsage,
  shouldConsumeConversation,
  consumeConversation,
  canRespond,
  getBlockedMessage,
  checkQuotaLimits,
};
