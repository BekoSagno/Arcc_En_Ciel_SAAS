import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#020617] px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0b101d] p-8 shadow-[0_10px_30px_rgba(2,6,23,0.6)]">
        <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Arcc En Ciel
        </div>
        <h1 className="mt-2 text-2xl font-bold text-transparent bg-gradient-to-r from-white to-slate-400 bg-clip-text">
          Connexion
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Utilisez vos identifiants pour acceder au dashboard.
        </p>
        <LoginForm />
      </div>
    </div>
  );
}
