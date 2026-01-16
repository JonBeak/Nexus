/**
 * Shared Module Color Definitions
 *
 * Central color palette for all application modules.
 * Use these constants for consistent branding across the app.
 */

// Module color definitions with base, hover, and light variants
export const MODULE_COLORS = {
  estimates: {
    base: 'bg-emerald-500',
    dark: 'bg-emerald-700',
    hover: 'hover:bg-emerald-600',
    text: 'text-emerald-500',
    light: 'bg-emerald-100',
    lightText: 'text-emerald-100',
    border: 'border-emerald-500',
    // Badge colors (light bg, dark text/border for readability)
    badgeText: 'text-emerald-800',
    badgeBorder: 'border-emerald-800',
    name: 'Estimates'
  },
  invoices: {
    base: 'bg-green-600',
    hover: 'hover:bg-green-700',
    text: 'text-green-600',
    light: 'bg-green-100',
    lightText: 'text-green-100',
    border: 'border-green-600',
    name: 'Invoices'
  },
  orders: {
    base: 'bg-orange-500',
    hover: 'hover:bg-orange-600',
    text: 'text-orange-500',
    light: 'bg-orange-100',
    lightText: 'text-orange-100',
    border: 'border-orange-500',
    // Badge colors (light bg, dark text/border for readability)
    badgeText: 'text-orange-800',
    badgeBorder: 'border-orange-800',
    // Light button variant (for secondary actions)
    lightHover: 'hover:bg-orange-200',
    lightButtonText: 'text-orange-700',
    name: 'Orders'
  },
  supplyChain: {
    base: 'bg-red-500',
    hover: 'hover:bg-red-600',
    text: 'text-red-500',
    light: 'bg-red-100',
    lightText: 'text-red-100',
    border: 'border-red-500',
    name: 'Supply Chain'
  },
  customers: {
    base: 'bg-blue-500',
    hover: 'hover:bg-blue-600',
    text: 'text-blue-500',
    light: 'bg-blue-100',
    lightText: 'text-blue-100',
    border: 'border-blue-500',
    name: 'Customers'
  },
  vinyls: {
    base: 'bg-purple-500',
    hover: 'hover:bg-purple-600',
    text: 'text-purple-500',
    light: 'bg-purple-100',
    lightText: 'text-purple-100',
    border: 'border-purple-500',
    name: 'Vinyls'
  },
  timeTracking: {
    base: 'bg-yellow-500',
    hover: 'hover:bg-yellow-600',
    text: 'text-yellow-500',
    textDark: 'text-yellow-600',
    textHover: 'hover:text-yellow-700',
    light: 'bg-yellow-100',
    lightHover: 'hover:bg-yellow-50',
    lightText: 'text-yellow-100',
    lightTextDark: 'text-yellow-700',
    border: 'border-yellow-500',
    lightBorder: 'border-yellow-300',
    name: 'Time Tracking'
  },
  wages: {
    base: 'bg-green-800',
    hover: 'hover:bg-green-900',
    text: 'text-green-800',
    light: 'bg-green-100',
    lightText: 'text-green-100',
    border: 'border-green-800',
    name: 'Wages'
  },
  accounts: {
    base: 'bg-gray-400',
    hover: 'hover:bg-gray-500',
    text: 'text-gray-400',
    light: 'bg-gray-100',
    lightText: 'text-gray-100',
    border: 'border-gray-400',
    name: 'Accounts'
  },
  settings: {
    base: 'bg-gray-500',
    hover: 'hover:bg-gray-600',
    text: 'text-gray-500',
    light: 'bg-gray-100',
    lightText: 'text-gray-100',
    border: 'border-gray-500',
    name: 'Settings'
  },
  servers: {
    base: 'bg-gray-700',
    hover: 'hover:bg-gray-800',
    text: 'text-gray-700',
    light: 'bg-gray-100',
    lightText: 'text-gray-100',
    border: 'border-gray-700',
    name: 'Servers'
  },
  tasks: {
    base: 'bg-blue-600',
    hover: 'hover:bg-blue-700',
    text: 'text-blue-600',
    light: 'bg-blue-100',
    lightText: 'text-blue-100',
    border: 'border-blue-600',
    name: 'My Tasks'
  }
} as const;

// Type for module keys
export type ModuleKey = keyof typeof MODULE_COLORS;

/**
 * Page-Level Styles using CSS Variables
 *
 * Theme system with "industrial" as default.
 * CSS variables defined in JobEstimation.css.
 * Switch themes via: document.documentElement.dataset.theme = 'light'
 */
export const PAGE_STYLES = {
  // Legacy properties (backwards compatibility)
  background: 'bg-[var(--theme-page-bg)]',
  fullPage: 'min-h-screen bg-[var(--theme-page-bg)]',
  border: 'border-[var(--theme-border)]',
  divider: 'divide-[var(--theme-border)]',

  // Page level (darkest layer)
  page: {
    background: 'bg-[var(--theme-page-bg)]',
    text: 'text-[var(--theme-text-on-dark)]',
  },

  // Panel level (cards, containers)
  panel: {
    background: 'bg-[var(--theme-panel-bg)]',
    text: 'text-[var(--theme-text-primary)]',
    textMuted: 'text-[var(--theme-text-muted)]',
    textSecondary: 'text-[var(--theme-text-secondary)]',
    border: 'border-[var(--theme-border)]',
    divider: 'divide-[var(--theme-border)]',
  },

  // Header level (table headers, panel headers, nav bars)
  header: {
    background: 'bg-[var(--theme-header-bg)]',
    text: 'text-[var(--theme-text-secondary)]',
    border: 'border-[var(--theme-border)]',
  },

  // Input fields
  input: {
    background: 'bg-[var(--theme-input-bg)]',
    text: 'text-[var(--theme-text-primary)]',
    placeholder: 'placeholder:text-[var(--theme-text-muted)]',
    border: 'border-[var(--theme-border)]',
  },

  // Interactive states
  interactive: {
    hover: 'hover:bg-[var(--theme-hover-bg)]',
    hoverOnHeader: 'hover:bg-[var(--theme-header-hover)]',
    selected: 'bg-[var(--theme-selected-bg)]',
  },

  // Composite classes (common combinations)
  composites: {
    panelContainer: 'bg-[var(--theme-panel-bg)] rounded-lg shadow border border-[var(--theme-border)]',
    tableHeader: 'bg-[var(--theme-header-bg)] border-b border-[var(--theme-border)]',
    tableBody: 'divide-y divide-[var(--theme-border)]',
    navBar: 'bg-[var(--theme-panel-bg)] border-b border-[var(--theme-border)]',
  },
} as const;

// Helper to get combined button classes for a module
export const getModuleButtonClasses = (module: ModuleKey): string => {
  const colors = MODULE_COLORS[module];
  return `${colors.base} ${colors.hover}`;
};

// Helper to get pill button classes (for owner dashboard compact view)
export const getModulePillClasses = (module: ModuleKey): string => {
  const colors = MODULE_COLORS[module];
  return `px-3 py-3 ${colors.base} ${colors.hover} text-white font-medium rounded-lg transition-colors text-left`;
};

// Helper to get large card button classes (for manager dashboard)
export const getModuleCardClasses = (module: ModuleKey): string => {
  const colors = MODULE_COLORS[module];
  return `group p-6 ${colors.base} ${colors.hover} rounded-2xl transition-all duration-300 text-left shadow-lg hover:shadow-xl transform hover:scale-105`;
};
