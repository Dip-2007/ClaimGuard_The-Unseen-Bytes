"""
EDI ClaimGuard — FastAPI Backend
US Healthcare EDI Parser & X12 File Validator (837/835/834)
"""

from __future__ import annotations
import io
import json
import zipfile
from typing import Optional, List
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from contextlib import asynccontextmanager
import httpx

from parser.x12_parser import parse_edi
from parser.edi_types import (
    UploadResponse, ChatRequest, ChatResponse,
    FixRequest, FixResponse, ExportRequest,
    BatchResponse, BatchFileResult,
    RemittanceSummary, EnrollmentSummary,
    ValidationResult,
)
from validator.rule_engine import validate_edi, CARC_CODES, RARC_CODES
from fixer.auto_fix import apply_fix, apply_all_fixes
from ai.gemini_chat import chat_with_gemini
from utils.npi_validator import lookup_npi

from db.database import connect_db, close_db, get_db, configure_cloudinary, upload_to_cloudinary
from auth.auth_utils import get_current_user
from auth.auth_routes import router as auth_router
from db.models import ActivityItem, HistoryResponse

# ── App Lifecycle ──────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    await connect_db()
    configure_cloudinary()
    yield
    await close_db()


# ── App Setup ──────────────────────────────────────────────────────────

app = FastAPI(
    title="EDI ClaimGuard API",
    description="AI-Powered US Healthcare X12 EDI Parser & Validator",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include auth routes
app.include_router(auth_router, prefix="/api/auth")


# ── Health Check ───────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "name": "EDI ClaimGuard API",
        "version": "1.0.0",
        "status": "running",
        "endpoints": [
            "/api/upload",
            "/api/upload-batch",
            "/api/fix",
            "/api/fix-all",
            "/api/chat",
            "/api/validate-npi/{npi}",
            "/api/export",
            "/api/remittance-summary",
            "/api/enrollment-summary",
            "/api/carc-codes",
            "/api/rarc-codes",
            "/api/samples",
        ],
    }


# ── Upload & Parse ─────────────────────────────────────────────────────

@app.post("/api/upload", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    current_user: Optional[dict] = Depends(get_current_user),
):
    """Upload a single EDI file — auto-detect, parse, and validate."""
    try:
        content = await file.read()
        raw = content.decode("utf-8", errors="replace")
    except Exception as e:
        raise HTTPException(400, f"Could not read file: {str(e)}")

    # Parse
    parse_result = parse_edi(raw, file.filename or "upload.edi")

    # Validate
    validation = validate_edi(parse_result)

    # Track activity for authenticated users
    if current_user:
        db = get_db()
        try:
            # Upload to Cloudinary
            cloud_result = upload_to_cloudinary(content, file.filename or "upload.edi")
            cloudinary_url = cloud_result.get("url", "")
        except Exception as e:
            print(f"Cloudinary upload failed: {e}")
            cloudinary_url = ""

        await db.activities.insert_one({
            "user_id": current_user["sub"],
            "type": "upload",
            "title": f"Parsed {parse_result.transaction_type_label}",
            "description": f"File: {file.filename or 'upload.edi'} — {validation.error_count} errors, {validation.warning_count} warnings",
            "file_name": file.filename or "upload.edi",
            "transaction_type": parse_result.transaction_type,
            "cloudinary_url": cloudinary_url,
            "raw_content": raw,
            "error_count": validation.error_count,
            "warning_count": validation.warning_count,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    return UploadResponse(
        success=True,
        message=f"Successfully parsed {parse_result.transaction_type_label}",
        file_name=file.filename or "upload.edi",
        transaction_type=parse_result.transaction_type,
        transaction_type_label=parse_result.transaction_type_label,
        parse_result=parse_result,
        validation_result=validation,
    )


@app.post("/api/upload-batch", response_model=BatchResponse)
async def upload_batch(file: UploadFile = File(...)):
    """Upload a ZIP of EDI files — process all and return consolidated results."""
    try:
        content = await file.read()
        zip_buffer = io.BytesIO(content)
    except Exception as e:
        raise HTTPException(400, f"Could not read ZIP file: {str(e)}")

    if not zipfile.is_zipfile(zip_buffer):
        raise HTTPException(400, "Uploaded file is not a valid ZIP archive")

    results = []
    zip_buffer.seek(0)

    with zipfile.ZipFile(zip_buffer) as zf:
        for name in zf.namelist():
            # Skip directories and hidden files
            if name.endswith("/") or name.startswith("__"):
                continue

            try:
                raw = zf.read(name).decode("utf-8", errors="replace")
                parse_result = parse_edi(raw, name)
                validation = validate_edi(parse_result)

                results.append(BatchFileResult(
                    file_name=name,
                    upload_response=UploadResponse(
                        success=True,
                        message=f"Parsed {parse_result.transaction_type_label}",
                        file_name=name,
                        transaction_type=parse_result.transaction_type,
                        transaction_type_label=parse_result.transaction_type_label,
                        parse_result=parse_result,
                        validation_result=validation,
                    ),
                ))
            except Exception as e:
                results.append(BatchFileResult(
                    file_name=name,
                    upload_response=UploadResponse(
                        success=False,
                        message=f"Error processing {name}: {str(e)}",
                        file_name=name,
                    ),
                ))

    return BatchResponse(
        success=True,
        total_files=len(results),
        processed=len(results),
        results=results,
    )


# ── Fix ────────────────────────────────────────────────────────────────

@app.post("/api/fix", response_model=FixResponse)
async def fix_error(request: FixRequest):
    """Apply a single fix to the EDI content."""
    import logging
    logger = logging.getLogger("fix")
    logger.info(f"FIX REQUEST: error_id={request.error_id}, fix_value='{request.fix_value}', "
                f"line={request.line_number}, elem={request.element_index}")
    logger.info(f"RAW CONTENT length={len(request.raw_content)}, first 200 chars: {request.raw_content[:200]}")

    corrected, message = apply_fix(
        request.raw_content, request.error_id, request.fix_value,
        target_line=request.line_number, target_elem=request.element_index,
    )

    content_changed = corrected != request.raw_content
    logger.info(f"FIX RESULT: content_changed={content_changed}, message='{message}'")

    # Re-validate
    parse_result = parse_edi(corrected)
    validation = validate_edi(parse_result)
    
    logger.info(f"POST-FIX VALIDATION: errors={validation.error_count}, warnings={validation.warning_count}")

    return FixResponse(
        success=True,
        corrected_content=corrected,
        message=message,
        validation_result=validation,
        parse_result=parse_result,
    )


@app.post("/api/fix-all", response_model=FixResponse)
async def fix_all_errors(request: ExportRequest):
    """Apply all auto-fixable corrections."""
    corrected, messages = apply_all_fixes(request.raw_content)

    # Re-validate
    parse_result = parse_edi(corrected)
    validation = validate_edi(parse_result)

    return FixResponse(
        success=True,
        corrected_content=corrected,
        message=" | ".join(messages) if messages else "No auto-fixable errors found",
        validation_result=validation,
        parse_result=parse_result,
    )


@app.post("/api/validate-raw", response_model=FixResponse)
async def validate_raw_content(request: ExportRequest):
    """Re-validate raw EDI content directly provided by the user."""
    parse_result = parse_edi(request.raw_content)
    validation = validate_edi(parse_result)

    return FixResponse(
        success=True,
        corrected_content=request.raw_content,
        message="Manual edits re-validated successfully",
        validation_result=validation,
        parse_result=parse_result,
    )


# ── AI Chat ────────────────────────────────────────────────────────────

@app.post("/api/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    current_user: Optional[dict] = Depends(get_current_user),
):
    """AI chat endpoint — contextual Q&A about EDI files."""
    try:
        reply = await chat_with_gemini(
            message=request.message,
            context=request.context,
            history=request.history,
        )

        # Track chat activity for authenticated users
        if current_user:
            db = get_db()
            short_msg = request.message[:80] + ("..." if len(request.message) > 80 else "")
            await db.activities.insert_one({
                "user_id": current_user["sub"],
                "type": "chat",
                "title": f"Chat: {short_msg}",
                "description": reply[:120] + ("..." if len(reply) > 120 else ""),
                "message": request.message,
                "reply": reply,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })

        return ChatResponse(reply=reply)
    except Exception as e:
        return ChatResponse(
            reply="",
            error=f"Chat error: {str(e)}",
        )


# ── NPI Validation ─────────────────────────────────────────────────────

@app.get("/api/validate-npi/{npi}")
async def validate_npi(npi: str):
    """Validate an NPI via Luhn check and CMS NPPES lookup."""
    result = await lookup_npi(npi)
    return result


# ── Export ─────────────────────────────────────────────────────────────

@app.post("/api/export")
async def export_data(request: ExportRequest):
    """Export parsed EDI data in various formats."""
    parse_result = parse_edi(request.raw_content)
    validation = validate_edi(parse_result)

    if request.format == "json":
        return JSONResponse(content={
            "parse_result": parse_result.model_dump(),
            "validation_result": validation.model_dump(),
        })
    elif request.format == "edi":
        return Response(
            content=request.raw_content,
            media_type="text/plain",
            headers={"Content-Disposition": "attachment; filename=corrected.edi"},
        )
    elif request.format == "csv":
        # CSV of validation errors
        lines = ["Error ID,Severity,Segment,Element,Message,Suggestion"]
        for err in validation.errors:
            lines.append(
                f'"{err.error_id}","{err.severity}","{err.segment_id}",'
                f'"{err.element_index}","{err.message}","{err.suggestion}"'
            )
        return Response(
            content="\n".join(lines),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=errors.csv"},
        )
    else:
        raise HTTPException(400, f"Unsupported format: {request.format}")


# ── 835 Remittance Summary ─────────────────────────────────────────────

@app.post("/api/remittance-summary", response_model=RemittanceSummary)
async def get_remittance_summary(request: ExportRequest):
    """Generate 835 remittance summary with CARC/RARC decode."""
    parse_result = parse_edi(request.raw_content)

    if parse_result.transaction_type != "835":
        raise HTTPException(400, "File is not an 835 (Remittance Advice)")

    total_charged = 0.0
    total_paid = 0.0
    total_adjusted = 0.0
    claims = []
    adjustments = []

    current_claim = None

    for seg in parse_result.segments:
        if seg.segment_id == "CLP":
            if current_claim:
                claims.append(current_claim)

            claim_id = seg.elements[0].value if len(seg.elements) > 0 else ""
            status = seg.elements[1].value if len(seg.elements) > 1 else ""
            charged = float(seg.elements[2].value) if len(seg.elements) > 2 else 0
            paid = float(seg.elements[3].value) if len(seg.elements) > 3 else 0

            status_labels = {
                "1": "Processed as Primary",
                "2": "Processed as Secondary",
                "3": "Processed as Tertiary",
                "4": "Denied",
                "19": "Processed as Primary, Forwarded",
                "22": "Reversal of Previous Payment",
            }

            current_claim = {
                "claim_id": claim_id,
                "status": status,
                "status_label": status_labels.get(status, f"Status {status}"),
                "charged": charged,
                "paid": paid,
                "adjustments": [],
            }
            total_charged += charged
            total_paid += paid

        elif seg.segment_id == "CAS" and current_claim:
            group = seg.elements[0].value if len(seg.elements) > 0 else ""
            reason = seg.elements[1].value if len(seg.elements) > 1 else ""
            amount = float(seg.elements[2].value) if len(seg.elements) > 2 else 0

            group_labels = {
                "CO": "Contractual Obligation",
                "PR": "Patient Responsibility",
                "OA": "Other Adjustment",
                "PI": "Payer Initiated",
                "CR": "Correction/Reversal",
            }

            adj = {
                "group_code": group,
                "group_label": group_labels.get(group, group),
                "reason_code": reason,
                "reason_description": CARC_CODES.get(reason, f"Code {reason}"),
                "amount": amount,
            }
            current_claim["adjustments"].append(adj)
            adjustments.append(adj)
            total_adjusted += amount

    if current_claim:
        claims.append(current_claim)

    total_denied = sum(
        c["charged"] for c in claims if c["status"] == "4"
    )

    return RemittanceSummary(
        total_charged=total_charged,
        total_paid=total_paid,
        total_adjusted=total_adjusted,
        total_denied=total_denied,
        claims=claims,
        adjustments=adjustments,
    )


# ── 834 Enrollment Summary ────────────────────────────────────────────

@app.post("/api/enrollment-summary", response_model=EnrollmentSummary)
async def get_enrollment_summary(request: ExportRequest):
    """Generate 834 enrollment summary with member details."""
    parse_result = parse_edi(request.raw_content)

    if parse_result.transaction_type != "834":
        raise HTTPException(400, "File is not an 834 (Benefit Enrollment)")

    members = []
    current_member = None

    maintenance_labels = {
        "001": "Change",
        "002": "Delete",
        "021": "Addition",
        "024": "Cancellation/Termination",
        "025": "Reinstatement",
        "026": "Correction",
        "030": "Audit/Compare",
        "032": "Employee Info Only",
    }

    for seg in parse_result.segments:
        if seg.segment_id == "INS":
            if current_member:
                members.append(current_member)

            is_subscriber = seg.elements[0].value == "Y" if len(seg.elements) > 0 else False
            maint_code = seg.elements[2].value if len(seg.elements) > 2 else ""

            current_member = {
                "is_subscriber": is_subscriber,
                "relationship": seg.elements[1].value if len(seg.elements) > 1 else "",
                "maintenance_type": maint_code,
                "maintenance_label": maintenance_labels.get(maint_code, maint_code),
                "name": "",
                "dob": "",
                "gender": "",
                "address": "",
                "city": "",
                "state": "",
                "zip": "",
                "coverage": "",
                "effective_date": "",
            }

        elif seg.segment_id == "NM1" and current_member:
            if len(seg.elements) >= 3:
                qualifier = seg.elements[0].value
                if qualifier == "IL":
                    last = seg.elements[2].value if len(seg.elements) > 2 else ""
                    first = seg.elements[3].value if len(seg.elements) > 3 else ""
                    middle = seg.elements[4].value if len(seg.elements) > 4 else ""
                    current_member["name"] = f"{first} {middle} {last}".strip()

        elif seg.segment_id == "DMG" and current_member:
            if len(seg.elements) >= 2:
                current_member["dob"] = seg.elements[1].value
            if len(seg.elements) >= 3:
                gender_map = {"M": "Male", "F": "Female", "U": "Unknown"}
                current_member["gender"] = gender_map.get(
                    seg.elements[2].value, seg.elements[2].value
                )

        elif seg.segment_id == "N3" and current_member:
            if len(seg.elements) >= 1:
                current_member["address"] = seg.elements[0].value

        elif seg.segment_id == "N4" and current_member:
            if len(seg.elements) >= 1:
                current_member["city"] = seg.elements[0].value
            if len(seg.elements) >= 2:
                current_member["state"] = seg.elements[1].value
            if len(seg.elements) >= 3:
                current_member["zip"] = seg.elements[2].value

        elif seg.segment_id == "HD" and current_member:
            if len(seg.elements) >= 4:
                current_member["coverage"] = seg.elements[3].value

        elif seg.segment_id == "DTP" and current_member:
            if len(seg.elements) >= 3:
                qualifier = seg.elements[0].value
                if qualifier in ("348", "349"):
                    current_member["effective_date"] = seg.elements[2].value

    if current_member:
        members.append(current_member)

    additions = sum(1 for m in members if m["maintenance_type"] == "021")
    changes = sum(1 for m in members if m["maintenance_type"] == "001")
    terminations = sum(1 for m in members if m["maintenance_type"] == "024")

    return EnrollmentSummary(
        total_members=len(members),
        additions=additions,
        changes=changes,
        terminations=terminations,
        members=members,
    )


# ── Reference Data ─────────────────────────────────────────────────────

@app.get("/api/carc-codes")
async def get_carc_codes():
    """Get all known CARC codes."""
    return CARC_CODES


@app.get("/api/rarc-codes")
async def get_rarc_codes():
    """Get all known RARC codes."""
    return RARC_CODES


# ── Sample Files ───────────────────────────────────────────────────────

@app.get("/api/samples")
async def list_samples():
    """List available sample EDI files."""
    return {
        "samples": [
            {"name": "sample_837p.edi", "type": "837P", "description": "Professional Claim"},
            {"name": "sample_835.edi", "type": "835", "description": "Remittance Advice"},
            {"name": "sample_834.edi", "type": "834", "description": "Benefit Enrollment"},
        ]
    }


@app.get("/api/samples/{filename}")
async def get_sample(filename: str):
    """Get a sample EDI file content."""
    import os
    samples_dir = os.path.join(os.path.dirname(__file__), "samples")
    filepath = os.path.join(samples_dir, filename)

    if not os.path.exists(filepath):
        raise HTTPException(404, f"Sample file '{filename}' not found")

    with open(filepath, "r") as f:
        content = f.read()

    return {"filename": filename, "content": content}

@app.get("/api/fetch-cloudinary")
async def fetch_cloudinary(url: str, current_user: dict = Depends(get_current_user)):
    """Fetch file directly from Cloudinary server-side to bypass browser CORS block."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            response.raise_for_status()
            return Response(content=response.text, media_type="text/plain")
    except Exception as e:
        raise HTTPException(400, f"Error fetching from Cloudinary: {str(e)}")


# ── User History ───────────────────────────────────────────────────────

@app.get("/api/history", response_model=HistoryResponse)
async def get_history(current_user: dict = Depends(get_current_user)):
    """Get the authenticated user's activity history."""
    if not current_user:
        return HistoryResponse(activities=[], total=0)

    db = get_db()
    cursor = db.activities.find(
        {"user_id": current_user["sub"]}
    ).sort("created_at", -1).limit(100)

    activities = []
    async for doc in cursor:
        activities.append(ActivityItem(
            id=str(doc["_id"]),
            type=doc["type"],
            title=doc["title"],
            description=doc.get("description", ""),
            timestamp=doc.get("created_at", ""),
            metadata={
                k: v for k, v in doc.items()
                if k not in ("_id", "user_id", "type", "title", "description", "created_at")
            },
        ))

    return HistoryResponse(activities=activities, total=len(activities))

@app.get("/api/download-activity/{activity_id}")
async def download_activity(activity_id: str, current_user: dict = Depends(get_current_user)):
    """Download the raw EDI file directly from the cloud database."""
    if not current_user:
        raise HTTPException(401, "Not authenticated")
        
    db = get_db()
    from bson.objectid import ObjectId
    try:
        activity = await db.activities.find_one({"_id": ObjectId(activity_id), "user_id": current_user["sub"]})
        if not activity or "raw_content" not in activity:
            raise HTTPException(404, "File content not found in cloud database")
            
        filename = activity.get("file_name", "download.edi")
        return Response(
            content=activity["raw_content"],
            media_type="text/plain",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    except Exception as e:
        raise HTTPException(400, f"Download error: {str(e)}")


@app.get("/api/user/chats")
async def get_user_chats(current_user: dict = Depends(get_current_user)):
    """Get the authenticated user's saved chat sessions."""
    if not current_user:
        return {"sessions": []}

    db = get_db()
    cursor = db.chats.find(
        {"user_id": current_user["sub"]}
    ).sort("updated_at", -1).limit(50)

    sessions = []
    async for doc in cursor:
        sessions.append({
            "id": str(doc["_id"]),
            "title": doc.get("title", ""),
            "messages": doc.get("messages", []),
            "filter_tag": doc.get("filter_tag", "All"),
            "attached_file_name": doc.get("attached_file_name"),
            "created_at": doc.get("created_at", ""),
            "updated_at": doc.get("updated_at", ""),
        })

    return {"sessions": sessions}


@app.post("/api/user/chats")
async def save_user_chat(
    body: dict,
    current_user: dict = Depends(get_current_user),
):
    """Save or update a chat session for the authenticated user."""
    if not current_user:
        return {"success": False, "message": "Login required to save chats"}

    db = get_db()
    now = datetime.now(timezone.utc).isoformat()

    chat_doc = {
        "user_id": current_user["sub"],
        "title": body.get("title", "Untitled"),
        "messages": body.get("messages", []),
        "filter_tag": body.get("filter_tag", "All"),
        "attached_file_name": body.get("attached_file_name"),
        "updated_at": now,
    }

    session_id = body.get("session_id")
    if session_id:
        from bson import ObjectId
        await db.chats.update_one(
            {"_id": ObjectId(session_id), "user_id": current_user["sub"]},
            {"$set": chat_doc},
        )
        return {"success": True, "id": session_id}
    else:
        chat_doc["created_at"] = now
        result = await db.chats.insert_one(chat_doc)
        return {"success": True, "id": str(result.inserted_id)}


# ── Main ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
