"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import {
  DollarSign,
  Clock,
  Users,
  FileText,
  Building,
  Calendar,
  Plus,
  ChevronRight,
  Package,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Badge, { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────

interface DashboardStats {
  monthlyRevenue: number;
  pendingFromClients: number;
  owedToTeam: number;
  draftInvoices: number;
  lowStockItems: number;
  jobsThisMonth: number;
  jobsCompleted: number;
  outstandingInvoices: number;
  outstandingAmount: number;
}

interface TodayJob {
  id: string;
  jobNumber: string;
  scheduledDate: string;
  scheduledTime: string | null;
  jobType: string;
  status: string;
  totalFee: number;
  houseCutPercent: number;
  isBtoB: boolean;
  property: { id: string; name: string; address?: string };
  assignments: Array<{ share: number; user: { name: string } }>;
}

interface UpcomingJob {
  id: string;
  scheduledDate: string;
  property: { name: string };
  totalFee: number;
}

// ── Main Page ──────────────────────────────────────────────────────

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    monthlyRevenue: 0,
    pendingFromClients: 0,
    owedToTeam: 0,
    draftInvoices: 0,
    lowStockItems: 0,
    jobsThisMonth: 0,
    jobsCompleted: 0,
    outstandingInvoices: 0,
    outstandingAmount: 0,
  });
  const [todayJobs, setTodayJobs] = useState<TodayJob[]>([]);
  const [upcomingJobs, setUpcomingJobs] = useState<UpcomingJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [todayData, statsData, upcomingData] = await Promise.allSettled([
        api.get<{ jobs: TodayJob[] }>("/dashboard/today"),
        api.get<DashboardStats>("/dashboard/stats"),
        api.get<{ jobs: UpcomingJob[] }>("/jobs", { status: "SCHEDULED", limit: 10 }),
      ]);

      if (todayData.status === "fulfilled") {
        setTodayJobs(todayData.value.jobs || []);
      }
      if (statsData.status === "fulfilled") {
        setStats((prev) => ({ ...prev, ...statsData.value }));
      }
      if (upcomingData.status === "fulfilled") {
        setUpcomingJobs(upcomingData.value.jobs || []);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const today = new Date();
  const greeting =
    today.getHours() < 12
      ? "Good morning"
      : today.getHours() < 17
        ? "Good afternoon"
        : "Good evening";

  const hasData =
    todayJobs.length > 0 || upcomingJobs.length > 0 || stats.monthlyRevenue > 0;

  return (
    <div className="p-6 max-w-6xl">
      <PageHeader
        title={greeting}
        subtitle={today.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
      />

      {/* Welcome Banner - Show when no data */}
      {!isLoading && !hasData && (
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white mb-6">
          <h2 className="text-2xl font-bold mb-2">Welcome to Cleaning Right Now!</h2>
          <p className="text-blue-100 mb-4">
            Get started by adding your first property, team member, or scheduling a job.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/properties">
              <Button variant="secondary" size="sm">
                <Building size={16} />
                Add Property
              </Button>
            </Link>
            <Link href="/team">
              <Button variant="secondary" size="sm">
                <Users size={16} />
                Add Team Member
              </Button>
            </Link>
            <Link href="/jobs">
              <Button variant="secondary" size="sm">
                <Calendar size={16} />
                Schedule Job
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <StatCard
          label="Monthly Revenue"
          value={formatCurrency(stats.monthlyRevenue)}
          icon={DollarSign}
          iconColor="bg-green-100 text-green-600"
        />
        <StatCard
          label="Pending from Clients"
          value={formatCurrency(stats.pendingFromClients)}
          icon={Clock}
          iconColor="bg-amber-100 text-amber-600"
        />
        <StatCard
          label="Owed to Team"
          value={formatCurrency(stats.owedToTeam)}
          icon={Users}
          iconColor="bg-blue-100 text-blue-600"
        />
        <StatCard
          label="Draft Invoices"
          value={stats.draftInvoices.toString()}
          icon={FileText}
          iconColor="bg-purple-100 text-purple-600"
        />
        <StatCard
          label="Low Stock Items"
          value={stats.lowStockItems.toString()}
          icon={Package}
          iconColor="bg-red-100 text-red-600"
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Jobs */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Today&apos;s Jobs</CardTitle>
                <Link
                  href="/jobs"
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  View All <ChevronRight size={16} />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-gray-400 text-sm py-8 text-center">Loading...</p>
              ) : todayJobs.length === 0 ? (
                <EmptyState
                  icon={<Calendar size={40} />}
                  title="No jobs scheduled for today"
                  description="Schedule a new job or check your calendar for upcoming appointments."
                  action={{
                    label: "Schedule Job",
                    onClick: () => (window.location.href = "/jobs"),
                  }}
                />
              ) : (
                <div className="space-y-3">
                  {todayJobs.map((job) => {
                    const isCompleted = job.status === "COMPLETED";
                    return (
                      <Link
                        key={job.id}
                        href={`/jobs?highlight=${job.id}`}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                              isCompleted ? "bg-green-100" : "bg-blue-100"
                            }`}
                          >
                            <Building
                              className={isCompleted ? "text-green-600" : "text-blue-600"}
                              size={24}
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-medium text-gray-900">
                                {job.property.name}
                              </span>
                              {job.isBtoB && (
                                <Badge variant="warning" className="bg-orange-50 text-orange-600">
                                  B2B
                                </Badge>
                              )}
                              <StatusBadge status={job.status} />
                            </div>
                            <div className="text-sm text-gray-500">
                              {job.scheduledTime
                                ? formatTime(job.scheduledTime)
                                : "No time set"}
                              {job.assignments.length > 0 && (
                                <span className="ml-2">
                                  &bull;{" "}
                                  {job.assignments.map((a) => a.user.name).join(", ")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className="text-lg font-semibold text-gray-900">
                          {formatCurrency(job.totalFee)}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link
                href="/jobs?newJob=true"
                className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <Plus size={18} className="text-gray-400" />
                <span className="text-gray-700">New Job</span>
              </Link>
              <Link
                href="/properties"
                className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <Building size={18} className="text-gray-400" />
                <span className="text-gray-700">Add Property</span>
              </Link>
              <Link
                href="/calendar"
                className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <Calendar size={18} className="text-gray-400" />
                <span className="text-gray-700">View Calendar</span>
              </Link>
              <Link
                href="/team"
                className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <Users size={18} className="text-gray-400" />
                <span className="text-gray-700">Manage Team</span>
              </Link>
            </CardContent>
          </Card>

          {/* Upcoming Jobs */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Upcoming</CardTitle>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                  {upcomingJobs.length}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {upcomingJobs.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No upcoming jobs</p>
              ) : (
                <div className="space-y-3">
                  {upcomingJobs.slice(0, 5).map((job) => (
                    <Link
                      key={job.id}
                      href={`/jobs?highlight=${job.id}`}
                      className="flex items-center justify-between text-sm hover:bg-gray-50 p-2 rounded-lg transition-colors"
                    >
                      <span className="text-gray-700 font-medium">{job.property.name}</span>
                      <div className="text-right">
                        <span className="text-gray-500">{formatDate(job.scheduledDate)}</span>
                        <span className="text-gray-900 font-medium ml-2">
                          {formatCurrency(job.totalFee)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── Stat Card Component ───────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  icon: typeof DollarSign;
  iconColor: string;
}

function StatCard({ label, value, icon: Icon, iconColor }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${iconColor}`}>
          <Icon size={24} />
        </div>
      </CardContent>
    </Card>
  );
}
