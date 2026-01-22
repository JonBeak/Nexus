import { useState } from 'react';
import { timeApi } from '../../../services/api';
import { useAlert } from '../../../contexts/AlertContext';
import type { TimeEntry, BulkEditValues } from '../../../types/time';

interface UseTimeEntryActionsProps {
  onDataRefresh: () => void;
}

export const useTimeEntryActions = ({
  onDataRefresh
}: UseTimeEntryActionsProps) => {
  const { showConfirmation } = useAlert();

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
      await timeApi.updateEntry(entryId, {
        clock_in: editValues.clock_in.replace('T', ' '),
        clock_out: editValues.clock_out ? editValues.clock_out.replace('T', ' ') : undefined,
        break_minutes: editValues.break_minutes
      });

      setEditingEntry(null);
      setEditValues({ clock_in: '', clock_out: '', break_minutes: 0 });
      onDataRefresh(); // Refresh the data
    } catch (error) {
      console.error('Error saving edit:', error);
    }
  };
  
  const deleteEntry = async (entryId: number) => {
    const confirmed = await showConfirmation({
      title: 'Delete Entry',
      message: 'Are you sure you want to delete this entry? This cannot be undone.',
      confirmText: 'Delete',
      variant: 'danger'
    });
    if (!confirmed) {
      return;
    }

    try {
      await timeApi.deleteEntry(entryId);
      onDataRefresh(); // Refresh the data
    } catch (error) {
      console.error('Error deleting entry:', error);
    }
  };

  const bulkDelete = async (selectedEntries: number[]) => {
    const confirmed = await showConfirmation({
      title: 'Delete Entries',
      message: `Are you sure you want to delete ${selectedEntries.length} entries? This cannot be undone.`,
      confirmText: 'Delete All',
      variant: 'danger'
    });
    if (!confirmed) {
      return;
    }

    try {
      await timeApi.deleteEntries(selectedEntries);
      onDataRefresh();
      return true; // Success
    } catch (error) {
      console.error('Error deleting entries:', error);
      return false;
    }
  };
  
  const bulkEdit = async (selectedEntries: number[], bulkEditValues: BulkEditValues) => {
    try {
      await timeApi.bulkEdit({
        entryIds: selectedEntries,
        updates: bulkEditValues
      });

      onDataRefresh();
      return true; // Success
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
      await timeApi.createEntry(entryData);
      onDataRefresh();
      return true;
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
