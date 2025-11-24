# -*- coding: utf-8 -*-
"""
Main Application File
Khởi tạo Flask app và đăng ký các routes - KHÔNG dùng SQLAlchemy
"""
from flask import Flask
from flask_cors import CORS
from config import Config
from extensions import jwt, bcrypt, mail, oauth, configure_oauth
from routes.auth import auth_bp
from routes.user import user_bp
from routes.oauth_routes import oauth_bp
from routes.search_routes import search_bp 
# [MỚI] Import Review Blueprint
from routes.review_routes import review_bp 
import models as db_models
import os

def create_app():
    """Factory function để tạo Flask app"""
    app = Flask(__name__)
    
    # Load configuration
    app.config.from_object(Config)
    
    # Setup CORS
    CORS(app, resources={r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "expose_headers": ["Content-Type", "Authorization"],
        "supports_credentials": False
    }})
    
    # Initialize extensions
    jwt.init_app(app)
    bcrypt.init_app(app)
    mail.init_app(app)
    oauth.init_app(app)

    configure_oauth(app)
    
    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(user_bp)
    app.register_blueprint(oauth_bp)

    # [MỚI] Đăng ký search blueprint vào ứng dụng
    # API sẽ chạy tại đường dẫn: /api/products
    app.register_blueprint(search_bp)
    
    # [MỚI] Đăng ký review blueprint vào ứng dụng
    # API reviews sẽ chạy tại đường dẫn: /api/reviews và /api/product_detail
    app.register_blueprint(review_bp) 
    
    # Register error handlers
    from routes.errors import register_error_handlers
    register_error_handlers(app)
    
    # Register static routes
    from routes.static_routes import register_static_routes
    register_static_routes(app)
    
    return app

if __name__ == '__main__':
    app = create_app()
    
    # Tạo database tables
    db_models.create_users_table()
    print("✅ Database đã sẵn sàng!")
    print(f"📧 Mail: {app.config['MAIL_USERNAME']}")
    print(f"🔑 Google ID: {os.getenv('GOOGLE_CLIENT_ID')[:20] if os.getenv('GOOGLE_CLIENT_ID') else 'CHƯA CÓ'}...")
    
    # Chạy ứng dụng trên cổng 5000
    app.run(debug=True, host='127.0.0.1', port=5000)