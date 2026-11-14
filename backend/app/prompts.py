import json


def build_explanation_prompt(language: str, candidates: list[dict]) -> str:
    candidate_data = json.dumps(candidates, ensure_ascii=False, indent=2)

    return f"""
You are a careful academic advising assistant.

Your job is to explain the selected course candidates in {language.upper()} only.

Important rules:
1. Only explain the provided candidates.
2. Do not invent other courses.
3. Keep the course code, title, and section names exactly as provided.
4. Do not output Chinese text if the requested language is English.
5. Return only valid JSON.
6. Do not use markdown fences.

Input candidates:
{candidate_data}

Output format:
{{
  "explanations": [
    {{
      "code": "course code",
      "title": "course title",
      "section": "section label",
      "english_summary": "short English explanation",
      "reasons": ["English reason 1", "English reason 2"],
      "needs_confirmation": ["English confirmation note 1"]
    }}
  ],
  "message": "Short English summary"
}}
"""