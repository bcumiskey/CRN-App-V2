'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  StickyNote,
  Plus,
  AlertCircle,
  Bell,
  User,
  Info,
  CheckCircle,
  AlertTriangle,
  Building,
  Filter,
  Image,
  X,
  Send,
  Eye,
  ChevronDown,
  ChevronUp,
  Trash2,
  Camera,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import v1Fetch from '@/lib/v1-compat'

function toast(msg: string, type: 'success' | 'error' = 'success') {
  const div = document.createElement('div')
  div.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-white text-sm ${type === 'error' ? 'bg-red-600' : 'bg-green-600'}`
  div.textContent = msg; document.body.appendChild(div); setTimeout(() => div.remove(), 3000)
}

interface NotePhoto {
  id: string
  url: string
  caption?: string
}

interface PropertyNote {
  id: string
  type: string
  title?: string
  content: string
  severity?: string
  status: string
  estimatedCost?: number
  ownerNotified: boolean
  ownerNotifiedAt?: string
  resolution?: string
  createdAt: string
  property: { id: string; name: string; address: string }
  addedBy: { id: string; name: string }
  resolvedBy?: { id: string; name: string }
  photos: NotePhoto[]
}

interface Property {
  id: string
  name: string
}

const noteConfig: Record<string, { bg: string; border: string; text: string; icon: typeof AlertCircle; label: string }> = {
  damage: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700', icon: AlertTriangle, label: 'Damage' },
  issue: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', icon: AlertCircle, label: 'Issue' },
  reminder: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: Bell, label: 'Reminder' },
  owner_request: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', icon: User, label: 'Owner Request' },
  info: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: Info, label: 'Info' },
}

export default function NotesPage() {
  const [notes, setNotes] = useState<PropertyNote[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProperty, setSelectedProperty] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('active')
  const [showAddNote, setShowAddNote] = useState(false)
  const [expandedNote, setExpandedNote] = useState<string | null>(null)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)

  // Add note form state
  const [newNote, setNewNote] = useState({
    propertyId: '',
    type: 'issue',
    title: '',
    content: '',
    severity: '',
    estimatedCost: '',
  })
  const [uploadedPhotos, setUploadedPhotos] = useState<{ url: string; caption: string }[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const fetchNotes = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (selectedProperty) params.append('propertyId', selectedProperty)
      if (statusFilter === 'all') {
        params.append('includeResolved', 'true')
      } else if (statusFilter) {
        params.append('status', statusFilter)
      }

      const response = await v1Fetch(`/api/notes?${params}`)
      if (response.ok) {
        setNotes(await response.json())
      }
    } catch (error) {
      console.error('Failed to fetch notes:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedProperty, statusFilter])

  const fetchProperties = async () => {
    try {
      const response = await v1Fetch('/api/properties')
      if (response.ok) {
        const data = await response.json()
        setProperties(data.map((p: Property) => ({ id: p.id, name: p.name })))
      }
    } catch (error) {
      console.error('Failed to fetch properties:', error)
    }
  }

  useEffect(() => {
    fetchProperties()
  }, [])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  const handleResolve = async (noteId: string, resolution?: string) => {
    try {
      const response = await v1Fetch(`/api/notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved', resolution }),
      })
      if (response.ok) {
        fetchNotes()
      }
    } catch (error) {
      console.error('Failed to resolve note:', error)
    }
  }

  const handleNotifyOwner = async (noteId: string) => {
    try {
      const response = await v1Fetch(`/api/notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerNotified: true }),
      })
      if (response.ok) {
        fetchNotes()
      }
    } catch (error) {
      console.error('Failed to update note:', error)
    }
  }

  const handleDelete = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return
    try {
      const response = await v1Fetch(`/api/notes/${noteId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        fetchNotes()
      }
    } catch (error) {
      console.error('Failed to delete note:', error)
    }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('folder', 'notes')

        const response = await v1Fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        if (response.ok) {
          const { url } = await response.json()
          setUploadedPhotos((prev) => [...prev, { url, caption: '' }])
        }
      }
    } catch (error) {
      console.error('Upload failed:', error)
    } finally {
      setIsUploading(false)
    }
  }

  const handleSubmitNote = async () => {
    if (!newNote.propertyId || !newNote.content.trim()) return

    setIsSubmitting(true)
    try {
      const response = await v1Fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newNote,
          photos: uploadedPhotos,
        }),
      })

      if (response.ok) {
        setNewNote({
          propertyId: '',
          type: 'issue',
          title: '',
          content: '',
          severity: '',
          estimatedCost: '',
        })
        setUploadedPhotos([])
        setShowAddNote(false)
        fetchNotes()
      }
    } catch (error) {
      console.error('Failed to create note:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const activeNotes = notes.filter((n) => n.status === 'active' || n.status === 'reported_to_owner')
  const resolvedNotes = notes.filter((n) => n.status === 'resolved')

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Notes & Incidents"
        actions={
          <Button onClick={() => setShowAddNote(true)}>
            <Plus size={20} className="mr-2" />
            Add Note
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Filters */}
        <Card>
          <CardContent className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Building size={20} className="text-gray-400" />
              <select
                value={selectedProperty}
                onChange={(e) => setSelectedProperty(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">All Properties</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Filter size={20} className="text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="active">Active Only</option>
                <option value="resolved">Resolved Only</option>
                <option value="all">All Notes</option>
              </select>
            </div>

            <div className="ml-auto text-sm text-gray-500">
              {notes.length} note{notes.length !== 1 && 's'}
            </div>
          </CardContent>
        </Card>

        {/* Add Note Modal */}
        {showAddNote && (
          <Card className="border-2 border-emerald-500">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Add New Note</span>
                <button onClick={() => setShowAddNote(false)} className="p-1 hover:bg-gray-100 rounded">
                  <X size={20} />
                </button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Property *</label>
                  <select
                    value={newNote.propertyId}
                    onChange={(e) => setNewNote({ ...newNote, propertyId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select property...</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                  <select
                    value={newNote.type}
                    onChange={(e) => setNewNote({ ...newNote, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="damage">Damage</option>
                    <option value="issue">Issue</option>
                    <option value="reminder">Reminder</option>
                    <option value="owner_request">Owner Request</option>
                    <option value="info">Info</option>
                  </select>
                </div>
              </div>

              {(newNote.type === 'damage' || newNote.type === 'issue') && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
                    <select
                      value={newNote.severity}
                      onChange={(e) => setNewNote({ ...newNote, severity: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Select...</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <Input
                    label="Estimated Cost"
                    type="number"
                    value={newNote.estimatedCost}
                    onChange={(e) => setNewNote({ ...newNote, estimatedCost: e.target.value })}
                    placeholder="$0.00"
                  />
                </div>
              )}

              <Input
                label="Title (optional)"
                value={newNote.title}
                onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                placeholder="Brief summary..."
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea
                  value={newNote.content}
                  onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Describe the issue or note in detail..."
                />
              </div>

              {/* Photo Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Photos</label>
                {uploadedPhotos.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {uploadedPhotos.map((photo, idx) => (
                      <div key={idx} className="relative">
                        <img src={photo.url} alt={`Upload ${idx + 1}`} className="w-full h-20 object-cover rounded-lg" />
                        <button
                          type="button"
                          onClick={() => setUploadedPhotos((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-emerald-500 hover:bg-emerald-50 transition-colors">
                  {isUploading ? (
                    <span className="text-gray-500">Uploading...</span>
                  ) : (
                    <>
                      <Camera size={20} className="text-gray-400" />
                      <span className="text-gray-600">Add photos</span>
                    </>
                  )}
                  <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" disabled={isUploading} />
                </label>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowAddNote(false)}>Cancel</Button>
                <Button onClick={handleSubmitNote} disabled={!newNote.propertyId || !newNote.content.trim() || isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Note'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notes List */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : notes.length === 0 ? (
          <Card>
            <CardContent>
              <EmptyState
                icon={<StickyNote size={40} />}
                title="No notes found"
                description={selectedProperty || statusFilter !== 'active' ? 'Try adjusting your filters.' : 'Notes will appear here when added to properties.'}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Show active notes */}
            {(statusFilter === 'active' || statusFilter === 'all') && activeNotes.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle size={20} className="text-amber-500" />
                    Active Notes ({activeNotes.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {activeNotes.map((note) => {
                    const config = noteConfig[note.type] || noteConfig.info
                    const Icon = config.icon
                    const isExpanded = expandedNote === note.id

                    return (
                      <div
                        key={note.id}
                        className={cn('p-4 rounded-xl border-2', config.bg, config.border)}
                      >
                        <div className="flex items-start gap-4">
                          <div className={cn('w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0', config.bg)}>
                            <Icon size={24} className={config.text} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-semibold text-gray-900">{note.property.name}</span>
                              <span className={cn('px-2 py-0.5 rounded text-xs font-medium', config.text, config.bg)}>
                                {config.label}
                              </span>
                              {note.severity && (
                                <span className={cn(
                                  'px-2 py-0.5 rounded text-xs font-medium',
                                  note.severity === 'high' ? 'bg-red-100 text-red-700' :
                                  note.severity === 'medium' ? 'bg-amber-100 text-amber-700' :
                                  'bg-green-100 text-green-700'
                                )}>
                                  {note.severity}
                                </span>
                              )}
                              {note.ownerNotified && (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                                  Owner Notified
                                </span>
                              )}
                              {note.photos.length > 0 && (
                                <span className="flex items-center gap-1 text-xs text-gray-500">
                                  <Image size={12} /> {note.photos.length}
                                </span>
                              )}
                            </div>
                            {note.title && <p className="font-medium text-gray-900 mb-1">{note.title}</p>}
                            <p className="text-gray-700">{note.content}</p>
                            {note.estimatedCost && (
                              <p className="text-sm text-gray-600 mt-1">
                                Estimated cost: <span className="font-medium">${note.estimatedCost.toFixed(2)}</span>
                              </p>
                            )}

                            {/* Photos */}
                            {note.photos.length > 0 && (
                              <div className="grid grid-cols-4 gap-2 mt-3">
                                {note.photos.map((photo) => (
                                  <img
                                    key={photo.id}
                                    src={photo.url}
                                    alt="Evidence"
                                    className="w-full h-16 object-cover rounded-lg cursor-pointer hover:opacity-80"
                                    onClick={() => setLightboxImage(photo.url)}
                                  />
                                ))}
                              </div>
                            )}

                            <p className="text-xs text-gray-500 mt-2">
                              Added by {note.addedBy.name} &bull; {format(new Date(note.createdAt), 'MMM d, yyyy h:mm a')}
                            </p>
                          </div>

                          <div className="flex flex-col gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleResolve(note.id)}
                              className="text-green-600 border-green-200 hover:bg-green-50"
                            >
                              <CheckCircle size={16} className="mr-1" />
                              Resolve
                            </Button>
                            {!note.ownerNotified && (note.type === 'damage' || note.type === 'issue') && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleNotifyOwner(note.id)}
                                className="text-blue-600 border-blue-200 hover:bg-blue-50"
                              >
                                <Send size={16} className="mr-1" />
                                Report
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(note.id)}
                              className="text-red-600 hover:bg-red-50"
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )}

            {/* Show resolved notes */}
            {(statusFilter === 'resolved' || statusFilter === 'all') && resolvedNotes.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-500">
                    <CheckCircle size={20} />
                    Resolved ({resolvedNotes.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {resolvedNotes.map((note) => (
                    <div key={note.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 text-sm mb-1">
                            <span className="font-medium text-gray-700">{note.property.name}</span>
                            <span className="text-gray-400">&bull;</span>
                            <span className="text-gray-500 capitalize">{note.type.replace('_', ' ')}</span>
                          </div>
                          {note.title && <p className="text-sm text-gray-600 line-through">{note.title}</p>}
                          <p className="text-sm text-gray-500 line-through">{note.content}</p>
                          {note.resolution && (
                            <p className="text-xs text-green-600 mt-1">Resolution: {note.resolution}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            {format(new Date(note.createdAt), 'MMM d, yyyy')}
                            {note.resolvedBy && ` \u2022 Resolved by ${note.resolvedBy.name}`}
                          </p>
                        </div>
                        {note.photos.length > 0 && (
                          <div className="flex gap-1">
                            {note.photos.slice(0, 2).map((photo) => (
                              <img
                                key={photo.id}
                                src={photo.url}
                                alt="Evidence"
                                className="w-10 h-10 object-cover rounded cursor-pointer opacity-60 hover:opacity-100"
                                onClick={() => setLightboxImage(photo.url)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Image Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300"
            onClick={() => setLightboxImage(null)}
          >
            <X size={32} />
          </button>
          <img
            src={lightboxImage}
            alt="Full size"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
