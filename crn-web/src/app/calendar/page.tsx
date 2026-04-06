"use client";

import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";
import { formatTime } from "@/lib/utils";

interface Job {
  id: string;
  jobNumber: string;
  scheduledDate: string;
  scheduledTime?: string;
  jobType: string;
  status: string;
  totalFee: number;
  property: { name: string };
  assignments: Array<{ user: { name: string } }>;
}

const statusColor: Record<string, string> = {
  SCHEDULED: "bg-blue-50 border-blue-200 text-blue-700",
  IN_PROGRESS: "bg-yellow-50 border-yellow-200 text-yellow-700",
  COMPLETED: "bg-green-50 border-green-200 text-green-700",
  CANCELLED: "bg-red-50 border-red-200 text-red-700 opacity-50",
};

function getWeekDates(baseDate: Date): Date[] {
  const start = new Date(baseDate);
  const day = start.getDay();
  start.setDate(start.getDate() - day); // Start from Sunday
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function formatDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function isSameDay(d1: Date, d2: Date): boolean {
  return formatDateStr(d1) === formatDateStr(d2);
}

export default function CalendarPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const baseDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  }, [weekOffset]);

  const weekDates = useMemo(() => getWeekDates(baseDate), [baseDate]);
  const startDate = formatDateStr(weekDates[0]);
  const endDate = formatDateStr(weekDates[6]);

  useEffect(() => {
    setLoading(true);
    api
      .get<{ jobs: Job[] }>("/jobs", { startDate, endDate })
      .then((data) => setJobs(data.jobs))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  const jobsByDate = useMemo(() => {
    const map: Record<string, Job[]> = {};
    for (const date of weekDates) {
      map[formatDateStr(date)] = [];
    }
    for (const job of jobs) {
      const key = job.scheduledDate;
      if (map[key]) {
        map[key].push(job);
      }
    }
    return map;
  }, [jobs, weekDates]);

  const today = new Date();

  return (
    <div className="p-6 max-w-6xl">
      <PageHeader
        title="Calendar"
        subtitle={`${weekDates[0].toLocaleDateString("en-US", { month: "long", day: "numeric" })} - ${weekDates[6].toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setWeekOffset((o) => o - 1)}>
              <ChevronLeft size={20} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>
              Today
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setWeekOffset((o) => o + 1)}>
              <ChevronRight size={20} />
            </Button>
          </div>
        }
      />

      {/* Week Strip */}
      <div className="grid grid-cols-7 gap-4">
        {weekDates.map((date) => {
          const dateStr = formatDateStr(date);
          const dayJobs = jobsByDate[dateStr] || [];
          const isToday = isSameDay(date, today);

          return (
            <div key={dateStr} className="min-h-[200px]">
              {/* Day Header */}
              <div
                className={`text-center p-2 rounded-lg mb-2 ${
                  isToday ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"
                }`}
              >
                <p className="text-xs font-medium uppercase">
                  {date.toLocaleDateString("en-US", { weekday: "short" })}
                </p>
                <p className="text-lg font-bold">{date.getDate()}</p>
              </div>

              {/* Jobs */}
              <div className="space-y-2">
                {loading ? (
                  <div className="h-12 bg-gray-50 rounded-lg animate-pulse" />
                ) : dayJobs.length === 0 ? (
                  <p className="text-xs text-gray-300 text-center py-4">-</p>
                ) : (
                  dayJobs.map((job) => (
                    <Link
                      key={job.id}
                      href={`/jobs/${job.id}`}
                      className={`block p-2 rounded-lg border text-xs transition-colors hover:shadow-sm ${
                        statusColor[job.status] ?? "bg-gray-50 border-gray-200 text-gray-700"
                      }`}
                    >
                      <p className="font-semibold truncate">{job.property.name}</p>
                      {job.scheduledTime && <p className="opacity-75">{formatTime(job.scheduledTime)}</p>}
                      <p className="opacity-75 truncate">
                        {job.assignments.map((a) => a.user.name).join(", ") || job.jobType}
                      </p>
                    </Link>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
