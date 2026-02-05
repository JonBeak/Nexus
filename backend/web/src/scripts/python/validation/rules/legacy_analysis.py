"""
Legacy bbox-based letter analysis functions.

Extracted from front_lit.py to keep spec-specific rules focused on classification
and issue generation. These functions provide:
- Bbox-based letter identification (fallback when polygon analysis unavailable)
- Bbox-based hole containment checking
- Trim-to-return letter matching
- LetterGroup to LetterAnalysis conversion adapter
"""

from typing import List, Dict, Optional, Tuple, Any

from ..core import PathInfo, LetterAnalysis, LetterAnalysisResult
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
        # If original_bbox exists, bbox was already globally transformed by letter_analysis.py
        if hasattr(p, 'original_bbox') and p.original_bbox:
            transformed_bbox = p.bbox
        else:
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

        circle_bbox = path.bbox

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
    wire_hole_diameter = rules.get('wire_hole_diameter_mm', 2.75)
    wire_hole_tolerance = rules.get('wire_hole_tolerance_mm', 0.5)
    mounting_hole_diameter = rules.get('mounting_hole_diameter_mm', 1.08)
    mounting_hole_tolerance = rules.get('mounting_hole_tolerance_mm', 0.3)

    outside_paths = identify_outside_paths(paths_info, layer_name)

    analyses = []
    for letter in outside_paths:
        if not letter.bbox:
            continue

        if hasattr(letter, 'original_bbox') and letter.original_bbox:
            bbox = letter.bbox
            raw_bbox = letter.original_bbox
        else:
            bbox = apply_transform_to_bbox(letter.bbox, letter.transform_chain or '')
            raw_bbox = letter.bbox
        width = bbox[2] - bbox[0]
        height = bbox[3] - bbox[1]
        raw_w = raw_bbox[2] - raw_bbox[0]
        raw_h = raw_bbox[3] - raw_bbox[1]
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
            mounting_hole_count=mounting_count,
            raw_width=raw_w,
            raw_height=raw_h,
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


def convert_letter_groups_to_analysis(
    letter_analysis: LetterAnalysisResult,
    layer_name: str,
    file_scale: float
) -> List[LetterAnalysis]:
    """
    Convert LetterGroup objects from letter_analysis.py to LetterAnalysis
    for backwards compatibility with existing front_lit validation code.

    Args:
        letter_analysis: The pre-computed LetterAnalysisResult
        layer_name: The layer to filter by (e.g., 'return')
        file_scale: File scale factor

    Returns:
        List of LetterAnalysis objects
    """
    analyses = []

    for group in letter_analysis.letter_groups:
        # Filter by layer
        if layer_name and group.layer_name.lower() != layer_name.lower():
            continue

        # Build contained_holes list from hole info
        contained_holes = []
        for hole in group.wire_holes:
            contained_holes.append({
                'path_id': hole.path_id,
                'diameter': hole.diameter_mm,
                'hole_type': 'wire',
                'bbox': None
            })
        for hole in group.mounting_holes:
            contained_holes.append({
                'path_id': hole.path_id,
                'diameter': hole.diameter_mm,
                'hole_type': 'mounting',
                'bbox': None
            })
        for hole in group.unknown_holes:
            contained_holes.append({
                'path_id': hole.path_id,
                'diameter': hole.diameter_mm,
                'hole_type': 'unknown',
                'bbox': None
            })

        centroid = get_centroid(group.bbox)

        width = group.bbox[2] - group.bbox[0]
        height = group.bbox[3] - group.bbox[1]

        raw_w = group.raw_bbox[2] - group.raw_bbox[0] if group.raw_bbox else width
        raw_h = group.raw_bbox[3] - group.raw_bbox[1] if group.raw_bbox else height

        area = group.main_path.area or 0
        perimeter = group.main_path.length or 0

        analyses.append(LetterAnalysis(
            path_id=group.letter_id,
            layer=group.layer_name,
            bbox=group.bbox,
            width=width,
            height=height,
            area=area,
            perimeter=perimeter,
            centroid=centroid,
            contained_holes=contained_holes,
            raw_width=raw_w,
            raw_height=raw_h,
            wire_hole_count=len(group.wire_holes),
            mounting_hole_count=len(group.mounting_holes)
        ))

    return analyses
