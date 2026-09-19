import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VSCodeWorkspace } from "./VSCodeWorkspace";

vi.mock("@app/providers/TabContext", () => ({
  useTabs: () => ({
    tabs: [
      { id: "dashboard", title: "Dashboard", path: "/dashboard", active: false, closable: false },
      { id: "journal", title: "Journal", path: "/journal", active: true, closable: true, dirty: true },
    ],
    activeTabId: "journal",
    openTab: vi.fn(),
    switchTab: vi.fn(),
  }),
}));

vi.mock("@app/providers/LocalizationProvider", () => ({
  useLocalization: () => ({
    t: (key: string) => key,
    direction: "rtl",
  }),
}));

vi.mock("@app/providers/useGlobalSearch", () => ({
  useGlobalSearch: () => ({
    recent: [{ id: "route:dashboard", title: "Dashboard", type: "route" }],
    openSearch: vi.fn(),
    activateResult: vi.fn(),
  }),
}));

vi.mock("@app/providers/CurrencyContext", () => ({
  useCurrencyContext: () => ({
    hasMultipleCurrencies: true,
  }),
}));

vi.mock("@shared/hooks/useResponsiveContext", () => ({
  useResponsiveContext: () => ({
    isMobile: false,
    isTablet: false,
  }),
}));

vi.mock("@shared/hooks/useAppearance", () => ({
  useAppearance: () => ({
    settings: {
      tabStyle: "vscode",
      motion: "standard",
    },
  }),
}));

vi.mock("@shared/hooks", () => ({
  useCompanyTypeSettings: () => ({}),
  useCompanyInitState: () => ({
    initState: "ACTIVE",
    isReady: true,
  }),
}));

vi.mock("@modules/opening-balance/lib/company-lifecycle", () => ({
  companyTypeOf: () => "existing",
  hiddenNavIds: () => new Set<string>(),
}));

vi.mock("@modules/core/api/settingsService", () => ({
  settingsService: {
    getSettings: () => Promise.resolve({ company_name: "Acme" }),
  },
}));

vi.mock("./WindowControls", () => ({
  WindowControls: () => <div data-testid="window-controls-vscode" />,
}));

vi.mock("./useDesktopWindowState", () => ({
  useDesktopWindowState: () => ({
    isTauriWindow: true,
    isMaximized: false,
    isFullscreen: false,
    isFocused: true,
    ready: true,
    minimize: vi.fn(),
    toggleMaximize: vi.fn(),
    close: vi.fn(),
    setWindowTitle: vi.fn(),
  }),
}));

vi.mock("./TabBar", () => ({
  TabBar: () => <div data-testid="shared-tabbar">tabs</div>,
}));

describe("VSCodeWorkspace", () => {
  it("renders a workbench structure with title bar, activity bar, editor tabs, panel, and status bar", async () => {
    await act(async () => {
      render(
        <VSCodeWorkspace
          content={<div data-testid="workspace-content">content</div>}
          isExchangeVisible={false}
          onToggleExchange={vi.fn()}
        />,
      );
    });

    expect(screen.getByTestId("vscode-workbench")).toBeInTheDocument();
    expect(screen.getByTestId("vscode-titlebar")).toBeInTheDocument();
    expect(screen.getByTestId("vscode-activitybar")).toBeInTheDocument();
    expect(screen.getByTestId("vscode-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("vscode-editor-tabs")).toBeInTheDocument();
    expect(screen.getByTestId("vscode-editor-content")).toBeInTheDocument();
    expect(screen.getByTestId("vscode-panel")).toBeInTheDocument();
    expect(screen.getByTestId("vscode-statusbar")).toBeInTheDocument();
    expect(screen.getByTestId("window-controls-vscode")).toBeInTheDocument();
    expect(screen.getAllByTestId("shared-tabbar")).toHaveLength(1);
    expect(screen.getByTestId("workspace-content")).toBeInTheDocument();
  });
});
