'use client'

import { useEffect, useState } from 'react'
import { Users, Plus, Phone, Mail, User, Key, Check, DollarSign, Trash2, Pencil, RefreshCw, Eye, EyeOff, Shield, Star, TrendingUp } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import v1Fetch from '@/lib/v1-compat'
import { formatCurrency, cn } from '@/lib/utils'

function toast(msg: string, type: 'success' | 'error' = 'success') {
  const div = document.createElement('div')
  div.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-white text-sm ${type === 'error' ? 'bg-red-600' : 'bg-green-600'}`
  div.textContent = msg
  document.body.appendChild(div)
  setTimeout(() => div.remove(), 3000)
}

interface TeamMember {
  id: string
  name: string
  email: string | null
  phone: string | null
  role: string
  isActive: boolean
  hasPassword?: boolean
  // Supervisor fields
  rank?: number
  canSupervise?: boolean
  // Performance metrics
  avgRating?: number | null
  totalRatings?: number
  reliabilityScore?: number | null
}

export default function TeamPage() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [passwordMember, setPasswordMember] = useState<TeamMember | null>(null)
  const [showInactive, setShowInactive] = useState(false)

  useEffect(() => {
    fetchTeamMembers()
  }, [showInactive])

  const fetchTeamMembers = async () => {
    try {
      const url = showInactive ? '/api/team?includeInactive=true' : '/api/team'
      const response = await v1Fetch(url)
      if (response.ok) {
        const data = await response.json()
        setTeamMembers(data)
      }
    } catch (error) {
      console.error('Failed to fetch team:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAdd = () => {
    setEditingMember(null)
    setShowModal(true)
  }

  const handleEdit = (member: TeamMember) => {
    setEditingMember(member)
    setShowModal(true)
  }

  const handleSetPassword = (member: TeamMember, e: React.MouseEvent) => {
    e.stopPropagation()
    setPasswordMember(member)
    setShowPasswordModal(true)
  }

  const handleSave = async (data: Partial<TeamMember>) => {
    try {
      const url = editingMember ? `/api/team/${editingMember.id}` : '/api/team'
      const method = editingMember ? 'PUT' : 'POST'

      const response = await v1Fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        toast(editingMember ? 'Team member updated' : 'Team member added')
        setShowModal(false)
        fetchTeamMembers()
      } else {
        const errorData = await response.json()
        toast(errorData.error || 'Failed to save team member', 'error')
      }
    } catch (error) {
      toast('Failed to save team member', 'error')
    }
  }

  const handleSavePassword = async (password: string) => {
    if (!passwordMember) return

    try {
      const response = await v1Fetch(`/api/team/${passwordMember.id}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (response.ok) {
        toast(`Password set for ${passwordMember.name}`)
        setShowPasswordModal(false)
        setPasswordMember(null)
        fetchTeamMembers()
      } else {
        const error = await response.json()
        toast(error.error || 'Failed to set password', 'error')
      }
    } catch (error) {
      toast('Failed to set password', 'error')
    }
  }

  const handleDelete = async (member: TeamMember, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Remove ${member.name} from the team?`)) return

    try {
      const response = await v1Fetch(`/api/team/${member.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast(`${member.name} removed from team`)
        fetchTeamMembers()
      } else {
        toast('Failed to remove team member', 'error')
      }
    } catch (error) {
      toast('Failed to remove team member', 'error')
    }
  }

  const handleReactivate = async (member: TeamMember, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Reactivate ${member.name}?`)) return

    try {
      const response = await v1Fetch(`/api/team/${member.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...member, isActive: true }),
      })

      if (response.ok) {
        toast(`${member.name} has been reactivated`)
        fetchTeamMembers()
      } else {
        toast('Failed to reactivate team member', 'error')
      }
    } catch (error) {
      toast('Failed to reactivate team member', 'error')
    }
  }

  return (
    <div className="min-h-screen">
      <PageHeader title="Team" />

      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {teamMembers.filter(m => m.isActive).length} Active Team Member{teamMembers.filter(m => m.isActive).length !== 1 && 's'}
            </h3>
            <button
              onClick={() => setShowInactive(!showInactive)}
              className={cn(
                'flex items-center gap-2 text-sm px-3 py-1.5 rounded-full transition-colors',
                showInactive
                  ? 'bg-gray-200 text-gray-700'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              )}
            >
              {showInactive ? <EyeOff size={14} /> : <Eye size={14} />}
              {showInactive ? 'Hide Inactive' : 'Show Inactive'}
            </button>
          </div>
          <Button onClick={handleAdd}>
            <Plus size={16} />
            Add Team Member
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : teamMembers.length === 0 ? (
          <Card>
            <CardContent>
              <EmptyState
                icon={<Users size={40} />}
                title="No team members yet"
                description="Add your team members to start assigning jobs."
                actionLabel="Add Team Member"
                onAction={handleAdd}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teamMembers.map((member) => (
              <Card
                key={member.id}
                className={cn(
                  'hover:shadow-md transition-shadow cursor-pointer',
                  !member.isActive && 'opacity-60 bg-gray-50'
                )}
                onClick={() => member.isActive && handleEdit(member)}
              >
                <CardContent>
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      'w-12 h-12 rounded-full flex items-center justify-center',
                      member.isActive ? 'bg-blue-100' : 'bg-gray-200'
                    )}>
                      <User className={member.isActive ? 'text-blue-600' : 'text-gray-400'} size={24} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className={cn('font-semibold', member.isActive ? 'text-gray-900' : 'text-gray-500')}>
                          {member.name}
                        </h4>
                        {!member.isActive && (
                          <Badge variant="default">Inactive</Badge>
                        )}
                        <Badge variant={member.role === 'admin' ? 'purple' : 'info'}>
                          {member.role}
                        </Badge>
                        {member.canSupervise && (
                          <Badge variant="warning" className="gap-1">
                            <Shield size={10} />
                            Supervisor
                          </Badge>
                        )}
                      </div>

                      {/* Rank and Performance Stats */}
                      {member.isActive && (
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          <div className="flex items-center gap-1" title="Team Rank (1-100)">
                            <TrendingUp size={12} />
                            <span>Rank: {member.rank ?? 50}</span>
                          </div>
                          {member.avgRating && (
                            <div className="flex items-center gap-1" title={`Based on ${member.totalRatings} ratings`}>
                              <Star size={12} className="text-amber-500" />
                              <span>{member.avgRating.toFixed(1)}</span>
                            </div>
                          )}
                          {member.reliabilityScore !== undefined && member.reliabilityScore !== null && (
                            <div className="flex items-center gap-1" title="Attendance Reliability">
                              <Check size={12} className={member.reliabilityScore >= 90 ? 'text-green-500' : member.reliabilityScore >= 70 ? 'text-amber-500' : 'text-red-500'} />
                              <span>{Math.round(member.reliabilityScore)}%</span>
                            </div>
                          )}
                        </div>
                      )}

                      {member.phone && (
                        <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
                          <Phone size={14} />
                          {member.phone}
                        </div>
                      )}
                      {member.email && (
                        <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                          <Mail size={14} />
                          {member.email}
                        </div>
                      )}

                      {/* Login Status - only for active members */}
                      {member.isActive && member.email && (
                        <div className="mt-3 pt-3 border-t">
                          {member.hasPassword ? (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-sm text-green-600">
                                <Check size={14} />
                                <span>Login enabled</span>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => handleSetPassword(member, e)}
                                className="text-gray-500 hover:text-gray-700"
                              >
                                <Key size={14} />
                                Reset
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => handleSetPassword(member, e)}
                            >
                              <Key size={14} />
                              Set Password
                            </Button>
                          )}
                        </div>
                      )}
                      {member.isActive && !member.email && (
                        <p className="mt-3 pt-3 border-t text-xs text-gray-400">
                          Add email to enable login
                        </p>
                      )}

                      {/* View Pay Button for Workers - only for active */}
                      {member.isActive && member.role === 'worker' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="mt-2 w-full justify-start text-gray-600"
                          onClick={(e) => {
                            e.stopPropagation()
                            window.location.href = `/team/${member.id}/pay`
                          }}
                        >
                          <DollarSign size={14} />
                          View Pay History
                        </Button>
                      )}

                      {/* Action Buttons */}
                      <div className="mt-3 pt-3 border-t flex gap-2">
                        {member.isActive ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEdit(member)
                              }}
                            >
                              <Pencil size={14} />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:bg-red-50"
                              onClick={(e) => handleDelete(member, e)}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-green-600 hover:bg-green-50"
                            onClick={(e) => handleReactivate(member, e)}
                          >
                            <RefreshCw size={14} />
                            Reactivate
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <TeamMemberModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
        member={editingMember}
      />

      <SetPasswordModal
        open={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false)
          setPasswordMember(null)
        }}
        onSave={handleSavePassword}
        memberName={passwordMember?.name || ''}
      />
    </div>
  )
}

interface TeamMemberModalProps {
  open: boolean
  onClose: () => void
  onSave: (data: Partial<TeamMember>) => void
  member: TeamMember | null
}

function TeamMemberModal({ open, onClose, onSave, member }: TeamMemberModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'worker',
    rank: 50,
    canSupervise: false,
  })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (member) {
      setFormData({
        name: member.name,
        email: member.email || '',
        phone: member.phone || '',
        role: member.role,
        rank: member.rank ?? 50,
        canSupervise: member.canSupervise ?? false,
      })
    } else {
      setFormData({
        name: '',
        email: '',
        phone: '',
        role: 'worker',
        rank: 50,
        canSupervise: false,
      })
    }
  }, [member, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      await onSave(formData)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={member ? 'Edit Team Member' : 'Add Team Member'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Jane Doe"
          required
        />

        <Input
          label="Phone"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          placeholder="(555) 123-4567"
        />

        <Input
          label="Email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          placeholder="jane@example.com"
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <select
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="worker">Team Member</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        {/* Supervisor Settings */}
        <div className="border-t pt-4 mt-4">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Shield size={16} className="text-amber-500" />
            Supervisor Settings
          </h4>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Team Rank (1-100)
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={formData.rank}
                onChange={(e) => setFormData({ ...formData, rank: parseInt(e.target.value) || 50 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Higher = more senior. Owner/admin should be 100.</p>
            </div>

            <div className="flex flex-col">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Can Supervise
              </label>
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.canSupervise}
                  onChange={(e) => setFormData({ ...formData, canSupervise: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Enable supervisor tools</span>
              </label>
              <p className="text-xs text-gray-500 mt-1">Can mark absences and rate team.</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSaving}>
            {member ? 'Save Changes' : 'Add Team Member'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

interface SetPasswordModalProps {
  open: boolean
  onClose: () => void
  onSave: (password: string) => void
  memberName: string
}

function SetPasswordModal({ open, onClose, onSave, memberName }: SetPasswordModalProps) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setPassword('')
      setConfirmPassword('')
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password.length < 6) {
      toast('Password must be at least 6 characters', 'error')
      return
    }

    if (password !== confirmPassword) {
      toast('Passwords do not match', 'error')
      return
    }

    setIsSaving(true)
    try {
      await onSave(password)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Set Password for ${memberName}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-600">
          Set a password to allow this team member to log in to the team portal.
        </p>

        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password"
          required
        />

        <Input
          label="Confirm Password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm password"
          required
        />

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSaving}>
            <Key size={16} />
            Set Password
          </Button>
        </div>
      </form>
    </Modal>
  )
}
