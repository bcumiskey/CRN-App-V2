"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Save, AlertCircle } from "lucide-react";
import type { FinancialModelConfig, FinancialBucket } from "crn-shared";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/layout/PageHeader";

interface Settings {
  businessName: string;
  businessAddress?: string;
  businessPhone?: string;
  businessEmail?: string;
  financialModel: FinancialModelConfig;
  jobNumberPrefix: string;
  jobNumberNext: number;
  invoiceNumberPrefix: string;
  invoiceNumberNext: number;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .get<Settings>("/settings")
      .then(setSettings)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    try {
      await api.patch("/settings", settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const updateBucket = (index: number, field: keyof FinancialBucket, value: string | number) => {
    if (!settings) return;
    const buckets = [...settings.financialModel.buckets];
    buckets[index] = { ...buckets[index], [field]: value };
    setSettings({
      ...settings,
      financialModel: { ...settings.financialModel, buckets },
    });
  };

  const addBucket = () => {
    if (!settings) return;
    const buckets = [
      ...settings.financialModel.buckets,
      { name: "New Bucket", percent: 0, type: "business" as const },
    ];
    setSettings({
      ...settings,
      financialModel: { ...settings.financialModel, buckets },
    });
  };

  const removeBucket = (index: number) => {
    if (!settings) return;
    const buckets = settings.financialModel.buckets.filter((_, i) => i !== index);
    setSettings({
      ...settings,
      financialModel: { ...settings.financialModel, buckets },
    });
  };

  if (loading) {
    return (
      <div className="p-6 max-w-6xl">
        <p className="text-gray-400 text-sm">Loading settings...</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-6 max-w-6xl">
        <p className="text-gray-500">Failed to load settings</p>
      </div>
    );
  }

  const bucketSum = settings.financialModel.buckets.reduce((sum, b) => sum + b.percent, 0);
  const bucketsValid = Math.abs(bucketSum - 100) < 0.01;

  return (
    <div className="p-6 max-w-4xl">
      <PageHeader
        title="Settings"
        subtitle="Business configuration"
        actions={
          <Button
            onClick={handleSave}
            disabled={saving}
            variant="primary"
            loading={saving}
          >
            <Save size={14} />
            {saved ? "Saved!" : "Save Changes"}
          </Button>
        }
      />

      <div className="space-y-6">
        {/* Business Info */}
        <Card>
          <CardContent>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Business Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Business Name"
                type="text"
                value={settings.businessName}
                onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
              />
              <Input
                label="Phone"
                type="text"
                value={settings.businessPhone ?? ""}
                onChange={(e) => setSettings({ ...settings, businessPhone: e.target.value })}
              />
              <Input
                label="Email"
                type="email"
                value={settings.businessEmail ?? ""}
                onChange={(e) => setSettings({ ...settings, businessEmail: e.target.value })}
              />
              <Input
                label="Address"
                type="text"
                value={settings.businessAddress ?? ""}
                onChange={(e) => setSettings({ ...settings, businessAddress: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Financial Model */}
        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Financial Model</h2>
              <div className="flex items-center gap-2">
                {!bucketsValid && (
                  <span className="flex items-center gap-1 text-sm text-red-600">
                    <AlertCircle size={14} />
                    Must sum to 100% (currently {bucketSum.toFixed(1)}%)
                  </span>
                )}
                {bucketsValid && (
                  <span className="text-sm text-green-600 font-medium">100% allocated</span>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {settings.financialModel.buckets.map((bucket, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Input
                    type="text"
                    value={bucket.name}
                    onChange={(e) => updateBucket(i, "name", e.target.value)}
                    placeholder="Bucket name"
                    className="flex-1"
                  />
                  <div className="w-24">
                    <Input
                      type="number"
                      value={bucket.percent}
                      onChange={(e) => updateBucket(i, "percent", parseFloat(e.target.value) || 0)}
                      className="text-right"
                    />
                  </div>
                  <span className="text-sm text-gray-500 w-4">%</span>
                  <select
                    value={bucket.type}
                    onChange={(e) => updateBucket(i, "type", e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value="business">Business</option>
                    <option value="owner">Owner</option>
                    <option value="worker_pool">Worker Pool</option>
                  </select>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeBucket(i)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>

            <Button variant="ghost" size="sm" onClick={addBucket} className="mt-3">
              + Add Bucket
            </Button>
          </CardContent>
        </Card>

        {/* Numbering */}
        <Card>
          <CardContent>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Numbering</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Job Numbers</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Prefix"
                    type="text"
                    value={settings.jobNumberPrefix}
                    onChange={(e) => setSettings({ ...settings, jobNumberPrefix: e.target.value })}
                  />
                  <Input
                    label="Next Number"
                    type="number"
                    value={settings.jobNumberNext}
                    onChange={(e) => setSettings({ ...settings, jobNumberNext: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Preview: {settings.jobNumberPrefix}{settings.jobNumberNext}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Invoice Numbers</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Prefix"
                    type="text"
                    value={settings.invoiceNumberPrefix}
                    onChange={(e) => setSettings({ ...settings, invoiceNumberPrefix: e.target.value })}
                  />
                  <Input
                    label="Next Number"
                    type="number"
                    value={settings.invoiceNumberNext}
                    onChange={(e) => setSettings({ ...settings, invoiceNumberNext: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Preview: {settings.invoiceNumberPrefix}{settings.invoiceNumberNext}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
