const express = require("express");
const { resolveTenantId } = require("../services/tenantContext");
const { upsertAccount } = require("../services/socialAccountService");
const { prisma } = require("../services/prisma");

const router = express.Router();

// GET /api/social-accounts - Liste des comptes sociaux du tenant (sans tokens)
router.get("/social-accounts", async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant introuvable." });
    }

    const accounts = await prisma.socialAccount.findMany({
      where: { tenantId },
      orderBy: { platform: "asc" },
    });

    // Ne jamais renvoyer le token chiffré au frontend
    const safeAccounts = accounts.map((acc) => ({
      id: acc.id,
      tenantId: acc.tenantId,
      platform: acc.platform,
      platformId: acc.platformId,
      isActive: acc.isActive,
      createdAt: acc.createdAt,
      updatedAt: acc.updatedAt,
      hasToken: !!acc.accessTokenEnc,
    }));

    return res.status(200).json({ data: safeAccounts });
  } catch (error) {
    return next(error);
  }
});

// POST /api/social-accounts - Crée ou met à jour un compte social
router.post("/social-accounts", async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant introuvable." });
    }

    const { platform, accessToken, platformId, isActive = true } = req.body || {};

    if (!platform || !platformId) {
      return res.status(400).json({
        error: "Les champs 'platform' et 'platformId' sont requis.",
      });
    }

    const account = await upsertAccount({
      tenantId,
      platform,
      accessToken: accessToken || null,
      platformId: String(platformId),
      isActive: Boolean(isActive),
    });

    // Ne pas renvoyer le token chiffré
    const { accessTokenEnc, ...safe } = account;

    return res.status(200).json({ data: { ...safe, hasToken: !!accessTokenEnc } });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

