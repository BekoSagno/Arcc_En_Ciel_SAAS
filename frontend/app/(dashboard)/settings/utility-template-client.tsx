"use client";

import { useEffect, useMemo, useState } from "react";
import StatusBadge from "@/src/components/ui/StatusBadge";
import Button from "@/src/components/ui/Button";

export default function UtilityTemplateClient() {
  const [template, setTemplate] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const backendUrl = useMemo(
    () => process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000",
    []
  );

  useEffect(() => {
    const load = async () => {
      const response = await fetch(`${backendUrl}/api/settings/utility-template`);
      if (response.ok) {
        const json = await response.json();
        setTemplate(json.data?.template || "");
      }
    };
    load();
  }, [backendUrl]);

  const save = async () => {
    setStatus("saving");
    const response = await fetch(`${backendUrl}/api/settings/utility-template`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template }),
    });
    setStatus(response.ok ? "saved" : "idle");
    setTimeout(() => setStatus("idle"), 2000);
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0b101d] p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
          Message automatique 24h
        </div>
        <StatusBadge
          label={status === "saved" ? "sauvegarde" : "pret"}
          tone={status === "saved" ? "success" : "info"}
        />
      </div>
      <textarea
        className="mt-3 min-h-[140px] w-full rounded-lg border border-slate-800 bg-[#161b22] px-3 py-2 text-sm text-slate-100"
        placeholder="Ex: Bonjour ! Je reviens vers vous pour savoir si vous avez besoin d'aide..."
        value={template}
        onChange={(event) => setTemplate(event.target.value)}
      />
      <Button
        variant="primary"
        size="md"
        icon="💾"
        loading={status === "saving"}
        onClick={save}
        className="mt-4"
      >
        {status === "saving" ? "Enregistrement..." : "Enregistrer"}
      </Button>
    </div>
  );
}
