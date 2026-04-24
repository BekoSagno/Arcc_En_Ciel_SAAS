"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion } from "framer-motion";
import {
  Facebook,
  Instagram,
  Linkedin,
  Twitch,
  Twitter,
  MessageCircle,
  X as XIcon,
} from "lucide-react";

import PageHeader from "@/src/components/ui/PageHeader";
import SectionCard from "@/src/components/ui/SectionCard";
import Button from "@/src/components/ui/Button";
import StatusBadge from "@/src/components/ui/StatusBadge";

type SocialAccount = {
  id: string;
  tenantId: string;
  platform: string;
  platformId: string;
  isActive: boolean;
  hasToken: boolean;
};

const PLATFORMS = [
  {
    id: "FACEBOOK",
    name: "Facebook Pages",
    description: "Publiez sur votre page professionnelle.",
    icon: Facebook,
    accent: "text-blue-400",
  },
  {
    id: "INSTAGRAM",
    name: "Instagram Business",
    description: "Photos & reels via votre compte business.",
    icon: Instagram,
    accent: "text-pink-400",
  },
  {
    id: "LINKEDIN",
    name: "LinkedIn",
    description: "Posts B2B sur votre page entreprise.",
    icon: Linkedin,
    accent: "text-sky-300",
  },
  {
    id: "TIKTOK",
    name: "TikTok",
    description: "Courtes vidéos pour booster votre visibilité.",
    icon: Twitch,
    accent: "text-purple-400",
  },
  {
    id: "TWITTER",
    name: "X (Twitter)",
    description: "Annonces rapides pour votre audience.",
    icon: XIcon,
    accent: "text-slate-200",
  },
  {
    id: "THREADS",
    name: "Threads",
    description: "Conversations continues avec votre communauté.",
    icon: MessageCircle,
    accent: "text-emerald-300",
  },
];

export default function IntegrationsClient() {
  const { data: session } = useSession();
  const tenantId = session?.user?.tenantId;

  const backendUrl = useMemo(
    () => process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000",
    []
  );

  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(
    null
  );
  const [platformIdInput, setPlatformIdInput] = useState("");
  const [tokenInput, setTokenInput] = useState("");

  const loadAccounts = async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${backendUrl}/api/social-accounts`, {
        headers: {
          "x-tenant-id": tenantId,
        },
        cache: "no-store",
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(
          payload.error || "Impossible de charger les intégrations sociales."
        );
      }
      const json = await res.json();
      setAccounts(json.data || []);
    } catch (err) {
      console.error("Erreur chargement comptes sociaux:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Erreur lors du chargement des intégrations."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenantId) {
      loadAccounts();
    }
  }, [tenantId]);

  const openDialogForPlatform = (platformId: string) => {
    setSelectedPlatform(platformId);
    const existing = accounts.find((acc) => acc.platform === platformId);
    setPlatformIdInput(existing?.platformId || "");
    setTokenInput("");
    setIsDialogOpen(true);
  };

  const handleSaveIntegration = async () => {
    if (!tenantId || !selectedPlatform) return;
    if (!platformIdInput.trim()) {
      setError("L'identifiant de la page / du compte est requis.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${backendUrl}/api/social-accounts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({
          platform: selectedPlatform,
          platformId: platformIdInput.trim(),
          accessToken: tokenInput.trim() || null,
          isActive: true,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(
          payload.error || "Erreur lors de l'enregistrement de l'intégration."
        );
      }

      setIsDialogOpen(false);
      setPlatformIdInput("");
      setTokenInput("");
      await loadAccounts();
    } catch (err) {
      console.error("Erreur enregistrement compte social:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Impossible d'enregistrer l'intégration."
      );
    } finally {
      setLoading(false);
    }
  };

  const getAccountFor = (platformId: string) =>
    accounts.find((acc) => acc.platform === platformId) || null;

  return (
    <>
      <PageHeader
        eyebrow="Intégrations"
        title="Connexion à vos réseaux sociaux"
        subtitle="Connectez vos comptes professionnels pour permettre la publication automatique directe depuis Arcc En Ciel (API Meta, LinkedIn, etc.)."
      />

      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      <SectionCard title="Réseaux disponibles">
        {loading && accounts.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-400">
            Chargement des intégrations...
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {PLATFORMS.map((platform) => {
              const Icon = platform.icon;
              const account = getAccountFor(platform.id);
              const isConnected = !!account?.hasToken && account?.isActive;

              return (
                <motion.div
                  key={platform.id}
                  whileHover={{ y: -4 }}
                  className="rounded-2xl border border-slate-800 bg-[#050816] p-4 shadow-[0_18px_60px_rgba(2,6,23,0.6)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900">
                        <Icon className={`h-5 w-5 ${platform.accent}`} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">
                          {platform.name}
                        </div>
                        <div className="text-xs text-slate-400">
                          {platform.description}
                        </div>
                      </div>
                    </div>
                    <StatusBadge
                      label={isConnected ? "Connecté" : "Déconnecté"}
                      tone={isConnected ? "success" : "warning"}
                    />
                  </div>
                  {account?.platformId && (
                    <div className="mt-3 text-[11px] text-slate-500 truncate">
                      ID connecté :{" "}
                      <span className="text-slate-300">
                        {account.platformId}
                      </span>
                    </div>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    className="mt-4 w-full rounded-2xl"
                    onClick={() => openDialogForPlatform(platform.id)}
                    loading={loading && selectedPlatform === platform.id}
                  >
                    {isConnected ? "Modifier la connexion" : "Connecter"}
                  </Button>
                </motion.div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <Dialog.Root open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-800 bg-[#020617] p-6 shadow-[0_25px_80px_rgba(15,23,42,0.9)]">
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <Dialog.Title className="text-base font-semibold text-white">
                {selectedPlatform
                  ? `Configurer ${PLATFORMS.find((p) => p.id === selectedPlatform)?.name || ""}`
                  : "Configurer l'intégration"}
              </Dialog.Title>
              <Dialog.Close className="text-slate-500 hover:text-slate-200">
                ✕
              </Dialog.Close>
            </div>

            <div className="mt-4 space-y-4 text-sm">
              <p className="text-xs text-slate-400">
                Collez ici l'identifiant de la page / du compte et le token
                d'accès généré pour cette intégration. Ces informations sont
                chiffrées côté serveur.
              </p>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">
                  ID de page / compte (platformId)
                </label>
                <input
                  className="w-full rounded-lg border border-slate-800 bg-[#0b1120] px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                  value={platformIdInput}
                  onChange={(e) => setPlatformIdInput(e.target.value)}
                  placeholder="Ex: page_id Facebook, business_id Instagram..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">
                  Access Token (sera chiffré)
                </label>
                <textarea
                  className="min-h-[80px] w-full rounded-lg border border-slate-800 bg-[#0b1120] px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none resize-none"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Collez ici le token généré pour cette intégration..."
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <Dialog.Close asChild>
                <Button variant="secondary" size="sm">
                  Annuler
                </Button>
              </Dialog.Close>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveIntegration}
                loading={loading}
              >
                Enregistrer
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

