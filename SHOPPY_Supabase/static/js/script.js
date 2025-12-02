// ======================================================================
// PHẦN 1: HÀM FORMAT TIỀN, LOAD VÀ RENDER SẢN PHẨM
// ======================================================================

// Danh sách sản phẩm lấy từ server
let PRODUCTS = [];

// Giỏ hàng lưu trong localStorage (dạng object: "productId_storeId": số lượng)
let cart = JSON.parse(localStorage.getItem('cart_v1') || '{}');

// Hàm rút gọn querySelector
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel); // Thêm $$

// Format tiền theo dạng 100000 → "100.000₫"
function formatMoney(n) {
	return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + '₫';
}

// --------------------------------------------------------------------------
// THÊM MỚI: HÀM LẤY VÀ HIỂN THỊ GỢI Ý TÌM KIẾM
// --------------------------------------------------------------------------
let suggestionTimeout;
let highlightedIndex = -1; // Index của gợi ý đang được highlight

function showSuggestions() {
	$('#search_suggestions').style.display = 'block';
}

function hideSuggestions() {
	$('#search_suggestions').style.display = 'none';
	highlightedIndex = -1;
}

async function fetchSuggestions(query) {
	if (!query || query.length < 2) {
		hideSuggestions();
		return;
	}

	try {
		// Giả lập gọi API gợi ý tìm kiếm (chỉ lấy 5 sản phẩm đầu tiên)
		// CẦN THAY THẾ bằng API thật khi triển khai
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
	highlightedIndex = -1; // Reset index

	if (!products || products.length === 0) {
		hideSuggestions();
		return;
	}

	// --- 1. Thêm dòng "Tìm kiếm toàn bộ" ---
	const searchAllItem = document.createElement('div');
	searchAllItem.className = 'suggestion-item suggestion-search-all';
	searchAllItem.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="#1867f8">
        <path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z"/>
      </svg>
      Tìm kiếm: <b>${query}</b>
  `;
	searchAllItem.addEventListener('click', () => submitSearch(query));
	container.appendChild(searchAllItem);

	// --- 2. Thêm các sản phẩm gợi ý (có ảnh) ---
	products.forEach(product => {
		const item = document.createElement('div');
		item.className = 'suggestion-item';

		const imageUrl = product.product_image_url || 'images/placeholder.jpg';

		// Tạo HTML cho item gợi ý bao gồm ảnh, tên và vị trí (Không hiện giá)
		item.innerHTML = `
        <img class="suggestion-image" src="${imageUrl}" alt="${product.product_name}">
        <div class="suggestion-text-container">
            <div class="suggestion-name">${product.product_name}</div>
            <div class="suggestion-location">📍 ${product.location_name}</div>
        </div>
    `;

		item.dataset.productId = product.product_id;
		item.addEventListener('click', () => navigateToProductSummary(product.product_id));
		container.appendChild(item);
	});

	showSuggestions();
}

function submitSearch(query) {
	// Đặt giá trị vào ô input và submit form
	$('#search_input').value = query;
	hideSuggestions();
	const searchForm = $('#search_form');
	// Trigger submit để tải sản phẩm
	searchForm.dispatchEvent(new Event('submit', {bubbles : true, cancelable : true}));
}

function navigateToProductSummary(productId) {
	// Chuyển sang trang tổng quan sản phẩm
	window.location.href = `product-summary.html?product_id=${productId}`;
	hideSuggestions();
}
// --------------------------------------------------------------------------

// Load sản phẩm từ API với 3 tham số lọc
async function loadProducts(search = '', distance = '', price = '') {
	try {
		// Gọi API kèm query filter
		// CẦN THAY THẾ bằng API thật khi triển khai
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

// Render danh sách sản phẩm theo cấu trúc mới: HIỂN THỊ KHOẢNG GIÁ
function renderProducts() {
	const wrap = $('#product-list');
	wrap.innerHTML = '';

	// Không render gì cả - đã xóa phần hiển thị sản phẩm
}

// --------------------------------------------------------------------------
// PHẦN MỚI: LOAD VÀ RENDER SẢN PHẨM GỢI Ý
// --------------------------------------------------------------------------

// Load sản phẩm gợi ý từ API
async function loadSuggestedProducts(locationName = null) {
	try {
		// Lấy tọa độ GPS nếu có (khi không có locationName)
		let latitude = null;
		let longitude = null;

		if (!locationName && navigator.geolocation) {
			try {
				const position = await new Promise((resolve, reject) => {
					navigator.geolocation.getCurrentPosition(resolve, reject);
				});
				latitude = position.coords.latitude;
				longitude = position.coords.longitude;
			} catch (err) {
				console.log("Không lấy được GPS, dùng location mặc định");
			}
		}

		// Gọi API
		const res = await fetch('http://127.0.0.1:5000/api/suggest_products', {
			method : 'POST',
			headers : {
				'Content-Type' : 'application/json'
			},
			body : JSON.stringify({
				latitude : latitude,
				longitude : longitude,
				location_name : locationName,
				limit : 100
			})
		});

		const data = await res.json();

		if (data.status === 'success' && data.products) {
			renderSuggestedProducts(data.products);

			// Lấy location_name từ API và đẩy vào ô địa chỉ
			if (data.location_name && $('#search_address_input')) {
				$('#search_address_input').value = data.location_name;
			}
		} else {
			$('#suggested-products-list').innerHTML = '<p style="color:#888; text-align:center; grid-column:1/-1;">Không có sản phẩm gợi ý.</p>';
		}

	} catch (err) {
		console.error("Lỗi khi load sản phẩm gợi ý:", err);
		$('#suggested-products-list').innerHTML = '<p style="color:red; text-align:center; grid-column:1/-1;">Không thể kết nối đến server.</p>';
	}
}

// Render sản phẩm gợi ý
function renderSuggestedProducts(products) {
	const wrap = $('#suggested-products-list');
	wrap.innerHTML = '';

	if (!products || products.length === 0) {
		wrap.innerHTML = '<p style="color:#888; text-align:center; grid-column:1/-1;">Không có sản phẩm gợi ý.</p>';
		return;
	}

	products.forEach(product => {
		const detailUrl = `product-summary.html?product_id=${product.product_id}`;
		const imageUrl = product.product_image_url || 'images/placeholder.jpg';

		const minPrice = product.min_price;
		const maxPrice = product.max_price;

		let priceText = '';
		if (minPrice && minPrice > 0 && maxPrice && maxPrice > 0) {
			// Format: "10.000 - 30.000₫" (dấu ₫ chỉ ở cuối)
			const minFormatted = minPrice.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
			const maxFormatted = maxPrice.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
			priceText = `${minFormatted} - ${maxFormatted}₫`;
		} else if (minPrice && minPrice > 0) {
			priceText = formatMoney(minPrice);
		} else {
			priceText = 'Liên hệ qua facebook';
		}

		const productCard = document.createElement('div');
		productCard.className = 'product-card';
		productCard.style.cssText = 'background:white; border-radius:8px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.1); transition:transform 0.2s; cursor:pointer;';

		productCard.innerHTML = `
      <a href="${detailUrl}" style="text-decoration:none; color:inherit;">
        <img src="${imageUrl}" alt="${product.product_name}" style="width:100%; height:200px; object-fit:cover;">
        <div style="padding:15px;">
          <h3 style="font-size:16px; margin:0 0 10px 0; color:#333; height:40px; overflow:hidden;">${product.product_name}</h3>
          <p style="font-size:18px; font-weight:bold; color:#1867f8; margin:0;">${priceText}</p>
        </div>
      </a>
    `;

		// Hover effect
		productCard.addEventListener('mouseenter', () => {
			productCard.style.transform = 'translateY(-5px)';
		});
		productCard.addEventListener('mouseleave', () => {
			productCard.style.transform = 'translateY(0)';
		});

		wrap.appendChild(productCard);
	});
}

// ======================================================================
// PHẦN 2: XỬ LÝ TÌM KIẾM & LỌC SẢN PHẨM
// ======================================================================

// Kiểm tra form tồn tại rồi mới gắn event submit
if (document.getElementById('search_form')) {

	document.getElementById('search_form').addEventListener('submit', async (e) => {
		e.preventDefault();
		hideSuggestions(); // Ẩn gợi ý khi submit

		const searchText = $('#search_input').value;
		const distanceFilter = $('#distance_filter').value;
		const priceFilter = $('#price_filter').value;

		console.log('Tìm kiếm:', searchText, distanceFilter, priceFilter);

		// Load lại sản phẩm với filter
		await loadProducts(searchText, distanceFilter, priceFilter);
	});

	// --------------------------------------------------------------------------
	// THÊM MỚI: XỬ LÝ SỰ KIỆN GÕ PHÍM CHO GỢI Ý
	// --------------------------------------------------------------------------
	const searchInput = $('#search_input');

	// Lấy gợi ý khi gõ chữ
	searchInput.addEventListener('input', () => {
		clearTimeout(suggestionTimeout);
		suggestionTimeout = setTimeout(() => {
			fetchSuggestions(searchInput.value);
		}, 300); // Debounce 300ms
	});

	// Xử lý phím ESC (ẩn gợi ý), ArrowDown/Up (chọn), Enter (chọn/tìm kiếm)
	searchInput.addEventListener('keydown', (e) => {
		const suggestions = $$('#search_suggestions .suggestion-item');
		if (suggestions.length === 0) return;

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			suggestions[highlightedIndex]?.classList.remove('highlighted');
			highlightedIndex = (highlightedIndex + 1) % suggestions.length;
			suggestions[highlightedIndex].classList.add('highlighted');

			// Focus vào item được chọn (cuộn nếu cần)
			suggestions[highlightedIndex].scrollIntoView({block : "nearest"});

		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			suggestions[highlightedIndex]?.classList.remove('highlighted');
			highlightedIndex = (highlightedIndex - 1 + suggestions.length) % suggestions.length;
			suggestions[highlightedIndex].classList.add('highlighted');

			// Focus vào item được chọn (cuộn nếu cần)
			suggestions[highlightedIndex].scrollIntoView({block : "nearest"});
		} else if (e.key === 'Enter') {
			e.preventDefault(); // Chặn form submit mặc định
			const highlighted = suggestions[highlightedIndex];
			if (highlighted) {
				// Tắt submit để tránh gọi 2 lần search
				e.stopImmediatePropagation();
				highlighted.click(); // Kích hoạt hành động của item được chọn
			} else {
				// Nếu không có item nào được chọn, submit form như bình thường
				document.getElementById('search_form').dispatchEvent(new Event('submit', {bubbles : true, cancelable : true}));
			}
		} else if (e.key === 'Escape') {
			hideSuggestions();
		}
	});

	// Ẩn suggestions khi click ra ngoài
	document.addEventListener('click', function(event) {
		const form = $('#search_form');
		const suggestions = $('#search_suggestions');
		if (form && suggestions && !form.contains(event.target) && !suggestions.contains(event.target)) {
			hideSuggestions();
		}
	});
}

// ======================================================================
// PHẦN 3: GHI ÂM GIỌNG NÓI (VOICE SEARCH)
// ======================================================================

// Lưu recognition đang chạy để dừng nếu người dùng mở lại
let currentRecognition = null;

// Bắt đầu ghi âm
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

	recognition.continuous = false;
	recognition.interimResults = true;
	recognition.lang = "vi-VN";

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

		// ✅ Nếu đã có kết quả cuối → Hiển thị suggestions
		if (finalTranscript) {
			$('#search_input').value = finalTranscript;

			setTimeout(async () => {
				popup.style.display = "none";
				recognition.stop();

				// ✅ LẤY GỢI Ý TỪ API
				await fetchSuggestions(finalTranscript);

				// ✅ HIỂN THỊ POPUP GỢI Ý (giống như khi gõ chữ)
				showSuggestions();
			}, 200);
		}
	};

	// Khi xảy ra lỗi micro / không nói
	recognition.onerror = function(event) {
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

	// Khi kết thúc
	recognition.onend = function() {
		currentRecognition = null;

		if ($('#transcript_display').textContent === "Đang nghe...") {
			setTimeout(() => popup.style.display = "none", 200);
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
// PHẦN 4: TÌM KIẾM BẰNG HÌNH ẢNH (IMAGE SEARCH) - ĐÃ SỬA
// ======================================================================

let currentImageData = null;
let currentTab = 'upload';

// Mở popup tìm kiếm bằng hình ảnh
function openImageSearch() {
	const popup = document.getElementById('image_search_popup');
	popup.classList.add('active');
	popup.style.display = 'flex';

	// Reset về tab upload
	switchImageTab('upload');
	clearAllImages();
}

// Đóng popup
function closeImageSearch() {
	const popup = document.getElementById('image_search_popup');
	popup.classList.remove('active');
	setTimeout(() => {
		popup.style.display = 'none';
	}, 200);

	clearAllImages();
	hideError();
}

// Chuyển tab
function switchImageTab(tabName) {
	currentTab = tabName;

	// Update tab buttons
	document.querySelectorAll('.tab-button').forEach(btn => {
		if (btn.dataset.tab === tabName) {
			btn.classList.add('active');
		} else {
			btn.classList.remove('active');
		}
	});

	// Update tab panels
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
		e.stopPropagation(); // chặn bubble
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
}

// Xử lý file ảnh
function handleImageFile(file) {
	// Kiểm tra dung lượng (5MB)
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

// Tải ảnh từ paste - ĐÃ SỬA
function loadPastedImage() {
	const input = document.getElementById('imagePasteInput');
	const value = input.value.trim();

	if (!value) {
		// Ẩn preview nếu không có giá trị
		clearPasteImage();
		return;
	}

	// Check if it's a URL
	if (value.startsWith('http://') || value.startsWith('https://')) {
		// Validate URL format
		try {
			new URL(value);
			currentImageData = value;
			showImagePreview(value, 'paste');
			hideError();
		} catch (e) {
			showError('URL không hợp lệ');
		}
	}
	// Check if it's base64
	else if (value.startsWith('data:image/')) {
		currentImageData = value;
		showImagePreview(value, 'paste');
		hideError();
	}
	// Assume it's raw base64
	else if (value.length > 100) { // Chỉ xử lý nếu là base64 dài (tránh nhầm với text thường)
		try {
			// Thử decode để kiểm tra có phải base64 hợp lệ không
			atob(value);
			currentImageData = `data:image/jpeg;base64,${value}`;
			showImagePreview(currentImageData, 'paste');
			hideError();
		} catch (e) {
			showError('Base64 không hợp lệ');
		}
	}
	// Nếu là text thường, không làm gì
}

// Hiển thị preview ảnh
function showImagePreview(imageData, tab) {
	if (tab === 'upload') {
		const preview = document.getElementById('imagePreview');
		const container = document.getElementById('uploadPreviewContainer');

		preview.src = imageData;
		preview.style.display = 'block';
		container.style.display = 'block';

		// Ẩn upload zone
		document.getElementById('imageUploadArea').style.display = 'none';
	} else {
		const preview = document.getElementById('pastePreview');
		const container = document.getElementById('pastePreviewContainer');

		preview.src = imageData;
		preview.style.display = 'block';
		container.style.display = 'block';
	}
}

// Xóa ảnh upload
function clearUploadImage() {
	document.getElementById('imagePreview').style.display = 'none';
	document.getElementById('uploadPreviewContainer').style.display = 'none';
	document.getElementById('imageUploadArea').style.display = 'block';
	document.getElementById('imageFileInput').value = '';

	if (currentTab === 'upload') {
		currentImageData = null;
	}
}

// Xóa ảnh paste
function clearPasteImage() {
	document.getElementById('pastePreview').style.display = 'none';
	document.getElementById('pastePreviewContainer').style.display = 'none';
	document.getElementById('imagePasteInput').value = '';

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
	errorDiv.textContent = message;
	errorDiv.classList.add('show');
	errorDiv.style.display = 'block';
}

// Ẩn lỗi
function hideError() {
	const errorDiv = document.getElementById('imageSearchError');
	errorDiv.classList.remove('show');
	errorDiv.style.display = 'none';
}

// Tìm kiếm bằng ảnh
// Tìm kiếm bằng ảnh - ĐÃ SỬA
async function searchWithImage() {
	if (!currentImageData) {
		showError('Vui lòng chọn hoặc nhập ảnh trước');
		return;
	}

	const searchBtn = document.querySelector('.btn-primary');
	searchBtn.classList.add('loading');
	searchBtn.disabled = true;

	try {
		// Gọi API
		// CẦN THAY THẾ bằng API thật khi triển khai
		const response = await fetch('/api/search-by-image', {
			method : 'POST',
			headers : {
				'Content-Type' : 'application/json'
			},
			body : JSON.stringify({
				image : currentImageData
			})
		});

		const data = await response.json();

		if (data.status === 'success') {
			// Đóng popup
			closeImageSearch();

			// QUAN TRỌNG: Cập nhật danh sách sản phẩm TOÀN CỤC
			PRODUCTS = data.products || [];

			// Render lại sản phẩm với kết quả mới
			renderProducts();

			// Cập nhật search input với từ khóa tìm được
			const searchInput = document.getElementById('search_input');
			if (searchInput && data.search_term) {
				searchInput.value = data.search_term;
			}

			// Cập nhật tiêu đề kết quả tìm kiếm
			const title = document.querySelector('h2');
			if (title && data.search_term) {
				title.textContent = `Các sản phẩm tìm thấy cho "${data.search_term}"`;
			}

			console.log('✅ Image search successful:', data.products.length + ' products found');

		} else if (data.status === 'not_found') {
			showError(`❌ ${data.message}`);
			// Hiển thị danh sách rỗng
			PRODUCTS = [];
			renderProducts();
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

// Thêm vào phần Khởi tạo khi trang load
document.addEventListener('DOMContentLoaded', () => {
	setupImageUpload();

	// Tự động tải ảnh khi paste hoặc nhập vào ô URL/Base64
	const pasteInput = document.getElementById('imagePasteInput');

	pasteInput.addEventListener('input', (e) => {
		const value = e.target.value.trim();

		// Nếu xóa hết text thì ẩn preview
		if (!value) {
			clearPasteImage();
			hideError();
			return;
		}

		// Chờ một chút để người dùng nhập/xong
		clearTimeout(pasteInput.debounceTimer);
		pasteInput.debounceTimer = setTimeout(() => {
			loadPastedImage();
		}, 0); // Chờ 800ms sau khi ngừng gõ
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

	// Close popup khi click outside
	const popup = document.getElementById('image_search_popup');
	if (popup) {
		popup.addEventListener('click', (e) => {
			if (e.target === popup) {
				closeImageSearch();
			}
		});
	}

	// ESC key to close
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') {
			const popup = document.getElementById('image_search_popup');
			if (popup && popup.style.display === 'flex') {
				closeImageSearch();
			}
		}
	});
});

// Close popup khi click outside
const popup = document.getElementById('image_search_popup');
if (popup) {
	popup.addEventListener('click', (e) => {
		if (e.target === popup) {
			closeImageSearch();
		}
	});
}

// ESC key to close
document.addEventListener('keydown', (e) => {
	if (e.key === 'Escape') {
		const popup = document.getElementById('image_search_popup');
		if (popup && popup.style.display === 'flex') {
			closeImageSearch();
		}
	}
});

// ======================================================================
// PHẦN 4: GIỎ HÀNG (GIỮ NGUYÊN LOGIC)
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
	const total = Object.entries(cart).reduce((sum, [ key, qty ]) => {
		const [productId, storeId] = key.split('_');
		const product = PRODUCTS.find(p => p.product_id == productId);

		if (product) {
			const store = product.stores.find(s => s.store_id == storeId);
			// Lấy giá min_price_store nếu có, nếu không thì dùng cost (hoặc 0)
			if (store) return sum + ((store.ps_min_price_store || store.cost || 0) * qty);
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

		Object.entries(cart).forEach(([ key, qty ]) => {
			const [productId, storeId] = key.split('_');

			const product = PRODUCTS.find(p => p.product_id == productId);
			if (!product) return;

			const store = product.stores.find(s => s.store_id == storeId);
			if (!store) return;

			// Lấy ảnh chính của cửa hàng (ps_type = 1), nếu không có thì dùng ảnh sản phẩm
			const mainImage = store.product_images.find(img => img.ps_type === 1);
			const storeImageUrl = mainImage ? mainImage.ps_image_url : product.product_image_url;

			const price = store.ps_min_price_store || store.cost || 0;

			const item = document.createElement('div');
			item.className = 'cart-item';

			item.innerHTML = `
        <img src="${storeImageUrl}" />

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
// BỊ LOẠI BỎ HÀM ADD TO CART CỦA SẢN PHẨM CHÍNH TRÊN TRANG INDEX
function addToCart(productId, storeId) {
	alert("Vui lòng vào trang Chi Tiết Sản Phẩm để thêm vào giỏ hàng!");
}

// Tăng/giảm số lượng
function changeQty(key, delta) {
	cart[key] = (cart[key] || 0) + delta;
	if (cart[key] <= 0) delete cart[key];
	saveCart();
}

// Xóa khỏi giỏ
function removeItem(key) {
	if (confirm('Xóa sản phẩm này khỏi giỏ hàng?')) {
		delete cart[key];
		saveCart();
	}
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

// Nút Xem giỏ hàng → chuyển sang cart.html (ĐÃ CẬP NHẬT ID)
if ($('#view-cart-detail')) {
	$('#view-cart-detail').addEventListener('click', (e) => {
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

// Toggle popup giỏ hàng (ĐÃ THAY ĐỔI: Chuyển sang dùng Hover/JS class)
const cartBtn = $('#open-cart');
const cartPopup = $('#cart-popup');

if (cartBtn && cartPopup) {
	// Bật popup khi di chuột vào nút
	cartBtn.addEventListener('mouseenter', () => {
		// Chỉ bật class, CSS lo phần display: block
		cartPopup.classList.add('cart-hover-active');
	});

	// Tắt popup khi di chuột ra khỏi nút VÀ ra khỏi popup
	cartBtn.addEventListener('mouseleave', (e) => {
		// Nếu chuột ra khỏi nút nhưng lại vào popup, KHÔNG làm gì
		if (!cartPopup.contains(e.relatedTarget) && e.relatedTarget !== cartPopup) {
			// Dùng timeout để cho phép di chuyển chuột qua lại giữa button và popup
			setTimeout(() => {
				if (!cartPopup.matches(':hover')) {
					cartPopup.classList.remove('cart-hover-active');
				}
			}, 50);
		}
	});

	// Tắt popup khi di chuột ra khỏi popup
	cartPopup.addEventListener('mouseleave', (e) => {
		// Nếu chuột ra khỏi popup và không vào lại button, tắt popup
		if (!cartBtn.contains(e.relatedTarget) && e.relatedTarget !== cartBtn) {
			cartPopup.classList.remove('cart-hover-active');
		}
	});

	// Nút Đóng trong popup
	if ($('#close-cart')) {
		$('#close-cart').addEventListener('click', () => {
			cartPopup.classList.remove('cart-hover-active');
		});
	}
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

	// 1. Lấy thông tin User hiện tại
	const {data : {session}} = await supabase.auth.getSession();

	let finalName = null;

	if (session && session.user) {
		// --- [LOGIC MỚI: Ưu tiên lấy tên từ Database] ---

		// Gọi Supabase lấy tên trong bảng profiles
		const {data : profile, error} = await supabase
											.from('profiles')
											.select('name')
											.eq('id', session.user.id)
											.single();

		if (profile && profile.name) {
			// Nếu trong DB có tên -> Dùng tên DB (Tên cũ)
			finalName = profile.name;
		} else {
			// Nếu chưa có trong DB -> Mới dùng tên từ Google/Email
			finalName = session.user.user_metadata.name || session.user.email.split('@')[0];
		}

		// Lưu lại vào LocalStorage để dùng cho các trang khác
		localStorage.setItem('userName', finalName);
	} else {
		localStorage.removeItem('userName');
	}

	// Cập nhật giao diện Header
	if (finalName && accountLink) {
		accountLink.innerHTML = `👋 Chào, <b>${finalName}</b>`;
		accountLink.href = 'profile.html';
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
		const result = [ city, country ].filter(Boolean).join(', ');

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

	// Chỉ lấy tọa độ để hiển thị TÊN ĐƯỜNG cho đẹp (UI)
	// Không cần gọi fetch('/api/set_location') nữa vì file gps-fast.js đã làm rồi
	navigator.geolocation.getCurrentPosition(
		async (position) => {
			const lat = position.coords.latitude;
			const long = position.coords.longitude;

			// Chỉ làm nhiệm vụ hiển thị UI
			const locationName = await reverseGeocode(lat, long);
			locationElement.textContent = `📍 Vị trí hiện tại: ${locationName}`;
		},
		(err) => {
			locationElement.textContent = "📍 Không thể xác định vị trí";
		});
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
		yesButton.addEventListener('click', handleYes, {once : true});
		noButton.addEventListener('click', handleNo, {once : true});

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

	// === 2. KIỂM TRA SESSION & CẬP NHẬT VỊ TRÍ LÊN DB ===
	// Đoạn này sẽ chạy mỗi khi vào trang chủ (sau khi login/register/google login xong)
	const {data : {session}} = await supabase.auth.getSession();

	if (session && session.user) {
		// Nếu đã đăng nhập -> Cập nhật vị trí lên Database (hàm này có trong script1.js)
		updateUserLocation(session.user.id);
	}

	// === 4. Load sản phẩm gợi ý ===
	loadSuggestedProducts();

	// === 5. Xử lý event cho ô địa chỉ ===
	const addressInput = $('#search_address_input');
	if (addressInput) {
		addressInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				const locationName = addressInput.value.trim();
				if (locationName) {
					// Load sản phẩm gợi ý theo tên địa điểm
					loadSuggestedProducts(locationName);
				}
			}
		});
	}

	// 6. Hiệu ứng hiển thị trang
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
		const {error} = await supabase.auth.signOut();
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
			const {latitude, longitude} = position.coords;

			// Gọi Supabase update
			const {error} = await supabase
								.from('profiles')
								.update({
									lat : latitude,
									long : longitude,
									updated_at : new Date()
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
		});
}