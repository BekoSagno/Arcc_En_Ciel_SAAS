"use client";

import SectionCard from "@/src/components/ui/SectionCard";
import AdminTerminal from "./AdminTerminal";

export default function SystemLogs() {
  return (
    <SectionCard title="Journal système">
      <AdminTerminal />
    </SectionCard>
  );
}
