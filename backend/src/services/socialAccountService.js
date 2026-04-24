const { prisma } = require("./prisma");
const { encryptToken, decryptToken } = require("./cryptoService");

/**
 * Crée ou met à jour un compte social pour un tenant.
 * Le token est automatiquement chiffré avant stockage.
 *
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string} params.platform - FACEBOOK, INSTAGRAM, LINKEDIN, TIKTOK, TWITTER, THREADS
 * @param {string|null} params.accessToken - Token en clair (sera chiffré)
 * @param {string} params.platformId - ID de la page/compte (page_id, business_id, etc.)
 * @param {boolean} [params.isActive=true]
 * @returns {Promise<object>} Le compte social créé/mis à jour
 */
async function upsertAccount({ tenantId, platform, accessToken, platformId, isActive = true }) {
  if (!tenantId || !platform || !platformId) {
    throw new Error("tenantId, platform et platformId sont requis pour upsertAccount");
  }

  // Valider que la plateforme est valide
  const validPlatforms = ["FACEBOOK", "INSTAGRAM", "LINKEDIN", "TIKTOK", "TWITTER", "THREADS"];
  if (!validPlatforms.includes(platform)) {
    throw new Error(`Plateforme invalide: ${platform}. Valeurs acceptées: ${validPlatforms.join(", ")}`);
  }

  // Chiffrer le token si fourni
  const accessTokenEnc = accessToken ? encryptToken(accessToken) : null;

  const account = await prisma.socialAccount.upsert({
    where: {
      tenantId_platform: {
        tenantId,
        platform,
      },
    },
    update: {
      accessTokenEnc,
      platformId,
      isActive,
      updatedAt: new Date(),
    },
    create: {
      tenantId,
      platform,
      accessTokenEnc,
      platformId,
      isActive,
    },
  });

  console.log(`[SOCIAL-ACCOUNT] ✅ Compte ${platform} ${account.isActive ? "activé" : "désactivé"} pour tenant ${tenantId}`);

  return account;
}

/**
 * Récupère tous les comptes sociaux actifs d'un tenant avec les tokens décryptés.
 * ⚠️ Les tokens sont renvoyés en clair uniquement pour l'usage immédiat
 *    (ex: appels directs aux APIs Meta / LinkedIn / autres réseaux).
 * Ne jamais logger ou exposer ces tokens.
 *
 * @param {string} tenantId
 * @param {boolean} [activeOnly=true] - Si true, ne retourne que les comptes actifs
 * @returns {Promise<Array>} Liste des comptes avec tokens décryptés
 */
async function getDecryptedAccounts(tenantId, activeOnly = true) {
  if (!tenantId) {
    throw new Error("tenantId requis pour getDecryptedAccounts");
  }

  const where = { tenantId };
  if (activeOnly) {
    where.isActive = true;
  }

  const accounts = await prisma.socialAccount.findMany({
    where,
    orderBy: { platform: "asc" },
  });

  // Décrypter les tokens
  const decrypted = accounts.map((account) => {
    let accessToken = null;
    try {
      if (account.accessTokenEnc) {
        accessToken = decryptToken(account.accessTokenEnc);
      }
    } catch (error) {
      console.error(`[SOCIAL-ACCOUNT] ⚠️ Erreur décryptage token pour ${account.platform} (tenant ${tenantId}):`, error.message);
      // Continuer sans token si le décryptage échoue
    }

    return {
      id: account.id,
      tenantId: account.tenantId,
      platform: account.platform,
      accessToken, // ⚠️ Token en clair - à utiliser immédiatement, ne pas logger
      platformId: account.platformId,
      isActive: account.isActive,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  });

  console.log(`[SOCIAL-ACCOUNT] 📋 ${decrypted.length} compte(s) ${activeOnly ? "actif(s)" : ""} récupéré(s) pour tenant ${tenantId}`);

  return decrypted;
}

/**
 * Récupère un compte spécifique avec token décrypté.
 *
 * @param {string} tenantId
 * @param {string} platform
 * @returns {Promise<object|null>} Le compte avec token décrypté, ou null si non trouvé
 */
async function getDecryptedAccount(tenantId, platform) {
  if (!tenantId || !platform) {
    throw new Error("tenantId et platform sont requis pour getDecryptedAccount");
  }

  const account = await prisma.socialAccount.findUnique({
    where: {
      tenantId_platform: {
        tenantId,
        platform,
      },
    },
  });

  if (!account) {
    return null;
  }

  let accessToken = null;
  try {
    if (account.accessTokenEnc) {
      accessToken = decryptToken(account.accessTokenEnc);
    }
  } catch (error) {
    console.error(`[SOCIAL-ACCOUNT] ⚠️ Erreur décryptage token pour ${platform} (tenant ${tenantId}):`, error.message);
  }

  return {
    id: account.id,
    tenantId: account.tenantId,
    platform: account.platform,
    accessToken,
    platformId: account.platformId,
    isActive: account.isActive,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

/**
 * Désactive un compte social (soft delete).
 *
 * @param {string} tenantId
 * @param {string} platform
 * @returns {Promise<object>} Le compte mis à jour
 */
async function deactivateAccount(tenantId, platform) {
  if (!tenantId || !platform) {
    throw new Error("tenantId et platform sont requis pour deactivateAccount");
  }

  const account = await prisma.socialAccount.update({
    where: {
      tenantId_platform: {
        tenantId,
        platform,
      },
    },
    data: {
      isActive: false,
      updatedAt: new Date(),
    },
  });

  console.log(`[SOCIAL-ACCOUNT] 🔒 Compte ${platform} désactivé pour tenant ${tenantId}`);

  return account;
}

module.exports = {
  upsertAccount,
  getDecryptedAccounts,
  getDecryptedAccount,
  deactivateAccount,
};
