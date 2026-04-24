"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import SectionCard from "@/src/components/ui/SectionCard";
import StatusBadge from "@/src/components/ui/StatusBadge";
import PageHeader from "@/src/components/ui/PageHeader";
import Button from "@/src/components/ui/Button";

type Chunk = {
  id: string;
  content: string;
  score: number | null;
  sourceTitle: string;
  sourceType: string;
  createdAt?: string;
};

export default function CatalogueClient() {
  const { data: session } = useSession();
  const tenantId = session?.user?.tenantId;

  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const backendUrl = useMemo(
    () => process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000",
    []
  );

  const loadChunks = async (search = "") => {
    if (!tenantId) return;

    setIsLoading(true);
    try {
      const url = new URL(`${backendUrl}/api/rag/chunks`);
      if (search) {
        url.searchParams.set("q", search);
      }
      const response = await fetch(url.toString(), {
        headers: {
          "x-tenant-id": tenantId,
        },
      });
      if (response.ok) {
        const json = await response.json();
        const safeData = (json.data || []).map((chunk: any) => ({
          ...chunk,
          content:
            typeof chunk.content === "string"
              ? chunk.content
              : chunk.content
              ? String(chunk.content)
              : "",
        }));
        setChunks(safeData);
      } else {
        setChunks([]);
      }
    } catch (error) {
      setChunks([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!tenantId) return;

    loadChunks();
    // Rafraîchissement automatique toutes les 10 secondes
    const interval = setInterval(() => loadChunks(query), 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, backendUrl]);

  return (
    <>
      <PageHeader
        eyebrow="Catalogue RAG"
        title="Chunks, score et source"
        subtitle="Parcourez la memoire indexee et recherchez les passages les plus pertinents."
      />

      <SectionCard
        title="Recherche"
        action={
          <StatusBadge
            label={isLoading ? "Chargement" : "Pret"}
            tone={isLoading ? "warning" : "success"}
          />
        }
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <input
            className="flex-1 rounded-lg border border-slate-800 bg-[#161b22] px-3 py-2 text-sm text-slate-100"
            placeholder="Rechercher un passage (ex: prix, livraison...)"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Button
            variant="primary"
            size="md"
            icon="🔍"
            onClick={() => loadChunks(query)}
            loading={isLoading}
          >
            Rechercher
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="Bibliotheque de chunks">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-400">
              <tr className="border-b border-slate-800">
                <th className="py-3">Source</th>
                <th className="py-3">Score</th>
                <th className="py-3">Extrait</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {chunks.length === 0 ? (
                <tr>
                  <td className="py-6 text-slate-400" colSpan={3}>
                    Aucun chunk disponible.
                  </td>
                </tr>
              ) : null}
              {chunks.map((chunk) => (
                <tr key={chunk.id}>
                  <td className="py-4 pr-4">
                    <div className="font-semibold text-white">
                      {chunk.sourceTitle || "Source inconnue"}
                    </div>
                    <div className="text-xs text-slate-400">
                      {chunk.sourceType || "N/A"}
                    </div>
                  </td>
                  <td className="py-4 pr-4 text-slate-300">
                    {chunk.score !== null ? chunk.score.toFixed(3) : "—"}
                  </td>
                  <td className="py-4 text-slate-300">
                    {chunk.content.slice(0, 140)}
                    {chunk.content.length > 140 ? "..." : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </>
  );
}
