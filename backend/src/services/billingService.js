const { prisma } = require("./prisma");

/**
 * Calcule les coûts pour un tenant sur une période donnée
 */
const calculateTenantCosts = async (tenantId, startDate, endDate) => {
  const messages = await prisma.message.findMany({
    where: {
      tenantId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      costUsd: true,
      tokenUsage: true,
      direction: true,
      conversation: {
        select: {
          channel: true,
        },
      },
    },
  });

  // Coûts par canal
  const costsByChannel = {
    WHATSAPP: { messages: 0, costUsd: 0, tokens: 0 },
    MESSENGER: { messages: 0, costUsd: 0, tokens: 0 },
    FACEBOOK_COMMENT: { messages: 0, costUsd: 0, tokens: 0 },
  };

  let totalCost = 0;
  let totalTokens = 0;
  let totalMessages = 0;

  messages.forEach((msg) => {
    const channel = msg.conversation?.channel || "WHATSAPP";
    const cost = msg.costUsd || 0;
    const tokens = msg.tokenUsage || 0;

    if (costsByChannel[channel]) {
      costsByChannel[channel].messages += 1;
      costsByChannel[channel].costUsd += cost;
      costsByChannel[channel].tokens += tokens;
    }

    totalCost += cost;
    totalTokens += tokens;
    totalMessages += 1;
  });

  // Meta WhatsApp est gratuit dans la fenêtre 24h
  const metaWhatsAppCost = 0; // Gratuit
  const metaWhatsAppMessages = costsByChannel.WHATSAPP.messages;

  // Coûts OpenAI (tokens)
  const openAICost = totalTokens > 0 ? (totalTokens / 1000) * 0.00015 : 0; // $0.00015 par 1k tokens

  // Meta est gratuit
  const metaCost = 0;

  return {
    period: {
      start: startDate,
      end: endDate,
    },
    summary: {
      totalMessages,
      totalTokens,
      totalCostUsd: totalCost + metaWhatsAppCost,
    },
    breakdown: {
      metaWhatsApp: {
        messages: metaWhatsAppMessages,
        costUsd: metaWhatsAppCost,
        ratePerMessage: 0,
      },
      openai: {
        tokens: totalTokens,
        costUsd: openAICost,
        ratePer1kTokens: 0.00015,
      },
      meta: {
        messages: costsByChannel.MESSENGER.messages + costsByChannel.FACEBOOK_COMMENT.messages,
        costUsd: metaCost,
      },
    },
    byChannel: costsByChannel,
  };
};

/**
 * Génère une facture pour un tenant
 */
const generateInvoice = async (tenantId, periodStart, periodEnd) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) {
    throw new Error("Tenant introuvable");
  }

  const costs = await calculateTenantCosts(tenantId, periodStart, periodEnd);

  // Générer numéro de facture
  const invoiceCount = await prisma.invoice.count({
    where: { tenantId },
  });
  const invoiceNumber = `INV-${tenant.name.toUpperCase().replace(/\s+/g, "-")}-${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(4, "0")}`;

  // Calculer dates
  const dueDate = new Date(periodEnd);
  dueDate.setDate(dueDate.getDate() + 30); // 30 jours pour payer

  // Créer la facture
  const invoice = await prisma.invoice.create({
    data: {
      tenantId,
      invoiceNumber,
      periodStart,
      periodEnd,
      subtotalUsd: costs.summary.totalCostUsd,
      taxUsd: 0, // À configurer selon les besoins
      totalUsd: costs.summary.totalCostUsd,
      dueDate,
      status: "pending",
      lineItems: {
        create: [
          {
            description: `Messages WhatsApp (${costs.breakdown.metaWhatsApp.messages} messages)`,
            quantity: costs.breakdown.metaWhatsApp.messages,
            unitPrice: costs.breakdown.metaWhatsApp.ratePerMessage,
            totalPrice: costs.breakdown.metaWhatsApp.costUsd,
            category: "meta",
            metadata: {
              messages: costs.breakdown.metaWhatsApp.messages,
            },
          },
          {
            description: `Tokens OpenAI (${costs.breakdown.openai.tokens} tokens)`,
            quantity: costs.breakdown.openai.tokens,
            unitPrice: costs.breakdown.openai.ratePer1kTokens / 1000,
            totalPrice: costs.breakdown.openai.costUsd,
            category: "openai",
            metadata: {
              tokens: costs.breakdown.openai.tokens,
            },
          },
          {
            description: `Messages Meta (${costs.breakdown.meta.messages} messages)`,
            quantity: costs.breakdown.meta.messages,
            unitPrice: 0,
            totalPrice: 0,
            category: "meta",
            metadata: {
              messages: costs.breakdown.meta.messages,
            },
          },
        ],
      },
    },
    include: {
      lineItems: true,
    },
  });

  return invoice;
};

/**
 * Enregistre l'utilisation d'API pour un tenant
 */
const recordAPIUsage = async (tenantId, channel, apiProvider, messageCount = 0, tokenCount = 0, costUsd = 0) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.aPIUsage.upsert({
    where: {
      tenantId_date_channel_apiProvider: {
        tenantId,
        date: today,
        channel,
        apiProvider,
      },
    },
    create: {
      tenantId,
      date: today,
      channel,
      apiProvider,
      messageCount,
      tokenCount,
      costUsd,
    },
    update: {
      messageCount: {
        increment: messageCount,
      },
      tokenCount: {
        increment: tokenCount,
      },
      costUsd: {
        increment: costUsd,
      },
    },
  });
};

/**
 * Récupère les statistiques d'utilisation pour un tenant
 */
const getTenantUsageStats = async (tenantId, startDate, endDate) => {
  const usage = await prisma.aPIUsage.findMany({
    where: {
      tenantId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: {
      date: "desc",
    },
  });

  const totals = usage.reduce(
    (acc, u) => {
      acc.messages += u.messageCount;
      acc.tokens += u.tokenCount;
      acc.cost += u.costUsd;
      return acc;
    },
    { messages: 0, tokens: 0, cost: 0 }
  );

  return {
    daily: usage,
    totals,
  };
};

module.exports = {
  calculateTenantCosts,
  generateInvoice,
  recordAPIUsage,
  getTenantUsageStats,
};
