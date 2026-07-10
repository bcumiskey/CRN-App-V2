'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileText, Plus, Clock, CheckCircle, Send, Eye, AlertTriangle, Ban,
  ChevronDown, ChevronRight, ChevronLeft, CheckSquare,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency, formatDate } from '@/lib/utils'
import v1Fetch from '@/lib/v1-compat'
import { api } from '@/lib/api'

function toast(msg: string, type: 'success' | 'error' = 'success') {
  const div = document.createElement('div')
  div.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-white text-sm ${type === 'error' ? 'bg-red-600' : 'bg-green-600'}`
  div.textContent = msg; document.body.appendChild(div); setTimeout(() => div.remove(), 3000)
}

function todayLocalYMD() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Raw V2 list shape (fetched via api client so we keep total/limit/offset —
// v1Fetch unwraps the envelope to a bare array and drops the total)
interface Invoice {
  id: string
  invoiceNumber: string
  owner?: { id: string; name: string } | null
  property?: { id: string; name: string } | null
  invoiceDate: string
  total: number
  status: string
}

interface InvoiceListResponse {
  invoices: Invoice[]
  total: number
  limit: number
  offset: number
}

const PAGE_SIZE = 50

interface OwnerBalance {
  ownerId: string
  ownerName: string
  unpaidInvoiceTotal: number
  unpaidInvoiceCount: number
  unbilledJobTotal: number
  unbilledJobCount: number
  draftInvoiceTotal: number
  totalOutstanding: number
  oldestUnpaidInvoiceDate: string | null
  oldestUnbilledJobDate: string | null
}

interface BulkMarkPaidResult {
  id: string
  ok: boolean
  invoiceNumber?: string
  error?: string
}

const PAYMENT_METHODS = [
  { value: '', label: 'Not specified' },
  { value: 'check', label: 'Check' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'ach', label: 'ACH / Bank transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
]

// Statuses that can still be marked as paid
function isSelectable(status: string) {
  return status !== 'paid' && status !== 'void'
}

export default function InvoicesPage() {
  const router = useRouter()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  // Pagination
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)

  // Outstanding-by-owner section
  const [balances, setBalances] = useState<OwnerBalance[]>([])
  const [balancesError, setBalancesError] = useState(false)
  const [showBalances, setShowBalances] = useState(true)

  // Bulk mark-paid
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false)
  const [paidDate, setPaidDate] = useState(todayLocalYMD())
  const [paymentMethod, setPaymentMethod] = useState('')
  const [isMarkingPaid, setIsMarkingPaid] = useState(false)

  useEffect(() => {
    fetchInvoices(0)
    fetchBalances()
  }, [])

  const fetchInvoices = async (pageOffset: number) => {
    setLoading(true)
    try {
      const data = await api.get<InvoiceListResponse>('/invoices', {
        limit: PAGE_SIZE,
        offset: pageOffset,
      })
      setInvoices(data.invoices)
      setTotal(data.total)
    } catch (error) {
      console.error('Failed to fetch invoices:', error)
      toast('Failed to load invoices', 'error')
    } finally {
      setLoading(false)
    }
  }

  const goToOffset = (pageOffset: number) => {
    // Selection is per-page — clear it so hidden rows can't be bulk-acted on
    setSelected(new Set())
    setOffset(pageOffset)
    fetchInvoices(pageOffset)
  }

  const fetchBalances = async () => {
    try {
      const response = await v1Fetch('/api/owners/balances')
      if (response.ok) {
        const data = await response.json()
        setBalances(data.owners || [])
        setBalancesError(false)
      } else {
        setBalancesError(true)
      }
    } catch (error) {
      console.error('Failed to fetch owner balances:', error)
      setBalancesError(true)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'warning' | 'info' | 'success' | 'danger'> = {
      draft: 'warning',
      sent: 'info',
      viewed: 'info',
      paid: 'success',
      overdue: 'danger',
      void: 'default',
    }
    const icons: Record<string, typeof Clock> = {
      draft: Clock,
      sent: Send,
      viewed: Eye,
      paid: CheckCircle,
      overdue: AlertTriangle,
      void: Ban,
    }
    const Icon = icons[status] || Clock
    return (
      <Badge variant={variants[status] || 'default'}>
        <Icon size={12} className="mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  // ── Selection ──────────────────────────────────────────────────

  const selectableIds = invoices.filter(inv => isSelectable(inv.status)).map(inv => inv.id)
  const allSelected = selectableIds.length > 0 && selectableIds.every(id => selected.has(id))

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelected(prev => {
      if (allSelected) return new Set<string>()
      const next = new Set(prev)
      selectableIds.forEach(id => next.add(id))
      return next
    })
  }

  const openMarkPaidModal = () => {
    setPaidDate(todayLocalYMD())
    setPaymentMethod('')
    setShowMarkPaidModal(true)
  }

  const handleBulkMarkPaid = async () => {
    if (!paidDate) {
      toast('Please choose a paid date', 'error')
      return
    }
    const ids = Array.from(selected)
    if (ids.length === 0) return
    if (ids.length > 100) {
      toast('You can mark at most 100 invoices as paid at once — please select fewer', 'error')
      return
    }

    setIsMarkingPaid(true)
    try {
      const res = await v1Fetch('/api/invoices/bulk-mark-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceIds: ids,
          paidDate,
          ...(paymentMethod ? { paymentMethod } : {}),
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        toast(err?.error || 'Failed to mark invoices as paid', 'error')
        return
      }

      const data = await res.json()
      const results: BulkMarkPaidResult[] = data.results || []
      const failures = results.filter(r => !r.ok)

      if (failures.length === 0) {
        toast(`${data.paidCount} invoice${data.paidCount !== 1 ? 's' : ''} marked as paid`)
        setSelected(new Set())
      } else {
        // Keep the failed rows selected so Alex can see exactly what didn't go through
        setSelected(new Set(failures.map(f => f.id)))
        const first = failures[0]
        const firstLabel = first.invoiceNumber ? `${first.invoiceNumber}: ${first.error}` : first.error
        toast(
          `${data.paidCount} marked as paid, ${failures.length} failed — ${firstLabel}`,
          'error'
        )
      }

      setShowMarkPaidModal(false)
      // Paid invoices change both the table and the owner balances
      await Promise.all([fetchInvoices(offset), fetchBalances()])
    } catch (error) {
      console.error('Bulk mark-paid failed:', error)
      toast('Failed to mark invoices as paid', 'error')
    } finally {
      setIsMarkingPaid(false)
    }
  }

  // ── Outstanding by owner ───────────────────────────────────────

  const outstandingOwners = balances.filter(
    b => b.totalOutstanding !== 0 || b.draftInvoiceTotal > 0
  )
  const outstandingTotal = outstandingOwners.reduce((sum, b) => sum + b.totalOutstanding, 0)

  return (
    <div className="min-h-screen">
      <PageHeader title="Invoicing" />

      <div className="p-6">
        {/* Outstanding by owner */}
        {balancesError && (
          <p className="text-sm text-gray-400 mb-4">
            Couldn&apos;t load owner balances — refresh to try again.
          </p>
        )}
        {outstandingOwners.length > 0 && (
          <Card className="mb-6">
            <button
              type="button"
              onClick={() => setShowBalances(!showBalances)}
              className="w-full flex items-center justify-between px-6 py-4 text-left"
            >
              <span className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                {showBalances ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                Outstanding by Owner
              </span>
              <span className="text-sm text-gray-600">
                Total outstanding:{' '}
                <span className="font-semibold text-gray-900">{formatCurrency(outstandingTotal)}</span>
              </span>
            </button>
            {showBalances && (
              <div className="border-t border-gray-100 divide-y divide-gray-100">
                {outstandingOwners.map((b) => (
                  <div
                    key={b.ownerId}
                    className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-3"
                  >
                    <div className="min-w-[10rem]">
                      <div className="font-medium text-gray-900">{b.ownerName}</div>
                      {b.draftInvoiceTotal > 0 && (
                        <div className="text-xs text-gray-400">
                          {formatCurrency(b.draftInvoiceTotal)} in unsent drafts
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right w-32">
                        <div className="text-xs text-gray-500">Invoiced &amp; unpaid</div>
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(b.unpaidInvoiceTotal)}{' '}
                          <span className="font-normal text-gray-400">({b.unpaidInvoiceCount})</span>
                        </div>
                        {b.oldestUnpaidInvoiceDate && (
                          <div className="text-xs text-gray-400">
                            since {formatDate(b.oldestUnpaidInvoiceDate)}
                          </div>
                        )}
                      </div>
                      <div className="text-right w-32">
                        <div className="text-xs text-gray-500">Unbilled work</div>
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(b.unbilledJobTotal)}{' '}
                          <span className="font-normal text-gray-400">({b.unbilledJobCount})</span>
                        </div>
                        {b.oldestUnbilledJobDate && (
                          <div className="text-xs text-gray-400">
                            since {formatDate(b.oldestUnbilledJobDate)}
                          </div>
                        )}
                      </div>
                      <div className="text-right w-28">
                        <div className="text-xs text-gray-500">Total owed</div>
                        <div className="text-sm font-semibold text-gray-900">
                          {formatCurrency(b.totalOutstanding)}
                        </div>
                      </div>
                      <div className="w-36 text-right">
                        {b.unbilledJobCount > 0 && (
                          <Button
                            size="sm"
                            onClick={() => router.push(`/invoices/new?ownerId=${b.ownerId}&billAll=1`)}
                          >
                            Bill outstanding
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900">
            {total} Invoice{total !== 1 && 's'}
          </h3>
          <Button onClick={() => router.push('/invoices/new')}>
            <Plus size={16} />
            Create Invoice
          </Button>
        </div>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="flex items-center justify-between gap-4 mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
            <span className="text-sm font-medium text-blue-900">
              {selected.size} invoice{selected.size !== 1 && 's'} selected
            </span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                Clear selection
              </Button>
              <Button variant="success" size="sm" onClick={openMarkPaidModal}>
                <CheckSquare size={14} />
                Mark as Paid
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : total === 0 ? (
          <Card>
            <CardContent>
              <EmptyState
                icon={<FileText size={40} />}
                title="No invoices yet"
                description="Create your first invoice to start billing clients."
                actionLabel="Create Invoice"
                onAction={() => router.push('/invoices/new')}
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        disabled={selectableIds.length === 0}
                        className="h-4 w-4 text-blue-600 rounded"
                        aria-label="Select all unpaid invoices"
                      />
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                      Invoice
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                      Property
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                      Client
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                      Date
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                      Amount
                    </th>
                    <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => router.push(`/invoices/${invoice.id}`)}
                    >
                      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                        {isSelectable(invoice.status) && (
                          <input
                            type="checkbox"
                            checked={selected.has(invoice.id)}
                            onChange={() => toggleSelect(invoice.id)}
                            className="h-4 w-4 text-blue-600 rounded"
                            aria-label={`Select invoice ${invoice.invoiceNumber}`}
                          />
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono text-sm">{invoice.invoiceNumber}</td>
                      <td className="px-6 py-4 font-medium">
                        {invoice.property?.name || (
                          <span className="text-gray-500 italic font-normal">All properties</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-600">{invoice.owner?.name || '-'}</td>
                      <td className="px-6 py-4 text-gray-600">{formatDate(invoice.invoiceDate)}</td>
                      <td className="px-6 py-4 text-right font-semibold">
                        {formatCurrency(invoice.total)}
                      </td>
                      <td className="px-6 py-4 text-center">{getStatusBadge(invoice.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {total > PAGE_SIZE && (
                <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100">
                  <span className="text-sm text-gray-600">
                    {offset + 1}&ndash;{Math.min(offset + PAGE_SIZE, total)} of {total}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={offset === 0 || loading}
                      onClick={() => goToOffset(Math.max(0, offset - PAGE_SIZE))}
                    >
                      <ChevronLeft size={14} />
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={offset + PAGE_SIZE >= total || loading}
                      onClick={() => goToOffset(offset + PAGE_SIZE)}
                    >
                      Next
                      <ChevronRight size={14} />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Bulk mark-paid modal */}
      <Modal
        open={showMarkPaidModal}
        onClose={() => { if (!isMarkingPaid) setShowMarkPaidModal(false) }}
        title={`Mark ${selected.size} Invoice${selected.size !== 1 ? 's' : ''} as Paid`}
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="Paid Date"
            type="date"
            value={paidDate}
            onChange={(e) => setPaidDate(e.target.value)}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Method (optional)
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PAYMENT_METHODS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-gray-500">
            Each invoice will be marked paid and its jobs stamped with this payment date and method.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowMarkPaidModal(false)}
              disabled={isMarkingPaid}
            >
              Cancel
            </Button>
            <Button variant="success" onClick={handleBulkMarkPaid} loading={isMarkingPaid}>
              Mark as Paid
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
