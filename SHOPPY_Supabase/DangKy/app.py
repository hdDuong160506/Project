# -*- coding: utf-8 -*-
"""
Main Application File
Khởi tạo Flask app và đăng ký các routes - KHÔNG dùng SQLAlchemy
"""
from flask import Flask
from flask_cors import CORS
from config import Config
from routes.search_routes import search_bp 
# [MỚI] Import Review Blueprint
from routes.review_routes import review_bp
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
    
    # [MỚI] Đăng ký search blueprint vào ứng dụng
    # API sẽ chạy tại đường dẫn: /api/products
    app.register_blueprint(search_bp)
    
    # [MỚI] Đăng ký review blueprint vào ứng dụng
    # API reviews sẽ chạy tại đường dẫn: /api/reviews và /api/product_detail
    app.register_blueprint(review_bp)
    
    return app

if __name__ == '__main__':
    app = create_app()

    print("✅ Database đã sẵn sàng!")
    print(f"📧 Mail: {app.config['MAIL_USERNAME']}")
    print(f"🔑 Google ID: {os.getenv('GOOGLE_CLIENT_ID')[:20] if os.getenv('GOOGLE_CLIENT_ID') else 'CHƯA CÓ'}...")
    
    # Chạy ứng dụng trên cổng 5000
    app.run(debug=True, host='127.0.0.1', port=5000)