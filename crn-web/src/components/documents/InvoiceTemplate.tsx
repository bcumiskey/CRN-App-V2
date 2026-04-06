'use client'

import { format } from 'date-fns'

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

interface LineItem {
  id: string
  date?: Date | string | null
  description: string
  amount: number
  itemType: string
}

interface Invoice {
  invoiceNumber: string
  invoiceDate: Date | string
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
    name: string
    address: string
    ownerName: string
    ownerEmail?: string | null
  }
}

interface InvoiceTemplateProps {
  invoice: Invoice
  company: CompanySettings
  showWatermark?: boolean
}

export default function InvoiceTemplate({
  invoice,
  company,
  showWatermark = false
}: InvoiceTemplateProps) {
  const formatDateStr = (date: Date | string | null | undefined) => {
    if (!date) return ''
    return format(new Date(date), 'MMM d, yyyy')
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800',
    sent: 'bg-blue-100 text-blue-800',
    paid: 'bg-green-100 text-green-800',
  }

  return (
    <div
      className="bg-white relative mx-auto shadow-lg print:shadow-none"
      id="invoice-template"
      style={{
        width: '8.5in',
        minHeight: '11in',
        maxWidth: '100%',
      }}
    >
      {/* Watermark */}
      {showWatermark && company.logoUrl && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5 z-0"
          aria-hidden="true"
        >
          <img
            src={company.logoUrl}
            alt=""
            className="w-96 h-96 object-contain"
          />
        </div>
      )}

      <div className="relative z-10 p-12 print:p-8">
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-gray-800 pb-6 mb-6">
          <div className="flex items-start gap-4">
            {company.logoUrl && (
              <img
                src={company.logoUrl}
                alt={company.companyName}
                className="h-16 w-auto object-contain"
              />
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {company.companyName}
              </h1>
              {company.address && (
                <p className="text-sm text-gray-600 whitespace-pre-line">
                  {company.address}
                </p>
              )}
              {company.phone && (
                <p className="text-sm text-gray-600">{company.phone}</p>
              )}
              {company.email && (
                <p className="text-sm text-gray-600">{company.email}</p>
              )}
              {company.website && (
                <p className="text-sm text-gray-600">{company.website}</p>
              )}
            </div>
          </div>

          <div className="text-right">
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
              INVOICE
            </h2>
            <p className="text-lg font-semibold text-gray-700 mt-1">
              {invoice.invoiceNumber}
            </p>
            {invoice.status !== 'draft' && (
              <span className={`inline-block mt-2 px-3 py-1 text-xs font-semibold uppercase rounded-full print:hidden ${statusColors[invoice.status] || statusColors.draft}`}>
                {invoice.status === 'paid' ? 'PAID' : invoice.status.toUpperCase()}
              </span>
            )}
          </div>
        </div>

        {/* Bill To & Invoice Details */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Bill To
            </h3>
            <p className="font-semibold text-gray-900">{invoice.property?.ownerName || 'N/A'}</p>
            <p className="text-gray-700">{invoice.property?.name || 'Unknown Property'}</p>
            <p className="text-gray-600 text-sm">{invoice.property?.address || ''}</p>
            {invoice.property?.ownerEmail && (
              <p className="text-gray-600 text-sm">{invoice.property.ownerEmail}</p>
            )}
          </div>

          <div className="text-right">
            <div className="inline-block text-left">
              <table className="text-sm">
                <tbody>
                  <tr>
                    <td className="text-gray-500 pr-4 py-1">Invoice Date:</td>
                    <td className="text-gray-900 font-medium">
                      {formatDateStr(invoice.invoiceDate)}
                    </td>
                  </tr>
                  {invoice.billingPeriod && (
                    <tr>
                      <td className="text-gray-500 pr-4 py-1">Billing Period:</td>
                      <td className="text-gray-900 font-medium">
                        {invoice.billingPeriod}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td className="text-gray-500 pr-4 py-1">Payment Terms:</td>
                    <td className="text-gray-900 font-medium">
                      {invoice.paymentTerms}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="mb-8">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-800 text-white print:bg-gray-800">
                <th className="text-left py-3 px-4 font-semibold text-sm">Date</th>
                <th className="text-left py-3 px-4 font-semibold text-sm">Description</th>
                <th className="text-right py-3 px-4 font-semibold text-sm">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(invoice.lineItems || []).map((item, index) => (
                <tr
                  key={item.id}
                  className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}
                >
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {formatDateStr(item.date)}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-900">
                    {item.description}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-900 text-right font-medium">
                    {formatCurrency(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-72">
            <div className="flex justify-between py-2 text-sm">
              <span className="text-gray-600">Subtotal:</span>
              <span className="text-gray-900 font-medium">
                {formatCurrency(invoice.subtotal)}
              </span>
            </div>
            {invoice.discount > 0 && (
              <div className="flex justify-between py-2 text-sm">
                <span className="text-gray-600">Discount:</span>
                <span className="text-green-600 font-medium">
                  -{formatCurrency(invoice.discount)}
                </span>
              </div>
            )}
            <div className="flex justify-between py-3 border-t-2 border-gray-800 mt-2">
              <span className="text-lg font-bold text-gray-900">Total Due:</span>
              <span className="text-lg font-bold text-gray-900">
                {formatCurrency(invoice.total)}
              </span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="mb-8 p-4 bg-gray-50 rounded-lg print:bg-gray-50">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Notes
            </h4>
            <p className="text-sm text-gray-700 whitespace-pre-line">
              {invoice.notes}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-gray-200 pt-6 mt-8">
          {company.invoiceTerms && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Payment Terms
              </h4>
              <p className="text-sm text-gray-600">{company.invoiceTerms}</p>
            </div>
          )}
          {company.invoiceFooter && (
            <p className="text-sm text-gray-500 text-center italic">
              {company.invoiceFooter}
            </p>
          )}
          {!company.invoiceFooter && (
            <p className="text-sm text-gray-500 text-center">
              Thank you for your business!
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
