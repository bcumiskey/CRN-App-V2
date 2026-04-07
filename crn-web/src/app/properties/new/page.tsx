'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import v1Fetch from '@/lib/v1-compat'

function toast(msg: string, type: 'success' | 'error' = 'success') {
  const div = document.createElement('div')
  div.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-white text-sm ${type === 'error' ? 'bg-red-600' : 'bg-green-600'}`
  div.textContent = msg
  document.body.appendChild(div)
  setTimeout(() => div.remove(), 3000)
}

interface Owner {
  id: string
  name: string
}

const COLORS = [
  '#1e40af', '#2563eb', '#10b981', '#34d399',
  '#f59e0b', '#f97316', '#ef4444', '#ec4899',
  '#8b5cf6', '#a855f7', '#06b6d4', '#14b8a6',
]

const BILLING_OPTIONS = [
  { value: 'per_job', label: 'Per Job (immediate)' },
  { value: 'monthly', label: 'Monthly (1st of month)' },
  { value: 'monthly_end', label: 'Monthly (end of month)' },
  { value: 'biweekly', label: 'Bi-weekly' },
]

export default function NewPropertyPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [owners, setOwners] = useState<Owner[]>([])

  const [form, setForm] = useState({
    name: '',
    address: '',
    baseRate: '',
    expensePercent: '12',
    ownerName: '',
    ownerPhone: '',
    ownerEmail: '',
    ownerId: '',
    billingType: 'per_job',
    autoSendInvoice: false,
    keywords: '',
    color: '#2563eb',
    accessCode: '',
    accessNotes: '',
    wifiName: '',
    wifiPassword: '',
    parkingNotes: '',
    trashDay: '',
    specialInstructions: '',
  })

  useEffect(() => {
    v1Fetch('/api/owners').then(r => r.ok ? r.json() : []).then(data => {
      setOwners(Array.isArray(data) ? data : [])
    }).catch(() => {})
  }, [])

  const update = (field: string, value: string | boolean) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const handleOwnerSelect = (ownerId: string) => {
    update('ownerId', ownerId)
    if (ownerId) {
      const owner = owners.find(o => o.id === ownerId)
      if (owner) {
        update('ownerName', (owner as any).name || '')
        update('ownerEmail', (owner as any).email || '')
        update('ownerPhone', (owner as any).phone || '')
      }
    }
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast('Property name is required', 'error'); return }
    if (!form.address.trim()) { toast('Address is required', 'error'); return }
    setSaving(true)
    try {
      const response = await v1Fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          address: form.address.trim(),
          baseRate: parseFloat(form.baseRate) || 0,
          expensePercent: parseFloat(form.expensePercent) || 12,
          ownerName: form.ownerName.trim(),
          ownerPhone: form.ownerPhone.trim(),
          ownerEmail: form.ownerEmail.trim(),
          ownerId: form.ownerId || undefined,
          billingType: form.billingType,
          autoSendInvoice: form.autoSendInvoice,
          keywords: form.keywords.trim(),
          color: form.color,
          accessCode: form.accessCode.trim(),
          accessNotes: form.accessNotes.trim(),
          wifiName: form.wifiName.trim(),
          wifiPassword: form.wifiPassword.trim(),
          parkingNotes: form.parkingNotes.trim(),
          trashDay: form.trashDay.trim(),
          specialInstructions: form.specialInstructions.trim(),
          code: form.name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20),
        }),
      })
      if (response.ok) {
        const data = await response.json()
        toast('Property created')
        router.push(`/properties/${data.id}`)
      } else {
        const err = await response.json().catch(() => null)
        toast(err?.error || 'Failed to create property', 'error')
      }
    } catch {
      toast('Failed to create property', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen">
      <div className="p-6 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <button onClick={() => router.push('/properties')} className="text-sm text-blue-600 hover:text-blue-700 mb-2 flex items-center gap-1">
              <ArrowLeft size={14} /> Back to Properties
            </button>
            <h1 className="text-2xl font-bold text-gray-900">New Property</h1>
          </div>
          <Button onClick={handleSave} loading={saving}>
            <Save size={16} /> Save Property
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Property Info */}
          <Card>
            <CardContent>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                🏠 Property Information
              </h3>
              <div className="space-y-4">
                <Input label="Property Name *" value={form.name} onChange={e => update('name', e.target.value)} placeholder="Beach House" />
                <Input label="Address *" value={form.address} onChange={e => update('address', e.target.value)} placeholder="123 Ocean Drive, Beach City, FL 12345" />
                <Input label="Calendar Keywords" value={form.keywords} onChange={e => update('keywords', e.target.value)} placeholder="beach house, smith, oceanview" />
                <p className="text-xs text-gray-500 -mt-2">Comma-separated keywords to help match calendar events to this property</p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Calendar Color</label>
                  <div className="flex gap-2 flex-wrap">
                    {COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => update('color', c)}
                        className={cn(
                          'w-8 h-8 rounded-full transition-all',
                          form.color === c ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : 'hover:scale-105'
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Color used to display this property on the calendar</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Owner Info */}
          <Card>
            <CardContent>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                👤 Owner Information
              </h3>
              <div className="space-y-4">
                {owners.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Link to Owner</label>
                    <select
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      value={form.ownerId}
                      onChange={e => handleOwnerSelect(e.target.value)}
                    >
                      <option value="">Enter owner manually</option>
                      {owners.map(o => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <Input label="Owner Name *" value={form.ownerName} onChange={e => update('ownerName', e.target.value)} placeholder="John Smith" />
                <Input label="Owner Phone" value={form.ownerPhone} onChange={e => update('ownerPhone', e.target.value)} placeholder="(555) 123-4567" />
                <Input label="Owner Email" value={form.ownerEmail} onChange={e => update('ownerEmail', e.target.value)} placeholder="owner@example.com" />
              </div>
            </CardContent>
          </Card>

          {/* Billing */}
          <Card>
            <CardContent>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                💰 Billing
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Base Rate *" value={form.baseRate} onChange={e => update('baseRate', e.target.value)} placeholder="320.00" type="number" />
                  <Input label="Expense %" value={form.expensePercent} onChange={e => update('expensePercent', e.target.value)} placeholder="12" type="number" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Frequency</label>
                  <select
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    value={form.billingType}
                    onChange={e => update('billingType', e.target.value)}
                  >
                    {BILLING_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.autoSendInvoice as boolean}
                    onChange={e => update('autoSendInvoice', e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  Auto-send invoices
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Access Info */}
          <Card>
            <CardContent>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                🔑 Access Information
              </h3>
              <div className="space-y-4">
                <Input label="Lockbox Code" value={form.accessCode} onChange={e => update('accessCode', e.target.value)} placeholder="1234" />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="WiFi Name" value={form.wifiName} onChange={e => update('wifiName', e.target.value)} placeholder="BeachHouse_WiFi" />
                  <Input label="WiFi Password" value={form.wifiPassword} onChange={e => update('wifiPassword', e.target.value)} placeholder="password123" />
                </div>
                <Input label="Trash Day" value={form.trashDay} onChange={e => update('trashDay', e.target.value)} placeholder="Tuesday" />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Parking Instructions</label>
                  <textarea
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    rows={2}
                    value={form.parkingNotes}
                    onChange={e => update('parkingNotes', e.target.value)}
                    placeholder="Park in driveway, 2 car max..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Access Notes</label>
                  <textarea
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    rows={2}
                    value={form.accessNotes}
                    onChange={e => update('accessNotes', e.target.value)}
                    placeholder="Key under mat, gate code 5678..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Special Instructions</label>
                  <textarea
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    rows={3}
                    value={form.specialInstructions}
                    onChange={e => update('specialInstructions', e.target.value)}
                    placeholder="Always leave porch light on, thermostat to 72..."
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
