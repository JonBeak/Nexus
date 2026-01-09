/**
 * Spec Tab Navigation Utility
 *
 * Handles tab navigation in the SPECs section:
 * - Tab moves right first (template → spec1 → spec2 → spec3)
 * - If nothing on right, moves to first cell of next row
 * - Shift+Tab moves left first, then to last cell of previous row
 */

// Column indices: 0=template, 1=spec1, 2=spec2, 3=spec3
const MAX_COL = 3;

/**
 * Try to focus an element at the given position
 * @returns true if element was found and focused
 */
function tryFocus(partId: number, row: number, col: number): boolean {
  const selector = `[data-spec-part="${partId}"][data-spec-row="${row}"][data-spec-col="${col}"]`;
  const element = document.querySelector<HTMLElement>(selector);

  console.log(`[SpecTab] Looking for: part=${partId}, row=${row}, col=${col} -> ${element ? 'FOUND' : 'NOT FOUND'}`);

  if (element && !element.hasAttribute('disabled')) {
    element.focus();
    return true;
  }
  return false;
}

/**
 * Find the maximum row number for a given part
 */
function getMaxRow(partId: number): number {
  const elements = document.querySelectorAll(`[data-spec-part="${partId}"][data-spec-row]`);
  let maxRow = 0;
  elements.forEach(el => {
    const row = parseInt(el.getAttribute('data-spec-row') || '0', 10);
    if (row > maxRow) maxRow = row;
  });
  return maxRow;
}

/**
 * Focus the next tabbable element after the specs section
 * This is used when we've reached the end of the specs and need to exit
 */
function focusNextAfterSpecs(partId: number, e: React.KeyboardEvent): void {
  // Get all spec elements for this part
  const specElements = document.querySelectorAll(`[data-spec-part="${partId}"]`);
  if (specElements.length === 0) return;

  // Find the last spec element in DOM order
  const lastSpecElement = specElements[specElements.length - 1];

  // Get all tabbable elements on the page
  const tabbableSelector = 'input:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';
  const allTabbable = Array.from(document.querySelectorAll<HTMLElement>(tabbableSelector));

  // Find the index of the last spec element
  const lastSpecIndex = allTabbable.indexOf(lastSpecElement as HTMLElement);
  if (lastSpecIndex === -1) return;

  // Find the next tabbable element that's NOT a spec element for this part
  for (let i = lastSpecIndex + 1; i < allTabbable.length; i++) {
    const el = allTabbable[i];
    if (el.getAttribute('data-spec-part') !== String(partId)) {
      e.preventDefault();
      el.focus();
      return;
    }
  }
}

/**
 * Handle Tab key navigation in spec fields
 * Tab: move right, then to next row's first column
 * Shift+Tab: move left, then to previous row's last column
 */
export function handleSpecTabNavigation(
  e: React.KeyboardEvent,
  partId: number,
  currentRow: number,
  currentCol: number
): void {
  if (e.key !== 'Tab') return;

  console.log(`[SpecTab] Tab pressed at: part=${partId}, row=${currentRow}, col=${currentCol}`);

  const isShiftTab = e.shiftKey;

  if (isShiftTab) {
    // Shift+Tab: try each column to the left in current row
    for (let col = currentCol - 1; col >= 0; col--) {
      if (tryFocus(partId, currentRow, col)) {
        e.preventDefault();
        return;
      }
    }

    // No cell on left, try previous row's rightmost cell
    const prevRow = currentRow - 1;
    if (prevRow >= 1) {
      for (let col = MAX_COL; col >= 0; col--) {
        if (tryFocus(partId, prevRow, col)) {
          e.preventDefault();
          return;
        }
      }
    }
    // If no previous row, let default behavior handle it (exit specs section)
  } else {
    // Tab: try each column to the right in current row
    for (let col = currentCol + 1; col <= MAX_COL; col++) {
      if (tryFocus(partId, currentRow, col)) {
        e.preventDefault();
        return;
      }
    }

    // No cell on right, try next row's leftmost cell
    const nextRow = currentRow + 1;
    const maxRow = getMaxRow(partId);

    if (nextRow <= maxRow) {
      for (let col = 0; col <= MAX_COL; col++) {
        if (tryFocus(partId, nextRow, col)) {
          e.preventDefault();
          return;
        }
      }
    }

    // No more cells in specs section - focus next element after specs
    // This prevents browser from going to wrong element due to column-based DOM order
    focusNextAfterSpecs(partId, e);
  }
}
