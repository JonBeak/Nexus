import React from 'react';

interface CollapsiblePanelProps {
  title: string;
  isCollapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  side: 'left' | 'right';
}

/**
 * CollapsiblePanel - A panel that can collapse into a vertical bar with rotated text.
 * Used in Prepare to Send mode for mutually exclusive left panels.
 *
 * Always renders children to preserve state - uses CSS to hide/show.
 */
export const CollapsiblePanel: React.FC<CollapsiblePanelProps> = ({
  title,
  isCollapsed,
  onToggle,
  children,
  side
}) => {
  return (
    <div className={`collapsible-panel ${isCollapsed ? 'collapsible-panel--collapsed' : 'collapsible-panel--expanded'}`}>
      {/* Collapsed bar - always rendered, hidden when expanded */}
      <div
        className={`collapsible-panel-collapsed collapsible-panel-collapsed-${side}`}
        onClick={onToggle}
        role="button"
        tabIndex={isCollapsed ? 0 : -1}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        aria-expanded={!isCollapsed}
        aria-label={`Expand ${title}`}
        style={{ display: isCollapsed ? 'flex' : 'none' }}
      >
        <span className="collapsible-panel-label">{title}</span>
      </div>

      {/* Expanded content - always rendered, hidden when collapsed */}
      <div
        className="collapsible-panel-expanded"
        style={{ display: isCollapsed ? 'none' : 'flex' }}
      >
        {children}
      </div>
    </div>
  );
};

export default CollapsiblePanel;
