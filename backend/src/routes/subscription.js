const express = require("express");
const { prisma } = require("../services/prisma");
const { resolveTenantId } = require("../services/tenantContext");
const { generateInvoice } = require("../services/billingService");

const router = express.Router();

const { PLANS } = require("../services/quotaService");

// Plans d'abonnement disponibles (formaté pour l'API)
const PLANS_API = [
  {
    id: "starter",
    name: "Starter",
    description: "Idéal pour les micro-boutiques. 1 000 conversations / 1 PDF / WhatsApp.",
    priceGnfMonthly: PLANS.starter.priceGnfMonthly,
    priceGnfAnnual: PLANS.starter.priceGnfAnnual,
    conversationLimit: PLANS.starter.conversationLimit,
    pdfLimit: PLANS.starter.pdfLimit,
    channels: PLANS.starter.channels,
  },
  {
    id: "business",
    name: "Business",
    description: "Pour les PME établies. 5 000 conversations / 10 PDF / Multi-canaux.",
    priceGnfMonthly: PLANS.business.priceGnfMonthly,
    priceGnfAnnual: PLANS.business.priceGnfAnnual,
    conversationLimit: PLANS.business.conversationLimit,
    pdfLimit: PLANS.business.pdfLimit,
    channels: PLANS.business.channels,
  },
  {
    id: "elite",
    name: "Elite",
    description: "Pour les grandes entreprises. 20 000 conversations / PDF illimité / Support 24/7.",
    priceGnfMonthly: PLANS.elite.priceGnfMonthly,
    priceGnfAnnual: PLANS.elite.priceGnfAnnual,
    conversationLimit: PLANS.elite.conversationLimit,
    pdfLimit: PLANS.elite.pdfLimit,
    channels: PLANS.elite.channels,
  },
];

/**
 * GET /api/subscription/plans
 * Liste les plans d'abonnement disponibles
 */
router.get("/subscription/plans", async (req, res, next) => {
  try {
    return res.status(200).json({ data: PLANS_API });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/subscription/me
 * Récupère l'abonnement actif du tenant courant
 */
router.get("/subscription/me", async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(401).json({ error: "Tenant ID requis." });
    }

    const now = new Date();

    const subscription = await prisma.subscription.findFirst({
      where: {
        tenantId,
        status: "active",
        endDate: {
          gte: now,
        },
      },
      orderBy: {
        endDate: "desc",
      },
    });

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        planType: true,
      },
    });

    return res.status(200).json({
      data: {
        tenant,
        subscription,
      },
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/subscription/checkout
 * Crée un abonnement pour le tenant courant.
 * Pour l'instant, le paiement est considéré comme réussi (mode test).
 */
router.post("/subscription/checkout", async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(401).json({ error: "Tenant ID requis." });
    }

    const { planType, billingCycle, paymentMethod } = req.body || {};

    if (!planType || !billingCycle) {
      return res
        .status(400)
        .json({ error: "planType et billingCycle sont requis." });
    }

    const plan = PLANS_API.find((p) => p.id === planType);
    if (!plan) {
      return res.status(400).json({ error: "Plan d'abonnement invalide." });
    }

    const now = new Date();
    const startDate = now;
    const endDate = new Date(now);
    if (billingCycle === "annual") {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      // monthly par défaut
      endDate.setMonth(endDate.getMonth() + 1);
    }

    const priceGnf =
      billingCycle === "annual"
        ? plan.priceGnfAnnual
        : plan.priceGnfMonthly;

    // Clôturer les abonnements actifs précédents
    await prisma.subscription.updateMany({
      where: {
        tenantId,
        status: "active",
        endDate: {
          gt: now,
        },
      },
      data: {
        status: "expired",
      },
    });

    // Créer le nouvel abonnement avec les limites du plan
    const subscription = await prisma.subscription.create({
      data: {
        tenantId,
        planType,
        billingCycle,
        status: "active",
        startDate,
        endDate,
        nextBillingDate: endDate,
        priceGnf,
        paymentMethod: paymentMethod || "manual_test",
        conversationLimit: plan.conversationLimit,
        pdfLimit: plan.pdfLimit,
        channels: plan.channels,
        payments: {
          create: {
            amountGnf: priceGnf,
            method: paymentMethod || "manual_test",
            status: "completed",
            paidAt: new Date(),
          },
        },
      },
      include: {
        payments: true,
      },
    });

    // Mettre à jour le planType du tenant
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        planType,
      },
    });

    // Générer une facture liée à la période de l'abonnement (en USD estimés)
    try {
      await generateInvoice(tenantId, startDate, endDate);
    } catch (err) {
      // On logge seulement, pour ne pas bloquer l'abonnement
      console.error(
        "[SUBSCRIPTION] Erreur génération facture pour nouvel abonnement:",
        err.message
      );
    }

    return res.status(201).json({
      data: subscription,
      message:
        "Abonnement créé avec succès. (Mode test: paiement considéré comme réussi)",
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/subscription/booster-packs
 * Liste les packs booster disponibles
 */
router.get("/subscription/booster-packs", async (req, res, next) => {
  try {
    const { BOOSTER_PACKS } = require("../services/quotaService");
    return res.status(200).json({ data: Object.entries(BOOSTER_PACKS).map(([id, pack]) => ({ id, ...pack })) });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/subscription/booster-pack
 * Acheter un pack booster pour recharger les conversations
 */
router.post("/subscription/booster-pack", async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(401).json({ error: "Tenant ID requis." });
    }

    const { packType, paymentMethod } = req.body || {};

    if (!packType) {
      return res.status(400).json({ error: "packType requis (pack_100 ou pack_400)." });
    }

    const { BOOSTER_PACKS } = require("../services/quotaService");
    const pack = BOOSTER_PACKS[packType];

    if (!pack) {
      return res.status(400).json({ error: "Type de pack invalide." });
    }

    // Récupérer l'abonnement actif
    const subscription = await prisma.subscription.findFirst({
      where: {
        tenantId,
        status: "active",
        endDate: { gte: new Date() },
      },
      orderBy: { endDate: "desc" },
    });

    if (!subscription) {
      return res.status(400).json({ error: "Aucun abonnement actif trouvé. Abonnez-vous d'abord." });
    }

    // Créer le pack booster
    const boosterPack = await prisma.boosterPack.create({
      data: {
        subscriptionId: subscription.id,
        packType,
        conversations: pack.conversations,
        priceGnf: pack.priceGnf,
        status: "active",
        // Expire dans 30 jours si non utilisé
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // Créer un paiement associé
    await prisma.payment.create({
      data: {
        subscriptionId: subscription.id,
        amountGnf: pack.priceGnf,
        method: paymentMethod || "mobile_money",
        status: "completed",
        paidAt: new Date(),
      },
    });

    return res.status(201).json({
      data: boosterPack,
      message: `Pack booster acheté avec succès. ${pack.conversations} conversations additionnelles ajoutées.`,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/subscription/quota
 * Récupère l'utilisation actuelle du quota pour le tenant
 */
router.get("/subscription/quota", async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(401).json({ error: "Tenant ID requis." });
    }

    const { getOrCreateQuotaUsage } = require("../services/quotaService");
    const quotaUsage = await getOrCreateQuotaUsage(tenantId);

    // Récupérer les packs booster actifs
    const subscription = await prisma.subscription.findFirst({
      where: {
        tenantId,
        status: "active",
        endDate: { gte: new Date() },
      },
      orderBy: { endDate: "desc" },
    });

    const activeBoosters = subscription
      ? await prisma.boosterPack.findMany({
          where: {
            subscriptionId: subscription.id,
            status: "active",
            OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
          },
        })
      : [];

    const totalBoosterConversations = activeBoosters.reduce((sum, pack) => sum + pack.conversations, 0);

    return res.status(200).json({
      data: {
        quotaUsage,
        activeBoosters,
        totalBoosterConversations,
        effectiveLimit: quotaUsage.conversationsLimit
          ? quotaUsage.conversationsLimit + totalBoosterConversations
          : null,
      },
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

