import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RRHHUploadPanel } from "./RRHHUploadPanel";

describe("RRHHUploadPanel", () => {
  it("permite ejecutar la acción de eliminar últimos agregados", () => {
    const onDeleteLastAdded = vi.fn();

    render(
      <RRHHUploadPanel
        isReadOnly={false}
        dragActive={false}
        file={null}
        uploadStatus="idle"
        deleteStatus="idle"
        deleteByCreatedAtStatus="idle"
        deleteByCreatedAtMessage={null}
        deleteBatchOptions={[]}
        selectedDeleteBatch=""
        uploadStats={null}
        onFileChange={vi.fn()}
        onClearFile={vi.fn()}
        onUpload={vi.fn()}
        onDeleteLastAdded={onDeleteLastAdded}
        onDeleteBatchChange={vi.fn()}
        onDeleteByCreatedAt={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /eliminar últimos agregados/i }));

    expect(onDeleteLastAdded).toHaveBeenCalledTimes(1);
  });

  it("muestra estado visual mientras elimina el último lote", () => {
    render(
      <RRHHUploadPanel
        isReadOnly={false}
        dragActive={false}
        file={null}
        uploadStatus="idle"
        deleteStatus="deleting"
        deleteByCreatedAtStatus="idle"
        deleteByCreatedAtMessage={null}
        deleteBatchOptions={[]}
        selectedDeleteBatch=""
        uploadStats={null}
        onFileChange={vi.fn()}
        onClearFile={vi.fn()}
        onUpload={vi.fn()}
        onDeleteLastAdded={vi.fn()}
        onDeleteBatchChange={vi.fn()}
        onDeleteByCreatedAt={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /eliminando/i })).toBeDisabled();
  });

  it("permite seleccionar una fecha y eliminar por created_at", () => {
    const onDeleteBatchChange = vi.fn();
    const onDeleteByCreatedAt = vi.fn();

    render(
      <RRHHUploadPanel
        isReadOnly={false}
        dragActive={false}
        file={null}
        uploadStatus="idle"
        deleteStatus="idle"
        deleteByCreatedAtStatus="idle"
        deleteByCreatedAtMessage={null}
        deleteBatchOptions={[{ value: "2026-04-13T09:00:00+00:00", label: "13 abr 2026, 09:00 · 2 registros" }]}
        selectedDeleteBatch="2026-04-13T09:00:00+00:00"
        uploadStats={null}
        onFileChange={vi.fn()}
        onClearFile={vi.fn()}
        onUpload={vi.fn()}
        onDeleteLastAdded={vi.fn()}
        onDeleteBatchChange={onDeleteBatchChange}
        onDeleteByCreatedAt={onDeleteByCreatedAt}
      />,
    );

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "2026-04-13T09:00:00+00:00" } });
    fireEvent.click(screen.getByRole("button", { name: /eliminar por fecha/i }));

    expect(onDeleteBatchChange).toHaveBeenCalledWith("2026-04-13T09:00:00+00:00");
    expect(onDeleteByCreatedAt).toHaveBeenCalledTimes(1);
  });
});
