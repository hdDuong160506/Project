const API_BASE = 'http://127.0.0.1:5000';

const statusEl = document.getElementById('status');
const viewProducts = document.getElementById('view-products');
const viewStores = document.getElementById('view-stores');
const productsEl = document.getElementById('products');
const storesEl = document.getElementById('stores');
const storeTitleEl = document.getElementById('store-title');
const sortDistanceEl = document.getElementById('sort-distance');
const sortPriceEl = document.getElementById('sort-price');

const PLACEHOLDER =
	'data:image/svg+xml;utf8,' +
	encodeURIComponent(
		'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500">' +
		'<rect width="100%" height="100%" fill="#f6f6f6"/>' +
		'<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" ' +
		'font-family="system-ui,Segoe UI,Arial" font-size="20" fill="#999">No image</text>' +
		'</svg>');

// 50000 --> 50.000đ
function vnd(n) {
	if (n == null) return '';
	const x = Number(n);
	if (!Number.isFinite(x)) return '';
	return x.toLocaleString('vi-VN', {style : 'currency', currency : 'VND'});
}

function priceLabel(it) {
	if (it && typeof it.price_text === 'string' && it.price_text.trim()) {
		return `${it.price_text.trim()} đ`;
	}
	const v = vnd(it ? it.price : undefined);
	return v ? v.replace('₫', 'đ') : '';
}

function renderProducts(items) {
	productsEl.innerHTML = '';
	if (!items || !items.length) {
		productsEl.innerHTML = '<div class="empty">Không có sản phẩm phù hợp.</div>';
		return;
	}

	for (const it of items) {
		const card = document.createElement('div');
		card.className = 'card';

		const img = document.createElement('img');
		img.className = 'thumb';
		img.loading = 'lazy';
		img.src = it.image_url || PLACEHOLDER;
		img.alt = it.name || 'image';
		img.onerror = () => { img.src = PLACEHOLDER; };
		card.appendChild(img);

		const box = document.createElement('div');
		box.className = 'pad';
		box.innerHTML = `
      <div class="name">${it.name || ''}</div>
      <div class="muted">Nhấp để xem các cửa hàng</div>
    `;
		card.appendChild(box);

		card.style.cursor = 'pointer';
		card.addEventListener('click', () => showStoresFor(it));

		productsEl.appendChild(card);
	}
}

// Lưu items GỐC từ API (không bao giờ thay đổi)
let ORIGINAL_STORES_DATA = null;
let CURRENT_PRODUCT_NAME = '';

// Chuẩn hóa giá trị về [0, 1]
function normalize(value, min, max) {
	if (max === min) return 0;
	return (value - min) / (max - min);
}

// Hàm tính toán và trả về items đã sort
function getSortedStores(items, useDistance, usePrice) {
	if (!items || !items.length) return items;

	// Nếu cả 2 đều không được chọn, trả về thứ tự gốc
	if (!useDistance && !usePrice) {
		return items; // Trả về items gốc, không sort
	}

	let sortedItems = [...items ]; // Tạo bản sao để sort

	// Nếu chỉ chọn 1 tiêu chí
	if (useDistance && !usePrice) {
		sortedItems.sort((a, b) => {
			return (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity);
		});
	} else if (!useDistance && usePrice) {
		sortedItems.sort((a, b) => {
			return (a.price ?? Infinity) - (b.price ?? Infinity);
		});
	}
	// Nếu chọn cả 2: sử dụng trọng số
	else {
		// Tìm min/max để chuẩn hóa
		const distances = items.map(it => it.distance_km ?? Infinity).filter(d => d !== Infinity);
		const prices = items.map(it => it.price ?? Infinity).filter(p => p !== Infinity);

		const minDist = Math.min(...distances, Infinity);
		const maxDist = Math.max(...distances, -Infinity);
		const minPrice = Math.min(...prices, Infinity);
		const maxPrice = Math.max(...prices, -Infinity);

		sortedItems.sort((a, b) => {
			// Chuẩn hóa về [0, 1]
			const distA = a.distance_km != null ? normalize(a.distance_km, minDist, maxDist) : 1;
			const distB = b.distance_km != null ? normalize(b.distance_km, minDist, maxDist) : 1;

			const priceA = a.price != null ? normalize(a.price, minPrice, maxPrice) : 1;
			const priceB = b.price != null ? normalize(b.price, minPrice, maxPrice) : 1;

			// Trọng số bằng nhau (0.5 + 0.5 = 1)
			const scoreA = distA * 0.5 + priceA * 0.5;
			const scoreB = distB * 0.5 + priceB * 0.5;

			return scoreA - scoreB;
		});
	}

	return sortedItems;
}

function renderStores(items, productName) {
	storesEl.innerHTML = '';
	storeTitleEl.textContent = productName || '';

	if (!items || !items.length) {
		storesEl.innerHTML = '<div class="empty">Không có cửa hàng bán sản phẩm này.</div>';
		return;
	}

	for (const it of items) {
		const card = document.createElement('div');
		card.className = 'card';

		const img = document.createElement('img');
		img.className = 'thumb';
		img.loading = 'lazy';
		img.src = it.image_url || PLACEHOLDER;
		img.alt = it.name || 'image';
		img.onerror = () => { img.src = PLACEHOLDER; };
		card.appendChild(img);

		const box = document.createElement('div');
		box.className = 'pad';

		const dist = (typeof it.distance_km === 'number')
						 ? (it.distance_km.toFixed(2) + ' km')
						 : '';

		box.innerHTML = `
      <div class="name">${it.shop || 'Cửa hàng'}</div>
      <div class="price">${priceLabel(it)}</div>
      <div class="muted">${it.address || ''}</div>
      <div class="tag">${dist}</div>
    `;

		card.appendChild(box);
		storesEl.appendChild(card);
	}
}

// Hàm update hiển thị stores dựa trên checkbox
function updateStoresDisplay() {
	if (!ORIGINAL_STORES_DATA) return;

	const useDistance = sortDistanceEl?.checked || false;
	const usePrice = sortPriceEl?.checked || false;

	// Lấy items đã sort (hoặc gốc nếu không sort)
	const itemsToShow = getSortedStores(ORIGINAL_STORES_DATA, useDistance, usePrice);

	// Render lại
	renderStores(itemsToShow, CURRENT_PRODUCT_NAME);
}

// Event listener cho checkboxes
sortDistanceEl?.addEventListener('change', updateStoresDisplay);
sortPriceEl?.addEventListener('change', updateStoresDisplay);

let LAST_GPS = null;
let LAST_PRODUCT_STATUS = '';

async function listProductsByGPS(lat, lon, limit = 10) {
	const res = await fetch(`${API_BASE}/api/products`, {
		method : 'POST',
		headers : {'Content-Type' : 'application/json'},
		body : JSON.stringify({latitude : lat, longitude : lon, limit})
	});
	if (!res.ok) throw new Error(`API error ${res.status}`);
	return res.json();
}

async function listProductsByCity(city, limit = 10) {
	const res = await fetch(`${API_BASE}/api/products`, {
		method : 'POST',
		headers : {'Content-Type' : 'application/json'},
		body : JSON.stringify({city, limit})
	});
	if (!res.ok) throw new Error(`API error ${res.status}`);
	return res.json();
}

async function listStores(product_id) {
	const payload = {product_id};
	if (LAST_GPS) {
		payload.latitude = LAST_GPS.lat;
		payload.longitude = LAST_GPS.lon;
	}
	const res = await fetch(`${API_BASE}/api/product-stores`, {
		method : 'POST',
		headers : {'Content-Type' : 'application/json'},
		body : JSON.stringify(payload)
	});
	if (!res.ok) throw new Error(`API error ${res.status}`);
	return res.json();
}

function showProducts(items) {
	viewStores.style.display = 'none';
	viewProducts.style.display = '';
	renderProducts(items);
}

function showStores(items, product) {
	viewProducts.style.display = 'none';
	viewStores.style.display = '';

	// Lưu items GỐC
	ORIGINAL_STORES_DATA = items;
	CURRENT_PRODUCT_NAME = product?.name || '';

	// Reset checkboxes về trạng thái không tích
	if (sortDistanceEl) sortDistanceEl.checked = false;
	if (sortPriceEl) sortPriceEl.checked = false;

	// Hiển thị items gốc (chưa sort)
	renderStores(items, CURRENT_PRODUCT_NAME);
}

async function showStoresFor(product) {
	try {
		statusEl.textContent = 'Đang tải các cửa hàng...';
		const data = await listStores(product.product_id);
		showStores(data.results, {name : product.name});
		statusEl.textContent = `Cửa hàng: ${data.count}`;
	} catch (e) {
		statusEl.textContent = `API lỗi: ${e.message}`;
	}
}

const GPS_OPTS = {
	enableHighAccuracy : true,
	timeout : 30000,
	maximumAge : 0
};

async function handleGPS() {
	if (!navigator.geolocation) {
		statusEl.textContent = 'Trình duyệt không hỗ trợ Geolocation';
		return;
	}
	statusEl.textContent = 'Đang lấy vị trí của bạn...';
	let done = false;

	const timer = setTimeout(() => {
		if (!done) statusEl.textContent = 'Không thể lấy vị trí GPS';
	}, 30000);

	navigator.geolocation.getCurrentPosition(
		async (pos) => {
			if (done) return;
			done = true;
			clearTimeout(timer);

			const lat = pos.coords.latitude;
			const lon = pos.coords.longitude;
			LAST_GPS = {lat, lon};

			try {
				const data = await listProductsByGPS(lat, lon);
				showProducts(data.products);
				statusEl.textContent = `Sản phẩm: ${data.count}`;
				LAST_PRODUCT_STATUS = statusEl.textContent;
				document.getElementById('city').value = data.city;
			} catch (e) {
				statusEl.textContent = `API lỗi: ${e.message}`;
			}
		},
		(err) => {
			console.warn('Geolocation error:', err);
		},
		GPS_OPTS);
}
document.getElementById('btn-gps').addEventListener('click', handleGPS);

document.getElementById('btn-city').addEventListener('click', async () => {
	const city = document.getElementById('city').value.trim();
	if (!city) {
		statusEl.textContent = 'Vui lòng nhập tỉnh/thành';
		return;
	}

	try {
		statusEl.textContent = 'Đang tải sản phẩm...';
		LAST_GPS = null;

		const data = await listProductsByCity(city);
		showProducts(data.products);

		statusEl.textContent = `Sản phẩm: ${data.count}`;
		LAST_PRODUCT_STATUS = statusEl.textContent;
	} catch (e) {
		statusEl.textContent = `API lỗi: ${e.message}`;
	}
});

document.getElementById('btn-back').addEventListener('click', () => {
	viewStores.style.display = 'none';
	viewProducts.style.display = '';
	statusEl.textContent = LAST_PRODUCT_STATUS || '';
});