import { api } from "@/lib/api";

interface FetchOptions {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  order?: string;
  status?: string;
}

export interface Advance {
  _id: string;
  amount: number;
  dateGiven: string;
  status: "pending" | "deducted";
  createdAt: string;
}

export const workerService = {
  getAll: async (options: FetchOptions = {}) => {
    const params = new URLSearchParams();
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, value.toString());
    });
    const response = await api(`workers?${params.toString()}`);
    return response.json();
  },

  create: async (data: unknown) => {
    const response = await api("workers", { method: "POST", body: JSON.stringify(data) });
    return response.json();
  },

  update: async (id: string, data: unknown) => {
    const response = await api(`workers/${id}`, { method: "PUT", body: JSON.stringify(data) });
    return response.json();
  },

  getAdvances: async (workerId: string): Promise<Advance[]> => {
    const response = await api(`advances/${workerId}`);
    const data = await response.json();
    return data.advances || data || [];
  },

  addAdvance: async (
    workerId: string,
    payload: { amount: number; dateGiven: string; notes?: string }
  ): Promise<{ advance: Advance }> => {
    const response = await api("advances", {
      method: "POST",
      body: JSON.stringify({ workerId, ...payload }),
    });
    return response.json();
  },

  deleteAdvance: async (advanceId: string): Promise<void> => {
    await api(`advances/${advanceId}`, { method: "DELETE" });
  },

  delete: async (id: string) => {
    const response = await api(`workers/${id}`, { method: "DELETE" });
    return response.json();
  },
};