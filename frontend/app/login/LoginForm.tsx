/* eslint-disable @typescript-eslint/no-misused-promises */
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { signIn } from "next-auth/react";
import { Eye, EyeOff } from "lucide-react";
import Button from "@/src/components/ui/Button";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

    // Rediriger vers /admin si SUPERADMIN, sinon /dashboard
    if (session?.user?.role === "SUPERADMIN") {
      window.location.href = "/admin";
    } else {
      window.location.href = "/dashboard";
    }
  };

  return (
    <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-200">Email</label>
        <input
          className="w-full rounded-xl border border-slate-800 bg-[#161b22] px-3 py-3 text-sm text-slate-100 transition focus:border-indigo-500/60 interactive-glow"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          placeholder="vous@email.com"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-200">Mot de passe</label>
        <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-[#161b22] px-3 py-2 text-sm text-slate-100 transition focus-within:border-indigo-500/60 interactive-glow">
          <input
            className="h-10 w-full bg-transparent outline-none"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            placeholder="Votre mot de passe"
          />
          <button
            type="button"
            className="p-1 text-slate-400 hover:text-slate-200"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
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
