import { fetchWithAuth, parseErrorDetail } from "./api";

export type DismissActionType = "dismiss" | "hide";
export type DismissReasonCategory = "resignation" | "mobility" | "other";
export type DismissReasonSystemKey = "comision-servicio";
export type DismissSuboptionSystemKey = "total" | "parcial";

export interface DismissReasonSuboption {
  id: number;
  system_key: string | null;
  name: string;
  description: string;
  sort_order: number;
}

export function isPartialCommissionSelection(reason?: DismissReason | null, suboptionId?: number | null): boolean {
  if (!reason || suboptionId == null) {
    return false;
  }

  const normalizedReasonKey = reason.system_key?.trim().toLowerCase() ?? "";
  const normalizedReason = reason.name.trim().toLowerCase();
  const suboption = reason.suboptions.find((item) => item.id === suboptionId) ?? null;
  const normalizedSuboptionKey = suboption?.system_key?.trim().toLowerCase() ?? "";
  const normalizedSuboption = suboption?.name.trim().toLowerCase() ?? "";

  if (normalizedReasonKey === "comision-servicio") {
    return normalizedSuboptionKey === "parcial" || normalizedSuboption === "parcial";
  }

  return (normalizedReason === "comisión de servicio" || normalizedReason === "comision de servicio") && normalizedSuboption === "parcial";
}

export interface DismissReason {
  id: number;
  system_key: string | null;
  name: string;
  description: string;
  action_type: DismissActionType;
  reason_category: DismissReasonCategory;
  sort_order: number;
  is_active: boolean;
  requires_start_date: boolean;
  suboptions: DismissReasonSuboption[];
}

export interface DismissReasonPayload {
  system_key: DismissReasonSystemKey | null;
  name: string;
  description: string;
  action_type: DismissActionType;
  reason_category: DismissReasonCategory;
  sort_order: number;
  is_active: boolean;
  requires_start_date: boolean;
}

export interface DismissSuboptionPayload {
  system_key: DismissSuboptionSystemKey | null;
  name: string;
  description: string;
  sort_order: number;
}

async function parseReasonResponse(response: Response, fallbackMessage: string): Promise<DismissReason> {
  if (!response.ok) {
    throw new Error(await parseErrorDetail(response, fallbackMessage));
  }

  return response.json() as Promise<DismissReason>;
}

export const dismissReasonsApi = {
  async list(activeOnly = true): Promise<DismissReason[]> {
    const response = await fetchWithAuth(`/bajas/reasons?active_only=${activeOnly ? "true" : "false"}`);
    if (!response.ok) {
      throw new Error(await parseErrorDetail(response, "No se pudieron cargar los motivos de baja."));
    }
    return response.json() as Promise<DismissReason[]>;
  },

  create: async (payload: DismissReasonPayload) => parseReasonResponse(
    await fetchWithAuth("/bajas/reasons", { method: "POST", body: JSON.stringify(payload) }),
    "No se pudo crear el motivo de baja.",
  ),

  update: async (reasonId: number, payload: Partial<DismissReasonPayload>) => parseReasonResponse(
    await fetchWithAuth(`/bajas/reasons/${reasonId}`, { method: "PUT", body: JSON.stringify(payload) }),
    "No se pudo actualizar el motivo de baja.",
  ),

  async remove(reasonId: number): Promise<void> {
    const response = await fetchWithAuth(`/bajas/reasons/${reasonId}`, { method: "DELETE" });
    if (!response.ok) {
      throw new Error(await parseErrorDetail(response, "No se pudo eliminar el motivo de baja."));
    }
  },

  addSuboption: async (reasonId: number, payload: DismissSuboptionPayload) => parseReasonResponse(
    await fetchWithAuth(`/bajas/reasons/${reasonId}/suboptions`, { method: "POST", body: JSON.stringify(payload) }),
    "No se pudo crear la subopción.",
  ),

  updateSuboption: async (suboptionId: number, payload: Partial<DismissSuboptionPayload>) => parseReasonResponse(
    await fetchWithAuth(`/bajas/suboptions/${suboptionId}`, { method: "PUT", body: JSON.stringify(payload) }),
    "No se pudo actualizar la subopción.",
  ),

  deleteSuboption: async (suboptionId: number) => parseReasonResponse(
    await fetchWithAuth(`/bajas/suboptions/${suboptionId}`, { method: "DELETE" }),
    "No se pudo eliminar la subopción.",
  ),
};
