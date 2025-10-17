import { timeApi } from '../../../services/api';

interface ExportDataParams {
  selectedDate: string;
  endDate: string;
  dateRange: 'single' | 'range';
  selectedGroup: string;
  searchTerm: string;
  format: 'csv' | 'pdf';
}

export const exportData = async ({
  selectedDate,
  endDate,
  dateRange,
  selectedGroup,
  searchTerm,
  format
}: ExportDataParams) => {
  try {
    const blob = await timeApi.exportData({
      startDate: selectedDate,
      endDate: dateRange === 'range' ? endDate : selectedDate,
      group: selectedGroup,
      format: format,
      search: searchTerm
    });

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `time-entries-${selectedDate}${dateRange === 'range' ? `-to-${endDate}` : ''}.${format}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    return true;
  } catch (error) {
    console.error('Error exporting data:', error);
    return false;
  }
};
