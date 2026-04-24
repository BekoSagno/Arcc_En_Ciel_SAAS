const { prisma } = require("../services/prisma");

const resolveTenantFromHeader = (req) => {
  const headerValue = req.headers["x-tenant-id"];
  if (!headerValue) {
    return null;
  }
  return headerValue;
};

const tenantMiddleware = async (req, res, next) => {
  try {
    const tenantId = resolveTenantFromHeader(req);
    if (!tenantId) {
      req.tenantId = null;
      return next();
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, status: true },
    });

    if (!tenant || tenant.status !== "active") {
      return res.status(403).json({ error: "Tenant invalide." });
    }

    req.tenantId = tenant.id;
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = { tenantMiddleware };
