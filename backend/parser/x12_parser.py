"""
X12 EDI Parser — recursive-descent parser for HIPAA 5010 transaction types.

Supports: 837P (Professional Claims), 837I (Institutional Claims),
          835 (Remittance/Payment), 834 (Enrollment/Benefit).
"""

from __future__ import annotations
from parser.edi_types import Element, Segment, Loop, ParseResult


# ── Transaction type identification ─────────────────────────────────────

TRANSACTION_TYPES = {
    ("HP", "837"): ("837P", "Professional Claim (837P)"),
    ("HC", "837"): ("837I", "Institutional Claim (837I)"),
    ("HP", "837P"): ("837P", "Professional Claim (837P)"),
    ("HC", "837I"): ("837I", "Institutional Claim (837I)"),
    ("HR", "835"):  ("835",  "Remittance Advice (835)"),
    ("HP", "835"):  ("835",  "Remittance Advice (835)"),
    ("BE", "834"):  ("834",  "Benefit Enrollment (834)"),
    ("EN", "834"):  ("834",  "Benefit Enrollment (834)"),
    ("FA", "999"): ("999", "Functional Acknowledgement (999)"),
    ("FA", "997"): ("997", "Functional Acknowledgement (997)"),
    ("HB", "271"): ("271", "Eligibility Response (271)"),
    ("HS", "270"): ("270", "Eligibility Inquiry (270)"),
    ("HN", "277"): ("277", "Claim Status Response (277)"),
}

# GS08 version code to functional id fallback
FUNCTIONAL_ID_MAP = {
    "005010X222A1": ("837P", "Professional Claim (837P)"),
    "005010X223A2": ("837I", "Institutional Claim (837I)"),
    "005010X221A1": ("835",  "Remittance Advice (835)"),
    "005010X220A1": ("834",  "Benefit Enrollment (834)"),
    "005010X279A1": ("271", "Eligibility Response (271)"),
    "005010X279":   ("270", "Eligibility Inquiry (270)"),
    "005010X212":   ("277", "Claim Status Response (277)"),
    "005010X231A1": ("999", "Functional Acknowledgement (999)"),
}

# ── Loop definitions per transaction type ───────────────────────────────

LOOP_DEFS_837P = {
    "1000A": {"trigger": ("NM1", 1, "41"), "name": "Submitter Name", "level": 1},
    "1000B": {"trigger": ("NM1", 1, "40"), "name": "Receiver Name", "level": 1},
    "2000A": {"trigger": ("HL", 3, "20"), "name": "Billing Provider HL", "level": 1},
    "2010AA": {"trigger": ("NM1", 1, "85"), "name": "Billing Provider Name", "level": 2},
    "2010AB": {"trigger": ("NM1", 1, "87"), "name": "Pay-to Provider Name", "level": 2},
    "2010AC": {"trigger": ("NM1", 1, "PE"), "name": "Pay-to Plan Name", "level": 2},
    "2000B": {"trigger": ("HL", 3, "22"), "name": "Subscriber HL", "level": 2},
    "2010BA": {"trigger": ("NM1", 1, "IL"), "name": "Subscriber Name", "level": 3},
    "2010BB": {"trigger": ("NM1", 1, "PR"), "name": "Payer Name", "level": 3},
    "2000C": {"trigger": ("HL", 3, "23"), "name": "Patient HL", "level": 3},
    "2010CA": {"trigger": ("NM1", 1, "QC"), "name": "Patient Name", "level": 4},
    "2300":  {"trigger": ("CLM",), "name": "Claim Information", "level": 4},
    "2310A": {"trigger": ("NM1", 1, "71"), "name": "Referring Provider", "level": 5},
    "2310B": {"trigger": ("NM1", 1, "82"), "name": "Rendering Provider", "level": 5},
    "2310C": {"trigger": ("NM1", 1, "77"), "name": "Service Facility", "level": 5},
    "2310D": {"trigger": ("NM1", 1, "DN"), "name": "Supervising Provider", "level": 5},
    "2320":  {"trigger": ("SBR",), "name": "Other Subscriber Info", "level": 5},
    "2330A": {"trigger": ("NM1", 1, "IL"), "name": "Other Subscriber Name", "context": "inside_2320", "level": 6},
    "2330B": {"trigger": ("NM1", 1, "PR"), "name": "Other Payer Name", "context": "inside_2320", "level": 6},
    "2400":  {"trigger": ("LX",), "name": "Service Line", "level": 5},
    "2410":  {"trigger": ("LIN",), "name": "Drug Identification", "level": 6},
    "2420A": {"trigger": ("NM1", 1, "82"), "name": "Rendering Provider (SL)", "context": "inside_2400", "level": 6},
    "2420B": {"trigger": ("NM1", 1, "85"), "name": "Purchased Service Provider", "level": 6},
    "2420C": {"trigger": ("NM1", 1, "77"), "name": "Service Facility (SL)", "context": "inside_2400", "level": 6},
    "2430":  {"trigger": ("SVD",), "name": "Line Adjudication", "level": 6},
    "2440":  {"trigger": ("LQ",), "name": "Form Identification", "level": 6},
}

LOOP_DEFS_837I = dict(LOOP_DEFS_837P)
LOOP_DEFS_837I.update({
    "2310G": {"trigger": ("NM1", 1, "ZJ"), "name": "Operating Physician", "level": 5},
    "2310H": {"trigger": ("NM1", 1, "ZZ"), "name": "Other Operating Physician", "level": 5},
    "2300":  {"trigger": ("CLM",), "name": "Claim Information", "level": 4},
})

LOOP_DEFS_835 = {
    "1000A": {"trigger": ("N1", 1, "PR"), "name": "Payer Identification", "level": 1},
    "1000B": {"trigger": ("N1", 1, "PE"), "name": "Payee Identification", "level": 1},
    "2000":  {"trigger": ("LX",), "name": "Header Number", "level": 1},
    "2100":  {"trigger": ("CLP",), "name": "Claim Payment Information", "level": 2},
    "2110":  {"trigger": ("SVC",), "name": "Service Payment Information", "level": 3},
}

LOOP_DEFS_834 = {
    "1000A": {"trigger": ("N1", 1, "P5"), "name": "Sponsor Name", "level": 1},
    "1000B": {"trigger": ("N1", 1, "IN"), "name": "Payer Name", "level": 1},
    "2000":  {"trigger": ("INS",), "name": "Member Level Detail", "level": 1},
    "2100A": {"trigger": ("NM1", 1, "IL"), "name": "Member Name", "level": 2},
    "2100B": {"trigger": ("NM1", 1, "70"), "name": "Incorrect Member Name", "level": 2},
    "2100C": {"trigger": ("NM1", 1, "31"), "name": "Member Mailing Address", "level": 2},
    "2100D": {"trigger": ("NM1", 1, "QD"), "name": "Responsible Person", "level": 2},
    "2100E": {"trigger": ("NM1", 1, "IL"), "name": "Member Employer", "context": "after_2100A", "level": 2},
    "2200":  {"trigger": ("DSB",), "name": "Disability Information", "level": 2},
    "2300":  {"trigger": ("HD",), "name": "Health Coverage", "level": 2},
    "2310":  {"trigger": ("LX",), "name": "Additional Coverage", "level": 3},
    "2320":  {"trigger": ("COB",), "name": "Coordination of Benefits", "level": 3},
    "2330":  {"trigger": ("NM1", 1, "IN"), "name": "COB Related Entity", "level": 4},
    "2700":  {"trigger": ("LS",), "name": "Additional Reporting", "level": 2},
}


# Segment descriptions for display
SEGMENT_DESCRIPTIONS = {
    "ISA": "Interchange Control Header",
    "IEA": "Interchange Control Trailer",
    "GS":  "Functional Group Header",
    "GE":  "Functional Group Trailer",
    "ST":  "Transaction Set Header",
    "SE":  "Transaction Set Trailer",
    "BHT": "Beginning of Hierarchical Transaction",
    "HL":  "Hierarchical Level",
    "NM1": "Name",
    "N3":  "Address",
    "N4":  "City/State/ZIP",
    "REF": "Reference Identification",
    "PER": "Contact Information",
    "CLM": "Claim Information",
    "DTP": "Date/Time Period",
    "AMT": "Monetary Amount",
    "SBR": "Subscriber Information",
    "PAT": "Patient Information",
    "DMG": "Demographic Information",
    "INS": "Member Information",
    "LX":  "Assigned Number",
    "SV1": "Professional Service",
    "SV2": "Institutional Service",
    "DG1": "Diagnosis",
    "HI":  "Health Care Information Codes",
    "CLP": "Claim Payment Information",
    "SVC": "Service Payment Information",
    "CAS": "Adjustment",
    "HD":  "Health Coverage",
    "LUI": "Language Use",
    "N1":  "Name",
    "QTY": "Quantity",
    "DTM": "Date/Time Reference",
    "SE":  "Transaction Set Trailer",
    "LS":  "Loop Header",
    "LE":  "Loop Trailer",
    "PLB": "Provider Level Balance",
    "TRN": "Trace Number",
}

ELEMENT_DESCRIPTIONS = {
  "ISA": {1:"Auth Info Qualifier",2:"Auth Info",3:"Security Info Qualifier",
    4:"Security Info",5:"Sender ID Qualifier",6:"Interchange Sender ID",
    7:"Receiver ID Qualifier",8:"Interchange Receiver ID",9:"Date",
    10:"Time",11:"Component Element Separator",12:"Version",
    13:"Control Number",14:"Ack Requested",15:"Usage Indicator",
    16:"Sub-Element Separator"},
  "IEA": {1:"Functional Group Count",2:"Interchange Control Number"},
  "GS":  {1:"Functional ID Code",2:"App Sender Code",3:"App Receiver Code",
    4:"Date",5:"Time",6:"Group Control Number",7:"Responsible Agency",
    8:"Version"},
  "GE":  {1:"Transaction Set Count",2:"Group Control Number"},
  "ST":  {1:"Transaction Set ID",2:"Control Number",3:"Version"},
  "SE":  {1:"Segment Count",2:"Control Number"},
  "BHT": {1:"Hierarchical Structure Code",2:"Transaction Set Purpose Code",
    3:"Reference Identification",4:"Date",5:"Time",6:"Transaction Type Code"},
  "BGN": {1:"Transaction Set Purpose Code",2:"Reference ID",3:"Date",
    4:"Time",5:"Time Zone",6:"Original Transaction Set Reference ID",
    7:"Transaction Type Code",8:"Action Code"},
  "HL":  {1:"Hierarchical ID",2:"Parent Hierarchical ID",
    3:"Hierarchical Level Code",4:"Hierarchical Child Code"},
  "NM1": {1:"Entity ID Code",2:"Entity Type Qualifier",3:"Last/Org Name",
    4:"First Name",5:"Middle Name",6:"Prefix",7:"Suffix",
    8:"ID Code Qualifier",9:"ID Code",10:"Entity Relationship Code",
    11:"Entity ID Code 2"},
  "N3":  {1:"Address Line 1",2:"Address Line 2"},
  "N4":  {1:"City",2:"State",3:"ZIP/Postal Code",4:"Country Code",
    5:"Location Qualifier",6:"Location ID"},
  "N1":  {1:"Entity ID Code",2:"Name",3:"ID Code Qualifier",4:"ID Code"},
  "REF": {1:"Reference ID Qualifier",2:"Reference ID",3:"Description"},
  "PER": {1:"Contact Function Code",2:"Name",3:"Comm Number Qualifier 1",
    4:"Comm Number 1",5:"Comm Number Qualifier 2",6:"Comm Number 2",
    7:"Comm Number Qualifier 3",8:"Comm Number 3"},
  "DTP": {1:"Date/Time Qualifier",2:"Date/Time Format",3:"Date/Time Value"},
  "DMG": {1:"Date Format Qualifier",2:"Date of Birth",3:"Gender Code",
    4:"Marital Status Code",5:"Race/Ethnicity Code",6:"Citizenship Status",
    7:"Country Code",9:"Ethnic Group Code"},
  "INS": {1:"Member Indicator",2:"Individual Relationship Code",
    3:"Maintenance Type Code",4:"Maintenance Reason Code",
    5:"Benefit Status Code",6:"Employment Status Code",
    7:"Student Status Code",8:"Handicap Indicator",
    9:"Date of Death",10:"Confidentiality Code",11:"City",
    12:"State",13:"Zip Code",17:"Employment Class Code"},
  "HD":  {1:"Maintenance Type Code",2:"Not Used",3:"Insurance Line Code",
    4:"Plan Coverage Description",5:"Coverage Type Code",
    6:"Contract Code",7:"Days per Week Code"},
  "COB": {1:"Payer Responsibility Sequence",2:"Reference ID",
    3:"COB Type Code",4:"Coordination Period"},
  "DSB": {1:"Disability Type Code",2:"Quantity",3:"Occupation Class Code",
    4:"Work Intensity Code",5:"Product/Service ID Qualifier",
    6:"Product/Service ID",7:"Date"},
  "CLM": {1:"Claim Submitter ID",2:"Total Claim Charge",3:"Not Used",
    4:"Not Used",5:"Service Location (POS:FacType:ClaimFreq)",
    6:"Provider Acceptance Assignment",7:"Assignment of Benefits",
    8:"Release of Information",9:"Patient Signature Source",
    10:"Auto Accident State",11:"Special Program Code"},
  "CL1": {1:"Admission Type Code",2:"Admission Source Code",
    3:"Patient Status Code"},
  "SBR": {1:"Payer Responsibility",2:"Individual Relationship Code",
    3:"Reference ID",4:"Name",5:"Insurance Type Code",
    6:"Coordination of Benefits Code",7:"Yes/No Condition",
    8:"Employment Status Code",9:"Claim Filing Indicator Code"},
  "HI":  {1:"Diagnosis Code 1 (Qualifier:Code)",2:"Diagnosis Code 2",
    3:"Diagnosis Code 3",4:"Diagnosis Code 4",5:"Diagnosis Code 5",
    6:"Diagnosis Code 6",7:"Diagnosis Code 7",8:"Diagnosis Code 8",
    9:"Diagnosis Code 9",10:"Diagnosis Code 10",11:"Diagnosis Code 11",
    12:"Diagnosis Code 12"},
  "SV1": {1:"Procedure Code (Qualifier:Code:Mod1:Mod2:Mod3:Mod4)",
    2:"Line Item Charge",3:"Unit of Measurement",4:"Service Unit Count",
    5:"Facility Code Value",6:"Service Qualifier",7:"Diagnosis Code Pointer",
    8:"Emergency Indicator",9:"Multiple Procedure Code",
    10:"EPSDT Indicator",11:"Family Planning Indicator",12:"Review Code",
    15:"Purchased Service Provider Specialty"},
  "SV2": {1:"Revenue Code",2:"Procedure Code",3:"Line Item Charge",
    4:"Unit of Measurement",5:"Service Unit Count",6:"Unit Rate",
    7:"Non-Covered Charge",10:"EPSDT Indicator"},
  "LX":  {1:"Assigned Number"},
  "CLP": {1:"Claim Submitter Identifier",2:"Claim Status Code",
    3:"Total Claim Charge",4:"Claim Payment Amount",
    5:"Patient Responsibility",6:"Claim Filing Indicator Code",
    7:"Payer Claim Control Number",8:"Facility Type Code",
    9:"Claim Frequency Type Code"},
  "SVC": {1:"Procedure Code (Qualifier:Code:Modifier)",2:"Line Item Charge",
    3:"Line Item Payment Amount",4:"Revenue Code",5:"Units of Service",
    6:"Original Procedure Code",7:"Adjudicated Procedure Quantity"},
  "CAS": {1:"Claim Adjustment Group Code",2:"Adjustment Reason Code 1",
    3:"Adjustment Amount 1",4:"Adjustment Quantity 1",
    5:"Adjustment Reason Code 2",6:"Adjustment Amount 2"},
  "PLB": {1:"Provider ID",2:"Fiscal Period Date",3:"Adjustment Reason Code",
    4:"Provider Adjustment Amount"},
  "BPR": {1:"Transaction Handling Code",2:"Total Actual Provider Payment",
    3:"Credit/Debit Flag",4:"Payment Method Code",5:"Payment Format Code",
    6:"Sender DFI ID Qualifier",7:"Sender DFI ID",8:"Sender Account Qualifier",
    9:"Sender Account Number",10:"Originating Company ID",
    11:"Originating Company Supplemental Code",12:"Receiver DFI ID Qualifier",
    13:"Receiver DFI ID",14:"Receiver Account Qualifier",
    15:"Receiver Account Number",16:"Issue Date"},
  "TRN": {1:"Trace Type Code",2:"Reference Identification",
    3:"Originating Company ID",4:"Reference ID"},
  "PRV": {1:"Provider Code",2:"Reference ID Qualifier",
    3:"Provider Taxonomy Code"},
  "AMT": {1:"Amount Qualifier Code",2:"Monetary Amount",3:"Credit/Debit Flag"},
  "QTY": {1:"Quantity Qualifier",2:"Quantity",3:"Composite Unit of Measure"},
  "PAT": {1:"Individual Relationship Code",2:"Patient Location Code",
    3:"Employment Status Code",4:"Student Status Code",5:"Date of Death",
    6:"Unit of Measurement",7:"Patient Weight",8:"Pregnancy Indicator"},
  "PWK": {1:"Report Type Code",2:"Report Transmission Code",
    3:"Report Copies Needed",4:"Entity ID Code",5:"ID Code Qualifier",
    6:"ID Code",7:"Description",9:"Request Category Code"},
  "CR1": {1:"Unit of Measurement Code",2:"Weight",3:"Ambulance Transport Code",
    4:"Ambulance Transport Reason Code",5:"Unit of Measurement Code",
    6:"Transport Distance",7:"Round Trip Purpose Description",
    8:"Stretcher Purpose Description",9:"Additional Info"},
  "CR7": {1:"Discipline Type Code",2:"Total Visits Rendered Count",
    3:"Visit Count",4:"Visit Count",5:"Visit Count"},
  "SVD": {1:"Other Payer Primary ID",2:"Service Line Paid Amount",
    3:"Procedure Code",4:"Product/Service ID",5:"Paid Service Unit Count",
    6:"Bundled/Unbundled Line Number"},
  "LQ":  {1:"Code List Qualifier Code",2:"Form ID Code"},
  "HCP": {1:"Pricing Methodology",2:"Repriced Allowed Amount",
    3:"Repriced Saving Amount",4:"Repricing Organization ID",
    5:"Repricing Per Diem/Flat Rate Amount",6:"Repriced Approved DRG Code",
    7:"Repriced Approved Amount",8:"Repriced Approved Revenue Code",
    9:"Repriced Approved Units",10:"Repriced Approved Unit Rate",
    11:"Repricing Action Code",12:"Reject Reason Code"},
}


def detect_delimiters(raw: str) -> tuple[str, str, str]:
    """
    Detect element separator, sub-element separator, and segment terminator
    from the ISA segment (fixed 106-char format).
    """
    if len(raw) < 106:
        # Fallback defaults
        return "*", ":", "~"

    # ISA segment is always exactly 106 characters
    element_sep = raw[3]          # Character after "ISA"
    sub_element_sep = raw[104]    # Position 104
    segment_term = raw[105]       # Position 105

    return element_sep, sub_element_sep, segment_term


def split_segments(raw: str, segment_terminator: str) -> list[str]:
    """Split raw EDI content into individual segment strings."""
    # Clean up whitespace around terminators
    content = raw.strip()
    segments = content.split(segment_terminator)
    # Clean each segment and remove empty ones
    return [s.strip() for s in segments if s.strip()]


def parse_segment(raw_segment: str, element_separator: str,
                  line_number: int = 0) -> Segment:
    """Parse a raw segment string into a Segment object."""
    parts = raw_segment.split(element_separator)
    segment_id = parts[0].strip()

    elements = []
    for i, value in enumerate(parts[1:], start=1):
        desc = ELEMENT_DESCRIPTIONS.get(segment_id, {}).get(i, "")
        elements.append(Element(index=i, value=value, description=desc))

    return Segment(
        segment_id=segment_id,
        elements=elements,
        raw=raw_segment,
        line_number=line_number,
    )


def identify_transaction_type(segments: list[Segment]) -> tuple[str, str]:
    """Identify the transaction type from GS and ST segments."""
    gs_functional_id = ""
    gs_version = ""
    st_id = ""

    for seg in segments:
        if seg.segment_id == "GS" and len(seg.elements) >= 1:
            gs_functional_id = seg.elements[0].value.strip()
            if len(seg.elements) >= 8:
                gs_version = seg.elements[7].value.strip()
        elif seg.segment_id == "ST" and len(seg.elements) >= 1:
            st_id = seg.elements[0].value.strip()
            break

    # Try GS functional ID + ST identifier
    key = (gs_functional_id, st_id)
    if key in TRANSACTION_TYPES:
        return TRANSACTION_TYPES[key]

    # Try GS functional ID + generic transaction code
    for k, v in TRANSACTION_TYPES.items():
        if k[0] == gs_functional_id:
            return v

    # Try version code
    if gs_version in FUNCTIONAL_ID_MAP:
        return FUNCTIONAL_ID_MAP[gs_version]

    # Fallback based on ST identifier alone
    if st_id == "271": return ("271", "Eligibility Response (271)")
    if st_id == "270": return ("270", "Eligibility Inquiry (270)")
    if st_id == "277": return ("277", "Claim Status Response (277)")
    if st_id in ("999", "997"): return ("999", "Functional Ack (999/997)")
    if st_id == "837":
        return ("837P", "Professional Claim (837P)")
    elif st_id == "835":
        return ("835", "Remittance Advice (835)")
    elif st_id == "834":
        return ("834", "Benefit Enrollment (834)")

    return ("UNKNOWN", f"Unknown Transaction (ST={st_id})")


def get_loop_defs(transaction_type: str) -> dict:
    """Get loop definitions for a given transaction type."""
    if transaction_type == "837P":
        return LOOP_DEFS_837P
    elif transaction_type == "837I":
        return LOOP_DEFS_837I
    elif transaction_type == "835":
        return LOOP_DEFS_835
    elif transaction_type == "834":
        return LOOP_DEFS_834
    return {}


def matches_trigger(segment: Segment, trigger: tuple, current_parent_loop_id: str = "", context: str = "") -> bool:
    """Check if a segment matches a loop trigger definition with context."""
    if not trigger:
        return False

    # First element of trigger is always the segment ID
    if segment.segment_id != trigger[0]:
        return False

    # If trigger has element index and value, check those too
    if len(trigger) >= 3:
        elem_index = trigger[1]
        expected_value = trigger[2]
        if len(segment.elements) >= elem_index:
            if segment.elements[elem_index - 1].value.strip() != expected_value:
                return False
        else:
            return False

    if len(trigger) >= 4:
        required_parent = trigger[3]
        if required_parent and current_parent_loop_id != required_parent:
            return False

    if context:
        if context.startswith("inside_"):
            if current_parent_loop_id != context[7:]:
                return False
        elif context.startswith("after_"):
            # A sibling dependency implies it sits under the same parent
            pass 

    return True


def build_hierarchy(segments: list[Segment], transaction_type: str) -> list[Loop]:
    """Build a hierarchical loop structure from flat segments using a stack-based algorithm."""
    loop_defs = get_loop_defs(transaction_type)
    
    # Maintain a stack of (loop_id, loop_object, nesting_level) tuples
    stack: list[tuple[str, Loop, int]] = []
    loops: list[Loop] = []
    envelope_segments: list[Segment] = []

    envelope_ids = {"ISA", "IEA", "GS", "GE", "ST", "SE", "BHT"}

    for segment in segments:
        triggered_loop = None
        new_loop_level = 0
        new_loop_id = ""

        current_parent_loop_id = stack[-1][0] if stack else ""

        for loop_id, loop_def in loop_defs.items():
            context = loop_def.get("context", "")
            if matches_trigger(segment, loop_def["trigger"], current_parent_loop_id, context):
                triggered_loop = Loop(
                    loop_id=loop_id,
                    name=loop_def["name"],
                    segments=[segment],
                    children=[]
                )
                new_loop_level = loop_def.get("level", 1)
                new_loop_id = loop_id
                break

        if triggered_loop:
            while stack and stack[-1][2] >= new_loop_level:
                stack.pop()

            if stack:
                stack[-1][1].children.append(triggered_loop)
            else:
                loops.append(triggered_loop)

            stack.append((new_loop_id, triggered_loop, new_loop_level))
        elif segment.segment_id in envelope_ids:
            envelope_segments.append(segment)
        elif stack:
            stack[-1][1].segments.append(segment)
        else:
            envelope_segments.append(segment)

    # Prepend envelope as a virtual loop
    if envelope_segments:
        envelope_loop = Loop(
            loop_id="ENVELOPE",
            name="Interchange/Functional Group Envelope",
            segments=envelope_segments,
        )
        loops.insert(0, envelope_loop)

    return loops


def parse_edi(raw_content: str, file_name: str = "upload.edi") -> ParseResult:
    """
    Main entry point: parse a raw EDI string into a ParseResult.
    """
    if not raw_content or not raw_content.strip():
        return ParseResult(
            file_name=file_name,
            transaction_type="UNKNOWN",
            transaction_type_label="Empty file",
        )

    # 1. Detect delimiters
    elem_sep, sub_sep, seg_term = detect_delimiters(raw_content)

    # 2. Split into raw segments
    raw_segments = split_segments(raw_content, seg_term)

    # 3. Parse each segment
    segments: list[Segment] = []
    for i, raw_seg in enumerate(raw_segments):
        seg = parse_segment(raw_seg, elem_sep, line_number=i + 1)
        segments.append(seg)

    # 4. Identify transaction type
    tx_type, tx_label = identify_transaction_type(segments)

    # 5. Extract envelope metadata
    isa_control = ""
    sender_id = ""
    receiver_id = ""
    date = ""
    for seg in segments:
        if seg.segment_id == "ISA":
            if len(seg.elements) >= 13:
                isa_control = seg.elements[12].value.strip()
            if len(seg.elements) >= 6:
                sender_id = seg.elements[5].value.strip()
            if len(seg.elements) >= 8:
                receiver_id = seg.elements[7].value.strip()
            if len(seg.elements) >= 9:
                date = seg.elements[8].value.strip()
            break

    # 6. Build loop hierarchy
    loops = build_hierarchy(segments, tx_type)

    # 7. Segment Counts Calculation
    st_seg = next((s for s in segments if s.segment_id == "ST"), None)
    se_seg = next((s for s in reversed(segments) if s.segment_id == "SE"), None)
    
    transaction_segment_count = sum(
        1 for s in segments
        if st_seg and se_seg
        and st_seg.line_number <= s.line_number <= se_seg.line_number
    )

    result = ParseResult(
        transaction_type=tx_type,
        transaction_type_label=tx_label,
        file_name=file_name,
        interchange_control_number=isa_control,
        sender_id=sender_id,
        receiver_id=receiver_id,
        date=date,
        segment_count=len(segments),
        total_segment_count=len(segments),
        transaction_segment_count=transaction_segment_count,
        element_separator=elem_sep,
        segment_terminator=seg_term,
        sub_element_separator=sub_sep,
        loops=loops,
        raw_content=raw_content,
        segments=segments,
    )
    return result
