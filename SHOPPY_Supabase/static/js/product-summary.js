const API_BASE = '';
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);
// Biến lưu trữ sản phẩm (product object) hiện tại
let currentProductData = null; 
let cart = JSON.parse(localStorage.getItem('cart_v1') || '{}');

// Hàm format tiền tệ
function formatMoney(n) { 
    if (typeof n !== 'number') return '0₫';
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + '₫'; 
}

// --- Hàm hỗ trợ Cart UI (Vẫn giả lập, nên cập nhật fetchCartDetails như bài trước để tốt hơn) ---
function getCartItemDetails(key) {
    const [productId, storeId] = key.split('_');
    return {
        name: `SP#${productId} (Tải lại trang)`,
        store_name: `CH#${storeId}`,
        price: 0,
        img: 'images/placeholder.jpg'
    };
}

function saveCart() { localStorage.setItem('cart_v1', JSON.stringify(cart)); updateCartUI(); }

window.changeQty = function (key, delta) { 
    cart[key] = (cart[key] || 0) + delta;
    if (cart[key] <= 0) delete cart[key];
    saveCart();
}

window.removeItem = function (key) { 
    if (confirm("Xóa sản phẩm này khỏi giỏ hàng?")) { 
        delete cart[key]; 
        saveCart(); 
    } 
}

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

// --- Hàm hỗ trợ Account/Logout (Giữ nguyên) ---
async function updateAccountLink() {
    const accountLink = document.getElementById('account-link');
    const logoutLink = document.getElementById('logout-link');
    if (typeof supabase === 'undefined') return; 

    const { data: { session } } = await supabase.auth.getSession();
    let userName = null;

    if (session && session.user) {
        userName = session.user.user_metadata.name || session.user.email.split('@')[0];
        localStorage.setItem('userName', userName);
    } else {
        localStorage.removeItem('userName');
    }

    if (userName && accountLink) {
        accountLink.innerHTML = `👋 Chào, <b>${userName}</b>`;
        accountLink.href = 'profile.html';
        if (logoutLink) logoutLink.style.display = 'flex';
    } else if (accountLink) {
        accountLink.textContent = 'Tài Khoản';
        accountLink.href = 'account.html';
        if (logoutLink) logoutLink.style.display = 'none';
    }
}

function showCustomConfirm(message) {
    return new Promise(resolve => {
        const modal = document.getElementById('custom-confirm-modal');
        const messageElement = modal.querySelector('#modal-message');
        const yesButton = modal.querySelector('#modal-confirm-yes');
        const noButton = modal.querySelector('#modal-confirm-no');

        if (!modal || !messageElement || !yesButton || !noButton) {
            resolve(confirm(message));
            return;
        }
        messageElement.textContent = message;
        modal.style.display = 'flex';
        const handleYes = () => { modal.style.display = 'none'; removeListeners(); resolve(true); };
        const handleNo = () => { modal.style.display = 'none'; removeListeners(); resolve(false); };
        yesButton.addEventListener('click', handleYes, { once: true });
        noButton.addEventListener('click', handleNo, { once: true });
        const removeListeners = () => {
            yesButton.removeEventListener('click', handleYes);
            noButton.removeEventListener('click', handleNo);
        };
    });
}

window.handleLogout = async function () {
    const confirmLogout = await showCustomConfirm("Bạn có chắc chắn muốn đăng xuất khỏi tài khoản này không?");
    if (!confirmLogout) return;
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        localStorage.removeItem('accessToken');
        localStorage.removeItem('userName');
        localStorage.removeItem('cart_v1');
        window.location.reload();
    } catch (err) {
        alert("Đăng xuất thất bại. Vui lòng thử lại.");
    }
};

window.toggleFilterMenu = function () { 
    const menu = $('#filter-dropdown');
    if (menu) menu.classList.toggle('active');
}
window.startVoiceSearch = function () { alert("Tìm kiếm bằng giọng nói chỉ hỗ trợ trên trang chủ."); }
window.openImageSearch = function () { alert("Tìm kiếm bằng hình ảnh chỉ hỗ trợ trên trang chủ."); }

// --- Logic Search ---
let suggestionTimeout;
const searchInput = $('#search_input');
function hideSuggestions() { const suggestionsDiv = $('#search_suggestions'); if (suggestionsDiv) suggestionsDiv.style.display = 'none'; }
if(searchInput) {
    searchInput.addEventListener('input', () => {
        clearTimeout(suggestionTimeout);
        suggestionTimeout = setTimeout(() => { hideSuggestions(); }, 300);
    });
}
document.addEventListener('click', function(event) {
    const form = $('#search_form');
    const suggestions = $('#search_suggestions');
    if (form && suggestions && !form.contains(event.target) && !suggestions.contains(event.target)) { hideSuggestions(); }
});

// ======================================================================
// PHẦN LOGIC TRANG SUMMARY (TẢI DỮ LIỆU) - ĐÃ CẬP NHẬT
// ======================================================================

async function loadProductData(productId) {
    try {
        // --- THAY ĐỔI QUAN TRỌNG ---
        // Gọi endpoint API mới chuyên biệt: api/product_summary
        // Endpoint này Backend sẽ tự fetch data theo Id đó
        const res = await fetch(`/api/product_summary?product_id=${productId}`);
        
        if (!res.ok) {
             throw new Error(`Server returned ${res.status}`);
        }

        const products = await res.json();
        
        // Vì API trả về mảng [product_obj] (để giữ cấu trúc chuẩn), ta lấy phần tử đầu tiên
        if (products && products.length > 0) {
            const product = products[0];
            currentProductData = product;
            return product;
        } else {
            $('#summary-product-name').textContent = 'Sản phẩm không tồn tại';
            $('#recommended-stores-list').innerHTML = '<div class="no-stores">Không tìm thấy thông tin sản phẩm này.</div>';
            return null;
        }

    } catch (err) {
        console.error("Lỗi khi load Product Data:", err);
        $('#recommended-stores-list').innerHTML = '<div class="no-stores" style="color:red">Lỗi kết nối server khi tải dữ liệu.</div>';
        return null;
    }
}

function renderProductSummary(product) {
    
    // --- 1. Cập nhật thông tin tổng quan sản phẩm ---
    if ($('#summary-product-name')) $('#summary-product-name').textContent = product.product_name;
    if ($('#breadcrumb-product-name')) $('#breadcrumb-product-name').textContent = product.product_name;
    if ($('#summary-product-tag')) $('#summary-product-tag').textContent = `#${product.tag || 'Chung'}`;
    if ($('#summary-product-image')) $('#summary-product-image').src = product.product_image_url || 'images/placeholder.jpg';
    if ($('#summary-product-description')) $('#summary-product-description').textContent = product.product_des || 'Không có mô tả chi tiết cho sản phẩm này.';
    
    const minPrice = product.min_price || product.product_min_cost;
    const maxPrice = product.max_price || product.product_max_cost;

    let priceText = 'Liên hệ';
    if (minPrice) {
        priceText = formatMoney(minPrice);
        if (maxPrice && maxPrice !== minPrice) {
            priceText += ` - ${formatMoney(maxPrice)}`;
        }
    }
    if ($('#summary-product-price')) $('#summary-product-price').textContent = priceText;


    // --- 2. Cập nhật danh sách cửa hàng ---
    const storeList = $('#recommended-stores-list');
    if (!storeList) return;
    
    storeList.innerHTML = '';
    
    if (!product.stores || product.stores.length === 0) {
        storeList.innerHTML = '<div class="no-stores">Hiện không có cửa hàng nào cung cấp sản phẩm này.</div>';
        return;
    }

    product.stores.forEach(store => {
        // Lấy ảnh của cửa hàng (ưu tiên type=1 hoặc lấy cái đầu tiên)
        const mainImage = store.product_images && store.product_images.length > 0 
                          ? (store.product_images.find(img => img.ps_type === 1) || store.product_images[0])
                          : null;
                          
        const storeImageUrl = mainImage ? mainImage.ps_image_url : product.product_image_url;
        
        const rating = store.ps_average_rating ? Number(store.ps_average_rating).toFixed(1) : 'Chưa có';
        const reviewCount = store.ps_total_reviews ? store.ps_total_reviews : 0;
        
        const storeMinPrice = store.ps_min_price_store || 0;
        const storeMaxPrice = store.ps_max_price_store || 0;

        let storePriceText = formatMoney(storeMinPrice);
        if (storeMaxPrice && storeMaxPrice !== storeMinPrice) {
             storePriceText += ` - ${formatMoney(storeMaxPrice)}`;
        }

        const storeCard = document.createElement('a');
        storeCard.className = 'store-item-card';
        storeCard.href = `product-detail.html?product_id=${product.product_id}&store_id=${store.store_id}`;
        
        storeCard.innerHTML = `
            <img src="${storeImageUrl}" alt="${store.store_name}" onerror="this.src='images/placeholder.jpg'">
            <div class="store-info">
                <div class="store-name">${store.store_name}</div>
                <div style="font-size:14px; color:#555;">Địa chỉ: ${store.store_address || 'Đang cập nhật'}</div>
                <div class="store-price">Giá: ${storePriceText}</div>
                <div class="store-review">⭐ ${rating} (${reviewCount} đánh giá)</div>
            </div>
            <div class="store-actions">
                <button>Xem Chi Tiết</button>
            </div>
        `;

        storeList.appendChild(storeCard);
    });
}

async function init() {
    const params = new URLSearchParams(window.location.search);
    const product_id = params.get('product_id');

    if (!product_id) { 
        document.body.innerHTML = '<h2 style="padding:50px">Không tìm thấy ID sản phẩm. Vui lòng quay lại trang chủ.</h2>'; 
        return; 
    }
    
    const product = await loadProductData(product_id);
    
    if (product) {
        renderProductSummary(product);
    }
}

document.addEventListener('DOMContentLoaded', () => {
     updateAccountLink(); 
     updateCartUI(); 
     init();

     const searchForm = $('#search_form');
     if(searchForm) {
        searchForm.onsubmit = (e) => {
            e.preventDefault();
            const searchInput = $('#search_input');
            if(searchInput) {
                window.location.href = `index.html?search=${searchInput.value}`;
            }
        };
     }
    
    if ($('#open-cart')) { $('#open-cart').addEventListener('click', () => { const popup = $('#cart-popup'); if (popup) popup.style.display = (popup.style.display === 'block') ? 'none' : 'block'; }); }
    if ($('#close-cart')) { $('#close-cart').addEventListener('click', () => { const popup = $('#cart-popup'); if (popup) popup.style.display = 'none'; }); }
    if ($('#clear-cart')) { $('#clear-cart').addEventListener('click', () => { if (confirm('Xóa toàn bộ giỏ hàng?')) { cart = {}; saveCart(); } }); }
    if ($('#checkout')) {
        $('#checkout').addEventListener('click', (e) => {
            e.preventDefault();
            const count = Object.values(cart).reduce((s, q) => s + q, 0);
            if (count === 0) { alert('Giỏ hàng đang rỗng.'); return; }
            window.location.href = 'cart.html';
        });
    }
});