import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MoreHorizontal, type LucideIcon } from "lucide-react";
import { useLocalization } from "@app/providers/LocalizationProvider";
import { Button, type ButtonProps } from "@shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@shared/ui/dropdown-menu";
import { cn } from "@shared/lib/utils";

export type ResponsiveActionPriority = "primary" | "secondary" | "tertiary" | "overflow";
export type ResponsiveActionMode = "full" | "compact";

export interface ResponsiveActionItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  priority: ResponsiveActionPriority;
  variant?: NonNullable<ButtonProps["variant"]>;
  disabled?: boolean;
  loading?: boolean;
  destructive?: boolean;
  shortcut?: string;
  accessibilityLabel?: string;
  tooltip?: string;
  allowIconOnly?: boolean;
  onClick?: () => void;
}

interface ResponsiveActionsProps {
  actions: ResponsiveActionItem[];
  className?: string;
  compact?: boolean;
}

type MeasuredWidths = {
  full: Record<string, number>;
  compact: Record<string, number>;
  more: number;
};

type LayoutState = {
  visible: string[];
  overflow: string[];
  modes: Record<string, ResponsiveActionMode>;
};

const GAP_PX = 8;

const PRIORITY_RANK: Record<ResponsiveActionPriority, number> = {
  primary: 0,
  secondary: 1,
  tertiary: 2,
  overflow: 3,
};

function resolveVariant(action: ResponsiveActionItem): NonNullable<ButtonProps["variant"]> {
  if (action.variant) return action.variant;
  if (action.destructive) return "destructive";
  if (action.priority === "primary") return "default";
  if (action.priority === "secondary") return "outline";
  return "ghost";
}

function computeLayout(
  actions: ResponsiveActionItem[],
  containerWidth: number,
  widths: MeasuredWidths,
): LayoutState {
  const inline = new Set(
    actions.filter((action) => action.priority !== "overflow").map((action) => action.id),
  );
  const overflow = new Set(
    actions.filter((action) => action.priority === "overflow").map((action) => action.id),
  );
  const modes: Record<string, ResponsiveActionMode> = Object.fromEntries(
    actions.map((action) => [action.id, "full" satisfies ResponsiveActionMode]),
  );

  const orderedInline = () => actions.filter((action) => inline.has(action.id));
  const orderedOverflow = () => actions.filter((action) => overflow.has(action.id));

  const widthFor = (action: ResponsiveActionItem) => {
    const mode = modes[action.id];
    const compactWidth = widths.compact[action.id];
    const fullWidth = widths.full[action.id];
    return mode === "compact" && compactWidth ? compactWidth : fullWidth;
  };

  const totalWidth = () => {
    const visibleActions = orderedInline();
    const overflowActions = orderedOverflow();
    const actionCount = visibleActions.length + (overflowActions.length > 0 ? 1 : 0);
    const gaps = actionCount > 1 ? GAP_PX * (actionCount - 1) : 0;
    const inlineWidth = visibleActions.reduce((sum, action) => sum + widthFor(action), 0);
    const overflowWidth = overflowActions.length > 0 ? widths.more : 0;
    return inlineWidth + overflowWidth + gaps;
  };

  if (containerWidth <= 0) {
    return {
      visible: orderedInline().map((action) => action.id),
      overflow: orderedOverflow().map((action) => action.id),
      modes,
    };
  }

  const demoteByPriority = (priority: ResponsiveActionPriority) => {
    let changed = false;
    for (let index = actions.length - 1; index >= 0; index -= 1) {
      const action = actions[index];
      if (!inline.has(action.id) || action.priority !== priority) continue;
      inline.delete(action.id);
      overflow.add(action.id);
      changed = true;
      if (totalWidth() <= containerWidth) return true;
    }
    return changed;
  };

  const compactByPriority = (priority: ResponsiveActionPriority) => {
    let changed = false;
    for (let index = actions.length - 1; index >= 0; index -= 1) {
      const action = actions[index];
      if (!inline.has(action.id) || action.priority !== priority) continue;
      if (!action.icon || action.allowIconOnly === false) continue;
      if (!widths.compact[action.id] || widths.compact[action.id] >= widths.full[action.id]) continue;
      if (modes[action.id] === "compact") continue;
      modes[action.id] = "compact";
      changed = true;
      if (totalWidth() <= containerWidth) return true;
    }
    return changed;
  };

  const demotionPasses: ResponsiveActionPriority[] = ["tertiary", "secondary"];
  for (const priority of demotionPasses) {
    if (totalWidth() <= containerWidth) break;
    demoteByPriority(priority);
  }

  const compactionPasses: ResponsiveActionPriority[] = ["primary", "secondary", "tertiary"];
  for (const priority of compactionPasses) {
    if (totalWidth() <= containerWidth) break;
    compactByPriority(priority);
  }

  for (const priority of demotionPasses) {
    if (totalWidth() <= containerWidth) break;
    demoteByPriority(priority);
  }

  return {
    visible: orderedInline().map((action) => action.id),
    overflow: orderedOverflow().map((action) => action.id),
    modes,
  };
}

function ActionIcon({
  action,
  className,
}: {
  action: ResponsiveActionItem;
  className?: string;
}) {
  const Icon = action.loading ? Loader2 : action.icon;
  if (!Icon) return null;
  return <Icon className={cn(className, action.loading && "animate-spin")} aria-hidden="true" />;
}

function InlineActionButton({
  action,
  mode,
  compact = false,
}: {
  action: ResponsiveActionItem;
  mode: ResponsiveActionMode;
  compact?: boolean;
}) {
  const iconOnly = mode === "compact";
  const accessibleName = action.accessibilityLabel ?? action.label;

  return (
    <Button
      type="button"
      size={iconOnly ? "icon" : "sm"}
      variant={resolveVariant(action)}
      disabled={action.disabled || action.loading}
      aria-label={iconOnly ? accessibleName : undefined}
      title={iconOnly ? action.tooltip ?? accessibleName : action.tooltip}
      onClick={action.onClick}
      className={cn(
        compact ? "h-8 shrink-0 gap-1.5 text-xs" : "h-9 shrink-0 gap-1.5",
        iconOnly && (compact ? "w-8 px-0" : "w-9 px-0"),
        action.priority === "primary" && !iconOnly && "shadow-sm",
      )}
    >
      <ActionIcon action={action} className="h-4 w-4" />
      {!iconOnly && <span className="truncate">{action.label}</span>}
      {iconOnly && <span className="sr-only">{accessibleName}</span>}
    </Button>
  );
}

export function ResponsiveActions({ actions, className, compact = false }: ResponsiveActionsProps) {
  const { t } = useLocalization();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [widths, setWidths] = useState<MeasuredWidths>({
    full: {},
    compact: {},
    more: 0,
  });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const update = () => setContainerWidth(Math.floor(element.clientWidth));
    update();

    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const measureRoot = measureRef.current;
    if (!measureRoot) return;

    const readWidths = () => {
      const next: MeasuredWidths = {
        full: {},
        compact: {},
        more: 0,
      };

      const nodes = measureRoot.querySelectorAll<HTMLElement>("[data-action-id]");
      nodes.forEach((node) => {
        const id = node.dataset.actionId;
        const mode = node.dataset.mode as ResponsiveActionMode | "more" | undefined;
        if (!id || !mode) return;
        const width = Math.ceil(node.getBoundingClientRect().width);
        if (mode === "more") {
          next.more = width;
          return;
        }
        next[mode][id] = width;
      });

      setWidths((current) => {
        const sameFull = JSON.stringify(current.full) === JSON.stringify(next.full);
        const sameCompact = JSON.stringify(current.compact) === JSON.stringify(next.compact);
        const sameMore = current.more === next.more;
        return sameFull && sameCompact && sameMore ? current : next;
      });
    };

    readWidths();
    const observer = new ResizeObserver(readWidths);
    observer.observe(measureRoot);
    Array.from(measureRoot.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, [actions]);

  const sortedActions = useMemo(
    () =>
      [...actions].sort((left, right) => {
        const priorityDelta = PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority];
        return priorityDelta !== 0 ? priorityDelta : 0;
      }),
    [actions],
  );

  const layout = useMemo(
    () => computeLayout(sortedActions, containerWidth, widths),
    [sortedActions, containerWidth, widths],
  );

  const actionMap = useMemo(
    () => new Map(sortedActions.map((action) => [action.id, action])),
    [sortedActions],
  );

  const visibleActions = layout.visible
    .map((id) => actionMap.get(id))
    .filter((action): action is ResponsiveActionItem => Boolean(action));

  const overflowActions = layout.overflow
    .map((id) => actionMap.get(id))
    .filter((action): action is ResponsiveActionItem => Boolean(action));

  return (
    <div ref={containerRef} className={cn("relative min-w-0", className)}>
      <div className="flex min-w-0 items-center justify-end gap-2">
        {visibleActions.map((action) => (
          <InlineActionButton
            key={action.id}
            action={action}
            mode={layout.modes[action.id] ?? "full"}
            compact={compact}
          />
        ))}

        {overflowActions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label={t("actions.more", { namespace: "common" })}
                className={cn("shrink-0", compact ? "h-8 w-8" : "h-9 w-9")}
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">{t("actions.more", { namespace: "common" })}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[13rem] text-start">
              {overflowActions.map((action) => (
                <DropdownMenuItem
                  key={action.id}
                  disabled={action.disabled || action.loading}
                  onClick={action.onClick}
                  className={cn(
                    "gap-2",
                    action.destructive && "text-destructive focus:text-destructive",
                  )}
                >
                  <ActionIcon action={action} className="h-4 w-4" />
                  <span className="flex-1 truncate">{action.label}</span>
                  {action.shortcut ? (
                    <DropdownMenuShortcut>{action.shortcut}</DropdownMenuShortcut>
                  ) : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div
        ref={measureRef}
        aria-hidden="true"
        className="pointer-events-none absolute -top-[9999px] start-0 flex flex-wrap items-center gap-2 opacity-0"
      >
        {sortedActions.map((action) => (
          <div key={`${action.id}-full`} data-action-id={action.id} data-mode="full">
            <InlineActionButton action={action} mode="full" compact={compact} />
          </div>
        ))}
        {sortedActions
          .filter((action) => action.icon && action.allowIconOnly !== false)
          .map((action) => (
            <div key={`${action.id}-compact`} data-action-id={action.id} data-mode="compact">
              <InlineActionButton action={action} mode="compact" compact={compact} />
            </div>
          ))}
        <div data-action-id="__more__" data-mode="more">
          <Button type="button" size="icon" variant="outline" className={cn("shrink-0", compact ? "h-8 w-8" : "h-9 w-9")}>
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">{t("actions.more", { namespace: "common" })}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
