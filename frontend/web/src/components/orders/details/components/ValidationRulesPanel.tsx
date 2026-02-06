/**
 * Validation Rules Panel
 * Displays the validation rules that will be applied to AI files,
 * grouped by category (Global, Front Lit, etc.)
 */

import React from 'react';
import { Shield, CheckSquare } from 'lucide-react';
import { PAGE_STYLES } from '../../../../constants/moduleColors';
import { ValidationRuleDisplay } from '../../../../types/aiFileValidation';

interface ValidationRulesPanelProps {
  rules: ValidationRuleDisplay[];
}

const ValidationRulesPanel: React.FC<ValidationRulesPanelProps> = ({ rules }) => {
  if (!rules || rules.length === 0) return null;

  // Group rules by category
  const grouped = rules.reduce<Record<string, ValidationRuleDisplay[]>>((acc, rule) => {
    if (!acc[rule.category]) acc[rule.category] = [];
    acc[rule.category].push(rule);
    return acc;
  }, {});

  // Sort categories: Global first, then alphabetical
  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    if (a === 'Global') return -1;
    if (b === 'Global') return 1;
    return a.localeCompare(b);
  });

  return (
    <div className={`${PAGE_STYLES.panel.background} rounded-lg border ${PAGE_STYLES.border} mt-4`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
        <Shield className={`w-4 h-4 ${PAGE_STYLES.panel.textMuted}`} />
        <h3 className={`font-medium ${PAGE_STYLES.panel.text}`}>Validation Rules</h3>
        <span className="text-xs text-gray-400">({rules.length})</span>
      </div>

      {/* Rule groups */}
      <div className="px-4 py-3 space-y-3">
        {sortedCategories.map((category) => (
          <div key={category}>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              {category}
            </h4>
            <ul className="space-y-1">
              {grouped[category].map((rule) => (
                <li key={rule.rule_key} className="flex items-start gap-2 text-sm">
                  <CheckSquare className="w-3.5 h-3.5 text-indigo-400 mt-0.5 flex-shrink-0" />
                  <span>
                    <span className="font-medium text-gray-700">{rule.name}</span>
                    <span className="text-gray-500"> — {rule.description}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ValidationRulesPanel;
