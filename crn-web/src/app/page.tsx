"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import { calculateJob } from "crn-shared";
import type { FinancialModel } from "crn-shared";

interface Job {
  id: string;
  jobNumber: string;
  scheduledDate: string;
  scheduledTime?: string;
  jobType: string;
  status: string;
  totalFee: number;
  houseCutPercent: number;
  isBtoB: boolean;
  property: { name: string };
  assignments: Array<{ share: number; user: { name: string } }>;
}

interface Stats {
  jobsThisMonth: number;
  jobsCompleted: number;
  revenueThisMonth: number;
  outstandingInvoices: number;
  outstandingAmount: number;
}

const statusColor: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export default function DashboardPage() {
  const [todayJobs, setTodayJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<{ jobs: Job[] }>("/dashboard/today"),
      api.get<Stats>("/dashboard/stats"),
    ]).then(([today, statsData]) => {
      setTodayJobs(today.jobs);
      setStats(statsData);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const today = new Date();
  const greeting = today.getHours() < 12 ? "Good morning" : today.getHours() < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="p-6 max-w-6xl">
      <h1 className="text-2xl font-bold text-gray-900">{greeting}</h1>
      <p className="text-gray-500 mb-6">
        {today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
      </p>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Jobs This Month" value={`${stats.jobsCompleted}/${stats.jobsThisMonth}`} />
          <StatCard label="Revenue" value={`$${stats.revenueThisMonth.toLocaleString()}`} />
          <StatCard label="Outstanding" value={`$${stats.outstandingAmount.toLocaleString()}`} />
          <StatCard label="Overdue Invoices" value={String(stats.outstandingInvoices)} />
        </div>
      )}

      {/* Today's Jobs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Today {todayJobs.length > 0 && `(${todayJobs.length})`}
          </h2>
          <Link href="/jobs/new" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            + Add Job
          </Link>
        </div>

        {loading ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : todayJobs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No jobs today</p>
            <p className="text-gray-400 text-sm mt-1">Enjoy your day off!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {todayJobs.map((job) => (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="flex items-center gap-4 p-4 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900">{job.property.name}</span>
                    {job.isBtoB && (
                      <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">B2B</span>
                    )}
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[job.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {job.status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {job.scheduledTime && `${job.scheduledTime} · `}{job.jobType} · {job.assignments.map(a => a.user.name).join(", ")}
                  </p>
                </div>
                <span className="text-lg font-semibold text-gray-900">${job.totalFee}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Jobs</h2>
        <UpcomingJobs />
      </div>
    </div>
  );
}

function UpcomingJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  useEffect(() => {
    api.get<{ jobs: Job[] }>("/jobs", { status: "SCHEDULED", limit: 10 })
      .then((data) => setJobs(data.jobs))
      .catch(console.error);
  }, []);

  if (jobs.length === 0) return <p className="text-gray-400 text-sm">No upcoming jobs</p>;

  return (
    <div className="space-y-2">
      {jobs.map((job) => (
        <Link
          key={job.id}
          href={`/jobs/${job.id}`}
          className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <div>
            <span className="font-medium text-gray-900">{job.property.name}</span>
            <span className="text-sm text-gray-400 ml-2">{job.scheduledDate}{job.scheduledTime ? ` at ${job.scheduledTime}` : ""}</span>
          </div>
          <span className="text-sm font-medium text-gray-600">${job.totalFee}</span>
        </Link>
      ))}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}
