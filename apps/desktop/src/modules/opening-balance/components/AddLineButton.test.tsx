import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddLineButton } from "@modules/opening-balance/components/AddLineButton";

describe("AddLineButton", () => {
  it("renders the add-line label", () => {
    render(<AddLineButton onClick={vi.fn()} />);
    expect(screen.getByRole("button", { name: /إضافة بند/ })).toBeInTheDocument();
  });

  it("fires onClick when clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<AddLineButton onClick={onClick} />);
    await user.click(screen.getByRole("button", { name: /إضافة بند/ }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});