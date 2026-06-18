import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Loader2, Undo2, Download, Calendar } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { siteService } from "@/services/siteService";
import { CustomPagination } from "@/components/CustomPagination";
import writeXlsxFile, { SheetData } from "write-excel-file/browser";
import { saveAs } from "file-saver";
import { attendanceService } from "@/services/attendanceService";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Site {
  _id: string;
  clientName: string;
  siteRefName: string;
  location: string;
  lpoNo?: string;
  lpoStatus: string;
  jobRefNo?: string;
  siteInChargeName: string;
  startDate: string;
  endDate?: string;
  isActive?: boolean;
  createdAt?: string;
}

interface PaginatedResponse {
  sites: Site[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

interface WorkerAllocationReport {
  firstName: string;
  lastName: string;
  employeeNo?: string;
  daysWorked?: number;
  totalHours?: number;
  totalOtHours?: number;
}

interface SiteAllocationReport {
  siteName: string;
  workers: WorkerAllocationReport[];
}

const Sites = () => {
  const queryClient = useQueryClient();

  // State
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(10);

  const [open, setOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);

  const [formData, setFormData] = useState({
    clientName: "",
    siteRefName: "",
    location: "",
    lpoNo: "",
    lpoStatus: "Not Received",
    jobRefNo: "",
    siteInChargeName: "",
    startDate: "",
    endDate: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const [reportStart, setReportStart] = useState("");
  const [reportEnd, setReportEnd] = useState("");
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const generateAllocationReport = async () => {
    if (!reportStart || !reportEnd) {
      toast({ title: "Error", description: "Please select start and end dates", variant: "destructive" });
      return;
    }
    try {
      setIsGeneratingReport(true);
      toast({ title: "Generating report..." });

      const sitesReport: SiteAllocationReport[] = await attendanceService.getAllocationReport(reportStart, reportEnd);
      if (!sitesReport || sitesReport.length === 0) {
        toast({ title: "No data", description: "No sites found for this period", variant: "destructive" });
        return;
      }

      const fmtDate = (d: string) =>
        new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      const periodLabel = `${fmtDate(reportStart)}  to  ${fmtDate(reportEnd)}`;

      // ── Color palette (CSS hex strings, required by write-excel-file)
      const CT = "#1A3A5C"; // Title  – dark navy
      const CP = "#1E5799"; // Period – royal blue
      const CH = "#2980B9"; // Header – steel blue
      const CZ = "#154360"; // Total  – deep navy
      const CO = "#EBF5FB"; // Odd row – very light blue
      const CW = "#FFFFFF"; // Even row – white
      const CF = "#FFFFFF"; // Foreground text on dark rows
      const CD = "#1C2833"; // Dark text on light rows

      // Cell factory helpers
      // tC / pC: merged title/period cells – span = number of columns
      const tC = (v: string, span: number) => ({ value: v, span, fontWeight: "bold" as const, fontSize: 14, backgroundColor: CT, color: CF, align: "center" as const });
      const pC = (v: string, span: number) => ({ value: v, span, fontWeight: "bold" as const, fontSize: 11, backgroundColor: CP, color: CF, align: "center" as const });
      const hC = (v: string) => ({ value: v, fontWeight: "bold" as const, fontSize: 11, backgroundColor: CH, color: CF, align: "center" as const, borderStyle: "thin" as const });
      const zC = (v: string | number, align: "center" | "left" = "center") => ({
        value: typeof v === "number" ? v : String(v),
        fontWeight: "bold" as const, fontSize: 11, backgroundColor: CZ, color: CF, align,
        topBorderStyle:    "medium" as const, bottomBorderStyle: "medium" as const,
        leftBorderStyle:   "medium" as const, rightBorderStyle:  "medium" as const,
      });
      const dC = (v: string | number, bg: string, align: "center" | "left" = "center") => ({
        value: typeof v === "number" ? v : String(v),
        fontSize: 10, backgroundColor: bg, color: CD, align, borderStyle: "thin" as const,
      });

      // ── Build sheets structure for write-excel-file
      interface ExcelSheet {
        data: SheetData;
        columns?: { width: number }[];
        sheet: string;
      }
      const sheets: ExcelSheet[] = [];

      // ─────────────────────── SUMMARY SHEET ───────────────────────
      let grandWorkers = 0, grandNormal = 0, grandOt = 0;

      const summaryRows: SheetData = [
        [tC("SITE WORKER ALLOCATION REPORT", 6), null, null, null, null, null],
        [pC(`Period: ${periodLabel}`, 6),         null, null, null, null, null],
        [null, null, null, null, null, null],
        [hC("S/No"), hC("Site Name"), hC("Workers Worked"), hC("Total Normal Hrs"), hC("Total OT Hrs"), hC("Total Hrs")],
      ];

      sitesReport.forEach((site: SiteAllocationReport, idx: number) => {
        const workers     = site.workers || [];
        const workerCount = workers.filter((w: WorkerAllocationReport) => (w.daysWorked || 0) > 0).length;
        const siteNormal  = workers.reduce((s: number, w: WorkerAllocationReport) => s + (w.totalHours   || 0), 0);
        const siteOt      = workers.reduce((s: number, w: WorkerAllocationReport) => s + (w.totalOtHours || 0), 0);
        grandWorkers += workerCount;
        grandNormal  += siteNormal;
        grandOt      += siteOt;
        const bg = idx % 2 === 0 ? CO : CW;
        summaryRows.push([
          dC(idx + 1,             bg),
          dC(site.siteName,       bg, "left"),
          dC(workerCount,         bg),
          dC(siteNormal,          bg),
          dC(siteOt,              bg),
          dC(siteNormal + siteOt, bg),
        ]);
      });

      summaryRows.push([null, null, null, null, null, null]);
      summaryRows.push([
        zC(""), zC("GRAND TOTAL"), zC(grandWorkers), zC(grandNormal), zC(grandOt), zC(grandNormal + grandOt),
      ]);

      sheets.push({
        data: summaryRows,
        columns: [{ width: 8 }, { width: 40 }, { width: 18 }, { width: 18 }, { width: 14 }, { width: 14 }],
        sheet: "Summary",
      });

      // ─────────────────────── PER-SITE SHEETS ───────────────────────
      const usedNames = new Set<string>(["Summary"]);

      sitesReport.forEach((site: SiteAllocationReport) => {
        const workersArray: WorkerAllocationReport[] = (site.workers || []).slice().sort(
          (a: WorkerAllocationReport, b: WorkerAllocationReport) => (a.employeeNo || "").localeCompare(b.employeeNo || "")
        );

        let safeName = site.siteName.replace(/[[\]*?/\\:]/g, "_").substring(0, 28);
        if (!safeName) safeName = "Site";
        let sheetName = safeName;
        let n = 1;
        while (usedNames.has(sheetName)) sheetName = `${safeName}_${n++}`;
        usedNames.add(sheetName);

        const siteRows: SheetData = [
          [tC("SITE WORKER ALLOCATION REPORT", 7), null, null, null, null, null, null],
          [pC(`Period: ${periodLabel}`,            7), null, null, null, null, null, null],
          [pC(`Site: ${site.siteName}`,            7), null, null, null, null, null, null],
          [null, null, null, null, null, null, null],
          [hC("S/No"), hC("Worker Name"), hC("Employee No"), hC("Days Worked"), hC("Normal Hrs"), hC("OT Hrs"), hC("Total Hrs")],
        ];

        let tDays = 0, tNormal = 0, tOt = 0, sNo = 1;

        workersArray.forEach((worker: WorkerAllocationReport, idx: number) => {
          const days   = Number(worker.daysWorked   || 0);
          const normal = Number(worker.totalHours   || 0);
          const ot     = Number(worker.totalOtHours || 0);
          const tot    = normal + ot;
          tDays   += days;
          tNormal += normal;
          tOt     += ot;
          const bg = idx % 2 === 0 ? CO : CW;
          siteRows.push([
            dC(sNo++,                                   bg),
            dC(`${worker.firstName} ${worker.lastName}`, bg, "left"),
            dC(worker.employeeNo || "-",                bg),
            dC(days,                                    bg),
            dC(normal,                                  bg),
            dC(ot,                                      bg),
            dC(tot,                                     bg),
          ]);
        });

        siteRows.push([null, null, null, null, null, null, null]);
        siteRows.push([
          zC(""),
          zC(`Total Workers: ${workersArray.length}`, "left"),
          zC(""),
          zC(tDays),
          zC(tNormal),
          zC(tOt),
          zC(tNormal + tOt),
        ]);

        sheets.push({
          data: siteRows,
          columns: [{ width: 8 }, { width: 35 }, { width: 15 }, { width: 14 }, { width: 14 }, { width: 12 }, { width: 12 }],
          sheet: sheetName,
        });
      });

      // ── Write & download ─────────────────────────────────────────────────────
      const blob = await writeXlsxFile(sheets).toBlob();
      const fileName = `Site_Allocation_Report_${reportStart}_to_${reportEnd}.xlsx`;
      saveAs(blob, fileName);

      const activeSites = sitesReport.filter((s: SiteAllocationReport) => (s.workers || []).length > 0).length;
      toast({
        title: "Report Downloaded ✓",
        description: `${activeSites} sites · ${grandWorkers} workers · ${grandNormal + grandOt} total hrs`,
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to generate report", variant: "destructive" });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Fetch Sites - Fixed for TanStack Query v5


  const {
    data = { sites: [], pagination: null },
    isLoading,
    isFetching,
  } = useQuery<PaginatedResponse>({
    queryKey: ["sites", page, search],
    queryFn: () =>
      siteService.getAll({
        page,
        limit,
        search: search.trim(),
        sort: "createdAt",
        order: "desc",
      }),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 30,
  });

  const sites = data.sites;
  const pagination = data.pagination;

  // Mutations
  const createMutation = useMutation({
    mutationFn: siteService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      toast({ title: "Success", description: "Site added successfully" });
      setOpen(false);
      resetForm();
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Failed to create site";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      siteService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      toast({ title: "Success", description: "Site updated successfully" });
      setOpen(false);
      resetForm();
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Failed to update site";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: siteService.delete,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      toast({ title: "Success", description: res?.msg || "Site status updated" });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Failed to delete site";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      clientName: "",
      siteRefName: "",
      location: "",
      lpoNo: "",
      lpoStatus: "Not Received",
      jobRefNo: "",
      siteInChargeName: "",
      startDate: "",
      endDate: "",
    });
    setErrors({});
    setEditingSite(null);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.clientName.trim())
      newErrors.clientName = "Client name is required";
    if (!formData.siteRefName.trim())
      newErrors.siteRefName = "Site reference/name is required";
    if (!formData.location.trim()) newErrors.location = "Location is required";
    if (!formData.startDate) newErrors.startDate = "Start date is required";
    if (!formData.siteInChargeName.trim())
      newErrors.siteInChargeName = "Site in-charge name is required";

    if (!["Received", "Not Received"].includes(formData.lpoStatus.trim())) {
      newErrors.lpoStatus = "LPO status must be 'Received' or 'Not Received'";
    }

    const today = new Date();
    const currentYear = today.getFullYear();
    const minYear = currentYear - 5;
    const minDate = `${minYear}-01-01`;

    if (formData.startDate < minDate) {
      newErrors.startDate = `Start date must be from ${minYear} onwards`;
    }

    if (
      formData.endDate &&
      formData.startDate &&
      formData.endDate <= formData.startDate
    ) {
      newErrors.endDate = "End date must be after start date";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (editingSite) {
      updateMutation.mutate({ id: editingSite._id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (site: Site) => {
    setEditingSite(site);
    setFormData({
      clientName: site.clientName,
      siteRefName: site.siteRefName,
      location: site.location,
      lpoNo: site.lpoNo || "",
      lpoStatus: site.lpoStatus || "Not Received",
      jobRefNo: site.jobRefNo || "",
      siteInChargeName: site.siteInChargeName,
      startDate: site.startDate ? site.startDate.split("T")[0] : "",
      endDate: site.endDate ? site.endDate.split("T")[0] : "",
    });
    setErrors({});
    setOpen(true);
  };

  const handleDelete = (site: Site) => {
    const isInactive = site.isActive === false;
    const action = isInactive ? "unblock" : "delete";
    if (confirm(`Are you sure you want to ${action} this site?`)) {
      deleteMutation.mutate(site._id);
    }
  };

  const openAddDialog = () => {
    resetForm();
    setOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Sites Management</h1>
            <p className="text-muted-foreground">
              Manage your construction sites and projects
            </p>
          </div>

          <div className="flex gap-3 flex-col sm:flex-row w-full sm:w-auto">
            <Input
              placeholder="Search sites..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full sm:w-64"
            />
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={openAddDialog}>
                  <Plus className="w-4 h-4 mr-2" /> Add Site
                </Button>
              </DialogTrigger>

              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingSite ? "Edit Site" : "Add New Site"}
                  </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg text-red-600">
                      Site Details
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* All your form inputs (same as before) */}
                      <div>
                        <Label>Client Name *</Label>
                        <Input
                          value={formData.clientName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              clientName: e.target.value,
                            })
                          }
                          className={errors.clientName ? "border-red-500" : ""}
                        />
                        {errors.clientName && (
                          <p className="text-red-500 text-sm mt-1">
                            {errors.clientName}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label>Site Ref / Name *</Label>
                        <Input
                          value={formData.siteRefName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              siteRefName: e.target.value,
                            })
                          }
                          className={errors.siteRefName ? "border-red-500" : ""}
                        />
                        {errors.siteRefName && (
                          <p className="text-red-500 text-sm mt-1">
                            {errors.siteRefName}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label>Location *</Label>
                        <Input
                          value={formData.location}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              location: e.target.value,
                            })
                          }
                          className={errors.location ? "border-red-500" : ""}
                        />
                        {errors.location && (
                          <p className="text-red-500 text-sm mt-1">
                            {errors.location}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label>LPO No</Label>
                        <Input
                          placeholder=""
                          value={formData.lpoNo}
                          onChange={(e) =>
                            setFormData({ ...formData, lpoNo: e.target.value })
                          }
                          className={errors.lpoNo ? "border-red-500" : ""}
                        />
                        {errors.lpoNo && (
                          <p className="text-red-500 text-sm mt-1">
                            {errors.lpoNo}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label>LPO Status</Label>
                        <Select
                          value={formData.lpoStatus}
                          onValueChange={(value) =>
                            setFormData({
                              ...formData,
                              lpoStatus: value,
                            })
                          }
                        >
                          <SelectTrigger className={errors.lpoStatus ? "border-red-500" : ""}>
                            <SelectValue placeholder="Select LPO Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Received">Received</SelectItem>
                            <SelectItem value="Not Received">Not Received</SelectItem>
                          </SelectContent>
                        </Select>
                        {errors.lpoStatus && (
                          <p className="text-red-500 text-sm mt-1">
                            {errors.lpoStatus}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label>Job Ref No</Label>
                        <Input
                          placeholder=""
                          value={formData.jobRefNo}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              jobRefNo: e.target.value,
                            })
                          }
                          className={errors.jobRefNo ? "border-red-500" : ""}
                        />
                        {errors.jobRefNo && (
                          <p className="text-red-500 text-sm mt-1">
                            {errors.jobRefNo}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label>Site In-Charge Name *</Label>
                        <Input
                          value={formData.siteInChargeName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              siteInChargeName: e.target.value,
                            })
                          }
                          className={
                            errors.siteInChargeName ? "border-red-500" : ""
                          }
                        />
                        {errors.siteInChargeName && (
                          <p className="text-red-500 text-sm mt-1">
                            {errors.siteInChargeName}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label>Start Date *</Label>
                        <Input
                          type="date"
                          value={formData.startDate}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              startDate: e.target.value,
                            })
                          }
                          className={errors.startDate ? "border-red-500" : ""}
                        />
                        {errors.startDate && (
                          <p className="text-red-500 text-sm mt-1">
                            {errors.startDate}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label>End Date</Label>
                        <Input
                          type="date"
                          value={formData.endDate}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              endDate: e.target.value,
                            })
                          }
                          className={errors.endDate ? "border-red-500" : ""}
                        />
                        {errors.endDate && (
                          <p className="text-red-500 text-sm mt-1">
                            {errors.endDate}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={
                      createMutation.isPending || updateMutation.isPending
                    }
                  >
                    {createMutation.isPending || updateMutation.isPending
                      ? "Saving..."
                      : editingSite
                        ? "Update Site"
                        : "Add Site"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Site Allocation Reports */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Site Worker Allocation Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div>
                <Label>Start Date</Label>
                <Input 
                  type="date" 
                  value={reportStart} 
                  onChange={(e) => setReportStart(e.target.value)} 
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input 
                  type="date" 
                  value={reportEnd} 
                  onChange={(e) => setReportEnd(e.target.value)} 
                />
              </div>
              <Button onClick={generateAllocationReport} className="gap-2" disabled={isGeneratingReport}>
                {isGeneratingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Export Allocation Report
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table Card */}
        <Card>
          <CardHeader>
            <CardTitle>
              All Sites {pagination && `(${pagination.totalItems})`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && !data.sites.length ? (
              <div className="flex items-center justify-center h-96">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <span className="ml-4 text-xl">Loading Sites...</span>
              </div>
            ) : sites.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground">
                {search
                  ? "No sites found matching your search."
                  : "No sites found. Add one!"}
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client Name</TableHead>
                        <TableHead>Site Ref/Name</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>LPO No</TableHead>
                        <TableHead>LPO Status</TableHead>
                        <TableHead>In-Charge</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sites.map((site) => (
                        <TableRow key={site._id}>
                          <TableCell className="font-medium">
                            {site.clientName}
                            {site.isActive === false && (
                              <Badge variant="destructive" className="ml-2 px-1 text-[10px]">Inactive</Badge>
                            )}
                          </TableCell>
                          <TableCell>{site.siteRefName}</TableCell>
                          <TableCell>{site.location}</TableCell>
                          <TableCell>{site.lpoNo || "-"}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                site.lpoStatus === "Received"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {site.lpoStatus}
                            </Badge>
                          </TableCell>
                          <TableCell>{site.siteInChargeName}</TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleEdit(site)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className={site.isActive === false ? "text-green-600 border-green-200 hover:bg-green-50" : "text-red-500 hover:bg-red-50 hover:text-red-600"}
                              onClick={() => handleDelete(site)}
                              title={site.isActive === false ? "Unblock Site" : "Delete Site"}
                            >
                              {site.isActive === false ? <Undo2 className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
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
                    totalRecords={pagination.totalItems}
                    entityName="sites"
                  />
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Sites;
