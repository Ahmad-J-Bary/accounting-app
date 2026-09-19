import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Tab } from "@shared/types/tabs";
import { LocalizationProvider } from "@app/providers/LocalizationProvider";
import { WorkspaceTabStrip } from "./WorkspaceTabStrip";

const tabs: Tab[] = [
  { id: "main-tab", title: "Dashboard", path: "/dashboard", active: false, closable: false, pinned: true },
  { id: "journal", title: "Journal", path: "/journal", active: true, closable: true, icon: "FileText", dirty: true },
  { id: "sales", title: "Sales Invoices", path: "/sales-invoices", active: false, closable: true, icon: "Receipt", pinned: true },
];

function renderStrip(tabStyle: "default" | "browser" | "vscode" = "default") {
  localStorage.setItem("erp_language", "en");
  const actions = {
    onActivate: vi.fn(),
    onClose: vi.fn(),
    onNewTab: vi.fn(),
    onCloseOthers: vi.fn(),
    onCloseToRight: vi.fn(),
    onCloseToLeft: vi.fn(),
    onCloseAll: vi.fn(),
    onReopenLastClosed: vi.fn(),
    onDuplicate: vi.fn(),
    onPin: vi.fn(),
    onUnpin: vi.fn(),
  };

  render(
    <LocalizationProvider>
      <WorkspaceTabStrip
        tabs={tabs}
        tabStyle={tabStyle}
        alwaysVisible
        {...actions}
      />
    </LocalizationProvider>,
  );

  return actions;
}

describe("WorkspaceTabStrip", () => {
  it("renders the shared interactions and opens the overflow actions", async () => {
    const actions = renderStrip("browser");

    fireEvent.click(screen.getByLabelText("Open new tab"));
    expect(actions.onNewTab).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("tab", { name: "Switch to Journal" }));
    expect(actions.onActivate).toHaveBeenCalledWith("journal");

    fireEvent.pointerDown(screen.getByLabelText("More tabs"), { button: 0, ctrlKey: false });
    expect(await screen.findByText("Reopen last closed tab")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Close all tabs"));
    expect(actions.onCloseAll).toHaveBeenCalledTimes(1);
  });

  it("supports the tab context menu commands from the same workspace layer", async () => {
    const actions = renderStrip("vscode");

    fireEvent.contextMenu(screen.getByRole("tab", { name: "Switch to Sales Invoices" }));
    expect(await screen.findByText("Tab actions")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Close others"));
    expect(actions.onCloseOthers).toHaveBeenCalledWith("sales");

    fireEvent.contextMenu(screen.getByRole("tab", { name: "Switch to Sales Invoices" }));
    fireEvent.click(await screen.findByText("Unpin tab"));
    expect(actions.onUnpin).toHaveBeenCalledWith("sales");
  });

  it("switches presentation mode without changing the underlying component", () => {
    localStorage.setItem("erp_language", "en");
    const { rerender } = render(
      <LocalizationProvider>
        <WorkspaceTabStrip
          tabs={tabs}
          tabStyle="default"
          onActivate={vi.fn()}
          onClose={vi.fn()}
          onNewTab={vi.fn()}
          alwaysVisible
        />
      </LocalizationProvider>,
    );

    expect(screen.getByRole("tab", { name: "Switch to Journal" }).className).toContain("rounded-t-lg");

    rerender(
      <LocalizationProvider>
        <WorkspaceTabStrip
          tabs={tabs}
          tabStyle="browser"
          onActivate={vi.fn()}
          onClose={vi.fn()}
          onNewTab={vi.fn()}
          alwaysVisible
        />
      </LocalizationProvider>,
    );
    expect(screen.getByRole("tab", { name: "Switch to Journal" }).className).toContain("rounded-t-2xl");
  });
});
