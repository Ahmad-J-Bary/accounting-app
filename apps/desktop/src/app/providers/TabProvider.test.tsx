import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { LocalizationProvider } from "@app/providers/LocalizationProvider";
import { TabProvider } from "./TabProvider";
import { useTabs } from "./TabContext";

const WORKSPACE_STORAGE_KEY = "erp.workspace.state.v1";

function Probe() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    tabs,
    activeTabId,
    openTab,
    closeTab,
    closeOtherTabs,
    closeTabsToRight,
    closeTabsToLeft,
    closeAllTabs,
    reopenLastClosedTab,
    nextTab,
    prevTab,
    markDirty,
    openDashboardTab,
  } = useTabs();

  return (
    <div>
      <span data-testid="count">{tabs.length}</span>
      <span data-testid="active">{activeTabId}</span>
      <span data-testid="path">{location.pathname + location.search}</span>
      <span data-testid="tabs">
        {tabs
          .map((tab) => `${tab.id}:${tab.path}:${tab.active ? "1" : "0"}:${tab.dirty ? "dirty" : "clean"}`)
          .join("|")}
      </span>

      <button onClick={() => openTab({ id: "customers-a", title: "Customers", path: "/customers", closable: true })}>open-customers</button>
      <button onClick={() => openTab({ id: "customers-b", title: "Customers 2", path: "/customers", closable: true })}>open-customers-duplicate</button>
      <button onClick={() => openTab({ id: "suppliers-a", title: "Suppliers", path: "/suppliers", closable: true })}>open-suppliers</button>
      <button onClick={() => openTab({ id: "expenses-a", title: "Expenses", path: "/expenses", closable: true })}>open-expenses</button>
      <button onClick={() => openTab({ id: "sales-edit-a", title: "Edit 123", path: "/sales-invoices/123", closable: true })}>open-sales-edit</button>
      <button onClick={() => openTab({ id: "sales-edit-b", title: "Edit 123 Duplicate", path: "/sales-invoices/123", closable: true })}>open-sales-edit-duplicate</button>
      <button onClick={() => openTab({ id: "sales-view-a", title: "View 123", path: "/sales-invoices/123?mode=view", closable: true })}>open-sales-view</button>
      <button onClick={() => openTab({ id: "sales-new-1", title: "Draft 1", path: "/sales-invoices/new-1", closable: true })}>open-sales-new-1</button>
      <button onClick={() => openTab({ id: "sales-new-2", title: "Draft 2", path: "/sales-invoices/new-2", closable: true })}>open-sales-new-2</button>
      <button onClick={() => markDirty(activeTabId, true)}>dirty-active</button>
      <button onClick={() => closeTab(activeTabId)}>close-active</button>
      <button onClick={() => closeOtherTabs(activeTabId)}>close-others</button>
      <button onClick={() => closeTabsToRight(activeTabId)}>close-right</button>
      <button onClick={() => closeTabsToLeft(activeTabId)}>close-left</button>
      <button onClick={() => closeAllTabs()}>close-all</button>
      <button onClick={() => reopenLastClosedTab()}>reopen-last</button>
      <button onClick={() => nextTab()}>next-tab</button>
      <button onClick={() => prevTab()}>prev-tab</button>
      <button onClick={() => openDashboardTab()}>new-dashboard</button>
      <button onClick={() => navigate("/sales-invoices/123")}>navigate-sales-edit</button>
      <button onClick={() => navigate("/customers?status=active")}>navigate-customers-filter</button>
      <button onClick={() => navigate(-1)}>go-back</button>
      <button onClick={() => navigate(1)}>go-forward</button>
    </div>
  );
}

function renderWorkspace(initialEntries: string[] = ["/dashboard"]) {
  return render(
    <LocalizationProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <TabProvider>
          <Routes>
            <Route path="*" element={<Probe />} />
          </Routes>
        </TabProvider>
      </MemoryRouter>
    </LocalizationProvider>,
  );
}

describe("TabProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("reuses existing route tabs and entity tabs by identity", () => {
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "open-customers" }));
    fireEvent.click(screen.getByRole("button", { name: "open-customers-duplicate" }));
    expect(screen.getByTestId("count").textContent).toBe("2");
    expect(screen.getByTestId("path").textContent).toBe("/customers");

    fireEvent.click(screen.getByRole("button", { name: "open-sales-edit" }));
    fireEvent.click(screen.getByRole("button", { name: "open-sales-edit-duplicate" }));
    expect(screen.getByTestId("count").textContent).toBe("3");

    fireEvent.click(screen.getByRole("button", { name: "open-sales-view" }));
    expect(screen.getByTestId("count").textContent).toBe("4");
  });

  it("keeps draft routes as distinct tabs", () => {
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "open-sales-new-1" }));
    fireEvent.click(screen.getByRole("button", { name: "open-sales-new-2" }));

    expect(screen.getByTestId("count").textContent).toBe("3");
    expect(screen.getByTestId("tabs").textContent).toContain("/sales-invoices/new-1");
    expect(screen.getByTestId("tabs").textContent).toContain("/sales-invoices/new-2");
  });

  it("protects dirty tabs with a localized confirmation dialog", () => {
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "open-customers" }));
    fireEvent.click(screen.getByRole("button", { name: "dirty-active" }));
    fireEvent.click(screen.getByRole("button", { name: "close-active" }));

    expect(screen.getByText("إغلاق تبويب يحتوي على تغييرات غير محفوظة")).toBeInTheDocument();
    expect(screen.getByTestId("count").textContent).toBe("2");

    fireEvent.click(screen.getByRole("button", { name: "إغلاق التبويب" }));
    expect(screen.getByTestId("count").textContent).toBe("1");
    expect(screen.getByTestId("path").textContent).toBe("/dashboard");
  });

  it("supports closing and reopening tabs from the closed stack", () => {
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "open-customers" }));
    fireEvent.click(screen.getByRole("button", { name: "close-active" }));
    expect(screen.getByTestId("count").textContent).toBe("1");

    fireEvent.click(screen.getByRole("button", { name: "reopen-last" }));
    expect(screen.getByTestId("count").textContent).toBe("2");
    expect(screen.getByTestId("path").textContent).toBe("/customers");
  });

  it("navigates tabs with keyboard shortcuts", () => {
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "open-customers" }));
    fireEvent.click(screen.getByRole("button", { name: "open-suppliers" }));
    expect(screen.getByTestId("path").textContent).toBe("/suppliers");

    fireEvent.keyDown(window, { ctrlKey: true, code: "PageUp", key: "PageUp" });
    expect(screen.getByTestId("path").textContent).toBe("/customers");

    fireEvent.keyDown(window, { ctrlKey: true, shiftKey: true, code: "Tab", key: "Tab" });
    expect(screen.getByTestId("path").textContent).toBe("/dashboard");

    fireEvent.keyDown(window, { ctrlKey: true, code: "KeyT", key: "t" });
    expect(screen.getByTestId("count").textContent).toBe("4");
  });

  it("synchronizes location changes without creating duplicate tabs on back/forward", () => {
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "open-customers" }));
    fireEvent.click(screen.getByRole("button", { name: "open-suppliers" }));
    expect(screen.getByTestId("count").textContent).toBe("3");

    fireEvent.click(screen.getByRole("button", { name: "go-back" }));
    expect(screen.getByTestId("path").textContent).toBe("/customers");
    expect(screen.getByTestId("count").textContent).toBe("3");

    fireEvent.click(screen.getByRole("button", { name: "go-forward" }));
    expect(screen.getByTestId("path").textContent).toBe("/suppliers");
    expect(screen.getByTestId("count").textContent).toBe("3");
  });

  it("restores persisted workspace state", () => {
    window.localStorage.setItem(
      WORKSPACE_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        activeTabId: "sales-edit-a",
        tabs: [
          { id: "main-tab", title: "لوحة التحكم", path: "/dashboard", active: false, closable: false, restoreKey: "main:dashboard" },
          { id: "sales-edit-a", title: "Edit 123", path: "/sales-invoices/123", active: true, closable: true, restoreKey: "entity:sales-invoices:123:default" },
        ],
        closedTabs: [],
      }),
    );

    renderWorkspace(["/sales-invoices/123"]);

    expect(screen.getByTestId("count").textContent).toBe("2");
    expect(screen.getByTestId("active").textContent).toBe("sales-edit-a");
    expect(screen.getByTestId("path").textContent).toBe("/sales-invoices/123");
  });

  it("falls back safely when storage is corrupted", () => {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, "{broken");

    renderWorkspace();

    expect(screen.getByTestId("count").textContent).toBe("1");
    expect(screen.getByTestId("active").textContent).toBe("main-tab");
    expect(screen.getByTestId("path").textContent).toBe("/dashboard");
  });
});
