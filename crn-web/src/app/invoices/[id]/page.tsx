'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Printer, Send, CheckCircle, Download, Mail, Pencil, Trash2, Loader2, Check } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import InvoiceTemplate from '@/components/documents/InvoiceTemplate'
import { cn, formatCurrency } from '@/lib/utils'
import v1Fetch from '@/lib/v1-compat'

function toast(msg: string, type: 'success' | 'error' = 'success') {
  const div = document.createElement('div')
  div.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-white text-sm ${type === 'error' ? 'bg-red-600' : 'bg-green-600'}`
  div.textContent = msg; document.body.appendChild(div); setTimeout(() => div.remove(), 3000)
}

const PAYMENT_METHODS = [
  { value: 'venmo', label: 'Venmo' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
]

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
  const [isSending, setIsSending] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('')

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

  const handleDownloadPDF = useCallback(async () => {
    if (!invoice || isDownloading) return

    setIsDownloading(true)
    toast('Generating PDF...')

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
  }, [invoice, isDownloading])

  const handleSendEmail = async () => {
    if (!invoice) return

    if (!invoice.property?.ownerEmail) {
      toast('Property owner has no email address', 'error')
      return
    }

    setIsSending(true)

    try {
      const res = await v1Fetch(`/api/invoices/${invoice.id}/send`, {
        method: 'POST',
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to send')
      }

      setInvoice({ ...invoice, status: 'sent' })
      toast(`Invoice sent to ${invoice.property?.ownerEmail}`)
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to send invoice', 'error')
    } finally {
      setIsSending(false)
    }
  }

  const handleMarkSent = async () => {
    if (!invoice) return
    setIsUpdating(true)

    try {
      const res = await v1Fetch(`/api/invoices/${invoice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'sent' }),
      })

      if (res.ok) {
        setInvoice({ ...invoice, status: 'sent' })
        toast('Invoice marked as sent')
      }
    } catch (error) {
      toast('Failed to update invoice', 'error')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleMarkPaid = async (paymentMethod: string) => {
    if (!invoice) return
    setIsUpdating(true)

    try {
      const res = await v1Fetch(`/api/invoices/${invoice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid', paymentMethod }),
      })

      if (res.ok) {
        setInvoice({ ...invoice, status: 'paid', paymentMethod })
        toast(`Invoice marked as paid via ${PAYMENT_METHODS.find(p => p.value === paymentMethod)?.label}`)
        setShowPaymentModal(false)
        setSelectedPaymentMethod('')
      }
    } catch (error) {
      toast('Failed to update invoice', 'error')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleClearPayment = async () => {
    if (!invoice) return
    setIsUpdating(true)

    try {
      const res = await v1Fetch(`/api/invoices/${invoice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'sent', paymentMethod: null }),
      })

      if (res.ok) {
        setInvoice({ ...invoice, status: 'sent', paymentMethod: null })
        toast('Payment cleared - invoice marked as sent')
        setShowPaymentModal(false)
        setSelectedPaymentMethod('')
      }
    } catch (error) {
      toast('Failed to update invoice', 'error')
    } finally {
      setIsUpdating(false)
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

                {/* Send Email - only for draft with owner email */}
                {invoice.status === 'draft' && invoice.property?.ownerEmail && (
                  <Button
                    variant="primary"
                    onClick={handleSendEmail}
                    disabled={isSending}
                  >
                    <Mail size={16} />
                    {isSending ? 'Sending...' : 'Send Email'}
                  </Button>
                )}

                {/* Mark as Sent - only for draft without owner email */}
                {invoice.status === 'draft' && !invoice.property?.ownerEmail && (
                  <Button
                    variant="outline"
                    onClick={handleMarkSent}
                    disabled={isUpdating}
                  >
                    <Send size={16} />
                    {isUpdating ? 'Updating...' : 'Mark as Sent'}
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

                {/* Show payment method if paid - clickable to edit */}
                {invoice.status === 'paid' && (
                  <button
                    onClick={() => setShowPaymentModal(true)}
                    className="px-3 py-1.5 bg-green-100 text-green-800 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors"
                  >
                    Paid via {PAYMENT_METHODS.find(p => p.value === invoice.paymentMethod)?.label || 'Unknown'}
                  </button>
                )}

                {/* PDF Download */}
                <Button
                  variant="outline"
                  onClick={handleDownloadPDF}
                  disabled={isDownloading}
                >
                  {isDownloading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download size={16} />
                      PDF
                    </>
                  )}
                </Button>

                {/* Print */}
                <Button variant="outline" onClick={handlePrint}>
                  <Printer size={16} />
                  Print
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
        title={invoice?.status === 'paid' ? 'Update Payment' : 'Mark Invoice as Paid'}
        size="sm"
      >
        <div className="space-y-4">
          <div className="text-center pb-4 border-b">
            <p className="font-medium text-gray-900">{invoice?.invoiceNumber}</p>
            <p className="text-lg font-semibold text-green-600 mt-1">
              {invoice && formatCurrency(invoice.total)}
            </p>
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
            {invoice?.status === 'paid' && (
              <Button
                variant="outline"
                className="flex-1 text-red-600 hover:bg-red-50"
                disabled={isUpdating}
                onClick={() => handleClearPayment()}
              >
                {isUpdating ? 'Updating...' : 'Clear Payment'}
              </Button>
            )}
            <Button
              variant="success"
              className="flex-1"
              disabled={!selectedPaymentMethod || isUpdating}
              onClick={() => handleMarkPaid(selectedPaymentMethod)}
            >
              <Check size={16} />
              {invoice?.status === 'paid' ? 'Update' : 'Mark as Paid'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
