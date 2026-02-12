"""
Push Thru helper functions: backer decomposition, acrylic-cutout matching,
offset validation, and corner radius checking.
"""

from typing import List, Dict, Any, Optional, Tuple

from ..core import PathInfo
from ..geometry import polygon_contains, buffer_polygon_round
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
) -> Tuple[List[Polygon], List[Polygon], List[PathInfo]]:
    """
    Extract box outlines + cutout polygons from compound paths on the backer layer.

    Compound paths on backer: exterior = box, interiors = letter cutouts.
    Non-compound rectangular paths on backer: LED box candidates.

    Returns:
        (box_polygons, cutout_polygons, led_box_candidates)
    """
    boxes = []
    cutouts = []
    led_candidates = []

    for p in paths_info:
        if not p.layer_name or p.layer_name.lower() != backer_layer.lower():
            continue
        if not p.is_closed or p.polygon is None:
            continue

        if p.is_compound and hasattr(p.polygon, 'interiors') and len(p.polygon.interiors) > 0:
            try:
                box_poly = Polygon(p.polygon.exterior)
                if box_poly.is_valid and box_poly.area > 0:
                    boxes.append(box_poly)

                for ring in p.polygon.interiors:
                    cutout = Polygon(ring)
                    if not cutout.is_valid:
                        cutout = cutout.buffer(0)
                    if cutout.area > 0:
                        cutouts.append(cutout)
            except Exception:
                pass
        elif not p.is_compound and not p.is_circle:
            led_candidates.append(p)

    return boxes, cutouts, led_candidates


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
    Validate cutout is the expected rounded offset from acrylic.
    Buffers acrylic by expected offset and compares to actual cutout
    using Hausdorff distance.

    Returns detail dict if offset is wrong, None if OK.
    """
    points_per_real_inch = 72 * file_scale
    offset_file = offset_mm * points_per_real_inch / 25.4
    tol_file = tolerance_mm * points_per_real_inch / 25.4

    expected = buffer_polygon_round(acrylic_poly, offset_file)
    if expected is None:
        return None

    try:
        hausdorff = expected.hausdorff_distance(cutout_poly)
        if hausdorff > tol_file:
            hausdorff_mm = hausdorff * 25.4 / points_per_real_inch
            return {
                'hausdorff_mm': round(hausdorff_mm, 3),
                'expected_offset_mm': offset_mm,
                'tolerance_mm': tolerance_mm,
            }
    except Exception:
        pass
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
