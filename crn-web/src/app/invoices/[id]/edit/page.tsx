'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft,
  Save,
  Mail,
  Printer,
  Download,
  CheckCircle,
  Send,
  Plus,
  Trash2,
  RefreshCw,
  Zap,
  Settings,
  Package,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { formatCurrency, formatDate } from '@/lib/utils'
import { PRESET_BILLING_ITEMS } from '@/lib/billing-items'
import v1Fetch from '@/lib/v1-compat'
import { format } from 'date-fns'

function toast(msg: string, type: 'success' | 'error' = 'success') {
  const div = document.createElement('div')
  div.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-white text-sm ${type === 'error' ? 'bg-red-600' : 'bg-green-600'}`
  div.textContent = msg; document.body.appendChild(div); setTimeout(() => div.remove(), 3000)
}

interface LineItem {
  id: string
  date?: string | null
  description: string
  amount: number
  itemType: string
  jobId?: string | null
}

interface Invoice {
  id: string
  invoiceNumber: string
  invoiceDate: string
  paymentTerms: string
  type: string
  billingPeriod?: string | null
  subtotal: number
  discount: number
  total: number
  status: string
  notes?: string | null
  lineItems: LineItem[]
  property: {
    id: string
    name: string
    address: string
    ownerName: string
    ownerEmail?: string | null
    ownerPhone?: string | null
  }
}

interface CompanySettings {
  companyName: string
  address?: string | null
  phone?: string | null
  email?: string | null
  logoUrl?: string | null
}

interface UnbilledJob {
  id: string
  date: string
  rate: number
}

export default function InvoiceEditPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [company, setCompany] = useState<CompanySettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  // Editable fields
  const [invoiceDate, setInvoiceDate] = useState('')
  const [billingPeriod, setBillingPeriod] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [notes, setNotes] = useState('')
  const [discount, setDiscount] = useState(0)
  const [lineItems, setLineItems] = useState<LineItem[]>([])

  // Auto-sync
  const [autoSync, setAutoSync] = useState(true)
  const [unbilledJobs, setUnbilledJobs] = useState<UnbilledJob[]>([])
  const [showAddItemModal, setShowAddItemModal] = useState(false)

  useEffect(() => {
    if (id) {
      loadData()
    }
  }, [id])

  const loadData = async () => {
    try {
      const [invoiceRes, settingsRes] = await Promise.all([
        v1Fetch(`/api/invoices/${id}`),
        v1Fetch('/api/settings'),
      ])

      if (invoiceRes.ok) {
        const data = await invoiceRes.json()
        setInvoice(data)
        setInvoiceDate(data.invoiceDate.split('T')[0])
        setBillingPeriod(data.billingPeriod || '')
        setPaymentTerms(data.paymentTerms)
        setNotes(data.notes || '')
        setDiscount(data.discount)
        setLineItems(data.lineItems)

        // Fetch unbilled jobs for this property
        if (data.property?.id) {
          fetchUnbilledJobs(data.property.id)
        }
      }

      if (settingsRes.ok) {
        setCompany(await settingsRes.json())
      }
    } catch (error) {
      console.error('Failed to load invoice:', error)
      toast('Failed to load invoice', 'error')
    } finally {
      setLoading(false)
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

  const calculateSubtotal = () => {
    return lineItems.reduce((sum, item) => sum + item.amount, 0)
  }

  const calculateTotal = () => {
    return calculateSubtotal() - discount
  }

  const handleLineItemChange = (index: number, field: keyof LineItem, value: string | number | null) => {
    const updated = [...lineItems]
    updated[index] = { ...updated[index], [field]: value }
    setLineItems(updated)
  }

  const handleRemoveLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index))
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

  const handleAddUnbilledJob = (job: UnbilledJob) => {
    const newItem: LineItem = {
      id: `new-${Date.now()}`,
      description: `Turnover Cleaning - ${formatDate(job.date)}`,
      amount: job.rate,
      itemType: 'service',
      date: job.date,
      jobId: job.id,
    }
    setLineItems([...lineItems, newItem])
    setUnbilledJobs(unbilledJobs.filter(j => j.id !== job.id))
  }

  const handleSave = async () => {
    if (!invoice) return
    setIsSaving(true)

    try {
      const res = await v1Fetch(`/api/invoices/${invoice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceDate,
          billingPeriod: billingPeriod || null,
          paymentTerms,
          notes: notes || null,
          discount,
          lineItems: lineItems.map(item => ({
            id: item.id.startsWith('new-') ? undefined : item.id,
            description: item.description,
            amount: item.amount,
            itemType: item.itemType,
            date: item.date,
            jobId: item.jobId,
          })),
        }),
      })

      if (res.ok) {
        const updated = await res.json()
        setInvoice(updated)
        setLineItems(updated.lineItems)
        toast('Invoice saved')
      } else {
        toast('Failed to save invoice', 'error')
      }
    } catch (error) {
      toast('Failed to save invoice', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSendEmail = async () => {
    if (!invoice) return
    if (!invoice.property?.ownerEmail) {
      toast('Property owner has no email address', 'error')
      return
    }

    // Save first
    await handleSave()

    setIsSending(true)
    try {
      const res = await v1Fetch(`/api/invoices/${invoice.id}/send`, { method: 'POST' })
      if (res.ok) {
        setInvoice({ ...invoice, status: 'sent' })
        toast(`Invoice sent to ${invoice.property?.ownerEmail}`)
      } else {
        const error = await res.json()
        toast(error.error || 'Failed to send', 'error')
      }
    } catch (error) {
      toast('Failed to send invoice', 'error')
    } finally {
      setIsSending(false)
    }
  }

  const handleMarkPaid = async () => {
    if (!invoice) return
    try {
      const res = await v1Fetch(`/api/invoices/${invoice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid' }),
      })
      if (res.ok) {
        setInvoice({ ...invoice, status: 'paid' })
        toast('Invoice marked as paid')
      }
    } catch (error) {
      toast('Failed to update invoice', 'error')
    }
  }

  const handleDownloadPDF = async () => {
    if (!invoice) return
    setIsDownloading(true)

    try {
      const res = await v1Fetch(`/api/invoices/${invoice.id}/pdf`)
      if (!res.ok) throw new Error('Failed to generate PDF')

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${invoice.invoiceNumber}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast('PDF downloaded')
    } catch (error) {
      toast('Failed to download PDF', 'error')
    } finally {
      setIsDownloading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <PageHeader title="Edit Invoice" />
        <div className="p-6 flex justify-center">
          <div className="animate-pulse text-gray-500">Loading invoice...</div>
        </div>
      </div>
    )
  }

  if (!invoice || !company) {
    return (
      <div className="min-h-screen">
        <PageHeader title="Edit Invoice" />
        <div className="p-6">
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-gray-500">Invoice not found</p>
              <Button variant="outline" className="mt-4" onClick={() => router.push('/invoices')}>
                <ArrowLeft size={16} /> Back to Invoices
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-amber-100 text-amber-800',
    sent: 'bg-blue-100 text-blue-800',
    paid: 'bg-green-100 text-green-800',
  }

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      <div className="print:hidden">
        <PageHeader title={`Edit Invoice ${invoice.invoiceNumber}`} />
      </div>

      <div className="p-6 print:p-0">
        {/* Header Actions */}
        <div className="flex justify-between items-center mb-6 print:hidden">
          <Button variant="outline" onClick={() => router.push(`/invoices/${invoice.id}`)}>
            <ArrowLeft size={16} /> View Invoice
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save size={16} /> {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-3 gap-6 print:grid-cols-1">
          {/* Left Column - Invoice Preview (editable) */}
          <div className="col-span-2 print:col-span-1">
            <Card className="print:shadow-none print:border-0">
              <CardContent className="p-8">
                {/* Invoice Header */}
                <div className="flex justify-between items-start border-b-2 border-gray-800 pb-6 mb-6">
                  <div className="flex items-start gap-4">
                    {company.logoUrl && (
                      <img src={company.logoUrl} alt={company.companyName} className="h-16 w-auto" />
                    )}
                    <div>
                      <h1 className="text-2xl font-bold text-gray-900">{company.companyName}</h1>
                      {company.address && <p className="text-sm text-gray-600 whitespace-pre-line">{company.address}</p>}
                      {company.phone && <p className="text-sm text-gray-600">{company.phone}</p>}
                      {company.email && <p className="text-sm text-gray-600">{company.email}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <h2 className="text-3xl font-bold text-gray-900">INVOICE</h2>
                    <p className="text-lg font-semibold text-gray-700 mt-1">{invoice.invoiceNumber}</p>
                    <span className={`inline-block mt-2 px-3 py-1 text-xs font-semibold uppercase rounded-full ${statusColors[invoice.status]}`}>
                      {invoice.status}
                    </span>
                  </div>
                </div>

                {/* Bill To & Invoice Details */}
                <div className="grid grid-cols-2 gap-8 mb-8">
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Bill To</h3>
                    <p className="font-semibold text-gray-900">{invoice.property?.ownerName || '-'}</p>
                    <p className="text-gray-700">{invoice.property?.name || 'Unknown Property'}</p>
                    <p className="text-gray-600 text-sm">{invoice.property?.address || ''}</p>
                    {invoice.property?.ownerEmail && (
                      <p className="text-gray-600 text-sm">{invoice.property.ownerEmail}</p>
                    )}
                  </div>
                  <div className="text-right text-sm space-y-1">
                    <div className="flex justify-end items-center gap-2">
                      <span className="text-gray-500">Invoice Date:</span>
                      <span className="font-medium">{format(new Date(invoiceDate), 'MMM d, yyyy')}</span>
                    </div>
                    {billingPeriod && (
                      <div className="flex justify-end items-center gap-2">
                        <span className="text-gray-500">Billing Period:</span>
                        <span className="font-medium">{billingPeriod}</span>
                      </div>
                    )}
                    <div className="flex justify-end items-center gap-2">
                      <span className="text-gray-500">Payment Terms:</span>
                      <span className="font-medium">{paymentTerms}</span>
                    </div>
                  </div>
                </div>

                {/* Line Items - Editable */}
                <div className="mb-8">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-800 text-white">
                        <th className="text-left py-3 px-4 font-semibold text-sm">Date</th>
                        <th className="text-left py-3 px-4 font-semibold text-sm">Description</th>
                        <th className="text-right py-3 px-4 font-semibold text-sm w-32">Amount</th>
                        <th className="w-12 print:hidden"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((item, index) => (
                        <tr key={item.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                          <td className="py-2 px-4">
                            <input
                              type="date"
                              value={item.date?.split('T')[0] || ''}
                              onChange={(e) => handleLineItemChange(index, 'date', e.target.value || null)}
                              className="w-full px-2 py-1 border rounded text-sm print:border-0 print:bg-transparent"
                            />
                          </td>
                          <td className="py-2 px-4">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => handleLineItemChange(index, 'description', e.target.value)}
                              className="w-full px-2 py-1 border rounded text-sm print:border-0 print:bg-transparent"
                              placeholder="Description"
                            />
                            {item.jobId && (
                              <span className="text-xs text-blue-600 print:hidden">Linked to job</span>
                            )}
                          </td>
                          <td className="py-2 px-4">
                            <input
                              type="number"
                              step="0.01"
                              value={item.amount}
                              onChange={(e) => handleLineItemChange(index, 'amount', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 border rounded text-sm text-right print:border-0 print:bg-transparent"
                            />
                          </td>
                          <td className="py-2 px-4 print:hidden">
                            <button
                              onClick={() => handleRemoveLineItem(index)}
                              className="text-gray-400 hover:text-red-600"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="mt-2 print:hidden">
                    <Button variant="outline" size="sm" onClick={() => setShowAddItemModal(true)}>
                      <Plus size={14} /> Add Line Item
                    </Button>
                  </div>
                </div>

                {/* Totals */}
                <div className="flex justify-end mb-8">
                  <div className="w-72">
                    <div className="flex justify-between py-2 text-sm">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="text-gray-900 font-medium">{formatCurrency(calculateSubtotal())}</span>
                    </div>
                    <div className="flex justify-between py-2 text-sm items-center print:hidden">
                      <span className="text-gray-600">Discount:</span>
                      <input
                        type="number"
                        step="0.01"
                        value={discount}
                        onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-1 border rounded text-right text-sm"
                      />
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between py-2 text-sm hidden print:flex">
                        <span className="text-gray-600">Discount:</span>
                        <span className="text-green-600 font-medium">-{formatCurrency(discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-3 border-t-2 border-gray-800 mt-2">
                      <span className="text-lg font-bold text-gray-900">Total Due:</span>
                      <span className="text-lg font-bold text-gray-900">{formatCurrency(calculateTotal())}</span>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {notes && (
                  <div className="p-4 bg-gray-50 rounded-lg hidden print:block">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Notes</h4>
                    <p className="text-sm text-gray-700 whitespace-pre-line">{notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Actions & Settings */}
          <div className="space-y-4 print:hidden">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap size={18} className="text-amber-500" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {invoice.status === 'draft' && invoice.property?.ownerEmail && (
                  <Button className="w-full" onClick={handleSendEmail} disabled={isSending}>
                    <Mail size={16} /> {isSending ? 'Sending...' : 'Send Email'}
                  </Button>
                )}
                {invoice.status === 'draft' && !invoice.property?.ownerEmail && (
                  <Button variant="outline" className="w-full" onClick={() => {
                    v1Fetch(`/api/invoices/${invoice.id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ status: 'sent' }),
                    }).then(() => {
                      setInvoice({ ...invoice, status: 'sent' })
                      toast('Invoice marked as sent')
                    })
                  }}>
                    <Send size={16} /> Mark as Sent
                  </Button>
                )}
                {invoice.status === 'sent' && (
                  <Button variant="success" className="w-full" onClick={handleMarkPaid}>
                    <CheckCircle size={16} /> Mark as Paid
                  </Button>
                )}
                <Button variant="outline" className="w-full" onClick={handleDownloadPDF} disabled={isDownloading}>
                  <Download size={16} /> {isDownloading ? 'Generating...' : 'Download PDF'}
                </Button>
                <Button variant="outline" className="w-full" onClick={handlePrint}>
                  <Printer size={16} /> Print
                </Button>
              </CardContent>
            </Card>

            {/* Invoice Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Settings size={18} className="text-gray-500" />
                  Invoice Settings
                </CardTitle>
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
                  placeholder="e.g., January 2026"
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

            {/* Auto-Sync */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <RefreshCw size={18} className={autoSync ? 'text-green-500' : 'text-gray-400'} />
                  Auto-Sync
                </CardTitle>
              </CardHeader>
              <CardContent>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoSync}
                    onChange={(e) => setAutoSync(e.target.checked)}
                    className="w-5 h-5 rounded text-blue-600"
                  />
                  <div>
                    <span className="font-medium text-gray-900">Sync with Jobs</span>
                    <p className="text-xs text-gray-500">Auto-add completed jobs to this invoice</p>
                  </div>
                </label>

                {unbilledJobs.length > 0 && (
                  <div className="mt-4 border-t pt-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Unbilled Jobs ({unbilledJobs.length})
                    </p>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {unbilledJobs.map(job => (
                        <div
                          key={job.id}
                          className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                        >
                          <div>
                            <span className="font-medium">{formatDate(job.date)}</span>
                            <span className="text-gray-500 ml-2">{formatCurrency(job.rate)}</span>
                          </div>
                          <button
                            onClick={() => handleAddUnbilledJob(job)}
                            className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                          >
                            + Add
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Saved Items */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package size={18} className="text-purple-500" />
                  Your Saved Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {PRESET_BILLING_ITEMS.slice(0, 6).map(item => (
                    <button
                      key={item.id}
                      onClick={() => handleAddPresetItem(item.id)}
                      className="p-2 text-left text-sm border rounded hover:bg-gray-50 transition-colors"
                    >
                      <div className="font-medium text-gray-900 truncate">{item.label}</div>
                      <div className="text-xs text-gray-500">{item.category}</div>
                    </button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-3"
                  onClick={handleAddCustomItem}
                >
                  <Plus size={14} /> Custom Item
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
              {PRESET_BILLING_ITEMS.map(item => (
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
              <Plus size={14} /> Add Custom Item
            </Button>
          </div>
        </div>
      </Modal>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          .print\\:flex { display: flex !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:border-0 { border: none !important; }
          .print\\:bg-transparent { background: transparent !important; }
          .print\\:bg-white { background: white !important; }
          .print\\:col-span-1 { grid-column: span 1 !important; }
          .print\\:grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)) !important; }
        }
      `}</style>
    </div>
  )
}
