"""
Pydantic data models for EDI X12 parsing.
"""

from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field


class Element(BaseModel):
    """Single data element within a segment."""
    index: int
    value: str
    description: str = ""


class Segment(BaseModel):
    """An EDI segment (e.g., ISA, GS, ST, CLM, etc.)."""
    segment_id: str
    elements: list[Element] = []
    raw: str = ""
    line_number: int = 0


class Loop(BaseModel):
    """A hierarchical loop containing segments and child loops."""
    loop_id: str
    name: str = ""
    segments: list[Segment] = []
    children: list[Loop] = []


class ParseResult(BaseModel):
    """Complete result of parsing an EDI file."""
    transaction_type: str = ""          # 837P, 837I, 835, 834
    transaction_type_label: str = ""    # Human-readable label
    file_name: str = ""
    interchange_control_number: str = ""
    sender_id: str = ""
    receiver_id: str = ""
    date: str = ""
    segment_count: int = 0
    element_separator: str = "*"
    segment_terminator: str = "~"
    sub_element_separator: str = ":"
    loops: list[Loop] = []
    raw_content: str = ""
    segments: list[Segment] = []        # Flat list of all segments
    total_segment_count: int = 0
    transaction_segment_count: int = 0


class ValidationError(BaseModel):
    """A single validation error."""
    error_id: str = ""
    severity: str = "error"             # error, warning, info
    segment_id: str = ""
    element_index: int = -1
    loop_location: str = ""
    line_number: int = 0
    message: str = ""
    suggestion: str = ""
    fixable: bool = False
    fix_value: str = ""


class ValidationResult(BaseModel):
    """Complete validation result."""
    is_valid: bool = True
    error_count: int = 0
    warning_count: int = 0
    info_count: int = 0
    errors: list[ValidationError] = []


class UploadResponse(BaseModel):
    """Response returned after uploading and processing an EDI file."""
    success: bool = True
    message: str = ""
    file_name: str = ""
    transaction_type: str = ""
    transaction_type_label: str = ""
    parse_result: Optional[ParseResult] = None
    validation_result: Optional[ValidationResult] = None
    activity_id: Optional[str] = None


class ChatMessage(BaseModel):
    """A chat message."""
    role: str = "user"
    content: str = ""


class ChatRequest(BaseModel):
    """Request for AI chat."""
    message: str
    context: Optional[str] = None
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    """Response from AI chat."""
    reply: str = ""
    error: Optional[str] = None


class FixRequest(BaseModel):
    """Request to apply a fix."""
    error_id: str
    fix_value: str
    raw_content: str
    line_number: int = 0
    element_index: int = -1


class FixResponse(BaseModel):
    """Response after applying a fix."""
    success: bool = True
    corrected_content: str = ""
    message: str = ""
    validation_result: Optional[ValidationResult] = None
    parse_result: Optional[ParseResult] = None
    activity_id: Optional[str] = None


class ExportRequest(BaseModel):
    """Request to export parsed data."""
    raw_content: str
    format: str = "json"  # json, edi, csv


class BatchFileResult(BaseModel):
    """Result for a single file in batch processing."""
    file_name: str
    upload_response: UploadResponse


class BatchResponse(BaseModel):
    """Response for batch ZIP upload."""
    success: bool = True
    total_files: int = 0
    processed: int = 0
    results: list[BatchFileResult] = []


class RemittanceSummary(BaseModel):
    """835 remittance summary."""
    total_charged: float = 0.0
    total_paid: float = 0.0
    total_adjusted: float = 0.0
    total_denied: float = 0.0
    claims: list[dict] = []
    adjustments: list[dict] = []


class EnrollmentSummary(BaseModel):
    """834 enrollment summary."""
    total_members: int = 0
    additions: int = 0
    changes: int = 0
    terminations: int = 0
    members: list[dict] = []


class SaveResolvedRequest(BaseModel):
    """Request to save a resolved (fixed) file to history."""
    activity_id: str
    raw_content: str
    file_name: str
