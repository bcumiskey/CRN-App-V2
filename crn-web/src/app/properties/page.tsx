'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building, MapPin, Plus, User, Phone, Mail, Pencil, Trash2, Eye, EyeOff } from 'lucide-react'
import Image from 'next/image'
import v1Fetch from '@/lib/v1-compat'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency, cn } from '@/lib/utils'

function toast(msg: string, type: 'success' | 'error' = 'success') {
  const div = document.createElement('div')
  div.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-white text-sm ${type === 'error' ? 'bg-red-600' : 'bg-green-600'}`
  div.textContent = msg
  document.body.appendChild(div)
  setTimeout(() => div.remove(), 3000)
}

interface Property {
  id: string
  name: string
  address: string
  isActive: boolean
  ownerId: string | null
  ownerName: string
  ownerEmail: string | null
  ownerPhone: string | null
  baseRate: number
  expensePercent: number
  billingType: string
  imageUrl: string | null
  notes: { id: string }[]
}

export default function PropertiesPage() {
  const router = useRouter()
  const [properties, setProperties] = useState<Property[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showInactive, setShowInactive] = useState(false)

  useEffect(() => {
    fetchProperties()
  }, [showInactive])

  const fetchProperties = async () => {
    try {
      const url = showInactive ? '/api/properties?includeInactive=true' : '/api/properties'
      const response = await v1Fetch(url)
      if (response.ok) {
        const data = await response.json()
        setProperties(data)
      }
    } catch (error) {
      console.error('Failed to fetch properties:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAdd = () => {
    router.push('/properties/new')
  }

  const handleEdit = (propertyId: string) => {
    router.push(`/properties/${propertyId}`)
  }

  const handleDelete = async (property: Property, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Delete "${property.name}"? This will also delete all associated jobs and invoices.`)) return

    try {
      const response = await v1Fetch(`/api/properties/${property.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast(`${property.name} deleted`)
        fetchProperties()
      } else {
        toast('Failed to delete property', 'error')
      }
    } catch (error) {
      toast('Failed to delete property', 'error')
    }
  }

  return (
    <div className="min-h-screen">
      <PageHeader title="Properties" />

      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {properties.filter(p => p.isActive).length} Active Properties
            </h3>
            <button
              onClick={() => setShowInactive(!showInactive)}
              className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-full transition-colors ${
                showInactive
                  ? 'bg-gray-200 text-gray-700'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {showInactive ? <EyeOff size={14} /> : <Eye size={14} />}
              {showInactive ? 'Hide Inactive' : 'Show Inactive'}
            </button>
          </div>
          <Button onClick={handleAdd}>
            <Plus size={16} />
            Add Property
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : properties.length === 0 ? (
          <Card>
            <CardContent>
              <EmptyState
                icon={<Building size={40} />}
                title="No properties yet"
                description="Add your first property to start managing jobs and invoices."
                actionLabel="Add Property"
                onAction={handleAdd}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {properties.map((property) => (
              <Card
                key={property.id}
                className={`hover:shadow-md transition-shadow cursor-pointer overflow-hidden ${
                  !property.isActive ? 'opacity-60 bg-gray-50' : ''
                }`}
                onClick={() => handleEdit(property.id)}
              >
                {/* Property Image — V1 used Vercel Blob URLs which won't load; show placeholder stripe */}
                {property.imageUrl ? (
                  <div className="relative h-40 w-full bg-gray-200">
                    <Image
                      src={property.imageUrl}
                      alt={property.name}
                      fill
                      className={`object-cover ${!property.isActive ? 'grayscale' : ''}`}
                      onError={(e) => {
                        // Hide broken image, show gradient placeholder
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                    {/* Fallback gradient shown behind image */}
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-blue-600 -z-10" />
                  </div>
                ) : (
                  <div className="h-2 bg-gradient-to-r from-blue-500 to-blue-600" />
                )}

                <CardContent className={property.imageUrl ? 'pt-4' : ''}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className={`font-semibold ${property.isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                          {property.name}
                        </h4>
                        {!property.isActive && (
                          <Badge variant="default">Inactive</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                        <MapPin size={14} />
                        {property.address}
                      </div>
                    </div>
                    {property.isActive && (
                      <Badge variant={property.billingType === 'monthly' ? 'warning' : 'info'}>
                        {property.billingType === 'monthly' ? 'Monthly' : 'Per Job'}
                      </Badge>
                    )}
                  </div>

                  <div className="text-2xl font-bold text-gray-900 mb-4">
                    {formatCurrency(property.baseRate)}
                  </div>

                  <div className="border-t pt-3 space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <User size={14} />
                      {property.ownerName}
                    </div>
                    {property.ownerPhone && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Phone size={14} />
                        {property.ownerPhone}
                      </div>
                    )}
                    {property.ownerEmail && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Mail size={14} />
                        {property.ownerEmail}
                      </div>
                    )}
                  </div>

                  {property.notes && property.notes.length > 0 && (
                    <div className="mt-3 p-2 bg-amber-50 rounded-lg text-sm text-amber-700">
                      {property.notes.length} active note{property.notes.length !== 1 && 's'}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="mt-3 pt-3 border-t flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEdit(property.id)
                      }}
                    >
                      <Pencil size={14} />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:bg-red-50"
                      onClick={(e) => handleDelete(property, e)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
