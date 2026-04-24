const axios = require("axios");
const { prisma } = require("./prisma");
const { ingestSource } = require("./ragIngestor");
const { getDecryptedAccount } = require("./socialAccountService");

/**
 * Crée une annonce (brouillon) et ses cibles de publication.
 *
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string} params.body - Contenu principal de l'annonce
 * @param {string[]} [params.mediaUrls] - URLs d'images éventuellement associées
 * @param {string[]} [params.networks] - Réseaux cibles (ex: ["FACEBOOK_PAGE"])
 * @param {string} [params.title]
 * @param {Date} [params.scheduledAt]
 */
async function createSocialPost({
  tenantId,
  body,
  mediaUrls = [],
  networks = ["FACEBOOK"],
  title = null,
  scheduledAt = null,
}) {
  if (!tenantId) {
    throw new Error("tenantId requis pour createSocialPost");
  }
  if (!body || !body.trim()) {
    throw new Error("Le contenu de l'annonce (body) est requis");
  }

  const post = await prisma.socialPost.create({
    data: {
      tenantId,
      title,
      body: body.trim(),
      mediaUrls,
      status: scheduledAt ? "scheduled" : "draft",
      scheduledAt,
      targets: {
        create: networks.map((network) => ({
          network,
          status: "pending",
        })),
      },
    },
    include: {
      targets: true,
    },
  });

  console.log("[SOCIAL] 📝 Annonce créée:", {
    id: post.id,
    tenantId,
    networks,
    scheduledAt,
  });

  return post;
}

/**
 * Publication directe sur Instagram pour un tenant donné (connexion Meta directe).
 * Utilise l'Instagram Business ID + Token stockés dans SocialAccount.
 */
async function publishToInstagram({ tenantId, post }) {
  const results = [];

  try {
    const account = await getDecryptedAccount(tenantId, "INSTAGRAM");
    if (!account || !account.isActive) {
      console.warn(
        `[SOCIAL] ⚠️ Aucun compte INSTAGRAM actif pour le tenant ${tenantId}`
      );
      results.push({
        network: "INSTAGRAM",
        status: "failed",
        externalId: null,
        error: "Compte INSTAGRAM non configuré ou inactif pour ce tenant",
      });
      return results;
    }

    if (!account.accessToken || !account.platformId) {
      console.warn(
        `[SOCIAL] ⚠️ Compte INSTAGRAM incomplet (token ou platformId manquant) pour tenant ${tenantId}`
      );
      results.push({
        network: "INSTAGRAM",
        status: "failed",
        externalId: null,
        error: "Token ou Instagram Business ID manquant pour ce tenant",
      });
      return results;
    }

    // Log de debug sans exposer le token
    console.log(
      `[SOCIAL] 📸 Publication Instagram pour tenant ${tenantId} via IG Business ID ${account.platformId}`
    );
    console.log(
      `[DEBUG] Jeton Instagram récupéré, longueur : ${
        account.accessToken ? account.accessToken.length : 0
      }`
    );

    const graphBase =
      process.env.META_GRAPH_BASE_URL || "https://graph.facebook.com";
    const graphVersion = process.env.META_GRAPH_VERSION || "v19.0";

    const igUserId = account.platformId; // Instagram Business ID
    const caption = post.body || "";

    const mediaUrls = Array.isArray(post.mediaUrls)
      ? post.mediaUrls
          .map((u) => (typeof u === "string" ? u.trim() : ""))
          .filter((u) => u.length > 0)
      : [];

    if (!mediaUrls.length) {
      console.warn(
        `[SOCIAL] ⚠️ Aucune image fournie pour la publication Instagram (post ${post.id}, tenant ${tenantId})`
      );
      results.push({
        network: "INSTAGRAM",
        status: "failed",
        externalId: null,
        error: "Aucune image fournie pour la publication Instagram",
      });
      return results;
    }

    const createUrl = `${graphBase}/${graphVersion}/${igUserId}/media`;
    const publishUrl = `${graphBase}/${graphVersion}/${igUserId}/media_publish`;

    // -------------------------------------------------------------------
    // CAS 1 : une seule image -> comportement simple (post image unique)
    // -------------------------------------------------------------------
    if (mediaUrls.length === 1) {
      const imageUrl = mediaUrls[0];

      console.log("[SOCIAL] 🔄 Appel Graph API Instagram /media:", createUrl);

      const createResp = await axios.post(
        createUrl,
        {
          image_url: imageUrl,
          caption,
          access_token: account.accessToken,
        },
        { validateStatus: () => true }
      );

      if (createResp.status < 200 || createResp.status >= 300) {
        console.error(
          "[SOCIAL] ❌ Erreur création media Instagram:",
          createResp.status,
          createResp.data
        );
        results.push({
          network: "INSTAGRAM",
          status: "failed",
          externalId: null,
          error:
            createResp.data?.error?.message ||
            `Erreur création media Instagram (HTTP ${createResp.status})`,
        });
        return results;
      }

      const creationId = createResp.data?.id;
      console.log("[SOCIAL] 📸 Media container créé:", creationId);
      console.log(
        `[INSTAGRAM] Étape 1 : Conteneur OK (ID: ${creationId || "inconnu"})`
      );

      if (!creationId) {
        results.push({
          network: "INSTAGRAM",
          status: "failed",
          externalId: null,
          error: "Réponse /media invalide : id manquant",
        });
        return results;
      }

      console.log(
        "[SOCIAL] 🚀 Appel Graph API Instagram /media_publish:",
        publishUrl
      );

      const publishResp = await axios.post(
        publishUrl,
        {
          creation_id: creationId,
          access_token: account.accessToken,
        },
        { validateStatus: () => true }
      );

      if (publishResp.status < 200 || publishResp.status >= 300) {
        console.error(
          "[SOCIAL] ❌ Erreur publication Instagram:",
          publishResp.status,
          publishResp.data
        );
        results.push({
          network: "INSTAGRAM",
          status: "failed",
          externalId: creationId,
          error:
            publishResp.data?.error?.message ||
            `Erreur publication Instagram (HTTP ${publishResp.status})`,
        });
        return results;
      }

      const publishedId = publishResp.data?.id || creationId;
      console.log("[SOCIAL] ✅ Publication Instagram réussie:", publishedId);
      console.log(
        `[INSTAGRAM] Étape 2 : Publication terminée ! (Post ID: ${
          publishedId || "inconnu"
        })`
      );

      results.push({
        network: "INSTAGRAM",
        status: "published",
        externalId: publishedId,
        error: null,
      });
      return results;
    }

    // -------------------------------------------------------------------
    // CAS 2 : plusieurs images -> créer un CARROUSEL
    // -------------------------------------------------------------------
    const maxItems = Math.min(mediaUrls.length, 10); // Limite Instagram : 10 items max
    const childIds = [];

    console.log(
      `[SOCIAL] 📸 Publication carrousel Instagram avec ${maxItems} image(s) pour tenant ${tenantId}`
    );

    // 1) Créer un media container pour chaque image (is_carousel_item = true)
    for (let index = 0; index < maxItems; index++) {
      const imageUrl = mediaUrls[index];
      console.log(
        `[SOCIAL] 🔄 Création item carrousel ${index + 1}/${maxItems}: ${imageUrl}`
      );

      const itemResp = await axios.post(
        createUrl,
        {
          image_url: imageUrl,
          is_carousel_item: true,
          access_token: account.accessToken,
        },
        { validateStatus: () => true }
      );

      if (itemResp.status < 200 || itemResp.status >= 300) {
        console.error(
          "[SOCIAL] ❌ Erreur création item carrousel Instagram:",
          itemResp.status,
          itemResp.data
        );
        results.push({
          network: "INSTAGRAM",
          status: "failed",
          externalId: null,
          error:
            itemResp.data?.error?.message ||
            `Erreur création item carrousel Instagram (HTTP ${itemResp.status})`,
        });
        return results;
      }

      const itemId = itemResp.data?.id;
      if (!itemId) {
        console.error(
          "[SOCIAL] ❌ Réponse /media invalide pour item carrousel (id manquant):",
          itemResp.data
        );
        results.push({
          network: "INSTAGRAM",
          status: "failed",
          externalId: null,
          error: "Réponse /media invalide pour un item de carrousel (id manquant)",
        });
        return results;
      }

      childIds.push(itemId);
    }

    console.log(
      "[SOCIAL] 📸 Items carrousel créés avec succès:",
      childIds.join(", ")
    );
    console.log(
      `[INSTAGRAM] Étape 1 : Items carrousel OK (${childIds.length} items)`
    );

    // 2) Créer le container CAROUSEL
    console.log(
      "[SOCIAL] 🔄 Création du container CAROUSEL Instagram avec children:",
      childIds.join(", ")
    );

    const carouselResp = await axios.post(
      createUrl,
      {
        media_type: "CAROUSEL",
        children: childIds,
        caption,
        access_token: account.accessToken,
      },
      { validateStatus: () => true }
    );

    if (carouselResp.status < 200 || carouselResp.status >= 300) {
      console.error(
        "[SOCIAL] ❌ Erreur création container CAROUSEL Instagram:",
        carouselResp.status,
        carouselResp.data
      );
      results.push({
        network: "INSTAGRAM",
        status: "failed",
        externalId: null,
        error:
          carouselResp.data?.error?.message ||
          `Erreur création container CAROUSEL Instagram (HTTP ${carouselResp.status})`,
      });
      return results;
    }

    const carouselId = carouselResp.data?.id;
    console.log("[SOCIAL] 📸 Container CAROUSEL créé:", carouselId);
    console.log(
      `[INSTAGRAM] Étape 2 : Container CAROUSEL OK (ID: ${carouselId || "inconnu"})`
    );

    if (!carouselId) {
      results.push({
        network: "INSTAGRAM",
        status: "failed",
        externalId: null,
        error: "Réponse /media invalide pour le carrousel (id manquant)",
      });
      return results;
    }

    // 3) Publier le carrousel
    console.log(
      "[SOCIAL] 🚀 Appel Graph API Instagram /media_publish (CAROUSEL):",
      publishUrl
    );

    const publishResp = await axios.post(
      publishUrl,
      {
        creation_id: carouselId,
        access_token: account.accessToken,
      },
      { validateStatus: () => true }
    );

    if (publishResp.status < 200 || publishResp.status >= 300) {
      console.error(
        "[SOCIAL] ❌ Erreur publication CAROUSEL Instagram:",
        publishResp.status,
        publishResp.data
      );
      results.push({
        network: "INSTAGRAM",
        status: "failed",
        externalId: carouselId,
        error:
          publishResp.data?.error?.message ||
          `Erreur publication CAROUSEL Instagram (HTTP ${publishResp.status})`,
      });
      return results;
    }

    const publishedId = publishResp.data?.id || carouselId;
    console.log("[SOCIAL] ✅ Publication CAROUSEL Instagram réussie:", publishedId);
    console.log(
      `[INSTAGRAM] Étape 3 : Publication terminée ! (Post ID: ${
        publishedId || "inconnu"
      })`
    );

    results.push({
      network: "INSTAGRAM",
      status: "published",
      externalId: publishedId,
      error: null,
    });
    return results;
  } catch (error) {
    console.error(
      "[SOCIAL] ❌ Exception lors de la publication Instagram:",
      error.message
    );
    results.push({
      network: "INSTAGRAM",
      status: "failed",
      externalId: null,
      error: error.message,
    });
    return results;
  }
}

/**
 * Publication directe sur Facebook (Page) pour un tenant donné.
 * Utilise le page_id + token stockés dans SocialAccount.
 */
async function publishToFacebook({ tenantId, post }) {
  const results = [];

  try {
    const account = await getDecryptedAccount(tenantId, "FACEBOOK");
    if (!account || !account.isActive) {
      console.warn(
        `[SOCIAL] ⚠️ Aucun compte FACEBOOK actif pour le tenant ${tenantId}`
      );
      results.push({
        network: "FACEBOOK",
        status: "failed",
        externalId: null,
        error: "Compte FACEBOOK non configuré ou inactif pour ce tenant",
      });
      return results;
    }

    if (!account.accessToken || !account.platformId) {
      console.warn(
        `[SOCIAL] ⚠️ Compte FACEBOOK incomplet (token ou platformId manquant) pour tenant ${tenantId}`
      );
      results.push({
        network: "FACEBOOK",
        status: "failed",
        externalId: null,
        error: "Token ou Page ID Facebook manquant pour ce tenant",
      });
      return results;
    }

    const graphBase =
      process.env.META_GRAPH_BASE_URL || "https://graph.facebook.com";
    const graphVersion = process.env.META_GRAPH_VERSION || "v19.0";

    const pageId = account.platformId;
    const caption = post.body || "";

    const mediaUrls = Array.isArray(post.mediaUrls)
      ? post.mediaUrls
          .map((u) => (typeof u === "string" ? u.trim() : ""))
          .filter((u) => u.length > 0)
      : [];

    console.log(
      `[SOCIAL] 📘 Publication Facebook pour tenant ${tenantId} via Page ID ${pageId}`
    );
    console.log(
      `[DEBUG] Jeton Facebook récupéré, longueur : ${
        account.accessToken ? account.accessToken.length : 0
      }`
    );

    let publishUrl;
    let payload;

    // -------------------------------------------------------------
    // CAS 1 : aucune image -> post texte simple sur le feed
    // -------------------------------------------------------------
    if (!mediaUrls.length) {
      // Publication texte seule
      publishUrl = `${graphBase}/${graphVersion}/${pageId}/feed`;
      payload = {
        message: caption,
        access_token: account.accessToken,
      };
      console.log("[SOCIAL] 🔄 Appel Graph API Facebook /feed:", publishUrl);
      const resp = await axios.post(publishUrl, payload, {
        validateStatus: () => true,
      });

      if (resp.status < 200 || resp.status >= 300) {
        console.error(
          "[SOCIAL] ❌ Erreur publication Facebook:",
          resp.status,
          resp.data
        );
        results.push({
          network: "FACEBOOK",
          status: "failed",
          externalId: null,
          error:
            resp.data?.error?.message ||
            `Erreur publication Facebook (HTTP ${resp.status})`,
        });
        return results;
      }

      const externalId = resp.data?.id || resp.data?.post_id || null;
      console.log("[SOCIAL] ✅ Publication Facebook réussie:", externalId);

      results.push({
        network: "FACEBOOK",
        status: "published",
        externalId,
        error: null,
      });
      return results;
    }

    // -------------------------------------------------------------
    // CAS 2 : une seule image -> /photos simple (comme avant)
    // -------------------------------------------------------------
    if (mediaUrls.length === 1) {
      const imageUrl = mediaUrls[0];
      publishUrl = `${graphBase}/${graphVersion}/${pageId}/photos`;
      payload = {
        url: imageUrl,
        caption,
        access_token: account.accessToken,
      };
      console.log("[SOCIAL] 🔄 Appel Graph API Facebook /photos:", publishUrl);

      const resp = await axios.post(publishUrl, payload, {
        validateStatus: () => true,
      });

      if (resp.status < 200 || resp.status >= 300) {
        console.error(
          "[SOCIAL] ❌ Erreur publication Facebook:",
          resp.status,
          resp.data
        );
        results.push({
          network: "FACEBOOK",
          status: "failed",
          externalId: null,
          error:
            resp.data?.error?.message ||
            `Erreur publication Facebook (HTTP ${resp.status})`,
        });
        return results;
      }

      const externalId = resp.data?.id || resp.data?.post_id || null;
      console.log("[SOCIAL] ✅ Publication Facebook réussie:", externalId);

      results.push({
        network: "FACEBOOK",
        status: "published",
        externalId,
        error: null,
      });
      return results;
    }

    // -------------------------------------------------------------
    // CAS 3 : plusieurs images -> post multi-photos via attached_media
    // -------------------------------------------------------------
    const maxItems = Math.min(mediaUrls.length, 10);
    const photoIds = [];

    console.log(
      `[SOCIAL] 📘 Publication Facebook multi-images avec ${maxItems} image(s) pour tenant ${tenantId}`
    );

    // 1) Créer des photos non publiées pour chaque image
    for (let index = 0; index < maxItems; index++) {
      const imageUrl = mediaUrls[index];
      const photosUrl = `${graphBase}/${graphVersion}/${pageId}/photos`;

      console.log(
        `[SOCIAL] 🔄 Création photo non publiée ${index + 1}/${maxItems}: ${imageUrl}`
      );

      const photoResp = await axios.post(
        photosUrl,
        {
          url: imageUrl,
          published: false,
          access_token: account.accessToken,
        },
        { validateStatus: () => true }
      );

      if (photoResp.status < 200 || photoResp.status >= 300) {
        console.error(
          "[SOCIAL] ❌ Erreur création photo non publiée Facebook:",
          photoResp.status,
          photoResp.data
        );
        results.push({
          network: "FACEBOOK",
          status: "failed",
          externalId: null,
          error:
            photoResp.data?.error?.message ||
            `Erreur création photo Facebook (HTTP ${photoResp.status})`,
        });
        return results;
      }

      const photoId = photoResp.data?.id;
      if (!photoId) {
        console.error(
          "[SOCIAL] ❌ Réponse /photos invalide pour photo non publiée (id manquant):",
          photoResp.data
        );
        results.push({
          network: "FACEBOOK",
          status: "failed",
          externalId: null,
          error: "Réponse /photos invalide pour une photo non publiée (id manquant)",
        });
        return results;
      }

      photoIds.push(photoId);
    }

    console.log(
      "[SOCIAL] 📘 Photos non publiées créées avec succès:",
      photoIds.join(", ")
    );

    // 2) Créer le post sur /feed avec attached_media
    const feedUrl = `${graphBase}/${graphVersion}/${pageId}/feed`;
    const attached_media = photoIds.map((id) => ({ media_fbid: id }));

    console.log(
      "[SOCIAL] 🔄 Appel Graph API Facebook /feed (multi-images):",
      feedUrl
    );

    const resp = await axios.post(
      feedUrl,
      {
        message: caption,
        attached_media,
        access_token: account.accessToken,
      },
      { validateStatus: () => true }
    );

    if (resp.status < 200 || resp.status >= 300) {
      console.error(
        "[SOCIAL] ❌ Erreur publication Facebook multi-images:",
        resp.status,
        resp.data
      );
      results.push({
        network: "FACEBOOK",
        status: "failed",
        externalId: null,
        error:
          resp.data?.error?.message ||
          `Erreur publication Facebook multi-images (HTTP ${resp.status})`,
      });
      return results;
    }

    const externalId = resp.data?.id || resp.data?.post_id || null;
    console.log(
      "[SOCIAL] ✅ Publication Facebook multi-images réussie:",
      externalId
    );

    results.push({
      network: "FACEBOOK",
      status: "published",
      externalId,
      error: null,
    });
    return results;
  } catch (error) {
    console.error(
      "[SOCIAL] ❌ Exception lors de la publication Facebook:",
      error.message
    );
    results.push({
      network: "FACEBOOK",
      status: "failed",
      externalId: null,
      error: error.message,
    });
    return results;
  }
}

/**
 * Publie une annonce sur toutes ses cibles configurées (APIs sociales directes).
 *
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string} params.postId
 */
async function publishSocialPostNow({ tenantId, postId }) {
  if (!tenantId || !postId) {
    throw new Error("tenantId et postId sont requis pour publishSocialPostNow");
  }

  const post = await prisma.socialPost.findFirst({
    where: { id: postId, tenantId },
    include: { targets: true },
  });

  if (!post) {
    throw new Error("Annonce introuvable pour ce tenant");
  }

  console.log("[SOCIAL] 🚀 Publication de l'annonce demandée:", {
    id: post.id,
    tenantId,
    targetCount: post.targets.length,
  });

  let results = [];

  // Publication directe selon les réseaux cibles
  const targetNetworks = post.targets.map((t) => t.network);

  // Instagram
  if (targetNetworks.includes("INSTAGRAM")) {
    const igResults = await publishToInstagram({ tenantId, post });
    results.push(...igResults);
  }

  // Facebook (Page)
  if (targetNetworks.includes("FACEBOOK")) {
    const fbResults = await publishToFacebook({ tenantId, post });
    results.push(...fbResults);
  }

  // Si aucun résultat (aucun réseau supporté), marquer comme failed
  if (results.length === 0) {
    console.warn(
      "[SOCIAL] ⚠️ Aucun réseau supporté trouvé pour cette annonce. Aucune publication externe effectuée."
    );
    for (const target of post.targets) {
      await prisma.socialPostTarget.update({
        where: { id: target.id },
        data: {
          status: "failed",
          errorMessage: "Aucun réseau de publication supporté",
        },
      });
      results.push({
        network: target.network,
        status: "failed",
        error: "Réseau non supporté",
      });
    }
  }

  // Mettre à jour le statut de chaque cible en fonction des résultats
  for (const target of post.targets) {
    const resultForNetwork = results.find(
      (r) => r.network === target.network
    );

    if (!resultForNetwork) {
      continue;
    }

    let targetStatus = target.status;
    let errorMessage = target.errorMessage || null;
    let externalId = target.externalId || null;
    let publishedAt = target.publishedAt || null;

    if (
      resultForNetwork.status === "published" ||
      resultForNetwork.status === "already_published"
    ) {
      targetStatus = "published";
      externalId = resultForNetwork.externalId || externalId;
      publishedAt = new Date();
      errorMessage = null;
    } else if (resultForNetwork.status === "failed") {
      targetStatus = "failed";
      errorMessage = resultForNetwork.error || errorMessage;
      externalId = resultForNetwork.externalId || externalId;
    } else if (resultForNetwork.status === "publishing") {
      targetStatus = "publishing";
    }

    await prisma.socialPostTarget.update({
      where: { id: target.id },
      data: {
        status: targetStatus,
        errorMessage,
        externalId,
        publishedAt,
      },
    });
  }

  // Mettre à jour le statut global du post
  const hasFailure = results.some((r) => r.status === "failed");
  const allPublished = results.length > 0 && results.every((r) => r.status === "published" || r.status === "already_published");

  const updatedPost = await prisma.socialPost.update({
    where: { id: post.id },
    data: {
      status: hasFailure ? "failed" : allPublished ? "published" : "publishing",
      publishedAt: allPublished ? new Date() : post.publishedAt,
    },
    include: { targets: true },
  });

  // Indexer l'annonce dans Pinecone pour la mémoire IA (si publication réussie)
  // Cela permet à l'IA de répondre aux commentaires sur cette annonce
  if (allPublished && !hasFailure) {
    console.log(
      `[SOCIAL-RAG] 🧠 Indexation de l'annonce ${post.id} dans Pinecone pour la mémoire IA...`
    );
    try {
      await indexSocialPostInPinecone({ tenantId, post: updatedPost });
    } catch (error) {
      // Ne pas faire échouer la publication si l'indexation échoue
      console.error(`[SOCIAL-RAG] ⚠️ Échec de l'indexation (non bloquant):`, error.message);
    }
  }

  return { post: updatedPost, results };
}

/**
 * Indexe une annonce dans Pinecone pour la mémoire IA.
 * Permet à l'IA de répondre aux commentaires sur cette annonce en utilisant le contenu de l'annonce.
 *
 * @param {object} params
 * @param {string} params.tenantId
 * @param {object} params.post - L'annonce SocialPost à indexer
 */
async function indexSocialPostInPinecone({ tenantId, post }) {
  if (!tenantId || !post) {
    console.warn("[SOCIAL-RAG] ⚠️ Paramètres manquants pour l'indexation Pinecone");
    return null;
  }

  try {
    // Vérifier si l'annonce est déjà indexée (éviter les doublons)
    const existingSource = await prisma.rAGSource.findFirst({
      where: {
        tenantId,
        title: `Annonce: ${post.id}`,
        type: "TEXT",
      },
    });

    if (existingSource) {
      console.log(`[SOCIAL-RAG] ✅ Annonce ${post.id} déjà indexée (RAGSource: ${existingSource.id})`);
      return existingSource;
    }

    // Construire le contenu à indexer (titre + body + réseaux)
    const contentParts = [];
    if (post.title) {
      contentParts.push(`Titre: ${post.title}`);
    }
    contentParts.push(`Contenu: ${post.body}`);
    if (post.targets && post.targets.length > 0) {
      const networks = post.targets.map((t) => t.network).join(", ");
      contentParts.push(`Réseaux de publication: ${networks}`);
    }
    if (post.mediaUrls && post.mediaUrls.length > 0) {
      contentParts.push(`Images associées: ${post.mediaUrls.join(", ")}`);
    }

    const contentToIndex = contentParts.join("\n\n");

    // Créer un RAGSource de type TEXT pour cette annonce
    const ragSource = await prisma.rAGSource.create({
      data: {
        tenantId,
        type: "TEXT",
        title: `Annonce: ${post.id}`,
        sourceUrl: null, // Pas d'URL pour une annonce
        status: "active",
      },
    });

    console.log(`[SOCIAL-RAG] 📝 RAGSource créé pour annonce ${post.id} (RAGSource ID: ${ragSource.id})`);

    // Indexer le contenu dans Pinecone avec metadata spécifiques pour les annonces
    const namespace = tenantId; // Utiliser le tenantId comme namespace (cohérent avec le système RAG)

    // Utiliser ingestSource pour la compatibilité avec le système RAG (RAGSource + RAGChunk)
    // Mais on va aussi ajouter directement dans Pinecone avec les metadata demandées
    await ingestSource({
      tenantId,
      sourceId: ragSource.id,
      namespace,
      content: contentToIndex,
    });

    // Indexation directe supplémentaire avec metadata spécifiques pour les annonces sociales
    // Cela permet à l'IA de savoir que c'est une annonce publiée
    try {
      const { getEmbeddings } = require("./googleAiService");
      const { getPineconeIndex } = require("./pineconeClient");

      // Générer l'embedding du texte complet (pas chunké pour cette indexation)
      const embedding = await getEmbeddings(post.body);

      // Adapter la dimension si nécessaire (768 par défaut)
      const PINECONE_DIM = Number(process.env.PINECONE_DIM || "768");
      let vector = embedding;
      if (vector.length !== PINECONE_DIM) {
        if (vector.length > PINECONE_DIM) {
          vector = vector.slice(0, PINECONE_DIM);
        } else {
          console.warn(`[SOCIAL-RAG] ⚠️ Dimension embedding (${vector.length}) < PINECONE_DIM (${PINECONE_DIM}), padding avec zéros`);
          vector = [...vector, ...Array(PINECONE_DIM - vector.length).fill(0)];
        }
      }

      const pinecone = getPineconeIndex();
      const vectorId = `social_post_${post.id}`;

      // Upsert avec metadata spécifiques pour les annonces sociales
      await pinecone.namespace(namespace).upsert([
        {
          id: vectorId,
          values: vector,
          metadata: {
            source: "social_post",
            text: post.body,
            id: post.id,
            tenantId: String(tenantId),
            postId: String(post.id),
            title: post.title || "",
            networks: post.targets?.map((t) => t.network).join(",") || "",
          },
        },
      ]);

      console.log(
        `[SOCIAL-RAG] ✅ Annonce ${post.id} indexée directement dans Pinecone avec metadata social_post`
      );
    } catch (error) {
      console.warn(`[SOCIAL-RAG] ⚠️ Indexation directe Pinecone échouée (non bloquant):`, error.message);
      // On continue même si cette indexation échoue, car ingestSource a déjà fait le travail
    }

    console.log(
      `[SOCIAL-RAG] ✅ Annonce ${post.id} indexée dans Pinecone avec succès (namespace: ${namespace})`
    );
    console.log(
      `[IA] Mémorisation dans Pinecone réussie pour l'annonce ${post.id}`
    );

    return ragSource;
  } catch (error) {
    console.error(`[SOCIAL-RAG] ❌ Erreur lors de l'indexation de l'annonce ${post.id}:`, error);
    // Ne pas faire échouer la publication si l'indexation échoue
    // L'annonce est quand même publiée, mais ne sera pas disponible pour la mémoire IA
    return null;
  }
}

module.exports = {
  createSocialPost,
  publishSocialPostNow,
  indexSocialPostInPinecone,
};

