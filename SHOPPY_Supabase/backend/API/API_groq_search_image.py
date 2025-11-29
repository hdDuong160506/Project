import os
import requests
import base64
import re
from dotenv import load_dotenv
from supabase import create_client, Client
from difflib import SequenceMatcher

load_dotenv()

# Groq API - MIỄN PHÍ & CỰC NHANH
GROQ_SEARCH_IMAGE_API_KEY = os.getenv("GROQ_SEARCH_IMAGE_API_KEY")
VISION_MODEL = "llama-3.2-90b-vision-preview"  # Model vision thực tế available

# Supabase
DATA_BASE_SECRET_KEY_SUPABASE = os.getenv("DATA_BASE_SECRET_KEY_SUPABASE")
DATA_BASE_URL_SUPABASE = os.getenv("DATA_BASE_URL_SUPABASE")

url = DATA_BASE_URL_SUPABASE
key = DATA_BASE_SECRET_KEY_SUPABASE
supabase: Client = create_client(url, key)


# ==================== HELPER FUNCTIONS ====================

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
    text = text.lower().strip()
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
        
        if detected_words & product_words:
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


def prepare_image_data(image_data: str):
    """
    Chuẩn bị image data cho Groq API (base64)
    Returns: (base64_string, mime_type) hoặc (None, None)
    """
    try:
        # Nếu là URL
        if image_data.startswith('http://') or image_data.startswith('https://'):
            response = requests.get(image_data, timeout=10)
            if response.status_code == 200:
                base64_data = base64.b64encode(response.content).decode('utf-8')
                mime_type = response.headers.get('Content-Type', 'image/jpeg')
                return base64_data, mime_type
        
        # Nếu là base64 string với data URL
        elif image_data.startswith('data:image'):
            match = re.match(r'data:([^;]+);base64,(.+)', image_data)
            if match:
                mime_type = match.group(1)
                base64_data = match.group(2)
                return base64_data, mime_type
        
        # Nếu là raw base64 (không có prefix)
        else:
            return image_data, "image/jpeg"
        
        return None, None
        
    except Exception as e:
        print(f"⚠️ Lỗi prepare_image_data: {str(e)}")
        return None, None


def safe_extract_text_from_groq_response(response_data: dict):
    """
    Trích xuất text từ response Groq một cách an toàn
    """
    try:
        if not response_data:
            return None
        
        # Kiểm tra error
        if "error" in response_data:
            error = response_data["error"]
            print(f"⚠️ Groq API error: {error.get('message', 'Unknown error')}")
            return None
        
        # Lấy content từ choices
        if "choices" in response_data and response_data["choices"]:
            choice = response_data["choices"][0]
            
            # Kiểm tra finish_reason
            finish_reason = choice.get("finish_reason")
            if finish_reason and finish_reason not in ["stop", "length"]:
                print(f"⚠️ Groq finish_reason: {finish_reason}")
            
            # Lấy text
            if "message" in choice and "content" in choice["message"]:
                text = choice["message"]["content"].strip()
                if text:
                    print(f"✅ Extracted text: {text}")
                    return text
        
        return None
        
    except Exception as e:
        print(f"⚠️ Error parsing Groq response: {e}")
        return None


def clean_detected_text(text: str) -> str:
    """
    Làm sạch text từ AI response
    """
    if not text:
        return ""
    
    # Làm sạch ký tự đặc biệt
    text = text.replace('"', '').replace('*', '').replace('`', '').strip()
    
    # Xử lý các format có thể có
    if ":" in text:
        text = text.split(":")[-1].strip()
    if "\n" in text:
        text = text.split("\n")[0].strip()
    
    # Loại bỏ các từ thừa
    stop_words = ["output", "result", "product", "món", "là", "is", "answer", ":", "tên", "sản phẩm"]
    for word in stop_words:
        if text.lower().startswith(word):
            text = text[len(word):].strip()
    
    return text


# ==================== MAIN FUNCTION ====================

def groq_search_product_by_image(image_data: str):
    """
    Tìm sản phẩm bằng hình ảnh sử dụng Groq Vision API
    
    Args:
        image_data: URL ảnh, base64 string, hoặc data URL
    
    Returns:
        str: Tên sản phẩm tìm được, hoặc None nếu không tìm thấy
    """
    # Bước 1: Lấy danh sách sản phẩm
    products = fetch_product_names()
    
    if not products:
        print("⚠️ Danh sách sản phẩm rỗng")
        return None
    
    if not GROQ_SEARCH_IMAGE_API_KEY:
        print("⚠️ Thiếu GROQ_SEARCH_IMAGE_API_KEY")
        return None
    
    # Bước 2: Chuẩn bị image data
    base64_image, mime_type = prepare_image_data(image_data)
    
    if not base64_image:
        print("⚠️ Không thể xử lý image data")
        return None
    
    # Bước 3: Tạo prompt
    product_list = ", ".join(products)
    
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
    
    # Bước 4: Gọi Groq Vision API
    url = "https://api.groq.com/openai/v1/chat/completions"
    
    headers = {
        "Authorization": f"Bearer {GROQ_SEARCH_IMAGE_API_KEY}",
        "Content-Type": "application/json"
    }
    
    data = {
        "model": VISION_MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": prompt
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime_type};base64,{base64_image}"
                        }
                    }
                ]
            }
        ],
        "temperature": 0.2,
        "max_tokens": 500
    }
    
    try:
        response = requests.post(url, headers=headers, json=data, timeout=20)
        
        print(f"🔍 Vision API Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"⚠️ API error {response.status_code}: {response.text}")
            return None
        
        res = response.json()
        print(f"🔍 Groq Response: {res}")
        
        # Bước 5: Trích xuất text
        text = safe_extract_text_from_groq_response(res)
        
        if not text:
            print("⚠️ Không trích xuất được text từ response")
            return None
        
        # Bước 6: Làm sạch text
        text = clean_detected_text(text)
        print(f"✅ Groq Vision detected: '{text}'")
        
        # Bước 7: Fuzzy matching
        matched_product = fuzzy_match_product(text, products)
        
        if matched_product:
            return matched_product
        
        # Bước 8: Fallback - tìm món có chứa từ khóa chính
        keywords = ["cơm", "phở", "bún", "bánh", "chả", "gà", "bò", "heo"]
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


# ==================== TEST FUNCTION ====================

if __name__ == "__main__":
    # Test với URL ảnh
    test_url = "https://example.com/food.jpg"
    print("🖼️ Test: Tìm kiếm từ URL ảnh")
    result = groq_search_product_by_image(test_url)
    print(f"➡️ Result: {result}\n{'-'*50}\n")
    
    # Test với base64
    # với file local, bạn có thể đọc và encode:
    # with open("path/to/image.jpg", "rb") as f:
    #     base64_data = base64.b64encode(f.read()).decode('utf-8')
    #     result = groq_search_product_by_image(base64_data)