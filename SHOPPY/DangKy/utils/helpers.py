# -*- coding: utf-8 -*-
"""
Helper Functions
Các hàm tiện ích dùng chung
"""
import re
import random
from datetime import datetime, timedelta

def get_vn_time():
    """Lấy giờ hiện tại theo múi giờ Việt Nam (UTC+7)."""
    return (datetime.utcnow() + timedelta(hours=7)).replace(microsecond=0)

def is_valid_email(email):
    """Kiểm tra format email có hợp lệ không."""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def generate_otp():
    """Tạo mã OTP 6 số ngẫu nhiên."""
    return ''.join([str(random.randint(0, 9)) for _ in range(6)])

def validate_coordinates(lat, long):
    """Kiểm tra tọa độ có hợp lệ không."""
    try:
        lat = float(lat)
        long = float(long)
        if not (-90 <= lat <= 90) or not (-180 <= long <= 180):
            return False, "Tọa độ không hợp lệ"
        return True, (lat, long)
    except (ValueError, TypeError):
        return False, "Tọa độ phải là số"