/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { attendanceService } from "@/services/attendanceService";
import { siteService } from "@/services/siteService";
import { workerService } from "@/services/workerService";
import {
  Download,
  Loader2,
  Calendar,
  Trash2,
} from "lucide-react";
import { CustomPagination } from "@/components/CustomPagination";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import {
  AttendanceRecord,
  downloadAllTimesheetsAsZip,
  SalaryRecord, // ← Now works!
} from "@/utils/generateAllTimesheetsZip";

interface Worker {
  _id: string;
  firstName: string;
  lastName: string;
  employeeNo: string;
}

interface Site {
  _id: string;
  siteRefName: string;
}

interface DailyRecord {
  _id: string;
  worker: {
    _id: string;
    firstName: string;
    lastName: string;
    employeeNo: string;
  };
  site?: { _id: string; siteRefName: string };
  status: number;
  workingHours: number;
  otHours: number;
  details: {
    _id: string;
    siteName: string;
    workingHours: number;
    otHours: number;
    isRamzan?: boolean;
  }[];
}

interface PaginationData {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  hasNext: boolean;
  hasPrev: boolean;
  limit: number;
}

interface AttendanceResponse {
  records: DailyRecord[];
  pagination: PaginationData;
}

export default function DailyAttendance() {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    worker: "",
    site: "",
    date: today,
    status: "1",
    workingHours: "8",
    otHours: "0",
    isRamzan: false,
  });

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  const [exportMonth, setExportMonth] = useState(
    String(new Date().getMonth() + 1).padStart(2, "0")
  );
  const [exportYear, setExportYear] = useState(
    String(new Date().getFullYear())
  );

  // Fetch workers & sites
  const { data: workers = [], isLoading: loadingWorkers } = useQuery<Worker[]>({
    queryKey: ["workers"],
    queryFn: () =>
      workerService.getAll({ limit: 1000 }).then((r) => r.data || r || []),
    staleTime: 5 * 60 * 1000,
  });

  const { data: sites = [], isLoading: loadingSites } = useQuery<Site[]>({
    queryKey: ["sites"],
    queryFn: () =>
      siteService.getAll({ limit: 1000 }).then((r) => r.sites || r || []),
    staleTime: 5 * 60 * 1000,
  });

  // Paginated attendance
  const {
    data: response,
    isLoading: loadingRecords,
    isFetching,
  } = useQuery<AttendanceResponse>({
    queryKey: ["daily-attendance", form.date, page],
    queryFn: async () => {
      const data = await attendanceService.getByDate(form.date, page, limit);
      return data as AttendanceResponse;
    },
    placeholderData: (prev) => prev ?? undefined,
  });

  const deleteMutation = useMutation({
    mutationFn: attendanceService.deleteDaily,
    onSuccess: () => {
      toast({ title: "Record deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["daily-attendance"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting record",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this specific site record?")) {
      deleteMutation.mutate(id);
    }
  };

  const records = response?.records || [];
  const pagination = response?.pagination || {
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    hasNext: false,
    hasPrev: false,
  };

  const isLoading = loadingWorkers || loadingSites || loadingRecords;

  const exportMonthlyToExcel = async () => {
    try {
      toast({ title: "Exporting...", description: "Fetching monthly data..." });

      const data = await attendanceService.getMonthly(exportYear, exportMonth);
      const records = data.records || [];

      if (records.length === 0) {
        toast({
          title: "No data",
          description: "No attendance found for this month",
          variant: "destructive",
        });
        return;
      }

      // Group records by worker
      const workersMap = new Map<string, any[]>();

      records.forEach((r: any) => {
        const key = r.worker._id;
        if (!workersMap.has(key)) {
          workersMap.set(key, []);
        }
        workersMap.get(key)!.push({
          Date: new Date(r.date).toLocaleDateString("en-GB"),
          Day: new Date(r.date).toLocaleDateString("en-GB", { weekday: "short" }),
          Site: r.site.siteRefName,
          "Day Type": r.isRamzan ? "Ramzan" : "Normal",
          Status:
            r.status === 1
              ? "Full Day"
              : r.status === 0.5
                ? "Half Day"
                : r.status === 2
                  ? "Holiday"
                  : "Absent",
          Hours: r.workingHours,
          OT: r.otHours || 0,
        });
      });

      // Create workbook
      const wb = XLSX.utils.book_new();

      // Calculate expected workdays for this month
      const yearNum = Number(exportYear);
      const monthNum = Number(exportMonth);
      const daysInMonth = new Date(Date.UTC(yearNum, monthNum, 0)).getUTCDate();
      let sundaysInMonth = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(Date.UTC(yearNum, monthNum - 1, d));
        if (date.getUTCDay() === 0) {
          sundaysInMonth++;
        }
      }
      const expectedWorkdays = daysInMonth - sundaysInMonth;

      // Summary sheet (optional — shows total days, OT, etc.)
      const summaryData = Array.from(workersMap.entries()).map(([workerId, days]) => {
        const worker = records.find((r: any) => r.worker._id === workerId)?.worker;
        const presentDays = days.filter(d => {
          const parts = d.Date.split('/');
          const dDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
          const isSun = dDate.getDay() === 0;
          return !isSun && (d.Status === "Full Day" || d.Status === "Half Day" || d.Status === "Holiday");
        }).length;
        const totalOT = days.reduce((sum, d) => sum + d.OT, 0);

        return {
          "Employee No": worker.employeeNo,
          "Worker Name": `${worker.firstName} ${worker.lastName}`,
          "Present Days": presentDays,
          "Absent Days": Math.max(0, expectedWorkdays - presentDays),
          "Total OT Hours": totalOT,
        };
      });

      const summaryWS = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summaryWS, "Summary");

      // One sheet per worker
      workersMap.forEach((days, workerId) => {
        const worker = records.find((r: any) => r.worker._id === workerId)?.worker;
        const workerName = `${worker.employeeNo}_${worker.firstName}_${worker.lastName}`.replace(/[^a-zA-Z0-9]/g, "_");

        // Add header row
        const sheetData = [
          [`Monthly Attendance — ${worker.firstName} ${worker.lastName} (${worker.employeeNo})`],
          [], // empty row
          ["Date", "Day", "Site", "Day Type", "Status", "Hours", "OT"],
          ...days.map(d => [d.Date, d.Day, d.Site, d["Day Type"], d.Status, d.Hours, d.OT]),
        ];

        const ws = XLSX.utils.aoa_to_sheet(sheetData);

        // Style header
        ws["A1"].s = { font: { bold: true, sz: 14 }, alignment: { horizontal: "center" } };
        ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }]; // merge A1:G1

        // Auto-size columns
        ws["!cols"] = [
          { wch: 12 },
          { wch: 8 },
          { wch: 30 },
          { wch: 12 },
          { wch: 12 },
          { wch: 10 },
          { wch: 10 },
        ];

        XLSX.utils.book_append_sheet(wb, ws, workerName.slice(0, 31)); // Excel tab name max 31 chars
      });

      // Generate file
      const fileName = `Monthly_Attendance_${exportYear}-${exportMonth}.xlsx`;
      const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      saveAs(new Blob([excelBuffer]), fileName);

      toast({
        title: "Success!",
        description: `${workersMap.size} worker tabs + Summary exported`,
      });
    } catch (err) {
      console.error(err);
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  // Download all timesheets (ZIP of PDFs)
  const downloadAllTimesheets = async () => {
    try {
      toast({ title: "Preparing ZIP...", description: "Fetching records..." });
      const data = await attendanceService.getMonthly(exportYear, exportMonth);
      const monthlyRecords = data.records || [];
      if (monthlyRecords.length === 0) {
        toast({ title: "No Data", description: "No attendance found for this month", variant: "destructive" });
        return;
      }

      // Group by worker id, create SalaryRecord[] required by generator
      const grouped = new Map<string, AttendanceRecord[]>();
      monthlyRecords.forEach((r: any) => {
        const key = r.worker._id;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push({
          date: r.date,
          status: r.status,
          workingHours: r.workingHours,
          otHours: r.otHours,
          site: r.site,
        });
      });

      const salaryRecords: SalaryRecord[] = [];
      grouped.forEach((attendanceArr, workerId) => {
        const worker = monthlyRecords.find((m: any) => m.worker._id === workerId)?.worker;
        // If you have salary fields in your DB, replace 0's with actual values
        salaryRecords.push({
          _id: workerId,
          givenName: worker.firstName,
          surname: worker.lastName,
          employNo: worker.employeeNo,
          basicSalary: 0,
          allowance: 0,
          totalSalary: 0,
          totalOtAed: 0,
          absentDeduction: 0,
          advance: 0,
          totalSalaryPayable: 0,
          perDayAed: 0,
          otAedPerHrNormal: 0,
          otAedPerHrSunday: 0,
          attendance: attendanceArr,
        });
      });

      // Build month strings
      const monthDisplay = `${new Date(Number(exportYear), Number(exportMonth) - 1).toLocaleString("en-GB", { month: "long" })} ${exportYear}`;
      const monthValue = `${exportYear}-${exportMonth}`;

      await downloadAllTimesheetsAsZip(salaryRecords, monthDisplay, monthValue);

      toast({ title: "ZIP Ready!", description: "All worker timesheets downloaded" });
    } catch (err) {
      console.error(err);
      toast({ title: "ZIP Failed", description: "Please try again", variant: "destructive" });
    }
  };



  // Export to Excel — fetches ALL records (not just current page)
  const exportToExcel = async () => {
    try {
      toast({
        title: "Preparing export...",
        description: "Fetching all records",
      });

      // Fetch all pages
      let allGrouped: any[] = [];
      let currentPage = 1;
      let hasMore = true;

      while (hasMore) {
        const res = await attendanceService.getByDate(
          form.date,
          currentPage,
          100
        );
        allGrouped = [...allGrouped, ...(res.records || [])];
        hasMore = res.pagination?.hasNext || false;
        currentPage++;
      }

      // Flatten grouped details into separate physical records for Excel
      const allRecords = allGrouped.flatMap(g =>
        g.details.map((d: any) => ({
          worker: g.worker,
          site: { siteRefName: d.siteName },
          status: g.status,
          workingHours: d.workingHours,
          otHours: d.otHours,
          isRamzan: d.isRamzan
        }))
      );

      if (allRecords.length === 0) {
        toast({ title: "Nothing to export", variant: "destructive" });
        return;
      }

      // Format data for Excel
      const excelData = allRecords.map((r) => ({
        "Employee No": r.worker.employeeNo,
        "Worker Name": `${r.worker.firstName} ${r.worker.lastName}`,
        Site: r.site.siteRefName,
        "Day Type": r.isRamzan ? "Ramzan" : "Normal",
        Status:
          r.status === 1
            ? "Full Day"
            : r.status === 0.5
              ? "Half Day"
              : r.status === 2
                ? "Holiday"
                : "Absent",
        "Working Hours": r.workingHours,
        "OT Hours": r.otHours || 0,
      }));

      // Create workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Auto-size columns
      const colWidths = [
        { wch: 15 }, // Employee No
        { wch: 25 }, // Worker Name
        { wch: 30 }, // Site
        { wch: 12 }, // Day Type
        { wch: 12 }, // Status
        { wch: 15 }, // Hours
        { wch: 12 }, // OT
      ];
      ws["!cols"] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, "Attendance");

      // Generate file
      const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const fileName = `Daily_Attendance_${form.date}.xlsx`;
      const blob = new Blob([excelBuffer], {
        type: "application/octet-stream",
      });
      saveAs(blob, fileName);

      toast({
        title: "Success!",
        description: `${allRecords.length} records exported to Excel`,
      });
    } catch (err) {
      toast({
        title: "Export failed",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  // Save mutation
  const mutation = useMutation({
    mutationFn: attendanceService.upsertDaily,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["daily-attendance", form.date],
      });
      toast({ title: "Saved!", description: "Attendance recorded" });
      setForm((prev) => ({
        ...prev,
        worker: "",
        workingHours: prev.isRamzan ? "6" : "8",
        otHours: "0",
      }));
      setPage(1);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.worker || !form.site) {
      toast({
        title: "Error",
        description: "Select worker & site",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate({
      worker: form.worker,
      site: form.site,
      date: form.date,
      status: Number(form.status),
      workingHours: Number(form.workingHours),
      otHours: Number(form.otHours),
      isRamzan: form.isRamzan,
    });
  };



  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-4xl font-bold">Daily Attendance</h1>
          <div className="flex gap-3">
            {/* Existing Daily Export */}
            <Button onClick={exportToExcel} className="gap-2">
              <Download className="h-4 w-4" />
              Export Today
            </Button>

            {/* NEW: Monthly Export */}
            <div className="flex items-center gap-3 border rounded-lg p-3 bg-card">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <Select value={exportMonth} onValueChange={setExportMonth}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "Jan",
                    "Feb",
                    "Mar",
                    "Apr",
                    "May",
                    "Jun",
                    "Jul",
                    "Aug",
                    "Sep",
                    "Oct",
                    "Nov",
                    "Dec",
                  ].map((m, i) => (
                    <SelectItem
                      key={i + 1}
                      value={String(i + 1).padStart(2, "0")}
                    >
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={exportYear} onValueChange={setExportYear}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2025, 2024, 2023, 2022, 2021].map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={exportMonthlyToExcel} className="gap-2">
                <Download className="h-4 w-4" />
                Export Month
              </Button>
              <Button onClick={downloadAllTimesheets} className="flex items-center gap-2">
                <Download size={18} /> Download All Timesheets (ZIP)
              </Button>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Form */}
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Mark Attendance</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => {
                      setForm({ ...form, date: e.target.value });
                      setPage(1);
                    }}
                  />
                </div>

                <div className="flex items-center space-x-2 border rounded-md p-3 bg-muted/30">
                  <input
                    type="checkbox"
                    id="isRamzan"
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    checked={form.isRamzan}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setForm(prev => ({
                         ...prev, 
                         isRamzan: checked,
                         workingHours: checked && prev.status === "1" ? "6" : (!checked && prev.status === "1" ? "8" : prev.workingHours),
                         status: checked && prev.status === "0.5" ? "1" : prev.status
                      }));
                    }}
                  />
                  <Label htmlFor="isRamzan" className="font-semibold cursor-pointer">Ramzan Day (Normal Hours: 6)</Label>
                </div>

                <div>
                  <Label>Site</Label>
                  <Select
                    value={form.site}
                    onValueChange={(v) => setForm({ ...form, site: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select site" />
                    </SelectTrigger>
                    <SelectContent>
                      {sites.filter((s: any) => s.isActive !== false).map((s) => (
                        <SelectItem key={s._id} value={s._id}>
                          {s.siteRefName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Worker</Label>
                  <Select
                    value={form.worker}
                    onValueChange={(v) => setForm({ ...form, worker: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select worker" />
                    </SelectTrigger>
                    <SelectContent>
                      {workers.filter((w: any) => w.isActive !== false).map((w) => (
                        <SelectItem key={w._id} value={w._id}>
                          {w.firstName} {w.lastName} ({w.employeeNo})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => {
                      setForm((prev) => ({
                        ...prev,
                        status: v,
                        workingHours:
                          v === "0"
                            ? "0"
                            : v === "0.5"
                              ? "4"
                              : v === "1"
                                ? (prev.isRamzan ? "6" : "8")
                                : v === "2"
                                  ? (prev.isRamzan ? "6" : "8")
                                  : prev.workingHours,
                        otHours: (v === "0" || v === "2") ? "0" : prev.otHours,
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Absent</SelectItem>
                      {!form.isRamzan && <SelectItem value="0.5">Half Day</SelectItem>}
                      <SelectItem value="1">Full Day</SelectItem>
                      <SelectItem value="2">Holiday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Working Hours</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    max="12"
                    value={form.workingHours}
                    onChange={(e) =>
                      setForm({ ...form, workingHours: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label>OT Hours (Manual Override)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    value={form.otHours}
                    onChange={(e) =>
                      setForm({ ...form, otHours: e.target.value })
                    }
                  />
                </div>

                <Button
                  className="w-full"
                  disabled={mutation.isPending || isLoading}
                >
                  {mutation.isPending ? "Saving..." : "Save Attendance"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Table + Pagination + Export */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                Records – {new Date(form.date).toLocaleDateString("en-GB")}
                <span className="ml-3 text-sm text-muted-foreground">
                  ({pagination.totalRecords} total)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center h-96">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                  <span className="ml-4 text-xl">Loading Attendance...</span>
                </div>
              ) : records.length === 0 ? (
                <div className="py-32 text-center text-muted-foreground">
                  No attendance recorded for this date
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Worker</TableHead>
                          <TableHead>Site</TableHead>
                          <TableHead>Day Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Hours</TableHead>
                          <TableHead>OT</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {records.map((r) => (
                          <TableRow key={r._id}>
                            <TableCell className="font-medium">
                              {r.worker.firstName} {r.worker.lastName}
                              <span className="text-muted-foreground text-sm ml-1">
                                ({r.worker.employeeNo})
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                {r.details.map((d: any, idx: number) => (
                                  <div key={idx}>{d.siteName}</div>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                {r.details.map((d: any, idx: number) => (
                                  <div key={idx}>
                                    {d.isRamzan ? (
                                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">Ramzan</span>
                                    ) : "Normal"}
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              {r.status === 0
                                ? "Absent"
                                : r.status === 0.5
                                  ? "Half Day"
                                  : r.status === 2
                                    ? "Holiday"
                                    : "Full Day"}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                {r.details.map((d: any, idx: number) => (
                                  <div key={idx}>{d.workingHours}</div>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="text-orange-600 font-medium">
                              <div className="flex flex-col gap-1">
                                {r.details.map((d: any, idx: number) => (
                                  <div key={idx} className="flex items-center h-[24px]">{d.otHours > 0 ? `+${d.otHours}` : "–"}</div>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                {r.details.map((d: any, idx: number) => (
                                  <div key={idx} className="flex items-center justify-center h-[24px]">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-100"
                                      onClick={() => handleDelete(d._id)}
                                      title="Delete Record"
                                    >
                                      <Trash2 size={14} />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {pagination && (
                    <CustomPagination
                      currentPage={pagination.currentPage}
                      totalPages={pagination.totalPages}
                      onPageChange={setPage}
                      limit={limit}
                      onLimitChange={(newLimit) => {
                        setLimit(newLimit);
                        setPage(1);
                      }}
                      totalRecords={pagination.totalRecords}
                      entityName="records"
                    />
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout >
  );
}
