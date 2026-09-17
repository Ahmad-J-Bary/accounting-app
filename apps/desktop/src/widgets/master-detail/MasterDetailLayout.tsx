import { ReactNode, useRef } from "react";
import { cn } from '@shared/lib/utils';
import { useSidePanelSettings } from "@shared/hooks";
import { useIsMobile, useIsTablet, useContainerQuery } from "@shared/hooks/useResponsive";

interface MasterDetailLayoutProps {
  master: ReactNode;
  detail: ReactNode;
  isDetailOpen: boolean;
  onDetailClose?: () => void;
  masterClassName?: string;
  detailClassName?: string;
  className?: string;
  masterLabel?: string;
  detailLabel?: string;
  masterMinWidth?: number;
}

/**
 * MasterDetailLayout — Canonical responsive master/detail layout.
 *
 * Responsive behavior:
 * - Desktop/Wide (≥1280px): Side-by-side split (master + detail)
 * - Laptop (1024-1279px): Side-by-side with narrower master
 * - Tablet (640-1023px): Detail overlays master (master hidden when detail open)
 * - Mobile (<640px): Detail overlays master full-width (master hidden when detail open)
 *
 * Uses:
 * - Viewport hooks for shell-level decisions (mobile/tablet/laptop/desktop)
 * - SidePanelSettings for detail panel width configuration
 */
export function MasterDetailLayout({
  master,
  detail,
  isDetailOpen,
  onDetailClose,
  masterClassName,
  detailClassName,
  className,
  masterLabel,
  detailLabel,
  masterMinWidth = 280,
}: MasterDetailLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useContainerQuery(containerRef);
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const { getSidebarWidth } = useSidePanelSettings();

  const isNarrow = isMobile || isTablet;
  const showDetailAsOverlay = isNarrow && isDetailOpen;
  const detailWidth = getSidebarWidth();

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex h-full w-full overflow-hidden",
        className,
      )}
      role="region"
      aria-label={masterLabel || detailLabel ? "Master-detail layout" : undefined}
    >
      {/* Master Panel */}
      <div
        className={cn(
          "flex flex-col min-w-0 transition-all duration-300 ease-in-out h-full overflow-hidden",
          isDetailOpen && !isNarrow && "flex-1",
          !isDetailOpen && "flex-1",
          isNarrow && isDetailOpen && "hidden",
          masterClassName,
        )}
        style={{
          minWidth: isDetailOpen && !isNarrow ? `${masterMinWidth}px` : undefined,
        }}
        role="navigation"
        aria-label={masterLabel}
      >
        {master}
      </div>

      {/* Detail Panel */}
      {isDetailOpen && (
        <div
          className={cn(
            "h-full flex flex-col shrink-0 transition-all duration-300 ease-in-out overflow-hidden",
            !isNarrow && "border-s border-border",
            showDetailAsOverlay && "absolute inset-0 z-30 bg-background w-full",
            detailClassName,
          )}
          style={{
            width: isNarrow ? undefined : detailWidth,
          }}
          role="main"
          aria-label={detailLabel}
        >
          {detail}
        </div>
      )}

      {/* Mobile back button overlay */}
      {showDetailAsOverlay && onDetailClose && (
        <button
          onClick={onDetailClose}
          className="absolute top-2 start-2 z-40 p-2 rounded-xl bg-card border border-border shadow-lg"
          aria-label="Back to list"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
    </div>
  );
}
