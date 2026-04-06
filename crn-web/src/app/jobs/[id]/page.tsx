"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import Link from "next/link";
import { calculateJob } from "crn-shared";
import type { FinancialModel, FinancialModelConfig, JobResult } from "crn-shared";
import {
  ArrowLeft,
  Play,
  CheckCircle,
  XCircle,
  MapPin,
  Clock,
  Users,
  DollarSign,
  FileText,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import Badge from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";

interface Assignment {
  id: string;
  share: number;
  isOwner: boolean;
  user: { id: string; name: string };
}

interface ExtraCharge {
  id: string;
  description: string;
  amount: number;
}

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
  notes?: string;
  clientPaid: boolean;
  teamPaid: boolean;
  property: { id: string; name: string; address?: string; code?: string };
  assignments: Assignment[];
  charges: ExtraCharge[];
}

interface Settings {
  financialModel: FinancialModelConfig;
}

const shareLevelLabel = (share: number): string => {
  if (share === 1) return "Full";
  if (share === 0.75) return "3/4";
  if (share === 0.5) return "Half";
  if (share === 0.25) return "Quarter";
  if (share === 0) return "Ride-along";
  return `${share}`;
};

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<Job>(`/jobs/${id}`),
      api.get<Settings>("/settings"),
    ])
      .then(([jobData, settingsData]) => {
        setJob(jobData);
        setSettings(settingsData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleAction = async (action: string) => {
    if (!job) return;
    setActionLoading(true);
    try {
      const updated = await api.patch<Job>(`/jobs/${job.id}`, { status: action });
      setJob(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const togglePayment = async (field: "clientPaid" | "teamPaid") => {
    if (!job) return;
    try {
      const updated = await api.patch<Job>(`/jobs/${job.id}`, {
        [field]: !job[field],
      });
      setJob(updated);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-6xl">
        <p className="text-gray-400 text-sm">Loading job...</p>
      </div>
    );
  }

  if (!job || !settings) {
    return (
      <div className="p-6 max-w-6xl">
        <p className="text-gray-500">Job not found</p>
        <Link href="/jobs" className="text-blue-600 text-sm mt-2 inline-block">Back to Jobs</Link>
      </div>
    );
  }

  const model: FinancialModel = { buckets: settings.financialModel.buckets };
  let result: JobResult | null = null;
  try {
    result = calculateJob(model, {
      totalFee: job.totalFee,
      houseCutPercent: job.houseCutPercent,
      charges: job.charges.map((c) => ({ amount: c.amount })),
      assignments: job.assignments.map((a) => ({
        userId: a.user.id,
        userName: a.user.name,
        share: a.share,
        isOwner: a.isOwner,
      })),
    });
  } catch {
    // Financial model error - display raw data
  }

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={20} className="text-gray-500" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Job {job.jobNumber}</h1>
            <StatusBadge status={job.status} />
            {job.isBtoB && (
              <Badge variant="warning" className="bg-orange-50 text-orange-600">B2B</Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {job.status === "SCHEDULED" && (
            <Button
              onClick={() => handleAction("IN_PROGRESS")}
              disabled={actionLoading}
              variant="primary"
              className="bg-yellow-500 hover:bg-yellow-600"
            >
              <Play size={14} /> Start
            </Button>
          )}
          {job.status === "IN_PROGRESS" && (
            <Button
              onClick={() => handleAction("COMPLETED")}
              disabled={actionLoading}
              variant="success"
            >
              <CheckCircle size={14} /> Complete
            </Button>
          )}
          {(job.status === "SCHEDULED" || job.status === "IN_PROGRESS") && (
            <Button
              onClick={() => handleAction("CANCELLED")}
              disabled={actionLoading}
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              <XCircle size={14} /> Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Property & Schedule */}
          <Card>
            <CardContent>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Property & Schedule</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <MapPin size={18} className="text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Property</p>
                    <Link href={`/properties/${job.property.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                      {job.property.name}
                    </Link>
                    {job.property.address && <p className="text-xs text-gray-400 mt-0.5">{job.property.address}</p>}
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock size={18} className="text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Date & Time</p>
                    <p className="text-sm font-medium text-gray-900">{formatDate(job.scheduledDate)}</p>
                    {job.scheduledTime && <p className="text-xs text-gray-400">{formatTime(job.scheduledTime)}</p>}
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <FileText size={18} className="text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Type</p>
                    <p className="text-sm font-medium text-gray-900">{job.jobType}</p>
                  </div>
                </div>
              </div>
              {job.notes && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm text-gray-500 mb-1">Notes</p>
                  <p className="text-sm text-gray-700">{job.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Crew & Shares */}
          <Card>
            <CardContent>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Users size={18} className="text-gray-400" />
                Crew & Shares
              </h2>
              {job.assignments.length === 0 ? (
                <p className="text-sm text-gray-400">No crew assigned</p>
              ) : (
                <div className="space-y-3">
                  {job.assignments.map((a) => (
                    <div key={a.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-semibold">
                          {a.user.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{a.user.name}</p>
                          {a.isOwner && <p className="text-xs text-purple-600">Owner</p>}
                        </div>
                      </div>
                      <Badge variant="info" className="bg-blue-50">
                        {shareLevelLabel(a.share)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Extra Charges */}
          {job.charges.length > 0 && (
            <Card>
              <CardContent>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Extra Charges</h2>
                <div className="space-y-2">
                  {job.charges.map((c) => (
                    <div key={c.id} className="flex items-center justify-between py-2">
                      <span className="text-sm text-gray-700">{c.description}</span>
                      <span className="text-sm font-medium text-gray-900">{formatCurrency(c.amount)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Financial Summary */}
          <Card>
            <CardContent>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <DollarSign size={18} className="text-gray-400" />
                Financial Summary
              </h2>
              {result ? (
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Gross Revenue</span>
                    <span className="font-medium text-gray-900">{formatCurrency(result.grossRevenue)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">House Cut ({job.houseCutPercent}%)</span>
                    <span className="font-medium text-red-600">-{formatCurrency(result.houseCutAmount)}</span>
                  </div>
                  <div className="border-t border-gray-100 pt-3 flex justify-between text-sm">
                    <span className="font-medium text-gray-700">Net Revenue</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(result.netRevenue)}</span>
                  </div>

                  {/* Buckets */}
                  <div className="border-t border-gray-100 pt-3 space-y-2">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Buckets</p>
                    {result.buckets.map((b) => (
                      <div key={b.name} className="flex justify-between text-sm">
                        <span className="text-gray-500">{b.name} ({b.percent}%)</span>
                        <span className="font-medium text-gray-900">{formatCurrency(b.amount)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Worker Payments */}
                  {result.workerPayments.length > 0 && (
                    <div className="border-t border-gray-100 pt-3 space-y-2">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Worker Pay</p>
                      {result.workerPayments.map((w) => (
                        <div key={w.userId} className="flex justify-between text-sm">
                          <span className="text-gray-500">{w.userName}</span>
                          <span className="font-semibold text-green-700">{formatCurrency(w.totalPay)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Fee</span>
                    <span className="font-medium text-gray-900">{formatCurrency(job.totalFee)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">House Cut</span>
                    <span className="font-medium text-gray-900">{job.houseCutPercent}%</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Status */}
          <Card>
            <CardContent>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Status</h2>
              <div className="space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-gray-700">Client Paid</span>
                  <button
                    onClick={() => togglePayment("clientPaid")}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      job.clientPaid ? "bg-green-500" : "bg-gray-200"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        job.clientPaid ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-gray-700">Team Paid</span>
                  <button
                    onClick={() => togglePayment("teamPaid")}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      job.teamPaid ? "bg-green-500" : "bg-gray-200"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        job.teamPaid ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </label>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
