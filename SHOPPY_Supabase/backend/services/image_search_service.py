import os
import requests
import base64
import re
from dotenv import load_dotenv
from supabase import create_client, Client
from difflib import SequenceMatcher

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

def normalize_text(text: str) -> str:
    """Chuẩn hóa text để so sánh"""
    # Chuyển về lowercase và loại bỏ dấu câu
    text = text.lower().strip()
    # Loại bỏ các ký tự đặc biệt
    text = re.sub(r'[^\w\sàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]', '', text)
    return text

def fuzzy_match_product(detected_text: str, products: list) -> str:
    """
    So sánh mờ để tìm sản phẩm phù hợp nhất
    """
    detected_normalized = normalize_text(detected_text)
    
    print(f"🔍 Đang tìm kiếm cho: '{detected_normalized}'")
    
    best_match = None
    best_score = 0.0
    
    for product in products:
        product_normalized = normalize_text(product)
        
        # Phương pháp 1: Kiểm tra substring
        if detected_normalized in product_normalized or product_normalized in detected_normalized:
            score = 0.9
            print(f"  ✓ Substring match: '{product}' (score: {score})")
            if score > best_score:
                best_score = score
                best_match = product
        
        # Phương pháp 2: Kiểm tra từng từ
        detected_words = set(detected_normalized.split())
        product_words = set(product_normalized.split())
        
        if detected_words & product_words:  # Có từ chung
            common_ratio = len(detected_words & product_words) / max(len(detected_words), len(product_words))
            if common_ratio > 0.5 and common_ratio > best_score:
                best_score = common_ratio
                best_match = product
                print(f"  ✓ Word match: '{product}' (score: {common_ratio:.2f})")
        
        # Phương pháp 3: Similarity score
        similarity = SequenceMatcher(None, detected_normalized, product_normalized).ratio()
        if similarity > 0.6 and similarity > best_score:
            best_score = similarity
            best_match = product
            print(f"  ✓ Fuzzy match: '{product}' (score: {similarity:.2f})")
    
    if best_match:
        print(f"✅ Best match: '{best_match}' (score: {best_score:.2f})")
    else:
        print(f"⚠️ Không tìm thấy match cho '{detected_text}'")
    
    return best_match

def search_product_by_image_data(image_data: str):
    """
    Tìm sản phẩm bằng hình ảnh - TỰ ĐỘNG lấy danh sách sản phẩm
    """
    products = fetch_product_names()
    
    if not products:
        print("⚠️ Danh sách sản phẩm rỗng")
        return None
        
    if not GEMINI_API_KEY:
        print("⚠️ Thiếu GEMINI_API_KEY")
        return None

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"
    
    # FIXED: Tạo danh sách đầy đủ hơn, nhóm theo loại món
    product_list = ", ".join(products)  # Lấy TẤT CẢ sản phẩm
    
    # PROMPT MỚI: Nhận diện đa dạng sản phẩm
    prompt = f"""Nhận diện đối tượng trong ảnh và chọn TÊN PHÙ HỢP NHẤT từ danh sách sản phẩm sau:

    {product_list}

    QUY TẮC:
    1. Nhận diện BẤT KỲ đối tượng nào: đồ ăn, thức uống, đồ dùng học tập, thiết bị điện tử, quần áo, phụ kiện, đồ gia dụng, v.v.
    2. Trả về ĐÚNG TÊN từ danh sách trên (giữ nguyên chính tả)
    3. Nếu là đồ ăn → tìm món ăn tương ứng
    4. Nếu là đồ vật → tìm sản phẩm mô tả đúng nhất  
    5. Nếu là thiết bị → tìm thiết bị điện tử phù hợp
    6. Nếu là quần áo → tìm trang phục tương tự
    7. CHỈ trả về TÊN SẢN PHẨM, không giải thích

    Output: [tên sản phẩm chính xác]"""

    # Xử lý image data
    image_part = prepare_image_data(image_data)
    if not image_part:
        print("⚠️ Không thể xử lý image data")
        return None
    
    data = {
        "contents": [{
            "parts": [
                {"text": prompt},
                image_part
            ]
        }],
        "generationConfig": {
            "temperature": 0.2,  # Tăng để linh hoạt hơn
            "maxOutputTokens": 500,  # FIXED: Tăng tokens cho tên dài
            "topP": 0.9,
            "topK": 40
        }
    }
    
    headers = {"Content-Type": "application/json"}
    params = {"key": GEMINI_API_KEY}
    
    try:
        response = requests.post(url, headers=headers, json=data, params=params, timeout=20)
        
        print(f"🔍 Vision API Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"⚠️ API error {response.status_code}: {response.text}")
            return None
        
        res = response.json()
        print(f"🔍 Gemini Response: {res}")
        
        # Trích xuất text
        text = safe_extract_text_from_gemini_response(res)
        
        if not text:
            print("⚠️ Không trích xuất được text từ response")
            return None
        
        # Làm sạch output
        text = text.replace('"', '').replace('*', '').replace('`', '').strip()
        
        # Xử lý các format có thể có
        if ":" in text:
            text = text.split(":")[-1].strip()
        if "\n" in text:
            text = text.split("\n")[0].strip()
        
        # Loại bỏ các từ thừa
        stop_words = ["output", "result", "product", "món", "là", "is", "answer", ":", "tên"]
        for word in stop_words:
            if text.lower().startswith(word):
                text = text[len(word):].strip()
        
        print(f"✅ Gemini Vision detected: '{text}'")
        
        # FIXED: Dùng fuzzy matching thay vì exact match
        matched_product = fuzzy_match_product(text, products)
        
        if matched_product:
            return matched_product
        
        # Fallback cuối cùng: Tìm món có chứa từ khóa chính
        keywords = ["cơm", "phở", "bún", "bánh", "chả"]
        for keyword in keywords:
            if keyword in text.lower():
                for product in products:
                    if keyword in product.lower():
                        print(f"⚠️ Fallback match: {product}")
                        return product
        
        print(f"⚠️ Không tìm thấy sản phẩm phù hợp")
        return None
        
    except requests.exceptions.Timeout:
        print("⚠️ Timeout khi gọi Vision API")
        return None
    
    except Exception as e:
        print(f"⚠️ Lỗi Vision API: {type(e).__name__} - {str(e)}")
        return None

def prepare_image_data(image_data: str):
    """
    Chuẩn bị image data cho Gemini API
    """
    try:
        # Nếu là URL
        if image_data.startswith('http://') or image_data.startswith('https://'):
            response = requests.get(image_data, timeout=10)
            if response.status_code == 200:
                base64_data = base64.b64encode(response.content).decode('utf-8')
                mime_type = response.headers.get('Content-Type', 'image/jpeg')
                return {
                    "inline_data": {
                        "mime_type": mime_type,
                        "data": base64_data
                    }
                }
        
        # Nếu là base64 string với data URL
        elif image_data.startswith('data:image'):
            match = re.match(r'data:([^;]+);base64,(.+)', image_data)
            if match:
                mime_type = match.group(1)
                base64_data = match.group(2)
                return {
                    "inline_data": {
                        "mime_type": mime_type,
                        "data": base64_data
                    }
                }
        
        # Nếu là raw base64 (không có prefix)
        else:
            return {
                "inline_data": {
                    "mime_type": "image/jpeg",
                    "data": image_data
                }
            }
        
        return None
        
    except Exception as e:
        print(f"⚠️ Lỗi prepare_image_data: {str(e)}")
        return None

def safe_extract_text_from_gemini_response(response_data: dict):
    """
    Trích xuất text từ response Gemini một cách an toàn
    """
    try:
        if not response_data:
            return None
            
        if "candidates" in response_data and response_data["candidates"]:
            candidate = response_data["candidates"][0]
            
            finish_reason = candidate.get("finishReason")
            if finish_reason and finish_reason not in ["STOP", "MAX_TOKENS"]:
                print(f"⚠️ Gemini finishReason: {finish_reason}")
                # Vẫn thử lấy text
            
            # Lấy content
            if "content" in candidate and candidate["content"].get("parts"):
                text = candidate["content"]["parts"][0].get("text", "").strip()
                if text:
                    print(f"✅ Extracted text: {text}")
                    return text
        
        elif "error" in response_data:
            error = response_data["error"]
            print(f"⚠️ Gemini API error: {error.get('message', 'Unknown error')}")
            return None
            
        return None
        
    except Exception as e:
        print(f"⚠️ Error parsing Gemini response: {e}")
        return None