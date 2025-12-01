from flask import Flask, send_from_directory
from flask_cors import CORS

# Load Config
from config import Config

# -----------------------------------------------------
# IMPORT CÁC BLUEPRINT
# -----------------------------------------------------
# 1. Các Blueprint cũ
from routes.search_routes import search_bp
from routes.review_routes import review_bp
from routes.api_routes import api_bp

# 2. [NEW] Blueprint bản đồ từ folder 'map'
# Python sẽ tìm file __init__.py trong folder 'backend/map'
from map import map_bp 

# -----------------------------------------------------
# KHỞI TẠO APP
# -----------------------------------------------------
# static_folder="../static": trỏ ra folder static nằm ngoài backend
app = Flask(__name__, static_folder="../static", static_url_path="")

# Load cấu hình
app.config.from_object(Config)

# Cấu hình CORS
CORS(
    app,
    resources={
        r"/*": {
            "origins": "*",
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "expose_headers": ["Content-Type", "Authorization"],
            "supports_credentials": False,
        }
    },
)

# -----------------------------------------------------
# ĐĂNG KÝ (REGISTER) BLUEPRINTS
# -----------------------------------------------------

# 1. Đăng ký các API cũ
# (Giữ nguyên logic cũ của bạn)
app.register_blueprint(api_bp) 
app.register_blueprint(search_bp)
app.register_blueprint(review_bp)

# 2. [NEW] Đăng ký Map Blueprint
# url_prefix='/map': 
# - Trang web bản đồ sẽ là: http://localhost:5000/map/
# - API của bản đồ sẽ là: http://localhost:5000/map/api/stores
app.register_blueprint(map_bp, url_prefix='/map')


# -----------------------------------------------------
# ROUTES PHỤC VỤ STATIC FILES CHUNG
# -----------------------------------------------------

@app.route("/")
def home():
    """Phục vụ trang chủ (index.html) khi vào localhost:5000"""
    return send_from_directory(app.static_folder, "index.html")

# Route catch-all: Phục vụ các file css, js, images khác trong thư mục static
# Lưu ý: Flask sẽ ưu tiên check các route blueprint bên trên trước.
# Nếu không khớp route nào bên trên thì mới chạy vào đây.
@app.route("/<path:path>")
def serve_static(path):
    return send_from_directory(app.static_folder, path)

# -----------------------------------------------------
# CHẠY SERVER
# -----------------------------------------------------
if __name__ == "__main__":
    print("\n--- SERVER STARTING ---")
    print(f"🚀 Main Server:    http://127.0.0.1:5000")
    print(f"🗺️  Map Module:     http://127.0.0.1:5000/map/")
    print(f"📂 Static Folder:  {app.static_folder}")
    print("-----------------------\n")

    app.run(debug=True, host="127.0.0.1", port=5000)