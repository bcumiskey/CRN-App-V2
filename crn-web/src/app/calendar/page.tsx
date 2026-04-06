"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  addMonths,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, RefreshCw, Settings, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";
import { formatTime, cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────

interface Job {
  id: string;
  scheduledDate: string;
  scheduledTime: string | null;
  status: string;
  source: string;
  jobType: string;
  property: { name: string };
  assignments?: { user: { name: string } }[];
}

interface HoverPreview {
  day: Date;
  jobs: Job[];
  x: number;
  y: number;
}

// ── Helpers ────────────────────────────────────────────────────────

/** Generate a hex color from property name */
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

function showToast(message: string, type: "success" | "error" = "success") {
  if (type === "error") console.error("[Toast]", message);
  else console.log("[Toast]", message);
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

export default function CalendarPage() {
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hoverPreview, setHoverPreview] = useState<HoverPreview | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle date click - go to jobs page with date pre-selected
  const handleDateClick = (date: Date) => {
    const formattedDate = format(date, "yyyy-MM-dd");
    router.push(`/jobs?newJob=true&date=${formattedDate}`);
  };

  // Handle hover with 2 second delay
  const handleDayHover = useCallback(
    (e: React.MouseEvent, day: Date, dayJobs: Job[]) => {
      if (dayJobs.length === 0) return;
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      hoverTimeoutRef.current = setTimeout(() => {
        setHoverPreview({
          day,
          jobs: dayJobs,
          x: rect.left + rect.width / 2,
          y: rect.bottom + 8,
        });
      }, 2000);
    },
    []
  );

  const handleDayLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoverPreview(null);
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [currentMonth]);

  const fetchJobs = async () => {
    setIsLoading(true);
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

  const handleSyncCalendars = async () => {
    setIsSyncing(true);
    try {
      const [calendarRes, recurringRes] = await Promise.allSettled([
        api.post<{ summary?: { jobsCreated?: number; unmatchedEvents?: number } }>(
          "/calendar-sources/sync",
          {}
        ),
        api.post<{ totalJobsCreated?: number }>("/recurring-schedules/generate", {}),
      ]);

      const messages: string[] = [];

      if (calendarRes.status === "fulfilled") {
        const calendarCreated = calendarRes.value.summary?.jobsCreated || 0;
        const unmatched = calendarRes.value.summary?.unmatchedEvents || 0;
        if (calendarCreated > 0) {
          messages.push(`${calendarCreated} from calendars`);
        }
        if (unmatched > 0) {
          showToast(`${unmatched} calendar events couldn't be matched to properties`, "error");
        }
      }

      if (recurringRes.status === "fulfilled") {
        const recurringCreated = recurringRes.value.totalJobsCreated || 0;
        if (recurringCreated > 0) {
          messages.push(`${recurringCreated} from recurring schedules`);
        }
      }

      if (messages.length > 0) {
        showToast(`Created: ${messages.join(", ")}`);
        fetchJobs();
      } else {
        showToast("Calendars are up to date");
      }
    } catch {
      showToast("Failed to sync calendars", "error");
    } finally {
      setIsSyncing(false);
    }
  };

  // Calendar grid computation
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDay = monthStart.getDay();
  const paddedDays: (Date | null)[] = [...Array(startDay).fill(null), ...days];

  const getJobsForDay = useCallback(
    (date: Date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      return jobs.filter((job) => job.scheduledDate === dateStr);
    },
    [jobs]
  );

  // Get color styles for a job based on property color and status
  const getJobColorStyle = (job: Job) => {
    const baseColor = getPropertyColor(job.property.name);
    const isCompleted = job.status === "COMPLETED";
    return {
      backgroundColor: isCompleted ? `${baseColor}30` : `${baseColor}20`,
      color: baseColor,
      borderLeft: `3px solid ${baseColor}`,
    };
  };

  return (
    <div className="p-6 max-w-6xl">
      <PageHeader
        title="Calendar"
        subtitle="Click any date to add a job. Jobs from calendars, recurring schedules, or added manually."
        actions={
          <div className="flex gap-2">
            <Button size="sm" onClick={() => router.push("/jobs?newJob=true")}>
              <Plus size={16} />
              Add Job
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push("/settings/calendar")}>
              <Settings size={16} />
              Calendar Sources
            </Button>
            <Button variant="outline" size="sm" onClick={handleSyncCalendars} loading={isSyncing}>
              <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} />
              Sync Calendars
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent>
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-xl font-semibold">{format(currentMonth, "MMMM yyyy")}</h2>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
            {/* Day Headers */}
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                className="bg-gray-50 p-3 text-center text-sm font-medium text-gray-500"
              >
                {day}
              </div>
            ))}

            {/* Calendar Days */}
            {paddedDays.map((day, index) => {
              if (!day) {
                return <div key={`empty-${index}`} className="bg-white p-2 min-h-[100px]" />;
              }

              const dayJobs = getJobsForDay(day);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => handleDateClick(day)}
                  onMouseEnter={(e) => handleDayHover(e, day, dayJobs)}
                  onMouseLeave={handleDayLeave}
                  className={cn(
                    "bg-white p-2 min-h-[100px] cursor-pointer hover:bg-gray-50 transition-colors",
                    isToday && "bg-blue-50 hover:bg-blue-100"
                  )}
                >
                  <div
                    className={cn(
                      "text-sm font-medium mb-1",
                      isToday ? "text-blue-600" : "text-gray-900"
                    )}
                  >
                    {format(day, "d")}
                  </div>
                  <div className="space-y-1">
                    {dayJobs.slice(0, 3).map((job) => {
                      const colorStyle = getJobColorStyle(job);
                      const isCompleted = job.status === "COMPLETED";
                      return (
                        <div
                          key={job.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/jobs?highlight=${job.id}`);
                          }}
                          className="text-xs p-1 rounded truncate cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
                          style={colorStyle}
                        >
                          {isCompleted && <span className="opacity-60">&#x2713; </span>}
                          {job.scheduledTime && (
                            <span className="font-medium">{formatTime(job.scheduledTime)} </span>
                          )}
                          {job.property.name}
                          {job.assignments && job.assignments.length > 0 && (
                            <div className="text-[10px] opacity-70 truncate">
                              {job.assignments.map((a) => a.user.name.split(" ")[0]).join(", ")}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {dayJobs.length > 3 && (
                      <div className="text-xs text-gray-500">+{dayJobs.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Hover Preview Tooltip */}
      {hoverPreview && (
        <div
          className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-3 min-w-[200px] max-w-[300px]"
          style={{
            left: `${hoverPreview.x}px`,
            top: `${hoverPreview.y}px`,
            transform: "translateX(-50%)",
          }}
          onMouseEnter={() => {
            if (hoverTimeoutRef.current) {
              clearTimeout(hoverTimeoutRef.current);
            }
          }}
          onMouseLeave={handleDayLeave}
        >
          <div className="text-sm font-semibold text-gray-900 mb-2 border-b pb-2">
            {format(hoverPreview.day, "EEEE, MMMM d")}
          </div>
          <div className="space-y-2">
            {hoverPreview.jobs.map((job) => {
              const colorStyle = getJobColorStyle(job);
              const isCompleted = job.status === "COMPLETED";
              return (
                <div
                  key={job.id}
                  className="p-2 rounded text-sm cursor-pointer hover:ring-2 hover:ring-blue-400"
                  style={colorStyle}
                  onClick={() => router.push(`/jobs?highlight=${job.id}`)}
                >
                  <div className="font-medium">
                    {isCompleted && <span className="opacity-60">&#x2713; </span>}
                    {job.property.name}
                  </div>
                  {job.scheduledTime && (
                    <div className="text-xs opacity-75">{formatTime(job.scheduledTime)}</div>
                  )}
                  {job.assignments && job.assignments.length > 0 && (
                    <div className="text-xs opacity-75">
                      Team: {job.assignments.map((a) => a.user.name).join(", ")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
