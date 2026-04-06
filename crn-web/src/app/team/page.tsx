"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import {
  Users,
  Plus,
  Phone,
  Mail,
  User,
  Key,
  Check,
  DollarSign,
  Trash2,
  Pencil,
  RefreshCw,
  Eye,
  EyeOff,
  Shield,
  Star,
  TrendingUp,
  Search,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import Badge, { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────
interface TeamMember {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  role: string;
  status: string; // "active" | "inactive" | "archived"
  defaultShare: number;
  hasPassword?: boolean;
  // Supervisor fields
  rank?: number;
  canSupervise?: boolean;
  // Performance metrics
  avgRating?: number | null;
  totalRatings?: number;
  reliabilityScore?: number | null;
}

// ── Helpers ────────────────────────────────────────────────
function notify(msg: string) {
  console.log("[CRN]", msg);
}

const roleVariant: Record<string, "purple" | "info" | "success" | "warning" | "default"> = {
  admin: "purple",
  lead: "info",
  cleaner: "success",
  trainee: "warning",
};

const shareLabelMap: Record<number, string> = {
  1: "Full",
  0.75: "3/4",
  0.5: "Half",
  0.25: "Quarter",
  0: "Ride-along",
};

const statusTabs = [
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "All", value: "" },
];

// ── Main Page ──────────────────────────────────────────────
export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [passwordMember, setPasswordMember] = useState<TeamMember | null>(null);
  const [statusFilter, setStatusFilter] = useState("active");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchMembers();
  }, [statusFilter, search]);

  const fetchMembers = () => {
    setLoading(true);
    api
      .get<{ members: TeamMember[] }>("/team", {
        status: statusFilter || undefined,
        search: search || undefined,
      })
      .then((data) => setMembers(data.members))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const handleAdd = () => {
    setEditingMember(null);
    setShowModal(true);
  };

  const handleEdit = (member: TeamMember) => {
    setEditingMember(member);
    setShowModal(true);
  };

  const handleSetPassword = (member: TeamMember, e: React.MouseEvent) => {
    e.stopPropagation();
    setPasswordMember(member);
    setShowPasswordModal(true);
  };

  const handleSave = async (data: Record<string, unknown>) => {
    try {
      if (editingMember) {
        await api.patch(`/team/${editingMember.id}`, data);
        notify("Team member updated");
      } else {
        await api.post("/team", data);
        notify("Team member added");
      }
      setShowModal(false);
      fetchMembers();
    } catch (error: any) {
      const msg = error?.data?.error || "Failed to save team member";
      notify(msg);
    }
  };

  const handleSavePassword = async (password: string) => {
    if (!passwordMember) return;
    try {
      await api.patch(`/team/${passwordMember.id}/password`, { password });
      notify(`Password set for ${passwordMember.name}`);
      setShowPasswordModal(false);
      setPasswordMember(null);
      fetchMembers();
    } catch (error: any) {
      const msg = error?.data?.error || "Failed to set password";
      notify(msg);
    }
  };

  const handleDelete = async (member: TeamMember, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Remove ${member.name} from the team?`)) return;
    try {
      await api.delete(`/team/${member.id}`);
      notify(`${member.name} removed from team`);
      fetchMembers();
    } catch {
      notify("Failed to remove team member");
    }
  };

  const handleReactivate = async (member: TeamMember, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Reactivate ${member.name}?`)) return;
    try {
      await api.patch(`/team/${member.id}`, { status: "active" });
      notify(`${member.name} has been reactivated`);
      fetchMembers();
    } catch {
      notify("Failed to reactivate team member");
    }
  };

  const activeCount = members.filter((m) => m.status === "active").length;

  return (
    <div className="p-6 max-w-6xl">
      <PageHeader
        title="Team"
        subtitle={`${activeCount} active member${activeCount !== 1 ? "s" : ""}`}
        actions={
          <Button onClick={handleAdd}>
            <Plus size={16} />
            Add Team Member
          </Button>
        }
      />

      {/* Search & Filter */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search team..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-md transition-colors",
                statusFilter === tab.value
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Team Cards */}
      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : members.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<Users size={40} />}
              title="No team members yet"
              description="Add your team members to start assigning jobs."
              action={{ label: "Add Team Member", onClick: handleAdd }}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((member) => {
            const isActive = member.status === "active";
            return (
              <Card
                key={member.id}
                className={cn(
                  "hover:shadow-md transition-shadow cursor-pointer",
                  !isActive && "opacity-60 bg-gray-50"
                )}
                onClick={() => isActive && handleEdit(member)}
              >
                <CardContent>
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div
                      className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold shrink-0",
                        isActive ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-400"
                      )}
                    >
                      {member.name.charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Name + Badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4
                          className={cn(
                            "font-semibold truncate",
                            isActive ? "text-gray-900" : "text-gray-500"
                          )}
                        >
                          {member.name}
                        </h4>
                        <StatusBadge status={member.status} />
                        <Badge variant={roleVariant[member.role] ?? "default"}>
                          {member.role}
                        </Badge>
                        {member.canSupervise && (
                          <Badge variant="warning" className="gap-1">
                            <Shield size={10} />
                            Supervisor
                          </Badge>
                        )}
                      </div>

                      {/* Performance Stats */}
                      {isActive && (
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          <div
                            className="flex items-center gap-1"
                            title="Team Rank (1-100)"
                          >
                            <TrendingUp size={12} />
                            <span>Rank: {member.rank ?? 50}</span>
                          </div>
                          {member.avgRating != null && (
                            <div
                              className="flex items-center gap-1"
                              title={`Based on ${member.totalRatings ?? 0} ratings`}
                            >
                              <Star size={12} className="text-amber-500" />
                              <span>{member.avgRating.toFixed(1)}</span>
                            </div>
                          )}
                          {member.reliabilityScore != null && (
                            <div
                              className="flex items-center gap-1"
                              title="Attendance Reliability"
                            >
                              <Check
                                size={12}
                                className={cn(
                                  member.reliabilityScore >= 90
                                    ? "text-green-500"
                                    : member.reliabilityScore >= 70
                                    ? "text-amber-500"
                                    : "text-red-500"
                                )}
                              />
                              <span>{Math.round(member.reliabilityScore)}%</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Default Share */}
                      {isActive && (
                        <p className="text-xs text-gray-500 mt-1">
                          Default Share:{" "}
                          <span className="font-medium text-gray-700">
                            {shareLabelMap[member.defaultShare] ?? member.defaultShare}
                          </span>
                        </p>
                      )}

                      {/* Contact Info */}
                      {member.phone && (
                        <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
                          <Phone size={14} />
                          {member.phone}
                        </div>
                      )}
                      {member.email && (
                        <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                          <Mail size={14} />
                          {member.email}
                        </div>
                      )}

                      {/* Login Status */}
                      {isActive && member.email && (
                        <div className="mt-3 pt-3 border-t">
                          {member.hasPassword ? (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-sm text-green-600">
                                <Check size={14} />
                                <span>Login enabled</span>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => handleSetPassword(member, e)}
                                className="text-gray-500 hover:text-gray-700"
                              >
                                <Key size={14} />
                                Reset
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => handleSetPassword(member, e)}
                            >
                              <Key size={14} />
                              Set Password
                            </Button>
                          )}
                        </div>
                      )}
                      {isActive && !member.email && (
                        <p className="mt-3 pt-3 border-t text-xs text-gray-400">
                          Add email to enable login
                        </p>
                      )}

                      {/* View Pay Button */}
                      {isActive && member.role !== "admin" && (
                        <Link
                          href={`/team/${member.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-2 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 w-full py-1.5"
                        >
                          <DollarSign size={14} />
                          View Pay History
                        </Link>
                      )}

                      {/* Action Buttons */}
                      <div className="mt-3 pt-3 border-t flex gap-2">
                        {isActive ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(member);
                              }}
                            >
                              <Pencil size={14} />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:bg-red-50"
                              onClick={(e) => handleDelete(member, e)}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-green-600 hover:bg-green-50"
                            onClick={(e) => handleReactivate(member, e)}
                          >
                            <RefreshCw size={14} />
                            Reactivate
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Team Member Modal */}
      <TeamMemberModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
        member={editingMember}
      />

      {/* Set Password Modal */}
      <SetPasswordModal
        open={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          setPasswordMember(null);
        }}
        onSave={handleSavePassword}
        memberName={passwordMember?.name || ""}
      />
    </div>
  );
}

// ── Team Member Modal ──────────────────────────────────────
interface TeamMemberModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => void;
  member: TeamMember | null;
}

function TeamMemberModal({ open, onClose, onSave, member }: TeamMemberModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    role: "cleaner",
    defaultShare: 1,
    rank: 50,
    canSupervise: false,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (member) {
      setFormData({
        name: member.name,
        email: member.email || "",
        phone: member.phone || "",
        role: member.role,
        defaultShare: member.defaultShare ?? 1,
        rank: member.rank ?? 50,
        canSupervise: member.canSupervise ?? false,
      });
    } else {
      setFormData({
        name: "",
        email: "",
        phone: "",
        role: "cleaner",
        defaultShare: 1,
        rank: 50,
        canSupervise: false,
      });
    }
  }, [member, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(formData);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={member ? "Edit Team Member" : "Add Team Member"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Jane Doe"
          required
        />

        <Input
          label="Phone"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          placeholder="(555) 123-4567"
        />

        <Input
          label="Email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          placeholder="jane@example.com"
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <select
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          >
            <option value="cleaner">Cleaner</option>
            <option value="lead">Lead</option>
            <option value="trainee">Trainee</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Default Share</label>
          <select
            value={formData.defaultShare}
            onChange={(e) =>
              setFormData({ ...formData, defaultShare: parseFloat(e.target.value) })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          >
            <option value={1}>Full (1.0)</option>
            <option value={0.75}>3/4 (0.75)</option>
            <option value={0.5}>Half (0.5)</option>
            <option value={0.25}>Quarter (0.25)</option>
            <option value={0}>Ride-along (0)</option>
          </select>
        </div>

        {/* Supervisor Settings */}
        <div className="border-t pt-4 mt-4">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Shield size={16} className="text-amber-500" />
            Supervisor Settings
          </h4>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Team Rank (1-100)
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={formData.rank}
                onChange={(e) =>
                  setFormData({ ...formData, rank: parseInt(e.target.value) || 50 })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Higher = more senior. Owner/admin should be 100.
              </p>
            </div>

            <div className="flex flex-col">
              <label className="block text-sm font-medium text-gray-700 mb-1">Can Supervise</label>
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.canSupervise}
                  onChange={(e) =>
                    setFormData({ ...formData, canSupervise: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Enable supervisor tools</span>
              </label>
              <p className="text-xs text-gray-500 mt-1">Can mark absences and rate team.</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSaving}>
            {member ? "Save Changes" : "Add Team Member"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Set Password Modal ─────────────────────────────────────
interface SetPasswordModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (password: string) => void;
  memberName: string;
}

function SetPasswordModal({ open, onClose, onSave, memberName }: SetPasswordModalProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setPassword("");
      setConfirmPassword("");
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      notify("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      notify("Passwords do not match");
      return;
    }

    setIsSaving(true);
    try {
      await onSave(password);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Set Password for ${memberName}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-600">
          Set a password to allow this team member to log in to the team portal.
        </p>

        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password"
          required
        />

        <Input
          label="Confirm Password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm password"
          required
        />

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSaving}>
            <Key size={16} />
            Set Password
          </Button>
        </div>
      </form>
    </Modal>
  );
}
