/**
 * Inline SVG icon set — replaces emoji nav icons for a polished CWS-ready look.
 * Each icon renders a 24×24 SVG with `currentColor` so it inherits text color.
 */
import React from "react";

type IconProps = { size?: number; className?: string; strokeWidth?: number; style?: React.CSSProperties };

function base(children: React.ReactNode, props?: IconProps) {
  const { size = 16, className = "", strokeWidth = 1.8, style } = props ?? {};
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const IconBolt = (p?: IconProps) => base(<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" fill="currentColor" stroke="none" />, p);
export const IconTarget = (p?: IconProps) => base(
  <>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
  </>, p);
export const IconUser = (p?: IconProps) => base(
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </>, p);
export const IconList = (p?: IconProps) => base(
  <>
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </>, p);
export const IconBuilding = (p?: IconProps) => base(
  <>
    <rect x="4" y="3" width="16" height="18" rx="1" />
    <path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01M9 16h.01M15 16h.01" />
  </>, p);
export const IconGlobe = (p?: IconProps) => base(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
  </>, p);
export const IconBrain = (p?: IconProps) => base(
  <>
    <path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0 2-5 3 3 0 0 0-2-5 3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0-3-3Z" />
  </>, p);
export const IconRocket = (p?: IconProps) => base(
  <>
    <path d="M5 15c-1 1-2 4-2 4s3-1 4-2" />
    <path d="M14 5 19 10c-3 2-6 5-9 7l-2-2c2-3 5-6 7-9" />
    <circle cx="15" cy="9" r="1.5" fill="currentColor" stroke="none" />
    <path d="M9 15 5 19" />
  </>, p);
export const IconSettings = (p?: IconProps) => base(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </>, p);
export const IconRefresh = (p?: IconProps) => base(
  <>
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    <path d="M3 21v-5h5" />
  </>, p);
export const IconCheck = (p?: IconProps) => base(<path d="m5 12 5 5L20 7" />, p);
export const IconX = (p?: IconProps) => base(<path d="M6 6l12 12M18 6 6 18" />, p);
export const IconPlus = (p?: IconProps) => base(<path d="M12 5v14M5 12h14" />, p);
export const IconCalendar = (p?: IconProps) => base(
  <>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </>, p);
export const IconTrash = (p?: IconProps) => base(
  <>
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
  </>, p);
export const IconBriefcase = (p?: IconProps) => base(
  <>
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </>, p);
export const IconShield = (p?: IconProps) => base(
  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />, p);
export const IconCopy = (p?: IconProps) => base(
  <>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </>, p);
export const IconFile = (p?: IconProps) => base(
  <>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" />
    <path d="M14 2v6h6" />
  </>, p);
export const IconSearch = (p?: IconProps) => base(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </>, p);
export const IconSparkles = (p?: IconProps) => base(
  <>
    <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z" fill="currentColor" stroke="none" />
    <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z" fill="currentColor" stroke="none" />
  </>, p);
export const IconSave = (p?: IconProps) => base(
  <>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
    <path d="M17 21v-8H7v8M7 3v5h8" />
  </>, p);
export const IconExternalLink = (p?: IconProps) => base(
  <>
    <path d="M14 3h7v7" />
    <path d="M10 14 21 3" />
    <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
  </>, p);

export const IconBrandLogo = ({ size = 28, className = "" }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="SuperJobAgent Logo"
  >
    <defs>
      <linearGradient id="sja-grad-primary" x1="2" y1="2" x2="38" y2="38" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#6366F1" />
        <stop offset="50%" stopColor="#8B5CF6" />
        <stop offset="100%" stopColor="#EC4899" />
      </linearGradient>
      <linearGradient id="sja-grad-bolt" x1="12" y1="6" x2="28" y2="34" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="100%" stopColor="#E0E7FF" />
      </linearGradient>
      <filter id="sja-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    <rect width="40" height="40" rx="11" fill="url(#sja-grad-primary)" />
    {/* Concentric orbital rings */}
    <circle cx="20" cy="20" r="16" stroke="rgba(255,255,255,0.22)" strokeWidth="0.75" strokeDasharray="2 3" />
    <circle cx="20" cy="20" r="12" stroke="rgba(255,255,255,0.28)" strokeWidth="0.75" />
    {/* Neural nodes */}
    <circle cx="9" cy="14" r="1.5" fill="#38BDF8" />
    <circle cx="31" cy="12" r="1.75" fill="#34D399" />
    <circle cx="32" cy="28" r="1.5" fill="#F472B6" />
    <circle cx="8" cy="27" r="1.75" fill="#A78BFA" />
    {/* High-Voltage AI Bolt */}
    <path
      d="M22 6L11 20H19L17 34L29 18H21L24 6H22Z"
      fill="url(#sja-grad-bolt)"
      filter="url(#sja-glow)"
    />
  </svg>
);
