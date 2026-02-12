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


def detect_svg_scale(svg_path: str) -> Optional[float]:
    """
    Detect file_scale from SVG dimensions/units.

    Returns scale factor such that: real_mm = diameter / (72 * scale) * 25.4

    - viewBox in points (typical AI→Inkscape conversion): returns None (caller uses its own file_scale)
    - viewBox in inches (Illustrator SVG export with width="Xin"): returns 1/72
      This makes 72 * (1/72) = 1.0, so diameter_inches * 25.4 = real_mm
    """
    try:
        tree = ET.parse(svg_path)
        root = tree.getroot()

        width_str = root.get('width', '')
        viewBox = root.get('viewBox', '')

        if not viewBox:
            return None

        vb_parts = viewBox.replace(',', ' ').split()
        if len(vb_parts) < 4:
            return None

        # Check if width attribute has explicit inch unit
        if 'in' in width_str:
            # Width in inches, viewBox matches → units are inches
            # scale = 1/72 makes the formula: diameter_inches / 1.0 * 25.4 = real_mm
            return 1.0 / 72.0

        # Default: assume points (standard AI→SVG conversion)
        return None
    except Exception as e:
        print(f"Warning: Could not detect SVG scale: {e}", file=sys.stderr)
        return None


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


def _classify_svg_group(group, ns_strip=True) -> str:
    """
    Classify a top-level SVG <g> as 'container' or 'orphan'.

    Container groups correspond to AI layer boundaries — they wrap other <g>
    children and have no transform or direct path/shape children.

    Orphan groups are flattened sub-groups from within an AI layer — they
    typically have a transform attribute and contain direct path/shape children.
    """
    shape_tags = {'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon'}

    has_child_g = False
    has_direct_shapes = False

    for child in group:
        tag = child.tag.split('}')[-1] if '}' in child.tag else child.tag
        if tag == 'g':
            has_child_g = True
        elif tag in shape_tags:
            has_direct_shapes = True

    has_transform = group.get('transform') is not None

    # Container: wraps child <g> elements, no transform, no direct shapes
    if has_child_g and not has_transform and not has_direct_shapes:
        return 'container'
    return 'orphan'


def _decode_illustrator_id(raw_id: str) -> str:
    """
    Decode Illustrator's _xHHHH_ encoding in SVG element IDs.

    Illustrator encodes non-alphanumeric characters in layer names as _xHHHH_
    where HHHH is the Unicode code point in hex. For example:
      _x2D_ → '-'   (hyphen)
      _x20_ → ' '   (space)
      _x26_ → '&'   (ampersand)
    """
    def _replace(m):
        try:
            return chr(int(m.group(1), 16))
        except (ValueError, OverflowError):
            return m.group(0)

    return re.sub(r'_x([0-9A-Fa-f]{2,4})_', _replace, raw_id)


def build_layer_and_transform_map(svg_path: str,
                                   ai_path: Optional[str] = None) -> Tuple[Dict[str, str], Dict[str, str]]:
    """
    Build mappings from path IDs to layer names and transform chains.
    """
    layer_map: Dict[str, str] = {}
    transform_map: Dict[str, str] = {}

    ai_layer_names_raw = []
    ai_layer_names = []
    if ai_path:
        ai_layer_names_raw = extract_layer_names_from_ai(ai_path)
        # Filter out separator layers (names with no alphanumeric chars like "---")
        # for the final assignment, but keep raw count for mapping alignment
        ai_layer_names = [n for n in ai_layer_names_raw if re.search(r'[a-zA-Z0-9]', n)]

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

        # === Preferred path: use inkscape:label attributes if present ===
        # Inkscape exports AI→SVG with authoritative layer names on <g> elements.
        # This completely bypasses the fragile positional OCG→SVG mapping.
        INK_NS = '{http://www.inkscape.org/namespaces/inkscape}'
        ink_labels = {}
        for g in top_level_groups:
            label = g.get(f'{INK_NS}label')
            gid = g.get('id', '')
            if label and gid:
                ink_labels[gid] = label

        # Map from element ID → layer name (covers both groups and loose paths)
        group_to_layer = {}

        if ink_labels:
            # Inkscape labels found — use them directly (authoritative)
            group_to_layer = dict(ink_labels)
            print(f"Layer mapping: using inkscape:label attributes for {len(ink_labels)} groups: {list(ink_labels.values())}", file=sys.stderr)
        else:
            # === SVG-native path: use id attributes from top-level <g> elements ===
            # When there are no OCG names (native SVG, not AI→SVG conversion),
            # the top-level <g id="..."> attributes ARE the layer names.
            if not ai_layer_names:
                for g in top_level_groups:
                    gid = g.get('id', '')
                    if gid:
                        decoded = _decode_illustrator_id(gid)
                        group_to_layer[gid] = decoded
                print(f"Layer mapping: using SVG <g id> attributes for {len(group_to_layer)} groups: {list(group_to_layer.values())}", file=sys.stderr)
            else:
                # === Fallback: heuristic mapping from OCG names ===
                # No inkscape:label found — log diagnostics for debugging
                print(f"Layer mapping: no inkscape:label attributes found, using OCG heuristic", file=sys.stderr)
                print(f"  OCG names (raw): {ai_layer_names_raw}", file=sys.stderr)
                print(f"  OCG names (filtered): {ai_layer_names}", file=sys.stderr)
                print(f"  SVG top-level groups: {len(top_level_groups)}", file=sys.stderr)

                # Classify each top-level group as container or orphan
                group_types = [_classify_svg_group(g) for g in top_level_groups]
                num_containers = sum(1 for t in group_types if t == 'container')
                num_orphans = sum(1 for t in group_types if t == 'orphan')
                print(f"  Containers: {num_containers}, Orphans: {num_orphans}", file=sys.stderr)

                if num_orphans > 0 and num_containers == len(ai_layer_names):
                    # Container-based partitioning: Inkscape flattened sub-groups within layers.
                    # Each container anchors a layer; orphans preceding it belong to the
                    # previous container's layer. Orphans before the first container belong
                    # to the first layer.
                    #
                    # IMPORTANT: Iterate ALL children of main_group (not just <g> elements)
                    # because Inkscape can also place loose <path>/<circle>/etc. as siblings
                    # of the groups. These loose paths belong to the same layer partition.
                    shape_tags = {'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon'}
                    group_set = set(id(g) for g in top_level_groups)
                    group_idx_map = {id(g): i for i, g in enumerate(top_level_groups)}

                    # Partition ALL children into segments ending at each container group
                    partitions: List[List] = []
                    current_partition: List = []
                    for child in main_group:
                        tag = child.tag.split('}')[-1] if '}' in child.tag else child.tag
                        if id(child) in group_set:
                            # This is a top-level group
                            current_partition.append(child)
                            if group_types[group_idx_map[id(child)]] == 'container':
                                partitions.append(current_partition)
                                current_partition = []
                        elif tag in shape_tags:
                            # Loose path/shape sibling — include in current partition
                            current_partition.append(child)

                    # Any trailing elements after the last container go into the last partition
                    if current_partition and partitions:
                        partitions[-1].extend(current_partition)
                    elif current_partition:
                        partitions.append(current_partition)

                    # Assign layer names to partitions
                    # Use raw OCG names to find the correct mapping — separator layers
                    # in the AI file don't produce SVG groups, so we skip them
                    content_layer_idx = 0
                    for partition_idx, partition in enumerate(partitions):
                        # Find next content layer name (skip separators)
                        layer_name = f'Layer_{partition_idx+1}'
                        while content_layer_idx < len(ai_layer_names_raw):
                            candidate = ai_layer_names_raw[content_layer_idx]
                            content_layer_idx += 1
                            if re.search(r'[a-zA-Z0-9]', candidate):
                                layer_name = candidate
                                break

                        for elem in partition:
                            eid = elem.get('id', f'elem_{partition_idx}')
                            group_to_layer[eid] = layer_name
                else:
                    # Simple case: no orphans, or container count doesn't match layer count.
                    # Fall back to offset heuristic — extra leading elements are structural.
                    # Include ALL children (groups + loose shapes) — some AI layers
                    # produce loose <path> elements instead of <g> groups, which shifts
                    # the positional mapping if we only count groups.
                    shape_tags = {'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon'}
                    all_children = []
                    for child in main_group:
                        tag = child.tag.split('}')[-1] if '}' in child.tag else child.tag
                        if tag == 'g' or tag in shape_tags:
                            all_children.append(child)

                    offset = max(0, len(all_children) - len(ai_layer_names)) if ai_layer_names else 0

                    for i, elem in enumerate(all_children):
                        eid = elem.get('id', f'elem_{i}')
                        ai_idx = i - offset
                        if ai_layer_names and 0 <= ai_idx < len(ai_layer_names):
                            group_to_layer[eid] = ai_layer_names[ai_idx]
                        else:
                            group_to_layer[eid] = f'Layer_{i+1}'

                # Log final heuristic assignments
                print(f"  Heuristic layer assignments: {group_to_layer}", file=sys.stderr)

        def get_top_level_parent(element, parent_chain):
            for parent_id in parent_chain:
                if parent_id in group_to_layer:
                    return group_to_layer[parent_id]
            return None

        def traverse(element, parent_chain: List[str], transform_chain: List[str],
                     in_defs: bool = False, hidden: bool = False):
            tag = element.tag.split('}')[-1] if '}' in element.tag else element.tag
            elem_id = element.get('id', '')
            transform = element.get('transform', '')

            if tag == 'defs':
                in_defs = True

            # Detect display:none (hidden annotation layers in SVG exports)
            if not hidden:
                style = element.get('style', '')
                if 'display:none' in style or 'display: none' in style:
                    hidden = True

            new_chain = parent_chain + [elem_id] if tag == 'g' and elem_id else parent_chain
            new_transforms = transform_chain + [transform] if transform else transform_chain

            # Match all SVG shape elements that svgpathtools converts to paths
            if tag in ('path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon'):
                path_id = element.get('id')
                if path_id:
                    if in_defs:
                        layer_map[path_id] = '_defs_'
                    elif hidden:
                        layer_map[path_id] = '_hidden_'
                    else:
                        # Check if this path is directly mapped (loose path in wrapper)
                        # before falling back to parent chain lookup
                        layer_name = group_to_layer.get(path_id) or get_top_level_parent(element, new_chain)
                        layer_map[path_id] = layer_name or '_no_layer_'

                    path_transform = element.get('transform', '')
                    all_transforms = new_transforms + ([path_transform] if path_transform else [])
                    transform_map[path_id] = '|'.join(all_transforms) if all_transforms else ''

            for child in element:
                traverse(child, new_chain, new_transforms, in_defs, hidden)

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
