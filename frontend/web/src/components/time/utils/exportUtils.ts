interface ExportDataParams {
  selectedDate: string;
  endDate: string;
  dateRange: 'single' | 'range';
  selectedGroup: string;
  searchTerm: string;
  format: 'csv' | 'pdf';
  makeAuthenticatedRequest: (url: string, options?: any) => Promise<Response>;
}

export const exportData = async ({
  selectedDate,
  endDate,
  dateRange,
  selectedGroup,
  searchTerm,
  format,
  makeAuthenticatedRequest
}: ExportDataParams) => {
  try {
    const params = new URLSearchParams({
      startDate: selectedDate,
      endDate: dateRange === 'range' ? endDate : selectedDate,
      group: selectedGroup,
      format: format,
      search: searchTerm
    });
    
    const res = await makeAuthenticatedRequest(
      `http://192.168.2.14:3001/api/time-management/export?${params}`
    );
    
    if (res.ok) {
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `time-entries-${selectedDate}${dateRange === 'range' ? `-to-${endDate}` : ''}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      return true;
    } else {
      console.error('Export failed');
      return false;
    }
  } catch (error) {
    console.error('Error exporting data:', error);
    return false;
  }
};