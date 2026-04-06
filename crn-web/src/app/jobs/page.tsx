"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { calculateJob } from "crn-shared";
import type { FinancialModel } from "crn-shared";
import { format, parseISO } from "date-fns";
import {
  Calendar,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  Check,
  X,
  Users,
  MapPin,
  Clock,
  DollarSign,
  RefreshCw,
  Repeat,
  Play,
  Pause,
  Building,
  History,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import Badge, { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { formatCurrency, formatDate, formatTime, cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────

interface JobAssignment {
  id: string;
  share: number;
  isOwner: boolean;
  paidAt: string | null;
  paymentMethod: string | null;
  user: { id: string; name: string; imageUrl?: string | null };
}

interface Job {
  id: string;
  jobNumber: string;
  scheduledDate: string;
  scheduledTime: string | null;
  priority: number;
  totalFee: number;
  houseCutPercent: number;
  status: string;
  clientPaid: boolean;
  teamPaid: boolean;
  teamPaidAt: string | null;
  source: string;
  jobType: string;
  isBtoB: boolean;
  property: { id: string; name: string };
  assignments: JobAssignment[];
}

interface Property {
  id: string;
  name: string;
  defaultFee: number;
}

interface TeamMember {
  id: string;
  name: string;
  imageUrl?: string | null;
  role?: string;
}

// ── Constants ──────────────────────────────────────────────────────

const PAYMENT_METHODS = [
  { value: "venmo", label: "Venmo" },
  { value: "zelle", label: "Zelle" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
];

const PRIORITY_OPTIONS = [
  { value: "1", label: "1 - Highest" },
  { value: "2", label: "2 - High" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "5", label: "5 - Normal" },
  { value: "6", label: "6" },
  { value: "7", label: "7" },
  { value: "8", label: "8 - Low" },
  { value: "9", label: "9" },
  { value: "10", label: "10 - Lowest" },
];

// Default financial model — will be fetched from company settings
const DEFAULT_MODEL: FinancialModel = {
  buckets: [
    { name: "Business Expenses", percent: 10, type: "business" },
    { name: "Owner Profit", percent: 10, type: "owner" },
    { name: "Worker Pool", percent: 80, type: "worker_pool" },
  ],
};

// ── Helpers ────────────────────────────────────────────────────────

const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const getAvatarColor = (name: string) => {
  const colors = [
    "bg-blue-500", "bg-green-500", "bg-purple-500", "bg-pink-500",
    "bg-indigo-500", "bg-teal-500", "bg-orange-500", "bg-cyan-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

/** Generate a hex color from property name (since V2 has no stored color) */
const getPropertyColor = (name: string): string => {
  const palette = [
    "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b",
    "#ef4444", "#06b6d4", "#ec4899", "#14b8a6",
    "#f97316", "#6366f1", "#84cc16", "#d946ef",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
};

/** Simple toast - logs + shows a brief on-screen notification */
function showToast(message: string, type: "success" | "error" = "success") {
  if (type === "error") {
    console.error("[Toast]", message);
  } else {
    console.log("[Toast]", message);
  }
  // Create a brief visual toast
  const el = document.createElement("div");
  el.className = `fixed bottom-4 right-4 z-[100] px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium transition-opacity ${
    type === "error" ? "bg-red-600" : "bg-green-600"
  }`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 300);
  }, 2500);
}

// ── Main Page ──────────────────────────────────────────────────────

export default function JobsPage() {
  return (
    <Suspense fallback={<JobsPageLoading />}>
      <JobsPageContent />
    </Suspense>
  );
}

function JobsPageLoading() {
  return (
    <div className="p-6 max-w-6xl">
      <PageHeader title="Jobs & Payments" subtitle="Loading..." />
      <div className="text-center py-12 text-gray-500">Loading...</div>
    </div>
  );
}

function JobsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const tabParam = searchParams.get("tab");
  const newJobParam = searchParams.get("newJob");
  const dateParam = searchParams.get("date");

  const [activeTab, setActiveTab] = useState<"jobs" | "recurring">(
    tabParam === "recurring" ? "recurring" : "jobs"
  );
  const [jobs, setJobs] = useState<Job[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [financialModel, setFinancialModel] = useState<FinancialModel>(DEFAULT_MODEL);

  // Team payment modal state
  const [showTeamPaymentModal, setShowTeamPaymentModal] = useState(false);
  const [selectedJobForTeamPayment, setSelectedJobForTeamPayment] = useState<Job | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("");

  // Expanded jobs state
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());

  const toggleJobExpanded = (jobId: string) => {
    setExpandedJobs((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  };

  // State for pre-selected date from calendar
  const [preselectedDate, setPreselectedDate] = useState<string | null>(null);

  useEffect(() => {
    fetchJobs();
    fetchProperties();
    fetchTeamMembers();
    fetchFinancialModel();
  }, [currentMonth]);

  // Scroll to highlighted job
  useEffect(() => {
    if (highlightId) {
      setTimeout(() => {
        const element = document.getElementById(`job-${highlightId}`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          element.classList.add("ring-2", "ring-blue-500");
          setTimeout(() => {
            element.classList.remove("ring-2", "ring-blue-500");
          }, 3000);
        }
      }, 100);
    }
  }, [highlightId, jobs]);

  // Open new job modal if coming from calendar
  useEffect(() => {
    if (newJobParam === "true") {
      setPreselectedDate(dateParam);
      setEditingJob(null);
      setShowModal(true);
      router.replace("/jobs");
    }
  }, [newJobParam, dateParam, router]);

  const fetchJobs = async () => {
    try {
      const month = currentMonth.getMonth() + 1;
      const year = currentMonth.getFullYear();
      const data = await api.get<{ jobs: Job[] }>("/jobs", { month, year });
      setJobs(data.jobs || []);
    } catch (error) {
      console.error("Failed to fetch jobs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProperties = async () => {
    try {
      const data = await api.get<{ properties: Property[] }>("/properties");
      setProperties(data.properties || []);
    } catch (error) {
      console.error("Failed to fetch properties:", error);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const data = await api.get<{ users: TeamMember[] }>("/users");
      setTeamMembers(data.users || []);
    } catch (error) {
      console.error("Failed to fetch team members:", error);
    }
  };

  const fetchFinancialModel = async () => {
    try {
      const data = await api.get<{ financialModel?: FinancialModel }>("/settings");
      if (data.financialModel) {
        setFinancialModel(data.financialModel);
      }
    } catch {
      // Use default model
    }
  };

  const computeJobFinancials = useCallback(
    (job: Job) => {
      try {
        return calculateJob(financialModel, {
          totalFee: job.totalFee,
          houseCutPercent: job.houseCutPercent,
          charges: [],
          assignments: job.assignments.map((a) => ({
            userId: a.user.id,
            userName: a.user.name,
            share: a.share ?? 1,
            isOwner: a.isOwner ?? false,
          })),
        });
      } catch {
        return null;
      }
    },
    [financialModel]
  );

  // ── CRUD Handlers ───────────────────────────────────────────────

  const handleSave = async (data: Record<string, unknown>) => {
    try {
      const payload = {
        ...data,
        totalFee: parseFloat(String(data.totalFee)) || 0,
        houseCutPercent: parseFloat(String(data.houseCutPercent)) || 12,
        priority: parseInt(String(data.priority)) || 5,
      };

      if (editingJob) {
        await api.patch(`/jobs/${editingJob.id}`, payload);
        showToast("Job updated");
      } else {
        await api.post("/jobs", payload);
        showToast("Job created");
      }
      setShowModal(false);
      setEditingJob(null);
      fetchJobs();
    } catch (error) {
      showToast("Failed to save job", "error");
    }
  };

  const handleDelete = async (jobId: string) => {
    if (!confirm("Delete this job?")) return;
    try {
      await api.delete(`/jobs/${jobId}`);
      showToast("Job deleted");
      fetchJobs();
    } catch {
      showToast("Failed to delete job", "error");
    }
  };

  const handleStatusChange = async (jobId: string, field: string, value: boolean | string) => {
    try {
      if (field === "status") {
        await api.patch(`/jobs/${jobId}`, { status: value });
        showToast(value === "COMPLETED" ? "Job marked complete!" : "Status updated");
      } else if (field === "clientPaid") {
        await api.patch(`/jobs/${jobId}`, { clientPaid: value });
        showToast(value ? "Client marked as paid" : "Client payment unmarked");
      } else if (field === "teamPaid") {
        await api.patch(`/jobs/${jobId}`, { teamPaid: value });
        showToast(value ? "Team marked as paid" : "Team payment unmarked");
      }
      fetchJobs();
    } catch {
      showToast("Failed to update job", "error");
    }
  };

  const handleEdit = (job: Job) => {
    setEditingJob(job);
    setShowModal(true);
  };

  const handleTeamPayment = async (jobId: string, paymentMethod: string | null) => {
    try {
      await api.post(`/jobs/${jobId}/team-payment`, { paymentMethod });
      if (paymentMethod) {
        showToast(`Team marked as paid via ${PAYMENT_METHODS.find((p) => p.value === paymentMethod)?.label}`);
      } else {
        showToast("Team payment cleared");
      }
      setShowTeamPaymentModal(false);
      setSelectedJobForTeamPayment(null);
      setSelectedPaymentMethod("");
      fetchJobs();
    } catch {
      showToast("Failed to update team payment", "error");
    }
  };

  // ── Computed Values ─────────────────────────────────────────────

  const totalRevenue = jobs.reduce((sum, job) => sum + job.totalFee, 0);
  const completedJobs = jobs.filter((j) => j.status === "COMPLETED").length;

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  // Group jobs by date
  const jobsByDate = jobs.reduce(
    (acc, job) => {
      const dateKey = job.scheduledDate; // already YYYY-MM-DD
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(job);
      return acc;
    },
    {} as Record<string, Job[]>
  );

  // Sort each day's jobs by priority
  for (const dateKey of Object.keys(jobsByDate)) {
    jobsByDate[dateKey].sort((a, b) => (a.priority || 5) - (b.priority || 5));
  }

  const sortedDates = Object.keys(jobsByDate).sort();

  return (
    <div className="p-6 max-w-6xl">
      <PageHeader
        title="Jobs & Payments"
        subtitle={`${format(currentMonth, "MMMM yyyy")} - ${jobs.length} jobs`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              onClick={() => {
                setEditingJob(null);
                setShowModal(true);
              }}
            >
              <Plus size={16} />
              Add Job
            </Button>
            <Button variant="outline" onClick={() => router.push("/team")}>
              <History size={16} />
              Pay History
            </Button>
          </div>
        }
      />

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit mb-6">
        <button
          onClick={() => setActiveTab("jobs")}
          className={cn(
            "px-4 py-2 rounded-md text-sm font-medium transition-colors",
            activeTab === "jobs"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          )}
        >
          <Calendar size={16} className="inline mr-2" />
          Jobs
        </button>
        <button
          onClick={() => setActiveTab("recurring")}
          className={cn(
            "px-4 py-2 rounded-md text-sm font-medium transition-colors",
            activeTab === "recurring"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          )}
        >
          <Repeat size={16} className="inline mr-2" />
          Recurring Schedules
        </button>
      </div>

      {activeTab === "jobs" && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Total Jobs</p>
                    <p className="text-2xl font-bold">{jobs.length}</p>
                  </div>
                  <Calendar className="text-blue-500" size={24} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Completed</p>
                    <p className="text-2xl font-bold text-green-600">{completedJobs}</p>
                  </div>
                  <Check className="text-green-500" size={24} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Revenue</p>
                    <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
                  </div>
                  <DollarSign className="text-emerald-500" size={24} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Pending</p>
                    <p className="text-2xl font-bold text-amber-600">
                      {jobs.filter((j) => j.status === "SCHEDULED").length}
                    </p>
                  </div>
                  <Clock className="text-amber-500" size={24} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Month Navigation */}
          <Card className="mb-6">
            <CardContent className="flex items-center justify-between py-3">
              <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg">
                <ChevronLeft size={20} />
              </button>
              <h3 className="text-lg font-semibold">{format(currentMonth, "MMMM yyyy")}</h3>
              <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg">
                <ChevronRight size={20} />
              </button>
            </CardContent>
          </Card>

          {/* Jobs List */}
          {isLoading ? (
            <Card>
              <CardContent className="text-center py-12 text-gray-500">Loading...</CardContent>
            </Card>
          ) : jobs.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <EmptyState
                  icon={<Calendar size={40} />}
                  title="No jobs this month"
                  description="Add a job or sync your calendars to get started."
                  action={{
                    label: "Add Job",
                    onClick: () => setShowModal(true),
                  }}
                />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {sortedDates.map((dateKey) => (
                <div key={dateKey}>
                  <h4 className="text-sm font-semibold text-gray-500 mb-2 px-1">
                    {formatDate(dateKey)}
                  </h4>
                  <div className="space-y-2">
                    {jobsByDate[dateKey].map((job) => {
                      const financials = computeJobFinancials(job);
                      const isExpanded = expandedJobs.has(job.id);
                      const isCompleted = job.status === "COMPLETED";
                      const propColor = getPropertyColor(job.property.name);

                      const getJobStyle = () => ({
                        backgroundColor: isCompleted ? `${propColor}40` : `${propColor}20`,
                        borderColor: propColor,
                        borderWidth: "1px",
                        borderStyle: "solid" as const,
                      });

                      return (
                        <Card
                          key={job.id}
                          id={`job-${job.id}`}
                          className="transition-all cursor-pointer"
                          style={getJobStyle()}
                        >
                          <CardContent className="p-3 sm:p-4">
                            {/* Main row - always visible */}
                            <div
                              className="flex items-center gap-3"
                              onClick={() => toggleJobExpanded(job.id)}
                            >
                              {/* Property Icon */}
                              <div
                                className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: `${propColor}30` }}
                              >
                                {isCompleted ? (
                                  <Check style={{ color: propColor }} size={20} />
                                ) : (
                                  <MapPin style={{ color: propColor }} size={20} />
                                )}
                              </div>

                              {/* Property Name & Fee */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <h3 className="font-semibold text-gray-900 truncate">
                                      {job.property.name}
                                    </h3>
                                    {job.isBtoB && (
                                      <Badge variant="warning" className="bg-orange-50 text-orange-600 flex-shrink-0">
                                        B2B
                                      </Badge>
                                    )}
                                  </div>
                                  <span className="font-semibold text-gray-900 flex-shrink-0">
                                    {formatCurrency(job.totalFee)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {/* Time */}
                                  {job.scheduledTime && (
                                    <span className="text-xs text-gray-500 flex items-center gap-1">
                                      <Clock size={12} />
                                      {formatTime(job.scheduledTime)}
                                    </span>
                                  )}
                                  {/* Priority badge */}
                                  {(job.priority || 5) <= 3 && (
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                        (job.priority || 5) <= 2
                                          ? "bg-red-100 text-red-700"
                                          : "bg-amber-100 text-amber-700"
                                      }`}
                                    >
                                      P{job.priority}
                                    </span>
                                  )}
                                  {/* Status */}
                                  <StatusBadge status={job.status} />
                                </div>
                              </div>

                              {/* Team Member Avatars */}
                              <div className="flex items-center -space-x-2 flex-shrink-0">
                                {job.assignments.length > 0 ? (
                                  <>
                                    {job.assignments.slice(0, 3).map((a, idx) => (
                                      <div
                                        key={a.user.id}
                                        className={cn(
                                          "w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-white",
                                          getAvatarColor(a.user.name)
                                        )}
                                        style={{ zIndex: 3 - idx }}
                                        title={a.user.name}
                                      >
                                        {getInitials(a.user.name)}
                                      </div>
                                    ))}
                                    {job.assignments.length > 3 && (
                                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-400 text-white text-xs font-medium border-2 border-white">
                                        +{job.assignments.length - 3}
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-200 text-gray-400 border-2 border-white"
                                    title="Unassigned"
                                  >
                                    <AlertCircle size={16} />
                                  </div>
                                )}
                              </div>

                              {/* Expand/Collapse */}
                              <div className="flex-shrink-0 text-gray-400">
                                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                              </div>
                            </div>

                            {/* Expanded Details */}
                            {isExpanded && (
                              <div className="mt-4 pt-4 border-t space-y-4">
                                {/* Financial Breakdown */}
                                {financials && (
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                    <div className="bg-white/60 rounded-lg p-2">
                                      <p className="text-gray-500 text-xs">Gross</p>
                                      <p className="font-semibold">{formatCurrency(financials.grossRevenue)}</p>
                                    </div>
                                    <div className="bg-white/60 rounded-lg p-2">
                                      <p className="text-gray-500 text-xs">House Cut</p>
                                      <p className="font-semibold">{formatCurrency(financials.houseCutAmount)}</p>
                                    </div>
                                    <div className="bg-white/60 rounded-lg p-2">
                                      <p className="text-gray-500 text-xs">Net Revenue</p>
                                      <p className="font-semibold">{formatCurrency(financials.netRevenue)}</p>
                                    </div>
                                    <div className="bg-white/60 rounded-lg p-2">
                                      <p className="text-gray-500 text-xs">Worker Pool</p>
                                      <p className="font-semibold">{formatCurrency(financials.workerPoolAmount)}</p>
                                    </div>
                                  </div>
                                )}

                                {/* Team Members Detail */}
                                <div className="flex flex-wrap gap-2">
                                  {job.assignments.length > 0 ? (
                                    job.assignments.map((a) => {
                                      const workerPay = financials?.workerPayments.find(
                                        (w) => w.userId === a.user.id
                                      );
                                      return (
                                        <div
                                          key={a.user.id}
                                          className="flex items-center gap-2 bg-white/60 rounded-lg px-3 py-2"
                                        >
                                          <div
                                            className={cn(
                                              "w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium",
                                              getAvatarColor(a.user.name)
                                            )}
                                          >
                                            {getInitials(a.user.name)}
                                          </div>
                                          <span className="text-sm font-medium text-gray-700">
                                            {a.user.name}
                                          </span>
                                          {workerPay && (
                                            <span className="text-xs text-gray-500">
                                              {formatCurrency(workerPay.totalPay)}
                                            </span>
                                          )}
                                          {a.paidAt && (
                                            <Check size={12} className="text-green-500" />
                                          )}
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <span className="text-sm text-amber-600 flex items-center gap-1">
                                      <AlertCircle size={14} />
                                      No team assigned
                                    </span>
                                  )}
                                </div>

                                {/* Meta Info */}
                                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                                  <span
                                    className={`px-2 py-1 rounded text-xs font-medium ${
                                      (job.priority || 5) <= 2
                                        ? "bg-red-100 text-red-700"
                                        : (job.priority || 5) <= 4
                                          ? "bg-amber-100 text-amber-700"
                                          : (job.priority || 5) <= 6
                                            ? "bg-gray-100 text-gray-700"
                                            : "bg-blue-100 text-blue-700"
                                    }`}
                                  >
                                    Priority {job.priority || 5}
                                  </span>
                                  <span className="capitalize">Source: {job.source || "manual"}</span>
                                  <span>Type: {job.jobType}</span>
                                  {job.jobNumber && <span>#{job.jobNumber}</span>}
                                </div>

                                {/* Actions Row */}
                                <div className="flex items-center justify-between pt-2 border-t">
                                  {/* Status Controls */}
                                  <div className="flex items-center gap-4">
                                    {/* Job Completion Toggle */}
                                    <label
                                      className="flex items-center gap-2 cursor-pointer"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isCompleted}
                                        onChange={(e) =>
                                          handleStatusChange(
                                            job.id,
                                            "status",
                                            e.target.checked ? "COMPLETED" : "SCHEDULED"
                                          )
                                        }
                                        className="w-5 h-5 text-green-600 rounded"
                                      />
                                      <span className="text-sm text-gray-700">Complete</span>
                                    </label>

                                    {/* Client Paid */}
                                    <label
                                      className="flex items-center gap-2 cursor-pointer"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={job.clientPaid}
                                        onChange={(e) =>
                                          handleStatusChange(job.id, "clientPaid", e.target.checked)
                                        }
                                        className="w-5 h-5 text-blue-600 rounded"
                                      />
                                      <span className="text-sm text-gray-700">Client Paid</span>
                                    </label>

                                    {/* Team Payment Button */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedJobForTeamPayment(job);
                                        setShowTeamPaymentModal(true);
                                      }}
                                      className={cn(
                                        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium",
                                        job.teamPaid
                                          ? "bg-blue-100 text-blue-700"
                                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                      )}
                                    >
                                      {job.teamPaid ? (
                                        <>
                                          <Check size={14} />
                                          {job.assignments[0]?.paymentMethod
                                            ? PAYMENT_METHODS.find(
                                                (p) => p.value === job.assignments[0]?.paymentMethod
                                              )?.label
                                            : "Paid"}
                                        </>
                                      ) : (
                                        "Pay Team"
                                      )}
                                    </button>
                                  </div>

                                  {/* Edit/Delete Actions */}
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEdit(job);
                                      }}
                                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                    >
                                      <Pencil size={18} />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(job.id);
                                      }}
                                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                    >
                                      <Trash2 size={18} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Recurring Schedules Tab */}
      {activeTab === "recurring" && <RecurringSchedulesTab />}

      {/* Job Create/Edit Modal */}
      <JobModal
        open={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingJob(null);
          setPreselectedDate(null);
        }}
        onSave={handleSave}
        properties={properties}
        teamMembers={teamMembers}
        editingJob={editingJob}
        preselectedDate={preselectedDate}
      />

      {/* Team Payment Modal */}
      <Modal
        open={showTeamPaymentModal}
        onClose={() => {
          setShowTeamPaymentModal(false);
          setSelectedJobForTeamPayment(null);
          setSelectedPaymentMethod("");
        }}
        title="Team Payment"
        size="sm"
      >
        {selectedJobForTeamPayment && (
          <TeamPaymentContent
            job={selectedJobForTeamPayment}
            financialModel={financialModel}
            selectedPaymentMethod={selectedPaymentMethod}
            setSelectedPaymentMethod={setSelectedPaymentMethod}
            onPay={handleTeamPayment}
            onClose={() => {
              setShowTeamPaymentModal(false);
              setSelectedJobForTeamPayment(null);
              setSelectedPaymentMethod("");
            }}
          />
        )}
      </Modal>
    </div>
  );
}

// ── Team Payment Content ──────────────────────────────────────────

interface TeamPaymentContentProps {
  job: Job;
  financialModel: FinancialModel;
  selectedPaymentMethod: string;
  setSelectedPaymentMethod: (v: string) => void;
  onPay: (jobId: string, method: string | null) => void;
  onClose: () => void;
}

function TeamPaymentContent({
  job,
  financialModel,
  selectedPaymentMethod,
  setSelectedPaymentMethod,
  onPay,
  onClose,
}: TeamPaymentContentProps) {
  let perPersonAmount = 0;
  try {
    const result = calculateJob(financialModel, {
      totalFee: job.totalFee,
      houseCutPercent: job.houseCutPercent,
      charges: [],
      assignments: job.assignments.map((a) => ({
        userId: a.user.id,
        userName: a.user.name,
        share: a.share ?? 1,
        isOwner: a.isOwner ?? false,
      })),
    });
    if (result.workerPayments.length > 0) {
      perPersonAmount = result.workerPayments[0].totalPay;
    }
  } catch {
    // fallback
  }

  return (
    <div className="space-y-4">
      <div className="text-center pb-4 border-b">
        <p className="font-medium text-gray-900">{job.property.name}</p>
        <p className="text-sm text-gray-500">{formatDate(job.scheduledDate)}</p>
        <p className="text-lg font-semibold text-blue-600 mt-1">
          {formatCurrency(perPersonAmount)} per person
        </p>
      </div>

      {job.teamPaid ? (
        <>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
            <Check size={32} className="mx-auto text-blue-600 mb-2" />
            <p className="font-medium text-blue-800">Team Already Paid</p>
            <p className="text-sm text-blue-600 mt-1">
              via{" "}
              {PAYMENT_METHODS.find((p) => p.value === job.assignments[0]?.paymentMethod)?.label ||
                "Unknown Method"}
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Close
            </Button>
            <Button
              variant="outline"
              className="flex-1 text-red-600 hover:bg-red-50"
              onClick={() => onPay(job.id, null)}
            >
              <X size={16} />
              Clear Payment
            </Button>
          </div>
        </>
      ) : (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Payment Method
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method.value}
                  onClick={() => setSelectedPaymentMethod(method.value)}
                  className={cn(
                    "p-3 rounded-lg border-2 text-center font-medium transition-colors",
                    selectedPaymentMethod === method.value
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-gray-200 hover:border-gray-300 text-gray-700"
                  )}
                >
                  {method.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={!selectedPaymentMethod}
              onClick={() => onPay(job.id, selectedPaymentMethod)}
            >
              <Check size={16} />
              Mark as Paid
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Job Modal ─────────────────────────────────────────────────────

interface JobModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => void;
  properties: Property[];
  teamMembers: TeamMember[];
  editingJob: Job | null;
  preselectedDate?: string | null;
}

function JobModal({
  open,
  onClose,
  onSave,
  properties,
  teamMembers,
  editingJob,
  preselectedDate,
}: JobModalProps) {
  const [formData, setFormData] = useState({
    propertyId: "",
    scheduledDate: format(new Date(), "yyyy-MM-dd"),
    scheduledTime: "",
    priority: "5",
    totalFee: "",
    houseCutPercent: "12",
    jobType: "STANDARD",
    userIds: [] as string[],
    status: "SCHEDULED",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (editingJob) {
        setFormData({
          propertyId: editingJob.property.id,
          scheduledDate: editingJob.scheduledDate,
          scheduledTime: editingJob.scheduledTime || "",
          priority: (editingJob.priority || 5).toString(),
          totalFee: editingJob.totalFee.toString(),
          houseCutPercent: (editingJob.houseCutPercent || 12).toString(),
          jobType: editingJob.jobType || "STANDARD",
          userIds: editingJob.assignments.map((a) => a.user.id),
          status: editingJob.status,
        });
      } else {
        setFormData({
          propertyId: "",
          scheduledDate: preselectedDate || format(new Date(), "yyyy-MM-dd"),
          scheduledTime: "",
          priority: "5",
          totalFee: "",
          houseCutPercent: "12",
          jobType: "STANDARD",
          userIds: [],
          status: "SCHEDULED",
        });
      }
    }
  }, [open, editingJob, preselectedDate]);

  const handlePropertyChange = (propertyId: string) => {
    const property = properties.find((p) => p.id === propertyId);
    setFormData((prev) => ({
      ...prev,
      propertyId,
      totalFee: property ? property.defaultFee.toString() : prev.totalFee,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(formData);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTeamMember = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      userIds: prev.userIds.includes(id) ? prev.userIds.filter((i) => i !== id) : [...prev.userIds, id],
    }));
  };

  return (
    <Modal open={open} onClose={onClose} title={editingJob ? "Edit Job" : "Schedule Job"} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Property Select */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Property</label>
          <select
            value={formData.propertyId}
            onChange={(e) => handlePropertyChange(e.target.value)}
            required
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select a property</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Date"
            type="date"
            value={formData.scheduledDate}
            onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
            required
          />
          <Input
            label="Time"
            type="time"
            value={formData.scheduledTime}
            onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {PRIORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Total Fee"
            type="number"
            step="0.01"
            value={formData.totalFee}
            onChange={(e) => setFormData({ ...formData, totalFee: e.target.value })}
            required
          />
          <Input
            label="House Cut %"
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={formData.houseCutPercent}
            onChange={(e) => setFormData({ ...formData, houseCutPercent: e.target.value })}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job Type</label>
            <select
              value={formData.jobType}
              onChange={(e) => setFormData({ ...formData, jobType: e.target.value })}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="STANDARD">Standard</option>
              <option value="DEEP_CLEAN">Deep Clean</option>
              <option value="MOVE_IN">Move In</option>
              <option value="MOVE_OUT">Move Out</option>
              <option value="POST_CONSTRUCTION">Post Construction</option>
              <option value="COMMERCIAL">Commercial</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Assign Team</label>
          <div className="flex flex-wrap gap-2">
            {teamMembers.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => toggleTeamMember(member.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  formData.userIds.includes(member.id)
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                )}
              >
                <div
                  className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                    formData.userIds.includes(member.id) ? "bg-blue-400 text-white" : getAvatarColor(member.name) + " text-white"
                  )}
                >
                  {getInitials(member.name)}
                </div>
                {member.name}
              </button>
            ))}
            {teamMembers.length === 0 && (
              <p className="text-sm text-gray-500">No team members yet</p>
            )}
          </div>
        </div>

        {editingJob && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="SCHEDULED">Scheduled</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSaving}>
            {editingJob ? "Save Changes" : "Schedule Job"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Recurring Schedules Tab ───────────────────────────────────────

interface Schedule {
  id: string;
  name: string;
  propertyId: string;
  property: { id: string; name: string; defaultFee: number };
  isActive: boolean;
  frequency: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  time: string | null;
  totalFee: number | null;
  houseCutPercent: number;
  generateAheadDays: number;
  lastGeneratedDate: string | null;
}

const DAYS_OF_WEEK = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

const FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
];

function RecurringSchedulesTab() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);

  useEffect(() => {
    fetchSchedules();
    fetchProps();
  }, []);

  const fetchSchedules = async () => {
    try {
      const data = await api.get<{ schedules: Schedule[] }>("/recurring-schedules");
      setSchedules(data.schedules || []);
    } catch (error) {
      console.error("Failed to fetch schedules:", error);
    }
  };

  const fetchProps = async () => {
    try {
      const data = await api.get<{ properties: Property[] }>("/properties");
      setProperties(data.properties || []);
    } catch {
      // ignore
    }
  };

  const handleSaveSchedule = async (data: Record<string, unknown>) => {
    try {
      if (editingSchedule) {
        await api.patch(`/recurring-schedules/${editingSchedule.id}`, data);
        showToast("Schedule updated");
      } else {
        await api.post("/recurring-schedules", data);
        showToast("Schedule created");
      }
      setShowScheduleModal(false);
      setEditingSchedule(null);
      fetchSchedules();
    } catch {
      showToast("Failed to save schedule", "error");
    }
  };

  const handleDeleteSchedule = async (schedule: Schedule) => {
    if (!confirm(`Delete schedule "${schedule.name}"?`)) return;
    try {
      await api.delete(`/recurring-schedules/${schedule.id}`);
      showToast("Schedule deleted");
      fetchSchedules();
    } catch {
      showToast("Failed to delete schedule", "error");
    }
  };

  const handleToggleScheduleActive = async (schedule: Schedule) => {
    try {
      await api.patch(`/recurring-schedules/${schedule.id}`, {
        isActive: !schedule.isActive,
      });
      showToast(schedule.isActive ? "Schedule paused" : "Schedule activated");
      fetchSchedules();
    } catch {
      showToast("Failed to update schedule", "error");
    }
  };

  const handleGenerateScheduleJobs = async (scheduleId?: string) => {
    setIsGenerating(true);
    try {
      if (scheduleId) {
        const data = await api.post<{ message: string }>("/recurring-schedules/generate", {
          scheduleId,
        });
        showToast(data.message || "Jobs generated");
      } else {
        const data = await api.post<{ message: string }>("/recurring-schedules/generate", {});
        showToast(data.message || "All jobs generated");
      }
      fetchSchedules();
    } catch {
      showToast("Failed to generate jobs", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const getFrequencyLabel = (schedule: Schedule) => {
    switch (schedule.frequency) {
      case "daily":
        return "Daily";
      case "weekly":
        return `Weekly on ${DAYS_OF_WEEK.find((d) => d.value === String(schedule.dayOfWeek))?.label || ""}`;
      case "biweekly":
        return `Bi-weekly on ${DAYS_OF_WEEK.find((d) => d.value === String(schedule.dayOfWeek))?.label || ""}`;
      case "monthly": {
        const day = schedule.dayOfMonth;
        const suffix =
          day === 1 || day === 21 || day === 31
            ? "st"
            : day === 2 || day === 22
              ? "nd"
              : day === 3 || day === 23
                ? "rd"
                : "th";
        return `Monthly on the ${day}${suffix}`;
      }
      default:
        return schedule.frequency;
    }
  };

  const activeSchedules = schedules.filter((s) => s.isActive);

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">
          {activeSchedules.length} active schedule{activeSchedules.length !== 1 && "s"} generating
          jobs automatically
        </p>
        <div className="flex gap-3">
          {activeSchedules.length > 0 && (
            <Button variant="outline" onClick={() => handleGenerateScheduleJobs()} loading={isGenerating}>
              <RefreshCw size={16} />
              Generate All Jobs
            </Button>
          )}
          <Button
            onClick={() => {
              setEditingSchedule(null);
              setShowScheduleModal(true);
            }}
          >
            <Plus size={16} />
            Add Schedule
          </Button>
        </div>
      </div>

      {schedules.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<Repeat size={40} />}
              title="No recurring schedules"
              description="Create recurring schedules to automatically generate jobs on a regular basis."
              action={{
                label: "Add Schedule",
                onClick: () => setShowScheduleModal(true),
              }}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {schedules.map((schedule) => (
            <Card key={schedule.id} className={!schedule.isActive ? "opacity-60" : ""}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-lg flex items-center justify-center",
                        schedule.isActive ? "bg-blue-100" : "bg-gray-100"
                      )}
                    >
                      <Repeat
                        className={schedule.isActive ? "text-blue-600" : "text-gray-400"}
                        size={24}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-900">{schedule.name}</h4>
                        <Badge variant={schedule.isActive ? "success" : "default"}>
                          {schedule.isActive ? "Active" : "Paused"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Building size={12} />
                          {schedule.property.name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {getFrequencyLabel(schedule)}
                          {schedule.time && ` at ${schedule.time}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">
                        {formatCurrency(schedule.totalFee || schedule.property.defaultFee)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {schedule.generateAheadDays} days ahead
                      </div>
                    </div>

                    <div className="flex items-center gap-1 border-l pl-4">
                      {schedule.isActive && (
                        <button
                          onClick={() => handleGenerateScheduleJobs(schedule.id)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Generate jobs now"
                        >
                          <RefreshCw size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => handleToggleScheduleActive(schedule)}
                        className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded"
                        title={schedule.isActive ? "Pause schedule" : "Activate schedule"}
                      >
                        {schedule.isActive ? <Pause size={16} /> : <Play size={16} />}
                      </button>
                      <button
                        onClick={() => {
                          setEditingSchedule(schedule);
                          setShowScheduleModal(true);
                        }}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteSchedule(schedule)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Schedule Modal */}
      <ScheduleModal
        open={showScheduleModal}
        onClose={() => {
          setShowScheduleModal(false);
          setEditingSchedule(null);
        }}
        onSave={handleSaveSchedule}
        schedule={editingSchedule}
        properties={properties}
      />
    </>
  );
}

// ── Schedule Modal ────────────────────────────────────────────────

interface ScheduleModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => void;
  schedule: Schedule | null;
  properties: Property[];
}

function ScheduleModal({ open, onClose, onSave, schedule, properties }: ScheduleModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    propertyId: "",
    frequency: "weekly",
    dayOfWeek: "1",
    dayOfMonth: "1",
    time: "",
    totalFee: "",
    houseCutPercent: "12",
    generateAheadDays: "30",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (schedule) {
        setFormData({
          name: schedule.name,
          propertyId: schedule.propertyId,
          frequency: schedule.frequency,
          dayOfWeek: schedule.dayOfWeek?.toString() || "1",
          dayOfMonth: schedule.dayOfMonth?.toString() || "1",
          time: schedule.time || "",
          totalFee: schedule.totalFee?.toString() || "",
          houseCutPercent: schedule.houseCutPercent.toString(),
          generateAheadDays: schedule.generateAheadDays.toString(),
        });
      } else {
        setFormData({
          name: "",
          propertyId: "",
          frequency: "weekly",
          dayOfWeek: "1",
          dayOfMonth: "1",
          time: "",
          totalFee: "",
          houseCutPercent: "12",
          generateAheadDays: "30",
        });
      }
    }
  }, [schedule, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(formData);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedProperty = properties.find((p) => p.id === formData.propertyId);

  return (
    <Modal open={open} onClose={onClose} title={schedule ? "Edit Schedule" : "Add Recurring Schedule"} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Schedule Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Weekly Deep Clean"
          required
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Property</label>
          <select
            value={formData.propertyId}
            onChange={(e) => setFormData({ ...formData, propertyId: e.target.value })}
            required
            disabled={!!schedule}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          >
            <option value="">Select a property</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({formatCurrency(p.defaultFee)})
              </option>
            ))}
          </select>
        </div>

        <div className="border-t pt-4">
          <h4 className="font-medium text-gray-900 mb-3">Schedule Pattern</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
              <select
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            {(formData.frequency === "weekly" || formData.frequency === "biweekly") && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Day of Week</label>
                <select
                  value={formData.dayOfWeek}
                  onChange={(e) => setFormData({ ...formData, dayOfWeek: e.target.value })}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {formData.frequency === "monthly" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Day of Month</label>
                <select
                  value={formData.dayOfMonth}
                  onChange={(e) => setFormData({ ...formData, dayOfMonth: e.target.value })}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {Array.from({ length: 31 }, (_, i) => (
                    <option key={i + 1} value={String(i + 1)}>
                      {i + 1}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="mt-4">
            <Input
              label="Time (optional)"
              type="time"
              value={formData.time}
              onChange={(e) => setFormData({ ...formData, time: e.target.value })}
            />
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className="font-medium text-gray-900 mb-3">Job Settings</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Total Fee (optional)"
              type="number"
              step="0.01"
              value={formData.totalFee}
              onChange={(e) => setFormData({ ...formData, totalFee: e.target.value })}
              placeholder={selectedProperty ? selectedProperty.defaultFee.toString() : "Property fee"}
            />
            <Input
              label="House Cut %"
              type="number"
              value={formData.houseCutPercent}
              onChange={(e) => setFormData({ ...formData, houseCutPercent: e.target.value })}
            />
            <Input
              label="Generate Ahead (days)"
              type="number"
              value={formData.generateAheadDays}
              onChange={(e) => setFormData({ ...formData, generateAheadDays: e.target.value })}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Jobs will be auto-generated up to {formData.generateAheadDays} days in advance.
            {!formData.totalFee &&
              selectedProperty &&
              ` Using property fee: ${formatCurrency(selectedProperty.defaultFee)}`}
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSaving}>
            {schedule ? "Save Changes" : "Add Schedule"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
