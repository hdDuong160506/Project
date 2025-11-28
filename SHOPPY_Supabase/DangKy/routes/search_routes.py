from flask import Blueprint, jsonify, request
# Import các module từ database và services
# Lưu ý: app.py chạy từ thư mục gốc nên đường dẫn import này vẫn đúng
from database.fetch_data import fetch_data_from_database
from services.search_service import search_location, build_product_map

# 1. Khởi tạo Blueprint thay vì Flask app
search_bp = Blueprint('search', __name__)

# Lưu ý: Chúng ta bỏ route '/' (homepage) ở đây vì app.py đã có static routes quản lý giao diện rồi.
# Chúng ta chỉ giữ lại API thôi.

# 2. Đổi @app.route thành @search_bp.route
@search_bp.route("/api/products")
def api_products():
    search_text = request.args.get("search", "")
    distance_filter = request.args.get("distance", "")
    price_filter = request.args.get("price", "")
    
    # Lấy tọa độ user, mặc định Hoàn Kiếm, Hà Nội
    user_lat = float(request.args.get("lat", 21.0285))
    user_lon = float(request.args.get("lon", 105.8542))
    
    # Gọi hàm lấy dữ liệu
    rows = fetch_data_from_database()
    
    # Logic tìm kiếm
    if search_text:
        results = search_location(search_text, rows, user_lat, user_lon)
    else:
        # Nếu không có search_text, trả về tất cả sản phẩm
        product_map = build_product_map(rows, user_lat, user_lon)
        results = list(product_map.values())

    # Logic lọc khoảng cách
    if distance_filter:
        max_dist = float(distance_filter)
        for r in results:
            r["store"] = [s for s in r["store"] 
                          if s.get("distance_km") is not None and s["distance_km"] <= max_dist]
        results = [r for r in results if r["store"]]

    # Logic lọc giá
    if price_filter:
        ranges = {
            "1": (0, 50000), "2": (50000, 100000), "3": (100000, 200000),
            "4": (200000, 500000), "5": (500000, 1000000), "6": (1000000, float('inf'))
        }
        if price_filter in ranges:
            low, high = ranges[price_filter]
            for r in results:
                r["store"] = [s for s in r["store"] 
                            if s.get("min_price") is not None and s.get("max_price") is not None and 
                            ((low <= s["min_price"] <= high) or (low <= s["max_price"] <= high) or
                            (s["min_price"] <= low and s["max_price"] >= high))]
            results = [r for r in results if r["store"]]

    # Format dữ liệu JSON trả về
    products = []
    for p in results:
        # first_store = p["store"][0] if p["store"] else {} # Dòng này thừa, comment lại
        
        products.append({
            "product_id": p["product"].get("product_id", 0),
            "product_name": p["product"].get("product_name", "Không có tên"),
            "product_des": p["product"].get("product_des", ""),
            "product_image_url": p["product"].get("product_image_url", "image/products/default.jpg"),
            "location_name": p["location"].get("location_name", ""),
            "stores": [
                {
                    "store_id": store.get("store_id"),
                    "store_name": store.get("store_name"),
                    "store_address": store.get("store_address"),
                    "store_lat": store.get("store_lat"),
                    "store_long": store.get("store_long"),
                    "distance_km": store.get("distance_km"),
                    "min_price": store.get("min_price"),
                    "max_price": store.get("max_price"),
                    "cost": store.get("cost"),
                    "product_images": [
                        {
                            "ps_id": img.get("ps_id"),
                            "ps_image_id": img.get("ps_image_id"),
                            "ps_image_url": img.get("ps_image_url"),
                            "ps_type": img.get("ps_type")
                        }
                        for img in store.get("product_images", [])
                    ]
                }
                for store in p.get("store", [])
            ]
        })
    
    return jsonify(products)

# 3. Xóa đoạn if __name__ == "__main__": app.run() đi vì file này không chạy trực tiếp nữa