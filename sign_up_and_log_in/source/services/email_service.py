# -*- coding: utf-8 -*-
"""
Email Service
Xử lý gửi email - KHÔNG dùng Class
"""
from flask_mailman import EmailMessage

def send_verification_email(to_email, user_name, verification_url):
    """Gửi email xác thực tài khoản"""
    subject = "Xác thực tài khoản"
    body = f"Chào {user_name},\n\n" \
           f"Cảm ơn bạn đã đăng ký! Vui lòng bấm vào link sau để kích hoạt tài khoản:\n" \
           f"{verification_url}\n\n" \
           f"Link này sẽ hết hạn sau 1 giờ.\n\n" \
           f"Nếu bạn không đăng ký tài khoản này, vui lòng bỏ qua email này."
    
    msg = EmailMessage(
        subject=subject,
        body=body,
        to=[to_email]
    )
    msg.send()

def send_otp_email(to_email, user_name, otp_code):
    """Gửi email chứa mã OTP"""
    subject = "Mã OTP đặt lại mật khẩu"
    body = f"Chào {user_name},\n\n" \
           f"Bạn đã yêu cầu đặt lại mật khẩu. Mã OTP của bạn là:\n\n" \
           f"    {otp_code}\n\n" \
           f"Mã này sẽ hết hạn sau 10 phút.\n\n" \
           f"Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này."
    
    msg = EmailMessage(
        subject=subject,
        body=body,
        to=[to_email]
    )
    msg.send()