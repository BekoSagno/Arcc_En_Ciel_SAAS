"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import SectionCard from "@/src/components/ui/SectionCard";
import StatusBadge from "@/src/components/ui/StatusBadge";
import PageHeader from "@/src/components/ui/PageHeader";
import Button from "@/src/components/ui/Button";

type ChannelConfig = {
  id: string;
  channel: string;
  status: string;
  credentials?: Record<string, string>;
};

const CHANNELS = [
  { key: "WHATSAPP", label: "WhatsApp (Meta)" },
  { key: "MESSENGER", label: "Messenger" },
  { key: "FACEBOOK_COMMENT", label: "Facebook Comments" },
];

export default function ChannelsClient() {
  const { data: session } = useSession();
  const tenantId = session?.user?.tenantId;
  const [configs, setConfigs] = useState<ChannelConfig[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const backendUrl = useMemo(
    () => process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000",
    []
  );

  const loadConfigs = async () => {
    if (!tenantId) return;

    const response = await fetch(`${backendUrl}/api/channels`, {
      headers: {
        "x-tenant-id": tenantId,
      },
    });
    if (response.ok) {
      const json = await response.json();
      setConfigs(json.data || []);
    }
  };

  useEffect(() => {
    if (!tenantId) return;
    loadConfigs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, backendUrl]);

  const getConfig = (channel: string) =>
    configs.find((cfg) => cfg.channel === channel);

  const updateConfig = async (channel: string, values: Record<string, string>) => {
    setIsSaving(true);
    await fetch(`${backendUrl}/api/channels`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(tenantId ? { "x-tenant-id": tenantId } : {}),
      },
      body: JSON.stringify({
        channel,
        status: "active",
        credentials: values,
      }),
    });
    await loadConfigs();
    setIsSaving(false);
  };

  return (
    <>
      <PageHeader
        eyebrow="Channels"
        title="Connexions aux canaux"
        subtitle="Configurez les tokens Meta pour activer l'automation WhatsApp."
      />

      <SectionCard
        title="Etat des canaux"
        action={
          <StatusBadge
            label={isSaving ? "saving" : "ready"}
            tone={isSaving ? "warning" : "success"}
          />
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          {CHANNELS.map((channel, index) => {
            const config = getConfig(channel.key);
            return (
              <motion.div
                key={channel.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="rounded-2xl border border-slate-800 bg-[#161b22] p-4 hover:border-slate-700 transition-all duration-200"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-white">
                    {channel.label}
                  </div>
                  <StatusBadge
                    label={config?.status || "inactive"}
                    tone={config?.status === "active" ? "success" : "warning"}
                  />
                </div>
                <div className="mt-3 text-xs text-slate-400">
                  Derniere verification: -- 
                </div>
              </motion.div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="Configuration">
        <div className="grid gap-6 md:grid-cols-2">
          <ChannelForm
            title="Meta WhatsApp"
            fields={[
              { key: "phoneNumberId", label: "WhatsApp Phone Number ID" },
              { key: "wabaId", label: "Business Account ID (WABA)" },
              { key: "accessToken", label: "Meta Access Token" },
            ]}
            initialValues={getConfig("WHATSAPP")?.credentials || {}}
            onSave={(values) => updateConfig("WHATSAPP", values)}
          />
          <ChannelForm
            title="Meta Messenger"
            fields={[
              { key: "appId", label: "App ID" },
              { key: "appSecret", label: "App Secret" },
              { key: "verifyToken", label: "Verify Token" },
            ]}
            initialValues={getConfig("MESSENGER")?.credentials || {}}
            onSave={(values) => updateConfig("MESSENGER", values)}
          />
          <ChannelForm
            title="Facebook Comments"
            fields={[
              { key: "pageId", label: "Page ID" },
              { key: "pageAccessToken", label: "Page Access Token" },
            ]}
            initialValues={getConfig("FACEBOOK_COMMENT")?.credentials || {}}
            onSave={(values) => updateConfig("FACEBOOK_COMMENT", values)}
          />
        </div>
      </SectionCard>

      <SectionCard title="Webhooks">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-[#161b22] px-4 py-3">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Meta Webhook
            </div>
            <div className="mt-2 text-sm text-slate-200">
              {backendUrl}/api/webhooks/facebook
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#161b22] px-4 py-3">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Meta WhatsApp Webhook
            </div>
            <div className="mt-2 text-sm text-slate-200">
              {backendUrl}/api/webhooks/whatsapp
            </div>
          </div>
        </div>
      </SectionCard>
    </>
  );
}

function ChannelForm({
  title,
  fields,
  initialValues,
  onSave,
}: {
  title: string;
  fields: { key: string; label: string }[];
  initialValues: Record<string, string>;
  onSave: (values: Record<string, string>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    setValues(initialValues || {});
  }, [initialValues]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0b101d] p-5">
      <div className="text-sm font-semibold text-white">{title}</div>
      <div className="mt-4 space-y-3">
        {fields.map((field) => (
          <div key={field.key} className="space-y-1">
            <label className="text-xs text-slate-400">{field.label}</label>
            <input
              className="w-full rounded-lg border border-slate-800 bg-[#161b22] px-3 py-2 text-sm text-slate-100"
              value={values[field.key] || ""}
              onChange={(event) =>
                setValues((prev) => ({
                  ...prev,
                  [field.key]: event.target.value,
                }))
              }
            />
          </div>
        ))}
      </div>
      <Button
        variant="primary"
        size="md"
        icon="💾"
        onClick={() => onSave(values)}
        className="mt-4 w-full"
      >
        Enregistrer
      </Button>
    </div>
  );
}
