const { PrismaClient } = require("@prisma/client");
const { hashPassword } = require("../src/utils/password");

const prisma = new PrismaClient();

const run = async () => {
  const tenantName = process.env.SEED_TENANT_NAME || "Arcc En Ciel";
  const whatsappNumber = process.env.SEED_WHATSAPP_NUMBER || "";
  const facebookPageId = process.env.SEED_FACEBOOK_PAGE_ID || "";
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "";
  const superAdminEmail = process.env.SEED_SUPERADMIN_EMAIL || "";
  const superAdminPassword = process.env.SEED_SUPERADMIN_PASSWORD || "";

  const tenant = await prisma.tenant.upsert({
    where: { name: tenantName },
    create: { name: tenantName },
    update: {},
  });

  const identities = [];
  if (whatsappNumber) {
    identities.push({
      tenantId: tenant.id,
      channel: "WHATSAPP",
      externalId: whatsappNumber,
      label: "Meta WhatsApp",
    });
  }
  if (facebookPageId) {
    identities.push({
      tenantId: tenant.id,
      channel: "MESSENGER",
      externalId: facebookPageId,
      label: "Facebook Page",
    });
    identities.push({
      tenantId: tenant.id,
      channel: "FACEBOOK_COMMENT",
      externalId: facebookPageId,
      label: "Facebook Comments",
    });
  }

  for (const identity of identities) {
    await prisma.channelIdentity.upsert({
      where: {
        channel_externalId: {
          channel: identity.channel,
          externalId: identity.externalId,
        },
      },
      create: identity,
      update: { tenantId: tenant.id, label: identity.label },
    });
  }

  if (adminEmail && adminPassword) {
    const passwordHash = await hashPassword(adminPassword);
    await prisma.user.upsert({
      where: { email: adminEmail },
      create: {
        email: adminEmail,
        name: "Admin",
        role: "TENANT_ADMIN",
        passwordHash,
        tenantId: tenant.id,
      },
      update: {
        passwordHash,
        tenantId: tenant.id,
      },
    });
  }

  if (superAdminEmail && superAdminPassword) {
    const passwordHash = await hashPassword(superAdminPassword);
    await prisma.user.upsert({
      where: { email: superAdminEmail },
      create: {
        email: superAdminEmail,
        name: "SuperAdmin",
        role: "SUPERADMIN",
        passwordHash,
        tenantId: tenant.id,
      },
      update: {
        passwordHash,
        tenantId: tenant.id,
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log("Seed completed", { tenantId: tenant.id });
};

run()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
