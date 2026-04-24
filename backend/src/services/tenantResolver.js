const { prisma } = require("./prisma");

const resolveTenantId = async ({ channel, externalId }) => {
  if (!channel || !externalId) {
    return null;
  }

  const mapping = await prisma.channelIdentity.findUnique({
    where: {
      channel_externalId: {
        channel,
        externalId,
      },
    },
    select: { tenantId: true },
  });

  return mapping?.tenantId || null;
};

module.exports = { resolveTenantId };
