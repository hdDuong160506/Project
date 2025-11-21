# -*- coding: utf-8 -*-
import os
import re
import random
from flask import redirect, session, Flask, request, jsonify, send_from_directory, url_for
from authlib.integrations.flask_client import OAuth
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    get_jwt_identity,
    jwt_required,
    JWTManager
)
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from flask_mailman import Mail, EmailMessage
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadTimeSignature
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from sqlalchemy.exc import IntegrityError

load_dotenv()

# --- HÀM HELPER ---
def get_vn_time():
    """Lấy giờ hiện tại theo múi giờ Việt Nam (UTC+7)."""
    return (datetime.utcnow() + timedelta(hours=7)).replace(microsecond=0)

def is_valid_email(email):
    """Kiểm tra format email có hợp lệ không."""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def generate_otp():
    """Tạo mã OTP 6 số ngẫu nhiên."""
    return ''.join([str(random.randint(0, 9)) for _ in range(6)])

# --- THIẾT LẬP ỨNG DỤNG FLASK ---
app = Flask(__name__)

CORS(app, resources={r"/*": {
    "origins": "*",
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization"],
    "expose_headers": ["Content-Type", "Authorization"],
    "supports_credentials": False
}})

# --- CẤU HÌNH ---
SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'default-fallback-key-rat-ngau-nhien')
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'database.db3')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = SECRET_KEY
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=1)
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=30)
app.config['SECRET_KEY'] = SECRET_KEY
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD')
app.config['MAIL_DEFAULT_SENDER'] = os.getenv('MAIL_USERNAME')

# --- KHỞI TẠO CÁC EXTENSIONS ---
db = SQLAlchemy(app)
jwt = JWTManager(app)
bcrypt = Bcrypt(app)
mail = Mail()
mail.init_app(app)
s = URLSafeTimedSerializer(SECRET_KEY)
TOKEN_SALT = 'email-verification-salt'

# --- CẤU HÌNH OAUTH (CHỈ GOOGLE) ---
oauth = OAuth(app)

oauth.register(
    name='google',
    client_id=os.getenv('GOOGLE_CLIENT_ID'),
    client_secret=os.getenv('GOOGLE_CLIENT_SECRET'),
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'}
)

# --- ĐỊNH NGHĨA MODEL ---
class User(db.Model):
    __tablename__ = 'users'
    
    id_users = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.Text, nullable=False)
    email = db.Column(db.Text, unique=True, nullable=False)
    pwd = db.Column(db.Text, nullable=True)
    lat = db.Column(db.Float, nullable=True)
    long = db.Column(db.Float, nullable=True)
    refresh_token = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, nullable=True, default=get_vn_time)
    updated_at = db.Column(db.DateTime, nullable=True, default=get_vn_time, onupdate=get_vn_time)
    verification = db.Column(db.Boolean, nullable=False, default=False)
    google_id = db.Column(db.Text, unique=True, nullable=True)
    
    # Thêm cột cho OTP reset password
    reset_otp = db.Column(db.Text, nullable=True)
    reset_otp_expires = db.Column(db.DateTime, nullable=True)

    def __repr__(self):
        return f'<User {self.email}>'

# --- HÀM HELPER CHO SOCIAL LOGIN ---
def _process_social_login(user_info, provider_name, provider_id):
    """Tìm hoặc Tạo user cho Google login."""
    email = user_info.get('email', '').lower()
    name = user_info.get('name', '')
    social_id = str(provider_id)
    
    if not email:
        raise Exception(f"Không nhận được email từ {provider_name.title()}.")

    user = User.query.filter_by(email=email).first()
    
    if user:
        if not user.google_id:
            user.google_id = social_id
        user.verification = True
        user.updated_at = get_vn_time()
        db.session.commit()
    else:
        user = User(
            name=name,
            email=email,
            pwd=None,
            verification=True,
            created_at=get_vn_time(),
            updated_at=get_vn_time(),
            lat=10.8231,
            long=106.6297,
            google_id=social_id
        )
        db.session.add(user)
        
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            user = User.query.filter_by(email=email).first()
            if not user:
                raise Exception("Lỗi tạo tài khoản, vui lòng thử lại.")
            user.verification = True
            db.session.commit()
    
    return user

# --- API ENDPOINT: ĐĂNG KÝ ---
@app.route('/register', methods=['POST'])
@jwt_required(optional=True)
def register():
    if get_jwt_identity():
        return jsonify({"msg": "Bạn đã đăng nhập. Không thể đăng ký tài khoản mới."}), 403

    data = request.get_json()
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    pwd = data.get('pwd', '')

    if not name or not email or not pwd:
        return jsonify({"msg": "Thiếu name, email hoặc pwd"}), 400
    
    if len(name) < 2 or len(name) > 100:
        return jsonify({"msg": "Tên phải có từ 2-100 ký tự"}), 400
    
    if not is_valid_email(email):
        return jsonify({"msg": "Email không hợp lệ"}), 400
    
    if len(pwd) < 6:
        return jsonify({"msg": "Mật khẩu phải có ít nhất 6 ký tự"}), 400

    existing_user = User.query.filter_by(email=email).first()
    if existing_user:
        if existing_user.verification:
            return jsonify({"msg": "Email đã tồn tại"}), 400
        else:
            return jsonify({"msg": "Email này đã đăng ký nhưng chưa kích hoạt. Vui lòng kiểm tra email."}), 400

    hashed_password = bcrypt.generate_password_hash(pwd).decode('utf-8')
    vn_time_now = get_vn_time()

    new_user = User(
        name=name,
        email=email,
        pwd=hashed_password,
        created_at=vn_time_now,
        updated_at=vn_time_now,
        verification=False,
        lat=10.8231,
        long=106.6297
    )
    
    try:
        token = s.dumps(email, salt=TOKEN_SALT)
        verification_url = url_for('verify_email', token=token, _external=True)

        subject = "Xác thực tài khoản"
        body = f"Chào {name},\n\n" \
               f"Cảm ơn bạn đã đăng ký! Vui lòng bấm vào link sau để kích hoạt tài khoản:\n" \
               f"{verification_url}\n\n" \
               f"Link này sẽ hết hạn sau 1 giờ.\n\n" \
               f"Nếu bạn không đăng ký tài khoản này, vui lòng bỏ qua email này."
        
        msg = EmailMessage(
            subject=subject,
            body=body,
            to=[email]
        )
        msg.send()
        
        try:
            db.session.add(new_user)
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            return jsonify({"msg": "Email đã tồn tại"}), 400

        return jsonify({"msg": "Đăng ký thành công! Vui lòng kiểm tra email để kích hoạt tài khoản."}), 201

    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Lỗi gửi email: {str(e)}")
        return jsonify({"msg": "Gửi email xác thực thất bại.", "error": str(e)}), 500

# --- API ENDPOINT: XÁC THỰC EMAIL ---
@app.route('/verify-email/<token>', methods=['GET'])
def verify_email(token):
    try:
        email = s.loads(token, salt=TOKEN_SALT, max_age=3600)
        user = User.query.filter_by(email=email).first()
        
        if not user:
            return """
            <html><head><meta charset="UTF-8"></head>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
                <h1 style="color: #f44336;">❌ Lỗi</h1>
                <p>Không tìm thấy người dùng.</p>
            </body></html>""", 404
            
        if user.verification:
            return """
            <html><head><meta charset="UTF-8"></head>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
                <h1 style="color: #4CAF50;">✅ Đã kích hoạt</h1>
                <p>Tài khoản này đã được kích hoạt trước đó.</p>
                <p><a href="/?verified=true" style="color: #667eea; text-decoration: none;">← Quay lại trang đăng nhập</a></p>
            </body></html>""", 200

        user.verification = True
        user.updated_at = get_vn_time()
        db.session.commit()
        
        return f"""
        <html><head><meta charset="UTF-8">
        <script>
            // Tự động đóng tab sau 3 giây và thông báo cho trang chính
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

    except SignatureExpired:
        return """
        <html><head><meta charset="UTF-8"></head>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1 style="color: #f44336;">⏰ Link đã hết hạn</h1>
            <p>Link xác thực đã hết hạn (quá 1 giờ).</p>
            <p><a href="/" style="color: #667eea; text-decoration: none;">← Quay lại trang chủ</a></p>
        </body></html>""", 400
    except (BadTimeSignature, Exception) as e:
        app.logger.error(f"Lỗi verify email: {str(e)}")
        return """
        <html><head><meta charset="UTF-8"></head>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1 style="color: #f44336;">❌ Lỗi</h1>
            <p>Link xác thực không hợp lệ.</p>
            <p><a href="/" style="color: #667eea; text-decoration: none;">← Quay lại trang chủ</a></p>
        </body></html>""", 400

# --- API ENDPOINT: ĐĂNG NHẬP ---
@app.route('/login', methods=['POST'])
@jwt_required(optional=True)
def login():
    if get_jwt_identity():
        return jsonify({"msg": "Bạn đã đăng nhập rồi. Không thể đăng nhập lại."}), 403

    data = request.get_json()
    email = data.get('email', '').strip().lower()
    pwd = data.get('pwd', '')

    if not email or not pwd:
        return jsonify({"msg": "Thiếu email hoặc pwd"}), 400

    user = User.query.filter_by(email=email).first()

    if not user or not user.pwd:
        bcrypt.check_password_hash(bcrypt.generate_password_hash("dummy"), pwd)
        return jsonify({"msg": "Email hoặc mật khẩu không đúng"}), 401

    if bcrypt.check_password_hash(user.pwd, pwd):
        if not user.verification:
            return jsonify({"msg": "Tài khoản chưa được kích hoạt. Vui lòng kiểm tra email."}), 403
        
        user_identity = str(user.id_users)
        access_token = create_access_token(identity=user_identity)
        refresh_token = create_refresh_token(identity=user_identity)
        
        user.refresh_token = refresh_token
        user.updated_at = get_vn_time()
        db.session.commit()
        
        return jsonify(
            access_token=access_token,
            refresh_token=refresh_token,
            user={
                "id": user.id_users,
                "name": user.name,
                "email": user.email
            }
        ), 200
    else:
        return jsonify({"msg": "Email hoặc mật khẩu không đúng"}), 401

# --- GOOGLE LOGIN ENDPOINTS ---
@app.route('/login/google')
def login_google_redirect():
    """Chuyển hướng user đến Google."""
    redirect_uri = url_for('google_callback', _external=True)
    return oauth.google.authorize_redirect(redirect_uri)

@app.route('/login/google/callback')
def google_callback():
    """Xử lý thông tin Google trả về."""
    try:
        token = oauth.google.authorize_access_token()
        resp = oauth.google.get('https://www.googleapis.com/oauth2/v3/userinfo')
        user_info = resp.json()
        
        user = _process_social_login(user_info, 'google', user_info['sub'])
        
        user_identity = str(user.id_users)
        access_token = create_access_token(identity=user_identity)
        refresh_token = create_refresh_token(identity=user_identity)
        
        user.refresh_token = refresh_token
        db.session.commit()
        
        return redirect(f'/?access_token={access_token}&refresh_token={refresh_token}')
        
    except Exception as e:
        app.logger.error(f"Lỗi Google Callback: {str(e)}")
        import traceback
        app.logger.error(traceback.format_exc())
        return redirect(f'/?error=Loi_Google_Login')

# --- API ENDPOINT: QUÊN MẬT KHẨU - GỬI OTP ---
@app.route('/forgot-password', methods=['POST'])
def forgot_password():
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    
    if not email:
        return jsonify({"msg": "Thiếu email"}), 400
    
    if not is_valid_email(email):
        return jsonify({"msg": "Email không hợp lệ"}), 400
    
    user = User.query.filter_by(email=email).first()
    
    if not user:
        # Không tiết lộ email có tồn tại hay không (bảo mật)
        return jsonify({"msg": "Nếu email tồn tại, mã OTP đã được gửi."}), 200
    
    if not user.verification:
        return jsonify({"msg": "Tài khoản chưa được kích hoạt."}), 403
    
    # Tạo mã OTP 6 số
    otp_code = generate_otp()
    otp_expires = get_vn_time() + timedelta(minutes=10)  # Hết hạn sau 10 phút
    
    user.reset_otp = otp_code
    user.reset_otp_expires = otp_expires
    user.updated_at = get_vn_time()
    
    try:
        db.session.commit()
        
        subject = "Mã OTP đặt lại mật khẩu"
        body = f"Chào {user.name},\n\n" \
               f"Bạn đã yêu cầu đặt lại mật khẩu. Mã OTP của bạn là:\n\n" \
               f"    {otp_code}\n\n" \
               f"Mã này sẽ hết hạn sau 10 phút.\n\n" \
               f"Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này."
        
        msg = EmailMessage(
            subject=subject,
            body=body,
            to=[email]
        )
        msg.send()
        
        return jsonify({"msg": "Mã OTP đã được gửi đến email của bạn."}), 200
        
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Lỗi gửi OTP: {str(e)}")
        return jsonify({"msg": "Gửi OTP thất bại.", "error": str(e)}), 500

# --- API ENDPOINT: XÁC THỰC OTP ---
@app.route('/verify-otp', methods=['POST'])
def verify_otp():
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    otp = data.get('otp', '').strip()
    
    if not email or not otp:
        return jsonify({"msg": "Thiếu email hoặc OTP"}), 400
    
    if len(otp) != 6 or not otp.isdigit():
        return jsonify({"msg": "OTP phải là 6 chữ số"}), 400
    
    user = User.query.filter_by(email=email).first()
    
    if not user or not user.reset_otp:
        return jsonify({"msg": "OTP không hợp lệ hoặc đã hết hạn"}), 401
    
    # Kiểm tra OTP đã hết hạn chưa
    if user.reset_otp_expires < get_vn_time():
        user.reset_otp = None
        user.reset_otp_expires = None
        db.session.commit()
        return jsonify({"msg": "OTP đã hết hạn. Vui lòng yêu cầu mã mới."}), 401
    
    # Kiểm tra OTP có đúng không
    if user.reset_otp != otp:
        return jsonify({"msg": "OTP không đúng"}), 401
    
    # OTP hợp lệ - tạo token tạm thời để đổi mật khẩu
    reset_token = s.dumps(email, salt='password-reset-salt')
    
    return jsonify({
        "msg": "Xác thực OTP thành công",
        "reset_token": reset_token
    }), 200

# --- API ENDPOINT: ĐẶT LẠI MẬT KHẨU ---
@app.route('/reset-password', methods=['POST'])
def reset_password():
    data = request.get_json()
    reset_token = data.get('reset_token', '')
    new_pwd = data.get('new_pwd', '')
    
    if not reset_token or not new_pwd:
        return jsonify({"msg": "Thiếu reset_token hoặc new_pwd"}), 400
    
    if len(new_pwd) < 6:
        return jsonify({"msg": "Mật khẩu mới phải có ít nhất 6 ký tự"}), 400
    
    try:
        # Giải mã token (hết hạn sau 15 phút)
        email = s.loads(reset_token, salt='password-reset-salt', max_age=900)
        user = User.query.filter_by(email=email).first()
        
        if not user:
            return jsonify({"msg": "Token không hợp lệ"}), 401
        
        # Cập nhật mật khẩu mới
        hashed_password = bcrypt.generate_password_hash(new_pwd).decode('utf-8')
        user.pwd = hashed_password
        user.reset_otp = None
        user.reset_otp_expires = None
        user.updated_at = get_vn_time()
        
        # Xóa tất cả refresh token cũ (bắt buộc đăng nhập lại)
        user.refresh_token = None
        
        db.session.commit()
        
        return jsonify({"msg": "Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại."}), 200
        
    except SignatureExpired:
        return jsonify({"msg": "Token đã hết hạn"}), 401
    except Exception as e:
        app.logger.error(f"Lỗi reset password: {str(e)}")
        return jsonify({"msg": "Token không hợp lệ"}), 401

# --- ENDPOINT REFRESH TOKEN ---
@app.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if not user or not user.refresh_token:
        return jsonify({"msg": "Refresh token không hợp lệ hoặc đã bị thu hồi"}), 401
    user.updated_at = get_vn_time()
    db.session.commit()
    new_access_token = create_access_token(identity=str(user.id_users))
    return jsonify(access_token=new_access_token), 200

# --- ENDPOINT LOGOUT ---
@app.route('/logout', methods=['POST'])
@jwt_required(refresh=True)
def logout():
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if user:
        user.refresh_token = None
        user.updated_at = get_vn_time()
        db.session.commit()
    return jsonify({"msg": "Đăng xuất thành công"}), 200

# --- ENDPOINT: XEM THÔNG TIN USER ---
@app.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if user:
        user.updated_at = get_vn_time()
        db.session.commit()
        return jsonify({
            "id": user.id_users,
            "name": user.name,
            "email": user.email,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "last_active": user.updated_at.isoformat() if user.updated_at else None,
            "verification": user.verification,
            "lat": user.lat,
            "long": user.long,
            "has_google": user.google_id is not None
        }), 200
    else:
        return jsonify({"msg": "Không tìm thấy user"}), 404
    
# --- ENDPOINT: CẬP NHẬT VỊ TRÍ NGƯỜI DÙNG ---
@app.route('/update-location', methods=['POST'])
@jwt_required()
def update_location():
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user:
        return jsonify({"msg": "Không tìm thấy user"}), 404
    
    data = request.get_json()
    lat = data.get('lat')
    long = data.get('long')
    
    if lat is None or long is None:
        return jsonify({"msg": "Thiếu thông tin tọa độ"}), 400
    
    try:
        lat = float(lat)
        long = float(long)
        if not (-90 <= lat <= 90) or not (-180 <= long <= 180):
            return jsonify({"msg": "Tọa độ không hợp lệ"}), 400
    except (ValueError, TypeError):
        return jsonify({"msg": "Tọa độ phải là số"}), 400
    
    user.lat = lat
    user.long = long
    user.updated_at = get_vn_time()
    db.session.commit()
    
    return jsonify({"msg": "Cập nhật vị trí thành công"}), 200

# --- CÁC ENDPOINT NHƯ LỖI ... ---
@app.route('/')
def serve_index():
    return send_from_directory('.', 'html_update.html')

@app.errorhandler(404)
def not_found(e):
    return jsonify({"msg": "Endpoint không tồn tại"}), 404

@app.errorhandler(500)
def internal_error(e):
    app.logger.error(f"Lỗi 500: {str(e)}")
    return jsonify({"msg": "Lỗi server"}), 500


# --- ENDPOINT CHÍNH SÁCH ---
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

# --- CHẠY ỨNG DỤNG ---
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        print("✅ Database đã sẵn sàng!")
        print(f"📧 Mail: {app.config['MAIL_USERNAME']}")
        print(f"🔑 Google ID: {os.getenv('GOOGLE_CLIENT_ID')[:20] if os.getenv('GOOGLE_CLIENT_ID') else 'CHƯA CÓ'}...")
    
    app.run(debug=True, host='127.0.0.1', port=5000)