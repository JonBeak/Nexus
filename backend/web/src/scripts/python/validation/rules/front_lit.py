"""
Front Lit Channel Letter Validation Rules

Validates structural requirements for Front Lit channel letter working files:
1. Wire holes in Return layer (if LEDs are present)
2. Mounting holes based on letter size
3. Trim layer path count matches Return layer
4. Trim offset from Return is within tolerance

File scale assumptions:
- Working files are at 10% scale (multiply by 10 for real-world dimensions)
- Wire hole: ~10mm real = 1mm in file
- Mounting hole: ~4mm real = 0.4mm in file
- Trim offset: 2mm real per side = 0.2mm in file per side

Trim offset note:
- At straight edges, trim extends by the perpendicular offset
- At corners, mitered joints extend further: offset / sin(angle/2)
- For 90° corner: 1.41x the perpendicular offset
- For 60° corner: 2.0x the perpendicular offset
- For 30° corner: 3.86x the perpendicular offset
- Miter limit of 4 means max extension is 4x before bevel kicks in
- We use miter_factor to allow for this variation in bbox measurements
"""

from typing import List, Dict, Optional, Tuple, Any

try:
    from shapely.geometry import Point
except ImportError:
    Point = None

from ..core import PathInfo, ValidationIssue, LetterAnalysis
from ..transforms import apply_transform_to_bbox
from ..geometry import get_centroid, bbox_contains


def identify_outside_paths(paths_info: List[PathInfo], layer_name: str) -> List[PathInfo]:
    """
    Find closed paths that are NOT contained within other paths on the same layer.
    These are the letter outlines (outside paths).
    """
    layer_paths = [p for p in paths_info if p.layer_name and
                   p.layer_name.lower() == layer_name.lower() and
                   p.is_closed and p.bbox]

    if not layer_paths:
        return []

    path_bboxes = []
    for p in layer_paths:
        transformed_bbox = apply_transform_to_bbox(p.bbox, p.transform_chain or '')
        path_bboxes.append((p, transformed_bbox))

    outside_paths = []
    for path, bbox in path_bboxes:
        is_inside_another = False

        for other_path, other_bbox in path_bboxes:
            if path.path_id == other_path.path_id:
                continue

            if path.is_circle:
                is_inside_another = True
                break

            if bbox_contains(other_bbox, bbox, tolerance=1.0):
                is_inside_another = True
                break

        if not is_inside_another:
            outside_paths.append(path)

    return outside_paths


def find_contained_circles(letter_path: PathInfo,
                           all_paths: List[PathInfo],
                           wire_hole_diameter: float,
                           wire_hole_tolerance: float,
                           mounting_hole_diameter: float,
                           mounting_hole_tolerance: float) -> List[Dict[str, Any]]:
    """
    Find all circles contained within a letter path and classify them.
    Uses bbox containment check - circles must be fully within the letter's bbox.
    """
    if not letter_path.bbox:
        return []

    # Use raw bbox (untransformed) for containment check
    # This ensures we're comparing in the same coordinate space
    letter_bbox = letter_path.bbox
    same_layer = letter_path.layer_name

    contained_holes = []

    for path in all_paths:
        if not path.layer_name or path.layer_name.lower() != same_layer.lower():
            continue

        if not path.is_circle or not path.circle_diameter:
            continue

        if path.path_id == letter_path.path_id:
            continue

        if not path.bbox:
            continue

        # Use raw bbox for circle too
        circle_bbox = path.bbox

        # Check if circle is fully contained within letter bbox
        if not bbox_contains(letter_bbox, circle_bbox, tolerance=1.0):
            continue

        diameter = path.circle_diameter
        hole_type = 'unknown'

        if abs(diameter - wire_hole_diameter) <= wire_hole_tolerance:
            hole_type = 'wire'
        elif abs(diameter - mounting_hole_diameter) <= mounting_hole_tolerance:
            hole_type = 'mounting'

        contained_holes.append({
            'path_id': path.path_id,
            'diameter': diameter,
            'hole_type': hole_type,
            'bbox': circle_bbox
        })

    return contained_holes


def analyze_letters_in_layer(paths_info: List[PathInfo],
                             layer_name: str,
                             rules: Dict) -> List[LetterAnalysis]:
    """
    Analyze all letters (outside paths) in a layer, including their contained holes.
    """
    wire_hole_diameter = rules.get('wire_hole_diameter_mm', 1.0)
    wire_hole_tolerance = rules.get('wire_hole_tolerance_mm', 0.2)
    mounting_hole_diameter = rules.get('mounting_hole_diameter_mm', 0.4)
    mounting_hole_tolerance = rules.get('mounting_hole_tolerance_mm', 0.1)

    outside_paths = identify_outside_paths(paths_info, layer_name)

    analyses = []
    for letter in outside_paths:
        if not letter.bbox:
            continue

        bbox = apply_transform_to_bbox(letter.bbox, letter.transform_chain or '')
        width = bbox[2] - bbox[0]
        height = bbox[3] - bbox[1]
        centroid = get_centroid(bbox)

        contained = find_contained_circles(
            letter, paths_info,
            wire_hole_diameter, wire_hole_tolerance,
            mounting_hole_diameter, mounting_hole_tolerance
        )

        wire_count = sum(1 for h in contained if h['hole_type'] == 'wire')
        mounting_count = sum(1 for h in contained if h['hole_type'] == 'mounting')

        analyses.append(LetterAnalysis(
            path_id=letter.path_id,
            layer=layer_name,
            bbox=bbox,
            width=width,
            height=height,
            area=letter.area or 0,
            perimeter=letter.length,
            centroid=centroid,
            contained_holes=contained,
            wire_hole_count=wire_count,
            mounting_hole_count=mounting_count
        ))

    return analyses


def match_trim_to_return(trim_letters: List[LetterAnalysis],
                         return_letters: List[LetterAnalysis]) -> List[Tuple[LetterAnalysis, Optional[LetterAnalysis], float]]:
    """
    Match each trim letter to its corresponding return letter based on centroid proximity.
    """
    matches = []

    for trim in trim_letters:
        best_match = None
        best_distance = float('inf')

        for ret in return_letters:
            dx = trim.centroid[0] - ret.centroid[0]
            dy = trim.centroid[1] - ret.centroid[1]
            distance = (dx ** 2 + dy ** 2) ** 0.5

            if distance < best_distance:
                best_distance = distance
                best_match = ret

        matches.append((trim, best_match, best_distance))

    return matches


def check_front_lit_structure(paths_info: List[PathInfo], rules: Dict) -> List[ValidationIssue]:
    """
    Validate Front Lit channel letter structural requirements.

    Rules:
    1. Wire holes: Each letter in Return layer must have exactly 1 wire hole (if LEDs present)
    2. Mounting holes: Minimum based on letter size (perimeter and area)
    3. Trim count: Trim layer must have same number of letters as Return layer
    4. Trim offset: Each trim shape must be ~2mm larger per side than corresponding return
    """
    issues = []

    # Configuration
    return_layer = rules.get('return_layer', 'return')
    trim_layer = rules.get('trim_layer', 'trimcap')
    file_scale = rules.get('file_scale', 0.1)
    check_wire_holes = rules.get('check_wire_holes', True)
    min_mounting_holes = rules.get('min_mounting_holes', 2)
    holes_per_inch_perimeter = rules.get('mounting_holes_per_inch_perimeter', 0.05)
    holes_per_sq_inch_area = rules.get('mounting_holes_per_sq_inch_area', 0.0123)
    trim_offset_min = rules.get('trim_offset_min_mm', 0.19)
    trim_offset_max = rules.get('trim_offset_max_mm', 0.21)
    # Miter factor accounts for corners extending further than perpendicular offset
    # With miter limit of 4, corners can extend up to 4x the offset before beveling
    miter_factor = rules.get('miter_factor', 4.0)

    # Analyze Return layer
    return_letters = analyze_letters_in_layer(paths_info, return_layer, rules)

    if not return_letters:
        layers_found = set(p.layer_name for p in paths_info if p.layer_name)
        issues.append(ValidationIssue(
            rule='front_lit_structure',
            severity='warning',
            message=f'No letters found in "{return_layer}" layer. Available layers: {", ".join(layers_found)}',
            details={'available_layers': list(layers_found)}
        ))
        return issues

    # Add info about detected letters for debugging
    issues.append(ValidationIssue(
        rule='front_lit_structure',
        severity='info',
        message=f'Found {len(return_letters)} letter(s) in {return_layer} layer',
        details={
            'layer': return_layer,
            'count': len(return_letters),
            'letters': [{'path_id': l.path_id, 'centroid': l.centroid, 'width': round(l.width, 1), 'height': round(l.height, 1)} for l in return_letters]
        }
    ))

    # Scale factor: at 10% scale, 1" real = 7.2 points in file
    points_per_real_inch = 72 * file_scale

    # Rule 1: Wire holes
    if check_wire_holes:
        for letter in return_letters:
            if letter.wire_hole_count == 0:
                issues.append(ValidationIssue(
                    rule='front_lit_wire_holes',
                    severity='error',
                    message=f'Letter {letter.path_id} in {return_layer} layer has no wire hole',
                    path_id=letter.path_id,
                    details={
                        'layer': letter.layer,
                        'bbox': letter.bbox,
                        'total_holes_found': len(letter.contained_holes)
                    }
                ))
            elif letter.wire_hole_count > 1:
                issues.append(ValidationIssue(
                    rule='front_lit_wire_holes',
                    severity='warning',
                    message=f'Letter {letter.path_id} has {letter.wire_hole_count} wire holes, expected 1',
                    path_id=letter.path_id,
                    details={
                        'layer': letter.layer,
                        'wire_hole_count': letter.wire_hole_count,
                        'letter_bbox': letter.bbox,
                        'letter_width': letter.width,
                        'letter_height': letter.height,
                        'holes_detected': letter.contained_holes
                    }
                ))

    # Rule 2: Mounting holes
    for letter in return_letters:
        real_perimeter_inches = letter.perimeter / points_per_real_inch
        real_area_sq_inches = letter.area / (points_per_real_inch ** 2)

        holes_by_perimeter = int(real_perimeter_inches * holes_per_inch_perimeter)
        holes_by_area = int(real_area_sq_inches * holes_per_sq_inch_area)
        required_holes = max(min_mounting_holes, holes_by_perimeter, holes_by_area)

        if letter.mounting_hole_count < required_holes:
            issues.append(ValidationIssue(
                rule='front_lit_mounting_holes',
                severity='warning',
                message=f'Letter {letter.path_id} needs {required_holes} mounting holes, has {letter.mounting_hole_count}',
                path_id=letter.path_id,
                details={
                    'layer': letter.layer,
                    'actual_holes': letter.mounting_hole_count,
                    'required_holes': required_holes,
                    'real_perimeter_inches': round(real_perimeter_inches, 2),
                    'real_area_sq_inches': round(real_area_sq_inches, 2),
                    'holes_by_perimeter': holes_by_perimeter,
                    'holes_by_area': holes_by_area
                }
            ))

    # Rule 3: Trim count
    trim_letters = analyze_letters_in_layer(paths_info, trim_layer, rules)

    # Add info about detected trim letters for debugging
    issues.append(ValidationIssue(
        rule='front_lit_structure',
        severity='info',
        message=f'Found {len(trim_letters)} letter(s) in {trim_layer} layer',
        details={
            'layer': trim_layer,
            'count': len(trim_letters),
            'letters': [{'path_id': l.path_id, 'centroid': l.centroid, 'width': round(l.width, 1), 'height': round(l.height, 1)} for l in trim_letters]
        }
    ))

    if len(trim_letters) != len(return_letters):
        issues.append(ValidationIssue(
            rule='front_lit_trim_count',
            severity='error',
            message=f'{trim_layer} layer has {len(trim_letters)} letters, {return_layer} has {len(return_letters)}',
            details={
                'trim_count': len(trim_letters),
                'return_count': len(return_letters),
                'trim_layer': trim_layer,
                'return_layer': return_layer
            }
        ))

    # Rule 4: Trim offset
    # Max distance for a valid match - trim and return should be nearly coincident
    # At 10% scale, a few mm offset = a few units. 10 units is generous.
    max_match_distance = rules.get('max_match_distance', 10.0)

    if trim_letters and return_letters:
        matches = match_trim_to_return(trim_letters, return_letters)

        for trim, return_match, distance in matches:
            if return_match is None or distance > max_match_distance:
                issues.append(ValidationIssue(
                    rule='front_lit_trim_offset',
                    severity='warning',
                    message=f'Trim letter {trim.path_id} has no matching return letter (nearest is {distance:.1f} units away)',
                    path_id=trim.path_id,
                    details={
                        'trim_path_id': trim.path_id,
                        'trim_bbox': trim.bbox,
                        'nearest_return': return_match.path_id if return_match else None,
                        'distance': round(distance, 2)
                    }
                ))
                continue

            width_diff = trim.width - return_match.width
            height_diff = trim.height - return_match.height
            width_offset_per_side = width_diff / 2
            height_offset_per_side = height_diff / 2

            # Min offset: straight edges should have at least the minimum offset
            # Max offset: corners with miters can extend up to miter_factor * max_offset
            max_with_miter = trim_offset_max * miter_factor

            width_ok = trim_offset_min <= width_offset_per_side <= max_with_miter
            height_ok = trim_offset_min <= height_offset_per_side <= max_with_miter

            if not width_ok or not height_ok:
                expected_total_min = trim_offset_min * 2
                expected_total_max = max_with_miter * 2

                issues.append(ValidationIssue(
                    rule='front_lit_trim_offset',
                    severity='error',
                    message=f'Trim {trim.path_id} offset incorrect: width diff {width_diff:.2f}mm, height diff {height_diff:.2f}mm (expected {expected_total_min:.2f}-{expected_total_max:.2f}mm total)',
                    path_id=trim.path_id,
                    details={
                        'trim_path_id': trim.path_id,
                        'return_path_id': return_match.path_id,
                        'trim_bbox': trim.bbox,
                        'trim_width': trim.width,
                        'trim_height': trim.height,
                        'return_bbox': return_match.bbox,
                        'return_width': return_match.width,
                        'return_height': return_match.height,
                        'width_diff_mm': round(width_diff, 3),
                        'height_diff_mm': round(height_diff, 3),
                        'centroid_distance': round(distance, 2),
                        'expected_min_total': expected_total_min,
                        'expected_max_total': expected_total_max,
                        'miter_factor': miter_factor
                    }
                ))

    return issues
