const { prisma } = require("./prisma");

const resolveTenantId = async (req) => {
  const headerTenant = req.headers["x-tenant-id"];
  if (headerTenant) {
    return headerTenant;
  }

  const envTenant = process.env.DEFAULT_TENANT_ID;
  if (envTenant) {
    return envTenant;
  }

  const firstTenant = await prisma.tenant.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  return firstTenant?.id || null;
};

module.exports = { resolveTenantId };
