import NextAuth from "next-auth";

declare module "next-auth" {
  interface User {
    role?: string;
    tenantId?: string;
    tenantName?: string;
  }

  interface Session {
    user: {
      role?: string;
      tenantId?: string;
      tenantName?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    tenantId?: string;
    tenantName?: string;
  }
}
