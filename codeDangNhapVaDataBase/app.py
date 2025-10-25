import os
from flask import Flask, request, jsonify, send_from_directory # 1. THÊM send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import create_access_token, create_refresh_token, get_jwt_identity, jwt_required, JWTManager
from werkzeug.security import generate_password_hash, check_password_hash
from flask_cors import CORS # 2. IMPORT flask_cors

# --- 1. Thiết lập ứng dụng Flask ---
app = Flask(__name__)
CORS(app) # 3. KÍCH HOẠT CORS CHO TOÀN BỘ APP

# Cấu hình database SQLite
basedir = os.path.abspath(os.path.dirname(__file__))
# QUAN TRỌNG: Đặt tên file db là 'database.db3' để khớp với file của bạn
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'database.db3')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = 'your-super-secret-key' # Thay key bí mật của bạn vào đây

# Khởi tạo extensions
db = SQLAlchemy(app)
jwt = JWTManager(app)

# --- 2. Định nghĩa Model (Database) ---
# Model này khớp với file database.db3 của bạn
class User(db.Model):
    __tablename__ = 'users'
    
    id_users = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    # Khớp với tên cột 'pwd' trong file của bạn 
    pwd = db.Column(db.String(255), nullable=False) 
    # Khớp với cột 'refresh_token' của bạn 
    refresh_token = db.Column(db.String(512), nullable=True) 
    
    # Các cột khác (có thể thêm nếu cần dùng)
    # lat = db.Column(db.Float)
    # long = db.Column(db.Float)
    # created_at = db.Column(db.DateTime, server_default=db.func.now())
    # updated_at = db.Column(db.DateTime, onupdate=db.func.now())

    def __repr__(self):
        return f'<User {self.email}>'

# (Bạn cũng có thể định nghĩa các Model Product, Store, Location... ở đây)

# --- 3. API Endpoint: Đăng ký (/register) ---
@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    
    name = data.get('name')
    email = data.get('email')
    pwd = data.get('pwd') # Lấy 'pwd'

    if not name or not email or not pwd:
        return jsonify({"msg": "Thiếu name, email hoặc pwd"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"msg": "Email đã tồn tại"}), 400

    # --- SỬA LẠI CHỖ NÀY ---
    # Code MỚI (dùng Werkzeug)
    # Tự động tạo salt và hash, trả về 1 chuỗi
    hashed_password = generate_password_hash(pwd)

    new_user = User(
        name=name, 
        email=email, 
        pwd=hashed_password # Lưu trực tiếp chuỗi hash
    )
    # --- KẾT THÚC PHẦN SỬA ---
    
    db.session.add(new_user)
    db.session.commit()

    return jsonify({"msg": "Tạo tài khoản thành công"}), 201

# --- 4. API Endpoint: Đăng nhập (/login) ---
@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    
    email = data.get('email')
    pwd = data.get('pwd')

    if not email or not pwd:
        return jsonify({"msg": "Thiếu email hoặc pwd"}), 400

    user = User.query.filter_by(email=email).first()

    # Code MỚI (dùng Werkzeug)
    # Cú pháp: check_password_hash(hash_từ_database, password_user_nhập)
    if user and check_password_hash(user.pwd, pwd):
        
        # --- THAY ĐỔI QUAN TRỌNG Ở ĐÂY ---
        # Chuyển ID (là số nguyên) thành chuỗi (string)
        user_identity = str(user.id_users) 
        
        # Tạo token bằng ID đã chuyển thành chuỗi
        access_token = create_access_token(identity=user_identity)
        refresh_token = create_refresh_token(identity=user_identity)
        # --- KẾT THÚC THAY ĐỔI ---
        
        # LƯU refresh_token vào database
        user.refresh_token = refresh_token
        db.session.commit()
        
        return jsonify(
            access_token=access_token,
            refresh_token=refresh_token
        ), 200
    else:
        return jsonify({"msg": "Email hoặc mật khẩu không đúng"}), 401

# --- 5. API Endpoint: Làm mới Token (/refresh) ---
# (Hành vi MỚI)
@app.route('/refresh', methods=['POST'])
@jwt_required(refresh=True) # Yêu cầu đây phải là 1 refresh_token
def refresh():
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)

    # Kiểm tra xem user này có đang đăng nhập không
    # (nếu user.refresh_token là None, nghĩa là họ đã logout)
    if not user or not user.refresh_token:
        return jsonify({"msg": "Refresh token không hợp lệ hoặc đã bị thu hồi"}), 401

    # Tạo access_token mới
    new_access_token = create_access_token(identity=user.id_users)
    return jsonify(access_token=new_access_token), 200

# --- 6. API Endpoint: Đăng xuất (/logout) ---
# (Hành vi MỚI)
@app.route('/logout', methods=['POST'])
@jwt_required(refresh=True) # Yêu cầu refresh_token để logout
def logout():
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    # Logic quan trọng nhất:
    # Thu hồi token bằng cách xóa nó khỏi DB
    user.refresh_token = None
    db.session.commit()
    
    return jsonify({"msg": "Đăng xuất thành công"}), 200

# --- 7. API Endpoint: Test (Route được bảo vệ) ---
@app.route('/profile', methods=['GET'])
@jwt_required() 
def get_profile():
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)

    if user:
        return jsonify({
            "id": user.id_users,
            "name": user.name,
            "email": user.email
        }), 200
    else:
        return jsonify({"msg": "Không tìm thấy user"}), 404

# --- 8. Route để phục vụ file index.html ---
# Route này sẽ nằm GẦN CUỐI file, trước if __name__
@app.route('/') # Khi ai đó truy cập trang chủ
def serve_index():
    # Nó sẽ tìm file 'index.html' trong cùng thư mục
    return send_from_directory('.', 'index.html')

# --- 9. Chạy ứng dụng ---
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    
    app.run(debug=True)