import copy
from services.price_service import parse_price_info
from utils.haversine_function import haversine_function
from services.search_engine import match_score
from API.API_gemini_fix_query import gemini_fix_query

def build_store_info(row, user_lat=None, user_lon=None):
    """
    Xây dựng thông tin store với mảng pi chứa tất cả thuộc tính từ bảng product_images.
    """
    store_info = {key: row[key] for key in row.keys()}  # copy tất cả fields

    # Tính distance nếu có tọa độ và user_lat/lon
    distance = None
    if user_lat is not None and user_lon is not None and row.get("store_lat") and row.get("store_long"):
        distance = haversine_function(user_lat, user_lon, row["store_lat"], row["store_long"])
    
    store_info["distance_km"] = distance

    # Nếu có cost, chuẩn hóa (sử dụng ps_cost như trong query)
    if "ps_cost" in row:
        price_info = parse_price_info(row["ps_cost"])
        store_info["min_price"] = price_info["min_price"]
        store_info["max_price"] = price_info["max_price"]
        store_info["cost"] = price_info.get("fixed_cost")
    
    # Khởi tạo mảng pi
    store_info["product_images"] = []  # Mảng chứa tất cả product_images
    
    return store_info


def build_product_map(rows, user_lat=None, user_lon=None):
    """Xây dựng product map với mảng pi chứa tất cả thuộc tính từ bảng product_images"""
    product_map = {}
    
    for row in rows:
        product_id = row["product_id"]
        store_id = row["store_id"]
        
        # Khởi tạo product nếu chưa có
        if product_id not in product_map:
            product_map[product_id] = {
                "product": {
                    "product_id": row["product_id"],
                    "product_name": row["product_name"],
                    "product_des": row["product_des"],
                    "product_image_url": row["product_image_url"],
                    "product_location_id": row["product_location_id"],
                    "product_tag": row["product_tag"]
                },
                "location": {
                    "location_id": row["location_id"],
                    "location_name": row["location_name"],
                    "location_max_long": row["location_max_long"],
                    "location_min_long": row["location_min_long"],
                    "location_max_lat": row["location_max_lat"],
                    "location_min_lat": row["location_min_lat"]
                },
                "store": []
            }
        
        # Tìm store trong product (nếu đã tồn tại)
        existing_store = None
        if store_id:
            for store in product_map[product_id]["store"]:
                if store["store_id"] == store_id:
                    existing_store = store
                    break
        
        # Nếu store chưa tồn tại, tạo mới
        if store_id and not existing_store:
            store_info = build_store_info(row, user_lat, user_lon)
            # Thêm ảnh vào mảng pi nếu có
            if row.get("ps_image_url"):
                pi_info = {
                    "ps_id": row["ps_id"],
                    "ps_image_id": row["ps_image_id"],
                    "ps_image_url": row["ps_image_url"],
                    "ps_type": row["ps_type"]
                }
                store_info["product_images"].append(pi_info)
            product_map[product_id]["store"].append(store_info)
        
        # Nếu store đã tồn tại và có ảnh mới, thêm ảnh vào mảng pi
        elif store_id and existing_store and row.get("ps_image_url"):
            new_pi = {
                "ps_id": row["ps_id"],
                "ps_image_id": row["ps_image_id"],
                "ps_image_url": row["ps_image_url"],
                "ps_type": row["ps_type"]
            }
            
            # Kiểm tra xem ảnh đã tồn tại trong mảng pi chưa
            pi_exists = any(
                pi["ps_image_id"] == new_pi["ps_image_id"] 
                for pi in existing_store["product_images"]
            )
            if not pi_exists:
                existing_store["product_images"].append(new_pi)
    
    return product_map


def search_products_by_query(query, product_map):
    """
    Tìm kiếm sản phẩm dựa trên query và trả về kết quả có score.
    """
    scored_products = []
    for product in product_map.values():
        product_name = product["product"]["product_name"]
        score = match_score(query, product_name)
        if score > 0:
            p_copy = copy.deepcopy(product)
            p_copy["score"] = score
            scored_products.append(p_copy)
    scored_products.sort(key=lambda x: x["score"], reverse=True)
    return scored_products


def search_with_gemini_fallback(query, product_map):
    """
    Nếu query gốc không tìm thấy kết quả, dùng Gemini để sửa query và tìm lại.
    """
    fixed_query = gemini_fix_query(query)
    if not fixed_query:
        return []
    return search_products_by_query(fixed_query, product_map)


def search_location(query, rows, user_lat=21.0285, user_lon=105.8542):
    """
    Tìm sản phẩm theo query từ rows lấy từ database.
    Thêm tham số user_lat, user_lon với giá trị mặc định.
    """
    product_map = build_product_map(rows, user_lat, user_lon)  # ✅ Truyền tọa độ
    scored_products = search_products_by_query(query, product_map)
    if scored_products:
        return scored_products
    return search_with_gemini_fallback(query, product_map)