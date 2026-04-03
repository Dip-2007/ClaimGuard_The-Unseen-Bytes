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
) -> tuple[str, str]:
    """
    Apply a single fix to the raw EDI content.

    Returns (corrected_content, message).
    """
    elem_sep, sub_sep, seg_term = detect_delimiters(raw_content)
    raw_segments = split_segments(raw_content, seg_term)

    # Parse to find the error
    parse_result = parse_edi(raw_content)
    validation = validate_edi(parse_result)

    target_error = None
    for err in validation.errors:
        if err.error_id == error_id:
            target_error = err
            break

    if not target_error:
        return raw_content, f"Error ID '{error_id}' not found in validation results"

    if not target_error.fixable and not fix_value:
        return raw_content, f"Error '{error_id}' is not auto-fixable and no manual fix value was provided"

    # Apply the fix based on segment and element position
    corrected_segments = []
    fixed = False

    for raw_seg in raw_segments:
        parts = raw_seg.split(elem_sep)
        seg_id = parts[0].strip()

        if (seg_id == target_error.segment_id and
            target_error.element_index > 0 and
            not fixed):
            # Replace the element value at the specified index
            idx = target_error.element_index
            if idx < len(parts):
                use_value = fix_value if fix_value else target_error.fix_value
                parts[idx] = use_value
                fixed = True

            corrected_segments.append(elem_sep.join(parts))
        else:
            corrected_segments.append(raw_seg)

    if not fixed:
        return raw_content, f"Could not locate segment to fix for error '{error_id}'"

    corrected = seg_term.join(corrected_segments) + seg_term
    return corrected, f"Applied fix for {error_id}: set {target_error.segment_id}{target_error.element_index:02d} to '{fix_value or target_error.fix_value}'"


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
