import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Archivo } from "next/font/google";
import "./globals.css";
import Providers from "@/src/components/Providers";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Arcc En Ciel",
  description: "Plateforme SaaS IA pour WhatsApp, Messenger et Facebook.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={`${jakarta.variable} ${archivo.variable} antialiased bg-[#020617] text-slate-100`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
