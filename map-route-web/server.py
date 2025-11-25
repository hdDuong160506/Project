# server.py
import os
import json
import sqlite3
import requests
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS

app = Flask(__name__, template_folder='templates', static_folder='static')
CORS(app)

# --- CONFIG ---
ORS_API_KEY = os.getenv("ORS_API_KEY")
if not ORS_API_KEY:
    # Bạn có thể hardcode key tạm thời ở đây nếu lười set env, nhưng không khuyến khích
    print("WARNING: ORS_API_KEY not found in env.")
    # raise RuntimeError("Please set ORS_API_KEY environment variable.")

ORS_BASE = "https://api.openrouteservice.org/v2/directions"
DB_PATH = "database.db3"

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Để truy cập cột bằng tên (row['name'])
    return conn

@app.route('/')
def index():
    return render_template('index.html')

# --- API: Lấy danh sách cửa hàng từ Database ---
@app.route('/api/stores')
def get_stores():
    try:
        if not os.path.exists(DB_PATH):
            return jsonify({"error": "Database file not found"}), 404
            
        conn = get_db_connection()
        # Giả định bảng store có các cột: id_store, name, address, lat, long
        # Nếu tên cột trong DB khác, bạn hãy sửa lại câu query này
        stores = conn.execute('SELECT * FROM store').fetchall()
        conn.close()
        
        # Convert sqlite Row object sang dict để trả về JSON
        stores_list = [dict(row) for row in stores]
        app.logger.info(f"Fetched {len(stores_list)} stores from DB")
        return jsonify(stores_list)
    except Exception as e:
        app.logger.error(f"DB Error: {e}")
        return jsonify({"error": str(e)}), 500

# --- API: Routing (Logic cũ) ---
@app.route('/route', methods=['GET', 'POST', 'OPTIONS'])
def route():
    if request.method == 'OPTIONS':
        return jsonify({"ok": True}), 200

    data = None
    try:
        data = request.get_json(silent=True)
    except:
        pass

    # Fallback support
    if data is None and request.method == 'GET':
        # ... (Logic xử lý GET fallback cũ) ...
        pass # Giữ nguyên logic cũ nếu cần, hoặc lược bỏ cho gọn

    if not data:
        return jsonify({"error": "Missing JSON body"}), 400

    start = data.get('start')
    end = data.get('end')
    profile = data.get('profile', 'driving-car')

    if not ORS_API_KEY:
        return jsonify({"error": "Server missing API Key"}), 500

    url = f"{ORS_BASE}/{profile}/geojson"
    headers = {
        "Authorization": ORS_API_KEY,
        "Content-Type": "application/json"
    }
    body = {"coordinates": [start, end]}

    try:
        resp = requests.post(url, json=body, headers=headers, timeout=15)
        if resp.status_code != 200:
            return jsonify({"error": "ORS request failed", "detail": resp.text}), 502
        return jsonify(resp.json())
    except Exception as e:
        return jsonify({"error": "Failed to call ORS", "detail": str(e)}), 502

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)