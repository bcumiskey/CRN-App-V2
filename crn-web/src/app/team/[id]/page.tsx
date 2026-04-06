"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import Link from "next/link";
import { ArrowLeft, Mail, Phone, Briefcase, Calendar } from "lucide-react";

interface RecentJob {
  id: string;
  jobNumber: string;
  scheduledDate: string;
  propertyName: string;
  status: string;
  totalPay: number;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  status: string;
  defaultShare: number;
  phone?: string;
  email?: string;
  totalJobs?: number;
  recentJobs?: RecentJob[];
}

const roleColor: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700",
  lead: "bg-blue-100 text-blue-700",
  cleaner: "bg-green-100 text-green-700",
  trainee: "bg-yellow-100 text-yellow-700",
};

const statusJobColor: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export default function TeamMemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [member, setMember] = useState<TeamMember | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<TeamMember>(`/team/${id}`)
      .then(setMember)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="p-6 max-w-6xl">
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="p-6 max-w-6xl">
        <p className="text-gray-500">Team member not found</p>
        <Link href="/team" className="text-blue-600 text-sm mt-2 inline-block">Back to Team</Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={20} className="text-gray-500" />
        </button>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xl font-semibold">
            {member.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{member.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${roleColor[member.role] ?? "bg-gray-100 text-gray-600"}`}>
                {member.role}
              </span>
              <span
                className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                  member.status === "active"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {member.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-3">
                <Briefcase size={20} className="text-blue-500" />
                <div>
                  <p className="text-2xl font-bold text-gray-900">{member.totalJobs ?? 0}</p>
                  <p className="text-sm text-gray-500">Total Jobs</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-3">
                <Calendar size={20} className="text-green-500" />
                <div>
                  <p className="text-2xl font-bold text-gray-900">{member.defaultShare}</p>
                  <p className="text-sm text-gray-500">Default Share</p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Assignments */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Assignments</h2>
            {!member.recentJobs || member.recentJobs.length === 0 ? (
              <p className="text-sm text-gray-400">No recent assignments</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">Job</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">Date</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">Property</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">Status</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">Pay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {member.recentJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-gray-50">
                      <td className="py-3">
                        <Link href={`/jobs/${job.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                          {job.jobNumber}
                        </Link>
                      </td>
                      <td className="py-3 text-sm text-gray-600">{job.scheduledDate}</td>
                      <td className="py-3 text-sm text-gray-600">{job.propertyName}</td>
                      <td className="py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusJobColor[job.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {job.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3 text-sm font-medium text-gray-900 text-right">${job.totalPay.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Contact Info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact</h2>
            <div className="space-y-3">
              {member.phone && (
                <div className="flex items-center gap-3">
                  <Phone size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-700">{member.phone}</span>
                </div>
              )}
              {member.email && (
                <div className="flex items-center gap-3">
                  <Mail size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-700">{member.email}</span>
                </div>
              )}
              {!member.phone && !member.email && (
                <p className="text-sm text-gray-400">No contact info</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
