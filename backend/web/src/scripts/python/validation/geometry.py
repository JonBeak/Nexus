"""
Geometric utilities for path analysis.
"""

from typing import Tuple, Optional

try:
    from shapely.geometry import Polygon
    from shapely.geometry import JOIN_STYLE as _JOIN_STYLE
except ImportError:
    Polygon = None
    _JOIN_STYLE = None


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


def compound_path_to_polygon(path, samples_per_segment: int = 10) -> Optional[Polygon]:
    """
    Convert a compound SVG path (multiple subpaths like M...Z M...Z) to a
    Shapely Polygon with interior rings.

    The largest-area subpath becomes the exterior ring; all others become
    interior rings (counter holes, e.g., inside "A", "O", "B").

    Falls back to path_to_polygon() on error.
    """
    if Polygon is None:
        return None

    try:
        subpaths = path.continuous_subpaths()
        if len(subpaths) < 2:
            return path_to_polygon(path, samples_per_segment)

        # Convert each subpath to a list of points
        rings = []
        for sp in subpaths:
            points = []
            for seg in sp:
                for t in range(samples_per_segment):
                    pt = seg.point(t / samples_per_segment)
                    points.append((pt.real, pt.imag))
            if len(points) >= 3:
                # Close the ring
                first = sp[0].point(0)
                points.append((first.real, first.imag))
                rings.append(points)

        if not rings:
            return path_to_polygon(path, samples_per_segment)

        # Largest area ring = exterior
        ring_areas = []
        for pts in rings:
            try:
                p = Polygon(pts)
                ring_areas.append(abs(p.area))
            except Exception:
                ring_areas.append(0)

        max_idx = ring_areas.index(max(ring_areas))
        exterior = rings[max_idx]
        interiors = [r for i, r in enumerate(rings) if i != max_idx]

        poly = Polygon(exterior, interiors)
        if poly.is_valid:
            return poly
        return poly.buffer(0)

    except Exception:
        return path_to_polygon(path, samples_per_segment)


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


def build_compound_polygon(outer_polygon: Polygon,
                           inner_polygons: list) -> Optional[Polygon]:
    """
    Build a Shapely Polygon with interior rings (holes) for counters.

    In SVG/AI files, letters like "O", "A", "B" are compound paths where:
    - outer_polygon: The exterior boundary of the letter
    - inner_polygons: The interior counter shapes (the holes inside letters)

    The resulting compound polygon correctly represents the filled area,
    so containment checks work properly:
    - A point in the counter area is NOT inside the letter (correct!)
    - A point in the material area IS inside the letter (correct!)

    Args:
        outer_polygon: The exterior letter boundary (Shapely Polygon)
        inner_polygons: List of interior counter polygons (Shapely Polygons)

    Returns:
        Shapely Polygon with interior rings, or None if construction fails
    """
    if Polygon is None or outer_polygon is None:
        return None

    try:
        # Get the exterior ring coordinates from the outer polygon
        exterior_coords = list(outer_polygon.exterior.coords)

        # Get interior ring coordinates from each inner polygon
        interior_rings = []
        for inner in inner_polygons:
            if inner is not None and hasattr(inner, 'exterior'):
                interior_rings.append(list(inner.exterior.coords))

        if not interior_rings:
            # No counters, return the original polygon
            return outer_polygon

        # Create compound polygon with interior holes
        compound = Polygon(exterior_coords, interior_rings)

        # Validate and fix if needed
        if not compound.is_valid:
            compound = compound.buffer(0)

        return compound

    except Exception:
        # If compound construction fails, return original polygon
        return outer_polygon


def polygon_distance(poly1: Optional[Polygon], poly2: Optional[Polygon]) -> float:
    """
    Minimum distance between two Shapely polygon boundaries.

    Returns:
        float: Minimum distance between polygon boundaries.
               Returns float('inf') if either polygon is None.
    """
    if poly1 is None or poly2 is None:
        return float('inf')

    try:
        return poly1.distance(poly2)
    except Exception:
        return float('inf')


def buffer_polygon_with_mitre(polygon: Optional[Polygon],
                              offset: float,
                              mitre_limit: float = 4.0) -> Optional[Polygon]:
    """
    Buffer a Shapely polygon outward using mitre joins.

    Simulates physical mitered trim cap geometry from a return letter polygon.
    At corners the miter extends further than the perpendicular offset, which
    is the exact behaviour of real trim cap material at joins.

    Args:
        polygon: Shapely Polygon to buffer
        offset: Buffer distance in file units (positive = outward)
        mitre_limit: Maximum miter extension ratio before bevel (default 4.0)

    Returns:
        Buffered Shapely Polygon, or None if input is None or operation fails
    """
    if polygon is None or Polygon is None or _JOIN_STYLE is None:
        return None

    try:
        buffered = polygon.buffer(offset, join_style=_JOIN_STYLE.mitre,
                                  mitre_limit=mitre_limit)
        if buffered.is_empty:
            return None
        return buffered
    except Exception:
        return None
