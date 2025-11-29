from flask import Flask, send_from_directory
from flask_cors import CORS

# [CẬP NHẬT] Thay thế config cũ bằng config mới
from config import Config

# [CẬP NHẬT] Import các Blueprint mới từ app.py
from routes.search_routes import search_bp
from routes.review_routes import review_bp
from routes.api_routes import api_bp


# Khởi tạo App
# Giả sử thư mục 'static' nằm ngang hàng với thư mục 'backend'
# Cấu trúc:
#  - static/
#  - backend/ (chúng ta đang ở đây)
app = Flask(__name__, static_folder="../static", static_url_path="")

# Load cấu hình
app.config.from_object(Config)

# [CẬP NHẬT] Cấu hình CORS chi tiết hơn từ app.py
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

# [CẬP NHẬT] Đăng ký các API Routes mới
# API check_email sẽ chạy tại đường dẫn: /api/user/check_email (do Blueprint không có url_prefix)
app.register_blueprint(api_bp) 
# API search sẽ chạy tại đường dẫn: /api/products
app.register_blueprint(search_bp)
# API reviews sẽ chạy tại đường dẫn: /api/reviews và /api/product_detail
app.register_blueprint(review_bp)


# --- Route phục vụ file HTML (Frontend) ---
@app.route("/")
def home():
    """Phục vụ file index.html từ thư mục static."""
    return send_from_directory(app.static_folder, "index.html")


@app.route("/<path:path>")
def serve_static(path):
    """Phục vụ các file tĩnh khác (CSS, JS, images,...) từ thư mục static."""
    return send_from_directory(app.static_folder, path)


# --- Chạy Server ---
if __name__ == "__main__":
    print(f"🚀 Server đang chạy tại: http://127.0.0.1:5000")
    print(f"📂 Đang phục vụ static từ: {app.static_folder}")
    print(f"🌐 API Blueprints: /api/products, /api/reviews")

    # Chạy ứng dụng trên cổng 5000
    app.run(debug=True, host="127.0.0.1", port=5000)
