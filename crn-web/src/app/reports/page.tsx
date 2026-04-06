'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  TrendingUp,
  DollarSign,
  Calendar,
  Users,
  Building,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Activity,
  MapPin,
  ChevronRight,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { formatCurrency, cn } from '@/lib/utils'
import { format, addDays, startOfDay, isSameDay } from 'date-fns'
import v1Fetch from '@/lib/v1-compat'

interface ReportData {
  period: string
  dateRange: { start: string; end: string }
  overview: {
    totalRevenue: number
    pendingRevenue: number
    avgJobValue: number
    teamPayments: number
    expenseDeductions: number
    totalJobs: number
    completedJobs: number
    pendingJobs: number
    completionRate: number
  }
  comparison: {
    revenueChange: number
    jobsChange: number
    previousPeriodRevenue: number
    previousPeriodJobs: number
  }
  invoices: {
    total: number
    paid: number
    sent: number
    draft: number
    invoicedRevenue: number
    paidInvoiceRevenue: number
    outstandingRevenue: number
  }
  topProperties: Array<{
    id: string
    name: string
    revenue: number
    jobs: number
    avgRate: number
  }>
  topOwners: Array<{
    id: string
    name: string
    revenue: number
    jobs: number
  }>
  teamStats: Array<{
    id: string
    name: string
    jobs: number
    earnings: number
  }>
  monthlyTrends: Array<{
    month: string
    shortMonth: string
    revenue: number
    jobs: number
    invoiced: number
  }>
  recentJobs: Array<{
    id: string
    date: string
    propertyName: string
    rate: number
    completed: boolean
    clientPaid: boolean
  }>
  recentInvoices: Array<{
    id: string
    invoiceNumber: string
    invoiceDate: string
    propertyName: string
    total: number
    status: string
  }>
  counts: {
    properties: number
    teamMembers: number
    owners: number
  }
}

interface UpcomingJob {
  id: string
  date: string
  time: string | null
  property: { id: string; name: string; color: string | null }
  completed: boolean
  assignments: { teamMember: { name: string } }[]
}

const PERIODS = [
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'last_90_days', label: 'Last 90 Days' },
  { value: 'this_year', label: 'This Year' },
  { value: 'all_time', label: 'All Time' },
]

export default function ReportsPage() {
  const router = useRouter()
  const [period, setPeriod] = useState('this_month')
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [upcomingJobs, setUpcomingJobs] = useState<UpcomingJob[]>([])
  const [loadingOutlook, setLoadingOutlook] = useState(true)

  const fetchReportData = useCallback(async () => {
    setLoading(true)
    try {
      const response = await v1Fetch(`/api/reports?period=${period}`)
      if (response.ok) {
        setData(await response.json())
      }
    } catch (error) {
      console.error('Failed to fetch report data:', error)
    } finally {
      setLoading(false)
    }
  }, [period])

  const fetchWeekOutlook = useCallback(async () => {
    setLoadingOutlook(true)
    try {
      const today = new Date()
      const endDate = addDays(today, 7)
      const month = today.getMonth() + 1
      const year = today.getFullYear()
      const response = await v1Fetch(`/api/jobs?month=${month}&year=${year}`)
      if (response.ok) {
        const allJobs = await response.json()
        const filtered = allJobs.filter((job: UpcomingJob) => {
          const jobDate = new Date(job.date)
          return jobDate >= startOfDay(today) && jobDate <= endDate
        })
        setUpcomingJobs(filtered)
      }
    } catch (error) {
      console.error('Failed to fetch week outlook:', error)
    } finally {
      setLoadingOutlook(false)
    }
  }, [])

  useEffect(() => {
    fetchReportData()
  }, [fetchReportData])

  useEffect(() => {
    fetchWeekOutlook()
  }, [fetchWeekOutlook])

  const maxRevenue = data?.monthlyTrends
    ? Math.max(...data.monthlyTrends.map(m => m.revenue), 1)
    : 1

  return (
    <div className="min-h-screen">
      <PageHeader title="Reports & Analytics" />

      <div className="p-6 space-y-6">
        {/* Period Selector */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Business Overview</h2>
            {data && (
              <p className="text-sm text-gray-500">
                {format(new Date(data.dateRange.start), 'MMM d, yyyy')} - {format(new Date(data.dateRange.end), 'MMM d, yyyy')}
              </p>
            )}
          </div>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {PERIODS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* Week Outlook */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Calendar size={20} />
                Week Outlook
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/jobs')}
              >
                View All <ChevronRight size={16} />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingOutlook ? (
              <div className="text-center py-4 text-gray-500">Loading...</div>
            ) : (
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {Array.from({ length: 7 }).map((_, idx) => {
                  const day = addDays(new Date(), idx)
                  const dayJobs = upcomingJobs.filter(job =>
                    isSameDay(new Date(job.date), day)
                  )
                  const isToday = idx === 0

                  return (
                    <div
                      key={idx}
                      className={cn(
                        'flex flex-col items-center p-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors',
                        isToday && 'bg-blue-50 ring-2 ring-blue-200'
                      )}
                      onClick={() => router.push('/jobs')}
                    >
                      <span className="text-xs text-gray-500 font-medium">
                        {format(day, 'EEE')}
                      </span>
                      <span className={cn(
                        'text-lg font-bold',
                        isToday ? 'text-blue-600' : 'text-gray-900'
                      )}>
                        {format(day, 'd')}
                      </span>

                      <div className="mt-1 flex flex-col gap-0.5 w-full">
                        {dayJobs.length === 0 ? (
                          <div className="h-2 w-full bg-gray-100 rounded" />
                        ) : dayJobs.length <= 3 ? (
                          dayJobs.map((job) => (
                            <div
                              key={job.id}
                              className={cn(
                                'h-2 w-full rounded',
                                job.completed ? 'bg-green-400' : 'bg-blue-400'
                              )}
                              style={job.property.color ? { backgroundColor: job.property.color } : undefined}
                              title={job.property.name}
                            />
                          ))
                        ) : (
                          <>
                            <div className="h-2 w-full bg-blue-400 rounded" />
                            <div className="text-xs text-center text-gray-500 font-medium">
                              +{dayJobs.length - 1}
                            </div>
                          </>
                        )}
                      </div>

                      {dayJobs.length > 0 && (
                        <span className={cn(
                          'mt-1 text-xs font-medium',
                          dayJobs.some(j => !j.completed) ? 'text-blue-600' : 'text-green-600'
                        )}>
                          {dayJobs.length}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Today's jobs detail */}
            {upcomingJobs.filter(j => isSameDay(new Date(j.date), new Date())).length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Today&apos;s Jobs</h4>
                <div className="space-y-2">
                  {upcomingJobs
                    .filter(j => isSameDay(new Date(j.date), new Date()))
                    .map(job => (
                      <div
                        key={job.id}
                        className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 cursor-pointer hover:bg-gray-100"
                        onClick={() => router.push(`/jobs?highlight=${job.id}`)}
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: job.property.color ? `${job.property.color}30` : '#dbeafe' }}
                        >
                          <MapPin
                            size={16}
                            style={{ color: job.property.color || '#2563eb' }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{job.property.name}</p>
                          <p className="text-xs text-gray-500">
                            {job.time || 'No time set'}
                            {job.assignments.length > 0 && ` \u2022 ${job.assignments.map(a => a.teamMember.name).join(', ')}`}
                          </p>
                        </div>
                        {job.completed ? (
                          <Badge variant="success" className="text-xs">Done</Badge>
                        ) : (
                          <Badge variant="info" className="text-xs">Pending</Badge>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading reports...</div>
        ) : data ? (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <DollarSign className="text-green-600" size={20} />
                    </div>
                    {data.comparison.revenueChange !== 0 && (
                      <div className={cn(
                        'flex items-center text-xs font-medium',
                        data.comparison.revenueChange > 0 ? 'text-green-600' : 'text-red-600'
                      )}>
                        {data.comparison.revenueChange > 0 ? (
                          <ArrowUpRight size={14} />
                        ) : (
                          <ArrowDownRight size={14} />
                        )}
                        {Math.abs(data.comparison.revenueChange).toFixed(1)}%
                      </div>
                    )}
                  </div>
                  <p className="text-2xl font-bold mt-2">{formatCurrency(data.overview.totalRevenue)}</p>
                  <p className="text-sm text-gray-500">Total Revenue</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Calendar className="text-blue-600" size={20} />
                    </div>
                    {data.comparison.jobsChange !== 0 && (
                      <div className={cn(
                        'flex items-center text-xs font-medium',
                        data.comparison.jobsChange > 0 ? 'text-green-600' : 'text-red-600'
                      )}>
                        {data.comparison.jobsChange > 0 ? (
                          <ArrowUpRight size={14} />
                        ) : (
                          <ArrowDownRight size={14} />
                        )}
                        {Math.abs(data.comparison.jobsChange).toFixed(1)}%
                      </div>
                    )}
                  </div>
                  <p className="text-2xl font-bold mt-2">{data.overview.completedJobs}</p>
                  <p className="text-sm text-gray-500">Jobs Completed</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="p-2 bg-purple-100 rounded-lg w-fit">
                    <TrendingUp className="text-purple-600" size={20} />
                  </div>
                  <p className="text-2xl font-bold mt-2">{formatCurrency(data.overview.avgJobValue)}</p>
                  <p className="text-sm text-gray-500">Avg Job Value</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="p-2 bg-amber-100 rounded-lg w-fit">
                    <Users className="text-amber-600" size={20} />
                  </div>
                  <p className="text-2xl font-bold mt-2">{formatCurrency(data.overview.teamPayments)}</p>
                  <p className="text-sm text-gray-500">Team Earnings</p>
                </CardContent>
              </Card>
            </div>

            {/* Second Row Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="p-2 bg-emerald-100 rounded-lg w-fit">
                    <CheckCircle className="text-emerald-600" size={20} />
                  </div>
                  <p className="text-2xl font-bold mt-2">{data.overview.completionRate.toFixed(0)}%</p>
                  <p className="text-sm text-gray-500">Completion Rate</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="p-2 bg-orange-100 rounded-lg w-fit">
                    <Clock className="text-orange-600" size={20} />
                  </div>
                  <p className="text-2xl font-bold mt-2">{data.overview.pendingJobs}</p>
                  <p className="text-sm text-gray-500">Pending Jobs</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="p-2 bg-red-100 rounded-lg w-fit">
                    <AlertCircle className="text-red-600" size={20} />
                  </div>
                  <p className="text-2xl font-bold mt-2">{formatCurrency(data.invoices.outstandingRevenue)}</p>
                  <p className="text-sm text-gray-500">Outstanding Invoices</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="p-2 bg-indigo-100 rounded-lg w-fit">
                    <Activity className="text-indigo-600" size={20} />
                  </div>
                  <p className="text-2xl font-bold mt-2">{formatCurrency(data.overview.expenseDeductions)}</p>
                  <p className="text-sm text-gray-500">Business Margin</p>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue Trend Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 size={20} />
                    Revenue Trend (Last 6 Months)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end gap-2 h-48">
                    {data.monthlyTrends.map((month, idx) => (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                          style={{ height: `${(month.revenue / maxRevenue) * 160}px`, minHeight: '4px' }}
                          title={formatCurrency(month.revenue)}
                        />
                        <span className="text-xs text-gray-500">{month.shortMonth}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between mt-4 text-sm text-gray-600">
                    <span>
                      Total: {formatCurrency(data.monthlyTrends.reduce((sum, m) => sum + m.revenue, 0))}
                    </span>
                    <span>
                      {data.monthlyTrends.reduce((sum, m) => sum + m.jobs, 0)} jobs
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Invoice Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText size={20} />
                    Invoice Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 bg-green-500 rounded" />
                        <span>Paid</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold">{data.invoices.paid}</span>
                        <span className="text-gray-500 ml-2">
                          {formatCurrency(data.invoices.paidInvoiceRevenue)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 bg-amber-500 rounded" />
                        <span>Sent (Outstanding)</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold">{data.invoices.sent}</span>
                        <span className="text-gray-500 ml-2">
                          {formatCurrency(data.invoices.outstandingRevenue)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 bg-gray-400 rounded" />
                        <span>Draft</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold">{data.invoices.draft}</span>
                      </div>
                    </div>

                    <div className="pt-4">
                      <div className="h-4 rounded-full overflow-hidden bg-gray-100 flex">
                        {data.invoices.total > 0 && (
                          <>
                            <div
                              className="bg-green-500 h-full"
                              style={{ width: `${(data.invoices.paid / data.invoices.total) * 100}%` }}
                            />
                            <div
                              className="bg-amber-500 h-full"
                              style={{ width: `${(data.invoices.sent / data.invoices.total) * 100}%` }}
                            />
                            <div
                              className="bg-gray-400 h-full"
                              style={{ width: `${(data.invoices.draft / data.invoices.total) * 100}%` }}
                            />
                          </>
                        )}
                      </div>
                      <p className="text-center text-sm text-gray-500 mt-2">
                        {data.invoices.total} total invoices
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tables Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Top Properties */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Building size={20} />
                      Top Properties
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push('/properties')}
                    >
                      View All
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.topProperties.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No property data</p>
                  ) : (
                    <div className="space-y-3">
                      {data.topProperties.slice(0, 5).map((prop, idx) => (
                        <div
                          key={prop.id}
                          className="flex items-center justify-between cursor-pointer hover:bg-gray-50 p-2 rounded"
                          onClick={() => router.push(`/properties/${prop.id}/edit`)}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-gray-400 text-sm w-4">{idx + 1}</span>
                            <div>
                              <p className="font-medium text-sm">{prop.name}</p>
                              <p className="text-xs text-gray-500">{prop.jobs} jobs</p>
                            </div>
                          </div>
                          <p className="font-semibold text-green-600">
                            {formatCurrency(prop.revenue)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top Owners */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Users size={20} />
                      Top Owners
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push('/owners')}
                    >
                      View All
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.topOwners.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No owner data</p>
                  ) : (
                    <div className="space-y-3">
                      {data.topOwners.slice(0, 5).map((owner, idx) => (
                        <div
                          key={owner.id}
                          className="flex items-center justify-between cursor-pointer hover:bg-gray-50 p-2 rounded"
                          onClick={() => router.push(`/owners/${owner.id}`)}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-gray-400 text-sm w-4">{idx + 1}</span>
                            <div>
                              <p className="font-medium text-sm">{owner.name}</p>
                              <p className="text-xs text-gray-500">{owner.jobs} jobs</p>
                            </div>
                          </div>
                          <p className="font-semibold text-green-600">
                            {formatCurrency(owner.revenue)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Team Performance */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Users size={20} />
                      Team Performance
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push('/team')}
                    >
                      View All
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.teamStats.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No team data</p>
                  ) : (
                    <div className="space-y-3">
                      {data.teamStats.slice(0, 5).map((member, idx) => (
                        <div key={member.id} className="flex items-center justify-between p-2">
                          <div className="flex items-center gap-3">
                            <span className="text-gray-400 text-sm w-4">{idx + 1}</span>
                            <div>
                              <p className="font-medium text-sm">{member.name}</p>
                              <p className="text-xs text-gray-500">{member.jobs} jobs</p>
                            </div>
                          </div>
                          <p className="font-semibold text-amber-600">
                            {formatCurrency(member.earnings)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
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
                  {data.recentJobs.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No recent jobs</p>
                  ) : (
                    <div className="space-y-2">
                      {data.recentJobs.slice(0, 5).map((job) => (
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
                              <Badge variant={job.clientPaid ? 'success' : 'warning'} className="text-xs">
                                {job.clientPaid ? 'Paid' : 'Unpaid'}
                              </Badge>
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
                  {data.recentInvoices.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No recent invoices</p>
                  ) : (
                    <div className="space-y-2">
                      {data.recentInvoices.slice(0, 5).map((invoice) => (
                        <div
                          key={invoice.id}
                          className="flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer"
                          onClick={() => router.push(`/invoices/${invoice.id}`)}
                        >
                          <div>
                            <p className="text-sm font-medium">{invoice.invoiceNumber}</p>
                            <p className="text-xs text-gray-500">
                              {invoice.propertyName} - {format(new Date(invoice.invoiceDate), 'MMM d')}
                            </p>
                          </div>
                          <div className="text-right flex items-center gap-2">
                            <p className="text-sm font-semibold">{formatCurrency(invoice.total)}</p>
                            <Badge
                              variant={
                                invoice.status === 'paid'
                                  ? 'success'
                                  : invoice.status === 'sent'
                                  ? 'warning'
                                  : 'default'
                              }
                              className="text-xs"
                            >
                              {invoice.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Business Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Business Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Building className="text-blue-600" size={28} />
                    </div>
                    <p className="text-3xl font-bold">{data.counts.properties}</p>
                    <p className="text-gray-500">Properties</p>
                  </div>
                  <div className="text-center">
                    <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Users className="text-purple-600" size={28} />
                    </div>
                    <p className="text-3xl font-bold">{data.counts.owners}</p>
                    <p className="text-gray-500">Owners</p>
                  </div>
                  <div className="text-center">
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Users className="text-amber-600" size={28} />
                    </div>
                    <p className="text-3xl font-bold">{data.counts.teamMembers}</p>
                    <p className="text-gray-500">Team Members</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <div className="text-center py-12 text-gray-500">Failed to load report data</div>
        )}
      </div>
    </div>
  )
}
