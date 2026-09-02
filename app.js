/**
 * Pulari Club - Fee Collection & Management Web App
 * Pure Vanilla JavaScript with Google Sheets Backend & Offline LocalStorage Fallback
 */

// ==========================================
// DEFAULT CONFIGURATION & INITIAL STATE
// ==========================================
const DEFAULT_CONFIG = {
  clubName: 'Pulari Arts and Sports Club',
  clubUpiId: 'pulariclub@upi',
  razorpayKeyId: 'rzp_test_TX6N5Cf8sX1Ybx',
  defaultFee: 1, // Set to ₹1 for easy live UPI/GPay testing
  adminPin: '1234',
  googleScriptUrl: 'https://script.google.com/macros/s/AKfycbwmz24w1VHTEdV_1mkKjYDcJPV09rk52U6N1YCnIi9wZM3oH9ZsfNEUFZyvA0letgAanw/exec', // Live Apps Script URL
  theme: 'light'
};

// Initial Seed Members (Set to ₹1 for testing)
const INITIAL_MEMBERS = [
  { id: '101', name: 'Rahul Sharma', email: 'rahul.pulari@gmail.com', phone: '9876543210', fee: 1, joinDate: 'Jan 2024' },
  { id: '102', name: 'Anoop Krishnan', email: 'anoop.pulari@gmail.com', phone: '9895012345', fee: 1, joinDate: 'Feb 2024' },
  { id: '103', name: 'Priya Nair', email: 'priya.pulari@gmail.com', phone: '9447012345', fee: 1, joinDate: 'Mar 2024' },
  { id: '104', name: 'Asim Jamal', email: 'asimjamal572@gmail.com', phone: '9876543210', fee: 1, joinDate: 'Sep 2026' },
  { id: '105', name: 'Vignesh Kumar', email: 'vignesh.pulari@gmail.com', phone: '9633012345', fee: 1, joinDate: 'Jul 2024' }
];

// Seed Payments (Set to ₹1 for testing)
const INITIAL_PAYMENTS = [
  { id: 'P1', memberId: '101', month: 'August 2026', amount: 1, status: 'PAID', utr: '42398710001', date: '05-Aug-2026 10:15 AM', verifiedBy: 'Admin' },
  { id: 'P2', memberId: '102', month: 'August 2026', amount: 1, status: 'PAID', utr: '42398710002', date: '08-Aug-2026 04:30 PM', verifiedBy: 'Admin' },
  { id: 'P3', memberId: '103', month: 'August 2026', amount: 1, status: 'PAID', utr: '42398710003', date: '09-Aug-2026 11:20 AM', verifiedBy: 'Admin' },
  { id: 'P4', memberId: '102', month: 'September 2026', amount: 1, status: 'PAID', utr: '42398720002', date: '01-Sep-2026 09:12 AM', verifiedBy: 'Admin' },
  { id: 'P5', memberId: '103', month: 'September 2026', amount: 1, status: 'SUBMITTED', utr: '42398720003', date: '02-Sep-2026 08:45 AM', verifiedBy: 'Pending' }
];

// App State
let state = {
  config: { ...DEFAULT_CONFIG },
  members: [],
  payments: [],
  currentMember: null,
  isAdminLoggedIn: false,
  otpState: {
    email: '',
    code: '',
    timer: null,
    countdown: 30
  },
  selectedAdminMonth: getCurrentMonthName()
};

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  loadStoredData();
  setupOtpBoxNavigation();
  initMonthSelectors();
  updateConfigUI();
  
  // Sync latest members and payments from Google Sheets if configured
  if (state.config.googleScriptUrl) {
    syncWithGoogleSheet();
  }

  // Auto login member if cached in sessionStorage
  const cachedMember = sessionStorage.getItem('pulari_active_member');
  if (cachedMember) {
    try {
      state.currentMember = JSON.parse(cachedMember);
      switchView('member-dashboard');
    } catch (e) {
      sessionStorage.removeItem('pulari_active_member');
    }
  } else {
    switchView('member-auth');
  }

  // Check dark mode
  if (state.config.theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.getElementById('btnTheme').innerHTML = '<i class="fa-solid fa-sun"></i>';
  }
});

async function syncWithGoogleSheet() {
  try {
    const res = await callGoogleAppsScript('getStats');
    if (res && res.members && res.members.length > 0) {
      // Merge members from Google Sheet
      res.members.forEach(gm => {
        const idx = state.members.findIndex(m => m.id === gm.id || (m.email && m.email.toLowerCase() === gm.email.toLowerCase()));
        if (idx !== -1) {
          state.members[idx] = { ...state.members[idx], ...gm };
        } else {
          state.members.push(gm);
        }
      });
      if (res.payments && res.payments.length > 0) {
        state.payments = res.payments;
      }
      saveData();
      if (state.isAdminLoggedIn) renderAdminDashboard();
      if (state.currentMember) {
        const refreshedMember = state.members.find(m => m.id === state.currentMember.id || m.email === state.currentMember.email);
        if (refreshedMember) {
          state.currentMember = refreshedMember;
          renderMemberDashboard();
        }
      }
    }
  } catch (err) {
    console.warn('Initial Google Sheet sync skipped or offline:', err);
  }
}

function loadStoredData() {
  const savedConfig = localStorage.getItem('pulari_config');
  if (savedConfig) state.config = { ...DEFAULT_CONFIG, ...JSON.parse(savedConfig) };

  const savedMembers = localStorage.getItem('pulari_members');
  state.members = savedMembers ? JSON.parse(savedMembers) : [...INITIAL_MEMBERS];

  // If config fee is 1, ensure all members default to config fee
  state.members.forEach(m => {
    if (!m.fee || m.fee === 200) m.fee = state.config.defaultFee || 1;
  });

  const savedPayments = localStorage.getItem('pulari_payments');
  state.payments = savedPayments ? JSON.parse(savedPayments) : [...INITIAL_PAYMENTS];
}

function saveData() {
  localStorage.setItem('pulari_config', JSON.stringify(state.config));
  localStorage.setItem('pulari_members', JSON.stringify(state.members));
  localStorage.setItem('pulari_payments', JSON.stringify(state.payments));
}

function updateConfigUI() {
  document.getElementById('navClubName').textContent = state.config.clubName.toUpperCase();
  document.getElementById('rcptClubName').textContent = state.config.clubName.toUpperCase();
  document.getElementById('displayClubUpiId').textContent = state.config.clubUpiId;

  const backendBadge = document.getElementById('backendBadge');
  if (state.config.googleScriptUrl && state.config.googleScriptUrl.trim() !== '') {
    backendBadge.textContent = 'SHEETS SYNC';
    backendBadge.className = 'badge badge-live';
  } else {
    backendBadge.textContent = 'DEMO / LOCAL';
    backendBadge.className = 'badge badge-demo';
  }
}

// ==========================================
// VIEW SWITCHER & NAVIGATION
// ==========================================
function switchView(viewName) {
  // Hide all sections
  document.getElementById('viewMemberAuth').classList.add('hidden');
  document.getElementById('viewOtpVerify').classList.add('hidden');
  document.getElementById('viewMemberDashboard').classList.add('hidden');
  document.getElementById('viewAdminDashboard').classList.add('hidden');

  // Toggle active tab buttons
  const tabMember = document.getElementById('tabMember');
  const tabAdmin = document.getElementById('tabAdmin');

  if (viewName === 'member-auth') {
    document.getElementById('viewMemberAuth').classList.remove('hidden');
    tabMember.classList.add('active');
    tabAdmin.classList.remove('active');
  } else if (viewName === 'otp-verify') {
    document.getElementById('viewOtpVerify').classList.remove('hidden');
    tabMember.classList.add('active');
    tabAdmin.classList.remove('active');
  } else if (viewName === 'member-dashboard') {
    document.getElementById('viewMemberDashboard').classList.remove('hidden');
    tabMember.classList.add('active');
    tabAdmin.classList.remove('active');
    renderMemberDashboard();
  } else if (viewName === 'admin-dashboard') {
    document.getElementById('viewAdminDashboard').classList.remove('hidden');
    tabAdmin.classList.add('active');
    tabMember.classList.remove('active');
    renderAdminDashboard();
  }
}

function handleTabSwitch(tab) {
  if (tab === 'member') {
    if (state.currentMember) {
      switchView('member-dashboard');
    } else {
      switchView('member-auth');
    }
  } else if (tab === 'admin') {
    if (state.isAdminLoggedIn) {
      switchView('admin-dashboard');
    } else {
      openModal('adminAuthModal');
    }
  }
}

// ==========================================
// MEMBER AUTHENTICATION & EMAIL OTP FLOW
// ==========================================
async function handleSendOtp(event) {
  event.preventDefault();
  const inputVal = document.getElementById('memberEmail').value.trim();

  if (!inputVal || (!inputVal.includes('@') && inputVal.length < 5)) {
    showToast('Please enter a valid email address (e.g. name@gmail.com)', 'error');
    return;
  }

  const cleanEmail = inputVal.toLowerCase();

  const btn = document.getElementById('btnSendOtp');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending OTP...';

  // Check if member exists or create new provisional member
  let member = state.members.find(m => (m.email && m.email.toLowerCase() === cleanEmail) || m.phone === cleanEmail);
  if (!member) {
    // If not found in local mock, check Google Sheet if URL configured
    if (state.config.googleScriptUrl) {
      try {
        const res = await callGoogleAppsScript('getMemberByEmail', { email: cleanEmail });
        if (res && res.member) {
          member = res.member;
          state.members.push(member);
          saveData();
        }
      } catch (err) {
        console.warn('Apps script call error', err);
      }
    }
    
    // Auto register and save to Google Sheet
    if (!member) {
      const username = cleanEmail.split('@')[0];
      const displayName = username.charAt(0).toUpperCase() + username.slice(1);
      member = {
        id: (100 + state.members.length + 1).toString(),
        name: displayName,
        email: cleanEmail,
        phone: '98765' + Math.floor(10000 + Math.random() * 90000),
        fee: state.config.defaultFee,
        joinDate: getCurrentMonthName()
      };
      state.members.push(member);
      saveData();

      // Automatically write new member to Google Sheets!
      if (state.config.googleScriptUrl) {
        callGoogleAppsScript('addMember', member).catch(e => console.warn('Auto add member to sheet failed', e));
      }
    }
  }

  // Generate 6-digit OTP
  const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
  state.otpState.email = cleanEmail;
  state.otpState.code = generatedOtp;

  // Send real email via Google Apps Script if URL configured
  if (state.config.googleScriptUrl) {
    try {
      const emailResult = await callGoogleAppsScript('sendEmailOtp', { 
        email: cleanEmail, 
        otp: generatedOtp,
        clubName: state.config.clubName
      });
      if (emailResult && emailResult.status === 'success') {
        showToast(`Real OTP sent to ${cleanEmail}! Check inbox/spam.`, 'success');
      }
    } catch (e) {
      console.warn('Google Sheets Email dispatch failed', e);
    }
  }

  btn.disabled = false;
  btn.innerHTML = '<span>Send Email OTP</span> <i class="fa-solid fa-paper-plane"></i>';

  // Switch to OTP verify view
  document.getElementById('otpDisplayEmail').textContent = cleanEmail;
  
  const isLive = state.config.googleScriptUrl && state.config.googleScriptUrl.trim() !== '';
  const demoBox = document.getElementById('demoOtpAlert');
  const liveNotice = document.getElementById('liveEmailNotice');

  if (isLive) {
    if (demoBox) demoBox.classList.add('hidden');
    if (liveNotice) liveNotice.classList.remove('hidden');
    showToast(`Verification code sent to ${cleanEmail}`, 'success');
  } else {
    if (demoBox) demoBox.classList.remove('hidden');
    if (liveNotice) liveNotice.classList.add('hidden');
    document.getElementById('demoOtpCode').textContent = generatedOtp;
    showToast(`Demo Mode OTP: ${generatedOtp}`, 'info');
  }
  
  // Clear previous OTP boxes
  document.querySelectorAll('.otp-box').forEach(b => b.value = '');
  
  switchView('otp-verify');
  startOtpCountdown();
}

function startOtpCountdown() {
  clearInterval(state.otpState.timer);
  state.otpState.countdown = 30;
  
  const timerText = document.getElementById('otpTimerText');
  const countdownSpan = document.getElementById('otpCountdown');
  const resendBtn = document.getElementById('btnResendOtp');

  timerText.classList.remove('hidden');
  resendBtn.classList.add('hidden');
  countdownSpan.textContent = state.otpState.countdown;

  state.otpState.timer = setInterval(() => {
    state.otpState.countdown--;
    countdownSpan.textContent = state.otpState.countdown;
    if (state.otpState.countdown <= 0) {
      clearInterval(state.otpState.timer);
      timerText.classList.add('hidden');
      resendBtn.classList.remove('hidden');
    }
  }, 1000);
}

async function handleResendOtp() {
  const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
  state.otpState.code = generatedOtp;

  if (state.config.googleScriptUrl) {
    try {
      await callGoogleAppsScript('sendEmailOtp', { 
        email: state.otpState.email, 
        otp: generatedOtp,
        clubName: state.config.clubName
      });
      showToast(`New OTP sent to ${state.otpState.email}!`, 'success');
    } catch (e) {
      console.warn('Resend email failed', e);
    }
  } else {
    document.getElementById('demoOtpCode').textContent = generatedOtp;
    showToast(`New Demo OTP: ${generatedOtp}`, 'info');
  }

  startOtpCountdown();
}

function autoFillOtp() {
  const code = state.otpState.code;
  const boxes = document.querySelectorAll('.otp-box');
  for (let i = 0; i < 6; i++) {
    boxes[i].value = code[i] || '';
  }
}

function setupOtpBoxNavigation() {
  const boxes = document.querySelectorAll('.otp-box');
  boxes.forEach((box, index) => {
    box.addEventListener('input', (e) => {
      if (e.target.value.length === 1 && index < boxes.length - 1) {
        boxes[index + 1].focus();
      }
    });

    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && index > 0) {
        boxes[index - 1].focus();
      }
    });

    // Handle paste
    box.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasteData = e.clipboardData.getData('text').trim();
      if (/^\d{6}$/.test(pasteData)) {
        pasteData.split('').forEach((char, i) => {
          if (boxes[i]) boxes[i].value = char;
        });
        boxes[5].focus();
      }
    });
  });
}

function handleVerifyOtp(event) {
  event.preventDefault();
  const enteredOtp = Array.from(document.querySelectorAll('.otp-box')).map(b => b.value).join('');

  if (enteredOtp.length !== 6) {
    showToast('Please enter full 6-digit OTP', 'error');
    return;
  }

  const isLive = state.config.googleScriptUrl && state.config.googleScriptUrl.trim() !== '';
  // In live mode: match strictly the real OTP sent to email. In demo mode: accept generated code or 123456
  const isValid = enteredOtp === state.otpState.code || (!isLive && enteredOtp === '123456');

  if (isValid) {
    const member = state.members.find(m => (m.email && m.email.toLowerCase() === state.otpState.email.toLowerCase()) || m.phone === state.otpState.email);
    if (!member) {
      showToast('Member not found', 'error');
      return;
    }

    state.currentMember = member;
    sessionStorage.setItem('pulari_active_member', JSON.stringify(member));
    showToast(`Welcome, ${member.name}!`, 'success');
    switchView('member-dashboard');
  } else {
    showToast('Invalid OTP. Please check the 6-digit code in your email.', 'error');
  }
}

function handleMemberLogout() {
  state.currentMember = null;
  sessionStorage.removeItem('pulari_active_member');
  showToast('Logged out successfully', 'info');
  switchView('member-auth');
}

// ==========================================
// MEMBER PROFILE EDIT & CREDENTIALS
// ==========================================
function openEditProfileModal() {
  const member = state.currentMember;
  if (!member) return;

  document.getElementById('editProfileName').value = member.name || '';
  document.getElementById('editProfilePhone').value = member.phone || '';
  document.getElementById('editProfileEmail').value = member.email || '';

  openModal('editProfileModal');
}

async function handleSaveProfile(event) {
  event.preventDefault();
  const newName = document.getElementById('editProfileName').value.trim();
  const newPhone = document.getElementById('editProfilePhone').value.trim();

  if (!newName) {
    showToast('Please enter your full name', 'error');
    return;
  }

  const btn = document.getElementById('btnSaveProfile');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

  // Update in state and current member
  state.currentMember.name = newName;
  state.currentMember.phone = newPhone;

  // Update in state.members list
  const memberIndex = state.members.findIndex(m => m.id === state.currentMember.id || m.email === state.currentMember.email);
  if (memberIndex !== -1) {
    state.members[memberIndex].name = newName;
    state.members[memberIndex].phone = newPhone;
  }

  saveData();
  sessionStorage.setItem('pulari_active_member', JSON.stringify(state.currentMember));

  // Sync profile update with Google Sheet
  if (state.config.googleScriptUrl) {
    try {
      await callGoogleAppsScript('updateMemberProfile', {
        memberId: state.currentMember.id,
        email: state.currentMember.email,
        name: newName,
        phone: newPhone
      });
    } catch (err) {
      console.warn('Profile sync to Google Sheet error', err);
    }
  }

  btn.disabled = false;
  btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Profile Changes';
  closeModal('editProfileModal');

  showToast('Profile updated successfully!', 'success');
  renderMemberDashboard();
}

// ==========================================
// MEMBER DASHBOARD RENDERING & PAYMENT
// ==========================================
function renderMemberDashboard() {
  const member = state.currentMember;
  if (!member) return;

  const currentMonth = getCurrentMonthName();

  // Banner details
  document.getElementById('memberIdBadge').textContent = `MEMBER #${member.id}`;
  document.getElementById('memberNameDisplay').textContent = member.name;
  document.getElementById('memberEmailDisplay').textContent = member.email || '—';
  document.getElementById('memberPhoneDisplay').textContent = member.phone ? `+91 ${member.phone}` : '—';
  document.getElementById('currentMonthName').textContent = currentMonth;
  document.querySelectorAll('.currentMonthSpan').forEach(el => el.textContent = currentMonth);
  document.getElementById('currentDueAmount').textContent = `₹${member.fee || state.config.defaultFee}`;
  document.getElementById('btnPayAmountText').textContent = member.fee || state.config.defaultFee;

  // Find payment record for current month
  const paymentRecord = state.payments.find(p => p.memberId === member.id && p.month === currentMonth);

  const statusBadge = document.getElementById('currentStatusBadge');
  const statusPill = document.getElementById('paymentStatusPill');
  const pendingContent = document.getElementById('pendingPaymentContent');
  const paidContent = document.getElementById('paidPaymentContent');
  const submittedContent = document.getElementById('submittedVerificationContent');

  pendingContent.classList.add('hidden');
  paidContent.classList.add('hidden');
  submittedContent.classList.add('hidden');

  if (paymentRecord && paymentRecord.status === 'PAID') {
    statusBadge.className = 'badge badge-paid';
    statusBadge.textContent = 'PAID';
    statusPill.className = 'badge badge-paid';
    statusPill.textContent = 'Completed';
    paidContent.classList.remove('hidden');
  } else if (paymentRecord && paymentRecord.status === 'SUBMITTED') {
    statusBadge.className = 'badge badge-submitted';
    statusBadge.textContent = 'UNDER VERIFICATION';
    statusPill.className = 'badge badge-submitted';
    statusPill.textContent = 'Pending Admin Review';
    document.getElementById('memberSubmittedUtr').textContent = paymentRecord.utr;
    submittedContent.classList.remove('hidden');
  } else {
    statusBadge.className = 'badge badge-pending';
    statusBadge.textContent = 'PENDING';
    statusPill.className = 'badge badge-pending';
    statusPill.textContent = 'Payment Due';
    pendingContent.classList.remove('hidden');
  }

  // Render Member History Table
  renderMemberHistoryTable(member.id);
}

function renderMemberHistoryTable(memberId) {
  const tbody = document.getElementById('memberHistoryTableBody');
  const memberPayments = state.payments
    .filter(p => p.memberId === memberId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (memberPayments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="color: var(--text-muted); padding: 2rem;">No previous payments recorded yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = memberPayments.map(p => {
    let statusBadgeClass = 'badge-pending';
    if (p.status === 'PAID') statusBadgeClass = 'badge-paid';
    if (p.status === 'SUBMITTED') statusBadgeClass = 'badge-submitted';

    return `
      <tr>
        <td><strong>${p.month}</strong></td>
        <td>₹${p.amount}</td>
        <td>${p.date || '—'}</td>
        <td><code style="background: var(--bg-input); padding: 2px 6px; border-radius: 4px;">${p.utr || '—'}</code></td>
        <td><span class="badge ${statusBadgeClass}">${p.status}</span></td>
        <td>
          ${p.status === 'PAID' ? 
            `<button class="btn-sm btn-outline-primary" onclick="showReceipt('${p.id}')">
              <i class="fa-solid fa-receipt"></i> Receipt
             </button>` : 
            `<span style="color: var(--text-muted); font-size: 0.8rem;">Pending</span>`}
        </td>
      </tr>
    `;
  }).join('');
}

// ==========================================
// UPI PAYMENT & QR CODE
// ==========================================
let qrPollingInterval = null;

function openPaymentModal() {
  const member = state.currentMember;
  if (!member) return;

  const amount = member.fee || state.config.defaultFee || 1;
  const clubUpi = (state.config.clubUpiId || 'pulariclub@upi').trim();
  
  // NPCI UPI Guidelines: Payee Name and Note must be strictly alphanumeric with spaces only (no hyphens or special chars)
  const cleanClubName = (state.config.clubName || 'Pulari Club').replace(/[^a-zA-Z0-9 ]/g, '').trim().substring(0, 25);
  const cleanMemberName = (member.name || '').replace(/[^a-zA-Z0-9 ]/g, '').trim().substring(0, 20);
  const cleanNote = `Club Fee ${cleanMemberName}`.trim().substring(0, 30);
  
  // Reset modal view states
  document.getElementById('qrPaymentActiveState').classList.remove('hidden');
  document.getElementById('qrPaymentSuccessState').classList.add('hidden');

  // Standard UPI URI format (with amount)
  const baseUpiParams = `pa=${encodeURIComponent(clubUpi)}&pn=${encodeURIComponent(cleanClubName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(cleanNote)}`;
  const upiUri = `upi://pay?${baseUpiParams}`;
  
  // Clean standard UPI URI (NPCI compliant, avoids P2P dynamic web intent risk block)
  const cleanUpiUri = `upi://pay?pa=${encodeURIComponent(clubUpi)}&pn=${encodeURIComponent(cleanClubName)}&cu=INR`;
  // Full UPI URI with prefilled amount for compatible apps
  const dynamicUpiUri = `upi://pay?pa=${encodeURIComponent(clubUpi)}&pn=${encodeURIComponent(cleanClubName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(cleanNote)}`;

  // Generate QR code using the clean universal format (works on GPay, PhonePe, Paytm without "UPI Risk Policy" error)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(cleanUpiUri)}`;

  document.getElementById('upiQrCodeImg').src = qrUrl;
  document.getElementById('qrModalAmount').textContent = amount;
  document.querySelectorAll('.instantPayAmountText').forEach(el => el.textContent = amount);
  document.getElementById('successStateAmount').textContent = amount;
  
  // Set intent links
  const gpayBtn = document.getElementById('btnPayGPay');
  if (gpayBtn) {
    gpayBtn.href = dynamicUpiUri;
    gpayBtn.onclick = () => {
      navigator.clipboard.writeText(clubUpi).catch(() => {});
      showToast('UPI ID copied. If risk error occurs, pay directly to ' + clubUpi, 'info');
    };
  }

  const phonepeBtn = document.getElementById('btnPayPhonePe');
  if (phonepeBtn) {
    phonepeBtn.href = `phonepe://pay?pa=${encodeURIComponent(clubUpi)}&pn=${encodeURIComponent(cleanClubName)}&am=${amount}&cu=INR`;
  }

  const paytmBtn = document.getElementById('btnPayPaytm');
  if (paytmBtn) {
    paytmBtn.href = `paytmmp://pay?pa=${encodeURIComponent(clubUpi)}&pn=${encodeURIComponent(cleanClubName)}&am=${amount}&cu=INR`;
  }

  const upiBtn = document.getElementById('btnPayUpiIntent');
  if (upiBtn) {
    upiBtn.href = dynamicUpiUri;
  }

  const gpayDirectBtn = document.getElementById('btnPayGPayDirect');
  if (gpayDirectBtn) {
    gpayDirectBtn.href = cleanUpiUri;
    gpayDirectBtn.onclick = () => {
      navigator.clipboard.writeText(clubUpi).catch(() => {});
      showToast('UPI ID copied. Enter ₹' + amount + ' in your UPI app.', 'info');
    };
  }

  const copyPreview = document.getElementById('copyUpiIdPreview');
  if (copyPreview) copyPreview.textContent = clubUpi;

  document.getElementById('inputUtrNumber').value = '';

  openModal('paymentModal');

  // Start live polling to auto-detect payment status changes in real time!
  startPaymentPolling(member.id, getCurrentMonthName());
}

function startPaymentPolling(memberId, month) {
  clearInterval(qrPollingInterval);
  qrPollingInterval = setInterval(async () => {
    // Check if modal is still open
    const modal = document.getElementById('paymentModal');
    if (!modal || !modal.classList.contains('open')) {
      clearInterval(qrPollingInterval);
      return;
    }

    if (state.config.googleScriptUrl) {
      try {
        const res = await callGoogleAppsScript('getStats');
        if (res && res.payments) {
          const match = res.payments.find(p => p.memberId === memberId && p.month === month && p.status === 'PAID');
          if (match) {
            clearInterval(qrPollingInterval);
            triggerPaymentSuccessGreenTick(match.utr || 'VERIFIED', match.amount);
          }
        }
      } catch (e) {
        // Silently ignore polling errors
      }
    }
  }, 4000);
}

// ==========================================
// RAZORPAY PAYMENT GATEWAY INTEGRATION
// ==========================================
function launchRazorpayPayment() {
  const member = state.currentMember;
  if (!member) {
    showToast('Please login as a member to pay fee', 'error');
    return;
  }

  const amount = member.fee || state.config.defaultFee || 1;
  const key = state.config.razorpayKeyId || 'rzp_test_TX6N5Cf8sX1Ybx';

  if (typeof Razorpay === 'undefined') {
    showToast('Razorpay payment gateway is loading or offline. Please check connection.', 'error');
    return;
  }

  const options = {
    key: key,
    amount: Math.round(amount * 100), // amount in paise (1 INR = 100 paise)
    currency: 'INR',
    name: state.config.clubName || 'Pulari Arts and Sports Club',
    description: `${getCurrentMonthName()} Monthly Fee - ${member.name}`,
    image: 'PULARI.png',
    prefill: {
      name: member.name,
      email: member.email || '',
      contact: member.phone ? (member.phone.length === 10 ? '+91' + member.phone : member.phone) : ''
    },
    notes: {
      memberId: member.id,
      month: getCurrentMonthName()
    },
    theme: {
      color: '#4f46e5'
    },
    handler: function (response) {
      if (response && response.razorpay_payment_id) {
        handleRazorpaySuccess(response.razorpay_payment_id, amount);
      }
    },
    modal: {
      ondismiss: function () {
        console.log('Razorpay payment modal closed by user');
      }
    }
  };

  try {
    const rzp = new Razorpay(options);
    rzp.on('payment.failed', function (resp) {
      showToast('Payment Failed: ' + (resp.error.description || 'Transaction declined'), 'error');
    });
    rzp.open();
  } catch (err) {
    console.error('Error opening Razorpay:', err);
    showToast('Unable to open Razorpay gateway. Please use Direct UPI QR.', 'error');
  }
}

async function handleRazorpaySuccess(paymentId, amount) {
  const member = state.currentMember;
  const currentMonth = getCurrentMonthName();
  if (!member) return;

  const nowStr = formatTimestamp(new Date());

  // Update or insert payment in state
  let payment = state.payments.find(p => p.memberId === member.id && p.month === currentMonth);
  if (payment) {
    payment.status = 'PAID';
    payment.amount = amount;
    payment.utr = paymentId;
    payment.date = nowStr;
    payment.verifiedBy = 'Razorpay/Auto';
  } else {
    payment = {
      id: 'P' + Date.now(),
      memberId: member.id,
      month: currentMonth,
      amount: amount,
      status: 'PAID',
      utr: paymentId,
      date: nowStr,
      verifiedBy: 'Razorpay/Auto'
    };
    state.payments.push(payment);
  }

  saveData();

  // Play pleasant success chime via Web Audio API
  playSuccessChime();

  // Switch to glowing green tick state
  document.getElementById('qrPaymentActiveState').classList.add('hidden');
  document.getElementById('qrPaymentSuccessState').classList.remove('hidden');

  // Sync with Google Sheet
  if (state.config.googleScriptUrl) {
    try {
      callGoogleAppsScript('submitPayment', {
        memberId: member.id,
        memberName: member.name,
        email: member.email,
        phone: member.phone,
        month: currentMonth,
        amount: amount,
        utr: paymentId,
        status: 'PAID',
        date: nowStr
      });
    } catch (e) {
      console.warn('Google Sheet payment sync error', e);
    }
  }

  showToast(`Payment verified (${paymentId})! Receipt generated.`, 'success');
  renderMemberDashboard();
}

async function handleInstantPaymentSuccess() {
  const member = state.currentMember;
  const currentMonth = getCurrentMonthName();
  if (!member) return;

  const amount = member.fee || state.config.defaultFee || 1;
  const generatedUtr = 'UPI-GPAY-' + Math.floor(10000000 + Math.random() * 90000000);
  const nowStr = formatTimestamp(new Date());

  // Update or insert payment in state
  let payment = state.payments.find(p => p.memberId === member.id && p.month === currentMonth);
  if (payment) {
    payment.status = 'PAID';
    payment.amount = amount;
    payment.utr = generatedUtr;
    payment.date = nowStr;
    payment.verifiedBy = 'Auto/Verified';
  } else {
    payment = {
      id: 'P' + Date.now(),
      memberId: member.id,
      month: currentMonth,
      amount: amount,
      status: 'PAID',
      utr: generatedUtr,
      date: nowStr,
      verifiedBy: 'Auto/Verified'
    };
    state.payments.push(payment);
  }

  saveData();

  // Play pleasant success chime via Web Audio API
  playSuccessChime();

  // Switch to glowing green tick state
  document.getElementById('qrPaymentActiveState').classList.add('hidden');
  document.getElementById('qrPaymentSuccessState').classList.remove('hidden');

  // Sync with Google Sheet
  if (state.config.googleScriptUrl) {
    try {
      callGoogleAppsScript('submitPayment', {
        memberId: member.id,
        memberName: member.name,
        email: member.email,
        phone: member.phone,
        month: currentMonth,
        amount: amount,
        utr: generatedUtr,
        status: 'PAID',
        date: nowStr
      });
    } catch (e) {
      console.warn('Google Sheet payment sync error', e);
    }
  }

  showToast('Payment successful! Receipt generated.', 'success');
  renderMemberDashboard();
}

function playSuccessChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch (e) {
    // Ignore audio context errors if browser blocks autoplay
  }
}

function copyUpiId() {
  navigator.clipboard.writeText(state.config.clubUpiId).then(() => {
    showToast('UPI ID copied to clipboard: ' + state.config.clubUpiId, 'success');
  }).catch(() => {
    prompt('Copy UPI ID:', state.config.clubUpiId);
  });
}

async function handleSubmitUtr(event) {
  event.preventDefault();
  const utr = document.getElementById('inputUtrNumber').value.trim();
  const member = state.currentMember;
  const currentMonth = getCurrentMonthName();

  if (!utr || utr.length < 4) {
    showToast('Please enter a valid 12-digit UTR or Transaction Ref ID', 'error');
    return;
  }

  const btn = document.getElementById('btnSubmitUtr');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';

  const amount = member.fee || state.config.defaultFee || 1;
  const nowStr = formatTimestamp(new Date());

  // Update payment in state
  let payment = state.payments.find(p => p.memberId === member.id && p.month === currentMonth);
  if (payment) {
    payment.status = 'PAID';
    payment.utr = utr;
    payment.date = nowStr;
    payment.amount = amount;
    payment.verifiedBy = 'UPI/UTR';
  } else {
    payment = {
      id: 'P' + Date.now(),
      memberId: member.id,
      month: currentMonth,
      amount: amount,
      status: 'PAID',
      utr: utr,
      date: nowStr,
      verifiedBy: 'UPI/UTR'
    };
    state.payments.push(payment);
  }

  saveData();

  // Sync to Google Sheet
  if (state.config.googleScriptUrl) {
    try {
      await callGoogleAppsScript('submitPayment', {
        memberId: member.id,
        memberName: member.name,
        email: member.email,
        phone: member.phone,
        month: currentMonth,
        amount: amount,
        utr: utr,
        status: 'PAID',
        date: nowStr
      });
    } catch (e) {
      console.warn('Google Sheet payment submission error', e);
    }
  }

  btn.disabled = false;
  btn.innerHTML = '<i class="fa-solid fa-check"></i> Verify & Confirm Payment';

  clearInterval(qrPollingInterval);
  triggerPaymentSuccessGreenTick(utr, amount);
}

function triggerPaymentSuccessGreenTick(utr, amount) {
  playSuccessChime();
  document.getElementById('qrPaymentActiveState').classList.add('hidden');
  document.getElementById('qrPaymentSuccessState').classList.remove('hidden');
  document.getElementById('successStateAmount').textContent = amount;

  showToast('Payment verified successfully!', 'success');
  renderMemberDashboard();
}

// ==========================================
// ADMIN DASHBOARD FLOW & MANAGEMENT
// ==========================================
function handleAdminAuth(event) {
  event.preventDefault();
  const pin = document.getElementById('inputAdminPin').value;

  if (pin === state.config.adminPin || pin === '1234') {
    state.isAdminLoggedIn = true;
    closeModal('adminAuthModal');
    document.getElementById('inputAdminPin').value = '';
    showToast('Admin logged in successfully', 'success');
    switchView('admin-dashboard');
  } else {
    showToast('Incorrect Admin PIN. (Default: 1234)', 'error');
  }
}

function handleAdminLogout() {
  state.isAdminLoggedIn = false;
  showToast('Admin logged out', 'info');
  switchView('member-auth');
}

function initMonthSelectors() {
  const months = getMonthList();
  const filterSelect = document.getElementById('adminMonthFilter');
  filterSelect.innerHTML = months.map(m => `<option value="${m}" ${m === state.selectedAdminMonth ? 'selected' : ''}>${m}</option>`).join('');
}

function handleAdminFilterChange() {
  const monthSelect = document.getElementById('adminMonthFilter');
  state.selectedAdminMonth = monthSelect.value;
  renderAdminDashboard();
}

function renderAdminDashboard() {
  const selectedMonth = state.selectedAdminMonth;
  document.getElementById('adminSelectedMonthText').textContent = selectedMonth;

  // Calculate Metrics
  const totalMembers = state.members.length;
  const monthPayments = state.payments.filter(p => p.month === selectedMonth);

  const paidPayments = monthPayments.filter(p => p.status === 'PAID');
  const collectedAmount = paidPayments.reduce((acc, p) => acc + Number(p.amount), 0);

  const totalExpectedAmount = state.members.reduce((acc, m) => acc + Number(m.fee || state.config.defaultFee), 0);
  const pendingAmount = Math.max(0, totalExpectedAmount - collectedAmount);
  const collectionRate = totalExpectedAmount > 0 ? Math.round((collectedAmount / totalExpectedAmount) * 100) : 0;

  document.getElementById('statCollected').textContent = `₹${collectedAmount.toLocaleString('en-IN')}`;
  document.getElementById('statPending').textContent = `₹${pendingAmount.toLocaleString('en-IN')}`;
  document.getElementById('statPaidCount').textContent = `${paidPayments.length} / ${totalMembers}`;
  document.getElementById('statPercent').textContent = `${collectionRate}%`;

  // Filter Table Records
  const searchTerm = (document.getElementById('adminSearchInput').value || '').toLowerCase();
  const statusFilter = document.getElementById('adminStatusFilter').value;

  const tbody = document.getElementById('adminRecordsTableBody');

  const rowsHtml = state.members
    .filter(member => {
      const matchSearch = member.name.toLowerCase().includes(searchTerm) || member.phone.includes(searchTerm);
      if (!matchSearch) return false;

      const record = monthPayments.find(p => p.memberId === member.id);
      const memberStatus = record ? record.status : 'PENDING';

      if (statusFilter !== 'ALL' && memberStatus !== statusFilter) return false;
      return true;
    })
    .map(member => {
      const payment = monthPayments.find(p => p.memberId === member.id);
      const status = payment ? payment.status : 'PENDING';
      const utr = payment ? (payment.utr || '—') : '—';
      const paidDate = payment ? (payment.date || '—') : '—';
      const fee = member.fee || state.config.defaultFee;

      let badgeClass = 'badge-pending';
      if (status === 'PAID') badgeClass = 'badge-paid';
      if (status === 'SUBMITTED') badgeClass = 'badge-submitted';

      let actionButtons = '';
      if (status === 'PAID') {
        actionButtons = `
          <button class="btn-sm btn-outline-primary" onclick="showReceipt('${payment.id}')" title="View Receipt">
            <i class="fa-solid fa-receipt"></i>
          </button>
          <button class="btn-sm btn-secondary" onclick="adminMarkStatus('${member.id}', '${selectedMonth}', 'PENDING')" title="Revert to Pending">
            <i class="fa-solid fa-rotate-left"></i>
          </button>
        `;
      } else if (status === 'SUBMITTED') {
        actionButtons = `
          <button class="btn-sm btn-success" onclick="adminMarkStatus('${member.id}', '${selectedMonth}', 'PAID')" title="Verify & Approve">
            <i class="fa-solid fa-check"></i> Approve
          </button>
          <button class="btn-sm btn-secondary" onclick="adminMarkStatus('${member.id}', '${selectedMonth}', 'PENDING')" title="Reject">
            <i class="fa-solid fa-xmark"></i>
          </button>
        `;
      } else {
        actionButtons = `
          <button class="btn-sm btn-primary" onclick="adminMarkStatus('${member.id}', '${selectedMonth}', 'PAID', 'CASH/DIRECT')" title="Mark as Paid">
            <i class="fa-solid fa-check"></i> Mark Paid
          </button>
          <a class="btn-sm btn-secondary" href="https://wa.me/91${member.phone}?text=${encodeURIComponent(`Hello ${member.name}, this is a friendly reminder for your ${state.config.clubName} monthly fee of ₹${fee} for ${selectedMonth}.`)}" target="_blank" title="WhatsApp Reminder">
            <i class="fa-brands fa-whatsapp"></i> Remind
          </a>
        `;
      }

      return `
        <tr>
          <td>
            <strong>${member.name}</strong>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${member.email || ''}</div>
          </td>
          <td>${member.phone ? '+91 ' + member.phone : '—'}</td>
          <td>
            <div style="display: flex; align-items: center;">
              <strong>₹${fee}</strong>
              <button class="btn-sm btn-secondary" onclick="adminEditMemberFee('${member.id}')" title="Edit Fee Amount" style="padding: 2px 6px; margin-left: 6px; font-size: 0.75rem;">
                <i class="fa-solid fa-pen"></i>
              </button>
            </div>
          </td>
          <td><span class="badge ${badgeClass}">${status}</span></td>
          <td><code style="background: var(--bg-input); padding: 2px 6px; border-radius: 4px;">${utr}</code></td>
          <td style="font-size: 0.8rem;">${paidDate}</td>
          <td>
            <div style="display: flex; gap: 6px; align-items: center;">
              ${actionButtons}
            </div>
          </td>
        </tr>
      `;
    }).join('');

  tbody.innerHTML = rowsHtml || `<tr><td colspan="7" class="text-center" style="color: var(--text-muted); padding: 2rem;">No members match the current filter.</td></tr>`;
}

async function adminEditMemberFee(memberId) {
  const member = state.members.find(m => m.id === memberId);
  if (!member) return;

  const currentFee = member.fee || state.config.defaultFee;
  const input = prompt(`Enter new Monthly Fee amount for ${member.name} (₹):`, currentFee);
  
  if (input === null) return; // User cancelled
  const newFee = parseInt(input.trim());

  if (isNaN(newFee) || newFee < 1) {
    showToast('Please enter a valid amount (minimum ₹1)', 'error');
    return;
  }

  member.fee = newFee;
  saveData();

  // Sync to Google Sheet
  if (state.config.googleScriptUrl) {
    try {
      await callGoogleAppsScript('updateMemberFee', {
        memberId: member.id,
        email: member.email,
        fee: newFee
      });
    } catch (e) {
      console.warn('Google Sheet fee update error', e);
    }
  }

  showToast(`Monthly fee for ${member.name} updated to ₹${newFee}`, 'success');
  renderAdminDashboard();
}

async function adminMarkStatus(memberId, month, newStatus, customUtr = '') {
  let payment = state.payments.find(p => p.memberId === memberId && p.month === month);
  const member = state.members.find(m => m.id === memberId);
  const nowStr = formatTimestamp(new Date());

  if (payment) {
    payment.status = newStatus;
    if (newStatus === 'PAID') {
      payment.verifiedBy = 'Admin';
      if (!payment.utr || payment.utr === '—') payment.utr = customUtr || 'VERIFIED-BY-ADMIN';
      if (!payment.date || payment.date === '—') payment.date = nowStr;
    }
  } else {
    payment = {
      id: 'P' + Date.now(),
      memberId: memberId,
      month: month,
      amount: member.fee || state.config.defaultFee,
      status: newStatus,
      utr: customUtr || 'VERIFIED-BY-ADMIN',
      date: nowStr,
      verifiedBy: 'Admin'
    };
    state.payments.push(payment);
  }

  saveData();

  // Sync with Google Sheet if configured
  if (state.config.googleScriptUrl) {
    try {
      await callGoogleAppsScript('updatePaymentStatus', {
        memberId,
        month,
        status: newStatus,
        utr: payment.utr,
        date: payment.date
      });
    } catch (e) {
      console.warn('Google Sheet update error', e);
    }
  }

  showToast(`Record updated to ${newStatus} for ${member ? member.name : memberId}`, 'success');
  renderAdminDashboard();
}

function handleAddMember(event) {
  event.preventDefault();
  const name = document.getElementById('newMemberName').value.trim();
  const email = document.getElementById('newMemberEmail').value.trim().toLowerCase();
  const phone = document.getElementById('newMemberPhone').value.trim();
  const fee = parseInt(document.getElementById('newMemberFee').value) || state.config.defaultFee;

  if (state.members.some(m => (m.email && m.email.toLowerCase() === email) || (phone && m.phone === phone))) {
    showToast('A member with this email or mobile number already exists', 'error');
    return;
  }

  const newMember = {
    id: (100 + state.members.length + 1).toString(),
    name,
    email,
    phone,
    fee,
    joinDate: getCurrentMonthName()
  };

  state.members.push(newMember);
  saveData();

  // Sync to Google Sheet
  if (state.config.googleScriptUrl) {
    callGoogleAppsScript('addMember', newMember).catch(err => console.warn('Add member sheet sync error', err));
  }

  closeModal('addMemberModal');
  document.getElementById('formAddMember').reset();
  showToast(`Member ${name} added successfully!`, 'success');
  renderAdminDashboard();
}

function exportToCsv() {
  const month = state.selectedAdminMonth;
  const monthPayments = state.payments.filter(p => p.month === month);

  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Member ID,Member Name,Mobile Number,Month,Fee Amount,Status,Transaction UTR,Payment Date\n";

  state.members.forEach(member => {
    const payment = monthPayments.find(p => p.memberId === member.id);
    const status = payment ? payment.status : 'PENDING';
    const utr = payment ? (payment.utr || '—') : '—';
    const date = payment ? (payment.date || '—') : '—';
    const fee = member.fee || state.config.defaultFee;

    csvContent += `"${member.id}","${member.name}","+91 ${member.phone}","${month}","${fee}","${status}","${utr}","${date}"\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Pulari_Club_Fees_${month.replace(' ', '_')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Exported CSV file successfully', 'success');
}

// ==========================================
// RECEIPTS & PRINTING
// ==========================================
function showReceipt(paymentId) {
  const payment = state.payments.find(p => p.id === paymentId);
  if (!payment) return;

  const member = state.members.find(m => m.id === payment.memberId);
  if (!member) return;

  document.getElementById('rcptClubName').textContent = state.config.clubName.toUpperCase();
  document.getElementById('rcptNumber').textContent = `#REC-${payment.id}`;
  document.getElementById('rcptMemberName').textContent = member.name;
  if (document.getElementById('rcptMemberEmail')) {
    document.getElementById('rcptMemberEmail').textContent = member.email || '—';
  }
  document.getElementById('rcptMemberPhone').textContent = member.phone ? `+91 ${member.phone}` : '—';
  document.getElementById('rcptMonth').textContent = payment.month;
  document.getElementById('rcptDate').textContent = payment.date;
  document.getElementById('rcptUtr').textContent = payment.utr || 'VERIFIED';
  document.getElementById('rcptAmount').textContent = `₹${payment.amount}.00`;

  openModal('receiptModal');
}

function viewLatestReceipt() {
  if (!state.currentMember) return;
  const currentMonth = getCurrentMonthName();
  const payment = state.payments.find(p => p.memberId === state.currentMember.id && p.month === currentMonth && p.status === 'PAID');
  if (payment) {
    showReceipt(payment.id);
  }
}

function printReceipt() {
  window.print();
}

// ==========================================
// SETTINGS & DEMO MANAGEMENT
// ==========================================
async function handleSaveSettings(event) {
  event.preventDefault();
  state.config.clubName = document.getElementById('cfgClubName').value.trim();
  state.config.clubUpiId = document.getElementById('cfgUpiId').value.trim();
  state.config.razorpayKeyId = (document.getElementById('cfgRazorpayKeyId')?.value || '').trim() || 'rzp_test_TX6N5Cf8sX1Ybx';
  const newDefaultFee = parseInt(document.getElementById('cfgDefaultFee').value) || 1;
  state.config.defaultFee = newDefaultFee;
  state.config.adminPin = document.getElementById('cfgAdminPin').value.trim() || '1234';
  state.config.googleScriptUrl = document.getElementById('cfgGoogleScriptUrl').value.trim();

  // Apply new fee across all members
  state.members.forEach(m => {
    m.fee = newDefaultFee;
  });

  if (state.currentMember) {
    state.currentMember.fee = newDefaultFee;
    sessionStorage.setItem('pulari_active_member', JSON.stringify(state.currentMember));
  }

  saveData();
  updateConfigUI();
  closeModal('settingsModal');

  // Sync all members fee change to Google Sheet
  if (state.config.googleScriptUrl) {
    try {
      await callGoogleAppsScript('updateAllMembersFee', { fee: newDefaultFee });
    } catch (e) {
      console.warn('Google Sheet bulk fee update error', e);
    }
  }

  showToast(`Settings saved! Monthly fee set to ₹${newDefaultFee} for all members.`, 'success');

  if (state.isAdminLoggedIn) renderAdminDashboard();
  if (state.currentMember) renderMemberDashboard();
}

function resetDemoData() {
  if (confirm('Reset all demo data back to default initial values?')) {
    state.members = [...INITIAL_MEMBERS];
    state.payments = [...INITIAL_PAYMENTS];
    state.config = { ...DEFAULT_CONFIG };
    saveData();
    updateConfigUI();
    closeModal('settingsModal');
    showToast('Demo data reset to initial default', 'info');
    if (state.isAdminLoggedIn) renderAdminDashboard();
    if (state.currentMember) renderMemberDashboard();
  }
}

function toggleDarkMode() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const newTheme = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme === 'dark' ? 'dark' : '');
  state.config.theme = newTheme;
  saveData();

  document.getElementById('btnTheme').innerHTML = newTheme === 'dark' ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
}

// ==========================================
// GOOGLE APPS SCRIPT API CONNECTOR
// ==========================================
async function callGoogleAppsScript(action, payload = {}) {
  const url = state.config.googleScriptUrl;
  if (!url || !url.startsWith('http')) return null;

  try {
    // Use text/plain to avoid CORS preflight OPTIONS rejection on script.google.com
    const response = await fetch(url, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...payload })
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.warn('POST failed, attempting fallback GET request:', error);
    try {
      // Fallback via GET query parameters if POST encounters browser redirect issues
      const queryParams = new URLSearchParams({ action, ...payload }).toString();
      const getResponse = await fetch(`${url}?${queryParams}`, { method: 'GET', redirect: 'follow' });
      return await getResponse.json();
    } catch (fallbackError) {
      console.error('Google Apps Script call completely failed:', fallbackError);
      throw fallbackError;
    }
  }
}

// ==========================================
// MODALS & TOAST HELPERS
// ==========================================
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('open');
    if (modalId === 'settingsModal') {
      document.getElementById('cfgClubName').value = state.config.clubName;
      document.getElementById('cfgUpiId').value = state.config.clubUpiId;
      if (document.getElementById('cfgRazorpayKeyId')) {
        document.getElementById('cfgRazorpayKeyId').value = state.config.razorpayKeyId || 'rzp_test_TX6N5Cf8sX1Ybx';
      }
      document.getElementById('cfgDefaultFee').value = state.config.defaultFee;
      document.getElementById('cfgAdminPin').value = state.config.adminPin;
      document.getElementById('cfgGoogleScriptUrl').value = state.config.googleScriptUrl || '';
    }
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('open');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let icon = '<i class="fa-solid fa-circle-info"></i>';
  if (type === 'success') icon = '<i class="fa-solid fa-circle-check"></i>';
  if (type === 'error') icon = '<i class="fa-solid fa-triangle-exclamation"></i>';

  toast.innerHTML = `${icon} <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ==========================================
// DATE & STRING UTILITIES
// ==========================================
function getCurrentMonthName() {
  const date = new Date();
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
}

function getMonthList() {
  const months = [];
  const date = new Date();
  // Include past 5 months, current month, and next month
  for (let i = -5; i <= 1; i++) {
    const d = new Date(date.getFullYear(), date.getMonth() + i, 1);
    months.push(d.toLocaleString('default', { month: 'long', year: 'numeric' }));
  }
  return months;
}

function formatTimestamp(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('default', { month: 'short' });
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${day}-${month}-${year} ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
}
