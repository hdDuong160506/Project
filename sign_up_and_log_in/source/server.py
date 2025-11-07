import os
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

# --- 1. Thiết lập ứng dụng Flask ---
app = Flask(__name__)
CORS(app)

# Cấu hình database SQLite
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'database.db3')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = 'your-super-secret-key'

# Khởi tạo extensions
db = SQLAlchemy(app)
jwt = JWTManager(app)
# --- THAY ĐỔI 2: KHỞI TẠO BCRYPT ---
bcrypt = Bcrypt(app) 

# --- 2. Định nghĩa Model (Database) ---
class User(db.Model):
    __tablename__ = 'users'
    
    id_users = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    pwd = db.Column(db.String(255), nullable=False) 
    refresh_token = db.Column(db.String(512), nullable=True) 

    def __repr__(self):
        return f'<User {self.email}>'

# --- 3. API Endpoint: Đăng ký (/register) ---
@app.route('/register', methods=['POST'])
@jwt_required(optional=True) # <-- THAY ĐỔI 2: Cho phép kiểm tra token (nếu có)
def register():
    # --- THAY ĐỔI 3: KIỂM TRA XEM USER ĐÃ ĐĂNG NHẬP CHƯA ---
    current_user_id = get_jwt_identity()
    if current_user_id:
        return jsonify({"msg": "Bạn đã đăng nhập. Không thể đăng ký tài khoản mới."}), 403 # 403 Forbidden
    # --- KẾT THÚC THAY ĐỔI ---

    data = request.get_json()
    
    name = data.get('name')
    email = data.get('email')
    pwd = data.get('pwd')

    if not name or not email or not pwd:
        return jsonify({"msg": "Thiếu name, email hoặc pwd"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"msg": "Email đã tồn tại"}), 400

    hashed_password = bcrypt.generate_password_hash(pwd).decode('utf-8')

    new_user = User(
        name=name, 
        email=email, 
        pwd=hashed_password
    )
    
    db.session.add(new_user)
    db.session.commit()

    return jsonify({"msg": "Tạo tài khoản thành công"}), 201

# --- 4. API Endpoint: Đăng nhập (/login) ---
@app.route('/login', methods=['POST'])
@jwt_required(optional=True) # <-- THAY ĐỔI 4: Cho phép kiểm tra token (nếu có)
def login():
    # --- THAY ĐỔI 5: KIỂM TRA XEM USER ĐÃ ĐĂNG NHẬP CHƯA ---
    current_user_id = get_jwt_identity()
    if current_user_id:
        return jsonify({"msg": "Bạn đã đăng nhập rồi. Không thể đăng nhập lại."}), 403 # 403 Forbidden
    # --- KẾT THÚC THAY ĐỔI ---

    data = request.get_json()
    
    email = data.get('email')
    pwd = data.get('pwd')

    if not email or not pwd:
        return jsonify({"msg": "Thiếu email hoặc pwd"}), 400

    user = User.query.filter_by(email=email).first()

    if user and bcrypt.check_password_hash(user.pwd, pwd):
        
        user_identity = str(user.id_users) 
        
        access_token = create_access_token(identity=user_identity)
        refresh_token = create_refresh_token(identity=user_identity)
        
        user.refresh_token = refresh_token
        db.session.commit()
        
        return jsonify(
            access_token=access_token,
            refresh_token=refresh_token
        ), 200
    else:
        return jsonify({"msg": "Email hoặc mật khẩu không đúng"}), 401

# --- 5. API Endpoint: Làm mới Token (/refresh) ---
@app.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)

    if not user or not user.refresh_token:
        return jsonify({"msg": "Refresh token không hợp lệ hoặc đã bị thu hồi"}), 401

    new_access_token = create_access_token(identity=user.id_users)
    return jsonify(access_token=new_access_token), 200

# --- 6. API Endpoint: Đăng xuất (/logout) ---
@app.route('/logout', methods=['POST'])
@jwt_required(refresh=True)
def logout():
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
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
@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

# --- 9. Chạy ứng dụng ---
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    
    app.run(debug=True)