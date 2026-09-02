import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LocalizationProvider } from "./LocalizationProvider";
import { TabProvider } from "./TabProvider";
import { CommandProvider } from "./CommandProvider";
import { GlobalSearchProvider, useGlobalSearch } from "./GlobalSearchProvider";

function Probe() {
  const { openSearch, results, setQuery } = useGlobalSearch();
  return (
    <div>
      <button onClick={openSearch}>open</button>
      <button onClick={() => setQuery("الإعدادات")}>query-settings</button>
      <span data-testid="results">{results.length}</span>
      <span data-testid="first">{results[0]?.title || "none"}</span>
    </div>
  );
}

describe("GlobalSearchProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns normalized search results for commands and routes", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <LocalizationProvider>
          <TabProvider>
            <CommandProvider>
              <GlobalSearchProvider>
                <Probe />
              </GlobalSearchProvider>
            </CommandProvider>
          </TabProvider>
        </LocalizationProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "open" }));
    fireEvent.click(screen.getByRole("button", { name: "query-settings" }));

    expect(Number(screen.getByTestId("results").textContent || "0")).toBeGreaterThan(0);
    expect(screen.getByTestId("first").textContent).toContain("الإعدادات");
  });
});
