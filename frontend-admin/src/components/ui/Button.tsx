"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "success" | "danger" | "warning" | "info";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void | Promise<void>;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  type?: "button" | "submit" | "reset";
  className?: string;
  icon?: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: "border-indigo-500 bg-indigo-600/30 text-indigo-200 shadow-lg shadow-indigo-500/20 hover:bg-indigo-600/40 hover:border-indigo-400 hover:shadow-indigo-500/30",
  secondary: "border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600 hover:bg-slate-700/50 hover:text-slate-200",
  success: "border-emerald-500 bg-emerald-500/20 text-emerald-300 shadow-lg shadow-emerald-500/20 hover:bg-emerald-500/30 hover:border-emerald-400 hover:shadow-emerald-500/30",
  danger: "border-rose-500 bg-rose-500/20 text-rose-300 shadow-lg shadow-rose-500/20 hover:bg-rose-500/30 hover:border-rose-400 hover:shadow-rose-500/30",
  warning: "border-amber-500 bg-amber-500/20 text-amber-300 shadow-lg shadow-amber-500/20 hover:bg-amber-500/30 hover:border-amber-400 hover:shadow-amber-500/30",
  info: "border-blue-500 bg-blue-500/20 text-blue-300 shadow-lg shadow-blue-500/20 hover:bg-blue-500/30 hover:border-blue-400 hover:shadow-blue-500/30",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-sm",
  lg: "px-6 py-3 text-base",
};

export default function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  type = "button",
  className = "",
  icon,
}: ButtonProps) {
  const baseStyles = "rounded-lg border-2 font-semibold transition-all duration-200 ease-in-out transform focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900";
  const disabledStyles = "opacity-50 cursor-not-allowed";
  const hoverStyles = disabled || loading ? "" : "hover:scale-105";
  const activeStyles = disabled || loading ? "" : "active:scale-95";

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        ${baseStyles}
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${disabled || loading ? disabledStyles : `${hoverStyles} ${activeStyles}`}
        ${className}
      `}
      whileHover={disabled || loading ? {} : { scale: 1.05 }}
      whileTap={disabled || loading ? {} : { scale: 0.95 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
    >
      <span className="flex items-center justify-center gap-2">
        {loading ? (
          <>
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="inline-block"
            >
              ⏳
            </motion.span>
            <span>Traitement...</span>
          </>
        ) : (
          <>
            {icon && <span>{icon}</span>}
            <span>{children}</span>
          </>
        )}
      </span>
    </motion.button>
  );
}
