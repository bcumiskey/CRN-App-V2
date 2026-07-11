"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn, formatDate } from "@/lib/utils";
import { JobCard } from "../JobCard";
import { portalApi, VIEW_AS_EVENT } from "../portal-api";
import {
  addDaysYMD,
  parseYMD,
  startOfWeekYMD,
  todayYMD,
  type WorkerJob,
} from "../lib";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function TeamPortalSchedulePage() {
  const today = useMemo(() => todayYMD(), []);
  const [weekStart, setWeekStart] = useState(() => startOfWeekYMD(todayYMD()));
  const [selectedDate, setSelectedDate] = useState(today);
  const [jobs, setJobs] = useState<WorkerJob[]>([]);
  const [loading, setLoading] = useState(true);

  const weekEnd = addDaysYMD(weekStart, 6);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysYMD(weekStart, i)),
    [weekStart]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await portalApi.get<{ jobs: WorkerJob[]; startDate: string; endDate: string }>(
        "/worker/schedule",
        { startDate: weekStart, endDate: weekEnd }
      );
      setJobs(data.jobs);
    } catch (err) {
      console.error("Failed to load schedule:", err);
    } finally {
      setLoading(false);
    }
  }, [weekStart, weekEnd]);

  useEffect(() => {
    load();
    // Admin "viewing as" changed → reload for the newly selected worker.
    window.addEventListener(VIEW_AS_EVENT, load);
    return () => window.removeEventListener(VIEW_AS_EVENT, load);
  }, [load]);

  const changeWeek = (direction: -1 | 1) => {
    const next = addDaysYMD(weekStart, direction * 7);
    setWeekStart(next);
    // Keep "today" selected when navigating back to the current week
    const nextEnd = addDaysYMD(next, 6);
    setSelectedDate(today >= next && today <= nextEnd ? today : next);
  };

  const jobsByDay = useMemo(() => {
    const map: Record<string, WorkerJob[]> = {};
    for (const job of jobs) {
      (map[job.scheduledDate] ??= []).push(job);
    }
    return map;
  }, [jobs]);

  const dayJobs = jobsByDay[selectedDate] ?? [];

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => changeWeek(-1)} aria-label="Previous week">
          <ChevronLeft size={16} />
        </Button>
        <p className="text-sm font-medium text-gray-700">
          {formatDate(weekStart)} – {formatDate(weekEnd)}
        </p>
        <Button variant="outline" size="sm" onClick={() => changeWeek(1)} aria-label="Next week">
          <ChevronRight size={16} />
        </Button>
      </div>

      {/* Week strip — like the mobile app */}
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((day) => {
          const count = jobsByDay[day]?.length ?? 0;
          const isSelected = day === selectedDate;
          const isToday = day === today;
          return (
            <button
              key={day}
              onClick={() => setSelectedDate(day)}
              className={cn(
                "flex flex-col items-center rounded-lg py-2 text-sm transition-colors",
                isSelected
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
              )}
            >
              <span className={cn("text-xs", isSelected ? "text-blue-100" : "text-gray-400")}>
                {DAY_LABELS[parseYMD(day).getDay()]}
              </span>
              <span className={cn("font-semibold", isToday && !isSelected && "text-blue-600")}>
                {parseYMD(day).getDate()}
              </span>
              <span
                className={cn(
                  "mt-0.5 h-1.5 w-1.5 rounded-full",
                  count > 0 ? (isSelected ? "bg-white" : "bg-blue-500") : "bg-transparent"
                )}
              />
            </button>
          );
        })}
      </div>

      {/* Selected day's jobs */}
      {loading ? (
        <div className="animate-pulse text-gray-500 py-12 text-center">Loading schedule...</div>
      ) : dayJobs.length === 0 ? (
        <EmptyState
          icon={<CalendarDays size={40} />}
          title={`No jobs on ${formatDate(selectedDate)}`}
          description="Jobs assigned to you on this day will show up here."
        />
      ) : (
        <div className="space-y-4">
          {dayJobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}
