// ======================================================================
// PHẦN 1: HÀM FORMAT TIỀN, LOAD VÀ RENDER SẢN PHẨM
// ======================================================================

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

// Load sản phẩm từ API kèm query filter (search, distance, price)
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

// XÓA HÀM toggleStoresList VÌ KHÔNG DÙNG NỮA

// Render danh sách sản phẩm theo cấu trúc mới: CHỈ HIỂN THỊ SẢN PHẨM CHÍNH
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
    
    // Tìm thông tin cửa hàng đầu tiên để tạo link chi tiết
    const firstStore = product.stores && product.stores.length > 0 ? product.stores[0] : null;
    const detailUrl = firstStore 
        ? `product-detail.html?product_id=${product.product_id}&store_id=${firstStore.store_id}` 
        : '#'; // Link dự phòng nếu không có cửa hàng nào

    // Khung chứa sản phẩm
    const productContainer = document.createElement('div');
    productContainer.className = 'product-container';

    // ==== Khối thông tin sản phẩm chính ====
    const productInfo = document.createElement('div');
    productInfo.className = 'product-info';

    // Đổi cấu trúc: Bọc ảnh và tên sản phẩm trong thẻ <a> trỏ đến trang chi tiết
    productInfo.innerHTML = `
      <a href="${detailUrl}" style="text-decoration:none; color:inherit;">
          <img src="${product.product_image_url}" alt="${product.product_name}">
      </a>
      <div>
          <a href="${detailUrl}" style="text-decoration:none; color:inherit;">
              <h3>${product.product_name}</h3>
          </a>
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
          ${firstStore
            ? `<a 
                 href="${detailUrl}"
                 class="btn-toggle-stores">
                 Xem Chi Tiết ►
               </a>`
            : '<span style="color:#888; font-size:13px;">Không có cửa hàng bán</span>'
          }
      </div>
    `;

    // Gắn vào DOM
    productContainer.appendChild(productInfo);
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

function updateAccountLink() {
    const accountLink = document.getElementById('account-link');
    const userName = localStorage.getItem('userName');
    
    // Nút Đăng Xuất (icon)
    const logoutLink = document.getElementById('logout-link');

    if (accountLink) {
        if (userName) {
            // Hiển thị tên tài khoản
            accountLink.textContent = userName;
            accountLink.href = 'account.html'; // Vẫn giữ về trang account
            if (logoutLink) logoutLink.style.display = 'flex'; // Hiện nút Đăng Xuất
        } else {
            // Nếu chưa đăng nhập
            accountLink.textContent = 'Tài Khoản';
            accountLink.href = 'account.html';
            if (logoutLink) logoutLink.style.display = 'none'; // Ẩn nút Đăng Xuất
        }
    }
}


// ======================================================================
// PHẦN 7: ĐĂNG XUẤT (LOGOUT)
// ======================================================================

function logout() {
  // Xóa tất cả thông tin đăng nhập
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken'); 
  localStorage.removeItem('userName'); 
  
  // Thực hiện hiệu ứng chuyển trang rồi chuyển hướng đến trang đăng nhập
  document.body.classList.add('page-fade-out');

  setTimeout(() => {
    // Chuyển hướng đến trang đăng nhập
    window.location.href = 'index.html';
  }, 500); 
}

// Gắn sự kiện cho nút Đăng Xuất
if ($('#logout-link')) {
  $('#logout-link').addEventListener('click', logout);
}

// ======================================================================
// PHẦN 8: XỬ LÝ VỊ TRÍ VÀ THỜI TIẾT (BỔ SUNG)
// ======================================================================

const API_URL = 'http://127.0.0.1:5000'; 

/**
 * [Hàm giả lập/Thay thế] Dịch ngược tọa độ (Reverse Geocoding)
 * Trong thực tế: Gọi Google Geocoding API hoặc 1 dịch vụ tương tự
 * @param {number} lat - Vĩ độ
 * @param {number} long - Kinh độ
 * @returns {string} - Tên vị trí (thành phố/quận/huyện)
 */
async function fetchLocationName(lat, long) {
    // Giả định: 
    if (lat >= 15 && lat < 17) {
        return 'TP. Đà Nẵng, Việt Nam';
    } else if (lat >= 10 && lat < 11) {
        return 'TP. Hồ Chí Minh, Việt Nam';
    }
    return `Vĩ độ: ${lat.toFixed(4)}, Kinh độ: ${long.toFixed(4)}`;
}

/**
 * [Hàm giả lập] Lấy thông tin thời tiết
 * Trong thực tế: Gọi OpenWeatherMap API hoặc 1 dịch vụ tương tự
 * @param {number} lat - Vĩ độ
 * @param {number} long - Kinh độ
 * @returns {string} - Thông tin thời tiết
 */
async function fetchWeather(lat, long) {
    // Giả định
    return 'Nắng đẹp, 30°C';
}


async function fetchUserLocationAndWeather() {
    const accessToken = localStorage.getItem('accessToken');
    const locationDisplayEl = $('#current-location-display');
    const weatherDisplayEl = $('#current-weather-display');
    
    if (!locationDisplayEl || !weatherDisplayEl) return;

    // Thiết lập trạng thái chờ
    locationDisplayEl.textContent = 'Đang tải...';
    weatherDisplayEl.textContent = 'Đang tải...';

    if (!accessToken) {
        locationDisplayEl.textContent = 'Chưa đăng nhập';
        weatherDisplayEl.textContent = 'Không có thông tin';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/profile`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            throw new Error('Lỗi khi tải profile');
        }

        const userProfile = await response.json();
        // Giả định userProfile có 2 trường lat và long (từ database)
        const lat = userProfile.lat;
        const long = userProfile.long;

        if (lat && long) {
            // 1. Dịch ngược tọa độ thành tên vị trí
            const locationName = await fetchLocationName(lat, long);
            locationDisplayEl.textContent = locationName;

            // 2. Lấy thời tiết
            const weather = await fetchWeather(lat, long);
            weatherDisplayEl.textContent = weather;

        } else {
            locationDisplayEl.textContent = 'Vị trí chưa được cập nhật';
            weatherDisplayEl.textContent = 'Không có thông tin';
        }

    } catch (error) {
        console.error("Lỗi khi tải vị trí/thời tiết:", error);
        locationDisplayEl.textContent = 'Lỗi kết nối server';
        weatherDisplayEl.textContent = 'Lỗi kết nối server';
    }
}


// ======================================================================
// PHẦN 9: KHỞI TẠO VÀ XỬ LÝ SỰ KIỆN
// ======================================================================

// Khi trang load → tải toàn bộ sản phẩm + cập nhật giỏ hàng
window.onload = async function() {
  await loadProducts();
  updateCartUI();
  
  // === [BỔ SUNG] Gọi hàm cập nhật tên người dùng ===
  updateAccountLink();
  
  // === [BỔ SUNG] Gọi hàm cập nhật vị trí và thời tiết ===
  await fetchUserLocationAndWeather(); 
  // ======================================================
  
  // Kích hoạt lại animation cho trang chủ
  document.body.classList.remove('page-fade-out'); 
};