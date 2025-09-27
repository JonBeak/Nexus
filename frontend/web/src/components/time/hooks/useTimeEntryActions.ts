import { useState } from 'react';
import type { TimeEntry, AuthenticatedRequest, BulkEditValues } from '../../../types/time';

interface UseTimeEntryActionsProps {
  makeAuthenticatedRequest: AuthenticatedRequest;
  onDataRefresh: () => void;
}

export const useTimeEntryActions = ({ 
  makeAuthenticatedRequest, 
  onDataRefresh 
}: UseTimeEntryActionsProps) => {
  
  const [editingEntry, setEditingEntry] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{
    clock_in: string;
    clock_out: string;
    break_minutes: number;
  }>({ clock_in: '', clock_out: '', break_minutes: 0 });

  // Helper function to convert MySQL datetime to datetime-local input format
  const toDateTimeLocal = (dateString: string | null) => {
    if (!dateString) return '';
    
    // Treat MySQL datetime as local time
    const date = new Date(dateString.replace('T', ' ').replace('Z', ''));
    
    // Convert to YYYY-MM-DDTHH:MM format for datetime-local input
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const startEditing = (entry: TimeEntry) => {
    setEditingEntry(entry.entry_id);
    setEditValues({
      clock_in: toDateTimeLocal(entry.clock_in),
      clock_out: toDateTimeLocal(entry.clock_out),
      break_minutes: entry.break_minutes
    });
  };
  
  const cancelEditing = () => {
    setEditingEntry(null);
    setEditValues({ clock_in: '', clock_out: '', break_minutes: 0 });
  };
  
  const saveEdit = async (entryId: number) => {
    try {
      const updates = {
        clock_in: editValues.clock_in.replace('T', ' '),
        clock_out: editValues.clock_out ? editValues.clock_out.replace('T', ' ') : null,
        break_minutes: editValues.break_minutes
      };
      
      const res = await makeAuthenticatedRequest(
        `http://192.168.2.14:3001/api/time-management/entries/${entryId}`, 
        {
          method: 'PUT',
          body: JSON.stringify(updates)
        }
      );
      
      if (res.ok) {
        setEditingEntry(null);
        setEditValues({ clock_in: '', clock_out: '', break_minutes: 0 });
        onDataRefresh(); // Refresh the data
      } else {
        console.error('Failed to save edit');
      }
    } catch (error) {
      console.error('Error saving edit:', error);
    }
  };
  
  const deleteEntry = async (entryId: number) => {
    if (!confirm('Are you sure you want to delete this entry? This cannot be undone.')) {
      return;
    }
    
    try {
      const res = await makeAuthenticatedRequest(
        `http://192.168.2.14:3001/api/time-management/entries/${entryId}`,
        { method: 'DELETE' }
      );
      
      if (res.ok) {
        onDataRefresh(); // Refresh the data
      } else {
        console.error('Failed to delete entry');
      }
    } catch (error) {
      console.error('Error deleting entry:', error);
    }
  };

  const bulkDelete = async (selectedEntries: number[]) => {
    if (!confirm(`Are you sure you want to delete ${selectedEntries.length} entries? This cannot be undone.`)) {
      return;
    }
    
    try {
      const res = await makeAuthenticatedRequest(
        'http://192.168.2.14:3001/api/time-management/bulk-delete',
        {
          method: 'DELETE',
          body: JSON.stringify({ entryIds: selectedEntries })
        }
      );
      
      if (res.ok) {
        onDataRefresh();
        return true; // Success
      } else {
        console.error('Failed to delete entries');
        return false;
      }
    } catch (error) {
      console.error('Error deleting entries:', error);
      return false;
    }
  };
  
  const bulkEdit = async (selectedEntries: number[], bulkEditValues: BulkEditValues) => {
    try {
      const res = await makeAuthenticatedRequest(
        'http://192.168.2.14:3001/api/time-management/bulk-edit',
        {
          method: 'PUT',
          body: JSON.stringify({ 
            entryIds: selectedEntries,
            updates: bulkEditValues
          })
        }
      );
      
      if (res.ok) {
        onDataRefresh();
        return true; // Success
      } else {
        console.error('Failed to edit entries');
        return false;
      }
    } catch (error) {
      console.error('Error editing entries:', error);
      return false;
    }
  };

  const addTimeEntry = async (entryData: {
    user_id: number;
    clock_in: string;
    clock_out: string;
    break_minutes: number;
    date: string;
  }) => {
    try {
      const res = await makeAuthenticatedRequest(
        'http://192.168.2.14:3001/api/time-management/entries',
        {
          method: 'POST',
          body: JSON.stringify(entryData)
        }
      );
      
      if (res.ok) {
        onDataRefresh();
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('Error adding time entry:', error);
      return false;
    }
  };
  
  return {
    // State
    editingEntry,
    editValues,
    
    // Setters
    setEditValues,
    
    // Actions
    startEditing,
    cancelEditing,
    saveEdit,
    deleteEntry,
    bulkDelete,
    bulkEdit,
    addTimeEntry,
    
    // Helpers
    toDateTimeLocal
  };
};
