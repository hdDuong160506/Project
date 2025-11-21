# -*- coding: utf-8 -*-
"""
Extensions File
Khởi tạo các Flask extensions - CHỈ CẦN cho JWT và Mail
"""
from flask_jwt_extended import JWTManager
from flask_bcrypt import Bcrypt
from flask_mailman import Mail
from authlib.integrations.flask_client import OAuth
from itsdangerous import URLSafeTimedSerializer
import os

# Initialize extensions
jwt = JWTManager()
bcrypt = Bcrypt()
mail = Mail()
oauth = OAuth()

# Token serializer
SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'default-fallback-key-rat-ngau-nhien')
serializer = URLSafeTimedSerializer(SECRET_KEY)

# Configure OAuth providers
def configure_oauth(app):
    """Configure OAuth providers"""
    oauth.register(
        name='google',
        client_id=app.config['GOOGLE_CLIENT_ID'],
        client_secret=app.config['GOOGLE_CLIENT_SECRET'],
        server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
        client_kwargs={'scope': 'openid email profile'}
    )