"use client";

import { useState, useEffect } from "react";

const logs = [
  "[INFO] 10:22:14 Worker queue active",
  "[INFO] 10:22:29 Webhook WhatsApp OK",
  "[WARN] 10:23:03 Pinecone latency 1.8s",
  "[INFO] 10:23:22 Messenger delivery success",
  "[ERROR] 10:24:01 Meta signature mismatch (test)",
  "[INFO] 10:25:15 Tenant 'Boutique Arcc Test' créé",
  "[INFO] 10:26:42 RAG indexing complété pour tenant 9b801926-c38a-45ee-903d-47d67e45ef85",
  "[INFO] 10:28:33 Nouvelle conversation WhatsApp initiée",
];

export default function AdminTerminal() {
  const [currentLogs, setCurrentLogs] = useState(logs);

  // Simuler l'ajout de nouveaux logs (à remplacer par un vrai système de logs)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
      const newLog = `[INFO] ${timeStr} Système opérationnel`;
      setCurrentLogs((prev) => [newLog, ...prev].slice(0, 50)); // Garder les 50 derniers
    }, 30000); // Toutes les 30 secondes

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="rounded-2xl border border-slate-800 bg-black/50 p-5 text-xs font-mono text-emerald-400 shadow-[0_10px_30px_rgba(2,6,23,0.6)] max-h-[500px] overflow-y-auto">
      {currentLogs.map((line, index) => {
        const isError = line.includes("[ERROR]");
        const isWarn = line.includes("[WARN]");
        return (
          <div
            key={`${line}-${index}`}
            className={`leading-6 ${
              isError
                ? "text-rose-400"
                : isWarn
                  ? "text-amber-400"
                  : "text-emerald-400"
            }`}
          >
            {line}
          </div>
        );
      })}
    </div>
  );
}
