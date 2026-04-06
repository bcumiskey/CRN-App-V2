"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import { Users } from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  role: string;
  status: string;
  defaultShare: number;
  phone?: string;
  email?: string;
}

const roleColor: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700",
  lead: "bg-blue-100 text-blue-700",
  cleaner: "bg-green-100 text-green-700",
  trainee: "bg-yellow-100 text-yellow-700",
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your cleaning crew</p>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : members.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <Users size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No team members</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((member) => (
            <Link
              key={member.id}
              href={`/team/${member.id}`}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:border-blue-200 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-lg font-semibold">
                  {member.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{member.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleColor[member.role] ?? "bg-gray-100 text-gray-600"}`}>
                      {member.role}
                    </span>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
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
              <div className="mt-4 pt-3 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  Default Share: <span className="font-medium text-gray-900">{shareLabelMap[member.defaultShare] ?? member.defaultShare}</span>
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
