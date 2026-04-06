'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  DollarSign,
  Clock,
  Users,
  FileText,
  Building,
  Calendar,
  Plus,
  ChevronRight,
  AlertTriangle,
  Bell,
  Package,
  X,
  AlertCircle,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency, formatDate } from '@/lib/utils'
import v1Fetch from '@/lib/v1-compat'

interface DashboardStats {
  monthlyRevenue: number
  pendingFromClients: number
  owedToTeam: number
  draftInvoices: number
  lowStockItems: number
}

interface TodayJob {
  id: string
  time: string | null
  date: string
  property: { id: string; name: string; address?: string }
  assignments: { teamMember: { name: string } }[]
  completed: boolean
}

interface Alert {
  id: string
  type: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  description: string
  actionUrl?: string
  isPersisted?: boolean
}

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats>({
    monthlyRevenue: 0, pendingFromClients: 0, owedToTeam: 0, draftInvoices: 0, lowStockItems: 0,
  })
  const [todayJobs, setTodayJobs] = useState<TodayJob[]>([])
  const [upcomingJobs, setUpcomingJobs] = useState<TodayJob[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
    fetchAlerts()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const response = await v1Fetch('/api/dashboard')
      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
        setTodayJobs(data.todayJobs || [])
        setUpcomingJobs(data.upcomingJobs || [])
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchAlerts = async () => {
    try {
      const response = await v1Fetch('/api/alerts')
      if (response.ok) {
        const data = await response.json()
        setAlerts(data.alerts || [])
      }
    } catch {
      // Alerts endpoint may not exist yet — that's OK
    }
  }

  const dismissAlert = (alertId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDismissedAlerts(prev => new Set([...prev, alertId]))
  }

  const visibleAlerts = alerts.filter(a => !dismissedAlerts.has(a.id))
  const hasData = todayJobs.length > 0 || upcomingJobs.length > 0 || stats.monthlyRevenue > 0

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'critical': return { bg: 'bg-red-50', border: 'border-red-200', icon: 'text-red-600', badge: 'bg-red-600 text-white' }
      case 'warning': return { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-600', badge: 'bg-amber-500 text-white' }
      default: return { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-600', badge: 'bg-blue-500 text-white' }
    }
  }

  return (
    <div className="min-h-screen">
      <div className="p-6">
        <PageHeader
          title={new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening"}
          subtitle={new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        />
      </div>

      <div className="px-6 pb-6 space-y-6">
        {/* Welcome Banner */}
        {!isLoading && !hasData && (
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white">
            <h2 className="text-2xl font-bold mb-2">Welcome to Cleaning Right Now!</h2>
            <p className="text-blue-100 mb-4">Get started by adding your first property, team member, or scheduling a job.</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/properties"><Button variant="secondary" size="sm"><Building size={16} /> Add Property</Button></Link>
              <Link href="/team"><Button variant="secondary" size="sm"><Users size={16} /> Add Team Member</Button></Link>
              <Link href="/jobs"><Button variant="secondary" size="sm"><Calendar size={16} /> Schedule Job</Button></Link>
            </div>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard label="Monthly Revenue" value={formatCurrency(stats.monthlyRevenue)} icon={DollarSign} iconColor="bg-green-100 text-green-600" />
          <StatCard label="Pending from Clients" value={formatCurrency(stats.pendingFromClients)} icon={Clock} iconColor="bg-amber-100 text-amber-600" />
          <StatCard label="Owed to Team" value={formatCurrency(stats.owedToTeam)} icon={Users} iconColor="bg-blue-100 text-blue-600" />
          <StatCard label="Draft Invoices" value={stats.draftInvoices.toString()} icon={FileText} iconColor="bg-purple-100 text-purple-600" />
          <StatCard label="Low Stock Items" value={stats.lowStockItems.toString()} icon={Package} iconColor="bg-red-100 text-red-600" />
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: Today + Upcoming (merged timeline) */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">
                    Today&apos;s Jobs & Upcoming
                    {(todayJobs.length + upcomingJobs.length) > 0 && (
                      <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                        {todayJobs.length + upcomingJobs.length}
                      </span>
                    )}
                  </h3>
                  <Link href="/jobs" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                    View All <ChevronRight size={16} />
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {todayJobs.length === 0 && upcomingJobs.length === 0 ? (
                  <EmptyState
                    icon={<Calendar size={40} />}
                    title="No jobs scheduled"
                    description="Schedule a new job or check your calendar."
                    actionLabel="Schedule Job"
                    onAction={() => router.push('/jobs')}
                  />
                ) : (
                  <div className="space-y-2">
                    {/* Today's jobs */}
                    {todayJobs.length > 0 && (
                      <>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Today</p>
                        {todayJobs.map((job) => (
                          <JobRow key={job.id} job={job} showDate={false} />
                        ))}
                      </>
                    )}

                    {/* Upcoming */}
                    {upcomingJobs.length > 0 && (
                      <>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-4 mb-2">Upcoming</p>
                        {upcomingJobs.slice(0, 8).map((job) => (
                          <JobRow key={job.id} job={job} showDate={true} />
                        ))}
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Alerts + Quick Actions */}
          <div className="space-y-6">

            {/* Alerts Panel */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  {visibleAlerts.some(a => a.severity === 'critical') ? (
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                      <AlertTriangle className="text-red-600" size={16} />
                    </div>
                  ) : (
                    <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                      <Bell className="text-amber-600" size={16} />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-gray-900">Alerts</h3>
                    {visibleAlerts.length > 0 && (
                      <p className="text-xs text-gray-500">{visibleAlerts.length} item{visibleAlerts.length !== 1 ? 's' : ''} need attention</p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {visibleAlerts.length === 0 ? (
                  <div className="text-center py-4">
                    <Bell size={24} className="mx-auto mb-2 text-gray-300" />
                    <p className="text-sm text-gray-500">All clear! No alerts.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {visibleAlerts.slice(0, 10).map((alert) => {
                      const styles = getSeverityStyles(alert.severity)
                      return (
                        <div
                          key={alert.id}
                          className={`p-3 rounded-lg ${styles.bg} border ${styles.border} cursor-pointer hover:brightness-95 group`}
                          onClick={() => alert.actionUrl && router.push(alert.actionUrl)}
                        >
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${styles.badge}`}>
                                  {alert.severity}
                                </span>
                                <span className="font-medium text-sm text-gray-900 truncate">{alert.title}</span>
                              </div>
                              <p className="text-xs text-gray-600 line-clamp-2">{alert.description}</p>
                            </div>
                            <button
                              onClick={(e) => dismissAlert(alert.id, e)}
                              className="p-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-gray-900">Quick Actions</h3>
              </CardHeader>
              <CardContent className="space-y-1">
                <Link href="/jobs" className="flex items-center gap-3 p-2.5 hover:bg-gray-50 rounded-lg transition-colors">
                  <Plus size={18} className="text-gray-400" />
                  <span className="text-sm text-gray-700">New Job</span>
                </Link>
                <Link href="/properties" className="flex items-center gap-3 p-2.5 hover:bg-gray-50 rounded-lg transition-colors">
                  <Building size={18} className="text-gray-400" />
                  <span className="text-sm text-gray-700">Add Property</span>
                </Link>
                <Link href="/calendar" className="flex items-center gap-3 p-2.5 hover:bg-gray-50 rounded-lg transition-colors">
                  <Calendar size={18} className="text-gray-400" />
                  <span className="text-sm text-gray-700">View Calendar</span>
                </Link>
                <Link href="/team" className="flex items-center gap-3 p-2.5 hover:bg-gray-50 rounded-lg transition-colors">
                  <Users size={18} className="text-gray-400" />
                  <span className="text-sm text-gray-700">Manage Team</span>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Job Row (shared between Today and Upcoming) ─────────────────

function JobRow({ job, showDate }: { job: TodayJob; showDate: boolean }) {
  return (
    <Link
      href={`/jobs?highlight=${job.id}`}
      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          job.completed ? 'bg-green-100' : 'bg-blue-100'
        }`}>
          <Building className={job.completed ? 'text-green-600' : 'text-blue-600'} size={20} />
        </div>
        <div>
          <div className="font-medium text-gray-900 text-sm">{job.property.name}</div>
          <div className="text-xs text-gray-500">
            {showDate && job.date ? formatDate(job.date) + ' · ' : ''}
            {job.time || 'No time set'}
            {job.assignments?.length > 0 && (
              <span className="ml-1">
                · {job.assignments.map(a => a.teamMember?.name).filter(Boolean).join(', ')}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {job.completed && (
          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
            Complete
          </span>
        )}
        <ChevronRight size={16} className="text-gray-300" />
      </div>
    </Link>
  )
}

// ── Stat Card ────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, iconColor }: {
  label: string; value: string; icon: typeof DollarSign; iconColor: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconColor}`}>
          <Icon size={20} />
        </div>
      </CardContent>
    </Card>
  )
}
