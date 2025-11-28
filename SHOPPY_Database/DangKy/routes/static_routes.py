# -*- coding: utf-8 -*-
"""
Static Routes
Xử lý các route tĩnh như homepage, privacy policy
"""
from flask import send_from_directory
import os

def register_static_routes(app):
    """Đăng ký static routes cho app"""
    
    @app.route('/')
    def serve_index():
        # Tìm file index.html trong thư mục static (nằm ngang hàng với thư mục dangky)
        return send_from_directory(os.path.join(app.root_path, '../static'), 'index.html')
    
    # --- THÊM ROUTE NÀY ĐỂ LOAD CSS/JS/ẢNH ---
    @app.route('/<path:filename>')
    def serve_static(filename):
        # Phục vụ các file css, js, images từ thư mục static
        return send_from_directory(os.path.join(app.root_path, '../static'), filename)
    
    @app.route('/privacy')
    def privacy_policy():
        """Privacy Policy"""
        return """
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Chính sách bảo mật</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; line-height: 1.6; }
                h1 { color: #667eea; }
                h2 { color: #333; margin-top: 30px; }
                p { margin: 15px 0; }
            </style>
        </head>
        <body>
            <h1>🔒 Chính sách bảo mật</h1>
            <p><strong>Cập nhật lần cuối:</strong> Ngày 12 tháng 11 năm 2025</p>
            
            <h2>1. Thông tin chúng tôi thu thập</h2>
            <p>Khi bạn đăng nhập qua Google hoặc Email, chúng tôi thu thập:</p>
            <ul>
                <li>Tên hiển thị</li>
                <li>Địa chỉ email</li>
                <li>ID người dùng từ nền tảng (Google ID nếu đăng nhập qua Google)</li>
            </ul>
            
            <h2>2. Cách chúng tôi sử dụng thông tin</h2>
            <p>Thông tin của bạn được sử dụng để:</p>
            <ul>
                <li>Tạo và quản lý tài khoản</li>
                <li>Xác thực đăng nhập</li>
                <li>Gửi email xác thực và khôi phục mật khẩu</li>
                <li>Cải thiện trải nghiệm người dùng</li>
            </ul>
            
            <h2>3. Bảo mật thông tin</h2>
            <p>Chúng tôi cam kết bảo vệ thông tin cá nhân của bạn bằng các biện pháp bảo mật tiêu chuẩn ngành.</p>
            
            <h2>4. Chia sẻ thông tin</h2>
            <p>Chúng tôi KHÔNG chia sẻ thông tin cá nhân của bạn với bên thứ ba.</p>
            
            <h2>5. Quyền của bạn</h2>
            <p>Bạn có quyền:</p>
            <ul>
                <li>Truy cập thông tin cá nhân</li>
                <li>Yêu cầu xóa tài khoản</li>
                <li>Rút lại quyền truy cập</li>
            </ul>
            
            <h2>6. Liên hệ</h2>
            <p>Nếu có câu hỏi về chính sách này, vui lòng liên hệ: <strong>support@yourapp.com</strong></p>
            
            <hr style="margin: 40px 0;">
            <p style="text-align: center; color: #666;">
                <a href="/" style="color: #667eea; text-decoration: none;">← Quay lại trang chủ</a>
            </p>
        </body>
        </html>
        """