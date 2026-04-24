import Link from "next/link";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#020617] px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-10 top-10 h-64 w-64 rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="absolute right-10 bottom-10 h-72 w-72 rounded-full bg-cyan-400/10 blur-[140px]" />
      </div>
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-[#0b101d] p-8 shadow-[0_20px_70px_rgba(0,0,0,0.35)] interactive-glow interactive-raise">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-400">
          <span>Arcc En Ciel</span>
          <Link href="/" className="text-[11px] text-slate-400 hover:text-white transition">
            Accueil
          </Link>
        </div>
        <h1 className="mt-3 text-3xl font-bold text-transparent bg-gradient-to-r from-white to-slate-400 bg-clip-text">
          Connexion
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Accédez au dashboard avec vos identifiants ou via un code OTP.
        </p>
        <div className="mt-4">
          <LoginForm />
        </div>
        <div className="mt-5 flex flex-col gap-2 text-sm text-slate-400">
          <div>
            Pas encore de compte ?{" "}
            <Link
              href="/onboarding"
              className="font-semibold text-indigo-400 transition hover:text-indigo-300"
            >
              Créer mon compte
            </Link>
          </div>
          <div>
            Pas de mot de passe ?{" "}
            <Link
              href="/otp"
              className="font-semibold text-indigo-400 transition hover:text-indigo-300"
            >
              Recevoir un code OTP
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
