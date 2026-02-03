"""
Base validation rules that apply to all file types.
"""

import re
from typing import List, Dict, Tuple

from .core import PathInfo, ValidationIssue


def check_overlapping_paths(paths_info: List[PathInfo], rules: Dict) -> List[ValidationIssue]:
    """
    Check for duplicate overlapping objects within the same layer.
    """
    issues = []
    tolerance = rules.get('tolerance', 0.01)

    path_groups: Dict[Tuple[str, str, str], List[PathInfo]] = {}

    for path in paths_info:
        layer = path.layer_name or '_unknown_'
        if layer == '_defs_':
            continue

        d_normalized = re.sub(r'\s+', ' ', path.d_attribute.strip())
        transform = path.transform_chain or ''

        key = (layer, d_normalized, transform)
        if key not in path_groups:
            path_groups[key] = []
        path_groups[key].append(path)

    for (layer, d_attr, transform), group in path_groups.items():
        if len(group) > 1:
            for i in range(len(group)):
                for j in range(i + 1, len(group)):
                    path_a = group[i]
                    path_b = group[j]

                    if path_a.bbox and path_b.bbox:
                        bbox_match = all(
                            abs(a - b) < tolerance
                            for a, b in zip(path_a.bbox, path_b.bbox)
                        )

                        if bbox_match:
                            issues.append(ValidationIssue(
                                rule='no_duplicate_overlapping',
                                severity='error',
                                message=f'Duplicate overlapping paths on layer "{layer}": {path_a.path_id} and {path_b.path_id}',
                                path_id=path_a.path_id,
                                details={
                                    'duplicate_of': path_b.path_id,
                                    'layer': layer,
                                    'bbox': path_a.bbox
                                }
                            ))

    return issues


def check_stroke_requirements(paths_info: List[PathInfo], rules: Dict) -> List[ValidationIssue]:
    """
    Validate stroke requirements.
    """
    issues = []

    required_color = rules.get('required_color')
    if required_color:
        required_color = required_color.lower()

    required_width = rules.get('required_width')
    width_tolerance = rules.get('tolerance', 0.1)
    allow_fill = rules.get('allow_fill', True)

    for path in paths_info:
        if required_color and path.stroke and path.stroke.lower() != required_color:
            issues.append(ValidationIssue(
                rule='stroke_requirements',
                severity='error',
                message=f'Path {path.path_id} has incorrect stroke color: {path.stroke} (expected {required_color})',
                path_id=path.path_id,
                details={'actual_stroke': path.stroke, 'expected': required_color}
            ))

        if required_width is not None and path.stroke_width is not None:
            if abs(path.stroke_width - required_width) > width_tolerance:
                issues.append(ValidationIssue(
                    rule='stroke_requirements',
                    severity='error',
                    message=f'Path {path.path_id} has incorrect stroke width: {path.stroke_width:.2f}pt (expected {required_width}pt)',
                    path_id=path.path_id,
                    details={'actual_width': path.stroke_width, 'expected': required_width}
                ))

        if not allow_fill and path.fill and path.fill != 'none':
            issues.append(ValidationIssue(
                rule='stroke_requirements',
                severity='error',
                message=f'Path {path.path_id} has fill: {path.fill} (expected no fill)',
                path_id=path.path_id,
                details={'actual_fill': path.fill}
            ))

    return issues


def check_mounting_holes(paths_info: List[PathInfo], rules: Dict) -> List[ValidationIssue]:
    """
    Check that backing paths have appropriate mounting holes based on size.
    """
    issues = []

    min_holes = rules.get('min_holes', 2)
    holes_per_sq_inch = rules.get('holes_per_sq_inch', 0.01)
    min_perimeter_for_holes = rules.get('min_perimeter_for_holes', 48)

    for path in paths_info:
        if not path.is_closed or path.area is None:
            continue

        area_sq_inches = path.area / (72 * 72)
        perimeter_inches = path.length / 72

        if perimeter_inches < min_perimeter_for_holes:
            continue

        required_holes = max(min_holes, int(area_sq_inches * holes_per_sq_inch))

        if path.num_holes < required_holes:
            issues.append(ValidationIssue(
                rule='structural_mounting_holes',
                severity='warning',
                message=f'Path {path.path_id} may need more mounting holes: has {path.num_holes}, suggested {required_holes} based on {area_sq_inches:.1f} sq in area',
                path_id=path.path_id,
                details={
                    'actual_holes': path.num_holes,
                    'suggested_holes': required_holes,
                    'area_sq_inches': round(area_sq_inches, 2),
                    'perimeter_inches': round(perimeter_inches, 2)
                }
            ))

    return issues


def check_path_closure(paths_info: List[PathInfo], rules: Dict) -> List[ValidationIssue]:
    """
    Check that paths are properly closed.
    """
    issues = []

    for path in paths_info:
        if not path.is_closed and path.length > 10:
            issues.append(ValidationIssue(
                rule='path_closure',
                severity='warning',
                message=f'Path {path.path_id} may not be properly closed',
                path_id=path.path_id,
                details={'length': round(path.length, 2)}
            ))

    return issues
