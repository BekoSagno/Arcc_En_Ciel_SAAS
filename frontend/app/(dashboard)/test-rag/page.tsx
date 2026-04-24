"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import PageHeader from "@/src/components/ui/PageHeader";
import Button from "@/src/components/ui/Button";

export default function TestRagPage() {
  const { data: session } = useSession();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [context, setContext] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [error, setError] = useState("");

  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

  // Obtenir le tenantId depuis la session
  const tenantId = session?.user?.tenantId;

  useEffect(() => {
    if (tenantId) {
      loadStatus();
    }
  }, [tenantId]);

  const loadStatus = async () => {
    if (!tenantId) {
      console.warn("TenantId non disponible dans la session");
      return;
    }

    try {
      const response = await fetch(`${backendUrl}/api/test-rag/status`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        credentials: "include",
      });
      
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      } else {
        console.error("Erreur chargement statut:", response.status, response.statusText);
        // Si la route n'existe pas (404), on peut continuer sans statut
        if (response.status === 404) {
          console.warn("Route test-rag/status non disponible");
        }
      }
    } catch (err) {
      console.error("Erreur chargement statut:", err);
      // Ne pas bloquer l'interface si le statut ne charge pas
    }
  };

  const handleTest = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!tenantId) {
      setError("Vous devez être connecté pour tester le RAG.");
      return;
    }

    setIsLoading(true);
    setError("");
    setAnswer("");
    setContext([]);

    try {
      const response = await fetch(`${backendUrl}/api/test-rag/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({ question }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors du test");
      }

      const data = await response.json();
      setAnswer(data.answer || "");
      setContext(data.context || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Test RAG"
        title="Tester votre base de connaissances"
        subtitle="Posez une question pour vérifier que l'IA trouve les bonnes informations dans vos documents"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <form
            onSubmit={handleTest}
            className="rounded-2xl border border-slate-800 bg-[#0b101d] p-6"
          >
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-300">
                  Question de test
                </label>
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ex: Quel est le prix de vos services ?"
                  className="mt-2 w-full rounded-lg border border-slate-800 bg-[#161b22] px-4 py-3 text-sm text-white"
                  required
                />
              </div>

              {error && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={isLoading}
                icon={isLoading ? undefined : "🔍"}
                className="w-full"
              >
                {isLoading ? "Recherche en cours..." : "Tester la question"}
              </Button>
            </div>
          </form>

          {answer && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-6 rounded-2xl border border-slate-800 bg-[#0b101d] p-6"
            >
              <h3 className="mb-4 text-sm font-semibold text-white">
                🤖 Réponse de l'IA
              </h3>
              <p className="text-sm text-slate-200 leading-relaxed">{answer}</p>
            </motion.div>
          )}

          {context.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="mt-6 rounded-2xl border border-slate-800 bg-[#0b101d] p-6"
            >
              <h3 className="mb-4 text-sm font-semibold text-white">
                📚 Contexte trouvé ({context.length} extraits)
              </h3>
              <div className="space-y-3">
                {context.map((ctx, idx) => {
                  // Gérer le cas où ctx pourrait être un objet
                  const text = typeof ctx === "string" ? ctx : JSON.stringify(ctx);
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: idx * 0.05 }}
                      className="rounded-lg border border-slate-800 bg-[#161b22] px-4 py-3 text-xs text-slate-300 hover:border-indigo-500/50 transition-colors"
                    >
                      {text}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0b101d] p-6">
          <h3 className="text-sm font-semibold text-white">État du RAG</h3>
          {status ? (
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Sources totales:</span>
                <span className="text-white">{status.sources.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Sources indexées:</span>
                <span className="text-emerald-400">
                  {status.sources.indexed}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Chunks:</span>
                <span className="text-white">{status.sources.chunks}</span>
              </div>
              <div className="mt-4 rounded-lg border border-slate-800 bg-[#161b22] px-3 py-2">
                <div className="text-xs text-slate-400">Statut</div>
                <div
                  className={`mt-1 text-sm font-semibold ${
                    status.status === "ready"
                      ? "text-emerald-400"
                      : "text-amber-400"
                  }`}
                >
                  {status.status === "ready"
                    ? "✅ Prêt"
                    : "⚠️ Aucune donnée"}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-slate-400">
              Chargement...
            </div>
          )}
        </div>
      </div>
    </>
  );
}
