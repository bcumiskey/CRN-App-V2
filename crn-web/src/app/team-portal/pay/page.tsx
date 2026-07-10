"use client";

import { useEffect, useState } from "react";
import { Wallet, Briefcase, CalendarRange } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDate } from "@/lib/utils";

interface WorkerPayJob {
  jobId: string;
  date: string;
  propertyName: string;
  jobType: string;
  yourPay: number;
}

interface WorkerPay {
  periodId: string;
  periodLabel: string;
  periodStatus: string;
  startDate: string;
  endDate: string;
  jobsWorked: number;
  totalEarned: number;
  jobs: WorkerPayJob[];
}

export default function TeamPortalPayPage() {
  const [pay, setPay] = useState<WorkerPay | null>(null);
  const [loading, setLoading] = useState(true);
  const [noPeriod, setNoPeriod] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.get<WorkerPay>("/worker/pay");
        setPay(data);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          setNoPeriod(true);
        } else {
          console.error("Failed to load pay data:", err);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return <div className="animate-pulse text-gray-500 py-12 text-center">Loading pay...</div>;
  }

  if (noPeriod || !pay) {
    return (
      <EmptyState
        icon={<Wallet size={40} />}
        title="No open pay period"
        description="Earnings will show here once a pay period is open."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <CalendarRange size={16} />
              Pay Period
            </div>
            <p className="text-sm font-semibold text-gray-900 mt-2">{pay.periodLabel}</p>
            <div className="mt-1">
              <StatusBadge status={pay.periodStatus} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <Briefcase size={16} />
              Jobs Worked
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-2">{pay.jobsWorked}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <Wallet size={16} />
              Total Earned
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-2">
              {formatCurrency(pay.totalEarned)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Job breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Jobs This Period</CardTitle>
        </CardHeader>
        {pay.jobs.length === 0 ? (
          <CardContent>
            <EmptyState
              icon={<Briefcase size={40} />}
              title="No jobs in this period"
              description="Completed jobs assigned to you will be listed here."
            />
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="px-4 sm:px-6 py-3 font-medium">Date</th>
                  <th className="px-4 sm:px-6 py-3 font-medium">Property</th>
                  <th className="px-4 sm:px-6 py-3 font-medium">Type</th>
                  <th className="px-4 sm:px-6 py-3 font-medium text-right">Your Pay</th>
                </tr>
              </thead>
              <tbody>
                {pay.jobs.map((job) => (
                  <tr key={job.jobId} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 sm:px-6 py-3 text-gray-700">{formatDate(job.date)}</td>
                    <td className="px-4 sm:px-6 py-3 text-gray-900 font-medium">
                      {job.propertyName}
                    </td>
                    <td className="px-4 sm:px-6 py-3 text-gray-700">{job.jobType}</td>
                    <td className="px-4 sm:px-6 py-3 text-right font-semibold text-gray-900">
                      {formatCurrency(job.yourPay)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
