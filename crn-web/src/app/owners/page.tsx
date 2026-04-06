'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Users, Plus, Mail, Phone, Building, Trash2, ExternalLink, Eye, EyeOff } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency } from '@/lib/utils'
import v1Fetch from '@/lib/v1-compat'

function toast(msg: string, type: 'success' | 'error' = 'success') {
  const div = document.createElement('div')
  div.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-white text-sm ${type === 'error' ? 'bg-red-600' : 'bg-green-600'}`
  div.textContent = msg
  document.body.appendChild(div)
  setTimeout(() => div.remove(), 3000)
}

interface Property {
  id: string
  name: string
  address: string
  baseRate: number
}

interface Owner {
  id: string
  name: string
  email: string | null
  phone: string | null
  notes: string | null
  isActive: boolean
  defaultBaseRate: number | null
  defaultBillingType: string | null
  preferredContactMethod: string | null
  properties: Property[]
  _count: { properties: number }
}

function OwnersPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [owners, setOwners] = useState<Owner[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingOwner, setEditingOwner] = useState<Owner | null>(null)
  const [showInactive, setShowInactive] = useState(false)

  useEffect(() => {
    fetchOwners()
  }, [showInactive])

  // Handle edit query param (from owner detail page)
  useEffect(() => {
    const editId = searchParams.get('edit')
    if (editId && owners.length > 0) {
      const ownerToEdit = owners.find(o => o.id === editId)
      if (ownerToEdit) {
        setEditingOwner(ownerToEdit)
        setShowModal(true)
        // Clear the query param
        router.replace('/owners')
      }
    }
  }, [searchParams, owners, router])

  const fetchOwners = async () => {
    try {
      const url = showInactive ? '/api/owners?includeInactive=true' : '/api/owners'
      const response = await v1Fetch(url)
      if (response.ok) {
        const data = await response.json()
        setOwners(data)
      }
    } catch (error) {
      console.error('Failed to fetch owners:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    setEditingOwner(null)
    setShowModal(true)
  }

  const handleEdit = (owner: Owner, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingOwner(owner)
    setShowModal(true)
  }

  const handleSave = async (data: Record<string, unknown>) => {
    try {
      const url = editingOwner ? `/api/owners/${editingOwner.id}` : '/api/owners'
      const method = editingOwner ? 'PATCH' : 'POST'

      const response = await v1Fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        toast(editingOwner ? 'Owner updated' : 'Owner created')
        setShowModal(false)
        fetchOwners()
      } else {
        const error = await response.json()
        toast(error.error || 'Failed to save owner', 'error')
      }
    } catch (error) {
      toast('Failed to save owner', 'error')
    }
  }

  const handleDelete = async (owner: Owner, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Delete owner "${owner.name}"? This cannot be undone.`)) return

    try {
      const response = await v1Fetch(`/api/owners/${owner.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast('Owner deleted')
        fetchOwners()
      } else {
        const error = await response.json()
        toast(error.error || 'Failed to delete owner', 'error')
      }
    } catch (error) {
      toast('Failed to delete owner', 'error')
    }
  }

  const totalProperties = owners.reduce((sum, o) => sum + o.properties?.length || 0, 0)

  return (
    <div className="min-h-screen">
      <PageHeader title="Property Owners" />

      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {owners.filter(o => o.isActive).length} Active Owners
              </h3>
              <p className="text-sm text-gray-500">
                Managing {totalProperties} properties
              </p>
            </div>
            <button
              onClick={() => setShowInactive(!showInactive)}
              className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-full transition-colors ${
                showInactive
                  ? 'bg-gray-200 text-gray-700'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {showInactive ? <EyeOff size={14} /> : <Eye size={14} />}
              {showInactive ? 'Hide Inactive' : 'Show Inactive'}
            </button>
          </div>
          <Button onClick={handleAdd}>
            <Plus size={16} />
            Add Owner
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : owners.length === 0 ? (
          <Card>
            <CardContent>
              <EmptyState
                icon={<Users size={40} />}
                title="No owners yet"
                description="Add property owners to group and manage multiple properties together."
                actionLabel="Add Owner"
                onAction={handleAdd}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {owners.map((owner) => (
              <Card
                key={owner.id}
                className={`overflow-hidden hover:shadow-md transition-shadow cursor-pointer ${
                  !owner.isActive ? 'opacity-60 bg-gray-50' : ''
                }`}
                onClick={() => router.push(`/owners/${owner.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        owner.isActive ? 'bg-blue-100' : 'bg-gray-200'
                      }`}>
                        <Users className={owner.isActive ? 'text-blue-600' : 'text-gray-400'} size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className={`font-semibold ${owner.isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                            {owner.name}
                          </h4>
                          {!owner.isActive && (
                            <Badge variant="default">Inactive</Badge>
                          )}
                        </div>
                        {owner.isActive && (
                          <Badge variant="info" className="mt-1">
                            {(owner.properties?.length || 0)} {(owner.properties?.length || 0) === 1 ? 'property' : 'properties'}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <ExternalLink size={16} className="text-gray-400" />
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-1 text-sm text-gray-600 mb-3">
                    {owner.email && (
                      <div className="flex items-center gap-2">
                        <Mail size={12} />
                        <span className="truncate">{owner.email}</span>
                      </div>
                    )}
                    {owner.phone && (
                      <div className="flex items-center gap-2">
                        <Phone size={12} />
                        {owner.phone}
                      </div>
                    )}
                  </div>

                  {/* Properties Preview */}
                  {owner.properties.length > 0 && (
                    <div className="border-t pt-3 mb-3">
                      <p className="text-xs text-gray-500 mb-2">Properties:</p>
                      <div className="space-y-1">
                        {owner.properties.slice(0, 3).map((property) => (
                          <div
                            key={property.id}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-gray-700 truncate">{property.name}</span>
                            <span className="text-gray-500">{formatCurrency(property.baseRate)}</span>
                          </div>
                        ))}
                        {owner.properties.length > 3 && (
                          <p className="text-xs text-gray-400">
                            +{owner.properties.length - 3} more
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Default Rate */}
                  {owner.defaultBaseRate && (
                    <div className="text-sm text-gray-600 border-t pt-3">
                      <span className="text-gray-500">Default Rate:</span>
                      <span className="ml-1 font-semibold">{formatCurrency(owner.defaultBaseRate)}</span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 mt-3 pt-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={(e) => handleEdit(owner, e)}
                    >
                      Edit
                    </Button>
                    {(owner.properties?.length || 0) === 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => handleDelete(owner, e)}
                        className="text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <OwnerModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
        owner={editingOwner}
      />
    </div>
  )
}

export default function OwnersPage() {
  return (
    <Suspense fallback={<div className="min-h-screen"><div className="p-6 text-center text-gray-500">Loading...</div></div>}>
      <OwnersPageContent />
    </Suspense>
  )
}

interface OwnerModalProps {
  open: boolean
  onClose: () => void
  onSave: (data: Record<string, unknown>) => void
  owner: Owner | null
}

function OwnerModal({ open, onClose, onSave, owner }: OwnerModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    notes: '',
    defaultBaseRate: '',
    defaultBillingType: '',
    preferredContactMethod: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (owner) {
      setFormData({
        name: owner.name,
        email: owner.email || '',
        phone: owner.phone || '',
        notes: owner.notes || '',
        defaultBaseRate: owner.defaultBaseRate?.toString() || '',
        defaultBillingType: owner.defaultBillingType || '',
        preferredContactMethod: owner.preferredContactMethod || '',
      })
    } else {
      setFormData({
        name: '',
        email: '',
        phone: '',
        notes: '',
        defaultBaseRate: '',
        defaultBillingType: '',
        preferredContactMethod: '',
      })
    }
  }, [owner, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave(formData)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={owner ? 'Edit Owner' : 'Add Owner'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Owner Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="John Smith"
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="owner@example.com"
          />
          <Input
            label="Phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="(555) 123-4567"
          />
        </div>

        <div className="border-t pt-4">
          <h4 className="font-medium text-gray-900 mb-3">Default Preferences</h4>
          <p className="text-sm text-gray-500 mb-3">
            These defaults will be suggested when creating new properties for this owner.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Default Rate"
              type="number"
              step="0.01"
              value={formData.defaultBaseRate}
              onChange={(e) => setFormData({ ...formData, defaultBaseRate: e.target.value })}
              placeholder="320.00"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Billing</label>
              <select
                value={formData.defaultBillingType}
                onChange={(e) => setFormData({ ...formData, defaultBillingType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">No default</option>
                <option value="per_job">Per Job</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Contact</label>
              <select
                value={formData.preferredContactMethod}
                onChange={(e) => setFormData({ ...formData, preferredContactMethod: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">No preference</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="text">Text Message</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Internal notes about this owner..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows={3}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {owner ? 'Save Changes' : 'Add Owner'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
