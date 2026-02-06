#!/usr/bin/env python3
"""
Diagnostic script: Trace path flow through the SVG validation pipeline.

Identifies exactly WHERE Vinyl layer paths are lost — from AI→SVG conversion
through layer assignment, skip filtering, and letter analysis.

Usage:
    python3 debug_svg_layers.py "/path/to/file.ai"
"""

import os
import re
import sys
import xml.etree.ElementTree as ET

# Add validation package to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from validation.svg_parser import (
    convert_ai_to_svg, extract_paths_from_svg,
    build_layer_and_transform_map, extract_layer_names_from_ai,
    _classify_svg_group
)
from validation.letter_analysis import (
    analyze_letter_hole_associations, identify_letters,
    find_paths_inside_letter, GEOMETRY_CONFIG
)
from validation.core import PathInfo


def separator(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")


def step1_svg_xml_structure(svg_path, ai_path):
    """Inspect raw SVG XML structure and AI layer names."""
    separator("STEP 1: SVG XML Structure")

    # Extract AI layer names
    ai_layer_names_raw = extract_layer_names_from_ai(ai_path)
    ai_layer_names = [n for n in ai_layer_names_raw if re.search(r'[a-zA-Z0-9]', n)]

    print(f"AI layer names (raw):      {ai_layer_names_raw}")
    print(f"AI layer names (filtered): {ai_layer_names}")
    print(f"  Raw count: {len(ai_layer_names_raw)}, Filtered count: {len(ai_layer_names)}")
    print()

    # Parse SVG
    tree = ET.parse(svg_path)
    root = tree.getroot()

    # Find root <g> elements
    root_groups = []
    for child in root:
        tag = child.tag.split('}')[-1] if '}' in child.tag else child.tag
        if tag == 'g':
            root_groups.append(child)

    print(f"Root <g> elements: {len(root_groups)}")

    # Determine wrapper vs flat
    if len(root_groups) == 1:
        print("Structure: WRAPPER style (single <g> under root)")
        main_group = root_groups[0]
        wrapper_id = main_group.get('id', '(no id)')
        print(f"  Wrapper group id: {wrapper_id}")

        top_level_groups = []
        for child in main_group:
            tag = child.tag.split('}')[-1] if '}' in child.tag else child.tag
            if tag == 'g':
                top_level_groups.append(child)
    else:
        print("Structure: FLAT style (multiple <g> under root)")
        main_group = root
        top_level_groups = root_groups

    print(f"Top-level groups (potential layers): {len(top_level_groups)}")
    print()

    # Classify each top-level group
    shape_tags = {'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon'}
    group_types = []

    for i, g in enumerate(top_level_groups):
        gtype = _classify_svg_group(g)
        group_types.append(gtype)

        gid = g.get('id', '(no id)')
        has_transform = g.get('transform') is not None

        child_g_count = 0
        direct_shape_count = 0
        for child in g:
            ctag = child.tag.split('}')[-1] if '}' in child.tag else child.tag
            if ctag == 'g':
                child_g_count += 1
            elif ctag in shape_tags:
                direct_shape_count += 1

        print(f"  Group {i}: id={gid}, type={gtype}, "
              f"child_g={child_g_count}, shapes={direct_shape_count}, "
              f"transform={has_transform}")

    num_containers = sum(1 for t in group_types if t == 'container')
    num_orphans = sum(1 for t in group_types if t == 'orphan')

    print()
    print(f"Containers: {num_containers}, Orphans: {num_orphans}")
    print(f"num_containers ({num_containers}) == len(ai_layer_names) ({len(ai_layer_names)})? "
          f"{'YES' if num_containers == len(ai_layer_names) else 'NO'}")

    # The critical gate at svg_parser.py:214
    will_use_container_partition = (num_orphans > 0 and num_containers == len(ai_layer_names))
    print(f"Will use container-based partitioning? "
          f"{'YES (orphans>0 AND containers==layers)' if will_use_container_partition else 'NO (fallback to offset heuristic)'}")

    return top_level_groups, group_types, main_group, ai_layer_names_raw, ai_layer_names


def step2_layer_assignment(svg_path, ai_path, top_level_groups, group_types,
                           main_group, ai_layer_names_raw, ai_layer_names):
    """Trace layer assignment logic."""
    separator("STEP 2: Layer Assignment")

    # Get the actual layer_map from the real function
    layer_map, transform_map = build_layer_and_transform_map(svg_path, ai_path)

    # Replicate the group_to_layer dict to show the intermediate mapping
    num_containers = sum(1 for t in group_types if t == 'container')
    num_orphans = sum(1 for t in group_types if t == 'orphan')

    group_to_layer = {}

    if num_orphans > 0 and num_containers == len(ai_layer_names):
        print("Using: CONTAINER-BASED partitioning")
        print()

        shape_tags = {'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon'}
        group_set = set(id(g) for g in top_level_groups)
        group_idx_map = {id(g): i for i, g in enumerate(top_level_groups)}

        partitions = []
        current_partition = []
        for child in main_group:
            tag = child.tag.split('}')[-1] if '}' in child.tag else child.tag
            if id(child) in group_set:
                current_partition.append(child)
                if group_types[group_idx_map[id(child)]] == 'container':
                    partitions.append(current_partition)
                    current_partition = []
            elif tag in shape_tags:
                current_partition.append(child)

        if current_partition and partitions:
            partitions[-1].extend(current_partition)
        elif current_partition:
            partitions.append(current_partition)

        print(f"Partitions created: {len(partitions)}")

        content_layer_idx = 0
        for pidx, partition in enumerate(partitions):
            layer_name = f'Layer_{pidx+1}'
            while content_layer_idx < len(ai_layer_names_raw):
                candidate = ai_layer_names_raw[content_layer_idx]
                content_layer_idx += 1
                if re.search(r'[a-zA-Z0-9]', candidate):
                    layer_name = candidate
                    break

            elem_ids = []
            for elem in partition:
                eid = elem.get('id', f'elem_{pidx}')
                group_to_layer[eid] = layer_name
                elem_ids.append(eid)

            print(f"  Partition {pidx} -> layer '{layer_name}' "
                  f"({len(partition)} elements: {elem_ids})")
    else:
        print("Using: OFFSET HEURISTIC (fallback)")
        offset = max(0, len(top_level_groups) - len(ai_layer_names)) if ai_layer_names else 0
        print(f"  Offset: {offset}")
        print()

        for i, group in enumerate(top_level_groups):
            gid = group.get('id', f'group_{i}')
            ai_idx = i - offset
            if ai_layer_names and 0 <= ai_idx < len(ai_layer_names):
                group_to_layer[gid] = ai_layer_names[ai_idx]
            else:
                group_to_layer[gid] = f'Layer_{i+1}'

            print(f"  Group {i} (id={gid}) -> '{group_to_layer[gid]}'")

    print()
    print("--- group_to_layer mapping ---")
    for gid, lname in group_to_layer.items():
        print(f"  {gid} -> {lname}")

    print()
    print(f"--- layer_map (path_id -> layer) from build_layer_and_transform_map ---")
    print(f"Total entries: {len(layer_map)}")

    # Group by layer for readability
    layer_path_counts = {}
    special_paths = []
    for pid, lname in sorted(layer_map.items()):
        layer_path_counts[lname] = layer_path_counts.get(lname, 0) + 1
        if lname in ('_no_layer_', '_defs_') or re.match(r'^Layer[\s_]\d+$', lname):
            special_paths.append((pid, lname))

    print("\nPaths per layer:")
    for lname, count in sorted(layer_path_counts.items()):
        marker = ""
        if lname in ('_no_layer_', '_defs_'):
            marker = " ** WILL BE SKIPPED **"
        elif re.match(r'^Layer[\s_]\d+$', lname):
            marker = " ** WILL BE SKIPPED (default layer name) **"
        print(f"  {lname}: {count} paths{marker}")

    if special_paths:
        print(f"\nSpecial/skippable path assignments ({len(special_paths)}):")
        for pid, lname in special_paths[:20]:
            print(f"  {pid} -> {lname}")
        if len(special_paths) > 20:
            print(f"  ... and {len(special_paths)-20} more")

    return layer_map


def step3_skip_filter(svg_path, ai_path):
    """Trace the skip filter from __init__.py."""
    separator("STEP 3: Skip Filter")

    # Get all paths (before filtering)
    all_paths = extract_paths_from_svg(svg_path, ai_path)
    print(f"Total paths from extract_paths_from_svg: {len(all_paths)}")

    # Count per layer before filtering
    before_counts = {}
    for p in all_paths:
        layer = p.layer_name or '_unknown_'
        before_counts[layer] = before_counts.get(layer, 0) + 1

    print("\nPaths per layer BEFORE filtering:")
    for lname, count in sorted(before_counts.items()):
        print(f"  {lname}: {count}")

    # Apply the skip filter (identical to __init__.py:99-107)
    _skip_layers = ('_no_layer_', '_defs_')
    removed = []
    kept = []

    for p in all_paths:
        skip_reason = None
        if p.layer_name in _skip_layers:
            skip_reason = f"in _skip_layers ({p.layer_name})"
        elif p.layer_name and re.match(r'^Layer[\s_]\d+$', p.layer_name):
            skip_reason = f"default layer name ({p.layer_name})"
        elif p.layer_name and not re.search(r'[a-zA-Z0-9]', p.layer_name):
            skip_reason = f"separator layer ({p.layer_name})"

        if skip_reason:
            removed.append((p.path_id, p.layer_name, skip_reason))
        else:
            kept.append(p)

    print(f"\nRemoved by skip filter: {len(removed)}")
    if removed:
        for pid, lname, reason in removed[:30]:
            print(f"  {pid} (layer={lname}): {reason}")
        if len(removed) > 30:
            print(f"  ... and {len(removed)-30} more")

    print(f"\nKept after filtering: {len(kept)}")

    after_counts = {}
    for p in kept:
        layer = p.layer_name or '_unknown_'
        after_counts[layer] = after_counts.get(layer, 0) + 1

    print("\nPaths per layer AFTER filtering:")
    for lname, count in sorted(after_counts.items()):
        print(f"  {lname}: {count}")

    # Highlight Vinyl layer specifically
    vinyl_before = sum(1 for p in all_paths
                       if p.layer_name and 'vinyl' in p.layer_name.lower())
    vinyl_after = sum(1 for p in kept
                      if p.layer_name and 'vinyl' in p.layer_name.lower())
    print(f"\n*** Vinyl layer: {vinyl_before} before -> {vinyl_after} after filtering ***")

    return kept


def step4_letter_analysis(filtered_paths):
    """Run letter analysis and show path accounting."""
    separator("STEP 4: Letter Analysis Path Accounting")

    print(f"Input paths: {len(filtered_paths)}")
    print(f"Layers present: {sorted(set(p.layer_name or '' for p in filtered_paths))}")
    print()

    # Run analysis
    result = analyze_letter_hole_associations(
        filtered_paths,
        layer_name=None,
        config={'file_scale': 0.1}
    )

    # Path accounting
    if 'path_accounting' in result.stats:
        pa = result.stats['path_accounting']
        print("Path accounting:")
        for key, val in pa.items():
            print(f"  {key}: {val}")
    else:
        print("No path_accounting in stats")

    print()

    # Letter groups by layer
    layer_letters = {}
    for lg in result.letter_groups:
        layer_letters.setdefault(lg.layer_name, []).append(lg)

    print(f"Letter groups found: {len(result.letter_groups)}")
    for lname, groups in sorted(layer_letters.items()):
        print(f"  {lname}: {len(groups)} letters, "
              f"{sum(len(g.holes) for g in groups)} holes, "
              f"{sum(len(g.holes) for g in groups)} holes")

    print(f"\nOrphan holes: {len(result.orphan_holes)}")
    for oh in result.orphan_holes[:10]:
        print(f"  {oh.path_id}: type={oh.hole_type}, "
              f"diameter_real_mm={oh.diameter_real_mm:.2f}")
    if len(result.orphan_holes) > 10:
        print(f"  ... and {len(result.orphan_holes)-10} more")

    # Unprocessed paths
    if result.unprocessed_paths:
        print(f"\nUnprocessed paths: {len(result.unprocessed_paths)}")
        by_reason = {}
        for up in result.unprocessed_paths:
            by_reason.setdefault(up['reason'], []).append(up)

        for reason, paths in sorted(by_reason.items()):
            print(f"  {reason}: {len(paths)}")
            for p in paths[:5]:
                print(f"    {p['path_id']} (layer={p['layer']})")
            if len(paths) > 5:
                print(f"    ... and {len(paths)-5} more")

    return result


def step5_phantom_duplicates(result):
    """Check for phantom duplicate drops in build_letter_group."""
    separator("STEP 5: Phantom Duplicate Detection")

    tol = GEOMETRY_CONFIG.get('phantom_duplicate_tolerance', 0.001)
    found = False

    for lg in result.letter_groups:
        for hole in lg.holes:
            print(f"  HOLE in {lg.letter_id} (layer={lg.layer_name}): "
                  f"{hole.path_id}, diameter_real_mm={hole.diameter_real_mm:.2f}")

    print()
    # Check what the analysis found as phantom duplicates by looking at
    # letters that share near-identical areas with other paths
    for lg in result.letter_groups:
        outer_area = lg.main_path.area or 0
        if outer_area <= 0:
            continue

        # The inner_paths passed to build_letter_group would have included
        # phantom duplicates that were filtered. We can detect them by
        # looking for assigned paths with ratio ~1.0 to this letter.
        # (These would have been silently skipped)

    print(f"  Phantom duplicate tolerance: ratio in "
          f"{1.0 - tol:.4f}–{1.0 + tol:.4f}")


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 debug_svg_layers.py <path_to_ai_file>")
        sys.exit(1)

    ai_path = sys.argv[1]

    if not os.path.exists(ai_path):
        print(f"Error: File not found: {ai_path}")
        sys.exit(1)

    print(f"Diagnosing: {ai_path}")
    print(f"File size: {os.path.getsize(ai_path):,} bytes")

    temp_svg = None
    try:
        # Convert AI to SVG
        print("\nConverting AI to SVG...")
        success, result, temp_svg = convert_ai_to_svg(ai_path)
        if not success:
            print(f"ERROR: Conversion failed: {result}")
            sys.exit(1)

        svg_path = result
        print(f"SVG created: {svg_path}")

        # Step 1
        (top_level_groups, group_types, main_group,
         ai_layer_names_raw, ai_layer_names) = step1_svg_xml_structure(svg_path, ai_path)

        # Step 2
        layer_map = step2_layer_assignment(
            svg_path, ai_path, top_level_groups, group_types,
            main_group, ai_layer_names_raw, ai_layer_names)

        # Step 3
        filtered_paths = step3_skip_filter(svg_path, ai_path)

        # Step 4
        analysis_result = step4_letter_analysis(filtered_paths)

        # Step 5
        step5_phantom_duplicates(analysis_result)

        separator("DONE")
        print("Check output above to find where Vinyl layer paths disappear.")

    finally:
        if temp_svg and os.path.exists(temp_svg):
            try:
                os.unlink(temp_svg)
                print(f"\nCleaned up temp SVG: {temp_svg}")
            except Exception:
                pass


if __name__ == '__main__':
    main()
