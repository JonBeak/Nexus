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
  // Parse YYYY-MM-DD portion safely to avoid timezone shift on date-only values
  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = match
    ? new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]))
    : new Date(dateString);
  // For datetime strings, use original to preserve time
  const timeSource = dateString.includes('T') ? new Date(dateString) : date;
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const day = date.getDate();
  const year = date.getFullYear().toString().slice(-2);
  const dateStr = `${month} ${day}, '${year}`;
  const timeStr = timeSource.toLocaleTimeString('en-CA', {
    hour: 'numeric',
    minute: '2-digit'
  });
  return { date: dateStr, time: timeStr };
};
