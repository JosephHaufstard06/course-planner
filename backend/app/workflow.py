import json
import re

from app.ai_client import ask_deepseek
from app.prompts import build_explanation_prompt


def _safe_json_loads(text: str):
    text = text.strip()

    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.S)
        if not match:
            return None
        return json.loads(match.group(0))


def explain_filtered_candidates(language: str, candidates: list[dict]):
    prompt = build_explanation_prompt(language, candidates)

    try:
        raw = ask_deepseek(prompt)
    except RuntimeError as exc:
        return {
            "status": "error",
            "explanations": [],
            "message": str(exc),
        }

    parsed = _safe_json_loads(raw)
    if not isinstance(parsed, dict):
        return {
            "status": "error",
            "explanations": [],
            "message": "AI returned invalid JSON.",
        }

    explanations = parsed.get("explanations", [])
    if not isinstance(explanations, list):
        explanations = []

    return {
        "status": "ok",
        "explanations": explanations,
        "message": parsed.get("message", "Explanation generated successfully."),
    }