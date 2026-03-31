import { buildApiUrl, fetchWithAuth, parseErrorDetail, parseJsonResponse } from "./api";

export interface ContextualHelpSection {
  id: number;
  position: number;
  title: string;
  content: string;
}

export interface ContextualHelpPage {
  id: number;
  slug: string;
  page_name: string;
  description?: string | null;
  updated_at?: string | null;
  updated_by_id?: number | null;
  updated_by_name?: string | null;
  sections: ContextualHelpSection[];
}

export interface ContextualHelpPageUpsert {
  page_name: string;
  description: string;
  sections: Array<{
    title: string;
    content: string;
  }>;
}

async function parseContextualHelpResponse(response: Response, fallbackMessage: string): Promise<ContextualHelpPage> {
  if (!response.ok) {
    throw new Error(await parseErrorDetail(response, fallbackMessage));
  }

  return parseJsonResponse<ContextualHelpPage>(response);
}

export const contextualHelpApi = {
  async getBySlug(slug: string): Promise<ContextualHelpPage> {
    const response = await fetchWithAuth(buildApiUrl(`/contextual-help/${slug}`));
    return parseContextualHelpResponse(response, "No se pudo cargar la ayuda contextual.");
  },

  async list(): Promise<ContextualHelpPage[]> {
    const response = await fetchWithAuth(buildApiUrl("/contextual-help"));
    if (!response.ok) {
      throw new Error(await parseErrorDetail(response, "No se pudo cargar la lista de ayudas contextuales."));
    }

    return parseJsonResponse<ContextualHelpPage[]>(response);
  },

  async upsert(slug: string, payload: ContextualHelpPageUpsert): Promise<ContextualHelpPage> {
    const response = await fetchWithAuth(buildApiUrl(`/contextual-help/${slug}`), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    return parseContextualHelpResponse(response, "No se pudo guardar la ayuda contextual.");
  },
};
