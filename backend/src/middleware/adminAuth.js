const { prisma } = require("../services/prisma");

/**
 * Middleware pour protéger les routes admin
 * Vérifie que l'utilisateur est un SUPERADMIN
 */
const adminAuthMiddleware = async (req, res, next) => {
  try {
    // Récupérer l'email de l'utilisateur depuis le header (envoyé par le frontend après auth NextAuth)
    const userEmail = req.headers["x-user-email"];
    const userRole = req.headers["x-user-role"];

    // Si le header role est SUPERADMIN, on accepte directement (pour éviter un DB call)
    if (userRole === "SUPERADMIN") {
      req.adminUser = { email: userEmail, role: userRole };
      return next();
    }

    // Sinon, vérifier en DB
    if (!userEmail) {
      return res.status(401).json({ error: "Authentification requise." });
    }

    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      select: { id: true, email: true, role: true, status: true },
    });

    if (!user || user.status !== "active") {
      return res.status(401).json({ error: "Utilisateur invalide." });
    }

    if (user.role !== "SUPERADMIN") {
      return res.status(403).json({ error: "Accès refusé. Rôle SUPERADMIN requis." });
    }

    req.adminUser = user;
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = { adminAuthMiddleware };
