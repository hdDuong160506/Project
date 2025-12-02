const API_BASE = '';
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

// Giỏ hàng lưu trong localStorage: { "productId_storeId": quantity }
let cart = JSON.parse(localStorage.getItem('cart_v1') || '{}');

// Cache chứa thông tin chi tiết sản phẩm lấy từ Server (Map: key -> object)
// Được dùng để hiển thị UI mà không cần fetch lại liên tục
let CART_CACHE = {};

let currentProduct = null;
let currentQuantity = 1;

function formatMoney(n) {
	if (typeof n !== 'number') return '0₫';
	return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + '₫';
}

function saveCart() {
	localStorage.setItem('cart_v1', JSON.stringify(cart));
	updateCartUI();
}

// ======================================================================
// PHẦN 1: ĐỒNG BỘ GIỎ HÀNG VỚI SERVER (Thay thế loadAllProducts)
// ======================================================================
async function fetchCartDetails() {
	// 1. Lấy danh sách key từ localStorage
	const cartKeys = Object.keys(cart);

	// Nếu giỏ hàng rỗng, không cần gọi API
	if (cartKeys.length === 0) {
		CART_CACHE = {};
		updateCartUI();
		return;
	}

	try {
		console.log("Đang tải chi tiết giỏ hàng từ Flask...");
		// 2. Gọi API lấy chi tiết (POST)
		const res = await fetch('/api/cart/details', {
			method : 'POST',
			headers : {'Content-Type' : 'application/json'},
			// Gửi object cart lên để BE tra cứu theo key
			body : JSON.stringify({cart : cart})
		});

		if (res.ok) {
			// 3. Server trả về Product Map: { "key": { ...details, stores: [...] } }
			CART_CACHE = await res.json();
			console.log('Đã đồng bộ chi tiết giỏ hàng:', CART_CACHE);
			updateCartUI();
		} else {
			console.error('Lỗi khi fetch chi tiết giỏ hàng:', res.status);
		}
	} catch (err) {
		console.error("Lỗi mạng khi fetch cart:", err);
	}
}

// ======================================================================
// PHẦN 2: LOAD SẢN PHẨM CHÍNH (Sử dụng endpoint cart/details để lấy info)
// ======================================================================
async function loadMainProduct() {
	const params = new URLSearchParams(window.location.search);
	const product_id = params.get('product_id');
	const store_id = params.get('store_id');

	if (!product_id || !store_id) {
		document.body.innerHTML = '<h2 style="padding:20px">Thiếu ID sản phẩm hoặc Cửa hàng</h2>';
		return;
	}

	const key = `${product_id}_${store_id}`;

	try {
		// Tận dụng API /api/cart/details để lấy thông tin của chính sản phẩm này
		// (Giả lập một giỏ hàng chỉ có 1 món này để lấy chi tiết)
		const res = await fetch('/api/cart/details', {
			method : 'POST',
			headers : {'Content-Type' : 'application/json'},
			body : JSON.stringify({cart : {[key] : 1}})
		});

		if (res.ok) {
			const data = await res.json();
			const productData = data[key]; // Lấy chi tiết từ Map trả về

			if (!productData) {
				document.body.innerHTML = '<h2 style="padding:20px">Không tìm thấy thông tin sản phẩm.</h2>';
				return;
			}

			// Map dữ liệu từ API vào structure currentProduct dùng cho UI
			// Cấu trúc từ Backend (product_map):
			// { product_name, product_image_url, ..., stores: [{ store_name, ps_min_price_store, ... }] }

			const storeInfo = productData.stores[0];

			currentProduct = {
				id : key,
				product_id : productData.product_id,
				store_id : storeInfo.store_id,
				name : storeInfo.store_name,
				sub_name : productData.product_name,
				address : storeInfo.store_address,
				price : storeInfo.ps_min_price_store || 0,
				// Ưu tiên ảnh của cửa hàng, nếu không có thì dùng ảnh chung của sản phẩm
				img : (storeInfo.product_images && storeInfo.product_images.length > 0)
						  ? storeInfo.product_images[0].ps_image_url
						  : productData.product_image_url,
				description : productData.product_des || "Không có mô tả.",
			};

			// Render UI Trang Chi Tiết
			$('#product-name').textContent = currentProduct.sub_name;
			document.getElementById('product-subtitle').innerHTML = `<div><strong>Cửa hàng:</strong> ${currentProduct.name}</div><div style="font-size: 0.9em; color: #777;">📍 ${currentProduct.address || ''}</div>`;
			$('#product-price').textContent = formatMoney(currentProduct.price);
			$('#product-image-main').src = currentProduct.img;
			$('#product-description').textContent = currentProduct.description;

			// Update Breadcrumb
			const summaryLinkSpan = document.getElementById('breadcrumb-summary-link');
			if (summaryLinkSpan) {
				const summaryLink = document.createElement('a');
				summaryLink.href = `product-summary.html?product_id=${product_id}`;
				summaryLink.textContent = currentProduct.sub_name;
				summaryLinkSpan.appendChild(summaryLink);
			}

		} else {
			document.body.innerHTML = '<h2 style="padding:20px">Lỗi tải thông tin sản phẩm từ Server.</h2>';
		}
	} catch (e) {
		console.error("Lỗi loadMainProduct:", e);
	}
}

// ======================================================================
// PHẦN 3: CẬP NHẬT GIAO DIỆN GIỎ HÀNG (Sử dụng CART_CACHE)
// ======================================================================
function updateCartUI() {
	const cartList = $('#cart-list');

	// Tính tổng số lượng từ localStorage (đáng tin cậy nhất về số lượng)
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

		// Duyệt qua các key trong localStorage để hiển thị
		Object.entries(cart).forEach(([ key, qty ]) => {
			// Lấy thông tin chi tiết từ CART_CACHE đã fetch từ server
			const details = CART_CACHE[key];

			if (details) {
				// Lấy thông tin cửa hàng từ mảng stores (chỉ có 1 phần tử theo logic BE hiện tại)
				const storeInfo = details.stores[0];
				const price = storeInfo.ps_min_price_store || 0;
				const name = details.product_name;
				const storeName = storeInfo.store_name;

				// Xử lý ảnh
				let imgUrl = details.product_image_url;
				if (storeInfo.product_images && storeInfo.product_images.length > 0) {
					imgUrl = storeInfo.product_images[0].ps_image_url;
				}

				total += price * qty;

				const item = document.createElement('div');
				item.className = 'cart-item';
				item.innerHTML = `
                    <img src="${imgUrl}" onerror="this.src='images/placeholder.jpg'" />
                    <div style="flex:1">
                        <div style="font-size:14px">${name}</div>
                        <div style="font-size:12px;color:#666">${storeName}</div>
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
			} else {
				// Nếu có trong localStorage nhưng chưa có trong Cache (đang loading hoặc lỗi)
				// Hiển thị skeleton loading
				const item = document.createElement('div');
				item.className = 'cart-item';
				item.innerHTML = `
                    <div style="display:flex; align-items:center; padding:10px;">
                        <div style="width:50px; height:50px; background:#eee; margin-right:10px;"></div>
                        <div style="flex:1">
                            <div style="height:14px; background:#eee; width:80%; margin-bottom:5px;"></div>
                            <div style="height:12px; background:#eee; width:50%;"></div>
                        </div>
                    </div>`;
				cartList.appendChild(item);
			}
		});
	}

	if ($('#cart-total')) $('#cart-total').textContent = formatMoney(total);
}

// Global functions update
window.addToCart = function(productId, storeId, qty) {
	const key = `${productId}_${storeId}`;
	qty = parseInt(qty, 10);

	// 1. Cập nhật localStorage
	cart[key] = (cart[key] || 0) + qty;
	saveCart();

	// 2. Cập nhật CART_CACHE ngay lập tức (Optimistic Update)
	// Nếu chúng ta đang ở trang detail của sản phẩm này, ta đã có đủ thông tin để hiển thị ngay
	// mà không cần gọi lại API fetchCartDetails()
	if (currentProduct && currentProduct.id === key) {
		// Tạo object giống cấu trúc BE trả về
		if (!CART_CACHE[key]) {
			CART_CACHE[key] = {
				product_name : currentProduct.sub_name,
				product_image_url : currentProduct.img,
				stores : [ {
					store_name : currentProduct.name,
					ps_min_price_store : currentProduct.price,
					product_images : [ {ps_image_url : currentProduct.img} ]
				} ]
			};
		}
	} else {
		// Nếu thêm từ nguồn lạ (ít xảy ra ở trang detail), fetch lại để chắc chắn
		fetchCartDetails();
	}

	updateCartUI();
	alert('Đã thêm sản phẩm vào giỏ hàng!');
}

				   window.changeQty = function(key, delta) {
	cart[key] = (cart[key] || 0) + delta;
	if (cart[key] <= 0) delete cart[key];
	saveCart();
	// Không cần fetch lại vì thông tin sản phẩm (giá/tên) không đổi
}

									  window.removeItem = function(key) {
	if (confirm("Xóa sản phẩm này khỏi giỏ hàng?")) {
		delete cart[key];
		saveCart();
	}
}

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

// Global scope logic for Filter/Voice (Giữ nguyên)
let currentRecognition = null;
window.toggleFilterMenu = function() {
	const menu = $('#filter-dropdown');
	if (menu) menu.classList.toggle('active');
};
window.startVoiceSearch = function() {
	alert("Tìm kiếm bằng giọng nói chưa được tích hợp trên trang này.");
};
window.cancelVoiceSearch = function() {
	if (currentRecognition) currentRecognition.abort();
	$('#voice_popup').style.display = "none";
}

						   // KHỞI ĐỘNG
						   document.addEventListener('DOMContentLoaded', async () => {
							   // 1. Load sản phẩm chính (Dùng API cart/details với key duy nhất)
							   await loadMainProduct();

							   // 2. Load toàn bộ chi tiết giỏ hàng từ Server (Gửi list keys lên)
							   await fetchCartDetails();

							   updateAccountLink();

							   // Bind events
							   const qtyInput = $('#qty-input');
							   if (qtyInput) {
								   qtyInput.value = currentQuantity;
								   $('#qty-minus').onclick = () => { if (currentQuantity > 1) qtyInput.value = --currentQuantity; };
								   $('#qty-plus').onclick = () => { qtyInput.value = ++currentQuantity; };
							   }

							   const addToCartBtn = $('#add-to-cart-btn');
							   if (addToCartBtn) {
								   addToCartBtn.onclick = () => {
									   if (currentProduct) addToCart(currentProduct.product_id, currentProduct.store_id, currentQuantity);
								   };
							   }

							   const buyNowBtn = $('#buy-now-btn');
							   if (buyNowBtn) {
								   buyNowBtn.onclick = () => {
									   if (currentProduct) {
										   addToCart(currentProduct.product_id, currentProduct.store_id, currentQuantity);
										   document.body.classList.add('page-fade-out');
										   setTimeout(() => { window.location.href = 'cart.html'; }, 500);
									   }
								   };
							   }

							   // GẮN SỰ KIỆN MAP
							   const mapBtn = document.getElementById('map-btn');

							   if (mapBtn) {
								   mapBtn.onclick = () => {
									   // Kiểm tra xem có thông tin sản phẩm hiện tại không
									   if (!currentProduct) {
										   alert('Chưa tải được thông tin cửa hàng!');
										   return;
									   }

									   // Tạo object thông tin cửa hàng
									   const storeInfo = {
										   id : currentProduct.store_id, // ✅ Sửa từ currentStoreId thành currentProduct.store_id
										   name : currentProduct.name,
										   address : currentProduct.address
									   };

									   // Lưu vào localStorage
									   localStorage.setItem('TARGET_STORE', JSON.stringify(storeInfo));

									   // Chuyển hướng đến trang bản đồ
									   window.location.href = '/map/';
								   };
							   }

							   const searchForm = $('#search_form');
							   if (searchForm) {
								   searchForm.onsubmit = (e) => {
									   e.preventDefault();
									   document.body.classList.add('page-fade-out');
									   setTimeout(() => { window.location.href = `index.html?search=${$('#search_input').value}`; }, 500);
								   };
							   }

							   // Cart Popup Events
							   if ($('#open-cart')) $('#open-cart').onclick = () => { const popup = $('#cart-popup'); popup.style.display = (popup.style.display === 'block') ? 'none' : 'block'; };
							   if ($('#close-cart')) $('#close-cart').onclick = () => $('#cart-popup').style.display = 'none';
							   if ($('#clear-cart')) $('#clear-cart').onclick = () => { if (confirm('Xóa toàn bộ giỏ hàng?')) { cart = {}; saveCart(); } };
							   if ($('#checkout')) $('#checkout').onclick = () => { document.body.classList.add('page-fade-out'); setTimeout(() => { window.location.href = 'cart.html'; }, 500); };

							   if ($('#logout-link')) {
								   $('#logout-link').addEventListener('click', async () => {
									   if (typeof supabase !== 'undefined') await supabase.auth.signOut();
									   localStorage.removeItem('accessToken');
									   localStorage.removeItem('userName');
									   document.body.classList.add('page-fade-out');
									   setTimeout(() => { window.location.href = 'index.html'; }, 500);
								   });
							   }
						   });