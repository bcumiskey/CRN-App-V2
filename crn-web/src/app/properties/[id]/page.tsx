"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Camera,
  ListChecks,
  Building,
  Save,
  X,
  Pencil,
  MapPin,
  DollarSign,
  Key,
  Wifi,
  Car,
  AlertTriangle,
  BedDouble,
  FileText,
  Clock,
  User,
  Check,
  Send,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import Badge, { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────
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

interface Owner {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

interface Property {
  id: string;
  name: string;
  code: string;
  address?: string;
  status: string;
  // V1 compat names (mapped by v1Fetch from V2's defaultJobFee/houseCutPercent)
  baseRate: number;
  expensePercent: number;
  // V2 native names
  defaultJobFee?: number;
  houseCutPercent?: number;
  // Access
  accessInstructions?: string;
  lockboxCode?: string;
  wifiName?: string;
  wifiPassword?: string;
  parkingNotes?: string;
  parkingInstructions?: string;
  trashDay?: string;
  specialInstructions?: string;
  imageUrl?: string;
  color?: string;
  billingType?: string;
  ownerId?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  owner?: Owner;
  rooms: Room[];
  recentJobs?: RecentJob[];
  checklists?: any[];
  standingInstructions?: any[];
  propertyNotes?: any[];
}

// ── Helpers ────────────────────────────────────────────────
function notify(msg: string) {
  console.log("[CRN]", msg);
}

const ROOM_OPTIONS = [
  "Living Room",
  "Kitchen",
  "Master Bedroom",
  "Bedroom 2",
  "Bedroom 3",
  "Bedroom 4",
  "Master Bathroom",
  "Bathroom 2",
  "Bathroom 3",
  "Dining Room",
  "Patio/Deck",
  "Pool Area",
  "Garage",
  "Laundry Room",
  "Entry",
  "Hallway",
  "Other",
];

const priorityColor: Record<string, string> = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-gray-100 text-gray-600 border-gray-200",
};

const priorityOptions = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

// ── Inline Editable Field ──────────────────────────────────
function InlineField({
  label,
  value,
  onSave,
  type = "text",
  mono = false,
}: {
  label: string;
  value: string;
  onSave: (val: string) => void;
  type?: string;
  mono?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  if (!editing) {
    return (
      <div
        className="group cursor-pointer p-2 -mx-2 rounded-lg hover:bg-gray-50 transition-colors"
        onClick={() => setEditing(true)}
      >
        <p className="text-xs text-gray-500">{label}</p>
        <p className={cn("text-sm font-medium text-gray-900", mono && "font-mono")}>
          {value || <span className="text-gray-400 italic">Click to add...</span>}
        </p>
        <Pencil
          size={12}
          className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
        />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-gray-500">{label}</p>
      <div className="flex gap-1">
        <input
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onSave(draft);
              setEditing(false);
            }
            if (e.key === "Escape") {
              setDraft(value);
              setEditing(false);
            }
          }}
          className={cn(
            "flex-1 px-2 py-1 text-sm border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
            mono && "font-mono"
          )}
        />
        <button
          onClick={() => {
            onSave(draft);
            setEditing(false);
          }}
          className="p-1 text-green-600 hover:bg-green-50 rounded"
        >
          <Check size={14} />
        </button>
        <button
          onClick={() => {
            setDraft(value);
            setEditing(false);
          }}
          className="p-1 text-gray-400 hover:bg-gray-100 rounded"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────
export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [property, setProperty] = useState<Property | null>(null);
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"info" | "instructions" | "rooms" | "notes">("info");

  // Inline field save
  const [saving, setSaving] = useState(false);

  // Instructions form
  const [newInstrText, setNewInstrText] = useState("");
  const [newInstrPriority, setNewInstrPriority] = useState<string>("medium");
  const [newInstrCategory, setNewInstrCategory] = useState("");
  const [savingInstr, setSavingInstr] = useState(false);
  const [editingInstr, setEditingInstr] = useState<Instruction | null>(null);

  // Room management
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [roomForm, setRoomForm] = useState({ name: "", bedConfig: "", stockingNotes: "" });
  const [savingRoom, setSavingRoom] = useState(false);

  // Notes
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // ── Load data ──────────────────────────────────────────
  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get<Property>(`/properties/${id}`),
      api
        .get<{ instructions: Instruction[] }>(`/properties/${id}/instructions`)
        .catch(() => ({ instructions: [] })),
      api
        .get<{ notes: Note[] }>(`/properties/${id}/notes`)
        .catch(() => ({ notes: [] })),
    ])
      .then(([propData, instrData, notesData]) => {
        setProperty(propData);
        setInstructions(instrData.instructions);
        setNotes(notesData.notes);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (id) loadData();
  }, [id, loadData]);

  // ── Property field update ──────────────────────────────
  const updateField = async (field: string, value: string | number) => {
    if (!property) return;
    setSaving(true);
    try {
      const updated = await api.patch<Property>(`/properties/${id}`, { [field]: value });
      setProperty(updated);
      notify("Property updated");
    } catch {
      notify("Failed to update property");
    } finally {
      setSaving(false);
    }
  };

  // ── Instructions ───────────────────────────────────────
  const handleAddInstruction = async () => {
    if (!newInstrText.trim()) return;
    setSavingInstr(true);
    try {
      const added = await api.post<Instruction>(`/properties/${id}/instructions`, {
        text: newInstrText,
        priority: newInstrPriority,
        category: newInstrCategory || undefined,
      });
      setInstructions([...instructions, added]);
      setNewInstrText("");
      setNewInstrCategory("");
      notify("Instruction added");
    } catch {
      notify("Failed to add instruction");
    } finally {
      setSavingInstr(false);
    }
  };

  const handleUpdateInstruction = async () => {
    if (!editingInstr) return;
    try {
      const updated = await api.patch<Instruction>(
        `/properties/${id}/instructions/${editingInstr.id}`,
        {
          text: editingInstr.text,
          priority: editingInstr.priority,
          category: editingInstr.category,
        }
      );
      setInstructions(instructions.map((i) => (i.id === updated.id ? updated : i)));
      setEditingInstr(null);
      notify("Instruction updated");
    } catch {
      notify("Failed to update instruction");
    }
  };

  const handleDeleteInstruction = async (instrId: string) => {
    try {
      await api.delete(`/properties/${id}/instructions/${instrId}`);
      setInstructions(instructions.filter((i) => i.id !== instrId));
      notify("Instruction removed");
    } catch {
      notify("Failed to delete instruction");
    }
  };

  // ── Rooms ──────────────────────────────────────────────
  const openAddRoom = () => {
    setEditingRoom(null);
    setRoomForm({ name: "", bedConfig: "", stockingNotes: "" });
    setShowRoomModal(true);
  };

  const openEditRoom = (room: Room) => {
    setEditingRoom(room);
    setRoomForm({
      name: room.name,
      bedConfig: room.bedConfig || "",
      stockingNotes: room.stockingNotes || "",
    });
    setShowRoomModal(true);
  };

  const handleSaveRoom = async () => {
    if (!roomForm.name.trim()) return;
    setSavingRoom(true);
    try {
      if (editingRoom) {
        await api.patch(`/properties/${id}/rooms/${editingRoom.id}`, roomForm);
      } else {
        await api.post(`/properties/${id}/rooms`, roomForm);
      }
      setShowRoomModal(false);
      loadData();
      notify(editingRoom ? "Room updated" : "Room added");
    } catch {
      notify("Failed to save room");
    } finally {
      setSavingRoom(false);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!confirm("Delete this room?")) return;
    try {
      await api.delete(`/properties/${id}/rooms/${roomId}`);
      loadData();
      notify("Room deleted");
    } catch {
      notify("Failed to delete room");
    }
  };

  // ── Notes ──────────────────────────────────────────────
  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setSavingNote(true);
    try {
      const added = await api.post<Note>(`/properties/${id}/notes`, { text: newNote });
      setNotes([added, ...notes]);
      setNewNote("");
      notify("Note added");
    } catch {
      notify("Failed to add note");
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await api.delete(`/properties/${id}/notes/${noteId}`);
      setNotes(notes.filter((n) => n.id !== noteId));
      notify("Note removed");
    } catch {
      notify("Failed to delete note");
    }
  };

  // ── Loading / Not Found ────────────────────────────────
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
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => router.push("/properties")}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft size={20} className="text-gray-500" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Property Not Found</h1>
        </div>
        <Link href="/properties" className="text-blue-600 text-sm">
          Back to Properties
        </Link>
      </div>
    );
  }

  const owner = property.owner || {
    name: property.ownerName || "",
    email: property.ownerEmail,
    phone: property.ownerPhone,
  };

  const groupedInstructions = instructions.reduce(
    (acc, instr) => {
      const p = instr.priority || "low";
      if (!acc[p]) acc[p] = [];
      acc[p].push(instr);
      return acc;
    },
    {} as Record<string, Instruction[]>
  );

  const tabs = [
    { key: "info" as const, label: "Property Info", icon: Building },
    { key: "instructions" as const, label: `Instructions (${instructions.length})`, icon: ListChecks },
    { key: "rooms" as const, label: `Rooms (${property.rooms?.length ?? 0})`, icon: BedDouble },
    { key: "notes" as const, label: `Notes (${notes.length})`, icon: FileText },
  ];

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push("/properties")}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-500" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{property.name}</h1>
            <span className="text-sm font-mono text-gray-400">{property.code}</span>
            <StatusBadge status={property.status} />
            {saving && <span className="text-xs text-blue-500 animate-pulse">Saving...</span>}
          </div>
          {property.address && (
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
              <MapPin size={14} />
              {property.address}
            </p>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors",
              activeTab === tab.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── INFO TAB ──────────────────────────────────── */}
      {activeTab === "info" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Info Cards — inline editable */}
            <Card>
              <CardContent>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Info</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <InlineField
                    label="Default Fee"
                    value={String(property.baseRate)}
                    type="number"
                    onSave={(v) => updateField("baseRate", parseFloat(v) || 0)}
                  />
                  <InlineField
                    label="House Cut %"
                    value={String(property.expensePercent)}
                    type="number"
                    onSave={(v) => updateField("expensePercent", parseFloat(v) || 0)}
                  />
                  <InlineField
                    label="Name"
                    value={property.name}
                    onSave={(v) => updateField("name", v)}
                  />
                  <InlineField
                    label="Address"
                    value={property.address || ""}
                    onSave={(v) => updateField("address", v)}
                  />
                  <InlineField
                    label="Code"
                    value={property.code}
                    mono
                    onSave={(v) => updateField("code", v)}
                  />
                  <div className="p-2 -mx-2">
                    <p className="text-xs text-gray-500">Status</p>
                    <select
                      value={property.status}
                      onChange={(e) => updateField("status", e.target.value)}
                      className="mt-1 text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Access & Info — inline editable */}
            <Card>
              <CardContent>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Access & Info</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <Key size={16} className="text-gray-400 mt-0.5 shrink-0" />
                    <InlineField
                      label="Lockbox Code"
                      value={property.lockboxCode || ""}
                      mono
                      onSave={(v) => updateField("lockboxCode", v)}
                    />
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <Wifi size={16} className="text-gray-400 mt-0.5 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <InlineField
                        label="WiFi Name"
                        value={property.wifiName || ""}
                        onSave={(v) => updateField("wifiName", v)}
                      />
                      <InlineField
                        label="WiFi Password"
                        value={property.wifiPassword || ""}
                        mono
                        onSave={(v) => updateField("wifiPassword", v)}
                      />
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <Car size={16} className="text-gray-400 mt-0.5 shrink-0" />
                    <InlineField
                      label="Parking Instructions"
                      value={property.parkingInstructions || ""}
                      onSave={(v) => updateField("parkingInstructions", v)}
                    />
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <Trash2 size={16} className="text-gray-400 mt-0.5 shrink-0" />
                    <InlineField
                      label="Trash Day"
                      value={property.trashDay || ""}
                      onSave={(v) => updateField("trashDay", v)}
                    />
                  </div>
                </div>
                {/* Special Instructions — editable */}
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle size={14} className="text-yellow-600" />
                    <p className="text-xs font-medium text-yellow-700 uppercase">
                      Special Instructions
                    </p>
                  </div>
                  <InlineField
                    label=""
                    value={property.specialInstructions || ""}
                    onSave={(v) => updateField("specialInstructions", v)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Owner Info — inline editable */}
            <Card>
              <CardContent>
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <User size={18} className="text-gray-400" />
                  Owner
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <InlineField
                    label="Owner Name"
                    value={owner.name || ""}
                    onSave={(v) => updateField("ownerName", v)}
                  />
                  <InlineField
                    label="Owner Email"
                    value={owner.email || ""}
                    type="email"
                    onSave={(v) => updateField("ownerEmail", v)}
                  />
                  <InlineField
                    label="Owner Phone"
                    value={owner.phone || ""}
                    type="tel"
                    onSave={(v) => updateField("ownerPhone", v)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Recent Jobs */}
            <Card>
              <CardContent>
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
                          <p className="text-xs text-gray-400">
                            {formatDate(job.scheduledDate)} - {job.jobType}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">
                            {formatCurrency(job.totalFee)}
                          </p>
                          <StatusBadge status={job.status} />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardContent>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">At a Glance</h2>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Rooms</span>
                    <span className="font-medium">{property.rooms?.length ?? 0}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Instructions</span>
                    <span className="font-medium">{instructions.length}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Notes</span>
                    <span className="font-medium">{notes.length}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Default Fee</span>
                    <span className="font-semibold">{formatCurrency(property.baseRate)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">House Cut</span>
                    <span className="font-semibold">{property.expensePercent}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ─── INSTRUCTIONS TAB ──────────────────────────── */}
      {activeTab === "instructions" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Standing Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-4">
              Add specific cleaning instructions. They will be shown to the team for every job at
              this property.
            </p>

            {/* Add new instruction */}
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
                  <select
                    value={newInstrPriority}
                    onChange={(e) => setNewInstrPriority(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    {priorityOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Category (optional)
                  </label>
                  <select
                    value={newInstrCategory}
                    onChange={(e) => setNewInstrCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value="">General</option>
                    {ROOM_OPTIONS.map((room) => (
                      <option key={room} value={room}>
                        {room}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  value={newInstrText}
                  onChange={(e) => setNewInstrText(e.target.value)}
                  placeholder="Enter a cleaning instruction..."
                  onKeyDown={(e) => e.key === "Enter" && handleAddInstruction()}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <Button
                  onClick={handleAddInstruction}
                  loading={savingInstr}
                  disabled={!newInstrText.trim()}
                >
                  <Plus size={16} />
                  Add
                </Button>
              </div>
            </div>

            {/* Instructions list */}
            {instructions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No instructions yet. Add your first instruction above.
              </div>
            ) : (
              <div className="space-y-4">
                {(["high", "medium", "low"] as const).map(
                  (priority) =>
                    groupedInstructions[priority] &&
                    groupedInstructions[priority].length > 0 && (
                      <div key={priority}>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                          {priority} Priority
                        </p>
                        <div className="space-y-2">
                          {groupedInstructions[priority].map((instr) => (
                            <div
                              key={instr.id}
                              className={cn(
                                "flex items-start gap-3 p-3 rounded-lg border group",
                                priorityColor[priority]
                              )}
                            >
                              {editingInstr?.id === instr.id ? (
                                <div className="flex-1 space-y-2">
                                  <input
                                    value={editingInstr.text}
                                    onChange={(e) =>
                                      setEditingInstr({ ...editingInstr, text: e.target.value })
                                    }
                                    autoFocus
                                    className="w-full px-2 py-1 border border-blue-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                  <div className="flex gap-2">
                                    <select
                                      value={editingInstr.priority}
                                      onChange={(e) =>
                                        setEditingInstr({
                                          ...editingInstr,
                                          priority: e.target.value as "high" | "medium" | "low",
                                        })
                                      }
                                      className="px-2 py-1 border border-gray-300 rounded-md text-sm"
                                    >
                                      {priorityOptions.map((o) => (
                                        <option key={o.value} value={o.value}>
                                          {o.label}
                                        </option>
                                      ))}
                                    </select>
                                    <select
                                      value={editingInstr.category || ""}
                                      onChange={(e) =>
                                        setEditingInstr({
                                          ...editingInstr,
                                          category: e.target.value || undefined,
                                        })
                                      }
                                      className="px-2 py-1 border border-gray-300 rounded-md text-sm"
                                    >
                                      <option value="">General</option>
                                      {ROOM_OPTIONS.map((r) => (
                                        <option key={r} value={r}>
                                          {r}
                                        </option>
                                      ))}
                                    </select>
                                    <Button size="sm" onClick={handleUpdateInstruction}>
                                      <Save size={14} />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setEditingInstr(null)}
                                    >
                                      <X size={14} />
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="flex-1">
                                    <p
                                      className="text-sm cursor-pointer hover:text-blue-600"
                                      onClick={() => setEditingInstr(instr)}
                                    >
                                      {instr.text}
                                    </p>
                                    {instr.category && (
                                      <span className="text-xs text-gray-500 mt-1 inline-block">
                                        {instr.category}
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => handleDeleteInstruction(instr.id)}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-50 rounded transition-opacity"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── ROOMS TAB ─────────────────────────────────── */}
      {activeTab === "rooms" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              <span className="flex items-center gap-2">
                <BedDouble size={18} className="text-gray-400" />
                Rooms ({property.rooms?.length ?? 0})
              </span>
            </CardTitle>
            <Button size="sm" onClick={openAddRoom}>
              <Plus size={16} />
              Add Room
            </Button>
          </CardHeader>
          <CardContent>
            {!property.rooms || property.rooms.length === 0 ? (
              <EmptyState
                icon={<BedDouble size={40} />}
                title="No rooms added yet"
                description="Add rooms to document bed configurations and stocking notes."
                action={{ label: "Add Room", onClick: openAddRoom }}
              />
            ) : (
              <div className="space-y-3">
                {property.rooms.map((room) => (
                  <div
                    key={room.id}
                    className="flex items-start justify-between p-4 bg-gray-50 rounded-lg group hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{room.name}</p>
                      {room.bedConfig && (
                        <p className="text-sm text-gray-500 mt-0.5">Beds: {room.bedConfig}</p>
                      )}
                      {room.stockingNotes && (
                        <p className="text-sm text-gray-400 mt-0.5">{room.stockingNotes}</p>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditRoom(room)}
                        className="p-1.5 text-gray-500 hover:bg-white rounded"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteRoom(room.id)}
                        className="p-1.5 text-red-500 hover:bg-white rounded"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── NOTES TAB ─────────────────────────────────── */}
      {activeTab === "notes" && (
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="flex items-center gap-2">
                <FileText size={18} className="text-gray-400" />
                Notes Timeline
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Add Note */}
            <div className="flex gap-2 mb-6">
              <input
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note about this property..."
                onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
              <Button onClick={handleAddNote} loading={savingNote} disabled={!newNote.trim()}>
                <Send size={16} />
                Add Note
              </Button>
            </div>

            {notes.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No notes yet</p>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div key={note.id} className="border-l-2 border-gray-200 pl-4 group">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm text-gray-700">{note.text}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {note.createdBy} &mdash;{" "}
                          {new Date(note.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 rounded transition-opacity"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Room Modal ────────────────────────────────── */}
      <Modal
        open={showRoomModal}
        onClose={() => setShowRoomModal(false)}
        title={editingRoom ? "Edit Room" : "Add Room"}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Room Name</label>
            <select
              value={roomForm.name}
              onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="">Select a room...</option>
              {ROOM_OPTIONS.map((room) => (
                <option key={room} value={room}>
                  {room}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Bed Configuration"
            value={roomForm.bedConfig}
            onChange={(e) => setRoomForm({ ...roomForm, bedConfig: e.target.value })}
            placeholder="e.g. 1 King, 2 Twins"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stocking Notes</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              value={roomForm.stockingNotes}
              onChange={(e) => setRoomForm({ ...roomForm, stockingNotes: e.target.value })}
              placeholder="Towels, linens, amenities needed..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowRoomModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRoom} loading={savingRoom} disabled={!roomForm.name}>
              {editingRoom ? "Save Changes" : "Add Room"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
