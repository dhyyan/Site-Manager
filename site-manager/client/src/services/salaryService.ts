import { SalaryRecord, SalaryResponse } from '@/types';
import { api } from "@/lib/api";

export const salaryService = {
  getReport: async (month: string): Promise<SalaryResponse> => {
    const res = await api(`salary?month=${month}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.msg || 'Failed to fetch salary report');
    }
    return res.json();
  },
  saveSalary: async (
    month: string,
    workerId: string,
    wpsAmount: number,
    cashAmount: number,
    advanceDeduction?: number,
    otherDeduction?: number
  ) => {
    const res = await api(`salary/wps`, {
      method: 'POST',
      body: JSON.stringify({
        month,
        workerId,
        wpsAmount,
        cashAmount,
        advanceDeduction,
        otherDeduction
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.msg || 'Failed to save Salary');
    }
    return res.json();
  }
};