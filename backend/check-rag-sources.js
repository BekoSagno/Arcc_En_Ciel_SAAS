require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

(async () => {
  try {
    // Vérifier tous les tenants
    const allTenants = await prisma.tenant.findMany({
      include: {
        ragSources: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    console.log(`\n📊 RÉSUMÉ DES SOURCES RAG PAR TENANT\n`);
    console.log("=" .repeat(60));

    for (const tenant of allTenants) {
      console.log(`\n🏪 Tenant: ${tenant.name} (ID: ${tenant.id})`);
      console.log(`📚 Total sources: ${tenant.ragSources.length}`);

      if (tenant.ragSources.length > 0) {
        console.log("\n   Sources:");
        tenant.ragSources.forEach((s, i) => {
          const statusIcon = s.status === "active" ? "✅" : s.status === "indexed" ? "✅" : s.status === "failed" ? "❌" : "⏳";
          console.log(`   ${i + 1}. ${statusIcon} ${s.title}`);
          console.log(`      Type: ${s.type} | Status: ${s.status}`);
          console.log(`      Créé: ${s.createdAt.toLocaleString("fr-FR")}`);
          
          // Compter les chunks
          prisma.rAGChunk.count({
            where: { sourceId: s.id },
          }).then(count => {
            console.log(`      Chunks: ${count}`);
          });
        });
      } else {
        console.log("   ⚠️  Aucune source");
      }
    }

    // Vérifier spécifiquement "Boutique Arcc Test"
    console.log("\n" + "=" .repeat(60));
    console.log("\n🔍 VÉRIFICATION DÉTAILLÉE: Boutique Arcc Test\n");

    const tenant = await prisma.tenant.findUnique({
      where: { name: "Boutique Arcc Test" },
      include: {
        ragSources: {
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: {
            ragChunks: true,
          },
        },
      },
    });

    if (!tenant) {
      console.log("❌ Tenant 'Boutique Arcc Test' introuvable");
    } else {
      console.log(`✅ Tenant trouvé: ${tenant.name}`);
      console.log(`   ID: ${tenant.id}`);
      console.log(`   Total chunks RAG: ${tenant._count.ragChunks}`);
      console.log(`   Total sources: ${tenant.ragSources.length}\n`);

      if (tenant.ragSources.length === 0) {
        console.log("⚠️  Aucune source RAG trouvée pour ce tenant");
      } else {
        console.log("📚 Sources RAG trouvées:\n");
        for (const source of tenant.ragSources) {
          const chunkCount = await prisma.rAGChunk.count({
            where: { sourceId: source.id },
          });
          
          const statusIcon = source.status === "active" || source.status === "indexed" ? "✅" : source.status === "failed" ? "❌" : "⏳";
          console.log(`${statusIcon} ${source.title}`);
          console.log(`   ID: ${source.id}`);
          console.log(`   Type: ${source.type}`);
          console.log(`   Status: ${source.status}`);
          console.log(`   Chunks indexés: ${chunkCount}`);
          console.log(`   Créé: ${source.createdAt.toLocaleString("fr-FR")}`);
          console.log(`   Modifié: ${source.updatedAt.toLocaleString("fr-FR")}\n`);
        }
      }
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error("❌ Erreur:", error);
    process.exit(1);
  }
})();
