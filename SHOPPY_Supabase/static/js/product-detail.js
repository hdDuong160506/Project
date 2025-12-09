// ======================================================================
// CẤU HÌNH & KHỞI TẠO (CHECKLIST MERGE)
// ======================================================================
const API_BASE = '';
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

// Lấy client Supabase từ window (đã init ở file supabase-init.js hoặc CDN)
const supabaseClient = window.supabase;

// State toàn cục
let cart = JSON.parse(localStorage.getItem('cart_v1') || '{}');
let CART_CACHE = {};
let currentProduct = null;
let currentQuantity = 1;
let currentPsId = null;
let currentRecognition = null; // Voice search

// State cho Image Search
let currentImageData = null;
let currentTab = 'upload';

// ======================================================================
// PHẦN LOGIC SEARCH SUGGESTIONS (THÊM MỚI - ĐỒNG BỘ VỚI INDEX.HTML)
// ======================================================================

let suggestionTimeout;
let highlightedIndex = -1;

function showSuggestions() {
    const suggestionsDiv = $('#search_suggestions');
    if (suggestionsDiv) suggestionsDiv.style.display = 'block';
}

function hideSuggestions() {
    const suggestionsDiv = $('#search_suggestions');
    if (suggestionsDiv) suggestionsDiv.style.display = 'none';
    highlightedIndex = -1;
}

async function fetchSuggestions(query) {
    if (!query || query.length < 2) {
        hideSuggestions();
        return;
    }

    try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(query)}&limit=5`);
        const suggestions = await res.json();
        renderSuggestions(suggestions, query);
    } catch (err) {
        console.error("Lỗi khi fetch gợi ý tìm kiếm:", err);
        hideSuggestions();
    }
}

function renderSuggestions(products, query) {
    const container = $('#search_suggestions');
    container.innerHTML = '';
    highlightedIndex = -1;

    if (!products || products.length === 0) {
        hideSuggestions();
        return;
    }

    // 1. Thêm dòng "Tìm kiếm toàn bộ" - ✅ LUÔN REDIRECT VỀ INDEX
    const searchAllItem = document.createElement('div');
    searchAllItem.className = 'suggestion-item suggestion-search-all';
    searchAllItem.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="#1867f8">
            <path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z"/>
        </svg>
        Tìm kiếm: <b>${query}</b>
    `;

    // ✅ REDIRECT VỀ INDEX
    searchAllItem.addEventListener('click', () => {
        hideSuggestions();
        document.body.classList.add('page-fade-out');
        setTimeout(() => {
            window.location.href = `index.html?search=${encodeURIComponent(query)}`;
        }, 500);
    });

    container.appendChild(searchAllItem);

    // 2. Thêm các sản phẩm gợi ý - VẪN ĐI ĐẾN PRODUCT-SUMMARY
    products.forEach(product => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        const imageUrl = product.product_image_url || 'images/placeholder.jpg';

        item.innerHTML = `
            <img class="suggestion-image" src="${imageUrl}" alt="${product.product_name}">
            <div class="suggestion-text-container">
                <div class="suggestion-name">${product.product_name}</div>
                <div class="suggestion-location">📍 ${product.location_name || 'Không rõ vị trí'}</div>
            </div>
        `;

        item.dataset.productId = product.product_id;
        item.addEventListener('click', () => {
            hideSuggestions();
            document.body.classList.add('page-fade-out');
            setTimeout(() => {
                window.location.href = `product-summary.html?product_id=${product.product_id}`;
            }, 500);
        });
        container.appendChild(item);
    });

    showSuggestions();
}

// ✅ HÀM SUBMIT SEARCH - LUÔN REDIRECT VỀ INDEX
function submitSearch(query) {
    const searchInput = $('#search_input');
    if (searchInput) {
        searchInput.value = query;
    }
    hideSuggestions();

    document.body.classList.add('page-fade-out');
    setTimeout(() => {
        window.location.href = `index.html?search=${encodeURIComponent(query)}`;
    }, 500);
}

function navigateToProductSummary(productId) {
    document.body.classList.add('page-fade-out');
    setTimeout(() => {
        window.location.href = `product-summary.html?product_id=${productId}`;
    }, 500);
    hideSuggestions();
}

// ======================================================================
// 2. CÁC HÀM TIỆN ÍCH (UTILS)
// ======================================================================
function formatMoney(n) {
    if (typeof n !== 'number') return '0₫';
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + '₫';
}

// Thay thế hàm saveCart cũ trong product-summary.js bằng hàm này:

function saveCart() {
    // 1. LƯU LOCALSTORAGE & UPDATE UI (Giữ nguyên logic cũ của bạn)
    localStorage.setItem('cart_v1', JSON.stringify(cart));
    
    // Cập nhật giao diện ngay lập tức
    if (typeof updateCartUI === 'function') updateCartUI();
    
    // Cập nhật cache chi tiết sản phẩm (như code cũ bạn đang có)
    if (typeof fetchCartDetails === 'function') fetchCartDetails();

    // 2. LOGIC MỚI: ĐỒNG BỘ LÊN DATABASE (Thêm đoạn này vào)
    
    // Hủy lệnh hẹn giờ cũ nếu user thao tác liên tiếp
    if (window.summarySyncTimeout) clearTimeout(window.summarySyncTimeout);

    // Đặt hẹn giờ mới (1 giây sau sẽ đẩy lên DB)
    window.summarySyncTimeout = setTimeout(async () => {
        // Kiểm tra Supabase có tồn tại không
        if (typeof supabase === 'undefined') return;

        try {
            // Lấy session user
            const { data: { session } } = await supabase.auth.getSession();

            // Chỉ lưu nếu đã đăng nhập
            if (session && session.user) {
                console.log("☁️ [Popup] Đang đồng bộ giỏ hàng lên Database...");

                // Đọc lại data mới nhất từ LocalStorage (Fresh Data)
                const freshCart = JSON.parse(localStorage.getItem('cart_v1') || '{}');

                const { error } = await supabase
                    .from('cart')
                    .upsert({ 
                        user_id: session.user.id, 
                        cart_data: freshCart, 
                        updated_at: new Date()
                    }, { onConflict: 'user_id' });

                if (error) {
                    console.error("❌ [Popup] Lỗi sync:", error.message);
                } else {
                    console.log("✅ [Popup] Đã lưu lên mây thành công!");
                }
            }
        } catch (err) {
            console.warn("⚠️ Lỗi hệ thống khi sync popup:", err);
        }
    }, 1000); // Debounce 1s
}

// HÀM QUẢN LÝ LOADING OVERLAY (THÊM MỚI)
function showLoading() {
    const loading = $('#full-page-loading');
    if (loading) loading.style.display = 'flex';
}

function hideLoading() {
    const loading = $('#full-page-loading');
    if (loading) loading.style.display = 'none';
}

// HÀM HIỂN THỊ THÔNG BÁO CUSTOM (THAY THẾ ALERT)
let notificationTimeout;
function showNotification(message, icon = '✅') {
    const toast = $('#notification-toast');
    const msgEl = $('#toast-message');
    const iconEl = $('.toast-icon');

    if (!toast || !msgEl || !iconEl) {
        // Fallback nếu không tìm thấy HTML
        return alert(message);
    }

    // 1. Cập nhật nội dung
    msgEl.textContent = message;
    iconEl.textContent = icon;

    // 2. Xóa timeout cũ nếu đang chạy
    clearTimeout(notificationTimeout);

    // 3. Hiển thị
    toast.classList.remove('show'); // Reset animation
    void toast.offsetWidth; // Force reflow/repaint
    toast.classList.add('show');

    // 4. Tự động ẩn sau 3 giây (thời gian tương đương animation fadeout)
    notificationTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Hàm kiểm tra đăng nhập và chuyển hướng (KHÔNG HIỂN THỊ POP-UP)
async function checkLoginAndRedirect(message = "Chuyển hướng đến trang đăng nhập...") {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
        // Ghi log vào console (KHÔNG HIỂN THỊ BẤT KỲ GIAO DIỆN NÀO)
        console.log(message);

        // 🎯 SỬA CHỮA: LƯU URL HIỆN TẠI VÀO LOCALSTORAGE TRƯỚC KHI CHUYỂN TRANG
        localStorage.setItem('redirect_after_login', window.location.href);

        // Kích hoạt hiệu ứng chuyển trang và chuyển hướng
        document.body.classList.add('page-fade-out');
        setTimeout(() => {
            window.location.href = 'account.html';
        }, 500);
        return false;
    }
    return user;
}

// Update Account Link with User Info
async function updateAccountLink() {
    const accountLink = document.getElementById('account-link');
    const logoutLink = document.getElementById('logout-link');

    const {
        data: {
            session
        }
    } = await supabaseClient.auth.getSession();
    let finalName = localStorage.getItem('userName'); // Ưu tiên dùng local cache

    if (session && session.user && !finalName) {
        // Nếu chưa có tên trong cache (hoặc mới đăng nhập) -> Fetch từ DB (Tương tự script.js)
        const {
            data: profile
        } = await supabaseClient.from('profiles').select('name').eq('id', session.user.id).single();

        if (profile && profile.name) {
            finalName = profile.name;
        } else {
            finalName = session.user.user_metadata.name || session.user.email.split('@')[0];
        }
        localStorage.setItem('userName', finalName);
    } else if (!session) {
        localStorage.removeItem('userName');
        finalName = null;
    }

    // Cập nhật giao diện Header
    if (finalName && accountLink) {
        accountLink.innerHTML = `👋 Chào, <b>${finalName}</b>`;
        accountLink.href = 'profile.html';
        if (logoutLink) {
            logoutLink.style.display = 'flex';
            // Gắn sự kiện đăng xuất
            logoutLink.onclick = async () => {
                if (confirm("Bạn có chắc chắn muốn đăng xuất không?")) {
                    await handleLogout();
                }
            };
        }
    } else if (accountLink) {
        accountLink.textContent = 'Tài Khoản';
        accountLink.href = 'account.html';
        if (logoutLink) logoutLink.style.display = 'none';
    }
}

// Logic Đăng Xuất (ĐÃ CẬP NHẬT: Tải lại trang)
window.handleLogout = async function () {
    try {
        const {
            error
        } = await supabaseClient.auth.signOut();
        if (error) throw error;

        localStorage.removeItem('accessToken');
        localStorage.removeItem('userName');
        localStorage.removeItem('cart_v1');
        // 🎯 LƯU URL HIỆN TẠI ĐỂ SAU KHI ĐĂNG NHẬP LẠI (TỪ account.html) SẼ TRỞ VỀ ĐÂY
        localStorage.setItem('redirect_after_login', window.location.href);

        // Cập nhật: Tải lại trang hiện tại (product-detail.html)
        window.location.reload();

    } catch (err) {
        console.error("Lỗi đăng xuất:", err);
        alert("Đăng xuất thất bại. Vui lòng thử lại.");
    }
};


// ======================================================================
// 3. LOGIC SẢN PHẨM & GIỎ HÀNG
// ======================================================================

// Tải thông tin chi tiết sản phẩm (ĐÃ THÊM LOADING VÀ ĐỘ TRỄ 1S)
async function loadMainProduct() {
    const params = new URLSearchParams(window.location.search);
    const product_id = params.get('product_id');
    const store_id = params.get('store_id');

    if (!product_id || !store_id) {
        if ($('.product-container')) $('.product-container').innerHTML = '<h2 style="padding:20px">Thiếu thông tin sản phẩm</h2>';
        return;
    }

    const key = `${product_id}_${store_id}`;

    showLoading(); // HIỂN THỊ LOADING

    try {
        // Gọi API Backend lấy chi tiết
        const res = await fetch('/api/cart/details', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                cart: {
                    [key]: 1
                }
            })
        });

        if (res.ok) {
            const data = await res.json();
            const productData = data[key];

            if (!productData) {
                $('.product-container').innerHTML = '<h2 style="padding:20px">Sản phẩm không tồn tại</h2>';
                return;
            }

            const storeInfo = productData.stores[0];

            // Lấy dữ liệu rating sơ bộ
            const ratingVal = storeInfo.ps_average_rating || storeInfo.average_rating || 0;
            const reviewCountVal = storeInfo.ps_total_reviews || storeInfo.total_reviews || 0;

            currentProduct = {
                id: key,
                product_id: productData.product_id,
                store_id: storeInfo.store_id,
                name: storeInfo.store_name,
                sub_name: productData.product_name,
                address: storeInfo.store_address,
                // Ưu tiên ps_min_price_store nếu có, nếu không thì dùng cost
                price: storeInfo.ps_min_price_store || storeInfo.cost || 0,
                // SỬA LỖI CÚ PHÁP: Bỏ dấu chấm thừa sau `?`
                img: storeInfo.product_images?.[0]?.ps_image_url || productData.product_image_url,
                description: productData.product_des || "Đang cập nhật...",
                ps_id: storeInfo.ps_id
            };

            // Render UI
            if ($('#product-name')) $('#product-name').textContent = currentProduct.sub_name;
            if (document.getElementById('product-subtitle')) document.getElementById('product-subtitle').innerHTML = `<div><strong>Cửa hàng:</strong> ${currentProduct.name}</div><div style="color: #777;">📍 ${currentProduct.address}</div>`;
            if ($('#product-price')) $('#product-price').textContent = formatMoney(currentProduct.price);
            if ($('#product-image-main')) $('#product-image-main').src = currentProduct.img;
            if ($('#product-description')) $('#product-description').textContent = currentProduct.description;

            // Render Rating Header lần 1
            updateReviewHeader(ratingVal, reviewCountVal);

            const crumb = document.getElementById('breadcrumb-summary-link');
            if (crumb) crumb.innerHTML = `<a href="product-summary.html?product_id=${product_id}">${currentProduct.sub_name}</a>`;

            // QUAN TRỌNG: Trigger tải đánh giá ngay khi có ps_id
            if (currentProduct.ps_id) {
                currentPsId = currentProduct.ps_id;
                loadReviews(currentPsId, true); // Reset khi load lần đầu
            } else {
                findPsIdAndLoadReviews(currentProduct.product_id, currentProduct.store_id);
            }
        }
    } catch (e) {
        console.error("Lỗi loadMainProduct:", e);
    } finally {
        // === ĐỘ TRỄ ĐƯỢC ĐIỀU CHỈNH THÀNH 1 GIÂY (1000ms) ===
        await new Promise(resolve => setTimeout(resolve, 1000));
        // =======================================================
        hideLoading(); // ẨN LOADING
    }
}

// Đồng bộ giỏ hàng
async function fetchCartDetails() {
    const cartKeys = Object.keys(cart);
    if (cartKeys.length === 0) {
        CART_CACHE = {};
        updateCartUI();
        return;
    }

    const cartToFetch = {};
    cartKeys.forEach(key => {
        if (!CART_CACHE[key]) {
            cartToFetch[key] = cart[key];
        }
    });

    if (Object.keys(cartToFetch).length === 0) return;

    try {
        const res = await fetch('/api/cart/details', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                cart: cartToFetch
            })
        });
        if (res.ok) {
            const newCache = await res.json();
            CART_CACHE = {
                ...CART_CACHE,
                ...newCache
            };
            updateCartUI();
        }
    } catch (err) {
        console.error("Lỗi fetchCartDetails:", err);
    }
}

// UI Giỏ hàng với Skeleton Loading
function updateCartUI() {
    const cartList = $('#cart-list');
    const cartCount = Object.values(cart).reduce((s, q) => s + q, 0);
    let total = 0;

    const bubble = $('#cart-count');
    if (bubble) {
        bubble.textContent = cartCount;
        bubble.style.display = cartCount > 0 ? 'block' : 'none';
    }

    if (!cartList) return;

    cartList.innerHTML = '';
    if (cartCount === 0) {
        cartList.innerHTML = '<div style="color:#888; text-align:center; padding:10px;">Giỏ hàng trống</div>';
        if ($('#cart-total')) $('#cart-total').textContent = formatMoney(0);
        return;
    }

    Object.entries(cart).forEach(([key, qty]) => {
        const details = CART_CACHE[key];

        if (details) {
            const storeInfo = details.stores[0];
            // Lấy giá ưu tiên từ ps_min_price_store, nếu không có thì dùng cost
            const price = storeInfo.ps_min_price_store || storeInfo.cost || 0;
            total += price * qty;

            // SỬA LỖI CÚ PHÁP: Bỏ dấu chấm thừa sau `?`
            let imgUrl = storeInfo.product_images?.[0]?.ps_image_url || details.product_image_url;

            const item = document.createElement('div');
            item.className = 'cart-item';
            item.innerHTML = `
                <img src="${imgUrl}" onerror="this.src='images/placeholder.jpg'" />
                <div style="flex:1">
                    <div style="font-weight:500; font-size:14px;">${details.product_name}</div>
                    <div style="font-size:12px;color:#666">${storeInfo.store_name}</div>
                    <div style="font-size:13px;color:#333">${formatMoney(price)} x ${qty}</div>
                </div>
                <div class="qty">
                     <button class="small-btn" onclick="changeQty('${key}', -1)">-</button>
                     <div style="min-width:20px; text-align:center">${qty}</div>
                     <button class="small-btn" onclick="changeQty('${key}', 1)">+</button>
                     <button class="small-btn" style="margin-left:6px; color:red;" onclick="removeItem('${key}')">x</button>
                </div>
            `;
            cartList.appendChild(item);
        } else {
            // Skeleton Loading
            const item = document.createElement('div');
            item.className = 'cart-item';
            item.innerHTML = `
                <div style="display:flex; align-items:center; padding:10px; width:100%">
                    <div style="width:50px; height:50px; background:#eee; margin-right:10px; border-radius:4px;"></div>
                    <div style="flex:1">
                        <div style="height:14px; background:#eee; width:80%; margin-bottom:5px;"></div>
                        <div style="height:12px; background:#eee; width:50%;"></div>
                    </div>
                </div>`;
            cartList.appendChild(item);
            // Kích hoạt fetch details nếu item chưa có trong cache
            fetchCartDetails();
        }
    });

    if ($('#cart-total')) $('#cart-total').textContent = formatMoney(total);
}

// Thêm vào giỏ hàng (ĐÃ CẬP NHẬT LOGIC KIỂM TRA ĐĂNG NHẬP và DÙNG NOTIFICATION)
window.addToCart = async function (productId, storeId, qty) {
    const user = await checkLoginAndRedirect("Chưa đăng nhập. Chuyển hướng để thêm sản phẩm vào giỏ hàng.");
    if (!user) return;

    // Logic thêm vào giỏ hàng khi đã đăng nhập
    const key = `${productId}_${storeId}`;
    cart[key] = (cart[key] || 0) + parseInt(qty);
    saveCart();

    // Optimistic cache update
    if (currentProduct && currentProduct.id === key && !CART_CACHE[key]) {
        CART_CACHE[key] = {
            product_name: currentProduct.sub_name,
            product_image_url: currentProduct.img,
            stores: [{
                store_name: currentProduct.name,
                ps_min_price_store: currentProduct.price,
                product_images: [{
                    ps_image_url: currentProduct.img
                }]
            }]
        };
    }
    updateCartUI();
    // THAY THẾ ALERT BẰNG CUSTOM NOTIFICATION
    showNotification('Đã thêm vào giỏ hàng thành công!', '✅');
}

// Mua ngay (ĐÃ CẬP NHẬT LOGIC KIỂM TRA ĐĂNG NHẬP)
window.buyNow = async function () {
    const user = await checkLoginAndRedirect("Chưa đăng nhập. Chuyển hướng để mua hàng ngay.");
    if (!user) return;

    // Logic mua ngay khi đã đăng nhập
    if (currentProduct) {
        const key = `${currentProduct.product_id}_${currentProduct.store_id}`;
        cart[key] = (cart[key] || 0) + currentQuantity;
        saveCart();

        document.body.classList.add('page-fade-out');
        setTimeout(() => {
            window.location.href = 'cart.html';
        }, 500);
    }
}


// ======================================================================
// 4. LOGIC XỬ LÝ REVIEWS (CẬP NHẬT: PHÂN TRANG VỚI XEM THÊM)
// ======================================================================

// Constants cho pagination
const REVIEWS_PER_PAGE = 5; // Số review mỗi lần load
let currentReviewsPage = 0;
let hasMoreReviews = false;
let totalReviewsCount = 0;

async function findPsIdAndLoadReviews(productId, storeId) {
    if (!supabaseClient) return;
    const { data } = await supabaseClient.from('product_store').select('ps_id').eq('product_id', productId).eq('store_id', storeId).single();
    if (data) {
        currentPsId = data.ps_id;
        loadReviews(currentPsId, true); // Reset khi load lần đầu
    }
}

async function loadReviews(psId, resetPage = false) {
    if (!psId || !supabaseClient) return;

    // Reset page về 0 nếu cần
    if (resetPage) {
        currentReviewsPage = 0;
    }

    // Check Login UI (chỉ làm khi reset/lần đầu)
    if (resetPage) {
        const { data: { session } } = await supabaseClient.auth.getSession();
        const formContainer = $('#review-form-container');
        const loginPrompt = $('#login-prompt');

        if (formContainer && loginPrompt) {
            if (session) {
                formContainer.style.display = 'block';
                loginPrompt.style.display = 'none';
            } else {
                formContainer.style.display = 'none';
                loginPrompt.style.display = 'block';
            }
        }
    }

    const listEl = $('#reviews-list');

    // Hiển thị loading (chỉ khi reset)
    if (resetPage && listEl) {
        listEl.innerHTML = '<p style="color:#999; padding:10px">Đang tải đánh giá...</p>';
    }

    // 🎯 BƯỚC 1: Đếm tổng số reviews để hiển thị header
    if (resetPage) {
        // Dùng count: 'exact' với head: true để chỉ đếm
        const { count, error: countError } = await supabaseClient
            .from('reviews')
            .select('*', { count: 'exact', head: true })
            .eq('ps_id', psId);

        if (!countError && count !== null) {
            totalReviewsCount = count;

            // Tính rating trung bình (chỉ khi có reviews)
            if (count > 0) {
                const { data: ratingData } = await supabaseClient
                    .from('reviews')
                    .select('rating')
                    .eq('ps_id', psId);

                if (ratingData && ratingData.length > 0) {
                    const sumRating = ratingData.reduce((acc, curr) => acc + (curr.rating || 0), 0);
                    const avgRating = sumRating / ratingData.length;
                    updateReviewHeader(avgRating, count);
                }
            } else {
                updateReviewHeader(0, 0);
            }
        } else {
            totalReviewsCount = 0;
            updateReviewHeader(0, 0);
        }
    }

    // 🎯 BƯỚC 2: Load reviews với phân trang
    const from = currentReviewsPage * REVIEWS_PER_PAGE;
    const to = from + REVIEWS_PER_PAGE - 1;

    const { data: reviews, error } = await supabaseClient
        .from('reviews')
        .select('*')
        .eq('ps_id', psId)
        .order('created_at', { ascending: false })
        .range(from, to);

    if (error) {
        console.error("Lỗi tải review:", error);
        if (resetPage && listEl) {
            listEl.innerHTML = '<p style="color:red">Không thể tải đánh giá.</p>';
        }
        return;
    }

    // Kiểm tra còn review để load không
    hasMoreReviews = reviews && reviews.length === REVIEWS_PER_PAGE;

    if (!listEl) return;

    // Clear list nếu reset
    if (resetPage) {
        listEl.innerHTML = '';
    }

    // Xóa nút "Xem thêm" cũ nếu có
    const oldLoadMoreBtn = document.getElementById('load-more-reviews-btn');
    if (oldLoadMoreBtn) {
        oldLoadMoreBtn.remove();
    }

    if (!reviews || reviews.length === 0) {
        if (resetPage) {
            listEl.innerHTML = '<p style="color:#777; font-style: italic;">Chưa có đánh giá nào.</p>';
        }
        return;
    }

    // 🎯 BƯỚC 3: Lấy thông tin User
    const userIds = [...new Set(reviews.map(r => r.user_id))];
    const { data: profiles } = await supabaseClient
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', userIds);

    const profileMap = {};
    if (profiles) profiles.forEach(p => profileMap[p.id] = p);

    // 🎯 BƯỚC 4: Render reviews
    reviews.forEach(r => {
        const user = profileMap[r.user_id] || {
            name: 'Người dùng ẩn danh',
            avatar_url: null
        };
        let starsHtml = '';
        for (let i = 1; i <= 5; i++) starsHtml += `<span style="color:${i <= r.rating ? '#ffc107' : '#ddd'}">★</span>`;

        const date = new Date(r.created_at).toLocaleDateString('vi-VN');
        const avatarHtml = user.avatar_url ?
            `<img src="${user.avatar_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">` :
            `<div style="width:100%;height:100%;background:#ccc;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;border-radius:50%">${user.name ? user.name.charAt(0).toUpperCase() : 'U'}</div>`;

        const item = document.createElement('div');
        item.className = 'review-item';
        item.innerHTML = `
            <div class="review-avatar" style="width:40px;height:40px;">${avatarHtml}</div>
            <div class="review-content">
                <h4 style="margin:0;font-size:14px;">${user.name}</h4>
                <div class="stars" style="font-size:12px;">${starsHtml}</div>
                <p style="margin:5px 0;font-size:14px;">${r.comment || ''}</p>
                <div class="date" style="font-size:12px;color:#999;">${date}</div>
            </div>
        `;
        listEl.appendChild(item);
    });

    // 🎯 BƯỚC 5: Thêm nút "Xem thêm" nếu còn reviews
    if (hasMoreReviews) {
        const loadedCount = (currentReviewsPage + 1) * REVIEWS_PER_PAGE;
        const remainingCount = Math.max(0, totalReviewsCount - loadedCount);

        // ✅ CHỈ HIỂN THỊ NÚT NẾU CÒN ĐÁNH GIÁ
        if (remainingCount > 0) {
            const loadMoreBtn = document.createElement('button');
            loadMoreBtn.id = 'load-more-reviews-btn';
            loadMoreBtn.className = 'btn-load-more-reviews';
            loadMoreBtn.innerHTML = `
                Xem thêm đánh giá 
            `;
            loadMoreBtn.style.cssText = `
                width: 100%;
                padding: 12px 20px;
                margin-top: 15px;
                background: #f8f9fa;
                border: 1px solid #ddd;
                border-radius: 8px;
                color: #333;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.3s ease;
            `;

            loadMoreBtn.onmouseover = () => {
                loadMoreBtn.style.background = '#e9ecef';
                loadMoreBtn.style.borderColor = '#bbb';
            };
            loadMoreBtn.onmouseout = () => {
                loadMoreBtn.style.background = '#f8f9fa';
                loadMoreBtn.style.borderColor = '#ddd';
            };

            loadMoreBtn.onclick = async () => {
                loadMoreBtn.disabled = true;
                loadMoreBtn.innerHTML = '⏳ Đang tải...';

                currentReviewsPage++;
                await loadReviews(psId, false); // Load thêm không reset
            };

            listEl.appendChild(loadMoreBtn);
        }
    }
}

function updateReviewHeader(rating, count) {
    const statsEl = document.getElementById('review-stats');
    if (!statsEl) return;

    if (count > 0) {
        const ratingFixed = Number(rating).toFixed(1);
        statsEl.innerHTML = `
            <span style="color:#ffc107; font-size:1.3em;">★</span>
            <b style="color:#333; font-size:1.1em; margin-left: 4px;">${ratingFixed}/5</b>
            <span style="color:#666; font-size:0.95em; margin-left:8px;">(${count} đánh giá)</span>
        `;
    } else {
        statsEl.innerHTML = `<span style="color:#999; font-style:italic; font-size:0.9em">(Chưa có đánh giá)</span>`;
    }
}

async function submitReview() {
    if (!currentPsId) {
        alert("Lỗi: Không tìm thấy mã sản phẩm.");
        return;
    }
    if (!supabaseClient) return;

    // Check Login (KHÔNG HIỂN THỊ POPUP)
    const user = await checkLoginAndRedirect("Chưa đăng nhập. Chuyển hướng để gửi đánh giá.");
    if (!user) return;

    const ratingEl = document.querySelector('input[name="rating"]:checked');
    const commentInput = $('#review-comment');
    const comment = commentInput ? commentInput.value.trim() : '';

    if (!ratingEl) {
        alert("Vui lòng chọn số sao!");
        return;
    }

    const btn = $('#btn-submit-review');
    btn.textContent = "Đang gửi...";
    btn.disabled = true;

    try {
        const { error } = await supabaseClient
            .from('reviews')
            .insert([{
                ps_id: currentPsId,
                user_id: user.id,
                rating: parseInt(ratingEl.value),
                comment: comment
            }]);

        if (error) throw error;

        showNotification("Cảm ơn bạn đã đánh giá!", "✅");
        commentInput.value = '';
        if (ratingEl) ratingEl.checked = false;

        // Reset về trang đầu tiên và reload
        loadReviews(currentPsId, true);

    } catch (err) {
        showNotification("Gửi thất bại: " + err.message, "❌");
    } finally {
        btn.textContent = "Gửi đánh giá";
        btn.disabled = false;
    }
}
// ======================================================================
// 4.1. THÊM BIẾN CHO REVIEW FILTER & CRUD
// ======================================================================
let currentFilter = 'all';
let currentUserId = null;
let editingReviewId = null;
let reviewsDataCache = []; // Cache toàn bộ reviews đã tải

// ======================================================================
// 4.2. HÀM FILTER REVIEWS
// ======================================================================
async function filterReviews(filterType) {
    currentFilter = filterType;

    // Cập nhật UI nút filter
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    // Load lại reviews với filter mới
    if (currentPsId) {
        await loadReviews(currentPsId, true);
    }
}

// ======================================================================
// 4.3. CẬP NHẬT HÀM loadReviews để hỗ trợ filter và cache (XÓA SOFT DELETE)
// ======================================================================
async function loadReviews(psId, resetPage = false) {
    if (!psId || !supabaseClient) return;

    if (resetPage) {
        currentReviewsPage = 0;
        reviewsDataCache = [];
    }

    // Check Login UI
    if (resetPage) {
        const { data: { session } } = await supabaseClient.auth.getSession();
        const formContainer = $('#review-form-container');
        const loginPrompt = $('#login-prompt');

        if (formContainer && loginPrompt) {
            if (session) {
                formContainer.style.display = 'block';
                loginPrompt.style.display = 'none';
                currentUserId = session.user.id;
            } else {
                formContainer.style.display = 'none';
                loginPrompt.style.display = 'block';
                currentUserId = null;
            }
        }
    }

    const listEl = $('#reviews-list');

    if (resetPage && listEl) {
        listEl.innerHTML = '<p style="color:#999; padding:10px">Đang tải đánh giá...</p>';
    }

    // Đếm tổng số reviews (ĐÃ XÓA FILTER is_deleted)
    if (resetPage) {
        const { count, error: countError } = await supabaseClient
            .from('reviews')
            .select('*', { count: 'exact', head: true })
            .eq('ps_id', psId); // 🎯 ĐÃ XÓA .eq('is_deleted', false)

        if (!countError && count !== null) {
            totalReviewsCount = count;

            if (count > 0) {
                const { data: ratingData } = await supabaseClient
                    .from('reviews')
                    .select('rating')
                    .eq('ps_id', psId); // 🎯 ĐÃ XÓA .eq('is_deleted', false)

                if (ratingData && ratingData.length > 0) {
                    const sumRating = ratingData.reduce((acc, curr) => acc + (curr.rating || 0), 0);
                    const avgRating = sumRating / ratingData.length;
                    updateReviewHeader(avgRating, count);
                }
            } else {
                updateReviewHeader(0, 0);
            }
        } else {
            totalReviewsCount = 0;
            updateReviewHeader(0, 0);
        }
    }

    // Load reviews với filter (ĐÃ XÓA FILTER is_deleted)
    const from = currentReviewsPage * REVIEWS_PER_PAGE;
    const to = from + REVIEWS_PER_PAGE - 1;

    let query = supabaseClient
        .from('reviews')
        .select('*')
        .eq('ps_id', psId); // 🎯 ĐÃ XÓA .eq('is_deleted', false)

    // Áp dụng filter
    switch (currentFilter) {
        case 'newest':
            query = query.order('created_at', { ascending: false });
            break;
        case 'oldest':
            query = query.order('created_at', { ascending: true });
            break;
        case 'highest':
            query = query.order('rating', { ascending: false });
            break;
        case 'lowest':
            query = query.order('rating', { ascending: true });
            break;
        default: // 'all'
            query = query.order('created_at', { ascending: false });
    }

    const { data: reviews, error } = await query.range(from, to);

    if (error) {
        console.error("Lỗi tải review:", error);
        if (resetPage && listEl) {
            listEl.innerHTML = '<p style="color:red">Không thể tải đánh giá.</p>';
        }
        return;
    }

    // Cache reviews
    if (resetPage) {
        reviewsDataCache = reviews;
    } else {
        reviewsDataCache = [...reviewsDataCache, ...reviews];
    }

    hasMoreReviews = reviews && reviews.length === REVIEWS_PER_PAGE;

    if (!listEl) return;

    if (resetPage) {
        listEl.innerHTML = '';
    }

    const oldLoadMoreBtn = document.getElementById('load-more-reviews-btn');
    if (oldLoadMoreBtn) {
        oldLoadMoreBtn.remove();
    }

    if (!reviews || reviews.length === 0) {
        if (resetPage) {
            listEl.innerHTML = '<p style="color:#777; font-style: italic;">Chưa có đánh giá nào.</p>';
        }
        return;
    }

    // Lấy thông tin User
    const userIds = [...new Set(reviews.map(r => r.user_id))];
    const { data: profiles } = await supabaseClient
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', userIds);

    const profileMap = {};
    if (profiles) profiles.forEach(p => profileMap[p.id] = p);

    // Render reviews với nút chỉnh sửa/xóa
    reviews.forEach(r => {
        const user = profileMap[r.user_id] || {
            name: 'Người dùng ẩn danh',
            avatar_url: null
        };

        let starsHtml = '';
        for (let i = 1; i <= 5; i++) {
            starsHtml += `<span style="color:${i <= r.rating ? '#ffc107' : '#ddd'}">★</span>`;
        }

        const date = new Date(r.created_at).toLocaleDateString('vi-VN');
        const avatarHtml = user.avatar_url ?
            `<img src="${user.avatar_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">` :
            `<div style="width:100%;height:100%;background:#ccc;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;border-radius:50%">${user.name ? user.name.charAt(0).toUpperCase() : 'U'}</div>`;

        const item = document.createElement('div');
        item.className = 'review-item';
        item.dataset.reviewId = r.review_id;

        // Kiểm tra nếu là review của user hiện tại
        const isCurrentUserReview = currentUserId && r.user_id === currentUserId;

        let editDeleteButtons = '';
        if (isCurrentUserReview) {
            editDeleteButtons = `
                <div class="review-actions" style="margin-top: 8px; display: flex; gap: 10px;">
                    <button class="small-btn edit-review-btn" onclick="openEditReviewModal(${r.review_id})" 
                            style="font-size: 12px; padding: 4px 8px;">
                        ✏️ Chỉnh sửa
                    </button>
                    <button class="small-btn delete-review-btn" onclick="openConfirmDeleteModal(${r.review_id})" 
                            style="font-size: 12px; padding: 4px 8px; color: #ff4444;">
                        🗑️ Xóa
                    </button>
                </div>
            `;
        }

        item.innerHTML = `
            <div class="review-avatar" style="width:40px;height:40px;">${avatarHtml}</div>
            <div class="review-content">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <h4 style="margin:0;font-size:14px;">${user.name}</h4>
                        <div class="stars" style="font-size:12px;">${starsHtml}</div>
                    </div>
                    <div class="date" style="font-size:12px;color:#999;">${date}</div>
                </div>
                <p style="margin:5px 0;font-size:14px;">${r.comment || ''}</p>
                ${editDeleteButtons}
            </div>
        `;
        listEl.appendChild(item);
    });

    // Thêm nút "Xem thêm"
    if (hasMoreReviews) {
        const loadedCount = (currentReviewsPage + 1) * REVIEWS_PER_PAGE;
        const remainingCount = Math.max(0, totalReviewsCount - loadedCount);

        if (remainingCount > 0) {
            const loadMoreBtn = document.createElement('button');
            loadMoreBtn.id = 'load-more-reviews-btn';
            loadMoreBtn.className = 'btn-load-more-reviews';
            loadMoreBtn.innerHTML = `Xem thêm đánh giá`;
            loadMoreBtn.style.cssText = `
                width: 100%;
                padding: 12px 20px;
                margin-top: 15px;
                background: #f8f9fa;
                border: 1px solid #ddd;
                border-radius: 8px;
                color: #333;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.3s ease;
            `;

            loadMoreBtn.onmouseover = () => {
                loadMoreBtn.style.background = '#e9ecef';
                loadMoreBtn.style.borderColor = '#bbb';
            };
            loadMoreBtn.onmouseout = () => {
                loadMoreBtn.style.background = '#f8f9fa';
                loadMoreBtn.style.borderColor = '#ddd';
            };

            loadMoreBtn.onclick = async () => {
                loadMoreBtn.disabled = true;
                loadMoreBtn.innerHTML = '⏳ Đang tải...';

                currentReviewsPage++;
                await loadReviews(psId, false);
            };

            listEl.appendChild(loadMoreBtn);
        }
    }
}

// ======================================================================
// 4.4. HÀM MỞ MODAL CHỈNH SỬA REVIEW
// ======================================================================
async function openEditReviewModal(reviewId) {
    editingReviewId = reviewId;

    // Tìm review trong cache
    const review = reviewsDataCache.find(r => r.review_id === reviewId);
    if (!review) return;

    // Điền dữ liệu vào modal
    document.querySelectorAll('#edit-rating-stars input').forEach(input => {
        input.checked = parseInt(input.value) === review.rating;
    });

    $('#edit-review-comment').value = review.comment || '';

    // Hiển thị modal
    $('#edit-review-modal').style.display = 'flex';
}

// ======================================================================
// 4.5. HÀM ĐÓNG MODAL CHỈNH SỬA
// ======================================================================
function closeEditReviewModal() {
    $('#edit-review-modal').style.display = 'none';
    editingReviewId = null;
}

// ======================================================================
// 4.6. HÀM CẬP NHẬT REVIEW
// ======================================================================
async function updateReview() {
    if (!editingReviewId || !supabaseClient) return;

    const ratingEl = document.querySelector('input[name="edit-rating"]:checked');
    const commentInput = $('#edit-review-comment');
    const comment = commentInput ? commentInput.value.trim() : '';

    if (!ratingEl) {
        alert("Vui lòng chọn số sao!");
        return;
    }

    const btn = document.querySelector('#edit-review-modal .btn-primary');
    const originalText = btn.textContent;
    btn.textContent = "Đang lưu...";
    btn.disabled = true;

    try {
        const { error } = await supabaseClient
            .from('reviews')
            .update({
                rating: parseInt(ratingEl.value),
                comment: comment,
                updated_at: new Date().toISOString()
            })
            .eq('review_id', editingReviewId);

        if (error) throw error;

        showNotification("Đã cập nhật đánh giá thành công!", "✅");
        closeEditReviewModal();

        // Reload reviews
        if (currentPsId) {
            await loadReviews(currentPsId, true);
        }

    } catch (err) {
        showNotification("Cập nhật thất bại: " + err.message, "❌");
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// ======================================================================
// 4.7. HÀM MỞ MODAL XÁC NHẬN XÓA
// ======================================================================
function openConfirmDeleteModal(reviewId) {
    editingReviewId = reviewId;
    $('#confirm-delete-modal').style.display = 'flex';
}

// ======================================================================
// 4.8. HÀM ĐÓNG MODAL XÁC NHẬN XÓA
// ======================================================================
function closeConfirmDeleteModal() {
    $('#confirm-delete-modal').style.display = 'none';
    editingReviewId = null;
}

// ======================================================================
// 4.9. HÀM XÓA REVIEW (HARD DELETE - XÓA LUÔN)
// ======================================================================
async function deleteReview() {
    if (!editingReviewId || !supabaseClient) return;

    const btn = document.querySelector('#confirm-delete-modal .btn-danger');
    const originalText = btn.textContent;
    btn.textContent = "Đang xóa...";
    btn.disabled = true;

    try {
        // SỬA: Dùng .delete() thay vì .update() để xóa cứng
        const { error } = await supabaseClient
            .from('reviews')
            .delete()
            .eq('review_id', editingReviewId);

        if (error) throw error;

        showNotification("Đã xóa đánh giá thành công!", "✅");
        closeConfirmDeleteModal();

        // Reload reviews
        if (currentPsId) {
            await loadReviews(currentPsId, true);
        }

    } catch (err) {
        showNotification("Xóa thất bại: " + err.message, "❌");
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}
// ======================================================================
// 4.10. CẬP NHẬT HÀM submitReview ĐỂ RESET CACHE
// ======================================================================
async function submitReview() {
    if (!currentPsId) {
        alert("Lỗi: Không tìm thấy mã sản phẩm.");
        return;
    }
    if (!supabaseClient) return;

    const user = await checkLoginAndRedirect("Chưa đăng nhập. Chuyển hướng để gửi đánh giá.");
    if (!user) return;

    const ratingEl = document.querySelector('input[name="rating"]:checked');
    const commentInput = $('#review-comment');
    const comment = commentInput ? commentInput.value.trim() : '';

    if (!ratingEl) {
        alert("Vui lòng chọn số sao!");
        return;
    }

    const btn = $('#btn-submit-review');
    btn.textContent = "Đang gửi...";
    btn.disabled = true;

    try {
        const { error } = await supabaseClient
            .from('reviews')
            .insert([{
                ps_id: currentPsId,
                user_id: user.id,
                rating: parseInt(ratingEl.value),
                comment: comment
            }]);

        if (error) throw error;

        showNotification("Cảm ơn bạn đã đánh giá!", "✅");
        commentInput.value = '';
        if (ratingEl) ratingEl.checked = false;

        // Reset cache và load lại
        reviewsDataCache = [];
        loadReviews(currentPsId, true);

    } catch (err) {
        showNotification("Gửi thất bại: " + err.message, "❌");
    } finally {
        btn.textContent = "Gửi đánh giá";
        btn.disabled = false;
    }
}

// ======================================================================
// 5. THÊM EVENT LISTENERS VÀO DOMContentLoaded
// ======================================================================
document.addEventListener('DOMContentLoaded', async () => {
    // ... code hiện tại ...

    // Thêm vào phần cuối của DOMContentLoaded
    // Event listener cho modal
    $('#edit-review-modal').addEventListener('click', (e) => {
        if (e.target === $('#edit-review-modal')) {
            closeEditReviewModal();
        }
    });

    $('#confirm-delete-modal').addEventListener('click', (e) => {
        if (e.target === $('#confirm-delete-modal')) {
            closeConfirmDeleteModal();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if ($('#edit-review-modal').style.display === 'flex') {
                closeEditReviewModal();
            }
            if ($('#confirm-delete-modal').style.display === 'flex') {
                closeConfirmDeleteModal();
            }
        }
    });
});
// ======================================================================
// 5. LOGIC VOICE SEARCH
// ======================================================================

// Bắt đầu ghi âm
window.startVoiceSearch = function () {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
        alert("Trình duyệt không hỗ trợ tìm kiếm bằng giọng nói! Hãy thử Chrome.");
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    if (currentRecognition) {
        currentRecognition.stop();
    }

    currentRecognition = recognition;

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "vi-VN";

    const popup = $('#voice_popup');
    const transcriptDisplay = $('#transcript_display');
    transcriptDisplay.textContent = "Đang nghe...";
    popup.style.display = "flex";

    recognition.onstart = function () {
        transcriptDisplay.textContent = "Đang nghe... Hãy nói gì đó!";
    };

    recognition.onresult = function (event) {
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;

            if (event.results[i].isFinal)
                finalTranscript += transcript;
        }

        transcriptDisplay.textContent = finalTranscript || "Đang nghe...";

        // Nếu có kết quả cuối → Chuyển về trang chủ và tìm kiếm
        if (finalTranscript) {
            $('#search_input').value = finalTranscript;

            setTimeout(() => {
                popup.style.display = "none";
                recognition.stop();

                // Chuyển hướng về index.html với từ khóa tìm kiếm
                document.body.classList.add('page-fade-out');
                setTimeout(() => {
                    window.location.href = `index.html?search=${encodeURIComponent(finalTranscript)}`;
                }, 500);

            }, 200);
        }
    };

    recognition.onerror = function (event) {
        console.error("Lỗi nhận diện:", event.error);

        let msg = "Lỗi: ";
        if (event.error === "not-allowed")
            msg += "Bạn chưa cấp quyền micro!";
        else if (event.error === "no-speech")
            msg += "Không phát hiện giọng nói!";
        else
            msg += event.error;

        $('#transcript_display').textContent = msg;

        setTimeout(() => {
            popup.style.display = "none";
        }, 200);
    };

    recognition.onend = function () {
        currentRecognition = null;

        if ($('#transcript_display').textContent === "Đang nghe...") {
            setTimeout(() => popup.style.display = "none", 200);
        }
    };

    try {
        recognition.start();
    } catch (error) {
        console.error("Không thể start recognition:", error);
        popup.style.display = "none";
        alert("Không thể bật giọng nói!");
    }
}

// Hủy ghi âm
window.cancelVoiceSearch = function () {
    if (currentRecognition) currentRecognition.abort();
    $('#voice_popup').style.display = "none";
}

// ======================================================================
// 6. LOGIC IMAGE SEARCH (TÍCH HỢP TỪ script.js)
// ======================================================================

// Mở popup tìm kiếm bằng hình ảnh
window.openImageSearch = function () {
    const popup = document.getElementById('image_search_popup');
    popup.classList.add('active');
    popup.style.display = 'flex';

    // Reset về tab upload
    switchImageTab('upload');
    clearAllImages();
}

// Đóng popup
window.closeImageSearch = function () {
    const popup = document.getElementById('image_search_popup');
    popup.classList.remove('active');
    setTimeout(() => {
        popup.style.display = 'none';
    }, 200);

    clearAllImages();
    hideError();
}

// Chuyển tab
window.switchImageTab = function (tabName) {
    currentTab = tabName;

    document.querySelectorAll('.tab-button').forEach(btn => {
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.remove('active');
    });

    const activePanel = document.getElementById(`${tabName}-tab`);
    if (activePanel) {
        activePanel.classList.add('active');
    }

    hideError();
}

// Setup upload area
function setupImageUpload() {
    const uploadArea = document.getElementById('imageUploadArea');
    const fileInput = document.getElementById('imageFileInput');

    if (!uploadArea || !fileInput) return;

    // Click to upload
    document.getElementById('browseBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleImageFile(file);
        }
    });

    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');

        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            handleImageFile(file);
        } else {
            showError('Vui lòng chọn file ảnh hợp lệ');
        }
    });

    // Tự động tải ảnh khi paste hoặc nhập vào ô URL/Base64
    const pasteInput = document.getElementById('imagePasteInput');
    if (pasteInput) {
        pasteInput.addEventListener('input', (e) => {
            const value = e.target.value.trim();

            if (!value) {
                clearPasteImage();
                hideError();
                return;
            }

            clearTimeout(pasteInput.debounceTimer);
            pasteInput.debounceTimer = setTimeout(() => {
                loadPastedImage();
            }, 0);
        });

        pasteInput.addEventListener('paste', (e) => {
            const items = e.clipboardData.items;

            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    const blob = item.getAsFile();
                    const reader = new FileReader();

                    reader.onload = () => {
                        currentImageData = reader.result;
                        showImagePreview(currentImageData, 'paste');
                        hideError();
                    };

                    reader.readAsDataURL(blob);
                    e.preventDefault();
                    return;
                }
            }
        });
    }
}

// Xử lý file ảnh
function handleImageFile(file) {
    if (file.size > 5 * 1024 * 1024) {
        showError('Kích thước ảnh vượt quá 5MB');
        return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
        currentImageData = e.target.result;
        showImagePreview(currentImageData, 'upload');
        hideError();
    };

    reader.onerror = () => {
        showError('Không thể đọc file ảnh');
    };

    reader.readAsDataURL(file);
}

// Tải ảnh từ paste
function loadPastedImage() {
    const input = document.getElementById('imagePasteInput');
    const value = input.value.trim();

    if (!value) {
        clearPasteImage();
        return;
    }

    if (value.startsWith('http://') || value.startsWith('https://')) {
        try {
            new URL(value);
            currentImageData = value;
            showImagePreview(value, 'paste');
            hideError();
        } catch (e) {
            showError('URL không hợp lệ');
        }
    } else if (value.startsWith('data:image/')) {
        currentImageData = value;
        showImagePreview(value, 'paste');
        hideError();
    } else if (value.length > 100) {
        try {
            atob(value);
            currentImageData = `data:image/jpeg;base64,${value}`;
            showImagePreview(currentImageData, 'paste');
            hideError();
        } catch (e) {
            showError('Base64 không hợp lệ');
        }
    }
}

// Hiển thị preview ảnh
function showImagePreview(imageData, tab) {
    if (tab === 'upload') {
        const preview = document.getElementById('imagePreview');
        const container = document.getElementById('uploadPreviewContainer');

        if (preview) {
            preview.src = imageData;
            preview.style.display = 'block';
            if (container) container.style.display = 'block';

            const uploadArea = document.getElementById('imageUploadArea');
            if (uploadArea) uploadArea.style.display = 'none';
        }

    } else {
        const preview = document.getElementById('pastePreview');
        const container = document.getElementById('pastePreviewContainer');

        if (preview) {
            preview.src = imageData;
            preview.style.display = 'block';
            if (container) container.style.display = 'block';
        }
    }
}

// Xóa ảnh upload
window.clearUploadImage = function () {
    const preview = document.getElementById('imagePreview');
    const container = document.getElementById('uploadPreviewContainer');
    const uploadArea = document.getElementById('imageUploadArea');
    const fileInput = document.getElementById('imageFileInput');

    if (preview) preview.style.display = 'none';
    if (container) container.style.display = 'none';
    if (uploadArea) uploadArea.style.display = 'block';
    if (fileInput) fileInput.value = '';

    if (currentTab === 'upload') {
        currentImageData = null;
    }
}

// Xóa ảnh paste
window.clearPasteImage = function () {
    const preview = document.getElementById('pastePreview');
    const container = document.getElementById('pastePreviewContainer');
    const input = document.getElementById('imagePasteInput');

    if (preview) preview.style.display = 'none';
    if (container) container.style.display = 'none';
    if (input) input.value = '';

    if (currentTab === 'paste') {
        currentImageData = null;
    }
}

// Xóa tất cả ảnh
function clearAllImages() {
    clearUploadImage();
    clearPasteImage();
    currentImageData = null;
}

// Hiển thị lỗi
function showError(message) {
    const errorDiv = document.getElementById('imageSearchError');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.classList.add('show');
        errorDiv.style.display = 'block';
    }
}

// Ẩn lỗi
function hideError() {
    const errorDiv = document.getElementById('imageSearchError');
    if (errorDiv) {
        errorDiv.classList.remove('show');
        errorDiv.style.display = 'none';
    }
}

// Tìm kiếm bằng ảnh
window.searchWithImage = async function () {
    if (!currentImageData) {
        showError('Vui lòng chọn hoặc nhập ảnh trước');
        return;
    }

    const searchBtn = document.querySelector('.btn-primary');
    searchBtn.classList.add('loading');
    searchBtn.disabled = true;

    try {
        const response = await fetch('/api/search-by-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image: currentImageData
            })
        });

        const data = await response.json();

        if (data.status === 'success' || data.status === 'not_found') {
            closeImageSearch();
            const searchTerm = data.search_term || 'Hình ảnh của bạn';

            // CHUYỂN HƯỚNG VỀ TRANG CHỦ VỚI TỪ KHÓA TÌM KIẾM
            document.body.classList.add('page-fade-out');
            setTimeout(() => {
                window.location.href = `index.html?search=${encodeURIComponent(searchTerm)}`;
            }, 500);

        } else {
            showError(`❌ Lỗi: ${data.message}`);
        }

    } catch (error) {
        console.error('Search error:', error);
        showError('❌ Lỗi kết nối. Vui lòng thử lại');
    } finally {
        searchBtn.classList.remove('loading');
        searchBtn.disabled = false;
    }
}

// ======================================================================
// 7. GLOBAL EXPORTS & EVENT LISTENERS
// ======================================================================

// Cart Actions (with Optimistic Update)
// ĐÃ CHUYỂN logic này vào window.addToCart ở trên

window.changeQty = function (key, delta) {
    cart[key] = (cart[key] || 0) + delta;
    if (cart[key] <= 0) delete cart[key];
    saveCart();
}

window.removeItem = function (key) {
    if (confirm("Xóa sản phẩm này khỏi giỏ hàng?")) {
        delete cart[key];
        if (CART_CACHE[key]) delete CART_CACHE[key]; // Xóa khỏi cache
        saveCart();
    }
}

// KHỞI ĐỘNG
document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 Initializing product-detail page...");

    // ======================
    // 1. ADVANCED SEARCH HANDLING (ĐÃ SỬA)
    // ======================
    const searchForm = $('#search_form');

    if (searchForm) {
        const searchInput = $('#search_input');

        if (searchInput) {
            // 1.1. Xử lý khi gõ phím (Hiển thị gợi ý)
            searchInput.addEventListener('input', function () {
                clearTimeout(suggestionTimeout);
                suggestionTimeout = setTimeout(() => {
                    const query = this.value.trim();
                    if (query.length >= 2) {
                        fetchSuggestions(query);
                    } else {
                        hideSuggestions();
                    }
                }, 300);
            });

            // 1.2. Xử lý phím mũi tên & Enter
            searchInput.addEventListener('keydown', (e) => {
                const suggestions = $$('#search_suggestions .suggestion-item');
                if (suggestions.length === 0) return;

                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
                        suggestions[highlightedIndex].classList.remove('highlighted');
                    }
                    highlightedIndex = (highlightedIndex + 1) % suggestions.length;
                    suggestions[highlightedIndex].classList.add('highlighted');
                    suggestions[highlightedIndex].scrollIntoView({ block: "nearest" });

                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
                        suggestions[highlightedIndex].classList.remove('highlighted');
                    }
                    highlightedIndex = (highlightedIndex - 1 + suggestions.length) % suggestions.length;
                    suggestions[highlightedIndex].classList.add('highlighted');
                    suggestions[highlightedIndex].scrollIntoView({ block: "nearest" });

                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    const highlighted = suggestions[highlightedIndex];

                    if (highlighted) {
                        // ✅ CÓ SUGGESTION ĐƯỢC CHỌN -> CLICK VÀO NÓ
                        e.stopImmediatePropagation();
                        highlighted.click();
                    } else {
                        // ✅ KHÔNG CÓ SUGGESTION -> SUBMIT (redirect về index)
                        const query = searchInput.value.trim();
                        if (query) {
                            submitSearch(query);
                        }
                    }

                } else if (e.key === 'Escape') {
                    hideSuggestions();
                }
            });
        }

        // 1.3. Submit form - ✅ REDIRECT VỀ INDEX
        searchForm.onsubmit = (e) => {
            e.preventDefault();
            const query = searchInput.value.trim();
            if (query) {
                submitSearch(query);
            }
        };

        // 1.4. Ẩn gợi ý khi click ra ngoài
        document.addEventListener('click', function (event) {
            const suggestionsDiv = $('#search_suggestions');
            if (suggestionsDiv && suggestionsDiv.style.display === 'block' &&
                !searchForm.contains(event.target) &&
                !suggestionsDiv.contains(event.target)) {
                hideSuggestions();
            }
        });
    }

    // ======================
    // 2. LOAD PRODUCT DATA & INITIALIZE UI
    // ======================
    await Promise.all([
        loadMainProduct(),
        fetchCartDetails()
    ]);

    updateAccountLink();
    updateCartUI();
    setupImageUpload();

    // Popup Events
    const cartBtn = $('#open-cart');
    const cartPopup = $('#cart-popup');

    if (cartBtn && cartPopup) {
        cartBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            cartPopup.style.display = (cartPopup.style.display === 'block') ? 'none' : 'block';
        });

        if ($('#close-cart')) $('#close-cart').onclick = () => $('#cart-popup').style.display = 'none';

        // Đóng khi click ra ngoài popup
        document.addEventListener('click', (e) => {
            if (cartPopup.style.display === 'block' && !cartPopup.contains(e.target) && !cartBtn.contains(e.target)) {
                cartPopup.style.display = 'none';
            }
        });
    }

    // Đóng Image Search popup khi click outside hoặc ESC
    const imageSearchPopup = document.getElementById('image_search_popup');
    if (imageSearchPopup) {
        imageSearchPopup.addEventListener('click', (e) => {
            if (e.target === imageSearchPopup) {
                closeImageSearch();
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const popup = document.getElementById('image_search_popup');
            const cartPopup = document.getElementById('cart-popup');

            if (popup && popup.style.display === 'flex') {
                closeImageSearch();
            }
            if (cartPopup && cartPopup.style.display === 'block') {
                cartPopup.style.display = 'none';
            }
        }
    });

    // ĐỔI TÊN & CHỨC NĂNG: Nút Thanh toán -> Xem Giỏ hàng
    if ($('#checkout')) {
        // 1. Đổi Text button
        $('#checkout').textContent = 'Xem Giỏ hàng';

        // 2. Cập nhật Event Listener VỚI LOGIC KIỂM TRA ĐĂNG NHẬP
        $('#checkout').addEventListener('click', async () => {
            // Lấy session hiện tại
            const { data: { session } } = await supabase.auth.getSession();

            if (!session || !session.user) {
                ;
                // Chuyển hướng đến trang đăng nhập
                document.body.classList.add('page-fade-out');
                setTimeout(() => {
                    window.location.href = 'account.html'; // Hoặc đường dẫn đăng nhập phù hợp
                }, 500);
                return;
            }

            // Nếu đã đăng nhập -> Chuyển đến trang giỏ hàng bình thường
            document.body.classList.add('page-fade-out');

            setTimeout(() => {
                window.location.href = 'cart.html';
            }, 500);
        });
    };

    // Product Detail Events
    const qtyInput = $('#qty-input');
    if (qtyInput) {
        qtyInput.value = currentQuantity;
        $('#qty-minus').onclick = () => {
            if (currentQuantity > 1) {
                currentQuantity--;
                qtyInput.value = currentQuantity;
            }
        };
        $('#qty-plus').onclick = () => {
            currentQuantity++;
            qtyInput.value = currentQuantity;
        };
    }

    // Gắn lại sự kiện cho Thêm vào giỏ và Mua ngay (Đã nâng cấp: Sync Database)
    const btnAddToCart = $('#add-to-cart-btn');

    if (btnAddToCart) {
        btnAddToCart.onclick = async () => {
            // 1. Kiểm tra sản phẩm
            if (!currentProduct) return;

            // 2. Gọi hàm cũ để xử lý LocalStorage và UI (Badge số lượng...)
            // Hàm này sẽ cập nhật localStorage.getItem('cart_v1')
            window.addToCart(currentProduct.product_id, currentProduct.store_id, currentQuantity);

            // 3. LOGIC MỚI: Đẩy ngay dữ liệu mới nhất lên Supabase
            if (typeof supabase !== 'undefined') {
                try {
                    // Lấy session (dùng getSession cho nhanh, không cần mạng check)
                    const { data: { session } } = await supabase.auth.getSession();

                    if (session && session.user) {
                        console.log("🔄 Đang đồng bộ giỏ hàng mới lên Server...");

                        // Lấy giỏ hàng VỪA ĐƯỢC CẬP NHẬT xong từ bước 2
                        const updatedCart = JSON.parse(localStorage.getItem('cart_v1') || '{}');

                        // Gửi lên Database
                        const { error } = await supabase
                            .from('cart')
                            .upsert({
                                user_id: session.user.id,
                                cart_data: updatedCart,
                                updated_at: new Date()
                            }, { onConflict: 'user_id' });

                        if (error) {
                            console.error("❌ Lỗi sync background:", error.message);
                        } else {
                            console.log("✅ Đã lưu giỏ hàng lên Database!");
                        }
                    }
                } catch (err) {
                    console.warn("Lỗi hệ thống khi lưu giỏ hàng:", err);
                }
            }
        };
    }

    if ($('#buy-now-btn')) $('#buy-now-btn').onclick = window.buyNow;

    // Review Event (Đã có check login bên trong submitReview)
    if ($('#btn-submit-review')) $('#btn-submit-review').onclick = submitReview;

    // Map Event
    const mapBtn = document.getElementById('map-btn');
    if (mapBtn) {
        mapBtn.onclick = () => {
            if (!currentProduct) {
                alert('Chưa tải được thông tin cửa hàng!');
                return;
            }
            localStorage.setItem('TARGET_STORE', JSON.stringify({
                id: currentProduct.store_id,
                name: currentProduct.name,
                address: currentProduct.address
            }));
            window.location.href = '/map/';
        };
    }
});

// ======================================================================
// XỬ LÝ LƯU URL TRƯỚC KHI CHUYỂN TRANG (QUAN TRỌNG)
// ======================================================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Xử lý nút Tài Khoản trên Header
    const accountLink = document.getElementById('account-link');
    if (accountLink) {
        accountLink.addEventListener('click', function (e) {
            // Lưu URL hiện tại ngay lập tức khi bấm
            localStorage.setItem('redirect_after_login', window.location.href);
        });
    }

    // 2. [FIX] Xử lý link "Đăng nhập" ở phần Đánh giá (Login Prompt)
    // Vì link này nằm trong HTML tĩnh nên ta có thể bắt sự kiện ngay
    const reviewLoginLink = document.querySelector('#login-prompt a');
    if (reviewLoginLink) {
        reviewLoginLink.addEventListener('click', function (e) {
            // Lưu URL hiện tại: product-detail.html?product_id=...
            localStorage.setItem('redirect_after_login', window.location.href);
            console.log('💾 Đã lưu vị trí để quay lại:', window.location.href);
        });
    }
});