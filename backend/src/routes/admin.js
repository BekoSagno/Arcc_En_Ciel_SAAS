const express = require("express");
const { prisma } = require("../services/prisma");
const { hashPassword } = require("../utils/password");
const { upsertMetaWhatsAppConfig } = require("../services/metaConfigService");
const { adminAuthMiddleware } = require("../middleware/adminAuth");
const { generateInvoice } = require("../services/billingService");

const router = express.Router();

// Appliquer le middleware d'authentification admin sur toutes les routes
router.use("/admin", adminAuthMiddleware);

// ========== TENANTS ==========

// Liste tous les tenants avec statistiques et dernière activité
router.get("/admin/tenants", async (req, res, next) => {
  try {
    const tenants = await prisma.tenant.findMany({
      include: {
        _count: {
          select: {
            users: true,
            conversations: true,
            messages: true,
            ragSources: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Enrichir avec dernière activité réelle
    const tenantsWithActivity = await Promise.all(
      tenants.map(async (tenant) => {
        // Dernière activité = dernier message ou dernière conversation
        const lastMessage = await prisma.message.findFirst({
          where: { tenantId: tenant.id },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        });

        const lastConversation = await prisma.conversation.findFirst({
          where: { tenantId: tenant.id },
          orderBy: { lastMessageAt: "desc" },
          select: { lastMessageAt: true },
        });

        const lastActivity = lastMessage?.createdAt || lastConversation?.lastMessageAt || tenant.updatedAt;

        // Calculer le temps depuis la dernière activité
        const now = new Date();
        const diffMs = now.getTime() - new Date(lastActivity).getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        let lastActivityText = "Jamais";
        if (diffMins < 1) {
          lastActivityText = "À l'instant";
        } else if (diffMins < 60) {
          lastActivityText = `Il y a ${diffMins} min`;
        } else if (diffHours < 24) {
          lastActivityText = `Il y a ${diffHours}h`;
        } else {
          lastActivityText = `Il y a ${diffDays}j`;
        }

        // Vérifier si le tenant a des canaux configurés (facturation OK)
        const hasChannels = await prisma.channelConfig.count({
          where: {
            tenantId: tenant.id,
            status: "active",
          },
        });

        return {
          ...tenant,
          lastActivity: lastActivity,
          lastActivityText: lastActivityText,
          billingStatus: hasChannels > 0 ? "OK" : "À configurer",
        };
      })
    );

    return res.status(200).json({ data: tenantsWithActivity });
  } catch (error) {
    return next(error);
  }
});

// Détails d'un tenant spécifique
router.get("/admin/tenants/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            status: true,
            createdAt: true,
          },
        },
        channelIdentities: true,
        channelConfigs: true,
        _count: {
          select: {
            conversations: true,
            messages: true,
            ragSources: true,
            ragChunks: true,
          },
        },
      },
    });

    if (!tenant) {
      return res.status(404).json({ error: "Tenant introuvable." });
    }

    return res.status(200).json({ data: tenant });
  } catch (error) {
    return next(error);
  }
});

// ===== ABONNEMENTS (SUPERADMIN) =====

// Récupérer l'abonnement actif d'un tenant
router.get("/admin/tenants/:id/subscription", async (req, res, next) => {
  try {
    const { id: tenantId } = req.params;

    const now = new Date();
    const subscription = await prisma.subscription.findFirst({
      where: {
        tenantId,
        status: "active",
        endDate: { gte: now },
      },
      orderBy: { endDate: "desc" },
      include: {
        payments: true,
      },
    });

    return res.status(200).json({ data: subscription });
  } catch (error) {
    return next(error);
  }
});

// Créer / mettre à jour un abonnement pour un tenant (activation manuelle)
router.post("/admin/tenants/:id/subscription", async (req, res, next) => {
  try {
    const { id: tenantId } = req.params;
    const { planType, billingCycle = "monthly", priceGnf, startDate, endDate } =
      req.body || {};

    if (!planType) {
      return res
        .status(400)
        .json({ error: "planType est requis pour créer un abonnement." });
    }

    const now = new Date();
    const start = startDate ? new Date(startDate) : now;
    const end = endDate ? new Date(endDate) : new Date(start);
    if (!endDate) {
      if (billingCycle === "annual") {
        end.setFullYear(end.getFullYear() + 1);
      } else {
        end.setMonth(end.getMonth() + 1);
      }
    }

    const price =
      typeof priceGnf === "number" && priceGnf > 0 ? priceGnf : 0;

    // Clôturer les abonnements existants
    await prisma.subscription.updateMany({
      where: {
        tenantId,
        status: "active",
        endDate: { gt: now },
      },
      data: { status: "expired" },
    });

    // Créer l'abonnement
    const subscription = await prisma.subscription.create({
      data: {
        tenantId,
        planType,
        billingCycle,
        status: "active",
        startDate: start,
        endDate: end,
        nextBillingDate: end,
        priceGnf: price,
        paymentMethod: "manual_admin",
        payments: {
          create: {
            amountGnf: price,
            method: "manual_admin",
            status: "completed",
            paidAt: new Date(),
          },
        },
      },
      include: {
        payments: true,
      },
    });

    // Mettre à jour le plan du tenant
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { planType },
    });

    // Générer une facture liée à cette période
    try {
      await generateInvoice(tenantId, start, end);
    } catch (error) {
      console.error(
        "[ADMIN SUBSCRIPTION] Erreur génération facture:",
        error.message,
      );
    }

    return res.status(201).json({
      data: subscription,
      message: "Abonnement activé manuellement pour ce tenant.",
    });
  } catch (error) {
    return next(error);
  }
});

// Configurer Meta WhatsApp pour un tenant (superadmin uniquement)
router.post("/admin/tenants/:id/meta/whatsapp", async (req, res, next) => {
  try {
    const { id: tenantId } = req.params;
    const { phoneNumberId, wabaId, accessToken } = req.body || {};

    if (!phoneNumberId || !wabaId || !accessToken) {
      return res.status(400).json({
        error:
          "Champs requis manquants. Fournissez phoneNumberId, wabaId et accessToken.",
      });
    }

    const result = await upsertMetaWhatsAppConfig({
      tenantId,
      phoneNumberId: String(phoneNumberId).trim(),
      wabaId: String(wabaId).trim(),
      accessToken: String(accessToken).trim(),
    });

    return res.status(200).json({
      data: {
        tenant: result.tenant,
        channelConfig: result.config,
        channelIdentity: result.identity,
      },
    });
  } catch (error) {
    return next(error);
  }
});

// Créer un nouveau tenant
router.post("/admin/tenants", async (req, res, next) => {
  try {
    const {
      name,
      adminName,
      adminEmail,
      adminPassword,
      whatsappNumber,
      facebookPageId,
      metaAppId,
      metaAppSecret,
      metaVerifyToken,
      status,
      timezone,
      isAiEnabled,
    } = req.body || {};
    if (!name || !adminEmail || !adminPassword) {
      return res.status(400).json({ error: "Champs requis manquants." });
    }

    const tenant = await prisma.tenant.create({
      data: {
        name,
        status: status || "active",
        timezone: timezone || "Africa/Conakry",
        // Par défaut l'IA est activée, mais on peut la désactiver à la création
        isAiEnabled: typeof isAiEnabled === "boolean" ? isAiEnabled : true,
      },
    });

    const passwordHash = await hashPassword(adminPassword);
    const user = await prisma.user.create({
      data: {
        email: adminEmail.trim().toLowerCase(),
        name: adminName && adminName.trim().length > 0 ? adminName.trim() : "Client Admin",
        role: "TENANT_ADMIN",
        passwordHash,
        tenantId: tenant.id,
      },
    });

    if (whatsappNumber) {
      await prisma.channelIdentity.upsert({
        where: {
          channel_externalId: {
            channel: "WHATSAPP",
            externalId: whatsappNumber,
          },
        },
        create: {
          tenantId: tenant.id,
          channel: "WHATSAPP",
          externalId: whatsappNumber,
          label: "Meta WhatsApp",
        },
        update: { tenantId: tenant.id },
      });
    }

    if (facebookPageId) {
      await prisma.channelIdentity.upsert({
        where: {
          channel_externalId: {
            channel: "MESSENGER",
            externalId: facebookPageId,
          },
        },
        create: {
          tenantId: tenant.id,
          channel: "MESSENGER",
          externalId: facebookPageId,
          label: "Facebook Page",
        },
        update: { tenantId: tenant.id },
      });

      await prisma.channelIdentity.upsert({
        where: {
          channel_externalId: {
            channel: "FACEBOOK_COMMENT",
            externalId: facebookPageId,
          },
        },
        create: {
          tenantId: tenant.id,
          channel: "FACEBOOK_COMMENT",
          externalId: facebookPageId,
          label: "Facebook Comments",
        },
        update: { tenantId: tenant.id },
      });
    }

    const channelConfigs = [];
    if (whatsappNumber) {
      channelConfigs.push({
        tenantId: tenant.id,
        channel: "WHATSAPP",
        status: "active",
        credentials: {
          phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
          whatsappNumber: whatsappNumber || "",
        },
      });
    }
    if (facebookPageId || metaAppId || metaAppSecret || metaVerifyToken) {
      channelConfigs.push(
        {
          tenantId: tenant.id,
          channel: "MESSENGER",
          status: "active",
          credentials: {
            appId: metaAppId || "",
            appSecret: metaAppSecret || "",
            verifyToken: metaVerifyToken || "",
            pageId: facebookPageId || "",
          },
        },
        {
          tenantId: tenant.id,
          channel: "FACEBOOK_COMMENT",
          status: "active",
          credentials: {
            appId: metaAppId || "",
            appSecret: metaAppSecret || "",
            verifyToken: metaVerifyToken || "",
            pageId: facebookPageId || "",
          },
        }
      );
    }

    for (const config of channelConfigs) {
      await prisma.channelConfig.upsert({
        where: {
          tenantId_channel: {
            tenantId: config.tenantId,
            channel: config.channel,
          },
        },
        create: config,
        update: {
          status: config.status,
          credentials: config.credentials,
        },
      });
    }

    return res.status(201).json({ data: { tenant, user } });
  } catch (error) {
    return next(error);
  }
});

// Modifier un tenant
router.put("/admin/tenants/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, status, timezone, isAiEnabled } = req.body || {};

    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      return res.status(404).json({ error: "Tenant introuvable." });
    }

    const updated = await prisma.tenant.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(status && { status }),
        ...(timezone && { timezone }),
        ...(typeof isAiEnabled === "boolean" && { isAiEnabled }),
      },
    });

    return res.status(200).json({ data: updated });
  } catch (error) {
    return next(error);
  }
});

// Suspendre/Activer un tenant
router.patch("/admin/tenants/:id/status", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    if (!status || !["active", "suspended", "inactive"].includes(status)) {
      return res.status(400).json({ error: "Statut invalide." });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      return res.status(404).json({ error: "Tenant introuvable." });
    }

    const updated = await prisma.tenant.update({
      where: { id },
      data: { status },
    });

    return res.status(200).json({ data: updated });
  } catch (error) {
    return next(error);
  }
});

// ========== USERS ==========

// Liste des utilisateurs d'un tenant
router.get("/admin/tenants/:tenantId/users", async (req, res, next) => {
  try {
    const { tenantId } = req.params;
    const users = await prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return res.status(200).json({ data: users });
  } catch (error) {
    return next(error);
  }
});

// Créer un utilisateur pour un tenant
router.post("/admin/tenants/:tenantId/users", async (req, res, next) => {
  try {
    const { tenantId } = req.params;
    const { email, name, password, role } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: "Email et mot de passe requis." });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return res.status(404).json({ error: "Tenant introuvable." });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        name: name || "Utilisateur",
        role: role || "TENANT_ADMIN",
        passwordHash,
        tenantId,
      },
    });

    // Ne pas retourner le hash
    const { passwordHash: _, ...userSafe } = user;
    return res.status(201).json({ data: userSafe });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Cet email existe déjà." });
    }
    return next(error);
  }
});

// Modifier un utilisateur
router.put("/admin/users/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, role, status, password } = req.body || {};

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: "Utilisateur introuvable." });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (status !== undefined) updateData.status = status;
    if (password) {
      updateData.passwordHash = await hashPassword(password);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    const { passwordHash: _, ...userSafe } = updated;
    return res.status(200).json({ data: userSafe });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Cet email existe déjà." });
    }
    return next(error);
  }
});

// Désactiver/Activer un utilisateur
router.patch("/admin/users/:id/status", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    if (!status || !["active", "inactive"].includes(status)) {
      return res.status(400).json({ error: "Statut invalide." });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: "Utilisateur introuvable." });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { status },
    });

    const { passwordHash: _, ...userSafe } = updated;
    return res.status(200).json({ data: userSafe });
  } catch (error) {
    return next(error);
  }
});

// ========== STATISTIQUES GLOBALES ==========

router.get("/admin/stats", async (req, res, next) => {
  try {
    const [
      totalTenants,
      activeTenants,
      suspendedTenants,
      totalUsers,
      totalConversations,
      totalMessages,
      totalRAGSources,
      recentMessages,
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { status: "active" } }),
      prisma.tenant.count({ where: { status: "suspended" } }),
      prisma.user.count({ where: { status: "active" } }),
      prisma.conversation.count(),
      prisma.message.count(),
      prisma.rAGSource.count(),
      // Messages des dernières 24h
      prisma.message.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    // Statistiques par tenant (top 10 par activité)
    const tenantsStats = await prisma.tenant.findMany({
      include: {
        _count: {
          select: {
            conversations: true,
            messages: true,
            users: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 10,
    });

    // Enrichir avec dernière activité
    const tenantsWithActivity = await Promise.all(
      tenantsStats.map(async (t) => {
        const lastMessage = await prisma.message.findFirst({
          where: { tenantId: t.id },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        });

        return {
          id: t.id,
          name: t.name,
          status: t.status,
          conversations: t._count.conversations,
          messages: t._count.messages,
          users: t._count.users,
          lastActivity: lastMessage?.createdAt || t.updatedAt,
        };
      })
    );

    // Trier par activité (messages) décroissante
    tenantsWithActivity.sort((a, b) => b.messages - a.messages);

    return res.status(200).json({
      data: {
        overview: {
          totalTenants,
          activeTenants,
          suspendedTenants,
          totalUsers,
          totalConversations,
          totalMessages,
          totalRAGSources,
          recentMessages, // Messages des dernières 24h
        },
        topTenants: tenantsWithActivity,
      },
    });
  } catch (error) {
    return next(error);
  }
});

// ========== NOTIFICATIONS SYSTÈME ==========

/**
 * GET /api/admin/notifications
 * Récupère les notifications système importantes pour le super admin
 * (quota_exceeded, quota_alert, system, etc.) de tous les tenants
 */
router.get("/admin/notifications", async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit || "50");
    const unreadOnly = req.query.unreadOnly === "true";

    // Types de notifications importantes pour le super admin
    const importantTypes = [
      "quota_exceeded",
      "quota_alert",
      "system",
      "billing",
      "handoff", // Handoffs peuvent être importants pour le super admin
    ];

    const where = {
      type: { in: importantTypes },
      ...(unreadOnly ? { read: false } : {}),
    };

    // Récupérer les notifications avec les infos du tenant
    const notifications = await prisma.notification.findMany({
      where,
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            companyName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Compter les notifications non lues
    const unreadCount = await prisma.notification.count({
      where: {
        type: { in: importantTypes },
        read: false,
      },
    });

    // Formater les données pour le frontend
    const formattedNotifications = notifications.map((notif) => ({
      id: notif.id,
      tenantId: notif.tenantId,
      tenantName: notif.tenant?.name || notif.tenant?.companyName || "Tenant inconnu",
      type: notif.type,
      title: notif.title,
      message: notif.message,
      createdAt: notif.createdAt,
      read: notif.read,
      data: notif.data,
    }));

    return res.status(200).json({
      data: formattedNotifications,
      unreadCount,
    });
  } catch (error) {
    console.error("[ADMIN] Erreur récupération notifications:", error);
    return next(error);
  }
});

/**
 * PATCH /api/admin/notifications/:id/read
 * Marquer une notification système comme lue
 */
router.patch("/admin/notifications/:id/read", async (req, res, next) => {
  try {
    const { id } = req.params;

    const notification = await prisma.notification.update({
      where: { id },
      data: { read: true, readAt: new Date() },
    });

    return res.status(200).json(notification);
  } catch (error) {
    return next(error);
  }
});

/**
 * PATCH /api/admin/notifications/read-all
 * Marquer toutes les notifications système comme lues
 */
router.patch("/admin/notifications/read-all", async (req, res, next) => {
  try {
    const importantTypes = [
      "quota_exceeded",
      "quota_alert",
      "system",
      "billing",
      "handoff",
    ];

    await prisma.notification.updateMany({
      where: {
        type: { in: importantTypes },
        read: false,
      },
      data: { read: true, readAt: new Date() },
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
