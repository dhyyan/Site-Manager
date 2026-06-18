export interface Worker {
  _id: string;
  firstName: string;
  lastName: string;
  employeeNo: string;
  designation?: string;
  basicSalary: number;
  allowance: number;
  companyName?: string;
}

export interface Advance {
  _id: string;
  worker: string | Worker;
  amount: number;
  dateGiven: string;
  notes?: string;
  status: 'pending' | 'deducted';
  deductedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Site {
  _id: string;
  siteRefName: string;
  clientName: string;
  location: string;
}

export interface AttendanceRecord {
  _id: string;
  worker: Pick<Worker, '_id' | 'firstName' | 'lastName' | 'employeeNo'>;
  site: Pick<Site, '_id' | 'siteRefName'>;
  workingDays: number;
  otHours: number;
  absentDays: number;
  month: string;
}

export interface SalaryRecord {
  _id: string;
  givenName: string;
  surname: string;
  employNo: string;
  designation?: string;
  companyName?: string;
  basicSalary: number;
  allowance: number;
  totalSalary: number;
  totalHrInclOT: number;
  normalHrExcOT: number;
  normalOtHr: number;
  sundayOtHr: number;
  absent: number;
  otAedPerHrNormal: number;
  otAedPerHrSunday: number;
  totalOtAed: number;
  perDayAed: number;
  absentDeduction: number;
  advance: number;
  otherDeduction?: number; // Medical Bill/Petty Cash
  deductedAdvances?: Array<{
    advanceId: string;
    amount: number;
    dateGiven: string;
    notes?: string;
  }>;
  advancePending?: number;
  wps?: number;
  cash?: number;
  prevPending: number;
  currentEarnings?: number; // Gross Earnings (Net before Advance)
  pending: number;
  totalSalaryPayable: number;
}

export interface SalaryResponse {
  month: string;
  records: SalaryRecord[];
  totals: {
    totalBasicSalary: number;
    totalAllowance: number;
    totalSalary: number;
    totalOtAed: number;
    totalCurrentEarnings?: number;
    totalAbsentDeduction: number;
    totalAdvanceDeduction: number;
    totalOtherDeduction?: number;
    totalAdvancePending?: number;
    totalPrevPending: number;
    totalWps?: number;
    totalCash?: number;
    totalPending: number;
    totalPayroll: number;
  };
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalRecords: number;
    limit: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}