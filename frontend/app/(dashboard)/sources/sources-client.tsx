"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import PageHeader from "@/src/components/ui/PageHeader";
import Button from "@/src/components/ui/Button";

type Source = {
  id: string;
  title: string;
  type: string;
  status: string;
  updatedAt: string;
  stats?: {
    chunkCount: number;
    estimatedTokens: number;
  };
};

export default function SourcesClient() {
  const { data: session } = useSession();
  const [sources, setSources] = useState<Source[]>([]);
  const [type, setType] = useState("PDF");
  const [title, setTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const backendUrl = useMemo(
    () => process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000",
    []
  );

  const loadSources = async () => {
    try {
      const tenantId = session?.user?.tenantId;
      const response = await fetch(`${backendUrl}/api/rag/sources`, {
        headers: tenantId
          ? {
              "x-tenant-id": tenantId,
            }
          : undefined,
      });
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      setSources(data.data || []);
    } catch (error) {
      setError("Backend indisponible.");
    }
  };

  useEffect(() => {
    // Ne charge que si on connaît le tenant
    if (session?.user?.tenantId) {
      loadSources();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.tenantId]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const tenantId = session?.user?.tenantId;
      if (!tenantId) {
        setError("Tenant non disponible. Reconnectez-vous.");
        setIsLoading(false);
        return;
      }

      if (type === "PDF") {
        if (!file) {
          setError("Veuillez selectionner un PDF.");
          setIsLoading(false);
          return;
        }
        const formData = new FormData();
        formData.append("type", "PDF");
        formData.append("title", title);
        formData.append("file", file);

        const response = await fetch(`${backendUrl}/api/rag/sources`, {
          method: "POST",
          headers: {
            "x-tenant-id": tenantId,
          },
          body: formData,
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || "Erreur d'upload.");
        }
      } else {
        const response = await fetch(`${backendUrl}/api/rag/sources`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant-id": tenantId,
          },
          body: JSON.stringify({
            type,
            title,
            sourceUrl: type === "URL" ? sourceUrl : undefined,
            text: type === "TEXT" ? text : undefined,
          }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || "Erreur d'enregistrement.");
        }
      }

      setTitle("");
      setSourceUrl("");
      setText("");
      setFile(null);
      await loadSources();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'indexer la source.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (source: Source) => {
    const tenantId = session?.user?.tenantId;
    if (!tenantId) {
      setError("Tenant non disponible. Reconnectez-vous.");
      return;
    }

    const confirm = window.confirm(
      `Supprimer la source "${source.title}" et tous les chunks associés ?`
    );
    if (!confirm) return;

    try {
      setIsLoading(true);
      setError("");
      const response = await fetch(`${backendUrl}/api/rag/sources/${source.id}`, {
        method: "DELETE",
        headers: {
          "x-tenant-id": tenantId,
        },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(
          payload.error || "Erreur lors de la suppression de la source."
        );
      }
      await loadSources();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Impossible de supprimer la source."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="RAG Studio"
        title="Sources RAG"
        subtitle="Ajoutez des documents pour entrainer l'IA sur votre contenu."
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <form
          className="rounded-2xl border border-slate-800/80 bg-[#0b101d] p-6 shadow-[0_20px_60px_rgba(2,6,23,0.45)] lg:col-span-2"
          onSubmit={handleSubmit}
        >
          <div className="text-sm font-semibold text-white">
            Nouvelle source
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400">Type</label>
              <select
                className="w-full rounded-lg border border-slate-800 bg-[#161b22] px-3 py-2 text-sm text-slate-100"
                value={type}
                onChange={(event) => setType(event.target.value)}
              >
                <option value="PDF">PDF</option>
                <option value="URL">URL</option>
                <option value="TEXT">Texte</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400">Titre</label>
              <input
                className="w-full rounded-lg border border-slate-800 bg-[#161b22] px-3 py-2 text-sm text-slate-100"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
              />
            </div>
          </div>

          {type === "URL" ? (
            <div className="mt-4 space-y-2">
              <label className="text-xs font-medium text-slate-400">Lien</label>
              <input
                className="w-full rounded-lg border border-slate-800 bg-[#161b22] px-3 py-2 text-sm text-slate-100"
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
                required
              />
            </div>
          ) : null}

          {type === "TEXT" ? (
            <div className="mt-4 space-y-2">
              <label className="text-xs font-medium text-slate-400">
                Contenu
              </label>
              <textarea
                className="min-h-[140px] w-full rounded-lg border border-slate-800 bg-[#161b22] px-3 py-2 text-sm text-slate-100"
                value={text}
                onChange={(event) => setText(event.target.value)}
                required
              />
            </div>
          ) : null}

          {type === "PDF" ? (
            <div className="mt-4 space-y-2">
              <label className="text-xs font-medium text-slate-400">
                Fichier PDF
              </label>
              <div
                className={`mt-2 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-sm transition-colors ${
                  dragActive
                    ? "border-indigo-400 bg-indigo-500/10"
                    : "border-slate-700 bg-[#020617]"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  const dropped = e.dataTransfer.files?.[0];
                  if (dropped && dropped.type === "application/pdf") {
                    setFile(dropped);
                  }
                }}
              >
                <p className="text-slate-300">
                  Glissez-déposez un PDF ici ou cliquez pour sélectionner un
                  fichier.
                </p>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                  required={!file}
                  className="mt-3 text-sm text-slate-300 file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-indigo-500"
                />
                {file && (
                  <p className="mt-2 text-xs text-emerald-400">
                    Fichier sélectionné : {file.name}
                  </p>
                )}
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {error}
            </div>
          ) : null}

          <Button
            variant="primary"
            size="md"
            type="submit"
            loading={isLoading}
            icon={isLoading ? undefined : "🚀"}
            className="mt-4 w-full"
          >
            {isLoading ? "Indexation en cours..." : "Lancer l'indexation"}
          </Button>
        </form>

        <div className="rounded-2xl border border-slate-800 bg-[#0b101d] p-6 shadow-[0_10px_30px_rgba(2,6,23,0.4)]">
          <div className="text-sm font-semibold text-white">
            Etat de la memoire
          </div>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            <li>Sources actives: {sources.length}</li>
            <li>
              Chunks totaux:{" "}
              {sources.reduce(
                (sum, s) => sum + (s.stats?.chunkCount || 0),
                0
              )}
            </li>
            <li>
              Tokens estimés:{" "}
              {sources
                .reduce((sum, s) => sum + (s.stats?.estimatedTokens || 0), 0)
                .toLocaleString("fr-FR")}
            </li>
            <li className="text-xs text-slate-500">Namespace: tenant_id</li>
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-[#0b101d] shadow-[0_10px_30px_rgba(2,6,23,0.4)]">
        <div className="border-b border-slate-800 px-6 py-4 text-sm font-semibold text-white">
          Bibliotheque
        </div>
        <div className="divide-y divide-slate-800">
          {sources.length === 0 ? (
            <div className="px-6 py-6 text-sm text-slate-400">
              Aucune source pour le moment.
            </div>
          ) : null}
          {sources.map((source, index) => (
            <motion.div
              key={source.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="flex items-center justify-between px-6 py-4 text-sm hover:bg-slate-900/50 transition-colors duration-200"
            >
              <div className="flex-1">
                <div className="font-medium text-white">{source.title}</div>
                <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                  <span>{source.type}</span>
                  {source.stats && (
                    <>
                      <span className="text-slate-600">•</span>
                      <span className="text-indigo-400">
                        {source.stats.chunkCount} chunks
                      </span>
                      <span className="text-slate-600">•</span>
                      <span className="text-emerald-400">
                        {source.stats.estimatedTokens.toLocaleString("fr-FR")}{" "}
                        tokens
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs text-slate-400">
                    {new Date(source.updatedAt).toLocaleDateString("fr-FR")}
                  </div>
                  <span className="rounded-full border border-slate-800 bg-[#161b22] px-2 py-1 text-[11px] text-slate-300">
                    {source.status}
                  </span>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  icon="🗑"
                  onClick={() => handleDelete(source)}
                >
                  Supprimer
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </>
  );
}
