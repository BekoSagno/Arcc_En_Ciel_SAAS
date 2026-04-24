const express = require("express");
const { prisma } = require("../services/prisma");
const { verifyPassword, hashPassword } = require("../utils/password");
const crypto = require("crypto");

const router = express.Router();

router.post("/auth/register", async (req, res, next) => {
  try {
    const { name, email, password, whatsappNumber } = req.body || {};
    
    if (!name || !email || !password || !whatsappNumber) {
      return res.status(400).json({ 
        error: "Nom, email, mot de passe et numéro WhatsApp Business requis." 
      });
    }

    const trimmedWhatsapp = whatsappNumber.trim();

    // Vérifier si l'email existe déjà
    const existingUser = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (existingUser) {
      return res.status(409).json({ 
        error: "Cet email est déjà utilisé." 
      });
    }

    // Vérifier si le numéro WhatsApp existe déjà dans ChannelIdentity
    const existingWhatsApp = await prisma.channelIdentity.findUnique({
      where: {
        channel_externalId: {
          channel: "WHATSAPP",
          externalId: trimmedWhatsapp,
        },
      },
    });

    if (existingWhatsApp) {
      return res.status(409).json({ 
        error: "Ce numéro WhatsApp Business est déjà utilisé par un autre client. Chaque client doit avoir un numéro unique." 
      });
    }

    // Générer un nom unique pour le tenant (basé sur l'email)
    const emailPrefix = email.trim().toLowerCase().split("@")[0];
    const tenantName = `${emailPrefix}-${crypto.randomBytes(4).toString("hex")}`;

    // Créer le tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: tenantName,
        // companyName et industry seront renseignés plus tard dans le dashboard
        companyName: null,
        industry: null,
      },
    });

    // Hasher le mot de passe
    const passwordHash = await hashPassword(password);

    // Créer l'utilisateur
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        passwordHash,
        role: "TENANT_ADMIN",
        tenantId: tenant.id,
        status: "active",
      },
    });

    // Initialiser une entrée vide dans ChannelConfig pour Meta WhatsApp
    await prisma.channelConfig.create({
      data: {
        tenantId: tenant.id,
        channel: "WHATSAPP",
        status: "inactive",
        credentials: null,
      },
    });

    // Créer l'entrée ChannelIdentity pour le numéro WhatsApp
    await prisma.channelIdentity.create({
      data: {
        tenantId: tenant.id,
        channel: "WHATSAPP",
        externalId: trimmedWhatsapp,
        label: "WhatsApp Business - Inscription",
      },
    });

    return res.status(201).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
      },
      message: "Compte créé avec succès. Vous pouvez maintenant vous connecter.",
    });
  } catch (error) {
    console.error("[REGISTER] Erreur:", error);
    return next(error);
  }
});

router.post("/auth/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email et mot de passe requis." });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { tenant: true },
    });

    if (!user || user.status !== "active") {
      return res.status(401).json({ error: "Identifiants invalides." });
    }

    if (password === "otp-verified") {
      const otpVerified = await prisma.oTPCode.findFirst({
        where: {
          email: user.email,
          tenantId: user.tenantId,
          used: true,
          expiresAt: { gt: new Date(Date.now() - 5 * 60 * 1000) },
        },
        orderBy: { createdAt: "desc" },
      });
      if (!otpVerified) {
        return res.status(401).json({ error: "Vérification OTP requise." });
      }
    } else {
      const isValid = await verifyPassword(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: "Identifiants invalides." });
      }
    }

    return res.status(200).json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      tenantName: user.tenant?.name || null,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/users/profile - Récupérer le profil utilisateur complet
 */
router.get("/users/profile", async (req, res, next) => {
  try {
    const tenantId = req.headers["x-tenant-id"];
    const userId = req.query.userId || req.headers["x-user-id"];

    if (!tenantId && !userId) {
      return res.status(400).json({ error: "Tenant ID ou User ID requis." });
    }

    let user;
    if (userId) {
      user = await prisma.user.findUnique({
        where: { id: userId },
        include: { tenant: true },
      });
    } else if (tenantId) {
      // Récupérer le premier utilisateur actif du tenant
      user = await prisma.user.findFirst({
        where: { tenantId, status: "active" },
        include: { tenant: true },
      });
    }

    if (!user) {
      return res.status(404).json({ error: "Utilisateur introuvable." });
    }

    return res.status(200).json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      tenantName: user.tenant?.name || null,
    });
  } catch (error) {
    console.error("[PROFILE] Erreur récupération:", error);
    return next(error);
  }
});

/**
 * PATCH /api/users/profile - Mettre à jour le profil utilisateur
 * Requiert l'ID de l'utilisateur dans le body (ou via session si authentifié)
 */
router.patch("/users/profile", async (req, res, next) => {
  try {
    const { id, name, email } = req.body || {};
    
    if (!id) {
      return res.status(400).json({ error: "ID utilisateur requis." });
    }

    // Vérifier que l'utilisateur existe
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return res.status(404).json({ error: "Utilisateur introuvable." });
    }

    // Préparer les données à mettre à jour
    const updateData = {};
    if (name !== undefined) {
      updateData.name = name.trim() || null;
    }
    if (email !== undefined && email !== existingUser.email) {
      // Vérifier que le nouvel email n'est pas déjà utilisé
      const emailExists = await prisma.user.findUnique({
        where: { email: email.trim().toLowerCase() },
      });
      if (emailExists) {
        return res.status(409).json({ error: "Cet email est déjà utilisé." });
      }
      updateData.email = email.trim().toLowerCase();
    }

    // Mettre à jour l'utilisateur
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      include: { tenant: true },
    });

    return res.status(200).json({
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
      tenantId: updatedUser.tenantId,
      tenantName: updatedUser.tenant?.name || null,
    });
  } catch (error) {
    console.error("[PROFILE] Erreur mise à jour:", error);
    return next(error);
  }
});

module.exports = router;
