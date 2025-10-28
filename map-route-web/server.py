# server.py (debug-friendly, supports CORS, logs headers/body, robust JSON parse)
import os
import json
import requests
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS

app = Flask(__name__, template_folder='templates', static_folder='static')
CORS(app)  # allow preflight OPTIONS and cross-origin (safe for local dev)

ORS_API_KEY = os.getenv("ORS_API_KEY")
if not ORS_API_KEY:
    raise RuntimeError("Please set ORS_API_KEY environment variable before running.")

ORS_BASE = "https://api.openrouteservice.org/v2/directions"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/route', methods=['GET', 'POST', 'OPTIONS'])
def route():
    # Log request method + headers for debugging
    app.logger.info("=== /route called, method=%s ===", request.method)
    app.logger.info("Headers: %s", dict(request.headers))

    # If OPTIONS: return 200 (CORS preflight). flask_cors usually handles, but explicit is fine.
    if request.method == 'OPTIONS':
        return jsonify({"ok": True}), 200

    # Try to parse JSON from request body
    data = None
    try:
        data = request.get_json(silent=True)
        app.logger.info("get_json() => %s", data)
    except Exception as e:
        app.logger.warning("get_json() raised: %s", e)

    # If get_json returned None, show raw body and try to parse manually
    if data is None:
        raw = request.get_data(as_text=True)
        app.logger.info("Raw body text: %s", raw)
        if raw:
            try:
                data = json.loads(raw)
                app.logger.info("Parsed raw body JSON => %s", data)
            except Exception as e:
                app.logger.warning("Failed to parse raw body as JSON: %s", e)
                data = None

    # Support GET fallback (for quick tests)
    if request.method == 'GET' and data is None:
        s = request.args.get('start')
        e = request.args.get('end')
        profile = request.args.get('profile', 'driving-car')
        if s and e:
            try:
                start = [float(x) for x in s.split(',')]
                end = [float(x) for x in e.split(',')]
                data = {"start": start, "end": end, "profile": profile}
                app.logger.info("GET fallback parsed data: %s", data)
            except Exception as ex:
                app.logger.error("GET fallback parse failed: %s", ex)
                return jsonify({"error":"bad GET params"}), 400

    if not data:
        return jsonify({"error": "start and end required (format: [lon, lat])"}), 400

    start = data.get('start')
    end = data.get('end')
    profile = data.get('profile', 'driving-car')

    # Validate start/end types
    if not (isinstance(start, list) and isinstance(end, list) and len(start) == 2 and len(end) == 2):
        return jsonify({"error":"start/end must be arrays like [lon, lat]"}), 400

    url = f"{ORS_BASE}/{profile}/geojson"
    headers = {
        "Authorization": ORS_API_KEY,
        "Content-Type": "application/json"
    }
    body = {"coordinates":[start, end]}
    app.logger.info("Calling ORS %s with body: %s", url, body)

    try:
        resp = requests.post(url, json=body, headers=headers, timeout=15)
    except Exception as e:
        app.logger.exception("Exception while calling ORS")
        return jsonify({"error":"failed to call ORS","detail":str(e)}), 502

    if resp.status_code != 200:
        app.logger.error("ORS returned %s: %s", resp.status_code, resp.text)
        return jsonify({"error":"ORS request failed","status_code":resp.status_code,"detail":resp.text}), 502

    return jsonify(resp.json())

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
