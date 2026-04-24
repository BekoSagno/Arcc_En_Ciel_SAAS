"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import PageHeader from "@/src/components/ui/PageHeader";
import SectionCard from "@/src/components/ui/SectionCard";
import Button from "@/src/components/ui/Button";
import StatusBadge from "@/src/components/ui/StatusBadge";

type SocialPostTarget = {
  id: string;
  network: string;
  status: string;
  externalId?: string | null;
  errorMessage?: string | null;
  publishedAt?: string | null;
};

type SocialPost = {
  id: string;
  title?: string | null;
  body: string;
  mediaUrls: string[];
  status: string;
  scheduledAt?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  targets: SocialPostTarget[];
};

const ALL_NETWORKS = [
  { id: "FACEBOOK", label: "Facebook", icon: "📘" },
  { id: "LINKEDIN", label: "LinkedIn", icon: "💼" },
  { id: "INSTAGRAM", label: "Instagram", icon: "📷" },
  { id: "TIKTOK", label: "TikTok", icon: "🎵" },
  { id: "TWITTER", label: "Twitter", icon: "🐦" },
  { id: "THREADS", label: "Threads", icon: "🧵" },
];

export default function AnnoncesClient() {
  const { data: session } = useSession();
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Formulaire
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mediaUrlsInput, setMediaUrlsInput] = useState("");
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>([
    "FACEBOOK",
    "INSTAGRAM",
  ]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [saveAsDraft, setSaveAsDraft] = useState(false);
  const [localFiles, setLocalFiles] = useState<File[]>([]);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);

  const backendUrl = useMemo(
    () => process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000",
    []
  );

  const tenantId = session?.user?.tenantId;

  const loadPosts = async () => {
    if (!tenantId) return;
    setIsLoadingPosts(true);
    try {
      const response = await fetch(`${backendUrl}/api/social-posts`, {
        headers: {
          "x-tenant-id": tenantId,
        },
        cache: "no-store",
      });
      if (!response.ok) {
        return;
      }
      const json = await response.json();
      setPosts(json.data || []);
    } catch (err) {
      console.error("Erreur chargement annonces:", err);
    } finally {
      setIsLoadingPosts(false);
    }
  };

  useEffect(() => {
    if (tenantId) {
      loadPosts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const toggleNetwork = (network: string) => {
    setSelectedNetworks((prev) =>
      prev.includes(network)
        ? prev.filter((n) => n !== network)
        : [...prev, network]
    );
  };

  const getStatusTone = (status: string) => {
    const lower = status.toLowerCase();
    if (lower === "published") return "success";
    if (lower === "failed") return "danger";
    if (lower === "publishing" || lower === "scheduled") return "warning";
    return "info";
  };

  const resetForm = () => {
    setTitle("");
    setBody("");
    setMediaUrlsInput("");
    setSelectedNetworks(["FACEBOOK", "INSTAGRAM"]);
    setScheduledAt("");
    setSaveAsDraft(false);
    setError(null);
    setLocalFiles([]);
    setUploadedUrls([]);
  };

  const handleFilesChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files || []);
    setLocalFiles(files);

    // Générer des URLs locales pour l'aperçu immédiat
    const previewUrls = files.map((file) => URL.createObjectURL(file));
    setUploadedUrls(previewUrls);
  };

  const uploadLocalImages = async (
    tenantId: string
  ): Promise<string[]> => {
    if (!localFiles.length) return [];

    const formData = new FormData();
    localFiles.forEach((file) => {
      formData.append("files", file);
    });

    const response = await fetch(`${backendUrl}/api/uploads/images`, {
      method: "POST",
      headers: {
        "x-tenant-id": tenantId,
      },
      body: formData,
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(
        payload.error ||
          "Erreur lors de l'upload des images. Veuillez réessayer."
      );
    }

    const json = await response.json();
    const urls: string[] = json?.data?.urls || [];
    setUploadedUrls(urls);
    return urls;
  };

  const handleSaveDraft = async () => {
    if (!tenantId) {
      setError("Tenant non disponible. Reconnectez-vous.");
      return;
    }
    if (!body.trim()) {
      setError("Le contenu de l'annonce est requis pour sauvegarder un brouillon.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const mediaUrlsFromInput = mediaUrlsInput
        .split("\n")
        .map((u) => u.trim())
        .filter((u) => u.length > 0);

      const uploaded = await uploadLocalImages(tenantId);
      const allMediaUrls = [...uploaded, ...mediaUrlsFromInput];

      const response = await fetch(`${backendUrl}/api/social-posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({
          title: title.trim() || null,
          body,
          mediaUrls: allMediaUrls,
          networks: selectedNetworks.length > 0 ? selectedNetworks : ["FACEBOOK"],
          scheduledAt: null,
          publishNow: false,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Erreur lors de la sauvegarde du brouillon.");
      }

      resetForm();
      setIsModalOpen(false);
      await loadPosts();
    } catch (err) {
      console.error("Erreur sauvegarde brouillon:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de sauvegarder le brouillon."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!tenantId) {
      setError("Tenant non disponible. Reconnectez-vous.");
      return;
    }
    if (!body.trim()) {
      setError("Le contenu de l'annonce est requis.");
      return;
    }
    if (selectedNetworks.length === 0) {
      setError("Sélectionnez au moins un réseau social.");
      return;
    }
    const mediaUrlsFromInput = mediaUrlsInput
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    setIsLoading(true);
    setError(null);

    try {
      const uploaded = await uploadLocalImages(tenantId);
      const allMediaUrls = [...uploaded, ...mediaUrlsFromInput];

      // Validation spécifique Instagram : nécessite au moins une image
      if (
        selectedNetworks.includes("INSTAGRAM") &&
        allMediaUrls.length === 0
      ) {
        setError(
          "Pour publier sur Instagram, vous devez fournir au moins une image (upload ou URL)."
        );
        setIsLoading(false);
        return;
      }

      const response = await fetch(`${backendUrl}/api/social-posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({
          title: title.trim() || null,
          body,
          mediaUrls: allMediaUrls,
          networks: selectedNetworks,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
          publishNow: !scheduledAt, // Publier maintenant si pas de date programmée
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(
          payload.error || "Erreur lors de la création / publication de l'annonce."
        );
      }

      resetForm();
      setIsModalOpen(false);
      await loadPosts();
    } catch (err) {
      console.error("Erreur création / publication annonce:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de créer / publier l'annonce."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublishExisting = async (post: SocialPost) => {
    if (!tenantId) {
      setError("Tenant non disponible. Reconnectez-vous.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${backendUrl}/api/social-posts/${post.id}/publish`,
        {
          method: "POST",
          headers: {
            "x-tenant-id": tenantId,
          },
        }
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(
          payload.error || "Erreur lors de la publication de l'annonce."
        );
      }
      await loadPosts();
    } catch (err) {
      console.error("Erreur publication annonce:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de publier l'annonce."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const mediaUrls = [
    ...uploadedUrls,
    ...mediaUrlsInput
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => u.length > 0),
  ];

  return (
    <>
      <PageHeader
        eyebrow="Ad Studio"
        title="Annonces multi-réseaux"
        subtitle="Rédigez votre annonce, choisissez vos réseaux et laissez Arcc En Ciel publier et entraîner l'IA automatiquement."
        actions={
          <Button
            variant="primary"
            size="md"
            icon="➕"
            onClick={() => setIsModalOpen(true)}
          >
            Publier une annonce
          </Button>
        }
      />

      {error && !isModalOpen && (
        <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      <SectionCard title="Historique des annonces">
        {isLoadingPosts ? (
          <div className="py-8 text-center text-sm text-slate-400">
            Chargement...
          </div>
        ) : posts.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-4xl mb-3">📭</div>
            <div className="text-sm text-slate-400 mb-2">
              Aucune annonce pour le moment.
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsModalOpen(true)}
              icon="➕"
            >
              Créer votre première annonce
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post, index) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
                className="group rounded-xl border border-slate-800 bg-slate-900/40 p-4 transition-all hover:border-slate-700 hover:bg-slate-900/60"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <StatusBadge
                        label={post.status.toLowerCase()}
                        tone={getStatusTone(post.status)}
                      />
                      {post.scheduledAt && (
                        <span className="text-[10px] text-slate-500">
                          📅 Programmée:{" "}
                          {new Date(post.scheduledAt).toLocaleString("fr-FR")}
                        </span>
                      )}
                      {post.publishedAt && (
                        <span className="text-[10px] text-slate-500">
                          ✅ Publiée:{" "}
                          {new Date(post.publishedAt).toLocaleString("fr-FR")}
                        </span>
                      )}
                    </div>
                    {post.title && (
                      <div className="text-sm font-semibold text-white mb-1">
                        {post.title}
                      </div>
                    )}
                    <div className="text-xs text-slate-300 line-clamp-2 mb-2">
                      {post.body}
                    </div>
                    {post.mediaUrls.length > 0 && (
                      <div className="text-[10px] text-slate-500 mb-2">
                        🖼️ {post.mediaUrls.length} image(s)
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {post.targets.map((target) => (
                        <span
                          key={target.id}
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                            getStatusTone(target.status) === "success"
                              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                              : getStatusTone(target.status) === "danger"
                              ? "border-rose-500/50 bg-rose-500/10 text-rose-300"
                              : getStatusTone(target.status) === "warning"
                              ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
                              : "border-slate-600/50 bg-slate-800/50 text-slate-300"
                          }`}
                        >
                          {ALL_NETWORKS.find((n) => n.id === target.network)?.icon || "•"}{" "}
                          {target.network}: {target.status}
                        </span>
                      ))}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Créée le{" "}
                      {new Date(post.createdAt).toLocaleString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {post.status !== "published" && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handlePublishExisting(post)}
                        disabled={isLoading}
                        icon="📤"
                      >
                        Publier
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Modal de création/édition */}
      <Dialog.Root open={isModalOpen} onOpenChange={setIsModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 max-h-[90vh] w-[95vw] max-w-4xl -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-800 bg-[#0b101d] shadow-[0_20px_60px_rgba(0,0,0,0.4)] z-50 flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <Dialog.Title className="text-lg font-semibold text-white">
                Studio d&apos;annonces
              </Dialog.Title>
              <Dialog.Close className="text-slate-400 hover:text-white transition-colors">
                ✕
              </Dialog.Close>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Colonne gauche : Éditeur */}
                <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-400">
                          Titre (optionnel)
                        </label>
                        <input
                          className="w-full rounded-lg border border-slate-800 bg-[#161b22] px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="Ex: Promo spéciale"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-400">
                          Programmation (optionnel)
                        </label>
                        <input
                          type="datetime-local"
                          className="w-full rounded-lg border border-slate-800 bg-[#161b22] px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
                          value={scheduledAt}
                          onChange={(e) => setScheduledAt(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-400">
                        Contenu de l&apos;annonce *
                      </label>
                      <textarea
                        className="min-h-[120px] w-full rounded-lg border border-slate-800 bg-[#161b22] px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none resize-none"
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder="Texte que vous souhaitez publier..."
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-400">
                        URLs d&apos;images (optionnel)
                      </label>
                      <textarea
                        className="min-h-[60px] w-full rounded-lg border border-slate-800 bg-[#161b22] px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none resize-none"
                        value={mediaUrlsInput}
                        onChange={(e) => setMediaUrlsInput(e.target.value)}
                        placeholder="Une URL par ligne..."
                      />
                      <div className="space-y-1 pt-1">
                        <label className="text-xs font-medium text-slate-400">
                          Ou téléversez des images depuis votre ordinateur
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="block w-full cursor-pointer text-xs text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-100 hover:file:bg-slate-600"
                          onChange={handleFilesChange}
                        />
                        {localFiles.length > 0 && (
                          <p className="text-[10px] text-slate-500">
                            {localFiles.length} image(s) sélectionnée(s) pour
                            l&apos;upload.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-400">
                        Réseaux à cibler *
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {ALL_NETWORKS.map((network) => {
                          const active = selectedNetworks.includes(network.id);
                          return (
                            <button
                              key={network.id}
                              type="button"
                              onClick={() => toggleNetwork(network.id)}
                              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                active
                                  ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                                  : "border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-500"
                              }`}
                            >
                              <span>{network.icon}</span>
                              <span>{network.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {error && (
                      <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                        {error}
                      </div>
                    )}
                  </div>

                {/* Colonne droite : Aperçu */}
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
                    <div className="mb-4 flex items-center gap-2 text-xs text-slate-400">
                      <span>📘 Facebook · Aperçu</span>
                    </div>
                    {title && (
                      <div className="text-lg font-semibold text-white mb-2">
                        {title}
                      </div>
                    )}
                    <div className="text-sm text-slate-200 whitespace-pre-wrap mb-4">
                      {body || (
                        <span className="text-slate-500 italic">
                          Commencez à écrire votre annonce pour voir l&apos;aperçu ici...
                        </span>
                      )}
                    </div>
                    {mediaUrls.length > 0 && (
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        {mediaUrls.slice(0, 4).map((url, idx) => (
                          <div
                            key={idx}
                            className="aspect-square rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden"
                          >
                            <img
                              src={url}
                              alt={`Preview ${idx + 1}`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>Réseaux: {selectedNetworks.join(", ")}</span>
                      {scheduledAt && (
                        <>
                          <span>•</span>
                          <span>
                            📅 {new Date(scheduledAt).toLocaleString("fr-FR")}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-800 px-6 py-4">
              <Button
                variant="secondary"
                size="md"
                onClick={handleSaveDraft}
                disabled={isLoading || !body.trim()}
                icon="💾"
              >
                Sauvegarder en brouillon
              </Button>
              <div className="flex gap-2">
                <Dialog.Close asChild>
                  <Button variant="secondary" size="md">
                    Annuler
                  </Button>
                </Dialog.Close>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handlePublish}
                  loading={isLoading}
                  disabled={!body.trim() || selectedNetworks.length === 0}
                  icon="🚀"
                >
                  {scheduledAt
                    ? "Programmer"
                    : isLoading
                    ? "Publication en cours et indexation IA..."
                    : "Publier & entraîner l'IA"}
                </Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
