from flask import Flask, send_from_directory
from flask_cors import CORS
from config import Config
from routes.api_routes import api_bp

# Khởi tạo App
# Giả sử thư mục 'static' nằm ngang hàng với thư mục 'backend'
# Cấu trúc:
#  - static/
#  - backend/ (chúng ta đang ở đây)
app = Flask(__name__, static_folder='../static', static_url_path='')

# Load cấu hình
app.config.from_object(Config)

# Cấu hình CORS
CORS(app)

# Đăng ký các API Routes
app.register_blueprint(api_bp)

# --- Route phục vụ file HTML (Frontend) ---
@app.route('/')
def home():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

# --- Chạy Server ---
if __name__ == '__main__':
    print(f"🚀 Server đang chạy tại: http://127.0.0.1:5000")
    print(f"📂 Đang phục vụ static từ: {app.static_folder}")
    app.run(debug=True, port=5000)