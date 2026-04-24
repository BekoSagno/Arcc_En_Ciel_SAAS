import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

const handler = NextAuth({
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const backendUrl = process.env.BACKEND_URL || "http://localhost:4000";
        try {
          const response = await fetch(`${backendUrl}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          if (response.ok) {
            const contentType = response.headers.get("content-type") || "";
            if (!contentType.includes("application/json")) {
              return null;
            }
            const user = await response.json();
            if (!user?.id) {
              return null;
            }
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
              tenantId: user.tenantId,
              tenantName: user.tenantName,
            };
          }
        } catch (error) {
          // Fall through to local seed auth when backend is offline or malformed.
        }

        const seedEmail = process.env.AUTH_SEED_EMAIL;
        const seedPassword = process.env.AUTH_SEED_PASSWORD;
        if (
          seedEmail &&
          seedPassword &&
          credentials.email === seedEmail &&
          credentials.password === seedPassword
        ) {
          return {
            id: "local-admin",
            name: "SuperAdmin",
            email: seedEmail,
            role: "SUPERADMIN",
            tenantId: "local",
            tenantName: "Arcc En Ciel",
          };
        }

        return null;
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.tenantId = user.tenantId;
        token.tenantName = user.tenantName;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role;
        session.user.tenantId = token.tenantId;
        session.user.tenantName = token.tenantName;
      }
      return session;
    },
  },
});

export { handler as GET, handler as POST };
