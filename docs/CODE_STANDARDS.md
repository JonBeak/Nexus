# Code Standards & Common Issue Solutions

Reference guide with detailed code examples for backend/frontend patterns and common pitfalls.
**Referenced from**: CLAUDE.md (one-liner rules) | **See also**: PROJECT_STRUCTURE.md (architecture overview)

---

## Backend Patterns

All backend code follows: **Route → Controller → Service → Repository → Database**

### Repository Layer — Database Access

```typescript
// Repository Layer - Database Access
import { query } from '../config/database';
import { RowDataPacket } from 'mysql2';

export class ExampleRepository {
  async findById(id: number): Promise<RowDataPacket | null> {
    const rows = await query(
      'SELECT * FROM table_name WHERE id = ?',
      [id]
    ) as RowDataPacket[];
    return rows.length > 0 ? rows[0] : null;
  }
}
```

### Service Layer — Business Logic

```typescript
// Service Layer - Business Logic
export class ExampleService {
  constructor(private repository: ExampleRepository) {}

  async getItemDetails(id: number) {
    const item = await this.repository.findById(id);
    if (!item) {
      throw new Error('Item not found');
    }
    // Business logic here
    return item;
  }
}
```

### Controller Layer — HTTP Handling

```typescript
// Controller Layer - HTTP Handling
import { Request, Response } from 'express';

export const exampleController = async (req: Request, res: Response) => {
  try {
    const data = await exampleService.getItemDetails(
      parseInt(req.params.id)
    );
    res.json({ success: true, data });
  } catch (error) {
    console.error('Controller error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Operation failed'
    });
  }
};
```

### Pattern locations

- Backend: `/home/jon/Nexus/backend/web/src/`
- Frontend: `/home/jon/Nexus/frontend/web/src/components/`

---

## Frontend Pattern

```typescript
import { useState, useEffect } from 'react';
import { apiClient } from '@/services/api';

interface Props {
  // Always define proper TypeScript interfaces
}

export const ExampleComponent = ({ }: Props) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Always handle loading and error states

  return (
    // Component JSX
  );
};
```

---

## Common Issues — Detailed Examples

### MySQL Boolean Comparison

MySQL returns `tinyint(1)` for boolean columns. Direct comparison can fail silently.

```typescript
// CORRECT - Use !! for boolean conversion
const rows = await query('SELECT * FROM users WHERE id = ?', [id]) as RowDataPacket[];
const isActive = !!rows[0].is_active; // Properly converts MySQL tinyint to boolean

// WRONG - Can cause type confusion
const isActive = rows[0].is_active; // May be 1 or 0, not true/false
```

### Database Credentials from .env

Hardcoded credentials or incorrect env variable names cause connection failures.

```typescript
// CORRECT - Use env variables
const connection = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};

// WRONG - Hardcoded or inconsistent variable names
const connection = {
  host: 'localhost',
  user: 'root',  // Never use root
  password: 'hardcoded123',
  database: 'sign_manufacturing'
};
```

### Database User Security

Using root creates security vulnerabilities. The `.env` file contains `DB_USER` and `DB_PASSWORD` — use these exclusively, never hardcode `'root'`.

### API Client — Auto-Unwrap and BaseURL

The Axios instance in `apiClient.ts` has two behaviors that cause common mistakes:

**1. ServiceResult auto-unwrap:** The response interceptor automatically unwraps `{ success: true, data: T }` responses. So `response.data` is already `T`, not the full ServiceResult wrapper. Don't destructure `.data.data`.

```typescript
// CORRECT - response.data is already the unwrapped payload
const response = await apiClient.get('/orders/123');
const order = response.data; // This IS the order object

// WRONG - double-unwrapping (response.data.data is undefined)
const order = response.data.data; // undefined!
```

**2. BaseURL is `/api`:** The Axios instance has `baseURL: '/api'`. All request paths are appended to this. Don't include `/api` in your paths.

```typescript
// CORRECT - path is relative to baseURL
apiClient.get('/orders/123');     // requests /api/orders/123

// WRONG - duplicates the /api prefix
apiClient.get('/api/orders/123'); // requests /api/api/orders/123
```

---

## Database Query Standards — Detailed Examples

### query() Helper vs pool.execute()

```typescript
// CORRECT - Use query() helper
import { query } from '../config/database';
import { RowDataPacket } from 'mysql2';

async getItemById(id: number): Promise<RowDataPacket | null> {
  const rows = await query(
    'SELECT * FROM items WHERE id = ?',
    [id]
  ) as RowDataPacket[];
  return rows.length > 0 ? rows[0] : null;
}

// WRONG - Do NOT use pool.execute() directly
import { pool } from '../config/database';
const [rows] = await pool.execute(...);  // NEVER DO THIS
```

### Why query() over pool.execute()

- **Automatic destructuring** — returns rows directly, not `[rows, fields]` tuple
- **Centralized error logging** — all database errors logged consistently
- **Cleaner syntax** — less boilerplate code
- **No TypeScript generics** needed at call sites
- **Single enhancement point** for query timing, metrics, retry logic
- **Future-proof** — easy to add monitoring, slow query detection

### Before Making Database Changes

Always check existing structure before modifications:

```sql
-- Check existing structure
SHOW CREATE TABLE table_name;
DESCRIBE table_name;

-- Check for dependencies
SELECT * FROM information_schema.KEY_COLUMN_USAGE
WHERE REFERENCED_TABLE_NAME = 'table_name';

-- Test with sample data first
SELECT * FROM table_name LIMIT 10;
```

### Layer Access Rules

| Layer | Database Access |
|-------|----------------|
| Repository | ONLY layer that imports and uses `query()` |
| Service | Calls repository methods, NEVER queries DB directly |
| Controller | Calls service methods, NEVER accesses DB or repository |
| Route | Defines middleware chains only, NEVER accesses DB |

### Migration Reference

- Document: `/home/jon/Nexus/DATABASE_QUERY_STANDARDIZATION_PLAN.md`
- Status: In progress — migrating all `pool.execute()` to `query()` helper
- Legacy code may still use `pool.execute()` — update to `query()` when touching those files

---

## Modal Implementation

All modals MUST use the `useModalBackdrop` hook for consistent behavior across the application.

### Standard Pattern

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

### What You Get Automatically

- ✅ **ESC key closes modal** (with proper event propagation control)
- ✅ **Click outside closes modal** (mouseDown/mouseUp pattern prevents accidental closes)
- ✅ **Mobile body scroll lock** (background doesn't scroll when modal is open)
- ✅ **Drag-safe closing** (click-drag from inside to outside won't close modal)

### Required Props Interface

```typescript
interface ModalProps {
  isOpen: boolean;        // REQUIRED: Controls modal visibility
  onClose: () => void;    // REQUIRED: Called when modal should close
  // ... other specific props
}
```

### Hook Options

```typescript
useModalBackdrop({
  isOpen: boolean;                                    // Required
  onClose: () => void;                                // Required
  preventClose?: boolean;                             // Optional: prevent ESC/click-outside
  additionalRefs?: RefObject<HTMLElement>[];         // Optional: additional "inside" elements
})
```

### Z-Index Standards

- **z-50**: Standard modals (most common)
- **z-60**: Nested modals (modals opened from other modals)
- **z-70**: Alert/confirmation system (AlertContext)
- **z-9999**: System-critical modals (SessionExpiredModal)

### When to Use AlertContext Instead

For simple alerts and confirmations, use the AlertContext system rather than creating custom modals:

```typescript
import { useAlert } from '../contexts/AlertContext';

const { showSuccess, showError, showConfirmation } = useAlert();

// Simple alert
showSuccess('Item saved successfully!');

// Yes/No confirmation
const confirmed = await showConfirmation('Delete this item?');
if (confirmed) {
  // proceed with deletion
}
```

**Use AlertContext for**:
- Success/error/warning/info messages
- Simple Yes/No confirmations
- Quick user notifications

**Use custom modal for**:
- Forms with multiple fields
- Complex data displays
- Multi-step workflows
- Special layouts (preview panels, editors)

### Complete Documentation

See `/home/jon/Nexus/docs/MODAL_PATTERNS.md` for:
- Migration guide (converting manual implementations)
- Code examples (nested modals, preview panels, conditional close)
- Best practices (accessibility, focus management)
- Troubleshooting guide
- Special cases and edge scenarios

### Common Migration Pattern

**Before** (manual implementation):
```typescript
// Remove all of this:
const modalContentRef = useRef<HTMLDivElement>(null);
const mouseDownOutsideRef = useRef(false);
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

const handleBackdropMouseDown = (e: React.MouseEvent) => { /* ... */ };
const handleBackdropMouseUp = (e: React.MouseEvent) => { /* ... */ };
```

**After** (using hook):
```typescript
// Replace with single hook call:
const {
  modalContentRef,
  handleBackdropMouseDown,
  handleBackdropMouseUp,
  isMobile
} = useModalBackdrop({ isOpen, onClose });
```

---

**Last Updated**: 2026-02-06
