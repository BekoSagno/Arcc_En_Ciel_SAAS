"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import clsx from "clsx";

type Props = {
  className?: string;
};

/**
 * Logo combinant l'icône (fichier logo) et le mot-symbole "Arcc En Ciel".
 *
 * - Place le fichier du logo dans `frontend/public/logo.png` (haute résolution).
 * - Affichage centré, bien cadré, avec animation légère sur le texte.
 */
export default function BrandWordmark({ className }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className={clsx(
        "flex items-center gap-5 cursor-default select-none",
        className
      )}
    >
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-slate-200/90 bg-white shadow-[0_0_20px_rgba(15,23,42,0.95)] md:h-16 md:w-16">
        <Image
          src="/logo.png"
          alt="Logo Arcc En Ciel"
          width={56}
          height={56}
          sizes="(max-width: 768px) 56px, 64px"
          className="object-contain object-center p-2"
          priority
        />
      </div>
      <motion.span
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{
          scale: 1.05,
          y: -2,
        }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className={clsx(
          "text-aurora bg-gradient-to-r from-blue-400 via-pink-400 to-indigo-300 bg-clip-text text-transparent",
          "text-lg md:text-xl font-bold tracking-[0.2em] uppercase",
          "drop-shadow-[0_0_8px_rgba(129,140,248,0.6)]"
        )}
      >
        ARCC EN CIEL
      </motion.span>
    </motion.div>
  );
}

