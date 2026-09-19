import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTabs } from "@app/providers/TabContext";
import { findRouteById, resolveRouteLabel } from "@app/shell/routeRegistry";
import { useLocalization } from "@app/providers/LocalizationProvider";
import { CommandContext, type CommandContextValue } from "./CommandContext";
import type { AppCommand } from "@shared/types/commands";

function createTabId(prefix: string) {
  return `${prefix}-${Date.now()}`;
}

export function CommandProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { openTab, openDashboardTab, closeTab, nextTab, prevTab, reopenLastClosedTab, activeTabId } = useTabs();
  const { t } = useLocalization();

  const commands = useMemo<AppCommand[]>(() => {
    const openRouteInTab = (routeId: string, title: string) => {
      const route = findRouteById(routeId);
      if (!route) return;
      openTab({
        id: createTabId(routeId),
        title,
        path: route.to,
        icon: route.icon,
        module: route.groupId || "general",
      });
    };

    return [
      {
        id: "open-dashboard-tab",
        title: t("newDashboardTab", { namespace: "commands" }),
        icon: "LayoutDashboard",
        shortcut: ["Ctrl", "T"],
        keywords: ["dashboard", "tab", "home"],
        group: "workspace",
        run: () => openDashboardTab(),
      },
      {
        id: "workspace-close-active-tab",
        title: t("closeActiveTab", { namespace: "commands" }),
        icon: "X",
        shortcut: ["Ctrl", "W"],
        keywords: ["tab", "close", "workspace"],
        group: "workspace",
        run: () => closeTab(activeTabId),
      },
      {
        id: "workspace-next-tab",
        title: t("nextTab", { namespace: "commands" }),
        icon: "ChevronRight",
        shortcut: ["Ctrl", "Tab"],
        keywords: ["tab", "next", "workspace"],
        group: "workspace",
        run: () => nextTab(),
      },
      {
        id: "workspace-previous-tab",
        title: t("previousTab", { namespace: "commands" }),
        icon: "ChevronLeft",
        shortcut: ["Ctrl", "Shift", "Tab"],
        keywords: ["tab", "previous", "workspace"],
        group: "workspace",
        run: () => prevTab(),
      },
      {
        id: "workspace-reopen-last-tab",
        title: t("reopenLastTab", { namespace: "commands" }),
        icon: "History",
        keywords: ["tab", "reopen", "workspace"],
        group: "workspace",
        run: () => reopenLastClosedTab(),
      },
      {
        id: "open-settings",
        title: t("openSettings", { namespace: "commands" }),
        icon: "Settings",
        shortcut: ["Ctrl", ","],
        keywords: ["settings", "preferences", "config"],
        group: "navigation",
        run: () => navigate("/settings"),
      },
      {
        id: "new-sales-invoice",
        title: t("newSalesInvoice", { namespace: "commands" }),
        icon: "Receipt",
        shortcut: ["Ctrl", "N"],
        keywords: ["sales", "invoice"],
        group: "documents",
        run: () => openRouteInTab("sales-invoices", resolveRouteLabel("sales-invoices", t)),
      },
      {
        id: "new-purchase-invoice",
        title: t("newPurchaseInvoice", { namespace: "commands" }),
        icon: "ShoppingCart",
        shortcut: ["Ctrl", "B"],
        keywords: ["purchase", "invoice"],
        group: "documents",
        run: () => openRouteInTab("purchase-invoices", resolveRouteLabel("purchase-invoices", t)),
      },
      {
        id: "new-journal-entry",
        title: t("newJournalEntry", { namespace: "commands" }),
        icon: "FileText",
        shortcut: ["Ctrl", "J"],
        keywords: ["journal", "entry"],
        group: "documents",
        run: () => openRouteInTab("journal", resolveRouteLabel("journal", t)),
      },
      {
        id: "new-opening-balance",
        title: t("newOpeningBalance", { namespace: "commands" }),
        icon: "PackageOpen",
        keywords: ["opening", "balance", "inventory"],
        group: "documents",
        run: () => openRouteInTab("opening-balance", resolveRouteLabel("opening-balance", t)),
      },
    ];
  }, [activeTabId, closeTab, navigate, nextTab, openDashboardTab, openTab, prevTab, reopenLastClosedTab, t]);

  const value = useMemo<CommandContextValue>(
    () => ({
      commands,
      executeCommand: (id: string) => {
        const command = commands.find((item) => item.id === id);
        if (command) {
          void command.run();
        }
      },
    }),
    [commands],
  );

  return <CommandContext.Provider value={value}>{children}</CommandContext.Provider>;
}
