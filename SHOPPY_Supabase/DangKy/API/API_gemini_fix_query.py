import os
import requests
import re
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MODEL = "gemini-2.5-flash"

# Supabase
DATA_BASE_SECRET_KEY_SUPABASE = os.getenv("DATA_BASE_SECRET_KEY_SUPABASE")
DATA_BASE_URL_SUPABASE = os.getenv("DATA_BASE_URL_SUPABASE")

url = DATA_BASE_URL_SUPABASE
key = DATA_BASE_SECRET_KEY_SUPABASE
supabase: Client = create_client(url, key)

def fetch_product_names():
    """Lấy danh sách tên product từ Supabase"""
    try:
        response = supabase.table("product").select("name").execute()
        rows = response.data
        if not rows:
            print("⚠️ Dữ liệu rỗng từ Supabase")
            return []

        names = {row["name"].strip() for row in rows if row.get("name")}
        return list(names)

    except Exception as e:
        print(f"⚠️ Exception fetch_product_names: {e}")
        return []


PRODUCTS = fetch_product_names()
PRODUCT_SCOPE = ", ".join(PRODUCTS)

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
            "Extract and match the Vietnamese product name from the input sentence. "
            "Find ALL relevant products from the list below based on the user's intent.\n"
            f"Input: {query}\n\n"
            f"VALID PRODUCTS: {PRODUCT_SCOPE}\n\n"
            "Rules:\n"
            "1. Match partial words to full product names (e.g., 'bún' → list all dishes with 'bún', 'cơm' → list all dishes with 'cơm').\n"
            "2. If the input is GENERAL (like 'món cơm', 'món bún'), return ALL matching products separated by commas.\n"
            "3. If the input is SPECIFIC (like 'bún chả', 'cơm tấm'), return only that exact product.\n"
            "4. Return ONLY product names from the list, nothing else.\n"
            "5. Do NOT add explanations or extra words."
        )
    else:
        prompt = (
            "Fix spelling and match the Vietnamese product name from the input sentence. "
            "Find ALL relevant products from the list below based on the user's intent.\n"
            f"Input: {query}\n\n"
            f"VALID PRODUCTS: {PRODUCT_SCOPE}\n\n"
            "Rules:\n"
            "1. Fix any spelling mistakes first.\n"
            "2. Match partial words to full product names (e.g., 'bún' → list all dishes with 'bún', 'cơm' → list all dishes with 'cơm').\n"
            "3. If the input is GENERAL (like 'món cơm', 'món bún'), return ALL matching products separated by commas.\n"
            "4. If the input is SPECIFIC (like 'bún chả', 'cơm tấm'), return only that exact product.\n"
            "5. Return ONLY product names from the list, nothing else.\n"
            "6. Do NOT add explanations or extra words."
        )

    data = {
        "contents": [{"parts": [{"text": prompt}]}],
        "safetySettings": [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"}
        ]
    }
    headers = {"Content-Type": "application/json"}
    params = {"key": GEMINI_API_KEY}

    try:
        response = requests.post(url, headers=headers, json=data, params=params, timeout=10)
        
        # Debug response
        print(f"🔍 Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"⚠️ API error {response.status_code}: {response.text}")
            return query
        
        res = response.json()
        print(f"🔍 Full response: {res}")

        # Kiểm tra cấu trúc response
        if "candidates" not in res or not res["candidates"]:
            print("⚠️ Không có candidates trong response")
            return query

        candidate = res["candidates"][0]
        
        # Kiểm tra finish reason
        finish_reason = candidate.get("finishReason", "")
        if finish_reason and finish_reason != "STOP":
            print(f"⚠️ Finish reason: {finish_reason} (có thể bị chặn bởi safety filter)")
            return query
        
        # Kiểm tra content
        if "content" not in candidate:
            print("⚠️ Không có content trong candidate")
            return query
            
        if not candidate["content"].get("parts"):
            print("⚠️ Không có parts trong content")
            return query

        text = candidate["content"]["parts"][0].get("text", "").strip()

        if not text:
            print("⚠️ Gemini trả về text rỗng")
            return query

        # Làm sạch
        text = text.replace('"', '').replace('*', '').strip()

        # Nếu AI trả dạng câu dài → lấy cụm cuối
        if ":" in text:
            tmp = text.split(":")[-1].strip()
            if len(tmp.split()) <= 4:
                text = tmp

        print(f"✅ Gemini fixed: {text}")
        return text

    except requests.exceptions.Timeout:
        print(f"⚠️ Timeout - dùng query gốc: {query}")
        return query

    except Exception as e:
        print(f"⚠️ Lỗi ({type(e).__name__}): {str(e)}")
        return query