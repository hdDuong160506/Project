import os
import requests
import re
from dotenv import load_dotenv
import sqlite3

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MODEL = "gemini-2.5-flash"

# Lấy đường dẫn tuyệt đối của project
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # lên 1 cấp từ API/
DB_PATH = os.path.join(BASE_DIR, "database.db3")

def fetch_product_names():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute("SELECT name FROM product")
    rows = cur.fetchall()
    conn.close()

    # Loại None, trim khoảng trắng và bỏ trùng
    names = {row["name"].strip() for row in rows if row["name"]}
    return list(names)

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
            "Extract the Vietnamese product name from the input sentence. "
            "ONLY output the product name exactly as in the list below if it appears in the sentence. "
            "Do NOT add explanations or extra words.\n"
            f"Input: {query}\n\n"
            f"VALID PRODUCTS: {PRODUCT_SCOPE}\n\n"
            "Rules:\n"
            "1. If the input contains a product from the list, output that product.\n"
            "2. If none of the products appear, return the closest matching product from the list.\n"
            "3. Do NOT invent new products or locations."
        )
    else:
        prompt = (
            "Fix spelling and extract the Vietnamese product name from the input sentence. "
            "ONLY output the product name exactly as in the list below if it appears in the sentence. "
            "Do NOT translate or add explanations.\n"
            f"Input: {query}\n\n"
            f"VALID PRODUCTS: {PRODUCT_SCOPE}\n\n"
            "Rules:\n"
            "1. If the input contains a product from the list, output that product.\n"
            "2. If none of the products appear, return the closest matching product from the list.\n"
            "3. Do NOT invent new products or locations."
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
            print("⚠️ Gemini trả về rỗng, dùng query gốc: {query}")
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