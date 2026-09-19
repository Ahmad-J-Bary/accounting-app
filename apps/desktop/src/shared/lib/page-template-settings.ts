import { cn } from "@shared/lib/utils";
import type {
  DataHeaderSettings,
  PageHeaderSettings,
  PageTemplateSettings,
} from "@shared/types/ui-preferences";

export function getPageTemplateGutterClass(settings: PageTemplateSettings): string {
  switch (settings.pageGutter) {
    case "comfortable":
      return "gap-3 p-3 sm:gap-4 sm:p-4 md:gap-5 md:p-5";
    case "standard":
      return "gap-2 p-2 sm:gap-3 sm:p-3 md:gap-4 md:p-4";
    case "compact":
    default:
      return "gap-1.5 p-1.5 sm:gap-2 sm:p-2 md:gap-3 md:p-2.5";
  }
}

export function getPageTemplateRegionGapClass(settings: PageTemplateSettings): string {
  switch (settings.regionGap) {
    case "comfortable":
      return "gap-3 sm:gap-4";
    case "standard":
      return "gap-2 sm:gap-3";
    case "compact":
    default:
      return "gap-1.5 sm:gap-2";
  }
}

export function getPageHeaderShellClasses(settings: PageHeaderSettings): string {
  const resolvedStyle =
    settings.preset === "compact"
      ? settings.style === "standard" ? "slim" : settings.style
      : settings.preset === "spacious"
      ? settings.style === "standard" ? "wide" : settings.style
      : settings.style;

  const resolvedHeight =
    settings.preset === "compact"
      ? settings.height === "standard" ? "compact" : settings.height
      : settings.preset === "spacious"
      ? settings.height === "standard" ? "spacious" : settings.height
      : settings.height;

  const styleClass =
    resolvedStyle === "elevated"
      ? "rounded-xl border border-border shadow-sm"
      : resolvedStyle === "flat"
      ? "border-b border-border"
      : resolvedStyle === "wide"
      ? "border-b border-border"
      : resolvedStyle === "slim" || resolvedStyle === "compact"
      ? "border-b border-border"
      : "border-b border-border";

  const surfaceClass =
    settings.surface === "transparent"
      ? "bg-transparent"
      : settings.surface === "surface"
      ? "bg-card/95"
      : "bg-background/95";

  const spacingClass =
    resolvedHeight === "compact"
      ? settings.density === "compact"
        ? "px-2 py-1.5 sm:px-2.5 sm:py-1.5"
        : "px-2.5 py-2 sm:px-3 sm:py-2"
      : resolvedHeight === "spacious"
      ? settings.density === "spacious"
        ? "px-3.5 py-3.5 sm:px-4.5 sm:py-4 md:px-5.5"
        : "px-3 py-3 sm:px-4 sm:py-3.5 md:px-5"
      : settings.density === "compact"
      ? "px-2.5 py-2 sm:px-3 sm:py-2.5 md:px-3.5"
      : settings.density === "spacious"
      ? "px-3 py-3 sm:px-4 sm:py-3.5 md:px-4.5"
      : "px-2.5 py-2.5 sm:px-3.5 sm:py-3 md:px-4";

  return cn("no-print shrink-0 backdrop-blur-sm", styleClass, surfaceClass, spacingClass);
}

export function getDataHeaderShellClasses(settings: DataHeaderSettings): string {
  const surfaceClass =
    settings.surface === "card"
      ? "rounded-xl border border-border bg-card shadow-sm"
      : settings.surface === "flat"
      ? "border-b border-border bg-transparent"
      : "rounded-xl border border-border bg-muted/20";

  const densityClass =
    settings.density === "compact"
      ? "px-2 py-1.5"
      : settings.density === "comfortable"
      ? "px-3 py-2.5"
      : "px-2.5 py-2";

  return cn("no-print", surfaceClass, densityClass);
}

export function getTableShellRadiusClass(settings: PageTemplateSettings): string {
  return settings.tableShellRadius === "lg" ? "rounded-lg" : "rounded-xl";
}
