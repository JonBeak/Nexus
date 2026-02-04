"""
Letter-Hole Association Analysis Module

Groups paths into letters and identifies holes (wire/mounting) that are
geometrically INSIDE each letter using polygon containment.

Key algorithms:
1. Letter Identification: Find outer paths not contained within others
2. Counter Detection: Distinguish inner letter shapes (like inside "O") from holes
3. Hole Classification: Wire vs mounting holes based on diameter
4. Polygon Containment: Accurate geometric containment using Shapely

File scale detection:
- 10% scale: wire holes ~1mm, mounting ~0.4mm
- 100% scale: wire holes ~10mm, mounting ~4mm
"""

from typing import List, Dict, Any, Optional, Tuple
from math import pi

from .core import PathInfo, LetterGroup, LetterAnalysisResult, HoleInfo
from .geometry import (
    get_centroid, bbox_contains, bbox_area, calculate_circularity,
    polygon_contains, point_in_polygon
)
from .transforms import apply_transform_to_bbox


# Default configuration for letter analysis
DEFAULT_CONFIG = {
    # Hole sizes at 10% scale (multiply by 10 for real-world)
    'wire_hole_diameter_mm': 1.0,       # 10mm real
    'wire_hole_tolerance_mm': 0.2,
    'mounting_hole_diameter_mm': 0.4,   # 4mm real
    'mounting_hole_tolerance_mm': 0.1,

    # Hole sizes at 100% scale
    'wire_hole_diameter_100pct': 10.0,
    'mounting_hole_diameter_100pct': 4.0,

    # Counter detection
    'min_counter_area_ratio': 0.05,     # Min 5% of letter area to be a counter
    'max_hole_circularity': 0.85,       # Above = definitely a hole, not a counter

    # Containment
    'containment_tolerance': 0.5,

    # Scale detection tolerance
    'scale_detection_tolerance_10pct': 0.3,
    'scale_detection_tolerance_100pct': 3.0,
}


def detect_file_scale(paths_info: List[PathInfo], config: Dict = None) -> float:
    """
    Detect if file is 10% or 100% scale based on hole sizes.

    At 10% scale: wire holes ~ 1mm, mounting ~ 0.4mm
    At 100% scale: wire holes ~ 10mm, mounting ~ 4mm

    Returns:
        float: 0.1 for 10% scale, 1.0 for 100% scale
    """
    cfg = {**DEFAULT_CONFIG, **(config or {})}

    # Find all circles that look like holes
    circles = [p for p in paths_info if p.is_circle and p.circle_diameter]

    if not circles:
        return 1.0  # Default to 100% if no holes found

    wire_10pct = cfg['wire_hole_diameter_mm']
    mount_10pct = cfg['mounting_hole_diameter_mm']
    tol_10pct = cfg['scale_detection_tolerance_10pct']

    wire_100pct = cfg['wire_hole_diameter_100pct']
    mount_100pct = cfg['mounting_hole_diameter_100pct']
    tol_100pct = cfg['scale_detection_tolerance_100pct']

    votes_10pct = 0
    votes_100pct = 0

    for circle in circles:
        d = circle.circle_diameter

        # Check if diameter matches 10% scale values
        if abs(d - wire_10pct) < tol_10pct or abs(d - mount_10pct) < tol_10pct:
            votes_10pct += 1
        # Check if diameter matches 100% scale values
        elif abs(d - wire_100pct) < tol_100pct or abs(d - mount_100pct) < tol_100pct:
            votes_100pct += 1

    # Vote on scale
    if votes_10pct > votes_100pct:
        return 0.1
    elif votes_100pct > votes_10pct:
        return 1.0
    else:
        return 1.0  # Default to 100%


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

    letters = []
    for path in candidates:
        # Check if this path is contained in any other path on the same layer
        is_contained = False
        path_layer = (path.layer_name or '').lower()

        for other in candidates:
            if other.path_id == path.path_id:
                continue

            # Only compare paths on the same layer
            other_layer = (other.layer_name or '').lower()
            if path_layer != other_layer:
                continue

            # Use polygon containment if available
            if path.polygon and other.polygon:
                if polygon_contains(other.polygon, path.polygon):
                    is_contained = True
                    break
            else:
                # Fall back to bbox containment
                if path.bbox and other.bbox:
                    if bbox_contains(other.bbox, path.bbox, tolerance=1.0):
                        is_contained = True
                        break

        if not is_contained:
            letters.append(path)

    return letters


def is_counter_path(inner: PathInfo, outer: PathInfo, config: Dict = None) -> bool:
    """
    Determine if an inner path is a counter (inner letter shape like inside "O")
    or a hole.

    Counters are:
    - NOT circular (circularity < threshold)
    - Significant area (> min_ratio of letter area)

    Holes are:
    - Circular
    - Small

    Args:
        inner: The inner path to classify
        outer: The outer letter path
        config: Configuration dict

    Returns:
        True if inner is a counter, False if it's likely a hole
    """
    cfg = {**DEFAULT_CONFIG, **(config or {})}

    # If it's flagged as a circle, it's not a counter
    if inner.is_circle:
        return False

    # Calculate area ratio
    inner_area = inner.area or 0
    outer_area = outer.area or 0

    if outer_area <= 0:
        return False

    area_ratio = inner_area / outer_area

    # Must have significant area to be a counter
    if area_ratio < cfg['min_counter_area_ratio']:
        return False

    # Check circularity
    inner_perimeter = inner.length or 0
    if inner_perimeter > 0 and inner_area > 0:
        circularity = calculate_circularity(inner_area, inner_perimeter)
        if circularity > cfg['max_hole_circularity']:
            return False  # Too circular, likely a hole

    return True  # It's a counter


def classify_hole(path: PathInfo, scale: float, config: Dict = None) -> str:
    """
    Classify a circular path as wire, mounting, or unknown hole type.

    Args:
        path: PathInfo with circle detection data
        scale: File scale (0.1 for 10%, 1.0 for 100%)
        config: Configuration dict

    Returns:
        str: 'wire', 'mounting', or 'unknown'
    """
    cfg = {**DEFAULT_CONFIG, **(config or {})}

    if not path.is_circle or not path.circle_diameter:
        return 'unknown'

    d = path.circle_diameter

    # Adjust expected sizes based on scale
    if scale <= 0.15:  # 10% scale
        wire_d = cfg['wire_hole_diameter_mm']
        wire_tol = cfg['wire_hole_tolerance_mm']
        mount_d = cfg['mounting_hole_diameter_mm']
        mount_tol = cfg['mounting_hole_tolerance_mm']
    else:  # 100% scale
        wire_d = cfg['wire_hole_diameter_100pct']
        wire_tol = cfg['scale_detection_tolerance_100pct']
        mount_d = cfg['mounting_hole_diameter_100pct']
        mount_tol = cfg['scale_detection_tolerance_100pct'] / 2

    if abs(d - wire_d) <= wire_tol:
        return 'wire'
    elif abs(d - mount_d) <= mount_tol:
        return 'mounting'
    else:
        return 'unknown'


def path_is_inside_letter(hole: PathInfo, letter: PathInfo,
                          tolerance: float = 0.5) -> bool:
    """
    Check if a hole path is geometrically inside a letter path.

    Uses polygon containment with Shapely for accuracy.
    Falls back to bbox containment if polygons not available.

    Args:
        hole: The hole path
        letter: The letter path
        tolerance: Tolerance for edge cases

    Returns:
        True if hole is inside letter
    """
    # Prefer polygon-based containment
    if hole.polygon and letter.polygon:
        return polygon_contains(letter.polygon, hole.polygon, tolerance)

    # Fall back to centroid-in-polygon check
    if hole.bbox and letter.polygon:
        centroid = get_centroid(hole.bbox)
        return point_in_polygon(letter.polygon, centroid[0], centroid[1], tolerance)

    # Last resort: bbox containment
    if hole.bbox and letter.bbox:
        return bbox_contains(letter.bbox, hole.bbox, tolerance)

    return False


def find_paths_inside_letter(letter: PathInfo, all_paths: List[PathInfo],
                            tolerance: float = 0.5) -> List[PathInfo]:
    """
    Find all paths that are geometrically inside a letter.

    Args:
        letter: The letter path
        all_paths: List of all paths to check
        tolerance: Containment tolerance

    Returns:
        List of paths inside the letter
    """
    inside = []
    letter_layer = (letter.layer_name or '').lower()

    for path in all_paths:
        # Skip the letter itself
        if path.path_id == letter.path_id:
            continue

        # Only check paths on the same layer
        path_layer = (path.layer_name or '').lower()
        if path_layer != letter_layer:
            continue

        # Check containment
        if path_is_inside_letter(path, letter, tolerance):
            inside.append(path)

    return inside


def create_hole_info(path: PathInfo, hole_type: str) -> HoleInfo:
    """
    Create a HoleInfo object from a PathInfo.

    Args:
        path: The hole path
        hole_type: 'wire', 'mounting', or 'unknown'

    Returns:
        HoleInfo object
    """
    center = (0.0, 0.0)
    if path.bbox:
        center = get_centroid(path.bbox)

    return HoleInfo(
        path_id=path.path_id,
        hole_type=hole_type,
        diameter_mm=path.circle_diameter or 0.0,
        center=center,
        svg_path_data=path.d_attribute
    )


def build_letter_group(letter: PathInfo, inner_paths: List[PathInfo],
                       scale: float, config: Dict = None) -> LetterGroup:
    """
    Build a LetterGroup from a letter path and its inner paths.

    Args:
        letter: The main letter path
        inner_paths: Paths found inside the letter
        scale: File scale (0.1 or 1.0)
        config: Configuration dict

    Returns:
        LetterGroup object
    """
    cfg = {**DEFAULT_CONFIG, **(config or {})}

    counter_paths = []
    wire_holes = []
    mounting_holes = []
    unknown_holes = []

    for inner in inner_paths:
        if is_counter_path(inner, letter, cfg):
            counter_paths.append(inner)
        else:
            hole_type = classify_hole(inner, scale, cfg)
            hole_info = create_hole_info(inner, hole_type)

            if hole_type == 'wire':
                wire_holes.append(hole_info)
            elif hole_type == 'mounting':
                mounting_holes.append(hole_info)
            else:
                unknown_holes.append(hole_info)

    # Calculate net area (main - counters)
    main_area = letter.area or 0
    counter_area = sum(p.area or 0 for p in counter_paths)
    net_area = main_area - counter_area

    # Get bbox
    bbox = letter.bbox or (0, 0, 0, 0)
    if letter.transform_chain:
        bbox = apply_transform_to_bbox(bbox, letter.transform_chain)

    # Calculate real-world size
    width = bbox[2] - bbox[0]
    height = bbox[3] - bbox[1]

    # Convert to inches (72 points per inch at 100%, 7.2 at 10%)
    points_per_inch = 72 * scale
    real_width = width / points_per_inch if points_per_inch > 0 else 0
    real_height = height / points_per_inch if points_per_inch > 0 else 0
    real_area = net_area / (points_per_inch ** 2) if points_per_inch > 0 else 0

    return LetterGroup(
        letter_id=letter.path_id,
        main_path=letter,
        counter_paths=counter_paths,
        wire_holes=wire_holes,
        mounting_holes=mounting_holes,
        unknown_holes=unknown_holes,
        layer_name=letter.layer_name or '',
        bbox=bbox,
        area=real_area,
        detected_scale=scale,
        real_size_inches=(real_width, real_height)
    )


def analyze_letter_hole_associations(
    paths_info: List[PathInfo],
    layer_name: Optional[str] = None,
    config: Dict = None
) -> LetterAnalysisResult:
    """
    Main entry point for letter-hole analysis.

    Analyzes paths to:
    1. Identify letters (outer shapes)
    2. Find holes inside each letter
    3. Classify holes (wire/mounting)
    4. Flag orphan holes (outside all letters)

    Args:
        paths_info: List of all extracted paths
        layer_name: Optional layer to focus on (None = all layers)
        config: Configuration dict

    Returns:
        LetterAnalysisResult with all analysis data
    """
    cfg = {**DEFAULT_CONFIG, **(config or {})}

    # Detect file scale
    scale = detect_file_scale(paths_info, cfg)

    # Find all letters
    letters = identify_letters(paths_info, layer_name)

    if not letters:
        # No letters found, check for orphan circles
        circles = [p for p in paths_info if p.is_circle]
        orphan_holes = []
        for c in circles:
            hole_type = classify_hole(c, scale, cfg)
            orphan_holes.append(create_hole_info(c, hole_type))

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

    # Build letter groups
    letter_groups = []
    for letter in letters:
        # Find paths inside this letter
        inner_paths = find_paths_inside_letter(
            letter, paths_info, cfg['containment_tolerance']
        )

        # Track assigned paths
        for inner in inner_paths:
            assigned_path_ids.add(inner.path_id)

        # Build the letter group
        group = build_letter_group(letter, inner_paths, scale, cfg)
        letter_groups.append(group)

    # Find orphan holes (circles not assigned to any letter)
    orphan_holes = []
    circles = [p for p in paths_info if p.is_circle and p.path_id not in assigned_path_ids]
    for c in circles:
        # Filter by layer if specified
        if layer_name:
            c_layer = (c.layer_name or '').lower()
            if c_layer != layer_name.lower():
                continue

        hole_type = classify_hole(c, scale, cfg)
        orphan_holes.append(create_hole_info(c, hole_type))

    # Find unassigned non-circle paths
    unassigned_paths = [
        p for p in paths_info
        if p.path_id not in assigned_path_ids
        and not p.is_circle
        and p.is_closed
    ]

    # Build stats
    layers_with_letters = list(set(lg.layer_name for lg in letter_groups if lg.layer_name))

    return LetterAnalysisResult(
        letter_groups=letter_groups,
        orphan_holes=orphan_holes,
        unassigned_paths=unassigned_paths,
        detected_scale=scale,
        stats={
            'layers_analyzed': layers_with_letters,
            'total_paths': len(paths_info),
            'letters_found': len(letter_groups),
            'circles_found': sum(1 for p in paths_info if p.is_circle)
        }
    )


def generate_letter_analysis_issues(
    analysis: LetterAnalysisResult,
    config: Dict = None
) -> List[Dict[str, Any]]:
    """
    Generate validation issues from letter analysis results.

    Args:
        analysis: LetterAnalysisResult from analyze_letter_hole_associations
        config: Configuration dict

    Returns:
        List of issue dicts with rule, severity, message, details
    """
    cfg = {**DEFAULT_CONFIG, **(config or {})}
    issues = []

    # Orphan holes are errors
    for hole in analysis.orphan_holes:
        issues.append({
            'rule': 'orphan_hole',
            'severity': 'error',
            'message': f'Hole {hole.path_id} ({hole.hole_type}, {hole.diameter_mm:.2f}mm) is outside all letters',
            'path_id': hole.path_id,
            'details': {
                'hole_type': hole.hole_type,
                'diameter_mm': hole.diameter_mm,
                'center': hole.center
            }
        })

    # Check each letter for required holes
    for letter in analysis.letter_groups:
        # No wire hole is an error
        if len(letter.wire_holes) == 0:
            issues.append({
                'rule': 'letter_no_wire_hole',
                'severity': 'error',
                'message': f'Letter {letter.letter_id} has no wire hole',
                'path_id': letter.letter_id,
                'details': {
                    'layer': letter.layer_name,
                    'size_inches': letter.real_size_inches,
                    'hole_counts': {
                        'wire': len(letter.wire_holes),
                        'mounting': len(letter.mounting_holes),
                        'unknown': len(letter.unknown_holes)
                    }
                }
            })

        # Multiple wire holes is a warning
        if len(letter.wire_holes) > 1:
            issues.append({
                'rule': 'letter_multiple_wire_holes',
                'severity': 'warning',
                'message': f'Letter {letter.letter_id} has {len(letter.wire_holes)} wire holes, expected 1',
                'path_id': letter.letter_id,
                'details': {
                    'wire_hole_count': len(letter.wire_holes),
                    'wire_holes': [h.to_dict() for h in letter.wire_holes]
                }
            })

        # Unknown holes are info
        for hole in letter.unknown_holes:
            issues.append({
                'rule': 'unknown_hole_size',
                'severity': 'info',
                'message': f'Hole {hole.path_id} in letter {letter.letter_id} has unusual diameter {hole.diameter_mm:.2f}mm',
                'path_id': hole.path_id,
                'details': {
                    'letter_id': letter.letter_id,
                    'diameter_mm': hole.diameter_mm,
                    'expected_wire': cfg['wire_hole_diameter_mm'] if analysis.detected_scale <= 0.15 else cfg['wire_hole_diameter_100pct'],
                    'expected_mounting': cfg['mounting_hole_diameter_mm'] if analysis.detected_scale <= 0.15 else cfg['mounting_hole_diameter_100pct']
                }
            })

    return issues
