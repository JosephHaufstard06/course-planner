from pydantic import BaseModel, Field


class CandidateContext(BaseModel):
    code: str
    title: str
    section: str
    reasons: list[str] = Field(default_factory=list)
    needs_confirmation: list[str] = Field(default_factory=list)


class ExplanationRequest(BaseModel):
    language: str = "en"
    candidates: list[CandidateContext] = Field(default_factory=list)


class ExplanationItem(BaseModel):
    code: str
    title: str
    section: str
    english_summary: str
    reasons: list[str] = Field(default_factory=list)
    needs_confirmation: list[str] = Field(default_factory=list)


class ExplanationResponse(BaseModel):
    status: str
    explanations: list[ExplanationItem] = Field(default_factory=list)
    message: str