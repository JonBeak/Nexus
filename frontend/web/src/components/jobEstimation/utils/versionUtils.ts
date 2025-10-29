/**
 * Utility functions for version management
 */

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD'
  }).format(amount);
};

export const formatDate = (dateString: string): { date: string; time: string } => {
  const date = new Date(dateString);
  const dateStr = date.toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  const timeStr = date.toLocaleTimeString('en-CA', {
    hour: '2-digit',
    minute: '2-digit'
  });
  return { date: dateStr, time: timeStr };
};
