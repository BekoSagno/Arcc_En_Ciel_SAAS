"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { motion } from "framer-motion";
import { Mail, Lock, Loader2, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import Button from "@/src/components/ui/Button";

export default function OTPPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tenantId = searchParams.get("tenantId") || "";

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [mockCode, setMockCode] = useState("");
  const [displayedCode, setDisplayedCode] = useState("");

  useEffect(() => {
    if (!tenantId) {
      router.push("/onboarding");
    }
  }, [tenantId, router]);

  const handleSendOTP = async () => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Email invalide.");
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000"}/api/otp/send`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim().toLowerCase(), tenantId }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de l'envoi du code.");
      }

      if (data.mock && data.code) {
        setMockCode("Mode mock activé. Utilisez le code ci-dessous :");
        setDisplayedCode(data.code);
      } else if (data.mock) {
        setMockCode("Mode mock activé. Vérifiez les logs du serveur backend pour le code.");
      }

      setSuccess(data.mock ? "Code généré (mode mock)" : "Code envoyé ! Vérifiez votre boîte email.");
      setStep("code");
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'envoi du code.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!code.trim() || code.length !== 6) {
      setError("Code invalide (6 chiffres requis).");
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000"}/api/otp/verify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            code: code.trim(),
            tenantId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Code invalide ou expiré.");
      }

      if (data.success && data.user) {
        const result = await signIn("credentials", {
          email: data.user.email,
          password: "otp-verified",
          redirect: false,
        });

        if (result?.ok) {
          router.push("/dashboard");
        } else {
          setError("Connexion échouée. Réessayez.");
        }
      }
    } catch (err: any) {
      setError(err.message || "Erreur lors de la vérification.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#020617] px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-8 top-10 h-60 w-60 rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="absolute right-8 bottom-10 h-64 w-64 rounded-full bg-cyan-400/10 blur-[130px]" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-[#0b101d] p-8 shadow-[0_20px_70px_rgba(0,0,0,0.35)] interactive-glow"
      >
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-400">
          <span>Arcc En Ciel</span>
          <Link href="/login" className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition">
            <ArrowLeft className="h-3 w-3" /> Retour login
          </Link>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-transparent bg-gradient-to-r from-white to-slate-400 bg-clip-text">
          {step === "email" ? "Vérification Email" : "Code de Vérification"}
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          {step === "email"
            ? "Saisissez votre email pour recevoir un code de vérification."
            : "Entrez le code reçu par email."}
        </p>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {success && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            {success}
          </div>
        )}

        {mockCode && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
            <p className="mb-2">{mockCode}</p>
            {displayedCode && (
              <div className="mt-3 rounded-lg bg-amber-500/20 p-3 text-center">
                <p className="text-xs text-amber-200 mb-1">Code OTP :</p>
                <p className="text-2xl font-mono font-bold text-white tracking-widest">{displayedCode}</p>
              </div>
            )}
          </div>
        )}

        {step === "email" ? (
          <div className="mt-6 space-y-4">
            <label className="block text-sm text-slate-300">
              Email
              <div className="mt-2 flex items-center gap-3 rounded-xl border border-slate-800 bg-[#020617] px-4 py-3">
                <Mail className="h-5 w-5 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendOTP()}
                  placeholder="votre@email.com"
                  className="flex-1 bg-transparent text-white outline-none placeholder:text-slate-500"
                />
              </div>
            </label>
            <Button
              variant="primary"
              size="lg"
              loading={isLoading}
              icon={isLoading ? undefined : "📧"}
              disabled={!email.trim()}
              onClick={handleSendOTP}
              className="w-full"
            >
              {isLoading ? "Envoi en cours..." : "Envoyer le code"}
            </Button>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <label className="block text-sm text-slate-300">
              Code OTP (6 chiffres)
              <div className="mt-2 flex items-center gap-3 rounded-xl border border-slate-800 bg-[#020617] px-4 py-3">
                <Lock className="h-5 w-5 text-slate-500" />
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyOTP()}
                  placeholder="000000"
                  maxLength={6}
                  className="flex-1 bg-transparent text-center text-2xl font-mono tracking-widest text-white outline-none placeholder:text-slate-500"
                />
              </div>
            </label>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                size="md"
                icon="⬅️"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError("");
                  setSuccess("");
                }}
                className="flex-1"
              >
                Retour
              </Button>
              <Button
                variant="primary"
                size="md"
                loading={isLoading}
                icon={isLoading ? undefined : "✅"}
                disabled={code.length !== 6}
                onClick={handleVerifyOTP}
                className="flex-1"
              >
                {isLoading ? "Vérification..." : "Vérifier"}
              </Button>
            </div>
          </div>
        )}

        <div className="mt-6 text-center text-xs text-slate-500">
          <Link href="/login" className="text-indigo-400 transition hover:text-indigo-300">
            Déjà un compte ? Se connecter
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
