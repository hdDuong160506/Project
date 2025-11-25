# -*- coding: utf-8 -*-
"""
Configuration File
Chứa tất cả các cấu hình cho ứng dụng - KHÔNG dùng SQLAlchemy
"""
import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Configuration class"""
    
    # Secret Keys
    SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'default-fallback-key-rat-ngau-nhien')
    JWT_SECRET_KEY = SECRET_KEY
    
    # Database - CHỈ LÀ PATH, KHÔNG dùng SQLAlchemy
    DATABASE_PATH = 'database.db3'
    
    # JWT
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
    
    # Email
    MAIL_SERVER = 'smtp.gmail.com'
    MAIL_PORT = 587
    MAIL_USE_TLS = True
    MAIL_USERNAME = os.getenv('MAIL_USERNAME')
    MAIL_PASSWORD = os.getenv('MAIL_PASSWORD')
    MAIL_DEFAULT_SENDER = os.getenv('MAIL_USERNAME')
    
    # OAuth - Google
    GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID')
    GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET')
    
    # Token Salts
    EMAIL_VERIFICATION_SALT = 'email-verification-salt'
    PASSWORD_RESET_SALT = 'password-reset-salt'