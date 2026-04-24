"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Loader2, MessageCircle, Eye, EyeOff } from "lucide-react";
import Button from "@/src/components/ui/Button";

const steps = [
  "Inscription",
  "Validation",
];

const transition = { duration: 0.4, ease: "easeOut" };

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState("Preparation...");
  const [error, setError] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [loginStatus, setLoginStatus] = useState<
    "idle" | "success" | "failed"
  >("idle");
  const [messages, setMessages] = useState([
    {
      id: "intro",
      role: "assistant",
      content:
        "Bonjour ! Testez votre IA en posant une question sur votre boutique.",
    },
  ]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    whatsappNumber: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [registrationError, setRegistrationError] = useState("");
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  const canContinueStep1 = 
    form.name.trim() && 
    form.email.trim() && 
    form.password.trim() && 
    form.password === form.confirmPassword &&
    form.password.length >= 6 &&
    form.whatsappNumber.trim().length > 0;

  const handleRegister = async () => {
    setRegistrationError("");
    setIsSubmitting(true);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
      const response = await fetch(`${backendUrl}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          whatsappNumber: form.whatsappNumber.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de l'inscription.");
      }

      setRegistrationSuccess(true);
      setTenantId(data.tenant?.id || "");
      setIsSubmitting(false);
      setStep(2); // Passer à l'étape de validation
    } catch (err: any) {
      console.error("[REGISTER] Erreur:", err);
      setRegistrationError(err.message || "Erreur lors de l'inscription. Veuillez réessayer.");
      setIsSubmitting(false);
    }
  };


  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <header className="border-b border-slate-800 bg-[#0b101d]/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="text-sm font-semibold text-slate-300 transition hover:text-white"
          >
            ← Retour a l'accueil
          </Link>
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <Link href="/login" className="hover:text-white transition">Se connecter</Link>
            <Link href="/otp" className="hover:text-white transition">Connexion OTP</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
          {steps.map((label, index) => {
            const isActive = step === index + 1;
            return (
              <div
                key={label}
                className={`rounded-full border px-3 py-1 interactive-glow ${
                  isActive
                    ? "border-indigo-500/60 text-indigo-300"
                    : "border-slate-700 text-slate-500"
                }`}
              >
                {index + 1}. {label}
              </div>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={transition}
              className="rounded-3xl border border-slate-800 bg-[#0b101d] p-8 interactive-glow"
            >
              <h1 className="text-2xl font-semibold text-white">
                Créer votre compte
              </h1>
              <p className="mt-2 text-slate-300">
                Remplissez vos informations personnelles pour créer votre compte.
              </p>
              <div className="mt-6 grid gap-4">
                <label className="text-sm text-slate-300">
                  Nom complet
                  <input
                    type="text"
                    className="mt-2 w-full rounded-2xl border border-slate-800 bg-[#020617] px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500/60 interactive-glow"
                    placeholder="Jean Dupont"
                    value={form.name}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                  />
                </label>
                <label className="text-sm text-slate-300">
                  Email
                  <input
                    type="email"
                    className="mt-2 w-full rounded-2xl border border-slate-800 bg-[#020617] px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500/60 interactive-glow"
                    placeholder="jean.dupont@example.com"
                    value={form.email}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, email: event.target.value }))
                    }
                  />
                </label>
                <label className="text-sm text-slate-300">
                  Mot de passe
                  <div className="mt-2 flex items-center gap-2 rounded-2xl border border-slate-800 bg-[#020617] px-4 py-1 text-sm text-white focus-within:border-indigo-500/60 interactive-glow">
                    <input
                      type={showPassword ? "text" : "password"}
                      className="h-10 w-full bg-transparent outline-none"
                      placeholder="Minimum 6 caractères"
                      value={form.password}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, password: event.target.value }))
                      }
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
                </label>
                <label className="text-sm text-slate-300">
                  Confirmer le mot de passe
                  <div className="mt-2 flex items-center gap-2 rounded-2xl border border-slate-800 bg-[#020617] px-4 py-1 text-sm text-white focus-within:border-indigo-500/60 interactive-glow">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      className="h-10 w-full bg-transparent outline-none"
                      placeholder="Répétez votre mot de passe"
                      value={form.confirmPassword}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          confirmPassword: event.target.value,
                        }))
                      }
                    />
                    <button
                      type="button"
                      className="p-1 text-slate-400 hover:text-slate-200"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      aria-label={showConfirmPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </label>
                <label className="text-sm text-slate-300">
                  Numéro WhatsApp Business
                  <input
                    type="text"
                    className="mt-2 w-full rounded-2xl border border-slate-800 bg-[#020617] px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500/60 interactive-glow"
                    placeholder="+224 600 00 00 00"
                    value={form.whatsappNumber}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, whatsappNumber: event.target.value }))
                    }
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    Ce numéro doit être unique et ne peut pas être utilisé par un autre client.
                  </p>
                </label>
                {form.password && form.confirmPassword && form.password !== form.confirmPassword && (
                  <p className="text-sm text-amber-300">Les mots de passe ne correspondent pas.</p>
                )}
                {form.password && form.password.length < 6 && (
                  <p className="text-sm text-amber-300">Le mot de passe doit contenir au moins 6 caractères.</p>
                )}
                {registrationError && (
                  <p className="text-sm text-red-400">{registrationError}</p>
                )}
              </div>
              <div className="mt-8 flex justify-end">
                <Button
                  variant="primary"
                  size="md"
                  icon="➡️"
                  disabled={!canContinueStep1 || isSubmitting}
                  loading={isSubmitting}
                  onClick={handleRegister}
                >
                  {isSubmitting ? "Création en cours..." : "Créer mon compte"}
                </Button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={transition}
              className="flex min-h-[60vh] flex-col items-center justify-center rounded-3xl border border-slate-800 bg-[#0b101d] p-10 text-center interactive-glow"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="mt-6 text-2xl font-semibold text-white">
                Compte créé avec succès !
              </h3>
              <p className="mt-3 text-sm text-slate-300">
                Votre compte a été créé. Vous pouvez maintenant valider l'email par OTP ou vous connecter.
              </p>
              <div className="mt-8 flex flex-wrap gap-3 justify-center">
                <Button
                  variant="primary"
                  size="md"
                  icon="📧"
                  onClick={() => router.push(`/otp?tenantId=${tenantId || ""}`)}
                >
                  Valider par OTP
                </Button>
                <Link href="/login">
                  <Button
                    variant="secondary"
                    size="md"
                    icon="🔐"
                  >
                    Se connecter
                  </Button>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
