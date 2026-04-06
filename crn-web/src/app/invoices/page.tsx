'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Plus, Clock, CheckCircle, Send } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency, formatDate } from '@/lib/utils'
import v1Fetch from '@/lib/v1-compat'

function toast(msg: string, type: 'success' | 'error' = 'success') {
  const div = document.createElement('div')
  div.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-white text-sm ${type === 'error' ? 'bg-red-600' : 'bg-green-600'}`
  div.textContent = msg; document.body.appendChild(div); setTimeout(() => div.remove(), 3000)
}

interface Invoice {
  id: string
  invoiceNumber: string
  property: { name: string; ownerName: string }
  invoiceDate: string
  total: number
  status: string
}

export default function InvoicesPage() {
  const router = useRouter()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchInvoices()
  }, [])

  const fetchInvoices = async () => {
    try {
      const response = await v1Fetch('/api/invoices')
      if (response.ok) {
        setInvoices(await response.json())
      } else {
        toast('Failed to load invoices', 'error')
      }
    } catch (error) {
      console.error('Failed to fetch invoices:', error)
      toast('Failed to load invoices', 'error')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'warning' | 'info' | 'success'> = {
      draft: 'warning',
      sent: 'info',
      paid: 'success',
    }
    const icons: Record<string, typeof Clock> = {
      draft: Clock,
      sent: Send,
      paid: CheckCircle,
    }
    const Icon = icons[status] || Clock
    return (
      <Badge variant={variants[status] || 'warning'}>
        <Icon size={12} className="mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  return (
    <div className="min-h-screen">
      <PageHeader title="Invoicing" />

      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900">
            {invoices.length} Invoice{invoices.length !== 1 && 's'}
          </h3>
          <Button onClick={() => router.push('/invoices/new')}>
            <Plus size={16} />
            Create Invoice
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : invoices.length === 0 ? (
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
                      <td className="px-6 py-4 font-mono text-sm">{invoice.invoiceNumber}</td>
                      <td className="px-6 py-4 font-medium">{invoice.property?.name || 'Unknown'}</td>
                      <td className="px-6 py-4 text-gray-600">{invoice.property?.ownerName || '-'}</td>
                      <td className="px-6 py-4 text-gray-600">{formatDate(invoice.invoiceDate)}</td>
                      <td className="px-6 py-4 text-right font-semibold">
                        {formatCurrency(invoice.total)}
                      </td>
                      <td className="px-6 py-4 text-center">{getStatusBadge(invoice.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
