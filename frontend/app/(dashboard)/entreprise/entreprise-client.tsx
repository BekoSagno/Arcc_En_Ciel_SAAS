"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import Button from "@/src/components/ui/Button";
import PageHeader from "@/src/components/ui/PageHeader";

export default function EntrepriseClient() {
  const { data: session } = useSession();
  const tenantId = session?.user?.tenantId;
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

  const [form, setForm] = useState({
    companyName: "",
    industry: "",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!tenantId) return;

    const loadTenantInfo = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${backendUrl}/api/tenants/me`, {
          headers: {
            "x-tenant-id": tenantId,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setForm({
            companyName: data.companyName || "",
            industry: data.industry || "",
          });
        }
      } catch (err) {
        console.error("[ENTREPRISE] Erreur chargement:", err);
      } finally {
        setLoading(false);
      }
    };

    loadTenantInfo();
  }, [tenantId, backendUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const response = await fetch(`${backendUrl}/api/tenants/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId || "",
        },
        body: JSON.stringify({
          companyName: form.companyName.trim(),
          industry: form.industry.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de la mise à jour.");
      }

      setSuccess("Informations de l'entreprise mises à jour avec succès !");
      setTimeout(() => setSuccess(""), 5000);
    } catch (err: any) {
      setError(err.message || "Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-slate-400">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Informations de l'entreprise"
        subtitle="Renseignez les informations de votre entreprise pour personnaliser votre expérience."
      />

      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-800 bg-[#0b101d] p-6"
      >
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Nom de l'entreprise
            </label>
            <input
              type="text"
              className="w-full rounded-xl border border-slate-800 bg-[#020617] px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500/60"
              placeholder="Ex: Boutique Fashion Conakry"
              value={form.companyName}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, companyName: e.target.value }))
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Secteur d'activité
            </label>
            <input
              type="text"
              className="w-full rounded-xl border border-slate-800 bg-[#020617] px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500/60"
              placeholder="Ex: Commerce de détail, Services, E-commerce..."
              value={form.industry}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, industry: e.target.value }))
              }
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-400">
              {success}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              variant="primary"
              size="md"
              icon="💾"
              type="submit"
              loading={saving}
              disabled={saving}
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </div>
      </motion.form>
    </div>
  );
}
