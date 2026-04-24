const axios = require("axios");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const { PassThrough } = require("stream");

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
} else {
  console.warn("[AUDIO] ffmpeg-static introuvable, la conversion pourrait échouer.");
}

const apiKey = process.env.GEMINI_API_KEY;

/**
 * Convertit un buffer audio (ogg/opus) en WAV pour une meilleure compatibilité STT.
 */
async function convertToWav(buffer, mimeType = "audio/ogg") {
  return new Promise((resolve, reject) => {
    const input = new PassThrough();
    input.end(buffer);

    const output = new PassThrough();
    const chunks = [];
    output.on("data", (chunk) => chunks.push(chunk));
    output.on("end", () => resolve(Buffer.concat(chunks)));
    output.on("error", reject);

    const cmd = ffmpeg(input);
    if (mimeType.includes("ogg") || mimeType.includes("opus")) {
      cmd.inputFormat("ogg");
    }

    cmd
      .audioCodec("pcm_s16le")
      .format("wav")
      .on("error", reject)
      .pipe(output, { end: true });
  });
}


/**
 * Transcrit un buffer audio via Gemini (appel REST direct) et détecte la langue.
 * Retourne { text, language }
 * Utilise l'endpoint v1beta avec logique de fallback sur plusieurs variantes de modèles.
 * Accepte soit un Buffer, soit une chaîne base64 directement.
 */
async function transcribeAndAnalyze(bufferOrBase64, mimeType = "audio/ogg") {
  // Gérer l'entrée : peut être un Buffer ou une chaîne base64
  let audioBase64;
  let workingMime = mimeType || "audio/ogg";
  
  if (Buffer.isBuffer(bufferOrBase64)) {
    // C'est un Buffer, on le convertit en base64
    if (!bufferOrBase64 || bufferOrBase64.length === 0) {
      console.warn("[AUDIO] Buffer vide ou invalide");
      return { text: "", language: "unknown" };
    }
    audioBase64 = bufferOrBase64.toString("base64");
  } else if (typeof bufferOrBase64 === "string") {
    // C'est déjà une chaîne base64
    if (!bufferOrBase64 || bufferOrBase64.length === 0) {
      console.warn("[AUDIO] Chaîne base64 vide ou invalide");
      return { text: "", language: "unknown" };
    }
    audioBase64 = bufferOrBase64;
  } else {
    console.warn("[AUDIO] Type d'entrée invalide (attendu: Buffer ou string base64)");
    return { text: "", language: "unknown" };
  }
  
  if (!apiKey) {
    console.warn("[AUDIO] GEMINI_API_KEY manquant, transcription impossible.");
    return { text: "", language: "unknown" };
  }

  // Normaliser le mimeType
  if (workingMime === "audio/ogg; codecs=opus") {
    workingMime = "audio/ogg";
  }

  // Liste des modèles à tester par ordre de probabilité de succès
  // On commence par gemini-flash-latest (sans "1.5") car c'est ce qui fonctionne pour le texte
  const modelVariants = [
    "gemini-flash-latest",        // Priorité : même modèle que pour le texte
    "gemini-1.5-flash-latest",    // Fallback 1
    "gemini-1.5-flash",           // Fallback 2
    "gemini-1.5-flash-002"        // Fallback 3
  ];

  // Liste des versions d'API à tester (v1beta en priorité comme demandé, puis v1 en fallback)
  const apiVersions = ["v1beta", "v1"];

  // Tester chaque version d'API et chaque modèle jusqu'à trouver celui qui fonctionne
  for (const apiVersion of apiVersions) {
    for (const modelName of modelVariants) {
      try {
        console.log(`[AUDIO] Tentative de transcription avec : ${apiVersion}/${modelName}...`);

        const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent?key=${apiKey}`;
      
      const response = await axios.post(url, {
        contents: [{
          parts: [
            { 
              text: "Transcris cet audio WhatsApp intégralement et détecte la langue. Réponds UNIQUEMENT en JSON : {\"transcription\": \"...\", \"language\": \"français\" ou \"autre\"}" 
            },
          {
            inlineData: {
                mimeType: workingMime, 
                data: audioBase64 
              } 
            }
          ]
        }]
      }, {
        headers: { 
          'Content-Type': 'application/json' 
        },
        timeout: 60000 // 60 secondes timeout
      });

      const resultText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      console.log(`[AUDIO] Réponse brute Gemini (${apiVersion}/${modelName}):`, resultText);

      // Extraire le JSON de la réponse
      const jsonMatch = resultText.match(/\{[\s\S]*\}/s);
      
      if (jsonMatch) {
        let parsed = {};
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.warn(`[AUDIO] Impossible de parser le JSON pour ${modelName}, utilisation du texte brut`);
          parsed = { transcription: resultText || "", language: "unknown" };
        }

        const transcription = parsed.transcription || parsed.text || "";
        let language = parsed.language || "unknown";
        
        // Normaliser la langue : "français" -> "fr", "autre" -> "unknown"
        if (language.toLowerCase() === "français" || language.toLowerCase() === "francais") {
          language = "fr";
        } else if (language.toLowerCase() === "autre") {
          language = "unknown";
        }

        const result = {
          text: transcription,
          language: language
        };

        console.log(`[AUDIO] ✅ SUCCÈS avec ${apiVersion}/${modelName}`);
        console.log("[AUDIO] Résultat :", result);
        return result;
      } else {
        console.warn(`[AUDIO] ⚠️ Aucun JSON trouvé dans la réponse pour ${apiVersion}/${modelName}`);
        // On continue vers le modèle suivant
        continue;
      }
      } catch (error) {
        const errorMsg = error.response?.data?.error?.message || error.message;
        const statusCode = error.response?.status;
        console.warn(`[AUDIO] ⚠️ Échec avec ${apiVersion}/${modelName} (${statusCode || 'N/A'}): ${errorMsg}`);
        
        // Si c'est un 404, on continue la boucle vers le modèle suivant
        // Pour les autres erreurs (timeout, etc.), on continue aussi
        continue;
      }
    }
  }

  // Si on arrive ici, tous les modèles ont échoué
  console.error("[AUDIO] ❌ Tous les modèles Gemini ont échoué (404 ou autre).");
  return { text: "", language: "erreur" };
}

/**
 * Alias pour compatibilité avec le code existant
 * @deprecated Utiliser transcribeAndAnalyze à la place
 */
async function transcribeAudio(buffer, mimeType = "audio/ogg") {
  return transcribeAndAnalyze(buffer, mimeType);
}

module.exports = {
  transcribeAudio,
  transcribeAndAnalyze,
  convertToWav,
};
