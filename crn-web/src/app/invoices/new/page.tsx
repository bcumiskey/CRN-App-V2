'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Save, Plus, Trash2, Users } from 'lucide-react'
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

function todayLocalYMD() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface LineItem {
  id: string
  description: string
  amount: number
  itemType: string
  date: string | null
}

interface JobCharge {
  id: string
  amount: number
  reason: string
}

interface UnbilledJob {
  id: string
  jobNumber: string
  scheduledDate: string
  totalFee: number
  charges?: JobCharge[]
  property: { id: string; name: string }
}

// What billing this job actually collects: base fee plus any extra charges
// (mirrors generate-monthly, which invoices one line per job + one per charge)
function jobBillableTotal(job: UnbilledJob) {
  return job.totalFee + (job.charges ?? []).reduce((sum, c) => sum + c.amount, 0)
}

interface Property {
  id: string
  name: string
  ownerName: string
  ownerId: string | null
}

export default function NewInvoicePage() {
  return (
    <Suspense fallback={<NewInvoicePageLoading />}>
      <NewInvoicePageContent />
    </Suspense>
  )
}

function NewInvoicePageLoading() {
  return (
    <div className="min-h-screen">
      <PageHeader title="Create Invoice" />
      <div className="p-6">
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </div>
    </div>
  )
}

function NewInvoicePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Owner mode: /invoices/new?ownerId=...&billAll=1 — one consolidated invoice
  // for ALL of the owner's properties. Without ownerId, the original
  // property-driven flow is untouched.
  const ownerIdParam = searchParams.get('ownerId')
  const billAll = searchParams.get('billAll') === '1'
  const ownerMode = Boolean(ownerIdParam)

  const [isSaving, setIsSaving] = useState(false)

  // Owner (owner mode only)
  const [ownerName, setOwnerName] = useState<string | null>(null)

  // Property & Jobs
  const [properties, setProperties] = useState<Property[]>([])
  const [selectedPropertyId, setSelectedPropertyId] = useState('')
  const [unbilledJobs, setUnbilledJobs] = useState<UnbilledJob[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const [selectedJobs, setSelectedJobs] = useState<string[]>([])
  const [lineItems, setLineItems] = useState<LineItem[]>([])

  // Form data
  const [invoiceDate, setInvoiceDate] = useState(todayLocalYMD())
  const [paymentTerms, setPaymentTerms] = useState('Due upon receipt')
  const [discount, setDiscount] = useState(0)
  const [notes, setNotes] = useState('')
  const [billingPeriod, setBillingPeriod] = useState('')

  // Modal
  const [showAddItemModal, setShowAddItemModal] = useState(false)

  useEffect(() => {
    if (ownerMode && ownerIdParam) {
      fetchOwner(ownerIdParam)
      fetchUnbilledJobs(`ownerId=${encodeURIComponent(ownerIdParam)}`, billAll)
      // Free-text label; arbitrary spans are fine ("months can go by")
      setBillingPeriod(`Through ${formatDate(todayLocalYMD())}`)
    } else {
      fetchProperties()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerIdParam, ownerMode, billAll])

  useEffect(() => {
    if (!ownerMode && selectedPropertyId) {
      fetchUnbilledJobs(`propertyId=${encodeURIComponent(selectedPropertyId)}`)
      setSelectedJobs([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPropertyId, ownerMode])

  const fetchOwner = async (ownerId: string) => {
    try {
      const res = await v1Fetch(`/api/owners/${ownerId}`)
      if (res.ok) {
        const data = await res.json()
        setOwnerName(data.name || 'Owner')
      } else {
        toast('Failed to load owner details', 'error')
        setOwnerName('Unknown owner')
      }
    } catch (error) {
      console.error('Failed to fetch owner:', error)
      toast('Failed to load owner details', 'error')
      setOwnerName('Unknown owner')
    }
  }

  const fetchProperties = async () => {
    try {
      const res = await v1Fetch('/api/properties')
      if (res.ok) {
        const data = await res.json()
        setProperties(data.map((p: any) => ({
          id: p.id,
          name: p.name,
          ownerName: p.ownerName,
          ownerId: p.owner?.id ?? p.ownerId ?? null,
        })))
      }
    } catch (error) {
      console.error('Failed to fetch properties:', error)
    }
  }

  const fetchUnbilledJobs = async (query: string, preselectAll = false) => {
    setJobsLoading(true)
    try {
      const res = await v1Fetch(`/api/invoices/uninvoiced-jobs?${query}`)
      if (res.ok) {
        const data = await res.json()
        const jobs: UnbilledJob[] = data.jobs || []
        setUnbilledJobs(jobs)
        if (preselectAll) {
          setSelectedJobs(jobs.map(j => j.id))
        }
      }
    } catch (error) {
      console.error('Failed to fetch unbilled jobs:', error)
    } finally {
      setJobsLoading(false)
    }
  }

  // Group jobs by property so a multi-property owner invoice reads clearly
  const jobsByProperty = useMemo(() => {
    const groups = new Map<string, UnbilledJob[]>()
    for (const job of unbilledJobs) {
      const key = job.property?.name || 'Unknown property'
      const group = groups.get(key)
      if (group) group.push(job)
      else groups.set(key, [job])
    }
    return Array.from(groups.entries())
  }, [unbilledJobs])

  const calculateJobsTotal = () => {
    return unbilledJobs
      .filter(j => selectedJobs.includes(j.id))
      .reduce((sum, j) => sum + jobBillableTotal(j), 0)
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
    if (!ownerMode && !selectedPropertyId) {
      toast('Please select a property', 'error')
      return
    }

    if (selectedJobs.length === 0 && lineItems.length === 0) {
      toast('Please select jobs or add line items', 'error')
      return
    }

    let ownerId: string
    if (ownerMode) {
      ownerId = ownerIdParam!
    } else {
      const selectedProperty = properties.find(p => p.id === selectedPropertyId)
      if (!selectedProperty?.ownerId) {
        toast('This property has no owner — set an owner on the property before invoicing', 'error')
        return
      }
      ownerId = selectedProperty.ownerId
    }

    if (lineItems.some(item => !item.description.trim())) {
      toast('Every line item needs a description', 'error')
      return
    }

    if (discount < 0) {
      toast('Discount cannot be negative', 'error')
      return
    }

    setIsSaving(true)
    try {
      // Selected jobs become job-linked line items. In owner mode the invoice
      // spans multiple properties, so each line names its property. Extra
      // charges on a job get their own line, same as generate-monthly.
      const jobLineItems = unbilledJobs
        .filter(j => selectedJobs.includes(j.id))
        .flatMap(j => [
          {
            description: ownerMode
              ? `${j.property?.name || 'Unknown property'} - Turnover Cleaning - ${formatDate(j.scheduledDate)}`
              : `Turnover Cleaning - ${formatDate(j.scheduledDate)}`,
            amount: j.totalFee,
            date: j.scheduledDate,
            jobId: j.id,
            category: 'cleaning',
          },
          ...(j.charges ?? []).map(charge => ({
            description: charge.reason,
            amount: charge.amount,
            date: j.scheduledDate,
            jobId: j.id,
            category: 'extra_charge',
          })),
        ])

      const extraLineItems = lineItems.map(item => ({
        description: item.description,
        amount: item.amount,
        category: item.itemType,
        ...(item.date ? { date: item.date } : {}),
      }))

      const res = await v1Fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerId,
          // Owner-level consolidated invoices are "monthly" type with no
          // propertyId; the property-driven flow keeps its original contract
          type: ownerMode ? 'monthly' : selectedJobs.length > 0 ? 'per_job' : 'custom',
          invoiceDate,
          ...(ownerMode ? {} : { propertyId: selectedPropertyId }),
          paymentTerms,
          ...(billingPeriod ? { billingPeriod } : {}),
          ...(notes ? { notes } : {}),
          lineItems: [...jobLineItems, ...extraLineItems],
        }),
      })

      if (res.ok) {
        const newInvoice = await res.json()

        // Discount is applied via PATCH (server recalculates total = subtotal - discount)
        let discountFailed = false
        if (discount > 0) {
          const discountRes = await v1Fetch(`/api/invoices/${newInvoice.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ discount }),
          })
          discountFailed = !discountRes.ok
        }

        if (discountFailed) {
          toast('Invoice created, but the discount was not applied — edit the invoice to add it', 'error')
        } else {
          toast('Invoice created')
        }
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

  const renderJobRow = (job: UnbilledJob) => (
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
          <div className="font-medium">{formatDate(job.scheduledDate)}</div>
          <div className="text-sm text-gray-500">Turnover Cleaning</div>
          {(job.charges ?? []).length > 0 && (
            <div className="text-xs text-gray-400">
              + {formatCurrency((job.charges ?? []).reduce((sum, c) => sum + c.amount, 0))} extra charge{(job.charges ?? []).length !== 1 && 's'}
            </div>
          )}
        </div>
      </div>
      <div className="font-semibold">{formatCurrency(jobBillableTotal(job))}</div>
    </label>
  )

  const showJobsSection = ownerMode || Boolean(selectedPropertyId)

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
            {ownerMode ? (
              <Card>
                <CardHeader>
                  <CardTitle>Billing Owner</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <Users size={20} className="text-blue-600" />
                    <div>
                      <div className="font-medium text-gray-900">
                        {ownerName ?? 'Loading owner...'}
                      </div>
                      <p className="text-sm text-gray-500">
                        One consolidated invoice covering outstanding work across all of this
                        owner&apos;s properties.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
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
            )}

            {showJobsSection && unbilledJobs.length > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Unbilled Jobs</CardTitle>
                  <Button variant="outline" size="sm" onClick={handleSelectAllJobs}>
                    {selectedJobs.length === unbilledJobs.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </CardHeader>
                <CardContent>
                  {ownerMode ? (
                    <div className="space-y-4">
                      {jobsByProperty.map(([propertyName, jobs]) => (
                        <div key={propertyName}>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-semibold text-gray-700">{propertyName}</h4>
                            <span className="text-xs text-gray-500">
                              {jobs.length} job{jobs.length !== 1 && 's'} ·{' '}
                              {formatCurrency(jobs.reduce((sum, j) => sum + jobBillableTotal(j), 0))}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {jobs.map(renderJobRow)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {unbilledJobs.map(renderJobRow)}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {showJobsSection && !jobsLoading && unbilledJobs.length === 0 && (
              <Card>
                <CardContent className="text-center py-8 text-gray-500">
                  {ownerMode
                    ? 'No unbilled jobs for this owner'
                    : 'No unbilled jobs for this property'}
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
                  placeholder={ownerMode ? 'Jun 22 – Jul 5, 2026' : 'January 2026'}
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
                  disabled={
                    (!ownerMode && !selectedPropertyId) ||
                    (selectedJobs.length === 0 && lineItems.length === 0) ||
                    isSaving
                  }
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
