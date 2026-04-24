const { Pinecone } = require("@pinecone-database/pinecone");

const getPineconeIndex = () => {
  const apiKey = process.env.PINECONE_API_KEY;
  const indexName = process.env.PINECONE_INDEX;
  const host = process.env.PINECONE_HOST;

  if (!apiKey || !indexName) {
    console.error("[PINECONE] Configuration manquante:", { 
      hasApiKey: !!apiKey, 
      hasIndexName: !!indexName,
      hasHost: !!host 
    });
    throw new Error("Pinecone non configure. Vérifiez PINECONE_API_KEY et PINECONE_INDEX dans .env");
  }

  try {
    const client = new Pinecone({ apiKey });
    const index = host ? client.index(indexName, host) : client.index(indexName);
    console.log(`[PINECONE] Connexion établie - Index: ${indexName}, Host: ${host || "default"}`);
    return index;
  } catch (error) {
    console.error("[PINECONE] Erreur de connexion:", error.message);
    throw error;
  }
};

module.exports = { getPineconeIndex };
