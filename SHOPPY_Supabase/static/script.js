// File: script.js

// ======================================================================
// KHAI BÁO CẦN THIẾT
// ======================================================================
// BỎ: Khai báo API Thời tiết

// Danh sách sản phẩm lấy từ server
let PRODUCTS = [];

// Giỏ hàng lưu trong localStorage (dạng object: "productId_storeId": số lượng)
let cart = JSON.parse(localStorage.getItem('cart_v1') || '{}');

// Hàm rút gọn querySelector
const $ = sel => document.querySelector(sel);

// Format tiền theo dạng 100000 → "100.000₫"
function formatMoney(n) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + '₫';
}

// ======================================================================
// PHẦN 1: HÀM FORMAT TIỀN, LOAD VÀ RENDER SẢN PHẨM
// ======================================================================

// Load sản phẩm từ API với 3 tham số lọc
async function loadProducts(search = '', distance = '', price = '') {
  try {
    // Gọi API kèm query filter
    const res = await fetch(`/api/products?search=${encodeURIComponent(search)}&distance=${distance}&price=${price}`);

    // Kết quả JSON chứa danh sách sản phẩm
    PRODUCTS = await res.json();

    // Render lên giao diện
    renderProducts();

  } catch (err) {
    console.error("Lỗi khi load sản phẩm:", err);

    // Khi API lỗi → hiển thị thông báo để test UI
    $('#product-list').innerHTML = '<p style="color:red; text-align:center;">Không thể kết nối đến server.</p>';
  }
}

// Hàm mới: Xử lý bật/tắt danh sách cửa hàng
function toggleStoresList(productId) {
    const storesList = document.getElementById(`stores-list-${productId}`);
    const toggleButton = document.getElementById(`toggle-stores-btn-${productId}`);
    
    if (storesList.classList.contains('active')) {
        storesList.classList.remove('active');
        toggleButton.textContent = 'Xem Cửa Hàng ▼';
    } else {
        storesList.classList.add('active');
        toggleButton.textContent = 'Ẩn Cửa Hàng ▲';
    }
}


// Render danh sách sản phẩm theo cấu trúc mới
function renderProducts() {
  const wrap = $('#product-list');
  wrap.innerHTML = '';

  // Không tìm thấy sản phẩm
  if (PRODUCTS.length === 0) {
    wrap.innerHTML = '<p style="color:#888; text-align:center; padding:40px;">Không tìm thấy sản phẩm nào.</p>';
    return;
  }

  // Lặp qua từng sản phẩm
  PRODUCTS.forEach(product => {

    // Khung chứa sản phẩm
    const productContainer = document.createElement('div');
    productContainer.className = 'product-container';

    // ==== Khối thông tin sản phẩm chính ====
    const productInfo = document.createElement('div');
    productInfo.className = 'product-info';

    productInfo.innerHTML = `
      <img src="${product.product_image_url}" alt="${product.product_name}">
      <div>
          <h3>${product.product_name}</h3>
          <div class="product-price">
              ${
                product.min_price 
                  ? formatMoney(product.min_price) +
                    (
                      product.max_price && product.max_price !== product.min_price
                        ? ' - ' + formatMoney(product.max_price)
                        : ''
                    )
                  : 'Liên hệ'
              }
          </div>
          <p class="product-location">📍 ${product.location_name}</p>
      </div>
      <div class="product-actions-main">
          ${product.stores && product.stores.length > 0 
            ? `<button 
                 class="btn-toggle-stores" 
                 id="toggle-stores-btn-${product.product_id}"
                 onclick="toggleStoresList(${product.product_id})">
                 Xem Cửa Hàng ▼
               </button>`
            : '<span style="color:#888; font-size:13px;">Không có cửa hàng bán</span>'
          }
      </div>
    `;

    // ==== Danh sách cửa hàng bán sản phẩm ====
    // Thêm ID để dễ dàng truy cập bằng JS
    const storesList = document.createElement('div');
    storesList.id = `stores-list-${product.product_id}`; 
    storesList.className = 'stores-list';

    if (product.stores && product.stores.length > 0) {
      product.stores.forEach(store => {

        // Lấy ảnh chính của cửa hàng (ps_type = 1), nếu không có thì dùng ảnh sản phẩm
        const mainImage = store.product_images.find(img => img.ps_type === 1);
        const storeImageUrl = mainImage ? mainImage.ps_image_url : product.product_image_url;
        
        // Tạo đường dẫn chi tiết
        const detailUrl = `product-detail.html?product_id=${product.product_id}&store_id=${store.store_id}`;


        const storeCard = document.createElement('div');
        storeCard.className = 'store-card';

        // HTML hiển thị từng cửa hàng
        storeCard.innerHTML = `
          <a href="${detailUrl}" class="store-header-link">
              <div class="store-header">
                  <img src="${storeImageUrl}" alt="${store.store_name}" class="store-image">
                  <div class="store-info">
                      <h4 class="store-name">${store.store_name}</h4>
                      <p class="store-address">${store.store_address}</p>
                      <p class="store-distance">📍 ${store.distance_km ? store.distance_km + ' km' : 'Không xác định'}</p>
                  </div>
              </div>
          </a>

          <div class="store-price">
              ${
                store.min_price
                  ? formatMoney(store.min_price) +
                    (store.max_price && store.max_price !== store.min_price
                      ? ' - ' + formatMoney(store.max_price)
                      : '')
                  : 'Liên hệ'
              }
          </div>

          <div class="store-actions">
              <button class="btn-add-cart" onclick="addToCart(${product.product_id}, ${store.store_id})">Thêm vào giỏ</button>
              
              <a href="${detailUrl}"
                 class="btn-view">
                 Xem Chi Tiết
              </a>
          </div>
        `;

        storesList.appendChild(storeCard);
      });

    } else {
      // Không có cửa hàng bán (sẽ không chạy vì đã kiểm tra bên trên, nhưng giữ lại phòng trường hợp lỗi)
      storesList.innerHTML = '<p style="color:#888; text-align:center; padding:10px;">Không có cửa hàng nào bán sản phẩm này.</p>';
    }

    // Gắn vào DOM
    productContainer.appendChild(productInfo);
    productContainer.appendChild(storesList);
    wrap.appendChild(productContainer);
  });
}


// ======================================================================
// PHẦN 2: XỬ LÝ TÌM KIẾM & LỌC SẢN PHẨM
// ======================================================================

// Kiểm tra form tồn tại rồi mới gắn event submit
if (document.getElementById('search_form')) {

  document.getElementById('search_form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const searchText = $('#search_input').value;
    const distanceFilter = $('#distance_filter').value;
    const priceFilter = $('#price_filter').value;

    console.log('Tìm kiếm:', searchText, distanceFilter, priceFilter);

    // Load lại sản phẩm với filter
    await loadProducts(searchText, distanceFilter, priceFilter);
  });
}



// ======================================================================
// PHẦN 3: GHI ÂM GIỌNG NÓI (VOICE SEARCH)
// ======================================================================

// Lưu recognition đang chạy để dừng nếu người dùng mở lại
let currentRecognition = null;

// Bắt đầu ghi âm
function startVoiceSearch() {

  // Kiểm tra trình duyệt hỗ trợ Web Speech API
  if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
    alert("Trình duyệt không hỗ trợ tìm kiếm bằng giọng nói! Hãy thử Chrome.");
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();

  // Dừng phiên ghi âm trước đó (nếu có)
  if (currentRecognition) {
    currentRecognition.stop();
  }

  currentRecognition = recognition;

  recognition.continuous = false;     // Chỉ nghe 1 câu
  recognition.interimResults = true;  // Lấy kết quả tạm thời
  recognition.lang = "vi-VN";         // Ngôn ngữ tiếng Việt

  // Mở popup UI
  const popup = $('#voice_popup');
  const transcriptDisplay = $('#transcript_display');
  transcriptDisplay.textContent = "Đang nghe...";
  popup.style.display = "flex";

  // Khi bắt đầu nghe
  recognition.onstart = function() {
    transcriptDisplay.textContent = "Đang nghe... Hãy nói gì đó!";
  };

  // Nhận kết quả
  recognition.onresult = function(event) {
    let finalTranscript = '';
    let interimTranscript = '';

    // Ghép text từ event
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;

      if (event.results[i].isFinal)
        finalTranscript += transcript;
      else
        interimTranscript += transcript;
    }

    // Hiển thị ra popup
    transcriptDisplay.textContent = finalTranscript || interimTranscript;

    // Nếu đã có kết quả cuối → tự động tìm kiếm
    if (finalTranscript) {
      $('#search_input').value = finalTranscript;

      setTimeout(() => {
        popup.style.display = "none";
        recognition.stop();

        // Tự submit form tìm kiếm
        const searchForm = $('#search_form');
        searchForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      }, 1000);
    }
  };

  // Khi xảy ra lỗi micro / không nói
  recognition.onerror = function(event) {
    console.error("Lỗi nhận diện:", event.error);

    let msg = "Lỗi: ";
    if (event.error === "not-allowed") msg += "Bạn chưa cấp quyền micro!";
    else if (event.error === "no-speech") msg += "Không phát hiện giọng nói!";
    else msg += event.error;

    $('#transcript_display').textContent = msg;

    setTimeout(() => {
      popup.style.display = "none";
    }, 2000);
  };

  // Khi kết thúc
  recognition.onend = function() {
    currentRecognition = null;

    if ($('#transcript_display').textContent === "Đang nghe...") {
      setTimeout(() => popup.style.display = "none", 500);
    }
  };

  // Start recognition
  try {
    recognition.start();
  } catch (error) {
    console.error("Không thể start recognition:", error);
    popup.style.display = "none";
    alert("Không thể bật giọng nói!");
  }
}

// Hủy ghi âm
function cancelVoiceSearch() {
  if (currentRecognition) currentRecognition.abort();
  $('#voice_popup').style.display = "none";
}



// ======================================================================
// PHẦN 4: GIỎ HÀNG
// Hỗ trợ sản phẩm theo từng cửa hàng (productId_storeId)
// ======================================================================

// Lưu giỏ hàng vào localStorage
function saveCart() {
  localStorage.setItem('cart_v1', JSON.stringify(cart));
  updateCartUI();
}

// Cập nhật giao diện giỏ hàng
function updateCartUI() {

  const cartList = $('#cart-list');
  const cartCount = Object.values(cart).reduce((s, q) => s + q, 0);

  // Badge số lượng giỏ hàng
  const cartCountBubble = $('#cart-count');
  if (cartCountBubble) {
    cartCountBubble.textContent = cartCount;
    cartCountBubble.style.display = cartCount > 0 ? 'block' : 'none';
  }

  // Tính tổng tiền theo cấu trúc key productId_storeId
  const total = Object.entries(cart).reduce((sum, [key, qty]) => {
    const [productId, storeId] = key.split('_');
    const product = PRODUCTS.find(p => p.product_id == productId);

    if (product) {
      const store = product.stores.find(s => s.store_id == storeId);
      if (store) return sum + ((store.min_price || store.cost || 0) * qty);
    }
    return sum;
  }, 0);

  if ($('#cart-total')) $('#cart-total').textContent = formatMoney(total);

  // Nếu giỏ hàng rỗng
  if (cartCount === 0) {
    if (cartList) cartList.innerHTML = '<div style="color:#888">Giỏ hàng trống</div>';
    return;
  }

  // Render từng item trong giỏ
  if (cartList) {
    cartList.innerHTML = '';

    Object.entries(cart).forEach(([key, qty]) => {
      const [productId, storeId] = key.split('_');

      const product = PRODUCTS.find(p => p.product_id == productId);
      if (!product) return;

      const store = product.stores.find(s => s.store_id == storeId);
      if (!store) return;

      const price = store.min_price || store.cost || 0;

      const item = document.createElement('div');
      item.className = 'cart-item';

      item.innerHTML = `
        <img src="${product.product_image_url}" />

        <div style="flex:1">
          <div style="font-size:14px">${product.product_name}</div>
          <div style="font-size:12px;color:#666">${store.store_name}</div>
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
}

// Thêm vào giỏ với key dạng "productId_storeId"
function addToCart(productId, storeId) {
  const key = `${productId}_${storeId}`;
  cart[key] = (cart[key] || 0) + 1;
  saveCart();
  alert('Đã thêm vào giỏ hàng!');
}

// Tăng/giảm số lượng
function changeQty(key, delta) {
  cart[key] = (cart[key] || 0) + delta;
  if (cart[key] <= 0) delete cart[key];
  saveCart();
}

// Xóa khỏi giỏ
function removeItem(key) {
  delete cart[key];
  saveCart();
}

// Nút xóa toàn bộ giỏ
if ($('#clear-cart')) {
  $('#clear-cart').addEventListener('click', () => {
    if (confirm('Xóa toàn bộ giỏ hàng?')) {
      cart = {};
      saveCart();
    }
  });
}

// Nút checkout → chuyển sang cart.html
if ($('#checkout')) {
  $('#checkout').addEventListener('click', (e) => {
    e.preventDefault();

    const count = Object.values(cart).reduce((s, q) => s + q, 0);
    if (count === 0) {
      alert('Giỏ hàng đang rỗng.');
      return;
    }

    document.body.classList.add('page-fade-out');

    setTimeout(() => {
      window.location.href = 'cart.html';
    }, 500);
  });
}

// Toggle popup giỏ hàng
if ($('#open-cart')) {
  $('#open-cart').addEventListener('click', () => {
    const popup = $('#cart-popup');
    popup.style.display = (popup.style.display === 'block') ? 'none' : 'block';
  });
}

if ($('#close-cart')) {
  $('#close-cart').addEventListener('click', () => {
    $('#cart-popup').style.display = 'none';
  });
}



// ======================================================================
// PHẦN 5: BỘ LỌC (FILTER MENU)
// ======================================================================

// Bật/tắt menu bộ lọc
function toggleFilterMenu() {
  const menu = $('#filter-dropdown');
  menu.classList.toggle('active');
}

// Ẩn menu khi click ra ngoài
document.addEventListener('click', function(event) {
  const form = $('#search_form');
  const menu = $('#filter-dropdown');

  if (form && !form.contains(event.target)) {
    if (menu) menu.classList.remove('active');
  }
});


// ======================================================================
// PHẦN 6: CẬP NHẬT GIAO DIỆN TÀI KHOẢN
// ======================================================================

async function updateAccountLink() {
    const accountLink = document.getElementById('account-link');
    const logoutLink = document.getElementById('logout-link');
    
    // 1. Hỏi trực tiếp Supabase xem có user không
    const { data: { session } } = await supabase.auth.getSession();

    let userName = null;

    if (session && session.user) {
        // Ưu tiên 1: Lấy tên từ metadata (Lúc đăng ký mình đã lưu vào đây)
        userName = session.user.user_metadata.name;
        // Ưu tiên 2: Nếu không có tên, lấy phần đầu email
        if (!userName) userName = session.user.email.split('@')[0];
        
        // Lưu lại vào local để dùng cho các trang khác
        localStorage.setItem('userName', userName);
    } else {
        // Nếu không có session, xóa luôn local cho sạch
        localStorage.removeItem('userName');
    }

    // Cập nhật UI
    if (userName && accountLink) {
        accountLink.innerHTML = `👋 Chào, <b>${userName}</b>`;
        accountLink.href = 'profile.html'; // Link tới trang cá nhân
        if (logoutLink) logoutLink.style.display = 'flex';
    } else if (accountLink) {
        accountLink.textContent = 'Tài Khoản';
        accountLink.href = 'account.html';
        if (logoutLink) logoutLink.style.display = 'none';
    }
}

// ======================================================================
// PHẦN 7: ĐĂNG XUẤT (LOGOUT)
// ======================================================================

// BỎ: Hàm logout() gốc

// Lắng nghe sự kiện real-time (Để đồng bộ Tab A và Tab B)
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        updateAccountLink();
    }
});

// ======================================================================
// PHẦN 9: LẤY VỊ TRÍ THỰC VÀ HIỂN THỊ (REVERSE GEOCODING)
// ======================================================================

/**
 * Hàm dịch ngược tọa độ thành tên địa điểm (chỉ Thành phố và Quốc gia).
 */
async function reverseGeocode(latitude, longitude) {
    // Chỉ cần zoom thấp (ví dụ 10) để ưu tiên thông tin tổng quát hơn
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`; 
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        const address = data.address;
        
        // Lấy các trường Thành phố (City) và Quốc gia (Country)
        const city = address.city || address.town || address.village || address.state || address.province || '';
        const country = address.country || '';

        // Xây dựng chuỗi kết quả: City, Country
        const result = [city, country].filter(Boolean).join(', ');

        // Sử dụng tọa độ nếu không lấy được thông tin cơ bản
        return result || `Tọa độ: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

    } catch (error) {
        console.error("Lỗi khi dịch ngược tọa độ:", error);
        return "Vị trí không khả dụng (Lỗi API)";
    }
}

/**
 * Lấy vị trí Geolocation và cập nhật lên UI (index.html).
 */
function updateCurrentLocationDisplay() {
    const locationElement = document.getElementById('current-location'); 

    if (!locationElement) return;

    if (!navigator.geolocation) {
        locationElement.textContent = "📍 Trình duyệt không hỗ trợ Geolocation.";
        return;
    }

    locationElement.textContent = "📍 Đang tìm vị trí...";

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const long = position.coords.longitude;
            
            // 1. Lấy tên địa điểm (City, Country) từ tọa độ
            const locationName = await reverseGeocode(lat, long);
            locationElement.textContent = `📍 Vị trí hiện tại: ${locationName}`;

        },
        (error) => {
            let errorMessage = "Không lấy được vị trí";
            if (error.code === error.PERMISSION_DENIED) {
                errorMessage = "Vui lòng cấp quyền vị trí cho trình duyệt.";
            }
            locationElement.textContent = `📍 ${errorMessage}`;
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
}
// ======================================================================
// PHẦN MỚI: HÀM CUSTOM MODAL (DÙNG CHO ĐĂNG XUẤT)
// ======================================================================
function showCustomConfirm(message) {
    return new Promise(resolve => {
        const modal = document.getElementById('custom-confirm-modal');
        const messageElement = modal.querySelector('#modal-message');
        const yesButton = modal.querySelector('#modal-confirm-yes');
        const noButton = modal.querySelector('#modal-confirm-no');
        
        // Đảm bảo các phần tử modal tồn tại trước khi thao tác
        if (!modal || !messageElement || !yesButton || !noButton) {
            console.error("Lỗi: Không tìm thấy các phần tử Custom Modal trong index.html.");
            // Quay về dùng confirm() gốc nếu modal bị lỗi
            resolve(confirm(message)); 
            return;
        }

        messageElement.textContent = message;
        modal.style.display = 'flex';

        const handleYes = () => {
            modal.style.display = 'none';
            removeListeners();
            resolve(true); // Trả về true (Đồng ý)
        };

        const handleNo = () => {
            modal.style.display = 'none';
            removeListeners();
            resolve(false); // Trả về false (Hủy)
        };

        // Gắn sự kiện (đảm bảo chỉ gắn một lần)
        yesButton.addEventListener('click', handleYes, { once: true });
        noButton.addEventListener('click', handleNo, { once: true });

        // Hàm gỡ bỏ listeners dự phòng
        const removeListeners = () => {
            yesButton.removeEventListener('click', handleYes);
            noButton.removeEventListener('click', handleNo);
        };
    });
}
// ======================================================================


// ======================================================================
// PHẦN 8: KHỞI TẠO VÀ XỬ LÝ SỰ KIỆN
// ======================================================================

// Khi trang load → tải toàn bộ sản phẩm + cập nhật giỏ hàng
window.onload = async function() {
  await loadProducts();
  updateCartUI();
  
  // === 1. Cập nhật tên người dùng ===
  updateAccountLink();
  
  // === 2. Cập nhật vị trí hiển thị lên UI ===
  updateCurrentLocationDisplay();
  
  // === 3. KIỂM TRA SESSION & CẬP NHẬT VỊ TRÍ LÊN DB ===
  // Đoạn này sẽ chạy mỗi khi vào trang chủ (sau khi login/register/google login xong)
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session && session.user) {
      // Nếu đã đăng nhập -> Cập nhật vị trí lên Database (hàm này có trong script1.js)
      updateUserLocation(session.user.id);
  }
  
  // 4. Hiệu ứng hiển thị trang
  document.body.classList.remove('page-fade-out'); 
};

// Hàm đăng xuất toàn cục (gắn vào window để html gọi được)
window.handleLogout = async function() {
    
    // SỬ DỤNG CUSTOM MODAL THAY CHO CONFIRM()
    const confirmLogout = await showCustomConfirm("Bạn có chắc chắn muốn đăng xuất khỏi tài khoản này không?"); 
    
    if (!confirmLogout) return;
    
    // Nếu người dùng đồng ý (confirmLogout là true)
    try {
        // 1. Gọi Supabase đăng xuất
        const { error } = await supabase.auth.signOut();
        if (error) throw error;

        // 2. Xóa sạch LocalStorage
        localStorage.removeItem('accessToken');
        localStorage.removeItem('userName');
        localStorage.removeItem('cart_v1'); 

        // 3. Tải lại trang để cập nhật giao diện
        window.location.reload();
        
    } catch (err) {
        console.error("Lỗi đăng xuất:", err);
        alert("Đăng xuất thất bại. Vui lòng thử lại.");
    }
};

// --- HÀM CẬP NHẬT VỊ TRÍ & THỜI GIAN (LƯU VÀO DB) ---
async function updateUserLocation(userId) {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const { latitude, longitude } = position.coords;
            
            // Gọi Supabase update
            const { error } = await supabase
                .from('profiles')
                .update({ 
                    lat: latitude, 
                    long: longitude,
                    updated_at: new Date()
                })
                .eq('id', userId);

            if (!error) {
                console.log(`✅ Đã cập nhật vị trí lên DB: ${latitude}, ${longitude}`);
            } else {
                console.warn("⚠️ Lỗi update vị trí (có thể do mạng hoặc RLS):", error.message);
            }
        },
        (err) => {
            console.warn("⚠️ Không lấy được vị trí (User từ chối hoặc lỗi):", err.message);
        }
    );
}