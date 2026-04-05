"""
Auto-Fix Engine — applies deterministic corrections for common EDI validation errors.
"""

from __future__ import annotations
from parser.edi_types import ValidationError, ValidationResult
from parser.x12_parser import parse_edi, detect_delimiters, split_segments
from validator.rule_engine import validate_edi


def apply_fix(
    raw_content: str,
    error_id: str,
    fix_value: str,
    target_line: int = 0,
    target_elem: int = -1,
) -> tuple[str, str]:
    """
    Apply a single fix to the raw EDI content.

    target_line / target_elem come from the frontend request and help
    disambiguate when multiple errors share the same error_id (e.g. several
    REF-001 warnings on different segments).

    Returns (corrected_content, message).
    """
    elem_sep, sub_sep, seg_term = detect_delimiters(raw_content)
    raw_segments = split_segments(raw_content, seg_term)

    # Parse to find the error
    parse_result = parse_edi(raw_content)
    validation = validate_edi(parse_result)

    # --- Find the EXACT error instance the user clicked -----
    target_error = None

    # Priority 1: match by error_id + line_number + element_index (exact)
    if target_line > 0 and target_elem > 0:
        for err in validation.errors:
            if (err.error_id == error_id
                    and err.line_number == target_line
                    and err.element_index == target_elem):
                target_error = err
                break

    # Priority 2: match by error_id + line_number
    if not target_error and target_line > 0:
        for err in validation.errors:
            if err.error_id == error_id and err.line_number == target_line:
                target_error = err
                break

    # Priority 3: fallback — first error with matching error_id
    if not target_error:
        for err in validation.errors:
            if err.error_id == error_id:
                target_error = err
                break

    if not target_error:
        return raw_content, f"Error ID '{error_id}' not found in validation results"

    if not target_error.fixable and fix_value is None:
        return raw_content, f"Error '{error_id}' is not auto-fixable and no manual fix value was provided"

    # If the user explicitly passed a fix_value (even empty string), use it.
    use_value = fix_value if fix_value is not None else target_error.fix_value

    # Use line number for precise targeting when available
    fix_line = target_error.line_number
    fix_elem_idx = target_error.element_index

    if fix_elem_idx <= 0:
        return raw_content, f"Error '{error_id}' targets the full segment (element_index={fix_elem_idx}), cannot auto-fix a specific element."

    corrected_segments = []
    fixed = False

    for i, raw_seg in enumerate(raw_segments):
        seg_line = i + 1  # segments are 1-indexed
        parts = raw_seg.split(elem_sep)
        seg_id = parts[0].strip()

        if not fixed:
            # Primary match: use line_number if available for precise targeting
            match_by_line = (fix_line > 0 and seg_line == fix_line)
            # Fallback: match by segment_id (for errors with line_number=0)
            match_by_id = (fix_line <= 0 and seg_id == target_error.segment_id)

            if match_by_line or match_by_id:
                # Pad the segment up to the fix index if elements are missing
                if fix_elem_idx >= len(parts):
                    parts.extend([""] * (fix_elem_idx - len(parts) + 1))
                
                parts[fix_elem_idx] = use_value
                fixed = True
                corrected_segments.append(elem_sep.join(parts))
                continue

        corrected_segments.append(raw_seg)

    if not fixed:
        return raw_content, f"Could not locate segment to fix for error '{error_id}'"

    corrected = seg_term.join(corrected_segments) + seg_term
    return corrected, f"Applied fix for {error_id}: set {target_error.segment_id}{target_error.element_index:02d} to '{use_value}'"


def apply_all_fixes(raw_content: str) -> tuple[str, list[str]]:
    """
    Apply all auto-fixable errors at once.
    Returns (corrected_content, list_of_messages).
    """
    messages = []
    content = raw_content
    max_iterations = 10  # Safety limit

    for _ in range(max_iterations):
        parse_result = parse_edi(content)
        validation = validate_edi(parse_result)

        fixable = [e for e in validation.errors if e.fixable and e.fix_value]
        if not fixable:
            break

        err = fixable[0]
        content, msg = apply_fix(content, err.error_id, err.fix_value)
        messages.append(msg)

    return content, messages
