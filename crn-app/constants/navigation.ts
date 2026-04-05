/**
 * Navigation configuration — sections, actions, and defaults.
 * Drives the configurable tab bar system.
 */

export interface TabSection {
  key: string;
  label: string;
  icon: string; // lucide icon name
  route: string;
  adminOnly?: boolean;
  workerOnly?: boolean;
  stubbed?: boolean;
}

export interface CenterAction {
  key: string;
  label: string;
  icon: string;
}

export const allSections: TabSection[] = [
  { key: "dashboard", label: "Dashboard", icon: "LayoutDashboard", route: "/(admin)" },
  { key: "jobs", label: "Jobs", icon: "ClipboardList", route: "/(admin)/jobs" },
  { key: "calendar", label: "Calendar", icon: "Calendar", route: "/(admin)/calendar" },
  { key: "properties", label: "Properties", icon: "Building", route: "/(admin)/properties" },
  { key: "team", label: "Team", icon: "Users", route: "/(admin)/team" },
  { key: "invoicing", label: "Invoicing", icon: "FileText", route: "/(admin)/invoicing", stubbed: true },
  { key: "expenses", label: "Expenses", icon: "Receipt", route: "/(admin)/expenses", stubbed: true },
  { key: "reports", label: "Reports", icon: "TrendingUp", route: "/(admin)/reports", stubbed: true },
  { key: "linens", label: "Linens", icon: "Package", route: "/(admin)/linens", stubbed: true },
  { key: "pay_periods", label: "Pay Periods", icon: "Wallet", route: "/(admin)/pay-periods", stubbed: true },
  { key: "settings", label: "Settings", icon: "Settings", route: "/(admin)/settings" },
];

export const adminCenterActions: CenterAction[] = [
  { key: "quick_add_job", label: "Quick Add Job", icon: "Plus" },
  { key: "add_note", label: "Add Note", icon: "StickyNote" },
  { key: "add_charge", label: "Add Charge", icon: "DollarSign" },
  { key: "log_expense", label: "Log Expense", icon: "Receipt" },
  { key: "log_mileage", label: "Log Mileage", icon: "Car" },
];

export const workerCenterActions: CenterAction[] = [
  { key: "add_note", label: "Add Note", icon: "StickyNote" },
  { key: "check_in", label: "Check In", icon: "MapPin" },
  { key: "start_job", label: "Start Job", icon: "Play" },
];

export const defaultAdminTabBar = [
  { position: 1, section: "dashboard" },
  { position: 2, section: "jobs" },
  // position 3 is center FAB
  { position: 4, section: "calendar" },
  // position 5 is always "more"
];

export const defaultWorkerTabBar = [
  { position: 1, section: "today" },
  { position: 2, section: "schedule" },
  { position: 4, section: "my_pay" },
];
