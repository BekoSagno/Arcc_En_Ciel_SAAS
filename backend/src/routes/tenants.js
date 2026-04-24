const express = require("express");
const { prisma } = require("../services/prisma");
const { resolveTenantId } = require("../services/tenantContext");

const router = express.Router();

// GET /api/tenants/me - Récupérer les informations du tenant actuel
router.get("/tenants/me", async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);

    if (!tenantId) {
      return res.status(401).json({ error: "Tenant ID requis." });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        companyName: true,
        industry: true,
        status: true,
        timezone: true,
        planType: true,
        createdAt: true,
      },
    });

    if (!tenant) {
      return res.status(404).json({ error: "Tenant introuvable." });
    }

    return res.status(200).json(tenant);
  } catch (error) {
    return next(error);
  }
});

// PUT /api/tenants/me - Mettre à jour les informations du tenant actuel
router.put("/tenants/me", async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);

    if (!tenantId) {
      return res.status(401).json({ error: "Tenant ID requis." });
    }

    const { companyName, industry, timezone } = req.body || {};

    // Vérifier que le tenant existe
    const existingTenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!existingTenant) {
      return res.status(404).json({ error: "Tenant introuvable." });
    }

    // Mettre à jour uniquement les champs fournis
    const updateData = {};
    if (companyName !== undefined) {
      updateData.companyName = companyName.trim() || null;
    }
    if (industry !== undefined) {
      updateData.industry = industry.trim() || null;
    }
    if (timezone !== undefined) {
      updateData.timezone = timezone.trim();
    }

    const updatedTenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: updateData,
      select: {
        id: true,
        name: true,
        companyName: true,
        industry: true,
        status: true,
        timezone: true,
        planType: true,
        updatedAt: true,
        createdAt: true,
      },
    });

    return res.status(200).json({
      success: true,
      tenant: updatedTenant,
      message: "Informations mises à jour avec succès.",
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
