"use client";

import Link from "next/link";
import {
  Brain,
  ShieldCheck,
  LineChart,
  MessagesSquare,
  ArrowRight,
  MessageCircle,
  Facebook,
  MessageSquare,
  Zap,
  ChevronDown,
  Instagram,
  Linkedin,
  MapPin,
  Phone,
  Mail,
  Menu,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import BrandWordmark from "@/src/components/BrandWordmark";
import SplashScreen from "@/src/components/SplashScreen";

const modules = [
  {
    title: "Cerveau IA",
    description:
      "RAG proprietaire base sur Gemini 1.5 pour une precision chirurgicale.",
    icon: Brain,
  },
  {
    title: "Omnicanal",
    description:
      "Repondez partout (WhatsApp, Messenger, Commentaires FB).",
    icon: MessagesSquare,
  },
  {
    title: "Analytics",
    description: "Suivez vos conversions et vos leads en temps reel.",
    icon: LineChart,
  },
  {
    title: "Securite",
    description: "Vos donnees sont isolees et cryptees pour chaque boutique.",
    icon: ShieldCheck,
  },
];

const steps = [
  {
    title: "1. Créer votre compte",
    description: "Inscrivez-vous, créez votre boutique et accédez au dashboard.",
  },
  {
    title: "2. Choisir votre abonnement",
    description:
      "Sélectionnez le plan Starter, Pro ou Enterprise et le mode de paiement (Mobile Money, virement, carte).",
  },
  {
    title: "3. Charger vos contenus",
    description: "Déposez vos documents (PDF, Word, Excel, catalogues) pour nourrir l’IA.",
  },
  {
    title: "4. Connecter vos canaux",
    description: "Activez WhatsApp, Messenger et les commentaires Facebook en quelques clics.",
  },
  {
    title: "5. Lancer vos conversations",
    description:
      "Votre conseiller IA répond automatiquement aux clients, transmet à un humain si besoin, et apprend des échanges.",
  },
];

export default function Home() {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showIntro, setShowIntro] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Le splash screen se masque automatiquement après 4.5 secondes via son callback
    // Mais on garde cette logique pour éviter tout problème
  }, []);

  const navItems = [
    {
      label: "Canaux",
      href: "#channels",
      submenu: [
        { label: "WhatsApp", href: "#channels" },
        { label: "Messenger", href: "#channels" },
        { label: "Facebook Comments", href: "#channels" },
      ],
    },
    {
      label: "Modules",
      href: "#modules",
      submenu: modules.map((m) => ({ label: m.title, href: "#modules" })),
    },
    {
      label: "Parcours",
      href: "#how",
      submenu: steps.slice(0, 4).map((s) => ({ label: s.title, href: "#how" })),
    },
    { label: "Demo", href: "#demo" },
  ];

  return (
    <>
      <AnimatePresence mode="wait">
        {showIntro && (
          <SplashScreen
            onComplete={() => {
              setShowIntro(false);
            }}
          />
        )}
      </AnimatePresence>
      {!showIntro && (
    <div className="min-h-screen bg-[#020617] text-white overflow-x-hidden">
      <header className="border-b border-slate-700/50 bg-[#020617] shadow-lg sticky top-0 z-50">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 md:px-8 md:py-4">
          {/* Logo */}
          <div className="text-lg font-semibold tracking-wide flex-shrink-0">
            <BrandWordmark className="text-sm sm:text-base md:text-lg" />
          </div>

          {/* Navigation Desktop */}
          <nav
            className="relative hidden lg:flex flex-1 items-center justify-center gap-2 xl:gap-3"
            onMouseLeave={() => setActiveMenu(null)}
          >
            {navItems.map((item) => (
              <div
                key={item.label}
                className="relative"
                onMouseEnter={() => setActiveMenu(item.label)}
              >
                <motion.button
                  type="button"
                  onClick={() => setActiveMenu((prev) => (prev === item.label ? null : item.label))}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex items-center gap-1 rounded-full px-3 py-2 text-sm xl:px-4 xl:py-2.5 xl:text-base font-semibold transition-all duration-300 ${
                    activeMenu === item.label
                      ? "text-white bg-slate-800/80 shadow-md"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/50"
                  }`}
                >
                  <span className="text-aurora whitespace-nowrap">{item.label}</span>
                  {item.submenu ? (
                    <ChevronDown
                      className={`h-3.5 w-3.5 xl:h-4 xl:w-4 transition-transform duration-300 flex-shrink-0 ${
                        activeMenu === item.label ? "rotate-180 text-indigo-400" : "text-slate-400"
                      }`}
                    />
                  ) : null}
                </motion.button>
                {item.submenu && activeMenu === item.label && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute left-0 mt-3 w-52 rounded-xl border border-slate-700 bg-[#0b101d]/98 backdrop-blur-md shadow-[0_20px_80px_rgba(0,0,0,0.5)] z-30 p-2"
                  >
                    <ul className="space-y-1 text-xs">
                      {item.submenu.map((sub) => (
                        <li key={sub.label}>
                          <a
                            href={sub.href}
                            className="block rounded-lg px-3 py-2 text-slate-300 hover:bg-indigo-500/20 hover:text-white transition-colors duration-200"
                            onClick={() => setActiveMenu(null)}
                          >
                            {sub.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </div>
            ))}
          </nav>

          {/* Boutons CTA + Menu Burger */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Boutons CTA - Cachés sur mobile très petit, visibles à partir de sm */}
            <div className="hidden sm:flex items-center gap-2 sm:gap-3">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link
              href="/login"
                  className="rounded-full border border-slate-600 bg-slate-900/50 px-3 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-all duration-300 hover:border-slate-500 hover:bg-slate-800/80 sm:px-4 sm:py-2.5 sm:text-base"
            >
              Se connecter
            </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link
              href="/onboarding"
                  className="rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-400/40 transition-all duration-300 hover:brightness-110 hover:shadow-sky-400/60 sm:px-4 sm:py-2.5 sm:text-base"
                >
                  S&apos;inscrire
                </Link>
              </motion.div>
            </div>

            {/* Menu Burger - Visible uniquement sur mobile/tablette */}
            <motion.button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              whileTap={{ scale: 0.95 }}
              className="lg:hidden flex items-center justify-center w-10 h-10 rounded-full bg-slate-800/50 text-white hover:bg-slate-700/50 transition-colors"
              aria-label="Menu"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </motion.button>
          </div>
        </div>

        {/* Menu Mobile Slide-in */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              {/* Overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileMenuOpen(false)}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
              />
              {/* Menu Panel */}
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-[#0b101d] border-l border-slate-700 shadow-2xl z-50 overflow-y-auto lg:hidden"
              >
                <div className="p-6">
                  {/* Header du menu mobile */}
                  <div className="flex items-center justify-between mb-8">
                    <BrandWordmark className="text-base" />
                    <motion.button
                      type="button"
                      onClick={() => setMobileMenuOpen(false)}
                      whileTap={{ scale: 0.95 }}
                      className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-800 text-white hover:bg-slate-700 transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </motion.button>
                  </div>

                  {/* Navigation Mobile */}
                  <nav className="space-y-2">
                    {navItems.map((item) => (
                      <div key={item.label} className="border-b border-slate-800/50 pb-4 last:border-0 last:pb-0">
                        <button
                          type="button"
                          onClick={() => setActiveMenu(activeMenu === item.label ? null : item.label)}
                          className="w-full flex items-center justify-between py-3 text-left text-white font-semibold"
                        >
                          <span>{item.label}</span>
                          {item.submenu && (
                            <ChevronDown
                              className={`h-4 w-4 transition-transform duration-300 ${
                                activeMenu === item.label ? "rotate-180" : ""
                              }`}
                            />
                          )}
                        </button>
                        {item.submenu && activeMenu === item.label && (
                          <motion.ul
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-2 space-y-1 pl-4"
                          >
                            {item.submenu.map((sub) => (
                              <li key={sub.label}>
                                <a
                                  href={sub.href}
                                  onClick={() => {
                                    setActiveMenu(null);
                                    setMobileMenuOpen(false);
                                  }}
                                  className="block py-2 text-slate-300 hover:text-white transition-colors"
                                >
                                  {sub.label}
                                </a>
                              </li>
                            ))}
                          </motion.ul>
                        )}
                      </div>
                    ))}
                  </nav>

                  {/* Boutons CTA Mobile */}
                  <div className="mt-8 space-y-3 pt-6 border-t border-slate-800">
                    <Link
                      href="/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block w-full text-center rounded-full border border-slate-600 bg-slate-900/50 px-4 py-3 text-base font-semibold text-white backdrop-blur-sm transition-all duration-300 hover:border-slate-500 hover:bg-slate-800/80"
                    >
                      Se connecter
                    </Link>
                    <Link
                      href="/onboarding"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block w-full text-center rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-indigo-500 px-4 py-3 text-base font-semibold text-white shadow-lg shadow-sky-400/40 transition-all duration-300 hover:brightness-110 hover:shadow-sky-400/60"
                    >
                      S&apos;inscrire
                    </Link>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </header>

      <main>
        {/* Hero Section - Fundly Branding */}
        <section className="relative mx-auto w-full max-w-7xl px-6 pt-16 pb-24 md:pt-24 md:pb-32">
          {/* Mesh Gradients - Halos de couleur */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute left-1/4 top-1/4 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-arcc-cyan/20 blur-[120px]" />
            <div className="absolute right-1/4 top-1/3 h-[400px] w-[400px] translate-x-1/2 -translate-y-1/2 rounded-full bg-arcc-orange/20 blur-[100px]" />
          </div>

          <div className="relative z-10 mx-auto max-w-6xl">
            <div className="grid gap-10 md:grid-cols-2 md:items-center">
              {/* Colonne gauche : accroche */}
              <div className="text-center md:text-left">
                <motion.h1
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="text-4xl font-bold leading-tight text-white md:text-5xl lg:text-6xl"
                >
              L&apos;Intelligence Artificielle qui connaît votre boutique par cœur
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                  className="mx-auto mt-5 max-w-xl text-base text-slate-400 md:text-lg"
                >
              Automatisez votre service client sur WhatsApp, Messenger et les commentaires Facebook en
              connectant votre base de connaissance en 2 minutes.
                </motion.p>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
                  className="mt-8 flex flex-col items-center justify-start gap-4 sm:flex-row md:justify-start"
                >
              <Link
                href="/onboarding"
                    className="inline-flex items-center gap-2 rounded-4xl bg-arcc-orange px-8 py-4 text-base font-semibold text-white shadow-lg shadow-arcc-orange/30 transition-all duration-300 hover:bg-arcc-orange/90 hover:shadow-arcc-orange/50 hover:scale-105"
              >
                Créer mon IA gratuitement
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/login"
                    className="inline-flex items-center rounded-4xl border-2 border-slate-600 bg-navy-card/50 px-8 py-4 text-base font-semibold text-white backdrop-blur-sm transition-all duration-300 hover:border-arcc-cyan/60 hover:bg-navy-card/80 hover:scale-105"
              >
                Accéder au dashboard
              </Link>
                </motion.div>
              </div>

              {/* Colonne droite : bloc IA de Vente intégré à l'accroche */}
              <motion.div
                initial={{ opacity: 0, x: 40, y: 20 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
                className="glass-card rounded-4xl bg-navy-card p-6 md:p-8"
              >
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-4xl bg-arcc-orange/20">
                  <Brain className="h-7 w-7 text-arcc-orange" />
                </div>
                <h2 className="mb-3 text-2xl font-semibold text-white md:text-3xl">
                  L&apos;IA de Vente
                </h2>
                <p className="mb-5 text-sm leading-relaxed text-slate-300 md:text-base">
                  RAG propriétaire basé sur Gemini 1.5 pour une précision chirurgicale. Votre IA comprend le
                  contexte de chaque conversation et répond avec l&apos;expertise de votre équipe.
                </p>
                <div className="flex flex-wrap gap-3">
                  <span className="rounded-full bg-arcc-orange/20 px-4 py-2 text-xs font-medium text-arcc-orange md:text-sm">
                    Gemini 1.5
                  </span>
                  <span className="rounded-full bg-arcc-cyan/20 px-4 py-2 text-xs font-medium text-arcc-cyan md:text-sm">
                    768 dimensions
                  </span>
                  <span className="rounded-full bg-slate-700/50 px-4 py-2 text-xs font-medium text-slate-300 md:text-sm">
                    RAG avancé
                  </span>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Bento Box Grid - Fonctionnalités */}
        <section
          id="modules"
          className="relative mx-auto w-full max-w-7xl px-6 pb-32"
        >
          {/* Mesh Gradients pour la section */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute left-0 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-arcc-cyan/15 blur-[140px]" />
            <div className="absolute right-0 top-1/2 h-[500px] w-[500px] translate-x-1/2 -translate-y-1/2 rounded-full bg-arcc-orange/15 blur-[120px]" />
          </div>

          <div className="relative z-10">
            {/* Grille Bento Box asymétrique */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:grid-rows-8">
              {/* Grand bloc - L'IA de Vente */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="group relative overflow-hidden rounded-4xl glass-card bg-navy-card p-8 md:col-span-7 md:row-span-5"
              >
                {/* Illustration abstraite - Globe/Connexions */}
                <div className="absolute right-0 top-0 h-full w-full opacity-20">
                  <div className="absolute right-8 top-8 h-32 w-32 rounded-full border-2 border-arcc-cyan/30" />
                  <div className="absolute right-16 top-20 h-20 w-20 rounded-full border-2 border-arcc-orange/30" />
                  <div className="absolute right-4 top-32 h-16 w-16 rounded-full border-2 border-arcc-cyan/20" />
                  <svg
                    className="absolute right-0 top-0 h-full w-full"
                    viewBox="0 0 200 200"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M50 100 L150 100 M100 50 L100 150 M70 70 L130 130 M130 70 L70 130"
                      stroke="url(#gradient1)"
                      strokeWidth="2"
                      opacity="0.3"
                    />
                    <defs>
                      <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.5" />
                        <stop offset="100%" stopColor="#f97316" stopOpacity="0.5" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div className="relative z-10">
                  <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-4xl bg-arcc-orange/20">
                    <Brain className="h-8 w-8 text-arcc-orange" />
                  </div>
                  <h2 className="mb-4 text-3xl font-bold text-white md:text-4xl">
                    L&apos;IA de Vente
                  </h2>
                  <p className="mb-6 text-base leading-relaxed text-slate-300 md:text-lg">
                    RAG propriétaire basé sur Gemini 1.5 pour une précision chirurgicale. Votre IA comprend le contexte de chaque conversation et répond avec l&apos;expertise de votre équipe.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <span className="rounded-full bg-arcc-orange/20 px-4 py-2 text-sm font-medium text-arcc-orange">
                      Gemini 1.5
                    </span>
                    <span className="rounded-full bg-arcc-cyan/20 px-4 py-2 text-sm font-medium text-arcc-cyan">
                      768 dimensions
                    </span>
                    <span className="rounded-full bg-slate-700/50 px-4 py-2 text-sm font-medium text-slate-300">
                      RAG avancé
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* Bloc moyen - Omnicanal */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="group relative overflow-hidden rounded-4xl glass-card bg-navy-card p-6 md:col-span-5 md:row-span-3"
              >
                <div className="relative z-10">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-4xl bg-arcc-cyan/20">
                      <MessagesSquare className="h-6 w-6 text-arcc-cyan" />
                    </div>
                    <div className="flex gap-2">
                      <MessageSquare className="h-5 w-5 text-emerald-400" />
                      <Facebook className="h-5 w-5 text-blue-400" />
                      <MessageCircle className="h-5 w-5 text-indigo-400" />
                    </div>
                  </div>
                  <h3 className="mb-2 text-xl font-bold text-white md:text-2xl">
                    Omnicanal
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-300 md:text-base">
                    Répondez partout : WhatsApp, Messenger, Commentaires FB. Une seule IA pour tous vos canaux.
                  </p>
                </div>
              </motion.div>

              {/* Mockup Mobile - Centre de la grille */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="group relative overflow-hidden rounded-4xl glass-card bg-navy-card p-6 md:col-span-5 md:row-span-5 md:col-start-8"
              >
                <div className="relative z-10">
                  <div className="mb-4 text-center">
                    <p className="text-xs font-semibold uppercase tracking-widest text-arcc-cyan">
                      Demo instantanée
                    </p>
                  </div>
                  {/* Mockup mobile simplifié */}
                  <div className="mx-auto w-48 rounded-3xl border-2 border-slate-700 bg-slate-900 p-4 shadow-2xl">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="h-2 w-12 rounded-full bg-slate-700" />
                      <div className="flex gap-1">
                        <div className="h-1 w-1 rounded-full bg-slate-600" />
                        <div className="h-1 w-1 rounded-full bg-slate-600" />
                        <div className="h-1 w-1 rounded-full bg-slate-600" />
                      </div>
                    </div>
                    <div className="space-y-3">
                  <div className="flex justify-end">
                        <div className="max-w-[80%] rounded-2xl bg-arcc-orange px-3 py-2 text-xs text-white">
                          Tarifs livraison ?
                    </div>
                  </div>
                  <div className="flex justify-start">
                        <div className="max-w-[80%] rounded-2xl bg-navy-card px-3 py-2 text-xs text-slate-300">
                          Conakry: 15 000 GNF
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-4 text-center">
                      <div>
                        <p className="text-xs text-emerald-400">-12 sec</p>
                        <p className="text-[10px] text-slate-500">Temps</p>
                      </div>
                      <div>
                        <p className="text-xs text-arcc-orange">98%</p>
                        <p className="text-[10px] text-slate-500">Satisfaction</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Petit bloc - Analytics */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="group relative overflow-hidden rounded-4xl glass-card bg-navy-card p-6 md:col-span-3 md:row-span-3"
              >
                <div className="relative z-10">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-4xl bg-arcc-cyan/20">
                    <LineChart className="h-6 w-6 text-arcc-cyan" />
              </div>
                  <h3 className="mb-2 text-lg font-bold text-white">Analytics</h3>
                  <p className="text-sm leading-relaxed text-slate-300">
                    Suivez vos conversions et leads en temps réel.
                  </p>
                </div>
              </motion.div>

              {/* Petit bloc - Sécurité */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="group relative overflow-hidden rounded-4xl glass-card bg-navy-card p-6 md:col-span-4 md:row-span-3 md:col-start-9"
              >
                <div className="relative z-10">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-4xl bg-arcc-orange/20">
                    <ShieldCheck className="h-6 w-6 text-arcc-orange" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-white">Sécurité</h3>
                  <p className="text-sm leading-relaxed text-slate-300">
                    Données isolées et cryptées pour chaque boutique.
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Section Canaux - Style Fundly */}
        <section
          id="channels"
          className="relative mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 sm:py-24 md:py-32"
        >
          {/* Mesh Gradients */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute left-1/4 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-arcc-cyan/10 blur-[100px]" />
            <div className="absolute right-1/4 top-1/2 h-[350px] w-[350px] translate-x-1/2 -translate-y-1/2 rounded-full bg-arcc-orange/10 blur-[90px]" />
          </div>

          <div className="relative z-10 mb-16 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-arcc-cyan">
              Canaux supportés
            </p>
            <h2 className="mt-4 text-3xl font-bold text-white md:text-4xl lg:text-5xl">
              Répondez partout où vos clients vous contactent
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base text-slate-400 md:text-lg">
              Une seule IA pour gérer tous vos canaux de communication. Automatisation intelligente sur WhatsApp, Messenger et les commentaires Facebook.
            </p>
          </div>

          <div className="relative z-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* WhatsApp */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="group relative overflow-hidden rounded-4xl glass-card bg-navy-card p-8 transition-all duration-300 hover:scale-105"
            >
              <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-emerald-500/10 blur-3xl"></div>
              <div className="relative z-10">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-4xl bg-emerald-500/20">
                  <MessageSquare className="h-8 w-8 text-emerald-400" />
                </div>
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-xl font-bold text-white">WhatsApp Business</h3>
                  <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-400">
                    Populaire
                  </span>
                </div>
                <p className="mb-6 text-sm leading-relaxed text-slate-300">
                  Répondez automatiquement aux messages WhatsApp de vos clients. Support des messages texte, images et notifications.
                </p>
                <ul className="space-y-3 text-sm text-slate-300">
                  <li className="flex items-start gap-2">
                    <Zap className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                    <span>Réponses instantanées 24/7</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                    <span>Relances automatiques après 24h</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                    <span>Intégration Meta WhatsApp native</span>
                  </li>
                </ul>
              </div>
            </motion.div>

            {/* Messenger */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="group relative overflow-hidden rounded-4xl glass-card bg-navy-card p-8 transition-all duration-300 hover:scale-105"
            >
              <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-blue-500/10 blur-3xl"></div>
              <div className="relative z-10">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-4xl bg-blue-500/20">
                  <MessageCircle className="h-8 w-8 text-blue-400" />
                </div>
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-xl font-bold text-white">Facebook Messenger</h3>
                  <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-400">
                    Direct
                  </span>
                </div>
                <p className="mb-6 text-sm leading-relaxed text-slate-300">
                  Gérez les conversations Messenger directement depuis votre page Facebook. Réponses automatiques et transfert vers humain si nécessaire.
                </p>
                <ul className="space-y-3 text-sm text-slate-300">
                  <li className="flex items-start gap-2">
                    <Zap className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-400" />
                    <span>Conversations privées Messenger</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-400" />
                    <span>Intégration Meta Graph API</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-400" />
                    <span>Handoff humain intelligent</span>
                  </li>
                </ul>
              </div>
            </motion.div>

            {/* Facebook Comments */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="group relative overflow-hidden rounded-4xl glass-card bg-navy-card p-8 transition-all duration-300 hover:scale-105"
            >
              <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-indigo-500/10 blur-3xl"></div>
              <div className="relative z-10">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-4xl bg-indigo-500/20">
                  <Facebook className="h-8 w-8 text-indigo-400" />
                </div>
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-xl font-bold text-white">Commentaires Facebook</h3>
                  <span className="rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-400">
                    Tunnel
                  </span>
                </div>
                <p className="mb-6 text-sm leading-relaxed text-slate-300">
                  Transformez les commentaires publics en conversations privées. Tunnel automatique vers Messenger pour un service client discret.
                </p>
                <ul className="space-y-3 text-sm text-slate-300">
                  <li className="flex items-start gap-2">
                    <Zap className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-400" />
                    <span>Détection automatique des commentaires</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-400" />
                    <span>Tunnel vers Messenger en 1 clic</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-400" />
                    <span>Gestion de la réputation publique</span>
                  </li>
                </ul>
              </div>
            </motion.div>
          </div>
        </section>

        <section id="demo" className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="rounded-3xl border border-slate-800 bg-[#0b101d] p-10 text-center">
            <h3 className="text-2xl font-semibold text-white">
              La preuve en direct
            </h3>
            <p className="mt-3 text-slate-300">
              Lancez votre IA en quelques minutes et testez-la immediatement.
            </p>
            <div className="mt-8 flex justify-center">
              <Link
                href="/onboarding"
                className="rounded-full bg-indigo-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-500 hover:shadow-indigo-500/50"
              >
                Créer mon IA gratuitement
              </Link>
            </div>
          </div>
        </section>

        <section id="how" className="mx-auto w-full max-w-6xl px-6 pb-20">
          <div className="mb-10">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-indigo-400">
              Comment ca marche
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-white md:text-3xl">
              Un demarrage ultra rapide
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className="rounded-2xl border border-slate-800 bg-[#0b101d] p-6 interactive-glow interactive-raise"
              >
                <div className="text-sm font-semibold text-indigo-400">
                  0{index + 1}
                </div>
                <h3 className="mt-2 text-lg font-semibold text-white">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm text-slate-300">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 bg-[#020617]">
        <div className="mx-auto w-full max-w-6xl px-6 py-10 text-sm text-slate-300">
          <div className="grid gap-10 md:grid-cols-4 lg:gap-12">
            {/* Colonne 1 : Logo + description + réseaux sociaux */}
            <div className="space-y-4">
              <BrandWordmark className="text-base" />
              <p className="text-xs leading-relaxed text-slate-400">
                Le cœur du networking intelligent en Guinée. Automatisez vos
                conversations clients, centralisez vos canaux et offrez une
                expérience premium 24/7.
              </p>
              <div className="flex items-center gap-3 pt-1">
                <a
                  href="#"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-slate-200 transition hover:bg-indigo-500 hover:text-white hover:shadow-[0_0_20px_rgba(79,70,229,0.8)]"
                >
                  <Facebook className="h-4 w-4" />
                </a>
                <a
                  href="#"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-slate-200 transition hover:bg-pink-500 hover:text-white hover:shadow-[0_0_20px_rgba(244,114,182,0.8)]"
                >
                  <Instagram className="h-4 w-4" />
                </a>
                <a
                  href="#"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-slate-200 transition hover:bg-sky-500 hover:text-white hover:shadow-[0_0_20px_rgba(56,189,248,0.8)]"
                >
                  <Linkedin className="h-4 w-4" />
                </a>
              </div>
            </div>

            {/* Colonne 2 : Liens rapides */}
            <div>
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Liens rapides
              </h3>
              <ul className="space-y-2 text-xs md:text-sm">
                <li>
                  <a href="#how" className="transition hover:text-white">
                    Comment ça marche
                  </a>
                </li>
                <li>
                  <a href="#channels" className="transition hover:text-white">
                    Canaux supportés
                  </a>
                </li>
                <li>
                  <a href="#modules" className="transition hover:text-white">
                    Modules IA
                  </a>
                </li>
                <li>
                  <Link href="/login" className="transition hover:text-white">
                    Se connecter
                  </Link>
                </li>
              </ul>
            </div>

            {/* Colonne 3 : Services */}
            <div>
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Services
              </h3>
              <ul className="space-y-2 text-xs md:text-sm">
                <li>Automatisation WhatsApp</li>
                <li>Réponses aux commentaires Facebook</li>
                <li>Studio d&apos;annonces multi-réseaux</li>
                <li>RAG &amp; mémoire IA avancée</li>
              </ul>
            </div>

            {/* Colonne 4 : Contact + newsletter */}
            <div className="space-y-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Contact
              </h3>
              <div className="space-y-2 text-xs md:text-sm">
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 text-indigo-400" />
                  <span>Conakry, Guinée</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-indigo-400" />
                  <span>+224 626 60 69 60</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-indigo-400" />
                  <span>contact@arccenciel.com</span>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-800 bg-[#0b101d] p-3">
                <p className="text-xs font-medium text-slate-200">
                  Restez informé
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Recevez nos dernières actualités et cas d&apos;usage IA.
                </p>
                <button className="mt-3 w-full rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-rose-500/30 transition hover:bg-rose-500">
                  S&apos;abonner
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-slate-800 pt-4 text-[11px] text-slate-500 md:flex-row">
            <p>© 2026 Arcc En Ciel. Tous droits réservés.</p>
            <p className="flex items-center gap-1">
              <MessageCircle className="h-3.5 w-3.5 text-emerald-400" />
              <span>Support IA et humain combinés pour vos clients.</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
      )}
    </>
  );
}
