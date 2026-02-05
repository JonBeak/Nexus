"""
SVG/AI file parsing and path extraction.
"""

import os
import re
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from typing import List, Dict, Tuple, Optional

from .core import PathInfo
from .geometry import is_circle_path, path_to_polygon, compound_path_to_polygon

try:
    from svgpathtools import svg2paths2
except ImportError:
    svg2paths2 = None


def convert_ai_to_svg(ai_path: str) -> Tuple[bool, str, Optional[str]]:
    """
    Convert AI file to SVG using multiple converter fallbacks.

    Tries converters in priority order:
    1. Inkscape (best for modern AI files)
    2. UniConvertor (good for legacy formats)
    3. Ghostscript + pdf2svg (fallback for very old formats)

    Returns:
        Tuple of (success, svg_path_or_error, temp_file_path)
    """
    from .ai_converters import convert_ai_to_svg_multi

    if not os.path.exists(ai_path):
        return False, f"File not found: {ai_path}", None

    temp_fd, temp_svg_path = tempfile.mkstemp(suffix='.svg')
    os.close(temp_fd)

    try:
        success, message, attempts = convert_ai_to_svg_multi(ai_path, temp_svg_path)

        if success:
            return True, temp_svg_path, temp_svg_path
        else:
            # Cleanup on failure
            if os.path.exists(temp_svg_path):
                os.unlink(temp_svg_path)
            return False, message, None

    except Exception as e:
        # Cleanup on unexpected error
        if os.path.exists(temp_svg_path):
            os.unlink(temp_svg_path)
        return False, f"Conversion error: {str(e)}", None


def parse_color(color_str: Optional[str]) -> Optional[str]:
    """Normalize color string to hex format."""
    if not color_str or color_str == 'none':
        return None

    color_str = color_str.strip().lower()

    if color_str.startswith('#'):
        if len(color_str) == 4:
            return f"#{color_str[1]*2}{color_str[2]*2}{color_str[3]*2}"
        return color_str

    color_map = {
        'black': '#000000',
        'white': '#ffffff',
        'red': '#ff0000',
        'green': '#00ff00',
        'blue': '#0000ff',
    }
    return color_map.get(color_str, color_str)


def parse_stroke_width(width_str: Optional[str]) -> Optional[float]:
    """Parse stroke width to points."""
    if not width_str:
        return None

    width_str = width_str.strip().lower()

    match = re.match(r'([\d.]+)\s*(px|pt|mm|in)?', width_str)
    if match:
        value = float(match.group(1))
        unit = match.group(2) or 'px'

        conversions = {
            'px': 0.75,
            'pt': 1.0,
            'mm': 2.835,
            'in': 72.0
        }
        return value * conversions.get(unit, 1.0)

    return None


def extract_layer_names_from_ai(ai_path: str) -> List[str]:
    """
    Extract layer names directly from an AI file.
    AI files are PDF-based and store layer names as OCG (Optional Content Groups).
    """
    layer_names = []
    try:
        with open(ai_path, 'rb') as f:
            content = f.read()

        ocg_pattern = rb'/Name\(([^)]+)\)/Type/OCG'
        matches = re.findall(ocg_pattern, content)

        for match in matches:
            try:
                layer_name = match.decode('utf-8')
                layer_names.append(layer_name)
            except:
                pass
    except Exception as e:
        print(f"Warning: Could not extract layer names from AI file: {e}", file=sys.stderr)

    return layer_names


def build_layer_and_transform_map(svg_path: str,
                                   ai_path: Optional[str] = None) -> Tuple[Dict[str, str], Dict[str, str]]:
    """
    Build mappings from path IDs to layer names and transform chains.
    """
    layer_map: Dict[str, str] = {}
    transform_map: Dict[str, str] = {}

    ai_layer_names = []
    if ai_path:
        raw_names = extract_layer_names_from_ai(ai_path)
        # Filter out separator layers (names with no alphanumeric chars like "---")
        # Inkscape drops empty/hidden layers from SVG output, but OCG extraction
        # still finds them, causing an off-by-one index mismatch
        ai_layer_names = [n for n in raw_names if re.search(r'[a-zA-Z0-9]', n)]

    try:
        tree = ET.parse(svg_path)
        root = tree.getroot()

        # Find all <g> elements that are direct children of root
        root_groups = []
        for child in root:
            tag = child.tag.split('}')[-1] if '}' in child.tag else child.tag
            if tag == 'g':
                root_groups.append(child)

        if not root_groups:
            return layer_map, transform_map

        # Determine SVG structure:
        # - Wrapper style: single <g> under root containing layer <g> elements (e.g., Inkscape)
        # - Flat style: multiple <g> elements under root ARE the layers (e.g., Illustrator)
        if len(root_groups) == 1:
            # Single wrapper group — layers are its <g> children
            main_group = root_groups[0]
            top_level_groups = []
            for child in main_group:
                tag = child.tag.split('}')[-1] if '}' in child.tag else child.tag
                if tag == 'g':
                    top_level_groups.append(child)
        else:
            # Multiple groups under root — they ARE the layers (Illustrator style)
            main_group = root  # traverse from root
            top_level_groups = root_groups

        # If there are more SVG groups than AI layer names, Inkscape may have
        # exported extra structural groups (artboard bounds, clip regions) before
        # the real layers. Skip leading groups to align the counts.
        offset = max(0, len(top_level_groups) - len(ai_layer_names)) if ai_layer_names else 0

        group_to_layer = {}
        for i, group in enumerate(top_level_groups):
            gid = group.get('id', f'group_{i}')
            ai_idx = i - offset
            if ai_layer_names and 0 <= ai_idx < len(ai_layer_names):
                group_to_layer[gid] = ai_layer_names[ai_idx]
            else:
                group_to_layer[gid] = f'Layer_{i+1}'

        def get_top_level_parent(element, parent_chain):
            for parent_id in parent_chain:
                if parent_id in group_to_layer:
                    return group_to_layer[parent_id]
            return None

        def traverse(element, parent_chain: List[str], transform_chain: List[str], in_defs: bool = False):
            tag = element.tag.split('}')[-1] if '}' in element.tag else element.tag
            elem_id = element.get('id', '')
            transform = element.get('transform', '')

            if tag == 'defs':
                in_defs = True

            new_chain = parent_chain + [elem_id] if tag == 'g' and elem_id else parent_chain
            new_transforms = transform_chain + [transform] if transform else transform_chain

            # Match all SVG shape elements that svgpathtools converts to paths
            if tag in ('path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon'):
                path_id = element.get('id')
                if path_id:
                    if in_defs:
                        layer_map[path_id] = '_defs_'
                    else:
                        layer_name = get_top_level_parent(element, new_chain)
                        layer_map[path_id] = layer_name or '_no_layer_'

                    path_transform = element.get('transform', '')
                    all_transforms = new_transforms + ([path_transform] if path_transform else [])
                    transform_map[path_id] = '|'.join(all_transforms) if all_transforms else ''

            for child in element:
                traverse(child, new_chain, new_transforms, in_defs)

        traverse(root, [], [])

    except Exception as e:
        print(f"Warning: Could not parse layer structure: {e}", file=sys.stderr)

    return layer_map, transform_map


def extract_paths_from_svg(svg_path: str, ai_path: Optional[str] = None) -> List[PathInfo]:
    """
    Extract all paths from SVG file with their attributes.
    """
    if svg2paths2 is None:
        print("Error: svgpathtools not installed", file=sys.stderr)
        return []

    paths_info = []
    layer_map, transform_map = build_layer_and_transform_map(svg_path, ai_path)

    try:
        paths, attributes, svg_attributes = svg2paths2(svg_path)

        for i, (path, attrs) in enumerate(zip(paths, attributes)):
            path_id = attrs.get('id', f'path_{i}')
            d_attr = attrs.get('d', '')

            style = attrs.get('style', '')
            style_dict = {}
            if style:
                for item in style.split(';'):
                    if ':' in item:
                        key, value = item.split(':', 1)
                        style_dict[key.strip()] = value.strip()

            stroke = attrs.get('stroke') or style_dict.get('stroke')
            stroke_width_str = attrs.get('stroke-width') or style_dict.get('stroke-width')
            fill = attrs.get('fill') or style_dict.get('fill')
            transform = attrs.get('transform')

            try:
                path_length = path.length()
            except Exception:
                path_length = 0

            is_closed = False
            is_compound = False
            num_subpaths = 1
            try:
                if len(path) > 0:
                    if path.iscontinuous():
                        start = path[0].start
                        end = path[-1].end
                        is_closed = abs(start - end) < 0.5
                    else:
                        subpaths = path.continuous_subpaths()
                        num_subpaths = len(subpaths)
                        is_compound = num_subpaths > 1
                        if is_compound:
                            is_closed = all(
                                abs(sp[0].start - sp[-1].end) < 0.5
                                for sp in subpaths if len(sp) > 0
                            )
            except Exception:
                pass

            bbox = None
            try:
                xmin, xmax, ymin, ymax = path.bbox()
                bbox = (xmin, ymin, xmax, ymax)
            except Exception:
                pass

            area = None
            num_holes = 0
            path_polygon = None
            if is_closed:
                if is_compound:
                    path_polygon = compound_path_to_polygon(path)
                else:
                    path_polygon = path_to_polygon(path)
                if path_polygon and path_polygon.is_valid:
                    area = abs(path_polygon.area)
                    # Handle both Polygon and MultiPolygon types
                    if path_polygon.geom_type == 'Polygon':
                        num_holes = len(list(path_polygon.interiors))
                    elif path_polygon.geom_type == 'MultiPolygon':
                        # Sum holes from all polygons in the multipolygon
                        num_holes = sum(len(list(poly.interiors)) for poly in path_polygon.geoms)

            path_is_circle, circle_diameter = is_circle_path(path)

            paths_info.append(PathInfo(
                path_id=path_id,
                d_attribute=d_attr,
                stroke=parse_color(stroke),
                stroke_width=parse_stroke_width(stroke_width_str),
                fill=parse_color(fill),
                transform=transform,
                bbox=bbox,
                length=path_length,
                area=area,
                is_closed=is_closed,
                num_holes=num_holes,
                layer_name=layer_map.get(path_id),
                transform_chain=transform_map.get(path_id),
                is_circle=path_is_circle,
                circle_diameter=circle_diameter,
                polygon=path_polygon,
                is_compound=is_compound,
                num_subpaths=num_subpaths
            ))

    except Exception as e:
        print(f"Error parsing SVG: {e}", file=sys.stderr)

    return paths_info
