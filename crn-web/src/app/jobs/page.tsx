'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import {
  Calendar,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  Check,
  X,
  Users,
  MapPin,
  Clock,
  DollarSign,
  RefreshCw,
  Repeat,
  Play,
  Pause,
  Building,
  History,
  AlertCircle,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency, cn } from '@/lib/utils'
import v1Fetch from "@/lib/v1-compat"

function toast(msg: string, type: 'success' | 'error' = 'success') {
  // Simple toast implementation
  const div = document.createElement('div');
  div.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-white text-sm ${type === 'error' ? 'bg-red-600' : 'bg-green-600'}`;
  div.textContent = msg;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

function calculateJobPayments(rate: number, expensePercent: number, count: number) {
  const expense = Math.round(rate * (expensePercent / 100) * 100) / 100;
  const teamTotal = Math.round((rate - expense) * 100) / 100;
  const perPerson = count > 0 ? Math.round((teamTotal / count) * 100) / 100 : 0;
  return { expense, teamTotal, perPerson };
}

interface JobAssignment {
  id: string
  teamMember: { id: string; name: string; imageUrl?: string | null }
  paidAt: string | null
  paymentMethod: string | null
}

// Helper to get initials from name
const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// Helper to generate consistent color from string
const getAvatarColor = (name: string) => {
  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500',
    'bg-indigo-500', 'bg-teal-500', 'bg-orange-500', 'bg-cyan-500'
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

interface Job {
  id: string
  date: string
  time: string | null
  priority: number
  rate: number
  expensePercent: number
  completed: boolean
  clientPaid: boolean
  teamPaid: boolean
  teamPaidAt: string | null
  source: string
  property: { id: string; name: string; color: string | null }
  assignments: JobAssignment[]
}

const PAYMENT_METHODS = [
  { value: 'venmo', label: 'Venmo' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
]

const PRIORITY_OPTIONS = [
  { value: '1', label: '1 - Highest' },
  { value: '2', label: '2 - High' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5 - Normal' },
  { value: '6', label: '6' },
  { value: '7', label: '7' },
  { value: '8', label: '8 - Low' },
  { value: '9', label: '9' },
  { value: '10', label: '10 - Lowest' },
]

interface Property {
  id: string
  name: string
  baseRate: number
}

interface TeamMember {
  id: string
  name: string
  imageUrl?: string | null
}

interface Schedule {
  id: string
  name: string
  propertyId: string
  property: Property
  isActive: boolean
  frequency: string
  dayOfWeek: number | null
  dayOfMonth: number | null
  time: string | null
  rate: number | null
  expensePercent: number
  generateAheadDays: number
  lastGeneratedDate: string | null
}

const DAYS_OF_WEEK = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
]

const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
]

export default function JobsPage() {
  return (
    <Suspense fallback={<JobsPageLoading />}>
      <JobsPageContent />
    </Suspense>
  )
}

function JobsPageLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="Jobs & Payments" />
      <div className="p-6">
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </div>
    </div>
  )
}

function JobsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const highlightId = searchParams.get('highlight')
  const tabParam = searchParams.get('tab')
  const newJobParam = searchParams.get('newJob')
  const dateParam = searchParams.get('date')

  const [activeTab, setActiveTab] = useState<'jobs' | 'recurring'>(
    tabParam === 'recurring' ? 'recurring' : 'jobs'
  )
  const [jobs, setJobs] = useState<Job[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingJob, setEditingJob] = useState<Job | null>(null)
  const [currentMonth, setCurrentMonth] = useState(new Date())

  // Recurring schedules state
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  // Team payment modal state
  const [showTeamPaymentModal, setShowTeamPaymentModal] = useState(false)
  const [selectedJobForTeamPayment, setSelectedJobForTeamPayment] = useState<Job | null>(null)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('')

  // Expanded jobs state (for mobile-friendly expand/collapse)
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set())

  const toggleJobExpanded = (jobId: string) => {
    setExpandedJobs(prev => {
      const next = new Set(prev)
      if (next.has(jobId)) {
        next.delete(jobId)
      } else {
        next.add(jobId)
      }
      return next
    })
  }

  useEffect(() => {
    fetchJobs()
    fetchProperties()
    fetchTeamMembers()
    fetchSchedules()
  }, [currentMonth])

  // Scroll to highlighted job
  useEffect(() => {
    if (highlightId) {
      setTimeout(() => {
        const element = document.getElementById(`job-${highlightId}`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
          element.classList.add('ring-2', 'ring-blue-500')
          setTimeout(() => {
            element.classList.remove('ring-2', 'ring-blue-500')
          }, 3000)
        }
      }, 100)
    }
  }, [highlightId, jobs])

  // State for pre-selected date from calendar
  const [preselectedDate, setPreselectedDate] = useState<string | null>(null)

  // Open new job modal if coming from calendar
  useEffect(() => {
    if (newJobParam === 'true') {
      setPreselectedDate(dateParam)
      setEditingJob(null)
      setShowModal(true)
      // Clear the URL params
      router.replace('/jobs')
    }
  }, [newJobParam, dateParam, router])

  const fetchJobs = async () => {
    try {
      const month = currentMonth.getMonth() + 1
      const year = currentMonth.getFullYear()
      const response = await v1Fetch(`/api/jobs?month=${month}&year=${year}`)
      if (response.ok) {
        const data = await response.json()
        setJobs(data)
      }
    } catch (error) {
      console.error('Failed to fetch jobs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchProperties = async () => {
    const response = await v1Fetch('/api/properties')
    if (response.ok) {
      setProperties(await response.json())
    }
  }

  const fetchTeamMembers = async () => {
    const response = await v1Fetch('/api/team')
    if (response.ok) {
      setTeamMembers(await response.json())
    }
  }

  const fetchSchedules = async () => {
    try {
      const response = await v1Fetch('/api/recurring-schedules')
      if (response.ok) {
        setSchedules(await response.json())
      }
    } catch (error) {
      console.error('Failed to fetch schedules:', error)
    }
  }

  // Schedule management functions
  const handleSaveSchedule = async (data: Record<string, unknown>) => {
    try {
      const url = editingSchedule
        ? `/api/recurring-schedules/${editingSchedule.id}`
        : '/api/recurring-schedules'
      const method = editingSchedule ? 'PATCH' : 'POST'

      const response = await v1Fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        toast(editingSchedule ? 'Schedule updated' : 'Schedule created')
        setShowScheduleModal(false)
        setEditingSchedule(null)
        fetchSchedules()
      } else {
        const error = await response.json()
        toast(error.error || 'Failed to save schedule', 'error')
      }
    } catch (error) {
      toast('Failed to save schedule', 'error')
    }
  }

  const handleDeleteSchedule = async (schedule: Schedule) => {
    if (!confirm(`Delete schedule "${schedule.name}"?`)) return

    try {
      const response = await v1Fetch(`/api/recurring-schedules/${schedule.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast('Schedule deleted')
        fetchSchedules()
      } else {
        toast('Failed to delete schedule', 'error')
      }
    } catch (error) {
      toast('Failed to delete schedule', 'error')
    }
  }

  const handleToggleScheduleActive = async (schedule: Schedule) => {
    try {
      const response = await v1Fetch(`/api/recurring-schedules/${schedule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !schedule.isActive }),
      })

      if (response.ok) {
        toast(schedule.isActive ? 'Schedule paused' : 'Schedule activated')
        fetchSchedules()
      } else {
        toast('Failed to update schedule', 'error')
      }
    } catch (error) {
      toast('Failed to update schedule', 'error')
    }
  }

  const handleGenerateScheduleJobs = async (scheduleId?: string) => {
    setIsGenerating(true)
    try {
      const response = await v1Fetch('/api/recurring-schedules/generate', {
        method: scheduleId ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: scheduleId ? JSON.stringify({ scheduleId }) : undefined,
      })

      if (response.ok) {
        const data = await response.json()
        toast(data.message)
        fetchSchedules()
        fetchJobs()
      } else {
        toast('Failed to generate jobs', 'error')
      }
    } catch (error) {
      toast('Failed to generate jobs', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  const getFrequencyLabel = (schedule: Schedule) => {
    switch (schedule.frequency) {
      case 'daily':
        return 'Daily'
      case 'weekly':
        return `Weekly on ${DAYS_OF_WEEK.find(d => d.value === String(schedule.dayOfWeek))?.label || ''}`
      case 'biweekly':
        return `Bi-weekly on ${DAYS_OF_WEEK.find(d => d.value === String(schedule.dayOfWeek))?.label || ''}`
      case 'monthly':
        const day = schedule.dayOfMonth
        const suffix = day === 1 || day === 21 || day === 31 ? 'st' :
                      day === 2 || day === 22 ? 'nd' :
                      day === 3 || day === 23 ? 'rd' : 'th'
        return `Monthly on the ${day}${suffix}`
      default:
        return schedule.frequency
    }
  }

  const handleSave = async (data: any) => {
    try {
      const payload = {
        ...data,
        rate: parseFloat(data.rate) || 0,
        expensePercent: parseFloat(data.expensePercent) || 12,
        priority: parseInt(data.priority) || 5,
      }

      const url = editingJob ? `/api/jobs/${editingJob.id}` : '/api/jobs'
      const method = editingJob ? 'PATCH' : 'POST'

      const response = await v1Fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        toast(editingJob ? 'Job updated' : 'Job created')
        setShowModal(false)
        setEditingJob(null)
        fetchJobs()
      } else {
        const error = await response.json()
        toast(error.error || 'Failed to save job', 'error')
      }
    } catch (error) {
      toast('Failed to save job', 'error')
    }
  }

  const handleDelete = async (jobId: string) => {
    if (!confirm('Delete this job?')) return
    try {
      const response = await v1Fetch(`/api/jobs/${jobId}`, { method: 'DELETE' })
      if (response.ok) {
        toast('Job deleted')
        fetchJobs()
      } else {
        toast('Failed to delete job', 'error')
      }
    } catch (error) {
      toast('Failed to delete job', 'error')
    }
  }

  const handleStatusChange = async (jobId: string, field: string, value: boolean) => {
    try {
      const response = await v1Fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })

      if (response.ok) {
        fetchJobs()
        if (field === 'completed' && value) {
          toast('Job marked complete! Invoice created.')
        } else if (field === 'completed' && !value) {
          toast('Job marked incomplete')
        } else if (field === 'teamPaid' && value) {
          toast('Team marked as paid')
        } else {
          toast(value ? 'Updated' : 'Unmarked')
        }
      }
    } catch (error) {
      toast('Failed to update job', 'error')
    }
  }

  const handleEdit = (job: Job) => {
    setEditingJob(job)
    setShowModal(true)
  }

  const handleTeamPayment = async (jobId: string, paymentMethod: string | null) => {
    try {
      const response = await v1Fetch(`/api/jobs/${jobId}/team-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod }),
      })

      if (response.ok) {
        fetchJobs()
        if (paymentMethod) {
          toast(`Team marked as paid via ${PAYMENT_METHODS.find(p => p.value === paymentMethod)?.label}`)
        } else {
          toast('Team payment cleared')
        }
        setShowTeamPaymentModal(false)
        setSelectedJobForTeamPayment(null)
        setSelectedPaymentMethod('')
      } else {
        toast('Failed to update team payment', 'error')
      }
    } catch (error) {
      toast('Failed to update team payment', 'error')
    }
  }

  const totalRevenue = jobs.reduce((sum, job) => sum + job.rate, 0)
  const completedJobs = jobs.filter(j => j.completed).length

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }

  // Group jobs by date
  const jobsByDate = jobs.reduce((acc, job) => {
    const dateKey = format(parseISO(job.date), 'yyyy-MM-dd')
    if (!acc[dateKey]) acc[dateKey] = []
    acc[dateKey].push(job)
    return acc
  }, {} as Record<string, Job[]>)

  const sortedDates = Object.keys(jobsByDate).sort()

  const activeSchedules = schedules.filter(s => s.isActive)

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="Jobs & Payments" />

      <div className="p-6 space-y-6">
        {/* Tab Navigation */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
          <button
            onClick={() => setActiveTab('jobs')}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium transition-colors',
              activeTab === 'jobs'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            <Calendar size={16} className="inline mr-2" />
            Jobs
          </button>
          <button
            onClick={() => setActiveTab('recurring')}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium transition-colors',
              activeTab === 'recurring'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            <Repeat size={16} className="inline mr-2" />
            Recurring Schedules
            {activeSchedules.length > 0 && (
              <Badge variant="info" className="ml-2">{activeSchedules.length}</Badge>
            )}
          </button>
        </div>

        {activeTab === 'jobs' && (
          <>
        {/* Header with Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Jobs</p>
                  <p className="text-2xl font-bold">{jobs.length}</p>
                </div>
                <Calendar className="text-blue-500" size={24} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Completed</p>
                  <p className="text-2xl font-bold text-green-600">{completedJobs}</p>
                </div>
                <Check className="text-green-500" size={24} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Revenue</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
                </div>
                <DollarSign className="text-emerald-500" size={24} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-2">
              <Button onClick={() => { setEditingJob(null); setShowModal(true) }} className="flex-1">
                <Plus size={16} />
                Add Job
              </Button>
              <Button variant="outline" onClick={() => router.push('/team')}>
                <History size={16} />
                Pay History
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Month Navigation */}
        <Card>
          <CardContent className="flex items-center justify-between py-3">
            <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg">
              <ChevronLeft size={20} />
            </button>
            <h3 className="text-lg font-semibold">
              {format(currentMonth, 'MMMM yyyy')}
            </h3>
            <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg">
              <ChevronRight size={20} />
            </button>
          </CardContent>
        </Card>

        {/* Jobs List */}
        {isLoading ? (
          <Card>
            <CardContent className="text-center py-12 text-gray-500">Loading...</CardContent>
          </Card>
        ) : jobs.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <EmptyState
                icon={<Calendar size={40} />}
                title="No jobs this month"
                description="Add a job or sync your calendars to get started."
                actionLabel="Add Job"
                onAction={() => setShowModal(true)}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {sortedDates.map(dateKey => (
              <div key={dateKey}>
                <h4 className="text-sm font-semibold text-gray-500 mb-2 px-1">
                  {format(parseISO(dateKey), 'EEEE, MMMM d')}
                </h4>
                <div className="space-y-2">
                  {jobsByDate[dateKey].map(job => {
                    const payments = calculateJobPayments(job.rate, job.expensePercent, job.assignments.length)
                    const isExpanded = expandedJobs.has(job.id)
                    // Get background color style based on property color
                    const getJobStyle = () => {
                      if (job.property.color) {
                        return {
                          backgroundColor: job.completed
                            ? `${job.property.color}40` // 25% opacity for completed
                            : `${job.property.color}20`, // 12% opacity for pending
                          borderColor: job.property.color,
                          borderWidth: '1px',
                          borderStyle: 'solid' as const,
                        }
                      }
                      return undefined
                    }
                    return (
                      <Card
                        key={job.id}
                        id={`job-${job.id}`}
                        className={cn(
                          'transition-all cursor-pointer',
                          !job.property.color && (job.completed ? 'bg-green-50 border-green-200' : 'bg-white')
                        )}
                        style={getJobStyle()}
                      >
                        <CardContent className="p-3 sm:p-4">
                          {/* Main row - always visible */}
                          <div
                            className="flex items-center gap-3"
                            onClick={() => toggleJobExpanded(job.id)}
                          >
                            {/* Property Icon */}
                            <div
                              className={cn(
                                'w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center flex-shrink-0',
                                !job.property.color && (job.completed ? 'bg-green-200' : 'bg-blue-100')
                              )}
                              style={job.property.color ? { backgroundColor: `${job.property.color}30` } : undefined}
                            >
                              {job.completed ? (
                                <Check
                                  className={!job.property.color ? 'text-green-700' : ''}
                                  style={job.property.color ? { color: job.property.color } : undefined}
                                  size={20}
                                />
                              ) : (
                                <MapPin
                                  className={!job.property.color ? 'text-blue-600' : ''}
                                  style={job.property.color ? { color: job.property.color } : undefined}
                                  size={20}
                                />
                              )}
                            </div>

                            {/* Property Name & Rate */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <h3 className="font-semibold text-gray-900 truncate">{job.property.name}</h3>
                                <span className="font-semibold text-gray-900 flex-shrink-0">{formatCurrency(job.rate)}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                {/* Time if exists */}
                                {job.time && (
                                  <span className="text-xs text-gray-500 flex items-center gap-1">
                                    <Clock size={12} />
                                    {job.time}
                                  </span>
                                )}
                                {/* Priority badge for high priority */}
                                {job.priority <= 3 && (
                                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                    job.priority <= 2 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                  }`}>
                                    P{job.priority}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Team Member Avatars */}
                            <div className="flex items-center -space-x-2 flex-shrink-0">
                              {job.assignments.length > 0 ? (
                                <>
                                  {job.assignments.slice(0, 3).map((a, idx) => (
                                    <div
                                      key={a.teamMember.id}
                                      className={cn(
                                        'w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-white',
                                        getAvatarColor(a.teamMember.name)
                                      )}
                                      style={{ zIndex: 3 - idx }}
                                      title={a.teamMember.name}
                                    >
                                      {getInitials(a.teamMember.name)}
                                    </div>
                                  ))}
                                  {job.assignments.length > 3 && (
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-400 text-white text-xs font-medium border-2 border-white">
                                      +{job.assignments.length - 3}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-200 text-gray-400 border-2 border-white" title="Unassigned">
                                  <AlertCircle size={16} />
                                </div>
                              )}
                            </div>

                            {/* Expand/Collapse Indicator */}
                            <div className="flex-shrink-0 text-gray-400">
                              {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </div>
                          </div>

                          {/* Expanded Details */}
                          {isExpanded && (
                            <div className="mt-4 pt-4 border-t space-y-4">
                              {/* Team Members Detail */}
                              <div className="flex flex-wrap gap-2">
                                {job.assignments.length > 0 ? (
                                  job.assignments.map(a => (
                                    <div key={a.teamMember.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                                      <div className={cn(
                                        'w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium',
                                        getAvatarColor(a.teamMember.name)
                                      )}>
                                        {getInitials(a.teamMember.name)}
                                      </div>
                                      <span className="text-sm font-medium text-gray-700">{a.teamMember.name}</span>
                                      {job.assignments.length > 0 && (
                                        <span className="text-xs text-gray-500">
                                          {formatCurrency(payments.perPerson)}
                                        </span>
                                      )}
                                    </div>
                                  ))
                                ) : (
                                  <span className="text-sm text-amber-600 flex items-center gap-1">
                                    <AlertCircle size={14} />
                                    No team assigned
                                  </span>
                                )}
                              </div>

                              {/* Meta Info */}
                              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  job.priority <= 2 ? 'bg-red-100 text-red-700' :
                                  job.priority <= 4 ? 'bg-amber-100 text-amber-700' :
                                  job.priority <= 6 ? 'bg-gray-100 text-gray-700' :
                                  'bg-blue-100 text-blue-700'
                                }`}>
                                  Priority {job.priority}
                                </span>
                                <span className="capitalize">Source: {job.source}</span>
                              </div>

                              {/* Actions Row */}
                              <div className="flex items-center justify-between pt-2 border-t">
                                {/* Status Controls */}
                                <div className="flex items-center gap-4">
                                  {/* Job Completion */}
                                  <label className="flex items-center gap-2 cursor-pointer" onClick={e => e.stopPropagation()}>
                                    <input
                                      type="checkbox"
                                      checked={job.completed}
                                      onChange={(e) => handleStatusChange(job.id, 'completed', e.target.checked)}
                                      className="w-5 h-5 text-green-600 rounded"
                                    />
                                    <span className="text-sm text-gray-700">Complete</span>
                                  </label>

                                  {/* Team Payment */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSelectedJobForTeamPayment(job)
                                      setShowTeamPaymentModal(true)
                                    }}
                                    className={cn(
                                      'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium',
                                      job.teamPaid
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    )}
                                  >
                                    {job.teamPaid ? (
                                      <>
                                        <Check size={14} />
                                        {job.assignments[0]?.paymentMethod
                                          ? PAYMENT_METHODS.find(p => p.value === job.assignments[0]?.paymentMethod)?.label
                                          : 'Paid'}
                                      </>
                                    ) : (
                                      'Pay Team'
                                    )}
                                  </button>
                                </div>

                                {/* Edit/Delete Actions */}
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleEdit(job) }}
                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                  >
                                    <Pencil size={18} />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(job.id) }}
                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
          </>
        )}

        {/* Recurring Schedules Tab */}
        {activeTab === 'recurring' && (
          <>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-500">
                  {activeSchedules.length} active schedule{activeSchedules.length !== 1 && 's'} generating jobs automatically
                </p>
              </div>
              <div className="flex gap-3">
                {activeSchedules.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => handleGenerateScheduleJobs()}
                    loading={isGenerating}
                  >
                    <RefreshCw size={16} />
                    Generate All Jobs
                  </Button>
                )}
                <Button onClick={() => { setEditingSchedule(null); setShowScheduleModal(true) }}>
                  <Plus size={16} />
                  Add Schedule
                </Button>
              </div>
            </div>

            {schedules.length === 0 ? (
              <Card>
                <CardContent className="p-6">
                  <EmptyState
                    icon={<Repeat size={40} />}
                    title="No recurring schedules"
                    description="Create recurring schedules to automatically generate jobs on a regular basis."
                    actionLabel="Add Schedule"
                    onAction={() => setShowScheduleModal(true)}
                  />
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {schedules.map((schedule) => (
                  <Card key={schedule.id} className={!schedule.isActive ? 'opacity-60' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            'w-12 h-12 rounded-lg flex items-center justify-center',
                            schedule.isActive ? 'bg-blue-100' : 'bg-gray-100'
                          )}>
                            <Repeat className={schedule.isActive ? 'text-blue-600' : 'text-gray-400'} size={24} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-gray-900">{schedule.name}</h4>
                              <Badge variant={schedule.isActive ? 'success' : 'default'}>
                                {schedule.isActive ? 'Active' : 'Paused'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                              <span className="flex items-center gap-1">
                                <Building size={12} />
                                {schedule.property.name}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock size={12} />
                                {getFrequencyLabel(schedule)}
                                {schedule.time && ` at ${schedule.time}`}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="font-semibold text-gray-900">
                              {formatCurrency(schedule.rate || schedule.property.baseRate)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {schedule.generateAheadDays} days ahead
                            </div>
                          </div>

                          <div className="flex items-center gap-1 border-l pl-4">
                            {schedule.isActive && (
                              <button
                                onClick={() => handleGenerateScheduleJobs(schedule.id)}
                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                title="Generate jobs now"
                              >
                                <RefreshCw size={16} />
                              </button>
                            )}
                            <button
                              onClick={() => handleToggleScheduleActive(schedule)}
                              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded"
                              title={schedule.isActive ? 'Pause schedule' : 'Activate schedule'}
                            >
                              {schedule.isActive ? <Pause size={16} /> : <Play size={16} />}
                            </button>
                            <button
                              onClick={() => { setEditingSchedule(schedule); setShowScheduleModal(true) }}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteSchedule(schedule)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <JobModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingJob(null); setPreselectedDate(null) }}
        onSave={handleSave}
        properties={properties}
        teamMembers={teamMembers}
        editingJob={editingJob}
        preselectedDate={preselectedDate}
      />

      <ScheduleModal
        isOpen={showScheduleModal}
        onClose={() => { setShowScheduleModal(false); setEditingSchedule(null) }}
        onSave={handleSaveSchedule}
        schedule={editingSchedule}
        properties={properties}
      />

      {/* Team Payment Modal */}
      <Modal
        open={showTeamPaymentModal}
        onClose={() => {
          setShowTeamPaymentModal(false)
          setSelectedJobForTeamPayment(null)
          setSelectedPaymentMethod('')
        }}
        title="Team Payment"
        size="sm"
      >
        {selectedJobForTeamPayment && (
          <div className="space-y-4">
            <div className="text-center pb-4 border-b">
              <p className="font-medium text-gray-900">{selectedJobForTeamPayment.property.name}</p>
              <p className="text-sm text-gray-500">{format(parseISO(selectedJobForTeamPayment.date), 'MMMM d, yyyy')}</p>
              <p className="text-lg font-semibold text-blue-600 mt-1">
                {formatCurrency(calculateJobPayments(
                  selectedJobForTeamPayment.rate,
                  selectedJobForTeamPayment.expensePercent,
                  selectedJobForTeamPayment.assignments.length
                ).perPerson)} per person
              </p>
            </div>

            {selectedJobForTeamPayment.teamPaid ? (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                  <Check size={32} className="mx-auto text-blue-600 mb-2" />
                  <p className="font-medium text-blue-800">Team Already Paid</p>
                  <p className="text-sm text-blue-600 mt-1">
                    via {PAYMENT_METHODS.find(p => p.value === selectedJobForTeamPayment.assignments[0]?.paymentMethod)?.label || 'Unknown Method'}
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShowTeamPaymentModal(false)
                      setSelectedJobForTeamPayment(null)
                    }}
                  >
                    Close
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 text-red-600 hover:bg-red-50"
                    onClick={() => handleTeamPayment(selectedJobForTeamPayment.id, null)}
                  >
                    <X size={16} />
                    Clear Payment
                  </Button>
                </div>
              </>
            ) : (
              <>
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
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
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
                      setShowTeamPaymentModal(false)
                      setSelectedJobForTeamPayment(null)
                      setSelectedPaymentMethod('')
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={!selectedPaymentMethod}
                    onClick={() => handleTeamPayment(selectedJobForTeamPayment.id, selectedPaymentMethod)}
                  >
                    <Check size={16} />
                    Mark as Paid
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

interface JobModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: any) => void
  properties: Property[]
  teamMembers: TeamMember[]
  editingJob: Job | null
  preselectedDate?: string | null
}

function JobModal({ isOpen, onClose, onSave, properties, teamMembers, editingJob, preselectedDate }: JobModalProps) {
  const [formData, setFormData] = useState({
    propertyId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    priority: '5',
    rate: '',
    expensePercent: '12',
    teamMemberIds: [] as string[],
    completed: false,
  })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (editingJob) {
        setFormData({
          propertyId: editingJob.property.id,
          date: format(parseISO(editingJob.date), 'yyyy-MM-dd'),
          priority: editingJob.priority?.toString() || '5',
          rate: editingJob.rate.toString(),
          expensePercent: editingJob.expensePercent?.toString() || '12',
          teamMemberIds: editingJob.assignments.map(a => a.teamMember.id),
          completed: editingJob.completed,
        })
      } else {
        setFormData({
          propertyId: '',
          date: preselectedDate || format(new Date(), 'yyyy-MM-dd'),
          priority: '5',
          rate: '',
          expensePercent: '12',
          teamMemberIds: [],
          completed: false,
        })
      }
    }
  }, [isOpen, editingJob, preselectedDate])

  const handlePropertyChange = (propertyId: string) => {
    const property = properties.find((p) => p.id === propertyId)
    setFormData((prev) => ({
      ...prev,
      propertyId,
      rate: property ? property.baseRate.toString() : prev.rate,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      await onSave(formData)
    } finally {
      setIsSaving(false)
    }
  }

  const toggleTeamMember = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      teamMemberIds: prev.teamMemberIds.includes(id)
        ? prev.teamMemberIds.filter((i) => i !== id)
        : [...prev.teamMemberIds, id],
    }))
  }

  return (
    <Modal open={isOpen} onClose={onClose} title={editingJob ? 'Edit Job' : 'Schedule Job'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Property</label>
          <select
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={formData.propertyId}
            onChange={(e) => handlePropertyChange(e.target.value)}
            required
          >
            <option value="">Select a property</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Date"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <select
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
            >
              {PRIORITY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Rate"
            type="number"
            step="0.01"
            value={formData.rate}
            onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
            required
          />
          <Input
            label="Expense %"
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={formData.expensePercent}
            onChange={(e) => setFormData({ ...formData, expensePercent: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Assign Team</label>
          <div className="flex flex-wrap gap-2">
            {teamMembers.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => toggleTeamMember(member.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  formData.teamMemberIds.includes(member.id)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {member.name}
              </button>
            ))}
            {teamMembers.length === 0 && (
              <p className="text-sm text-gray-500">No team members yet</p>
            )}
          </div>
        </div>

        {editingJob && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.completed}
              onChange={(e) => setFormData({ ...formData, completed: e.target.checked })}
              className="w-4 h-4 text-green-600 rounded"
            />
            <span className="text-sm font-medium text-gray-700">Mark as completed</span>
          </label>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSaving}>
            {editingJob ? 'Save Changes' : 'Schedule Job'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

interface ScheduleModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: Record<string, unknown>) => void
  schedule: Schedule | null
  properties: Property[]
}

function ScheduleModal({ isOpen, onClose, onSave, schedule, properties }: ScheduleModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    propertyId: '',
    frequency: 'weekly',
    dayOfWeek: '1',
    dayOfMonth: '1',
    time: '',
    rate: '',
    expensePercent: '12',
    generateAheadDays: '30',
  })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (schedule) {
        setFormData({
          name: schedule.name,
          propertyId: schedule.propertyId,
          frequency: schedule.frequency,
          dayOfWeek: schedule.dayOfWeek?.toString() || '1',
          dayOfMonth: schedule.dayOfMonth?.toString() || '1',
          time: schedule.time || '',
          rate: schedule.rate?.toString() || '',
          expensePercent: schedule.expensePercent.toString(),
          generateAheadDays: schedule.generateAheadDays.toString(),
        })
      } else {
        setFormData({
          name: '',
          propertyId: '',
          frequency: 'weekly',
          dayOfWeek: '1',
          dayOfMonth: '1',
          time: '',
          rate: '',
          expensePercent: '12',
          generateAheadDays: '30',
        })
      }
    }
  }, [schedule, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      await onSave(formData)
    } finally {
      setIsSaving(false)
    }
  }

  const selectedProperty = properties.find(p => p.id === formData.propertyId)

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={schedule ? 'Edit Schedule' : 'Add Recurring Schedule'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Schedule Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Weekly Deep Clean"
          required
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Property</label>
          <select
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={formData.propertyId}
            onChange={(e) => setFormData({ ...formData, propertyId: e.target.value })}
            required
            disabled={!!schedule}
          >
            <option value="">Select a property</option>
            {properties.map(p => (
              <option key={p.id} value={p.id}>{`${p.name} (${formatCurrency(p.baseRate)})`}</option>
            ))}
          </select>
        </div>

        <div className="border-t pt-4">
          <h4 className="font-medium text-gray-900 mb-3">Schedule Pattern</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
              <select
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
              >
                {FREQUENCIES.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {(formData.frequency === 'weekly' || formData.frequency === 'biweekly') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Day of Week</label>
                <select
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={formData.dayOfWeek}
                  onChange={(e) => setFormData({ ...formData, dayOfWeek: e.target.value })}
                >
                  {DAYS_OF_WEEK.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            )}

            {formData.frequency === 'monthly' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Day of Month</label>
                <select
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={formData.dayOfMonth}
                  onChange={(e) => setFormData({ ...formData, dayOfMonth: e.target.value })}
                >
                  {Array.from({ length: 31 }, (_, i) => (
                    <option key={String(i + 1)} value={String(i + 1)}>{String(i + 1)}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="mt-4">
            <Input
              label="Time (optional)"
              value={formData.time}
              onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              placeholder="9:00 AM"
            />
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className="font-medium text-gray-900 mb-3">Job Settings</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Rate (optional)"
              type="number"
              step="0.01"
              value={formData.rate}
              onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
              placeholder={selectedProperty ? selectedProperty.baseRate.toString() : 'Property rate'}
            />
            <Input
              label="Expense %"
              type="number"
              value={formData.expensePercent}
              onChange={(e) => setFormData({ ...formData, expensePercent: e.target.value })}
            />
            <Input
              label="Generate Ahead (days)"
              type="number"
              value={formData.generateAheadDays}
              onChange={(e) => setFormData({ ...formData, generateAheadDays: e.target.value })}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Jobs will be auto-generated up to {formData.generateAheadDays} days in advance.
            {!formData.rate && selectedProperty && ` Using property rate: ${formatCurrency(selectedProperty.baseRate)}`}
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSaving}>
            {schedule ? 'Save Changes' : 'Add Schedule'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
