import { describe, expect, it } from "vitest";

import { buildProgrammingPayload } from "./programmingPersistence";

describe("buildProgrammingPayload", () => {
  it("sends null dismiss metadata when clearing an active partial commission", () => {
    const payload = buildProgrammingPayload({
      funcionarioId: 1,
      periodId: 2,
      observations: "Sin observaciones",
      assignedGroupId: "none",
      pendingStatus: "Activo",
      dismissReasonId: null,
      dismissSuboptionId: null,
      dismissPartialHours: "",
      clearPartialCommission: true,
      prais: "No",
      globalSpecialty: "Urgencia",
      selectedProcess: "Apoyo",
      selectedPerformanceUnit: "Unidad",
      timeUnit: "hours",
      activityEntries: [],
      activitiesList: [],
    });

    expect(payload).toEqual({
      programming: expect.objectContaining({
        assigned_status: "Activo",
        dismiss_reason_id: null,
        dismiss_suboption_id: null,
        dismiss_partial_hours: null,
      }),
    });
  });

  it("persists rows with assigned hours below 1 when using comma decimals", () => {
    const payload = buildProgrammingPayload({
      funcionarioId: 1,
      periodId: 2,
      observations: "",
      assignedGroupId: "none",
      pendingStatus: "Activo",
      prais: "No",
      globalSpecialty: "Urgencia",
      selectedProcess: "Apoyo",
      selectedPerformanceUnit: "Unidad",
      timeUnit: "hours",
      activityEntries: [
        {
          id: 1,
          activity: "Consulta",
          specialty: "Urgencia",
          assignedHours: "0,5",
          performance: "1,5",
        },
      ],
      activitiesList: [
        {
          id: 99,
          name: "Consulta",
          visible: "SI",
          req_rendimiento: "SI",
        },
      ],
    });

    expect(payload.programming).toEqual(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            assigned_hours: 0.5,
            performance: 1.5,
          }),
        ],
      }),
    );
  });
});
