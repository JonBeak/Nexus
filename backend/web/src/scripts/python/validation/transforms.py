"""
SVG Transform utilities - parsing and applying transforms to coordinates.
"""

import re
from typing import List, Tuple


def parse_transform(transform_str: str) -> List[Tuple[str, List[float]]]:
    """
    Parse SVG transform string into list of (transform_type, values).
    Supports: translate, scale, rotate, matrix, skewX, skewY
    """
    if not transform_str:
        return []

    transforms = []
    pattern = r'(\w+)\s*\(\s*([^)]+)\s*\)'

    for match in re.finditer(pattern, transform_str):
        transform_type = match.group(1).lower()
        values_str = match.group(2)
        values = [float(v.strip()) for v in re.split(r'[,\s]+', values_str) if v.strip()]
        transforms.append((transform_type, values))

    return transforms


def apply_transform_to_point(x: float, y: float,
                             transforms: List[Tuple[str, List[float]]]) -> Tuple[float, float]:
    """
    Apply a list of transforms to a point.
    Transforms are applied in order (first in list applied first).
    """
    for transform_type, values in transforms:
        if transform_type == 'translate':
            tx = values[0] if len(values) > 0 else 0
            ty = values[1] if len(values) > 1 else 0
            x += tx
            y += ty
        elif transform_type == 'scale':
            sx = values[0] if len(values) > 0 else 1
            sy = values[1] if len(values) > 1 else sx
            x *= sx
            y *= sy
        elif transform_type == 'matrix':
            if len(values) >= 6:
                a, b, c, d, e, f = values[:6]
                new_x = a * x + c * y + e
                new_y = b * x + d * y + f
                x, y = new_x, new_y
        elif transform_type == 'rotate':
            import math
            angle = math.radians(values[0]) if len(values) > 0 else 0
            cx = values[1] if len(values) > 1 else 0
            cy = values[2] if len(values) > 2 else 0
            # Translate to origin, rotate, translate back
            x -= cx
            y -= cy
            cos_a, sin_a = math.cos(angle), math.sin(angle)
            new_x = x * cos_a - y * sin_a
            new_y = x * sin_a + y * cos_a
            x = new_x + cx
            y = new_y + cy

    return x, y


def apply_transform_to_bbox(bbox: Tuple[float, float, float, float],
                            transform_chain: str) -> Tuple[float, float, float, float]:
    """
    Apply transform chain to a bounding box and return transformed bbox.
    Transform chain is pipe-separated: "transform1|transform2|..."
    """
    if not transform_chain:
        return bbox

    xmin, ymin, xmax, ymax = bbox

    # Parse all transforms in the chain
    all_transforms = []
    for transform_str in transform_chain.split('|'):
        all_transforms.extend(parse_transform(transform_str))

    if not all_transforms:
        return bbox

    # Transform all four corners and compute new bbox
    corners = [(xmin, ymin), (xmax, ymin), (xmin, ymax), (xmax, ymax)]
    transformed = [apply_transform_to_point(x, y, all_transforms) for x, y in corners]

    new_xmin = min(c[0] for c in transformed)
    new_xmax = max(c[0] for c in transformed)
    new_ymin = min(c[1] for c in transformed)
    new_ymax = max(c[1] for c in transformed)

    return (new_xmin, new_ymin, new_xmax, new_ymax)
