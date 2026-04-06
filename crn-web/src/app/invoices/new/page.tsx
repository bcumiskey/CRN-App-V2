'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { formatCurrency, formatDate } from '@/lib/utils'
import { PRESET_BILLING_ITEMS } from '@/lib/billing-items'
import v1Fetch from '@/lib/v1-compat'

function toast(msg: string, type: 'success' | 'error' = 'success') {
  const div = document.createElement('div')
  div.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-white text-sm ${type === 'error' ? 'bg-red-600' : 'bg-green-600'}`
  div.textContent = msg; document.body.appendChild(div); setTimeout(() => div.remove(), 3000)
}

interface LineItem {
  id: string
  description: string
  amount: number
  itemType: string
  date: string | null
}

interface UnbilledJob {
  id: string
  date: string
  rate: number
  property: { id: string; name: string }
}

interface Property {
  id: string
  name: string
  ownerName: string
}

export default function NewInvoicePage() {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)

  // Property & Jobs
  const [properties, setProperties] = useState<Property[]>([])
  const [selectedPropertyId, setSelectedPropertyId] = useState('')
  const [unbilledJobs, setUnbilledJobs] = useState<UnbilledJob[]>([])
  const [selectedJobs, setSelectedJobs] = useState<string[]>([])
  const [lineItems, setLineItems] = useState<LineItem[]>([])

  // Form data
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentTerms, setPaymentTerms] = useState('Due upon receipt')
  const [discount, setDiscount] = useState(0)
  const [notes, setNotes] = useState('')
  const [billingPeriod, setBillingPeriod] = useState('')

  // Modal
  const [showAddItemModal, setShowAddItemModal] = useState(false)

  useEffect(() => {
    fetchProperties()
  }, [])

  useEffect(() => {
    if (selectedPropertyId) {
      fetchUnbilledJobs(selectedPropertyId)
      setSelectedJobs([])
    }
  }, [selectedPropertyId])

  const fetchProperties = async () => {
    try {
      const res = await v1Fetch('/api/properties')
      if (res.ok) {
        const data = await res.json()
        setProperties(data.map((p: Property) => ({
          id: p.id,
          name: p.name,
          ownerName: p.ownerName,
        })))
      }
    } catch (error) {
      console.error('Failed to fetch properties:', error)
    }
  }

  const fetchUnbilledJobs = async (propertyId: string) => {
    try {
      const res = await v1Fetch(`/api/invoices/unbilled-jobs?propertyId=${propertyId}`)
      if (res.ok) {
        const data = await res.json()
        setUnbilledJobs(data.jobs || [])
      }
    } catch (error) {
      console.error('Failed to fetch unbilled jobs:', error)
    }
  }

  const calculateJobsTotal = () => {
    return unbilledJobs
      .filter(j => selectedJobs.includes(j.id))
      .reduce((sum, j) => sum + j.rate, 0)
  }

  const calculateItemsTotal = () => {
    return lineItems.reduce((sum, item) => sum + item.amount, 0)
  }

  const calculateSubtotal = () => {
    return calculateJobsTotal() + calculateItemsTotal()
  }

  const calculateTotal = () => {
    return calculateSubtotal() - discount
  }

  const handleToggleJob = (jobId: string) => {
    if (selectedJobs.includes(jobId)) {
      setSelectedJobs(selectedJobs.filter(id => id !== jobId))
    } else {
      setSelectedJobs([...selectedJobs, jobId])
    }
  }

  const handleSelectAllJobs = () => {
    if (selectedJobs.length === unbilledJobs.length) {
      setSelectedJobs([])
    } else {
      setSelectedJobs(unbilledJobs.map(j => j.id))
    }
  }

  const handleAddPresetItem = (presetId: string) => {
    const preset = PRESET_BILLING_ITEMS.find(p => p.id === presetId)
    if (preset) {
      const newItem: LineItem = {
        id: `new-${Date.now()}`,
        description: preset.label,
        amount: 0,
        itemType: preset.category,
        date: null,
      }
      setLineItems([...lineItems, newItem])
    }
    setShowAddItemModal(false)
  }

  const handleAddCustomItem = () => {
    const newItem: LineItem = {
      id: `new-${Date.now()}`,
      description: '',
      amount: 0,
      itemType: 'service',
      date: null,
    }
    setLineItems([...lineItems, newItem])
    setShowAddItemModal(false)
  }

  const handleLineItemChange = (index: number, field: string, value: string | number) => {
    const updated = [...lineItems]
    updated[index] = { ...updated[index], [field]: value }
    setLineItems(updated)
  }

  const handleRemoveLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index))
  }

  const handleCreate = async () => {
    if (!selectedPropertyId) {
      toast('Please select a property', 'error')
      return
    }

    if (selectedJobs.length === 0 && lineItems.length === 0) {
      toast('Please select jobs or add line items', 'error')
      return
    }

    setIsSaving(true)
    try {
      const res = await v1Fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: selectedPropertyId,
          jobIds: selectedJobs,
          lineItems: lineItems.map(item => ({
            description: item.description,
            amount: item.amount,
            itemType: item.itemType,
            date: item.date,
          })),
          invoiceDate,
          paymentTerms,
          discount,
          notes,
          billingPeriod,
        }),
      })

      if (res.ok) {
        const newInvoice = await res.json()
        toast('Invoice created')
        router.push(`/invoices/${newInvoice.id}`)
      } else {
        const error = await res.json()
        toast(error.error || 'Failed to create invoice', 'error')
      }
    } catch (error) {
      toast('Failed to create invoice', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen">
      <PageHeader title="Create Invoice" />

      <div className="p-6">
        <Button variant="ghost" onClick={() => router.push('/invoices')} className="mb-4">
          <ArrowLeft size={16} />
          Back to Invoices
        </Button>

        <div className="grid grid-cols-3 gap-6">
          {/* Left column - Property & Jobs selection */}
          <div className="col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Select Property</CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Property</label>
                  <select
                    value={selectedPropertyId}
                    onChange={(e) => setSelectedPropertyId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Choose a property...</option>
                    {properties.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.ownerName})</option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>

            {selectedPropertyId && unbilledJobs.length > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Unbilled Jobs</CardTitle>
                  <Button variant="outline" size="sm" onClick={handleSelectAllJobs}>
                    {selectedJobs.length === unbilledJobs.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {unbilledJobs.map((job) => (
                      <label
                        key={job.id}
                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedJobs.includes(job.id)
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selectedJobs.includes(job.id)}
                            onChange={() => handleToggleJob(job.id)}
                            className="h-4 w-4 text-blue-600 rounded"
                          />
                          <div>
                            <div className="font-medium">{formatDate(job.date)}</div>
                            <div className="text-sm text-gray-500">Turnover Cleaning</div>
                          </div>
                        </div>
                        <div className="font-semibold">{formatCurrency(job.rate)}</div>
                      </label>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedPropertyId && unbilledJobs.length === 0 && (
              <Card>
                <CardContent className="text-center py-8 text-gray-500">
                  No unbilled jobs for this property
                </CardContent>
              </Card>
            )}

            {/* Additional line items */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Additional Items</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setShowAddItemModal(true)}>
                  <Plus size={14} />
                  Add Item
                </Button>
              </CardHeader>
              <CardContent>
                {lineItems.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">No additional items</div>
                ) : (
                  <div className="space-y-2">
                    {lineItems.map((item, index) => (
                      <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <Input
                          className="flex-1"
                          value={item.description}
                          onChange={(e) => handleLineItemChange(index, 'description', e.target.value)}
                          placeholder="Description"
                        />
                        <Input
                          className="w-32"
                          type="number"
                          step="0.01"
                          value={item.amount}
                          onChange={(e) => handleLineItemChange(index, 'amount', parseFloat(e.target.value) || 0)}
                          placeholder="Amount"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveLineItem(index)}
                        >
                          <Trash2 size={14} className="text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right column - Summary */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Invoice Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="Invoice Date"
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                />
                <Input
                  label="Billing Period"
                  value={billingPeriod}
                  onChange={(e) => setBillingPeriod(e.target.value)}
                  placeholder="January 2026"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
                  <select
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Due upon receipt">Due upon receipt</option>
                    <option value="Net 15">Net 15</option>
                    <option value="Net 30">Net 30</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    rows={3}
                    placeholder="Notes visible on invoice..."
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Selected Jobs ({selectedJobs.length})</span>
                  <span>{formatCurrency(calculateJobsTotal())}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Additional Items ({lineItems.length})</span>
                  <span>{formatCurrency(calculateItemsTotal())}</span>
                </div>
                <div className="border-t pt-3 flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-semibold">{formatCurrency(calculateSubtotal())}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">Discount</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={discount}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    className="w-24 text-right"
                  />
                </div>
                <div className="border-t pt-3 flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(calculateTotal())}</span>
                </div>

                <Button
                  className="w-full mt-4"
                  onClick={handleCreate}
                  disabled={!selectedPropertyId || (selectedJobs.length === 0 && lineItems.length === 0) || isSaving}
                >
                  <Save size={16} />
                  {isSaving ? 'Creating...' : 'Create Invoice'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Add Item Modal */}
      <Modal
        open={showAddItemModal}
        onClose={() => setShowAddItemModal(false)}
        title="Add Line Item"
      >
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Preset Items</h4>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_BILLING_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleAddPresetItem(item.id)}
                  className="p-3 text-left border rounded-lg hover:bg-gray-50"
                >
                  <div className="font-medium">{item.label}</div>
                  <div className="text-xs text-gray-500">{item.category}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="border-t pt-4">
            <Button variant="outline" className="w-full" onClick={handleAddCustomItem}>
              <Plus size={14} />
              Add Custom Item
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
