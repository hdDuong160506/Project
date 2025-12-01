const API_BASE = '';
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);
let cart = JSON.parse(localStorage.getItem('cart_v1') || '{}');
let currentProduct = null;
let currentQuantity = 1;

let currentStoreLat = null;
let currentStoreLon = null;
let currentStoreId = null;

// --- Dữ liệu tất cả sản phẩm (từ API call bổ sung) ---
let ALL_PRODUCTS = [];

function formatMoney(n) {
    if (typeof n !== 'number') return '0₫';
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + '₫';
}

// BỎ renderStars (không còn dùng)

function saveCart() { localStorage.setItem('cart_v1', JSON.stringify(cart)); updateCartUI(); }

window.addToCart = function (productId, storeId, qty) { // Đưa ra global scope
    // Sử dụng key ps_id (currentProduct.id) nếu có, nếu không thì dùng tạm key product_id_store_id
    const key = currentProduct && currentProduct.id ? currentProduct.id : `${productId}_${storeId}`;
    qty = parseInt(qty, 10);

    cart[key] = (cart[key] || 0) + qty;
    saveCart();
    alert('Đã thêm sản phẩm vào giỏ hàng!');
}

window.changeQty = function (key, delta) { // Đưa ra global scope
    cart[key] = (cart[key] || 0) + delta;
    if (cart[key] <= 0) delete cart[key];
    saveCart();
}

window.removeItem = function (key) { // Đưa ra global scope
    if (confirm("Xóa sản phẩm này khỏi giỏ hàng?")) { delete cart[key]; saveCart(); }
}


// ======================================================================
// PHẦN 1: TẢI TẤT CẢ SẢN PHẨM (Mô phỏng logic từ index.html)
// ======================================================================
async function loadAllProducts() {
    try {
        // Tải tất cả sản phẩm (không filter)
        const res = await fetch(`/api/products`);
        ALL_PRODUCTS = await res.json();
        console.log(`Đã tải ${ALL_PRODUCTS.length} sản phẩm cho giỏ hàng.`);
    } catch (err) {
        console.error("Lỗi khi load ALL_PRODUCTS:", err);
    }
}


// ======================================================================
// PHẦN 2: HÀM TÌM THÔNG TIN SẢN PHẨM TRONG GIỎ HÀNG 
// ======================================================================
function getCartItemDetails(key, isPsId = true) {
    let productId, storeId;

    // Key ở đây có thể là ps_id (từ trang detail) hoặc productId_storeId (từ trang index)
    if (currentProduct && key == currentProduct.id) {
        productId = currentProduct.product_id;
        storeId = currentProduct.store_id;
    } else {
        [productId, storeId] = key.split('_');
    }

    // 1. Tìm sản phẩm chính trong danh sách tổng
    const product = ALL_PRODUCTS.find(p => p.product_id == productId);

    if (product) {
        // 2. Tìm cửa hàng cụ thể trong sản phẩm đó
        const store = product.stores.find(s => s.store_id == storeId);

        if (store) {
            // Lấy ảnh chính của cửa hàng (ps_type = 1), nếu không có thì dùng ảnh sản phẩm
            const mainImage = store.product_images ? store.product_images.find(img => img.ps_type === 1) : null;
            const storeImageUrl = mainImage ? mainImage.ps_image_url : product.product_image_url;

            return {
                name: product.product_name,
                store_name: store.store_name,
                // Dùng giá từ store (ps_min_price_store)
                price: store.ps_min_price_store || 0,
                img: storeImageUrl
            };
        }
    }

    // Nếu không tìm thấy
    return {
        name: `Sản phẩm #${productId}`,
        store_name: `Cửa hàng #${storeId}`,
        price: 0,
        img: 'images/placeholder.jpg'
    };
}


// ======================================================================
// PHẦN 3: CẬP NHẬT GIAO DIỆN GIỎ HÀNG (SỬ DỤNG getCartItemDetails)
// ======================================================================
function updateCartUI() {
    const cartList = $('#cart-list');
    const cartCount = Object.values(cart).reduce((s, q) => s + q, 0);
    let total = 0;

    const cartCountBubble = $('#cart-count');
    if (cartCountBubble) {
        cartCountBubble.textContent = cartCount;
        cartCountBubble.style.display = cartCount > 0 ? 'block' : 'none';
    }

    if (cartCount === 0) {
        if (cartList) cartList.innerHTML = '<div style="color:#888">Giỏ hàng trống</div>';
        if ($('#cart-total')) $('#cart-total').textContent = formatMoney(0);
        return;
    }

    if (cartList) {
        cartList.innerHTML = '';

        Object.entries(cart).forEach(([key, qty]) => {
            // Lấy thông tin chi tiết sản phẩm (Dùng ALL_PRODUCTS)
            const itemDetails = getCartItemDetails(key);

            const price = itemDetails.price || 0;
            total += price * qty;

            const item = document.createElement('div');
            item.className = 'cart-item';

            item.innerHTML = `
                <img src="${itemDetails.img}" />

                <div style="flex:1">
                    <div style="font-size:14px">${itemDetails.name}</div>
                    <div style="font-size:12px;color:#666">${itemDetails.store_name}</div>
                    <div style="font-size:13px;color:#666">
                        ${formatMoney(price)} x ${qty} = ${formatMoney(price * qty)}
                    </div>
                </div>

                <div class="qty">
                    <button class="small-btn" onclick="changeQty('${key}', -1)">-</button>
                    <div style="min-width:20px;text-align:center">${qty}</div>
                    <button class="small-btn" onclick="changeQty('${key}', 1)">+</button>

                    <button class="small-btn" style="margin-left:6px" onclick="removeItem('${key}')">xóa</button>
                </div>
            `;

            cartList.appendChild(item);
        });
    }

    if ($('#cart-total')) $('#cart-total').textContent = formatMoney(total);
}
// ======================================================================


function updateAccountLink() {
    const accountLink = document.getElementById('account-link');
    const userName = localStorage.getItem('userName');
    const logoutLink = document.getElementById('logout-link');
    if (accountLink) {
        if (userName) {
            accountLink.textContent = `👋 Chào, ${userName}`;
            accountLink.href = 'profile.html';
            if (logoutLink) logoutLink.style.display = 'flex';
        } else {
            accountLink.textContent = 'Tài Khoản';
            accountLink.href = 'account.html';
            if (logoutLink) logoutLink.style.display = 'none';
        }
    }
}

/**
 * Tải chi tiết sản phẩm bằng cách tìm kiếm trong ALL_PRODUCTS
 * và dùng Supabase để lấy PS_ID cho Cart Key.
 */
async function loadMainProduct() {
    const params = new URLSearchParams(window.location.search);
    const product_id = params.get('product_id');
    const store_id = params.get('store_id');

    if (!product_id || !store_id) {
        document.body.innerHTML = '<h2 style="padding:20px">Không tìm thấy ID sản phẩm hoặc Cửa hàng</h2>';
        return;
    }

    // 1. Tìm sản phẩm chính trong ALL_PRODUCTS
    const product = ALL_PRODUCTS.find(p => p.product_id == product_id);

    if (!product) {
        document.body.innerHTML = '<h2 style="padding:20px">Không tìm thấy sản phẩm này trong danh sách.</h2>';
        return;
    }

    // 2. Tìm cửa hàng cụ thể
    const store = product.stores.find(s => s.store_id == store_id);

    if (!store) {
        document.body.innerHTML = '<h2 style="padding:20px">Không tìm thấy cửa hàng này cho sản phẩm.</h2>';
        return;
    }

    // 3. TÌM PS_ID DÙNG SUPABASE (Key cho Cart)
    let ps_id = null;
    try {
        const { data, error } = await supabase
            .from('product_store')
            .select('ps_id')
            .eq('product_id', product_id)
            .eq('store_id', store_id)
            .single();

        if (data) ps_id = data.ps_id;
        // Bỏ qua lỗi nếu không tìm thấy ps_id (sẽ dùng product_id_store_id thay thế)
    } catch (e) {
        console.error("Lỗi tra cứu PS_ID:", e);
    }

    // 4. Xây dựng object currentProduct
    const mainImage = store.product_images ? store.product_images.find(img => img.ps_type === 1) : null;
    const storeImageUrl = mainImage ? mainImage.ps_image_url : product.product_image_url;

    currentStoreId = store.store_id

    currentProduct = {
        id: ps_id, // Key cho Cart (nếu null, sẽ được xử lý khi thêm vào giỏ)
        product_id: product.product_id,
        store_id: store.store_id,
        name: store.store_name,                 // Tên cửa hàng (store_name)
        sub_name: product.product_name,           // Tên sản phẩm gốc
        address: store.store_address,
        price: store.ps_min_price_store || 0, // Dùng giá từ cửa hàng
        img: storeImageUrl,
        description: product.product_des || "Không có mô tả.",
        // Bỏ rating và review_count
    };

    // 5. Cập nhật giao diện
    $('#product-name').textContent = currentProduct.sub_name;
    // Cập nhật Subtitle với tên và địa chỉ Cửa hàng
    document.getElementById('product-subtitle').innerHTML = `<div><strong>Cửa hàng:</strong> ${currentProduct.name}</div><div style="font-size: 0.9em; color: #777;">📍 ${currentProduct.address || ''}</div>`;
    $('#product-price').textContent = formatMoney(currentProduct.price);
    $('#product-image-main').src = currentProduct.img;
    $('#product-description').textContent = currentProduct.description;

    // ĐÃ XÓA LOGIC CẬP NHẬT selected-store-detail
}


// ======================================================================
// PHẦN 4: KHỞI ĐỘNG (Phần sự kiện đã được đưa ra global scope)
// ======================================================================
let currentRecognition = null;

// HÀM GLOBAL (ĐỂ HTML GỌI)
window.toggleFilterMenu = function () {
    const menu = $('#filter-dropdown');
    if (menu) menu.classList.toggle('active');
}
window.startVoiceSearch = function () { alert("Tìm kiếm bằng giọng nói chưa được tích hợp trên trang này."); }
window.cancelVoiceSearch = function () { if (currentRecognition) currentRecognition.abort(); $('#voice_popup').style.display = "none"; }


document.addEventListener('DOMContentLoaded', async () => {
    // Bước 1: Tải tất cả sản phẩm
    await loadAllProducts();

    // Bước 2: Tải sản phẩm chi tiết của trang hiện tại
    await loadMainProduct();

    // Bước 3: Cập nhật Giỏ hàng
    updateCartUI();

    updateAccountLink();

    // --- Logic mới cho Breadcrumb ---
    const params = new URLSearchParams(window.location.search);
    const product_id = params.get('product_id');
    const summaryLinkSpan = document.getElementById('breadcrumb-summary-link');

    if (summaryLinkSpan && product_id && currentProduct) {
        // Lấy tên sản phẩm gốc (product.product_name) từ currentProduct
        const productName = currentProduct.sub_name || 'Tổng quan sản phẩm';

        // Tạo link về trang tổng quan
        const summaryLink = document.createElement('a');
        summaryLink.href = `product-summary.html?product_id=${product_id}`;
        summaryLink.textContent = productName;

        summaryLinkSpan.appendChild(summaryLink);
    } else if (summaryLinkSpan) {
        summaryLinkSpan.textContent = 'Tổng quan sản phẩm';
    }
    // --- Hết Logic mới cho Breadcrumb ---

    // GẮN SỰ KIỆN QTY
    $('#qty-input').value = currentQuantity;
    $('#qty-minus').onclick = () => { if (currentQuantity > 1) $('#qty-input').value = --currentQuantity; };
    $('#qty-plus').onclick = () => { $('#qty-input').value = ++currentQuantity; };

    // GẮN SỰ KIỆN ADD TO CART
    $('#add-to-cart-btn').onclick = () => {
        if (currentProduct && currentProduct.product_id && currentProduct.store_id) addToCart(currentProduct.product_id, currentProduct.store_id, currentQuantity);
        else alert('Lỗi: Thiếu thông tin sản phẩm để thêm vào giỏ hàng.');
    };

    // GẮN SỰ KIỆN BUY NOW
    $('#buy-now-btn').onclick = () => {
        if (currentProduct && currentProduct.product_id && currentProduct.store_id) {
            addToCart(currentProduct.product_id, currentProduct.store_id, currentQuantity);
            document.body.classList.add('page-fade-out');
            setTimeout(() => { window.location.href = 'cart.html'; }, 500);
        } else alert('Lỗi: Thiếu thông tin sản phẩm để mua ngay.');
    };

    // GẮN SỰ KIỆN MAP
    const mapBtn = document.getElementById('map-btn'); // Hoặc $('#map-btn') nếu dùng jQuery

    if (mapBtn) {
        mapBtn.onclick = () => {
            // Chuyển hướng người dùng sang đường dẫn của Blueprint
            // Dùng '/map/' (tương đối) để nó tự nhận host và port 5000 hiện tại
            const storeInfo = {
                id: currentStoreId
            };

            // Lưu vào bộ nhớ trình duyệt (phải chuyển thành chuỗi JSON)
            localStorage.setItem('TARGET_STORE', JSON.stringify(storeInfo));
            window.location.href = '/map/';
        };
    }

    // GẮN SỰ KIỆN SEARCH
    $('#search_form').onsubmit = (e) => {
        e.preventDefault();
        document.body.classList.add('page-fade-out');
        setTimeout(() => { window.location.href = `index.html?search=${$('#search_input').value}`; }, 500);
    };

    // GẮN SỰ KIỆN CART POPUP
    $('#open-cart').onclick = () => { const popup = $('#cart-popup'); popup.style.display = (popup.style.display === 'block') ? 'none' : 'block'; };
    $('#close-cart').onclick = () => $('#cart-popup').style.display = 'none';
    $('#clear-cart').onclick = () => { if (confirm('Xóa toàn bộ giỏ hàng?')) { cart = {}; saveCart(); } };
    $('#checkout').onclick = () => { document.body.classList.add('page-fade-out'); setTimeout(() => { window.location.href = 'cart.html'; }, 500); };

    // GẮN SỰ KIỆN LOGOUT
    if ($('#logout-link')) {
        $('#logout-link').addEventListener('click', async () => {
            await supabase.auth.signOut();
            localStorage.removeItem('accessToken');
            localStorage.removeItem('userName');
            document.body.classList.add('page-fade-out');
            setTimeout(() => { window.location.href = 'index.html'; }, 500);
        });
    }
});