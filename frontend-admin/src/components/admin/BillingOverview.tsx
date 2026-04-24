"use client";

import { useState, useEffect } from "react";
import SectionCard from "@/src/components/ui/SectionCard";
import StatusBadge from "@/src/components/ui/StatusBadge";
import { DollarSign, FileText, TrendingUp, AlertCircle } from "lucide-react";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

type Props = {
  session: any;
};

export default function BillingOverview({ session }: Props) {
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<"30" | "90" | "365">("30");

  useEffect(() => {
    loadBillingOverview();
    const interval = setInterval(loadBillingOverview, 30000); // 30 secondes
    return () => clearInterval(interval);
  }, [selectedPeriod]);

  const loadBillingOverview = async () => {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(selectedPeriod));

      const response = await fetch(
        `${backendUrl}/api/admin/billing/overview?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
        {
          headers: {
            "x-user-email": session?.user?.email || "",
            "x-user-role": session?.user?.role || "",
          },
          cache: "no-store",
        }
      );

      if (response.ok) {
        const data = await response.json();
        setOverview(data.data);
      }
    } catch (error) {
      console.error("Erreur lors du chargement de la facturation:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-slate-400">Chargement de la facturation...</div>;
  }

  const totals = overview?.totals || {};
  const invoices = overview?.invoices || {};

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Facturation & Utilisation</h3>
        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value as "30" | "90" | "365")}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300"
        >
          <option value="30">30 derniers jours</option>
          <option value="90">90 derniers jours</option>
          <option value="365">1 an</option>
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-[#0b101d] p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-400">
                Coût total
              </div>
              <div className="mt-2 text-3xl font-bold text-white">
                ${(totals.totalCostUsd || 0).toFixed(2)}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {totals.totalMessages || 0} messages
              </div>
            </div>
            <DollarSign className="h-8 w-8 text-emerald-400" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0b101d] p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-400">
                Tokens utilisés
              </div>
              <div className="mt-2 text-3xl font-bold text-white">
                {(totals.totalTokens || 0).toLocaleString()}
              </div>
              <div className="mt-1 text-xs text-slate-500">OpenAI</div>
            </div>
            <TrendingUp className="h-8 w-8 text-indigo-400" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0b101d] p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-400">
                Factures en attente
              </div>
              <div className="mt-2 text-3xl font-bold text-white">
                {invoices.pending || 0}
              </div>
              <div className="mt-1 text-xs text-slate-500">En retard</div>
            </div>
            <AlertCircle className="h-8 w-8 text-amber-400" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0b101d] p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-400">
                Payé ce mois
              </div>
              <div className="mt-2 text-3xl font-bold text-white">
                ${(invoices.paidThisMonth || 0).toFixed(2)}
              </div>
              <div className="mt-1 text-xs text-slate-500">Revenus</div>
            </div>
            <FileText className="h-8 w-8 text-rose-400" />
          </div>
        </div>
      </div>

      {overview?.tenantCosts && overview.tenantCosts.length > 0 && (
        <SectionCard title="Coûts par Tenant" className="mt-6">
          <div className="space-y-3">
            {overview.tenantCosts
              .sort((a: any, b: any) => (b.totalCostUsd || 0) - (a.totalCostUsd || 0))
              .slice(0, 10)
              .map((tenant: any) => (
                <div
                  key={tenant.tenantId}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#161b22] px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-semibold text-white">{tenant.tenantName}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {tenant.totalMessages || 0} messages ·{" "}
                      {(tenant.totalTokens || 0).toLocaleString()} tokens
                    </div>
                    {tenant.breakdown && (
                      <div className="mt-1 text-xs text-slate-500">
                        Meta WhatsApp: ${(tenant.breakdown.metaWhatsApp?.costUsd || 0).toFixed(2)} · OpenAI: $
                        {(tenant.breakdown.openai?.costUsd || 0).toFixed(2)} · Meta: $
                        {(tenant.breakdown.meta?.costUsd || 0).toFixed(2)}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-white">
                      ${(tenant.totalCostUsd || 0).toFixed(2)}
                    </div>
                    <div className="text-xs text-slate-500">Coût total</div>
                  </div>
                </div>
              ))}
          </div>
        </SectionCard>
      )}
    </>
  );
}
