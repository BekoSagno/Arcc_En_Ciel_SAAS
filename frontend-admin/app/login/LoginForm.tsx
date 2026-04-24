/* eslint-disable @typescript-eslint/no-misused-promises */
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { signIn } from "next-auth/react";
import Button from "@/src/components/ui/Button";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError("");

    const result = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });

    if (result?.error) {
      setError("Identifiants invalides.");
      setIsLoading(false);
      return;
    }

    // Récupérer la session pour déterminer la redirection
    const sessionResponse = await fetch("/api/auth/session");
    const session = await sessionResponse.json();

    // Rediriger vers /admin si SUPERADMIN, sinon /
    if (session?.user?.role === "SUPERADMIN") {
      window.location.href = "/admin";
    } else {
      window.location.href = "/";
    }
  };

  return (
    <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300">Email</label>
        <input
          className="w-full rounded-lg border border-slate-800 bg-[#161b22] px-3 py-2 text-sm text-slate-100"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300">Mot de passe</label>
        <input
          className="w-full rounded-lg border border-slate-800 bg-[#161b22] px-3 py-2 text-sm text-slate-100"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>
      {error ? (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {error}
        </div>
      ) : null}
      <Button
        variant="primary"
        size="lg"
        type="submit"
        loading={isLoading}
        icon={isLoading ? undefined : "🔐"}
        className="w-full"
      >
        {isLoading ? "Connexion en cours..." : "Se connecter"}
      </Button>
    </form>
  );
}
