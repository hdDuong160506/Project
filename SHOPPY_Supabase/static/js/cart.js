// ==========================================================
// cart.js - Phiên bản Safe Mode (Chống Crash khi Init chậm)
// ==========================================================

let CART_DATA = {}; 
let cart = JSON.parse(localStorage.getItem('cart_v1') || '{}');
const $ = sel => document.querySelector(sel);

function formatMoney(n) {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + '₫';
}

// ==========================================================
// 1. KHỞI TẠO
// ==========================================================

async function initCartPage() {
    console.log("🚀 Cart Page Initializing...");
    setupEventListeners();
    await loadCartData();
}

function setupEventListeners() {
    const listContainer = $('#cart-page-list');
    if (!listContainer) return;

    if (listContainer.dataset.eventAttached === "true") return;

    listContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-action');
        if (!btn) return;
        e.preventDefault();

        const action = btn.dataset.action;
        const key = btn.dataset.key;
        
        console.log(`🖱️ Click: ${action} - SP: ${key}`);
        handleCartAction(action, key);
    });

    listContainer.dataset.eventAttached = "true";
}

// ==========================================================
// 2. LOGIC XỬ LÝ
// ==========================================================

function handleCartAction(action, key) {
    if (action === 'increase') {
        cart[key] = (cart[key] || 0) + 1;
    } 
    else if (action === 'decrease') {
        cart[key] = (cart[key] || 0) - 1;
        if (cart[key] <= 0) delete cart[key];
    } 
    else if (action === 'remove') {
        if (confirm('Bạn chắc chắn muốn xóa sản phẩm này?')) delete cart[key];
        else return;
    }
    saveCart();
}

// 🔥 HÀM SAVE CART (ĐÃ FIX LỖI CRASH undefined reading 'getSession')
function saveCart() {
    // 1. Lưu LocalStorage & Render ngay
    localStorage.setItem('cart_v1', JSON.stringify(cart));
    renderCartPage();

    // 2. Sync DB
    if (window.cartSyncTimeout) clearTimeout(window.cartSyncTimeout);

    window.cartSyncTimeout = setTimeout(async () => {
        // 🛑 CHECK KỸ: Phải có supabase VÀ phải có .auth (Client xịn)
        if (typeof supabase === 'undefined' || !supabase.auth) {
            console.warn("⚠️ Supabase chưa sẵn sàng (Init chậm hoặc sai thứ tự script). Bỏ qua Sync.");
            return;
        }

        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            
            if (session && session.user) {
                console.log("☁️ Đang đồng bộ...");
                const freshCartData = JSON.parse(localStorage.getItem('cart_v1') || '{}');

                const { error: upsertError } = await supabase
                    .from('cart')
                    .upsert({ 
                        user_id: session.user.id, 
                        cart_data: freshCartData, 
                        updated_at: new Date()
                    }, { onConflict: 'user_id' });

                if (upsertError) console.error("❌ Sync Lỗi:", upsertError.message);
                else console.log("✅ Sync Thành công!");
            }
        } catch (err) {
            console.error("🔥 Lỗi Sync:", err);
        }
    }, 1000);
}

// ==========================================================
// 3. TẢI DATA & RENDER
// ==========================================================

async function loadCartData() {
    // Check LocalStorage trước
    if (Object.keys(cart).length === 0) {
        await trySyncFromDB();
        if (Object.keys(cart).length === 0) {
            renderEmptyCart();
            return;
        }
    } else {
        // Chạy ngầm check DB
        trySyncFromDB().then(hasNew => {
            if (hasNew) {
                console.log("♻️ Reload data mới từ DB...");
                fetchProductDetails();
            }
        });
    }
    await fetchProductDetails();
}

// 🔥 HÀM SYNC CHECK (CŨNG ĐÃ FIX LỖI CRASH)
async function trySyncFromDB() {
    // 🛑 CHECK KỸ: Tránh crash nếu supabase chỉ là thư viện rỗng
    if (typeof supabase === 'undefined' || !supabase.auth) return false;

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return false;

        const { data: dbCart } = await supabase
            .from('cart')
            .select('cart_data')
            .eq('user_id', session.user.id)
            .maybeSingle();

        if (dbCart?.cart_data) {
            const localStr = JSON.stringify(cart);
            const dbStr = JSON.stringify(dbCart.cart_data);
            if (localStr !== dbStr) {
                cart = dbCart.cart_data;
                localStorage.setItem('cart_v1', JSON.stringify(cart));
                return true; 
            }
        }
    } catch (e) { 
        // Lờ đi lỗi nhẹ
    }
    return false;
}

function renderCartPage() {
    const cartList = $('#cart-page-list');
    if (!cartList) return;

    const cartCount = Object.values(cart).reduce((s, q) => s + q, 0);
    let total = 0;

    if (cartCount === 0) { renderEmptyCart(); return; }
    if($('#cart-page-checkout')) $('#cart-page-checkout').disabled = false;
    
    cartList.innerHTML = '';

    Object.entries(cart).forEach(([key, qty]) => {
        const itemDetails = CART_DATA[key];
        if (!itemDetails) return;

        const storeInfo = itemDetails.stores[0];
        const price = storeInfo.ps_min_price_store || 0;
        const itemTotal = price * qty;
        total += itemTotal;

        let displayImage = itemDetails.product_image_url;
        if (storeInfo.product_images?.length > 0) {
            displayImage = storeInfo.product_images[0].ps_image_url;
        }

        const item = document.createElement('div');
        item.className = 'cart-page-item';
        
        item.innerHTML = `
          <div class="col-product">
            <input type="checkbox" checked style="margin-right: 10px;" />
            <img src="${displayImage}" alt="img" onerror="this.src='images/placeholder.jpg'" />
            <div class="product-info">
              <h4>${itemDetails.product_name}</h4>
              <div class="shop-info">🏪 ${storeInfo.store_name}</div>
            </div>
          </div>
          <div class="col-price text-center">${formatMoney(price)}</div>
          <div class="col-qty">
            <div class="qty-selector">
              <button class="qty-btn btn-action" data-action="decrease" data-key="${key}">-</button>
              <div class="qty-display">${qty}</div>
              <button class="qty-btn btn-action" data-action="increase" data-key="${key}">+</button>
            </div>
          </div>
          <div class="col-total text-center text-bold">${formatMoney(itemTotal)}</div>
          <div class="col-action text-right">
            <button class="delete-btn btn-action" data-action="remove" data-key="${key}">Xóa</button>
          </div>
        `;
        cartList.appendChild(item);
    });

    $('#cart-page-total').innerHTML = `Tổng cộng (${cartCount} Sản phẩm): <span>${formatMoney(total)}</span>`;
}

async function fetchProductDetails() {
    const cartList = $('#cart-page-list');
    if (!CART_DATA || Object.keys(CART_DATA).length === 0) {
        cartList.innerHTML = '<div style="text-align:center; padding:30px;"><div class="spinner"></div><p>Đang tải...</p></div>';
    }
    try {
        const res = await fetch('/api/cart/details', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cart: cart })
        });
        if (res.ok) {
            CART_DATA = await res.json();
            renderCartPage();
        } else {
            cartList.innerHTML = '<p style="color:red; text-align:center;">Lỗi tải sản phẩm.</p>';
        }
    } catch (err) {
        cartList.innerHTML = '<p style="color:red; text-align:center;">Lỗi kết nối.</p>';
    }
}

function renderEmptyCart() {
    const list = $('#cart-page-list');
    if(list) list.innerHTML = '<div class="empty-cart">Giỏ trống <br><a href="index.html">Mua ngay</a></div>';
    const totalEl = $('#cart-page-total');
    if(totalEl) totalEl.innerHTML = `Tổng cộng (0 Sản phẩm): <span>0₫</span>`;
    if($('#cart-page-checkout')) $('#cart-page-checkout').disabled = true;
}

const checkoutBtn = $('#cart-page-checkout');
if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
        const count = Object.values(cart).reduce((s, q) => s + q, 0);
        if (count === 0) { alert('Giỏ hàng trống!'); return; }
        window.location.href = 'checkout.html';
    });
}

window.onload = initCartPage;

// Fallback
window.changeQty = function (key, delta) { handleCartAction(delta > 0 ? 'increase' : 'decrease', key); }
window.removeItem = function (key) { handleCartAction('remove', key); }