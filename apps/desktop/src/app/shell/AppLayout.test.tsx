import { render, screen } from "@testing-library/react";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppLayout } from "./AppLayout";

let currentTabStyle: "default" | "browser" | "vscode" = "default";
let currentShellVariant: "vertical" | "topnav" | "horizontal" | "combo" = "vertical";
let currentActiveTabId = "dashboard";
let currentTabs = [
  { id: "dashboard", title: "Dashboard", path: "/dashboard", active: true },
  { id: "journal", title: "Journal", path: "/journal", active: false },
];

vi.mock("@app/providers/TabContext", () => ({
  useTabs: () => ({
    tabs: currentTabs,
    activeTabId: currentActiveTabId,
  }),
}));

vi.mock("@shared/hooks/useAppearance", () => ({
  useAppearance: () => ({
    settings: {
      tabStyle: currentTabStyle,
      motion: "standard",
    },
    activeLayout: {
      shellVariant: currentShellVariant,
    },
  }),
}));

vi.mock("@shared/hooks/useResponsiveContext", () => ({
  useResponsiveContext: () => ({
    isMobile: false,
    isTablet: false,
  }),
}));

vi.mock("@app/providers/CurrencyContext", () => ({
  useCurrencyContext: () => ({
    hasMultipleCurrencies: false,
  }),
}));

vi.mock("@app/providers/useGlobalSearch", () => ({
  useGlobalSearch: () => ({
    openSearch: vi.fn(),
  }),
}));

vi.mock("@app/providers/useCommands", () => ({
  useCommands: () => ({
    executeCommand: vi.fn(),
  }),
}));

vi.mock("@app/providers/LocalizationProvider", () => ({
  useLocalization: () => ({
    direction: "rtl",
    t: (key: string) => key,
  }),
}));

vi.mock("@shared/hooks/useKeyboardShortcuts", () => ({
  useKeyboardShortcuts: vi.fn(),
}));

vi.mock("@modules/inventory/api/warehouseService", () => ({
  warehouseService: {
    ensureDefaultWarehouse: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@modules/core/update/context/UpdateContext", () => ({
  UpdateProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@app/router/ErpRoutes", () => ({
  ErpRoutes: ({ location }: { location?: string }) => <div data-testid={`route-${location ?? "unknown"}`} />,
}));

vi.mock("@shared/ui/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@modules/core/currencies/components/FloatingExchangeRateWidget", () => ({
  FloatingExchangeRateWidget: () => <div data-testid="exchange-widget" />,
}));

vi.mock("./layouts/VerticalLayout", () => ({
  VerticalLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="layout-vertical">{children}</div>,
}));

vi.mock("./layouts/TopNavLayout", () => ({
  TopNavLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="layout-topnav">{children}</div>,
}));

vi.mock("./layouts/HorizontalLayout", () => ({
  HorizontalLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="layout-horizontal">{children}</div>,
}));

vi.mock("./layouts/ComboLayout", () => ({
  ComboLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="layout-combo">{children}</div>,
}));

vi.mock("./layouts/DefaultVerticalLayout", () => ({
  DefaultVerticalLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="default-layout-vertical">{children}</div>,
}));

vi.mock("./layouts/DefaultTopNavLayout", () => ({
  DefaultTopNavLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="default-layout-topnav">{children}</div>,
}));

vi.mock("./layouts/DefaultHorizontalLayout", () => ({
  DefaultHorizontalLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="default-layout-horizontal">{children}</div>,
}));

vi.mock("./layouts/DefaultComboLayout", () => ({
  DefaultComboLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="default-layout-combo">{children}</div>,
}));

vi.mock("./MobileNav", () => ({
  MobileNav: () => <div data-testid="mobile-nav" />,
}));

vi.mock("./GlobalSearch", () => ({
  GlobalSearch: () => <div data-testid="global-search-overlay" />,
}));

vi.mock("./VoiceAssistantOverlay", () => ({
  VoiceAssistantOverlay: () => <div data-testid="voice-overlay" />,
}));

vi.mock("@shared/ui/BarcodeScanDialog", () => ({
  BarcodeScanDialog: () => <div data-testid="barcode-dialog" />,
}));

vi.mock("./DefaultWorkspace", () => ({
  DefaultWorkspace: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="default-workspace">{children}</div>
  ),
}));

vi.mock("./BrowserWorkspace", () => ({
  BrowserWorkspace: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="browser-workspace">{children}</div>
  ),
}));

vi.mock("./VSCodeWorkspace", () => ({
  VSCodeWorkspace: ({ content }: { content: React.ReactNode }) => (
    <div data-testid="vscode-workbench">
      <div data-testid="vscode-content">{content}</div>
    </div>
  ),
}));

describe("AppLayout presentation switching", () => {
  beforeEach(() => {
    currentTabStyle = "default";
    currentShellVariant = "vertical";
    currentActiveTabId = "dashboard";
    currentTabs = [
      { id: "dashboard", title: "Dashboard", path: "/dashboard", active: true },
      { id: "journal", title: "Journal", path: "/journal", active: false },
    ];
  });

  it("uses the standard shell family for default and browser modes, then switches to vscode workbench cleanly", async () => {
    let rerender: ReturnType<typeof render>["rerender"];

    await act(async () => {
      ({ rerender } = render(<AppLayout />));
    });

    expect(screen.getByTestId("default-workspace")).toBeInTheDocument();
    expect(screen.getByTestId("default-layout-vertical")).toBeInTheDocument();
    expect(screen.queryByTestId("browser-workspace")).not.toBeInTheDocument();
    expect(screen.queryByTestId("layout-vertical")).not.toBeInTheDocument();
    expect(screen.queryByTestId("vscode-workbench")).not.toBeInTheDocument();
    expect(screen.getByTestId("route-/dashboard")).toBeInTheDocument();

    currentTabStyle = "browser";
    await act(async () => {
      rerender(<AppLayout />);
    });

    expect(screen.queryByTestId("default-workspace")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("browser-workspace")).toHaveLength(1);
    expect(screen.getByTestId("layout-vertical")).toBeInTheDocument();
    expect(screen.queryByTestId("default-layout-vertical")).not.toBeInTheDocument();
    expect(screen.queryByTestId("vscode-workbench")).not.toBeInTheDocument();

    currentTabStyle = "vscode";
    await act(async () => {
      rerender(<AppLayout />);
    });

    expect(screen.queryByTestId("default-workspace")).not.toBeInTheDocument();
    expect(screen.queryByTestId("browser-workspace")).not.toBeInTheDocument();
    expect(screen.getByTestId("vscode-workbench")).toBeInTheDocument();
    expect(screen.queryByTestId("layout-vertical")).not.toBeInTheDocument();
    expect(screen.getByTestId("vscode-content")).toBeInTheDocument();

    currentTabStyle = "default";
    await act(async () => {
      rerender(<AppLayout />);
    });

    expect(screen.getAllByTestId("default-workspace")).toHaveLength(1);
    expect(screen.queryByTestId("browser-workspace")).not.toBeInTheDocument();
    expect(screen.getByTestId("default-layout-vertical")).toBeInTheDocument();
    expect(screen.queryByTestId("layout-vertical")).not.toBeInTheDocument();
    expect(screen.queryByTestId("vscode-workbench")).not.toBeInTheDocument();
  });

  it("renders the active tab route even when tab.active flags are stale", async () => {
    currentTabStyle = "vscode";
    currentActiveTabId = "journal";
    currentTabs = [
      { id: "dashboard", title: "Dashboard", path: "/dashboard", active: false },
      { id: "journal", title: "Journal", path: "/journal", active: false },
    ];

    await act(async () => {
      render(<AppLayout />);
    });

    expect(screen.getByTestId("route-/journal")).toBeInTheDocument();
  });
});
