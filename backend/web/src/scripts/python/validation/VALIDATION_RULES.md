# Validation Rules

Living document tracking all validation rules across sign types.
`[x]` = implemented, `[ ]` = TODO.

---

## General (All Sign Types)

These rules run for every file regardless of sign type.

- [x] **Duplicate overlapping paths** — Flag identical paths stacked on the same layer (`no_duplicate_overlapping`)
- [x] **Stroke requirements** — Validate stroke color, width, and fill against spec rules (`stroke_requirements`)
- [x] **Path closure** — Warn on unclosed paths above a minimum length (`path_closure`)
- [x] **Hole classification** — Classify circular inner paths by diameter against `standard_hole_sizes` DB table (wire, mounting types, unknown)
- [x] **Unknown hole reporting** — Info-level notice for holes that don't match any standard size

---

## Front Lit (Trim Cap)

Rules file: `rules/front_lit.py`

### Return Layer
- [x] **Wire hole required** — Each return letter must have exactly 1 wire hole (`letter_no_wire_hole`)
- [x] **Multiple wire holes warning** — Warn if a return letter has >1 wire hole (`letter_multiple_wire_holes`)
- [x] **Mounting hole count** — Minimum mounting holes based on letter perimeter and area (`front_lit_mounting_holes`)
- [x] **Unexpected mounting type** — Warn when mounting holes don't match expected type (`unexpected_mounting_type`)

### Trim Cap Layer
- [x] **Trim layer exists** — Error if no trim cap layer is present (`front_lit_trim_missing`)
- [x] **Trim count matches return** — Trim layer must have same number of letters as return (`front_lit_trim_count`)
- [x] **Trim offset** — Each trim shape must be ~2mm larger per side than return, accounting for miter factor (`front_lit_trim_offset`)
- [x] **Trim cap spacing** — Polygon-based check that buffered trim caps maintain minimum clearance between letters (`front_lit_trim_spacing`, min 0.15")

---

## Front Lit Acrylic Face

Rules file: `rules/front_lit_acrylic_face.py`

### Return Layer
- [x] **Wire hole required** — Same as Front Lit (shared `generate_letter_analysis_issues`)
- [x] **Multiple wire holes warning** — Same as Front Lit
- [x] **Mounting hole count** — Same formula as Front Lit (`acrylic_face_mounting_holes`)
- [x] **Unexpected mounting type** — Same as Front Lit

### Face Layer
- [x] **Face layer exists** — Error if no face layer is present (`acrylic_face_missing`)
- [x] **Face count matches return** — Face layer must have same number of letters as return (`acrylic_face_count`)
- [x] **Face offset** — Each face shape must be >=0.3mm larger per side than return (`acrylic_face_offset`)
- [x] **Face spacing** — Polygon-based check that face letters maintain minimum clearance (`acrylic_face_spacing`, min 0.10")
- [x] **Engraving path detection** — Non-circular inner paths inset ~0.4mm from face bbox classified as engraving (`acrylic_face_engraving_missing`)

---

## Halo Lit

Rules file: `rules/halo_lit.py` (not yet created)

---

## Trimless

Rules file: `rules/trimless.py` (not yet created)

---

## Non-Lit

Rules file: `rules/non_lit.py` (not yet created)

---

## Push Thru

Rules file: `rules/push_thru.py`

### Layers
- **Backer** (ACM or Aluminum) — Contains box outlines with letter cutouts (compound paths: outer box + inner letter holes)
- **Push Thru Acrylic** — Contains the acrylic letter shapes that push through the backer cutouts
- **Lexan** — Contains simple paths (NOT compound paths) that group/contain backer letter cutouts
- **LED Box** — Smaller rectangular box nested inside the backer box (may be on the Backer layer itself)

### Acrylic ↔ Backer Cutout Rules
- [x] **Cutout count matches acrylic** — Every acrylic letter on the Push Thru Acrylic layer must have a corresponding cutout in the Backer layer, and vice versa
- [x] **Cutout offset from acrylic** — Backer cutouts must be exactly 0.8mm larger than acrylic letters (rounded/uniform offset, very tight tolerance). This is a precise rounded offset so the shape should be uniformly expanded, not just bbox-expanded
- [x] **Rounded corners required** — Every corner on both acrylic letters and backer cutouts must be rounded (no sharp L-to-L junctions). Detection: extract radius from cubic bezier control points using kappa constant (r = control_point_distance / 0.5523)

#### Corner Radius Minimums (±5% tolerance, these are minimums)

**Acrylic letters** (Push Thru Acrylic layer):
- [x] **Convex corner radius** — Minimum 0.028" radius at convex corners
- [x] **Concave corner radius** — Minimum 0.059" radius at concave corners

**Backer cutouts** (paths within backer box area on Backer layer — treat as normal paths, not inverted compound path holes):
- [x] **Convex corner radius** — Minimum 0.059" radius at convex corners
- [x] **Concave corner radius** — Minimum 0.028" radius at concave corners

### Box Rules (2" Angle Return box type)
- [x] **Acrylic inset from box edge** — Push Thru Acrylic letters must be at least 3" from the edge of the backer box

### Lexan Layer Rules
- [x] **Lexan layer exists** — A Lexan layer must be present in the file
- [x] **Lexan paths are simple (not compound)** — Each path on the Lexan layer must be a simple path, not a compound path
- [x] **Lexan contains all cutouts** — Every backer letter cutout must be contained within a Lexan path. One Lexan path can contain many cutouts, but every cutout must be accounted for
- [x] **Lexan inset from backer box** — Lexan paths must be inside the backer box boundaries, offset inward by at least 2.25"

### LED Box Rules
- [x] **LED box exists** — Each backer box should have a paired LED box (a rectangular path on the Backer layer with no letter cutouts)
- [x] **LED box offset from backer** — LED box must be offset -0.16" from the backer box (i.e., 0.16" smaller per side). Exact for rectangular boxes, very tight tolerance

---

## Notes

- Hole sizes come from the `standard_hole_sizes` database table (single source of truth)
- Scale detection is automatic from file analysis; default assumption is 10% working scale
- Polygon-based spacing checks use Shapely buffering with mitered joins to simulate physical trim/face shapes
