"""
Google Gemini AI integration for contextual EDI chat and error explanations.
"""

from __future__ import annotations
import os
from parser.edi_types import ChatMessage

try:
    from google import genai
    from google.genai import types
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False


SYSTEM_PROMPT = """You are EDI ClaimGuard AI Assistant — an expert in US Healthcare EDI X12 transactions (HIPAA 5010).

You help users understand:
- X12 837P/837I (Healthcare Claims)
- X12 835 (Remittance Advice / Payment)
- X12 834 (Benefit Enrollment & Maintenance)

Your capabilities:
1. Explain EDI segments and elements in plain English
2. Clarify validation errors and suggest fixes
3. Decode CARC/RARC adjustment reason codes
4. Explain HIPAA 5010 compliance requirements
5. Help with claim denial analysis
6. Explain loop hierarchy and segment relationships

Rules:
- Always be specific and reference actual segment IDs (e.g., CLM, NM1, SV1)
- When explaining errors, mention the element index and expected format
- Keep responses concise but thorough
- If the user provides EDI context, reference specific data from their file
- Never fabricate segment data — only reference what's provided
"""


def configure_gemini():
    """Configure the Gemini API with the API key from environment."""
    if not GEMINI_AVAILABLE:
        return None

    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        return None

    try:
        client = genai.Client(api_key=api_key)
        return client
    except Exception:
        return None


async def chat_with_gemini(
    message: str,
    context: str | None = None,
    history: list[ChatMessage] | None = None,
) -> str:
    """
    Send a message to Gemini with optional EDI context.
    Returns the AI response text.
    """
    client = configure_gemini()

    if client is None:
        # Fallback response when Gemini is not available
        return generate_fallback_response(message, context)

    # Build the prompt with context
    prompt_parts = []

    if context:
        prompt_parts.append(f"## EDI File Context\n```\n{context[:3000]}\n```\n")

    if history:
        prompt_parts.append("## Conversation History")
        for msg in history[-5:]:  # Last 5 messages
            role = "User" if msg.role == "user" else "Assistant"
            prompt_parts.append(f"**{role}**: {msg.content}")

    prompt_parts.append(f"## Current Question\n{message}")

    full_prompt = "\n\n".join(prompt_parts)

    try:
        # Using gemini-2.5-pro as the more accurate model
        response = client.models.generate_content(
            model="gemini-2.5-pro",
            contents=full_prompt,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
            ),
        )
        return response.text
    except Exception as e:
        return f"AI service error: {str(e)}. Please check your GEMINI_API_KEY."


def generate_fallback_response(message: str, context: str | None = None) -> str:
    """Generate a helpful response without the AI API."""
    msg_lower = message.lower()

    if "837" in msg_lower or "claim" in msg_lower:
        return (
            "**837 (Healthcare Claim) Quick Guide:**\n\n"
            "The 837 transaction is used to submit healthcare claims. Key segments:\n"
            "- **CLM** — Claim information (patient account, charge amount, facility code)\n"
            "- **NM1*85** — Billing provider name & NPI\n"
            "- **NM1*IL** — Subscriber (patient) information\n"
            "- **SV1/SV2** — Service line details (CPT/HCPCS codes, charges)\n"
            "- **HI** — Diagnosis codes (ICD-10)\n"
            "- **DTP** — Date of service\n\n"
            "💡 *Set up GEMINI_API_KEY for detailed, context-aware answers.*"
        )
    elif "835" in msg_lower or "remittance" in msg_lower or "payment" in msg_lower:
        return (
            "**835 (Remittance Advice) Quick Guide:**\n\n"
            "The 835 transaction reports payment/adjustment details. Key segments:\n"
            "- **CLP** — Claim payment info (status, charged, paid amounts)\n"
            "- **SVC** — Service line payment details\n"
            "- **CAS** — Adjustments with CARC/RARC reason codes\n"
            "- **N1*PR** — Payer identification\n"
            "- **N1*PE** — Payee identification\n\n"
            "💡 *Set up GEMINI_API_KEY for detailed, context-aware answers.*"
        )
    elif "834" in msg_lower or "enrollment" in msg_lower or "member" in msg_lower:
        return (
            "**834 (Benefit Enrollment) Quick Guide:**\n\n"
            "The 834 transaction handles member enrollment/changes. Key segments:\n"
            "- **INS** — Member information (subscriber/dependent indicator)\n"
            "- **NM1*IL** — Member name\n"
            "- **DMG** — Demographics (DOB, gender)\n"
            "- **HD** — Health coverage details\n"
            "- **DTP** — Coverage dates\n"
            "- INS03 codes: 021 (Add), 001 (Change), 024 (Terminate)\n\n"
            "💡 *Set up GEMINI_API_KEY for detailed, context-aware answers.*"
        )
    elif "carc" in msg_lower or "rarc" in msg_lower or "denial" in msg_lower:
        return (
            "**CARC/RARC Code Reference:**\n\n"
            "**Common CARC codes:**\n"
            "- **1** — Deductible amount\n"
            "- **2** — Coinsurance amount\n"
            "- **3** — Co-payment amount\n"
            "- **16** — Lacks information / billing error\n"
            "- **45** — Charge exceeds fee schedule\n"
            "- **50** — Not medically necessary\n"
            "- **97** — Benefit included in another service\n"
            "- **197** — Missing precertification\n\n"
            "💡 *Set up GEMINI_API_KEY for code-specific explanations.*"
        )
    elif "npi" in msg_lower:
        return (
            "**NPI (National Provider Identifier) Info:**\n\n"
            "- 10-digit number assigned to healthcare providers\n"
            "- Validated using the Luhn algorithm (with 80840 prefix)\n"
            "- Found in NM109 when NM108 = 'XX'\n"
            "- Verify at: https://npiregistry.cms.hhs.gov/\n\n"
            "💡 *Set up GEMINI_API_KEY for detailed NPI lookups.*"
        )
    else:
        return (
            "**EDI ClaimGuard AI Assistant**\n\n"
            "I can help you with:\n"
            "- 📋 Understanding 837P/837I claims\n"
            "- 💰 Decoding 835 remittance/payments\n"
            "- 👤 Explaining 834 enrollment data\n"
            "- 🔍 Interpreting CARC/RARC denial codes\n"
            "- ✅ Understanding validation errors\n\n"
            "Try asking about a specific segment, error, or transaction type!\n\n"
            "💡 *For AI-powered answers, set the GEMINI_API_KEY environment variable.*"
        )
