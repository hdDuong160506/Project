from flask import Flask, request, jsonify
from flask_cors import CORS
import traceback

# Import từ các module khác
from config import *
from database import *
from helpers import *

app = Flask(__name__)
CORS(app)


@app.get("/")
def root():
    try:
        with getConnection() as connection:
            tables = listTables(connection)
            cols = listColumns(connection, TABLE_NAME) if TABLE_NAME in tables else []
        return {
            "ok": True,
            "message": "Flask GPS Product API is running",
            "db_path": DB_PATH,
            "table": TABLE_NAME,
            "tables": tables,
            "table_columns": {TABLE_NAME: cols},
        }
    except Exception as e:
        return {
            "ok": False,
            "error": str(e),
            "db_path": DB_PATH,
            "table": TABLE_NAME,
        }


@app.post("/api/products")
def post_products():
    try:
        data = request.get_json(force=True)

        city_input = data.get("city") or data.get("location") or data.get("province")
        try:
            limit = int(data.get("limit")) if data.get("limit") else None
        except Exception:
            limit = None

        with getConnection() as connection:
            if city_input:
                normalized_city = normalize_vn_name(city_input)
                rows = connection.execute(
                    "SELECT location_id, name FROM location"
                ).fetchall()
                location_entry = None
                for r in rows:
                    normalized_db_name = (
                        normalize_vn_name(r["name"]) if r["name"] else ""
                    )
                    if normalized_db_name and (
                        normalized_db_name in normalized_city
                        or normalized_city in normalized_db_name
                    ):
                        location_entry = r
                        break
                if not location_entry:
                    return (
                        jsonify(
                            {
                                "error": f"Không tìm thấy tỉnh/thành '{city_input}' trong cơ sở dữ liệu."
                            }
                        ),
                        404,
                    )
                location_id = location_entry["location_id"]
                city_name = location_entry["name"]
            else:
                lat, lon = parse_latlon(data)
                location_entry = connection.execute(
                    """
                    SELECT location_id, name
                    FROM location
                    WHERE ? BETWEEN min_lat AND max_lat
                      AND ? BETWEEN min_long AND max_long
                    LIMIT 1
                    """,
                    (lat, lon),
                ).fetchone()
                if not location_entry:
                    return (
                        jsonify(
                            {"error": "Không tìm thấy tỉnh/thành phù hợp với tọa độ."}
                        ),
                        404,
                    )
                location_id = location_entry["location_id"]
                city_name = location_entry["name"]

            products = connection.execute(
                "SELECT product_id, name, image_url FROM product WHERE location_id = ?",
                (location_id,),
            ).fetchall()
            items = [
                {
                    "product_id": p["product_id"],
                    "name": p["name"],
                    "image_url": p["image_url"],
                }
                for p in products
            ]
            if limit is not None and limit > 0:
                items = items[:limit]
            return jsonify({"city": city_name, "count": len(items), "products": items})
    except Exception as e:
        import traceback

        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500


@app.post("/api/product-stores")
def post_product_stores():
    try:
        data = request.get_json(force=True)

        product_id = data.get("product_id")
        if not product_id:
            return jsonify({"error": "Missing product_id"}), 400

        lat = data.get("latitude") or data.get("lat")
        lon = data.get("longitude") or data.get("lon")
        lat = float(lat) if lat is not None and str(lat).strip() != "" else None
        lon = float(lon) if lon is not None and str(lon).strip() != "" else None

        with getConnection() as connection:
            product = connection.execute(
                "SELECT name, image_url FROM product WHERE product_id = ?",
                (product_id,),
            ).fetchone()
            product_name = product["name"] if product else None
            product_image = product["image_url"] if product else None

            rows = connection.execute(
                """
                SELECT ps.cost, s.name AS store_name, s.address, s.lat AS s_lat, s.long AS s_lon, pi.image_url AS main_image
                FROM product_store ps
                JOIN store s ON ps.store_id = s.store_id
                LEFT JOIN product_images pi ON pi.ps_id = ps.ps_id AND pi.type = 1
                WHERE ps.product_id = ?
                """,
                (product_id,),
            ).fetchall()

            # ✅ DEBUG: In raw data từ database
            print("\n" + "=" * 50)
            print(f"DEBUG: Product ID = {product_id}")
            print(f"DEBUG: Found {len(rows)} stores")
            results = []
            for i, r in enumerate(rows):
                # ✅ DEBUG: In từng row từ database
                print(f"\n--- Row {i} (from database) ---")
                print(f"  cost (raw): {r['cost']} (type: {type(r['cost'])})")
                print(f"  store_name: {r['store_name']}")
                if (
                    lat is not None
                    and lon is not None
                    and r["s_lat"] is not None
                    and r["s_lon"] is not None
                ):
                    dist_km = haversine_km(lat, lon, r["s_lat"], r["s_lon"])
                else:
                    dist_km = None

                cost_value = r["cost"]
                print(f"  cost value: {cost_value}")

                price_text = format_price_text(cost_value)
                price_val = extract_min_price(cost_value)
                item = {
                    "name": product_name,
                    "price": price_val,
                    "price_text": price_text,
                    "address": r["address"],
                    "image_url": r["main_image"],
                    "shop": r["store_name"],
                }
                if dist_km is not None:
                    item["distance_km"] = round(float(dist_km), 2)

                # ✅ DEBUG: In item cuối cùng
                print(f"\n  Final item:")
                print(f"    price: {item['price']}")
                print(f"    price_text: {item['price_text']}")
                results.append(item)

        # if lat is not None and lon is not None:
        #     results.sort(key=lambda x: x.get("distance_km", 1e12))
        return jsonify(
            {
                "product_id": product_id,
                "product": {
                    "name": product_name,
                    "image_url": (results[0]["image_url"] if results else None),
                },
                "count": len(results),
                "results": results,
            }
        )
    except Exception as e:
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT, debug=DEBUG)
