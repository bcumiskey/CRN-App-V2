"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import { Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import Badge, { StatusBadge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

interface TeamMember {
  id: string;
  name: string;
  role: string;
  status: string;
  defaultShare: number;
  phone?: string;
  email?: string;
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

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ members: TeamMember[] }>("/team")
      .then((data) => setMembers(data.members))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-6xl">
      <PageHeader title="Team" subtitle="Manage your cleaning crew" />

      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : members.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<Users size={40} />}
              title="No team members"
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((member) => (
            <Link
              key={member.id}
              href={`/team/${member.id}`}
            >
              <Card className="p-5 hover:border-blue-200 hover:shadow-md transition-all h-full">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-lg font-semibold">
                    {member.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{member.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={roleVariant[member.role] ?? "default"}>
                        {member.role}
                      </Badge>
                      <StatusBadge status={member.status} />
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <p className="text-sm text-gray-500">
                    Default Share: <span className="font-medium text-gray-900">{shareLabelMap[member.defaultShare] ?? member.defaultShare}</span>
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
