import SectionCard from "@/src/components/ui/SectionCard";
import PageHeader from "@/src/components/ui/PageHeader";
import UtilityTemplateClient from "./utility-template-client";

const settings = [
  { label: "Mode IA", value: "GPT-4o-mini" },
  { label: "Langue", value: "Francais (Guinee)" },
  { label: "Timezone", value: "Africa/Conakry" },
  { label: "Handoff humain", value: "Actif" },
];

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Parametres"
        title="Configuration generale"
        subtitle="Parametres globaux de la plateforme."
      />

      <SectionCard title="Configuration IA">
        <div className="grid gap-4 md:grid-cols-2">
          {settings.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-slate-800 bg-[#161b22] px-4 py-3"
            >
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                {item.label}
              </div>
              <div className="mt-2 text-sm font-semibold text-white">
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Template WhatsApp Utility">
        <UtilityTemplateClient />
      </SectionCard>
    </>
  );
}

