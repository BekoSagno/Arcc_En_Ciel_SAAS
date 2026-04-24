/**
 * Route de test pour vérifier le fonctionnement du RAG
 * Accessible uniquement en développement
 */

const express = require("express");
const { resolveTenantId } = require("../services/tenantContext");
const { prisma } = require("../services/prisma");
const { findRelevantContext } = require("../services/ragService");
const { generateAnswer } = require("../services/aiService");

const router = express.Router();

// Route de test pour vérifier le RAG
router.get("/test-rag/status", async (req, res) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant introuvable." });
    }

    // Compter les sources
    const sourcesCount = await prisma.rAGSource.count({
      where: { tenantId },
    });

    const indexedCount = await prisma.rAGSource.count({
      where: { tenantId, status: "indexed" },
    });

    const chunksCount = await prisma.rAGChunk.count({
      where: { tenantId },
    });

    return res.status(200).json({
      tenantId,
      sources: {
        total: sourcesCount,
        indexed: indexedCount,
        chunks: chunksCount,
      },
      status: indexedCount > 0 ? "ready" : "no_data",
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Route de test pour tester une question
router.post("/test-rag/query", async (req, res) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant introuvable." });
    }

    const { question } = req.body || {};
    if (!question) {
      return res.status(400).json({ error: "Question requise." });
    }

    // Vérifier qu'il y a des données indexées
    const indexedCount = await prisma.rAGSource.count({
      where: { tenantId, status: "indexed" },
    });

    if (indexedCount === 0) {
      return res.status(400).json({
        error: "Aucune source indexée. Uploadez d'abord des documents.",
      });
    }

    // Rechercher le contexte
    const context = await findRelevantContext({
      tenantId,
      question,
      topK: 5,
    });

    // Log pour debug
    console.log(`[TEST-RAG] Question: "${question}"`);
    console.log(`[TEST-RAG] Contexte trouvé: ${context.length} extraits`);
    if (context.length > 0) {
      console.log(`[TEST-RAG] Premier extrait: ${context[0]?.substring(0, 100)}...`);
    }

    // Générer la réponse
    const answer = await generateAnswer({
      question,
      context,
      tenant: {
        id: tenantId,
      },
    });

    return res.status(200).json({
      question,
      answer: answer.text,
      context: context, // Déjà un tableau de strings
      contextCount: context.length,
      sourcesIndexed: indexedCount,
    });
  } catch (error) {
    console.error("[TEST-RAG] Erreur:", error);
    return res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

module.exports = router;
