export interface SalaryRecord {
  id: string;
  givenName: string;
  surname: string;
  employNo: string;
  basicSalary: number;
  allowance: number;
  totalSalary: number;
  totalHrInclOT: number;
  normalHrExcOT: number;
  otHr: number;
  absent: number;
  otAedPerHr: number;
  totalOtAed: number;
  perDayAed: number;
  absentDeduction: number;
  advance: number;
  totalSalaryPayable: number;
}

export interface SalaryCalculationRequest {
  employeeId: string;
  givenName: string;
  surname: string;
  employNo: string;
  month: string; 
  basicSalary: number;
  allowance: number;
  totalHrInclOT: number;
  normalHrExcOT: number;
  absent: number;
  advance: number;
}

export interface SalaryTotals {
  totalBasicSalary: number;
  totalAllowance: number;
  totalSalary: number;
  totalOtAed: number;
  totalAbsentDeduction: number;
  totalPayroll: number;
}

export interface SalaryCalculationResponse {
  month: string;
  records: SalaryRecord[];
  totals: SalaryTotals;
}
