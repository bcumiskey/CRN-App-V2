'use client'

import { useState, useEffect } from 'react'
import { Building, Calendar, Save, FileText, ExternalLink } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import v1Fetch from '@/lib/v1-compat'

function toast(msg: string, type: 'success' | 'error' = 'success') {
  const div = document.createElement('div')
  div.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-white text-sm ${type === 'error' ? 'bg-red-600' : 'bg-green-600'}`
  div.textContent = msg; document.body.appendChild(div); setTimeout(() => div.remove(), 5000)
}

// Form state mirrors the fields that actually exist on the v2 CompanySettings
// model. The GET response passes through mapSettingsV2toV1, which aliases
// businessName → companyName on reads; the save payload below maps back to the
// API's real field names (see buildSavePayload).
interface SettingsForm {
  companyName: string
  ownerName: string
  email: string
  phone: string
  address: string
  defaultPaymentTerms: string
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsForm>({
    companyName: 'Cleaning Right Now',
    ownerName: '',
    email: '',
    phone: '',
    address: '',
    defaultPaymentTerms: '',
  })
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const res = await v1Fetch('/api/settings')
      if (res.ok) {
        const data = await res.json()
        setSettings({
          companyName: data.companyName || data.businessName || '',
          ownerName: data.ownerName || '',
          email: data.email || '',
          phone: data.phone || '',
          address: data.address || '',
          defaultPaymentTerms: data.defaultPaymentTerms || '',
        })
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setLoading(false)
    }
  }

  // Map form state → PATCH /api/settings payload (API field names).
  // - companyName is the read-side alias; the API expects businessName.
  // - email uses z.string().email(), which rejects "" — omit when blank.
  const buildSavePayload = () => {
    const payload: Record<string, string> = {
      businessName: settings.companyName.trim(),
      ownerName: settings.ownerName.trim(),
      phone: settings.phone.trim(),
      address: settings.address.trim(),
      defaultPaymentTerms: settings.defaultPaymentTerms,
    }
    const email = settings.email.trim()
    if (email) payload.email = email
    return payload
  }

  const handleSave = async () => {
    if (!settings.companyName.trim()) {
      toast('Company name is required', 'error')
      return
    }
    setIsSaving(true)
    try {
      const res = await v1Fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildSavePayload()),
      })

      if (!res.ok) {
        // API errors are { error: string, details?: [{ field, message }] }
        let message = `Failed to save settings (${res.status})`
        try {
          const body = await res.json()
          if (body?.error) message = body.error
          if (Array.isArray(body?.details) && body.details.length > 0) {
            message += ': ' + body.details
              .map((d: { field?: string; message?: string }) =>
                d.field ? `${d.field} — ${d.message}` : d.message)
              .join('; ')
          }
        } catch {
          // Non-JSON error body; keep the status-based message
        }
        toast(message, 'error')
        return
      }

      toast('Settings saved successfully')
      // Refetch so the form reflects exactly what the server persisted
      await loadSettings()
    } catch (error) {
      console.error('Failed to save settings:', error)
      toast('Failed to save settings: network error', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <PageHeader title="Settings" />
        <div className="p-6 flex justify-center">
          <div className="animate-pulse text-gray-500">Loading settings...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <PageHeader title="Settings" />

      <div className="p-6 max-w-4xl space-y-6">
        {/* Business Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building size={20} className="text-gray-400" />
              <h3 className="font-semibold text-gray-900">Business Information</h3>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Company Name"
                value={settings.companyName}
                onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                placeholder="Your Business Name"
              />
              <Input
                label="Owner Name"
                value={settings.ownerName}
                onChange={(e) => setSettings({ ...settings, ownerName: e.target.value })}
                placeholder="Owner's full name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Email"
                type="email"
                value={settings.email}
                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                placeholder="business@example.com"
              />
              <Input
                label="Phone"
                value={settings.phone}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                placeholder="(555) 123-4567"
              />
            </div>
            <Input
              label="Address"
              value={settings.address}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              placeholder="123 Main St, City, State 12345"
            />
          </CardContent>
        </Card>

        {/* Document Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText size={20} className="text-gray-400" />
              <h3 className="font-semibold text-gray-900">Document Settings</h3>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Invoice Payment Terms
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={2}
                value={settings.defaultPaymentTerms}
                onChange={(e) => setSettings({ ...settings, defaultPaymentTerms: e.target.value })}
                placeholder="Due upon receipt"
              />
              <p className="text-sm text-gray-500 mt-1">
                Default payment terms shown on new invoices.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Calendar Integration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar size={20} className="text-gray-400" />
              <h3 className="font-semibold text-gray-900">Calendar Integration</h3>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Calendar integrations are configured per-property. Edit a property to add a Turno or
              Google Calendar iCal URL.
            </p>
            <Button variant="outline" onClick={() => (window.location.href = '/properties')}>
              <ExternalLink size={16} />
              Manage Properties
            </Button>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            <Save size={16} />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  )
}
