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
import { Plus, Pencil, ChevronLeft, ChevronRight, Loader2, Trash2, Undo2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { workerService } from "@/services/workerService";
import { CustomPagination } from "@/components/CustomPagination";

interface Worker {
  _id: string;
  firstName: string;
  lastName: string;
  designation?: string;
  joinDate: string;
  employeeNo: string;
  visaNumber?: string;
  visaExpDate?: string;
  laborCardNo?: string;
  laborCardExpDate?: string;
  emiratesIdNo?: string;
  emiratesIdExpDate?: string;
  passportNo?: string;
  passportExpDate?: string;
  mobNo?: string;
  basicSalary: number;
  allowance: number;
  companyName?: string;
  isActive?: boolean;
}

interface Advance {
  _id: string;
  amount: number;
  dateGiven: string;
  status: "pending" | "deducted";
  createdAt: string;
}

interface PaginatedResponse {
  success: boolean;
  data: Worker[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalRecords: number;
    limit: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

const Workers = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [order, setOrder] = useState("desc");
  const [status, setStatus] = useState("all");

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    designation: "",
    joinDate: "",
    employeeNo: "",
    visaNumber: "",
    visaExpDate: "",
    laborCardNo: "",
    laborCardExpDate: "",
    emiratesIdNo: "",
    emiratesIdExpDate: "",
    passportNo: "",
    passportExpDate: "",
    mobNo: "",
    basicSalary: 0,
    allowance: 0,
    companyName: "AL FAHEEM ELECTROMECHANICAL WORKS",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newAdvanceAmount, setNewAdvanceAmount] = useState<number>(0);
  const [newAdvanceDate, setNewAdvanceDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  // Fetch workers with pagination
  const { data: response, isLoading } = useQuery<PaginatedResponse>({
    queryKey: ["workers", page, limit, search, sortBy, order, status],
    queryFn: () =>
      workerService.getAll({
        page,
        limit,
        search,
        sortBy,
        order,
        status,
      }),
  });

  const {
    data: advances = [],
    refetch: refetchAdvances,
    isLoading: loadingAdvances,
  } = useQuery<Advance[]>({
    queryKey: ["advances", editingWorker?._id],
    queryFn: () => workerService.getAdvances(editingWorker!._id),
    enabled: !!editingWorker,
    staleTime: 30_000,
  });

  const workers = response?.data || [];
  const pagination = response?.pagination;

  const createMutation = useMutation({
    mutationFn: workerService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workers"] });
      toast({
        title: "Success",
        description: "New worker has been added successfully",
      });
      setOpen(false);
      resetForm();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      // Handle MongoDB duplicate key error (E11000)
      if (
        err?.response?.data?.msg?.includes("already exists") ||
        err?.message?.includes("E11000") ||
        err?.response?.data?.msg === "employeeNo already exists"
      ) {
        toast({
          title: "Duplicate Employee No",
          description:
            "This Employee Number already exists. Please use a unique number (e.g., EMP-2025-0002)",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description:
            err?.response?.data?.msg ||
            err?.message ||
            "Failed to create worker",
          variant: "destructive",
        });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      workerService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workers"] });
      toast({ title: "Success", description: "Worker updated successfully" });
      setOpen(false);
      resetForm();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      if (
        err?.response?.data?.msg?.includes("already exists") ||
        err?.message?.includes("E11000")
      ) {
        toast({
          title: "Cannot Update",
          description:
            "This Employee Number is already used by another worker.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description:
            err?.response?.data?.msg ||
            err?.message ||
            "Failed to update worker",
          variant: "destructive",
        });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: workerService.delete,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["workers"] });
      toast({ title: "Success", description: res?.msg || "Worker status updated" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.response?.data?.msg || "Failed to update worker status",
        variant: "destructive",
      });
    },
  });

  const addAdvanceMutation = useMutation({
    mutationFn: ({ workerId, payload }: { workerId: string; payload: { amount: number; dateGiven: string } }) =>
      workerService.addAdvance(workerId, payload),
    onSuccess: () => {
      refetchAdvances();
      toast({ title: "Success", description: "Advance added successfully" });
      setNewAdvanceAmount(0);
      setNewAdvanceDate(new Date().toISOString().slice(0, 10));
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.response?.data?.msg || "Failed to add advance",
        variant: "destructive",
      });
    },
  });

  const addAdvance = () => {
    if (!editingWorker) return;
    if (newAdvanceAmount <= 0) {
      toast({ title: "Invalid", description: "Amount must be > 0", variant: "destructive" });
      return;
    }
    addAdvanceMutation.mutate({
      workerId: editingWorker._id,
      payload: { amount: newAdvanceAmount, dateGiven: newAdvanceDate },
    });
  };

  const resetForm = () => {
    setFormData({
      firstName: "",
      lastName: "",
      designation: "",
      joinDate: "",
      employeeNo: "",
      visaNumber: "",
      visaExpDate: "",
      laborCardNo: "",
      laborCardExpDate: "",
      emiratesIdNo: "",
      emiratesIdExpDate: "",
      passportNo: "",
      passportExpDate: "",
      mobNo: "",
      basicSalary: 0,
      allowance: 0,
      companyName: "AL FAHEEM ELECTROMECHANICAL WORKS",
    });
    setErrors({});
    setEditingWorker(null);
    setNewAdvanceAmount(0);
    setNewAdvanceDate(new Date().toISOString().slice(0, 10));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim())
      newErrors.firstName = "First name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";
    if (!formData.employeeNo.trim())
      newErrors.employeeNo = "Employee No is required";
    if (!formData.joinDate) newErrors.joinDate = "Join date is required";
    if (formData.basicSalary <= 0)
      newErrors.basicSalary = "Basic salary must be greater than 0";

    if (!/^EMP-\d{4}-\d{4}$/.test(formData.employeeNo)) {
      newErrors.employeeNo = "Format: EMP-YYYY-XXXX (e.g., EMP-2025-0001)";
    }

    if (formData.visaNumber && formData.visaNumber.length <= 8) {
      newErrors.visaNumber = "Visa number must be more than 8 characters";
    }

    // Passport number validation removed as per request
    // if (formData.passportNo && !/^[A-Z]\d{7}$/.test(formData.passportNo)) {
    //   newErrors.passportNo = "Passport format: A1234567";
    // }

    if (formData.mobNo && !/^\d{10}$/.test(formData.mobNo)) {
      newErrors.mobNo = "Mobile number must be exactly 10 digits";
    }

    if (
      formData.emiratesIdNo &&
      !/^\d{3}-\d{4}-\d{7}-\d{1}$/.test(formData.emiratesIdNo)
    ) {
      newErrors.emiratesIdNo = "Format: 123-4567-1234567-1";
    }

    if (
      formData.laborCardNo &&
      !/^[A-Z0-9]{5,20}$/.test(formData.laborCardNo)
    ) {
      newErrors.laborCardNo = "Labor card must be 5–20 alphanumeric characters";
    }

    if (formData.allowance < 0)
      newErrors.allowance = "Allowance cannot be negative";

    const today = new Date().toISOString().split("T")[0];
    if (formData.joinDate > today)
      newErrors.joinDate = "Join date cannot be in the future";

    const checkExpiry = (field: string, label: string) => {
      if (
        formData[field] &&
        formData.joinDate &&
        formData[field] < formData.joinDate
      ) {
        newErrors[field] = `${label} expiry must be after join date`;
      }
    };

    checkExpiry("visaExpDate", "Visa");
    checkExpiry("laborCardExpDate", "Labor Card");
    checkExpiry("emiratesIdExpDate", "Emirates ID");
    checkExpiry("passportExpDate", "Passport");

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const data = {
      ...formData,
      basicSalary: Number(formData.basicSalary),
      allowance: Number(formData.allowance),
      companyName: formData.companyName,
    };

    if (editingWorker) {
      updateMutation.mutate({ id: editingWorker._id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (worker: Worker) => {
    setEditingWorker(worker);
    setFormData({
      firstName: worker.firstName,
      lastName: worker.lastName,
      designation: worker.designation || "",
      joinDate: worker.joinDate?.split("T")[0] || "",
      employeeNo: worker.employeeNo,
      visaNumber: worker.visaNumber || "",
      visaExpDate: worker.visaExpDate?.split("T")[0] || "",
      laborCardNo: worker.laborCardNo || "",
      laborCardExpDate: worker.laborCardExpDate?.split("T")[0] || "",
      emiratesIdNo: worker.emiratesIdNo || "",
      emiratesIdExpDate: worker.emiratesIdExpDate?.split("T")[0] || "",
      passportNo: worker.passportNo || "",
      passportExpDate: worker.passportExpDate?.split("T")[0] || "",
      mobNo: worker.mobNo || "",
      basicSalary: worker.basicSalary,
      allowance: worker.allowance,
      companyName: worker.companyName || "AL FAHEEM ELECTROMECHANICAL WORKS",
    });
    setErrors({});
    setOpen(true);
  };

  const handleDelete = (worker: Worker) => {
    const isInactive = worker.isActive === false;
    const action = isInactive ? "unblock" : "delete";
    if (confirm(`Are you sure you want to ${action} this worker?`)) {
      deleteMutation.mutate(worker._id);
    }
  };

  // Add this helper function inside your component (above openAddDialog)
  const generateNextEmployeeNo = (): string => {
    const currentYear = new Date().getFullYear();
    const prefix = `EMP-${currentYear}-`;

    // Find all workers with current year prefix
    const currentYearWorkers = workers.filter(
      (w) => w.employeeNo && w.employeeNo.startsWith(prefix)
    );

    if (currentYearWorkers.length === 0) {
      return `${prefix}0001`;
    }

    // Extract numbers, find the highest, then +1
    const numbers = currentYearWorkers
      .map((w) => {
        const match = w.employeeNo.match(/EMP-\d{4}-(\d{4})$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => !isNaN(n));

    const highest = Math.max(...numbers);
    const next = highest + 1;
    return `${prefix}${String(next).padStart(4, "0")}`;
  };

  // Replace your current openAddDialog with this:
  const openAddDialog = () => {
    resetForm();

    // Auto-suggest next Employee No when adding new worker
    const suggestedEmployeeNo = generateNextEmployeeNo();
    setFormData((prev) => ({ ...prev, employeeNo: suggestedEmployeeNo }));

    setOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">
              Workers Management
            </h1>
            <p className="text-muted-foreground">
              Manage your workforce and assignments
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAddDialog}>
                <Plus className="w-4 h-4 mr-2" /> Add Worker
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingWorker ? "Edit Worker" : "Add New Worker"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-6">
                  {/* Employee Details */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg text-red-600">
                      Employee Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>First Name *</Label>
                        <Input
                          value={formData.firstName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              firstName: e.target.value,
                            })
                          }
                          className={errors.firstName ? "border-red-500" : ""}
                        />
                        {errors.firstName && (
                          <p className="text-red-500 text-sm mt-1">
                            {errors.firstName}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label>Last Name *</Label>
                        <Input
                          value={formData.lastName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              lastName: e.target.value,
                            })
                          }
                          className={errors.lastName ? "border-red-500" : ""}
                        />
                        {errors.lastName && (
                          <p className="text-red-500 text-sm mt-1">
                            {errors.lastName}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label>Designation</Label>
                        <Input
                          value={formData.designation}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              designation: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label>Join Date *</Label>
                        <Input
                          type="date"
                          value={formData.joinDate}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              joinDate: e.target.value,
                            })
                          }
                          className={errors.joinDate ? "border-red-500" : ""}
                        />
                        {errors.joinDate && (
                          <p className="text-red-500 text-sm mt-1">
                            {errors.joinDate}
                          </p>
                        )}
                      </div>
                      <div className="md:col-span-2">
                        <Label>Employee No *</Label>
                        <Input
                          placeholder="EMP-2025-0001"
                          value={formData.employeeNo}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              employeeNo: e.target.value,
                            })
                          }
                          className={errors.employeeNo ? "border-red-500" : ""}
                          readOnly={!editingWorker} // ← Auto-filled when adding, editable when editing
                          style={
                            !editingWorker
                              ? {
                                backgroundColor: "#f3f4f6",
                                cursor: "not-allowed",
                              }
                              : {}
                          }
                        />
                        {!editingWorker && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Auto-generated. You can change it if needed.
                          </p>
                        )}
                        {errors.employeeNo && (
                          <p className="text-red-500 text-sm mt-1">
                            {errors.employeeNo}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Documents Section */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg text-red-600">
                      Documents & Visa Details
                    </h3>

                    {/* Visa */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Visa Number</Label>
                        <Input
                          placeholder="12345678"
                          value={formData.visaNumber}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              visaNumber: e.target.value,
                            })
                          }
                          className={errors.visaNumber ? "border-red-500" : ""}
                        />
                        {errors.visaNumber && (
                          <p className="text-red-500 text-sm mt-1">
                            {errors.visaNumber}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label>Visa Expiry Date</Label>
                        <Input
                          type="date"
                          value={formData.visaExpDate}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              visaExpDate: e.target.value,
                            })
                          }
                          className={errors.visaExpDate ? "border-red-500" : ""}
                        />
                        {errors.visaExpDate && (
                          <p className="text-red-500 text-sm mt-1">
                            {errors.visaExpDate}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Labor Card */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Labor Card No</Label>
                        <Input
                          value={formData.laborCardNo}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              laborCardNo: e.target.value,
                            })
                          }
                          className={errors.laborCardNo ? "border-red-500" : ""}
                        />
                        {errors.laborCardNo && (
                          <p className="text-red-500 text-sm mt-1">
                            {errors.laborCardNo}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label>Labor Card Expiry</Label>
                        <Input
                          type="date"
                          value={formData.laborCardExpDate}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              laborCardExpDate: e.target.value,
                            })
                          }
                          className={
                            errors.laborCardExpDate ? "border-red-500" : ""
                          }
                        />
                        {errors.laborCardExpDate && (
                          <p className="text-red-500 text-sm mt-1">
                            {errors.laborCardExpDate}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Emirates ID */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Emirates ID No</Label>
                        <Input
                          placeholder="123-4567-1234567-1"
                          value={formData.emiratesIdNo}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              emiratesIdNo: e.target.value,
                            })
                          }
                          className={
                            errors.emiratesIdNo ? "border-red-500" : ""
                          }
                        />
                        {errors.emiratesIdNo && (
                          <p className="text-red-500 text-sm mt-1">
                            {errors.emiratesIdNo}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label>Emirates ID Expiry</Label>
                        <Input
                          type="date"
                          value={formData.emiratesIdExpDate}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              emiratesIdExpDate: e.target.value,
                            })
                          }
                          className={
                            errors.emiratesIdExpDate ? "border-red-500" : ""
                          }
                        />
                        {errors.emiratesIdExpDate && (
                          <p className="text-red-500 text-sm mt-1">
                            {errors.emiratesIdExpDate}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Passport */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Passport No</Label>
                        <Input
                          placeholder="A1234567"
                          value={formData.passportNo}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              passportNo: e.target.value,
                            })
                          }
                          className={errors.passportNo ? "border-red-500" : ""}
                        />
                        {errors.passportNo && (
                          <p className="text-red-500 text-sm mt-1">
                            {errors.passportNo}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label>Passport Expiry</Label>
                        <Input
                          type="date"
                          value={formData.passportExpDate}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              passportExpDate: e.target.value,
                            })
                          }
                          className={
                            errors.passportExpDate ? "border-red-500" : ""
                          }
                        />
                        {errors.passportExpDate && (
                          <p className="text-red-500 text-sm mt-1">
                            {errors.passportExpDate}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Mobile Number */}
                    <div>
                      <Label>Mobile Number</Label>
                      <Input
                        placeholder="501234567"
                        value={formData.mobNo}
                        onChange={(e) =>
                          setFormData({ ...formData, mobNo: e.target.value })
                        }
                        className={errors.mobNo ? "border-red-500" : ""}
                      />
                      {errors.mobNo && (
                        <p className="text-red-500 text-sm mt-1">
                          {errors.mobNo}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Company Details */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg text-red-600">
                      Company Details
                    </h3>
                    <div>
                      <Label>Company Name</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                        value={formData.companyName}
                        onChange={(e) =>
                          setFormData({ ...formData, companyName: e.target.value })
                        }
                      >
                        <option value="AL FAHEEM ELECTROMECHANICAL WORKS">
                          AL FAHEEM ELECTROMECHANICAL WORKS
                        </option>
                        <option value="DAF">DAF</option>
                        <option value="Mazaya Al Madina">Mazaya Al Madina</option>
                      </select>
                    </div>
                  </div>

                  {/* Salary & Advance */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg text-red-600">
                      Salary Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label>Basic Salary *</Label>
                        <Input
                          type="number"
                          value={formData.basicSalary}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              basicSalary: Number(e.target.value) || 0,
                            })
                          }
                          className={errors.basicSalary ? "border-red-500" : ""}
                        />
                        {errors.basicSalary && (
                          <p className="text-red-500 text-sm mt-1">
                            {errors.basicSalary}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label>Allowance</Label>
                        <Input
                          type="number"
                          value={formData.allowance}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              allowance: Number(e.target.value) || 0,
                            })
                          }
                          className={errors.allowance ? "border-red-500" : ""}
                        />
                        {errors.allowance && (
                          <p className="text-red-500 text-sm mt-1">
                            {errors.allowance}
                          </p>
                        )}
                      </div>

                    </div>
                  </div>
                </div>

                {/* ADVANCE HISTORY SECTION */}
                {editingWorker && (
                  <div className="space-y-6 border-t pt-6">
                    <h3 className="text-lg font-semibold text-red-600">Advance History</h3>

                    <div className="flex gap-3 items-end">
                      <div className="flex-1">
                        <Label>Amount (AED)</Label>
                        <Input
                          type="number"
                          min="1"
                          value={newAdvanceAmount || ""}
                          onChange={(e) => setNewAdvanceAmount(Number(e.target.value) || 0)}
                          disabled={addAdvanceMutation.isPending}
                          placeholder="2000"
                        />
                      </div>
                      <div className="flex-1">
                        <Label>Date Given</Label>
                        <Input
                          type="date"
                          value={newAdvanceDate}
                          onChange={(e) => setNewAdvanceDate(e.target.value)}
                          disabled={addAdvanceMutation.isPending}
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={addAdvance}
                        disabled={addAdvanceMutation.isPending || newAdvanceAmount <= 0}
                      >
                        {addAdvanceMutation.isPending ? "Adding..." : "Add Advance"}
                      </Button>
                    </div>

                    <div className="border rounded-lg">
                      {loadingAdvances ? (
                        <div className="p-12 text-center">
                          <Loader2 className="w-8 h-8 animate-spin mx-auto" />
                        </div>
                      ) : advances.length === 0 ? (
                        <p className="text-center py-12 text-muted-foreground">No advances recorded</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {advances.map((adv) => (
                              <TableRow key={adv._id}>
                                <TableCell>{new Date(adv.dateGiven).toLocaleDateString()}</TableCell>
                                <TableCell className="text-right font-medium">
                                  {adv.amount.toLocaleString()}
                                </TableCell>
                                <TableCell>
                                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${adv.status === "deducted"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-orange-100 text-orange-800"
                                    }`}>
                                    {adv.status}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      createMutation.isPending || updateMutation.isPending
                    }
                  >
                    {createMutation.isPending || updateMutation.isPending
                      ? "Saving..."
                      : editingWorker
                        ? "Update Worker"
                        : "Add Worker"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader className="space-y-4">
            <CardTitle>All Workers</CardTitle>
            {/* Search and Filter Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label className="text-xs">Search</Label>
                <Input
                  placeholder="Search by name, ID, designation..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <select
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">All Workers</option>
                  <option value="expired">Expired Docs</option>
                  <option value="expiring">Expiring Soon</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">Sort By</Label>
                <select
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="createdAt">Date Added</option>
                  <option value="firstName">First Name</option>
                  <option value="basicSalary">Basic Salary</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-96">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <span className="ml-4 text-xl">Loading Workers...</span>
              </div>
            ) : workers.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No workers found.
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee No</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Basic Salary</TableHead>
                        <TableHead>Allowance</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {workers.map((worker) => (
                        <TableRow key={worker._id}>
                          <TableCell className="font-medium">
                            {worker.employeeNo}
                          </TableCell>
                          <TableCell>
                            {worker.firstName} {worker.lastName}
                            {worker.isActive === false && (
                              <span className="ml-2 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-medium">
                                Inactive
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            AED {worker.basicSalary.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            AED {worker.allowance.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleEdit(worker)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className={worker.isActive === false ? "text-green-600 border-green-200 hover:bg-green-50" : "text-red-500 hover:bg-red-50 hover:text-red-600"}
                              onClick={() => handleDelete(worker)}
                              title={worker.isActive === false ? "Unblock Worker" : "Delete Worker"}
                            >
                              {worker.isActive === false ? <Undo2 className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination Controls */}
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
                    entityName="workers"
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

export default Workers;
