"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useState } from "react";

type SplashScreenProps = {
  onComplete: () => void;
};

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Animation de la barre de progression sur 4.5 secondes
    const duration = 4500; // 4.5 secondes
    const interval = 16; // ~60fps
    const steps = duration / interval;
    const increment = 100 / steps;

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + increment;
        if (next >= 100) {
          clearInterval(timer);
          return 100;
        }
        return next;
      });
    }, interval);

    // Appeler onComplete après 4.5 secondes
    const timeout = setTimeout(() => {
      onComplete();
    }, duration);

    return () => {
      clearInterval(timer);
      clearTimeout(timeout);
    };
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ y: -50, opacity: 0 }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#020617]"
    >
      {/* Halos lumineux en arrière-plan */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/20 blur-[120px]" />
        <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-500/15 blur-[100px]" />
        <div className="absolute left-1/2 top-1/2 h-[200px] w-[200px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-pink-500/10 blur-[80px]" />
      </div>

      {/* Contenu principal */}
      <div className="relative z-10 flex flex-col items-center justify-center space-y-8">
        {/* Logo avec animation de rotation et scale */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{
            duration: 1,
            ease: [0.25, 0.46, 0.45, 0.94],
            delay: 0.2,
          }}
          className="relative"
        >
          <motion.div
            animate={{
              rotate: [0, 5, -5, 0],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-indigo-400/50 bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 shadow-[0_0_40px_rgba(129,140,248,0.4)] md:h-32 md:w-32"
          >
            <Image
              src="/logo.png"
              alt="Logo Arcc En Ciel"
              width={96}
              height={96}
              sizes="(max-width: 768px) 96px, 128px"
              className="object-contain object-center p-3"
              priority
            />
            {/* Effet de brillance rotatif */}
            <motion.div
              animate={{
                rotate: 360,
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "linear",
              }}
              className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/10 to-transparent"
            />
          </motion.div>
        </motion.div>

        {/* Nom de la marque avec dégradé */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.8,
            ease: "easeOut",
            delay: 0.6,
          }}
          className="text-center"
        >
          <motion.h1
            className="bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 bg-clip-text text-4xl font-bold tracking-[0.15em] text-transparent drop-shadow-[0_0_20px_rgba(129,140,248,0.6)] md:text-5xl lg:text-6xl"
            style={{ fontFamily: "var(--font-jakarta), 'Inter', sans-serif" }}
          >
            ARCC EN CIEL
          </motion.h1>
        </motion.div>

        {/* Slogan avec animation décalée */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.8,
            ease: "easeOut",
            delay: 1,
          }}
          className="text-center text-base font-medium text-slate-300 md:text-lg lg:text-xl"
          style={{ fontFamily: "var(--font-jakarta), 'Inter', sans-serif" }}
        >
          L&apos;intelligence qui illumine vos désirs
        </motion.p>

        {/* Barre de chargement fine et élégante */}
        <motion.div
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: "100%" }}
          transition={{
            duration: 0.5,
            ease: "easeOut",
            delay: 1.2,
          }}
          className="mt-8 w-64 md:w-80"
        >
          <div className="h-0.5 overflow-hidden rounded-full bg-slate-800/50">
            <motion.div
              initial={{ width: "0%" }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.16, ease: "linear" }}
              className="h-full bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 shadow-[0_0_10px_rgba(129,140,248,0.6)]"
            />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
