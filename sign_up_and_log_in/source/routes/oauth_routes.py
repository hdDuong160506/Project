# -*- coding: utf-8 -*-
"""
OAuth Routes
Xử lý đăng nhập qua Google - KHÔNG dùng ORM
"""
from flask import Blueprint, redirect, url_for, current_app
from flask_jwt_extended import create_access_token, create_refresh_token
from extensions import oauth
import models as db
from utils.helpers import get_vn_time

oauth_bp = Blueprint('oauth', __name__)

def process_social_login(user_info, provider_name, provider_id):
    """Tìm hoặc tạo user cho social login"""
    email = user_info.get('email', '').lower()
    name = user_info.get('name', '')
    social_id = str(provider_id)
    
    if not email:
        raise Exception(f"Không nhận được email từ {provider_name.title()}.")

    # Tìm user theo email
    user = db.find_user_by_email(email)
    
    if user:
        # User đã tồn tại, cập nhật google_id nếu chưa có
        if not user.get("google_id"):
            db.update_user_google_id(email, social_id)
            user = db.find_user_by_email(email)  # Reload user
        else:
            db.update_last_active(user["id_users"])
    else:
        # Tạo user mới
        user_id = db.insert_user(
            name=name,
            email=email,
            pwd_hash=None,
            lat=10.8231,
            long=106.6297,
            verification=True,
            google_id=social_id
        )
        
        if not user_id:
            # Nếu insert thất bại (do race condition), thử tìm lại
            user = db.find_user_by_email(email)
            if not user:
                raise Exception("Lỗi tạo tài khoản, vui lòng thử lại.")
            db.update_user_google_id(email, social_id)
        else:
            user = db.find_user_by_id(user_id)
    
    return user


@oauth_bp.route('/login/google')
def login_google_redirect():
    """Chuyển hướng user đến Google"""
    redirect_uri = url_for('oauth.google_callback', _external=True)
    return oauth.google.authorize_redirect(redirect_uri)


@oauth_bp.route('/login/google/callback')
def google_callback():
    """Xử lý thông tin Google trả về"""
    try:
        token = oauth.google.authorize_access_token()
        resp = oauth.google.get('https://www.googleapis.com/oauth2/v3/userinfo')
        user_info = resp.json()
        
        user = process_social_login(user_info, 'google', user_info['sub'])
        
        user_identity = str(user["id_users"])
        access_token = create_access_token(identity=user_identity)
        refresh_token = create_refresh_token(identity=user_identity)
        
        db.update_user_tokens(user["id_users"], refresh_token)
        
        return redirect(f'/?access_token={access_token}&refresh_token={refresh_token}')
        
    except Exception as e:
        current_app.logger.error(f"Lỗi Google Callback: {str(e)}")
        import traceback
        current_app.logger.error(traceback.format_exc())
        return redirect(f'/?error=Loi_Google_Login')