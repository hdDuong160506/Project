from flask import Flask, request, jsonify
from flask_cors import CORS
from geopy.geocoders import Nominatim

# 1. Khởi tạo Flask App và cho phép CORS
app = Flask(__name__)
CORS(app) # Rất quan trọng!

# 2. Khởi tạo dịch vụ geopy
geolocator = Nominatim(user_agent="my-souvenir-app")

# 3. Tạo một API endpoint
# Frontend sẽ gửi yêu cầu POST đến địa chỉ '/api/suggest-products'
@app.route("/api/suggest-products", methods=["POST"])
def suggest_products():
    try:
        # 4. Lấy tọa độ (lat, lon) mà Frontend gửi lên
        data = request.json
        latitude = data.get('latitude')
        longitude = data.get('longitude')

        if not latitude or not longitude:
            return jsonify({"error": "Không có tọa độ"}), 400

        coordinates = f"{latitude}, {longitude}"

        # 5. Dùng geopy để tìm địa danh
        location = geolocator.reverse(coordinates, language="vi")

        target_location = "Không xác định"
        if location:
            address_details = location.raw.get('address', {})
            city = address_details.get('city')
            province = address_details.get('state')

            # Ưu tiên lấy city hoặc province
            if city:
                target_location = city
            elif province:
                target_location = province

        print(f"Đã tìm thấy vị trí: {target_location}")

        # 6. Trả kết quả (tạm thời chỉ trả tên vị trí) về cho Frontend
        # Sau này, bạn sẽ truy vấn DB ở đây để lấy sản phẩm
        return jsonify({
            "found_location": target_location,
            "suggested_products": [
                f"Sản phẩm đặc trưng của {target_location} 1",
                f"Sản phẩm đặc trưng của {target_location} 2",
            ]
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# 7. Chạy server
if __name__ == "__main__":
    # Server sẽ chạy ở địa chỉ http://127.0.0.1:5000
    app.run(port=5000, debug=True)