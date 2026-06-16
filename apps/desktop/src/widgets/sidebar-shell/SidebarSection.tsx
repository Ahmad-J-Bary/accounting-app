import React, { ReactNode, useRef, useState, useEffect } from "react";
import { cn } from "@shared/lib/utils";
import { ChevronDown } from "lucide-react";
import type { SidebarSectionProps } from "./types";

export function SidebarSection({
  title,
  icon,
  children,
  defaultOpen = true,
  className,
}: SidebarSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">(defaultOpen ? "auto" : 0);

  // Measure real content height for smooth animation
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    if (isOpen) {
      const h = el.scrollHeight;
      setHeight(h);
      // After transition, set to auto so it grows with dynamic content
      const timer = setTimeout(() => setHeight("auto"), 280);
      return () => clearTimeout(timer);
    } else {
      // Snap from auto → exact px before animating to 0
      setHeight(contentRef.current?.scrollHeight ?? 0);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setHeight(0));
      });
    }
  }, [isOpen]);

  return (
    <div
      className={cn(
        "border border-slate-100 rounded-xl bg-slate-50/30 shadow-[0_1px_2px_rgba(0,0,0,0.01)]",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50/80 hover:bg-slate-100/60 transition-colors text-right border-b border-slate-100 rounded-t-xl"
      >
        <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
          {icon}{title}
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-slate-400 transition-transform duration-250",
            !isOpen && "rotate-90"
          )}
        />
      </button>

      {/* Height-measured smooth collapse */}
      <div
        style={{
          height: height === "auto" ? "auto" : `${height}px`,
          overflow: "hidden",
          transition: "height 260ms cubic-bezier(0.4,0,0.2,1), opacity 220ms ease",
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div ref={contentRef} className="p-4">
          <div className="space-y-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
