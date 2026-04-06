"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  DollarSign,
  Key,
  Wifi,
  Car,
  Trash2,
  AlertTriangle,
  BedDouble,
  FileText,
  Clock,
} from "lucide-react";

interface Room {
  id: string;
  name: string;
  bedConfig?: string;
  stockingNotes?: string;
}

interface Instruction {
  id: string;
  text: string;
  priority: "high" | "medium" | "low";
  category?: string;
}

interface Note {
  id: string;
  text: string;
  createdAt: string;
  createdBy: string;
}

interface RecentJob {
  id: string;
  jobNumber: string;
  scheduledDate: string;
  jobType: string;
  status: string;
  totalFee: number;
}

interface Property {
  id: string;
  name: string;
  code: string;
  address?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  status: string;
  defaultFee: number;
  defaultHouseCutPercent: number;
  lockboxCode?: string;
  wifiName?: string;
  wifiPassword?: string;
  parkingInstructions?: string;
  trashDay?: string;
  specialInstructions?: string;
  rooms: Room[];
  recentJobs?: RecentJob[];
}

const statusColor: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

const priorityColor: Record<string, string> = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-gray-100 text-gray-600 border-gray-200",
};

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [property, setProperty] = useState<Property | null>(null);
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<Property>(`/properties/${id}`),
      api.get<{ instructions: Instruction[] }>(`/properties/${id}/instructions`).catch(() => ({ instructions: [] })),
      api.get<{ notes: Note[] }>(`/properties/${id}/notes`).catch(() => ({ notes: [] })),
    ])
      .then(([propData, instrData, notesData]) => {
        setProperty(propData);
        setInstructions(instrData.instructions);
        setNotes(notesData.notes);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="p-6 max-w-6xl">
        <p className="text-gray-400 text-sm">Loading property...</p>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="p-6 max-w-6xl">
        <p className="text-gray-500">Property not found</p>
        <Link href="/properties" className="text-blue-600 text-sm mt-2 inline-block">Back to Properties</Link>
      </div>
    );
  }

  const groupedInstructions = instructions.reduce(
    (acc, instr) => {
      const priority = instr.priority || "low";
      if (!acc[priority]) acc[priority] = [];
      acc[priority].push(instr);
      return acc;
    },
    {} as Record<string, Instruction[]>
  );

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={20} className="text-gray-500" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{property.name}</h1>
            <span className="text-sm font-mono text-gray-400">{property.code}</span>
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                property.status === "active"
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {property.status}
            </span>
          </div>
          {property.address && (
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
              <MapPin size={14} />
              {property.address}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Info</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <DollarSign size={18} className="text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Default Fee</p>
                  <p className="text-lg font-semibold text-gray-900">${property.defaultFee}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">House Cut</p>
                <p className="text-lg font-semibold text-gray-900">{property.defaultHouseCutPercent}%</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Owner</p>
                <p className="text-sm font-medium text-gray-900">{property.ownerName || "-"}</p>
                {property.ownerPhone && <p className="text-xs text-gray-400">{property.ownerPhone}</p>}
              </div>
            </div>
          </div>

          {/* Access & Info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Access & Info</h2>
            <div className="grid grid-cols-2 gap-4">
              {property.lockboxCode && (
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Key size={16} className="text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Lockbox Code</p>
                    <p className="text-sm font-mono font-medium text-gray-900">{property.lockboxCode}</p>
                  </div>
                </div>
              )}
              {(property.wifiName || property.wifiPassword) && (
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Wifi size={16} className="text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">WiFi</p>
                    {property.wifiName && <p className="text-sm font-medium text-gray-900">{property.wifiName}</p>}
                    {property.wifiPassword && <p className="text-xs text-gray-400 font-mono">{property.wifiPassword}</p>}
                  </div>
                </div>
              )}
              {property.parkingInstructions && (
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Car size={16} className="text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Parking</p>
                    <p className="text-sm text-gray-700">{property.parkingInstructions}</p>
                  </div>
                </div>
              )}
              {property.trashDay && (
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Trash2 size={16} className="text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Trash Day</p>
                    <p className="text-sm text-gray-700">{property.trashDay}</p>
                  </div>
                </div>
              )}
            </div>
            {property.specialInstructions && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle size={14} className="text-yellow-600" />
                  <p className="text-xs font-medium text-yellow-700 uppercase">Special Instructions</p>
                </div>
                <p className="text-sm text-yellow-800">{property.specialInstructions}</p>
              </div>
            )}
          </div>

          {/* Rooms */}
          {property.rooms && property.rooms.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BedDouble size={18} className="text-gray-400" />
                Rooms ({property.rooms.length})
              </h2>
              <div className="space-y-3">
                {property.rooms.map((room) => (
                  <div key={room.id} className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-900">{room.name}</p>
                    {room.bedConfig && <p className="text-xs text-gray-500 mt-0.5">Beds: {room.bedConfig}</p>}
                    {room.stockingNotes && <p className="text-xs text-gray-400 mt-0.5">{room.stockingNotes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Standing Instructions */}
          {instructions.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Standing Instructions</h2>
              <div className="space-y-4">
                {(["high", "medium", "low"] as const).map(
                  (priority) =>
                    groupedInstructions[priority] && (
                      <div key={priority}>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">{priority} Priority</p>
                        <div className="space-y-2">
                          {groupedInstructions[priority].map((instr) => (
                            <div
                              key={instr.id}
                              className={`text-sm p-3 rounded-lg border ${priorityColor[priority]}`}
                            >
                              {instr.text}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Recent Jobs */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock size={18} className="text-gray-400" />
              Recent Jobs
            </h2>
            {!property.recentJobs || property.recentJobs.length === 0 ? (
              <p className="text-sm text-gray-400">No recent jobs</p>
            ) : (
              <div className="space-y-2">
                {property.recentJobs.map((job) => (
                  <Link
                    key={job.id}
                    href={`/jobs/${job.id}`}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{job.jobNumber}</p>
                      <p className="text-xs text-gray-400">{job.scheduledDate} - {job.jobType}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">${job.totalFee}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusColor[job.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {job.status.replace("_", " ")}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Notes Timeline */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText size={18} className="text-gray-400" />
              Notes
            </h2>
            {notes.length === 0 ? (
              <p className="text-sm text-gray-400">No notes yet</p>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div key={note.id} className="border-l-2 border-gray-200 pl-3">
                    <p className="text-sm text-gray-700">{note.text}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {note.createdBy} - {new Date(note.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
