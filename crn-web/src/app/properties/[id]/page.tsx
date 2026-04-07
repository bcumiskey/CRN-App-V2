"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import v1Fetch from "@/lib/v1-compat";
import {
  ArrowLeft,
  Plus,
  Trash2,
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
  Palette,
  Tag,
  Shirt,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
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
  bedType?: string;
  bedCount?: number;
  towelCount?: number;
  floor?: string;
  hasRobes?: boolean;
  hasSlippers?: boolean;
  stockingNotes?: string;
}

interface StandingInstruction {
  id: string;
  text: string;
  instruction?: string; // V1 compat
  priority: "critical" | "important" | "normal" | "high" | "medium" | "low";
  category?: string;
  room?: string;
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

interface ChecklistItem {
  id: string;
  text: string;
  completed?: boolean;
}

interface Checklist {
  id: string;
  name: string;
  items: ChecklistItem[];
}

interface Property {
  id: string;
  name: string;
  code: string;
  address?: string;
  status: string;
  baseRate: number;
  expensePercent: number;
  defaultJobFee?: number;
  houseCutPercent?: number;
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
  calendarKeywords?: string;
  billingType?: string;
  ownerId?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  owner?: Owner;
  rooms: Room[];
  recentJobs?: RecentJob[];
  checklists?: Checklist[];
  standingInstructions?: StandingInstruction[];
  propertyNotes?: Note[];
}

// ── Helpers ────────────────────────────────────────────────
const CALENDAR_COLORS = [
  "#3B82F6", "#10B981", "#8B5CF6", "#EC4899",
  "#6366F1", "#14B8A6", "#F97316", "#06B6D4",
  "#EF4444", "#84CC16", "#A855F7", "#F59E0B",
  "#0EA5E9", "#D946EF", "#22C55E", "#FB923C",
];

const ROOM_OPTIONS = [
  "Living Room", "Kitchen", "Master Bedroom", "Bedroom 2",
  "Bedroom 3", "Bedroom 4", "Master Bathroom", "Bathroom 2",
  "Bathroom 3", "Dining Room", "Patio/Deck", "Pool Area",
  "Garage", "Laundry Room", "Entry", "Hallway", "Other",
];

const PRIORITY_LABELS: Record<string, string> = {
  critical: "Critical",
  important: "Important",
  normal: "Normal",
  high: "Critical",
  medium: "Important",
  low: "Normal",
};

const PRIORITY_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-red-100 text-red-800 border-red-200",
  important: "bg-amber-100 text-amber-800 border-amber-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  normal: "bg-gray-100 text-gray-700 border-gray-200",
  low: "bg-gray-100 text-gray-700 border-gray-200",
};

/** Normalize priority strings to the three display groups */
function normalizePriority(p: string): "critical" | "important" | "normal" {
  if (p === "critical" || p === "high") return "critical";
  if (p === "important" || p === "medium") return "important";
  return "normal";
}

// ── Inline Editable Field ──────────────────────────────────
function InlineField({
  label,
  value,
  onSave,
  type = "text",
  mono = false,
  multiline = false,
}: {
  label: string;
  value: string;
  onSave: (val: string) => void;
  type?: string;
  mono?: boolean;
  multiline?: boolean;
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
        {label && <p className="text-xs text-gray-500">{label}</p>}
        <p className={cn("text-sm font-medium text-gray-900", mono && "font-mono", multiline && "whitespace-pre-wrap")}>
          {value || <span className="text-gray-400 italic">Click to add...</span>}
        </p>
        <Pencil
          size={12}
          className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
        />
      </div>
    );
  }

  const commit = () => {
    onSave(draft);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (multiline) {
    return (
      <div className="space-y-1">
        {label && <p className="text-xs text-gray-500">{label}</p>}
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
          rows={3}
          onKeyDown={(e) => {
            if (e.key === "Escape") cancel();
          }}
          className={cn(
            "w-full px-2 py-1 text-sm border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
            mono && "font-mono"
          )}
        />
        <div className="flex gap-1">
          <button onClick={commit} className="p-1 text-green-600 hover:bg-green-50 rounded">
            <Check size={14} />
          </button>
          <button onClick={cancel} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {label && <p className="text-xs text-gray-500">{label}</p>}
      <div className="flex gap-1">
        <input
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") cancel();
          }}
          className={cn(
            "flex-1 px-2 py-1 text-sm border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
            mono && "font-mono"
          )}
        />
        <button onClick={commit} className="p-1 text-green-600 hover:bg-green-50 rounded">
          <Check size={14} />
        </button>
        <button onClick={cancel} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
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
  const [instructions, setInstructions] = useState<StandingInstruction[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"info" | "instructions" | "rooms" | "notes">("info");

  // Inline field save
  const [saving, setSaving] = useState(false);

  // Instructions form
  const [newInstrText, setNewInstrText] = useState("");
  const [newInstrPriority, setNewInstrPriority] = useState<string>("normal");
  const [newInstrCategory, setNewInstrCategory] = useState("");
  const [savingInstr, setSavingInstr] = useState(false);
  const [editingInstr, setEditingInstr] = useState<StandingInstruction | null>(null);

  // Room management
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [roomForm, setRoomForm] = useState({
    name: "",
    bedConfig: "",
    bedType: "",
    bedCount: "",
    towelCount: "",
    floor: "",
    hasRobes: false,
    hasSlippers: false,
    stockingNotes: "",
  });
  const [savingRoom, setSavingRoom] = useState(false);

  // Notes
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Color picker
  const [showColorPicker, setShowColorPicker] = useState(false);

  // ── Load data ──────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [propRes, instrRes, notesRes] = await Promise.all([
        v1Fetch(`/api/properties/${id}`),
        v1Fetch(`/api/properties/${id}/instructions`).catch(() => null),
        v1Fetch(`/api/properties/${id}/notes`).catch(() => null),
      ]);

      if (propRes.ok) {
        const propData = await propRes.json();
        setProperty(propData);
      }

      if (instrRes && instrRes.ok) {
        const instrData = await instrRes.json();
        // Handle both { instructions: [...] } and flat array
        const list = instrData.instructions || instrData;
        setInstructions(
          Array.isArray(list)
            ? list.map((i: any) => ({
                ...i,
                text: i.text || i.instruction || "",
                priority: i.priority || "normal",
              }))
            : []
        );
      }

      if (notesRes && notesRes.ok) {
        const notesData = await notesRes.json();
        setNotes(notesData.notes || notesData || []);
      }
    } catch (err) {
      console.error("Failed to load property data:", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) loadData();
  }, [id, loadData]);

  // ── Property field update ──────────────────────────────
  const updateField = async (field: string, value: string | number | boolean) => {
    if (!property) return;
    setSaving(true);
    try {
      const res = await v1Fetch(`/api/properties/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProperty(updated);
      }
    } catch {
      console.error("Failed to update property");
    } finally {
      setSaving(false);
    }
  };

  // ── Instructions ───────────────────────────────────────
  const handleAddInstruction = async () => {
    if (!newInstrText.trim()) return;
    setSavingInstr(true);
    try {
      const res = await v1Fetch(`/api/properties/${id}/instructions`, {
        method: "POST",
        body: JSON.stringify({
          text: newInstrText,
          instruction: newInstrText,
          priority: newInstrPriority,
          category: newInstrCategory || undefined,
          room: newInstrCategory || undefined,
        }),
      });
      if (res.ok) {
        const added = await res.json();
        setInstructions([
          ...instructions,
          {
            ...added,
            text: added.text || added.instruction || newInstrText,
            priority: added.priority || newInstrPriority,
          },
        ]);
        setNewInstrText("");
        setNewInstrCategory("");
      }
    } catch {
      console.error("Failed to add instruction");
    } finally {
      setSavingInstr(false);
    }
  };

  const handleUpdateInstruction = async () => {
    if (!editingInstr) return;
    try {
      const res = await v1Fetch(`/api/properties/${id}/instructions`, {
        method: "PUT",
        body: JSON.stringify({
          id: editingInstr.id,
          text: editingInstr.text,
          instruction: editingInstr.text,
          priority: editingInstr.priority,
          category: editingInstr.category,
          room: editingInstr.category,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setInstructions(
          instructions.map((i) =>
            i.id === editingInstr.id
              ? { ...updated, text: updated.text || updated.instruction || editingInstr.text, priority: updated.priority || editingInstr.priority }
              : i
          )
        );
        setEditingInstr(null);
      }
    } catch {
      console.error("Failed to update instruction");
    }
  };

  const handleDeleteInstruction = async (instrId: string) => {
    try {
      const res = await v1Fetch(`/api/properties/${id}/instructions?instructionId=${instrId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setInstructions(instructions.filter((i) => i.id !== instrId));
      }
    } catch {
      console.error("Failed to delete instruction");
    }
  };

  // ── Rooms ──────────────────────────────────────────────
  const openAddRoom = () => {
    setEditingRoom(null);
    setRoomForm({
      name: "",
      bedConfig: "",
      bedType: "",
      bedCount: "",
      towelCount: "",
      floor: "",
      hasRobes: false,
      hasSlippers: false,
      stockingNotes: "",
    });
    setShowRoomModal(true);
  };

  const openEditRoom = (room: Room) => {
    setEditingRoom(room);
    setRoomForm({
      name: room.name,
      bedConfig: room.bedConfig || "",
      bedType: room.bedType || "",
      bedCount: String(room.bedCount || ""),
      towelCount: String(room.towelCount || ""),
      floor: room.floor || "",
      hasRobes: room.hasRobes || false,
      hasSlippers: room.hasSlippers || false,
      stockingNotes: room.stockingNotes || "",
    });
    setShowRoomModal(true);
  };

  const handleSaveRoom = async () => {
    if (!roomForm.name.trim()) return;
    setSavingRoom(true);
    try {
      const payload = {
        name: roomForm.name,
        bedConfig: roomForm.bedConfig || undefined,
        bedType: roomForm.bedType || undefined,
        bedCount: roomForm.bedCount ? parseInt(roomForm.bedCount) : undefined,
        towelCount: roomForm.towelCount ? parseInt(roomForm.towelCount) : undefined,
        floor: roomForm.floor || undefined,
        hasRobes: roomForm.hasRobes,
        hasSlippers: roomForm.hasSlippers,
        stockingNotes: roomForm.stockingNotes || undefined,
      };

      if (editingRoom) {
        await v1Fetch(`/api/properties/${id}/rooms/${editingRoom.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await v1Fetch(`/api/properties/${id}/rooms`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setShowRoomModal(false);
      loadData();
    } catch {
      console.error("Failed to save room");
    } finally {
      setSavingRoom(false);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!confirm("Delete this room?")) return;
    try {
      await v1Fetch(`/api/properties/${id}/rooms/${roomId}`, {
        method: "DELETE",
      });
      loadData();
    } catch {
      console.error("Failed to delete room");
    }
  };

  // ── Notes ──────────────────────────────────────────────
  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setSavingNote(true);
    try {
      const res = await v1Fetch(`/api/properties/${id}/notes`, {
        method: "POST",
        body: JSON.stringify({ text: newNote }),
      });
      if (res.ok) {
        const added = await res.json();
        setNotes([added, ...notes]);
        setNewNote("");
      }
    } catch {
      console.error("Failed to add note");
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await v1Fetch(`/api/properties/${id}/notes/${noteId}`, {
        method: "DELETE",
      });
      setNotes(notes.filter((n) => n.id !== noteId));
    } catch {
      console.error("Failed to delete note");
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

  // Group instructions by normalized priority
  const groupedInstructions: Record<string, StandingInstruction[]> = { critical: [], important: [], normal: [] };
  instructions.forEach((instr) => {
    const group = normalizePriority(instr.priority || "normal");
    groupedInstructions[group].push(instr);
  });

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
            {/* Color swatch */}
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="w-5 h-5 rounded-full border-2 border-white shadow-sm shrink-0 cursor-pointer hover:scale-110 transition-transform"
              style={{ backgroundColor: property.color || "#3B82F6" }}
              title="Calendar color"
            />
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

      {/* Color Picker Popover */}
      {showColorPicker && (
        <div className="mb-4 p-4 bg-white border border-gray-200 rounded-lg shadow-lg w-fit">
          <p className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-1">
            <Palette size={12} />
            Calendar Color
          </p>
          <div className="flex flex-wrap gap-2">
            {CALENDAR_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => {
                  updateField("color", color);
                  setShowColorPicker(false);
                }}
                className={cn(
                  "w-8 h-8 rounded-full border-2 transition-transform hover:scale-110",
                  property.color === color ? "border-gray-900 scale-110" : "border-transparent"
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          {property.calendarKeywords && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                <Tag size={10} className="inline mr-1" />
                Keywords: {property.calendarKeywords}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Property Image */}
      {property.imageUrl && (
        <div className="mb-6 rounded-xl overflow-hidden max-w-md">
          <img
            src={property.imageUrl}
            alt={property.name}
            className="w-full h-48 object-cover"
          />
        </div>
      )}

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
            {/* Quick Info Cards */}
            <Card>
              <CardContent>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Info</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                      <DollarSign size={12} />
                      Base Rate
                    </p>
                    <p className="text-lg font-bold text-green-800">
                      {formatCurrency(property.baseRate ?? property.defaultJobFee ?? 0)}
                    </p>
                    <button
                      onClick={() => {
                        const val = prompt("Enter new base rate:", String(property.baseRate || 0));
                        if (val !== null) updateField("baseRate", parseFloat(val) || 0);
                      }}
                      className="text-xs text-green-600 hover:underline mt-1"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-600 font-medium">House Cut %</p>
                    <p className="text-lg font-bold text-blue-800">
                      {property.expensePercent ?? property.houseCutPercent ?? 0}%
                    </p>
                    <button
                      onClick={() => {
                        const val = prompt("Enter house cut %:", String(property.expensePercent || 0));
                        if (val !== null) updateField("expensePercent", parseFloat(val) || 0);
                      }}
                      className="text-xs text-blue-600 hover:underline mt-1"
                    >
                      Edit
                    </button>
                  </div>
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
                      <option value="lame_duck">Lame Duck</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Access & Info */}
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
                      label="Parking Notes"
                      value={property.parkingNotes || property.parkingInstructions || ""}
                      onSave={(v) => updateField("parkingNotes", v)}
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

                {/* Access Instructions */}
                {(property.accessInstructions || true) && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Key size={14} className="text-blue-600" />
                      <p className="text-xs font-medium text-blue-700 uppercase">Access Instructions</p>
                    </div>
                    <InlineField
                      label=""
                      value={property.accessInstructions || ""}
                      multiline
                      onSave={(v) => updateField("accessInstructions", v)}
                    />
                  </div>
                )}

                {/* Special Instructions */}
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle size={14} className="text-yellow-600" />
                    <p className="text-xs font-medium text-yellow-700 uppercase">Special Instructions</p>
                  </div>
                  <InlineField
                    label=""
                    value={property.specialInstructions || ""}
                    multiline
                    onSave={(v) => updateField("specialInstructions", v)}
                  />
                </div>

                {/* Calendar Keywords */}
                <div className="mt-4">
                  <InlineField
                    label="Calendar Keywords"
                    value={property.calendarKeywords || ""}
                    onSave={(v) => updateField("calendarKeywords", v)}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Comma-separated keywords to auto-match calendar entries to this property.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Owner Info */}
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

            {/* At a Glance */}
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
                  <hr className="border-gray-100" />
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Base Rate</span>
                    <span className="font-semibold text-green-700">
                      {formatCurrency(property.baseRate ?? property.defaultJobFee ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">House Cut</span>
                    <span className="font-semibold">
                      {property.expensePercent ?? property.houseCutPercent ?? 0}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Calendar Color</span>
                    <span
                      className="w-4 h-4 rounded-full inline-block"
                      style={{ backgroundColor: property.color || "#3B82F6" }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Checklists Summary */}
            {property.checklists && property.checklists.length > 0 && (
              <Card>
                <CardContent>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <ListChecks size={18} className="text-gray-400" />
                    Checklists
                  </h2>
                  <div className="space-y-3">
                    {property.checklists.map((cl: any) => (
                      <div key={cl.id} className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm font-medium text-gray-900">{cl.name}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {cl.items?.length ?? 0} items
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
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
              Standing instructions are shown to the cleaning team for every job at this property.
              They are grouped by priority so critical items are always visible first.
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
                    <option value="critical">Critical</option>
                    <option value="important">Important</option>
                    <option value="normal">Normal</option>
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
                  placeholder="Enter a standing instruction..."
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

            {/* Instructions grouped by priority */}
            {instructions.length === 0 ? (
              <EmptyState
                icon={<ListChecks size={40} />}
                title="No standing instructions"
                description="Add instructions that will apply to every cleaning job at this property."
              />
            ) : (
              <div className="space-y-6">
                {(["critical", "important", "normal"] as const).map((group) => {
                  const items = groupedInstructions[group];
                  if (!items || items.length === 0) return null;

                  const groupColor = {
                    critical: "border-l-red-500",
                    important: "border-l-amber-500",
                    normal: "border-l-gray-300",
                  }[group];

                  const groupBg = {
                    critical: "bg-red-50",
                    important: "bg-amber-50",
                    normal: "bg-gray-50",
                  }[group];

                  return (
                    <div key={group}>
                      <div className="flex items-center gap-2 mb-3">
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider",
                            PRIORITY_STYLES[group]
                          )}
                        >
                          {PRIORITY_LABELS[group]} ({items.length})
                        </span>
                      </div>
                      <div className="space-y-2">
                        {items.map((instr) => (
                          <div
                            key={instr.id}
                            className={cn(
                              "flex items-start gap-3 p-3 rounded-lg border-l-4 group",
                              groupColor,
                              groupBg
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
                                        priority: e.target.value as any,
                                      })
                                    }
                                    className="px-2 py-1 border border-gray-300 rounded-md text-sm"
                                  >
                                    <option value="critical">Critical</option>
                                    <option value="important">Important</option>
                                    <option value="normal">Normal</option>
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
                                  <Button size="sm" variant="ghost" onClick={() => setEditingInstr(null)}>
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
                  );
                })}
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
                description="Add rooms to document bed configurations, stocking notes, and amenities."
                action={{ label: "Add Room", onClick: openAddRoom }}
              />
            ) : (
              <div className="space-y-4">
                {property.rooms.map((room) => (
                  <div
                    key={room.id}
                    className="p-4 bg-gray-50 rounded-lg group hover:bg-gray-100 transition-colors border border-gray-100"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900 text-base">{room.name}</h3>
                        {room.floor && (
                          <span className="text-xs text-gray-400">Floor: {room.floor}</span>
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

                    {/* Bed & amenity details */}
                    <div className="flex flex-wrap gap-3 mb-3">
                      {(room.bedConfig || room.bedType) && (
                        <span className="inline-flex items-center gap-1 text-xs bg-white px-2 py-1 rounded border border-gray-200 text-gray-600">
                          <BedDouble size={12} />
                          {room.bedConfig || `${room.bedCount || ""} ${room.bedType || ""}`.trim()}
                        </span>
                      )}
                      {room.towelCount != null && room.towelCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs bg-white px-2 py-1 rounded border border-gray-200 text-gray-600">
                          Towels: {room.towelCount}
                        </span>
                      )}
                      {room.hasRobes && (
                        <span className="inline-flex items-center gap-1 text-xs bg-purple-50 px-2 py-1 rounded border border-purple-200 text-purple-700">
                          <Shirt size={12} />
                          Robes
                        </span>
                      )}
                      {room.hasSlippers && (
                        <span className="inline-flex items-center gap-1 text-xs bg-purple-50 px-2 py-1 rounded border border-purple-200 text-purple-700">
                          Slippers
                        </span>
                      )}
                    </div>

                    {/* Stocking Notes — prominent display */}
                    {room.stockingNotes && (
                      <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <FileText size={11} />
                          Stocking Notes / Property Guide
                        </p>
                        <p className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">
                          {room.stockingNotes}
                        </p>
                      </div>
                    )}
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
              <EmptyState
                icon={<FileText size={40} />}
                title="No notes yet"
                description="Add notes to keep a history of communications or observations about this property."
              />
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
        size="lg"
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

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Bed Configuration"
              value={roomForm.bedConfig}
              onChange={(e) => setRoomForm({ ...roomForm, bedConfig: e.target.value })}
              placeholder="e.g. 1 King, 2 Twins"
            />
            <Input
              label="Bed Type"
              value={roomForm.bedType}
              onChange={(e) => setRoomForm({ ...roomForm, bedType: e.target.value })}
              placeholder="e.g. King, Queen, Twin"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Bed Count"
              type="number"
              value={roomForm.bedCount}
              onChange={(e) => setRoomForm({ ...roomForm, bedCount: e.target.value })}
              placeholder="0"
            />
            <Input
              label="Towel Count"
              type="number"
              value={roomForm.towelCount}
              onChange={(e) => setRoomForm({ ...roomForm, towelCount: e.target.value })}
              placeholder="0"
            />
            <Input
              label="Floor"
              value={roomForm.floor}
              onChange={(e) => setRoomForm({ ...roomForm, floor: e.target.value })}
              placeholder="e.g. 1st, 2nd, Basement"
            />
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={roomForm.hasRobes}
                onChange={(e) => setRoomForm({ ...roomForm, hasRobes: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              Has Robes
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={roomForm.hasSlippers}
                onChange={(e) => setRoomForm({ ...roomForm, hasSlippers: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              Has Slippers
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stocking Notes / Property Guide
            </label>
            <p className="text-xs text-gray-400 mb-2">
              Towel folding methods, display arrangements, amenity placement, and other room-specific setup details.
            </p>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              value={roomForm.stockingNotes}
              onChange={(e) => setRoomForm({ ...roomForm, stockingNotes: e.target.value })}
              placeholder="e.g. Fan-fold bath towels, place 2 hand towels on vanity, stock 3 mini shampoo bottles..."
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
