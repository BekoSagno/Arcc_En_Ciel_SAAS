const express = require("express");
const { prisma } = require("../services/prisma");
const { adminAuthMiddleware } = require("../middleware/adminAuth");
const { resolveTenantId } = require("../services/tenantContext");
const {
  calculateTenantCosts,
  generateInvoice,
  getTenantUsageStats,
} = require("../services/billingService");

const router = express.Router();

// Appliquer le middleware d'authentification admin sur toutes les routes
router.use("/admin/billing", adminAuthMiddleware);

// ========== FACTURATION ==========

// Calculer les coûts d'un tenant pour une période
router.get("/admin/billing/tenants/:tenantId/costs", async (req, res, next) => {
  try {
    const { tenantId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate et endDate requis (format ISO)" });
    }

    const costs = await calculateTenantCosts(
      tenantId,
      new Date(startDate),
      new Date(endDate)
    );

    return res.status(200).json({ data: costs });
  } catch (error) {
    return next(error);
  }
});

// Générer une facture pour un tenant
router.post("/admin/billing/tenants/:tenantId/invoices", async (req, res, next) => {
  try {
    const { tenantId } = req.params;
    const { periodStart, periodEnd } = req.body;

    if (!periodStart || !periodEnd) {
      return res.status(400).json({ error: "periodStart et periodEnd requis (format ISO)" });
    }

    const invoice = await generateInvoice(
      tenantId,
      new Date(periodStart),
      new Date(periodEnd)
    );

    return res.status(201).json({ data: invoice });
  } catch (error) {
    return next(error);
  }
});

// Liste des factures d'un tenant
router.get("/admin/billing/tenants/:tenantId/invoices", async (req, res, next) => {
  try {
    const { tenantId } = req.params;
    const invoices = await prisma.invoice.findMany({
      where: { tenantId },
      include: {
        lineItems: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ data: invoices });
  } catch (error) {
    return next(error);
  }
});

// ================== CÔTÉ TENANT (self-service) ==================

// Liste des factures du tenant courant
router.get("/billing/invoices", async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant introuvable." });
    }

    const invoices = await prisma.invoice.findMany({
      where: { tenantId },
      include: { lineItems: true },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ data: invoices });
  } catch (error) {
    return next(error);
  }
});

// Statistiques d'utilisation d'un tenant
router.get("/admin/billing/tenants/:tenantId/usage", async (req, res, next) => {
  try {
    const { tenantId } = req.params;
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const usage = await getTenantUsageStats(tenantId, start, end);

    return res.status(200).json({ data: usage });
  } catch (error) {
    return next(error);
  }
});

// Vue d'ensemble de la facturation globale
router.get("/admin/billing/overview", async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Récupérer tous les tenants actifs
    const tenants = await prisma.tenant.findMany({
      where: { status: "active" },
      select: { id: true, name: true },
    });

    // Calculer les coûts pour chaque tenant
    const tenantCosts = await Promise.all(
      tenants.map(async (tenant) => {
        try {
          const costs = await calculateTenantCosts(tenant.id, start, end);
          return {
            tenantId: tenant.id,
            tenantName: tenant.name,
            ...costs.summary,
            breakdown: costs.breakdown,
          };
        } catch (error) {
          console.error(`Erreur calcul coûts pour ${tenant.name}:`, error);
          return {
            tenantId: tenant.id,
            tenantName: tenant.name,
            totalMessages: 0,
            totalTokens: 0,
            totalCostUsd: 0,
            breakdown: {},
          };
        }
      })
    );

    // Totaux globaux
    const totals = tenantCosts.reduce(
      (acc, tc) => {
        acc.totalMessages += tc.totalMessages || 0;
        acc.totalTokens += tc.totalTokens || 0;
        acc.totalCostUsd += tc.totalCostUsd || 0;
        return acc;
      },
      { totalMessages: 0, totalTokens: 0, totalCostUsd: 0 }
    );

    // Factures en attente
    const pendingInvoices = await prisma.invoice.count({
      where: {
        status: "pending",
        dueDate: { lt: new Date() },
      },
    });

    // Factures payées ce mois
    const thisMonth = new Date();
    thisMonth.setDate(1);
    const paidThisMonth = await prisma.invoice.aggregate({
      where: {
        status: "paid",
        paidAt: { gte: thisMonth },
      },
      _sum: {
        totalUsd: true,
      },
    });

    return res.status(200).json({
      data: {
        period: { start, end },
        totals,
        tenantCosts,
        invoices: {
          pending: pendingInvoices,
          paidThisMonth: paidThisMonth._sum.totalUsd || 0,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
