"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import Link from "next/link";
import { ArrowLeft, Mail, Phone, Briefcase, CheckCircle, Key, Smartphone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import Badge, { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PortalAccessModal, portalLoginUrl, removePortalAccess } from "../PortalAccessModal";

interface RecentAssignment {
  id: string;
  share: number;
  jobId: string;
  jobNumber: number;
  scheduledDate: string;
  totalFee: number;
  status: string;
  propertyName: string;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  status: string;
  defaultShare: number;
  phone?: string | null;
  email?: string | null;
  hasPortalPassword: boolean;
}

interface TeamMemberDetail {
  member: TeamMember;
  recentAssignments: RecentAssignment[];
  stats: { totalJobs: number; completedJobs: number };
}

const roleVariant: Record<string, "purple" | "info" | "success" | "warning" | "default"> = {
  admin: "purple",
  lead: "info",
  cleaner: "success",
  worker: "success",
  trainee: "warning",
};

export default function TeamMemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<TeamMemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const load = useCallback(() => {
    return api
      .get<TeamMemberDetail>(`/team/${id}`)
      .then(setDetail)
      .catch(console.error);
  }, [id]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  if (loading) {
    return (
      <div className="p-6 max-w-6xl">
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="p-6 max-w-6xl">
        <p className="text-gray-500">Team member not found</p>
        <Link href="/team" className="text-blue-600 text-sm mt-2 inline-block">Back to Team</Link>
      </div>
    );
  }

  const { member, recentAssignments, stats } = detail;
  const isActive = member.status === "active";

  const handleRemoveAccess = async () => {
    if (await removePortalAccess(member.id, member.name)) {
      load();
    }
  };

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
              <Badge variant={roleVariant[member.role] ?? "default"}>
                {member.role}
              </Badge>
              <StatusBadge status={member.status} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <Briefcase size={20} className="text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalJobs}</p>
                    <p className="text-sm text-gray-500">Total Jobs</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-green-500" />
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{stats.completedJobs}</p>
                    <p className="text-sm text-gray-500">Completed Jobs</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Assignments */}
          <Card>
            <CardContent>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Assignments</h2>
              {recentAssignments.length === 0 ? (
                <p className="text-sm text-gray-400">No recent assignments</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">Job</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">Date</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">Property</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">Status</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">Job Fee</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {recentAssignments.map((a) => (
                      <tr key={a.id} className="hover:bg-gray-50">
                        <td className="py-3">
                          <Link href={`/jobs/${a.jobId}`} className="text-sm font-medium text-blue-600 hover:underline">
                            #{a.jobNumber}
                          </Link>
                        </td>
                        <td className="py-3 text-sm text-gray-600">{formatDate(a.scheduledDate)}</td>
                        <td className="py-3 text-sm text-gray-600">{a.propertyName}</td>
                        <td className="py-3">
                          <StatusBadge status={a.status} />
                        </td>
                        <td className="py-3 text-sm font-medium text-gray-900 text-right">{formatCurrency(a.totalFee)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Contact Info */}
          <Card>
            <CardContent>
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
            </CardContent>
          </Card>

          {/* Portal Access */}
          <Card>
            <CardContent>
              <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Smartphone size={18} className="text-gray-400" />
                Portal access
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Cleaners sign in at{" "}
                <span className="font-medium text-gray-700 break-all">{portalLoginUrl()}</span>{" "}
                on any phone — no app needed.
              </p>

              {!member.email ? (
                <p className="text-sm text-gray-400">
                  Add an email address to enable portal access.
                </p>
              ) : member.hasPortalPassword ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle size={16} />
                    <span>Portal access enabled</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowPasswordModal(true)}
                    >
                      <Key size={14} />
                      Reset Password
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:bg-red-50"
                      onClick={handleRemoveAccess}
                    >
                      Remove Access
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500">
                    No portal password set{!isActive && " (member is not active)"}.
                  </p>
                  <Button size="sm" onClick={() => setShowPasswordModal(true)}>
                    <Key size={14} />
                    Set Portal Password
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <PortalAccessModal
        open={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        memberId={member.id}
        memberName={member.name}
        hasPortalPassword={member.hasPortalPassword}
        onSaved={load}
      />
    </div>
  );
}
