"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  Building,
  FileText,
  CheckCircle,
  BarChart3,
  Receipt,
  AlertTriangle,
  Clock,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { formatCurrency, cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────

type Preset = "this_month" | "last_month" | "this_quarter" | "ytd" | "this_year";

interface PnlData {
  grossRevenue: number;
  houseCut: number;
  netRevenue: number;
  buckets: { businessExpense: number; ownerProfit: number; workerPool: number };
  operatingExpenses: { total: number; byCategory: { name: string; amount: number }[] };
  netProfit: number;
}

interface RevenueItem {
  label: string;
  revenue: number;
  jobCount: number;
  avgPerJob: number;
}

interface PropertyRevenue {
  propertyId: string;
  propertyName: string;
  jobCount: number;
  totalRevenue: number;
  avgPerJob: number;
  houseCut: number;
  netToCRN: number;
}

interface WorkerEarning {
  userId: string;
  userName: string;
  jobsWorked: number;
  totalShares: number;
  workerPoolPay: number;
  ownerPay: number;
  totalPay: number;
  avgPerJob: number;
  requires1099: boolean;
}

interface CompletionRate {
  scheduled: number;
  completed: number;
  cancelled: number;
  rate: number;
  trend: { month: string; rate: number }[];
}

interface JobVolume {
  totalJobs: number;
  avgPerDay: number;
  busiestDay: string;
  dayOfWeekDistribution: { day: string; count: number }[];
}

interface Ten99Entry {
  userId: string;
  userName: string;
  totalPaid: number;
  requires1099: boolean;
  w9OnFile: boolean;
}

interface ScheduleCLine {
  line: string;
  category: string;
  amount: number;
}

interface ArAging {
  current: number;
  days1to30: number;
  days31to60: number;
  days60plus: number;
  totalOutstanding: number;
  invoices: unknown[];
}

// ── Constants ──────────────────────────────────────────────────────────

const PRESETS: { value: Preset; label: string }[] = [
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "ytd", label: "YTD" },
  { value: "this_year", label: "This Year" },
];

const TABS = ["Overview", "Revenue", "Team", "Tax"] as const;
type Tab = (typeof TABS)[number];

// ── Helpers ────────────────────────────────────────────────────────────

function formatPct(n: number): string {
  return `${(n ?? 0).toFixed(1)}%`;
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return formatCurrency(n);
}

type SortDir = "asc" | "desc";

function useSortable<T>(data: T[], defaultKey: keyof T, defaultDir: SortDir = "desc") {
  const [sortKey, setSortKey] = useState<keyof T>(defaultKey);
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);

  const sorted = useMemo(() => {
    const copy = [...data];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return copy;
  }, [data, sortKey, sortDir]);

  const toggle = (key: keyof T) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  return { sorted, sortKey, sortDir, toggle };
}

function SortHeader<T>({
  label,
  field,
  sortKey,
  sortDir,
  onToggle,
  className,
}: {
  label: string;
  field: T;
  sortKey: T;
  sortDir: SortDir;
  onToggle: (k: T) => void;
  className?: string;
}) {
  const active = field === sortKey;
  return (
    <th
      className={cn(
        "px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 transition-colors",
        className
      )}
      onClick={() => onToggle(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          sortDir === "asc" ? (
            <ChevronUp size={12} />
          ) : (
            <ChevronDown size={12} />
          )
        ) : (
          <ArrowUpDown size={12} className="opacity-30" />
        )}
      </span>
    </th>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-gray-200 rounded", className)} />;
}

function CardSkeleton() {
  return (
    <Card>
      <CardContent className="p-5">
        <Skeleton className="h-4 w-24 mb-3" />
        <Skeleton className="h-8 w-32 mb-2" />
        <Skeleton className="h-3 w-20" />
      </CardContent>
    </Card>
  );
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [preset, setPreset] = useState<Preset>("this_month");
  const [tab, setTab] = useState<Tab>("Overview");

  // Data stores
  const [pnl, setPnl] = useState<PnlData | null>(null);
  const [revenueByMonth, setRevenueByMonth] = useState<RevenueItem[]>([]);
  const [revenueByProperty, setRevenueByProperty] = useState<PropertyRevenue[]>([]);
  const [revenueByType, setRevenueByType] = useState<RevenueItem[]>([]);
  const [revenueByOwner, setRevenueByOwner] = useState<RevenueItem[]>([]);
  const [workerEarnings, setWorkerEarnings] = useState<WorkerEarning[]>([]);
  const [completionRate, setCompletionRate] = useState<CompletionRate | null>(null);
  const [jobVolume, setJobVolume] = useState<JobVolume | null>(null);
  const [ten99Summary, setTen99Summary] = useState<Ten99Entry[]>([]);
  const [scheduleCData, setScheduleCData] = useState<ScheduleCLine[]>([]);
  const [arAging, setArAging] = useState<ArAging | null>(null);

  // Loading states per tab
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingRevenue, setLoadingRevenue] = useState(true);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [loadingTax, setLoadingTax] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Data fetching ──

  const params = useMemo(() => ({ preset }), [preset]);

  const fetchOverview = useCallback(async () => {
    setLoadingOverview(true);
    setError(null);
    try {
      const [pnlRes, monthRes, workersRes, completionRes, volumeRes, arRes] =
        await Promise.all([
          api.get<PnlData>("/reports/pnl", params),
          api.get<{ items: RevenueItem[] }>("/reports/revenue", { ...params, groupBy: "month" }),
          api.get<WorkerEarning[]>("/reports/worker-earnings", params),
          api.get<CompletionRate>("/reports/completion-rate", params),
          api.get<JobVolume>("/reports/job-volume", params),
          api.get<ArAging>("/reports/ar-aging", params),
        ]);
      setPnl(pnlRes);
      setRevenueByMonth((monthRes as any).items ?? (monthRes as any).breakdown ?? monthRes ?? []);
      // Worker earnings: API returns {workers: [...]} not a plain array
      setWorkerEarnings(Array.isArray(workersRes) ? workersRes : (workersRes as any)?.workers ?? []);
      // Completion rate: API returns monthlyTrend not trend
      setCompletionRate({ ...completionRes, trend: (completionRes as any).monthlyTrend ?? (completionRes as any).trend ?? [] } as any);
      setJobVolume(volumeRes);
      // AR aging: API returns {buckets, totalOutstanding} — map to expected shape
      const aging = arRes as any;
      setArAging({
        current: aging.buckets?.current ?? aging.current ?? 0,
        days1to30: aging.buckets?.days1to30 ?? aging.days1to30 ?? 0,
        days31to60: aging.buckets?.days31to60 ?? aging.days31to60 ?? 0,
        days60plus: aging.buckets?.days60plus ?? aging.days60plus ?? 0,
        totalOutstanding: aging.totalOutstanding ?? 0,
        invoices: aging.invoices ?? [],
      } as any);
    } catch (err) {
      console.error("Failed to fetch overview:", err);
      setError("Failed to load overview data. Please try again.");
    } finally {
      setLoadingOverview(false);
    }
  }, [params]);

  const fetchRevenue = useCallback(async () => {
    setLoadingRevenue(true);
    try {
      const [propRes, typeRes, ownerRes] = await Promise.all([
        api.get<PropertyRevenue[]>("/reports/property-revenue", params),
        api.get<{ items: RevenueItem[] }>("/reports/revenue", { ...params, groupBy: "type" }),
        api.get<{ items: RevenueItem[] }>("/reports/revenue", { ...params, groupBy: "owner" }),
      ]);
      setRevenueByProperty(Array.isArray(propRes) ? propRes : (propRes as any)?.properties ?? []);
      setRevenueByType((typeRes as any).items ?? (typeRes as any).breakdown ?? typeRes ?? []);
      setRevenueByOwner((ownerRes as any).items ?? (ownerRes as any).breakdown ?? ownerRes ?? []);
    } catch (err) {
      console.error("Failed to fetch revenue:", err);
    } finally {
      setLoadingRevenue(false);
    }
  }, [params]);

  const fetchTeam = useCallback(async () => {
    setLoadingTeam(true);
    try {
      const [workersRes, ten99Res] = await Promise.all([
        api.get<WorkerEarning[]>("/reports/worker-earnings", params),
        api.get<Ten99Entry[]>("/reports/1099-summary", params),
      ]);
      setWorkerEarnings(Array.isArray(workersRes) ? workersRes : (workersRes as any)?.workers ?? []);
      setTen99Summary(Array.isArray(ten99Res) ? ten99Res : (ten99Res as any)?.workers ?? (ten99Res as any)?.entries ?? []);
    } catch (err) {
      console.error("Failed to fetch team:", err);
    } finally {
      setLoadingTeam(false);
    }
  }, [params]);

  const fetchTax = useCallback(async () => {
    setLoadingTax(true);
    try {
      const [schedRes, ten99Res, pnlRes] = await Promise.all([
        api.get<ScheduleCLine[]>("/reports/schedule-c", params),
        api.get<Ten99Entry[]>("/reports/1099-summary", params),
        api.get<PnlData>("/reports/pnl", params),
      ]);
      setScheduleCData(Array.isArray(schedRes) ? schedRes : (schedRes as any)?.lines ?? (schedRes as any)?.items ?? []);
      setTen99Summary(Array.isArray(ten99Res) ? ten99Res : (ten99Res as any)?.workers ?? (ten99Res as any)?.entries ?? []);
      setPnl(pnlRes);
    } catch (err) {
      console.error("Failed to fetch tax:", err);
    } finally {
      setLoadingTax(false);
    }
  }, [params]);

  // Fetch data when preset or tab changes
  useEffect(() => {
    if (tab === "Overview") fetchOverview();
    else if (tab === "Revenue") fetchRevenue();
    else if (tab === "Team") fetchTeam();
    else if (tab === "Tax") fetchTax();
  }, [tab, fetchOverview, fetchRevenue, fetchTeam, fetchTax]);

  // ── Render ──

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Reports"
        subtitle="V2 financial reports, tax prep, and business analytics"
      />

      <div className="px-4 sm:px-6 space-y-6 pb-12">
        {/* Period Selector Pills */}
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPreset(p.value)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                preset === p.value
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Tab Bar */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-0 -mb-px">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-5 py-3 text-sm font-medium border-b-2 transition-colors",
                  tab === t
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                )}
              >
                {t}
              </button>
            ))}
          </nav>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertTriangle size={18} className="text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setError(null);
                fetchOverview();
              }}
            >
              Retry
            </Button>
          </div>
        )}

        {/* Tab Content */}
        {tab === "Overview" && (
          <OverviewTab
            loading={loadingOverview}
            pnl={pnl}
            revenueByMonth={revenueByMonth}
            workerEarnings={workerEarnings}
            completionRate={completionRate}
            jobVolume={jobVolume}
            arAging={arAging}
          />
        )}
        {tab === "Revenue" && (
          <RevenueTab
            loading={loadingRevenue}
            revenueByProperty={revenueByProperty}
            revenueByType={revenueByType}
            revenueByOwner={revenueByOwner}
          />
        )}
        {tab === "Team" && (
          <TeamTab
            loading={loadingTeam}
            workerEarnings={workerEarnings}
            ten99Summary={ten99Summary}
          />
        )}
        {tab === "Tax" && (
          <TaxTab
            loading={loadingTax}
            pnl={pnl}
            scheduleCData={scheduleCData}
            ten99Summary={ten99Summary}
          />
        )}
      </div>
    </div>
  );
}

// ── Tab: Overview ──────────────────────────────────────────────────────

function OverviewTab({
  loading,
  pnl,
  revenueByMonth,
  workerEarnings,
  completionRate,
  jobVolume,
  arAging,
}: {
  loading: boolean;
  pnl: PnlData | null;
  revenueByMonth: RevenueItem[];
  workerEarnings: WorkerEarning[];
  completionRate: CompletionRate | null;
  jobVolume: JobVolume | null;
  arAging: ArAging | null;
}) {
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <Card>
          <CardContent className="p-6">
            <TableSkeleton rows={6} />
          </CardContent>
        </Card>
      </div>
    );
  }

  const maxMonthRevenue = Math.max(...revenueByMonth.map((m) => m.revenue), 1);

  return (
    <div className="space-y-6">
      {/* Hero KPI Cards */}
      {pnl && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-green-50 to-white border-green-200">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-green-600 mb-1">
                <DollarSign size={18} />
                <span className="text-sm font-medium">Gross Revenue</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {formatCurrency(pnl?.grossRevenue ?? 0)}
              </p>
              {jobVolume && (
                <p className="text-sm text-gray-500 mt-1">
                  {jobVolume?.totalJobs ?? 0} jobs ({formatCurrency(jobVolume.avgPerDay)}/day avg)
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                <TrendingUp size={18} />
                <span className="text-sm font-medium">Net Revenue</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {formatCurrency(pnl?.netRevenue ?? 0)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                After {formatCurrency(pnl?.houseCut ?? 0)} house cut
              </p>
            </CardContent>
          </Card>

          <Card
            className={cn(
              "bg-gradient-to-br to-white",
              pnl?.netProfit ?? 0 >= 0
                ? "from-emerald-50 border-emerald-200"
                : "from-red-50 border-red-200"
            )}
          >
            <CardContent className="p-5">
              <div
                className={cn(
                  "flex items-center gap-2 mb-1",
                  pnl?.netProfit ?? 0 >= 0 ? "text-emerald-600" : "text-red-600"
                )}
              >
                {pnl?.netProfit ?? 0 >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                <span className="text-sm font-medium">Net Profit</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {formatCurrency(pnl?.netProfit ?? 0)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                After {formatCurrency(pnl.operatingExpenses.total)} expenses
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* P&L Bucket Breakdown */}
      {pnl && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 size={18} />
              Profit and Loss Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-blue-600 mb-1">Worker Pool</p>
                <p className="text-2xl font-bold">{formatCurrency(pnl?.buckets?.workerPool ?? 0)}</p>
              </div>
              <div className="text-center p-4 bg-amber-50 rounded-lg">
                <p className="text-sm font-medium text-amber-600 mb-1">Business Expenses</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(pnl?.buckets?.businessExpense ?? 0)}
                </p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-sm font-medium text-green-600 mb-1">Owner Profit</p>
                <p className="text-2xl font-bold">{formatCurrency(pnl?.buckets?.ownerProfit ?? 0)}</p>
              </div>
            </div>

            {/* Expense breakdown */}
            {pnl?.operatingExpenses?.byCategory.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-100">
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  Operating Expenses by Category
                </h4>
                <div className="space-y-2">
                  {pnl?.operatingExpenses?.byCategory.map((cat) => {
                    const pct =
                      pnl.operatingExpenses.total > 0
                        ? (cat.amount / pnl.operatingExpenses.total) * 100
                        : 0;
                    return (
                      <div key={cat.name} className="flex items-center gap-3">
                        <span className="text-sm text-gray-600 w-36 truncate">{cat.name}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                          <div
                            className="bg-blue-500 h-2.5 rounded-full transition-all"
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-900 w-24 text-right">
                          {formatCurrency(cat.amount)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Revenue by Month Chart */}
      {revenueByMonth.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 size={18} />
              Revenue by Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 sm:gap-3 h-52">
              {revenueByMonth.map((month) => {
                const heightPct = (month.revenue / maxMonthRevenue) * 100;
                return (
                  <div
                    key={month.label}
                    className="flex-1 flex flex-col items-center gap-1 group"
                  >
                    <span className="text-xs text-gray-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      {formatCompact(month.revenue)}
                    </span>
                    <div className="w-full flex items-end" style={{ height: "180px" }}>
                      <div
                        className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors cursor-default"
                        style={{
                          height: `${Math.max(heightPct, 2)}%`,
                        }}
                        title={`${month.label}: ${formatCurrency(month.revenue)} (${month.jobCount} jobs)`}
                      />
                    </div>
                    <span className="text-xs text-gray-500 truncate max-w-full">
                      {month.label}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-4 text-sm text-gray-500">
              <span>
                Total: {formatCurrency(revenueByMonth.reduce((s, m) => s + m.revenue, 0))}
              </span>
              <span>
                {revenueByMonth.reduce((s, m) => s + m.jobCount, 0)} jobs
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bottom row: Completion Rate, Job Volume, AR Aging */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Completion Rate */}
        {completionRate && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle size={18} />
                Completion Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center mb-4">
                <p
                  className={cn(
                    "text-4xl font-bold",
                    completionRate.rate >= 90
                      ? "text-green-600"
                      : completionRate.rate >= 75
                        ? "text-amber-600"
                        : "text-red-600"
                  )}
                >
                  {formatPct(completionRate.rate)}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div>
                  <p className="font-semibold text-gray-900">{completionRate.scheduled}</p>
                  <p className="text-gray-500">Scheduled</p>
                </div>
                <div>
                  <p className="font-semibold text-green-600">{completionRate.completed}</p>
                  <p className="text-gray-500">Completed</p>
                </div>
                <div>
                  <p className="font-semibold text-red-600">{completionRate.cancelled}</p>
                  <p className="text-gray-500">Cancelled</p>
                </div>
              </div>

              {completionRate?.trend?.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-2">Monthly Trend</p>
                  <div className="flex items-end gap-1 h-16">
                    {completionRate?.trend?.map((t) => (
                      <div
                        key={t.month}
                        className="flex-1 bg-green-400 rounded-t hover:bg-green-500 transition-colors"
                        style={{ height: `${t.rate}%` }}
                        title={`${t.month}: ${formatPct(t.rate)}`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Job Volume */}
        {jobVolume && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 size={18} />
                Job Volume
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-700">{jobVolume?.totalJobs ?? 0}</p>
                  <p className="text-xs text-gray-500">Total Jobs</p>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <p className="text-2xl font-bold text-purple-700">
                    {(jobVolume?.avgPerDay ?? 0).toFixed(1)}
                  </p>
                  <p className="text-xs text-gray-500">Avg/Day</p>
                </div>
              </div>
              {jobVolume.busiestDay && (
                <p className="text-sm text-gray-600 mb-3">
                  Busiest day: <span className="font-medium">{jobVolume.busiestDay}</span>
                </p>
              )}
              {jobVolume?.dayOfWeekDistribution?.length > 0 && (
                <div className="space-y-1.5">
                  {jobVolume?.dayOfWeekDistribution?.map((d) => {
                    const maxCount = Math.max(
                      ...jobVolume?.dayOfWeekDistribution?.map((x) => x.count),
                      1
                    );
                    return (
                      <div key={d.day} className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-8">{d.day.slice(0, 3)}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${(d.count / maxCount) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-700 w-6 text-right">
                          {d.count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* AR Aging */}
        {arAging && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock size={18} />
                Accounts Receivable
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center mb-4">
                <p className="text-3xl font-bold text-gray-900">
                  {formatCurrency(arAging?.totalOutstanding ?? 0)}
                </p>
                <p className="text-sm text-gray-500">Total Outstanding</p>
              </div>
              <div className="space-y-3">
                <AgingRow label="Current" amount={arAging.current} color="bg-green-500" />
                <AgingRow label="1-30 Days" amount={arAging.days1to30} color="bg-amber-500" />
                <AgingRow
                  label="31-60 Days"
                  amount={arAging.days31to60}
                  color="bg-orange-500"
                />
                <AgingRow label="60+ Days" amount={arAging.days60plus} color="bg-red-500" />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Worker Earnings Table (compact for overview) */}
      {workerEarnings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users size={18} />
              Worker Earnings Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">
                      Worker
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">
                      Jobs
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">
                      Total Pay
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">
                      Avg/Job
                    </th>
                    <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500 uppercase">
                      1099
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {workerEarnings.slice(0, 8).map((w) => (
                    <tr key={w.userId} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{w.userName}</td>
                      <td className="px-4 py-2.5 text-right text-gray-600">{w.jobsWorked}</td>
                      <td className="px-4 py-2.5 text-right font-medium">
                        {formatCurrency(w.totalPay)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-600">
                        {formatCurrency(w.avgPerJob)}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {w.requires1099 && (
                          <Badge variant="warning">1099</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AgingRow({
  label,
  amount,
  color,
}: {
  label: string;
  amount: number;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className={cn("w-3 h-3 rounded-full", color)} />
        <span className="text-sm text-gray-600">{label}</span>
      </div>
      <span className="text-sm font-medium text-gray-900">{formatCurrency(amount)}</span>
    </div>
  );
}

// ── Tab: Revenue ───────────────────────────────────────────────────────

function RevenueTab({
  loading,
  revenueByProperty,
  revenueByType,
  revenueByOwner,
}: {
  loading: boolean;
  revenueByProperty: PropertyRevenue[];
  revenueByType: RevenueItem[];
  revenueByOwner: RevenueItem[];
}) {
  const propSort = useSortable<PropertyRevenue>(
    revenueByProperty,
    "totalRevenue",
    "desc"
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <TableSkeleton rows={8} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Revenue by Property */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building size={18} />
            Revenue by Property
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {propSort.sorted.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No property revenue data</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <SortHeader
                      label="Property"
                      field={"propertyName" as keyof PropertyRevenue}
                      sortKey={propSort.sortKey}
                      sortDir={propSort.sortDir}
                      onToggle={propSort.toggle}
                      className="pl-4"
                    />
                    <SortHeader
                      label="Jobs"
                      field={"jobCount" as keyof PropertyRevenue}
                      sortKey={propSort.sortKey}
                      sortDir={propSort.sortDir}
                      onToggle={propSort.toggle}
                      className="text-right"
                    />
                    <SortHeader
                      label="Total Revenue"
                      field={"totalRevenue" as keyof PropertyRevenue}
                      sortKey={propSort.sortKey}
                      sortDir={propSort.sortDir}
                      onToggle={propSort.toggle}
                      className="text-right"
                    />
                    <SortHeader
                      label="Avg/Job"
                      field={"avgPerJob" as keyof PropertyRevenue}
                      sortKey={propSort.sortKey}
                      sortDir={propSort.sortDir}
                      onToggle={propSort.toggle}
                      className="text-right"
                    />
                    <SortHeader
                      label="House Cut"
                      field={"houseCut" as keyof PropertyRevenue}
                      sortKey={propSort.sortKey}
                      sortDir={propSort.sortDir}
                      onToggle={propSort.toggle}
                      className="text-right"
                    />
                    <SortHeader
                      label="Net to CRN"
                      field={"netToCRN" as keyof PropertyRevenue}
                      sortKey={propSort.sortKey}
                      sortDir={propSort.sortDir}
                      onToggle={propSort.toggle}
                      className="text-right pr-4"
                    />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {propSort.sorted.map((p) => (
                    <tr key={p.propertyId} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-900">
                        {p.propertyName}
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{p.jobCount}</td>
                      <td className="px-3 py-2.5 text-right font-medium">
                        {formatCurrency(p.totalRevenue)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-600">
                        {formatCurrency(p.avgPerJob)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-600">
                        {formatCurrency(p.houseCut)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-green-600">
                        {formatCurrency(p.netToCRN)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {propSort.sorted.length > 1 && (
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                      <td className="px-4 py-2.5">Total</td>
                      <td className="px-3 py-2.5 text-right">
                        {propSort.sorted.reduce((s, p) => s + p.jobCount, 0)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {formatCurrency(
                          propSort.sorted.reduce((s, p) => s + p.totalRevenue, 0)
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-400">--</td>
                      <td className="px-3 py-2.5 text-right">
                        {formatCurrency(
                          propSort.sorted.reduce((s, p) => s + p.houseCut, 0)
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right text-green-600">
                        {formatCurrency(
                          propSort.sorted.reduce((s, p) => s + p.netToCRN, 0)
                        )}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revenue by Type + Revenue by Owner side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueBreakdownCard
          title="Revenue by Job Type"
          icon={<FileText size={18} />}
          items={revenueByType}
        />
        <RevenueBreakdownCard
          title="Revenue by Owner"
          icon={<Users size={18} />}
          items={revenueByOwner}
        />
      </div>
    </div>
  );
}

function RevenueBreakdownCard({
  title,
  icon,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  items: RevenueItem[];
}) {
  const maxRevenue = Math.max(...items.map((i) => i.revenue), 1);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center text-gray-500 py-6">No data for this period</div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-900">{item.label}</span>
                  <span className="text-gray-600">
                    {formatCurrency(item.revenue)} ({item.jobCount} jobs)
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${(item.revenue / maxRevenue) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Tab: Team ──────────────────────────────────────────────────────────

function TeamTab({
  loading,
  workerEarnings,
  ten99Summary,
}: {
  loading: boolean;
  workerEarnings: WorkerEarning[];
  ten99Summary: Ten99Entry[];
}) {
  const earningsSort = useSortable<WorkerEarning>(workerEarnings, "totalPay", "desc");

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <TableSkeleton rows={8} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Full Worker Earnings Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users size={18} />
            Worker Earnings Detail
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {earningsSort.sorted.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No earnings data</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <SortHeader
                      label="Worker"
                      field={"userName" as keyof WorkerEarning}
                      sortKey={earningsSort.sortKey}
                      sortDir={earningsSort.sortDir}
                      onToggle={earningsSort.toggle}
                      className="pl-4"
                    />
                    <SortHeader
                      label="Jobs"
                      field={"jobsWorked" as keyof WorkerEarning}
                      sortKey={earningsSort.sortKey}
                      sortDir={earningsSort.sortDir}
                      onToggle={earningsSort.toggle}
                      className="text-right"
                    />
                    <SortHeader
                      label="Shares"
                      field={"totalShares" as keyof WorkerEarning}
                      sortKey={earningsSort.sortKey}
                      sortDir={earningsSort.sortDir}
                      onToggle={earningsSort.toggle}
                      className="text-right"
                    />
                    <SortHeader
                      label="Pool Pay"
                      field={"workerPoolPay" as keyof WorkerEarning}
                      sortKey={earningsSort.sortKey}
                      sortDir={earningsSort.sortDir}
                      onToggle={earningsSort.toggle}
                      className="text-right"
                    />
                    <SortHeader
                      label="Owner Pay"
                      field={"ownerPay" as keyof WorkerEarning}
                      sortKey={earningsSort.sortKey}
                      sortDir={earningsSort.sortDir}
                      onToggle={earningsSort.toggle}
                      className="text-right"
                    />
                    <SortHeader
                      label="Total Pay"
                      field={"totalPay" as keyof WorkerEarning}
                      sortKey={earningsSort.sortKey}
                      sortDir={earningsSort.sortDir}
                      onToggle={earningsSort.toggle}
                      className="text-right"
                    />
                    <SortHeader
                      label="Avg/Job"
                      field={"avgPerJob" as keyof WorkerEarning}
                      sortKey={earningsSort.sortKey}
                      sortDir={earningsSort.sortDir}
                      onToggle={earningsSort.toggle}
                      className="text-right"
                    />
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase pr-4">
                      1099
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {earningsSort.sorted.map((w) => (
                    <tr key={w.userId} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{w.userName}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{w.jobsWorked}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600">
                        {w.totalShares.toFixed(1)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {formatCurrency(w.workerPoolPay)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {formatCurrency(w.ownerPay)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold">
                        {formatCurrency(w.totalPay)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-600">
                        {formatCurrency(w.avgPerJob)}
                      </td>
                      <td className="px-3 py-2.5 text-center pr-4">
                        {w.requires1099 ? (
                          <Badge variant="warning">Yes</Badge>
                        ) : (
                          <span className="text-gray-400">--</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {earningsSort.sorted.length > 1 && (
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                      <td className="px-4 py-2.5">Total</td>
                      <td className="px-3 py-2.5 text-right">
                        {earningsSort.sorted.reduce((s, w) => s + w.jobsWorked, 0)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {earningsSort.sorted
                          .reduce((s, w) => s + w.totalShares, 0)
                          .toFixed(1)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {formatCurrency(
                          earningsSort.sorted.reduce((s, w) => s + w.workerPoolPay, 0)
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {formatCurrency(
                          earningsSort.sorted.reduce((s, w) => s + w.ownerPay, 0)
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {formatCurrency(
                          earningsSort.sorted.reduce((s, w) => s + w.totalPay, 0)
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-400">--</td>
                      <td className="px-3 py-2.5 pr-4" />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 1099 Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt size={18} />
            1099 Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {ten99Summary.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No 1099 data</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">
                      Worker
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">
                      Total Paid
                    </th>
                    <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase">
                      Requires 1099
                    </th>
                    <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500 uppercase">
                      W-9 On File
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {ten99Summary.map((e) => (
                    <tr key={e.userId} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{e.userName}</td>
                      <td className="px-3 py-2.5 text-right font-medium">
                        {formatCurrency(e.totalPaid)}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {e.requires1099 ? (
                          <Badge variant="warning">Yes - 1099 Required</Badge>
                        ) : (
                          <Badge variant="default">Below Threshold</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {e.w9OnFile ? (
                          <Badge variant="success">On File</Badge>
                        ) : (
                          <Badge variant="danger">Missing</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Tab: Tax ───────────────────────────────────────────────────────────

function TaxTab({
  loading,
  pnl,
  scheduleCData,
  ten99Summary,
}: {
  loading: boolean;
  pnl: PnlData | null;
  scheduleCData: ScheduleCLine[];
  ten99Summary: Ten99Entry[];
}) {
  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <TableSkeleton rows={10} />
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalScheduleC = scheduleCData.reduce((s, l) => s + l.amount, 0);

  return (
    <div className="space-y-6">
      {/* Tax Summary Banner */}
      {pnl && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-indigo-900 mb-4">
            Tax Period Summary
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-indigo-600 font-medium">Gross Revenue</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(pnl?.grossRevenue ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-indigo-600 font-medium">Total Expenses</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(pnl.operatingExpenses.total)}
              </p>
            </div>
            <div>
              <p className="text-sm text-indigo-600 font-medium">Net Profit</p>
              <p
                className={cn(
                  "text-xl font-bold",
                  pnl?.netProfit ?? 0 >= 0 ? "text-green-700" : "text-red-700"
                )}
              >
                {formatCurrency(pnl?.netProfit ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-indigo-600 font-medium">
                Est. SE Tax (15.3%)
              </p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(Math.max(pnl?.netProfit ?? 0 * 0.153, 0))}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Schedule C Mapping */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText size={18} />
            Schedule C Line Items
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {scheduleCData.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No Schedule C data</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">
                      Line
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">
                      Category
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {scheduleCData.map((line, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-600 font-mono text-xs">
                        {line.line}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-gray-900">
                        {line.category}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium">
                        {formatCurrency(line.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                    <td className="px-4 py-2.5" />
                    <td className="px-3 py-2.5">Total Deductions</td>
                    <td className="px-4 py-2.5 text-right">
                      {formatCurrency(totalScheduleC)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expense Detail from P&L */}
      {pnl && pnl?.operatingExpenses?.byCategory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt size={18} />
              Expense Detail
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">
                      Category
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">
                      Amount
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">
                      % of Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pnl?.operatingExpenses?.byCategory.map((cat) => (
                    <tr key={cat.name} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{cat.name}</td>
                      <td className="px-3 py-2.5 text-right font-medium">
                        {formatCurrency(cat.amount)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-600">
                        {pnl.operatingExpenses.total > 0
                          ? formatPct((cat.amount / pnl.operatingExpenses.total) * 100)
                          : "--"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                    <td className="px-4 py-2.5">Total Expenses</td>
                    <td className="px-3 py-2.5 text-right">
                      {formatCurrency(pnl.operatingExpenses.total)}
                    </td>
                    <td className="px-4 py-2.5 text-right">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 1099 Summary for Tax Tab */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle size={18} />
            1099-NEC Filing Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ten99Summary.length === 0 ? (
            <div className="text-center text-gray-500 py-6">No contractor payments</div>
          ) : (
            <>
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900">{ten99Summary.length}</p>
                  <p className="text-xs text-gray-500">Contractors</p>
                </div>
                <div className="text-center p-3 bg-amber-50 rounded-lg">
                  <p className="text-2xl font-bold text-amber-700">
                    {ten99Summary.filter((e) => e.requires1099).length}
                  </p>
                  <p className="text-xs text-gray-500">1099s Required</p>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <p className="text-2xl font-bold text-red-700">
                    {ten99Summary.filter((e) => e.requires1099 && !e.w9OnFile).length}
                  </p>
                  <p className="text-xs text-gray-500">Missing W-9s</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">
                        Contractor
                      </th>
                      <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">
                        Total Paid
                      </th>
                      <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500 uppercase">
                        W-9
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {ten99Summary.map((e) => (
                      <tr
                        key={e.userId}
                        className={cn(
                          "hover:bg-gray-50",
                          e.requires1099 && !e.w9OnFile && "bg-red-50"
                        )}
                      >
                        <td className="px-4 py-2.5 font-medium text-gray-900">
                          {e.userName}
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium">
                          {formatCurrency(e.totalPaid)}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {e.requires1099 ? (
                            <Badge variant="warning">1099 Required</Badge>
                          ) : (
                            <Badge variant="default">Under $600</Badge>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {e.w9OnFile ? (
                            <CheckCircle size={16} className="text-green-500 inline" />
                          ) : e.requires1099 ? (
                            <AlertTriangle size={16} className="text-red-500 inline" />
                          ) : (
                            <span className="text-gray-400">--</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                      <td className="px-4 py-2.5">Total</td>
                      <td className="px-3 py-2.5 text-right">
                        {formatCurrency(ten99Summary.reduce((s, e) => s + e.totalPaid, 0))}
                      </td>
                      <td className="px-3 py-2.5" />
                      <td className="px-4 py-2.5" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
