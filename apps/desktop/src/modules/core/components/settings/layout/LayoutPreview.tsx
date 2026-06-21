import type { LayoutType } from '@shared/types/appearance';

/* ── Navigation Menu Previews (large cards) ── */

export function SidenavPreview() {
  return (
    <svg viewBox="0 0 80 52" className="w-full h-auto">
      <rect width="80" height="52" fill="#f1f5f9" rx="2" />
      <rect x="0" y="0" width="18" height="52" fill="#1e293b" rx="1" />
      <rect x="20" y="0" width="60" height="8" fill="white" stroke="#e2e8f0" strokeWidth="0.5" />
      <rect x="22" y="10" width="56" height="40" fill="white" rx="1" />
    </svg>
  );
}

export function TopnavPreview() {
  return (
    <svg viewBox="0 0 80 52" className="w-full h-auto">
      <rect width="80" height="52" fill="#f1f5f9" rx="2" />
      <rect x="0" y="0" width="80" height="8" fill="white" stroke="#e2e8f0" strokeWidth="0.5" />
      <rect x="0" y="8" width="80" height="10" fill="#1e293b" />
      <rect x="2" y="20" width="76" height="30" fill="white" rx="1" />
    </svg>
  );
}

export function ComboPreview() {
  return (
    <svg viewBox="0 0 80 52" className="w-full h-auto">
      <rect width="80" height="52" fill="#f1f5f9" rx="2" />
      <rect x="0" y="0" width="80" height="8" fill="#1e293b" />
      <rect x="0" y="8" width="18" height="44" fill="#1e293b" rx="1" />
      <rect x="18" y="8" width="62" height="8" fill="white" stroke="#e2e8f0" strokeWidth="0.5" />
      <rect x="20" y="18" width="58" height="32" fill="white" rx="1" />
    </svg>
  );
}

/* ── Sidenav Shape Previews ── */

export function SidenavDefaultPreview() {
  return (
    <svg viewBox="0 0 80 44" className="w-full h-auto">
      <rect width="80" height="44" fill="#f1f5f9" rx="2" />
      <rect x="0" y="0" width="20" height="44" fill="#334155" rx="1" />
      <rect x="22" y="0" width="58" height="7" fill="white" stroke="#e2e8f0" strokeWidth="0.5" />
      <rect x="24" y="9" width="54" height="33" fill="white" rx="1" />
    </svg>
  );
}

export function SidenavStackedPreview() {
  return (
    <svg viewBox="0 0 80 44" className="w-full h-auto">
      <rect width="80" height="44" fill="#f1f5f9" rx="2" />
      <rect x="0" y="0" width="20" height="44" fill="#334155" rx="1" />
      <rect x="22" y="0" width="58" height="7" fill="white" stroke="#e2e8f0" strokeWidth="0.5" />
      <rect x="0" y="6" width="20" height="38" fill="#475569" rx="1" />
      <rect x="24" y="9" width="54" height="33" fill="white" rx="1" />
    </svg>
  );
}

/* ── Topnav Shape Previews ── */

export function TopnavDefaultPreview() {
  return (
    <svg viewBox="0 0 80 44" className="w-full h-auto">
      <rect width="80" height="44" fill="#f1f5f9" rx="2" />
      <rect x="0" y="0" width="80" height="8" fill="white" stroke="#e2e8f0" strokeWidth="0.5" />
      <rect x="0" y="8" width="80" height="10" fill="#1e293b" />
      <rect x="2" y="20" width="76" height="22" fill="white" rx="1" />
    </svg>
  );
}

export function TopnavSlimPreview() {
  return (
    <svg viewBox="0 0 80 44" className="w-full h-auto">
      <rect width="80" height="44" fill="#f1f5f9" rx="2" />
      <rect x="0" y="0" width="80" height="6" fill="white" stroke="#e2e8f0" strokeWidth="0.5" />
      <rect x="0" y="6" width="80" height="7" fill="#1e293b" />
      <rect x="2" y="15" width="76" height="27" fill="white" rx="1" />
    </svg>
  );
}

export function TopnavStackedPreview() {
  return (
    <svg viewBox="0 0 80 44" className="w-full h-auto">
      <rect width="80" height="44" fill="#f1f5f9" rx="2" />
      <rect x="0" y="0" width="80" height="7" fill="white" stroke="#e2e8f0" strokeWidth="0.5" />
      <rect x="0" y="7" width="80" height="6" fill="#1e293b" />
      <rect x="2" y="15" width="76" height="27" fill="white" rx="1" />
    </svg>
  );
}

/* ── Appearance (Light/Dark) Previews ── */

export function VerticalLightPreview() {
  return (
    <svg viewBox="0 0 80 36" className="w-full h-auto">
      <rect width="80" height="36" fill="#f1f5f9" rx="2" />
      <rect x="0" y="0" width="18" height="36" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="0.5" rx="1" />
      <rect x="20" y="0" width="60" height="7" fill="white" stroke="#e2e8f0" strokeWidth="0.5" />
      <rect x="22" y="9" width="56" height="25" fill="white" rx="1" />
    </svg>
  );
}

export function VerticalDarkPreview() {
  return (
    <svg viewBox="0 0 80 36" className="w-full h-auto">
      <rect width="80" height="36" fill="#f1f5f9" rx="2" />
      <rect x="0" y="0" width="18" height="36" fill="#1e293b" rx="1" />
      <rect x="20" y="0" width="60" height="7" fill="white" stroke="#e2e8f0" strokeWidth="0.5" />
      <rect x="22" y="9" width="56" height="25" fill="white" rx="1" />
    </svg>
  );
}

export function HorizontalLightPreview() {
  return (
    <svg viewBox="0 0 80 36" className="w-full h-auto">
      <rect width="80" height="36" fill="#f1f5f9" rx="2" />
      <rect x="0" y="0" width="80" height="65%" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="0.5" />
      <rect x="2" y="14" width="76" height="20" fill="white" rx="1" />
    </svg>
  );
}

export function HorizontalDarkPreview() {
  return (
    <svg viewBox="0 0 80 36" className="w-full h-auto">
      <rect width="80" height="36" fill="#f1f5f9" rx="2" />
      <rect x="0" y="0" width="80" height="65%" fill="#1e293b" />
      <rect x="2" y="14" width="76" height="20" fill="white" rx="1" />
    </svg>
  );
}

/* ── Final Layout Previews (large) ── */

function VerticalFinalPreview() {
  return (
    <svg viewBox="0 0 140 80" className="w-full h-auto">
      <rect width="140" height="80" fill="#f8fafc" rx="4" />
      <rect x="0" y="0" width="32" height="80" fill="#1e293b" rx="3" />
      <rect x="34" y="0" width="106" height="12" fill="white" stroke="#e2e8f0" strokeWidth="0.5" rx="2" />
      <rect x="38" y="16" width="98" height="60" fill="white" rx="2" />
    </svg>
  );
}

function TopnavSlimFinalPreview() {
  return (
    <svg viewBox="0 0 140 80" className="w-full h-auto">
      <rect width="140" height="80" fill="#f8fafc" rx="4" />
      <rect x="0" y="0" width="140" height="9" fill="white" stroke="#e2e8f0" strokeWidth="0.5" rx="2" />
      <rect x="0" y="9" width="140" height="12" fill="#1e293b" />
      <rect x="4" y="24" width="132" height="52" fill="white" rx="2" />
    </svg>
  );
}

function NavbarHorizontalFinalPreview() {
  return (
    <svg viewBox="0 0 140 80" className="w-full h-auto">
      <rect width="140" height="80" fill="#f8fafc" rx="4" />
      <rect x="0" y="0" width="140" height="12" fill="white" stroke="#e2e8f0" strokeWidth="0.5" rx="2" />
      <rect x="0" y="12" width="140" height="16" fill="#1e293b" />
      <rect x="4" y="32" width="132" height="44" fill="white" rx="2" />
    </svg>
  );
}

function HorizontalSlimFinalPreview() {
  return (
    <svg viewBox="0 0 140 80" className="w-full h-auto">
      <rect width="140" height="80" fill="#f8fafc" rx="4" />
      <rect x="0" y="0" width="140" height="9" fill="white" stroke="#e2e8f0" strokeWidth="0.5" rx="2" />
      <rect x="0" y="9" width="140" height="11" fill="#334155" />
      <rect x="4" y="23" width="132" height="53" fill="white" rx="2" />
    </svg>
  );
}

function ComboNavFinalPreview() {
  return (
    <svg viewBox="0 0 140 80" className="w-full h-auto">
      <rect width="140" height="80" fill="#f8fafc" rx="4" />
      <rect x="0" y="0" width="140" height="12" fill="#1e293b" rx="2" />
      <rect x="0" y="12" width="28" height="68" fill="#1e293b" rx="2" />
      <rect x="28" y="12" width="112" height="12" fill="white" stroke="#e2e8f0" strokeWidth="0.5" rx="1" />
      <rect x="32" y="28" width="104" height="48" fill="white" rx="2" />
    </svg>
  );
}

const FINAL_PREVIEWS: Record<LayoutType, React.FC> = {
  'vertical': VerticalFinalPreview,
  'topnav-slim': TopnavSlimFinalPreview,
  'navbar-horizontal': NavbarHorizontalFinalPreview,
  'horizontal-slim': HorizontalSlimFinalPreview,
  'combo-nav': ComboNavFinalPreview,
};

export function getFinalPreview(layoutType: LayoutType): React.FC {
  return FINAL_PREVIEWS[layoutType];
}
