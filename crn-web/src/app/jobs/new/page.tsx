"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Plus } from "lucide-react";
import type { FinancialModelConfig } from "crn-shared";

interface Property {
  id: string;
  name: string;
  code: string;
  defaultFee: number;
  defaultHouseCutPercent: number;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  defaultShare: number;
}

interface Settings {
  financialModel: FinancialModelConfig;
}

const jobTypes = ["Standard Clean", "Deep Clean", "Turnover", "Move-In/Out", "Post-Construction", "Touch-Up"];

export default function NewJobPage() {
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [propertyId, setPropertyId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [time, setTime] = useState("");
  const [jobType, setJobType] = useState("Standard Clean");
  const [fee, setFee] = useState("");
  const [houseCutPercent, setHouseCutPercent] = useState("");
  const [isBtoB, setIsBtoB] = useState(false);
  const [notes, setNotes] = useState("");
  const [selectedCrew, setSelectedCrew] = useState<Array<{ userId: string; share: number }>>([]);

  useEffect(() => {
    Promise.all([
      api.get<{ properties: Property[] }>("/properties", { status: "active" }),
      api.get<{ members: TeamMember[] }>("/team", { status: "active" }),
      api.get<Settings>("/settings"),
    ])
      .then(([propData, teamData, settingsData]) => {
        setProperties(propData.properties);
        setTeamMembers(teamData.members);
        setSettings(settingsData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Auto-fill fee/house cut when property changes
  useEffect(() => {
    const prop = properties.find((p) => p.id === propertyId);
    if (prop) {
      setFee(String(prop.defaultFee));
      setHouseCutPercent(String(prop.defaultHouseCutPercent));
    }
  }, [propertyId, properties]);

  const toggleCrewMember = (memberId: string) => {
    setSelectedCrew((prev) => {
      const exists = prev.find((c) => c.userId === memberId);
      if (exists) return prev.filter((c) => c.userId !== memberId);
      const member = teamMembers.find((m) => m.id === memberId);
      return [...prev, { userId: memberId, share: member?.defaultShare ?? 1 }];
    });
  };

  const updateCrewShare = (userId: string, share: number) => {
    setSelectedCrew((prev) => prev.map((c) => (c.userId === userId ? { ...c, share } : c)));
  };

  const handleSave = async (addAnother: boolean) => {
    setSaving(true);
    try {
      await api.post("/jobs", {
        propertyId,
        scheduledDate: date,
        scheduledTime: time || undefined,
        jobType,
        totalFee: parseFloat(fee),
        houseCutPercent: parseFloat(houseCutPercent),
        isBtoB,
        notes: notes || undefined,
        assignments: selectedCrew,
      });
      if (addAnother) {
        // Reset form for next job, keep property/date
        setTime("");
        setJobType("Standard Clean");
        setNotes("");
        setSelectedCrew([]);
      } else {
        router.push("/jobs");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-6xl">
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    );
  }

  const shareLevels = settings?.financialModel.shareLevels ?? [
    { label: "Full", value: 1 },
    { label: "3/4", value: 0.75 },
    { label: "Half", value: 0.5 },
    { label: "Quarter", value: 0.25 },
    { label: "Ride-along", value: 0 },
  ];

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={20} className="text-gray-500" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Add Job</h1>
      </div>

      <div className="space-y-6">
        {/* Property */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Property</h2>
          <select
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            <option value="">Select a property...</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>
        </div>

        {/* Date, Time, Type */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Schedule</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time (optional)</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Job Type</label>
            <div className="flex flex-wrap gap-2">
              {jobTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => setJobType(type)}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                    jobType === type
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Financial */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Financial</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fee ($)</label>
              <input
                type="number"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">House Cut %</label>
              <input
                type="number"
                value={houseCutPercent}
                onChange={(e) => setHouseCutPercent(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer pb-2.5">
                <button
                  onClick={() => setIsBtoB(!isBtoB)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isBtoB ? "bg-orange-500" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isBtoB ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <span className="text-sm font-medium text-gray-700">B2B</span>
              </label>
            </div>
          </div>
        </div>

        {/* Crew */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Crew</h2>
          <div className="space-y-2">
            {teamMembers.map((member) => {
              const selected = selectedCrew.find((c) => c.userId === member.id);
              return (
                <div key={member.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100">
                  <button
                    onClick={() => toggleCrewMember(member.id)}
                    className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                      selected
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "border-gray-300 hover:border-blue-400"
                    }`}
                  >
                    {selected && <Check size={12} />}
                  </button>
                  <span className="text-sm font-medium text-gray-900 flex-1">{member.name}</span>
                  {selected && (
                    <div className="flex gap-1">
                      {shareLevels.map((level) => (
                        <button
                          key={level.value}
                          onClick={() => updateCrewShare(member.id, level.value)}
                          className={`text-xs px-2 py-1 rounded-full transition-colors ${
                            selected.share === level.value
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {level.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Any notes for this job..."
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end pb-8">
          <button
            onClick={() => handleSave(true)}
            disabled={saving || !propertyId || !fee}
            className="flex items-center gap-2 px-6 py-2.5 bg-white border border-blue-600 text-blue-600 hover:bg-blue-50 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <Plus size={14} /> Save & Add Another
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={saving || !propertyId || !fee}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <Check size={14} /> Save & Done
          </button>
        </div>
      </div>
    </div>
  );
}
