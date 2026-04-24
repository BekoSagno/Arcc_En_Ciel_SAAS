const express = require("express");
const multer = require("multer");
const { prisma } = require("../services/prisma");
const { resolveTenantId } = require("../services/tenantContext");
const {
  extractTextFromUrl,
  extractTextFromPdf,
  ingestSource,
} = require("../services/ragIngestor");
const {
  learnFromConversation,
  learnFromRecentConversations,
} = require("../services/conversationLearner");

const router = express.Router();
const upload = multer();

const validateRagConfig = () => {
  const missing = [];
  if (!process.env.GEMINI_API_KEY) missing.push("GEMINI_API_KEY");
  if (!process.env.PINECONE_API_KEY) missing.push("PINECONE_API_KEY");
  if (!process.env.PINECONE_INDEX) missing.push("PINECONE_INDEX");
  return missing;
};

router.get("/rag/sources", async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant introuvable." });
    }

    const sources = await prisma.rAGSource.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: {
          select: { chunks: true },
        },
      },
    });

    // Récupérer tous les chunks du tenant en une seule requête pour optimiser
    const allChunks = await prisma.rAGChunk.findMany({
      where: { tenantId },
      select: { sourceId: true, content: true },
    });

    // Grouper les chunks par sourceId et calculer les statistiques
    const chunksBySource = allChunks.reduce((acc, chunk) => {
      if (!acc[chunk.sourceId]) {
        acc[chunk.sourceId] = [];
      }
      acc[chunk.sourceId].push(chunk);
      return acc;
    }, {});

    // Calculer les statistiques pour chaque source (chunks + tokens estimés)
    const sourcesWithStats = sources.map((source) => {
      const chunkCount = source._count.chunks;
      const chunks = chunksBySource[source.id] || [];
      
      // Estimer les tokens : longueur totale du contenu des chunks
      // Estimation standard : 1 token ≈ 4 caractères
      const totalChars = chunks.reduce((sum, chunk) => sum + (chunk.content?.length || 0), 0);
      const estimatedTokens = Math.ceil(totalChars / 4);

      return {
        id: source.id,
        title: source.title,
        type: source.type,
        status: source.status,
        sourceUrl: source.sourceUrl,
        createdAt: source.createdAt,
        updatedAt: source.updatedAt,
        tenantId: source.tenantId,
        stats: {
          chunkCount,
          estimatedTokens,
        },
      };
    });

    return res.status(200).json({ data: sourcesWithStats });
  } catch (error) {
    return next(error);
  }
});

router.get("/rag/chunks", async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant introuvable." });
    }

    const query = req.query.q;
    const limit = Number(req.query.limit || 20);

    if (query) {
      const missing = validateRagConfig();
      if (missing.length) {
        return res.status(400).json({
          error: `Configuration RAG incomplète: ${missing.join(", ")}`,
        });
      }
      const { findRelevantContext } = require("../services/ragService");
      const { getPineconeIndex } = require("../services/pineconeClient");
      const { embedTexts } = require("../services/embeddingService");

      const vector = (await embedTexts([String(query)]))[0];
      const pinecone = getPineconeIndex();
      const result = await pinecone.namespace(tenantId).query({
        vector,
        topK: Math.min(limit, 50),
        includeMetadata: true,
      });

      const matches = result.matches || [];
      const sourceIds = [
        ...new Set(
          matches
            .map((match) => match.metadata?.sourceId)
            .filter((id) => typeof id === "string")
        ),
      ];
      const sources = await prisma.rAGSource.findMany({
        where: { id: { in: sourceIds } },
        select: { id: true, title: true, type: true },
      });
      const sourceMap = new Map(sources.map((s) => [s.id, s]));

      // Récupérer les chunks depuis la DB pour avoir le contenu correct
      const vectorIds = matches.map(m => m.id);
      const dbChunks = await prisma.rAGChunk.findMany({
        where: {
          tenantId,
          pineconeVectorId: { in: vectorIds },
        },
        select: { pineconeVectorId: true, content: true },
      });
      const chunkMap = new Map(dbChunks.map(c => [c.pineconeVectorId, c.content]));

      const data = matches.map((match) => {
        // Essayer de récupérer le texte depuis les métadonnées
        let content = match.metadata?.text;
        
        // Si content est un objet ou invalide, récupérer depuis la DB
        if (!content || typeof content !== "string" || content === "[object Object]") {
          content = chunkMap.get(match.id) || "";
        }
        
        // S'assurer que content est une string
        if (content && typeof content !== "string") {
          content = String(content);
        }
        
        return {
          id: match.id,
          score: match.score ?? null,
          content: content || "",
          sourceId: match.metadata?.sourceId || null,
          sourceTitle: sourceMap.get(match.metadata?.sourceId || "")?.title || "",
          sourceType: sourceMap.get(match.metadata?.sourceId || "")?.type || "",
        };
      });

      return res.status(200).json({ data, mode: "search" });
    }

    const chunks = await prisma.rAGChunk.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 100),
      include: { source: true },
    });

    return res.status(200).json({
      data: chunks.map((chunk) => ({
        id: chunk.id,
        score: null,
        content: chunk.content,
        sourceId: chunk.sourceId,
        sourceTitle: chunk.source?.title || "",
        sourceType: chunk.source?.type || "",
        createdAt: chunk.createdAt,
      })),
      mode: "latest",
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/rag/sources", upload.single("file"), async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant introuvable." });
    }

    const missing = validateRagConfig();
    if (missing.length) {
      return res.status(400).json({
        error: `Configuration RAG incomplète: ${missing.join(", ")}`,
      });
    }

    const { type, title, sourceUrl, text } = req.body || {};
    if (!type || !title) {
      return res.status(400).json({ error: "Type et titre requis." });
    }

    const source = await prisma.rAGSource.create({
      data: {
        tenantId,
        type,
        title,
        sourceUrl: sourceUrl || null,
        status: "processing",
      },
    });

    let content = "";
    if (type === "URL") {
      if (!sourceUrl) {
        return res.status(400).json({ error: "Lien requis." });
      }
      content = await extractTextFromUrl(sourceUrl);
    } else if (type === "TEXT") {
      if (!text) {
        return res.status(400).json({ error: "Texte requis." });
      }
      content = text || "";
    } else if (type === "PDF") {
      if (!req.file?.buffer) {
        return res.status(400).json({ error: "Fichier PDF requis." });
      }
      try {
        content = await extractTextFromPdf(req.file.buffer);
        if (!content || content.trim().length === 0) {
          throw new Error("Le PDF ne contient pas de texte extractible");
        }
      } catch (pdfError) {
        console.error("[RAG] Erreur extraction PDF:", pdfError);
        await prisma.rAGSource.update({
          where: { id: source.id },
          data: { status: "failed" },
        });
        return res.status(500).json({ 
          error: `Erreur lors de l'extraction du PDF: ${pdfError.message}` 
        });
      }
    }

    const namespace = tenantId;
    try {
      await ingestSource({
        tenantId,
        sourceId: source.id,
        namespace,
        content,
      });
    } catch (error) {
      console.error("[RAG] ❌ Erreur lors de l'ingestion:", error.message);
      console.error("[RAG] Stack:", error.stack);
      
      await prisma.rAGSource.update({
        where: { id: source.id },
        data: { status: "failed" },
      });
      
      // Améliorer le message d'erreur pour l'utilisateur
      let errorMessage = error.message;
      if (error.message.includes("fetch failed") || error.message.includes("Connexion échouée") || error.message.includes("Timeout")) {
        errorMessage = "Impossible de se connecter à l'API Gemini. Vérifiez votre connexion internet et que GEMINI_API_KEY est valide dans .env.";
      } else if (error.message.includes("embedding")) {
        errorMessage = `Erreur lors de la génération des embeddings: ${error.message}`;
      }
      
      throw new Error(errorMessage);
    }

    const updated = await prisma.rAGSource.update({
      where: { id: source.id },
      data: { status: "indexed" },
    });

    return res.status(201).json({ data: updated });
  } catch (error) {
    return next(error);
  }
});

// Suppression d'une source et de ses vecteurs/chunks associés pour un tenant
router.delete("/rag/sources/:id", async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant introuvable." });
    }

    const sourceId = req.params.id;
    const source = await prisma.rAGSource.findFirst({
      where: { id: sourceId, tenantId },
    });

    if (!source) {
      return res.status(404).json({ error: "Source introuvable pour ce tenant." });
    }

    const chunks = await prisma.rAGChunk.findMany({
      where: { tenantId, sourceId: source.id },
      select: { pineconeNamespace: true, pineconeVectorId: true },
    });

    if (chunks.length > 0) {
      const { getPineconeIndex } = require("../services/pineconeClient");
      const pinecone = getPineconeIndex();

      const byNamespace = new Map();
      for (const chunk of chunks) {
        const ns = chunk.pineconeNamespace || tenantId;
        if (!byNamespace.has(ns)) {
          byNamespace.set(ns, []);
        }
        byNamespace.get(ns).push(chunk.pineconeVectorId);
      }

      for (const [namespace, ids] of byNamespace.entries()) {
        if (!ids.length) continue;
        console.log(
          `[RAG] Suppression de ${ids.length} vecteurs dans Pinecone pour namespace=${namespace}, source=${source.id}`
        );
        try {
          await pinecone.namespace(namespace).deleteMany({ ids });
        } catch (err) {
          console.error(
            "[RAG] Erreur lors de la suppression des vecteurs dans Pinecone:",
            err
          );
        }
      }
    }

    await prisma.rAGChunk.deleteMany({
      where: { tenantId, sourceId: source.id },
    });

    await prisma.rAGSource.delete({
      where: { id: source.id },
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.post("/rag/query", async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant introuvable." });
    }

    const missing = validateRagConfig();
    if (missing.length) {
      return res.status(400).json({
        error: `Configuration RAG incomplète: ${missing.join(", ")}`,
      });
    }

    const { question } = req.body || {};
    if (!question) {
      return res.status(400).json({ error: "Question requise." });
    }

    const context = await require("../services/ragService").findRelevantContext({
      tenantId,
      question,
      topK: 5,
    });
    const answer = await require("../services/aiService").generateAnswer({
      question,
      context,
      tenant: {
        id: tenantId,
      },
    });

    return res.status(200).json({ data: { answer: answer.text, context } });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
