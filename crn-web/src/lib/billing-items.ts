// Preset billing items for invoice line items
export const PRESET_BILLING_ITEMS = [
  { id: 'turnover', label: 'Turnover Cleaning', category: 'service' },
  { id: 'deep_clean', label: 'Deep Clean', category: 'service' },
  { id: 'laundry', label: 'Laundry Service', category: 'service' },
  { id: 'supplies', label: 'Cleaning Supplies', category: 'supplies' },
  { id: 'linens', label: 'Linen Replacement', category: 'supplies' },
  { id: 'mileage', label: 'Mileage', category: 'expense' },
  { id: 'emergency', label: 'Emergency/After-Hours', category: 'service' },
  { id: 'misc', label: 'Miscellaneous', category: 'other' },
] as const

export type PresetBillingItem = typeof PRESET_BILLING_ITEMS[number]
export type BillingCategory = PresetBillingItem['category']
