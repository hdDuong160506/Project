const API_BASE = '';
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);
// Biến lưu trữ sản phẩm (product object) hiện tại
// Chú ý: currentProductData.stores_raw sẽ lưu danh sách cửa hàng gốc
let currentProductData = null; 
let cart = JSON.parse(localStorage.getItem('cart_v1') || '{}');

// Hàm format tiền tệ
function formatMoney(n) { 
    if (typeof n !== 'number') return '0₫';
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + '₫'; 
}

// --- Hàm hỗ trợ Cart UI (Giữ nguyên) ---
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
        const storedName = localStorage.getItem('userName');
        if (storedName) {
             userName = storedName;
        } else {
            userName = session.user.user_metadata.name || session.user.email.split('@')[0];
        }
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

// --- Logic Search (Giữ nguyên) ---
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
// PHẦN LOGIC TRANG SUMMARY (TẢI DỮ LIỆU)
// ======================================================================

async function loadProductData(productId) {
    try {
        const res = await fetch(`/api/product_summary?product_id=${productId}`);
        
        if (!res.ok) {
             throw new Error(`Server returned ${res.status}`);
        }

        const products = await res.json();
        
        if (products && products.length > 0) {
            const product = products[0];
            currentProductData = product;
            // LƯU TRỮ THỨ TỰ GỐC CỦA CỬA HÀNG CHO CHẾ ĐỘ 'MẶC ĐỊNH'
            currentProductData.stores_raw = [...product.stores]; 
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

// ======================================================================
// PHẦN LOGIC SẮP XẾP CỬA HÀNG
// ======================================================================

window.sortAndRenderStores = function () {
    if (!currentProductData || !currentProductData.stores_raw) return;

    // LẤY GIÁ TRỊ TỪ RADIO BUTTON ĐANG ĐƯỢC CHỌN
    const checkedRadio = document.querySelector('input[name="store_sort_filter"]:checked');
    if (!checkedRadio) return;
    
    const sortValue = checkedRadio.value;
    let sortedStores = [...currentProductData.stores_raw]; // Bắt đầu từ bản gốc (stores_raw)

    switch (sortValue) {
        case 'default':
            // Mặc định: Giữ nguyên bản sao từ stores_raw
            break; 
        case 'dist_asc':
            // Gần nhất: Sắp xếp Tăng dần khoảng cách (ps_distance)
            sortedStores.sort((a, b) => {
                const distA = a.ps_distance || Infinity; // Infinity nằm cuối
                const distB = b.ps_distance || Infinity;
                return distA - distB;
            });
            break;
        case 'price_asc':
            // Giá thấp: Sắp xếp Tăng dần giá (ps_min_price_store)
            sortedStores.sort((a, b) => {
                const priceA = a.ps_min_price_store || 0;
                const priceB = b.ps_min_price_store || 0;
                return priceA - priceB;
            });
            break;
        case 'rating_desc':
            // Đánh giá cao: Sắp xếp Giảm dần rating (ps_average_rating)
            sortedStores.sort((a, b) => {
                const ratingA = Number(a.ps_average_rating) || 0;
                const ratingB = Number(b.ps_average_rating) || 0;
                return ratingB - ratingA;
            });
            break;
        // Các trường hợp 'dist_desc' và 'price_desc' đã được loại bỏ theo yêu cầu mới.
    }

    // Cập nhật currentProductData tạm thời để render
    const productToRender = { 
        ...currentProductData, 
        stores: sortedStores 
    };

    renderProductSummary(productToRender);
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
    
    const storesToRender = product.stores || [];

    if (storesToRender.length === 0) {
        storeList.innerHTML = '<div class="no-stores">Hiện không có cửa hàng nào cung cấp sản phẩm này.</div>';
        return;
    }

    storesToRender.forEach(store => {
        // ... (Logic tính giá và ảnh giữ nguyên)
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

        // HIỂN THỊ KHOẢNG CÁCH
        const distanceInfo = store.ps_distance 
            ? `<span style="margin-left: 10px;">| Cách bạn: ${store.ps_distance.toFixed(2)} km</span>` 
            : ``; 

        const storeCard = document.createElement('a');
        storeCard.className = 'store-item-card';
        storeCard.href = `product-detail.html?product_id=${product.product_id}&store_id=${store.store_id}`;
        
        storeCard.innerHTML = `
            <img src="${storeImageUrl}" alt="${store.store_name}" onerror="this.src='images/placeholder.jpg'">
            <div class="store-info">
                <div class="store-name">${store.store_name}</div>
                <div style="font-size:14px; color:#555;">Địa chỉ: ${store.store_address || 'Đang cập nhật'}</div>
                <div class="store-price">Giá: ${storePriceText}</div>
                <div class="store-review">⭐ ${rating} (${reviewCount} đánh giá) ${distanceInfo}</div>
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
        // Tải dữ liệu ban đầu xong thì render lần đầu
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
    
    // Logic Cart Popup (thay vì hover/js class, trang summary dùng click)
    const cartBtn = $('#open-cart');
    const cartPopup = $('#cart-popup');

    if (cartBtn && cartPopup) {
        cartBtn.addEventListener('click', () => {
             cartPopup.classList.toggle('cart-hover-active'); // Dùng class để toggle
        });
        
        // Đóng khi click ngoài
        document.addEventListener('click', (e) => {
            if (!cartBtn.contains(e.target) && !cartPopup.contains(e.target) && cartPopup.classList.contains('cart-hover-active')) {
                cartPopup.classList.remove('cart-hover-active');
            }
        });
    }

    if ($('#close-cart')) { $('#close-cart').addEventListener('click', () => { const popup = $('#cart-popup'); if (popup) popup.classList.remove('cart-hover-active'); }); }
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