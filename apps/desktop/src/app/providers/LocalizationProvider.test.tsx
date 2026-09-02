import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LocalizationProvider, useLocalization } from "./LocalizationProvider";

function Probe() {
  const { language, direction, t, setLanguage } = useLocalization();
  return (
    <div>
      <span data-testid="language">{language}</span>
      <span data-testid="direction">{direction}</span>
      <span data-testid="label">{t("globalSearch", { namespace: "shell" })}</span>
      <button onClick={() => setLanguage("en")}>switch</button>
    </div>
  );
}

describe("LocalizationProvider", () => {
  it("defaults to Arabic and switches to English", () => {
    render(
      <LocalizationProvider>
        <Probe />
      </LocalizationProvider>,
    );

    expect(screen.getByTestId("language").textContent).toBe("ar");
    expect(screen.getByTestId("direction").textContent).toBe("rtl");
    expect(screen.getByTestId("label").textContent).toBe("البحث الشامل");

    fireEvent.click(screen.getByRole("button", { name: "switch" }));

    expect(screen.getByTestId("language").textContent).toBe("en");
    expect(screen.getByTestId("direction").textContent).toBe("ltr");
    expect(screen.getByTestId("label").textContent).toBe("Global Search");
  });
});
