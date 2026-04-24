"use client";

import { useMemo, useState } from "react";
import Button from "@/src/components/ui/Button";

export default function WebhooksClient() {
  const [status, setStatus] = useState("");
  const backendUrl = useMemo(
    () => process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000",
    []
  );

  const testMeta = async () => {
    setStatus("test meta...");
    const url = `${backendUrl}/api/webhooks/facebook?hub.mode=subscribe&hub.verify_token=arcc-meta-verify&hub.challenge=12345`;
    const response = await fetch(url);
    const text = await response.text();
    setStatus(`Meta: ${response.status} · ${text}`);
  };

  const testTwilio = async () => {
    setStatus("test twilio...");
    const url = `${backendUrl}/api/webhooks/whatsapp?token=arcc-twilio-verify`;
    const response = await fetch(url);
    const json = await response.json();
    setStatus(`Twilio: ${response.status} · ${JSON.stringify(json)}`);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-[#0b101d] p-6">
        <div className="text-sm font-semibold text-white">
          Validation Webhooks
        </div>
        <p className="mt-2 text-sm text-slate-400">
          Teste la verification automatique Meta/Twilio.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            variant="primary"
            size="md"
            icon="🔵"
            loading={status === "test meta..."}
            onClick={testMeta}
          >
            Tester Meta
          </Button>
          <Button
            variant="success"
            size="md"
            icon="💬"
            loading={status === "test twilio..."}
            onClick={testTwilio}
          >
            Tester Twilio
          </Button>
        </div>
        {status ? (
          <div className="mt-4 rounded-lg border border-slate-800 bg-[#161b22] px-3 py-2 text-xs text-slate-300">
            {status}
          </div>
        ) : null}
      </div>
    </div>
  );
}
