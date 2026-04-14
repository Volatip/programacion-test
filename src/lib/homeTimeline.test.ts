import { describe, expect, it } from "vitest";

import {
  DEFAULT_HOME_TIMELINE_SECTION,
  parseTimelineConfig,
  serializeTimelineConfig,
} from "./homeTimeline";

describe("homeTimeline", () => {
  it("tolera el shape legado basado en arreglo y aplica cabecera por defecto", () => {
    const result = parseTimelineConfig(
      JSON.stringify([{ id: "1", title: "Carga base", date: "Abr 2026", description: "Datos iniciales", color: "indigo" }])
    );

    expect(result.section).toEqual(DEFAULT_HOME_TIMELINE_SECTION);
    expect(result.milestones).toHaveLength(1);
    expect(result.milestones[0]).toMatchObject({
      title: "Carga base",
      date: "Abr 2026",
    });
  });

  it("serializa el nuevo shape con sección editable y hitos saneados", () => {
    const serialized = serializeTimelineConfig({
      section: {
        title: "  Timeline principal ",
        subtitle: "  Hitos operativos ",
        description: "  Resumen del flujo ",
        showTitle: true,
        showSubtitle: true,
        showDescription: true,
      },
      milestones: [
        {
          id: "1",
          title: "  Carga final  ",
          date: "  Mayo 2026 ",
          description: "  Datos listos ",
          color: "indigo",
          isActive: false,
        },
      ],
    });

    expect(JSON.parse(serialized)).toEqual({
      section: {
        title: "Timeline principal",
        subtitle: "Hitos operativos",
        description: "Resumen del flujo",
        showTitle: true,
        showSubtitle: true,
        showDescription: true,
      },
      milestones: [
        {
          id: "1",
          title: "Carga final",
          date: "Mayo 2026",
          description: "Datos listos",
          color: "indigo",
          isActive: false,
        },
      ],
    });
  });
});
