"""
HIPAA 5010 Validation Rule Engine.

Declarative JSON-based rules + programmatic checks for X12 EDI validation.
"""

from __future__ import annotations
import re
from parser.edi_types import (
    ParseResult, Segment, ValidationError, ValidationResult,
)


class Severity:
    ERROR   = "error"    # File will be rejected
    WARNING = "warning"  # Potential problem, may still process
    INFO    = "info"     # Advisory / best-practice


# ═══════════════════════════════════════════════════════════════════════════
# 1.  DYNAMIC TR3 SCHEMA LOADING
# ═══════════════════════════════════════════════════════════════════════════

import json
import os

SCHEMA_PATH = os.path.join(os.path.dirname(__file__), "tr3_schemas.json")
try:
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        _schemas = json.load(f)
except Exception as e:
    print(f"Warning: Failed to load tr3_schemas.json from {SCHEMA_PATH}: {e}")
    _schemas = {}

# Convert parsed lists into sets for O(1) lookup performance
ISA_ID_QUALIFIERS = set(_schemas.get("ISA_ID_QUALIFIERS", []))
GS_FUNCTIONAL_IDS = _schemas.get("GS_FUNCTIONAL_IDS", {})
GS_VERSION_TX = _schemas.get("GS_VERSION_TX", {})
NM1_ID_CODE_QUALIFIERS = set(_schemas.get("NM1_ID_CODE_QUALIFIERS", []))
NM1_ENTITY_TYPE = _schemas.get("NM1_ENTITY_TYPE", {})
VALID_NM1_08 = set(_schemas.get("VALID_NM1_08", []))
VALID_ISO_COUNTRIES = set(_schemas.get("VALID_ISO_COUNTRIES", []))
PLACE_OF_SERVICE_CODES = set(_schemas.get("PLACE_OF_SERVICE_CODES", []))
CLAIM_FREQUENCY_CODES = _schemas.get("CLAIM_FREQUENCY_CODES", {})
DTP_QUALIFIER_CODES = set(_schemas.get("DTP_QUALIFIER_CODES", []))
REF_QUALIFIER_CODES = set(_schemas.get("REF_QUALIFIER_CODES", []))
REF_QUALIFIERS_BY_LOOP = {}
for k, v in _schemas.get("REF_QUALIFIERS_BY_LOOP", {}).items():
    if isinstance(v, list):
        REF_QUALIFIERS_BY_LOOP[k] = set(v)
SBR_PAYER_RESPONSIBILITY = set(_schemas.get("SBR_PAYER_RESPONSIBILITY", []))
INS_RELATIONSHIP_CODES = _schemas.get("INS_RELATIONSHIP_CODES", {})
INS_MAINTENANCE_TYPE = _schemas.get("INS_MAINTENANCE_TYPE", {})
CAS_GROUP_CODES = _schemas.get("CAS_GROUP_CODES", {})
HD_INSURANCE_LINE = set(_schemas.get("HD_INSURANCE_LINE", []))
# HI  Diagnosis Code Qualifiers (ICD)
HI_DIAG_QUALIFIERS = {
    "ABK","BK",   # ICD-10-CM Principal Diagnosis
    "ABF","BF",   # ICD-10-CM Diagnosis
    "ABJ","BJ",   # ICD-10-CM Admitting Diagnosis
    "APR","PR",   # ICD-10-PCS Principal Procedure
    "ZZ",
}

CARC_CODES = _schemas.get("CAS_REASON_CODES", {}) # updated from tr3_schemas.json
RARC_CODES = {} # kept for backward compatibility with router


# ═══════════════════════════════════════════════════════════════════════════
# 2.  HELPER UTILITIES
# ═══════════════════════════════════════════════════════════════════════════

def _get_elem(seg, idx: int, default: str = "") -> str:
    """Safe element getter (1-based index)."""
    if seg is None or idx < 1 or idx > len(seg.elements):
        return default
    return seg.elements[idx - 1].value.strip()


def _find_segments(result, seg_id: str):
    """Yield all Segment objects with matching ID from the parse result."""
    for seg in result.segments:
        if seg.segment_id == seg_id:
            yield seg


def _find_first(result, seg_id: str):
    return next(_find_segments(result, seg_id), None)


def _err(severity, code, loop, seg, pos, elem, msg, fix, fixable=False, fix_value="") -> ValidationError:
    """Creates a ValidationError object conforming to parser.edi_types."""
    return ValidationError(
        severity=severity,
        error_id=code,
        loop_location=loop,
        segment_id=seg.segment_id if seg else "??",
        line_number=seg.line_number if seg else 0,
        element_index=elem if elem is not None else -1,
        message=msg,
        suggestion=fix,
        fixable=fixable,
        fix_value=fix_value
    )


def luhn_check(npi: str) -> bool:
    """
    HIPAA NPI Luhn validation.
    Prefix with '80840', then apply Luhn algorithm.
    Returns True if valid.
    """
    if not npi or not npi.isdigit() or len(npi) != 10:
        return False
    full = "80840" + npi
    total = 0
    for i, ch in enumerate(reversed(full)):
        n = int(ch)
        if i % 2 == 1:          # odd positions from right → double
            n *= 2
            if n > 9:
                n -= 9
        total += n
    return total % 10 == 0


_DATE8  = re.compile(r"^\d{8}$")   # CCYYMMDD
_DATE6  = re.compile(r"^\d{6}$")   # CCYYMM
_TIME4  = re.compile(r"^\d{4}$")   # HHMM
_TIME6  = re.compile(r"^\d{6}$")   # HHMMSS

def _valid_date8(v: str) -> bool:
    if not _DATE8.match(v):
        return False
    try:
        y, m, d = int(v[:4]), int(v[4:6]), int(v[6:])
        return 1 <= m <= 12 and 1 <= d <= 31
    except ValueError:
        return False

def _valid_monetary(v: str) -> bool:
    return bool(re.match(r"^\d+(\.\d{1,2})?$", v))

def _valid_alphanumeric(v: str, min_l: int, max_l: int) -> bool:
    return min_l <= len(v) <= max_l

def _icd10_format(code: str) -> bool:
    code = code.replace(".", "")
    return bool(re.match(r"^[A-Z]\d{2}[0-9A-Z]{0,4}$", code))

def _cpt_format(code: str) -> bool:
    return bool(re.match(r"^\d{4}[A-Z0-9]$", code)) or bool(re.match(r"^\d{5}$", code))

def _hcpcs_format(code: str) -> bool:
    return bool(re.match(r"^[A-Z]\d{4}[A-Z]?$", code))


# ═══════════════════════════════════════════════════════════════════════════
# 3.  LAYER 1 — INTERCHANGE ENVELOPE  (ISA / IEA)
# ═══════════════════════════════════════════════════════════════════════════

def _validate_envelope(result, errors: list) -> None:
    isa = _find_first(result, "ISA")
    iea = _find_first(result, "IEA")

    if not isa:
        errors.append(ValidationError(
            severity=Severity.ERROR, error_id="ENV-001",
            loop_location="ENVELOPE", segment_id="ISA", line_number=0,
            element_index=-1,
            message="Missing ISA segment — the file header is absent. Every EDI file must start with an ISA line that identifies the sender, receiver, and file version.",
            suggestion="Add an ISA segment as the very first line. This is the 'envelope' that wraps the entire EDI transaction."
        ))
        return

    elems = isa.elements
    n = len(elems)

    if n != 16:
        errors.append(_err(Severity.ERROR, "ENV-002", "ENVELOPE", isa, None, None,
            f"ISA segment has {n} fields, but exactly 16 are required. This means some data fields are missing or extra delimiters were added.",
            "Check the ISA line and count the fields separated by '*'. There must be exactly 16 values after 'ISA'."))

    isa01 = _get_elem(isa, 1)
    if isa01 not in ("00", "03"):
        errors.append(_err(Severity.ERROR, "ENV-003", "ENVELOPE", isa, 1, 1,
            f"Authorization qualifier is '{isa01}', but only '00' (no authorization) or '03' (with authorization) are allowed. This field tells the receiver whether security info is included.",
            "Set this to '00' if no authorization info is needed (most common).", fixable=True, fix_value="00"))

    isa05 = _get_elem(isa, 5)
    if isa05 not in ISA_ID_QUALIFIERS:
        errors.append(_err(Severity.ERROR, "ENV-006", "ENVELOPE", isa, 1, 5,
            f"Sender ID type is '{isa05}', which is not recognized. This field identifies what kind of ID the sender is using (e.g., Tax ID, NPI, etc.).",
            f"Use one of these valid codes: {', '.join(sorted(ISA_ID_QUALIFIERS))}. 'ZZ' (Mutually Defined) is the most common.", fixable=True, fix_value="ZZ"))

    isa07 = _get_elem(isa, 7)
    if isa07 not in ISA_ID_QUALIFIERS:
        errors.append(_err(Severity.ERROR, "ENV-007", "ENVELOPE", isa, 1, 7,
            f"Receiver ID type is '{isa07}', which is not recognized. This field identifies what kind of ID the receiver is using.",
            f"Use one of these valid codes: {', '.join(sorted(ISA_ID_QUALIFIERS))}. 'ZZ' (Mutually Defined) is the most common.", fixable=True, fix_value="ZZ"))

    isa11 = _get_elem(isa, 11)
    if isa11 != "^":
        errors.append(_err(Severity.ERROR, "ENV-010", "ENVELOPE", isa, 1, 11,
            f"Sub-element separator is '{isa11}', but HIPAA 5010 requires it to be '^' (caret). This character is used to split complex fields like diagnosis codes.",
            "Change this character to '^'. This is mandated by the HIPAA 5010 standard.", fixable=True, fix_value="^"))

    isa12 = _get_elem(isa, 12)
    if isa12 != "00501":
        errors.append(_err(Severity.ERROR, "ENV-011", "ENVELOPE", isa, 1, 12,
            f"Version number is '{isa12}', but HIPAA requires '00501' (version 5010). Payers will reject files that don't use the correct version.",
            "Set this to '00501' to indicate HIPAA 5010 compliance.", fixable=True, fix_value="00501"))

    isa13 = _get_elem(isa, 13)
    if not (isa13.isdigit() and len(isa13) == 9):
        errors.append(_err(Severity.ERROR, "ENV-012", "ENVELOPE", isa, 1, 13,
            f"Control number '{isa13}' is invalid — it must be exactly 9 digits. This is a unique tracking number for this file exchange.",
            "Use a 9-digit number like '000000001'. Pad with leading zeros if needed."))
        
    isa14 = _get_elem(isa, 14)
    if isa14 not in ("0", "1"):
        errors.append(_err(Severity.ERROR, "ENV-013", "ENVELOPE", isa, 1, 14,
            f"Acknowledgment request flag is '{isa14}', but must be '0' (no acknowledgment) or '1' (acknowledgment requested).",
            "Use '0' if you don't need a confirmation receipt, or '1' if you do.", fixable=True, fix_value="0"))

    if not iea:
        errors.append(ValidationError(
            severity=Severity.ERROR, error_id="ENV-015",
            loop_location="ENVELOPE", segment_id="IEA", line_number=0,
            element_index=-1,
            message="Missing IEA segment — the file footer is absent. Every EDI file must end with an IEA line that closes the envelope opened by ISA.",
            suggestion="Add an IEA segment at the very end of the file. It should contain the number of transaction groups and match the ISA control number."))
        return

    iea02 = _get_elem(iea, 2)
    if iea02 != isa13:
        errors.append(_err(Severity.ERROR, "ENV-016", "ENVELOPE", iea, 2, 2,
            f"File footer control number is '{iea02}', but the header says '{isa13}'. These numbers must match to confirm the file wasn't corrupted during transmission.",
            f"Change the IEA control number to '{isa13}' so it matches the ISA header.", fixable=True, fix_value=isa13))


# ═══════════════════════════════════════════════════════════════════════════
# 4.  LAYER 2 — FUNCTIONAL GROUP  (GS / GE)
# ═══════════════════════════════════════════════════════════════════════════

def _validate_functional_group(result, errors: list) -> None:
    gs = _find_first(result, "GS")
    ge = _find_first(result, "GE")

    if not gs:
        errors.append(ValidationError(
            severity=Severity.ERROR, error_id="FG-001",
            loop_location="ENVELOPE", segment_id="GS", line_number=0,
            element_index=-1,
            message="Missing GS segment — the functional group header is absent. The GS line groups related transactions together and tells the receiver what type of data to expect (claims, payments, enrollment, etc.).",
            suggestion="Add a GS segment between the ISA header and the ST transaction header."))
        return

    gs01 = _get_elem(gs, 1)
    if gs01 not in GS_FUNCTIONAL_IDS:
        errors.append(_err(Severity.ERROR, "FG-002", "ENVELOPE", gs, None, 1,
            f"Functional group code is '{gs01}', which is not recognized. This code tells the receiver what type of transactions are in the file (e.g., 'HC' for claims, 'HP' for institutional claims, 'HR' for payments).",
            "Use the correct code for your transaction: 'HC' for 837P claims, 'HP' for 837I claims, 'HR' for 835 payments, 'BE' for 834 enrollment."))

    gs06 = _get_elem(gs, 6)
    if not ge:
        errors.append(ValidationError(
            severity=Severity.ERROR, error_id="FG-007",
            loop_location="ENVELOPE", segment_id="GE", line_number=0,
            element_index=-1,
            message="Missing GE segment — the functional group footer is absent. Every GS (group header) must have a matching GE (group footer) to close the group.",
            suggestion="Add a GE segment after the SE (transaction footer) and before the IEA (file footer)."))
        return

    ge02 = _get_elem(ge, 2)
    if ge02 != gs06:
        errors.append(_err(Severity.ERROR, "FG-008", "ENVELOPE", ge, None, 2,
            f"Group footer control number is '{ge02}', but the group header says '{gs06}'. These must match to confirm the group is complete and intact.",
            f"Change the GE control number to '{gs06}' so it matches the GS header.", fixable=True, fix_value=gs06))


# ═══════════════════════════════════════════════════════════════════════════
# 5.  LAYER 3 — TRANSACTION SET  (ST / SE)
# ═══════════════════════════════════════════════════════════════════════════

def _validate_transaction_set(result, errors: list) -> None:
    st = _find_first(result, "ST")
    se = _find_first(result, "SE")

    if not st:
        errors.append(ValidationError(
            severity=Severity.ERROR, error_id="TS-001",
            loop_location="ENVELOPE", segment_id="ST", line_number=0,
            element_index=-1,
            message="Missing ST segment — the transaction header is absent. The ST line marks the beginning of the actual transaction data (claim, payment, or enrollment).",
            suggestion="Add an ST segment after the GS group header. Example: ST*837*0001~"))
        return

    st02 = _get_elem(st, 2)
    
    if not se:
        errors.append(ValidationError(
            severity=Severity.ERROR, error_id="TS-004",
            loop_location="ENVELOPE", segment_id="SE", line_number=0,
            element_index=-1,
            message="Missing SE segment — the transaction footer is absent. Every ST (transaction start) must have a matching SE (transaction end).",
            suggestion="Add an SE segment before GE. It needs the total segment count and the same control number as ST."))
        return

    se01 = _get_elem(se, 1)
    actual_count = sum(
        1 for s in result.segments
        if st.line_number <= s.line_number <= se.line_number
    )

    if se01.isdigit() and int(se01) != actual_count:
        errors.append(_err(Severity.ERROR, "TS-005", "ENVELOPE", se, None, 1,
            f"Segment count mismatch — the footer says there are {se01} segments, but the actual count is {actual_count}. This usually happens when segments are added or removed without updating the footer.",
            f"Update the count to '{actual_count}' to reflect the correct number of segments between ST and SE.", fixable=True, fix_value=str(actual_count)))

    se02 = _get_elem(se, 2)
    if se02 != st02:
        errors.append(_err(Severity.ERROR, "TS-006", "ENVELOPE", se, None, 2,
            f"Transaction footer control number is '{se02}', but the header says '{st02}'. These must match to confirm the transaction is complete.",
            f"Change it to '{st02}' to match the ST transaction header.", fixable=True, fix_value=st02))


# ═══════════════════════════════════════════════════════════════════════════
# 6.  LAYER 4 — COMMON SEGMENT RULES
# ═══════════════════════════════════════════════════════════════════════════

def _validate_nm1_segments(result, errors: list) -> None:
    for seg in _find_segments(result, "NM1"):
        loop = _get_loop_for_segment(result, seg)
        nm1_01 = _get_elem(seg, 1)
        nm1_02 = _get_elem(seg, 2)

        # Build a friendly label for the entity
        entity_labels = {
            "85": "Billing Provider", "87": "Pay-to Provider", "IL": "Patient/Subscriber",
            "40": "Receiver", "41": "Submitter", "82": "Rendering Provider",
            "77": "Service Facility", "QC": "Patient", "PR": "Payer",
            "PE": "Payee", "DN": "Referring Provider", "DQ": "Supervising Provider",
            "71": "Attending Provider", "72": "Operating Physician", "P3": "Primary Care Provider",
        }
        entity_label = entity_labels.get(nm1_01, f"Entity '{nm1_01}'")

        if nm1_02 not in ("1", "2"):
            errors.append(_err(Severity.ERROR, "NM1-001", loop, seg, None, 2,
                f"{entity_label} — entity type is '{nm1_02}', but must be '1' (Person) or '2' (Organization). This tells the system whether this is an individual or a company.",
                "Use '1' for a person (doctor, patient) or '2' for an organization (hospital, insurance company).", fixable=True, fix_value="2"))

        nm1_08 = _get_elem(seg, 8)
        nm1_09 = _get_elem(seg, 9)

        if nm1_08 and nm1_08 not in VALID_NM1_08:
            errors.append(_err(Severity.ERROR, "NM1-006", loop, seg, None, 8,
                f"{entity_label} — ID type code '{nm1_08}' is not recognized. This tells the system what kind of identifier follows (NPI, Tax ID, Member ID, etc.).",
                "Common valid codes: 'XX' = NPI, 'MI' = Member ID, 'FI' = Federal Tax ID, 'EI' = Employer ID, 'PI' = Payer ID, '34' = SSN.", fixable=False))

        if nm1_08 == "XX" and nm1_09:
            if not luhn_check(nm1_09):
                errors.append(_err(Severity.ERROR, "NM1-004", loop, seg, None, 9,
                    f"{entity_label} — NPI number '{nm1_09}' failed validation. The NPI must be a valid 10-digit number that passes the Luhn checksum (a mathematical check to catch typos).",
                    "Double-check the NPI. You can verify it at https://npiregistry.cms.hhs.gov/", fixable=False))


def _validate_dtp_segments(result, errors: list) -> None:
    for seg in _find_segments(result, "DTP"):
        loop = _get_loop_for_segment(result, seg)
        dtp01 = _get_elem(seg, 1)
        dtp02 = _get_elem(seg, 2)
        dtp03 = _get_elem(seg, 3)

        # Friendly labels for common DTP qualifiers
        dtp_labels = {
            "472": "Service Date", "471": "Prescription Date", "314": "Disability From Date",
            "360": "Disability To Date", "297": "Last Seen Date", "296": "Initial Treatment Date",
            "454": "Effective Date", "473": "Hospitalization Admission Date",
            "036": "Expiration Date", "348": "Benefit Begin Date", "349": "Benefit End Date",
            "303": "Maintenance Effective Date", "350": "Service Period Start",
            "351": "Service Period End",
        }
        date_label = dtp_labels.get(dtp01, f"Date (qualifier {dtp01})")

        if dtp01 and dtp01 not in DTP_QUALIFIER_CODES:
            errors.append(_err(Severity.WARNING, "DTP-001", loop, seg, None, 1,
                f"{date_label} — qualifier code '{dtp01}' is not in our standard list. This may be an unusual or proprietary date type.",
                "Verify this is the correct date qualifier for this context. Check the HIPAA implementation guide for your transaction type."))

        if dtp02 == "D8":
            if not _valid_date8(dtp03):
                errors.append(_err(Severity.ERROR, "DTP-002", loop, seg, None, 3,
                    f"{date_label} — the date '{dtp03}' is not valid. When the format code is 'D8', the date must be exactly 8 digits in YYYYMMDD format (e.g., 20240610 for June 10, 2024).",
                    "Fix the date to use YYYYMMDD format. Example: '20240610' for June 10, 2024."))
        elif dtp02 == "RD8":
            if len(dtp03) != 16 or not _valid_date8(dtp03[:8]) or not _valid_date8(dtp03[8:]):
                errors.append(_err(Severity.ERROR, "DTP-003", loop, seg, None, 3,
                    f"{date_label} — the date range '{dtp03}' is invalid. A date range must be two dates back-to-back (16 digits total, YYYYMMDDYYYYMMDD).",
                    "Example: '2024010120240131' means January 1 to January 31, 2024."))

def _validate_ref_segments(result, errors: list) -> None:
    tx = getattr(result, "transaction_type", "")
    for seg in _find_segments(result, "REF"):
        loop = _get_loop_for_segment(result, seg)
        ref01 = _get_elem(seg, 1)
        ref02 = _get_elem(seg, 2)

        # Friendly labels for common REF qualifiers
        ref_labels = {
            "EI": "Employer ID", "SY": "Social Security Number", "0B": "State License Number",
            "1G": "Provider UPIN", "G2": "Provider Commercial Number", "LU": "Location Number",
            "EA": "Medical Record Number", "D9": "Claim Number", "BLT": "Billing Type",
            "CE": "Class of Contract Code", "1L": "Group or Policy Number",
            "38": "Authorization Number", "F8": "Original Reference Number",
            "4N": "Special Payment Reference", "6R": "Provider Control Number",
        }
        ref_label = ref_labels.get(ref01, f"Reference '{ref01}'")

        valid_qualifiers = REF_QUALIFIER_CODES
        if tx and loop:
            context_key = f"{tx}_{loop}"
            if context_key in REF_QUALIFIERS_BY_LOOP:
                valid_qualifiers = REF_QUALIFIERS_BY_LOOP[context_key]

        if ref01 and ref01 not in valid_qualifiers:
            errors.append(_err(Severity.WARNING, "REF-001", loop, seg, None, 1,
                f"{ref_label} — qualifier code '{ref01}' is not expected in this section (Loop {loop}). Each section of an EDI file only allows specific reference types.",
                "Check the HIPAA implementation guide to see which reference qualifiers are valid in this loop."))

        if not ref02:
            errors.append(_err(Severity.ERROR, "REF-002", loop, seg, None, 2,
                f"{ref_label} — the reference value is blank. A reference qualifier was provided, but the actual ID/number is missing.",
                "Provide the actual reference number, ID, or identifier that this qualifier refers to."))

def _validate_hi_segments(result, errors: list) -> None:
    sub_element_sep = getattr(result, "sub_element_separator", ":")
    for seg in _find_segments(result, "HI"):
        loop = _get_loop_for_segment(result, seg)
        for i, element in enumerate(seg.elements, start=1):
            val = element.value.strip()
            if not val:
                continue
            
            parts = val.split(sub_element_sep)
            if len(parts) >= 2:
                qual = parts[0]
                code = parts[1]
                if qual in HI_DIAG_QUALIFIERS and not _icd10_format(code):
                     errors.append(_err(Severity.ERROR, "HI-001", loop, seg, None, i,
                         f"Diagnosis code '{code}' doesn't match standard ICD-10 format. ICD-10 codes start with a letter followed by 2+ digits (e.g., 'J0600' for bronchitis, 'M5412' for lumbar radiculopathy).",
                         "Verify the ICD-10 code at an official lookup tool. Format should be like 'A000' — no decimal points in EDI."))

def _validate_prv_segments(result, errors: list) -> None:
    for seg in _find_segments(result, "PRV"):
        loop = _get_loop_for_segment(result, seg)
        prv02 = _get_elem(seg, 2)
        prv03 = _get_elem(seg, 3)

        if prv02 != "PXC":
            errors.append(_err(Severity.WARNING, "PRV-001", loop, seg, None, 2,
                f"Provider taxonomy qualifier is '{prv02}', but it's typically 'PXC' (Health Care Provider Taxonomy Code). This tells the system what classification system is being used for the provider's specialty.",
                "Change to 'PXC' — this is the standard qualifier for taxonomy codes.", fixable=True, fix_value="PXC"))

        if prv03 and len(prv03) != 10:
            errors.append(_err(Severity.ERROR, "PRV-002", loop, seg, None, 3,
                f"Provider taxonomy code '{prv03}' is {len(prv03)} characters, but must be exactly 10. Taxonomy codes define a provider's specialty (e.g., '2085R0202X' for Diagnostic Radiology).",
                "Look up the correct 10-character taxonomy code at https://taxonomy.nucc.org/"))


def _validate_n3_n4(result, errors: list) -> None:
    for seg in _find_segments(result, "N4"):
        loop = _get_loop_for_segment(result, seg)
        n4_02 = _get_elem(seg, 2)
        n4_03 = _get_elem(seg, 3)
        n4_04 = _get_elem(seg, 4)

        is_us = n4_04 in ("", "US", "USA")

        if is_us:
            if n4_02 and len(n4_02) != 2:
                errors.append(_err(Severity.ERROR, "N4-001", loop, seg, None, 2,
                    f"State code '{n4_02}' must be exactly 2 letters (e.g., 'CA' for California, 'NY' for New York). This is the standard US state abbreviation.",
                    "Use the 2-letter US state abbreviation (e.g., CA, TX, FL, NY)."))

            if n4_03 and not re.match(r"^\d{5}(\d{4})?$", n4_03):
                errors.append(_err(Severity.ERROR, "N4-002", loop, seg, None, 3,
                    f"ZIP code '{n4_03}' is invalid. US ZIP codes must be either 5 digits (e.g., '90210') or 9 digits for ZIP+4 (e.g., '902101234').",
                    "Enter a valid 5-digit or 9-digit ZIP code without dashes."))
        else:
            if not n4_03:
                errors.append(_err(Severity.WARNING, "N4-004", loop, seg, None, 3,
                    "Postal code is empty. For international addresses, a postal/ZIP code should still be provided.",
                    "Add the appropriate postal code for the country specified."))

        if n4_04 and n4_04 not in VALID_ISO_COUNTRIES:
            errors.append(_err(Severity.WARNING, "N4-003", loop, seg, None, 4,
                f"Country code '{n4_04}' is not a recognized ISO country code. Country codes are 2-letter abbreviations (e.g., 'US' for United States, 'CA' for Canada).",
                "Use a standard 2-letter ISO country code. Most US healthcare files use 'US'.", fixable=True, fix_value="US"))


# ═══════════════════════════════════════════════════════════════════════════
# 7.  LAYER 5 — 837 SPECIFIC RULES
# ═══════════════════════════════════════════════════════════════════════════

def _validate_837(result, errors: list) -> None:
    _validate_837_clm(result, errors)
    _validate_837_sv1(result, errors)


def _validate_837_clm(result, errors: list) -> None:
    for seg in _find_segments(result, "CLM"):
        loop = _get_loop_for_segment(result, seg)
        clm01 = _get_elem(seg, 1)
        clm02 = _get_elem(seg, 2)
        if not _valid_monetary(clm02):
            errors.append(_err(Severity.ERROR, "CLM-004", loop, seg, None, 2,
                f"Claim total charge '{clm02}' for claim '{clm01}' is not a valid dollar amount. This should be a number with up to 2 decimal places (e.g., '1500.00' or '250').",
                "Enter the total charge as a number like '1500.00'. Do not include '$' signs or commas.", fixable=True, fix_value="0.00"))


def _validate_837_sv1(result, errors: list) -> None:
    for seg in _find_segments(result, "SV1"):
        loop = _get_loop_for_segment(result, seg)
        sv1_02 = _get_elem(seg, 2)
        if not _valid_monetary(sv1_02):
            errors.append(_err(Severity.ERROR, "SV1-004", loop, seg, None, 2,
                f"Service line charge '{sv1_02}' is not a valid dollar amount. Each service line must have a numeric charge (e.g., '250.00').",
                "Enter the charge as a number with up to 2 decimal places. No '$' signs or commas.", fixable=True, fix_value="0.00"))


# ═══════════════════════════════════════════════════════════════════════════
# 8.  LAYER 6 — 835 SPECIFIC RULES
# ═══════════════════════════════════════════════════════════════════════════

def _validate_835(result, errors: list) -> None:
    for seg in _find_segments(result, "CLP"):
        loop = _get_loop_for_segment(result, seg)
        clp01 = _get_elem(seg, 1)
        clp03 = _get_elem(seg, 3)
        if clp03 and not _valid_monetary(clp03):
            errors.append(_err(Severity.ERROR, "CLP-003", loop, seg, None, 3,
                f"Claim charge amount '{clp03}' for claim '{clp01}' is not a valid dollar amount in the payment/remittance data.",
                "Enter the charge as a number like '1500.00'. No '$' signs or commas.", fixable=True, fix_value="0.00"))


# ═══════════════════════════════════════════════════════════════════════════
# 9.  LAYER 7 — 834 SPECIFIC RULES
# ═══════════════════════════════════════════════════════════════════════════

def _validate_834(result, errors: list) -> None:
    for seg in _find_segments(result, "INS"):
        loop = _get_loop_for_segment(result, seg)
        ins01 = _get_elem(seg, 1)
        if ins01 not in ("Y", "N"):
            errors.append(_err(Severity.ERROR, "INS-001", loop, seg, None, 1,
                f"Subscriber indicator is '{ins01}', but must be 'Y' (this person IS the subscriber/primary member) or 'N' (this person is a dependent, like a spouse or child).",
                "Set to 'Y' if the member is the subscriber, or 'N' if they are a dependent on someone else's plan.", fixable=True, fix_value="Y"))


# ═══════════════════════════════════════════════════════════════════════════
# 10. LAYER 8 — CROSS-SEGMENT BUSINESS RULES
# ═══════════════════════════════════════════════════════════════════════════

def _validate_cross_segment(result, errors: list) -> None:
    tx = result.transaction_type

    # HL parent pointers check
    hls = list(_find_segments(result, "HL"))
    hl_ids = { _get_elem(seg, 1): seg.line_number for seg in hls }
    for seg in hls:
        parent_id = _get_elem(seg, 2)
        if parent_id and parent_id not in hl_ids:
            errors.append(_err(Severity.ERROR, "HL-001", "ENVELOPE", seg, None, 2,
                f"Hierarchy link broken — this segment references parent '{parent_id}', but no HL segment with that ID exists. HL segments form a tree structure (Info Source → Subscriber → Patient), and all parent references must point to a valid parent.",
                "Check the HL hierarchy. Each child HL must reference the ID of its parent HL segment."))

    # Mathematical checks
    if tx in ("837P", "837I"):
        for loop in result.loops:
            _check_837_math(loop, errors)
    elif tx == "835":
        for loop in result.loops:
            _check_835_math(loop, errors)

def _check_837_math(loop, errors):
    if loop.loop_id == "2300":
        clm = next((s for s in loop.segments if s.segment_id == "CLM"), None)
        if clm:
            try:
                clm_charge = float(_get_elem(clm, 2))
                sv_sum = 0.0
                sv_found = False

                for child in loop.children:
                    if child.loop_id == "2400":
                        sv = next((s for s in child.segments if s.segment_id in ("SV1", "SV2")), None)
                        if sv:
                            charge_idx = 2 if sv.segment_id == "SV1" else 3
                            sv_sum += float(_get_elem(sv, charge_idx))
                            sv_found = True

                if sv_found and abs(clm_charge - sv_sum) >= 0.01:
                    errors.append(_err(Severity.WARNING, "MATH-837", loop.loop_id, clm, None, 2,
                        f"Math check failed — the claim total is ${clm_charge:.2f}, but the individual service lines add up to ${sv_sum:.2f}. The claim header total should equal the sum of all service line charges.",
                        f"Either update the claim total to ${sv_sum:.2f}, or check the individual service line amounts."))
            except ValueError:
                pass

    for child in loop.children:
        _check_837_math(child, errors)

def _check_835_math(loop, errors):
    if loop.loop_id == "2100":
        clp = next((s for s in loop.segments if s.segment_id == "CLP"), None)
        if clp:
            try:
                clp_charge = float(_get_elem(clp, 3))
                clp_payment = float(_get_elem(clp, 4))
                svc_charge_sum = 0.0
                svc_payment_sum = 0.0
                svc_found = False

                for child in loop.children:
                    if child.loop_id == "2110":
                        svc = next((s for s in child.segments if s.segment_id == "SVC"), None)
                        if svc:
                            svc_charge_sum += float(_get_elem(svc, 2))
                            svc_payment_sum += float(_get_elem(svc, 3))
                            svc_found = True

                if svc_found:
                    if abs(clp_charge - svc_charge_sum) >= 0.01:
                        errors.append(_err(Severity.WARNING, "MATH-835-CLP03", loop.loop_id, clp, None, 3,
                            f"Math check failed — claim-level charge is ${clp_charge:.2f}, but the service line charges add up to ${svc_charge_sum:.2f}. These should balance.",
                            f"Verify each service line charge amount. The claim total should equal the sum of all SVC line charges."))
                    if abs(clp_payment - svc_payment_sum) >= 0.01:
                        errors.append(_err(Severity.WARNING, "MATH-835-CLP04", loop.loop_id, clp, None, 4,
                            f"Math check failed — claim-level payment is ${clp_payment:.2f}, but the service line payments add up to ${svc_payment_sum:.2f}. These should balance.",
                            f"Verify each service line payment amount. The claim payment total should equal the sum of all SVC line payments."))
            except ValueError:
                pass
    for child in loop.children:
        _check_835_math(child, errors)


# ═══════════════════════════════════════════════════════════════════════════
# 11. LOOP LOOKUP HELPER
# ═══════════════════════════════════════════════════════════════════════════

def _get_loop_for_segment(result, target_seg) -> str:
    if not hasattr(result, "loops"):
        return "UNKNOWN"

    def _search(loop) -> str:
        for s in loop.segments:
            if s is target_seg or (
                s.segment_id == target_seg.segment_id
                and s.line_number == target_seg.line_number
            ):
                return loop.loop_id
        for child in getattr(loop, "children", []):
            found = _search(child)
            if found:
                return found
        return ""

    for lp in result.loops:
        found = _search(lp)
        if found:
            return found

    return "UNKNOWN"


# ═══════════════════════════════════════════════════════════════════════════
# 12. MAIN ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════════

def validate_edi(parse_result: ParseResult) -> ValidationResult:
    errors: list[ValidationError] = []

    if not parse_result.segments:
        errors.append(ValidationError(
            error_id="GEN001",
            severity="error",
            message="No data found — the file appears to be empty or contains no recognizable EDI segments.",
        ))
        return ValidationResult(
            is_valid=False,
            error_count=1,
            errors=errors,
        )

    _validate_envelope(parse_result, errors)
    _validate_functional_group(parse_result, errors)
    _validate_transaction_set(parse_result, errors)
    _validate_nm1_segments(parse_result, errors)
    _validate_dtp_segments(parse_result, errors)
    _validate_ref_segments(parse_result, errors)
    _validate_n3_n4(parse_result, errors)
    _validate_hi_segments(parse_result, errors)
    _validate_prv_segments(parse_result, errors)

    tx = parse_result.transaction_type
    if tx in ("837P", "837I"):
        _validate_837(parse_result, errors)
    elif tx == "835":
        _validate_835(parse_result, errors)
    elif tx == "834":
        _validate_834(parse_result, errors)

    _validate_cross_segment(parse_result, errors)

    error_count = sum(1 for e in errors if e.severity == "error")
    warning_count = sum(1 for e in errors if e.severity == "warning")
    info_count = sum(1 for e in errors if e.severity == "info")

    return ValidationResult(
        is_valid=error_count == 0,
        error_count=error_count,
        warning_count=warning_count,
        info_count=info_count,
        errors=errors,
    )
