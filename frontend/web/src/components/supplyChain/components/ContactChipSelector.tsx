/**
 * Contact Chip Selector
 * Reusable To/CC/BCC field with selectable contact chips, dropdown, and manual email entry.
 * Created: 2026-02-10
 */

import React, { useState, useRef, useEffect } from 'react';
import { X, Star, ChevronDown } from 'lucide-react';
import { PAGE_STYLES } from '../../../constants/moduleColors';
import type { SupplierContact } from '../../../services/api/suppliersApi';

export interface ContactChip {
  id: string;
  name: string;
  email: string;
  isManual: boolean;
}

interface ContactChipSelectorProps {
  label: string;
  contacts: SupplierContact[];
  selected: ContactChip[];
  onAdd: (chip: ContactChip) => void;
  onRemove: (chipId: string) => void;
  allowManualEntry?: boolean;
}

export const ContactChipSelector: React.FC<ContactChipSelectorProps> = ({
  label,
  contacts,
  selected,
  onAdd,
  onRemove,
  allowManualEntry = true,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selectedIds = new Set(selected.map(c => c.id));
  const availableContacts = contacts.filter(
    c => c.is_active && c.email && !selectedIds.has(`contact-${c.contact_id}`)
  );

  const handleSelectContact = (contact: SupplierContact) => {
    onAdd({
      id: `contact-${contact.contact_id}`,
      name: contact.name,
      email: contact.email || '',
      isManual: false,
    });
    setShowDropdown(false);
    setInputValue('');
  };

  const handleManualEntry = () => {
    const email = inputValue.trim();
    if (!email || !email.includes('@')) return;
    // Avoid duplicates
    if (selected.some(c => c.email.toLowerCase() === email.toLowerCase())) {
      setInputValue('');
      return;
    }
    onAdd({
      id: `manual-${Date.now()}`,
      name: email.split('@')[0],
      email,
      isManual: true,
    });
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleManualEntry();
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-start gap-1.5">
        <label className={`text-xs font-medium ${PAGE_STYLES.panel.textSecondary} pt-1.5 w-8 shrink-0`}>
          {label}
        </label>
        <div
          className={`flex-1 flex flex-wrap items-center gap-1 px-1.5 py-1 min-h-[30px] ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} border rounded-md cursor-text`}
          onClick={() => inputRef.current?.focus()}
        >
          {selected.map((chip) => (
            <span
              key={chip.id}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded text-[11px] max-w-[200px]"
              title={`${chip.name} <${chip.email}>`}
            >
              <span className="truncate">
                {chip.isManual ? chip.email : `${chip.name} (${chip.email})`}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(chip.id); }}
                className="ml-0.5 hover:text-red-600 shrink-0"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}

          <div className="flex items-center gap-0.5 flex-1 min-w-[80px]">
            {allowManualEntry && (
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => availableContacts.length > 0 && setShowDropdown(true)}
                placeholder={selected.length === 0 ? 'Type email or select...' : ''}
                className={`flex-1 bg-transparent outline-none text-xs ${PAGE_STYLES.panel.text} min-w-[60px]`}
              />
            )}
            {availableContacts.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowDropdown(!showDropdown); }}
                className={`p-0.5 ${PAGE_STYLES.panel.textMuted} hover:${PAGE_STYLES.panel.text}`}
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Dropdown */}
      {showDropdown && availableContacts.length > 0 && (
        <div className={`absolute left-8 right-0 mt-1 z-20 ${PAGE_STYLES.panel.background} border ${PAGE_STYLES.panel.border} rounded-md shadow-lg max-h-40 overflow-y-auto`}>
          {availableContacts.map((contact) => (
            <button
              key={contact.contact_id}
              onClick={() => handleSelectContact(contact)}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-2 ${PAGE_STYLES.panel.text}`}
            >
              {contact.is_primary && <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />}
              <div className="flex-1 min-w-0">
                <span className="font-medium">{contact.name}</span>
                <span className={`ml-1.5 ${PAGE_STYLES.panel.textMuted}`}>{contact.email}</span>
              </div>
              {contact.role && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${PAGE_STYLES.panel.textMuted} bg-gray-100 dark:bg-gray-800 shrink-0`}>
                  {contact.role}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
