"""
Push Thru helper functions: backer decomposition, acrylic-cutout matching,
offset validation, corner radius checking, lexan validation, LED box validation.
"""

import sys
from typing import List, Dict, Any, Optional, Tuple

from ..core import PathInfo, ValidationIssue
from ..geometry import polygon_contains
from ..corner_analysis import extract_corner_radii

try:
    from shapely.geometry import Polygon
except ImportError:
    Polygon = None


def is_roughly_rectangular(polygon, tolerance: float = 0.90) -> bool:
    """Check if a polygon is roughly rectangular (area ratio to bbox)."""
    if polygon is None:
        return False
    try:
        box = polygon.minimum_rotated_rectangle
        if box.area <= 0:
            return False
        return polygon.area / box.area >= tolerance
    except Exception:
        return False


def decompose_backer_compounds(
    paths_info: List[PathInfo],
    backer_layer: str,
) -> Tuple[List[Polygon], List[Polygon]]:
    """
    Extract box outlines + cutout polygons from the backer layer.

    Handles two file architectures:
    A) Compound paths where exterior = box, interiors = letter cutouts
    B) Separate box rects + individual cutout paths (some compound for letter counters)

    Detection: uses area distribution — boxes are >> letter cutouts (typically 50-100x).
    Compound paths with box-sized exteriors → Architecture A (decompose).
    Compound paths with letter-sized exteriors → Architecture B (whole path = cutout).

    Returns:
        (box_polygons, cutout_polygons)
    """
    backer_paths = [
        p for p in paths_info
        if p.layer_name and p.layer_name.lower() == backer_layer.lower()
        and p.is_closed and p.polygon is not None and not p.is_circle
    ]

    if not backer_paths:
        return [], []

    # Determine box threshold from area distribution.
    # Boxes are typically 50-100x larger than letter cutouts.
    # Use 10x the median area as the cutoff.
    areas = sorted([(p.area or 0) for p in backer_paths], reverse=True)
    if len(areas) >= 3:
        median_area = areas[len(areas) // 2]
        box_threshold = median_area * 10
    else:
        # Too few paths — use the larger one as box if it's rectangular
        box_threshold = areas[-1] * 5 if len(areas) == 2 else 0

    boxes = []
    cutouts = []

    for p in backer_paths:
        p_area = p.area or 0

        if p.is_compound and hasattr(p.polygon, 'interiors') and len(p.polygon.interiors) > 0:
            try:
                ext_poly = Polygon(p.polygon.exterior)
                ext_area = ext_poly.area

                if ext_area > box_threshold and is_roughly_rectangular(ext_poly):
                    # Architecture A: exterior is a box, interiors are cutouts
                    if ext_poly.is_valid and ext_area > 0:
                        boxes.append(ext_poly)
                    for ring in p.polygon.interiors:
                        cutout = Polygon(ring)
                        if not cutout.is_valid:
                            cutout = cutout.buffer(0)
                        if cutout.area > 0:
                            cutouts.append(cutout)
                else:
                    # Architecture B: compound letter with counters → whole path is cutout
                    cutouts.append(p.polygon)
            except Exception:
                pass

        elif p_area > box_threshold and is_roughly_rectangular(p.polygon):
            # Non-compound box (Architecture B boxes)
            boxes.append(p.polygon)

        else:
            # Non-compound, non-box → cutout
            cutouts.append(p.polygon)

    print(f"Backer decomposition: {len(boxes)} box(es), {len(cutouts)} cutout(s) "
          f"(threshold={box_threshold:.0f}, paths={len(backer_paths)})", file=sys.stderr)

    return boxes, cutouts


def match_acrylic_to_cutouts(
    acrylic_paths: List[PathInfo],
    cutout_polygons: List[Polygon],
    max_distance: float = 50.0,
) -> List[Tuple[PathInfo, Optional[Polygon], float]]:
    """
    Match acrylic letters to backer cutouts by centroid proximity.

    Returns:
        List of (acrylic_path, matched_cutout_or_None, distance)
    """
    matches = []
    used_cutouts = set()

    for acrylic in acrylic_paths:
        if acrylic.polygon is None:
            matches.append((acrylic, None, float('inf')))
            continue

        acrylic_centroid = acrylic.polygon.centroid
        best_cutout = None
        best_dist = float('inf')
        best_idx = -1

        for idx, cutout in enumerate(cutout_polygons):
            if idx in used_cutouts:
                continue
            try:
                dist = acrylic_centroid.distance(cutout.centroid)
                if dist < best_dist:
                    best_dist = dist
                    best_cutout = cutout
                    best_idx = idx
            except Exception:
                continue

        if best_cutout is not None and best_dist <= max_distance:
            used_cutouts.add(best_idx)
            matches.append((acrylic, best_cutout, best_dist))
        else:
            matches.append((acrylic, None, best_dist))

    return matches


def check_cutout_offset(
    acrylic_poly: Polygon,
    cutout_poly: Polygon,
    offset_mm: float,
    tolerance_mm: float,
    file_scale: float,
) -> Optional[Dict[str, Any]]:
    """
    Validate cutout bbox is a uniform expansion of acrylic bbox.

    A uniform buffer expands the bounding box by exactly the buffer distance
    on each side, regardless of shape complexity. This is more robust than
    Hausdorff distance which is sensitive to polygon sampling imprecision.

    Returns detail dict if offset is wrong, None if OK.
    """
    points_per_real_inch = 72 * file_scale
    tol_file = tolerance_mm * points_per_real_inch / 25.4
    to_mm = 25.4 / points_per_real_inch

    a = acrylic_poly.bounds  # (minx, miny, maxx, maxy)
    c = cutout_poly.bounds

    sides = {
        'left':   a[0] - c[0],   # cutout extends further left
        'bottom': a[1] - c[1],   # cutout extends further down
        'right':  c[2] - a[2],   # cutout extends further right
        'top':    c[3] - a[3],   # cutout extends further up
    }

    worst_dev = 0.0
    worst_side = ''
    side_details = {}
    for name, offset_fu in sides.items():
        mm = offset_fu * to_mm
        dev = abs(mm - offset_mm)
        side_details[name] = round(mm, 3)
        if dev > worst_dev:
            worst_dev = dev
            worst_side = name

    worst_dev_file = worst_dev * points_per_real_inch / 25.4
    if worst_dev_file > tol_file:
        return {
            'offsets_mm': side_details,
            'worst_side': worst_side,
            'worst_deviation_mm': round(worst_dev, 3),
            'expected_offset_mm': offset_mm,
            'tolerance_mm': tolerance_mm,
        }
    return None


def check_corner_radii_for_path(
    path: PathInfo,
    file_scale: float,
    min_convex_inches: float,
    min_concave_inches: float,
    tolerance_pct: float,
    is_compound_interior: bool = False,
) -> List[Dict[str, Any]]:
    """
    Check corner radii on a single path, returning violations.

    Args:
        path: PathInfo with d_attribute
        file_scale: Scale factor
        min_convex_inches: Minimum radius for convex corners
        min_concave_inches: Minimum radius for concave corners
        tolerance_pct: Percentage tolerance (e.g. 0.05 = 5%)
        is_compound_interior: True if this is a cutout from a compound path
    """
    violations = []
    radii = extract_corner_radii(
        path.d_attribute, file_scale, is_compound=is_compound_interior
    )

    for corner in radii:
        if corner['is_sharp']:
            violations.append({
                'type': 'sharp',
                'position': corner['position'],
                'is_convex': corner['is_convex'],
            })
            continue

        r = corner['radius_inches']
        if corner['is_convex']:
            threshold = min_convex_inches * (1.0 - tolerance_pct)
            if r < threshold:
                violations.append({
                    'type': 'undersized_convex',
                    'radius_inches': round(r, 4),
                    'min_inches': min_convex_inches,
                    'position': corner['position'],
                })
        else:
            threshold = min_concave_inches * (1.0 - tolerance_pct)
            if r < threshold:
                violations.append({
                    'type': 'undersized_concave',
                    'radius_inches': round(r, 4),
                    'min_inches': min_concave_inches,
                    'position': corner['position'],
                })

    return violations


def check_lexan_layer(
    issues: List[ValidationIssue],
    paths_info: List[PathInfo],
    lexan_layer: str,
    layers_found: set,
    boxes: list,
    cutouts: list,
    lexan_inset_inches: float,
    max_cutout_area_ratio: float,
    min_cutout_clearance_inches: float,
    points_per_real_inch: float,
) -> None:
    """Validate lexan layer: exists, simple, contains cutouts, inset, area ratio, clearance."""
    lexan_paths = [
        p for p in paths_info
        if p.layer_name and p.layer_name.lower() == lexan_layer.lower()
        and p.is_closed and p.polygon is not None
    ]

    if not lexan_paths:
        issues.append(ValidationIssue(
            rule='push_thru_lexan_exists',
            severity='error',
            message=f'No paths found on "{lexan_layer}" layer',
            details={'available_layers': list(sorted(layers_found))},
        ))
        return

    # Lexan paths must be simple (not compound)
    compound_lexan = [p for p in lexan_paths if p.is_compound]
    if compound_lexan:
        issues.append(ValidationIssue(
            rule='push_thru_lexan_simple',
            severity='error',
            message=f'{len(compound_lexan)} lexan path(s) are compound (must be simple)',
            details={'compound_path_ids': [p.path_id for p in compound_lexan]},
        ))

    # Build map: which cutouts belong to which lexan path
    lexan_cutout_map: Dict[str, list] = {lp.path_id: [] for lp in lexan_paths}
    uncontained = []
    for i, cutout in enumerate(cutouts):
        contained = False
        for lp in lexan_paths:
            if lp.polygon is not None and polygon_contains(lp.polygon, cutout, tolerance=1.0):
                lexan_cutout_map[lp.path_id].append(cutout)
                contained = True
                break
        if not contained:
            uncontained.append(i)

    if uncontained:
        issues.append(ValidationIssue(
            rule='push_thru_lexan_containment',
            severity='error',
            message=f'{len(uncontained)} cutout(s) not contained within any lexan path',
            details={'uncontained_cutout_indices': uncontained},
        ))

    # Per-lexan checks: inset from box, area ratio, cutout clearance
    for lp in lexan_paths:
        if lp.polygon is None:
            continue

        # Lexan inset from backer box
        best_inset = float('inf')
        for box in boxes:
            try:
                dist = lp.polygon.boundary.distance(box.boundary)
                best_inset = min(best_inset, dist)
            except Exception:
                continue

        if best_inset < float('inf'):
            inset_in = best_inset / points_per_real_inch
            if inset_in < lexan_inset_inches:
                issues.append(ValidationIssue(
                    rule='push_thru_lexan_inset',
                    severity='error',
                    message=(
                        f'Lexan {lp.path_id} is {inset_in:.2f}" from box edge '
                        f'(min {lexan_inset_inches}")'
                    ),
                    path_id=lp.path_id,
                    details={
                        'inset_inches': round(inset_in, 3),
                        'required_inches': lexan_inset_inches,
                    },
                ))

        # Cutout area ratio: total cutout area / lexan area
        contained_cutouts = lexan_cutout_map.get(lp.path_id, [])
        if contained_cutouts and lp.polygon.area > 0:
            total_cutout_area = sum(c.area for c in contained_cutouts)
            ratio = total_cutout_area / lp.polygon.area

            if ratio > max_cutout_area_ratio:
                issues.append(ValidationIssue(
                    rule='push_thru_lexan_area_ratio',
                    severity='error',
                    message=(
                        f'Lexan {lp.path_id} cutout area ratio {ratio:.0%} '
                        f'exceeds max {max_cutout_area_ratio:.0%}'
                    ),
                    path_id=lp.path_id,
                    details={
                        'ratio': round(ratio, 3),
                        'max_ratio': max_cutout_area_ratio,
                        'cutout_count': len(contained_cutouts),
                        'lexan_area_file_units': round(lp.polygon.area, 1),
                        'cutout_area_file_units': round(total_cutout_area, 1),
                    },
                ))

        # Cutout clearance: minimum distance from each cutout to lexan boundary
        for cutout in contained_cutouts:
            try:
                clearance = lp.polygon.boundary.distance(cutout.boundary)
                clearance_inches = clearance / points_per_real_inch
                if clearance_inches < min_cutout_clearance_inches:
                    issues.append(ValidationIssue(
                        rule='push_thru_lexan_cutout_clearance',
                        severity='error',
                        message=(
                            f'Cutout is {clearance_inches:.3f}" from lexan {lp.path_id} edge '
                            f'(min {min_cutout_clearance_inches}")'
                        ),
                        path_id=lp.path_id,
                        details={
                            'clearance_inches': round(clearance_inches, 4),
                            'required_inches': min_cutout_clearance_inches,
                        },
                    ))
            except Exception:
                continue


