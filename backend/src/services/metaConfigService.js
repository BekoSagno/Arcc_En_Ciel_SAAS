const { prisma } = require("./prisma");
const { encryptToken } = require("./cryptoService");

/**
 * Crée ou met à jour la configuration Meta WhatsApp pour un tenant.
 *
 * @param {Object} params
 * @param {string} params.tenantId
 * @param {string} params.phoneNumberId
 * @param {string} params.wabaId
 * @param {string} params.accessToken
 * @returns {Promise<{ tenant: any, config: any, identity: any }>}
 */
async function upsertMetaWhatsAppConfig({
  tenantId,
  phoneNumberId,
  wabaId,
  accessToken,
}) {
  if (!tenantId || !phoneNumberId || !wabaId || !accessToken) {
    throw new Error("Paramètres manquants pour la configuration Meta WhatsApp.");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true },
  });

  if (!tenant) {
    throw new Error(`Tenant introuvable pour id: ${tenantId}`);
  }

  const channel = "WHATSAPP";

  const config = await prisma.channelConfig.upsert({
    where: {
      tenantId_channel: {
        tenantId,
        channel,
      },
    },
    create: {
      tenantId,
      channel,
      status: "active",
      credentials: {
        phoneNumberId,
        wabaId,
        accessToken: encryptToken(accessToken),
      },
    },
    update: {
      status: "active",
      credentials: {
        phoneNumberId,
        wabaId,
        accessToken: encryptToken(accessToken),
      },
    },
  });

  const identity = await prisma.channelIdentity.upsert({
    where: {
      channel_externalId: {
        channel,
        externalId: phoneNumberId,
      },
    },
    create: {
      tenantId,
      channel,
      externalId: phoneNumberId,
      label: "Meta WhatsApp",
    },
    update: {
      tenantId,
      label: "Meta WhatsApp",
    },
  });

  return { tenant, config, identity };
}

module.exports = {
  upsertMetaWhatsAppConfig,
};

