document.addEventListener('DOMContentLoaded', () => {

  // === [THÊM MỚI] KIỂM TRA ĐĂNG NHẬP ===
  // Nếu đã có Token trong LocalStorage thì đá về trang chủ ngay
  const existingToken = localStorage.getItem('accessToken'); // Lưu ý: script1.js của bạn đang lưu là 'accessToken'
  
  // Kiểm tra xem token có thực sự tồn tại không
  if (existingToken) {
      // (Tùy chọn) Bạn có thể check thêm logic backend check xem token còn hạn không
      // Nhưng để nhanh, chỉ cần check có token là redirect
      window.location.href = 'index.html'; 
      return; // Dừng code phía dưới lại
  }
  // ======================================

  // === PHẦN 1: CODE ĐỂ LẬT TRANG ===
  const signUpButton = document.getElementById('signUp');
  const signInButton = document.getElementById('signIn');
  const container = document.getElementById('container');
  const registerForm = document.getElementById('register-form');
  const loginForm = document.getElementById('login-form');

  function clearMessages() {
    const regMsg = document.getElementById('register-message');
    const loginMsg = document.getElementById('login-message');
    if (regMsg) regMsg.textContent = '';
    if (loginMsg) loginMsg.textContent = '';
  }

  if (signUpButton && container && registerForm && loginForm) {
    signUpButton.addEventListener('click', () => {
      container.classList.add('right-panel-active');
      clearMessages();
      registerForm.reset();
      loginForm.reset();
    });
  }

  if (signInButton && container && registerForm && loginForm) {
    signInButton.addEventListener('click', () => {
      container.classList.remove('right-panel-active');
      clearMessages();
      registerForm.reset();
      loginForm.reset();
    });
  }

  // === PHẦN 2: CODE API, MODAL, GOOGLE ===

  const API_URL = 'http://127.0.0.1:5000';

  const loginMessageEl = document.getElementById('login-message');
  const registerMessageEl = document.getElementById('register-message');
  const forgotLink = document.getElementById('forgot-password-link');
  const modalOverlay = document.getElementById('modal-overlay');
  const closeModalBtn = document.getElementById('close-modal');
  const forgotForm = document.getElementById('forgot-password-form');
  const forgotMessageEl = document.getElementById('forgot-message');
  const resetEmailPhoneStep = document.getElementById('reset-email-phone-step');
  const otpVerificationStep = document.getElementById('otp-verification-step');
  const newPasswordStep = document.getElementById('new-password-step');
  const resetEmailPhoneInput = document.getElementById('reset-email-phone-input');
  const displayUserEmail = document.getElementById('display-user-email');
  const otpInputFields = document.querySelectorAll('.otp-input-field');
  const fullOtpInput = document.getElementById('full-otp-input');
  const newPwdModalInput = document.getElementById('new-pwd-modal');
  const confirmPwdModalInput = document.getElementById('confirm-pwd-modal');
  const resendOtpLink = document.getElementById('resend-otp-link');
  const modalTitle = document.getElementById('modal-title');
  const backArrow = document.getElementById('modal-back-arrow');

  let currentForgotStep = 0;
  let userEmailForReset = '';
  let resetToken = null;

  const stepTitles = [
    'Đặt lại mật khẩu',
    'Nhập mã xác nhận',
    'Đặt lại mật khẩu'
  ];

  async function getAndSendLocation(accessToken) {
    if (!navigator.geolocation || !accessToken) return;
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const long = position.coords.longitude;
        try {
          await fetch(`${API_URL}/update-location`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              lat,
              long
            })
          });
        } catch (err) {
          console.log('Không thể cập nhật vị trí:', err);
        }
      },
      (error) => {
        console.log('Không lấy được GPS:', error.code);
      }
    );
  }

  function loginWithGoogle() {
    window.location.href = `${API_URL}/login/google`;
  }

  function showLoginMessage(message, isError = false) {
    if (!loginMessageEl) return;
    loginMessageEl.textContent = message;
    loginMessageEl.className = isError ? 'message error' : 'message success';
  }

  function showRegisterMessage(message, isError = false) {
    if (!registerMessageEl) return;
    registerMessageEl.textContent = message;
    registerMessageEl.className = isError ? 'message error' : 'message success';
  }

  function showForgotMessage(message, isError = false) {
    if (!forgotMessageEl) return;
    forgotMessageEl.textContent = message;
    forgotMessageEl.className = isError ? 'message error' : 'message success';
  }

  function updateForgotStepUI() {
    if (resetEmailPhoneStep) resetEmailPhoneStep.style.display = 'none';
    if (otpVerificationStep) otpVerificationStep.style.display = 'none';
    if (newPasswordStep) newPasswordStep.style.display = 'none';
    if (backArrow) backArrow.style.display = 'none';
    if (modalTitle) modalTitle.textContent = stepTitles[currentForgotStep];

    if (currentForgotStep === 0) {
      if (resetEmailPhoneStep) resetEmailPhoneStep.style.display = 'block';
    } else if (currentForgotStep === 1) {
      if (otpVerificationStep) otpVerificationStep.style.display = 'block';
      if (displayUserEmail) displayUserEmail.textContent = userEmailForReset;
      if (backArrow) backArrow.style.display = 'block';
      if (otpInputFields.length > 0) otpInputFields[0].focus();
    } else if (currentForgotStep === 2) {
      if (newPasswordStep) newPasswordStep.style.display = 'block';
      if (backArrow) backArrow.style.display = 'block';
    }
    showForgotMessage('');
  }

  function resetModal() {
    if (modalOverlay) modalOverlay.style.display = 'none';
    currentForgotStep = 0;
    userEmailForReset = '';
    if (forgotForm) forgotForm.reset();
    if (otpInputFields) otpInputFields.forEach(input => input.value = '');
    updateForgotStepUI();
    resetToken = null;
  }

  if (forgotLink) {
    forgotLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (modalOverlay) modalOverlay.style.display = 'flex';
      if (resetEmailPhoneInput) resetEmailPhoneInput.focus();
      updateForgotStepUI();
    });
  }

  if (closeModalBtn) closeModalBtn.addEventListener('click', resetModal);

  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        resetModal();
      }
    });
  }

  if (backArrow) {
    backArrow.addEventListener('click', () => {
      if (currentForgotStep > 0) {
        currentForgotStep--;
        updateForgotStepUI();
      }
    });
  }

  if (otpInputFields) {
    otpInputFields.forEach((input, index) => {
      input.addEventListener('input', (e) => {
        input.value = input.value.replace(/[^0-9]/g, '');
        if (input.value.length === 1 && index < otpInputFields.length - 1) {
          otpInputFields[index + 1].focus();
        }
        if (fullOtpInput) fullOtpInput.value = Array.from(otpInputFields).map(field => field.value).join('');
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && input.value.length === 0 && index > 0) {
          otpInputFields[index - 1].focus();
        }
      });

      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasteData = (e.clipboardData || window.clipboardData).getData('text').trim();

        if (/^\d{6}$/.test(pasteData)) {
          pasteData.split('').forEach((char, i) => {
            if (otpInputFields[i]) otpInputFields[i].value = char;
          });
          if (fullOtpInput) fullOtpInput.value = pasteData;
          otpInputFields[5].focus();
          const verifyBtn = document.getElementById('verify-otp-btn');
          if (verifyBtn) verifyBtn.click();
        } else if (/^\d+$/.test(pasteData)) {
          let currentInput = index;
          for (let i = 0; i < pasteData.length; i++) {
            if (otpInputFields[currentInput]) {
              otpInputFields[currentInput].value = pasteData[i];
              if (currentInput < otpInputFields.length - 1) currentInput++;
            }
          }
          otpInputFields[currentInput].focus();
          if (fullOtpInput) fullOtpInput.value = Array.from(otpInputFields).map(field => field.value).join('');
        }
      });
    });
  }

  if (forgotForm) {
    forgotForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      showForgotMessage('');
      let submitBtn, originalText;

      if (currentForgotStep === 0) {
        submitBtn = document.getElementById('continue-btn');
        originalText = submitBtn.textContent;
        submitBtn.textContent = '⏳ Đang gửi...';
        submitBtn.disabled = true;
        const emailOrPhone = resetEmailPhoneInput.value.trim();
        if (!emailOrPhone) {
          showForgotMessage('Vui lòng nhập Email hoặc Số điện thoại.', true);
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
          return;
        }

        userEmailForReset = emailOrPhone;
        try {
          const response = await fetch(`${API_URL}/forgot-password`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              email: userEmailForReset
            })
          });
          const result = await response.json();
          if (response.ok) {
            showForgotMessage(result.msg || '✅ OTP đã gửi! Vui lòng kiểm tra email.', false);
            currentForgotStep = 1;
            updateForgotStepUI();
          } else {
            showForgotMessage(`❌ Lỗi: ${result.msg || 'Không tìm thấy tài khoản'}`, true);
          }
        } catch (error) {
          showForgotMessage('❌ Lỗi: Không thể kết nối server.', true);
        } finally {
          if (currentForgotStep === 0) {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
          }
        }

      } else if (currentForgotStep === 1) {
        submitBtn = document.getElementById('verify-otp-btn');
        originalText = submitBtn.textContent;
        submitBtn.textContent = '⏳ Đang xác minh...';
        submitBtn.disabled = true;
        const otp = fullOtpInput.value;
        if (otp.length !== 6) {
          showForgotMessage('Vui lòng nhập đủ 6 chữ số OTP.', true);
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
          return;
        }
        try {
          const response = await fetch(`${API_URL}/verify-otp`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              email: userEmailForReset,
              otp: otp
            })
          });
          const result = await response.json();
          if (response.ok) {
            resetToken = result.reset_token;
            showForgotMessage(result.msg || '✅ Mã xác nhận hợp lệ!', false);
            currentForgotStep = 2;
            updateForgotStepUI();
          } else {
            showForgotMessage(`❌ Lỗi: ${result.msg || 'Mã xác nhận không đúng'}`, true);
          }
        } catch (error) {
          showForgotMessage('❌ Lỗi: Không thể kết nối server.', true);
        } finally {
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
        }

      } else if (currentForgotStep === 2) {
        submitBtn = document.getElementById('set-new-pwd-btn');
        originalText = submitBtn.textContent;
        submitBtn.textContent = '⏳ Đang đổi...';
        submitBtn.disabled = true;
        const newPwd = newPwdModalInput.value;
        const confirmPwd = confirmPwdModalInput.value;
        if (newPwd.length < 6) {
          showForgotMessage('Mật khẩu mới phải có ít nhất 6 ký tự.', true);
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
          return;
        }
        if (newPwd !== confirmPwd) {
          showForgotMessage('Mật khẩu xác nhận không khớp.', true);
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
          return;
        }
        try {
          const response = await fetch(`${API_URL}/reset-password`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              reset_token: resetToken,
              new_pwd: newPwd
            })
          });
          const result = await response.json();
          if (response.ok) {
            showForgotMessage(result.msg || '✅ Đổi mật khẩu thành công! Bạn có thể đăng nhập.', false);
            resetToken = null;
            setTimeout(resetModal, 2000);
          } else {
            showForgotMessage(`❌ Lỗi: ${result.msg || 'Không thể đặt lại mật khẩu'}`, true);
          }
        } catch (error) {
          showForgotMessage('❌ Lỗi: Không thể kết nối server.', true);
        } finally {
          if (forgotMessageEl && forgotMessageEl.classList.contains('error')) {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
          }
        }
      }
    });
  }

  if (resendOtpLink) {
    resendOtpLink.addEventListener('click', async (e) => {
      e.preventDefault();
      showForgotMessage('');
      const link = e.target;
      link.textContent = 'Đang gửi lại...';
      link.style.pointerEvents = 'none';
      link.style.opacity = '0.7';
      try {
        const response = await fetch(`${API_URL}/forgot-password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: userEmailForReset
          })
        });
        const result = await response.json();
        if (response.ok) {
          showForgotMessage(result.msg || '✅ Đã gửi lại OTP! Vui lòng kiểm tra email.', false);
        } else {
          showForgotMessage(`❌ Lỗi: ${result.msg || 'Không thể gửi lại OTP'}`, true);
        }
      } catch (error) {
        showForgotMessage('❌ Lỗi: Không thể kết nối server để gửi lại OTP.', true);
      } finally {
        link.textContent = 'Gửi lại';
        link.style.pointerEvents = 'auto';
        link.style.opacity = '1';
      }
    });
  }

  const regForm = document.getElementById('register-form');
  if (regForm) {
    regForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      showRegisterMessage('');
      const submitBtn = e.submitter;
      const originalText = submitBtn.textContent;
      submitBtn.textContent = '⏳ Đang xử lý...';
      submitBtn.disabled = true;
      const data = {
        name: document.getElementById('reg-name').value.trim(),
        email: document.getElementById('reg-email').value.trim(),
        pwd: document.getElementById('reg-pwd').value
      };
      try {
        const response = await fetch(`${API_URL}/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });
        const result = await response.json();
        if (response.ok) {
          showRegisterMessage(result.msg || 'Đăng ký thành công! Vui lòng kiểm tra email.', false);
          e.target.reset();
        } else {
          showRegisterMessage(`❌ Lỗi: ${result.msg || 'Thông tin không hợp lệ'}`, true);
        }
      } catch (error) {
        showRegisterMessage('❌ Lỗi: Không thể kết nối đến server.', true);
      } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    });
  }

  const logForm = document.getElementById('login-form');
  if (logForm) {
    logForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      showLoginMessage('');
      const submitBtn = e.submitter;
      const originalText = submitBtn.textContent;
      submitBtn.textContent = '⏳ Đang xử lý...';
      submitBtn.disabled = true;
      const data = {
        email: document.getElementById('login-email').value.trim(),
        pwd: document.getElementById('login-pwd').value
      };
      try {
        const response = await fetch(`${API_URL}/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });
        const result = await response.json();
        if (response.ok) {
          localStorage.setItem('accessToken', result.access_token);
          localStorage.setItem('refreshToken', result.refresh_token);

          // [BỔ SUNG] Lưu tên người dùng vào localStorage
          if (result.user && result.user.name) {
              localStorage.setItem('userName', result.user.name);
          }

          getAndSendLocation(result.access_token);
          showLoginMessage('✅ Đăng nhập thành công! Đang chuyển hướng...', false);
          setTimeout(() => {
            window.location.href = 'index.html';
          }, 1500);
        } else {
          showLoginMessage(`❌ Lỗi: ${result.msg || 'Sai email hoặc mật khẩu'}`, true);
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
        }
      } catch (error) {
        showLoginMessage('❌ Lỗi: Không thể kết nối đến server.', true);
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    });
  }

  // === XỬ LÝ GOOGLE LOGIN ===

  // 1. Thêm listener cho các nút Google (KHÔNG THAY ĐỔI)
  document.querySelectorAll('.google-login-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault(); // Ngăn button submit form
      loginWithGoogle();
    });
  });

  // 2. Xử lý callback (BỔ SUNG LƯU TÊN NGƯỜI DÙNG TỪ URL)
  const u = new URLSearchParams(window.location.search);
  const a = u.get('access_token');
  const r = u.get('refresh_token');
  const e = u.get('error');
  // Giả định backend Google OAuth trả về user_name trong URL
  const userNameParam = u.get('user_name'); 

  if (a && r) {
    localStorage.setItem('accessToken', a);
    localStorage.setItem('refreshToken', r);
    
    // [BỔ SUNG] Lưu tên người dùng từ URL (Google Login)
    if (userNameParam) {
        localStorage.setItem('userName', decodeURIComponent(userNameParam));
    }
    
    getAndSendLocation(a);
    showLoginMessage('✅ Đăng nhập Google thành công! Đang chuyển hướng...', false);
    const loginFormEl = document.getElementById('login-form');
    if (loginFormEl) loginFormEl.style.display = 'none';
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1500);
    window.history.replaceState({}, document.title, window.location.pathname);
  } else if (e) {
    showLoginMessage(`❌ Lỗi Google: ${decodeURIComponent(e)}`, true);
    window.history.replaceState({}, document.title, window.location.pathname);
  }

});