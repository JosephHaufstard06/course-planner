import os

from openai import APIConnectionError, APIStatusError, OpenAI


def ask_deepseek(prompt: str) -> str:
    api_key = os.getenv("DEEPSEEK_API_KEY")
    if not api_key:
        raise RuntimeError("Hvaen't set DEEPSEEK_API_KEY")

    client = OpenAI(
        api_key=api_key,
        base_url="https://api.deepseek.com",
        timeout=60.0,
    )

    
    model = os.getenv("DEEPSEEK_MODEL", "deepseek-flash")

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": "You are a rigorous student course selection matching assistant.You can only answer according to the information provided by the user.",
                },
                {"role": "user", "content": prompt},
            ],
            stream=False,
        )
    except APIStatusError as exc:
        raise RuntimeError(
            f"DeepSeek API returns fault，HTTP {exc.status_code}。"
        ) from exc
    except APIConnectionError as exc:
        raise RuntimeError("connecting DeepSeek API failed，please check the internet") from exc

    text = response.choices[0].message.content
    if not text:
        raise RuntimeError("DeepSeek returned empty content")

    return text