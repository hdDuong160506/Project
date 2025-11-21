# -*- coding: utf-8 -*-
import os
import re
from flask import Flask, request, jsonify, send_from_directory, url_for
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
from flask_mailman import Mail
from flask_mailman.message import EmailMessage
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadTimeSignature
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from sqlalchemy.exc import IntegrityError

# Tải các biến môi trường từ file .env
load_dotenv()

# --- HÀM HELPER ---
def get_vn_time():
    """Lấy giờ hiện tại theo múi giờ Việt Nam (UTC+7)."""
    return datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=7)

def is_valid_email(email):
    """Kiểm tra format email có hợp lệ không."""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

# --- THIẾT LẬP ỨNG DỤNG FLASK ---
app = Flask(__name__)

# Cấu hình CORS - Cho phép tất cả origins trong môi trường dev
CORS(app, resources={r"/*": {
    "origins": "*",
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization"],
    "expose_headers": ["Content-Type", "Authorization"],
    "supports_credentials": False
}})

# --- CẤU HÌNH ---
SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'default-fallback-key-rat-ngau-nhien')

# Cấu hình Database
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'database.db3')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Cấu hình JWT
app.config['JWT_SECRET_KEY'] = SECRET_KEY
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=1)
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=30)

# Cấu hình Flask-Mailman
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

# Khởi tạo Mail - QUAN TRỌNG: Phải khởi tạo ĐÚNG CÁCH
mail = Mail()
mail.init_app(app)

# Khởi tạo bộ tạo token
s = URLSafeTimedSerializer(SECRET_KEY)
TOKEN_SALT = 'email-verification-salt'

# --- ĐỊNH NGHĨA MODEL ---
class User(db.Model):
    __tablename__ = 'users'
    
    id_users = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.Text, nullable=False)
    email = db.Column(db.Text, unique=True, nullable=False)
    pwd = db.Column(db.Text, nullable=False)
    lat = db.Column(db.Float, nullable=True)  # Latitude (vĩ độ) - Dùng Float thay vì Real
    long = db.Column(db.Float, nullable=True)  # Longitude (kinh độ) - Dùng Float thay vì Real
    refresh_token = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, nullable=True, default=get_vn_time)
    updated_at = db.Column(db.DateTime, nullable=True, default=get_vn_time, onupdate=get_vn_time)
    verification = db.Column(db.Boolean, nullable=False, default=False)  # Tên cột là 'verification' chứ không phải 'is_verified'

    def __repr__(self):
        return f'<User {self.email}>'

# --- API ENDPOINT: ĐĂNG KÝ ---
@app.route('/register', methods=['POST'])
@jwt_required(optional=True)
def register():
    # Chặn người đã đăng nhập
    if get_jwt_identity():
        return jsonify({"msg": "Bạn đã đăng nhập. Không thể đăng ký tài khoản mới."}), 403

    data = request.get_json()
    
    # Validate input
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

    # Kiểm tra xem user có tồn tại không
    existing_user = User.query.filter_by(email=email).first()
    if existing_user:
        if existing_user.verification:  # Đổi từ is_verified thành verification
            return jsonify({"msg": "Email đã tồn tại"}), 400
        else:
            return jsonify({"msg": "Email này đã đăng ký nhưng chưa kích hoạt. Vui lòng kiểm tra email."}), 400

    hashed_password = bcrypt.generate_password_hash(pwd).decode('utf-8')
    vn_time_now = get_vn_time()

    # Tạo user mới
    new_user = User(
        name=name,
        email=email,
        pwd=hashed_password,
        created_at=vn_time_now,
        updated_at=vn_time_now,
        verification=False,  # Đổi từ is_verified thành verification
        lat=10.8231,  # Tọa độ mặc định: Sài Gòn (latitude)
        long=106.6297  # Tọa độ mặc định: Sài Gòn (longitude)
    )
    
    # Gửi Email
    try:
        # 1. Tạo token xác thực
        token = s.dumps(email, salt=TOKEN_SALT)

        # 2. Tạo link xác thực
        verification_url = url_for('verify_email', token=token, _external=True)

        # 3. Soạn email
        subject = "Xác thực tài khoản"
        body = f"Chào {name},\n\n" \
               f"Cảm ơn bạn đã đăng ký! Vui lòng bấm vào link sau để kích hoạt tài khoản:\n" \
               f"{verification_url}\n\n" \
               f"Link này sẽ hết hạn sau 1 giờ.\n\n" \
               f"Nếu bạn không đăng ký tài khoản này, vui lòng bỏ qua email này."
        
        # 4. Tạo đối tượng Message
        msg = EmailMessage(
            subject=subject,
            body=body,
            to=[email]
        )
        
        # 5. Gửi email - ĐÚNG CÁCH với flask-mailman
        msg.send()
        
        # 6. Lưu user vào DB (với race condition protection)
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
        return jsonify({"msg": "Gửi email xác thực thất bại. Vui lòng kiểm tra lại cấu hình mail."}), 500

# --- API ENDPOINT: XÁC THỰC EMAIL ---
@app.route('/verify-email/<token>', methods=['GET'])
def verify_email(token):
    try:
        # Giải mã token
        email = s.loads(token, salt=TOKEN_SALT, max_age=3600)
        
        user = User.query.filter_by(email=email).first()
        
        if not user:
            return """
            <html>
            <head><meta charset="UTF-8"></head>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
                <h1 style="color: #f44336;">❌ Lỗi</h1>
                <p>Không tìm thấy người dùng.</p>
            </body>
            </html>
            """, 404
            
        if user.verification:  # Đã kích hoạt rồi
            return """
            <html>
            <head><meta charset="UTF-8"></head>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
                <h1 style="color: #4CAF50;">✅ Đã kích hoạt</h1>
                <p>Tài khoản này đã được kích hoạt trước đó.</p>
                <p>Bạn có thể đăng nhập ngay.</p>
            </body>
            </html>
            """, 200

        # Kích hoạt user
        user.verification = True
        user.updated_at = get_vn_time()
        db.session.commit()
        
        return """
        <html>
        <head><meta charset="UTF-8"></head>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1 style="color: #4CAF50;">🎉 Xác thực thành công!</h1>
            <p>Tài khoản của bạn đã được kích hoạt.</p>
            <p>Bạn có thể đóng tab này và quay lại trang đăng nhập.</p>
        </body>
        </html>
        """, 200

    except SignatureExpired:
        return """
        <html>
        <head><meta charset="UTF-8"></head>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1 style="color: #f44336;">⏰ Link đã hết hạn</h1>
            <p>Link xác thực đã hết hạn (quá 1 giờ).</p>
            <p>Vui lòng thử đăng ký lại.</p>
        </body>
        </html>
        """, 400
    except (BadTimeSignature, Exception) as e:
        app.logger.error(f"Lỗi verify email: {str(e)}")
        return """
        <html>
        <head><meta charset="UTF-8"></head>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1 style="color: #f44336;">❌ Lỗi</h1>
            <p>Link xác thực không hợp lệ.</p>
        </body>
        </html>
        """, 400

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

    # Tránh timing attack
    if user:
        is_valid = bcrypt.check_password_hash(user.pwd, pwd)
    else:
        # Dummy check để timing giống nhau
        bcrypt.check_password_hash(bcrypt.generate_password_hash("dummy"), pwd)
        is_valid = False

    if is_valid and user:
        # Kiểm tra xác thực
        if not user.verification:  # Đổi từ is_verified thành verification
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

# --- API ENDPOINT: LÀM MỚI TOKEN ---
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

# --- API ENDPOINT: ĐĂNG XUẤT ---
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

# --- API ENDPOINT: LẤY THÔNG TIN USER ---
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
            "verification": user.verification,  # Đổi từ is_verified thành verification
            "lat": user.lat,
            "long": user.long
        }), 200
    else:
        return jsonify({"msg": "Không tìm thấy user"}), 404

# --- ROUTE TRANG CHỦ ---
@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

# --- ERROR HANDLERS ---
@app.errorhandler(404)
def not_found(e):
    return jsonify({"msg": "Endpoint không tồn tại"}), 404

@app.errorhandler(500)
def internal_error(e):
    return jsonify({"msg": "Lỗi server"}), 500

# --- CHẠY ỨNG DỤNG ---
if __name__ == '__main__':
    with app.app_context():
        # KHÔNG tạo lại database nếu đã có
        # db.create_all() sẽ không ghi đè table hiện có
        db.create_all()
        print("✅ Database đã sẵn sàng!")
        print(f"📧 Mail server: {app.config['MAIL_USERNAME']}")
        print(f"🔑 Mail configured: {app.config['MAIL_USERNAME'] is not None}")
        print(f"🔒 JWT Secret: {SECRET_KEY[:20]}...")
        
        # Kiểm tra mail config
        if not app.config['MAIL_USERNAME'] or not app.config['MAIL_PASSWORD']:
            print("⚠️  CẢNH BÁO: Thiếu cấu hình email trong file .env!")
            print("   Vui lòng thêm MAIL_USERNAME và MAIL_PASSWORD vào file .env")
    
    app.run(debug=True, host='127.0.0.1', port=5000)