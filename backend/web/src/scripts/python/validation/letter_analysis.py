"""
Letter-Hole Association Analysis Module (Geometry Layer)

Groups paths into letters and identifies holes that are geometrically INSIDE
each letter using polygon containment. Returns UNCLASSIFIED holes — spec-specific
rules (e.g. front_lit.py) classify them later as wire/mounting/unknown.

Key algorithms:
1. Letter Identification: Find outer paths not contained within others
2. Polygon Containment: Accurate geometric containment using Shapely

Counters (inner letter shapes like inside "O") are always part of the letter's
compound path — they have interior rings baked into the polygon. All separate
paths found inside a letter are holes, never counters.

This module has NO knowledge of spec-specific hole sizes (wire, mounting, etc.).
Classification is handled by the rules layer after geometry analysis.
"""

from typing import List, Dict, Any, Optional, Tuple

from .core import PathInfo, LetterGroup, LetterAnalysisResult, HoleInfo
from .geometry import (
    get_centroid, bbox_contains,
    polygon_contains, point_in_polygon
)
from .transforms import apply_transform_to_bbox, apply_transform_to_polygon

try:
    from shapely import STRtree
except ImportError:
    STRtree = None


# Geometry-only configuration (no spec-specific hole sizes)
GEOMETRY_CONFIG = {
    'containment_tolerance': 0.5,
    'phantom_duplicate_tolerance': 0.001,  # Ratio band around 1.0 for duplicate detection
}


def identify_letters(paths_info: List[PathInfo], layer_name: Optional[str] = None) -> List[PathInfo]:
    """
    Find paths that are "outer shapes" (not contained within other paths).
    These are the letter outlines.

    A path is a letter if:
    - It's closed
    - Has a polygon representation
    - Is NOT a small circle (holes are not letters)
    - Is NOT contained within another path

    Args:
        paths_info: List of all paths
        layer_name: Optional layer to filter by (None = all layers)

    Returns:
        List of PathInfo objects that are letter outlines
    """
    # Filter candidates
    if layer_name:
        candidates = [
            p for p in paths_info
            if p.layer_name and p.layer_name.lower() == layer_name.lower()
            and p.is_closed
            and p.polygon is not None
            and not p.is_circle  # Letters are not small circles
        ]
    else:
        candidates = [
            p for p in paths_info
            if p.is_closed
            and p.polygon is not None
            and not p.is_circle
        ]

    if not candidates:
        return []

    # Group candidates by layer for per-layer spatial indexing
    layer_groups: Dict[str, List[PathInfo]] = {}
    for c in candidates:
        key = (c.layer_name or '').lower()
        layer_groups.setdefault(key, []).append(c)

    letters = []
    contained_by = {}  # Debug: track what contains each excluded path

    for layer_key, layer_candidates in layer_groups.items():
        # Build STRtree for this layer if enough paths to benefit
        tree = None
        tree_paths = None
        if STRtree is not None and len(layer_candidates) >= 10:
            polys = [c.polygon for c in layer_candidates]
            if all(p is not None for p in polys):
                tree = STRtree(polys)
                tree_paths = layer_candidates

        for path in layer_candidates:
            is_contained = False
            path_area = path.area or 0

            # Determine which candidates to check against
            if tree is not None and path.polygon is not None:
                # Query tree for bbox-overlapping candidates
                hit_indices = tree.query(path.polygon)
                check_against = [tree_paths[i] for i in hit_indices]
            else:
                check_against = layer_candidates

            for other in check_against:
                if other.path_id == path.path_id:
                    continue

                other_area = other.area or 0
                if other_area > 0 and path_area > 0 and other_area < path_area:
                    continue

                if path.polygon and other.polygon:
                    if polygon_contains(other.polygon, path.polygon):
                        is_contained = True
                        contained_by[path.path_id] = other.path_id
                        break
                else:
                    if path.bbox and other.bbox:
                        if bbox_contains(other.bbox, path.bbox, tolerance=1.0):
                            is_contained = True
                            contained_by[path.path_id] = other.path_id
                            break

            if not is_contained:
                letters.append(path)

    # Attach debug info for diagnostics
    for path in candidates:
        if path.path_id in contained_by:
            path._contained_by = contained_by[path.path_id]
        elif path.path_id not in [l.path_id for l in letters]:
            path._contained_by = '__not_candidate__'

    return letters


def path_is_inside_letter(hole: PathInfo, letter: PathInfo,
                          tolerance: float = 0.5) -> bool:
    """
    Check if a hole path is geometrically inside a letter path.

    Uses polygon containment with Shapely for accuracy.
    Falls back to bbox containment if polygons not available.

    IMPORTANT: Uses compound_polygon if available (letter with counter holes).
    This ensures holes in the counter area (like inside "O") are correctly
    identified as NOT inside the letter material.

    Args:
        hole: The hole path
        letter: The letter path
        tolerance: Tolerance for edge cases

    Returns:
        True if hole is inside letter material (not in counter areas)
    """
    # Use compound_polygon if available (has counter holes subtracted)
    # This correctly excludes the counter area from containment checks
    letter_poly = getattr(letter, 'compound_polygon', None) or letter.polygon

    # Prefer polygon-based containment
    if hole.polygon and letter_poly:
        return polygon_contains(letter_poly, hole.polygon, tolerance)

    # Fall back to centroid-in-polygon check
    if hole.bbox and letter_poly:
        centroid = get_centroid(hole.bbox)
        return point_in_polygon(letter_poly, centroid[0], centroid[1], tolerance)

    # Last resort: bbox containment
    if hole.bbox and letter.bbox:
        return bbox_contains(letter.bbox, hole.bbox, tolerance)

    return False


def find_paths_inside_letter(letter: PathInfo, all_paths: List[PathInfo],
                            tolerance: float = 0.5,
                            spatial_index: Tuple = None) -> List[PathInfo]:
    """
    Find all paths that are geometrically inside a letter.

    Args:
        letter: The letter path
        all_paths: List of all paths to check
        tolerance: Containment tolerance
        spatial_index: Optional (STRtree, indexed_paths, non_indexed_paths) tuple for fast lookup

    Returns:
        List of paths inside the letter
    """
    inside = []
    letter_layer = (letter.layer_name or '').lower()
    letter_poly = getattr(letter, 'compound_polygon', None) or letter.polygon

    # Use spatial index if available and letter has a polygon
    if spatial_index is not None and letter_poly is not None:
        tree, indexed_paths, non_indexed_paths = spatial_index
        hit_indices = tree.query(letter_poly)
        # Check tree hits + all non-indexed paths (they lack polygons for tree)
        candidates = [indexed_paths[i] for i in hit_indices] + non_indexed_paths
    else:
        candidates = all_paths

    for path in candidates:
        if path.path_id == letter.path_id:
            continue

        path_layer = (path.layer_name or '').lower()
        if path_layer != letter_layer:
            continue

        if path_is_inside_letter(path, letter, tolerance):
            inside.append(path)

    return inside


def create_hole_info(path: PathInfo, scale: float = 1.0) -> HoleInfo:
    """
    Create an UNCLASSIFIED HoleInfo object from a PathInfo.

    Args:
        path: The hole path
        scale: File scale (0.1 for 10%, 1.0 for 100%) for unit conversion

    Returns:
        HoleInfo object with hole_type='unclassified'
    """
    # Use original_bbox (raw coordinates) for center since svg_path_data is also raw
    # This ensures SVG rendering is consistent (both in same coordinate space)
    raw_bbox = getattr(path, 'original_bbox', None) or path.bbox
    center = (0.0, 0.0)
    if raw_bbox:
        center = get_centroid(raw_bbox)

    # Convert file units (points) to real millimeters
    file_diameter = path.circle_diameter or 0.0
    points_per_inch = 72 * scale
    diameter_real_mm = (file_diameter / points_per_inch * 25.4) if points_per_inch > 0 else 0.0

    return HoleInfo(
        path_id=path.path_id,
        hole_type='unclassified',
        diameter_mm=file_diameter,
        center=center,
        svg_path_data=path.d_attribute,
        transform=path.transform_chain or '',
        diameter_real_mm=diameter_real_mm,
        fill=path.fill,
        stroke=path.stroke,
        layer_name=path.layer_name or '',
        raw_bbox=raw_bbox,
        bbox=path.bbox,  # Already transformed to global coords
    )


def build_letter_group(letter: PathInfo, inner_paths: List[PathInfo],
                       scale: float, config: Dict = None) -> LetterGroup:
    """
    Build a LetterGroup from a letter path and its inner paths.
    Counters are baked into compound paths — all separate inner paths are holes.
    Holes are stored UNCLASSIFIED — classification happens in the rules layer.

    Args:
        letter: The main letter path
        inner_paths: Paths found inside the letter
        scale: File scale (0.1 or 1.0)
        config: Configuration dict

    Returns:
        LetterGroup object with unclassified holes
    """
    cfg = {**GEOMETRY_CONFIG, **(config or {})}
    tol = cfg.get('phantom_duplicate_tolerance', 0.001)

    holes = []
    outer_area = letter.area or 0

    for inner in inner_paths:
        # Skip phantom duplicate paths (near-identical area to the letter)
        inner_area = inner.area or 0
        if outer_area > 0 and inner_area > 0:
            ratio = inner_area / outer_area
            if (1.0 - tol) <= ratio <= (1.0 + tol):
                continue

        hole_info = create_hole_info(inner, scale)
        holes.append(hole_info)

    # Net area — counters are already subtracted in compound path polygons
    net_area = letter.area or 0

    # Get raw bbox (matches path coordinates for SVG rendering)
    raw_bbox = getattr(letter, 'original_bbox', None) or letter.bbox or (0, 0, 0, 0)

    # Get transformed bbox for positioning in global coordinate space
    if hasattr(letter, 'original_bbox') and letter.original_bbox:
        bbox = letter.bbox or (0, 0, 0, 0)  # Already transformed
    else:
        bbox = raw_bbox
        if letter.transform_chain:
            bbox = apply_transform_to_bbox(raw_bbox, letter.transform_chain)

    # Calculate real-world size from RAW bbox (untransformed)
    width = raw_bbox[2] - raw_bbox[0]
    height = raw_bbox[3] - raw_bbox[1]

    # Convert to inches (72 points per inch at 100%, 7.2 at 10%)
    points_per_inch = 72 * scale
    real_width = width / points_per_inch if points_per_inch > 0 else 0
    real_height = height / points_per_inch if points_per_inch > 0 else 0
    real_area = net_area / (points_per_inch ** 2) if points_per_inch > 0 else 0
    real_perimeter = (letter.length / points_per_inch) if points_per_inch > 0 else 0

    return LetterGroup(
        letter_id=letter.path_id,
        main_path=letter,
        holes=holes,
        layer_name=letter.layer_name or '',
        bbox=bbox,
        raw_bbox=raw_bbox,
        transform=letter.transform_chain or '',
        area=real_area,
        perimeter=real_perimeter,
        detected_scale=scale,
        real_size_inches=(real_width, real_height)
    )


def analyze_letter_hole_associations(
    paths_info: List[PathInfo],
    layer_name: Optional[str] = None,
    config: Dict = None
) -> LetterAnalysisResult:
    """
    Main entry point for letter-hole geometry analysis.

    Analyzes paths to:
    1. Identify letters (outer shapes)
    2. Find holes inside each letter
    3. Return ALL holes as UNCLASSIFIED (rules layer classifies later)
    4. Flag orphan holes (outside all letters)

    Args:
        paths_info: List of all extracted paths
        layer_name: Optional layer to focus on (None = all layers)
        config: Configuration dict (must include 'file_scale' for scale)

    Returns:
        LetterAnalysisResult with all analysis data (holes unclassified)
    """
    cfg = {**GEOMETRY_CONFIG, **(config or {})}

    # CRITICAL FIX: Transform all paths to global coordinate space BEFORE analysis.
    # Paths may have different SVG transforms (translate, scale, rotate, matrix).
    # Without this, polygon containment checks compare coordinates in different
    # coordinate spaces, causing holes to appear outside letters when they're
    # actually inside after transforms are applied.
    #
    # We store original values for SVG rendering (which needs raw coordinates + transform)
    for path in paths_info:
        # Store originals before transforming (for SVG rendering later)
        path.original_bbox = path.bbox
        path.original_polygon = path.polygon

        if path.transform_chain:
            if path.polygon:
                path.polygon = apply_transform_to_polygon(path.polygon, path.transform_chain)
            if path.bbox:
                path.bbox = apply_transform_to_bbox(path.bbox, path.transform_chain)

    # Scale comes from config (file_scale: 0.1 for Working Files, 1.0 for others)
    # TODO: 3D Print files are 100% scale even for Working File — implement spec-specific scale override later
    scale = cfg.get('file_scale', 0.1)

    # Filter out tiny circles (< 2% of the SVG extent) — they're artifacts, not holes
    # But preserve circles that match known standard hole sizes (wire, mounting, etc.)
    min_hole_pct = cfg.get('min_hole_percent', 0.02)
    standard_sizes = cfg.get('standard_hole_sizes', [])
    all_bboxes = [p.bbox for p in paths_info if p.bbox]
    if all_bboxes:
        svg_width = max(b[2] for b in all_bboxes) - min(b[0] for b in all_bboxes)
        svg_height = max(b[3] for b in all_bboxes) - min(b[1] for b in all_bboxes)
        min_circle_diameter = max(svg_width, svg_height) * min_hole_pct
        for p in paths_info:
            # Compare in transformed coordinate space (bbox is already transformed above)
            if p.is_circle and p.bbox:
                transformed_w = p.bbox[2] - p.bbox[0]
                transformed_h = p.bbox[3] - p.bbox[1]
                transformed_diameter = (transformed_w + transformed_h) / 2
                if transformed_diameter < min_circle_diameter:
                    # Before stripping is_circle, check if this matches a standard hole size
                    if standard_sizes and scale > 0 and p.circle_diameter is not None:
                        real_mm = p.circle_diameter / (72 * scale) * 25.4
                        matches_standard = any(
                            abs(real_mm - s['diameter_mm']) <= s.get('tolerance_mm', 0.03)
                            for s in standard_sizes
                        )
                        if matches_standard:
                            continue  # Keep is_circle — it's a real hole
                    p.is_circle = False  # Too small to be a hole — exclude from analysis

    # Reclassify circles that are too LARGE to be holes — they're letter shapes
    # (e.g., the dot of "i", a period, a circular logo element)
    # Max real-world hole is 16mm; anything larger is definitely a letter
    max_hole_mm = 16.0
    if scale > 0:
        for p in paths_info:
            if p.is_circle and p.circle_diameter is not None:
                real_mm = p.circle_diameter / (72 * scale) * 25.4
                if real_mm > max_hole_mm:
                    p.is_circle = False

    # Find all letters
    letters = identify_letters(paths_info, layer_name)

    if not letters:
        # No letters found, check for orphan circles
        circles = [p for p in paths_info if p.is_circle]
        orphan_holes = []
        for c in circles:
            orphan_holes.append(create_hole_info(c, scale))

        return LetterAnalysisResult(
            letter_groups=[],
            orphan_holes=orphan_holes,
            unassigned_paths=[],
            detected_scale=scale,
            stats={
                'layers_analyzed': list(set(p.layer_name for p in paths_info if p.layer_name)),
                'total_paths': len(paths_info),
                'circles_found': len(circles)
            }
        )

    # Track which paths have been assigned to letters
    assigned_path_ids = set()
    for letter in letters:
        assigned_path_ids.add(letter.path_id)

    # Counters are baked into compound paths (interior rings in the polygon).
    # Set compound_polygon so containment checks exclude counter areas.
    for letter in letters:
        letter.compound_polygon = letter.polygon

    # Build per-layer spatial indices for fast hole lookup
    # Only index paths with valid polygons; track non-indexed paths separately
    layer_indices: Dict[str, Tuple] = {}
    if STRtree is not None:
        layer_paths: Dict[str, List[PathInfo]] = {}
        for p in paths_info:
            key = (p.layer_name or '').lower()
            layer_paths.setdefault(key, []).append(p)
        for key, lp in layer_paths.items():
            indexed = [p for p in lp if p.polygon is not None]
            non_indexed = [p for p in lp if p.polygon is None]
            if len(indexed) >= 10:
                geoms = [p.polygon for p in indexed]
                layer_indices[key] = (STRtree(geoms), indexed, non_indexed)

    # Find holes inside letters (using compound polygons for correct containment)
    letter_groups = []
    for letter in letters:
        l_key = (letter.layer_name or '').lower()
        idx = layer_indices.get(l_key)
        inner_paths = find_paths_inside_letter(
            letter, paths_info, cfg['containment_tolerance'],
            spatial_index=idx
        )

        for inner in inner_paths:
            assigned_path_ids.add(inner.path_id)

        group = build_letter_group(letter, inner_paths, scale, cfg)
        letter_groups.append(group)

    # Find orphan holes (circles not assigned to any letter)
    orphan_holes = []
    circles = [p for p in paths_info if p.is_circle and p.path_id not in assigned_path_ids]
    for c in circles:
        if layer_name:
            c_layer = (c.layer_name or '').lower()
            if c_layer != layer_name.lower():
                continue

        orphan_holes.append(create_hole_info(c, scale))

    # Find unassigned non-circle paths
    unassigned_paths = [
        p for p in paths_info
        if p.path_id not in assigned_path_ids
        and not p.is_circle
        and p.is_closed
    ]

    # === Full path accounting: classify ALL remaining paths ===
    total_holes_in_letters = sum(len(lg.holes) for lg in letter_groups)

    unprocessed_paths = []
    for p in paths_info:
        if p.path_id in assigned_path_ids:
            continue

        if p.is_circle:
            continue

        reason = 'unclassified'
        if (p.layer_name or '') == '_defs_':
            reason = 'defs_path'
        elif layer_name and (p.layer_name or '').lower() != layer_name.lower():
            reason = 'off_layer'
        elif not p.is_closed:
            reason = 'open_path'

        unprocessed_paths.append({
            'path_id': p.path_id,
            'reason': reason,
            'layer': p.layer_name or '',
            'is_compound': getattr(p, 'is_compound', False),
            'is_closed': p.is_closed,
            'has_polygon': p.polygon is not None,
            'area': round(p.area, 2) if p.area else 0,
            'contained_by': getattr(p, '_contained_by', None),
        })

    # Build stats with full path accounting
    layers_with_letters = list(set(lg.layer_name for lg in letter_groups if lg.layer_name))

    path_accounting = {
        'letters': len(letter_groups),
        'holes_in_letters': total_holes_in_letters,
        'orphan_holes': len(orphan_holes),
        'open_paths': sum(1 for u in unprocessed_paths if u['reason'] == 'open_path'),
        'defs_paths': sum(1 for u in unprocessed_paths if u['reason'] == 'defs_path'),
        'off_layer': sum(1 for u in unprocessed_paths if u['reason'] == 'off_layer'),
        'unclassified': sum(1 for u in unprocessed_paths if u['reason'] == 'unclassified'),
        'total': len(paths_info),
    }

    return LetterAnalysisResult(
        letter_groups=letter_groups,
        orphan_holes=orphan_holes,
        unassigned_paths=unassigned_paths,
        unprocessed_paths=unprocessed_paths,
        detected_scale=scale,
        stats={
            'layers_analyzed': layers_with_letters,
            'total_paths': len(paths_info),
            'letters_found': len(letter_groups),
            'circles_found': sum(1 for p in paths_info if p.is_circle),
            'path_accounting': path_accounting
        }
    )
