"""
Corner radius analysis for SVG paths.

Extracts corner radii from SVG path d-attributes by analyzing
Line→CubicBezier→Line segment transitions. Used by Push Thru
validation to enforce minimum radius requirements.
"""

from typing import List, Dict, Any

try:
    from svgpathtools import parse_path, Line, CubicBezier
except ImportError:
    parse_path = None
    Line = None
    CubicBezier = None

# Kappa constant: ratio of cubic bezier handle length to radius for a circular arc
_KAPPA = 0.5523


def extract_corner_radii(d_attribute: str, file_scale: float,
                         is_compound: bool = False) -> List[Dict[str, Any]]:
    """
    Extract corner radii from an SVG path d-attribute by analyzing
    Line→CubicBezier→Line transitions.

    At each rounded corner, the cubic bezier handle length relates to
    the corner radius via: r = handle_length / kappa (0.5523).

    Convex/concave is determined by the cross product of the incoming
    and outgoing direction vectors. For CW winding (compound path
    interiors), the interpretation is inverted.

    Args:
        d_attribute: SVG path d attribute string
        file_scale: File scale factor (e.g., 0.1 for 10% working files)
        is_compound: True if this is a compound path interior (CW winding)

    Returns:
        List of dicts with keys:
        - radius_inches: Corner radius in real inches
        - is_convex: True if convex corner, False if concave
        - is_sharp: True if no bezier at this corner (sharp L-to-L junction)
        - position: (x, y) midpoint of the bezier curve
    """
    if parse_path is None or Line is None or CubicBezier is None:
        return []

    try:
        path = parse_path(d_attribute)
    except Exception:
        return []

    # For compound paths, process each closed subpath separately
    if is_compound:
        try:
            subpaths = path.continuous_subpaths()
        except Exception:
            subpaths = [path]
    else:
        subpaths = [path]

    results = []
    points_per_real_inch = 72 * file_scale

    for sp in subpaths:
        segments = list(sp)
        n = len(segments)
        if n < 2:
            continue

        for i in range(n):
            seg = segments[i]
            prev_seg = segments[(i - 1) % n]
            next_seg = segments[(i + 1) % n]

            # Detect Line→CubicBezier→Line pattern (rounded corner)
            if isinstance(seg, CubicBezier) and isinstance(prev_seg, Line) and isinstance(next_seg, Line):
                _process_rounded_corner(
                    seg, prev_seg, next_seg,
                    points_per_real_inch, is_compound, results
                )

            # Detect Line→Line pattern (sharp corner — no bezier)
            elif isinstance(seg, Line) and isinstance(next_seg, Line):
                _process_sharp_corner(seg, next_seg, is_compound, results)

    return results


def _process_rounded_corner(seg, prev_seg, next_seg,
                            points_per_real_inch: float,
                            is_compound: bool,
                            results: list) -> None:
    """Extract radius from a Line→CubicBezier→Line transition."""
    p0 = seg.start
    p1 = seg.control1
    p2 = seg.control2
    p3 = seg.end

    handle_in = abs(p1 - p0)
    handle_out = abs(p3 - p2)
    avg_handle = (handle_in + handle_out) / 2

    if avg_handle < 1e-6:
        return

    radius_file = avg_handle / _KAPPA
    radius_inches = radius_file / points_per_real_inch

    # Convex/concave via cross product of direction vectors
    d_in = p0 - prev_seg.start   # incoming direction
    d_out = next_seg.end - p3    # outgoing direction

    cross = d_in.real * d_out.imag - d_in.imag * d_out.real

    # In SVG coordinate system (Y down), positive cross = CW turn = convex
    is_convex = cross > 0
    # CW winding (compound path interiors) inverts the interpretation
    if is_compound:
        is_convex = not is_convex

    midpoint = seg.point(0.5)
    results.append({
        'radius_inches': radius_inches,
        'is_convex': is_convex,
        'is_sharp': False,
        'position': (midpoint.real, midpoint.imag),
    })


def _process_sharp_corner(seg, next_seg, is_compound: bool,
                          results: list) -> None:
    """Flag a Line→Line transition as a sharp corner if direction changes."""
    d1 = seg.end - seg.start
    d2 = next_seg.end - next_seg.start
    cross = d1.real * d2.imag - d1.imag * d2.real
    if abs(cross) > 1e-6:
        results.append({
            'radius_inches': 0.0,
            'is_convex': (cross > 0) != is_compound,
            'is_sharp': True,
            'position': (seg.end.real, seg.end.imag),
        })
