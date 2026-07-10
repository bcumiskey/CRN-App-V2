"use client";

import { ReactNode } from "react";
import { Clock, MapPin, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import Badge, { StatusBadge } from "@/components/ui/Badge";
import { formatTime } from "@/lib/utils";
import type { WorkerJob } from "./lib";

/**
 * One job as the worker sees it: property, time, address, crew, status —
 * with optional action buttons (Start / Complete on the Today page).
 */
export function JobCard({ job, actions }: { job: WorkerJob; actions?: ReactNode }) {
  const title = job.property?.name ?? job.jobTypeLabel ?? job.jobType;
  const crew = job.assignments.map((a) => a.userName).join(", ");

  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900">{title}</h3>
            {job.isBtoB && <Badge variant="purple">B2B</Badge>}
            <StatusBadge status={job.status} />
          </div>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
            <Clock size={14} className="shrink-0" />
            {job.scheduledTime ? formatTime(job.scheduledTime) : "Anytime"}
          </p>
          {job.property?.address && (
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
              <MapPin size={14} className="shrink-0" />
              {job.property.address}
            </p>
          )}
          {crew && (
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
              <Users size={14} className="shrink-0" />
              {crew}
            </p>
          )}
          {job.notes && <p className="text-sm text-gray-600 mt-2">{job.notes}</p>}
        </div>
        {actions && <div className="flex flex-col gap-2 shrink-0">{actions}</div>}
      </CardContent>
    </Card>
  );
}
