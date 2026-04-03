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
# 1.  CODE SETS
# ═══════════════════════════════════════════════════════════════════════════

# ISA-05 / ISA-07  Interchange ID Qualifier
ISA_ID_QUALIFIERS = {
    "01","14","20","27","28","29","30","33","ZZ"
}

# GS-01  Functional Identifier Code  →  valid ST-01 codes
GS_FUNCTIONAL_IDS = {
    "FA": ["999","997"],    # Functional Acknowledgement
    "HC": ["837"],          # Health Care Claim (Institutional)
    "HP": ["837"],          # Health Care Claim (Professional)
    "HR": ["835"],          # Health Care Claim Payment / Remittance
    "BE": ["834"],          # Benefit Enrollment
    "EN": ["834"],          # Benefit Enrollment (alt)
    "HB": ["271"],          # Eligibility Response
    "HS": ["270"],          # Eligibility Inquiry
    "HN": ["277"],          # Health Care Claim Status
}

# GS-08  Version/Release codes  →  allowed transaction
GS_VERSION_TX = {
    "005010X222A1": "837P",
    "005010X223A2": "837I",
    "005010X221A1": "835",
    "005010X220A1": "834",
}

# NM1-08  Entity Identifier Qualifier (subset used in healthcare)
NM1_ID_CODE_QUALIFIERS = {
    "EI","FI","MI","NI","PI","PP","SY","TJ","XX","ZZ",
    "0B","1A","1B","1C","1D","1G","1H","1J","1K","1L","1W",
    "28","29","B3","C5","GY","SL","TZ","UM","US","ZH",
}

# NM1-02  Entity Type Qualifier
NM1_ENTITY_TYPE = {"1": "Person", "2": "Non-Person Entity"}

# Complete HIPAA code set for NM1-08
VALID_NM1_08 = {
    "EI","FI","MI","NI","PI","PP","SY","TJ","XX","ZZ",
    "0B","1A","1B","1C","1D","1G","1H","1J","1K","1L","1W",
    "28","29","34","B3","C5","GY","SL","TZ","UM","US","ZH",
    "2U","4N","6P","9A","9C","NF","SV","XV","FY","QD","QL",
    "G2","LU","HJ","PXC","OB","PD","1X","3D","4A","4C","71",
    "72","73","74","75","76","77","78","79","80","AF","AG",
    "AH","AP","BE","BF","BI","BJ","BK","BL","BO","BS","DA",
    "DD","DN","DP","DR","EA","EN","F3","FD","FE","FF","FH",
    "FI","FJ","FL","FM","FN","FO","FQ","FR","FS","FX","GH",
    "GI","GN","GP","GQ","GS","GU","GW","GX","GY","GZ","HC",
    "IG","IL","IM","IN","J5","JA","JB","JC","JD","JE","JF",
    "JG","JH","JI","JJ","JK","JL","JM","JN","JO","JP","JQ",
    "JR","JS","JT","JU","JV","JW","JX","JY","JZ","K3","K4",
    "K5","K6","K7","K8","K9","KA","KB","KC","KD","KE","KF",
    "KG","KH","KI","KJ","KK","KL","KM","KN","KO","KP","KQ",
    "KR","KS","KT","KU","KV","KW","KX","KY","KZ","L1","L2",
    "L3","L4","L5","L6","L7","L8","L9","LA","LB","LC","LD",
    "LE","LF","LG","LH","LI","LJ","LK","LL","LM","LN","LO",
    "LP","LQ","LR","LS","LT","LU","LV","LW","LX","LY","LZ"
}

VALID_ISO_COUNTRIES = {
    "US","CA","MX","GB","IN","AU","DE","FR",
    "JP","CN","BR","ZA","SG","NZ","IE","IT","ES","NL","SE","NO",
    "DK","FI","CH","AT","BE","PT","GR","PL","CZ","HU","RO","BG",
    "HR","SK","SI","EE","LV","LT","CY","MT","LU","IS","LI","MC",
    "SM","VA","AD","AL","BA","MK","ME","RS","XK","BY","UA","MD",
    "RU","KZ","UZ","TM","TJ","KG","AZ","AM","GE","TR","IL","SA",
    "AE","QA","KW","BH","OM","JO","LB","SY","IQ","IR","PK","BD",
    "LK","NP","MM","TH","VN","KH","LA","MY","ID","PH","KR","TW",
    "HK","MO","MN","AF","YE","EG","LY","TN","DZ","MA","SD","ET",
    "KE","TZ","UG","RW","NG","GH","CI","SN","CM","AO","MZ","ZM",
    "ZW","BW","NA","MG","MU","SC","AR","CL","CO","PE","VE","EC",
    "BO","PY","UY","GY","SR","PA","CR","GT","HN","SV","NI","CU",
    "DO","JM","TT","BB","BS","HT","PR","VG","VI","GU","AS","MP",
    "USA"
}

# CLM-05  Place of Service codes (HIPAA / CMS)
PLACE_OF_SERVICE_CODES = {
    "01","02","03","04","05","06","07","08","09","10",
    "11","12","13","14","15","16","17","18","19","20",
    "21","22","23","24","25","26","27","28","29","30",
    "31","32","33","34","35","36","37","38","39","40",
    "41","42","49","50","51","52","53","54","55","56",
    "57","58","60","61","62","65","71","72","99",
}

# CLM-05-3  Claim Frequency Type Code
CLAIM_FREQUENCY_CODES = {
    "1": "Original",
    "2": "Interim – First Claim",
    "3": "Interim – Continuing",
    "4": "Interim – Last Claim",
    "5": "Late Charge",
    "6": "Adjustment",
    "7": "Replacement",
    "8": "Void/Cancel",
    "9": "Final Claim for a Home Health PPS Episode",
}

# DTP-01  Date/Time Qualifier (commonly used subset)
DTP_QUALIFIER_CODES = {
    "007","010","036","050","096","102","291","304","314",
    "348","349","360","361","369","405","431","435","438","439",
    "440","441","444","445","446","453","454","455","461",
    "463","471","472","484","573","582","593","607","102",
    "336","009","011","014","023","032","035","043","044",
    "045","047","112","113","114","115","119","125","126",
    "127","128","129","133","13B","14A","150","152","193",
    "203","204","208","224","225","226","230","231","232",
    "233","236","238","241","242","245","248","258","260",
    "264","266","267","281","282","286","289","290","294",
    "295","296","297","299","303","311","318","339","340",
    "341","342","343","350","370","382","771",
}

# REF-01  Reference Identification Qualifier (subset)
REF_QUALIFIER_CODES = {
    "0B","0K","1A","1B","1C","1D","1G","1H","1J","1K","1L",
    "1W","28","2U","4N","6P","9A","9C","A4","AA","BB","BJ",
    "CE","D3","D9","DN","EA","EI","EJ","E9","F4","F8","FJ",
    "G1","G2","G3","G4","GJ","GS","HJ","IA","IK","J4","JD",
    "LU","LX","MCI","N4","NT","OB","P4","PD","PQ","Q4","RB",
    "SY","T4","TJ","UK","VX","Y4","ZH","ZY","ZZ",
    "0F","02","03","04","05","06","07","08","09","11","21","22",
    "23","24","2F","2H","3H","4R","55","57","77","F5","FY",
    "QB","QD","QH","QL","RB","IG","SFH",
    "EV","1S","38","4A","72","73","74","9F","AB","AV","AZ",
    "B3","B4","BV","C1","DP","EM","GH","IL","LA","MR","N5",
    "QA","QC","QE","QF","QG","SG","TX","UX","X4","XX",
}

# SBR-01  Payer Responsibility Sequence
SBR_PAYER_RESPONSIBILITY = {
    "A","B","C","D","E","F","G","H","P","S","T","U"
}

# INS-02  Individual Relationship Code (834)
INS_RELATIONSHIP_CODES = {
    "01":"Spouse","17":"Stepson or Stepdaughter","18":"Self",
    "19":"Child","20":"Employee","21":"Unknown","22":"Handicapped Dependent",
    "23":"Sponsored Dependent","24":"Dependent of a Minor Dependent",
    "25":"Ex-Spouse","26":"Associated Party","29":"Significant Other",
    "32":"Mother","33":"Father","36":"Emancipated Minor",
    "39":"Organ Donor","40":"Cadaver Donor","41":"Injured Plaintiff",
    "43":"Child Where Insured Has No Financial Responsibility",
    "44":"Stepparent","46":"Foster Child","53":"Life Partner",
    "G8":"Other Relationship",
}

# INS-03  Maintenance Type Code (834)
INS_MAINTENANCE_TYPE = {
    "001":"Change","002":"Delete","021":"Addition",
    "024":"Cancellation or Termination","025":"Reinstatement",
    "026":"Correction","030":"Audit or Compare",
    "032":"Employee Status Change",
}

# CAS-01  Claim Adjustment Group Codes (835)
CAS_GROUP_CODES = {
    "CO":"Contractual Obligations",
    "CR":"Correction and Reversals",
    "OA":"Other Adjustments",
    "PI":"Payer Initiated Reductions",
    "PR":"Patient Responsibility",
}

# HD-03  Insurance Line Code (834)
HD_INSURANCE_LINE = {
    "AH","AK","AL","AM","AO","AP","AU","DI","DS","EP",
    "FP","HE","HL","HM","HP","HS","HV","LT","LY","MA",
    "MB","MC","MD","MH","MM","MO","MP","MS","OT","PE",
    "PD","PL","PN","PP","PS","QA","QC","QD","QE","QF",
    "QG","QH","QI","QJ","QK","QL","QM","QN","QO","QP",
    "RA","RB","RC","RD","RE","RF","RG","RH","RI","RJ",
    "SP","TY","VI","WC",
    "HLT","DEN","VIS","DRUG","FAC","LTSS",
    "COB","EAP","FSA","HRA","HSA","HMO","PPO","POS",
    "EPO","IND","FAM","EMP",
}

# HI  Diagnosis Code Qualifiers (ICD)
HI_DIAG_QUALIFIERS = {
    "ABK","BK",   # ICD-10-CM Principal Diagnosis
    "ABF","BF",   # ICD-10-CM Diagnosis
    "ABJ","BJ",   # ICD-10-CM Admitting Diagnosis
    "APR","PR",   # ICD-10-PCS Principal Procedure
    "ZZ",
}

CARC_CODES = {} # kept for backward compatibility with router
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
            message="ISA segment is missing. Every X12 file must begin with ISA.",
            suggestion="Add an ISA segment as the very first line of the EDI file."
        ))
        return

    elems = isa.elements
    n = len(elems)

    if n != 16:
        errors.append(_err(Severity.ERROR, "ENV-002", "ENVELOPE", isa, None, None,
            f"ISA must have exactly 16 elements; found {n}.",
            "Count delimiter-separated fields after 'ISA'. HIPAA 5010 mandates exactly 16."))

    isa01 = _get_elem(isa, 1)
    if isa01 not in ("00", "03"):
        errors.append(_err(Severity.ERROR, "ENV-003", "ENVELOPE", isa, 1, 1,
            f"ISA01 (Auth Info Qualifier) '{isa01}' is invalid. Must be '00' or '03'.",
            "Use '00' (no authorization info)", fixable=True, fix_value="00"))

    isa05 = _get_elem(isa, 5)
    if isa05 not in ISA_ID_QUALIFIERS:
        errors.append(_err(Severity.ERROR, "ENV-006", "ENVELOPE", isa, 1, 5,
            f"ISA05 (Sender ID Qualifier) '{isa05}' is not a valid X12 qualifier.",
            f"Valid values: {', '.join(sorted(ISA_ID_QUALIFIERS))}.", fixable=True, fix_value="ZZ"))

    isa07 = _get_elem(isa, 7)
    if isa07 not in ISA_ID_QUALIFIERS:
        errors.append(_err(Severity.ERROR, "ENV-007", "ENVELOPE", isa, 1, 7,
            f"ISA07 (Receiver ID Qualifier) '{isa07}' is not a valid X12 qualifier.",
            f"Valid values: {', '.join(sorted(ISA_ID_QUALIFIERS))}.", fixable=True, fix_value="ZZ"))

    isa11 = _get_elem(isa, 11)
    if isa11 != "^":
        errors.append(_err(Severity.ERROR, "ENV-010", "ENVELOPE", isa, 1, 11,
            f"ISA11 (Component Element Separator) is '{isa11}'. HIPAA 5010 requires '^'.",
            "Change ISA11 to '^'", fixable=True, fix_value="^"))

    isa12 = _get_elem(isa, 12)
    if isa12 != "00501":
        errors.append(_err(Severity.ERROR, "ENV-011", "ENVELOPE", isa, 1, 12,
            f"ISA12 (Version) is '{isa12}'. HIPAA mandate requires '00501' (5010).",
            "Set ISA12 to '00501'", fixable=True, fix_value="00501"))

    isa13 = _get_elem(isa, 13)
    if not (isa13.isdigit() and len(isa13) == 9):
        errors.append(_err(Severity.ERROR, "ENV-012", "ENVELOPE", isa, 1, 13,
            f"ISA13 (Control Number) '{isa13}' must be exactly 9 numeric digits.",
            "Example: '000000001'. Pad with leading zeros."))
        
    isa14 = _get_elem(isa, 14)
    if isa14 not in ("0", "1"):
        errors.append(_err(Severity.ERROR, "ENV-013", "ENVELOPE", isa, 1, 14,
            f"ISA14 (Ack Requested) '{isa14}' must be '0' or '1'.",
            "Use '0' or '1'", fixable=True, fix_value="0"))

    if not iea:
        errors.append(ValidationError(
            severity=Severity.ERROR, error_id="ENV-015",
            loop_location="ENVELOPE", segment_id="IEA", line_number=0,
            element_index=-1,
            message="IEA (Interchange Control Trailer) segment is missing.",
            suggestion="Add IEA segment at the end of the file."))
        return

    iea02 = _get_elem(iea, 2)
    if iea02 != isa13:
        errors.append(_err(Severity.ERROR, "ENV-016", "ENVELOPE", iea, 2, 2,
            f"IEA02 control number '{iea02}' must match ISA13 '{isa13}'.",
            f"Change IEA02 to '{isa13}'", fixable=True, fix_value=isa13))


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
            message="GS (Functional Group Header) segment is missing.",
            suggestion="Add GS segment between ISA and ST."))
        return

    gs01 = _get_elem(gs, 1)
    if gs01 not in GS_FUNCTIONAL_IDS:
        errors.append(_err(Severity.ERROR, "FG-002", "ENVELOPE", gs, None, 1,
            f"GS01 (Functional ID) '{gs01}' is not a valid HIPAA functional identifier.",
            "Use 'HC', 'HP', 'HR', 'BE' based on transaction type."))

    gs06 = _get_elem(gs, 6)
    if not ge:
        errors.append(ValidationError(
            severity=Severity.ERROR, error_id="FG-007",
            loop_location="ENVELOPE", segment_id="GE", line_number=0,
            element_index=-1,
            message="GE (Functional Group Trailer) segment is missing.",
            suggestion="Add GE segment after SE and before IEA."))
        return

    ge02 = _get_elem(ge, 2)
    if ge02 != gs06:
        errors.append(_err(Severity.ERROR, "FG-008", "ENVELOPE", ge, None, 2,
            f"GE02 control number '{ge02}' must match GS06 '{gs06}'.",
            f"Change GE02 to '{gs06}'.", fixable=True, fix_value=gs06))


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
            message="ST (Transaction Set Header) segment is missing.",
            suggestion="Add ST segment after GS."))
        return

    st02 = _get_elem(st, 2)
    
    if not se:
        errors.append(ValidationError(
            severity=Severity.ERROR, error_id="TS-004",
            loop_location="ENVELOPE", segment_id="SE", line_number=0,
            element_index=-1,
            message="SE (Transaction Set Trailer) is missing.",
            suggestion="Add SE segment as the last segment before GE."))
        return

    se01 = _get_elem(se, 1)
    actual_count = sum(
        1 for s in result.segments
        if st.line_number <= s.line_number <= se.line_number
    )

    if se01.isdigit() and int(se01) != actual_count:
        errors.append(_err(Severity.ERROR, "TS-005", "ENVELOPE", se, None, 1,
            f"SE01 segment count is {se01}, but actual segment count from ST to SE inclusive is {actual_count}.",
            f"Change SE01 to '{actual_count}'.", fixable=True, fix_value=str(actual_count)))

    se02 = _get_elem(se, 2)
    if se02 != st02:
        errors.append(_err(Severity.ERROR, "TS-006", "ENVELOPE", se, None, 2,
            f"SE02 control number '{se02}' must match ST02 '{st02}'.",
            f"Change SE02 to '{st02}'.", fixable=True, fix_value=st02))


# ═══════════════════════════════════════════════════════════════════════════
# 6.  LAYER 4 — COMMON SEGMENT RULES
# ═══════════════════════════════════════════════════════════════════════════

def _validate_nm1_segments(result, errors: list) -> None:
    for seg in _find_segments(result, "NM1"):
        loop = _get_loop_for_segment(result, seg)
        nm1_02 = _get_elem(seg, 2)
        if nm1_02 not in ("1", "2"):
            errors.append(_err(Severity.ERROR, "NM1-001", loop, seg, None, 2,
                f"NM1-02 (Entity Type) '{nm1_02}' must be '1' or '2'.",
                "Use '1' for individuals, '2' for organizations.", fixable=True, fix_value="2"))

        nm1_08 = _get_elem(seg, 8)
        nm1_09 = _get_elem(seg, 9)

        if nm1_08 and nm1_08 not in VALID_NM1_08:
            errors.append(_err(Severity.ERROR, "NM1-006", loop, seg, None, 8,
                f"NM1-08 ID Qualifier '{nm1_08}' is not a valid HIPAA NM1-08 code. Common values: 'XX' (NPI), 'MI' (Member ID), '34' (SSN), 'EI' (EIN), 'PI' (Payer ID), 'FI' (Federal Tax ID), 'SY' (Social Security Number).",
                "Replace with a valid HIPAA NM1-08 qualifier code.", fixable=False))

        if nm1_08 == "XX" and nm1_09:
            if not luhn_check(nm1_09):
                errors.append(_err(Severity.ERROR, "NM1-004", loop, seg, None, 9,
                    f"NM1-09 NPI '{nm1_09}' fails the Luhn algorithm check.",
                    "Verify the NPI on the CMS NPPES registry.", fixable=False))


def _validate_dtp_segments(result, errors: list) -> None:
    for seg in _find_segments(result, "DTP"):
        loop = _get_loop_for_segment(result, seg)
        dtp01 = _get_elem(seg, 1)
        dtp02 = _get_elem(seg, 2)
        dtp03 = _get_elem(seg, 3)

        if dtp01 and dtp01 not in DTP_QUALIFIER_CODES:
            errors.append(_err(Severity.WARNING, "DTP-001", loop, seg, None, 1,
                f"DTP01 qualifier '{dtp01}' is not listed in standard code sets.",
                "Ensure standard HIPAA DTP qualifier codes are used."))

        if dtp02 == "D8":
            if not _valid_date8(dtp03):
                errors.append(_err(Severity.ERROR, "DTP-002", loop, seg, None, 3,
                    f"DTP03 date '{dtp03}' must be CCYYMMDD when DTP02='D8'.",
                    "Example: '20240610'."))
        elif dtp02 == "RD8":
            if len(dtp03) != 16 or not _valid_date8(dtp03[:8]) or not _valid_date8(dtp03[8:]):
                errors.append(_err(Severity.ERROR, "DTP-003", loop, seg, None, 3,
                    f"DTP03 date range '{dtp03}' must be 16 characters (CCYYMMDD-CCYYMMDD format) when DTP02='RD8'.",
                    "Example: '2024010120240131'."))

def _validate_ref_segments(result, errors: list) -> None:
    for seg in _find_segments(result, "REF"):
        loop = _get_loop_for_segment(result, seg)
        ref01 = _get_elem(seg, 1)
        ref02 = _get_elem(seg, 2)

        if ref01 and ref01 not in REF_QUALIFIER_CODES:
            errors.append(_err(Severity.WARNING, "REF-001", loop, seg, None, 1,
                f"REF01 qualifier '{ref01}' is not recognized.",
                "Review HIPAA reference qualifiers format."))

        if not ref02:
            errors.append(_err(Severity.ERROR, "REF-002", loop, seg, None, 2,
                "REF02 Reference Identification cannot be blank.",
                "Provide a valid reference number / identifier."))

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
                         f"Diagnosis code '{code}' does not match standard ICD-10 format.",
                         "Verify ICD-10-CM or PCS structure (e.g., A000 without decimal)."))

def _validate_prv_segments(result, errors: list) -> None:
    for seg in _find_segments(result, "PRV"):
        loop = _get_loop_for_segment(result, seg)
        prv02 = _get_elem(seg, 2)
        prv03 = _get_elem(seg, 3)

        if prv02 != "PXC":
            errors.append(_err(Severity.WARNING, "PRV-001", loop, seg, None, 2,
                f"PRV02 qualifier '{prv02}' is typically 'PXC' for taxonomy codes.",
                "Use 'PXC' for provider taxonomy."))

        if prv03 and len(prv03) != 10:
            errors.append(_err(Severity.ERROR, "PRV-002", loop, seg, None, 3,
                f"PRV03 taxonomy code '{prv03}' must be exactly 10 alphanumeric characters.",
                "Verify National Provider Taxonomy code."))


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
                    f"N4-02 (State) '{n4_02}' must be exactly 2 characters.",
                    "Use the 2-letter US state abbreviation."))

            if n4_03 and not re.match(r"^\d{5}(\d{4})?$", n4_03):
                errors.append(_err(Severity.ERROR, "N4-002", loop, seg, None, 3,
                    f"N4-03 (ZIP Code) '{n4_03}' must be 5 or 9 digits.",
                    "Use 5-digit ZIP or ZIP+4."))
        else:
            if not n4_03:
                errors.append(_err(Severity.WARNING, "N4-004", loop, seg, None, 3,
                    "N4-03 postal code is empty.",
                    "Provide a valid international postal code."))

        if n4_04 and n4_04 not in VALID_ISO_COUNTRIES:
            errors.append(_err(Severity.WARNING, "N4-003", loop, seg, None, 4,
                f"N4-04 country code '{n4_04}' is not a recognized ISO 3166 country code.",
                "Use standard 2-letter ISO country code, e.g., 'US', 'IN', 'CA', 'GB'."))


# ═══════════════════════════════════════════════════════════════════════════
# 7.  LAYER 5 — 837 SPECIFIC RULES
# ═══════════════════════════════════════════════════════════════════════════

def _validate_837(result, errors: list) -> None:
    _validate_837_clm(result, errors)
    _validate_837_sv1(result, errors)


def _validate_837_clm(result, errors: list) -> None:
    for seg in _find_segments(result, "CLM"):
        loop = _get_loop_for_segment(result, seg)
        clm02 = _get_elem(seg, 2)
        if not _valid_monetary(clm02):
            errors.append(_err(Severity.ERROR, "CLM-004", loop, seg, None, 2,
                f"CLM02 (Total Charge) '{clm02}' is not a valid monetary amount.",
                "Format as numeric with up to 2 decimal places.", fixable=True, fix_value="0.00"))


def _validate_837_sv1(result, errors: list) -> None:
    for seg in _find_segments(result, "SV1"):
        loop = _get_loop_for_segment(result, seg)
        sv1_02 = _get_elem(seg, 2)
        if not _valid_monetary(sv1_02):
            errors.append(_err(Severity.ERROR, "SV1-004", loop, seg, None, 2,
                f"SV1-02 charge '{sv1_02}' is not a valid monetary amount.",
                "Format: numeric with up to 2 decimal places.", fixable=True, fix_value="0.00"))


# ═══════════════════════════════════════════════════════════════════════════
# 8.  LAYER 6 — 835 SPECIFIC RULES
# ═══════════════════════════════════════════════════════════════════════════

def _validate_835(result, errors: list) -> None:
    for seg in _find_segments(result, "CLP"):
        loop = _get_loop_for_segment(result, seg)
        clp03 = _get_elem(seg, 3)
        if clp03 and not _valid_monetary(clp03):
            errors.append(_err(Severity.ERROR, "CLP-003", loop, seg, None, 3,
                f"CLP03 (Claim Charge) '{clp03}' is not valid.",
                "Format: numeric.", fixable=True, fix_value="0.00"))


# ═══════════════════════════════════════════════════════════════════════════
# 9.  LAYER 7 — 834 SPECIFIC RULES
# ═══════════════════════════════════════════════════════════════════════════

def _validate_834(result, errors: list) -> None:
    for seg in _find_segments(result, "INS"):
        loop = _get_loop_for_segment(result, seg)
        ins01 = _get_elem(seg, 1)
        if ins01 not in ("Y", "N"):
            errors.append(_err(Severity.ERROR, "INS-001", loop, seg, None, 1,
                f"INS01 (Member Indicator) '{ins01}' must be 'Y' or 'N'.",
                "Set to Y or N.", fixable=True, fix_value="Y"))


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
                f"HL02 references parent HL '{parent_id}' which does not exist prior in the hierarchy.",
                "Ensure HL segments are logically hierarchical."))

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
                        f"CLM02 total charge {clm_charge:.2f} does not strictly equal sum of service lines {sv_sum:.2f}.",
                        "Verify line items equal header totals if contracted to balance."))
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
                            f"CLP03 claim charge {clp_charge:.2f} mismatches sum of SVC02 {svc_charge_sum:.2f}.",
                            "Adjust amounts to balance."))
                    if abs(clp_payment - svc_payment_sum) >= 0.01:
                        errors.append(_err(Severity.WARNING, "MATH-835-CLP04", loop.loop_id, clp, None, 4,
                            f"CLP04 claim payment {clp_payment:.2f} mismatches sum of SVC03 {svc_payment_sum:.2f}.",
                            "Adjust amounts to balance."))
            except ValueError:
                pass
    for child in loop.children:
        _check_835_math(child, errors)


# ═══════════════════════════════════════════════════════════════════════════
# 11. LOOP LOOKUP HELPER
# ═══════════════════════════════════════════════════════════════════════════

def _get_loop_for_segment(result, target_seg) -> str:
    if hasattr(result, "loops"):
        for lp in result.loops:
            for s in lp.segments:
                if s is target_seg or (
                    s.segment_id == target_seg.segment_id
                    and s.line_number == target_seg.line_number
                ):
                    return lp.loop_id
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
            message="No segments found in the file",
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

