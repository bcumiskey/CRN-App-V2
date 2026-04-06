"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, Plus, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import Badge from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";

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

const tabs = [
  { label: "All", value: "" },
  { label: "Scheduled", value: "SCHEDULED" },
  { label: "In Progress", value: "IN_PROGRESS" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
];

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("");

  useEffect(() => {
    setLoading(true);
    api
      .get<{ jobs: Job[] }>("/jobs", { status: activeTab || undefined })
      .then((data) => setJobs(data.jobs))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeTab]);

  return (
    <div className="p-6 max-w-6xl">
      <PageHeader
        title="Jobs"
        subtitle="Manage cleaning jobs"
        actions={
          <Link href="/jobs/new">
            <Button variant="primary">
              <Plus size={16} />
              Add Job
            </Button>
          </Link>
        }
      />

      {/* Filter Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.value
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Jobs Table */}
      <Card>
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
        ) : jobs.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<ClipboardList size={40} />}
              title="No jobs found"
              description={activeTab ? "Try a different filter" : "Add your first job to get started"}
            />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Job #</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Date</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Property</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Type</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Status</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Crew</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Fee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {jobs.map((job) => (
                <tr
                  key={job.id}
                  onClick={() => router.push(`/jobs/${job.id}`)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{job.jobNumber}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {formatDate(job.scheduledDate)}
                    {job.scheduledTime && <span className="text-gray-400 ml-1">{formatTime(job.scheduledTime)}</span>}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{job.property.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {job.jobType}
                    {job.isBtoB && (
                      <Badge variant="warning" className="ml-2 bg-orange-50 text-orange-600">B2B</Badge>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {job.assignments.map((a) => a.user.name).join(", ") || "-"}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">{formatCurrency(job.totalFee)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
