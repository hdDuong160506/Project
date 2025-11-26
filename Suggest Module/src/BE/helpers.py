import math
import unicodedata
import re
from typing import Tuple


# Công thức tính khoảng cách dựa theo 2 điểm trên bề mặt trái đất
def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0  # Bán kính trái đất
    latitude1_rad = math.radians(lat1)
    latitude2_rad = math.radians(lat2)
    delta_latitude_rad = math.radians(lat2 - lat1)
    delta_longitude_rad = math.radians(lon2 - lon1)
    a = (
        math.sin(delta_latitude_rad / 2) ** 2
        + math.cos(latitude1_rad)
        * math.cos(latitude2_rad)
        * math.sin(delta_longitude_rad / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


# Lấy dữ liệu lat, lon từ front-end
def parse_latlon(payload: dict) -> Tuple[float, float]:
    lat = payload.get("latitude") or payload.get("lat")
    lon = payload.get("longitude") or payload.get("lon")
    if lat is None or lon is None:
        raise ValueError("Missing latitude/longitude")
    return float(lat), float(lon)


# Chuyển thành chữ thường, không dấu, khoảng trắng hợp lý
def normalize_vn_name(s: str) -> str:
    # Kiểm tra có phải str hay không
    if not isinstance(s, str):
        return ""

    normalized_string = unicodedata.normalize("NFD", s)
    characters_without_marks = []

    for c in normalized_string:
        category = unicodedata.category(c)

        if category != "Mn":  # Mn biểu diễn cho dấu
            characters_without_marks.append(c)

    base = "".join(characters_without_marks)
    base = base.lower().strip()  # Chuyển thành chữ thường và khoảng trắng hai đầu
    for token in ("thanh pho", "tp.", "tp", "tinh", ",", "."):
        base = base.replace(token, " ")
    return " ".join(base.split())


# Chuẩn hoá mọi loại dấu gạch ngang thành "-"
def _normalize_dash(s: str) -> str:
    chars = []
    for c in s:
        if unicodedata.category(c) == "Pd":  # punctuation, dash
            chars.append("-")
        else:
            chars.append(c)
    return "".join(chars)


# Lấy ra phần số (loại ., , chữ, đơn vị)
def _extract_digits(s: str) -> str:
    digits = re.sub(r"[^0-9]", "", s)
    return digits


# 3. Lấy giá trị nhỏ nhất trong khoảng
def extract_min_price(raw):
    if raw is None:
        return None

    s = str(raw).strip()
    if not s:
        return None

    s = _normalize_dash(s)

    # Nếu có khoảng giá
    if "-" in s:
        parts = [p.strip() for p in s.split("-") if p.strip()]
        if not parts:
            return None
        return parts[0]

    # Trường hợp chỉ 1 giá
    digits = _extract_digits(s)
    return int(digits) if digits else None


# 4. Format số có dấu . (10.000, 30.500.000)
def _fmt_vnd(n: int) -> str:
    return f"{n:,}".replace(",", ".")


# 5. Trả về text đẹp
def format_price_text(raw):
    if raw is None:
        return None

    s = str(raw).strip()
    if not s:
        return None

    s = _normalize_dash(s)

    # Check khoảng giá
    if "-" in s:
        parts = [p.strip() for p in s.split("-") if p.strip()]
        nums = []

        for p in parts[:2]:
            digits = _extract_digits(p)
            if digits:
                nums.append(_fmt_vnd(int(digits)))

        if len(nums) == 2:
            return f"{nums[0]} – {nums[1]}"
        if len(nums) == 1:
            return nums[0]
        return None

    # 1 giá
    digits = _extract_digits(s)
    return _fmt_vnd(int(digits)) if digits else None
