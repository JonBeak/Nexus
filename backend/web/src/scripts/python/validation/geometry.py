"""
Geometric utilities for path analysis.
"""

from typing import Tuple, Optional

try:
    from shapely.geometry import Polygon
except ImportError:
    Polygon = None


def get_centroid(bbox: Tuple[float, float, float, float]) -> Tuple[float, float]:
    """Get centroid of a bounding box."""
    xmin, ymin, xmax, ymax = bbox
    return ((xmin + xmax) / 2, (ymin + ymax) / 2)


def bbox_contains(outer: Tuple[float, float, float, float],
                  inner: Tuple[float, float, float, float],
                  tolerance: float = 0.5) -> bool:
    """Check if outer bbox fully contains inner bbox with tolerance."""
    return (inner[0] >= outer[0] - tolerance and
            inner[1] >= outer[1] - tolerance and
            inner[2] <= outer[2] + tolerance and
            inner[3] <= outer[3] + tolerance)


def bbox_area(bbox: Tuple[float, float, float, float]) -> float:
    """Calculate area of a bounding box."""
    xmin, ymin, xmax, ymax = bbox
    return (xmax - xmin) * (ymax - ymin)


def bbox_perimeter(bbox: Tuple[float, float, float, float]) -> float:
    """Calculate perimeter of a bounding box."""
    xmin, ymin, xmax, ymax = bbox
    return 2 * ((xmax - xmin) + (ymax - ymin))


def is_circle_path(path) -> Tuple[bool, Optional[float]]:
    """
    Determine if a path is approximately circular.

    Returns:
        Tuple of (is_circle, diameter) where diameter is in file units
    """
    try:
        if len(path) < 2:
            return False, None

        xmin, xmax, ymin, ymax = path.bbox()
        width = xmax - xmin
        height = ymax - ymin

        if width <= 0 or height <= 0:
            return False, None

        # Check aspect ratio (circles are square)
        aspect_ratio = min(width, height) / max(width, height)
        if aspect_ratio < 0.9:
            return False, None

        # Check path length vs expected circumference
        expected_circumference = 3.14159 * (width + height) / 2
        actual_length = path.length()

        length_ratio = actual_length / expected_circumference if expected_circumference > 0 else 0
        if abs(length_ratio - 1.0) > 0.15:
            return False, None

        diameter = (width + height) / 2
        return True, diameter

    except Exception:
        return False, None


def path_to_polygon(path, samples_per_segment: int = 10) -> Optional[Polygon]:
    """
    Convert svgpathtools Path to Shapely Polygon by sampling points.
    """
    if Polygon is None:
        return None

    try:
        points = []
        for i in range(len(path)):
            segment = path[i]
            for t in range(samples_per_segment):
                point = segment.point(t / samples_per_segment)
                points.append((point.real, point.imag))

        if len(points) >= 3:
            first_point = path[0].point(0)
            points.append((first_point.real, first_point.imag))

            try:
                polygon = Polygon(points)
                if polygon.is_valid:
                    return polygon
                return polygon.buffer(0)
            except Exception:
                return None

        return None
    except Exception:
        return None


def centroid_distance(bbox1: Tuple[float, float, float, float],
                      bbox2: Tuple[float, float, float, float]) -> float:
    """Calculate distance between centroids of two bounding boxes."""
    c1 = get_centroid(bbox1)
    c2 = get_centroid(bbox2)
    dx = c1[0] - c2[0]
    dy = c1[1] - c2[1]
    return (dx ** 2 + dy ** 2) ** 0.5


def calculate_circularity(area: float, perimeter: float) -> float:
    """
    Calculate circularity metric (isoperimetric quotient).

    Formula: 4 * pi * area / perimeter^2

    Returns:
        float: 1.0 for perfect circle, <1.0 for less circular shapes
               Complex shapes like letters typically have circularity < 0.5
    """
    from math import pi
    if perimeter <= 0:
        return 0.0
    return (4.0 * pi * area) / (perimeter ** 2)


def polygon_contains(outer: Optional[Polygon], inner: Optional[Polygon],
                    tolerance: float = 0.5) -> bool:
    """
    Check if outer polygon fully contains inner polygon using Shapely.

    Uses centroid containment as primary check, with buffer tolerance
    for edge cases.

    Args:
        outer: Shapely Polygon for the outer (letter) boundary
        inner: Shapely Polygon for the inner (hole) shape
        tolerance: Buffer tolerance for edge cases

    Returns:
        True if inner is contained within outer
    """
    if outer is None or inner is None:
        return False

    try:
        # Primary check: inner's centroid must be inside outer
        inner_centroid = inner.centroid
        if outer.contains(inner_centroid):
            return True

        # Secondary check: with tolerance buffer for edge cases
        buffered_outer = outer.buffer(tolerance)
        return buffered_outer.contains(inner)
    except Exception:
        return False


def point_in_polygon(polygon: Optional[Polygon], x: float, y: float,
                     tolerance: float = 0.0) -> bool:
    """
    Check if a point is inside a polygon.

    Args:
        polygon: Shapely Polygon
        x, y: Point coordinates
        tolerance: Buffer tolerance (positive to expand, negative to shrink)

    Returns:
        True if point is inside polygon
    """
    if polygon is None:
        return False

    try:
        if Polygon is None:
            return False
        from shapely.geometry import Point
        point = Point(x, y)

        if tolerance != 0.0:
            polygon = polygon.buffer(tolerance)

        return polygon.contains(point)
    except Exception:
        return False
