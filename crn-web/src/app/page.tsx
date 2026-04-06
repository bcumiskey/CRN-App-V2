'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  DollarSign,
  Clock,
  Users,
  FileText,
  Building,
  Calendar,
  Plus,
  ChevronRight,
  AlertCircle,
  Package,
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
  property: { id: string; name: string; address: string }
  assignments: { teamMember: { name: string } }[]
  completed: boolean
}

interface UpcomingJob {
  id: string
  date: string
  property: { name: string }
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    monthlyRevenue: 0,
    pendingFromClients: 0,
    owedToTeam: 0,
    draftInvoices: 0,
    lowStockItems: 0,
  })
  const [todayJobs, setTodayJobs] = useState<TodayJob[]>([])
  const [upcomingJobs, setUpcomingJobs] = useState<UpcomingJob[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
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

  const hasData = todayJobs.length > 0 || upcomingJobs.length > 0 || stats.monthlyRevenue > 0

  return (
    <div className="min-h-screen">
      <div className="p-6">
        <PageHeader
          title={new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening"}
          subtitle={new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        />
      </div>

      <div className="px-6 pb-6 space-y-6">
        {/* Welcome Banner - Show when no data */}
        {!isLoading && !hasData && (
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white">
            <h2 className="text-2xl font-bold mb-2">Welcome to Cleaning Right Now!</h2>
            <p className="text-blue-100 mb-4">
              Get started by adding your first property, team member, or scheduling a job.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/properties">
                <Button variant="secondary" size="sm">
                  <Building size={16} />
                  Add Property
                </Button>
              </Link>
              <Link href="/team">
                <Button variant="secondary" size="sm">
                  <Users size={16} />
                  Add Team Member
                </Button>
              </Link>
              <Link href="/jobs">
                <Button variant="secondary" size="sm">
                  <Calendar size={16} />
                  Schedule Job
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard
            label="Monthly Revenue"
            value={formatCurrency(stats.monthlyRevenue)}
            icon={DollarSign}
            iconColor="bg-green-100 text-green-600"
          />
          <StatCard
            label="Pending from Clients"
            value={formatCurrency(stats.pendingFromClients)}
            icon={Clock}
            iconColor="bg-amber-100 text-amber-600"
          />
          <StatCard
            label="Owed to Team"
            value={formatCurrency(stats.owedToTeam)}
            icon={Users}
            iconColor="bg-blue-100 text-blue-600"
          />
          <StatCard
            label="Draft Invoices"
            value={stats.draftInvoices.toString()}
            icon={FileText}
            iconColor="bg-purple-100 text-purple-600"
          />
          <StatCard
            label="Low Stock Items"
            value={stats.lowStockItems.toString()}
            icon={Package}
            iconColor="bg-red-100 text-red-600"
          />
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Today's Jobs */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Today&apos;s Jobs</h3>
                  <Link
                    href="/jobs"
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    View All <ChevronRight size={16} />
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {todayJobs.length === 0 ? (
                  <EmptyState
                    icon={<Calendar size={40} />}
                    title="No jobs scheduled for today"
                    description="Schedule a new job or check your calendar for upcoming appointments."
                    actionLabel="Schedule Job"
                    onAction={() => (window.location.href = '/jobs')}
                  />
                ) : (
                  <div className="space-y-3">
                    {todayJobs.map((job) => (
                      <Link
                        key={job.id}
                        href={`/jobs?highlight=${job.id}`}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                              job.completed ? 'bg-green-100' : 'bg-blue-100'
                            }`}
                          >
                            <Building
                              className={job.completed ? 'text-green-600' : 'text-blue-600'}
                              size={24}
                            />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{job.property.name}</div>
                            <div className="text-sm text-gray-500">
                              {job.time || 'No time set'}
                              {job.assignments.length > 0 && (
                                <span className="ml-2">
                                  • {job.assignments.map((a) => a.teamMember.name).join(', ')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {job.completed && (
                          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                            Complete
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions & Upcoming */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-gray-900">Quick Actions</h3>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link
                  href="/jobs"
                  className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <Plus size={18} className="text-gray-400" />
                  <span className="text-gray-700">New Job</span>
                </Link>
                <Link
                  href="/properties"
                  className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <Building size={18} className="text-gray-400" />
                  <span className="text-gray-700">Add Property</span>
                </Link>
                <Link
                  href="/calendar"
                  className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <Calendar size={18} className="text-gray-400" />
                  <span className="text-gray-700">View Calendar</span>
                </Link>
                <Link
                  href="/team"
                  className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <Users size={18} className="text-gray-400" />
                  <span className="text-gray-700">Manage Team</span>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Upcoming</h3>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                    {upcomingJobs.length}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                {upcomingJobs.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">No upcoming jobs</p>
                ) : (
                  <div className="space-y-3">
                    {upcomingJobs.slice(0, 5).map((job) => (
                      <div key={job.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{job.property.name}</span>
                        <span className="text-gray-500">{formatDate(job.date)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

interface StatCardProps {
  label: string
  value: string
  icon: typeof DollarSign
  iconColor: string
}

function StatCard({ label, value, icon: Icon, iconColor }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${iconColor}`}>
          <Icon size={24} />
        </div>
      </CardContent>
    </Card>
  )
}
