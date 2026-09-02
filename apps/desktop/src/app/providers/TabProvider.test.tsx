import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TabProvider } from "./TabProvider";
import { useTabs } from "./TabContext";

function Probe() {
  const { tabs, openDashboardTab, markDirty, closeTab } = useTabs();
  const dirtyTab = tabs.find((tab) => tab.dirty);

  return (
    <div>
      <span data-testid="count">{tabs.length}</span>
      <span data-testid="dirty">{dirtyTab?.id || "none"}</span>
      <button onClick={openDashboardTab}>new-dashboard</button>
      <button onClick={() => markDirty("main-tab", true)}>dirty-main</button>
      <button onClick={() => closeTab("main-tab")}>close-main</button>
    </div>
  );
}

describe("TabProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("opens a new dashboard tab and tracks dirty state", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <TabProvider>
          <Probe />
        </TabProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("count").textContent).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: "new-dashboard" }));
    expect(screen.getByTestId("count").textContent).toBe("2");

    fireEvent.click(screen.getByRole("button", { name: "dirty-main" }));
    expect(screen.getByTestId("dirty").textContent).toBe("main-tab");

    fireEvent.click(screen.getByRole("button", { name: "close-main" }));
    expect(screen.getByTestId("count").textContent).toBe("2");
  });
});
