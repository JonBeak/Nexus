/**
 * ValidationRulesManager - Main settings page for configurable validation rules
 * Tab-based: Expected Files | File Name Catalog | (Future: Validation Profiles)
 */

import React, { useState } from 'react';
import { FileCheck, FolderOpen } from 'lucide-react';
import { ExpectedFilesRulesPanel } from './ExpectedFilesRulesPanel';
import { StandardFileNamesPanel } from './StandardFileNamesPanel';

type Tab = 'expected_files' | 'file_catalog';

const TABS: { key: Tab; label: string; icon: React.ReactNode; description: string }[] = [
  {
    key: 'expected_files',
    label: 'Expected Files',
    icon: <FileCheck className="h-4 w-4" />,
    description: 'Rules that determine which files an order should contain',
  },
  {
    key: 'file_catalog',
    label: 'File Name Catalog',
    icon: <FolderOpen className="h-4 w-4" />,
    description: 'Standard file names used across rules',
  },
];

export const ValidationRulesManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('expected_files');

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Description */}
      <p className="text-sm text-gray-500 mb-4">
        {TABS.find(t => t.key === activeTab)?.description}
      </p>

      {/* Tab content */}
      {activeTab === 'expected_files' && <ExpectedFilesRulesPanel />}
      {activeTab === 'file_catalog' && <StandardFileNamesPanel />}
    </div>
  );
};
