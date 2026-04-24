/**
 * SERVICE DE FILTRAGE DE CONTEXTE
 * Empêche le mélange de contextes différents dans les conversations
 */

const { getEmbeddings } = require("./googleAiService");
const { prisma } = require("./prisma");

/**
 * Détecte le sujet principal d'un message en utilisant des mots-clés
 */
const detectTopic = async (message) => {
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return "general";
  }

  // Mots-clés pour identifier les sujets principaux
  const topicKeywords = {
    "bureaux_coworking": [
      "bureau", "bureaux", "coworking", "espace", "espaces", "salle", "salles",
      "réunion", "réunions", "location", "louer", "prix", "tarif", "tarifs",
      "disponibilité", "disponible", "réservation", "réserver", "surface",
      "m²", "m2", "personnes", "équipe", "équipes", "travail", "travaux",
      "bureau privé", "bureau partagé", "open space", "cabinet", "cabinet de travail"
    ],
    "claviers_equipement": [
      "clavier", "claviers", "azerty", "qwerty", "qwertz", "touches",
      "disposition", "équipement", "équipements", "matériel", "informatique",
      "ordinateur", "pc", "souris", "écran", "moniteur", "périphérique", "périphériques"
    ],
    "general": [] // Sujet général par défaut
  };

  const lowerMessage = message.toLowerCase();
  
  // Compter les occurrences de mots-clés par sujet
  const topicScores = {};
  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (topic === "general") continue;
    topicScores[topic] = keywords.reduce((count, keyword) => {
      // Utiliser word boundaries pour des correspondances plus précises
      const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'i');
      return count + (regex.test(lowerMessage) ? 1 : 0);
    }, 0);
  }

  // Trouver le sujet avec le score le plus élevé
  const scores = Object.values(topicScores);
  const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
  
  if (maxScore === 0) {
    return "general";
  }

  // Si plusieurs sujets ont le même score, on prend le premier
  const detectedTopic = Object.keys(topicScores).find(
    (topic) => topicScores[topic] === maxScore
  );

  console.log(`[CONTEXT FILTER] Sujet détecté: ${detectedTopic} (score: ${maxScore})`);
  return detectedTopic || "general";
};

/**
 * Détecte si le sujet de la conversation a changé
 */
const detectTopicChange = async (currentMessage, conversationHistory = []) => {
  if (!conversationHistory || conversationHistory.length === 0) {
    return { changed: false, newTopic: null };
  }

  const currentTopic = await detectTopic(currentMessage);
  
  // Analyser les 3 derniers messages pour déterminer le sujet précédent
  const recentMessages = conversationHistory.slice(-3);
  const previousTopics = await Promise.all(
    recentMessages
      .filter(msg => msg.role === "user")
      .map(msg => detectTopic(msg.content))
  );

  // Si aucun sujet précédent n'est détecté, pas de changement
  if (previousTopics.length === 0) {
    return { changed: false, newTopic: currentTopic };
  }

  // Trouver le sujet dominant dans les messages précédents
  const topicCounts = {};
  previousTopics.forEach(topic => {
    if (topic) {
      topicCounts[topic] = (topicCounts[topic] || 0) + 1;
    }
  });

  const previousTopic = Object.keys(topicCounts).reduce((a, b) => 
    topicCounts[a] > topicCounts[b] ? a : b, Object.keys(topicCounts)[0]
  ) || "general";

  // Si le sujet actuel est différent du sujet précédent, c'est un changement
  if (currentTopic !== previousTopic && currentTopic !== "general") {
    console.log(`[CONTEXT FILTER] Changement de sujet détecté: ${previousTopic} -> ${currentTopic}`);
    return { changed: true, newTopic: currentTopic, previousTopic };
  }

  return { changed: false, newTopic: currentTopic };
};

/**
 * Filtre le contexte RAG pour ne garder que les sources pertinentes au sujet
 */
const filterContextByTopic = async (contexts, topic, tenantId) => {
  if (!contexts || contexts.length === 0) {
    return contexts;
  }

  if (!topic || topic === "general") {
    // Pour le sujet général, on garde tout mais on limite à 3 résultats
    return contexts.slice(0, 3);
  }

  try {
    // Récupérer tous les chunks correspondants pour identifier leurs sources
    const { prisma } = require("./prisma");
    
    // Extraire les vectorIds des contexts (on doit les avoir dans les métadonnées)
    // Pour l'instant, on va filtrer par mots-clés dans le contenu
    
    const topicKeywords = {
      "bureaux_coworking": [
        "bureau", "bureaux", "coworking", "espace", "espaces", "salle", "salles",
        "réunion", "réunions", "location", "louer", "prix", "tarif", "tarifs",
        "disponibilité", "disponible", "réservation", "réserver", "surface",
        "m²", "m2", "personnes", "équipe", "équipes", "travail", "travaux"
      ],
      "claviers_equipement": [
        "clavier", "claviers", "azerty", "qwerty", "qwertz", "touches",
        "disposition", "équipement", "équipements", "matériel", "informatique",
        "ordinateur", "pc", "souris", "écran", "moniteur"
      ]
    };

    const keywords = topicKeywords[topic] || [];
    if (keywords.length === 0) {
      return contexts.slice(0, 3);
    }

    // Filtrer les contextes qui contiennent des mots-clés du sujet
    const filteredContexts = contexts.filter(context => {
      if (!context || typeof context !== "string") {
        return false;
      }
      const lowerContext = context.toLowerCase();
      return keywords.some(keyword => lowerContext.includes(keyword));
    });

    // Si on a trouvé des contextes filtrés, on les retourne
    // Sinon, on retourne les 2 premiers pour éviter de mélanger
    if (filteredContexts.length > 0) {
      console.log(`[CONTEXT FILTER] ${filteredContexts.length} contextes filtrés pour le sujet: ${topic}`);
      return filteredContexts.slice(0, 5);
    }

    // Si aucun contexte ne correspond, on retourne seulement le premier
    // pour éviter de mélanger avec d'autres sujets
    console.log(`[CONTEXT FILTER] Aucun contexte ne correspond au sujet ${topic}, limitation à 1 résultat`);
    return contexts.slice(0, 1);
  } catch (error) {
    console.error("[CONTEXT FILTER] Erreur filtrage contexte:", error);
    // En cas d'erreur, on limite à 2 résultats pour éviter le mélange
    return contexts.slice(0, 2);
  }
};

/**
 * Nettoie l'historique de conversation pour ne garder que les messages pertinents au sujet actuel
 */
const filterConversationHistory = (conversationHistory, currentTopic) => {
  if (!conversationHistory || conversationHistory.length === 0) {
    return [];
  }

  if (!currentTopic || currentTopic === "general") {
    // Pour le sujet général, on garde les 5 derniers messages
    return conversationHistory.slice(-5);
  }

  const topicKeywords = {
    "bureaux_coworking": [
      "bureau", "bureaux", "coworking", "espace", "espaces", "salle", "salles",
      "réunion", "réunions", "location", "louer", "prix", "tarif", "tarifs",
      "disponibilité", "disponible", "réservation", "réserver", "surface",
      "m²", "m2", "personnes", "équipe", "équipes", "travail", "travaux"
    ],
    "claviers_equipement": [
      "clavier", "claviers", "azerty", "qwerty", "qwertz", "touches",
      "disposition", "équipement", "équipements", "matériel", "informatique",
      "ordinateur", "pc", "souris", "écran", "moniteur"
    ]
  };

  const keywords = topicKeywords[currentTopic] || [];
  if (keywords.length === 0) {
    return conversationHistory.slice(-5);
  }

  // Garder les messages qui contiennent des mots-clés du sujet
  // Mais toujours garder au moins les 2 derniers messages pour la continuité
  const relevantMessages = conversationHistory.filter(msg => {
    if (!msg.content || typeof msg.content !== "string") {
      return false;
    }
    const lowerContent = msg.content.toLowerCase();
    return keywords.some(keyword => lowerContent.includes(keyword));
  });

  // Si on a des messages pertinents, on les garde + les 2 derniers pour la continuité
  if (relevantMessages.length > 0) {
    const lastTwo = conversationHistory.slice(-2);
    const combined = [...relevantMessages, ...lastTwo];
    // Dédupliquer en gardant l'ordre
    const unique = [];
    const seen = new Set();
    for (const msg of combined) {
      const key = `${msg.role}-${msg.content}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(msg);
      }
    }
    return unique.slice(-5);
  }

  // Si aucun message pertinent, on garde seulement les 2 derniers
  return conversationHistory.slice(-2);
};

module.exports = {
  detectTopic,
  detectTopicChange,
  filterContextByTopic,
  filterConversationHistory,
};
