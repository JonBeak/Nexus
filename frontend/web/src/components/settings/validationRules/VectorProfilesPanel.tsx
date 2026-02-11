/**
 * VectorProfilesPanel - Edit vector validation profile parameters
 * Each profile is a card with editable parameter fields grouped by category.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Save, RefreshCw, ChevronDown, ChevronRight, ToggleLeft, ToggleRight } from 'lucide-react';
import { validationRulesApi } from '../../../services/api/validationRulesApi';
import { VectorValidationProfile } from '../../../types/aiFileValidation';

/** Categorize parameters for display */
const PARAM_CATEGORIES: Record<string, { label: string; keys: string[] }> = {
  layers: {
    label: 'Layer Names',
    keys: ['return_layer', 'trim_layer', 'face_layer', 'backer_layer', 'acrylic_layer', 'lexan_layer'],
  },
  scale: {
    label: 'Scale',
    keys: ['file_scale'],
  },
  offsets: {
    label: 'Offsets & Tolerances',
    keys: [
      'trim_offset_min_mm', 'trim_offset_max_mm', 'miter_factor',
      'face_offset_min_mm', 'engraving_offset_mm', 'engraving_offset_tolerance_mm',
      'cutout_offset_mm', 'cutout_offset_tolerance_mm',
      'led_box_offset_inches', 'led_box_offset_tolerance_inches',
    ],
  },
  spacing: {
    label: 'Spacing',
    keys: ['min_trim_spacing_inches', 'min_face_spacing_inches', 'min_acrylic_inset_from_box_inches', 'lexan_inset_from_box_inches'],
  },
  holes: {
    label: 'Mounting Holes',
    keys: ['min_mounting_holes', 'mounting_holes_per_inch_perimeter', 'mounting_holes_per_sq_inch_area', 'check_wire_holes', 'expected_mounting_names'],
  },
  radii: {
    label: 'Corner Radii',
    keys: [
      'acrylic_convex_radius_inches', 'acrylic_concave_radius_inches',
      'cutout_convex_radius_inches', 'cutout_concave_radius_inches',
      'corner_radius_tolerance_pct',
    ],
  },
};

/** Human-readable labels for parameter keys */
const PARAM_LABELS: Record<string, string> = {
  file_scale: 'File Scale',
  return_layer: 'Return Layer',
  trim_layer: 'Trim Cap Layer',
  face_layer: 'Face Layer',
  backer_layer: 'Backer Layer',
  acrylic_layer: 'Acrylic Layer',
  lexan_layer: 'Lexan Layer',
  trim_offset_min_mm: 'Trim Offset Min (mm)',
  trim_offset_max_mm: 'Trim Offset Max (mm)',
  miter_factor: 'Miter Factor',
  face_offset_min_mm: 'Face Offset Min (mm)',
  engraving_offset_mm: 'Engraving Offset (mm)',
  engraving_offset_tolerance_mm: 'Engraving Offset Tolerance (mm)',
  cutout_offset_mm: 'Cutout Offset (mm)',
  cutout_offset_tolerance_mm: 'Cutout Offset Tolerance (mm)',
  led_box_offset_inches: 'LED Box Offset (in)',
  led_box_offset_tolerance_inches: 'LED Box Offset Tolerance (in)',
  min_trim_spacing_inches: 'Min Trim Spacing (in)',
  min_face_spacing_inches: 'Min Face Spacing (in)',
  min_acrylic_inset_from_box_inches: 'Min Acrylic Inset from Box (in)',
  lexan_inset_from_box_inches: 'Lexan Inset from Box (in)',
  min_mounting_holes: 'Min Mounting Holes',
  mounting_holes_per_inch_perimeter: 'Holes per Inch Perimeter',
  mounting_holes_per_sq_inch_area: 'Holes per Sq Inch Area',
  check_wire_holes: 'Check Wire Holes',
  expected_mounting_names: 'Expected Mounting Types',
  acrylic_convex_radius_inches: 'Acrylic Convex Radius (in)',
  acrylic_concave_radius_inches: 'Acrylic Concave Radius (in)',
  cutout_convex_radius_inches: 'Cutout Convex Radius (in)',
  cutout_concave_radius_inches: 'Cutout Concave Radius (in)',
  corner_radius_tolerance_pct: 'Corner Radius Tolerance (%)',
};

interface ProfileEditorProps {
  profile: VectorValidationProfile;
  onSaved: () => void;
}

const ProfileEditor: React.FC<ProfileEditorProps> = ({ profile, onSaved }) => {
  const [params, setParams] = useState<Record<string, any>>({ ...profile.parameters });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['layers', 'offsets', 'holes', 'spacing', 'radii', 'scale']));

  // Reset when profile changes
  useEffect(() => {
    setParams({ ...profile.parameters });
    setDirty(false);
  }, [profile]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const updateParam = (key: string, value: any) => {
    setParams(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await validationRulesApi.updateVectorProfile(profile.profile_id, { parameters: params });
      setDirty(false);
      onSaved();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  // Group the profile's parameters into categories
  const paramKeys = Object.keys(params);
  const categorizedKeys = new Set(Object.values(PARAM_CATEGORIES).flatMap(c => c.keys));
  const uncategorizedKeys = paramKeys.filter(k => !categorizedKeys.has(k));

  const renderParamInput = (key: string, value: any) => {
    const label = PARAM_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    if (typeof value === 'boolean') {
      return (
        <div key={key} className="flex items-center justify-between py-1.5">
          <span className="text-sm text-gray-600">{label}</span>
          <button
            onClick={() => updateParam(key, !value)}
            className={`flex items-center gap-1 text-sm ${value ? 'text-emerald-600' : 'text-gray-400'}`}
          >
            {value ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
            {value ? 'Yes' : 'No'}
          </button>
        </div>
      );
    }

    if (Array.isArray(value)) {
      return (
        <div key={key} className="flex items-center justify-between py-1.5">
          <span className="text-sm text-gray-600">{label}</span>
          <input
            type="text"
            value={value.join(', ')}
            onChange={(e) => updateParam(key, e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            className="w-56 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      );
    }

    if (typeof value === 'number') {
      return (
        <div key={key} className="flex items-center justify-between py-1.5">
          <span className="text-sm text-gray-600">{label}</span>
          <input
            type="number"
            step="any"
            value={value}
            onChange={(e) => updateParam(key, parseFloat(e.target.value) || 0)}
            className="w-32 px-2 py-1 text-sm border border-gray-300 rounded text-right focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      );
    }

    // String
    return (
      <div key={key} className="flex items-center justify-between py-1.5">
        <span className="text-sm text-gray-600">{label}</span>
        <input
          type="text"
          value={value ?? ''}
          onChange={(e) => updateParam(key, e.target.value)}
          className="w-56 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
    );
  };

  const renderCategory = (catKey: string, catLabel: string, keys: string[]) => {
    const relevantKeys = keys.filter(k => k in params);
    if (relevantKeys.length === 0) return null;

    const expanded = expandedCategories.has(catKey);

    return (
      <div key={catKey} className="border-b border-gray-100 last:border-b-0">
        <button
          onClick={() => toggleCategory(catKey)}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:bg-gray-50"
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {catLabel}
          <span className="text-gray-300 font-normal">({relevantKeys.length})</span>
        </button>
        {expanded && (
          <div className="px-4 pb-2 space-y-0.5">
            {relevantKeys.map(k => renderParamInput(k, params[k]))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`bg-white border rounded-lg shadow-sm ${!profile.is_active ? 'opacity-60' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50 rounded-t-lg">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">{profile.display_name}</h3>
          {profile.description && (
            <p className="text-xs text-gray-500 mt-0.5">{profile.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!profile.is_active && (
            <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">Inactive</span>
          )}
          <span className="text-xs text-gray-400 font-mono">{profile.spec_type_key}</span>
        </div>
      </div>

      {/* Parameters */}
      <div className="divide-y divide-gray-100">
        {Object.entries(PARAM_CATEGORIES).map(([catKey, { label, keys }]) =>
          renderCategory(catKey, label, keys)
        )}
        {uncategorizedKeys.length > 0 && renderCategory('other', 'Other', uncategorizedKeys)}
      </div>

      {/* Footer with save */}
      {dirty && (
        <div className="flex items-center justify-end gap-2 px-4 py-3 bg-amber-50 border-t rounded-b-lg">
          <span className="text-xs text-amber-600 mr-auto">Unsaved changes</span>
          <button
            onClick={() => { setParams({ ...profile.parameters }); setDirty(false); }}
            className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800"
          >
            Discard
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="h-3 w-3" />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
};

export const VectorProfilesPanel: React.FC = () => {
  const [profiles, setProfiles] = useState<VectorValidationProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await validationRulesApi.getVectorProfiles();
      setProfiles(data);
    } catch (err) {
      console.error('Failed to load vector profiles:', err);
      setError('Failed to load vector validation profiles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-8">
        <RefreshCw className="h-4 w-4 animate-spin" />
        Loading profiles...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-600 py-4">
        {error}
        <button onClick={loadData} className="ml-2 text-blue-600 hover:underline">Retry</button>
      </div>
    );
  }

  if (profiles.length === 0) {
    return <p className="text-sm text-gray-500 py-4">No vector validation profiles found. Run the database migration to seed profiles.</p>;
  }

  return (
    <div className="space-y-4">
      {profiles.map(profile => (
        <ProfileEditor key={profile.profile_id} profile={profile} onSaved={loadData} />
      ))}
    </div>
  );
};
