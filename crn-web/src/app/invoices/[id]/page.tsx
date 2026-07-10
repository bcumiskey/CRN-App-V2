'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Printer, Send, CheckCircle, Pencil, Trash2, Check, Download, Plus, DollarSign } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import InvoiceTemplate from '@/components/documents/InvoiceTemplate'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import v1Fetch from '@/lib/v1-compat'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://crn-api.vercel.app'

function toast(msg: string, type: 'success' | 'error' = 'success') {
  const div = document.createElement('div')
  div.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-white text-sm ${type === 'error' ? 'bg-red-600' : 'bg-green-600'}`
  div.textContent = msg; document.body.appendChild(div); setTimeout(() => div.remove(), 3000)
}

function todayLocalYMD() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const PAYMENT_METHODS = [
  { value: 'venmo', label: 'Venmo' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
]

// Full method list for recording individual payments (matches the API's
// check|venmo|zelle|ach|cash|other set)
const RECORD_PAYMENT_METHODS = [
  { value: '', label: 'Not specified' },
  { value: 'check', label: 'Check' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'ach', label: 'ACH / Bank transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
]

function methodLabel(method?: string | null): string {
  if (!method) return '—'
  return RECORD_PAYMENT_METHODS.find(m => m.value === method)?.label || method
}

interface Payment {
  id: string
  amount: number
  date: string
  method?: string | null
  notes?: string | null
}

interface LineItem {
  id: string
  date?: string | null
  description: string
  amount: number
  itemType: string
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
  paymentMethod?: string | null
  paidDate?: string | null
  notes?: string | null
  lineItems: LineItem[]
  payments?: Payment[]
  amountPaid?: number
  balance?: number
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
  website?: string | null
  logoUrl?: string | null
  invoiceFooter?: string | null
  invoiceTerms?: string | null
}

export default function InvoiceViewPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [company, setCompany] = useState<CompanySettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('')

  // Whether email delivery is configured on the API — unknown until a send
  // response tells us (there is no config-probe endpoint on purpose)
  const [emailConfigured, setEmailConfigured] = useState<boolean | null>(null)

  // Record Payment modal
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState(todayLocalYMD())
  const [payMethod, setPayMethod] = useState('')
  const [payNotes, setPayNotes] = useState('')
  const [isRecordingPayment, setIsRecordingPayment] = useState(false)
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null)

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
        const invoiceData = await invoiceRes.json()
        setInvoice(invoiceData)
      }

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json()
        setCompany(settingsData)
      }
    } catch (error) {
      console.error('Failed to load invoice:', error)
      toast('Failed to load invoice', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  const handleDownloadPdf = useCallback(() => {
    window.open(`${API_BASE}/api/invoices/${id}/pdf`, '_blank', 'noopener')
  }, [id])

  const handleSend = async () => {
    if (!invoice) return
    setIsUpdating(true)

    try {
      const res = await v1Fetch(`/api/invoices/${invoice.id}/send`, {
        method: 'POST',
      })

      if (res.ok) {
        const data = await res.json()
        setInvoice({ ...invoice, status: data.invoice?.status || 'sent' })
        const reason: string | undefined = data.emailSkippedReason

        if (data.emailSent) {
          setEmailConfigured(true)
          toast(`Invoice emailed to ${invoice.property?.ownerName || 'the owner'} and marked as sent`)
        } else if (reason === 'not_configured') {
          setEmailConfigured(false)
          toast('Invoice marked as sent — no email goes out, so deliver it to the owner yourself (Print / Save as PDF)')
        } else if (reason === 'no_owner_email') {
          setEmailConfigured(true)
          toast('Invoice marked as sent, but the owner has no email address — add an email to the owner to send invoices automatically', 'error')
        } else if (reason && reason.startsWith('send_failed')) {
          setEmailConfigured(true)
          const detail = reason.replace(/^send_failed:\s*/, '')
          toast(`Invoice was marked as sent, but emailing it failed: ${detail} — deliver it to the owner yourself`, 'error')
        } else {
          toast('Invoice marked as sent')
        }
      } else {
        const error = await res.json()
        toast(error.error || 'Failed to send invoice', 'error')
      }
    } catch (error) {
      toast('Failed to send invoice', 'error')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleMarkPaid = async (paymentMethod: string) => {
    if (!invoice) return
    setIsUpdating(true)

    try {
      const paidDate = todayLocalYMD()
      const res = await v1Fetch(`/api/invoices/${invoice.id}/mark-paid`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paidDate, paymentMethod }),
      })

      if (res.ok) {
        toast(`Invoice marked as paid via ${PAYMENT_METHODS.find(p => p.value === paymentMethod)?.label}`)
        setShowPaymentModal(false)
        setSelectedPaymentMethod('')
        // Refetch — mark-paid also records the remaining balance as a payment
        await loadData()
      } else {
        const error = await res.json()
        toast(error.error || 'Failed to mark invoice as paid', 'error')
      }
    } catch (error) {
      toast('Failed to mark invoice as paid', 'error')
    } finally {
      setIsUpdating(false)
    }
  }

  const openRecordPaymentModal = () => {
    if (!invoice) return
    const balance = invoice.balance ?? invoice.total
    setPayAmount(balance > 0 ? balance.toFixed(2) : '')
    setPayDate(todayLocalYMD())
    setPayMethod('')
    setPayNotes('')
    setShowRecordPaymentModal(true)
  }

  const handleRecordPayment = async () => {
    if (!invoice) return
    const amount = parseFloat(payAmount)
    if (!amount || amount <= 0) {
      toast('Enter a payment amount greater than zero', 'error')
      return
    }
    if (!payDate) {
      toast('Please choose a payment date', 'error')
      return
    }

    setIsRecordingPayment(true)
    try {
      const res = await v1Fetch(`/api/invoices/${invoice.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          date: payDate,
          ...(payMethod ? { method: payMethod } : {}),
          ...(payNotes.trim() ? { notes: payNotes.trim() } : {}),
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.warning) {
          // Overpayment — the payment WAS recorded, but flag it loudly
          toast(`Payment recorded — ${data.warning}`, 'error')
        } else if (data.invoiceStatus === 'paid' && invoice.status !== 'paid') {
          toast('Payment recorded — invoice is now fully paid')
        } else {
          toast(`Payment recorded — ${formatCurrency(Math.max(data.balance ?? 0, 0))} remaining`)
        }
        setShowRecordPaymentModal(false)
        await loadData()
      } else {
        const error = await res.json()
        toast(error.error || 'Failed to record payment', 'error')
      }
    } catch (error) {
      toast('Failed to record payment', 'error')
    } finally {
      setIsRecordingPayment(false)
    }
  }

  const handleDeletePayment = async (payment: Payment) => {
    if (!invoice) return
    if (!confirm(`Remove the ${formatCurrency(payment.amount)} payment from ${formatDate(payment.date)}? This cannot be undone.`)) return

    setDeletingPaymentId(payment.id)
    try {
      const res = await v1Fetch(`/api/invoices/${invoice.id}/payments/${payment.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        const data = await res.json()
        if (invoice.status === 'paid' && data.invoiceStatus === 'sent') {
          toast('Payment removed — invoice is owed again and reverted to sent')
        } else {
          toast('Payment removed')
        }
        await loadData()
      } else {
        const error = await res.json()
        toast(error.error || 'Failed to remove payment', 'error')
      }
    } catch (error) {
      toast('Failed to remove payment', 'error')
    } finally {
      setDeletingPaymentId(null)
    }
  }

  const handleDelete = async () => {
    if (!invoice) return
    if (!confirm('Are you sure you want to delete this invoice? This cannot be undone.')) return

    setIsDeleting(true)

    try {
      const res = await v1Fetch(`/api/invoices/${invoice.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast('Invoice deleted')
        router.push('/invoices')
      } else {
        const error = await res.json()
        toast(error.error || 'Failed to delete invoice', 'error')
      }
    } catch (error) {
      toast('Failed to delete invoice', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <PageHeader title="Invoice" />
        <div className="p-6 flex justify-center">
          <div className="animate-pulse text-gray-500">Loading invoice...</div>
        </div>
      </div>
    )
  }

  if (!invoice || !company) {
    return (
      <div className="min-h-screen">
        <PageHeader title="Invoice" />
        <div className="p-6">
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-gray-500">Invoice not found</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => router.push('/invoices')}
              >
                <ArrowLeft size={16} />
                Back to Invoices
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const amountPaid = invoice.amountPaid ?? 0
  const balance = invoice.balance ?? invoice.total
  const payments = invoice.payments ?? []
  const isPartiallyPaid = amountPaid > 0 && amountPaid < invoice.total && invoice.status !== 'paid'

  return (
    <>
      <div className="min-h-screen bg-gray-100 print:bg-white print:min-h-0">
        {/* Print-hidden header and actions */}
        <div className="print:hidden">
          <PageHeader title={`Invoice ${invoice.invoiceNumber}`} />

          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <Button variant="outline" onClick={() => router.push('/invoices')}>
                <ArrowLeft size={16} />
                Back to Invoices
              </Button>

              <div className="flex gap-2">
                {/* Edit - only for draft invoices */}
                {invoice.status === 'draft' && (
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/invoices/${invoice.id}/edit`)}
                  >
                    <Pencil size={16} />
                    Edit
                  </Button>
                )}

                {/* Send - drafts only. Emails the invoice PDF to the owner when
                    email delivery is configured; otherwise just marks it sent. */}
                {invoice.status === 'draft' && (
                  <Button
                    variant="primary"
                    onClick={handleSend}
                    disabled={isUpdating}
                    title={
                      emailConfigured === true
                        ? 'Emails the invoice PDF to the owner and marks it as sent.'
                        : emailConfigured === false
                          ? 'Email delivery is not configured — this only marks the invoice as sent. Deliver it yourself (Download PDF).'
                          : 'Marks the invoice as sent. If email delivery is configured, the owner is emailed the invoice PDF.'
                    }
                  >
                    <Send size={16} />
                    {isUpdating ? 'Sending...' : 'Send / Mark as Sent'}
                  </Button>
                )}

                {/* Mark as Paid - for draft or sent invoices */}
                {(invoice.status === 'draft' || invoice.status === 'sent') && (
                  <Button
                    variant="success"
                    onClick={() => setShowPaymentModal(true)}
                  >
                    <CheckCircle size={16} />
                    Mark as Paid
                  </Button>
                )}

                {/* Partially paid indicator */}
                {isPartiallyPaid && (
                  <Badge variant="warning" className="px-3 py-1.5 text-sm rounded-lg">
                    <DollarSign size={14} className="mr-1" />
                    Partially paid
                  </Badge>
                )}

                {/* Paid indicator */}
                {invoice.status === 'paid' && (
                  <span className="px-3 py-1.5 bg-green-100 text-green-800 rounded-lg text-sm font-medium inline-flex items-center">
                    <CheckCircle size={14} className="mr-1" />
                    Paid{invoice.paidDate ? ` on ${formatDate(invoice.paidDate)}` : ''}
                    {invoice.paymentMethod ? ` via ${PAYMENT_METHODS.find(p => p.value === invoice.paymentMethod)?.label || invoice.paymentMethod}` : ''}
                  </span>
                )}

                {/* Download PDF — server-generated PDF, same file that gets emailed */}
                <Button variant="outline" onClick={handleDownloadPdf}>
                  <Download size={16} />
                  Download PDF
                </Button>

                {/* Print / Save as PDF — uses the browser print dialog */}
                <Button variant="outline" onClick={handlePrint}>
                  <Printer size={16} />
                  Print / Save as PDF
                </Button>

                {/* Delete - only for draft invoices */}
                {invoice.status === 'draft' && (
                  <Button
                    variant="outline"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="text-red-600 hover:text-red-700 hover:border-red-300"
                  >
                    <Trash2 size={16} />
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </Button>
                )}
              </div>
            </div>

            {/* Payments */}
            {invoice.status !== 'void' && (
              <Card className="mb-6">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <DollarSign size={18} className="text-green-600" />
                    Payments
                  </CardTitle>
                  <Button size="sm" onClick={openRecordPaymentModal} disabled={balance <= 0 && invoice.status === 'paid'}>
                    <Plus size={14} />
                    Record Payment
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  {/* Amount-paid / balance summary — mirrors the invoice total below */}
                  <div className="px-6 py-3 border-b border-gray-100 text-sm text-gray-700">
                    Paid <span className="font-semibold">{formatCurrency(amountPaid)}</span> of{' '}
                    <span className="font-semibold">{formatCurrency(invoice.total)}</span> —{' '}
                    <span className={cn('font-semibold', balance > 0 ? 'text-amber-700' : 'text-green-700')}>
                      {formatCurrency(Math.max(balance, 0))} remaining
                    </span>
                    {balance < 0 && (
                      <span className="ml-2 text-red-600 font-medium">
                        (overpaid by {formatCurrency(Math.abs(balance))})
                      </span>
                    )}
                  </div>

                  {payments.length === 0 ? (
                    <p className="px-6 py-4 text-sm text-gray-400">No payments recorded yet.</p>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left px-6 py-2 text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="text-right px-6 py-2 text-xs font-medium text-gray-500 uppercase">Amount</th>
                          <th className="text-left px-6 py-2 text-xs font-medium text-gray-500 uppercase">Method</th>
                          <th className="text-left px-6 py-2 text-xs font-medium text-gray-500 uppercase">Notes</th>
                          <th className="w-12 px-4 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {payments.map((p) => (
                          <tr key={p.id} className="hover:bg-gray-50">
                            <td className="px-6 py-3 text-sm text-gray-700">{formatDate(p.date)}</td>
                            <td className="px-6 py-3 text-sm font-semibold text-gray-900 text-right">
                              {formatCurrency(p.amount)}
                            </td>
                            <td className="px-6 py-3 text-sm text-gray-600">{methodLabel(p.method)}</td>
                            <td className="px-6 py-3 text-sm text-gray-600">{p.notes || '—'}</td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => handleDeletePayment(p)}
                                disabled={deletingPaymentId === p.id}
                                className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                                aria-label={`Remove payment of ${formatCurrency(p.amount)}`}
                                title="Remove payment"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Invoice Template - visible in print */}
        <div className="p-6 print:p-0 overflow-x-auto">
          <InvoiceTemplate
            invoice={invoice}
            company={company}
            showWatermark={false}
          />
        </div>
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: white !important;
          }
          body > * { display: none !important; }
          body > #__next,
          body > div[data-nextjs-scroll-focus-boundary] { display: block !important; }
          .print\\:hidden, header, nav, aside, footer:not(#invoice-template footer),
          [role="navigation"], [role="banner"], .Toaster { display: none !important; }
          #invoice-template {
            width: 100% !important; max-width: 100% !important;
            margin: 0 !important; padding: 0 !important;
            box-shadow: none !important; border-radius: 0 !important;
          }
          @page { size: letter; margin: 0.5in; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .bg-gray-800 { background-color: #1f2937 !important; color: white !important; }
          .bg-gray-50 { background-color: #f9fafb !important; }
        }
      `}</style>

      {/* Payment Method Modal */}
      <Modal
        open={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false)
          setSelectedPaymentMethod('')
        }}
        title="Mark Invoice as Paid"
        size="sm"
      >
        <div className="space-y-4">
          <div className="text-center pb-4 border-b">
            <p className="font-medium text-gray-900">{invoice?.invoiceNumber}</p>
            <p className="text-lg font-semibold text-green-600 mt-1">
              {formatCurrency(Math.max(balance, 0))}
            </p>
            {isPartiallyPaid && (
              <p className="text-xs text-gray-500 mt-1">
                {formatCurrency(amountPaid)} of {formatCurrency(invoice.total)} already paid
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Payment Method
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method.value}
                  onClick={() => setSelectedPaymentMethod(method.value)}
                  className={cn(
                    'p-3 rounded-lg border-2 text-center font-medium transition-colors',
                    selectedPaymentMethod === method.value
                      ? 'border-green-600 bg-green-50 text-green-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  )}
                >
                  {method.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShowPaymentModal(false)
                setSelectedPaymentMethod('')
              }}
            >
              Cancel
            </Button>
            <Button
              variant="success"
              className="flex-1"
              disabled={!selectedPaymentMethod || isUpdating}
              onClick={() => handleMarkPaid(selectedPaymentMethod)}
            >
              <Check size={16} />
              {isUpdating ? 'Updating...' : 'Mark as Paid'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Record Payment Modal */}
      <Modal
        open={showRecordPaymentModal}
        onClose={() => { if (!isRecordingPayment) setShowRecordPaymentModal(false) }}
        title="Record Payment"
        size="sm"
      >
        <div className="space-y-4">
          <div className="text-center pb-4 border-b">
            <p className="font-medium text-gray-900">{invoice.invoiceNumber}</p>
            <p className="text-sm text-gray-500 mt-1">
              {formatCurrency(Math.max(balance, 0))} remaining of {formatCurrency(invoice.total)}
            </p>
          </div>

          <Input
            label="Amount ($)"
            type="number"
            step="0.01"
            min="0"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            placeholder="0.00"
          />
          <Input
            label="Payment Date"
            type="date"
            value={payDate}
            onChange={(e) => setPayDate(e.target.value)}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Method (optional)
            </label>
            <select
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {RECORD_PAYMENT_METHODS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="e.g. Check #1042"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowRecordPaymentModal(false)}
              disabled={isRecordingPayment}
            >
              Cancel
            </Button>
            <Button
              variant="success"
              className="flex-1"
              onClick={handleRecordPayment}
              disabled={isRecordingPayment}
              loading={isRecordingPayment}
            >
              Record Payment
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
