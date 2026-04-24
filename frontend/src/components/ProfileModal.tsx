"use client";

import { useState, useEffect } from "react";
import { X, Save, Building2, User, Mail, Phone, Briefcase } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import Button from "./ui/Button";

interface ProfileData {
  user: {
    id: string;
    name: string;
    email: string;
  };
  tenant: {
    id: string;
    companyName: string;
    industry: string;
    timezone: string;
  };
  whatsappNumber: string;
}

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  // useSession fournit une méthode update() pour rafraîchir la session côté client
  const { data: session, update } = useSession();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

  const [formData, setFormData] = useState<ProfileData>({
    user: {
      id: "",
      name: "",
      email: "",
    },
    tenant: {
      id: "",
      companyName: "",
      industry: "",
      timezone: "Africa/Conakry",
    },
    whatsappNumber: "",
  });

  // Charger les données du profil
  useEffect(() => {
    if (isOpen && session?.user?.tenantId) {
      loadProfile();
    }
  }, [isOpen, session]);

  const loadProfile = async () => {
    setLoading(true);
    setError("");
    try {
      const tenantId = session?.user?.tenantId;
      if (!tenantId) return;

      // Charger les données tenant, utilisateur et WhatsApp
      const [tenantRes, userRes, whatsappRes] = await Promise.all([
        fetch(`${backendUrl}/api/tenants/me`, {
          headers: {
            "x-tenant-id": tenantId,
          },
        }),
        fetch(`${backendUrl}/api/users/profile`, {
          headers: {
            "x-tenant-id": tenantId,
          },
        }),
        fetch(`${backendUrl}/api/channels/identities?channel=WHATSAPP`, {
          headers: {
            "x-tenant-id": tenantId,
          },
        }),
      ]);

      if (tenantRes.ok) {
        const tenantData = await tenantRes.json();
        const userData = userRes.ok ? await userRes.json() : null;
        let whatsappNumber = "";

        if (whatsappRes.ok) {
          const whatsappData = await whatsappRes.json();
          const whatsappIdentity = whatsappData.data?.find(
            (id: any) => id.channel === "WHATSAPP"
          );
          whatsappNumber = whatsappIdentity?.externalId || "";
        }

        setFormData({
          user: {
            id: userData?.id || session?.user?.id || "",
            name: userData?.name || session?.user?.name || "",
            email: userData?.email || session?.user?.email || "",
          },
          tenant: {
            id: tenantData.id || tenantId,
            companyName: tenantData.companyName || "",
            industry: tenantData.industry || "",
            timezone: tenantData.timezone || "Africa/Conakry",
          },
          whatsappNumber,
        });
      } else {
        setError("Erreur lors du chargement des données");
      }
    } catch (err) {
      console.error("Erreur chargement profil:", err);
      setError("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!session?.user?.tenantId) return;

    setSaving(true);
    setError("");

    try {
      const tenantId = session.user.tenantId;

      // Mettre à jour l'utilisateur
      const userRes = await fetch(`${backendUrl}/api/users/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: formData.user.id,
          name: formData.user.name,
          email: formData.user.email,
        }),
      });

      if (!userRes.ok) {
        const errorData = await userRes.json().catch(() => ({}));
        throw new Error(errorData.error || "Erreur lors de la mise à jour de l'utilisateur");
      }

      // Mettre à jour le tenant
      const tenantRes = await fetch(`${backendUrl}/api/tenants/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({
          companyName: formData.tenant.companyName,
          industry: formData.tenant.industry,
          timezone: formData.tenant.timezone,
        }),
      });

      if (!tenantRes.ok) {
        const errorData = await tenantRes.json().catch(() => ({}));
        throw new Error(errorData.error || "Erreur lors de la mise à jour de l'entreprise");
      }

      // Mettre à jour le numéro WhatsApp dans ChannelIdentity
      if (formData.whatsappNumber) {
        const whatsappRes = await fetch(`${backendUrl}/api/channels/identities`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant-id": tenantId,
          },
          body: JSON.stringify({
            channel: "WHATSAPP",
            externalId: formData.whatsappNumber.trim(),
            label: "WhatsApp Business",
          }),
        });

        if (!whatsappRes.ok) {
          console.warn("Erreur lors de la mise à jour du numéro WhatsApp (peut être déjà configuré)");
        }
      }

      // Rafraîchir la session
      await update();

      // Fermer la modal
      onClose();
    } catch (err: any) {
      console.error("Erreur sauvegarde:", err);
      setError(err.message || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-24">
        {/* Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl rounded-2xl border border-slate-800 bg-[#0b101d] shadow-2xl max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="sticky top-0 flex items-center justify-between border-b border-slate-800 bg-[#0b101d] px-6 py-4">
            <h2 className="text-xl font-semibold text-white">Profil et Entreprise</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {loading ? (
              <div className="text-center py-8 text-slate-400">Chargement...</div>
            ) : (
              <>
                {error && (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                    {error}
                  </div>
                )}

                {/* Informations Personnelles */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-300 uppercase tracking-wider">
                    <User className="h-4 w-4" />
                    Informations Personnelles
                  </div>

                  <div className="space-y-4 rounded-xl border border-slate-800 bg-[#161b22] p-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-2">
                        Nom complet
                      </label>
                      <input
                        type="text"
                        value={formData.user.name}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            user: { ...formData.user, name: e.target.value },
                          })
                        }
                        className="w-full rounded-lg border border-slate-700 bg-[#0b101d] px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                        placeholder="Votre nom complet"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-slate-400 mb-2">
                        Email
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <input
                          type="email"
                          value={formData.user.email}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              user: { ...formData.user, email: e.target.value },
                            })
                          }
                          className="w-full rounded-lg border border-slate-700 bg-[#0b101d] pl-10 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                          placeholder="votre@email.com"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-400 mb-2">
                        Numéro WhatsApp Business
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <input
                          type="tel"
                          value={formData.whatsappNumber}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              whatsappNumber: e.target.value,
                            })
                          }
                          className="w-full rounded-lg border border-slate-700 bg-[#0b101d] pl-10 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                          placeholder="+224 623 858 991"
                        />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Format: +224 623 858 991 (avec indicatif pays)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Informations Entreprise */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-300 uppercase tracking-wider">
                    <Building2 className="h-4 w-4" />
                    Informations Entreprise
                  </div>

                  <div className="space-y-4 rounded-xl border border-slate-800 bg-[#161b22] p-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-2">
                        Nom de l'entreprise
                      </label>
                      <div className="relative">
                        <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <input
                          type="text"
                          value={formData.tenant.companyName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              tenant: { ...formData.tenant, companyName: e.target.value },
                            })
                          }
                          className="w-full rounded-lg border border-slate-700 bg-[#0b101d] pl-10 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                          placeholder="Nom de votre entreprise"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-400 mb-2">
                        Secteur d'activité
                      </label>
                      <input
                        type="text"
                        value={formData.tenant.industry}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            tenant: { ...formData.tenant, industry: e.target.value },
                          })
                        }
                        className="w-full rounded-lg border border-slate-700 bg-[#0b101d] px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                        placeholder="Ex: Commerce, Services, Formation..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-slate-400 mb-2">
                        Fuseau horaire
                      </label>
                      <select
                        value={formData.tenant.timezone}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            tenant: { ...formData.tenant, timezone: e.target.value },
                          })
                        }
                        className="w-full rounded-lg border border-slate-700 bg-[#0b101d] px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                      >
                        <option value="Africa/Conakry">Africa/Conakry (Guinée)</option>
                        <option value="Africa/Abidjan">Africa/Abidjan (Côte d'Ivoire)</option>
                        <option value="Africa/Dakar">Africa/Dakar (Sénégal)</option>
                        <option value="Africa/Bamako">Africa/Bamako (Mali)</option>
                        <option value="UTC">UTC</option>
                      </select>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-800 bg-[#0b101d] px-6 py-4">
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              loading={saving}
              icon={<Save className="h-4 w-4" />}
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
