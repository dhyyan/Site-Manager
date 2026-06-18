import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Building2, Users, Clock, Banknote, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

interface Site {
  _id: string;
  siteRefName: string;
  clientName: string;
  location?: string;
}

interface Worker {
  _id: string;
  firstName: string;
  lastName: string;
  employeeNo: string;
}

interface DailyRecord {
  _id: string;
  worker: { _id: string; firstName: string; lastName: string; employeeNo: string };
  site: { _id: string; siteRefName: string };
  status: number;
  workingHours: number;
  otHours: number;
}

interface DashboardData {
  activeSites: number;
  totalWorkers: number;
  todayAttendance: string;
  monthlyPayroll: string;
  recentSites: Site[];
  topWorkers: { name: string; empNo: string; days: number }[];
}

const formatDate = (date: Date): string =>
  date.toISOString().split("T")[0];

const Dashboard = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const today = formatDate(new Date());
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const monthStr = `${year}-${month}`;

        // 1. Fetch Sites (new paginated format)
        const sitesRes = await api("sites?limit=1000");
        const sitesData = await sitesRes.json();
        const allSites: Site[] = sitesData.sites || sitesData.data || [];

        // 2. Fetch Workers (new format: { data: [...] })
        const workersRes = await api("workers?limit=1000");
        const workersData = await workersRes.json();
        const allWorkers: Worker[] = workersData.data || workersData.workers || [];

        // 3. Today's Attendance (now returns { records: [], pagination: {} })
        const todayRes = await api(`attendance/daily/${today}`);
        let todayRecords: DailyRecord[] = [];
        if (todayRes.ok) {
          const json = await todayRes.json();
          todayRecords = json.records || json || [];
        }

        const expectedHours = allWorkers.length * 8;
        const actualHours = todayRecords.reduce((sum, r) => sum + (r.workingHours || 0), 0);
        const attendancePct = expectedHours > 0
          ? ((actualHours / expectedHours) * 100).toFixed(1)
          : "0.0";

        // 4. Monthly Payroll (now uses /salary/report endpoint)
        let totalPayroll = 0;
        try {
          const salaryRes = await api(`salary/?month=${monthStr}`);
          if (salaryRes.ok) {
            const salaryJson = await salaryRes.json();
            totalPayroll = salaryJson.totals?.totalPayroll || 0;
          }
        } catch (err) {
          console.warn("Salary report not available yet");
        }

        // 5. Recent Sites (latest 3)
        const recentSites = allSites.slice(0, 3);

        // 6. Top Workers This Month (using attendance range)
        let topWorkers: { name: string; empNo: string; days: number }[] = [];

        try {
          const monthStart = `${year}-${month}-01`;
          const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
          const monthEnd = `${year}-${month}-${lastDay}`;

          const rangeRes = await api(`attendance/range?start=${monthStart}&end=${monthEnd}`);
          console.log("Range Response:", rangeRes);
          if (rangeRes.ok) {
            const rangeJson = await rangeRes.json();

            // FIXED LINE — works with both old and new formats
            const monthRecords: DailyRecord[] = Array.isArray(rangeJson) ? rangeJson : (rangeJson.records || []);

            const workerDays = monthRecords.reduce((acc: Record<string, number>, r) => {
              if (r.status > 0) {
                acc[r.worker._id] = (acc[r.worker._id] || 0) + r.status;
              }
              return acc;
            }, {});

            topWorkers = Object.entries(workerDays)
              .map(([id, days]) => {
                const w = allWorkers.find((wr) => wr._id === id);
                return {
                  name: w ? `${w.firstName} ${w.lastName}` : "Unknown Worker",
                  empNo: w?.employeeNo || "N/A",
                  days: Number(days.toFixed(1)),
                };
              })
              .sort((a, b) => b.days - a.days)
              .slice(0, 5);
          }
        } catch (err) {
          console.warn("Could not fetch top workers:", err);
        }

        setData({
          activeSites: allSites.length,
          totalWorkers: allWorkers.length,
          todayAttendance: `${attendancePct}%`,
          monthlyPayroll: `AED ${totalPayroll.toLocaleString("en-AE", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
          recentSites,
          topWorkers,
        });
      } catch (err) {
        console.error("Dashboard load error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const stats = [
    { title: "Active Sites", value: data?.activeSites ?? 0, icon: Building2, color: "text-blue-600" },
    { title: "Total Workers", value: data?.totalWorkers ?? 0, icon: Users, color: "text-green-600" },
    { title: "Attendance Today", value: data?.todayAttendance ?? "0%", icon: Clock, color: "text-orange-600" },
    { title: "Monthly Payroll", value: data?.monthlyPayroll ?? "AED 0.00", icon: Banknote, color: "text-purple-600" },
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <span className="ml-4 text-xl">Loading dashboard...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 p-4 sm:p-6 lg:p-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Real-time overview of your workforce and operations
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => (
            <Card key={stat.title} className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Sites */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Sites</CardTitle>
            </CardHeader>
            <CardContent>
              {data?.recentSites && data.recentSites.length > 0 ? (
                <div className="space-y-4">
                  {data.recentSites.map((site) => (
                    <div
                      key={site._id}
                      className="flex items-center justify-between p-4 bg-secondary/50 rounded-xl hover:bg-secondary/80 transition"
                    >
                      <div>
                        <h3 className="font-semibold text-lg">{site.siteRefName}</h3>
                        <p className="text-sm text-muted-foreground">
                          {site.clientName}
                          {site.location && ` • ${site.location}`}
                        </p>
                      </div>
                      <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        Active
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-16 text-muted-foreground">
                  No sites added yet
                </p>
              )}
            </CardContent>
          </Card>

          {/* Top Workers */}
          <Card>
            <CardHeader>
              <CardTitle>Top Workers in Month</CardTitle>
            </CardHeader>
            <CardContent>
              {data?.topWorkers && data.topWorkers.length > 0 ? (
                <div className="space-y-4">
                  {data.topWorkers.map((worker, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                          {i + 1}
                        </div>
                        <div>
                          <p className="font-medium">{worker.name}</p>
                          <p className="text-sm text-muted-foreground">{worker.empNo}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-primary">{worker.days}</p>
                        <p className="text-xs text-muted-foreground">days worked</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-16 text-muted-foreground">
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;