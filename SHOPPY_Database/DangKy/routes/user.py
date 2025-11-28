# -*- coding: utf-8 -*-
"""
User Routes
Xử lý thông tin người dùng, profile, location - KHÔNG dùng ORM
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import models as db
from utils.helpers import validate_coordinates

user_bp = Blueprint('user', __name__)

@user_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    """Xem thông tin profile"""
    current_user_id = get_jwt_identity()
    user = db.find_user_by_id(int(current_user_id))
    
    if not user:
        return jsonify({"msg": "Không tìm thấy user"}), 404
    
    db.update_last_active(user["id_users"])
    
    return jsonify(db.user_to_dict(user)), 200


@user_bp.route('/update-location', methods=['POST'])
@jwt_required()
def update_location():
    """Cập nhật vị trí người dùng"""
    current_user_id = get_jwt_identity()
    user = db.find_user_by_id(int(current_user_id))
    
    if not user:
        return jsonify({"msg": "Không tìm thấy user"}), 404
    
    data = request.get_json()
    lat = data.get('lat')
    long = data.get('long')
    
    if lat is None or long is None:
        return jsonify({"msg": "Thiếu thông tin tọa độ"}), 400
    
    # Validate coordinates
    is_valid, result = validate_coordinates(lat, long)
    if not is_valid:
        return jsonify({"msg": result}), 400
    
    lat, long = result
    db.update_user_location(user["id_users"], lat, long)
    
    return jsonify({"msg": "Cập nhật vị trí thành công"}), 200