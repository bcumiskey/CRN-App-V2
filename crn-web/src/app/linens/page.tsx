'use client'

import { useEffect, useState } from 'react'
import { Package, Plus, ShoppingCart, Pencil, Trash2, X, Check, Sparkles, ChevronDown, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency } from '@/lib/utils'
import v1Fetch from '@/lib/v1-compat'

function toast(msg: string, type: 'success' | 'error' = 'success') {
  const div = document.createElement('div')
  div.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-white text-sm ${type === 'error' ? 'bg-red-600' : 'bg-green-600'}`
  div.textContent = msg; document.body.appendChild(div); setTimeout(() => div.remove(), 3000)
}

interface Category {
  id: string
  name: string
  items: Item[]
}

interface Item {
  id: string
  name: string
  code: string
  brand?: string
  unitCost: number
  scope?: string
  owner?: { id: string; name: string }
}

interface Owner {
  id: string
  name: string
}

interface ShoppingItem {
  itemId: string
  itemName: string
  itemCode: string
  category: string
  properties: {
    propertyId: string
    propertyName: string
    perFlip: number
    onHand: number
    needed: number
    unitCost: number
    flipsRemaining: number
  }[]
  totalNeeded: number
  totalCost: number
}

type MainTabType = 'catalog' | 'shopping'
type CatalogSubTabType = 'linens' | 'supplies'

export default function LinensPage() {
  const [activeTab, setActiveTab] = useState<MainTabType>('catalog')
  const [catalogSubTab, setCatalogSubTab] = useState<CatalogSubTabType>('linens')

  // Linens state
  const [linenCategories, setLinenCategories] = useState<Category[]>([])
  const [loadingLinens, setLoadingLinens] = useState(true)

  // Supplies state
  const [supplyCategories, setSupplyCategories] = useState<Category[]>([])
  const [loadingSupplies, setLoadingSupplies] = useState(true)

  const [owners, setOwners] = useState<Owner[]>([])
  const [ownerFilter, setOwnerFilter] = useState<string>('all')

  // Catalog editing states
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [editingItemData, setEditingItemData] = useState({ name: '', code: '', brand: '', unitCost: '' })

  // Modal states
  const [showAddItem, setShowAddItem] = useState(false)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [addToCategoryId, setAddToCategoryId] = useState<string>('')

  // Expanded categories state
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  // Shopping list state
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([])
  const [shoppingStats, setShoppingStats] = useState({ totalItems: 0, totalCost: 0 })
  const [targetFlips, setTargetFlips] = useState('5')
  const [loadingShopping, setLoadingShopping] = useState(false)

  useEffect(() => {
    fetchLinenCategories()
    fetchSupplyCategories()
    fetchOwners()
  }, [])

  const fetchOwners = async () => {
    try {
      const response = await v1Fetch('/api/owners')
      if (response.ok) {
        setOwners(await response.json())
      }
    } catch (error) {
      console.error('Failed to fetch owners:', error)
    }
  }

  const fetchLinenCategories = async () => {
    try {
      const response = await v1Fetch('/api/linens')
      if (response.ok) {
        setLinenCategories(await response.json())
      }
    } catch (error) {
      console.error('Failed to fetch linens:', error)
    } finally {
      setLoadingLinens(false)
    }
  }

  const fetchSupplyCategories = async () => {
    try {
      const response = await v1Fetch('/api/supplies')
      if (response.ok) {
        setSupplyCategories(await response.json())
      }
    } catch (error) {
      console.error('Failed to fetch supplies:', error)
    } finally {
      setLoadingSupplies(false)
    }
  }

  // Category CRUD
  const handleAddCategory = async (name: string) => {
    const apiPath = catalogSubTab === 'linens' ? '/api/linens' : '/api/supplies'
    try {
      const response = await v1Fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'category', name }),
      })
      if (response.ok) {
        toast('Category added')
        setShowAddCategory(false)
        catalogSubTab === 'linens' ? fetchLinenCategories() : fetchSupplyCategories()
      } else {
        const error = await response.json()
        toast(error.error || 'Failed to add category', 'error')
      }
    } catch (error) {
      toast('Failed to add category', 'error')
    }
  }

  const handleUpdateCategory = async (categoryId: string) => {
    if (!editingCategoryName.trim()) return
    const apiPath = catalogSubTab === 'linens'
      ? `/api/linens/categories/${categoryId}`
      : `/api/supplies/categories/${categoryId}`
    try {
      const response = await v1Fetch(apiPath, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingCategoryName }),
      })
      if (response.ok) {
        toast('Category updated')
        setEditingCategory(null)
        catalogSubTab === 'linens' ? fetchLinenCategories() : fetchSupplyCategories()
      } else {
        toast('Failed to update category', 'error')
      }
    } catch (error) {
      toast('Failed to update category', 'error')
    }
  }

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Delete this category and all its items?')) return
    const apiPath = catalogSubTab === 'linens'
      ? `/api/linens/categories/${categoryId}`
      : `/api/supplies/categories/${categoryId}`
    try {
      const response = await v1Fetch(apiPath, { method: 'DELETE' })
      if (response.ok) {
        toast('Category deleted')
        catalogSubTab === 'linens' ? fetchLinenCategories() : fetchSupplyCategories()
      } else {
        toast('Failed to delete category', 'error')
      }
    } catch (error) {
      toast('Failed to delete category', 'error')
    }
  }

  // Item CRUD
  const handleAddItem = async (data: { categoryId: string; name: string; code: string; brand?: string; scope?: string; ownerId?: string }) => {
    const apiPath = catalogSubTab === 'linens' ? '/api/linens' : '/api/supplies'
    try {
      const response = await v1Fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          unitCost: '0',
          scope: data.scope || 'global',
          ownerId: data.scope === 'owner' ? data.ownerId : null,
        }),
      })
      if (response.ok) {
        toast('Item added')
        setShowAddItem(false)
        catalogSubTab === 'linens' ? fetchLinenCategories() : fetchSupplyCategories()
      } else {
        const error = await response.json()
        toast(error.error || 'Failed to add item', 'error')
      }
    } catch (error) {
      toast('Failed to add item', 'error')
    }
  }

  const handleUpdateItem = async (itemId: string) => {
    if (!editingItemData.name.trim() || !editingItemData.code.trim()) return
    const apiPath = catalogSubTab === 'linens'
      ? `/api/linens/items/${itemId}`
      : `/api/supplies/items/${itemId}`
    try {
      const response = await v1Fetch(apiPath, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editingItemData,
          unitCost: editingItemData.unitCost ? parseFloat(editingItemData.unitCost) : 0,
        }),
      })
      if (response.ok) {
        toast('Item updated')
        setEditingItem(null)
        catalogSubTab === 'linens' ? fetchLinenCategories() : fetchSupplyCategories()
      } else {
        toast('Failed to update item', 'error')
      }
    } catch (error) {
      toast('Failed to update item', 'error')
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Delete this item?')) return
    const apiPath = catalogSubTab === 'linens'
      ? `/api/linens/items/${itemId}`
      : `/api/supplies/items/${itemId}`
    try {
      const response = await v1Fetch(apiPath, { method: 'DELETE' })
      if (response.ok) {
        toast('Item deleted')
        catalogSubTab === 'linens' ? fetchLinenCategories() : fetchSupplyCategories()
      } else {
        toast('Failed to delete item', 'error')
      }
    } catch (error) {
      toast('Failed to delete item', 'error')
    }
  }

  // Shopping list
  const fetchShoppingList = async () => {
    const flips = parseInt(targetFlips) || 5
    setLoadingShopping(true)
    try {
      const response = await v1Fetch(`/api/linens/shopping-list?targetFlips=${flips}`)
      if (response.ok) {
        const data = await response.json()
        setShoppingList(data.items)
        setShoppingStats(data.summary)
      }
    } catch (error) {
      console.error('Failed to fetch shopping list:', error)
      toast('Failed to generate shopping list', 'error')
    } finally {
      setLoadingShopping(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'shopping') {
      fetchShoppingList()
    }
  }, [activeTab])

  const rawCategories = catalogSubTab === 'linens' ? linenCategories : supplyCategories
  const loadingCatalog = catalogSubTab === 'linens' ? loadingLinens : loadingSupplies

  // Filter items by owner
  const filterItemsByOwner = (items: Item[]) => {
    if (ownerFilter === 'all') return items
    if (ownerFilter === 'global') return items.filter(item => item.scope !== 'owner')
    return items.filter(item =>
      item.scope !== 'owner' || item.owner?.id === ownerFilter
    )
  }

  const categories = rawCategories.map(category => ({
    ...category,
    items: filterItemsByOwner(category.items),
  }))

  const mainTabs = [
    { id: 'catalog' as MainTabType, label: 'Item Catalog', icon: Package },
    { id: 'shopping' as MainTabType, label: 'Shopping List', icon: ShoppingCart },
  ]

  return (
    <div className="min-h-screen">
      <PageHeader title="Linens & Supplies" />

      <div className="p-6">
        {/* Main Tabs */}
        <div className="flex gap-2 mb-6">
          {mainTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Catalog Tab */}
        {activeTab === 'catalog' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setCatalogSubTab('linens')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    catalogSubTab === 'linens'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Package size={16} className="inline mr-2" />
                  Linens
                </button>
                <button
                  onClick={() => setCatalogSubTab('supplies')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    catalogSubTab === 'supplies'
                      ? 'bg-white text-emerald-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Sparkles size={16} className="inline mr-2" />
                  Supplies
                </button>
              </div>
              <Button onClick={() => setShowAddCategory(true)}>
                <Plus size={16} />
                Add Category
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-gray-600 text-sm">
                {catalogSubTab === 'linens'
                  ? 'Manage your linen catalog (sheets, towels, pillowcases, etc.). These are reusable textiles.'
                  : 'Manage your supply catalog (cleaning products, toiletries, etc.). These are consumable items.'
                }
              </p>
              {owners.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Filter by owner:</span>
                  <select
                    value={ownerFilter}
                    onChange={(e) => setOwnerFilter(e.target.value)}
                    className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="all">All Items</option>
                    <option value="global">Global Only</option>
                    {owners.map(owner => (
                      <option key={owner.id} value={owner.id}>{owner.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {loadingCatalog ? (
              <div className="text-center py-12 text-gray-500">Loading...</div>
            ) : categories.length === 0 ? (
              <Card>
                <CardContent>
                  <EmptyState
                    icon={catalogSubTab === 'linens' ? <Package size={40} /> : <Sparkles size={40} />}
                    title={`No ${catalogSubTab} categories yet`}
                    description={`Create categories to organize your ${catalogSubTab}.`}
                    actionLabel="Add Category"
                    onAction={() => setShowAddCategory(true)}
                  />
                </CardContent>
              </Card>
            ) : (
              categories.map(category => {
                const isExpanded = expandedCategories.has(category.id)
                return (
                <Card key={category.id}>
                  <CardHeader
                    className="flex flex-row items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => toggleCategory(category.id)}
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown size={20} className="text-gray-500" />
                      ) : (
                        <ChevronRight size={20} className="text-gray-500" />
                      )}
                      {editingCategory === category.id ? (
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Input
                            value={editingCategoryName}
                            onChange={(e) => setEditingCategoryName(e.target.value)}
                            className="w-48"
                            autoFocus
                          />
                          <Button size="sm" onClick={() => handleUpdateCategory(category.id)}>
                            <Check size={14} />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingCategory(null)}>
                            <X size={14} />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <h3 className="font-semibold text-gray-900">{category.name}</h3>
                          <span className="text-sm text-gray-500">({category.items.length} items)</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingCategory(category.id)
                              setEditingCategoryName(category.name)
                            }}
                            className="p-1 text-gray-400 hover:text-gray-600"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteCategory(category.id)
                            }}
                            className="p-1 text-gray-400 hover:text-red-600"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        setAddToCategoryId(category.id)
                        setShowAddItem(true)
                      }}
                    >
                      <Plus size={14} />
                      Add Item
                    </Button>
                  </CardHeader>
                  {isExpanded && (
                  <CardContent className="p-0">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Item Name</th>
                          <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                            {catalogSubTab === 'supplies' ? 'Use/Purpose' : 'Code'}
                          </th>
                          {catalogSubTab === 'supplies' && (
                            <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Brand</th>
                          )}
                          <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Unit Cost</th>
                          <th className="w-24"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {category.items.map(item => (
                          <tr key={item.id} className="hover:bg-gray-50 group">
                            {editingItem === item.id ? (
                              <>
                                <td className="px-6 py-2">
                                  <Input
                                    value={editingItemData.name}
                                    onChange={(e) => setEditingItemData({ ...editingItemData, name: e.target.value })}
                                    className="w-full"
                                  />
                                </td>
                                <td className="px-6 py-2">
                                  <Input
                                    value={editingItemData.code}
                                    onChange={(e) => setEditingItemData({ ...editingItemData, code: e.target.value.toUpperCase() })}
                                    className="w-24"
                                  />
                                </td>
                                {catalogSubTab === 'supplies' && (
                                  <td className="px-6 py-2">
                                    <Input
                                      value={editingItemData.brand}
                                      onChange={(e) => setEditingItemData({ ...editingItemData, brand: e.target.value })}
                                      className="w-32"
                                      placeholder="Brand"
                                    />
                                  </td>
                                )}
                                <td className="px-6 py-2">
                                  <div className="relative w-24">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                                    <Input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={editingItemData.unitCost}
                                      onChange={(e) => setEditingItemData({ ...editingItemData, unitCost: e.target.value })}
                                      className="w-full pl-5"
                                    />
                                  </div>
                                </td>
                                <td className="px-6 py-2">
                                  <div className="flex gap-1">
                                    <Button size="sm" onClick={() => handleUpdateItem(item.id)}>
                                      <Check size={14} />
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setEditingItem(null)}>
                                      <X size={14} />
                                    </Button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="px-6 py-3">
                                  <span className="font-medium">{item.name}</span>
                                  {item.scope === 'owner' && item.owner && (
                                    <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                                      {item.owner.name}
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-3 text-gray-500 font-mono text-sm">{item.code}</td>
                                {catalogSubTab === 'supplies' && (
                                  <td className="px-6 py-3 text-gray-500 text-sm">{item.brand || '-'}</td>
                                )}
                                <td className="px-6 py-3 text-right text-gray-700">{formatCurrency(item.unitCost)}</td>
                                <td className="px-6 py-3">
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                                    <button
                                      onClick={() => {
                                        setEditingItem(item.id)
                                        setEditingItemData({ name: item.name, code: item.code, brand: item.brand || '', unitCost: item.unitCost?.toString() || '0' })
                                      }}
                                      className="p-1 text-gray-400 hover:text-gray-600"
                                    >
                                      <Pencil size={14} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteItem(item.id)}
                                      className="p-1 text-gray-400 hover:text-red-600"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                        {category.items.length === 0 && (
                          <tr>
                            <td colSpan={catalogSubTab === 'supplies' ? 5 : 4} className="px-6 py-8 text-center text-gray-500">
                              No items in this category
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </CardContent>
                  )}
                </Card>
              )})
            )}
          </div>
        )}

        {/* Shopping List Tab */}
        {activeTab === 'shopping' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <label className="text-sm text-gray-600">Target flips per property:</label>
                <Input
                  type="number"
                  min="1"
                  value={targetFlips}
                  onChange={(e) => setTargetFlips(e.target.value)}
                  className="w-20"
                />
                <Button variant="outline" onClick={fetchShoppingList}>
                  Generate List
                </Button>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="text-sm text-gray-500">Items Needed</div>
                  <div className="text-xl font-bold">{shoppingStats.totalItems}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">Est. Cost</div>
                  <div className="text-xl font-bold text-green-600">{formatCurrency(shoppingStats.totalCost)}</div>
                </div>
              </div>
            </div>

            {loadingShopping ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">Generating shopping list...</CardContent>
              </Card>
            ) : shoppingList.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <ShoppingCart size={48} className="mx-auto mb-4 text-gray-300" />
                  <h3 className="font-semibold text-gray-900 mb-2">All stocked up!</h3>
                  <p className="text-gray-500">All properties have enough for {targetFlips} flips.</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Item</th>
                        <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Properties Needing</th>
                        <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase">Qty</th>
                        <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Est. Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {shoppingList.map(item => (
                        <tr key={item.itemId} className="hover:bg-gray-50">
                          <td className="px-6 py-3">
                            <div className="font-medium">{item.itemName}</div>
                            <div className="text-xs text-gray-500">{item.category} &bull; {item.itemCode}</div>
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex flex-wrap gap-1">
                              {item.properties.map(p => (
                                <span
                                  key={p.propertyId}
                                  className={`px-2 py-0.5 text-xs rounded ${
                                    p.flipsRemaining <= 1 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                  }`}
                                  title={`Need ${p.needed} @ ${formatCurrency(p.unitCost)} each`}
                                >
                                  {p.propertyName}: {p.needed}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-6 py-3 text-center font-semibold">{item.totalNeeded}</td>
                          <td className="px-6 py-3 text-right font-semibold">{formatCurrency(item.totalCost)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t">
                      <tr>
                        <td colSpan={2} className="px-6 py-3 font-semibold text-right">Total:</td>
                        <td className="px-6 py-3 text-center font-bold">{shoppingStats.totalItems}</td>
                        <td className="px-6 py-3 text-right font-bold text-green-600">{formatCurrency(shoppingStats.totalCost)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Add Category Modal */}
      <AddCategoryModal
        open={showAddCategory}
        onClose={() => setShowAddCategory(false)}
        onSave={handleAddCategory}
        type={catalogSubTab}
      />

      {/* Add Item Modal */}
      <AddItemModal
        open={showAddItem}
        onClose={() => setShowAddItem(false)}
        onSave={handleAddItem}
        categoryId={addToCategoryId}
        categories={rawCategories}
        type={catalogSubTab}
        owners={owners}
      />
    </div>
  )
}

function AddCategoryModal({ open, onClose, onSave, type }: {
  open: boolean
  onClose: () => void
  onSave: (name: string) => void
  type: 'linens' | 'supplies'
}) {
  const [name, setName] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (open) setName('')
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      await onSave(name)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Add ${type === 'linens' ? 'Linen' : 'Supply'} Category`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Category Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={type === 'linens' ? 'e.g., Sheets, Towels, Pillowcases' : 'e.g., Cleaning Products, Toiletries, Paper Goods'}
          required
        />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={isSaving}>{isSaving ? 'Adding...' : 'Add Category'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function AddItemModal({ open, onClose, onSave, categoryId, categories, type, owners }: {
  open: boolean
  onClose: () => void
  onSave: (data: { categoryId: string; name: string; code: string; brand?: string; scope?: string; ownerId?: string }) => void
  categoryId: string
  categories: { id: string; name: string; items: any[] }[]
  type: 'linens' | 'supplies'
  owners: Owner[]
}) {
  const [formData, setFormData] = useState({ categoryId: '', name: '', code: '', brand: '', scope: 'global', ownerId: '' })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setFormData({ categoryId: categoryId || categories[0]?.id || '', name: '', code: '', brand: '', scope: 'global', ownerId: '' })
    }
  }, [open, categoryId, categories])

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
    <Modal open={open} onClose={onClose} title={`Add ${type === 'linens' ? 'Linen' : 'Supply'} Item`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            value={formData.categoryId}
            onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <Input
          label="Item Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder={type === 'linens' ? 'e.g., King Fitted Sheet' : 'e.g., All-Purpose Cleaner'}
          required
        />
        <Input
          label={type === 'supplies' ? 'Use/Purpose' : 'Item Code'}
          value={formData.code}
          onChange={(e) => setFormData({ ...formData, code: type === 'supplies' ? e.target.value : e.target.value.toUpperCase() })}
          placeholder={type === 'supplies' ? 'e.g., Bathroom cleaning, Kitchen surfaces' : 'e.g., KFS'}
          required
        />
        {type === 'supplies' && (
          <Input
            label="Brand (optional)"
            value={formData.brand}
            onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
            placeholder="e.g., Method, Mrs. Meyer's"
          />
        )}
        {owners.length > 0 && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Owner-Specific?</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="scope"
                  checked={formData.scope === 'global'}
                  onChange={() => setFormData({ ...formData, scope: 'global', ownerId: '' })}
                />
                <span className="text-sm">Available to all</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="scope"
                  checked={formData.scope === 'owner'}
                  onChange={() => setFormData({ ...formData, scope: 'owner' })}
                />
                <span className="text-sm">Owner-specific</span>
              </label>
            </div>
            {formData.scope === 'owner' && (
              <select
                value={formData.ownerId}
                onChange={(e) => setFormData({ ...formData, ownerId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                required
              >
                <option value="">Select owner...</option>
                {owners.map(owner => (
                  <option key={owner.id} value={owner.id}>{owner.name}</option>
                ))}
              </select>
            )}
          </div>
        )}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={isSaving}>{isSaving ? 'Adding...' : 'Add Item'}</Button>
        </div>
      </form>
    </Modal>
  )
}
