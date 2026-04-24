const express = require("express");
const { prisma } = require("../services/prisma");

const router = express.Router();

router.post("/headers", (req, res) => {
  return res.status(200).json({ headers: req.headers });
});

// Liste les boutiques (tenants) avec leurs numéros WhatsApp Business
// et les numéros de test (TestNumberMapping)
router.get("/debug/tenants/numbers", async (req, res, next) => {
  try {
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        channelIdentities: {
          select: {
            channel: true,
            externalId: true,
            label: true,
          },
        },
        testNumberMappings: {
          select: {
            senderPhoneNumber: true,
            isActive: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const data = tenants.map((t) => ({
      tenantId: t.id,
      boutique: t.name,
      whatsappNumbers: t.channelIdentities
        .filter((ci) => ci.channel === "WHATSAPP")
        .map((ci) => ({
          number: ci.externalId,
          label: ci.label,
        })),
      testNumbers: t.testNumberMappings.map((m) => ({
        number: m.senderPhoneNumber,
        isActive: m.isActive,
      })),
    }));

    return res.status(200).json({ data });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
