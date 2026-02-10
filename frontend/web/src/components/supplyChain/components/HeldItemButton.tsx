/**
 * Held Item Button Component
 * Shows held item status with edit/release options
 * Created: 2026-02-04
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Edit2, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { MaterialRequirement } from '../../../types/materialRequirements';

interface HeldItemButtonProps {
  requirement: MaterialRequirement;
  onEditHold: () => void;
  onReleaseHold: () => void;
}

export const HeldItemButton: React.FC<HeldItemButtonProps> = ({
  requirement,
  onEditHold,
  onReleaseHold,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  // Calculate menu position when opened
  useEffect(() => {
    if (showMenu && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
  }, [showMenu]);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node) &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  // Close on escape
  useEffect(() => {
    if (!showMenu) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowMenu(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showMenu]);

  // Determine display text
  const getDisplayText = () => {
    if (requirement.held_vinyl_id && requirement.held_vinyl_width != null && requirement.held_vinyl_length_yards != null) {
      const w = parseFloat(Number(requirement.held_vinyl_width).toFixed(2)).toString();
      const l = parseFloat(Number(requirement.held_vinyl_length_yards).toFixed(2)).toString();
      return (
        <span className="text-center leading-tight">
          <span className="block">In Stock - Holding:</span>
          <span className="block">{w} x {l} yd</span>
        </span>
      );
    }
    if (requirement.held_supplier_product_id && requirement.held_general_quantity) {
      return (
        <span className="text-center leading-tight">
          <span className="block">In Stock - Holding:</span>
          <span className="block">{requirement.held_general_quantity}</span>
        </span>
      );
    }
    return 'In Stock';
  };

  // Don't show if no hold exists
  if (!requirement.held_vinyl_id && !requirement.held_supplier_product_id) {
    return null;
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setShowMenu(!showMenu)}
        className="w-full px-1.5 py-[5px] text-xs font-medium rounded-none border border-green-300 bg-green-100 text-green-700 hover:bg-green-200 transition-colors flex items-center gap-1"
        title="Click to manage hold"
      >
        <span className="flex-1">{getDisplayText()}</span>
        <ChevronDown className="h-3 w-3 flex-shrink-0" />
      </button>

      {showMenu &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed bg-white border border-gray-200 rounded shadow-lg z-[9999] py-1 min-w-[120px]"
            style={{
              top: menuPosition.top,
              left: menuPosition.left,
            }}
          >
            <button
              onClick={() => {
                setShowMenu(false);
                onEditHold();
              }}
              className="w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 flex items-center gap-2"
            >
              <Edit2 className="h-3 w-3 text-gray-500" />
              Edit Hold
            </button>
            <button
              onClick={() => {
                setShowMenu(false);
                onReleaseHold();
              }}
              className="w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
              <X className="h-3 w-3" />
              Release Hold
            </button>
          </div>,
          document.body
        )}
    </>
  );
};

export default HeldItemButton;
