const express = require("express");
const crypto = require("crypto");
const { prisma } = require("../services/prisma");
const { hashPassword } = require("../utils/password");
const { sendOTPEmail } = require("../services/emailService");

const router = express.Router();

const generateOTP = () => {
  return String(Math.floor(100000 + Math.random() * 900000));
};

router.post("/otp/send", async (req, res, next) => {
  try {
    const { email, tenantId } = req.body || {};
    const trimmedEmail = String(email || "").trim().toLowerCase();

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return res.status(400).json({ error: "Email invalide." });
    }

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID requis." });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true },
    });

    if (!tenant) {
      return res.status(404).json({ error: "Tenant introuvable." });
    }

    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.oTPCode.create({
      data: {
        email: trimmedEmail,
        code,
        tenantId: tenant.id,
        expiresAt,
      },
    });

    const emailResult = await sendOTPEmail({
      email: trimmedEmail,
      code,
      tenantName: tenant.name,
    });

    if (!emailResult.sent && !emailResult.mock) {
      return res.status(500).json({
        error: "Impossible d'envoyer l'email. Vérifiez la configuration SMTP.",
      });
    }

    // En mode mock, retourner le code pour l'afficher dans le frontend
    return res.status(200).json({
      message: emailResult.mock
        ? "Code généré (mode mock)"
        : "Code envoyé par email",
      mock: emailResult.mock,
      code: emailResult.mock ? code : undefined, // Retourner le code uniquement en mode mock
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/otp/verify", async (req, res, next) => {
  try {
    const { email, code, tenantId } = req.body || {};
    const trimmedEmail = String(email || "").trim().toLowerCase();
    const trimmedCode = String(code || "").trim();

    if (!trimmedEmail || !trimmedCode || !tenantId) {
      return res.status(400).json({ error: "Email, code et tenant ID requis." });
    }

    const otpRecord = await prisma.oTPCode.findFirst({
      where: {
        email: trimmedEmail,
        code: trimmedCode,
        tenantId,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!otpRecord) {
      return res.status(401).json({ error: "Code invalide ou expiré." });
    }

    await prisma.oTPCode.update({
      where: { id: otpRecord.id },
      data: { used: true },
    });

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        users: {
          where: { email: trimmedEmail },
          take: 1,
        },
      },
    });

    if (!tenant) {
      return res.status(404).json({ error: "Tenant introuvable." });
    }

    let user = tenant.users[0];

    if (!user) {
      const passwordHash = await hashPassword(crypto.randomBytes(12).toString("base64url"));
      user = await prisma.user.create({
        data: {
          email: trimmedEmail,
          name: trimmedEmail.split("@")[0],
          role: "TENANT_ADMIN",
          passwordHash,
          tenantId: tenant.id,
          status: "active",
        },
      });
    } else if (user.status !== "active") {
      await prisma.user.update({
        where: { id: user.id },
        data: { status: "active" },
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: tenant.id,
        tenantName: tenant.name,
      },
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
