'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Users,
  Building,
  Mail,
  Phone,
  DollarSign,
  FileText,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  ExternalLink,
  TrendingUp,
  CreditCard,
  Send,
  Pencil,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import { format } from 'date-fns'
import v1Fetch from '@/lib/v1-compat'

interface Property {
  id: string
  name: string
  address: string
  baseRate: number
  imageUrl: string | null
}

interface Owner {
  id: string
  name: string
  email: string | null
  phone: string | null
  notes: string | null
  defaultBaseRate: number | null
  defaultBillingType: string | null
  preferredContactMethod: string | null
  properties: Property[]
}

interface OwnerStats {
  totalRevenue: number
  paidRevenue: number
  unpaidRevenue: number
  totalJobs: number
  completedJobs: number
  pendingJobs: number
  totalInvoices: number
  paidInvoices: number
  unpaidInvoices: number
  draftInvoices: number
  recentJobs: {
    id: string
    date: string
    propertyName: string
    rate: number
    completed: boolean
    clientPaid: boolean
  }[]
  recentInvoices: {
    id: string
    invoiceNumber: string
    invoiceDate: string
    propertyName: string
    total: number
    status: string
  }[]
}

export default function OwnerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const ownerId = params.id as string

  const [owner, setOwner] = useState<Owner | null>(null)
  const [stats, setStats] = useState<OwnerStats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchOwner = useCallback(async () => {
    try {
      const [ownerRes, statsRes] = await Promise.all([
        v1Fetch(`/api/owners/${ownerId}`),
        v1Fetch(`/api/owners/${ownerId}/stats`),
      ])

      if (ownerRes.ok) {
        setOwner(await ownerRes.json())
      }
      if (statsRes.ok) {
        setStats(await statsRes.json())
      }
    } catch (error) {
      console.error('Failed to fetch owner:', error)
    } finally {
      setLoading(false)
    }
  }, [ownerId])

  useEffect(() => {
    fetchOwner()
  }, [fetchOwner])

  if (loading) {
    return (
      <div className="min-h-screen">
        <PageHeader title="Owner Details" />
        <div className="p-6 text-center text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!owner) {
    return (
      <div className="min-h-screen">
        <PageHeader title="Owner Details" />
        <div className="p-6">
          <Button variant="ghost" onClick={() => router.push('/owners')}>
            <ArrowLeft size={16} className="mr-2" /> Back to Owners
          </Button>
          <div className="text-center py-12 text-gray-500">Owner not found</div>
        </div>
      </div>
    )
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge variant="success">Paid</Badge>
      case 'sent':
        return <Badge variant="warning">Sent</Badge>
      case 'draft':
        return <Badge variant="default">Draft</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  return (
    <div className="min-h-screen">
      <PageHeader title="Owner Details" />

      <div className="p-6 space-y-6">
        {/* Back Button */}
        <Button variant="ghost" onClick={() => router.push('/owners')}>
          <ArrowLeft size={16} className="mr-2" /> Back to Owners
        </Button>

        {/* Owner Header */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                  <Users className="text-blue-600" size={32} />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{owner.name}</h1>
                  <div className="flex items-center gap-4 mt-2 text-gray-600">
                    {owner.email && (
                      <a
                        href={`mailto:${owner.email}`}
                        className="flex items-center gap-1 hover:text-blue-600"
                      >
                        <Mail size={14} />
                        {owner.email}
                      </a>
                    )}
                    {owner.phone && (
                      <a
                        href={`tel:${owner.phone}`}
                        className="flex items-center gap-1 hover:text-blue-600"
                      >
                        <Phone size={14} />
                        {owner.phone}
                      </a>
                    )}
                  </div>
                  {owner.preferredContactMethod && (
                    <p className="text-sm text-gray-500 mt-1">
                      Preferred contact: {owner.preferredContactMethod}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => router.push(`/owners?edit=${owner.id}`)}
              >
                <Pencil size={14} className="mr-2" />
                Edit Owner
              </Button>
            </div>

            {owner.notes && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>Notes:</strong> {owner.notes}
                </p>
              </div>
            )}

            {/* Default Settings */}
            {(owner.defaultBaseRate || owner.defaultBillingType) && (
              <div className="mt-4 pt-4 border-t flex gap-6 text-sm">
                {owner.defaultBaseRate && (
                  <div>
                    <span className="text-gray-500">Default Rate:</span>
                    <span className="ml-2 font-semibold">
                      {formatCurrency(owner.defaultBaseRate)}
                    </span>
                  </div>
                )}
                {owner.defaultBillingType && (
                  <div>
                    <span className="text-gray-500">Default Billing:</span>
                    <span className="ml-2 font-semibold capitalize">
                      {owner.defaultBillingType.replace('_', ' ')}
                    </span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <DollarSign className="text-green-600" size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Revenue</p>
                    <p className="text-xl font-bold text-gray-900">
                      {formatCurrency(stats.totalRevenue)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <TrendingUp className="text-blue-600" size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Paid Revenue</p>
                    <p className="text-xl font-bold text-green-600">
                      {formatCurrency(stats.paidRevenue)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <CreditCard className="text-amber-600" size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Outstanding</p>
                    <p className="text-xl font-bold text-amber-600">
                      {formatCurrency(stats.unpaidRevenue)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Building className="text-purple-600" size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Properties</p>
                    <p className="text-xl font-bold text-gray-900">
                      {owner.properties.length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Properties and Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Properties */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building size={20} />
                Properties ({owner.properties.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {owner.properties.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  No properties linked to this owner.
                </p>
              ) : (
                <div className="space-y-3">
                  {owner.properties.map((property) => (
                    <div
                      key={property.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                      onClick={() => router.push(`/properties/${property.id}/edit`)}
                    >
                      <div>
                        <p className="font-medium text-gray-900">{property.name}</p>
                        <p className="text-sm text-gray-500">{property.address}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(property.baseRate)}
                        </p>
                        <ExternalLink size={14} className="text-gray-400 ml-auto" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Job & Invoice Stats */}
          {stats && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar size={20} />
                  Activity Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Jobs Summary */}
                <div>
                  <h4 className="font-semibold text-gray-700 mb-3">Jobs</h4>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-gray-900">{stats.totalJobs}</p>
                      <p className="text-xs text-gray-500">Total</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">{stats.completedJobs}</p>
                      <p className="text-xs text-gray-500">Completed</p>
                    </div>
                    <div className="text-center p-3 bg-amber-50 rounded-lg">
                      <p className="text-2xl font-bold text-amber-600">{stats.pendingJobs}</p>
                      <p className="text-xs text-gray-500">Pending</p>
                    </div>
                  </div>
                </div>

                {/* Invoices Summary */}
                <div>
                  <h4 className="font-semibold text-gray-700 mb-3">Invoices</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-gray-900">{stats.totalInvoices}</p>
                      <p className="text-xs text-gray-500">Total</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">{stats.paidInvoices}</p>
                      <p className="text-xs text-gray-500">Paid</p>
                    </div>
                    <div className="text-center p-3 bg-amber-50 rounded-lg">
                      <p className="text-2xl font-bold text-amber-600">{stats.unpaidInvoices}</p>
                      <p className="text-xs text-gray-500">Sent</p>
                    </div>
                    <div className="text-center p-3 bg-gray-100 rounded-lg">
                      <p className="text-2xl font-bold text-gray-500">{stats.draftInvoices}</p>
                      <p className="text-xs text-gray-500">Draft</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Recent Activity Tables */}
        {stats && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Jobs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <CheckCircle size={20} />
                    Recent Jobs
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push('/schedule')}
                  >
                    View All
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.recentJobs.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No jobs yet</p>
                ) : (
                  <div className="space-y-2">
                    {stats.recentJobs.map((job) => (
                      <div
                        key={job.id}
                        className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                      >
                        <div className="flex items-center gap-3">
                          {job.completed ? (
                            <CheckCircle size={16} className="text-green-500" />
                          ) : (
                            <Clock size={16} className="text-amber-500" />
                          )}
                          <div>
                            <p className="text-sm font-medium">{job.propertyName}</p>
                            <p className="text-xs text-gray-500">
                              {format(new Date(job.date), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{formatCurrency(job.rate)}</p>
                          {job.completed && (
                            <p className="text-xs text-gray-500">
                              {job.clientPaid ? 'Paid' : 'Unpaid'}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Invoices */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <FileText size={20} />
                    Recent Invoices
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push('/invoices')}
                  >
                    View All
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.recentInvoices.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No invoices yet</p>
                ) : (
                  <div className="space-y-2">
                    {stats.recentInvoices.map((invoice) => (
                      <div
                        key={invoice.id}
                        className="flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer"
                        onClick={() => router.push(`/invoices/${invoice.id}`)}
                      >
                        <div>
                          <p className="text-sm font-medium">{invoice.invoiceNumber}</p>
                          <p className="text-xs text-gray-500">
                            {invoice.propertyName} - {format(new Date(invoice.invoiceDate), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <div className="text-right flex items-center gap-2">
                          <p className="text-sm font-semibold">{formatCurrency(invoice.total)}</p>
                          {getStatusBadge(invoice.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              {owner.email && (
                <Button
                  variant="outline"
                  onClick={() => window.location.href = `mailto:${owner.email}`}
                >
                  <Mail size={16} className="mr-2" />
                  Send Email
                </Button>
              )}
              {owner.phone && (
                <Button
                  variant="outline"
                  onClick={() => window.location.href = `tel:${owner.phone}`}
                >
                  <Phone size={16} className="mr-2" />
                  Call Owner
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => router.push('/properties/new/edit')}
              >
                <Building size={16} className="mr-2" />
                Add Property
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/invoices')}
              >
                <FileText size={16} className="mr-2" />
                Create Invoice
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
