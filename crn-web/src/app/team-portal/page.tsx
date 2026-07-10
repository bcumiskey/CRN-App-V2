"use client";

import { useCallback, useEffect, useState } from "react";
import { Sun, Play, CheckCircle } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/utils";
import { JobCard } from "./JobCard";
import type { WorkerJob } from "./lib";

function toast(msg: string, type: "success" | "error" = "success") {
  const div = document.createElement("div");
  div.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-white text-sm ${type === "error" ? "bg-red-600" : "bg-green-600"}`;
  div.textContent = msg;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 5000);
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const data = err.data as { error?: string } | null;
    if (data?.error) return data.error;
    return `${fallback} (${err.status})`;
  }
  return fallback;
}

export default function TeamPortalTodayPage() {
  const [jobs, setJobs] = useState<WorkerJob[]>([]);
  const [date, setDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ jobs: WorkerJob[]; date: string }>("/worker/today");
      setJobs(data.jobs);
      setDate(data.date);
    } catch (err) {
      console.error("Failed to load today's jobs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = async (job: WorkerJob, status: "IN_PROGRESS" | "COMPLETED") => {
    if (status === "COMPLETED") {
      const name = job.property?.name ?? job.jobTypeLabel ?? job.jobType;
      if (!window.confirm(`Mark "${name}" as completed?`)) return;
    }
    setUpdatingId(job.id);
    try {
      await api.patch(`/worker/jobs/${job.id}/status`, { status });
      toast(status === "IN_PROGRESS" ? "Job started" : "Job completed");
      await load();
    } catch (err) {
      console.error("Failed to update job status:", err);
      toast(errorMessage(err, "Failed to update job status"), "error");
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return <div className="animate-pulse text-gray-500 py-12 text-center">Loading today&apos;s jobs...</div>;
  }

  return (
    <div className="space-y-4">
      {date && (
        <p className="text-sm text-gray-500">
          {formatDate(date)} — {jobs.length === 1 ? "1 job" : `${jobs.length} jobs`}
        </p>
      )}

      {jobs.length === 0 ? (
        <EmptyState
          icon={<Sun size={40} />}
          title="No jobs today"
          description="Jobs assigned to you for today will show up here."
        />
      ) : (
        jobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            actions={
              job.status === "SCHEDULED" ? (
                <Button
                  size="sm"
                  loading={updatingId === job.id}
                  onClick={() => updateStatus(job, "IN_PROGRESS")}
                >
                  <Play size={14} />
                  Start
                </Button>
              ) : job.status === "IN_PROGRESS" ? (
                <Button
                  size="sm"
                  variant="success"
                  loading={updatingId === job.id}
                  onClick={() => updateStatus(job, "COMPLETED")}
                >
                  <CheckCircle size={14} />
                  Complete
                </Button>
              ) : undefined
            }
          />
        ))
      )}
    </div>
  );
}
