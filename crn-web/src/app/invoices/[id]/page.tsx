'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Printer, Send, CheckCircle, Pencil, Trash2, Check } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import InvoiceTemplate from '@/components/documents/InvoiceTemplate'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
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
  paidDate?: string | null
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

  const handleMarkSent = async () => {
    if (!invoice) return
    setIsUpdating(true)

    try {
      const res = await v1Fetch(`/api/invoices/${invoice.id}/send`, {
        method: 'POST',
      })

      if (res.ok) {
        setInvoice({ ...invoice, status: 'sent' })
        toast('Invoice marked as sent — no email goes out, so deliver it to the owner yourself (Print / Save as PDF)')
      } else {
        const error = await res.json()
        toast(error.error || 'Failed to mark invoice as sent', 'error')
      }
    } catch (error) {
      toast('Failed to mark invoice as sent', 'error')
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
        setInvoice({ ...invoice, status: 'paid', paymentMethod, paidDate })
        toast(`Invoice marked as paid via ${PAYMENT_METHODS.find(p => p.value === paymentMethod)?.label}`)
        setShowPaymentModal(false)
        setSelectedPaymentMethod('')
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

                {/* Mark as Sent - drafts only. No email goes out — Alex delivers the invoice herself. */}
                {invoice.status === 'draft' && (
                  <Button
                    variant="primary"
                    onClick={handleMarkSent}
                    disabled={isUpdating}
                    title="Marks the invoice as sent. No email is sent — deliver it to the owner yourself (Print / Save as PDF)."
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

                {/* Paid indicator */}
                {invoice.status === 'paid' && (
                  <span className="px-3 py-1.5 bg-green-100 text-green-800 rounded-lg text-sm font-medium inline-flex items-center">
                    <CheckCircle size={14} className="mr-1" />
                    Paid{invoice.paidDate ? ` on ${formatDate(invoice.paidDate)}` : ''}
                    {invoice.paymentMethod ? ` via ${PAYMENT_METHODS.find(p => p.value === invoice.paymentMethod)?.label || invoice.paymentMethod}` : ''}
                  </span>
                )}

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
    </>
  )
}
