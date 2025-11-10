1/ vô cmd paste cái này vô (tải thử viện)

pip install flask flask_sqlalchemy flask_jwt_extended flask_cors flask_bcrypt flask-mailman itsdangerous python-dotenv sqlalchemy

2/ tự tạo thêm file .env (để dấu key) với cấu trúc

# --- Key bí mật cho JWT và Token (Tạo một chuỗi ngẫu nhiên, dài) ---
JWT_SECRET_KEY=day_la_key_bi_mat_cua_toi_ban_hay_thay_doi_no_12345

# --- Cấu hình Gmail để gửi mail ---
# (Dùng tài khoản Gmail và Mật khẩu Ứng dụng 16 chữ số)
MAIL_USERNAME=gmail_bac_ki    <- nhớ thay đổi
MAIL_PASSWORD=app_password    <- nhờ chatgpt chỉ lấy app password


3/ cách xài
	bấm chạy file server
	bấm file html.