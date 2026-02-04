# AI File Converter System - Multi-Converter Fallback

## Overview

The AI file validation system now uses a **multi-converter fallback architecture** to handle various Adobe Illustrator file versions, including legacy formats that may not work with the primary converter.

## Architecture

### Converter Priority

The system tries converters in the following order until one succeeds:

1. **Inkscape** (Primary)
   - Best for modern AI files (CC 2015+, CS versions)
   - Fast and reliable for most use cases
   - Version: 1.2.2

2. **UniConvertor** (Optional Fallback)
   - Specifically designed for legacy vector formats
   - Good for AI 3.x - 10.x files
   - **Currently not installed** - install if needed for very old files

3. **Ghostscript + pdf2svg** (Installed Fallback)
   - Two-stage conversion: AI → PDF → SVG
   - Works for PostScript-based AI files
   - Versions: Ghostscript 10.02.1, pdf2svg 0.2.3

### How It Works

```
AI File → Detect Version → Try Converters in Order
                                      ↓
                            ┌─────────┴─────────┐
                            ↓                   ↓
                       Inkscape            Successful?
                            ↓                   ↓
                       Fails/Timeout        Return SVG
                            ↓
                    Try UniConvertor
                            ↓
                       Fails/Not Installed
                            ↓
                Try Ghostscript+pdf2svg
                            ↓
                       All Failed
                            ↓
                  Return Detailed Error
```

## Files Modified/Created

### New Files

1. **`/backend/web/src/scripts/python/validation/ai_converters.py`**
   - Multi-converter implementation
   - Version detection logic
   - Converter availability checking
   - SVG output validation

2. **`/backend/web/src/scripts/python/test_ai_converters.py`**
   - Testing script for converter system
   - Can test single files or entire directories
   - Reports which converters work for each file

3. **`/docs/AI_FILE_CONVERTER_SYSTEM.md`** (this file)
   - Documentation and usage guide

### Modified Files

1. **`/backend/web/src/scripts/python/validation/svg_parser.py`**
   - `convert_ai_to_svg()` function updated
   - Now uses multi-converter fallback via `ai_converters.py`
   - Maintains same function signature (no breaking changes)

## Testing

### Test Single File

```bash
cd /home/jon/Nexus/backend/web/src/scripts/python
python3 test_ai_converters.py /path/to/file.ai
```

**Output:**
```
======================================================================
Testing: file.ai
AI Version: AI 24.0 (CC 2020)
======================================================================

Testing Inkscape... ✓ Success (1,234,567 bytes)
Testing UniConvertor... ❌ Not installed
Testing Ghostscript+pdf2svg... ✓ Success (1,345,678 bytes)

======================================================================
SUMMARY
======================================================================
✓ Working converters: Inkscape, Ghostscript+pdf2svg
✓ Recommended: Inkscape
```

### Test All Files in Directory

```bash
python3 test_ai_converters.py --test-all /path/to/production/files/
```

### Verbose Output (Show Error Messages)

```bash
python3 test_ai_converters.py --verbose /path/to/file.ai
```

### JSON Output (For Automation)

```bash
python3 test_ai_converters.py --json /path/to/file.ai > results.json
```

## Production Testing Plan

When production AI files become available, follow this testing procedure:

### Step 1: Gather Sample Files

Collect representative files for each AI version you work with:
- [ ] CC 2020 (AI 24.0)
- [ ] CS5 (AI 15.0)
- [ ] Illustrator 10 (AI 10.0)
- [ ] Illustrator 8 (AI 8.0)
- [ ] AI 3.2 (if you have legacy files)

### Step 2: Run Converter Tests

```bash
cd /home/jon/Nexus/backend/web/src/scripts/python
python3 test_ai_converters.py --test-all /path/to/production/samples/ > converter_test_results.txt
```

### Step 3: Analyze Results

Review which converters work for which versions:
- If Inkscape handles all versions → great, no action needed
- If some versions fail with Inkscape → verify fallback converters work
- If UniConvertor is needed for legacy files → install it

### Step 4: Install Missing Converters (If Needed)

**Install UniConvertor (only if legacy AI files fail with other converters):**
```bash
pip3 install uniconvertor
# Or from source: https://sk1project.net/uc2/
```

**Install pdf2svg (already installed):**
```bash
sudo apt-get install pdf2svg
```

### Step 5: Integration Test

Test full validation pipeline:
```bash
python3 validate_ai_file.py /path/to/production/file.ai
```

Verify:
- [ ] Conversion succeeds
- [ ] Layer detection works
- [ ] Hole detection works (wire/mounting holes)
- [ ] Path measurements accurate
- [ ] Stroke/fill validation correct
- [ ] No temp file leaks in `/tmp`

## Current Status

### Installed Converters

| Converter | Status | Version | Notes |
|-----------|--------|---------|-------|
| Inkscape | ✓ Installed | 1.2.2 | Primary converter |
| Ghostscript | ✓ Installed | 10.02.1 | Part of fallback chain |
| pdf2svg | ✓ Installed | 0.2.3 | Part of fallback chain |
| UniConvertor | ❌ Not installed | - | Install only if needed |

### Test Results

**Tested File:** `requests-logo.ai` (AI 2017)
- ✓ Inkscape: Success (1,779,522 bytes)
- ❌ UniConvertor: Not installed
- ✓ Ghostscript+pdf2svg: Success (2,002,026 bytes)

**Validation Pipeline:** ✓ Working end-to-end

## Error Handling

### Graceful Degradation

The system handles missing converters gracefully:
- If a converter isn't installed → skip it, try next
- Only fail if ALL converters unavailable or all fail
- Each error is logged with details

### Error Messages

**When all converters fail:**
```
All converters failed for AI 3.2 file.
Attempted:
  - Inkscape: Inkscape failed (exit 1): unsupported format
  - UniConvertor: Not installed
  - Ghostscript+pdf2svg: Ghostscript failed: invalid PDF structure

Suggestion: Check if file is corrupted or install missing converters.
```

**When file is corrupted:**
```
All converters failed for AI 24.0 file.
Attempted:
  - Inkscape: Inkscape produced empty output
  - UniConvertor: Not installed
  - Ghostscript+pdf2svg: Ghostscript produced empty PDF

Suggestion: Check if file is corrupted or install missing converters.
```

## Performance

### Timing

| Converter | Typical Time | Timeout |
|-----------|--------------|---------|
| Inkscape | 1-5 seconds | 60 seconds |
| UniConvertor | 1-3 seconds | 60 seconds |
| Ghostscript+pdf2svg | 2-6 seconds | 60 seconds |

### Early Exit Optimization

The system stops trying converters as soon as one succeeds:
- If Inkscape works → returns immediately (no unnecessary fallback attempts)
- Only tries fallbacks when previous converters fail
- Optimal performance for the common case (modern AI files with Inkscape)

## Known Issues

### MultiPolygon Geometry Bug

**Issue:** Pre-existing bug in `svg_parser.py` geometry handling:
```
Error parsing SVG: 'MultiPolygon' object has no attribute 'interiors'
```

**Impact:** Warning message appears but validation completes successfully

**Location:** `svg_parser.py:278` - tries to access `.interiors` on MultiPolygon
```python
num_holes = len(list(path_polygon.interiors))  # Fails for MultiPolygon
```

**Fix:** Check polygon type before accessing `.interiors`:
```python
if path_polygon.geom_type == 'Polygon':
    num_holes = len(list(path_polygon.interiors))
elif path_polygon.geom_type == 'MultiPolygon':
    num_holes = sum(len(list(poly.interiors)) for poly in path_polygon.geoms)
```

**Status:** Separate issue, not related to converter changes

## Maintenance

### Adding New Converters

To add a new converter:

1. Add function to `ai_converters.py`:
```python
def try_new_converter(ai_path: str, output_svg: str) -> Tuple[bool, str]:
    """Try converting AI to SVG using NewConverter."""
    if not check_converter_available('new_converter'):
        return False, "NewConverter not installed"

    # Implementation here
    return True, ""
```

2. Add to converter list in `convert_ai_to_svg_multi()`:
```python
converters = [
    ('Inkscape', try_inkscape),
    ('UniConvertor', try_uniconvertor),
    ('NewConverter', try_new_converter),  # Add here
    ('Ghostscript+pdf2svg', try_ghostscript_pdf2svg)
]
```

3. Update documentation

### Updating Converter Priority

Reorder the `converters` list in `convert_ai_to_svg_multi()` to change priority.

Example - prefer UniConvertor for legacy files:
```python
# Detect version and choose order
version_info = detect_ai_version(ai_path)
numeric_version = version_info.get('numeric_version', 999)

if numeric_version and numeric_version < 10.0:
    # Legacy file - try UniConvertor first
    converters = [
        ('UniConvertor', try_uniconvertor),
        ('Inkscape', try_inkscape),
        ('Ghostscript+pdf2svg', try_ghostscript_pdf2svg)
    ]
else:
    # Modern file - try Inkscape first
    converters = [
        ('Inkscape', try_inkscape),
        ('UniConvertor', try_uniconvertor),
        ('Ghostscript+pdf2svg', try_ghostscript_pdf2svg)
    ]
```

## Integration with Frontend

No frontend changes required - the TypeScript service (`aiFileValidationService.ts`) continues to call the same Python script (`validate_ai_file.py`), which uses the updated converter system transparently.

**Frontend:** Unchanged
**API:** Unchanged
**Python Entry Point:** Unchanged
**Converter Logic:** Enhanced with fallbacks

## Rollback Plan

If issues arise:

1. **Quick Rollback:**
```bash
cd /home/jon/Nexus/backend/web/src/scripts/python/validation
git checkout HEAD -- svg_parser.py  # Revert to old version
rm ai_converters.py  # Remove new module
```

2. **Old `convert_ai_to_svg()` function:**
```python
def convert_ai_to_svg(ai_path: str) -> Tuple[bool, str, Optional[str]]:
    """Convert AI file to SVG using Inkscape CLI."""
    # Original Inkscape-only implementation
    # (See git history for full code)
```

## Future Enhancements

### Smart Converter Selection

Use AI version detection to choose optimal converter first:
```python
if numeric_version < 10.0:
    # Try UniConvertor first for legacy files
elif numeric_version >= 24.0:
    # Try Inkscape first for modern files
```

### Caching

Cache which converter works for specific AI versions:
```python
converter_cache = {
    'AI 3.2': 'UniConvertor',
    'AI 24.0': 'Inkscape'
}
```

### Metrics Collection

Track converter success rates:
```python
metrics = {
    'inkscape': {'successes': 150, 'failures': 5},
    'uniconvertor': {'successes': 8, 'failures': 2}
}
```

## Support

### Troubleshooting

**Problem:** All converters failing
- Check file isn't corrupted: Open in Adobe Illustrator
- Verify converters installed: `which inkscape gs pdf2svg`
- Check file permissions: `ls -l /path/to/file.ai`
- Run test script: `python3 test_ai_converters.py file.ai --verbose`

**Problem:** Conversion slow
- Check file size: Large files take longer
- Check timeout: Default 60s per converter
- Check system resources: CPU/memory usage

**Problem:** SVG missing details
- Compare converters: Some may preserve more detail
- Check AI file layers: Ensure they're not hidden
- Verify AI version: Very old versions may have compatibility issues

### Logs

Converter attempts are logged to stderr:
```bash
python3 validate_ai_file.py file.ai 2> converter_errors.log
```

## References

- **Inkscape CLI:** https://inkscape.org/doc/inkscape-man.html
- **UniConvertor:** https://sk1project.net/uc2/
- **Ghostscript:** https://www.ghostscript.com/
- **pdf2svg:** https://github.com/dawbarton/pdf2svg

---

**Last Updated:** 2026-02-04
**System Status:** ✓ Operational with Inkscape + Ghostscript+pdf2svg fallback
**Production Testing:** Pending availability of production AI files
