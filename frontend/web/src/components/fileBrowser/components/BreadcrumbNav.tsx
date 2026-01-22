/**
 * Breadcrumb Navigation Component
 * Shows the current path with clickable segments
 */

import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { PAGE_STYLES } from '../../../constants/moduleColors';

interface BreadcrumbNavProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export function BreadcrumbNav({ currentPath, onNavigate }: BreadcrumbNavProps) {
  // Split path into segments
  const segments = currentPath === '/' ? [] : currentPath.split('/').filter(Boolean);

  // Build paths for each segment
  const paths: { name: string; path: string }[] = [
    { name: 'Root', path: '/' }
  ];

  let currentBuildPath = '';
  for (const segment of segments) {
    currentBuildPath += '/' + segment;
    paths.push({ name: segment, path: currentBuildPath });
  }

  return (
    <nav className="flex items-center flex-wrap gap-1 text-sm">
      {paths.map((item, index) => (
        <React.Fragment key={item.path}>
          {index > 0 && (
            <ChevronRight className={`w-4 h-4 ${PAGE_STYLES.panel.textMuted} flex-shrink-0`} />
          )}
          <button
            onClick={() => onNavigate(item.path)}
            className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
              index === paths.length - 1
                ? `${PAGE_STYLES.panel.text} font-semibold`
                : `${PAGE_STYLES.panel.textMuted} hover:${PAGE_STYLES.panel.text} ${PAGE_STYLES.interactive.hover}`
            }`}
          >
            {index === 0 ? (
              <>
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline">Root</span>
              </>
            ) : (
              <span className="max-w-[200px] truncate">{item.name}</span>
            )}
          </button>
        </React.Fragment>
      ))}
    </nav>
  );
}
