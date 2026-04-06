'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatCurrency } from '@/lib/utils'
import v1Fetch from '@/lib/v1-compat'

function toast(msg: string, type: 'success' | 'error' = 'success') {
  const div = document.createElement('div')
  div.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-white text-sm ${type === 'error' ? 'bg-red-600' : 'bg-green-600'}`
  div.textContent = msg
  document.body.appendChild(div)
  setTimeout(() => div.remove(), 3000)
}

export default function NewPropertyPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    address: '',
    baseRate: '',
    expensePercent: '12',
    ownerName: '',
    ownerPhone: '',
    ownerEmail: '',
    billingType: 'per_job',
    keywords: '',
    accessCode: '',
    accessNotes: '',
  })

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }))

  const handleSave = async () => {
    if (!form.name.trim()) { toast('Property name is required', 'error'); return }
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
          billingType: form.billingType,
          keywords: form.keywords.trim(),
          accessCode: form.accessCode.trim(),
          accessNotes: form.accessNotes.trim(),
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
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <button onClick={() => router.push('/properties')} className="text-sm text-blue-600 hover:text-blue-700 mb-2 flex items-center gap-1">
              ← Back to Properties
            </button>
            <h1 className="text-2xl font-bold text-gray-900">New Property</h1>
          </div>
          <Button onClick={handleSave} loading={saving}>Save Property</Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Property Info */}
          <Card>
            <CardContent>
              <h3 className="font-semibold text-gray-900 mb-4">Property Information</h3>
              <div className="space-y-4">
                <Input label="Property Name *" value={form.name} onChange={e => update('name', e.target.value)} placeholder="Beach House" />
                <Input label="Address *" value={form.address} onChange={e => update('address', e.target.value)} placeholder="123 Ocean Drive" />
                <Input label="Calendar Keywords" value={form.keywords} onChange={e => update('keywords', e.target.value)} placeholder="beach house, smith, oceanview" />
                <p className="text-xs text-gray-500 -mt-2">Comma-separated keywords to help match calendar events</p>
              </div>
            </CardContent>
          </Card>

          {/* Owner Info */}
          <Card>
            <CardContent>
              <h3 className="font-semibold text-gray-900 mb-4">Owner Information</h3>
              <div className="space-y-4">
                <Input label="Owner Name *" value={form.ownerName} onChange={e => update('ownerName', e.target.value)} placeholder="John Smith" />
                <Input label="Owner Phone" value={form.ownerPhone} onChange={e => update('ownerPhone', e.target.value)} placeholder="(555) 123-4567" />
                <Input label="Owner Email" value={form.ownerEmail} onChange={e => update('ownerEmail', e.target.value)} placeholder="owner@example.com" />
              </div>
            </CardContent>
          </Card>

          {/* Billing */}
          <Card>
            <CardContent>
              <h3 className="font-semibold text-gray-900 mb-4">Billing</h3>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Base Rate *" value={form.baseRate} onChange={e => update('baseRate', e.target.value)} placeholder="320.00" type="number" />
                <Input label="Expense %" value={form.expensePercent} onChange={e => update('expensePercent', e.target.value)} placeholder="12" type="number" />
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Frequency</label>
                <select className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={form.billingType} onChange={e => update('billingType', e.target.value)}>
                  <option value="per_job">Per Job (immediate)</option>
                  <option value="monthly">Monthly</option>
                  <option value="monthly_end">Monthly (end of month)</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Access */}
          <Card>
            <CardContent>
              <h3 className="font-semibold text-gray-900 mb-4">Access Information</h3>
              <div className="space-y-4">
                <Input label="Lockbox Code" value={form.accessCode} onChange={e => update('accessCode', e.target.value)} placeholder="1234" />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Access Notes</label>
                  <textarea
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    rows={3}
                    value={form.accessNotes}
                    onChange={e => update('accessNotes', e.target.value)}
                    placeholder="Key under mat, gate code 5678..."
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
