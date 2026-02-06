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

**Last Updated**: 2026-02-06
