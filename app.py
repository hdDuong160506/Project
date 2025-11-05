from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import math
import os
from typing import List, Tuple
import unicodedata

# Config
DB_PATH = os.environ.get("DB_PATH", os.path.abspath("DB.db3"))
TABLE_NAME = os.environ.get("TABLE_NAME", "product")
COL_LAT = os.environ.get("COL_LAT", "latitude")
COL_lon = os.environ.get("COL_lon", "longitude")
COL_ID = os.environ.get("COL_ID", "id")
COL_NAME = os.environ.get("COL_NAME", "name")
COL_SHOP = os.environ.get("COL_SHOP", "shop_name")
COL_PRICE = os.environ.get("COL_PRICE", "price")
COL_ADDR = os.environ.get("COL_ADDR", "address")
COL_IMG = os.environ.get("COL_IMG", "image_url")
app = Flask(__name__)  # web framework, dùng để xây dựng web server và API backend
CORS(app)


def tryCandidates(paths: List[str]) -> str:
    for p in paths:
        if p and os.path.exists(p):
            return p
    return ""


def autoFindDB() -> str:
    if os.path.exists(DB_PATH):
        return DB_PATH
    cwd = os.getcwd()
    candidates = [
        DB_PATH,
        os.path.join(cwd, "database.db3"),
    ]
    try:
        for file in os.listdir(cwd):
            if file.lower().endswith((".db3")):
                candidates.append(os.path.join(cwd, file))
    except Exception:
        pass
    found = tryCandidates(candidates)
    return found or DB_PATH


# Lấy kết nối với database
def getConnection():
    dataFile = autoFindDB()
    if not os.path.exists(dataFile):
        raise FileNotFoundError(
            f"Database not found. Looked for: {dataFile}. Set env DB_PATH or place your .db3 next to app.py."
        )  # Dừng chương trình tại đây, nó giống với break ở C++
    connection = sqlite3.connect(dataFile)
    connection.row_factory = sqlite3.Row
    return connection


# Danh sách tên các bảng
def list_tables(connection) -> List[str]:
    rows = connection.execute(  #
        "SELECT name FROM sqlite_master WHERE type='table'"
    ).fetchall()
    return [r[0] for r in rows]


# Danh sách các cột trong bảng
def list_columns(conn, table: str) -> List[str]:
    safe = table.replace('"', '""')
    rows = conn.execute(
        f'PRAGMA table_info("{safe}")'
    ).fetchall()  # id, tên, kiểu dữ liệu, có phải NOT NULL, có default, có phải primary key,
    return [r[1] for r in rows]


# Hàm tính khoảng cách giữa hai điểm trên trái đất bằng công thức Haversine
def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0  # Bán kính trái đất
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlmb / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


# Bounding box bao quanh lat lon với bán kính cho trước
def bbox_for_radius(lat, lon, radius_km):
    dlat = radius_km / 111.0  # ~111 km per deg latitude
    cos_lat = max(0.01, math.cos(math.radians(lat)))
    dlon = radius_km / (111.320 * cos_lat)
    return (lat - dlat, lat + dlat, lon - dlon, lon + dlon)


@app.get("/")
# Kiểm tra trạng thái của backend flask
def root():
    try:
        with getConnection() as connection:
            tables = list_tables(connection)
            cols = list_columns(connection, TABLE_NAME) if TABLE_NAME in tables else []
        return {
            "ok": True,
            "message": "Flask GPS Product API is running",
            "db_path": autoFindDB(),
            "table": TABLE_NAME,
            "tables": tables,
            "table_columns": {TABLE_NAME: cols},
        }
    except Exception as e:
        return {
            "ok": False,
            "error": str(e),
            "db_path": autoFindDB(),
            "table": TABLE_NAME,
        }


@app.get("/api/columns")
def api_columns():
    with getConnection() as connection:
        tables = list_tables(connection)
        info = {}
        for t in tables:
            info[t] = list_columns(connection, t)
    return {"tables": tables, "columns": info}


# Hàm đọc tọa độ GPS từ dữ liệu JSON -> trả về dạng float
def _parse_latlon(payload: dict) -> Tuple[float, float]:
    lat = payload.get("latitude") or payload.get("lat")
    lon = payload.get("longitude") or payload.get("lon")
    if lat is None or lon is None:
        raise ValueError(
            "Missing latitude/longitude (accepted keys: latitude/longitude or lat/lon/lon)"
        )
    return float(lat), float(lon)


def _normalize_vn_name(s: str) -> str:
    if not isinstance(s, str):
        return ""
    # Xóa dấu
    base = "".join(
        c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn"
    )
    base = base.lower().strip()  # Về chữ thường và khoảng trắng ở hai đầu
    # loại bỏ tiền tố/thành phần để so khớp
    for token in ("thanh pho", "tp.", "tp", "tinh", ",", "."):
        base = base.replace(token, " ")
    return " ".join(base.split())


@app.route("/api/suggest-products", methods=["POST", "GET"])
def suggest_products():
    try:
        # Nhận dữ liệu từ frontend và lưu vào data
        if request.method == "POST":
            data = request.get_json(force=True)  # force = true để chuyển thành dict
        else:
            data = {
                "latitude": request.args.get("lat") or request.args.get("latitude"),
                "longitude": request.args.get("lon") or request.args.get("longitude"),
                "limit": request.args.get("limit"),
                "city": request.args.get("city")
                or request.args.get("location")
                or request.args.get("province"),
            }

        city_input = (
            (data or {}).get("city")
            or (data or {}).get("location")
            or (data or {}).get("province")
        )
        try:
            limit = int(data.get("limit")) if data and data.get("limit") else None
        except Exception:
            limit = None

        # Nếu có city_input: bỏ qua GPS, tìm theo tên tỉnh/thành và trả toàn bộ sản phẩm của nơi đó
        if city_input:
            norm_query = _normalize_vn_name(city_input)
            with getConnection() as connection:
                rows = connection.execute(
                    "SELECT location_id, name FROM location"
                ).fetchall()
                loc = None
                for r in rows:
                    dbn = _normalize_vn_name(r["name"]) if r["name"] else ""
                    if dbn and (dbn in norm_query or norm_query in dbn):
                        loc = r
                        break

                if not loc:
                    return (
                        jsonify(
                            {
                                "error": f"Không tìm thấy tỉnh/thành '{city_input}' trong cơ sở dữ liệu."
                            }
                        ),
                        404,
                    )

                location_id = loc["location_id"]
                city_name = loc["name"]

                products = connection.execute(
                    "SELECT product_id, name, cost, image_url FROM product WHERE location_id = ?",
                    (location_id,),
                ).fetchall()
                if not products:
                    return jsonify({"city": city_name, "count": 0, "results": []})

                results = []
                for p in products:
                    store_rows = connection.execute(
                        """
                        SELECT s.store_id, s.name AS store_name, s.address
                        FROM product_store ps
                        JOIN store s ON ps.store_id = s.store_id 
                        WHERE ps.product_id = ?
                        """,
                        (p["product_id"],),
                    ).fetchall()  # Join vào hai bảng ps và store
                    if store_rows:
                        for s in store_rows:
                            results.append(
                                {
                                    "name": p["name"],
                                    "price": p["cost"],
                                    "address": s["address"],
                                    "image_url": p["image_url"],
                                    "shop": s["store_name"],
                                }
                            )
                    else:
                        # Không có cửa hàng liên kết vẫn trả sản phẩm (không địa chỉ/ shop)
                        results.append(
                            {
                                "name": p["name"],
                                "price": p["cost"],
                                "address": None,
                                "image_url": p["image_url"],
                                "shop": None,
                            }
                        )

                if limit is not None and limit > 0:
                    results = results[:limit]

                return jsonify(
                    {"city": city_name, "count": len(results), "results": results}
                )

        # Không có city_input: đi theo luồng GPS như cũ
        lat, lon = _parse_latlon(data)

        with getConnection() as connection:
            # Tìm tỉnh/thành chứa điểm (lat, lon)
            loc = connection.execute(
                """
                SELECT location_id, name
                FROM location
                WHERE ? BETWEEN min_lat AND max_lat
                  AND ? BETWEEN min_long AND max_long
                LIMIT 1
                """,
                (lat, lon),
            ).fetchone()

            if not loc:
                return (
                    jsonify({"error": "Không tìm thấy tỉnh/thành phù hợp với tọa độ."}),
                    404,
                )

            location_id = loc["location_id"]
            city_name = loc["name"]

            # Lấy danh sách sản phẩm thuộc location_id
            products = connection.execute(
                "SELECT product_id, name, cost, image_url FROM product WHERE location_id = ?",
                (location_id,),
            ).fetchall()
            if not products:
                return jsonify({"city": city_name, "count": 0, "results": []})

            results = []
            for p in products:
                # Lấy các cửa hàng bán sản phẩm kèm toạ độ cửa hàng
                store_rows = connection.execute(
                    """
                    SELECT s.store_id, s.name AS store_name, s.address, s.lat AS s_lat, s.long AS s_lon
                    FROM product_store ps
                    JOIN store s ON ps.store_id = s.store_id
                    WHERE ps.product_id = ? AND s.lat IS NOT NULL AND s.long IS NOT NULL
                    """,
                    (p["product_id"],),
                ).fetchall()

                for s in store_rows:
                    dist_km = (
                        haversine_km(lat, lon, s["s_lat"], s["s_lon"])
                        if s["s_lat"] is not None and s["s_lon"] is not None
                        else None
                    )
                    if dist_km is None:
                        continue
                    results.append(
                        {
                            "name": p["name"],
                            "price": p["cost"],
                            "address": s["address"],
                            "image_url": p["image_url"],
                            "shop": s["store_name"],
                            "distance_km": round(float(dist_km), 2),
                        }
                    )

        # Sắp xếp theo khoảng cách tăng dần và áp dụng limit nếu có
        results.sort(key=lambda x: x["distance_km"])  # gần -> xa
        if limit is not None and limit > 0:
            results = results[:limit]

        return jsonify({"city": city_name, "count": len(results), "results": results})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
