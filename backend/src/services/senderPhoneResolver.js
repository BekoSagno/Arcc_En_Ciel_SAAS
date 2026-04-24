const { prisma } = require("./prisma");

/**
 * Résout le tenant_id à partir du numéro de téléphone de l'expéditeur.
 * Utilisé pour le routage multi-tenant en mode test avec sécurité stricte.
 * 
 * IMPORTANT: Pas de tenant par défaut - seuls les numéros explicitement mappés sont autorisés.
 * 
 * @param {string} senderPhoneNumber - Numéro de téléphone de l'expéditeur (ex: +224626606960)
 * @returns {Promise<string|null>} - Tenant ID résolu ou null (si non mappé, message ignoré)
 */
const resolveTenantFromSenderPhone = async (senderPhoneNumber) => {
  if (!senderPhoneNumber) {
    console.log("[ROUTAGE] ❌ Numéro expéditeur manquant - Message ignoré pour sécurité");
    return null;
  }

  // Normaliser le numéro (supprimer les espaces, ajouter + si absent)
  let normalizedPhone = senderPhoneNumber.trim().replace(/\s+/g, "");
  
  // Meta envoie les numéros sans le préfixe +, mais on les stocke avec +
  // Ajouter le + si le numéro ne commence pas par +
  if (!normalizedPhone.startsWith("+")) {
    normalizedPhone = "+" + normalizedPhone;
  }

  try {
    // Chercher dans TestNumberMapping
    const mapping = await prisma.testNumberMapping.findUnique({
      where: {
        senderPhoneNumber: normalizedPhone,
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    if (mapping && mapping.isActive) {
      // Vérifier que le tenant est actif
      if (mapping.tenant.status === "active") {
        console.log(`[ROUTAGE] ✅ Message reçu de ${normalizedPhone} -> Associé au Tenant: ${mapping.tenant.name} (${mapping.tenantId})`);
        return mapping.tenantId;
      } else {
        console.log(`[ROUTAGE] ❌ Mapping trouvé mais tenant inactif: ${mapping.tenant.name} - Message ignoré`);
        return null;
      }
    } else if (mapping && !mapping.isActive) {
      console.log(`[ROUTAGE] ❌ Mapping trouvé mais désactivé pour: ${normalizedPhone} - Message ignoré`);
      return null;
    } else {
      console.log(`[ROUTAGE] ❌ Aucun mapping trouvé pour: ${normalizedPhone} - Message ignoré (confidentialité)`);
      return null;
    }
  } catch (error) {
    console.error("[ROUTAGE] Erreur lors de la résolution du tenant:", error);
    return null;
  }
};

module.exports = { resolveTenantFromSenderPhone };
