# Trim Cap Spacing Validation — Implementation Plan

**Feedback #18** | Status: Open | Priority: Medium

## Problem
Front Lit channel letter working files need validation that trim cap letters maintain at least **0.15"** clearance between each other. The check must use **polygon shapes** (not bounding boxes) and account for **mitered corners** which extend further than straight edges.

## Background
- Trim cap polygons in AI files are simple outlines without miter geometry
- Physical trim caps have mitered joints at corners that extend further outward
- At 90° corners: miter extends 1.41× the offset
- At 60° corners: 2.0×
- At 30° corners: 3.86×
- Capped at 4.0× (miter_limit) then beveled

## Algorithm: Simulated Mitered Trim Cap Distance

```
For each return letter polygon:
  1. Buffer outward by trim_offset_max (2.5mm → ~0.71 file units at 10% scale)
     with join_style='mitre', mitre_limit=4.0
  2. Result = simulated physical trim cap shape with mitered corners

For each pair of simulated trim caps:
  3. distance = polygon_a.distance(polygon_b)   # Shapely minimum distance
  4. distance_inches = distance / (72 * file_scale)
  5. If distance_inches < 0.15" → ERROR
```

At corners, miters extend further outward → simulated polygons are closer → distance check correctly flags tight spacing at corners.

## Files to Modify

| File | Change |
|------|--------|
| `backend/web/src/scripts/python/validation/geometry.py` | Add `polygon_distance()`, `buffer_polygon_with_mitre()` |
| `backend/web/src/scripts/python/validation/rules/front_lit.py` | Add `check_trim_cap_spacing()`, trimcap-missing check |
| `backend/web/src/services/aiFileValidationRules.ts` | Add `min_trim_spacing_inches`, rule display entries |

## Detail: geometry.py

### `polygon_distance(poly1, poly2) -> float`
- Uses Shapely's `.distance()` for minimum distance between polygon boundaries
- Returns `float('inf')` if either polygon is None

### `buffer_polygon_with_mitre(polygon, offset, mitre_limit=4.0) -> Polygon`
- Buffers a Shapely polygon outward with `join_style=JOIN_STYLE.mitre`
- Used to simulate physical mitered trim cap from the return polygon

## Detail: rules/front_lit.py

### `check_trim_cap_spacing(letter_analysis, rules) -> List[ValidationIssue]`
Called from `check_front_lit_structure()`:

1. **Get return letter polygons** from `_letter_analysis.letter_groups` (already in global coordinate space)
2. **Filter** to return layer letters only (they have `main_path.polygon`)
3. **Buffer each** by `trim_offset_max_mm` (converted to file units) with mitre join and `mitre_limit=miter_factor`
4. **Pairwise distance check**: for each pair of buffered polygons, compute `polygon_distance()`
5. Convert to inches, compare against `min_trim_spacing_inches`
6. If too close → emit `front_lit_trim_spacing` error with both letter IDs, actual distance, required minimum

### Trim Cap Layer Missing Check
If trimcap layer has no letters at all, emit `front_lit_trim_missing` error (more explicit than current count-mismatch message).

## Detail: aiFileValidationRules.ts

### Config Addition
```typescript
FRONT_LIT_STRUCTURE_RULES = {
  ...existing,
  min_trim_spacing_inches: 0.15,    // NEW: minimum clearance between trim caps
};
```

### Rule Display Entries
```typescript
{ rule_key: 'front_lit_trim_spacing', name: 'Trim Cap Spacing',
  description: 'Trim cap letters must be at least 0.15" apart (with miter)', category: 'Front Lit Channel Letters' }
{ rule_key: 'front_lit_trim_missing', name: 'Trim Cap Layer Required',
  description: 'Working file must include a trimcap layer with letters', category: 'Front Lit Channel Letters' }
```

## No Frontend Changes Needed
The existing `IssueDisplay` components handle new rule types automatically — issues grouped by rule key with severity-colored backgrounds.

## Unit Conversions (at 10% scale)
- trim_offset_max: 2.5mm → `2.5 × 72 × 0.1 / 25.4 = 0.709` file units buffer
- min_spacing: 0.15" → `0.15 × 72 × 0.1 = 1.08` file units threshold

## Verification
1. Run validation on a Front Lit order with tight letter spacing
2. Confirm `front_lit_trim_spacing` errors appear for letters closer than 0.15" (after simulated miters)
3. Confirm corners produce smaller distances than parallel edges (miter effect)
4. Confirm `front_lit_trim_missing` error appears when trimcap layer is absent
5. Confirm existing trim offset/count rules still work
6. Check that the reported distance in error details is reasonable
