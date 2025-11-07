import requests
import re

GEMINI_API_KEY = "YOUR_KEY"
MODEL = "gemini-2.5-flash"

def looks_like_foreign(text: str):
    """
    Nếu chuỗi KHÔNG có dấu tiếng Việt → coi như tiếng nước ngoài.
    """
    return not bool(re.search(r"[àáạảãâấầậẩẫăằắặẳẵèéẹẻẽêềếệểễ"
                              r"ìíịỉĩòóọỏõôồốộổỗơờớợởỡ"
                              r"ùúụủũưừứựửữỳýỵỷỹđ]", text.lower()))

def gemini_fix_query(query: str):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"

    if looks_like_foreign(query):
        prompt = (
            "Convert this to a correct Vietnamese noun phrase. "
            "NO explanation. NO sentences. Only output the final phrase. "
            f"Input: {query}"
        )
    else:
        prompt = (
            "Fix spelling for this Vietnamese search term. "
            "Do NOT translate. Return only the corrected noun phrase. "
            f"Input: {query}"
        )

    data = {"contents": [{"parts": [{"text": prompt}]}]}
    headers = {"Content-Type": "application/json"}
    params = {"key": GEMINI_API_KEY}

    try:
        response = requests.post(url, headers=headers, json=data, params=params, timeout=5)
        res = response.json()

        # ------ CHECK AN TOÀN ------
        if (
            response.status_code != 200 or 
            "candidates" not in res or 
            not res["candidates"] or 
            "content" not in res["candidates"][0] or 
            not res["candidates"][0]["content"]["parts"]
        ):
            print(f"⚠️ API cấu trúc lạ, dùng query gốc: {query}")
            return query

        text = res["candidates"][0]["content"]["parts"][0].get("text", "").strip()

        if not text:
            print("⚠️ Gemini trả về rỗng, dùng query gốc")
            return query

        # Làm sạch
        text = text.replace('"', '').strip()

        # Nếu AI trả dạng câu dài → lấy cụm cuối
        # Ví dụ: "Here is the corrected phrase: bánh mì"
        if ":" in text:
            tmp = text.split(":")[-1].strip()
            if len(tmp.split()) <= 4:   # chỉ 1 cụm ngắn → đúng nghĩa
                text = tmp

        print("✅ Gemini fixed:", text)
        return text

    except requests.exceptions.Timeout:
        print("⚠️ Timeout — dùng query gốc:", query)
        return query

    except Exception as e:
        print(f"⚠️ Lỗi ({type(e).__name__}) — dùng query gốc")
        return query