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
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const day = date.getDate();
  const year = date.getFullYear().toString().slice(-2);
  const dateStr = `${month} ${day}, '${year}`;
  const timeStr = date.toLocaleTimeString('en-CA', {
    hour: 'numeric',
    minute: '2-digit'
  });
  return { date: dateStr, time: timeStr };
};
