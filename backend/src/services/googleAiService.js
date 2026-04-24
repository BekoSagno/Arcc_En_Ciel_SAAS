/**
 * ARCC EN CIEL - SERVICE GOOGLE AI
 * Remplace OpenAI par Gemini pour un usage 100% Gratuit (Modele Flash)
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();
const { HANDOFF_MESSAGE } = require("./messageProcessor");

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("GEMINI_API_KEY manquant.");
}

const genAI = new GoogleGenerativeAI(apiKey);
// Modèle d'embedding Gemini - on force text-embedding-004 avec dimension 768
const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || "text-embedding-004";
console.log(`[GEMINI] Modèle d'embedding utilisé: ${EMBED_MODEL} (dimension forcée: 768)`);
const chatModelName =
  process.env.GEMINI_CHAT_MODEL || "gemini-1.5-flash-latest";

/**
 * 1. Genere des vecteurs (Embeddings) a partir d'un texte
 * Utilise le modèle text-embedding-004 avec outputDimensionality=768
 * afin de correspondre exactement à la dimension attendue par Pinecone.
 */
const getEmbeddings = async (text) => {
  try {
    // Vérifier et convertir en string si nécessaire
    let textString;
    if (typeof text === "string") {
      textString = text;
    } else if (text && typeof text === "object") {
      textString = JSON.stringify(text);
      console.warn(`[GEMINI] ⚠️ Reçu un objet au lieu d'une string, conversion en JSON`);
    } else {
      textString = String(text || "");
    }
    
    if (!textString || textString.trim().length === 0) {
      throw new Error("Texte vide ou invalide pour l'embedding");
    }
    
    console.log(`[GEMINI] Création embedding pour: "${textString.substring(0, 20)}..." avec ${EMBED_MODEL}`);

    // Utiliser le SDK officiel GoogleGenerativeAI avec outputDimensionality=768
    const model = genAI.getGenerativeModel({ model: EMBED_MODEL });
    const result = await model.embedContent({
      content: { parts: [{ text: textString }] },
      // Force la dimension de sortie pour correspondre à Pinecone
      outputDimensionality: 768,
    });

    const vector = result.embedding?.values;

    if (!vector || !Array.isArray(vector) || vector.length === 0) {
      throw new Error("Réponse API invalide: embedding.values manquant ou vide");
    }

    console.log(
      `[GEMINI] ✅ Vector généré (Dimension: ${vector.length}) avec ${EMBED_MODEL}`
    );

    if (vector.length !== 768) {
      console.warn(
        `[GEMINI] ⚠️ Dimension obtenue ${vector.length} au lieu de 768. Vérifiez la configuration de l'index Pinecone.`
      );
    } else {
      console.log("[GEMINI] ✅ Dimension 768 confirmée (alignée avec Pinecone)");
    }

    return vector;

  } catch (error) {
    const textPreview = text && typeof text === "string" ? text.substring(0, 50) : String(text || "null").substring(0, 50);
    console.error(`[GEMINI] ❌ Erreur embedding (${textPreview}...):`, error.message);
    console.error(`[GEMINI] Stack trace:`, error.stack);
    
    // Gestion des erreurs spécifiques avec messages détaillés
    if (error.message.includes("Timeout") || error.message.includes("timeout")) {
      throw new Error("Timeout: La connexion à l'API Gemini a expiré. Vérifiez votre connexion internet et réessayez.");
    }
    if (error.message.includes("Connexion échouée") || error.message.includes("fetch failed") || error.message.includes("ECONNREFUSED") || error.message.includes("ENOTFOUND")) {
      throw new Error("Connexion échouée: Impossible de se connecter à l'API Gemini. Vérifiez votre connexion internet et que l'API est accessible.");
    }
    if (error.message.includes("400") || error.message.includes("Bad Request")) {
      throw new Error(
        `Requête invalide vers l'API d'embedding. Modèle utilisé: ${EMBED_MODEL} (depuis .env: ${
          process.env.GEMINI_EMBED_MODEL || "non défini"
        }).`
      );
    }
    if (error.message.includes("404") || error.message.includes("not found")) {
      throw new Error(
        `Modèle d'embedding introuvable: ${EMBED_MODEL} (depuis .env: ${
          process.env.GEMINI_EMBED_MODEL || "non défini"
        }). Vérifiez que GEMINI_EMBED_MODEL dans .env contient un modèle valide.`
      );
    }
    if (error.message.includes("429") || error.message.includes("quota")) {
      throw new Error("Quota Gemini dépassé. Vérifiez votre compte Google AI Studio.");
    }
    if (error.message.includes("401") || error.message.includes("API key") || error.message.includes("403")) {
      throw new Error("Clé API Gemini invalide ou permissions insuffisantes. Vérifiez GEMINI_API_KEY dans .env");
    }
    
    // Message d'erreur générique avec instructions
    throw new Error(
      `Service d'intelligence (embeddings) indisponible. Erreur: ${
        error.message
      }. Vérifiez votre .env: GEMINI_EMBED_MODEL=${
        process.env.GEMINI_EMBED_MODEL || EMBED_MODEL
      } et GEMINI_API_KEY doit être valide.`
    );
  }
};

/**
 * 2. Genere une reponse intelligente basee sur un contexte
 * Remplace : GPT-4o-mini
 */
const generateResponse = async (context, question, conversationHistory = [], currentTopic = null, shouldWelcomeBack = false, lastTopicInfo = null, hoursElapsed = 0, isGreeting = false) => {
  try {
    const model = genAI.getGenerativeModel({ model: chatModelName });

    // CRITIQUE: Si pas de contexte RAG, vérifier si on peut utiliser l'historique
    if (!context || context.trim().length === 0) {
      console.log("[GEMINI] ⚠️ generateResponse appelé sans contexte RAG.");
      
      // Si on a un historique de conversation utile, on peut quand même essayer de répondre
      const hasUsefulHistory = conversationHistory && conversationHistory.length > 0 && 
        conversationHistory.some(msg => 
          msg.role === "assistant" && 
          msg.content && 
          msg.content.length > 50 && 
          !msg.content.toLowerCase().includes("je passe la main")
        );
      
      if (hasUsefulHistory) {
        console.log("[GEMINI] 📝 Historique de conversation disponible - tentative de réponse basée sur l'historique");
        // On continue avec un contexte vide mais on utilisera l'historique dans le prompt
        context = ""; // Forcer contexte vide mais continuer
      } else {
        console.log("[GEMINI] 🔒 INTERDICTION: Aucun contexte RAG ni historique utile.");
        console.log("[GEMINI] ✅ Retour direct: HANDOFF_MESSAGE");
        return HANDOFF_MESSAGE;
      }
    }

    console.log(
      `[GEMINI] Génération réponse avec ${context.split("\n\n").length} extraits de contexte`
    );

    // Construire l'historique de conversation pour contexte (si fourni)
    const historyContext =
      conversationHistory && conversationHistory.length > 0
        ? `\n\nHISTORIQUE DE LA CONVERSATION:\n${conversationHistory
            .map(
              (msg, idx) =>
                `${idx + 1}. ${
                  msg.role === "user" ? "Client" : "Vous"
                }: ${msg.content}`
            )
            .join("\n")}`
        : "";

    // Instructions spéciales pour éviter le mélange de contextes
    const topicWarning = currentTopic ? `
⚠️ RÈGLE CRITIQUE - ISOLATION DU SUJET:
- Le client pose une question sur un sujet spécifique (${currentTopic === "bureaux_coworking" ? "bureaux/coworking" : currentTopic === "claviers_equipement" ? "claviers/équipement" : "général"}).
- Tu dois RÉPONDRE UNIQUEMENT sur ce sujet précis.
- NE MÉLANGE JAMAIS les informations de différents sujets/services.
- Si le contexte contient des informations sur d'autres sujets, IGNORE-LES complètement.
- Si tu n'as pas d'information sur le sujet demandé dans le contexte fourni, dis-le simplement et passe la main.
- Exemple INTERDIT: "Concernant les bureaux... et aussi pour les claviers..." → C'EST INTERDIT!
- Exemple CORRECT: Réponds uniquement sur le sujet de la question actuelle, sans mentionner d'autres sujets.
` : "";

    // Instruction spéciale pour le "bon retour" si le client revient après une longue pause
    const welcomeBackInstruction = shouldWelcomeBack ? `
🎯 INSTRUCTION SPÉCIALE - BON RETOUR (${hoursElapsed}h écoulées):
- Le client vient de te saluer (bonjour, salut, etc.) et revient après une longue pause (${hoursElapsed >= 24 ? 'plusieurs jours' : hoursElapsed >= 168 ? 'plus d\'une semaine' : `${hoursElapsed}h`} depuis ta dernière réponse).
- Tu DOIS ABSOLUMENT commencer ta réponse par:
  1. Souhaiter un bon retour de manière chaleureuse et professionnelle (ex: "Bonjour ! Ravi de vous revoir", "Bonjour, content de vous retrouver", "Bonjour ! C'est un plaisir de vous retrouver", etc.)
  2. Rappeler EN UNE PHRASE COURTE ET PRÉCISE où vous en étiez dans votre conversation précédente. ${lastTopicInfo ? `D'après l'historique, vous discutez de: "${lastTopicInfo.topic}".` : 'Analyse l\'historique de conversation pour identifier le dernier sujet abordé.'}
   ${lastTopicInfo && lastTopicInfo.lastMessage ? `Dernier échange: "${lastTopicInfo.lastMessage.substring(0, 80)}..."` : ''}
   Exemples de rappel: "Nous en étions à la réservation du bureau A2", "Nous discutions de votre abonnement de 3 mois", "Nous parlions de la formation sur la saisie au clavier", "Nous étions sur la gestion des symboles avec Alt Gr", etc.
  3. Puis continuer naturellement avec la réponse à sa question actuelle (si il en pose une) ou lui demander comment tu peux l'aider.
- ⚠️ CRITIQUE: Si le client demande "tu te rappelles de ce dont on s'était limité ?" ou "tu te souviens de notre conversation ?", tu DOIS lui rappeler précisément le dernier sujet abordé en utilisant l'historique de conversation.
- Sois chaleureux, professionnel et empathique. Montre que tu te souviens de votre conversation précédente comme un vrai humain le ferait.
- Exemple complet: "Bonjour ! Ravi de vous revoir. Nous en étions à la formation sur la saisie au clavier, plus précisément sur la gestion des symboles avec Alt Gr. Comment puis-je vous aider aujourd'hui ?"
` : "";

    const prompt = `
Tu es un conseiller commercial d'Arcc En Ciel.
Tu réponds aux clients de manière naturelle, chaleureuse et professionnelle, comme un vrai humain qui connaît son métier.
${historyContext}
${topicWarning}
${welcomeBackInstruction}

RÈGLES IMPORTANTES:
1. ${context && context.trim().length > 0 
  ? 'Utilise UNIQUEMENT les informations du CONTEXTE ci-dessous pour répondre. Ne jamais inventer, deviner, ou utiliser des connaissances générales.' 
  : '⚠️ ATTENTION: Le contexte RAG est vide. Tu peux utiliser l\'HISTORIQUE DE LA CONVERSATION ci-dessus pour répondre, mais uniquement si l\'historique contient des informations pertinentes sur le sujet demandé. Si l\'historique ne contient pas d\'information sur le sujet, tu dois passer la main.'}
2. Parle de manière naturelle et humaine. Évite les phrases robotiques comme "dans les informations dont je dispose", "selon mes données", "je n'ai pas dans mes informations".
3. Ta réponse doit être COURTE et PRÉCISE : maximum 3 phrases ou 400 caractères, sauf si le client demande explicitement plus de détails.
4. Gestion des salutations:
   - Si le client dit "bonjour" et que c'est le début de la conversation OU qu'il revient après plus d'1h, réponds à sa salutation de manière chaleureuse.
   - Si le client a déjà dit bonjour et que vous continuez la conversation normalement, ne redis pas bonjour à chaque message.
   - Si le client dit "bonjour" et que vous étiez en pleine conversation (moins d'1h), réponds simplement à sa salutation puis continue sur le sujet.
5. ⚠️ RÈGLE ABSOLUE: ${context && context.trim().length > 0 
  ? 'Utilise les informations du contexte pour répondre. Si tu peux répondre partiellement avec le contexte, fais-le. Ne passe la main à ton supérieur QUE si tu ne peux vraiment RIEN répondre avec le contexte fourni (par exemple, si le client demande des informations complètement absentes du contexte). Si tu peux répondre même partiellement, réponds avec ce que tu sais et propose de passer la main uniquement pour les détails manquants.'
  : 'Si l\'information demandée N\'EST PAS dans l\'historique de conversation ET que le contexte RAG est vide, tu dois passer la main. Mais si l\'historique contient des informations pertinentes, tu peux les utiliser pour répondre.'}
6. Si vraiment tu ne connais pas quelque chose de spécifique qui n'est PAS dans le contexte ou l'historique, ne l'invente JAMAIS. Mais si tu peux répondre partiellement avec le contexte, fais-le avant de proposer de passer la main.
7. Sois précis et cite les prix, horaires, ou détails exacts quand ils sont disponibles.
8. Ne mentionne JAMAIS que tu utilises un contexte, une base de données, ou que tu es une IA/robot.
9. Termine TOUJOURS ta réponse par UNE SEULE question courte, pour inviter le client à continuer (par exemple: "Cela vous conviendrait-il ?" ou "Quelle durée aviez-vous en tête ?").
10. ⚠️ RÈGLE CRITIQUE - ISOLATION STRICTE: 
    - Réponds UNIQUEMENT sur le sujet présent dans le CONTEXTE fourni (ou l'historique si contexte vide).
    - Ne mentionne JAMAIS de sujets qui ne sont PAS dans le contexte ou l'historique (ex: si le contexte parle de claviers, ne mentionne JAMAIS les bureaux, coworking, espaces, etc.).
    - Si le contexte ne contient pas d'information sur un sujet, ne l'invente pas et ne le mentionne pas.
    - Ne mélange JAMAIS les informations de différents sujets/services.

${context && context.trim().length > 0 ? `CONTEXTE (informations disponibles):
${context}` : `⚠️ CONTEXTE RAG VIDE - Utilise uniquement l'HISTORIQUE DE LA CONVERSATION ci-dessus si il contient des informations pertinentes.`}

QUESTION DU CLIENT:
${question}

RÉPONSE (réponds de façon courte, précise et humaine, UNIQUEMENT sur le sujet de la question):
`;

    const result = await model.generateContent(prompt);
    let response = result.response.text();
    console.log(`[GEMINI] Réponse générée (${response.length} caractères)`);
    
    // Détecter et corriger les phrases robotiques
    const roboticPhrases = [
      { pattern: /dans les informations dont je dispose/gi, replace: "d'après ce que je sais" },
      { pattern: /selon mes données/gi, replace: "d'après mes connaissances" },
      { pattern: /je n'ai pas.*dans mes informations/gi, replace: "je ne connais pas tous les détails" },
      { pattern: /je ne dispose pas de/gi, replace: "je ne connais pas" },
      { pattern: /les informations dont je dispose/gi, replace: "mes connaissances" },
      { pattern: /dans mes informations/gi, replace: "dans mes connaissances" },
      { pattern: /selon les informations/gi, replace: "d'après ce que je sais" },
    ];
    
    roboticPhrases.forEach(({ pattern, replace }) => {
      if (pattern.test(response)) {
        console.log(`[GEMINI] Phrase robotique détectée et corrigée: "${pattern}"`);
        response = response.replace(pattern, replace);
      }
    });
    
    const lowerResponse = response.toLowerCase();

    // Vérifier si la réponse mélange plusieurs sujets (détection de mélange de contextes)
    // IMPORTANT : On vérifie TOUJOURS pour éviter le mélange entre bureaux et claviers
    const contextLower = context.toLowerCase();
    const contextIsAboutKeyboards = contextLower.includes("clavier") || contextLower.includes("azerty") || contextLower.includes("qwerty") || contextLower.includes("disposition");
    const responseMentionsOffices = lowerResponse.includes("bureau") || lowerResponse.includes("bureaux") || lowerResponse.includes("coworking") || lowerResponse.includes("espace disponible") || lowerResponse.includes("équipement de vos futurs bureaux");

    // Si le contexte parle de claviers mais la réponse mentionne des bureaux, c'est un mélange CRITIQUE
    if (contextIsAboutKeyboards && responseMentionsOffices) {
      console.log(
        `[GEMINI] ⚠️ MÉLANGE DE SUJETS DÉTECTÉ: Le contexte parle de claviers mais la réponse mentionne des bureaux/coworking`
      );
      console.log(
        "[GEMINI] Réponse rejetée, handoff pour éviter le mélange"
      );
      return HANDOFF_MESSAGE;
    }

    // Vérifier si la réponse mentionne des sujets qui ne sont PAS dans le contexte
    const forbiddenTopics = {
      "séminaire": ["séminaire", "seminaire", "séminaires", "organisation de séminaire", "organisation de séminaires"],
      "bureaux": ["bureau", "bureaux", "coworking", "espace disponible", "équipement de vos futurs bureaux"],
    };
    
    // Vérifier si le contexte contient des informations sur chaque sujet
    const contextHasSeminaire = contextLower.includes("séminaire") || contextLower.includes("seminaire");
    const contextHasBureaux = contextLower.includes("bureau") || contextLower.includes("coworking") || contextLower.includes("espace");
    
    // Vérifier si la réponse mentionne un sujet absent du contexte
    if (!contextHasSeminaire && forbiddenTopics["séminaire"].some(keyword => lowerResponse.includes(keyword))) {
      console.log(
        `[GEMINI] ⚠️ SUJET ABSENT DU CONTEXTE DÉTECTÉ: La réponse mentionne "séminaire" mais ce sujet n'est PAS dans le contexte fourni`
      );
      console.log(
        "[GEMINI] Réponse rejetée, handoff pour éviter l'invention d'informations"
      );
      return HANDOFF_MESSAGE;
    }
    
    if (!contextHasBureaux && forbiddenTopics["bureaux"].some(keyword => lowerResponse.includes(keyword))) {
      console.log(
        `[GEMINI] ⚠️ SUJET ABSENT DU CONTEXTE DÉTECTÉ: La réponse mentionne "bureaux/coworking" mais ce sujet n'est PAS dans le contexte fourni`
      );
      console.log(
        "[GEMINI] Réponse rejetée, handoff pour éviter l'invention d'informations"
      );
      return HANDOFF_MESSAGE;
    }

    // Vérification générale : si plusieurs sujets sont mélangés dans la réponse
    // ⚠️ EXCEPTION : Ne pas appliquer cette vérification pour les salutations simples
    // car une salutation peut mentionner plusieurs sujets dans une phrase de bienvenue générale
    if (!isGreeting) {
      const topicKeywords = {
        bureaux: ["bureau", "bureaux", "coworking", "espace", "salle", "réunion", "location"],
        claviers: ["clavier", "claviers", "azerty", "qwerty", "touches", "disposition"],
      };

      const topicCounts = {};
      for (const [topic, keywords] of Object.entries(topicKeywords)) {
        topicCounts[topic] = keywords.filter((keyword) =>
          lowerResponse.includes(keyword)
        ).length;
      }

      const activeTopics = Object.keys(topicCounts).filter(
        (topic) => topicCounts[topic] > 0
      );

      if (activeTopics.length > 1) {
        console.log(
          `[GEMINI] ⚠️ MÉLANGE DE SUJETS DÉTECTÉ dans la réponse: ${activeTopics.join(
            ", "
          )}`
        );
        console.log(
        "[GEMINI] Réponse rejetée, handoff pour éviter le mélange"
        );
        return HANDOFF_MESSAGE;
      }
    } else {
      console.log(`[GEMINI] ℹ️ Salutation détectée - Vérification de mélange de sujets désactivée`);
    }
    
    // Détecter si la réponse indique un manque COMPLET d'information
    // Seulement si la réponse dit explicitement qu'elle ne peut rien répondre
    // Si elle dit "je ne connais pas les tarifs" mais répond quand même sur d'autres aspects, c'est OK
    const lowerResponseForHandoff = response.toLowerCase();
    if (lowerResponseForHandoff.includes("je ne connais pas") && 
        (lowerResponseForHandoff.includes("rien") || 
         lowerResponseForHandoff.includes("aucune") ||
         lowerResponseForHandoff.includes("pas d'information") ||
         lowerResponseForHandoff.includes("pas d information"))) {
      console.log("[GEMINI] Formulation 'je ne connais rien' détectée, handoff forcé");
      return HANDOFF_MESSAGE;
    }
    
    // Vérifier si la réponse est trop vague ou indique un manque COMPLET d'information
    // Seulement si elle ne contient aucune information utile ET mentionne explicitement qu'elle ne peut rien répondre
    const vagueIndicators = [
      "je ne sais rien",
      "je n'ai aucune information",
      "je ne peux rien vous dire",
      "je ne peux pas vous répondre",
    ];
    
    // Ne déclencher le handoff que si la réponse est VRAIMENT vide de contenu
    // ET qu'elle mentionne explicitement qu'elle ne peut rien répondre
    const hasVagueIndicator = vagueIndicators.some(indicator => lowerResponse.includes(indicator));
    const hasUsefulContent = response.length > 50 && (
      lowerResponse.includes("formation") || 
      lowerResponse.includes("cours") || 
      lowerResponse.includes("clavier") ||
      lowerResponse.includes("bureau") ||
      lowerResponse.includes("tarif") ||
      lowerResponse.includes("prix") ||
      lowerResponse.includes("offre") ||
      lowerResponse.includes("service")
    );
    
    if (hasVagueIndicator && !hasUsefulContent) {
      console.log("[GEMINI] Réponse trop vague sans contenu utile détectée, handoff");
      return HANDOFF_MESSAGE;
    }
    
    return response;
  } catch (error) {
    console.error("[GEMINI] Erreur génération réponse:", error.message);
    // En cas d'erreur de génération, on bascule directement en handoff humain
    return HANDOFF_MESSAGE;
  }
};

/**
 * 3. Génère une réponse générale (sans RAG) en utilisant les connaissances générales de Gemini.
 * IMPORTANT : Si la base de connaissances (RAG) n'a pas l'information, on passe directement la main
 * au lieu de faire des recherches web qui peuvent donner des informations incorrectes.
 */
const generateGeneralResponse = async (question, conversationHistory = [], currentTopic = null) => {
  try {
    // Utiliser Gemini sans recherche web - seulement avec ses connaissances générales
    const model = genAI.getGenerativeModel({ model: chatModelName });

    // Construire l'historique de conversation pour contexte
    const historyContext = conversationHistory.length > 0
      ? `\n\nHISTORIQUE DE LA CONVERSATION:\n${conversationHistory.map((msg, idx) => 
          `${idx + 1}. ${msg.role === 'user' ? 'Client' : 'Vous'}: ${msg.content}`
        ).join('\n')}`
      : '';

    // Instructions spéciales pour éviter le mélange de contextes
    const topicWarning = currentTopic ? `
⚠️ RÈGLE CRITIQUE - ISOLATION DU SUJET:
- Le client pose une question sur un sujet spécifique (${currentTopic === "bureaux_coworking" ? "bureaux/coworking" : currentTopic === "claviers_equipement" ? "claviers/équipement" : "général"}).
- Tu dois RÉPONDRE UNIQUEMENT sur ce sujet précis.
- NE MÉLANGE JAMAIS les informations de différents sujets/services.
- Si l'historique mentionne d'autres sujets, IGNORE-LES complètement pour cette réponse.
- Si tu n'as pas d'information sur le sujet demandé, dis-le simplement et passe la main.
- Exemple INTERDIT: "Concernant les bureaux... et aussi pour les claviers..." → C'EST INTERDIT!
- Exemple CORRECT: Réponds uniquement sur le sujet de la question actuelle, sans mentionner d'autres sujets.
` : '';

    const prompt = `
Tu es un conseiller commercial d'Arcc En Ciel, spécialisé dans les bureaux et espaces de coworking.
Tu réponds aux clients de manière naturelle, chaleureuse et professionnelle, comme un vrai humain qui connaît son métier.
${historyContext}
${topicWarning}

RÈGLES IMPORTANTES:
1. Utilise UNIQUEMENT le CONTEXTE ci-dessous pour répondre. Ne jamais inventer ou deviner.
2. Parle de manière naturelle et humaine. Évite les phrases robotiques comme "dans les informations dont je dispose", "selon mes données", "je n'ai pas dans mes informations".
3. Ta réponse doit être COURTE et PRÉCISE : maximum 3 phrases ou 400 caractères, sauf si le client demande explicitement plus de détails.
4. Ne redis pas des salutations à chaque fois. Si le client a déjà dit bonjour ou si une réponse a déjà été envoyée, entre directement dans le sujet.
5. ⚠️ RÈGLE ABSOLUE: Si l'information demandée par le client N'EST PAS dans le contexte fourni, tu NE DOIS PAS inventer, deviner, ou utiliser tes connaissances générales. Dans ce cas, réponds simplement que tu passes la main à ton supérieur.
6. Si vraiment tu ne connais pas quelque chose de spécifique, dis-le naturellement comme un humain le ferait, sans mentionner "informations" ou "données".
   Exemple BON: "Je ne connais pas tous les détails, mais je peux déjà vous dire que..."
   Exemple MAUVAIS: "Je n'ai pas cette information dans mes données"
7. Sois précis et cite les prix, horaires, ou détails exacts quand ils sont disponibles.
8. Ne mentionne JAMAIS que tu utilises un contexte, une base de données, ou que tu es une IA/robot.
9. Termine TOUJOURS ta réponse par UNE SEULE question courte, pour inviter le client à continuer (par exemple: "Cela vous conviendrait-il ?" ou "Quelle durée aviez-vous en tête ?").
10. ⚠️ RÈGLE ABSOLUE: Ne mélange JAMAIS les informations de différents sujets. Réponds UNIQUEMENT sur le sujet de la question actuelle.

CONTEXTE (informations disponibles):
Aucun contexte spécifique disponible dans la base de connaissances pour cette question.

QUESTION DU CLIENT:
${question}

RÉPONSE (réponds de façon courte, précise et humaine, UNIQUEMENT sur le sujet de la question):
`;

    const result = await model.generateContent(prompt);
    let response = result.response.text();
    console.log(
      `[GEMINI] Réponse générale générée (${response.length} caractères)`
    );
    
    // Détecter et corriger les phrases robotiques
    const roboticPhrases = [
      { pattern: /dans les informations dont je dispose/gi, replace: "d'après ce que je sais" },
      { pattern: /selon mes données/gi, replace: "d'après mes connaissances" },
      { pattern: /je n'ai pas.*dans mes informations/gi, replace: "je ne connais pas tous les détails" },
      { pattern: /je ne dispose pas de/gi, replace: "je ne connais pas" },
      { pattern: /les informations dont je dispose/gi, replace: "mes connaissances" },
      { pattern: /dans mes informations/gi, replace: "dans mes connaissances" },
      { pattern: /selon les informations/gi, replace: "d'après ce que je sais" },
    ];
    
    roboticPhrases.forEach(({ pattern, replace }) => {
      if (pattern.test(response)) {
        console.log(`[GEMINI] Phrase robotique détectée et corrigée`);
        response = response.replace(pattern, replace);
      }
    });
    
    const lowerResponse = response.toLowerCase();

    // Vérifier si la réponse mélange plusieurs sujets (détection de mélange de contextes)
    // Comme pour generateResponse, on n'active ce filtre QUE si currentTopic est explicite.
    if (currentTopic && currentTopic !== "general") {
      const topicKeywords = {
        bureaux: ["bureau", "bureaux", "coworking", "espace", "salle", "réunion", "location"],
        claviers: ["clavier", "claviers", "azerty", "qwerty", "touches", "disposition"],
      };

      const topicCounts = {};
      for (const [topic, keywords] of Object.entries(topicKeywords)) {
        topicCounts[topic] = keywords.filter((keyword) =>
          lowerResponse.includes(keyword)
        ).length;
      }

      const activeTopics = Object.keys(topicCounts).filter(
        (topic) => topicCounts[topic] > 0
      );

      if (activeTopics.length > 1) {
        console.log(
          `[GEMINI] ⚠️ MÉLANGE DE SUJETS DÉTECTÉ dans la réponse (général): ${activeTopics.join(
            ", "
          )}`
        );
        console.log(
          "[GEMINI] Réponse rejetée, handoff pour éviter le mélange (currentTopic défini)"
        );
        return HANDOFF_MESSAGE;
      }
    }
    
    // Si la réponse contient "je ne connais pas", ce n'est pas professionnel :
    // on passe la main au supérieur au lieu d'exposer une méconnaissance.
    if (response.toLowerCase().includes("je ne connais pas")) {
      console.log("[GEMINI] Formulation 'je ne connais pas' détectée (général), handoff forcé");
      return HANDOFF_MESSAGE;
    }
    
    return response;
  } catch (error) {
    console.error("[GEMINI] Erreur génération réponse générale:", error.message);
    // En cas d'erreur, on passe directement la main
    return HANDOFF_MESSAGE;
  }
};

module.exports = { getEmbeddings, generateResponse, generateGeneralResponse };
