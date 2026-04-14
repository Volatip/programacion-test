import { describe, expect, it } from "vitest";

import {
  buildHeaderInfoBarPlainText,
  getHeaderInfoBarCountdownDays,
  parseHeaderInfoBarConfig,
  serializeHeaderInfoBarConfig,
} from "./headerInfoBar";

describe("headerInfoBar helpers", () => {
  it("mantiene compatibilidad con texto plano legado", () => {
    const result = parseHeaderInfoBarConfig("  Bienvenidos a Programación  ");

    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]).toMatchObject({
      text: "Bienvenidos a Programación",
      color: "default",
    });
    expect(result.countdown).toBeNull();
  });

  it("serializa el nuevo shape con segmentos y contador saneados", () => {
    const serialized = serializeHeaderInfoBarConfig({
      version: 1,
      segments: [
        { id: "1", text: "  ¡Bienvenido! ", color: "default" },
        { id: "2", text: " Plataforma renovada ", color: "emerald" },
      ],
      countdown: {
        enabled: true,
        targetDate: "2026-04-20",
        prefix: " Quedan ",
        suffix: " días para cerrar ",
        color: "amber",
      },
    });

    expect(JSON.parse(serialized)).toEqual({
      version: 1,
      segments: [
        { id: "1", text: "¡Bienvenido!", color: "default" },
        { id: "2", text: "Plataforma renovada", color: "emerald" },
      ],
      countdown: {
        enabled: true,
        targetDate: "2026-04-20",
        prefix: "Quedan",
        suffix: "días para cerrar",
        color: "amber",
      },
    });
  });

  it("genera el texto plano con contador calculado", () => {
    const config = parseHeaderInfoBarConfig(JSON.stringify({
      segments: [
        { id: "1", text: "¡Bienvenido a Programación!", color: "default" },
        { id: "2", text: "Nueva plataforma", color: "violet" },
      ],
      countdown: {
        enabled: true,
        targetDate: "2026-04-18",
        prefix: "Quedan",
        suffix: "días para terminar el proceso!",
        color: "amber",
      },
    }));

    expect(getHeaderInfoBarCountdownDays("2026-04-18", new Date("2026-04-14T12:00:00"))).toBe(4);
    expect(buildHeaderInfoBarPlainText(config, new Date("2026-04-14T12:00:00"))).toBe(
      "¡Bienvenido a Programación! Nueva plataforma Quedan 4 días para terminar el proceso!"
    );
  });
});
