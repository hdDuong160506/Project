import sqlite3
from flask import Flask, request, render_template
from search_engine import match_score
from API_gemini_fix_query import gemini_fix_query
from haversine_function import haversine_function
import re

app = Flask(__name__)

user_lat = 21.0285   # ví dụ: Hà Nội
user_lon = 105.8542

import sqlite3
import copy
from haversine_function import haversine_function
from search_engine import match_score
from API_gemini_fix_query import gemini_fix_query

user_lat = 21.0285
user_lon = 105.8542

def search_location(query):
    conn = sqlite3.connect("database.db3")
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute("""
        SELECT 
            p.product_id, p.name AS product_name,
            l.name AS location_name,
            s.store_id, s.name AS store_name, s.lat, s.long,
            ps.cost
        FROM product p
        LEFT JOIN location l ON p.location_id = l.location_id
        LEFT JOIN product_store ps ON ps.product_id = p.product_id
        LEFT JOIN store s ON ps.store_id = s.store_id
    """)
    rows = cur.fetchall()
    conn.close()

    # Gom stores cùng product
    product_map = {}
    for r in rows:
        pid = r["product_id"]
        if pid not in product_map:
            product_map[pid] = {
                "name": r["product_name"],
                "location_name": r["location_name"],
                "stores": []
            }
        if r["store_id"]:
            distance = None
            if r["lat"] and r["long"]:
                distance = haversine_function(user_lat, user_lon, r["lat"], r["long"])

            raw_cost = r["cost"]
            min_price = None
            max_price = None
            fixed_cost = None

            if raw_cost:
                # Chuẩn hoá chuỗi giá
                text = raw_cost.replace("–", "-")      # đổi en-dash
                text = text.replace(".", "")           # bỏ dấu chấm
                text = text.replace(" ", "")           # bỏ khoảng trắng

                if "-" in text:
                    parts = text.split("-")
                    if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
                        min_price = int(parts[0])
                        max_price = int(parts[1])
                        fixed_cost = f"{min_price} - {max_price}"
                else:
                    if text.isdigit():
                        min_price = int(text)
                        max_price = int(text)
                        fixed_cost = f"{min_price}"

            product_map[pid]["stores"].append({
                "name": r["store_name"],
                "lat": r["lat"],
                "long": r["long"],
                "distance_km": distance,
                "min_price": min_price,
                "max_price": max_price,
                "raw_cost": fixed_cost
            })


    # Tìm theo query
    scored_products = []
    for product in product_map.values():
        score = match_score(query, product["name"])
        if score > 0:
            p_copy = copy.deepcopy(product)
            p_copy["score"] = score
            scored_products.append(p_copy)

    if scored_products:
        scored_products.sort(key=lambda x: x["score"], reverse=True)
        return scored_products

    # Nếu không tìm thấy → Gemini
    fixed = gemini_fix_query(query)
    if not fixed:
        return []

    scored_products2 = []
    for product in product_map.values():
        score = match_score(fixed, product["name"])
        if score > 0:
            p_copy = copy.deepcopy(product)
            p_copy["score"] = score
            scored_products2.append(p_copy)

    scored_products2.sort(key=lambda x: x["score"], reverse=True)
    return scored_products2

@app.route("/", methods=["GET", "POST"])
def index():
    results = []
    search_text = ""
    distance_filter = ""
    price_filter = ""

    if request.method == "POST":
        search_text = request.form.get("search", "")
        distance_filter = request.form.get("distance_filter", "")
        price_filter = request.form.get("price_filter", "")

        # Lấy kết quả gốc
        results = search_location(search_text)

        # Lọc theo khoảng cách
        if distance_filter:
            max_distance = float(distance_filter)
            for product in results:
                product["stores"] = [
                    s for s in product["stores"]
                    if s.get("distance_km") is not None and s["distance_km"] <= max_distance
                ]

        # Lọc theo giá
        if price_filter:
            for product in results:
                filtered = []

                for s in product["stores"]:
                    min = s.get("min_price")
                    max = s.get("max_price")

                    if min is None or max is None:
                        continue  # skip store không có giá

                    # Điều kiện lọc theo từng mức
                    if price_filter == "1":       # dưới 50k
                        if min < 50000 or max < 50000:
                            filtered.append(s)

                    elif price_filter == "2":     # 50k - 100k
                        if min <= 100000 and max >= 50000:
                            filtered.append(s)

                    elif price_filter == "3":     # 100k - 200k
                        if min <= 200000 and max >= 100000:
                            filtered.append(s)

                    elif price_filter == "4":     # 200k - 500k
                        if min <= 500000 and max >= 200000:
                            filtered.append(s)

                    elif price_filter == "5":     # 500k - 1 triệu
                        if min <= 1000000 and max >= 500000:
                            filtered.append(s)

                    elif price_filter == "6":     # trên 1 triệu
                        if min > 1000000 or max > 1000000:
                            filtered.append(s)

                product["stores"] = filtered


        # Xóa sản phẩm không còn cửa hàng
        results = [p for p in results if p["stores"]]

    return render_template(
        "search.html",
        results=results,
        search_text=search_text,
        distance_filter=distance_filter,
        price_filter=price_filter
    )

if __name__ == "__main__":
    app.run(debug=True)
