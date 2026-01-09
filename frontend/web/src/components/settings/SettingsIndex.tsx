/**
 * SettingsIndex - Card Grid Navigation
 * Displays available settings categories as clickable cards
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { List, CheckSquare, Grid3X3, Users, Mail, History, Lightbulb, Layers, LucideIcon } from 'lucide-react';
import { settingsApi, SettingsCategory } from '../../services/api/settings';

// Map icon names from database to Lucide components
const iconMap: Record<string, LucideIcon> = {
  List,
  CheckSquare,
  Grid3X3,
  Users,
  Mail,
  History,
  Lightbulb,
  Layers
};

// Fallback cards for when API is loading or fails
const fallbackCategories: SettingsCategory[] = [
  {
    category_id: 1,
    category_key: 'specifications',
    display_name: 'Specification Options',
    description: 'Manage dropdown options for order specifications',
    icon_name: 'List',
    route_path: '/settings/specifications',
    display_order: 1,
    required_role: 'manager',
    is_active: true
  }
];

export const SettingsIndex: React.FC = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<SettingsCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await settingsApi.getCategories();
        setCategories(data);
      } catch (err) {
        console.error('Failed to load settings categories:', err);
        setError('Failed to load settings categories');
        // Use fallback categories
        setCategories(fallbackCategories);
      } finally {
        setLoading(false);
      }
    };

    loadCategories();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-10 h-10 border-4 border-gray-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
          {error} - Showing available options.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map(category => {
          const Icon = iconMap[category.icon_name || 'List'] || List;

          return (
            <button
              key={category.category_key}
              onClick={() => navigate(category.route_path)}
              className="bg-white rounded-xl shadow-md p-6 text-left hover:shadow-lg transition-all duration-200 border border-gray-200 hover:border-gray-300 group"
            >
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-gray-200 transition-colors">
                <Icon className="h-6 w-6 text-gray-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-1">
                {category.display_name}
              </h3>
              <p className="text-sm text-gray-500 mb-3">
                {category.description}
              </p>
              <span className="inline-block text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                {category.required_role === 'owner' ? 'Owner only' : 'Manager+'}
              </span>
            </button>
          );
        })}
      </div>

      {categories.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-500">
          No settings categories available for your role.
        </div>
      )}
    </div>
  );
};

export default SettingsIndex;
