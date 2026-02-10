/**
 * StandardFileNamesPanel - Manage the file name catalog
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Check, X, ToggleLeft, ToggleRight } from 'lucide-react';
import { validationRulesApi, StandardFileName } from '../../../services/api/validationRulesApi';

export const StandardFileNamesPanel: React.FC = () => {
  const [fileNames, setFileNames] = useState<StandardFileName[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inline editing state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCategory, setEditCategory] = useState<string>('cutting_file');

  // New file name form
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState<string>('cutting_file');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await validationRulesApi.getStandardFileNames();
      setFileNames(data);
    } catch (err) {
      setError('Failed to load file names');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const startEdit = (fn: StandardFileName) => {
    setEditingId(fn.file_name_id);
    setEditName(fn.name);
    setEditDesc(fn.description || '');
    setEditCategory(fn.category);
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    try {
      await validationRulesApi.updateStandardFileName(editingId, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
        category: editCategory,
      });
      setEditingId(null);
      await loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to update');
    }
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await validationRulesApi.createStandardFileName({
        name: newName.trim(),
        description: newDesc.trim() || undefined,
        category: newCategory,
      });
      setNewName('');
      setNewDesc('');
      setNewCategory('cutting_file');
      setShowAdd(false);
      await loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to create');
    }
  };

  const toggleActive = async (fn: StandardFileName) => {
    try {
      await validationRulesApi.updateStandardFileName(fn.file_name_id, { is_active: !fn.is_active });
      await loadData();
    } catch (err) {
      console.error('Failed to toggle:', err);
    }
  };

  const categoryLabel = (cat: string) => {
    switch (cat) {
      case 'working_file': return 'Working';
      case 'cutting_file': return 'Cutting';
      case 'other': return 'Other';
      default: return cat;
    }
  };

  const categoryBadge = (cat: string) => {
    const colors: Record<string, string> = {
      working_file: 'bg-blue-100 text-blue-700',
      cutting_file: 'bg-green-100 text-green-700',
      other: 'bg-gray-100 text-gray-700',
    };
    return colors[cat] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const active = fileNames.filter(f => f.is_active);
  const inactive = fileNames.filter(f => !f.is_active);

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{active.length} file names in catalog</p>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" /> Add File Name
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">File Name</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g., Backer.ai"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded"
                autoFocus
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <input
                type="text"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="Optional description"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded"
              />
            </div>
            <div className="w-32">
              <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
              <select
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded bg-white"
              >
                <option value="cutting_file">Cutting</option>
                <option value="working_file">Working</option>
                <option value="other">Other</option>
              </select>
            </div>
            <button onClick={handleAdd} className="p-2 text-green-600 hover:bg-green-100 rounded" title="Save">
              <Check className="h-4 w-4" />
            </button>
            <button onClick={() => setShowAdd(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded" title="Cancel">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-600">File Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {active.map(fn => (
              <tr key={fn.file_name_id} className="border-b border-gray-100 hover:bg-gray-50">
                {editingId === fn.file_name_id ? (
                  <>
                    <td className="px-4 py-2">
                      <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-blue-300 rounded"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={editDesc}
                        onChange={e => setEditDesc(e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-blue-300 rounded"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={editCategory}
                        onChange={e => setEditCategory(e.target.value)}
                        className="px-2 py-1 text-sm border border-blue-300 rounded bg-white"
                      >
                        <option value="cutting_file">Cutting</option>
                        <option value="working_file">Working</option>
                        <option value="other">Other</option>
                      </select>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={saveEdit} className="p-1 text-green-600 hover:bg-green-100 rounded">
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded ml-1">
                        <X className="h-4 w-4" />
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 font-medium text-gray-800">{fn.name}</td>
                    <td className="px-4 py-3 text-gray-500">{fn.description || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 text-xs rounded ${categoryBadge(fn.category)}`}>
                        {categoryLabel(fn.category)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => startEdit(fn)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => toggleActive(fn)}
                        className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded ml-1"
                        title="Deactivate"
                      >
                        <ToggleRight className="h-4 w-4" />
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Inactive */}
      {inactive.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Inactive ({inactive.length})</h3>
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-1">
            {inactive.map(fn => (
              <div key={fn.file_name_id} className="flex items-center justify-between text-sm text-gray-500 py-1">
                <span>{fn.name}</span>
                <button
                  onClick={() => toggleActive(fn)}
                  className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
                  title="Reactivate"
                >
                  <ToggleLeft className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
