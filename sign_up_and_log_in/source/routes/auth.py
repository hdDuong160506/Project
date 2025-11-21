# -*- coding: utf-8 -*-
"""
Authentication Routes
Xử lý đăng ký, đăng nhập, quên mật khẩu - KHÔNG dùng ORM
"""
from flask import Blueprint, request, jsonify, url_for
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    get_jwt_identity,
    jwt_required
)
from extensions import bcrypt, serializer
import models as db
from services.email_service import send_verification_email, send_otp_email
from utils.helpers import get_vn_time, is_valid_email, generate_otp
from datetime import timedelta
from config import Config

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
@jwt_required(optional=True)
def register():
    """Đăng ký tài khoản mới"""
    if get_jwt_identity():
        return jsonify({"msg": "Bạn đã đăng nhập. Không thể đăng ký tài khoản mới."}), 403

    data = request.get_json()
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    pwd = data.get('pwd', '')

    # Validation
    if not name or not email or not pwd:
        return jsonify({"msg": "Thiếu name, email hoặc pwd"}), 400
    
    if len(name) < 2 or len(name) > 100:
        return jsonify({"msg": "Tên phải có từ 2-100 ký tự"}), 400
    
    if not is_valid_email(email):
        return jsonify({"msg": "Email không hợp lệ"}), 400
    
    if len(pwd) < 6:
        return jsonify({"msg": "Mật khẩu phải có ít nhất 6 ký tự"}), 400

    # Check existing user
    existing_user = db.find_user_by_email(email)
    if existing_user:
        if existing_user["verification"]:
            return jsonify({"msg": "Email đã tồn tại"}), 400
        else:
            return jsonify({"msg": "Email này đã đăng ký nhưng chưa kích hoạt. Vui lòng kiểm tra email."}), 400

    # Create new user
    hashed_password = bcrypt.generate_password_hash(pwd).decode('utf-8')
    
    try:
        # Insert user
        user_id = db.insert_user(name, email, hashed_password)
        if not user_id:
            return jsonify({"msg": "Email đã tồn tại"}), 400

        # Generate verification token
        token = serializer.dumps(email, salt=Config.EMAIL_VERIFICATION_SALT)
        verification_url = url_for('auth.verify_email', token=token, _external=True)

        # Send verification email
        send_verification_email(email, name, verification_url)

        return jsonify({"msg": "Đăng ký thành công! Vui lòng kiểm tra email để kích hoạt tài khoản."}), 201

    except Exception as e:
        return jsonify({"msg": "Gửi email xác thực thất bại.", "error": str(e)}), 500


@auth_bp.route('/verify-email/<token>', methods=['GET'])
def verify_email(token):
    """Xác thực email"""
    try:
        email = serializer.loads(token, salt=Config.EMAIL_VERIFICATION_SALT, max_age=3600)
        user = db.find_user_by_email(email)
        
        if not user:
            return """
            <html><head><meta charset="UTF-8"></head>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
                <h1 style="color: #f44336;">❌ Lỗi</h1>
                <p>Không tìm thấy người dùng.</p>
            </body></html>""", 404
            
        if user["verification"]:
            return """
            <html><head><meta charset="UTF-8"></head>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
                <h1 style="color: #4CAF50;">✅ Đã kích hoạt</h1>
                <p>Tài khoản này đã được kích hoạt trước đó.</p>
                <p><a href="/?verified=true" style="color: #667eea; text-decoration: none;">← Quay lại trang đăng nhập</a></p>
            </body></html>""", 200

        db.update_user_verification(email, True)
        
        return f"""
        <html><head><meta charset="UTF-8">
        <script>
            setTimeout(() => {{
                window.opener && window.opener.postMessage({{type: 'EMAIL_VERIFIED', email: '{email}'}}, '*');
                window.close();
            }}, 3000);
        </script>
        </head>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1 style="color: #4CAF50;">🎉 Xác thực thành công!</h1>
            <p>Tài khoản của bạn đã được kích hoạt.</p>
            <p>Tab này sẽ tự động đóng sau 3 giây...</p>
            <p><a href="/?verified=true&email={email}" style="color: #667eea; text-decoration: none;">Hoặc click vào đây để quay lại</a></p>
        </body></html>""", 200

    except Exception:
        return """
        <html><head><meta charset="UTF-8"></head>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1 style="color: #f44336;">❌ Lỗi</h1>
            <p>Link xác thực không hợp lệ hoặc đã hết hạn.</p>
            <p><a href="/" style="color: #667eea; text-decoration: none;">← Quay lại trang chủ</a></p>
        </body></html>""", 400


@auth_bp.route('/login', methods=['POST'])
@jwt_required(optional=True)
def login():
    """Đăng nhập"""
    if get_jwt_identity():
        return jsonify({"msg": "Bạn đã đăng nhập rồi. Không thể đăng nhập lại."}), 403

    data = request.get_json()
    email = data.get('email', '').strip().lower()
    pwd = data.get('pwd', '')

    if not email or not pwd:
        return jsonify({"msg": "Thiếu email hoặc pwd"}), 400

    user = db.find_user_by_email(email)

    if not user or not user.get("pwd"):
        bcrypt.check_password_hash(bcrypt.generate_password_hash("dummy"), pwd)
        return jsonify({"msg": "Email hoặc mật khẩu không đúng"}), 401

    if bcrypt.check_password_hash(user["pwd"], pwd):
        if not user["verification"]:
            return jsonify({"msg": "Tài khoản chưa được kích hoạt. Vui lòng kiểm tra email."}), 403
        
        user_identity = str(user["id_users"])
        access_token = create_access_token(identity=user_identity)
        refresh_token = create_refresh_token(identity=user_identity)
        
        db.update_user_tokens(user["id_users"], refresh_token)
        
        return jsonify(
            access_token=access_token,
            refresh_token=refresh_token,
            user={
                "id": user["id_users"],
                "name": user["name"],
                "email": user["email"]
            }
        ), 200
    else:
        return jsonify({"msg": "Email hoặc mật khẩu không đúng"}), 401


@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    """Gửi OTP để reset mật khẩu"""
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    
    if not email or not is_valid_email(email):
        return jsonify({"msg": "Email không hợp lệ"}), 400
    
    user = db.find_user_by_email(email)
    
    if not user:
        return jsonify({"msg": "Nếu email tồn tại, mã OTP đã được gửi."}), 200
    
    if not user["verification"]:
        return jsonify({"msg": "Tài khoản chưa được kích hoạt."}), 403
    
    # Generate OTP
    otp_code = generate_otp()
    otp_expires = get_vn_time() + timedelta(minutes=10)
    
    try:
        db.update_user_otp(email, otp_code, otp_expires)
        send_otp_email(email, user["name"], otp_code)
        return jsonify({"msg": "Mã OTP đã được gửi đến email của bạn."}), 200
    except Exception as e:
        return jsonify({"msg": "Gửi OTP thất bại.", "error": str(e)}), 500


@auth_bp.route('/verify-otp', methods=['POST'])
def verify_otp():
    """Xác thực OTP"""
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    otp = data.get('otp', '').strip()
    
    if not email or not otp:
        return jsonify({"msg": "Thiếu email hoặc OTP"}), 400
    
    if len(otp) != 6 or not otp.isdigit():
        return jsonify({"msg": "OTP phải là 6 chữ số"}), 400
    
    user = db.find_user_by_email(email)
    
    if not user or not user.get("reset_otp"):
        return jsonify({"msg": "OTP không hợp lệ hoặc đã hết hạn"}), 401
    
    # Parse datetime string to datetime object for comparison
    from datetime import datetime
    otp_expires = datetime.fromisoformat(user["reset_otp_expires"]) if isinstance(user["reset_otp_expires"], str) else user["reset_otp_expires"]
    
    if otp_expires < get_vn_time():
        db.clear_user_otp(email)
        return jsonify({"msg": "OTP đã hết hạn. Vui lòng yêu cầu mã mới."}), 401
    
    if user["reset_otp"] != otp:
        return jsonify({"msg": "OTP không đúng"}), 401
    
    # Generate reset token
    reset_token = serializer.dumps(email, salt=Config.PASSWORD_RESET_SALT)
    
    return jsonify({
        "msg": "Xác thực OTP thành công",
        "reset_token": reset_token
    }), 200


@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    """Đặt lại mật khẩu"""
    data = request.get_json()
    reset_token = data.get('reset_token', '')
    new_pwd = data.get('new_pwd', '')
    
    if not reset_token or not new_pwd:
        return jsonify({"msg": "Thiếu reset_token hoặc new_pwd"}), 400
    
    if len(new_pwd) < 6:
        return jsonify({"msg": "Mật khẩu mới phải có ít nhất 6 ký tự"}), 400
    
    try:
        email = serializer.loads(reset_token, salt=Config.PASSWORD_RESET_SALT, max_age=900)
        user = db.find_user_by_email(email)
        
        if not user:
            return jsonify({"msg": "Token không hợp lệ"}), 401
        
        hashed_password = bcrypt.generate_password_hash(new_pwd).decode('utf-8')
        db.update_user_password(email, hashed_password)
        db.clear_user_otp(email)
        
        return jsonify({"msg": "Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại."}), 200
    except Exception:
        return jsonify({"msg": "Token không hợp lệ hoặc đã hết hạn"}), 401


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """Refresh access token"""
    current_user_id = get_jwt_identity()
    user = db.find_user_by_id(int(current_user_id))
    
    if not user or not user.get("refresh_token"):
        return jsonify({"msg": "Refresh token không hợp lệ hoặc đã bị thu hồi"}), 401
    
    db.update_last_active(user["id_users"])
    
    new_access_token = create_access_token(identity=str(user["id_users"]))
    return jsonify(access_token=new_access_token), 200


@auth_bp.route('/logout', methods=['POST'])
@jwt_required(refresh=True)
def logout():
    """Đăng xuất"""
    current_user_id = get_jwt_identity()
    user = db.find_user_by_id(int(current_user_id))
    
    if user:
        db.clear_user_refresh_token(user["id_users"])
    
    return jsonify({"msg": "Đăng xuất thành công"}), 200