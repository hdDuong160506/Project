# -*- coding: utf-8 -*-
"""
Error Handlers
Xử lý các lỗi HTTP
"""
from flask import jsonify

def register_error_handlers(app):
    """Đăng ký error handlers cho app"""
    
    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"msg": "Endpoint không tồn tại"}), 404

    @app.errorhandler(500)
    def internal_error(e):
        app.logger.error(f"Lỗi 500: {str(e)}")
        return jsonify({"msg": "Lỗi server"}), 500
    
    @app.errorhandler(400)
    def bad_request(e):
        return jsonify({"msg": "Yêu cầu không hợp lệ"}), 400
    
    @app.errorhandler(401)
    def unauthorized(e):
        return jsonify({"msg": "Chưa xác thực"}), 401
    
    @app.errorhandler(403)
    def forbidden(e):
        return jsonify({"msg": "Không có quyền truy cập"}), 403