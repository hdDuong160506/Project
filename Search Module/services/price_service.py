def parse_price_info(raw_cost):
    """Phân tích và chuẩn hóa thông tin giá"""
    if not raw_cost:
        return {"min_price": None, "max_price": None, "fixed_cost": None}
    
    text = raw_cost.replace("–", "-").replace("—", "-").replace(".", "").replace(",", "").replace(" ", "")
    min_price = max_price = fixed_cost = None
    
    if "-" in text:
        parts = text.split("-")
        if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
            min_price = int(parts[0])
            max_price = int(parts[1])
            # ✅ Trả về integer (giá thấp nhất) thay vì string
            fixed_cost = min_price
    else:
        if text.isdigit():
            min_price = max_price = int(text)
            # ✅ Trả về integer thay vì string
            fixed_cost = min_price
    
    return {"min_price": min_price, "max_price": max_price, "fixed_cost": fixed_cost}