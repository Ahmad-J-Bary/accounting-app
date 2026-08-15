import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MovementTypeFilter } from "./MovementTypeFilter";
import { MOVEMENT_TYPE_KEYS } from "../constants/movementTypes";

describe("MovementTypeFilter", () => {
  it("shows the opening (أول المدة) chip by default", async () => {
    render(
      <MovementTypeFilter
        value={[...MOVEMENT_TYPE_KEYS]}
        onChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("النوع"));
    await waitFor(() => expect(screen.getByText("أول المدة")).toBeInTheDocument());
  });

  it("hides the opening (أول المدة) chip when excluded (NEW company)", async () => {
    render(
      <MovementTypeFilter
        value={MOVEMENT_TYPE_KEYS.filter(k => k !== "OpeningBalance")}
        onChange={vi.fn()}
        excludeKeys={["OpeningBalance"]}
      />,
    );
    fireEvent.click(screen.getByText("النوع"));
    await waitFor(() => expect(screen.getByText("مشتريات")).toBeInTheDocument());
    expect(screen.queryByText("أول المدة")).not.toBeInTheDocument();
  });
});