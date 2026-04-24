require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function checkConversations() {
  const phoneNumber = process.argv[2] || "224623858991";
  
  console.log(`\n🔍 Recherche des conversations pour le numéro: ${phoneNumber}\n`);
  
  try {
    // Chercher avec différentes variantes du numéro
    const variants = [
      phoneNumber,
      `+${phoneNumber}`,
      phoneNumber.replace(/\s+/g, ""),
      `+${phoneNumber.replace(/\s+/g, "")}`,
    ];
    
    const allConversations = [];
    
    for (const variant of variants) {
      const convs = await prisma.conversation.findMany({
        where: {
          OR: [
            { customerHandle: variant },
            { customerHandle: { contains: phoneNumber } },
          ],
        },
        include: {
          tenant: {
            select: { name: true, id: true },
          },
          messages: {
            select: { id: true, direction: true, body: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 3,
          },
        },
      });
      allConversations.push(...convs);
    }
    
    // Dédupliquer par ID
    const uniqueConvs = Array.from(
      new Map(allConversations.map(c => [c.id, c])).values()
    );
    
    if (uniqueConvs.length === 0) {
      console.log("✅ Aucune conversation trouvée.\n");
      return;
    }
    
    console.log(`📊 ${uniqueConvs.length} conversation(s) trouvée(s):\n`);
    
    uniqueConvs.forEach((conv, idx) => {
      console.log(`${idx + 1}. Conversation ${conv.id}`);
      console.log(`   Tenant: ${conv.tenant.name} (${conv.tenant.id})`);
      console.log(`   Customer Handle: ${conv.customerHandle}`);
      console.log(`   Channel: ${conv.channel}`);
      console.log(`   Status: ${conv.status}`);
      console.log(`   Messages: ${conv.messages.length}`);
      if (conv.messages.length > 0) {
        console.log(`   Derniers messages:`);
        conv.messages.forEach((msg, i) => {
          console.log(`      ${i + 1}. [${msg.direction}] ${msg.body.substring(0, 50)}... (${msg.createdAt.toLocaleString()})`);
        });
      }
      console.log("");
    });
    
  } catch (error) {
    console.error("❌ Erreur:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkConversations();
