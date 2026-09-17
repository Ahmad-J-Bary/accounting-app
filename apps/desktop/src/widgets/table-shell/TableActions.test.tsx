import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TableActions } from "./TableActions";
import type { RowActionDescriptor } from "@shared/types/row-actions";
import { Eye, Edit, Trash2 } from "lucide-react";

interface TestRow {
  id: string;
  name: string;
}

describe("TableActions", () => {
  const sampleRow: TestRow = { id: "10", name: "Kebab Test Item" };

  it("renders kebab button and dropdown items from unified descriptor", () => {
    const handleView = vi.fn();
    const handleEdit = vi.fn();
    const handleDelete = vi.fn();

    const actions: RowActionDescriptor<TestRow>[] = [
      { id: "view", label: "View Details", icon: Eye, onClick: handleView },
      { id: "edit", label: "Edit Record", icon: Edit, onClick: handleEdit },
      { id: "delete", label: "Delete Record", icon: Trash2, destructive: true, onClick: handleDelete },
    ];

    render(
      <TableActions actions={actions} row={sampleRow} defaultOpen={true} />
    );

    const kebabButton = screen.getByTestId("table-row-kebab-button");
    expect(kebabButton).toBeInTheDocument();

    expect(screen.getByText("View Details")).toBeInTheDocument();
    expect(screen.getByText("Edit Record")).toBeInTheDocument();
    expect(screen.getByText("Delete Record")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Edit Record"));
    expect(handleEdit).toHaveBeenCalledWith(sampleRow);
  });

  it("works with legacy props for backward compatibility", () => {
    const handleView = vi.fn();
    const handleEdit = vi.fn();

    render(
      <TableActions onView={handleView} onEdit={handleEdit} defaultOpen={true} />
    );

    expect(screen.getByText(/labels\.viewDetails|عرض التفاصيل/i)).toBeInTheDocument();
    expect(screen.getByText(/labels\.editData|تعديل البيانات/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/labels\.viewDetails|عرض التفاصيل/i));
    expect(handleView).toHaveBeenCalledTimes(1);
  });
});
