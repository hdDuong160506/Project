# -*- coding: utf-8 -*-
"""
Database Operations
Các hàm thao tác với database - KHÔNG dùng ORM/Class
"""
import sqlite3
from utils.helpers import get_vn_time
from extensions import bcrypt

DATABASE_PATH = 'database.db3'

def get_db_connection():
    """Tạo kết nối database"""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def dict_from_row(row):
    """Chuyển Row object thành dict"""
    return dict(row) if row else None

# ==================== USER OPERATIONS ====================

def create_users_table():
    """Tạo bảng users nếu chưa có"""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id_users INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            pwd TEXT,
            lat REAL,
            long REAL,
            refresh_token TEXT,
            created_at DATETIME,
            updated_at DATETIME,
            verification INTEGER DEFAULT 0,
            google_id TEXT UNIQUE,
            reset_otp TEXT,
            reset_otp_expires DATETIME
        )
    """)
    conn.commit()
    conn.close()

def insert_user(name, email, pwd_hash, lat=10.8231, long=106.6297, verification=False, google_id=None):
    """Thêm user mới vào database"""
    conn = get_db_connection()
    cur = conn.cursor()
    vn_time = get_vn_time()
    
    try:
        cur.execute("""
            INSERT INTO users (name, email, pwd, lat, long, created_at, updated_at, verification, google_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (name, email, pwd_hash, lat, long, vn_time, vn_time, int(verification), google_id))
        conn.commit()
        user_id = cur.lastrowid
        conn.close()
        return user_id
    except sqlite3.IntegrityError:
        conn.close()
        return None

def find_user_by_email(email):
    """Tìm user theo email"""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE email = ?", (email,))
    row = cur.fetchone()
    conn.close()
    return dict_from_row(row)

def find_user_by_id(user_id):
    """Tìm user theo ID"""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE id_users = ?", (user_id,))
    row = cur.fetchone()
    conn.close()
    return dict_from_row(row)

def find_user_by_google_id(google_id):
    """Tìm user theo Google ID"""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE google_id = ?", (google_id,))
    row = cur.fetchone()
    conn.close()
    return dict_from_row(row)

def update_user_verification(email, verified=True):
    """Cập nhật trạng thái verification"""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        UPDATE users 
        SET verification = ?, updated_at = ?
        WHERE email = ?
    """, (int(verified), get_vn_time(), email))
    conn.commit()
    conn.close()

def update_user_tokens(user_id, refresh_token):
    """Cập nhật refresh token"""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        UPDATE users 
        SET refresh_token = ?, updated_at = ?
        WHERE id_users = ?
    """, (refresh_token, get_vn_time(), user_id))
    conn.commit()
    conn.close()

def update_user_google_id(email, google_id):
    """Cập nhật Google ID cho user"""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        UPDATE users 
        SET google_id = ?, verification = 1, updated_at = ?
        WHERE email = ?
    """, (google_id, get_vn_time(), email))
    conn.commit()
    conn.close()

def update_user_location(user_id, lat, long):
    """Cập nhật vị trí user"""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        UPDATE users 
        SET lat = ?, long = ?, updated_at = ?
        WHERE id_users = ?
    """, (lat, long, get_vn_time(), user_id))
    conn.commit()
    conn.close()

def update_user_otp(email, otp_code, otp_expires):
    """Cập nhật OTP reset password"""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        UPDATE users 
        SET reset_otp = ?, reset_otp_expires = ?, updated_at = ?
        WHERE email = ?
    """, (otp_code, otp_expires, get_vn_time(), email))
    conn.commit()
    conn.close()

def clear_user_otp(email):
    """Xóa OTP sau khi reset password"""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        UPDATE users 
        SET reset_otp = NULL, reset_otp_expires = NULL, updated_at = ?
        WHERE email = ?
    """, (get_vn_time(), email))
    conn.commit()
    conn.close()

def update_user_password(email, new_pwd_hash):
    """Cập nhật mật khẩu mới"""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        UPDATE users 
        SET pwd = ?, refresh_token = NULL, updated_at = ?
        WHERE email = ?
    """, (new_pwd_hash, get_vn_time(), email))
    conn.commit()
    conn.close()

def clear_user_refresh_token(user_id):
    """Xóa refresh token (logout)"""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        UPDATE users 
        SET refresh_token = NULL, updated_at = ?
        WHERE id_users = ?
    """, (get_vn_time(), user_id))
    conn.commit()
    conn.close()

def update_last_active(user_id):
    """Cập nhật thời gian hoạt động cuối"""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        UPDATE users 
        SET updated_at = ?
        WHERE id_users = ?
    """, (get_vn_time(), user_id))
    conn.commit()
    conn.close()

def user_to_dict(user_data):
    """Chuyển user data thành dict dạng response"""
    if not user_data:
        return None
    
    return {
        "id": user_data["id_users"],
        "name": user_data["name"],
        "email": user_data["email"],
        "created_at": user_data.get("created_at"),
        "last_active": user_data.get("updated_at"),
        "verification": bool(user_data.get("verification")),
        "lat": user_data.get("lat"),
        "long": user_data.get("long"),
        "has_google": user_data.get("google_id") is not None
    }