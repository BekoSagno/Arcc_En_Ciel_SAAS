const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const { prisma } = require("../services/prisma");
const { hashPassword } = require("../utils/password");
const { extractTextFromPdf, ingestSource } = require("../services/ragIngestor");

const router = express.Router();
const upload = multer();

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

router.post("/onboarding/setup", upload.single("file"), async (req, res, next) => {
  try {
    const { name, whatsappNumber, knowledge } = req.body || {};
    const trimmedName = String(name || "").trim();
    const trimmedWhatsapp = String(whatsappNumber || "").trim();
    const trimmedKnowledge = String(knowledge || "").trim();

    if (!trimmedName || !trimmedWhatsapp) {
      return res.status(400).json({
        error: "Nom et numero WhatsApp requis.",
      });
    }

    let pdfContent = "";
    if (req.file?.buffer) {
      pdfContent = await extractTextFromPdf(req.file.buffer);
    }

    const contentParts = [trimmedKnowledge, pdfContent].filter(Boolean);
    if (!contentParts.length) {
      return res.status(400).json({
        error: "Ajoutez une description ou un PDF pour la connaissance.",
      });
    }

    let tenant = await prisma.tenant.findUnique({
      where: { name: trimmedName },
    });

    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: { name: trimmedName },
      });
    }

    if (trimmedWhatsapp) {
      const existingIdentity = await prisma.channelIdentity.findUnique({
        where: {
          channel_externalId: {
            channel: "WHATSAPP",
            externalId: trimmedWhatsapp,
          },
        },
      });

      if (existingIdentity && existingIdentity.tenantId !== tenant.id) {
        return res.status(409).json({
          error: "Ce numero WhatsApp est deja associe a un autre client.",
        });
      }

      await prisma.channelIdentity.upsert({
        where: {
          channel_externalId: {
            channel: "WHATSAPP",
            externalId: trimmedWhatsapp,
          },
        },
        create: {
          tenantId: tenant.id,
          channel: "WHATSAPP",
          externalId: trimmedWhatsapp,
          label: "Onboarding WhatsApp",
        },
        update: { tenantId: tenant.id },
      });
    }

    const slug = slugify(trimmedName) || "boutique";
    const adminEmail = `${slug}-${tenant.id.slice(0, 6)}@arcc.local`;
    const adminPassword = crypto.randomBytes(6).toString("base64url");
    const passwordHash = await hashPassword(adminPassword);
    await prisma.user.upsert({
      where: { email: adminEmail },
      create: {
        email: adminEmail,
        name: "Owner",
        role: "TENANT_ADMIN",
        passwordHash,
        tenantId: tenant.id,
      },
      update: {
        passwordHash,
        tenantId: tenant.id,
        status: "active",
      },
    });

    const source = await prisma.rAGSource.create({
      data: {
        tenantId: tenant.id,
        type: "TEXT",
        title: "Onboarding - Connaissance initiale",
        status: "processing",
      },
    });

    console.log(`[ONBOARDING] Début ingestion RAG pour tenant ${tenant.id}`);
    let ragSuccess = false;
    let ragError = null;
    try {
      await ingestSource({
        tenantId: tenant.id,
        sourceId: source.id,
        namespace: tenant.id,
        content: contentParts.join("\n\n"),
      });
      console.log(`[ONBOARDING] Ingestion RAG terminée pour tenant ${tenant.id}`);
      ragSuccess = true;
    } catch (err) {
      ragError = err;
      console.error(`[ONBOARDING] Erreur ingestion RAG:`, err.message || err);
      await prisma.rAGSource.update({
        where: { id: source.id },
        data: { status: "failed" },
      });
      // On continue quand même pour créer le tenant, mais on marque la source comme failed
      console.warn(`[ONBOARDING] Continuation malgré l'erreur RAG - le tenant sera créé mais la source RAG est en échec`);
      
      // Si l'erreur est critique (API invalide, quota, etc.), on retourne une erreur
      const errorMessage = err.message || String(err);
      if (errorMessage.includes("API") || errorMessage.includes("quota") || errorMessage.includes("401") || errorMessage.includes("403")) {
        return res.status(500).json({
          error: `Erreur lors de l'ingestion RAG: ${errorMessage}. Le tenant a été créé mais la base de connaissances n'a pas pu être initialisée.`,
          tenantId: tenant.id, // On retourne quand même le tenantId
          ragError: true,
        });
      }
    }

    // On met à jour le statut seulement si l'ingestion a réussi
    if (ragSuccess) {
      await prisma.rAGSource.update({
        where: { id: source.id },
        data: { status: "indexed" },
      });
    }

    // Le tenantId est OBLIGATOIRE - toujours retourné
    if (!tenant.id) {
      return res.status(500).json({
        error: "Erreur lors de la création du tenant. Veuillez réessayer.",
      });
    }

    return res.status(200).json({
      success: true,
      tenantId: tenant.id, // OBLIGATOIRE
      tenantName: tenant.name,
      sourceId: source.id,
      adminEmail,
      adminPassword,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
