/**
 * Liste les modeles Gemini disponibles pour generateContent.
 */

require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listModels() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY manquant.");
  }

  new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
  );
  if (!response.ok) {
    throw new Error(`Erreur API Gemini: ${response.status}`);
  }
  const data = await response.json();
  const models = data.models || [];

  const supported = models.filter((model) =>
    (model.supportedGenerationMethods || []).includes("generateContent")
  );

  console.log("Modeles compatibles generateContent:");
  supported.forEach((model) => {
    console.log(`- ${model.name}`);
  });
}

listModels().catch((error) => {
  console.error("Erreur liste modeles:", error.message);
});
