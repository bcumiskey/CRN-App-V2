'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns'
import { ChevronLeft, ChevronRight, RefreshCw, Settings, Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import v1Fetch from '@/lib/v1-compat'

function toast(msg: string, type: 'success' | 'error' = 'success') {
  const div = document.createElement('div')
  div.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-white text-sm ${type === 'error' ? 'bg-red-600' : 'bg-green-600'}`
  div.textContent = msg
  document.body.appendChild(div)
  setTimeout(() => div.remove(), 3000)
}

interface Job {
  id: string
  date: string
  time: string | null
  completed: boolean
  source: string
  property: { name: string; color: string | null }
  assignments?: { teamMember: { name: string } }[]
}

interface HoverPreview {
  day: Date
  jobs: Job[]
  x: number
  y: number
}

function generateColor(name: string): string {
  const colors = ['#3B82F6','#10B981','#8B5CF6','#EC4899','#6366F1','#14B8A6','#F97316','#06B6D4','#EF4444','#84CC16','#A855F7','#F59E0B']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export default function CalendarPage() {
  const router = useRouter()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [jobs, setJobs] = useState<Job[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [hoverPreview, setHoverPreview] = useState<HoverPreview | null>(null)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleDateClick = (date: Date) => {
    router.push(`/jobs?newJob=true&date=${format(date, 'yyyy-MM-dd')}`)
  }

  const handleDayHover = useCallback((e: React.MouseEvent, day: Date, dayJobs: Job[]) => {
    if (dayJobs.length === 0) return
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    hoverTimeoutRef.current = setTimeout(() => {
      setHoverPreview({ day, jobs: dayJobs, x: rect.left + rect.width / 2, y: rect.bottom + 8 })
    }, 2000)
  }, [])

  const handleDayLeave = useCallback(() => {
    if (hoverTimeoutRef.current) { clearTimeout(hoverTimeoutRef.current); hoverTimeoutRef.current = null }
    setHoverPreview(null)
  }, [])

  useEffect(() => { fetchJobs() }, [currentMonth])

  const fetchJobs = async () => {
    try {
      const month = currentMonth.getMonth() + 1
      const year = currentMonth.getFullYear()
      const response = await v1Fetch(`/api/jobs?month=${month}&year=${year}`)
      if (response.ok) setJobs(await response.json())
    } catch (error) {
      console.error('Failed to fetch jobs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSyncCalendars = async () => {
    setIsSyncing(true)
    try {
      const [calendarRes, recurringRes] = await Promise.allSettled([
        v1Fetch('/api/calendar-sources/sync-all', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }),
        v1Fetch('/api/recurring-schedules/generate', { method: 'POST' }),
      ])
      const messages: string[] = []
      if (calendarRes.status === 'fulfilled' && calendarRes.value.ok) {
        const data = await calendarRes.value.json()
        const created = data.summary?.jobsCreated || data.eventsCreated || 0
        if (created > 0) messages.push(`${created} from calendars`)
      }
      if (recurringRes.status === 'fulfilled' && recurringRes.value.ok) {
        const data = await recurringRes.value.json()
        if ((data.totalJobsCreated || 0) > 0) messages.push(`${data.totalJobsCreated} from schedules`)
      }
      if (messages.length > 0) { toast(`Created: ${messages.join(', ')}`); fetchJobs() }
      else toast('Calendars are up to date')
    } catch { toast('Failed to sync', 'error') }
    finally { setIsSyncing(false) }
  }

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startDay = monthStart.getDay()
  const paddedDays = [...Array(startDay).fill(null), ...days]

  const getJobsForDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return jobs.filter((job) => job.date === dateStr)
  }

  const getJobColorStyle = (job: Job) => {
    const baseColor = job.property.color || generateColor(job.property.name)
    return {
      backgroundColor: job.completed ? `${baseColor}30` : `${baseColor}20`,
      color: baseColor,
      borderLeft: `3px solid ${baseColor}`,
    }
  }

  return (
    <div className="min-h-screen">
      <div className="p-6">
        <PageHeader title="Calendar" />

        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-500">Click any date to add a job.</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => router.push('/jobs?newJob=true')}>
              <Plus size={16} /> Add Job
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push('/calendar-sync')}>
              <Settings size={16} /> Calendar Sources
            </Button>
            <Button variant="outline" size="sm" onClick={handleSyncCalendars} loading={isSyncing}>
              <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} /> Sync Calendars
            </Button>
          </div>
        </div>

        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-6">
              <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-gray-100 rounded-lg">
                <ChevronLeft size={20} />
              </button>
              <h2 className="text-xl font-semibold">{format(currentMonth, 'MMMM yyyy')}</h2>
              <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-gray-100 rounded-lg">
                <ChevronRight size={20} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
                <div key={d} className="bg-gray-50 p-3 text-center text-sm font-medium text-gray-500">{d}</div>
              ))}

              {paddedDays.map((day, i) => {
                if (!day) return <div key={`e-${i}`} className="bg-white p-2 min-h-[100px]" />
                const dayJobs = getJobsForDay(day)
                const isToday = isSameDay(day, new Date())
                return (
                  <div
                    key={day.toISOString()}
                    onClick={() => handleDateClick(day)}
                    onMouseEnter={(e) => handleDayHover(e, day, dayJobs)}
                    onMouseLeave={handleDayLeave}
                    className={cn('bg-white p-2 min-h-[100px] cursor-pointer hover:bg-gray-50 transition-colors', isToday && 'bg-blue-50 hover:bg-blue-100')}
                  >
                    <div className={cn('text-sm font-medium mb-1', isToday ? 'text-blue-600' : 'text-gray-900')}>{format(day, 'd')}</div>
                    <div className="space-y-1">
                      {dayJobs.slice(0, 3).map((job) => (
                        <div
                          key={job.id}
                          onClick={(e) => { e.stopPropagation(); router.push(`/jobs?highlight=${job.id}`) }}
                          className="text-xs p-1 rounded truncate cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
                          style={getJobColorStyle(job)}
                        >
                          {job.completed && <span className="opacity-60">✓ </span>}
                          {job.time && <span className="font-medium">{job.time} </span>}
                          {job.property.name}
                          {job.assignments && job.assignments.length > 0 && (
                            <div className="text-[10px] opacity-70 truncate">
                              {job.assignments.map(a => a.teamMember.name.split(' ')[0]).join(', ')}
                            </div>
                          )}
                        </div>
                      ))}
                      {dayJobs.length > 3 && <div className="text-xs text-gray-500">+{dayJobs.length - 3} more</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {hoverPreview && (
          <div
            className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-3 min-w-[200px] max-w-[300px]"
            style={{ left: `${hoverPreview.x}px`, top: `${hoverPreview.y}px`, transform: 'translateX(-50%)' }}
            onMouseEnter={() => { if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current) }}
            onMouseLeave={handleDayLeave}
          >
            <div className="text-sm font-semibold text-gray-900 mb-2 border-b pb-2">{format(hoverPreview.day, 'EEEE, MMMM d')}</div>
            <div className="space-y-2">
              {hoverPreview.jobs.map((job) => (
                <div
                  key={job.id}
                  className="p-2 rounded text-sm cursor-pointer hover:ring-2 hover:ring-blue-400"
                  style={getJobColorStyle(job)}
                  onClick={() => router.push(`/jobs?highlight=${job.id}`)}
                >
                  <div className="font-medium">{job.completed && <span className="opacity-60">✓ </span>}{job.property.name}</div>
                  {job.time && <div className="text-xs opacity-75">{job.time}</div>}
                  {job.assignments && job.assignments.length > 0 && (
                    <div className="text-xs opacity-75">Team: {job.assignments.map(a => a.teamMember.name).join(', ')}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
