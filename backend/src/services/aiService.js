const { generateResponse, generateGeneralResponse } = require("./googleAiService");

const selectModel = () =>
  process.env.GEMINI_CHAT_MODEL || "models/gemini-flash-latest";

/**
 * Détecte si le client exprime de l'insatisfaction dans son message
 */
const detectCustomerDissatisfaction = (message) => {
  if (!message || typeof message !== "string") return false;
  
  const lowerMessage = message.toLowerCase();
  
  // Mots-clés d'insatisfaction
  const dissatisfactionKeywords = [
    "pas satisfait", "insatisfait", "déçu", "décevant",
    "pas clair", "incompréhensible", "ne comprends pas",
    "ça ne répond pas", "ça ne m'aide pas", "inutile",
    "je veux parler à", "parler à un humain", "parler à quelqu'un",
    "agent", "conseiller", "superviseur", "responsable",
    "merci mais", "merci mais ça", "merci mais je",
    "c'est pas ça", "ce n'est pas ça", "ce n'est pas ce que",
    "autre chose", "autre question", "autre problème",
    "toujours pas", "encore", "toujours", "toujours le même",
    "frustré", "frustrant", "énervé", "énervant"
  ];
  
  return dissatisfactionKeywords.some(keyword => lowerMessage.includes(keyword));
};

/**
 * Détecte si le message contient une salutation
 */
const detectGreeting = (message) => {
  if (!message || typeof message !== "string") return false;
  
  const lowerMessage = message.toLowerCase().trim();
  
  // Mots-clés de salutation (français)
  const greetingKeywords = [
    "bonjour", "bonsoir", "salut", "bon matin", "bon après-midi",
    "bonne soirée", "bonne nuit", "coucou", "hey", "hi", "hello"
  ];
  
  // Vérifier si le message commence par une salutation ou contient uniquement une salutation
  const isOnlyGreeting = greetingKeywords.some(keyword => 
    lowerMessage === keyword || lowerMessage.startsWith(keyword + " ") || lowerMessage.startsWith(keyword + ",")
  );
  
  // Vérifier si le message contient une salutation (même au milieu)
  const containsGreeting = greetingKeywords.some(keyword => lowerMessage.includes(keyword));
  
  // Si c'est uniquement une salutation ou commence par une salutation, c'est clair
  // Sinon, on considère que c'est une salutation si elle est présente ET le message est court (< 50 caractères)
  return isOnlyGreeting || (containsGreeting && lowerMessage.length < 50);
};

/**
 * Détecte si le message est simple et peut être traité sans contexte RAG
 * (messages de présence, intérêt général, questions basiques)
 */
const detectSimpleMessage = (message) => {
  if (!message || typeof message !== "string") return false;
  
  const lowerMessage = message.toLowerCase().trim();
  
  // Messages simples qui peuvent être répondus sans RAG
  const simplePatterns = [
    /^(vous )?êtes (là|la|la\?)$/i,
    /^(vous )?etes (là|la|la\?)$/i,
    /^(tu )?es (là|la|la\?)$/i,
    /^(je )?suis intéressé$/i,
    /^(je )?suis interesse$/i,
    /^(je )?suis intéressée$/i,
    /^(je )?suis interesse$/i,
    /^oui$/i,
    /^non$/i,
    /^ok$/i,
    /^d'accord$/i,
    /^merci$/i,
    /^ça va$/i,
    /^comment ça va$/i,
    /^ça marche$/i,
  ];
  
  // Vérifier si le message correspond à un pattern simple
  const matchesPattern = simplePatterns.some(pattern => pattern.test(lowerMessage));
  
  // Vérifier si c'est un message très court (< 30 caractères) sans ponctuation complexe
  const isShortSimple = lowerMessage.length < 30 && 
    !lowerMessage.includes("?") && 
    !lowerMessage.includes("!") &&
    !lowerMessage.includes("comment") &&
    !lowerMessage.includes("pourquoi") &&
    !lowerMessage.includes("combien");
  
  return matchesPattern || isShortSimple;
};

/**
 * Détermine si on doit souhaiter un bon retour au client
 * (si dernière réponse date de plus d'1h ET le client a envoyé une salutation)
 * Retourne aussi le nombre d'heures écoulées pour personnaliser le message
 */
const shouldWelcomeBack = (lastOutboundAt, hasGreeting) => {
  if (!hasGreeting || !lastOutboundAt) return { should: false, hoursElapsed: 0 };
  
  const now = new Date();
  const lastOutbound = new Date(lastOutboundAt);
  const hoursElapsed = (now - lastOutbound) / (1000 * 60 * 60); // Conversion en heures
  
  // Si plus d'1h s'est écoulé depuis la dernière réponse
  return { 
    should: hoursElapsed >= 1, 
    hoursElapsed: Math.round(hoursElapsed * 10) / 10 // Arrondir à 1 décimale
  };
};

/**
 * Récupère le dernier sujet de conversation avant la pause
 * Analyse les derniers messages pour identifier le sujet principal
 */
const getLastConversationTopic = (conversationHistory) => {
  if (!conversationHistory || conversationHistory.length === 0) {
    return null;
  }

  // Prendre les 5-10 derniers messages pour identifier le sujet
  const recentMessages = conversationHistory.slice(-10);
  const allText = recentMessages.map(msg => msg.content).join(" ").toLowerCase();

  // Identifier les sujets principaux
  const topics = {
    "formation_clavier": ["clavier", "azerty", "qwerty", "touches", "saisie", "symbole", "alt gr", "maj"],
    "formation_informatique": ["formation", "informatique", "word", "excel", "office", "programme"],
    "bureaux_coworking": ["bureau", "bureaux", "coworking", "espace", "location", "abonnement"],
    "seminaires": ["séminaire", "seminaire", "organisation", "événement"],
    "licences": ["licence", "microsoft office", "kaspersky", "gemini pro", "logiciel"],
  };

  // Trouver le sujet le plus mentionné
  let maxScore = 0;
  let detectedTopic = null;

  for (const [topic, keywords] of Object.entries(topics)) {
    const score = keywords.reduce((acc, keyword) => {
      const regex = new RegExp(keyword, "gi");
      const matches = allText.match(regex);
      return acc + (matches ? matches.length : 0);
    }, 0);

    if (score > maxScore) {
      maxScore = score;
      detectedTopic = topic;
    }
  }

  // Si un sujet est détecté, créer un résumé court
  if (detectedTopic && maxScore > 0) {
    const topicNames = {
      "formation_clavier": "la formation sur la saisie au clavier",
      "formation_informatique": "la formation en informatique de base",
      "bureaux_coworking": "la réservation de bureaux ou espaces de coworking",
      "seminaires": "l'organisation de séminaires",
      "licences": "les licences logicielles",
    };

    // Chercher aussi le dernier message OUTBOUND pour avoir plus de contexte
    const lastOutbound = recentMessages.filter(msg => msg.role === "assistant").pop();
    if (lastOutbound) {
      return {
        topic: topicNames[detectedTopic] || detectedTopic,
        lastMessage: lastOutbound.content.substring(0, 100), // 100 premiers caractères
      };
    }

    return {
      topic: topicNames[detectedTopic] || detectedTopic,
      lastMessage: null,
    };
  }

  return null;
};

const generateAnswer = async ({
  question,
  context = [],
  conversationHistory = [],
  currentTopic = null,
  lastOutboundAt = null,
  tenant = null,
  isImageWithoutRAG = false,
  imageAnalysis = null,
}) => {
  // Détecter l'insatisfaction AVANT de générer une réponse
  if (detectCustomerDissatisfaction(question)) {
    console.log("[AI] Insatisfaction détectée dans le message du client, handoff automatique");
    const { HANDOFF_MESSAGE } = require("./messageProcessor");
    return { text: HANDOFF_MESSAGE, usage: null, shouldHandoff: true };
  }

  // CAS SPÉCIAL: Image avec services non présents dans la base de connaissance
  if (isImageWithoutRAG && imageAnalysis) {
    console.log("[AI] 📷 Image détectée avec services non présents dans la base de connaissance");
    
    // Récupérer les services disponibles dans la base de connaissance
    const { findRelevantContext } = require("./ragService");
    
    // Faire plusieurs recherches pour trouver les services disponibles
    const searchQueries = [
      "services disponibles offres produits",
      "formations disponibles",
      "bureaux coworking",
      "séminaires organisation",
    ];
    
    let allAvailableServices = [];
    for (const query of searchQueries) {
      const results = await findRelevantContext({
        tenantId: tenant?.id,
        question: query,
        topK: 5,
      });
      allAvailableServices = [...allAvailableServices, ...results];
    }
    
    // Dédupliquer et limiter
    const uniqueServices = [...new Set(allAvailableServices)].slice(0, 8);
    
    // Construire une réponse qui dit qu'elle ne dispose pas de ces services mais propose ce qui est disponible
    const tenantName = tenant?.companyName || tenant?.name || "notre service";
    const servicesInImage = imageAnalysis.services || [];
    const servicesList = servicesInImage.length > 0 ? servicesInImage.join(", ") : "les services mentionnés dans l'image";
    
    let responseText = `Je vois que vous me montrez ${servicesList} dans l'image que vous avez envoyée.\n\n`;
    responseText += `Je dois vous informer que ces services ne font pas partie de notre catalogue actuel chez ${tenantName}.\n\n`;
    
    if (uniqueServices && uniqueServices.length > 0) {
      responseText += `Cependant, nous proposons d'autres services qui pourraient vous intéresser. Voici ce que nous avons actuellement disponible :\n\n`;
      
      // Extraire et formater les services disponibles (limiter à 5-6 services les plus pertinents)
      const servicesPreview = uniqueServices.slice(0, 6)
        .map((service, idx) => {
          // Extraire le nom du service (première phrase ou 50 premiers caractères)
          const serviceName = service.split('\n')[0].substring(0, 80).trim();
          return `${idx + 1}. ${serviceName}`;
        })
        .join("\n");
      
      responseText += `${servicesPreview}\n\n`;
      responseText += `Souhaitez-vous en savoir plus sur l'un de ces services ? Je serais ravi de vous fournir tous les détails nécessaires. 😊`;
    } else {
      responseText += `Pour le moment, je ne dispose pas d'informations détaillées sur nos services disponibles dans ma base de données.\n\n`;
      responseText += `Je vous suggère de me contacter directement ou de laisser un message vocal/textuel avec votre demande spécifique, et je ferai en sorte qu'un membre de notre équipe vous contacte rapidement pour vous renseigner.`;
    }
    
    return { text: responseText, usage: null, shouldHandoff: false };
  }

  // Contexte RAG (documents du tenant)
  // Vérification STRICTE: le contexte doit être un tableau non vide avec au moins un élément valide
  const hasContext =
    Array.isArray(context) &&
    context.length > 0 &&
    context.some(
      (c) => typeof c === "string" && c.trim().length > 0
    );

  // Détecter si le client a envoyé une salutation
  const hasGreeting = detectGreeting(question);

  // PRIORITÉ: Pour une simple salutation (juste "bonjour", "salut", etc.), 
  // répondre directement sans passer par generateResponse pour éviter les problèmes
  // de détection de mélange de sujets, même si le contexte RAG existe
  if (hasGreeting) {
    const lowerQuestion = question.toLowerCase().trim();
    const isOnlyGreeting = lowerQuestion === "bonjour" || 
                          lowerQuestion === "salut" || 
                          lowerQuestion === "bonsoir" ||
                          lowerQuestion === "bon matin" ||
                          lowerQuestion === "bon après-midi" ||
                          lowerQuestion === "bonne soirée" ||
                          lowerQuestion === "bonne nuit" ||
                          lowerQuestion === "coucou" ||
                          lowerQuestion === "hey" ||
                          lowerQuestion === "hi" ||
                          lowerQuestion === "hello";
    
    if (isOnlyGreeting) {
      console.log(`[AI] 👋 Salutation simple détectée - réponse de bienvenue directe (sans passer par generateResponse)`);
      
      // Personnalisation du message de bienvenue selon le tenant
      const rawName = tenant?.companyName || tenant?.name || "";
      const tenantName = rawName && rawName.trim().length > 0
        ? rawName.trim()
        : null;
      const industry = (tenant?.industry || "").toLowerCase();

      // Déterminer le type de service pour adapter le ton
      let serviceLabel = "notre service";
      if (industry.includes("formation") || industry.includes("cours") || industry.includes("éducation") || industry.includes("education")) {
        serviceLabel = "notre centre de formation";
      }

      // Cas spécifique pour les formations Microsoft Office
      const lowerName = (tenantName || "").toLowerCase();
      if (
        lowerName.includes("office") ||
        lowerName.includes("microsoft") ||
        industry.includes("microsoft") ||
        industry.includes("office")
      ) {
        serviceLabel = "notre centre de formation Microsoft Office";
      }

      let welcomeText;
      if (tenantName) {
        welcomeText = `Bonjour 👋 ! Bienvenue sur ${tenantName}, ${serviceLabel}. Dites-moi ce que vous souhaitez comme information ou accompagnement, et je vous aiderai au mieux.`;
      } else {
        welcomeText =
          "Bonjour 👋 ! Je suis votre assistant. Vous pouvez m'écrire vos questions ou me dire ce que vous cherchez, et je vous aiderai au mieux.";
      }

      return { text: welcomeText, usage: null, shouldHandoff: false };
    }
  }

  // CRITIQUE: Si aucun contexte RAG trouvé (searchResults.matches vide),
  // INTERDIRE à l'IA d'utiliser ses connaissances générales ou Google Search
  // MAIS autoriser une petite réponse de bienvenue générique si c'est
  // uniquement une salutation (ex: "bonjour") ou un message simple.
  if (!hasContext) {
    console.log(
      "[AI] ⚠️ Aucun contexte RAG disponible (searchResults.matches vide)."
    );
    console.log(
      "[AI] 🔒 INTERDICTION: L'IA ne doit PAS utiliser ses connaissances générales."
    );

    // Cas particulier 1: le client envoie juste une salutation.
    // Dans ce cas, au lieu de passer la main à un humain, on peut
    // envoyer une réponse de bienvenue générique qui n'utilise
    // aucune connaissance métier.
    if (hasGreeting) {
      console.log(
        "[AI] 👋 Salutation détectée sans contexte RAG - envoi d'un message de bienvenue générique."
      );
      
      // Personnalisation du message de bienvenue selon le tenant
      const rawName = tenant?.companyName || tenant?.name || "";
      const tenantName = rawName && rawName.trim().length > 0
        ? rawName.trim()
        : null;
      const industry = (tenant?.industry || "").toLowerCase();

      // Déterminer le type de service pour adapter le ton
      let serviceLabel = "notre service";
      if (industry.includes("formation") || industry.includes("cours") || industry.includes("éducation") || industry.includes("education")) {
        serviceLabel = "notre centre de formation";
      }

      // Cas spécifique pour les formations Microsoft Office
      const lowerName = (tenantName || "").toLowerCase();
      if (
        lowerName.includes("office") ||
        lowerName.includes("microsoft") ||
        industry.includes("microsoft") ||
        industry.includes("office")
      ) {
        serviceLabel = "notre centre de formation Microsoft Office";
      }

      let welcomeText;
      if (tenantName) {
        welcomeText = `Bonjour 👋 ! Bienvenue sur ${tenantName}, ${serviceLabel}. Dites-moi ce que vous souhaitez comme information ou accompagnement, et je vous aiderai au mieux.`;
      } else {
        welcomeText =
          "Bonjour 👋 ! Je suis votre assistant. Vous pouvez m'écrire vos questions ou me dire ce que vous cherchez, et je vous aiderai au mieux.";
      }

      return { text: welcomeText, usage: null, shouldHandoff: false };
    }

    // Cas particulier 2: message simple qui peut être traité sans RAG
    // (présence, intérêt général, etc.)
    const isSimple = detectSimpleMessage(question);
    if (isSimple) {
      console.log(
        "[AI] 💬 Message simple détecté sans contexte RAG - réponse basique autorisée."
      );
      
      // Réponses adaptées selon le type de message simple
      const lowerQuestion = question.toLowerCase().trim();
      let simpleResponse = "";
      
      if (lowerQuestion.includes("êtes") || lowerQuestion.includes("etes") || lowerQuestion.includes("es là")) {
        simpleResponse = "Oui, je suis là ! 👋 Comment puis-je vous aider aujourd'hui ?";
      } else if (lowerQuestion.includes("intéressé") || lowerQuestion.includes("interesse")) {
        const rawName = tenant?.companyName || tenant?.name || "";
        const tenantName = rawName && rawName.trim().length > 0 ? rawName.trim() : "notre service";
        simpleResponse = `Parfait ! 😊 Je suis ravi de votre intérêt pour ${tenantName}. Dites-moi ce qui vous intéresse particulièrement, et je vous donnerai toutes les informations dont vous avez besoin.`;
      } else if (lowerQuestion === "oui" || lowerQuestion === "ok" || lowerQuestion === "d'accord") {
        simpleResponse = "Parfait ! 😊 Que souhaitez-vous savoir ou faire ensuite ?";
      } else if (lowerQuestion === "merci") {
        simpleResponse = "De rien ! 😊 N'hésitez pas si vous avez d'autres questions.";
      } else {
        // Réponse générique pour autres messages simples
        simpleResponse = "Je suis là pour vous aider ! 😊 Pouvez-vous me donner plus de détails sur ce que vous cherchez ?";
      }
      
      return { text: simpleResponse, usage: null, shouldHandoff: false };
    }

    // Cas particulier 3: utiliser l'historique de conversation comme contexte minimal
    // si la conversation a déjà commencé (au moins 2 messages)
    // NOTE: Pour l'instant, on skip ce cas car generateResponse nécessite un contexte RAG.
    // On pourrait implémenter une fonction spéciale plus tard si nécessaire.
    // Pour l'instant, on fait un handoff si pas de RAG et pas de message simple.

    // Avant de faire un handoff, vérifier si c'est une salutation simple
  // Si oui, on peut répondre avec un message de bienvenue même sans contexte RAG
  if (hasGreeting) {
    console.log(
      "[AI] 👋 Salutation détectée - envoi d'un message de bienvenue même sans contexte RAG complet."
    );
    
    // Personnalisation du message de bienvenue selon le tenant
    const rawName = tenant?.companyName || tenant?.name || "";
    const tenantName = rawName && rawName.trim().length > 0
      ? rawName.trim()
      : null;
    const industry = (tenant?.industry || "").toLowerCase();

    // Déterminer le type de service pour adapter le ton
    let serviceLabel = "notre service";
    if (industry.includes("formation") || industry.includes("cours") || industry.includes("éducation") || industry.includes("education")) {
      serviceLabel = "notre centre de formation";
    }

    // Cas spécifique pour les formations Microsoft Office
    const lowerName = (tenantName || "").toLowerCase();
    if (
      lowerName.includes("office") ||
      lowerName.includes("microsoft") ||
      industry.includes("microsoft") ||
      industry.includes("office")
    ) {
      serviceLabel = "notre centre de formation Microsoft Office";
    }

    let welcomeText;
    if (tenantName) {
      welcomeText = `Bonjour 👋 ! Bienvenue sur ${tenantName}, ${serviceLabel}. Dites-moi ce que vous souhaitez comme information ou accompagnement, et je vous aiderai au mieux.`;
    } else {
      welcomeText =
        "Bonjour 👋 ! Je suis votre assistant. Vous pouvez m'écrire vos questions ou me dire ce que vous cherchez, et je vous aiderai au mieux.";
    }

    return { text: welcomeText, usage: null, shouldHandoff: false };
  }

  // Avant de faire un handoff, vérifier si l'historique de conversation contient des informations utiles
  // Si oui, on peut essayer de répondre en se basant sur l'historique
  const hasUsefulHistory = conversationHistory && conversationHistory.length > 0 && 
    conversationHistory.some(msg => 
      msg.role === "assistant" && 
      msg.content && 
      msg.content.length > 50 && 
      !msg.content.includes("Je passe la main")
    );
  
  if (hasUsefulHistory) {
    console.log(
      "[AI] 📝 Contexte RAG vide mais historique de conversation disponible - tentative de réponse basée sur l'historique"
    );
    // On va quand même essayer de générer une réponse en utilisant l'historique
    // Le prompt dans generateResponse gérera le cas où le contexte est vide
  } else {
    console.log(
      "[AI] ✅ Réponse directe: HANDOFF_MESSAGE (passage à un humain - aucun contexte disponible)."
    );
    const { HANDOFF_MESSAGE } = require("./messageProcessor");
    return { text: HANDOFF_MESSAGE, usage: null, shouldHandoff: true };
  }
  }

  const welcomeBackInfo = shouldWelcomeBack(lastOutboundAt, hasGreeting);
  const shouldWelcome = welcomeBackInfo.should;
  
  // Récupérer le dernier sujet de conversation si c'est un retour après longue pause
  let lastTopicInfo = null;
  if (shouldWelcome && conversationHistory && conversationHistory.length > 0) {
    lastTopicInfo = getLastConversationTopic(conversationHistory);
    if (lastTopicInfo) {
      console.log(`[AI] 📝 Dernier sujet détecté: ${lastTopicInfo.topic}`);
    }
  }
  
    if (hasGreeting) {
    console.log(`[AI] Salutation détectée dans le message du client`);
  }
  
  if (shouldWelcome) {
    console.log(`[AI] Bon retour requis: dernière réponse il y a ${welcomeBackInfo.hoursElapsed}h, salutation détectée`);
    if (lastTopicInfo) {
      console.log(`[AI] 📝 Rappel du dernier sujet: ${lastTopicInfo.topic}`);
    }
  }
  
    // Cas normal : on répond à partir de la base de connaissance du tenant (RAG)
    const promptContext = context.join("\n\n");
  const text = await generateResponse(
      promptContext,
      question,
      conversationHistory,
    currentTopic,
    shouldWelcome,
    lastTopicInfo,
    welcomeBackInfo.hoursElapsed,
    hasGreeting // Passer l'information que c'est une salutation
    );
    
    // Si generateResponse renvoie HANDOFF_MESSAGE, on signale le handoff
    const { HANDOFF_MESSAGE } = require("./messageProcessor");
    const shouldHandoff = text === HANDOFF_MESSAGE;
    
    return { text, usage: null, shouldHandoff };
};

module.exports = { 
  selectModel, 
  generateAnswer, 
  detectCustomerDissatisfaction,
  detectGreeting,
  detectSimpleMessage,
  shouldWelcomeBack,
  getLastConversationTopic,
};
