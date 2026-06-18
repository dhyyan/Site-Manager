/* eslint-disable @typescript-eslint/no-explicit-any */
import { api } from "@/lib/api";

export const attendanceService = {
  // Daily Attendance - Create / Update
  upsertDaily: async (data: any) => {
    const res = await api("attendance/daily", {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.msg || "Failed to save attendance");
    }
    return res.json();
  },

  // Get attendance by date with pagination
  getByDate: async (date: string, page = 1, limit = 50) => {
    const res = await api(`attendance/daily/${date}?page=${page}&limit=${limit}`);
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.msg || "Failed to load records");
    }
    return res.json(); // Returns { records: [...], pagination: { ... } }
  },

  deleteDaily: async (id: string) => {
    const res = await api(`attendance/daily/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.msg || "Failed to delete record");
    }
    return res.json();
  },

  getMonthly: async (year: string, month: string) => {
    const res = await api(`attendance/monthly?year=${year}&month=${month}`);
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.msg || "Failed to load monthly attendance");
    }
    return res.json(); // { records: [...], total: number }
  },

  // Optional: Get range (monthly) - keep if you use it elsewhere
  getRange: async (start: string, end: string) => {
    const res = await api(`attendance/range?start=${start}&end=${end}`);
    if (!res.ok) throw new Error("Failed to load range");
    return res.json();
  },

  getAllocationReport: async (start: string, end: string) => {
    const res = await api(`attendance/allocation-report?start=${start}&end=${end}`);
    if (!res.ok) throw new Error("Failed to load allocation report");
    return res.json();
  },

  // Legacy - keep only if still used elsewhere
  getAll: async (month?: string) => {
    const url = month ? `attendance/monthly/${month}` : "attendance/monthly";
    const res = await api(url);
    if (!res.ok) throw new Error("Failed");
    return res.json();
  },

  create: async (data: unknown) => {
    const res = await api("attendance", { method: "POST", body: JSON.stringify(data) });
    if (!res.ok) throw new Error("Failed");
    return res.json();
  },
};