import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProgrammingActionBar } from "./ProgrammingActionBar";

describe("ProgrammingActionBar", () => {
  const baseProps = {
    onPrint: vi.fn(),
    onClose: vi.fn(),
    onDelete: vi.fn(),
    onSaveAndNext: vi.fn(),
    onPrevious: vi.fn(),
    onNext: vi.fn(),
    isReadOnly: false,
    programmingId: 1,
    isSubmitting: false,
    isAvailableNegative: false,
    isSaved: false,
    hasPrevious: true,
    hasNext: true,
    correctionHistory: [],
  };

  it("renderiza Anterior cuando existe un funcionario previo", () => {
    render(<ProgrammingActionBar {...baseProps} />);

    expect(screen.getByRole("button", { name: "Anterior" })).toBeInTheDocument();
  });

  it("oculta Anterior cuando no existe un funcionario previo", () => {
    render(<ProgrammingActionBar {...baseProps} hasPrevious={false} onPrevious={undefined} />);

    expect(screen.queryByRole("button", { name: "Anterior" })).not.toBeInTheDocument();
  });

  it("ejecuta onPrevious al hacer click en Anterior", () => {
    const onPrevious = vi.fn();
    render(<ProgrammingActionBar {...baseProps} onPrevious={onPrevious} />);

    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));

    expect(onPrevious).toHaveBeenCalledTimes(1);
  });

  it("muestra acciones de revisión cuando está en modo review", () => {
    const onSubmitReview = vi.fn();
    const { rerender } = render(
      <ProgrammingActionBar
        {...baseProps}
        isReadOnly
        reviewMode
        reviewComment="Observación"
        onReviewCommentChange={vi.fn()}
        onSubmitReview={onSubmitReview}
        latestReviewLabel="Validado · Revisor"
      />
    );

    expect(screen.getByText("Modo revisión")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Validado" }));

    rerender(
      <ProgrammingActionBar
        {...baseProps}
        isReadOnly
        isSubmitting
        reviewMode
        reviewComment="Observación"
        onReviewCommentChange={vi.fn()}
        onSubmitReview={onSubmitReview}
        latestReviewLabel="Validado · Revisor"
      />
    );

    rerender(
      <ProgrammingActionBar
        {...baseProps}
        isReadOnly
        reviewMode
        reviewComment="Observación"
        onReviewCommentChange={vi.fn()}
        onSubmitReview={onSubmitReview}
        latestReviewLabel="Validado · Revisor"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Arreglar" }));
    expect(screen.getByText("Solicitar corrección")).toBeInTheDocument();
    expect(onSubmitReview).toHaveBeenNthCalledWith(1, "validated");
    expect(onSubmitReview).toHaveBeenCalledTimes(1);
  });

  it("mantiene acciones de edición y revisión juntas para admin", () => {
    render(
      <ProgrammingActionBar
        {...baseProps}
        reviewMode
        reviewComment="Observación"
        onReviewCommentChange={vi.fn()}
        onSubmitReview={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Guardar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Validado" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Arreglar" })).toBeInTheDocument();
  });

  it("no envía la devolución al cancelar el modal de Arreglar", () => {
    const onSubmitReview = vi.fn();
    render(
      <ProgrammingActionBar
        {...baseProps}
        isReadOnly
        reviewMode
        reviewComment="Observación pendiente"
        onReviewCommentChange={vi.fn()}
        onSubmitReview={onSubmitReview}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Arreglar" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Cancelar" })[1]);

    expect(screen.queryByText("Solicitar corrección")).not.toBeInTheDocument();
    expect(onSubmitReview).not.toHaveBeenCalled();
  });

  it("envía Arreglar solo al confirmar con motivo", () => {
    const onSubmitReview = vi.fn();
    const onReviewCommentChange = vi.fn();
    const { rerender } = render(
      <ProgrammingActionBar
        {...baseProps}
        isReadOnly
        reviewMode
        reviewComment=""
        onReviewCommentChange={onReviewCommentChange}
        onSubmitReview={onSubmitReview}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Arreglar" }));
    fireEvent.change(screen.getByLabelText("Motivo de la observación"), {
      target: { value: "Falta justificar la distribución horaria." },
    });

    expect(onReviewCommentChange).toHaveBeenCalledWith("Falta justificar la distribución horaria.");

    rerender(
      <ProgrammingActionBar
        {...baseProps}
        isReadOnly
        reviewMode
        reviewComment="Falta justificar la distribución horaria."
        onReviewCommentChange={onReviewCommentChange}
        onSubmitReview={onSubmitReview}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Confirmar Arreglar" }));

    expect(onSubmitReview).toHaveBeenCalledWith("fix_required", "Falta justificar la distribución horaria.");
  });

  it("bloquea una segunda acción terminal mientras la primera se procesa", () => {
    const onSubmitReview = vi.fn();
    render(
      <ProgrammingActionBar
        {...baseProps}
        isReadOnly
        reviewMode
        reviewComment="Observación"
        onReviewCommentChange={vi.fn()}
        onSubmitReview={onSubmitReview}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Validado" }));
    fireEvent.click(screen.getByRole("button", { name: "Arreglar" }));

    expect(onSubmitReview).toHaveBeenCalledTimes(1);
    expect(onSubmitReview).toHaveBeenCalledWith("validated");
  });

  it("oculta acciones terminales cuando la revisión no está disponible", () => {
    render(
      <ProgrammingActionBar
        {...baseProps}
        isReadOnly
        reviewMode
        canSubmitReview={false}
        reviewComment="Observación"
        onReviewCommentChange={vi.fn()}
        onSubmitReview={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: "Validado" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Arreglar" })).not.toBeInTheDocument();
    expect(screen.getByText("Modo revisión")).toBeInTheDocument();
  });

  it("muestra la leyenda de correcciones y abre el historial", () => {
    render(
      <ProgrammingActionBar
        {...baseProps}
        isReadOnly
        reviewMode
        correctionHistory={[
          {
            id: 1,
            programming_id: 10,
            action: "fix_required",
            comment: "Falta justificar la distribución horaria.",
            reviewed_by_id: 5,
            reviewed_by_name: "Rita Revisor",
            reviewed_at: "2026-04-10T15:30:00Z",
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "1 Correcciones" }));

    expect(screen.getByText("Historial de correcciones")).toBeInTheDocument();
    expect(screen.getByText("Falta justificar la distribución horaria.")).toBeInTheDocument();
    expect(screen.getByText(/Rita Revisor/i)).toBeInTheDocument();
  });

  it("mantiene visible el historial de correcciones fuera del modo revisión", () => {
    render(
      <ProgrammingActionBar
        {...baseProps}
        correctionHistory={[
          {
            id: 1,
            programming_id: 10,
            action: "fix_required",
            comment: "Corregir jornada.",
            reviewed_by_id: 5,
            reviewed_by_name: "Rita Revisor",
            reviewed_at: "2026-04-10T15:30:00Z",
          },
        ]}
      />
    );

    expect(screen.getByText("Correcciones de revisión")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1 Correcciones" })).toBeInTheDocument();
  });
});
