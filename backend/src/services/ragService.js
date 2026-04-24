const { getPineconeIndex } = require("./pineconeClient");
const { getEmbeddings } = require("./googleAiService");

// Dimension attendue par l'index Pinecone.
// IMPORTANT : doit correspondre à la dimension configurée pour votre index.
// Par défaut : 768 (ancienne config), à adapter si vous recréez l'index.
const PINECONE_DIMENSION = Number(process.env.PINECONE_DIM || "768");

const findRelevantContext = async ({ tenantId, question, topK = 5 }) => {
  if (!tenantId || !question) {
    console.error(`[RAG] ⚠️ Paramètres manquants: tenantId=${tenantId}, question=${question ? "présent" : "absent"}`);
    return [];
  }

  // Vérification CRITIQUE: Le tenantId ne doit JAMAIS être vide ou invalide
  if (typeof tenantId !== "string" || tenantId.trim().length === 0) {
    console.error(`[RAG] ❌ ERREUR CRITIQUE: tenantId invalide (type: ${typeof tenantId}, valeur: "${tenantId}")`);
    return [];
  }

  try {
    console.log(`[RAG] Recherche contexte pour: "${question}"`);
    console.log(`[RAG] 🔍 TenantId utilisé comme namespace: ${tenantId}`);
    const rawVector = await getEmbeddings(question);
    
    // Vérification / adaptation de la dimension du vecteur de requête
    if (!rawVector || !Array.isArray(rawVector) || rawVector.length === 0) {
      console.error("[RAG] ❌ ERREUR: Vecteur de requête invalide (embedding vide)");
      return [];
    }

    let vector = rawVector;
    if (vector.length !== PINECONE_DIMENSION) {
      if (vector.length > PINECONE_DIMENSION) {
        console.warn(
          `[RAG] ⚠️ Vecteur de requête trop long (dimension=${vector.length}). Tronqué à ${PINECONE_DIMENSION} composantes.`
        );
        console.warn(
          `[RAG] ⚠️ ATTENTION: La troncature peut réduire la qualité des recherches.`
        );
        console.warn(
          `[RAG] 💡 Pour une meilleure qualité, configurez Pinecone avec dimension=${vector.length} et mettez PINECONE_DIM=${vector.length} dans .env`
        );
        vector = vector.slice(0, PINECONE_DIMENSION);
      } else {
        console.error(
          `[RAG] ❌ ERREUR: Vecteur de requête trop court (dimension=${vector.length}, attendu=${PINECONE_DIMENSION}).`
        );
        return [];
      }
    }

    const pinecone = getPineconeIndex();

    // Vérification: Le namespace doit être le tenantId exact
    const namespace = tenantId;
    if (!namespace || namespace.trim().length === 0) {
      console.error(`[RAG] ❌ ERREUR CRITIQUE: Namespace vide ou invalide (tenantId: ${tenantId})`);
      return [];
    }

    console.log(`[RAG] 🔍 Recherche dans Pinecone avec namespace="${namespace}"`);
    const query = await pinecone.namespace(namespace).query({
      vector,
      topK,
      includeMetadata: true,
    });

    const matches = query.matches || [];
    console.log(`[RAG] ${matches.length} résultats trouvés`);
    
    // CRITIQUE: Si aucun résultat trouvé, retourner un tableau vide immédiatement
    // L'IA ne doit PAS utiliser ses connaissances générales
    if (!matches || matches.length === 0) {
      console.log(`[RAG] ⚠️ Aucun résultat trouvé dans Pinecone pour tenantId=${tenantId}. Handoff requis.`);
      return [];
    }
    
    // Récupérer tous les chunks depuis la DB en une seule requête pour éviter les appels multiples
    const vectorIds = matches.map(m => m.id);
    const { prisma } = require("./prisma");
    const dbChunks = await prisma.rAGChunk.findMany({
      where: {
        tenantId,
        pineconeVectorId: { in: vectorIds },
      },
      select: { pineconeVectorId: true, content: true },
    });
    const chunkMap = new Map(dbChunks.map(c => [c.pineconeVectorId, c.content]));
    
    const contexts = matches
      .map((match, idx) => {
        const score = match.score || 0;
        const metadata = match.metadata || {};

        // Debug sur le premier match uniquement
        if (idx === 0) {
          console.log(`[RAG] Structure metadata (premier match):`, {
            keys: Object.keys(metadata),
            textType: typeof metadata.text,
            textValue:
              typeof metadata.text === "string"
                ? metadata.text.substring(0, 50)
                : String(metadata.text || "").substring(0, 50),
          });
        }

        const vectorId = match.id;
        // Source de vérité : contenu stocké dans la base (RAGChunk)
        let text = chunkMap.get(vectorId);

        // Si pas trouvé en DB (cas exceptionnel), essayer les métadonnées
        if (!text) {
          text = metadata.text || metadata.content || metadata.chunk || metadata.body;
        }

        // Normaliser en string
        if (text && typeof text !== "string") {
          text = String(text);
        }

        // Si encore vide ou "[object Object]", on ignore ce match
        if (!text || text.trim().length === 0 || text === "[object Object]") {
          console.log(
            `[RAG] Match ${idx + 1}: ignoré (texte invalide ou indisponible, vectorId=${vectorId})`
          );
          return null;
        }

        const preview = text.substring(0, 100);
        console.log(
          `[RAG] Match ${idx + 1}: score=${score.toFixed(3)}, texte utilisé="${preview}..."`
        );

        return text;
      })
      .filter((text) => typeof text === "string" && text.trim().length > 0);
    
    console.log(`[RAG] ${contexts.length} contextes valides extraits`);
    return contexts;
  } catch (error) {
    // Détecter le type d'erreur pour un meilleur diagnostic
    const isNetworkError = 
      error.message?.includes("timeout") || 
      error.message?.includes("Connect Timeout") ||
      error.message?.includes("fetch failed") ||
      error.code === "UND_ERR_CONNECT_TIMEOUT" ||
      error.name === "PineconeConnectionError";
    
    if (isNetworkError) {
      console.error(`[RAG] ⚠️ Erreur réseau/timeout Pinecone (peut être temporaire):`, error.message || error);
    } else {
      console.error(`[RAG] ❌ Erreur recherche contexte:`, error);
    }
    return [];
  }
};

module.exports = { findRelevantContext };
