// Utiliser fetch natif (Node.js 18+)

const backendUrl = "http://localhost:4000";
const superAdminEmail = "amedbekosagno989@arccenciel.com";

async function testAdminAPI() {
  console.log("🧪 Test de l'API Admin Super Admin\n");

  try {
    // Test 1: Stats
    console.log("1️⃣ Test GET /api/admin/stats");
    const statsResponse = await fetch(`${backendUrl}/api/admin/stats`, {
      headers: {
        "x-user-email": superAdminEmail,
        "x-user-role": "SUPERADMIN",
      },
    });

    if (statsResponse.ok) {
      const statsData = await statsResponse.json();
      console.log("✅ Stats récupérées avec succès");
      console.log("   - Tenants totaux:", statsData.data?.overview?.totalTenants || 0);
      console.log("   - Tenants actifs:", statsData.data?.overview?.activeTenants || 0);
      console.log("   - Utilisateurs:", statsData.data?.overview?.totalUsers || 0);
      console.log("   - Messages:", statsData.data?.overview?.totalMessages || 0);
    } else {
      const error = await statsResponse.text();
      console.log("❌ Erreur:", statsResponse.status, error);
    }

    // Test 2: Liste des tenants
    console.log("\n2️⃣ Test GET /api/admin/tenants");
    const tenantsResponse = await fetch(`${backendUrl}/api/admin/tenants`, {
      headers: {
        "x-user-email": superAdminEmail,
        "x-user-role": "SUPERADMIN",
      },
    });

    if (tenantsResponse.ok) {
      const tenantsData = await tenantsResponse.json();
      console.log("✅ Tenants récupérés avec succès");
      console.log("   - Nombre de tenants:", tenantsData.data?.length || 0);
      if (tenantsData.data && tenantsData.data.length > 0) {
        console.log("   - Premier tenant:", tenantsData.data[0].name);
        console.log("   - Dernière activité:", tenantsData.data[0].lastActivityText || "N/A");
      }
    } else {
      const error = await tenantsResponse.text();
      console.log("❌ Erreur:", tenantsResponse.status, error);
    }

    console.log("\n✅ Tests terminés!");
  } catch (error) {
    console.error("❌ Erreur lors des tests:", error.message);
  }
}

testAdminAPI();
