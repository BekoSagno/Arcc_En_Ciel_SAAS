const cheerio = require("cheerio");
const { prisma } = require("./prisma");
const { getEmbeddings } = require("./googleAiService");
const { getPineconeIndex } = require("./pineconeClient");

// Dimension attendue par l'index Pinecone.
// IMPORTANT : doit correspondre à la dimension configurée pour votre index.
// Par défaut : 768 (ancienne config), à adapter si vous recréez l'index.
const PINECONE_DIMENSION = Number(process.env.PINECONE_DIM || "768");

// Import de pdf-parse - dans v2.x, PDFParse est une classe
const pdfParseModule = require("pdf-parse");
const PDFParse = pdfParseModule.PDFParse;

if (!PDFParse || typeof PDFParse !== "function") {
  throw new Error("PDFParse n'est pas disponible dans le module pdf-parse");
}

// Créer une fonction wrapper qui utilise la classe PDFParse
// La classe a une méthode getText() qui extrait le texte (async)
// IMPORTANT: pdf-parse v2.x attend un Uint8Array, pas un Buffer
const pdfParse = async (uint8Array, options = {}) => {
  // S'assurer qu'on a un Uint8Array
  const data = uint8Array instanceof Uint8Array 
    ? uint8Array 
    : new Uint8Array(uint8Array);
  
  const parser = new PDFParse(data, options);
  // Charger le PDF
  await parser.load();
  // getText() est une fonction asynchrone, il faut l'attendre
  const text = await parser.getText();
  
  // S'assurer que text est une chaîne de caractères
  const textString = typeof text === "string" ? text : String(text || "");
  
  return { text: textString };
};

const chunkText = (text, size = 800, overlap = 100) => {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }
    start += size - overlap;
  }

  return chunks;
};

const extractTextFromUrl = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Impossible de recuperer l'URL.");
  }
  const html = await response.text();
  const $ = cheerio.load(html);
  $("script,style,noscript").remove();
  return $("body").text().replace(/\s+/g, " ").trim();
};

const extractTextFromPdf = async (buffer) => {
  try {
    if (!buffer) {
      throw new Error("Buffer invalide pour l'extraction PDF");
    }
    
    // pdf-parse v2.x attend un Uint8Array, pas un Buffer
    // Convertir le Buffer en Uint8Array si nécessaire
    let uint8Array;
    if (Buffer.isBuffer(buffer)) {
      uint8Array = new Uint8Array(buffer);
    } else if (buffer instanceof Uint8Array) {
      uint8Array = buffer;
    } else {
      // Essayer de convertir en Buffer puis en Uint8Array
      const buf = Buffer.from(buffer);
      uint8Array = new Uint8Array(buf);
    }
    
    // Vérifier que pdfParse est bien une fonction
    if (typeof pdfParse !== "function") {
      throw new Error(`pdfParse n'est pas une fonction. Type: ${typeof pdfParse}`);
    }
    
    const data = await pdfParse(uint8Array);
    
    if (!data || !data.text) {
      throw new Error("Aucun texte extrait du PDF");
    }
    
    // S'assurer que data.text est une chaîne avant d'appeler replace
    const text = typeof data.text === "string" ? data.text : String(data.text || "");
    
    return text.replace(/\s+/g, " ").trim();
  } catch (error) {
    console.error("[RAG] Erreur extraction PDF:", error.message);
    throw new Error(`Erreur lors de l'extraction du PDF: ${error.message}`);
  }
};

const ingestSource = async ({ tenantId, sourceId, namespace, content }) => {
  // Vérification CRITIQUE: Le tenantId et namespace ne doivent JAMAIS être vides
  if (!tenantId || typeof tenantId !== "string" || tenantId.trim().length === 0) {
    throw new Error(`[RAG] ❌ ERREUR CRITIQUE: tenantId invalide (${tenantId})`);
  }
  if (!namespace || typeof namespace !== "string" || namespace.trim().length === 0) {
    throw new Error(`[RAG] ❌ ERREUR CRITIQUE: namespace invalide (${namespace}). Le namespace doit être le tenantId.`);
  }
  if (namespace !== tenantId) {
    console.warn(`[RAG] ⚠️ ATTENTION: namespace (${namespace}) différent de tenantId (${tenantId}). Utilisation du tenantId comme namespace.`);
    namespace = tenantId;
  }

  console.log(`[RAG] Début ingestion - tenantId: ${tenantId}, namespace: ${namespace}, content length: ${content.length}`);
  
  const chunks = chunkText(content);
  if (!chunks.length) {
    console.log(`[RAG] Aucun chunk généré`);
    return [];
  }

  console.log(`[RAG] ${chunks.length} chunks générés, génération des embeddings...`);
  
  try {
    // Traitement par batch de 5 pour éviter de surcharger l'API Gemini
    const BATCH_SIZE = 5;
    const vectors = [];
    
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      console.log(`[RAG] Traitement batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)} (${batch.length} chunks)`);
      
      const batchVectors = await Promise.all(
        batch.map(async (chunk, batchIndex) => {
          const globalIndex = i + batchIndex;
          try {
            console.log(`[RAG] Génération embedding ${globalIndex + 1}/${chunks.length}`);
            return await getEmbeddings(chunk);
          } catch (err) {
            console.error(`[RAG] ❌ Erreur embedding chunk ${globalIndex + 1}:`, err.message);
            console.error(`[RAG] Stack:`, err.stack);
            
            // Si c'est une erreur de connexion ou d'API, donner plus de détails
            if (err.message.includes("fetch failed") || err.message.includes("ECONNREFUSED")) {
              console.error(`[RAG] 🚨 PROBLÈME DE CONNEXION À L'API GEMINI !`);
              console.error(`[RAG] 💡 Vérifie:`);
              console.error(`[RAG]    1. Ta connexion internet`);
              console.error(`[RAG]    2. Que GEMINI_API_KEY est valide dans .env`);
              console.error(`[RAG]    3. Que l'API Gemini est accessible`);
            } else if (err.message.includes("API key") || err.message.includes("401") || err.message.includes("403")) {
              console.error(`[RAG] 🚨 CLÉ API GEMINI INVALIDE !`);
              console.error(`[RAG] 💡 Vérifie GEMINI_API_KEY dans .env`);
            } else if (err.message.includes("quota") || err.message.includes("429")) {
              console.error(`[RAG] 🚨 QUOTA GEMINI DÉPASSÉ !`);
              console.error(`[RAG] 💡 Vérifie ton quota dans Google AI Studio`);
            }
            
            throw err;
          }
        })
      );
      
      vectors.push(...batchVectors);
      
      // Petite pause entre les batches pour éviter les rate limits
      if (i + BATCH_SIZE < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`[RAG] Embeddings générés, connexion à Pinecone...`);
    
    // Vérification CRITIQUE: La dimension des embeddings
    if (vectors.length > 0) {
      const firstVectorDimension = vectors[0].length;
      console.log(
        `[RAG] 🔍 Dimension des embeddings: ${firstVectorDimension} (dimension attendue par Pinecone: ${PINECONE_DIMENSION})`
      );
      
      // Vérifier que tous les vecteurs ont la même dimension
      const inconsistentVectors = vectors.filter((v) => v.length !== firstVectorDimension);
      if (inconsistentVectors.length > 0) {
        throw new Error(
          `[RAG] ❌ ERREUR: Dimensions incohérentes. Premier vecteur: ${firstVectorDimension}, ${inconsistentVectors.length} vecteurs avec des dimensions différentes.`
        );
      }
      
      // Avertissement si la dimension ne correspond pas à celle de l'index
      if (firstVectorDimension !== PINECONE_DIMENSION) {
        console.warn(
          `[RAG] ⚠️ ATTENTION: Dimension ${firstVectorDimension} alors que l'index Pinecone est configuré pour ${PINECONE_DIMENSION}.`
        );
        console.warn(
          `[RAG] ⚠️ Les vecteurs seront adaptés (tronqués ou complétés) pour correspondre à ${PINECONE_DIMENSION}.`
        );
      } else {
        console.log(
          `[RAG] ✅ Dimension ${PINECONE_DIMENSION} confirmée (compatible avec l'index Pinecone).`
        );
      }
    }
    
    const pinecone = getPineconeIndex();

    const records = chunks.map((chunk, index) => {
      // S'assurer que chunk est bien une string
      const chunkText = typeof chunk === "string" ? chunk : String(chunk || "");
      
      // Vérifier / adapter le vecteur à la bonne dimension
      let vector = vectors[index];
      if (!vector || !Array.isArray(vector) || vector.length === 0) {
        throw new Error(`[RAG] ❌ ERREUR: Vecteur invalide pour le chunk ${index}`);
      }
      
      if (vector.length !== PINECONE_DIMENSION) {
        if (vector.length > PINECONE_DIMENSION) {
          console.warn(
            `[RAG] ⚠️ Vecteur trop long pour le chunk ${index} (dimension=${vector.length}). Tronqué à ${PINECONE_DIMENSION} composantes.`
          );
          console.warn(
            `[RAG] ⚠️ ATTENTION: La troncature peut réduire la qualité des recherches.`
          );
          console.warn(
            `[RAG] 💡 Pour une meilleure qualité, configurez Pinecone avec dimension=${vector.length} et mettez PINECONE_DIM=${vector.length} dans .env`
          );
          vector = vector.slice(0, PINECONE_DIMENSION);
        } else {
          // Si le vecteur est plus court que la dimension de l'index, on lève une erreur explicite
          throw new Error(
            `[RAG] ❌ ERREUR: Vecteur trop court pour le chunk ${index} (dimension=${vector.length}, attendu=${PINECONE_DIMENSION}).`
          );
        }
      }
      
      // S'assurer que toutes les métadonnées sont des types primitifs (Pinecone requirement)
      return {
        id: `${sourceId}-${index}`,
        values: vector,
        metadata: {
          tenantId: String(tenantId),
          sourceId: String(sourceId),
          order: Number(index),
          text: chunkText, // String garantie
        },
      };
    });

    console.log(`[RAG] Upsert de ${records.length} vecteurs dans Pinecone...`);
    console.log(`[RAG] 🔍 Namespace utilisé pour l'upsert: ${namespace} (tenantId: ${tenantId})`);
    
    // Vérification finale: Le namespace doit être le tenantId
    if (namespace !== tenantId) {
      throw new Error(`[RAG] ❌ ERREUR CRITIQUE: Le namespace (${namespace}) doit être identique au tenantId (${tenantId})`);
    }
    
    await pinecone.namespace(namespace).upsert(records);
    console.log(`[RAG] ✅ Upsert terminé avec succès dans namespace="${namespace}"`);
  } catch (error) {
    console.error(`[RAG] Erreur lors de l'ingestion:`, error);
    throw error;
  }

  const createdChunks = await prisma.rAGChunk.createMany({
    data: chunks.map((chunk, index) => ({
      tenantId,
      sourceId,
      pineconeNamespace: namespace,
      pineconeVectorId: `${sourceId}-${index}`,
      content: chunk,
      metadata: { order: index },
    })),
  });

  return createdChunks;
};

module.exports = {
  chunkText,
  extractTextFromUrl,
  extractTextFromPdf,
  ingestSource,
};
