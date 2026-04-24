"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Button from "@/src/components/ui/Button";

type Tenant = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
};

export default function TenantsClient() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [name, setName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [facebookPageId, setFacebookPageId] = useState("");
  const [twilioAccountSid, setTwilioAccountSid] = useState("");
  const [twilioAuthToken, setTwilioAuthToken] = useState("");
  const [metaAppId, setMetaAppId] = useState("");
  const [metaAppSecret, setMetaAppSecret] = useState("");
  const [metaVerifyToken, setMetaVerifyToken] = useState("");
  const [status, setStatus] = useState("");
  const backendUrl = useMemo(
    () => process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000",
    []
  );

  const loadTenants = async () => {
    const response = await fetch(`${backendUrl}/api/admin/tenants`);
    if (response.ok) {
      const json = await response.json();
      setTenants(json.data || []);
    }
  };

  useEffect(() => {
    loadTenants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createTenant = async () => {
    setStatus("creation...");
    const response = await fetch(`${backendUrl}/api/admin/tenants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        adminEmail,
        adminPassword,
        whatsappNumber: whatsappNumber || undefined,
        facebookPageId: facebookPageId || undefined,
        twilioAccountSid: twilioAccountSid || undefined,
        twilioAuthToken: twilioAuthToken || undefined,
        metaAppId: metaAppId || undefined,
        metaAppSecret: metaAppSecret || undefined,
        metaVerifyToken: metaVerifyToken || undefined,
      }),
    });
    if (response.ok) {
      setName("");
      setAdminEmail("");
      setAdminPassword("");
      setWhatsappNumber("");
      setFacebookPageId("");
      setTwilioAccountSid("");
      setTwilioAuthToken("");
      setMetaAppId("");
      setMetaAppSecret("");
      setMetaVerifyToken("");
      await loadTenants();
      setStatus("cree");
    } else {
      setStatus("erreur");
    }
    setTimeout(() => setStatus(""), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-[#0b101d] p-6">
        <div className="text-sm font-semibold text-white">
          Creer un client
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <input
            className="rounded-lg border border-slate-800 bg-[#161b22] px-3 py-2 text-sm text-slate-100"
            placeholder="Nom du client"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <input
            className="rounded-lg border border-slate-800 bg-[#161b22] px-3 py-2 text-sm text-slate-100"
            placeholder="Email admin"
            value={adminEmail}
            onChange={(event) => setAdminEmail(event.target.value)}
          />
          <input
            className="rounded-lg border border-slate-800 bg-[#161b22] px-3 py-2 text-sm text-slate-100"
            placeholder="Mot de passe"
            type="password"
            value={adminPassword}
            onChange={(event) => setAdminPassword(event.target.value)}
          />
          <input
            className="rounded-lg border border-slate-800 bg-[#161b22] px-3 py-2 text-sm text-slate-100"
            placeholder="WhatsApp number"
            value={whatsappNumber}
            onChange={(event) => setWhatsappNumber(event.target.value)}
          />
          <input
            className="rounded-lg border border-slate-800 bg-[#161b22] px-3 py-2 text-sm text-slate-100"
            placeholder="Facebook Page ID"
            value={facebookPageId}
            onChange={(event) => setFacebookPageId(event.target.value)}
          />
          <input
            className="rounded-lg border border-slate-800 bg-[#161b22] px-3 py-2 text-sm text-slate-100"
            placeholder="Twilio Account SID"
            value={twilioAccountSid}
            onChange={(event) => setTwilioAccountSid(event.target.value)}
          />
          <input
            className="rounded-lg border border-slate-800 bg-[#161b22] px-3 py-2 text-sm text-slate-100"
            placeholder="Twilio Auth Token"
            value={twilioAuthToken}
            onChange={(event) => setTwilioAuthToken(event.target.value)}
          />
          <input
            className="rounded-lg border border-slate-800 bg-[#161b22] px-3 py-2 text-sm text-slate-100"
            placeholder="Meta App ID"
            value={metaAppId}
            onChange={(event) => setMetaAppId(event.target.value)}
          />
          <input
            className="rounded-lg border border-slate-800 bg-[#161b22] px-3 py-2 text-sm text-slate-100"
            placeholder="Meta App Secret"
            value={metaAppSecret}
            onChange={(event) => setMetaAppSecret(event.target.value)}
          />
          <input
            className="rounded-lg border border-slate-800 bg-[#161b22] px-3 py-2 text-sm text-slate-100"
            placeholder="Meta Verify Token"
            value={metaVerifyToken}
            onChange={(event) => setMetaVerifyToken(event.target.value)}
          />
        </div>
        <Button
          variant="primary"
          size="md"
          icon="➕"
          loading={status === "creation..."}
          onClick={createTenant}
          className="mt-4"
        >
          {status === "creation..." ? "Création..." : "Créer"}
        </Button>
        {status ? (
          <div className="mt-3 text-xs text-slate-400">Status: {status}</div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-[#0b101d] p-6">
        <div className="text-sm font-semibold text-white">Clients</div>
        <div className="mt-4 divide-y divide-slate-800">
          {tenants.map((tenant, index) => (
            <motion.div
              key={tenant.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="flex items-center justify-between py-3 hover:bg-slate-900/30 transition-colors rounded-lg px-2"
            >
              <div>
                <div className="text-sm text-white">{tenant.name}</div>
                <div className="text-xs text-slate-400">
                  {new Date(tenant.createdAt).toLocaleString("fr-FR")}
                </div>
              </div>
              <span className="text-xs uppercase text-emerald-300">actif</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
