import os
# --- THAY ĐỔI 1: Import 'datetime' và 'timedelta' ---
# datetime: Để lấy giờ hiện tại
# timedelta: Để cộng/trừ thời gian (chúng ta sẽ dùng để +7 tiếng)
from datetime import datetime, timedelta 
from flask import Flask, request, jsonify, send_from_directory
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

# --- KHỐI 1: THIẾT LẬP ỨNG DỤNG VÀ EXTENSIONS ---
# Khởi tạo ứng dụng Flask
app = Flask(__name__)
# Cho phép Frontend ở domain khác gọi được API
CORS(app)

# Cấu hình database SQLite
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'database.db3')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
# Chìa khóa bí mật để ký (sign) JWT token
app.config['JWT_SECRET_KEY'] = 'your-super-secret-key' # Nhớ đổi key này

# Khởi tạo các extensions
db = SQLAlchemy(app)
jwt = JWTManager(app)
bcrypt = Bcrypt(app) 

# --- KHỐI 2: ĐỊNH NGHĨA MODEL (DATABASE) ---
class User(db.Model):
    # Khai báo tên bảng
    __tablename__ = 'users'
    
    # Các cột cơ bản
    id_users = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    pwd = db.Column(db.String(255), nullable=False) 
    refresh_token = db.Column(db.String(512), nullable=True) 

    # --- THAY ĐỔI 2: Định nghĩa cột thời gian ---
    # Chúng ta sẽ không dùng 'default' hay 'onupdate' của server nữa
    # để chúng ta có thể kiểm soát 100% việc lưu giờ VN (GMT+7)
    created_at = db.Column(db.DateTime, nullable=True) # Sẽ set bằng tay khi đăng ký
    updated_at = db.Column(db.DateTime, nullable=True) # Sẽ set bằng tay ở mọi endpoint

    # Hàm đại diện, khi print(user) sẽ hiển thị email
    def __repr__(self):
        return f'<User {self.email}>'

# --- KHỐI 3: API ENDPOINT: ĐĂNG KÝ (/register) ---
@app.route('/register', methods=['POST'])
@jwt_required(optional=True) # Vẫn cho phép kiểm tra token (nếu có)
def register():
    # Chặn người đã đăng nhập
    current_user_id = get_jwt_identity()
    if current_user_id:
        return jsonify({"msg": "Bạn đã đăng nhập. Không thể đăng ký tài khoản mới."}), 403

    # Lấy dữ liệu
    data = request.get_json()
    name = data.get('name')
    email = data.get('email')
    pwd = data.get('pwd')

    # Validate (kiểm tra) dữ liệu
    if not name or not email or not pwd:
        return jsonify({"msg": "Thiếu name, email hoặc pwd"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"msg": "Email đã tồn tại"}), 400

    # Hash mật khẩu
    hashed_password = bcrypt.generate_password_hash(pwd).decode('utf-8')

    # --- THAY ĐỔI 3: Lấy giờ VN và set bằng tay khi tạo ---
    # Lấy giờ UTC hiện tại và cộng thêm 7 tiếng
    vn_time_now = datetime.utcnow() + timedelta(hours=7)

    # Tạo user mới
    new_user = User(
        name=name, 
        email=email, 
        pwd=hashed_password,
        created_at=vn_time_now,  # Set giờ tạo (giờ VN)
        updated_at=vn_time_now   # Set giờ hoạt động cuối (giờ VN)
    )
    
    # Lưu vào database
    db.session.add(new_user)
    db.session.commit()

    return jsonify({"msg": "Tạo tài khoản thành công"}), 201

# --- KHỐI 4: API ENDPOINT: ĐĂNG NHẬP (/login) ---
@app.route('/login', methods=['POST'])
@jwt_required(optional=True) # Vẫn cho phép kiểm tra token (nếu có)
def login():
    # Chặn người đã đăng nhập
    current_user_id = get_jwt_identity()
    if current_user_id:
        return jsonify({"msg": "Bạn đã đăng nhập rồi. Không thể đăng nhập lại."}), 403

    data = request.get_json()
    email = data.get('email')
    pwd = data.get('pwd')

    if not email or not pwd:
        return jsonify({"msg": "Thiếu email hoặc pwd"}), 400

    # Tìm user trong database
    user = User.query.filter_by(email=email).first()

    # Kiểm tra mật khẩu
    if user and bcrypt.check_password_hash(user.pwd, pwd):
        
        # Tạo tokens (luôn dùng string cho identity)
        user_identity = str(user.id_users) 
        access_token = create_access_token(identity=user_identity)
        refresh_token = create_refresh_token(identity=user_identity)
        
        # Lưu refresh token vào DB
        user.refresh_token = refresh_token
        
        # --- THAY ĐỔI 4: Cập nhật "Last Active" (giờ VN) ---
        user.updated_at = datetime.utcnow() + timedelta(hours=7)
        
        # Lưu cả 2 thay đổi vào DB
        db.session.commit()
        
        return jsonify(
            access_token=access_token,
            refresh_token=refresh_token
        ), 200
    else:
        # Sai email hoặc mật khẩu
        return jsonify({"msg": "Email hoặc mật khẩu không đúng"}), 401

# --- KHỐI 5: API ENDPOINT: LÀM MỚI TOKEN (/refresh) ---
@app.route('/refresh', methods=['POST'])
@jwt_required(refresh=True) # Bắt buộc phải có refresh_token
def refresh():
    # Lấy ID từ token
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)

    # Kiểm tra xem token có bị thu hồi (đã logout) không
    if not user or not user.refresh_token:
        return jsonify({"msg": "Refresh token không hợp lệ hoặc đã bị thu hồi"}), 401

    # --- THAY ĐỔI 5: Cập nhật "Last Active" (giờ VN) ---
    # Chỉ cần user gọi refresh, ta coi đó là 1 hành động "active"
    user.updated_at = datetime.utcnow() + timedelta(hours=7)
    db.session.commit() # Lưu lại thay đổi thời gian

    # Tạo access token mới (nhớ dùng str)
    new_access_token = create_access_token(identity=str(user.id_users))
    return jsonify(access_token=new_access_token), 200

# --- KHỐI 6: API ENDPOINT: ĐĂNG XUẤT (/logout) ---
@app.route('/logout', methods=['POST'])
@jwt_required(refresh=True) # Bắt buộc phải có refresh_token
def logout():
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    # Thu hồi token bằng cách xóa nó khỏi DB
    user.refresh_token = None
    
    # --- THAY ĐỔI 6: Cập nhật "Last Active" (giờ VN) ---
    # Logout cũng là một hành động "active"
    user.updated_at = datetime.utcnow() + timedelta(hours=7)

    # Lưu cả 2 thay đổi (token=None và updated_at)
    db.session.commit()
    
    return jsonify({"msg": "Đăng xuất thành công"}), 200

# --- KHỐI 7: API ENDPOINT: LẤY THÔNG TIN USER (/profile) ---
@app.route('/profile', methods=['GET'])
@jwt_required() # Bắt buộc phải có access_token
def get_profile():
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)

    if user:
        # --- THAY ĐỔI 7: Cập nhật "Last Active" (giờ VN) ---
        # Lấy profile cũng là một hành động "active"
        user.updated_at = datetime.utcnow() + timedelta(hours=7)
        db.session.commit() # Lưu lại thay đổi thời gian

        # Trả về thông tin user
        return jsonify({
            "id": user.id_users,
            "name": user.name,
            "email": user.email,
            "created_at": user.created_at.isoformat(), # Giờ tạo (giờ VN)
            "last_active": user.updated_at.isoformat() # Giờ hoạt động cuối (giờ VN)
        }), 200
    else:
        return jsonify({"msg": "Không tìm thấy user"}), 404

# --- KHỐI 8: ROUTE TRANG CHỦ (ĐỂ PHỤC VỤ file index.html) ---
@app.route('/')
def serve_index():
    # Gửi file 'index.html' trong cùng thư mục
    return send_from_directory('.', 'index.html')

# --- KHỐI 9: CHẠY ỨNG DỤNG ---
if __name__ == '__main__':
    # 'with app.app_context()' là cần thiết để SQLAlchemy biết nó đang chạy cho app nào
    with app.app_context():
        # Lệnh này sẽ tạo các bảng (như 'users') nếu chúng chưa tồn tại
        # Nếu bảng đã tồn tại, nó sẽ KHÔNG làm gì cả (an toàn)
        db.create_all()
    
    # Chạy server ở chế độ debug (tự khởi động lại khi có thay đổi code)
    app.run(debug=True)