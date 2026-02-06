# Modal Patterns Guide

## Overview

This guide establishes the standard patterns for implementing modals in the Nexus application. All modals should provide consistent UX through ESC key support, click-outside-to-close behavior, and mobile scroll locking.

## Quick Start: Standard Modal Pattern

### Using useModalBackdrop Hook (Recommended)

The `useModalBackdrop` hook provides a complete solution for modal interactions:

```typescript
import { useModalBackdrop } from '../hooks/useModalBackdrop';

interface MyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MyModal: React.FC<MyModalProps> = ({ isOpen, onClose }) => {
  const {
    modalContentRef,
    handleBackdropMouseDown,
    handleBackdropMouseUp,
    isMobile
  } = useModalBackdrop({ isOpen, onClose });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
    >
      <div
        ref={modalContentRef}
        className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4"
      >
        <h2 className="text-xl font-bold mb-4">Modal Title</h2>
        {/* Modal content */}
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
};
```

**What you get automatically:**
- ✅ ESC key closes modal (with proper event propagation control)
- ✅ Click outside modal content closes modal (mouseDown/mouseUp pattern)
- ✅ Mobile body scroll lock
- ✅ Prevents accidental closes from click-drag operations

## Hook API Reference

### useModalBackdrop

**Location**: `/home/jon/Nexus/frontend/web/src/hooks/useModalBackdrop.ts`

**Purpose**: Manages all modal interaction behavior in a single hook.

**Parameters**:
```typescript
interface UseModalBackdropOptions {
  isOpen: boolean;           // Whether the modal is currently open
  onClose: () => void;       // Function to call when modal should close
  preventClose?: boolean;    // Optional: prevent ESC/click-outside from closing
  additionalRefs?: RefObject<HTMLElement>[]; // Optional: additional elements to treat as "inside"
}
```

**Returns**:
```typescript
{
  modalContentRef: RefObject<HTMLDivElement>;  // Attach to modal content container
  handleBackdropMouseDown: (e: React.MouseEvent) => void;  // Attach to backdrop div
  handleBackdropMouseUp: (e: React.MouseEvent) => void;    // Attach to backdrop div
  isMobile: boolean;  // True if viewport is mobile-sized
}
```

**Usage**:
```typescript
const {
  modalContentRef,
  handleBackdropMouseDown,
  handleBackdropMouseUp,
  isMobile
} = useModalBackdrop({ isOpen, onClose });

// In JSX:
<div onMouseDown={handleBackdropMouseDown} onMouseUp={handleBackdropMouseUp}>
  <div ref={modalContentRef}>
    {/* content */}
  </div>
</div>
```

### useBodyScrollLock

**Location**: `/home/jon/Nexus/frontend/web/src/hooks/useBodyScrollLock.ts`

**Purpose**: Prevents body scroll when modal is open (mobile-friendly).

**Note**: `useModalBackdrop` already includes this functionality. Only use directly if you need manual control.

**Usage**:
```typescript
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

// In component:
useBodyScrollLock(isOpen); // Locks scroll when isOpen is true
```

### useIsMobile

**Location**: `/home/jon/Nexus/frontend/web/src/hooks/useMediaQuery.ts`

**Purpose**: Detects mobile viewport size.

**Note**: `useModalBackdrop` already provides this via its return value. Only import directly if needed outside modal context.

**Usage**:
```typescript
import { useIsMobile } from '../hooks/useMediaQuery';

const isMobile = useIsMobile();
```

## Migration Guide

### Converting Manual ESC Key Implementation

**Before** (manual implementation):
```typescript
useEffect(() => {
  if (!isOpen) return;

  const handleEscKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopImmediatePropagation();
      onClose();
    }
  };

  document.addEventListener('keydown', handleEscKey);
  return () => document.removeEventListener('keydown', handleEscKey);
}, [isOpen, onClose]);
```

**After** (using hook):
```typescript
const { modalContentRef, handleBackdropMouseDown, handleBackdropMouseUp } =
  useModalBackdrop({ isOpen, onClose });

// Remove the useEffect above - hook handles it
```

### Converting Manual Click-Outside Implementation

**Before** (manual implementation):
```typescript
const modalContentRef = useRef<HTMLDivElement>(null);
const mouseDownOutsideRef = useRef(false);

const handleBackdropMouseDown = (e: React.MouseEvent) => {
  if (modalContentRef.current && !modalContentRef.current.contains(e.target as Node)) {
    mouseDownOutsideRef.current = true;
  }
};

const handleBackdropMouseUp = (e: React.MouseEvent) => {
  if (mouseDownOutsideRef.current &&
      modalContentRef.current &&
      !modalContentRef.current.contains(e.target as Node)) {
    onClose();
  }
  mouseDownOutsideRef.current = false;
};
```

**After** (using hook):
```typescript
const { modalContentRef, handleBackdropMouseDown, handleBackdropMouseUp } =
  useModalBackdrop({ isOpen, onClose });

// Remove all the manual refs and handlers above - hook provides them
```

### Complete Migration Example

**Before**:
```typescript
export const MyModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const modalContentRef = useRef<HTMLDivElement>(null);
  const mouseDownOutsideRef = useRef(false);
  const isMobile = useIsMobile();

  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopImmediatePropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, [isOpen, onClose]);

  const handleBackdropMouseDown = (e: React.MouseEvent) => {
    if (modalContentRef.current && !modalContentRef.current.contains(e.target as Node)) {
      mouseDownOutsideRef.current = true;
    }
  };

  const handleBackdropMouseUp = (e: React.MouseEvent) => {
    if (mouseDownOutsideRef.current &&
        modalContentRef.current &&
        !modalContentRef.current.contains(e.target as Node)) {
      onClose();
    }
    mouseDownOutsideRef.current = false;
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50"
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
    >
      <div ref={modalContentRef} className="bg-white p-6">
        {/* content */}
      </div>
    </div>
  );
};
```

**After**:
```typescript
import { useModalBackdrop } from '../hooks/useModalBackdrop';

export const MyModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const {
    modalContentRef,
    handleBackdropMouseDown,
    handleBackdropMouseUp,
    isMobile
  } = useModalBackdrop({ isOpen, onClose });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50"
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
    >
      <div ref={modalContentRef} className="bg-white p-6">
        {/* content */}
      </div>
    </div>
  );
};
```

**Changes made**:
1. ✅ Added `useModalBackdrop` import
2. ✅ Replaced hook call with all manual implementations
3. ✅ Removed manual refs (modalContentRef, mouseDownOutsideRef)
4. ✅ Removed manual useEffect for ESC key
5. ✅ Removed manual backdrop handlers
6. ✅ Removed manual useBodyScrollLock call
7. ✅ Used hook's returned values

## Code Examples

### Example 1: Basic Modal

```typescript
import { useModalBackdrop } from '../hooks/useModalBackdrop';

interface BasicModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const BasicModal: React.FC<BasicModalProps> = ({
  isOpen,
  onClose,
  title,
  children
}) => {
  const {
    modalContentRef,
    handleBackdropMouseDown,
    handleBackdropMouseUp
  } = useModalBackdrop({ isOpen, onClose });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
    >
      <div
        ref={modalContentRef}
        className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full mx-4"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};
```

### Example 2: Modal with Additional Refs (Preview Panel)

Some modals have additional elements (like preview panels) that should be treated as "inside" the modal:

```typescript
import { useRef } from 'react';
import { useModalBackdrop } from '../hooks/useModalBackdrop';

export const ModalWithPreview: React.FC<Props> = ({ isOpen, onClose }) => {
  const previewPanelRef = useRef<HTMLDivElement>(null);

  const {
    modalContentRef,
    handleBackdropMouseDown,
    handleBackdropMouseUp
  } = useModalBackdrop({
    isOpen,
    onClose,
    additionalRefs: [previewPanelRef]  // Preview panel won't trigger close
  });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50"
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
    >
      <div ref={modalContentRef} className="bg-white">
        {/* Main modal content */}
      </div>
      <div ref={previewPanelRef} className="bg-gray-100">
        {/* Preview panel - clicking here won't close modal */}
      </div>
    </div>
  );
};
```

### Example 3: Preventing Close During Operations

For modals that should not close during critical operations (like file uploads):

```typescript
export const UploadModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [isUploading, setIsUploading] = useState(false);

  const {
    modalContentRef,
    handleBackdropMouseDown,
    handleBackdropMouseUp
  } = useModalBackdrop({
    isOpen,
    onClose,
    preventClose: isUploading  // Disables ESC and click-outside when uploading
  });

  // ... upload logic
};
```

### Example 4: Mobile-Responsive Modal

Using the `isMobile` value from the hook:

```typescript
export const ResponsiveModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const {
    modalContentRef,
    handleBackdropMouseDown,
    handleBackdropMouseUp,
    isMobile
  } = useModalBackdrop({ isOpen, onClose });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50"
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
    >
      <div
        ref={modalContentRef}
        className={`bg-white ${
          isMobile
            ? 'fixed inset-x-0 bottom-0 rounded-t-lg'  // Bottom sheet on mobile
            : 'rounded-lg max-w-2xl mx-auto mt-20'      // Centered on desktop
        }`}
      >
        {/* content */}
      </div>
    </div>
  );
};
```

## Best Practices

### 1. Always Use useModalBackdrop for Complex Modals

Any modal with forms, multiple states, or user interactions should use the hook:

```typescript
✅ DO: Use useModalBackdrop for forms, editors, multi-step flows
❌ DON'T: Manually implement ESC/click-outside for complex modals
```

### 2. Z-Index Management

Standard z-index values across the application:

- **z-50**: Standard modals (most common)
- **z-60**: Nested modals (modals opened from other modals)
- **z-70**: Alert/confirmation system (AlertContext)
- **z-9999**: System-critical modals (SessionExpiredModal)

```typescript
// Standard modal
<div className="fixed inset-0 bg-black bg-opacity-50 z-50">

// Nested modal
<div className="fixed inset-0 bg-black bg-opacity-50 z-60">

// Alert (via AlertContext - automatic)
<div className="fixed inset-0 bg-black bg-opacity-50 z-70">
```

### 3. When to Use AlertContext vs Custom Modal

**Use AlertContext** for:
- Simple alerts (success, error, warning, info messages)
- Yes/No confirmations
- Quick user notifications

```typescript
import { useAlert } from '../contexts/AlertContext';

const { showSuccess, showError, showConfirmation } = useAlert();

// Simple alert
showSuccess('Item saved successfully!');

// Confirmation
const confirmed = await showConfirmation('Delete this item?');
if (confirmed) {
  // proceed with deletion
}
```

**Use Custom Modal** for:
- Forms with multiple fields
- Complex data displays
- Multi-step workflows
- Modals with preview panels or special layouts

### 4. Accessibility Considerations

**Focus Management**:
```typescript
// Add focus trap if needed
useEffect(() => {
  if (isOpen && modalContentRef.current) {
    const firstInput = modalContentRef.current.querySelector('input, button');
    if (firstInput instanceof HTMLElement) {
      firstInput.focus();
    }
  }
}, [isOpen]);
```

**ARIA Attributes**:
```typescript
<div
  ref={modalContentRef}
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  className="bg-white rounded-lg p-6"
>
  <h2 id="modal-title" className="text-xl font-bold">
    Modal Title
  </h2>
  {/* content */}
</div>
```

### 5. Modal Props Interface Standard

Consistent props interface for all modals:

```typescript
interface ModalProps {
  isOpen: boolean;        // REQUIRED: Controls modal visibility
  onClose: () => void;    // REQUIRED: Called when modal should close
  // ... other specific props
}
```

### 6. Early Return Pattern

Always check `isOpen` and return early:

```typescript
export const MyModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { modalContentRef, handleBackdropMouseDown, handleBackdropMouseUp } =
    useModalBackdrop({ isOpen, onClose });

  if (!isOpen) return null;  // ✅ Early return - prevents rendering

  return (/* modal JSX */);
};
```

## Special Cases

### Case 1: Nested Modals (Parent/Child)

When opening a modal from within another modal:

```typescript
// Parent modal
export const ParentModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [childOpen, setChildOpen] = useState(false);

  const {
    modalContentRef,
    handleBackdropMouseDown,
    handleBackdropMouseUp
  } = useModalBackdrop({ isOpen, onClose });

  return (
    <>
      <div className="... z-50" /* parent at z-50 */>
        <div ref={modalContentRef}>
          <button onClick={() => setChildOpen(true)}>Open Child</button>
        </div>
      </div>

      {/* Child modal at higher z-index */}
      <ChildModal
        isOpen={childOpen}
        onClose={() => setChildOpen(false)}
      />
    </>
  );
};

// Child modal
export const ChildModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { modalContentRef, handleBackdropMouseDown, handleBackdropMouseUp } =
    useModalBackdrop({ isOpen, onClose });

  return (
    <div className="... z-60" /* child at z-60 - higher than parent */>
      <div ref={modalContentRef}>
        {/* child content */}
      </div>
    </div>
  );
};
```

**Key Points**:
- Parent modal uses `z-50`
- Child modal uses `z-60` (higher than parent)
- ESC key automatically closes only the top modal (proper event propagation)
- Each modal has independent state management

### Case 2: Modals Without `isOpen` Prop

Some legacy modals don't have an `isOpen` prop. Two migration options:

**Option A: Refactor to Controlled Component (Preferred)**

Add `isOpen` prop to match standard pattern:

```typescript
// Before
interface ModalProps {
  onClose: () => void;
}

// After
interface ModalProps {
  isOpen: boolean;  // Add this
  onClose: () => void;
}

// Update parent component usage
const [isOpen, setIsOpen] = useState(false);
<MyModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
```

**Option B: Add ESC Key Only (Minimal Change)**

If full refactoring is not feasible, add minimal ESC support:

```typescript
export const LegacyModal: React.FC<Props> = ({ onClose }) => {
  // Add simple ESC handler
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Keep existing simple onClick backdrop
  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>
        {/* content */}
      </div>
    </div>
  );
};
```

### Case 3: BaseModal Reusable Component

For a reusable base modal component, add optional ESC support:

```typescript
interface BaseModalProps {
  isOpen?: boolean;        // Optional for backwards compatibility
  onClose: () => void;
  enableStandardBehavior?: boolean;  // Opt-in to useModalBackdrop
  children: React.ReactNode;
}

export const BaseModal: React.FC<BaseModalProps> = ({
  isOpen,
  onClose,
  enableStandardBehavior = false,
  children
}) => {
  // Conditionally use hook
  const modalBehavior = enableStandardBehavior && isOpen !== undefined
    ? useModalBackdrop({ isOpen, onClose })
    : null;

  const modalContentRef = modalBehavior?.modalContentRef ?? useRef<HTMLDivElement>(null);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50"
      onClick={!enableStandardBehavior ? onClose : undefined}
      onMouseDown={modalBehavior?.handleBackdropMouseDown}
      onMouseUp={modalBehavior?.handleBackdropMouseUp}
    >
      <div
        ref={modalContentRef}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};
```

## Migration Checklist

When migrating a modal to use `useModalBackdrop`:

- [ ] Import `useModalBackdrop` hook
- [ ] Replace manual ESC key useEffect
- [ ] Replace manual click-outside handlers
- [ ] Remove duplicate refs (modalContentRef, mouseDownOutsideRef)
- [ ] Attach hook returns to backdrop div (`onMouseDown`, `onMouseUp`)
- [ ] Attach `modalContentRef` to modal content div
- [ ] Remove manual `useBodyScrollLock` call (if present)
- [ ] Remove manual `useIsMobile` import (if only used for scroll lock)
- [ ] Test ESC key closes modal
- [ ] Test click-outside closes modal
- [ ] Test click-drag from inside to outside does NOT close
- [ ] Test mobile body scroll lock
- [ ] Verify no console errors
- [ ] Verify all form interactions work as before

## Examples in Codebase

**Reference implementations**:
- `/home/jon/Nexus/frontend/web/src/components/orders/modals/CashPaymentModal.tsx` - Clean example
- `/home/jon/Nexus/frontend/web/src/components/orders/modals/RecordPaymentModal.tsx` - With form handling
- `/home/jon/Nexus/frontend/web/src/components/supplyChain/SupplierProductEditor.tsx` - Complex editor modal

**Hook source**:
- `/home/jon/Nexus/frontend/web/src/hooks/useModalBackdrop.ts` - Main hook implementation
- `/home/jon/Nexus/frontend/web/src/hooks/useBodyScrollLock.ts` - Body scroll lock
- `/home/jon/Nexus/frontend/web/src/hooks/useMediaQuery.ts` - Mobile detection

## Troubleshooting

### ESC Key Not Working

**Symptom**: Pressing ESC doesn't close the modal.

**Check**:
1. Is `isOpen` prop passed to `useModalBackdrop`?
2. Is the modal actually using the hook's return values?
3. Are there nested modals? (ESC should only close the topmost)
4. Check for `preventClose: true` in hook options

### Click-Outside Not Working

**Symptom**: Clicking outside doesn't close the modal.

**Check**:
1. Are `handleBackdropMouseDown` and `handleBackdropMouseUp` attached to backdrop div?
2. Is `modalContentRef` attached to the content div?
3. Are there `additionalRefs` that might be capturing the click?

### Body Still Scrolls on Mobile

**Symptom**: Background scrolls when modal is open on mobile.

**Check**:
1. Is `useModalBackdrop` hook called with correct `isOpen` value?
2. Hook automatically handles scroll lock - don't add manual `useBodyScrollLock`

### Modal Closes on Click-Drag

**Symptom**: Starting click inside modal and releasing outside closes it.

**Solution**: This is the correct behavior of `useModalBackdrop` - it uses mouseDown/mouseUp pattern to prevent accidental closes from drag operations.

## Summary

- **Always use `useModalBackdrop`** for modals with forms or complex interactions
- **Hook provides**: ESC key, click-outside, mobile scroll lock
- **Standard props**: `isOpen: boolean`, `onClose: () => void`
- **Z-index**: Use `z-50` for standard modals
- **AlertContext**: Use for simple alerts/confirmations
- **Migration**: Follow the checklist and test thoroughly

For questions or issues, see CODE_STANDARDS.md or consult the engineering team.
