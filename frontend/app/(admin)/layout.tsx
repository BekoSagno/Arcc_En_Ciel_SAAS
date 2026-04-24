"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import AdminLayoutShell from "@/src/components/admin/AdminLayoutShell";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated" && session?.user?.role !== "SUPERADMIN") {
      router.push("/dashboard");
      return;
    }
  }, [status, session, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-slate-400">Chargement...</div>
      </div>
    );
  }

  if (session?.user?.role !== "SUPERADMIN") {
    return null;
  }

  return <AdminLayoutShell>{children}</AdminLayoutShell>;
}
