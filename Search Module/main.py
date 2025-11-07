from flask import Flask, render_template, request
import unicodedata

app = Flask(__name__)

def remove_accents(text: str):
    text = text.lower()
    text = unicodedata.normalize('NFKD', text)
    text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')
    text = text.replace('đ', 'd').replace('Đ', 'D')
    return text

def generate_name_tags(name: str):
    name_lower = name.lower().strip()
    name_no_accent = remove_accents(name_lower)
    name_joined = name_lower.replace(" ", "")
    name_no_accent_joined = name_no_accent.replace(" ", "")
    words = name_no_accent.split()
    return {
        name_lower,
        name_no_accent,
        name_joined,
        name_no_accent_joined,
        *words,
    }

class Product:
    def __init__(self, name, price, province):
        self.name = name
        self.price = price
        self.province = province
        self.name_tags = generate_name_tags(name)
        self.name_no_accent = remove_accents(name)

products = [
    Product("Bánh đậu xanh Hải Dương", 50000, "Hải Dương"),
    Product("Bánh mì sandwich", 15000, "Hồ Chí Minh"),
    Product("Kẹo dừa Bến Tre", 30000, "Bến Tre"),
    Product("Coca Cola lon", 12000, "Toàn quốc"),
    Product("Trà xanh Không Độ", 10000, "Toàn quốc"),
    Product("Bánh quy bơ", 40000, "Hà Nội"),
    Product("Nem chua Thanh Hóa", 999999, "Thanh Hóa"),
    Product("Nguyên liệu nấu bún nước lèo", 120000, "Sóc Trăng"),
    Product("Bánh Pía", 100000, "Sóc Trăng"),
    Product("Cua đóng hộp", 300000, "Cà Mau"),

    # Miền Bắc
    Product("Chả mực Hạ Long", 350000, "Quảng Ninh"),
    Product("Bún khô Cao Bằng", 50000, "Cao Bằng"),
    Product("Thịt trâu gác bếp", 450000, "Điện Biên"),
    Product("Táo mèo khô", 90000, "Yên Bái"),
    Product("Lạp xưởng gác bếp", 250000, "Lạng Sơn"),
    Product("Mận Bắc Hà", 70000, "Lào Cai"),
    Product("Bánh cốm Hà Nội", 60000, "Hà Nội"),
    Product("Giò me Nghệ An", 180000, "Nghệ An"),
    Product("Chè Thái Nguyên", 80000, "Thái Nguyên"),
    Product("Cam Cao Phong", 70000, "Hòa Bình"),

    # Miền Trung
    Product("Mì Quảng khô", 45000, "Quảng Nam"),
    Product("Muối ớt Tây Ninh", 25000, "Tây Ninh"),
    Product("Bánh tráng Đại Lộc", 30000, "Quảng Nam"),
    Product("Tré Huế", 65000, "Thừa Thiên Huế"),
    Product("Bánh đậu xanh Rồng Vàng", 55000, "Quảng Ngãi"),
    Product("Rong biển Khánh Hòa", 50000, "Khánh Hòa"),
    Product("Chả bò Đà Nẵng", 260000, "Đà Nẵng"),
    Product("Yến sào Khánh Hoà", 3000000, "Khánh Hòa"),
    Product("Muối hồng Himalaya", 49000, "Đà Nẵng"),
    Product("Tỏi Lý Sơn", 180000, "Quảng Ngãi"),

    # Tây Nguyên
    Product("Cà phê Buôn Ma Thuột", 90000, "Đắk Lắk"),
    Product("Hồ tiêu đen", 120000, "Đắk Nông"),
    Product("Hạt điều rang muối", 150000, "Bình Phước"),
    Product("Macca Lâm Đồng", 250000, "Lâm Đồng"),
    Product("Trà Atiso Đà Lạt", 90000, "Lâm Đồng"),
    Product("Khoai lang mật", 75000, "Gia Lai"),
    Product("Sầu riêng Ri6", 180000, "Đắk Lắk"),
    Product("Bơ booth", 90000, "Lâm Đồng"),

    # Miền Tây
    Product("Nhãn xuồng cơm vàng", 80000, "Bà Rịa - Vũng Tàu"),
    Product("Chôm chôm Long Khánh", 60000, "Đồng Nai"),
    Product("Chuối sứ phơi khô", 50000, "Long An"),
    Product("Hạt sen sấy", 120000, "Đồng Tháp"),
    Product("Cá khô một nắng", 160000, "Cà Mau"),
    Product("Mật ong U Minh", 200000, "Cà Mau"),
    Product("Bánh phồng sữa", 35000, "Bến Tre"),
    Product("Đường thốt nốt An Giang", 55000, "An Giang"),
    Product("Mắm thái Châu Đốc", 90000, "An Giang"),
    Product("Trái cây sấy thập cẩm", 80000, "Tiền Giang"),

    # Thực phẩm – nước uống phổ thông
    Product("Pepsi lon", 12000, "Toàn quốc"),
    Product("Nước suối Aquafina", 7000, "Toàn quốc"),
    Product("Mì Hảo Hảo", 4000, "Toàn quốc"),
    Product("Phở bò ăn liền", 12000, "Toàn quốc"),
    Product("Gạo ST25", 28000, "Sóc Trăng"),
    Product("Gạo nàng thơm chợ Đào", 25000, "Long An"),

    # Đồ gia dụng
    Product("Nước rửa chén Sunlight", 35000, "Toàn quốc"),
    Product("Bột giặt OMO", 120000, "Toàn quốc"),
    Product("Dầu ăn Neptune", 55000, "Toàn quốc"),
    Product("Nước mắm Phú Quốc", 70000, "Kiên Giang"),

    # Hải sản
    Product("Mực khô Phan Thiết", 450000, "Bình Thuận"),
    Product("Tôm khô Cà Mau", 600000, "Cà Mau"),
    Product("Cá chỉ vàng", 150000, "Khánh Hòa"),
    Product("Cá cơm rim", 55000, "Ninh Thuận"),

    # Bánh kẹo Việt Nam
    Product("Bánh ChocoPie", 35000, "Toàn quốc"),
    Product("Bánh Oreo", 12000, "Toàn quốc"),
    Product("Me Thái cay", 30000, "Hồ Chí Minh"),

    # Đặc sản khác
    Product("Mơ sấy dẻo", 70000, "Hà Nội"),
    Product("Ô mai Hồng Lam", 90000, "Hà Nội"),
    Product("Đào sá xị", 15000, "Hồ Chí Minh"),
    Product("Kẹo nougat Đài Loan", 120000, "Toàn quốc"),
]

def match_score(product, keyword):
    kw = remove_accents(keyword).replace(" ", "")
    name_no_accent = remove_accents(product.name).replace(" ", "")
    score = 0

    if kw == name_no_accent:
        score += 5
    elif kw in name_no_accent:
        score += 3
        index = name_no_accent.find(kw)
        if index == 0:
            score += 2
        elif index < len(name_no_accent) // 3:
            score += 1

    for tag in product.name_tags:
        tag_no_accent = remove_accents(tag).replace(" ", "")
        if kw == tag_no_accent:
            score += 3
        elif kw in tag_no_accent:
            score += 1
            if tag_no_accent.startswith(kw):
                score += 1

    return score

def find_with_priority(keyword, product_list):
    results = []
    for p in product_list:
        score = match_score(p, keyword)
        if score > 0:
            results.append((score, p))
    results.sort(key=lambda x: (-x[0], x[1].name))
    return [p for _, p in results]

def filter_by_province(products, province):
    if not province or province == "all":
        return products
    province_no_accent = remove_accents(province)
    return [p for p in products if remove_accents(p.province) == province_no_accent]

# ✅ FULL danh sách tỉnh (63 tỉnh + Toàn quốc)
provinces = [
    "Toàn quốc", "An Giang", "Bà Rịa - Vũng Tàu", "Bắc Giang", "Bắc Kạn", "Bạc Liêu",
    "Bắc Ninh", "Bến Tre", "Bình Định", "Bình Dương", "Bình Phước", "Bình Thuận",
    "Cà Mau", "Cần Thơ", "Cao Bằng", "Đà Nẵng", "Đắk Lắk", "Đắk Nông", "Điện Biên",
    "Đồng Nai", "Đồng Tháp", "Gia Lai", "Hà Giang", "Hà Nam", "Hà Nội", "Hà Tĩnh",
    "Hải Dương", "Hải Phòng", "Hậu Giang", "Hòa Bình", "Hưng Yên", "Khánh Hòa",
    "Kiên Giang", "Kon Tum", "Lai Châu", "Lâm Đồng", "Lạng Sơn", "Lào Cai",
    "Long An", "Nam Định", "Nghệ An", "Ninh Bình", "Ninh Thuận", "Phú Thọ",
    "Phú Yên", "Quảng Bình", "Quảng Nam", "Quảng Ngãi", "Quảng Ninh", "Quảng Trị",
    "Sóc Trăng", "Sơn La", "Tây Ninh", "Thái Bình", "Thái Nguyên", "Thanh Hóa",
    "Thừa Thiên Huế", "Tiền Giang", "TP. Hồ Chí Minh", "Trà Vinh", "Tuyên Quang",
    "Vĩnh Long", "Vĩnh Phúc", "Yên Bái"
]

@app.route("/", methods=["GET", "POST"])
def index():
    query = request.form.get("keyword", "").strip()
    province = request.form.get("province", "all")

    results = products
    results = filter_by_province(results, province)

    if request.method == "POST" and query:
        results = find_with_priority(query, results)

    return render_template(
        "index.html",
        query=query,
        province=province,
        results=results,
        provinces=provinces  # ✅ TRUYỀN TỈNH VỀ HTML
    )

if __name__ == "__main__":
    app.run(debug=True)
