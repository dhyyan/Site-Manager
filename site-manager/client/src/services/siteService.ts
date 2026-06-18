// services/siteService.ts
import { api } from "@/lib/api";

export const siteService = {
  getAll: async ({
    page = 1,
    limit = 10,
    search = "",
    sort = "createdAt",
    order = "desc",
  }: {
    page?: number;
    limit?: number;
    search?: string;
    sort?: string;
    order?: "asc" | "desc";
  } = {}) => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(search && { search }),
      sort,
      order,
    });

    const res = await api(`sites?${params.toString()}`);
    if (!res.ok) throw new Error("Failed to fetch sites");
    return res.json();
  },

  create: async (data: unknown) => {
    const res = await api("sites", {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create site');
    return res.json();
  },

  update: async (id: string, data: unknown) => {
    const res = await api(`sites/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update site');
    return res.json();
  },

  delete: async (id: string) => {
    const res = await api(`sites/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete site');
    return res.json();
  },
  getStats: async (id: string, start: string, end: string) => {
    const params = new URLSearchParams({ start, end });
    const res = await api(`sites/${id}/stats?${params.toString()}`);
    if (!res.ok) throw new Error("Failed to fetch site stats");
    return res.json();
  },
};