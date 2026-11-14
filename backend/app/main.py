import os
from typing import Any, Dict, List
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = OpenAI(
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    base_url="https://api.deepseek.com"
)

def sanitize_candidate(raw: Dict[str, Any]) -> Dict[str, Any]:
    code = str(raw.get("code") or "").strip()
    title = str(raw.get("title") or "").strip()
    section = str(raw.get("section") or "").strip()
    reasons = raw.get("reasons") or []
    needs_confirmation = raw.get("needs_confirmation") or []

    safe_reasons: List[str] = []
    for item in reasons:
        if item is None:
            continue
        safe_reasons.append(str(item).strip())

    safe_needs: List[str] = []
    for item in needs_confirmation:
        if item is None:
            continue
        safe_needs.append(str(item).strip())

    return {
        "code": code,
        "title": title,
        "section": section,
        "reasons": safe_reasons,
        "needs_confirmation": safe_needs,
    }

def build_prompt(candidate: Dict[str, Any]) -> str:
    code = candidate.get("code", "")
    title = candidate.get("title", "")
    section = candidate.get("section", "")
    reasons = candidate.get("reasons") or []
    needs = candidate.get("needs_confirmation") or []

    reasons_text = "\n".join(f"- {r}" for r in reasons) if reasons else "- No extra reasons"
    needs_text = ", ".join(needs) if needs else "None"

    return f"""
You are helping a student choose courses.

Course:
- code: {code}
- title: {title}
- chosen section: {section}

Why this course is recommended:
{reasons_text}

Needs confirmation:
{needs_text}

Write a concise explanation in English for why this course is a good fit.
Keep it to 2-4 sentences, clear and student-friendly.
"""

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/api/explain-candidates")
async def explain_candidates(payload: Dict[str, Any]):
    candidates = payload.get("candidates") or []
    if not isinstance(candidates, list):
        return {"status": "error", "explanations": [], "message": "candidates must be a list"}

    safe_candidates = [sanitize_candidate(c) for c in candidates]

    explanations = []
    for c in safe_candidates:
        if not c["code"]:
            continue

        prompt = build_prompt(c)

        try:
            response = client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a helpful academic advisor. Explain course fit clearly in English."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.4,
                max_tokens=220
            )

            summary = response.choices[0].message.content.strip()
            explanations.append({
                "code": c["code"],
                "title": c["title"],
                "section": c["section"],
                "english_summary": summary,
                "reasons": c["reasons"],
                "needs_confirmation": c["needs_confirmation"]
            })

        except Exception as e:
            explanations.append({
                "code": c["code"],
                "title": c["title"],
                "section": c["section"],
                "english_summary": f"AI explanation unavailable: {str(e)}",
                "reasons": c["reasons"],
                "needs_confirmation": c["needs_confirmation"]
            })

    return {
        "status": "ok",
        "explanations": explanations,
        "message": "The selected course candidate is explained below."
    }