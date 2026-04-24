const express = require("express");
const { prisma } = require("../services/prisma");
const { resolveTenantId } = require("../services/tenantContext");
const { createSocialPost, publishSocialPostNow } = require("../services/socialPostService");

const router = express.Router();

// Liste des annonces du tenant (les plus récentes d'abord)
router.get("/social-posts", async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant introuvable." });
    }

    const posts = await prisma.socialPost.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { targets: true },
    });

    return res.status(200).json({ data: posts });
  } catch (error) {
    return next(error);
  }
});

// Création d'une annonce (brouillon ou directement prête à être publiée)
router.post("/social-posts", async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant introuvable." });
    }

    const { title, body, mediaUrls, networks, scheduledAt, publishNow } = req.body || {};

    if (!body || !String(body).trim()) {
      return res.status(400).json({ error: "Le contenu de l'annonce (body) est requis." });
    }

    const post = await createSocialPost({
      tenantId,
      title: title || null,
      body: String(body),
      mediaUrls: Array.isArray(mediaUrls) ? mediaUrls : [],
      networks:
        Array.isArray(networks) && networks.length > 0
          ? networks
          : ["FACEBOOK"],
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    });

    let publishResult = null;
    if (publishNow) {
      publishResult = await publishSocialPostNow({ tenantId, postId: post.id });
    }

    return res.status(201).json({ data: post, publishResult });
  } catch (error) {
    return next(error);
  }
});

// Récupération d'une annonce spécifique
router.get("/social-posts/:id", async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant introuvable." });
    }

    const postId = req.params.id;
    const post = await prisma.socialPost.findFirst({
      where: { id: postId, tenantId },
      include: { targets: true },
    });

    if (!post) {
      return res.status(404).json({ error: "Annonce introuvable." });
    }

    return res.status(200).json({ data: post });
  } catch (error) {
    return next(error);
  }
});

// Mise à jour d'une annonce (édition de brouillon)
router.patch("/social-posts/:id", async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant introuvable." });
    }

    const postId = req.params.id;
    const { title, body, mediaUrls, networks, scheduledAt } = req.body || {};

    // Vérifier que l'annonce existe et appartient au tenant
    const existingPost = await prisma.socialPost.findFirst({
      where: { id: postId, tenantId },
    });

    if (!existingPost) {
      return res.status(404).json({ error: "Annonce introuvable." });
    }

    // Ne permettre l'édition que si l'annonce est en brouillon ou programmée
    if (existingPost.status === "published" || existingPost.status === "publishing") {
      return res.status(400).json({
        error: "Impossible de modifier une annonce déjà publiée ou en cours de publication.",
      });
    }

    // Mettre à jour l'annonce
    const updateData = {};
    if (title !== undefined) updateData.title = title || null;
    if (body !== undefined) {
      if (!body || !String(body).trim()) {
        return res.status(400).json({ error: "Le contenu de l'annonce (body) est requis." });
      }
      updateData.body = String(body).trim();
    }
    if (mediaUrls !== undefined) updateData.mediaUrls = Array.isArray(mediaUrls) ? mediaUrls : [];
    if (scheduledAt !== undefined) {
      updateData.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
      updateData.status = scheduledAt ? "scheduled" : "draft";
    }

    // Mettre à jour les cibles si networks est fourni
    if (networks !== undefined && Array.isArray(networks) && networks.length > 0) {
      // Supprimer les anciennes cibles
      await prisma.socialPostTarget.deleteMany({
        where: { postId },
      });

      // Créer les nouvelles cibles
      await prisma.socialPostTarget.createMany({
        data: networks.map((network) => ({
          postId,
          network,
          status: "pending",
        })),
      });
    }

    const updatedPost = await prisma.socialPost.update({
      where: { id: postId },
      data: updateData,
      include: { targets: true },
    });

    return res.status(200).json({ data: updatedPost });
  } catch (error) {
    return next(error);
  }
});

// Publication manuelle d'une annonce existante
router.post("/social-posts/:id/publish", async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant introuvable." });
    }

    const postId = req.params.id;
    const result = await publishSocialPostNow({ tenantId, postId });

    return res.status(200).json({ data: result.post, results: result.results });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

