"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import SectionCard from "@/src/components/ui/SectionCard";
import StatCard from "@/src/components/ui/StatCard";
import PageHeader from "@/src/components/ui/PageHeader";

export default function BillingPage() {
  const { data: session } = useSession();
  const tenantId = session?.user?.tenantId;
  const backendUrl = useMemo(
    () => process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000",
    []
  );
  const usdToGnfRate = useMemo(
    () => Number(process.env.NEXT_PUBLIC_USD_GNF_RATE || 9000),
    []
  );

  const [usage, setUsage] = useState({
    whatsappMessages: 0,
    tokenUsage: 0,
    costUsd: 0,
  });
  const [channelUsage, setChannelUsage] = useState<Array<{
    channel: string;
    messages: number;
    costUsd: number;
    tokens: number;
  }>>([]);
  const [subscription, setSubscription] = useState<any | null>(null);
  const [quota, setQuota] = useState<any | null>(null);
  const [plans, setPlans] = useState<
    Array<{
      id: string;
      name: string;
      description: string;
      priceGnfMonthly: number;
      priceGnfAnnual: number;
      conversationLimit: number | null;
      pdfLimit: number | null;
      channels: string[];
    }>
  >([]);
  const [boosterPacks, setBoosterPacks] = useState<any[]>([]);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">(
    "monthly",
  );
  const [paymentMethod, setPaymentMethod] = useState<string>("mobile_money");
  const [subLoading, setSubLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) return;

    const load = async () => {
      try {
        const headers = {
          "x-tenant-id": tenantId,
        };

        const [usageRes, channelRes, subRes, plansRes, quotaRes, boosterRes, invoicesRes] = await Promise.all([
          fetch(`${backendUrl}/api/metrics/usage`, { headers }),
          fetch(`${backendUrl}/api/metrics/channel-usage`, { headers }),
          fetch(`${backendUrl}/api/subscription/me`, { headers }),
          fetch(`${backendUrl}/api/subscription/plans`),
          fetch(`${backendUrl}/api/subscription/quota`, { headers }),
          fetch(`${backendUrl}/api/subscription/booster-packs`),
          fetch(`${backendUrl}/api/billing/invoices`, { headers }),
        ]);

        if (usageRes.ok) {
          const data = await usageRes.json();
          setUsage(data.data || { whatsappMessages: 0, tokenUsage: 0, costUsd: 0 });
        }

        if (channelRes.ok) {
          const data = await channelRes.json();
          setChannelUsage(data.data || []);
        }

        if (subRes.ok) {
          const data = await subRes.json();
          setSubscription(data.data?.subscription || null);
        }

        if (plansRes.ok) {
          const data = await plansRes.json();
          setPlans(data.data || []);
        }

        if (quotaRes.ok) {
          const data = await quotaRes.json();
          setQuota(data.data || null);
        }

        if (boosterRes.ok) {
          const data = await boosterRes.json();
          setBoosterPacks(data.data || []);
        }

        if (invoicesRes.ok) {
          const data = await invoicesRes.json();
          setInvoices(data.data || []);
        }
      } catch (error) {
        console.error("Erreur chargement facturation:", error);
      } finally {
        setLoading(false);
      }
    };

    load();
    
    // Rafraîchissement automatique toutes les 10 secondes
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [tenantId, backendUrl]);

  const cards = [
    {
      label: "Conversations utilisées",
      value: quota
        ? `${quota.quotaUsage?.conversationsUsed || 0} / ${quota.effectiveLimit || quota.quotaUsage?.conversationsLimit || "∞"}`
        : "0 / 0",
    },
    {
      label: "PDF uploadés",
      value: quota
        ? `${quota.quotaUsage?.pdfUploaded || 0} / ${quota.quotaUsage?.pdfLimit || "∞"}`
        : "0 / 0",
    },
    { label: "Tokens OpenAI", value: String(usage.tokenUsage) },
    {
      label: "Coût estimé",
      value: `${Math.round(usage.costUsd * usdToGnfRate).toLocaleString("fr-FR")} GNF`,
    },
  ];

  const handleSubscribe = async (planId: string) => {
    if (!tenantId || !planId) return;
    setSubLoading(true);
    try {
      const response = await fetch(
        `${backendUrl}/api/subscription/checkout`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant-id": tenantId,
          },
          body: JSON.stringify({
            planType: planId,
            billingCycle,
            paymentMethod,
          }),
        },
      );

      if (response.ok) {
        const data = await response.json();
        setSubscription(data.data);
      } else {
        const err = await response.json().catch(() => ({}));
        console.error("Erreur abonnement:", err.error || "inconnue");
        alert(
          err.error ||
            "Erreur lors de l'activation de l'abonnement. Veuillez réessayer.",
        );
      }
    } catch (error) {
      console.error("Erreur abonnement:", error);
      alert(
        "Erreur lors de l'activation de l'abonnement. Vérifiez votre connexion.",
      );
    } finally {
      setSubLoading(false);
    }
  };

  const formatDate = (value?: string | Date | null) => {
    if (!value) return "-";
    const d = new Date(value);
    return d.toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-400">Chargement de la facturation...</div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Facturation"
        title="Abonnement & Credits"
        subtitle="Suivi des consommations et du forfait en cours."
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mt-8 space-y-8"
      >
        {/* Section Abonnement */}
        <SectionCard title="Mon abonnement">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-[#161b22] px-4 py-3 interactive-glow interactive-raise">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Plan actif
              </div>
              <div className="mt-2 text-sm font-semibold text-white">
                {subscription?.planType
                  ? subscription.planType.toUpperCase()
                  : "Aucun plan actif"}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {subscription
                  ? `Du ${formatDate(subscription.startDate)} au ${formatDate(
                      subscription.endDate,
                    )}`
                  : "Choisissez un plan pour activer votre abonnement."}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#161b22] px-4 py-3 interactive-glow interactive-raise">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Cycle de facturation
              </div>
              <div className="mt-2 flex items-center gap-3 text-sm font-semibold text-white">
                <button
                  type="button"
                  onClick={() => setBillingCycle("monthly")}
                  className={`rounded-full px-3 py-1 text-xs ${
                    billingCycle === "monthly"
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-800 text-slate-300"
                  }`}
                >
                  Mensuel
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle("annual")}
                  className={`rounded-full px-3 py-1 text-xs ${
                    billingCycle === "annual"
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-800 text-slate-300"
                  }`}
                >
                  Annuel -15%
                </button>
              </div>
              <div className="mt-2 text-xs text-slate-400">
                Le cycle choisi sera appliqué au prochain abonnement.
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#161b22] px-4 py-3 interactive-glow interactive-raise">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Moyen de paiement
              </div>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-[#0b101d] px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
              >
                <option value="mobile_money">Mobile Money (Guinée)</option>
                <option value="bank_transfer">Virement bancaire</option>
                <option value="card">Carte bancaire</option>
                <option value="cash">Paiement en espèces (manuel)</option>
              </select>
              <div className="mt-2 text-xs text-slate-400">
                En mode test, le paiement est simulé et l'abonnement est
                activé immédiatement.
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {plans.map((plan) => {
              const isActive = subscription?.planType === plan.id;
              const price =
                billingCycle === "annual"
                  ? plan.priceGnfAnnual
                  : plan.priceGnfMonthly;
              return (
                <div
                  key={plan.id}
                  className={`flex h-full flex-col rounded-xl border px-4 py-4 interactive-glow interactive-raise ${
                    isActive
                      ? "border-indigo-500 bg-indigo-500/10"
                      : "border-slate-800 bg-[#161b22]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-white">
                      {plan.name}
                    </div>
                    {isActive && (
                      <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
                        Actif
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {plan.description}
                  </div>
                  <div className="mt-3 text-lg font-semibold text-indigo-400">
                    {price.toLocaleString("fr-FR")} GNF
                    <span className="ml-1 text-xs text-slate-400">
                      /{billingCycle === "annual" ? "an" : "mois"}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {plan.conversationLimit
                      ? `${plan.conversationLimit.toLocaleString(
                          "fr-FR",
                        )} conversations / mois`
                      : "Conversations illimitées"}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {plan.pdfLimit
                      ? `${plan.pdfLimit} PDF inclus`
                      : "PDF illimités"}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    Canaux: {plan.channels?.join(", ") || "WhatsApp"}
                  </div>
                  <button
                    type="button"
                    disabled={subLoading || isActive}
                    onClick={() => handleSubscribe(plan.id)}
                    className={`mt-4 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      isActive
                        ? "cursor-default bg-slate-800 text-slate-400"
                        : "bg-indigo-600 text-white hover:bg-indigo-500"
                    } disabled:opacity-60`}
                  >
                    {isActive
                      ? "Plan actuel"
                      : subLoading
                      ? "Activation..."
                      : "Choisir ce plan"}
                  </button>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <section className="grid gap-4 md:grid-cols-3">
          {cards.map((item, index) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <StatCard label={item.label} value={item.value} />
            </motion.div>
          ))}
        </section>

      {quota && (
        <SectionCard title="Utilisation des quotas">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-[#161b22] px-4 py-3">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Conversations
              </div>
              <div className="mt-2 text-sm font-semibold text-white">
                {quota.quotaUsage?.conversationsUsed || 0} / {quota.effectiveLimit || quota.quotaUsage?.conversationsLimit || "∞"}
              </div>
              {quota.quotaUsage?.conversationsLimit && (
                <div className="mt-2">
                  <div className="h-2 w-full rounded-full bg-slate-800">
                    <div
                      className="h-2 rounded-full bg-indigo-500"
                      style={{
                        width: `${Math.min(
                          100,
                          ((quota.quotaUsage?.conversationsUsed || 0) /
                            (quota.effectiveLimit || quota.quotaUsage?.conversationsLimit)) *
                            100
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {Math.round(
                      ((quota.quotaUsage?.conversationsUsed || 0) /
                        (quota.effectiveLimit || quota.quotaUsage?.conversationsLimit)) *
                        100
                    )}% utilisé
                  </div>
                </div>
              )}
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#161b22] px-4 py-3">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                PDF uploadés
              </div>
              <div className="mt-2 text-sm font-semibold text-white">
                {quota.quotaUsage?.pdfUploaded || 0} / {quota.quotaUsage?.pdfLimit || "∞"}
              </div>
            </div>
          </div>
          {quota.activeBoosters && quota.activeBoosters.length > 0 && (
            <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.2em] text-emerald-400">
                Packs Booster actifs
              </div>
              <div className="mt-2 text-sm text-white">
                {quota.totalBoosterConversations} conversations additionnelles disponibles
              </div>
            </div>
          )}
        </SectionCard>
      )}

      <SectionCard title="Usage par canal (jour)">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-400">
              <tr className="border-b border-slate-800">
                <th className="py-3">Canal</th>
                <th className="py-3">Messages</th>
                <th className="py-3">Tokens</th>
                <th className="py-3">Cout</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {channelUsage.length === 0 ? (
                <tr>
                  <td className="py-6 text-slate-400" colSpan={4}>
                    Aucun usage detecte pour aujourd'hui.
                  </td>
                </tr>
              ) : null}
              {channelUsage.map((item, index) => (
                <motion.tr
                  key={item.channel}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="hover:bg-slate-900/30 transition-colors"
                >
                  <td className="py-4 text-white">{item.channel}</td>
                  <td className="py-4 text-slate-300">{item.messages}</td>
                  <td className="py-4 text-slate-300">{item.tokens}</td>
                  <td className="py-4 text-slate-300">
                    {Math.round(item.costUsd * usdToGnfRate).toLocaleString("fr-FR")} GNF
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Factures">
        {invoices.length === 0 ? (
          <div className="text-sm text-slate-400">Aucune facture disponible pour l'instant.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-400">
                <tr className="border-b border-slate-800">
                  <th className="py-3">Numéro</th>
                  <th className="py-3">Période</th>
                  <th className="py-3">Total</th>
                  <th className="py-3">Statut</th>
                  <th className="py-3 text-right">Détails</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-900/30 align-top">
                    <td className="py-3 text-white">{inv.invoiceNumber || inv.id}</td>
                    <td className="py-3 text-slate-300">
                      {formatDate(inv.periodStart)} - {formatDate(inv.periodEnd)}
                    </td>
                    <td className="py-3 text-white">
                      {Math.round((inv.totalUsd || 0) * usdToGnfRate).toLocaleString("fr-FR")} GNF
                    </td>
                    <td className="py-3 text-slate-300 capitalize">{inv.status}</td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setOpenInvoiceId(openInvoiceId === inv.id ? null : inv.id)}
                        className="text-xs rounded-full bg-slate-800 px-3 py-1 text-slate-200 hover:bg-slate-700"
                      >
                        {openInvoiceId === inv.id ? "Masquer" : "Voir"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {invoices.map((inv) => {
          if (openInvoiceId !== inv.id) return null;
          const items = inv.lineItems || [];
          return (
            <div key={`details-${inv.id}`} className="mt-4 rounded-xl border border-slate-800 bg-[#161b22] p-4">
              <div className="mb-3 text-sm font-semibold text-white">Détails de la facture</div>
              {items.length === 0 ? (
                <div className="text-sm text-slate-400">Aucune ligne.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-slate-400">
                      <tr className="border-b border-slate-800">
                        <th className="py-2">Description</th>
                        <th className="py-2 text-right">Quantité</th>
                        <th className="py-2 text-right">PU (GNF)</th>
                        <th className="py-2 text-right">Total (GNF)</th>
                        <th className="py-2">Catégorie</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {items.map((li: any, idx: number) => (
                        <tr key={li.id || idx} className="hover:bg-slate-900/30">
                          <td className="py-2 text-white">{li.description}</td>
                          <td className="py-2 text-right text-slate-300">{li.quantity}</td>
                          <td className="py-2 text-right text-slate-300">
                            {Math.round((li.unitPrice || 0) * usdToGnfRate).toLocaleString("fr-FR")}
                          </td>
                          <td className="py-2 text-right text-white">
                            {Math.round((li.totalPrice || 0) * usdToGnfRate).toLocaleString("fr-FR")}
                          </td>
                          <td className="py-2 text-slate-300">{li.category || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </SectionCard>
      </motion.div>
    </>
  );
}
