
// ── DATA ──────────────────────────────────────
const defaultPosts = [
  {
    id: 1, name: 'Priya Sharma', handle: '@priya_jisce', institute: 'JISCE',
    time: '2m', verified: true,
    text: 'Just submitted my final year project! 🎓 Four years of hard work, late nights, and too much coffee finally paid off. CampusX fam — we made it! #FinalYear #JISCElife',
    likes: 48, reposts: 12, replies: 9, liked: false, reposted: false,
    avatar: 'PS', avatarColor: 'linear-gradient(135deg,#f4212e,#ff6b9d)'
  },
  {
    id: 2, name: 'Arnab Das', handle: '@arnab_jisu', institute: 'JIS Uni',
    time: '45m', verified: false,
    text: 'JIS University Hackathon registrations are OPEN 🚀 48-hour coding marathon, prizes worth ₹50,000+! Form your team now and register by Dec 10. Who\'s in? 👇 #HackathonJISU #CampusX',
    likes: 127, reposts: 34, replies: 21, liked: true, reposted: false,
    avatar: 'AD', avatarColor: 'linear-gradient(135deg,#00ba7c,#1d9bf0)'
  },
  {
    id: 3, name: 'Sneha Roy', handle: '@sneha_cit', institute: 'CIT',
    time: '2h', verified: false,
    text: 'Hot take: the canteen at CIT has the best aloo paratha in all of JIS Group 🤌 Sorry not sorry #CITlife #CanteenDebate',
    likes: 89, reposts: 22, replies: 47, liked: false, reposted: true,
    avatar: 'SR', avatarColor: 'linear-gradient(135deg,#7856ff,#f4212e)'
  },
  {
    id: 4, name: 'Campus Admin', handle: '@campusx_admin', institute: 'JIS Group',
    time: '3h', verified: true,
    text: '🎉 Welcome to CampusX — the official social network for all JIS Group students!\n\nPost, connect, chat, and collaborate with students across all institutes. Get verified with your fee receipt to unlock all features. ✅ #CampusXLaunch',
    likes: 342, reposts: 98, replies: 56, liked: false, reposted: false,
    avatar: 'CA', avatarColor: 'var(--x-blue)'
  },
  {
    id: 5, name: 'Md. Iqbal', handle: '@iqbal_jisu', institute: 'JIS Uni',
    time: '5h', verified: false,
    text: 'Library extended hours UPDATE: Now open till 10 PM on weekdays 📚 Finally! Exam season just got more manageable. Thanks student council for pushing this through! #ResultDay #JISUni',
    likes: 203, reposts: 67, replies: 18, liked: true, reposted: false,
    avatar: 'MI', avatarColor: 'linear-gradient(135deg,#7856ff,#1d9bf0)'
  }
];

let feedPosts = [...defaultPosts];
let currentUser = { id: '', name: 'Rahul Sen', handle: '@rahul_jisce', initials: 'RS', institute: 'JISCE', role: 'STUDENT', avatarUrl: '', bannerUrl: '' };
let authState = {
  accessToken: localStorage.getItem('cx_access_token') || '',
  refreshToken: localStorage.getItem('cx_refresh_token') || ''
};
let currentInstituteId = '';
let instituteOptions = [];
let loginReceiptFile = null;
let modalReceiptFile = null;
let loginBusy = false;
let receiptBusy = false;
let filePickerLock = false;
const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:4000/api' : '/api';

function initialsFromName(name) {
  return (name || 'JIS Student').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'JS';
}

function instituteShort(value) {
  return (value || '').replace(/[,].*/, '').replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 6) || 'JIS';
}

function safeCssImage(url) {
  return String(url || '').replace(/"/g, '%22');
}

function setAvatarVisual(elementId, initials, imageUrl) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = initials || 'JS';
  if (imageUrl) {
    el.style.backgroundImage = 'url("' + safeCssImage(imageUrl) + '")';
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
    el.style.backgroundRepeat = 'no-repeat';
    el.style.color = 'transparent';
    return;
  }
  el.style.backgroundImage = '';
  el.style.background = 'linear-gradient(135deg,#1d9bf0,#7856ff)';
  el.style.color = '#fff';
}

function avatarCircleHtml(sizeClass, initials, imageUrl, extraStyle, extraAttrs) {
  const baseStyle = 'font-size:' + (sizeClass === 'av-xs' ? '11px' : '13px') + ';font-weight:700;border-radius:50%;' + (extraStyle || '');
  const attrs = extraAttrs ? ' ' + extraAttrs : '';
  const cleanUrl = mediaUrl(imageUrl || '');
  if (cleanUrl) {
    return '<img class="avatar ' + esc(sizeClass) + '" src="' + esc(cleanUrl) + '" alt="avatar" style="object-fit:cover;' + baseStyle + '"' + attrs + ' />';
  }
  return '<div class="av-placeholder ' + esc(sizeClass) + ' avatar" style="background:linear-gradient(135deg,#1d9bf0,#7856ff);' + baseStyle + '"' + attrs + '>' + esc(initials || 'JS') + '</div>';
}

function setBannerVisual(elementId, imageUrl) {
  const el = document.getElementById(elementId);
  if (!el) return;
  if (imageUrl) {
    el.style.backgroundImage = 'url("' + safeCssImage(imageUrl) + '")';
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
    el.style.backgroundRepeat = 'no-repeat';
    return;
  }
  el.style.backgroundImage = '';
  el.style.background = 'linear-gradient(135deg, #1d9bf0 0%, #7856ff 100%)';
}

function followButtonLabel(isFollowing, followsYou) {
  if (isFollowing) return 'Following';
  return followsYou ? 'Follow back' : 'Follow';
}

function setAuth(accessToken, refreshToken) {
  authState.accessToken = accessToken || '';
  authState.refreshToken = refreshToken || '';
  if (authState.accessToken) localStorage.setItem('cx_access_token', authState.accessToken);
  else localStorage.removeItem('cx_access_token');
  if (authState.refreshToken) localStorage.setItem('cx_refresh_token', authState.refreshToken);
  else localStorage.removeItem('cx_refresh_token');
}

async function apiRequest(path, options = {}) {
  const headers = Object.assign({}, options.headers || {});
  if (!options.body || !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (authState.accessToken) headers['Authorization'] = 'Bearer ' + authState.accessToken;
  let resp;
  try {
    resp = await fetch(API_BASE + path, Object.assign({}, options, { headers }));
  } catch (_) {
    throw new Error('Cannot reach server. Open app at http://localhost:4000 after starting backend.');
  }
  let data = {};
  try { data = await resp.json(); } catch (_) {}
  if (!resp.ok) throw new Error(data.error || ('Request failed (' + resp.status + ')'));
  return data;
}

function applyCurrentUserToUI() {
  document.getElementById('sidebar-display-name').textContent = currentUser.name;
  document.getElementById('sidebar-handle').textContent = currentUser.handle;
  const avatar = mediaUrl(currentUser.avatarUrl || '');
  setAvatarVisual('sidebar-av', currentUser.initials, avatar);
  setAvatarVisual('compose-av', currentUser.initials, avatar);
  setAvatarVisual('modal-av', currentUser.initials, avatar);
  document.getElementById('profile-display-name').textContent = currentUser.name;
  document.getElementById('profile-header-name').textContent = currentUser.name;
  setAvatarVisual('profile-av-initials', currentUser.initials, avatar);
  setBannerVisual('profile-cover', mediaUrl(currentUser.bannerUrl || ''));
  document.getElementById('profile-display-handle').innerHTML =
    currentUser.handle + ' · <span class="institute-badge">' + currentUser.institute + '</span>';
}

async function loadInstitutes() {
  const select = document.getElementById('institute-select');
  if (!select) return;
  try {
    const result = await apiRequest('/institutes', { method: 'GET', headers: { Authorization: '' } });
    instituteOptions = Array.isArray(result.institutes) ? result.institutes : [];
    if (!instituteOptions.length) return;
    select.innerHTML = '<option value="">-- Choose your institute --</option>';
    instituteOptions.forEach(inst => {
      const option = document.createElement('option');
      option.value = inst.id;
      option.textContent = inst.name;
      option.dataset.short = inst.shortCode || instituteShort(inst.name);
      select.appendChild(option);
    });
  } catch (_) {
    // Keep static fallback options if API is unavailable.
  }
}

function openFilePickerById(inputId, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  if (filePickerLock) return;
  const fileInput = document.getElementById(inputId);
  if (!fileInput) return;
  filePickerLock = true;
  fileInput.click();
  setTimeout(function () { filePickerLock = false; }, 500);
}

function triggerLoginReceiptUpload(event) {
  openFilePickerById('login-receipt-input', event);
}

function triggerModalReceiptUpload(event) {
  openFilePickerById('receipt-modal-file', event);
}

async function loadFeedFromApi(tab) {
  if (!authState.accessToken) return;
  try {
    const result = await apiRequest('/posts/feed?tab=' + encodeURIComponent(tab || 'for-you'));
    if (Array.isArray(result.posts) && result.posts.length) {
      feedPosts = result.posts;
      renderFeed();
    }
  } catch (_) {
    // Keep local feed fallback.
  }
}

// ── RENDER POSTS ──────────────────────────────
function renderPost(p) {
  return `
  <div class="post-card" id="post-${p.id}">
    <div class="av-placeholder av-sm avatar" style="font-size:13px;font-weight:700;background:${p.avatarColor};border-radius:50%;">${p.avatar}</div>
    <div class="post-body">
      <div class="post-meta">
        <span class="post-name">${p.name}</span>
        ${p.verified ? '<span class="verified">✅</span>' : ''}
        <span class="institute-badge">${p.institute}</span>
        <span class="post-dot">·</span>
        <span class="post-time">${p.time}</span>
      </div>
      <div class="post-text">${p.text.replace(/\n/g,'<br>').replace(/(#\w+)/g,'<a style="color:var(--x-blue);text-decoration:none;">$1</a>')}</div>
      <div class="post-actions">
        <button class="action-btn reply" onclick="showToast('💬 Reply feature coming soon!')">
          <span class="icon">💬</span><span>${p.replies}</span>
        </button>
        <button class="action-btn repost ${p.reposted ? 'reposted' : ''}" onclick="toggleRepost(${p.id},this)">
          <span class="icon">🔁</span><span id="rp-${p.id}">${p.reposts}</span>
        </button>
        <button class="action-btn like ${p.liked ? 'liked' : ''}" onclick="toggleLike(${p.id},this)">
          <span class="icon">${p.liked ? '❤️' : '🤍'}</span><span id="lk-${p.id}">${p.likes}</span>
        </button>
        <button class="action-btn share" onclick="showToast('🔗 Link copied to clipboard!')">
          <span class="icon">↗</span>
        </button>
      </div>
    </div>
  </div>`;
}

function renderFeed() {
  const c = document.getElementById('feed-posts');
  if (c) c.innerHTML = feedPosts.map(renderPost).join('');
}

function renderProfilePosts() {
  const c = document.getElementById('profile-posts');
  if (!c) return;
  const myPosts = [
    {
      id: 101, name: currentUser.name, handle: currentUser.handle,
      institute: currentUser.institute, time: '1h', verified: false,
      text: 'Just discovered CampusX and already loving the campus vibe here 🔥 This is going to be the go-to app for all JIS students! #CampusXLaunch',
      likes: 23, reposts: 5, replies: 4, liked: false, reposted: false,
      avatar: currentUser.initials, avatarColor: 'linear-gradient(135deg,#1d9bf0,#7856ff)'
    },
    {
      id: 102, name: currentUser.name, handle: currentUser.handle,
      institute: currentUser.institute, time: '4h', verified: false,
      text: 'Exam prep mode activated 📚 Who else is surviving on maggi and black coffee right now? #ExamSeason2025 #JISCElife',
      likes: 67, reposts: 14, replies: 11, liked: true, reposted: false,
      avatar: currentUser.initials, avatarColor: 'linear-gradient(135deg,#1d9bf0,#7856ff)'
    }
  ];
  c.innerHTML = myPosts.map(renderPost).join('');
}

// ── INTERACTIONS ──────────────────────────────
function toggleLike(id, btn) {
  const p = feedPosts.find(x => x.id === id);
  if (!p) return;
  p.liked = !p.liked;
  p.likes += p.liked ? 1 : -1;
  document.getElementById('lk-' + id).textContent = p.likes;
  btn.querySelector('.icon').textContent = p.liked ? '❤️' : '🤍';
  btn.classList.toggle('liked', p.liked);
}

function toggleRepost(id, btn) {
  const p = feedPosts.find(x => x.id === id);
  if (!p) return;
  p.reposted = !p.reposted;
  p.reposts += p.reposted ? 1 : -1;
  document.getElementById('rp-' + id).textContent = p.reposts;
  btn.classList.toggle('reposted', p.reposted);
  showToast(p.reposted ? '🔁 Reposted!' : 'Repost removed');
}

function toggleFollow(btn) {
  const f = btn.classList.contains('following');
  btn.classList.toggle('following', !f);
  btn.textContent = f ? 'Follow' : 'Following';
  showToast(f ? 'Unfollowed' : '✅ Now following!');
}

// ── NAVIGATION ────────────────────────────────
function showView(view) {
  ['feed','explore','notif','chat','profile','bookmarks','events','communities','lists','premium'].forEach(v => {
    const el = document.getElementById('view-' + v);
    if (el) { el.classList.add('hidden'); el.style.removeProperty('display'); }
    const nav = document.getElementById('nav-' + v);
    if (nav) nav.classList.remove('active');
  });
  const target = document.getElementById('view-' + view);
  if (target) {
    target.classList.remove('hidden');
    if (view === 'chat') target.style.display = 'block';
  }
  const nav = document.getElementById('nav-' + view);
  if (nav) nav.classList.add('active');
  const rp = document.getElementById('right-panel');
  if (rp) rp.style.display = (view === 'chat') ? 'none' : '';
  if (view === 'profile') renderProfilePosts();
  if (view === 'notif') { document.getElementById('notif-badge').style.display = 'none'; }
  if (view === 'events') renderEvents();
  if (view === 'communities') renderCommunitiesPage();
  if (view === 'lists') renderListsPage();
  if (view === 'premium') renderPremiumPage();
}

function switchFeedTab(el, tab) {
  document.querySelectorAll('.feed-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  loadFeedFromApi(tab || 'for-you');
}

// ── LOGIN ─────────────────────────────────────
function switchAuthScreen(mode) {
  const registerScreen = document.getElementById('login-screen');
  const signInScreen = document.getElementById('signin-screen');
  if (mode === 'signin') {
    if (registerScreen) registerScreen.classList.add('hidden');
    if (signInScreen) signInScreen.classList.remove('hidden');
  } else {
    if (signInScreen) signInScreen.classList.add('hidden');
    if (registerScreen) registerScreen.classList.remove('hidden');
  }
}

function doDirectSignIn() {
  const directEmail = document.getElementById('direct-signin-email');
  const directPassword = document.getElementById('direct-signin-password');
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  if (emailInput && directEmail) emailInput.value = directEmail.value;
  if (passwordInput && directPassword) passwordInput.value = directPassword.value;
  doLogin('signin');
}

async function doLogin(mode) {
  if (loginBusy) return;
  const loginMode = mode || 'register';
  const nameEl = document.getElementById('login-name');
  const rollEl = document.getElementById('login-roll');
  const emailEl = document.getElementById('login-email');
  const passEl = document.getElementById('login-password');
  const directEmailEl = document.getElementById('direct-signin-email');
  const directPassEl = document.getElementById('direct-signin-password');
  const selectEl = document.getElementById('institute-select');

  const fullName = (nameEl.value || '').trim();
  const rollNumber = (rollEl.value || '').trim();
  const email = ((loginMode === 'signin' && directEmailEl && directEmailEl.value) ? directEmailEl.value : emailEl.value || '').trim();
  const password = ((loginMode === 'signin' && directPassEl && directPassEl.value) ? directPassEl.value : passEl.value || '').trim();
  const instituteId = selectEl.value;
  const instituteText = (selectEl.options[selectEl.selectedIndex] && selectEl.options[selectEl.selectedIndex].textContent) || '';

  if (!email || !password) {
    showToast('⚠️ Please enter email and password');
    return;
  }

  if (loginMode !== 'signin') {
    if (!instituteId) { showToast('⚠️ Please select your institute'); return; }
    if (!fullName) { showToast('⚠️ Please enter full name'); return; }
    if (!rollNumber) { showToast('⚠️ Please enter roll number'); return; }
  }

  loginBusy = true;

  try {
    let result;

    if (loginMode === 'signin') {
      result = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ emailOrHandle: email, password })
      });
    } else {
      result = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          email,
          password,
          rollNumber,
          instituteId
        })
      });
    }

    const profile = result.user || {};
    const displayName = profile.fullName || fullName || 'JIS Student';
    const rawHandle = profile.handle || ('@' + displayName.toLowerCase().replace(/\s+/g, '_').slice(0, 14));
    const handle = rawHandle.startsWith('@') ? rawHandle : ('@' + rawHandle);
    const instShort = (profile.institute && profile.institute.shortCode) || instituteShort(instituteText || profile.institute?.name || '');

    currentUser = {
      id: profile.id || '',
      name: displayName,
      handle,
      initials: initialsFromName(displayName),
      institute: instShort,
      role: profile.role || 'STUDENT',
      avatarUrl: profile.avatarUrl || '',
      bannerUrl: profile.bannerUrl || ''
    };

    currentInstituteId = (profile.institute && profile.institute.id) || instituteId || '';
    setAuth(result.accessToken, result.refreshToken);
    applyCurrentUserToUI();

    document.getElementById('login-screen').classList.add('hidden');
    const signInScreen = document.getElementById('signin-screen');
    if (signInScreen) signInScreen.classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    await loadFeedFromApi('for-you');
    renderFeed();
    showToast(loginMode === 'signin' ? '✅ Signed in successfully!' : '🎉 Account created successfully!');

    if (loginMode === 'register' && loginReceiptFile && currentInstituteId) {
      const autoReceiptData = new FormData();
      autoReceiptData.append('instituteId', currentInstituteId);
      autoReceiptData.append('academicYear', new Date().getFullYear() + '-' + String(new Date().getFullYear() + 1).slice(2));
      autoReceiptData.append('receiptNumber', 'AUTO-' + Date.now());
      autoReceiptData.append('receipt', loginReceiptFile);
      try {
        await apiRequest('/verification/submit', {
          method: 'POST',
          body: autoReceiptData
        });
        showToast('✅ Receipt submitted for verification.');
      } catch (_) {
        showToast('⚠️ Account created. Submit receipt from Verification tab.');
      }
    }
  } catch (error) {
    showToast('❌ ' + (error && error.message ? error.message : 'Login failed'));
  } finally {
    loginBusy = false;
  }
}

// ── COMPOSE ───────────────────────────────────
function updateChar() {
  const v = document.getElementById('compose-inline').value;
  document.getElementById('char-count').textContent = 280 - v.length;
  document.getElementById('inline-toolbar').style.display = v.length > 0 ? 'flex' : 'none';
}

function updateModalChar() {
  const v = document.getElementById('compose-modal-input').value;
  document.getElementById('modal-char-count').textContent = 280 - v.length;
}

function postTweet() {
  const txt = document.getElementById('compose-inline').value.trim();
  if (!txt) return;
  addPost(txt);
  document.getElementById('compose-inline').value = '';
  document.getElementById('char-count').textContent = '280';
  document.getElementById('inline-toolbar').style.display = 'none';
  document.getElementById('emoji-picker').classList.add('hidden');
  renderFeed();
  showToast('✅ Posted!');
}

function postFromModal() {
  const txt = document.getElementById('compose-modal-input').value.trim();
  if (!txt) return;
  addPost(txt);
  document.getElementById('compose-modal-input').value = '';
  document.getElementById('modal-char-count').textContent = '280';
  document.getElementById('compose-modal').classList.add('hidden');
  showView('feed');
  renderFeed();
  showToast('✅ Posted!');
}

function addPost(txt) {
  feedPosts.unshift({
    id: Date.now(),
    name: currentUser.name, handle: currentUser.handle,
    institute: currentUser.institute, time: 'Just now', verified: false,
    text: txt, likes: 0, reposts: 0, replies: 0,
    liked: false, reposted: false,
    avatar: currentUser.initials,
    avatarColor: 'linear-gradient(135deg,#1d9bf0,#7856ff)',
    avatarUrl: currentUser.avatarUrl || ''
  });
}

// ── EMOJI ─────────────────────────────────────
function toggleEmojiPicker() { document.getElementById('emoji-picker').classList.toggle('hidden'); }
function toggleModalEmoji() { document.getElementById('modal-emoji-picker').classList.toggle('hidden'); }
function insertEmoji(e) {
  const el = document.getElementById('compose-inline');
  el.value += e; updateChar();
  document.getElementById('emoji-picker').classList.add('hidden');
}
function insertModalEmoji(e) {
  const el = document.getElementById('compose-modal-input');
  el.value += e; updateModalChar();
  document.getElementById('modal-emoji-picker').classList.add('hidden');
}

// ── COMPOSE MODAL ─────────────────────────────
function openComposeModal() { document.getElementById('compose-modal').classList.remove('hidden'); }
function closeComposeModal(e) {
  if (!e || e.target.classList.contains('modal-overlay'))
    document.getElementById('compose-modal').classList.add('hidden');
}

// ── RECEIPT MODAL ─────────────────────────────
function openReceiptModal() { document.getElementById('receipt-modal').classList.remove('hidden'); }
function closeReceiptModal(e) {
  if (!e || e.target.classList.contains('modal-overlay'))
    document.getElementById('receipt-modal').classList.add('hidden');
}
async function submitReceipt() {
  if (receiptBusy) return;
  receiptBusy = true;
  if (!authState.accessToken) {
    showToast('⚠️ Please sign in first');
    receiptBusy = false;
    return;
  }

  const fileInput = document.getElementById('receipt-modal-file');
  const file = (fileInput && fileInput.files && fileInput.files[0]) || modalReceiptFile;
  if (!file) {
    showToast('⚠️ Please attach receipt file');
    receiptBusy = false;
    return;
  }

  const name = (document.getElementById('receipt-student-name').value || '').trim();
  const roll = (document.getElementById('receipt-roll-number').value || '').trim();
  const year = (document.getElementById('receipt-year').value || '').trim() || (new Date().getFullYear() + '-' + String(new Date().getFullYear() + 1).slice(2));
  const receiptNo = (document.getElementById('receipt-number').value || '').trim() || ('MANUAL-' + Date.now());
  const instituteId = currentInstituteId || document.getElementById('institute-select').value;

  if (!instituteId) {
    showToast('⚠️ Institute missing. Please sign in again.');
    receiptBusy = false;
    return;
  }

  const formData = new FormData();
  formData.append('instituteId', instituteId);
  formData.append('academicYear', year);
  formData.append('receiptNumber', receiptNo);
  formData.append('studentName', name);
  formData.append('rollNumber', roll);
  formData.append('receipt', file);

  try {
    await apiRequest('/verification/submit', {
      method: 'POST',
      body: formData
    });
    document.getElementById('receipt-modal').classList.add('hidden');
    showToast('✅ Receipt submitted! Verification within 24 hours.');
  } catch (error) {
    showToast('❌ ' + (error && error.message ? error.message : 'Receipt submission failed'));
  } finally {
    receiptBusy = false;
  }
}

// ── CHAT ──────────────────────────────────────
function selectChat(name, initials, color, sub, el) {
  document.getElementById('chat-name').textContent = name;
  document.getElementById('chat-sub').textContent = sub;
  const av = document.getElementById('chat-av');
  av.textContent = initials;
  av.style.background = color;
  document.querySelectorAll('.chat-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
}

function sendChatMsg(e) { if (e.key === 'Enter') sendChatMsgBtn(); }

function sendChatMsgBtn() {
  const input = document.getElementById('chat-input-box');
  const txt = input.value.trim();
  if (!txt) return;
  const msgs = document.getElementById('chat-messages');
  const now = new Date();
  const time = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
  const div = document.createElement('div');
  div.className = 'msg sent';
  div.innerHTML = `<div class="msg-bubble">${txt}</div><div class="msg-time">${time}</div>`;
  msgs.appendChild(div);
  input.value = '';
  msgs.scrollTop = msgs.scrollHeight;
}

function insertChatEmoji() {
  document.getElementById('chat-input-box').value += '😊';
}

// ── TOAST ─────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ── INIT ──────────────────────────────────────
document.getElementById('compose-inline').addEventListener('focus', function () {
  document.getElementById('inline-toolbar').style.display = 'flex';
});

function updateLoginReceiptSelection(file) {
  const uploadArea = document.getElementById('login-upload-area');
  if (!uploadArea) return;
  if (!file) {
    uploadArea.innerHTML =
      '📎 Tap to upload fee receipt (PDF / Image)<br><span style="font-size:12px;margin-top:4px;display:block;">Required for account verification · PDF, JPG, PNG</span>';
    return;
  }
  uploadArea.innerHTML =
    '✅ Selected: ' + file.name + '<br><span style="font-size:12px;margin-top:4px;display:block;">Tap to change file</span>';
}

function updateModalReceiptSelection(file) {
  const preview = document.getElementById('receipt-upload-preview');
  if (!preview) return;
  if (!file) {
    preview.innerHTML =
      '<span style="font-size:28px;">📎</span><span>Tap to upload receipt</span><span style="font-size:12px;color:var(--x-muted);">PDF, JPG, or PNG · Max 5MB</span>';
    return;
  }
  preview.innerHTML =
    '<span style="font-size:24px;">✅</span><span style="font-weight:600;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 8px;">' + file.name + '</span><span style="font-size:12px;color:var(--x-muted);">Tap to change file</span>';
}

const loginReceiptInput = document.getElementById('login-receipt-input');
if (loginReceiptInput) {
  loginReceiptInput.addEventListener('change', function (e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    loginReceiptFile = file;
    updateLoginReceiptSelection(file);
    showToast('📎 Selected: ' + file.name);
  });
}

const modalReceiptInput = document.getElementById('receipt-modal-file');
if (modalReceiptInput) {
  modalReceiptInput.addEventListener('change', function (e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    modalReceiptFile = file;
    updateModalReceiptSelection(file);
    showToast('📎 Receipt attached: ' + file.name);
  });
}

const editAvatarInput = document.getElementById('edit-avatar-input');
if (editAvatarInput && editAvatarInput.dataset.bindProfileMedia !== '1') {
  editAvatarInput.addEventListener('change', function (e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setEditProfileImage('avatar', file);
  });
  editAvatarInput.dataset.bindProfileMedia = '1';
}

const editBannerInput = document.getElementById('edit-banner-input');
if (editBannerInput && editBannerInput.dataset.bindProfileMedia !== '1') {
  editBannerInput.addEventListener('change', function (e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setEditProfileImage('banner', file);
  });
  editBannerInput.dataset.bindProfileMedia = '1';
}

const editProfileNameInput = document.getElementById('edit-profile-name');
if (editProfileNameInput && editProfileNameInput.dataset.bindProfileName !== '1') {
  editProfileNameInput.addEventListener('input', refreshEditProfilePreview);
  editProfileNameInput.dataset.bindProfileName = '1';
}

function bindClickOnce(element, key, handler) {
  if (!element || element.dataset[key] === '1') return;
  element.addEventListener('click', handler);
  element.dataset[key] = '1';
}

const registerBtn = document.getElementById('register-btn');
bindClickOnce(registerBtn, 'bindRegister', function () { doLogin('register'); });
const signInBtn = document.getElementById('signin-btn');
bindClickOnce(signInBtn, 'bindSignin', function () { switchAuthScreen('signin'); });
const directSignInBtn = document.getElementById('direct-signin-btn');
bindClickOnce(directSignInBtn, 'bindDirectSignin', doDirectSignIn);
const directSignInPass = document.getElementById('direct-signin-password');
if (directSignInPass && directSignInPass.dataset.bindEnter !== '1') {
  directSignInPass.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') doDirectSignIn();
  });
  directSignInPass.dataset.bindEnter = '1';
}
const uploadArea = document.getElementById('login-upload-area');
bindClickOnce(uploadArea, 'bindLoginUpload', triggerLoginReceiptUpload);
const receiptUploadPreview = document.getElementById('receipt-upload-preview');
bindClickOnce(receiptUploadPreview, 'bindModalUpload', triggerModalReceiptUpload);

updateLoginReceiptSelection(null);
updateModalReceiptSelection(null);

// ===== Feature Patch (Part 1) =====
let inlineMediaFiles = [];
let modalMediaFiles = [];
let composeReplyPostId = '';
let composeQuotePostId = '';
let currentProfileData = null;
let profilePostsData = [];
let bookmarkPostsData = [];
let currentProfileTab = 'posts';
let repostActionPostId = '';
let deleteConfirmPostId = '';
let deleteConfirmTimer = null;
let replyDraftPostId = '';
let replyDraftText = {};
let replyDraftMedia = {};
let activeReplyMediaPostId = '';
let replyThreadByPost = {};
let replyThreadLoading = {};
const communityState = {};
const listState = {};
const premiumState = { plan: 'student_plus' };
const communityCatalog = [
  { id: 'jis-tech', title: 'JIS Tech Builders', about: 'Hackathons, code reviews, dev internships, and weekly coding challenges.', members: '8.4K' },
  { id: 'placements', title: 'Placement Watch', about: 'Off-campus and on-campus updates, interview prep, and referral threads.', members: '12.1K' },
  { id: 'fest-live', title: 'Fest & Events Live', about: 'Fest schedules, registrations, backstage updates, and photo drops.', members: '5.9K' },
  { id: 'research-hub', title: 'Research Hub', about: 'Papers, conferences, and collaboration opportunities across JIS institutes.', members: '3.2K' }
];
const listCatalog = [
  { id: 'inst-admin', title: 'Institute Admin Updates', owner: '@campus_admin', about: 'Official circulars, exam notices, and urgent announcements.', followers: '10.7K' },
  { id: 'coding-creators', title: 'Coding Creators', owner: '@priya_jisce', about: 'Best coding posts, snippets, and project demos from students.', followers: '6.8K' },
  { id: 'startup-watch', title: 'Startup Watch', owner: '@arnab_jisu', about: 'Campus startup ideas, pitch sessions, and founder stories.', followers: '4.4K' },
  { id: 'campus-photo', title: 'Campus Photos', owner: '@sneha_cit', about: 'Photography threads, visual stories, and event snapshots.', followers: '7.2K' }
];
const premiumCatalog = [
  { id: 'student_plus', title: 'Student Plus', about: 'Longer posts, profile highlight, and custom app icons.', price: '₹99/month' },
  { id: 'creator_plus', title: 'Creator Plus', about: 'Analytics, better discovery reach, and engagement insights.', price: '₹199/month' },
  { id: 'club_pro', title: 'Club Pro', about: 'Best for campus clubs with pinned campaigns and promoted notices.', price: '₹399/month' }
];
let editProfileAvatarFile = null;
let editProfileBannerFile = null;
let editProfileAvatarPreview = '';
let editProfileBannerPreview = '';
let editProfileSaving = false;

function esc(v) { return String(v || '').replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
function mediaUrl(u) { if (!u) return ''; if (/^https?:\/\//.test(u)) return u; return u.startsWith('/') ? u : ('/' + u); }
function normPost(p) {
  return Object.assign({
    id: String(Date.now()), name: 'JIS Student', handle: '@jis_student', institute: 'JIS', instituteName: 'JIS Group',
    time: 'now', verified: false, text: '', likes: 0, reposts: 0, replies: 0, liked: false, reposted: false, bookmarked: false,
    avatar: 'JS', avatarColor: 'linear-gradient(135deg,#1d9bf0,#7856ff)', avatarUrl: '', authorId: '', media: [], quotePost: null
  }, p || {});
}
function renderMedia(media) {
  if (!Array.isArray(media) || !media.length) return '';
  return '<div class="post-media-grid">' + media.map(function (m) {
    const t = String(m.type || m.mediaType || 'FILE').toUpperCase();
    const u = mediaUrl(m.url || '');
    if (t === 'IMAGE' || t === 'GIF') return '<div class="post-media-item"><img src="' + esc(u) + '" alt="media"></div>';
    if (t === 'VIDEO') return '<div class="post-media-item"><video controls src="' + esc(u) + '"></video></div>';
    if (t === 'AUDIO') return '<div class="post-media-item"><audio controls src="' + esc(u) + '"></audio></div>';
    return '<div class="post-media-item" style="padding:12px;"><a target="_blank" style="color:var(--x-blue);" href="' + esc(u) + '">📄 Open attachment</a></div>';
  }).join('') + '</div>';
}
function renderQuote(quote) {
  if (!quote) return '';
  return '<div class="quote-card"><div class="quote-meta">' + esc(quote.name) + ' · ' + esc(quote.handle) + '</div><div class="quote-text">' + esc(quote.text || '') + '</div>' + renderMedia(quote.media || []) + '</div>';
}
function renderReplyThread(postId) {
  const key = String(postId);
  if (replyThreadLoading[key]) {
    return '<div style="padding:10px 4px;color:var(--x-muted);font-size:13px;">Loading comments...</div>';
  }
  const list = Array.isArray(replyThreadByPost[key]) ? replyThreadByPost[key] : [];
  if (!list.length) {
    return '<div style="padding:10px 4px;color:var(--x-muted);font-size:13px;">No comments yet. Be the first to comment.</div>';
  }
  return list.map(function (raw) {
    const c = normPost(raw);
    return '<div style="display:flex;gap:8px;padding:8px 0;border-bottom:1px solid #141414;">' +
      avatarCircleHtml('av-xs', c.avatar || initialsFromName(c.name), c.avatarUrl || '', '', '') +
      '<div style="flex:1;min-width:0;">' +
      '<div style="font-size:13px;"><strong>' + esc(c.name || 'Student') + '</strong> <span style="color:var(--x-muted);">' + esc(c.handle || '') + ' · ' + esc(c.time || '') + '</span></div>' +
      '<div style="font-size:14px;line-height:1.45;word-break:break-word;">' + esc(c.text || '').replace(/\n/g, '<br>') + '</div>' +
      '</div></div>';
  }).join('');
}
function replyCharLeft(postId) {
  const text = String(replyDraftText[postId] || '');
  return Math.max(0, 280 - text.length);
}
function renderReplyMediaChips(postId) {
  const files = Array.isArray(replyDraftMedia[String(postId)]) ? replyDraftMedia[String(postId)] : [];
  if (!files.length) return '';
  return files.map(function (f, idx) {
    return '<span class="reply-compose-chip">' + esc(f.name) + ' <span style="cursor:pointer;color:var(--x-blue);" onclick="removeReplyMedia(\'' + esc(postId) + '\',' + idx + ')">✕</span></span>';
  }).join('');
}
function renderReplyBox(post) {
  const postId = String((post && post.id) || '');
  if (String(replyDraftPostId) !== postId) return '';
  const v = esc(replyDraftText[postId] || '');
  const threadHtml = renderReplyThread(postId);
  const replyingTo = post && post.handle ? post.handle : '@student';
  const mediaChips = renderReplyMediaChips(postId);
  return '<div class="reply-compose-card">' +
    '<div class="reply-thread-wrap">' + threadHtml + '</div>' +
    '<div class="reply-compose-head">Replying to <span style="color:var(--x-blue);">' + esc(replyingTo) + '</span></div>' +
    '<div class="reply-compose-main">' +
      avatarCircleHtml('av-sm', currentUser.initials || 'JS', currentUser.avatarUrl || '', '', '') +
      '<div class="reply-compose-input-wrap">' +
        '<textarea id="reply-box-' + esc(postId) + '" class="reply-compose-input" placeholder="Post your reply" maxlength="280" oninput="updateReplyDraft(\'' + esc(postId) + '\',this.value)">' + v + '</textarea>' +
        '<div class="reply-compose-chip-wrap" id="reply-media-preview-' + esc(postId) + '" style="' + (mediaChips ? 'display:flex;' : 'display:none;') + '">' + mediaChips + '</div>' +
        '<div class="reply-compose-tools">' +
          '<button class="compose-action" title="Emoji" onclick="insertReplyEmoji(\'' + esc(postId) + '\',\'😊\')">😊</button>' +
          '<button class="compose-action" title="Media" onclick="openReplyMediaPicker(\'' + esc(postId) + '\')">🖼️</button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="reply-compose-foot">' +
      '<span class="reply-char" id="reply-char-count-' + esc(postId) + '">' + replyCharLeft(postId) + '</span>' +
      '<button class="profile-edit-btn" style="float:none;margin-top:0;" onclick="cancelInlineReply()">Cancel</button>' +
      '<button class="submit-btn" onclick="submitInlineReply(\'' + esc(postId) + '\')">Reply</button>' +
    '</div>' +
  '</div>';
}

renderPost = function (raw) {
  const p = normPost(raw);
  const click = p.authorId ? 'onclick="openProfile(\'' + esc(p.authorId) + '\')"' : '';
  const userRole = String((currentUser && currentUser.role) || '').toUpperCase();
  const canDelete = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
  const deleteBtn = canDelete
    ? '<button class="action-btn" style="color:var(--x-red);" onclick="deletePost(\'' + esc(p.id) + '\')"><span class="icon">🗑️</span></button>'
    : '';
  return '<div class="post-card">' +
    avatarCircleHtml('av-sm', p.avatar || initialsFromName(p.name), p.avatarUrl || '', 'cursor:pointer;', click) +
    '<div class="post-body">' +
    '<div class="post-meta"><span class="post-name" style="cursor:pointer;" ' + click + '>' + esc(p.name) + '</span>' + (p.verified ? '<span class="verified">✅</span>' : '') +
    '<span class="post-handle" style="cursor:pointer;" ' + click + '>' + esc(p.handle) + '</span><span class="institute-badge">' + esc(p.institute) + '</span><span class="post-dot">·</span><span class="post-time">' + esc(p.time) + '</span></div>' +
    '<div class="post-text">' + esc(p.text).replace(/\n/g, '<br>').replace(/(#[A-Za-z0-9_]+)/g, '<span style="color:var(--x-blue);">$1</span>') + '</div>' +
    renderQuote(p.quotePost) + renderMedia(p.media) +
    '<div class="post-actions">' +
    '<button class="action-btn reply" onclick="replyToPost(\'' + esc(p.id) + '\')"><span class="icon">💬</span><span>' + Number(p.replies || 0) + '</span></button>' +
    '<button class="action-btn repost ' + (p.reposted ? 'reposted' : '') + '" onclick="toggleRepost(\'' + esc(p.id) + '\')"><span class="icon">🔁</span><span>' + Number(p.reposts || 0) + '</span></button>' +
    '<button class="action-btn like ' + (p.liked ? 'liked' : '') + '" onclick="toggleLike(\'' + esc(p.id) + '\')"><span class="icon">' + (p.liked ? '❤️' : '🤍') + '</span><span>' + Number(p.likes || 0) + '</span></button>' +
    '<button class="action-btn" style="color:' + (p.bookmarked ? 'var(--x-blue)' : 'var(--x-muted)') + ';" onclick="toggleBookmark(\'' + esc(p.id) + '\')"><span class="icon">🔖</span></button>' +
    '<button class="action-btn share" onclick="sharePost(\'' + esc(p.id) + '\')"><span class="icon">↗</span></button>' +
    deleteBtn +
    '</div>' +
    renderReplyBox(p) +
    '</div></div>';
};

renderFeed = function () {
  const c = document.getElementById('feed-posts');
  if (!c) return;
  if (!feedPosts.length) { c.innerHTML = '<div style="padding:24px;color:var(--x-muted);">No posts yet.</div>'; return; }
  c.innerHTML = feedPosts.map(renderPost).join('');
};

renderProfilePosts = function () {
  const c = document.getElementById('profile-posts');
  if (!c) return;
  const list = profilePostsData.length ? profilePostsData : [];
  const emptyLabel = currentProfileTab === 'replies' ? 'No replies yet.' : currentProfileTab === 'likes' ? 'No liked posts yet.' : currentProfileTab === 'media' ? 'No media posts yet.' : 'No posts yet.';
  c.innerHTML = list.length ? list.map(renderPost).join('') : '<div style="padding:24px;color:var(--x-muted);">' + emptyLabel + '</div>';
};

function openComposerMediaPicker(mode) { openFilePickerById(mode === 'modal' ? 'modal-media-input' : 'inline-media-input'); }
function removeComposerMedia(mode, idx) {
  if (mode === 'modal') modalMediaFiles = modalMediaFiles.filter(function (_, i) { return i !== idx; });
  else inlineMediaFiles = inlineMediaFiles.filter(function (_, i) { return i !== idx; });
  renderComposerMediaPreview(mode);
}
function renderComposerMediaPreview(mode) {
  const files = mode === 'modal' ? modalMediaFiles : inlineMediaFiles;
  const el = document.getElementById(mode === 'modal' ? 'modal-media-preview' : 'inline-media-preview');
  if (!el) return;
  if (!files.length) { el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = 'flex';
  el.innerHTML = files.map(function (f, i) { return '<span class="compose-media-chip">' + esc(f.name) + ' <span style="cursor:pointer;color:var(--x-blue);" onclick="removeComposerMedia(\'' + mode + '\',' + i + ')">✕</span></span>'; }).join('');
}
function insertPollTemplate(mode) {
  const el = document.getElementById(mode === 'modal' ? 'compose-modal-input' : 'compose-inline');
  if (!el) return;
  const extra = '\n\nPoll:\n1) Option A\n2) Option B\nVote in replies 👇';
  if (el.value.length + extra.length > 280) { showToast('⚠️ Not enough characters'); return; }
  el.value += extra;
  if (mode === 'modal') updateModalChar(); else updateChar();
}
function setComposeContext() {
  const t = document.getElementById('compose-modal-title');
  const n = document.getElementById('compose-context-note');
  if (!t || !n) return;
  if (composeReplyPostId) { t.textContent = 'Reply'; n.textContent = 'Replying to a post'; n.classList.remove('hidden'); return; }
  if (composeQuotePostId) { t.textContent = 'Quote Repost'; n.textContent = 'Add your thoughts'; n.classList.remove('hidden'); return; }
  t.textContent = 'New Post'; n.textContent = ''; n.classList.add('hidden');
}
async function createPostApi(text, files, parentId, quotePostId) {
  if (files && files.length) {
    const fd = new FormData(); fd.append('content', text || '');
    if (parentId) fd.append('parentId', parentId);
    if (quotePostId) fd.append('quotePostId', quotePostId);
    files.forEach(function (f) { fd.append('media', f); });
    return apiRequest('/posts', { method: 'POST', body: fd });
  }
  return apiRequest('/posts', { method: 'POST', body: JSON.stringify({ content: text || '', parentId: parentId || undefined, quotePostId: quotePostId || undefined }) });
}
postTweet = async function () {
  const el = document.getElementById('compose-inline'); if (!el) return;
  const text = (el.value || '').trim();
  if (!text && !inlineMediaFiles.length) { showToast('⚠️ Write text or attach media'); return; }
  try {
    const r = await createPostApi(text, inlineMediaFiles, '', '');
    if (r && r.post) feedPosts.unshift(normPost(r.post));
    el.value = ''; inlineMediaFiles = []; renderComposerMediaPreview('inline'); updateChar(); renderFeed(); showToast('✅ Posted');
  } catch (e) { showToast('❌ ' + (e && e.message ? e.message : 'Post failed')); }
};
postFromModal = async function () {
  const el = document.getElementById('compose-modal-input'); if (!el) return;
  const text = (el.value || '').trim();
  if (!text && !modalMediaFiles.length && !composeReplyPostId && !composeQuotePostId) { showToast('⚠️ Write text or attach media'); return; }
  try {
    const r = await createPostApi(text, modalMediaFiles, composeReplyPostId, composeQuotePostId);
    if (r && r.post) feedPosts.unshift(normPost(r.post));
    el.value = ''; modalMediaFiles = []; composeReplyPostId = ''; composeQuotePostId = '';
    renderComposerMediaPreview('modal'); updateModalChar(); setComposeContext(); document.getElementById('compose-modal').classList.add('hidden'); renderFeed(); showToast('✅ Posted');
  } catch (e) { showToast('❌ ' + (e && e.message ? e.message : 'Post failed')); }
};

function applyPostUpdate(id, fn) {
  feedPosts = feedPosts.map(function (p) { return String(p.id) === String(id) ? fn(normPost(p)) : p; });
  profilePostsData = profilePostsData.map(function (p) { return String(p.id) === String(id) ? fn(normPost(p)) : p; });
  bookmarkPostsData = bookmarkPostsData.map(function (p) { return String(p.id) === String(id) ? fn(normPost(p)) : p; });
  renderFeed(); renderProfilePosts();
  const b = document.getElementById('bookmark-list'); if (b) b.innerHTML = bookmarkPostsData.length ? bookmarkPostsData.map(renderPost).join('') : '<div style="padding:24px;color:var(--x-muted);">No bookmarks yet.</div>';
}
function findPostAny(id) { return feedPosts.concat(profilePostsData, bookmarkPostsData).find(function (p) { return String(p.id) === String(id); }) || null; }
async function loadRepliesForPost(postId, force) {
  const key = String(postId);
  if (!force && Array.isArray(replyThreadByPost[key])) return;
  replyThreadLoading[key] = true;
  renderFeed(); renderProfilePosts();
  const b1 = document.getElementById('bookmark-list');
  if (b1) b1.innerHTML = bookmarkPostsData.length ? bookmarkPostsData.map(renderPost).join('') : '<div style="padding:24px;color:var(--x-muted);">No bookmarks yet.</div>';
  try {
    const r = await apiRequest('/posts/' + encodeURIComponent(postId) + '/replies?limit=50');
    replyThreadByPost[key] = Array.isArray(r.replies) ? r.replies.map(normPost) : [];
  } catch (_) {
    replyThreadByPost[key] = Array.isArray(replyThreadByPost[key]) ? replyThreadByPost[key] : [];
  } finally {
    replyThreadLoading[key] = false;
    renderFeed(); renderProfilePosts();
    const b2 = document.getElementById('bookmark-list');
    if (b2) b2.innerHTML = bookmarkPostsData.length ? bookmarkPostsData.map(renderPost).join('') : '<div style="padding:24px;color:var(--x-muted);">No bookmarks yet.</div>';
  }
}
toggleLike = async function (id) {
  const p = findPostAny(id); const like = !(p && p.liked);
  try {
    const r = await apiRequest('/posts/' + encodeURIComponent(id) + '/like', { method: like ? 'POST' : 'DELETE' });
    applyPostUpdate(id, function (x) {
      x.liked = !!r.liked;
      x.likes = Number(r.likes ?? x.likes ?? 0);
      return x;
    });
  } catch (e) { showToast('❌ ' + (e && e.message ? e.message : 'Like failed')); }
};
function updateReplyDraft(id, value) {
  const key = String(id);
  replyDraftText[key] = value;
  const counter = document.getElementById('reply-char-count-' + key);
  if (counter) counter.textContent = String(replyCharLeft(key));
}
function openReplyMediaPicker(postId) {
  activeReplyMediaPostId = String(postId || '');
  openFilePickerById('reply-media-input');
}
function removeReplyMedia(postId, idx) {
  const key = String(postId || '');
  const files = Array.isArray(replyDraftMedia[key]) ? replyDraftMedia[key] : [];
  replyDraftMedia[key] = files.filter(function (_, i) { return i !== idx; });
  renderFeed(); renderProfilePosts();
  const b = document.getElementById('bookmark-list');
  if (b) b.innerHTML = bookmarkPostsData.length ? bookmarkPostsData.map(renderPost).join('') : '<div style="padding:24px;color:var(--x-muted);">No bookmarks yet.</div>';
}
function insertReplyEmoji(postId, emoji) {
  const key = String(postId || '');
  const el = document.getElementById('reply-box-' + key);
  const now = String(replyDraftText[key] || '');
  if (now.length + String(emoji || '').length > 280) return;
  replyDraftText[key] = now + String(emoji || '');
  if (el) el.value = replyDraftText[key];
  updateReplyDraft(key, replyDraftText[key]);
  if (el) el.focus();
}
function cancelInlineReply() {
  const key = String(replyDraftPostId || '');
  if (key) {
    replyDraftText[key] = '';
    replyDraftMedia[key] = [];
  }
  replyDraftPostId = '';
  activeReplyMediaPostId = '';
  renderFeed(); renderProfilePosts();
  const b = document.getElementById('bookmark-list'); if (b) b.innerHTML = bookmarkPostsData.length ? bookmarkPostsData.map(renderPost).join('') : '<div style="padding:24px;color:var(--x-muted);">No bookmarks yet.</div>';
}
replyToPost = function (id) {
  const key = String(id);
  if (String(replyDraftPostId) === key) {
    cancelInlineReply();
    return;
  }
  replyDraftPostId = key;
  if (!replyDraftText[replyDraftPostId]) replyDraftText[replyDraftPostId] = '';
  loadRepliesForPost(replyDraftPostId, false).catch(function () {});
  renderFeed(); renderProfilePosts();
  const b = document.getElementById('bookmark-list'); if (b) b.innerHTML = bookmarkPostsData.length ? bookmarkPostsData.map(renderPost).join('') : '<div style="padding:24px;color:var(--x-muted);">No bookmarks yet.</div>';
  setTimeout(function () { const el = document.getElementById('reply-box-' + replyDraftPostId); if (el) el.focus(); }, 50);
};
async function submitInlineReply(id) {
  const key = String(id);
  const txt = String(replyDraftText[key] || '').trim();
  const files = Array.isArray(replyDraftMedia[key]) ? replyDraftMedia[key] : [];
  if (!txt && !files.length) { showToast('⚠️ Write your reply or attach media'); return; }
  try {
    const r = await createPostApi(txt, files, String(id), '');
    if (r && r.post) {
      if (!Array.isArray(replyThreadByPost[key])) replyThreadByPost[key] = [];
      replyThreadByPost[key].push(normPost(r.post));
    }
    applyPostUpdate(id, function (x) { x.replies = Number(x.replies || 0) + 1; return x; });
    replyDraftText[key] = '';
    replyDraftMedia[key] = [];
    replyDraftPostId = key;
    await loadRepliesForPost(key, true);
    renderFeed(); renderProfilePosts();
    const b = document.getElementById('bookmark-list'); if (b) b.innerHTML = bookmarkPostsData.length ? bookmarkPostsData.map(renderPost).join('') : '<div style="padding:24px;color:var(--x-muted);">No bookmarks yet.</div>';
    setTimeout(function () { const el = document.getElementById('reply-box-' + key); if (el) el.focus(); }, 50);
    showToast('✅ Comment posted');
  } catch (e) {
    showToast('❌ ' + (e && e.message ? e.message : 'Reply failed'));
  }
}
function openQuoteComposer(id) { composeQuotePostId = String(id); composeReplyPostId = ''; setComposeContext(); openComposeModal(); }
function openRepostAction(id) {
  repostActionPostId = String(id || '');
  const modal = document.getElementById('repost-action-modal');
  const btn = document.getElementById('repost-main-action-btn');
  const post = findPostAny(id);
  if (btn) btn.textContent = post && post.reposted ? 'Undo Repost' : 'Repost';
  if (modal) modal.classList.remove('hidden');
}
function closeRepostAction(e) {
  if (e && !e.target.classList.contains('modal-overlay')) return;
  const modal = document.getElementById('repost-action-modal');
  if (modal) modal.classList.add('hidden');
  repostActionPostId = '';
}
async function doRepostAction(type) {
  const id = repostActionPostId;
  if (!id) return;
  if (type === 'quote') {
    closeRepostAction();
    openQuoteComposer(id);
    return;
  }
  const p = findPostAny(id); if (!p) return;
  try {
    if (p.reposted) {
      const r = await apiRequest('/posts/' + encodeURIComponent(id) + '/repost', { method: 'DELETE' });
      applyPostUpdate(id, function (x) { x.reposted = !!r.reposted; x.reposts = Number(r.reposts ?? x.reposts ?? 0); return x; });
      showToast('Repost removed');
    } else {
      const r = await apiRequest('/posts/' + encodeURIComponent(id) + '/repost', { method: 'POST' });
      applyPostUpdate(id, function (x) { x.reposted = !!r.reposted; x.reposts = Number(r.reposts ?? x.reposts ?? 0); return x; });
      showToast('🔁 Reposted');
    }
  } catch (e) {
    showToast('❌ ' + (e && e.message ? e.message : 'Repost failed'));
  } finally {
    closeRepostAction();
  }
}
toggleRepost = function (id) { openRepostAction(id); };
async function toggleBookmark(id) {
  const p = findPostAny(id); const b = !(p && p.bookmarked);
  try {
    const r = await apiRequest('/posts/' + encodeURIComponent(id) + '/bookmark', { method: b ? 'POST' : 'DELETE' });
    applyPostUpdate(id, function (x) { x.bookmarked = !!r.bookmarked; return x; });
    if (!r.bookmarked) bookmarkPostsData = bookmarkPostsData.filter(function (x) { return String(x.id) !== String(id); });
    if (r.bookmarked && p && !bookmarkPostsData.some(function (x) { return String(x.id) === String(id); })) bookmarkPostsData.unshift(Object.assign({}, p, { bookmarked: true }));
  } catch (e) { showToast('❌ ' + (e && e.message ? e.message : 'Bookmark failed')); }
}
async function sharePost(id) {
  const u = window.location.origin + '/post/' + encodeURIComponent(id);
  try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(u); showToast('🔗 Link copied'); return; } } catch (_) {}
  showToast('⚠️ Clipboard blocked. Share: ' + u);
}
async function deletePost(id) {
  if (String(deleteConfirmPostId) !== String(id)) {
    deleteConfirmPostId = String(id);
    if (deleteConfirmTimer) clearTimeout(deleteConfirmTimer);
    deleteConfirmTimer = setTimeout(function () { deleteConfirmPostId = ''; }, 4000);
    showToast('Tap delete again to confirm');
    return;
  }
  deleteConfirmPostId = '';
  if (deleteConfirmTimer) { clearTimeout(deleteConfirmTimer); deleteConfirmTimer = null; }
  try {
    await apiRequest('/posts/' + encodeURIComponent(id), { method: 'DELETE' });
    feedPosts = feedPosts.filter(function (p) { return String(p.id) !== String(id); });
    profilePostsData = profilePostsData.filter(function (p) { return String(p.id) !== String(id); });
    bookmarkPostsData = bookmarkPostsData.filter(function (p) { return String(p.id) !== String(id); });
    renderFeed(); renderProfilePosts();
    const b = document.getElementById('bookmark-list');
    if (b) b.innerHTML = bookmarkPostsData.length ? bookmarkPostsData.map(renderPost).join('') : '<div style="padding:24px;color:var(--x-muted);">No bookmarks yet.</div>';
    showToast('🗑️ Post deleted');
  } catch (e) {
    showToast('❌ ' + (e && e.message ? e.message : 'Delete failed'));
  }
}

async function loadProfileTabData(userId, tab) {
  const t = String(tab || 'posts');
  const map = { posts: 'posts', replies: 'replies', likes: 'likes', media: 'media' };
  const path = '/users/' + encodeURIComponent(userId) + '/' + (map[t] || 'posts');
  const r = await apiRequest(path);
  profilePostsData = Array.isArray(r.posts) ? r.posts.map(normPost) : [];
  renderProfilePosts();
}
function setProfileTab(tab, el) {
  currentProfileTab = String(tab || 'posts');
  const tabs = document.querySelectorAll('#view-profile .feed-tabs .feed-tab');
  tabs.forEach(function (x) { x.classList.remove('active'); });
  if (el) el.classList.add('active');
  if (currentProfileData && currentProfileData.id) loadProfileTabData(currentProfileData.id, currentProfileTab).catch(function () {});
}
function refreshProfileMedia(profile) {
  const p = profile || {};
  const name = p.name || currentUser.name || 'JIS Student';
  setAvatarVisual('profile-av-initials', initialsFromName(name), mediaUrl(p.avatarUrl || ''));
  setBannerVisual('profile-cover', mediaUrl(p.bannerUrl || ''));
}
function openEditProfileModal() {
  if (!currentProfileData || !currentProfileData.isSelf) return;
  editProfileAvatarFile = null;
  editProfileBannerFile = null;
  editProfileAvatarPreview = mediaUrl(currentProfileData.avatarUrl || currentUser.avatarUrl || '');
  editProfileBannerPreview = mediaUrl(currentProfileData.bannerUrl || currentUser.bannerUrl || '');
  const nameInput = document.getElementById('edit-profile-name');
  const bioInput = document.getElementById('edit-profile-bio');
  if (nameInput) nameInput.value = currentProfileData.name || currentUser.name || '';
  if (bioInput) bioInput.value = currentProfileData.bio || '';
  refreshEditProfilePreview();
  const modal = document.getElementById('edit-profile-modal');
  if (modal) modal.classList.remove('hidden');
}
function closeEditProfileModal(e, force) {
  if (editProfileSaving && !force) return;
  if (e && !e.target.classList.contains('modal-overlay')) return;
  const modal = document.getElementById('edit-profile-modal');
  if (modal) modal.classList.add('hidden');
}
function refreshEditProfilePreview() {
  const nameInput = document.getElementById('edit-profile-name');
  const name = nameInput && nameInput.value ? nameInput.value : (currentProfileData && currentProfileData.name) || currentUser.name;
  setAvatarVisual('edit-avatar-picker', initialsFromName(name), editProfileAvatarPreview);
  setBannerVisual('edit-banner-picker', editProfileBannerPreview);
}
function setEditProfileImage(kind, file) {
  if (!file) return;
  const isImageMime = /^image\//i.test(file.type || '');
  const isImageExt = /\.(jpg|jpeg|png|webp|gif|heic|heif)$/i.test(file.name || '');
  if (!isImageMime && !isImageExt) {
    showToast('⚠️ Upload image file only');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showToast('⚠️ Max image size is 10MB');
    return;
  }
  const reader = new FileReader();
  reader.onload = function () {
    const previewUrl = String(reader.result || '');
    if (kind === 'avatar') {
      editProfileAvatarFile = file;
      editProfileAvatarPreview = previewUrl;
    } else {
      editProfileBannerFile = file;
      editProfileBannerPreview = previewUrl;
    }
    refreshEditProfilePreview();
  };
  reader.readAsDataURL(file);
}
async function saveProfileEdit() {
  if (!currentProfileData || !currentProfileData.isSelf || editProfileSaving) return;
  const nameInput = document.getElementById('edit-profile-name');
  const bioInput = document.getElementById('edit-profile-bio');
  const fullName = String((nameInput && nameInput.value) || '').trim();
  const bio = String((bioInput && bioInput.value) || '').trim();
  if (fullName.length < 2) {
    showToast('⚠️ Name should be at least 2 characters');
    return;
  }
  const saveBtn = document.getElementById('edit-profile-save-btn');
  editProfileSaving = true;
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
  }
  try {
    const base = await apiRequest('/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ fullName: fullName, bio: bio })
    });
    let nextProfile = base.profile || currentProfileData;
    if (editProfileAvatarFile || editProfileBannerFile) {
      const formData = new FormData();
      if (editProfileAvatarFile) formData.append('avatar', editProfileAvatarFile);
      if (editProfileBannerFile) formData.append('banner', editProfileBannerFile);
      const mediaUpdate = await apiRequest('/users/me/profile-media', {
        method: 'PATCH',
        body: formData
      });
      nextProfile = mediaUpdate.profile || nextProfile;
    }
    currentProfileData = Object.assign({}, currentProfileData || {}, nextProfile, { isSelf: true });
    currentUser.name = currentProfileData.name || currentUser.name;
    currentUser.handle = currentProfileData.handle || currentUser.handle;
    currentUser.initials = initialsFromName(currentUser.name);
    currentUser.avatarUrl = currentProfileData.avatarUrl || '';
    currentUser.bannerUrl = currentProfileData.bannerUrl || '';
    applyCurrentUserToUI();
    refreshProfileMedia(currentProfileData);
    closeEditProfileModal(null, true);
    await loadProfile(currentUser.id || currentProfileData.id);
    showToast('✅ Profile updated');
  } catch (e) {
    showToast('❌ ' + (e && e.message ? e.message : 'Update failed'));
  } finally {
    editProfileSaving = false;
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
    }
  }
}
async function loadProfile(userId) {
  const isMe = String(userId) === String((currentUser && currentUser.id) || '');
  const p = await apiRequest(isMe ? '/users/me' : ('/users/' + encodeURIComponent(userId) + '/profile'));
  currentProfileData = p.profile || null;
  const pr = currentProfileData || {}; const inst = pr.institute && pr.institute.shortCode ? pr.institute.shortCode : 'JIS';
  document.getElementById('profile-header-name').textContent = pr.name || currentUser.name;
  document.getElementById('profile-header-post-count').textContent = String(pr.posts || 0) + ' posts';
  document.getElementById('profile-display-name').textContent = pr.name || currentUser.name;
  document.getElementById('profile-display-handle').innerHTML = esc(pr.handle || currentUser.handle) + ' · <span class="institute-badge">' + esc(inst) + '</span>';
  document.getElementById('profile-bio').textContent = pr.bio || 'No bio yet.';
  document.getElementById('profile-post-count').textContent = String(pr.posts || 0);
  document.getElementById('profile-following-count').textContent = String(pr.following || 0);
  document.getElementById('profile-follower-count').textContent = String(pr.followers || 0);
  refreshProfileMedia(pr);
  if (pr.isSelf) {
    currentUser.name = pr.name || currentUser.name;
    currentUser.handle = pr.handle || currentUser.handle;
    currentUser.initials = initialsFromName(currentUser.name);
    currentUser.institute = inst || currentUser.institute;
    currentUser.avatarUrl = pr.avatarUrl || currentUser.avatarUrl || '';
    currentUser.bannerUrl = pr.bannerUrl || currentUser.bannerUrl || '';
    applyCurrentUserToUI();
  }
  document.getElementById('profile-action-btn').textContent = pr.isSelf ? 'Edit profile' : followButtonLabel(!!pr.isFollowing, !!pr.followsYou);
  document.getElementById('profile-message-btn').classList.toggle('hidden', !!pr.isSelf);
  const activeEl = document.getElementById('profile-tab-' + currentProfileTab) || document.getElementById('profile-tab-posts');
  setProfileTab(currentProfileTab, activeEl);
}
async function openProfile(userId) { try { await loadProfile(userId); showView('profile'); } catch (e) { showToast('❌ ' + (e && e.message ? e.message : 'Profile load failed')); } }
async function handleProfileAction() {
  if (!currentProfileData) return;
  if (currentProfileData.isSelf) {
    openEditProfileModal();
    return;
  }
  try { const r = await apiRequest('/users/' + encodeURIComponent(currentProfileData.id) + '/follow', { method: currentProfileData.isFollowing ? 'DELETE' : 'POST' }); currentProfileData.isFollowing = !!r.following; currentProfileData.followsYou = !!r.followsYou; currentProfileData.followers = Number(r.followers ?? currentProfileData.followers ?? 0); document.getElementById('profile-action-btn').textContent = followButtonLabel(currentProfileData.isFollowing, currentProfileData.followsYou); document.getElementById('profile-follower-count').textContent = String(currentProfileData.followers); } catch (e) { showToast('❌ ' + (e && e.message ? e.message : 'Follow failed')); }
}
async function startChatFromProfile() { if (!currentProfileData || currentProfileData.isSelf) return; await startChatWithUser(currentProfileData.id); }

async function loadBookmarks() { try { const r = await apiRequest('/users/me/bookmarks'); bookmarkPostsData = Array.isArray(r.posts) ? r.posts.map(normPost) : []; } catch (_) { bookmarkPostsData = []; } }
async function loadNotifications(markRead) { try { const r = await apiRequest('/notifications'); const list = Array.isArray(r.notifications) ? r.notifications : []; document.getElementById('notif-list').innerHTML = list.length ? list.map(function (n) { return '<div class="notif-item"><div class="notif-icon">🔔</div><div style="flex:1;"><div class="notif-text">' + esc(n.message || 'Notification') + '</div><div class="notif-time">' + esc(n.createdAt || '') + '</div></div></div>'; }).join('') : '<div style="padding:24px;color:var(--x-muted);">No notifications yet.</div>'; const c = Number(r.unreadCount || 0); const b = document.getElementById('notif-badge'); if (b) { b.style.display = c > 0 ? 'inline-flex' : 'none'; b.textContent = c > 99 ? '99+' : String(c); } if (markRead && c > 0) await apiRequest('/notifications/read-all', { method: 'PATCH' }); } catch (_) {} }
function renderEvents() { const e = document.getElementById('events-list'); if (!e) return; e.innerHTML = '<div class="panel-card"><div class="panel-title">Campus Events</div><div style="font-size:14px;color:var(--x-muted);line-height:1.6;">Use this tab for college event announcements and reminders.</div><button class="submit-btn" style="margin-top:12px;" onclick="showView(\'feed\');document.getElementById(\'compose-inline\').value=\'Campus event update #JIS\';updateChar();">Post Event Update</button></div>'; }
function renderCommunitiesPage() {
  const box = document.getElementById('community-cards');
  if (!box) return;
  box.innerHTML = communityCatalog.map(function (c) {
    const joined = !!communityState[c.id];
    return '<div class="x-card">' +
      '<div class="x-card-title">' + esc(c.title) + '</div>' +
      '<div class="x-card-copy">' + esc(c.about) + '</div>' +
      '<div class="x-card-meta"><span>' + esc(c.members) + ' members</span>' +
      '<button class="x-card-btn ' + (joined ? 'active' : '') + '" onclick="toggleCommunityJoin(\'' + esc(c.id) + '\')">' + (joined ? 'Joined' : 'Join') + '</button>' +
      '</div></div>';
  }).join('');
}
function toggleCommunityJoin(id) {
  const key = String(id || '');
  communityState[key] = !communityState[key];
  renderCommunitiesPage();
  showToast(communityState[key] ? '✅ Joined community' : 'Left community');
}
function renderListsPage() {
  const box = document.getElementById('list-cards');
  if (!box) return;
  box.innerHTML = listCatalog.map(function (l) {
    const following = !!listState[l.id];
    return '<div class="x-card">' +
      '<div class="x-card-title">' + esc(l.title) + '</div>' +
      '<div class="x-card-copy">' + esc(l.about) + '</div>' +
      '<div class="x-card-meta"><span>' + esc(l.owner) + ' · ' + esc(l.followers) + ' followers</span>' +
      '<button class="x-card-btn ' + (following ? 'active' : '') + '" onclick="toggleListFollow(\'' + esc(l.id) + '\')">' + (following ? 'Following' : 'Follow List') + '</button>' +
      '</div></div>';
  }).join('');
}
function toggleListFollow(id) {
  const key = String(id || '');
  listState[key] = !listState[key];
  renderListsPage();
  showToast(listState[key] ? '📋 List followed' : 'List unfollowed');
}
function renderPremiumPage() {
  const box = document.getElementById('premium-cards');
  if (!box) return;
  box.innerHTML = premiumCatalog.map(function (p) {
    const active = premiumState.plan === p.id;
    return '<div class="x-card">' +
      '<div class="x-card-title">' + esc(p.title) + '</div>' +
      '<div class="x-card-copy">' + esc(p.about) + '</div>' +
      '<div class="x-card-meta"><span>' + esc(p.price) + '</span>' +
      '<button class="x-card-btn ' + (active ? 'active' : '') + '" onclick="setPremiumPlan(\'' + esc(p.id) + '\')">' + (active ? 'Current Plan' : 'Choose Plan') + '</button>' +
      '</div></div>';
  }).join('');
}
function setPremiumPlan(id) {
  premiumState.plan = String(id || '');
  renderPremiumPage();
  showToast('⭐ Premium plan updated');
}

showView = async function (view) {
  ['feed','explore','notif','chat','profile','bookmarks','events','communities','lists','premium'].forEach(function (v) {
    const el = document.getElementById('view-' + v); if (el) { el.classList.add('hidden'); el.style.removeProperty('display'); }
    const nav = document.getElementById('nav-' + v); if (nav) nav.classList.remove('active');
  });
  const t = document.getElementById('view-' + view); if (t) { t.classList.remove('hidden'); if (view === 'chat') t.style.display = 'block'; }
  const nav = document.getElementById('nav-' + view); if (nav) nav.classList.add('active');
  const rp = document.getElementById('right-panel'); if (rp) rp.style.display = view === 'chat' ? 'none' : '';
  if (view === 'feed') await loadFeedFromApi('for-you');
  if (view === 'profile') await loadProfile((currentProfileData && currentProfileData.id) || (currentUser && currentUser.id));
  if (view === 'notif') await loadNotifications(true);
  if (view === 'bookmarks') { await loadBookmarks(); document.getElementById('bookmark-list').innerHTML = bookmarkPostsData.length ? bookmarkPostsData.map(renderPost).join('') : '<div style="padding:24px;color:var(--x-muted);">No bookmarks yet.</div>'; }
  if (view === 'events') renderEvents();
  if (view === 'communities') renderCommunitiesPage();
  if (view === 'lists') renderListsPage();
  if (view === 'premium') renderPremiumPage();
  if (view === 'chat') await loadChats();
};

openComposeModal = function () { document.getElementById('compose-modal').classList.remove('hidden'); setComposeContext(); };
closeComposeModal = function (e) { if (!e || e.target.classList.contains('modal-overlay')) { document.getElementById('compose-modal').classList.add('hidden'); composeReplyPostId = ''; composeQuotePostId = ''; setComposeContext(); } };

let chatConversations = [];
let currentChatId = '';
let activeChatProfileUserId = '';
function chatIcon(v) { return initialsFromName(v || 'Chat'); }
function getChatDisplayParticipant(chat) {
  if (!chat || !Array.isArray(chat.participants) || !chat.participants.length) return null;
  const meId = String((currentUser && currentUser.id) || '');
  const other = chat.participants.find(function (p) { return String(p.id || '') !== meId; });
  return other || chat.participants[0] || null;
}
function getChatProfileUserId(chat) {
  if (!chat || chat.isGroup) return '';
  const p = getChatDisplayParticipant(chat);
  return p && p.id ? String(p.id) : '';
}
function chatAvatarData(chat) {
  const p = getChatDisplayParticipant(chat);
  if (p) {
    return {
      initials: initialsFromName(p.name || chat.title || 'Chat'),
      imageUrl: p.avatarUrl || ''
    };
  }
  return { initials: chatIcon((chat && chat.title) || 'Chat'), imageUrl: '' };
}
function openChatProfileFromConversation(conversationId, evt) {
  if (evt && evt.stopPropagation) evt.stopPropagation();
  const chat = chatConversations.find(function (c) { return String(c.id) === String(conversationId); }) || null;
  const profileUserId = getChatProfileUserId(chat);
  if (!profileUserId) {
    showToast('⚠️ Profile not available for this conversation');
    return;
  }
  openProfile(profileUserId);
}
function openActiveChatProfile() {
  if (!activeChatProfileUserId) {
    showToast('⚠️ Select a direct message first');
    return;
  }
  openProfile(activeChatProfileUserId);
}
async function loadChats() {
  try {
    const r = await apiRequest('/chats');
    chatConversations = Array.isArray(r.conversations) ? r.conversations : [];
    const totalUnread = chatConversations.reduce(function (s, c) { return s + Number(c.unreadCount || 0); }, 0);
    const chatBadge = document.getElementById('chat-badge'); if (chatBadge) { chatBadge.style.display = totalUnread > 0 ? 'inline-flex' : 'none'; chatBadge.textContent = totalUnread > 99 ? '99+' : String(totalUnread); }
    const list = document.getElementById('chat-list-items');
    if (!list) return;
    list.innerHTML = chatConversations.length ? chatConversations.map(function (c) {
      const active = String(c.id) === String(currentChatId) ? ' active' : '';
      const last = c.lastMessage && c.lastMessage.content ? c.lastMessage.content : 'No messages yet';
      const t = c.lastMessage && c.lastMessage.createdAt ? String(c.lastMessage.createdAt) : '';
      const profileUserId = getChatProfileUserId(c);
      const avatarOpen = profileUserId ? ' onclick="openChatProfileFromConversation(\'' + esc(c.id) + '\', event); return false;"' : '';
      const nameOpen = profileUserId ? ' onclick="openChatProfileFromConversation(\'' + esc(c.id) + '\', event); return false;"' : '';
      const av = chatAvatarData(c);
      return '<div class="chat-item' + active + '" onclick="openConversation(\'' + esc(c.id) + '\')">' + avatarCircleHtml('av-sm', av.initials, av.imageUrl, 'cursor:' + (profileUserId ? 'pointer' : 'default') + ';font-size:12px;', avatarOpen.trim()) + '<div class="chat-preview"><div class="chat-preview-name" style="cursor:' + (profileUserId ? 'pointer' : 'default') + ';"' + nameOpen + '>' + esc(c.title || 'Chat') + '</div><div class="chat-preview-msg">' + esc(last) + '</div></div><div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;"><span class="chat-time">' + esc(t) + '</span>' + (c.unreadCount ? '<span class="chat-unread">' + (Number(c.unreadCount) > 9 ? '9+' : Number(c.unreadCount)) + '</span>' : '') + '</div></div>';
    }).join('') : '<div style="padding:16px;color:var(--x-muted);">No conversations yet.</div>';
    if (!currentChatId && chatConversations.length) await openConversation(chatConversations[0].id);
  } catch (_) {}
}
function renderChatMedia(m) {
  const u = mediaUrl(m.mediaUrl || ''); if (!u) return '';
  const t = String(m.type || '').toUpperCase();
  if (t === 'IMAGE') return '<div style="margin-top:8px;"><img src="' + esc(u) + '" style="max-width:220px;border-radius:12px;border:1px solid var(--x-border);"></div>';
  if (/(mp4|webm|mov|mkv)$/i.test(u)) return '<div style="margin-top:8px;"><video controls src="' + esc(u) + '" style="max-width:220px;border-radius:12px;border:1px solid var(--x-border);"></video></div>';
  if (/(mp3|wav|ogg|m4a|aac|flac)$/i.test(u)) return '<div style="margin-top:8px;"><audio controls src="' + esc(u) + '" style="max-width:220px;"></audio></div>';
  return '<div style="margin-top:8px;"><a style="color:#fff;" target="_blank" href="' + esc(u) + '">📎 Open attachment</a></div>';
}
async function openConversation(id) {
  currentChatId = String(id);
  const chat = chatConversations.find(function (c) { return String(c.id) === currentChatId; }) || {};
  activeChatProfileUserId = getChatProfileUserId(chat);
  document.getElementById('chat-name').textContent = chat.title || 'Chat';
  document.getElementById('chat-sub').textContent = chat.isGroup ? 'Group conversation' : (activeChatProfileUserId ? 'Direct conversation · Tap name/avatar to open profile' : 'Direct conversation');
  const headAv = chatAvatarData(chat);
  setAvatarVisual('chat-av', headAv.initials, mediaUrl(headAv.imageUrl || ''));
  await loadChats();
  try {
    const r = await apiRequest('/chats/' + encodeURIComponent(id) + '/messages?limit=80');
    const msgs = Array.isArray(r.messages) ? r.messages : [];
    const mbox = document.getElementById('chat-messages');
    mbox.innerHTML = msgs.length ? msgs.map(function (m) {
      const sent = String(m.senderId) === String(currentUser.id);
      return '<div class="msg ' + (sent ? 'sent' : 'recv') + '"><div class="msg-bubble">' + (m.content ? esc(m.content) : '') + renderChatMedia(m) + '</div><div class="msg-time">' + esc(String(m.createdAt || '')) + '</div></div>';
    }).join('') : '<div style="color:var(--x-muted);">No messages yet.</div>';
    mbox.scrollTop = mbox.scrollHeight;
    await apiRequest('/chats/' + encodeURIComponent(id) + '/read', { method: 'PATCH' });
  } catch (_) {}
}
async function startChatWithUser(userId) {
  try { const r = await apiRequest('/chats', { method: 'POST', body: JSON.stringify({ participantIds: [userId], isGroup: false }) }); await showView('chat'); if (r && r.conversation && r.conversation.id) await openConversation(r.conversation.id); } catch (e) { showToast('❌ ' + (e && e.message ? e.message : 'Chat failed')); }
}
sendChatMsg = function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMsgBtn(); } };
sendChatMsgBtn = async function () {
  const input = document.getElementById('chat-input-box'); const txt = (input.value || '').trim(); if (!txt) return;
  if (!currentChatId) { showToast('⚠️ Select a chat first'); return; }
  try { await apiRequest('/chats/' + encodeURIComponent(currentChatId) + '/messages', { method: 'POST', body: JSON.stringify({ content: txt }) }); input.value = ''; await openConversation(currentChatId); } catch (e) { showToast('❌ ' + (e && e.message ? e.message : 'Message failed')); }
};
insertChatEmoji = function () { const i = document.getElementById('chat-input-box'); i.value += '😊'; i.focus(); };
function uploadChatAttachment() { if (!currentChatId) { showToast('⚠️ Select a chat first'); return; } openFilePickerById('chat-attachment-input'); }

async function loadSuggestions() {
  try {
    const r = await apiRequest('/users/suggestions?limit=6');
    const users = Array.isArray(r.users) ? r.users : [];
    const c = document.getElementById('who-to-follow-list'); if (!c) return;
    c.innerHTML = users.length ? users.map(function (u) {
      const av = mediaUrl(u.avatarUrl || '');
      const avatarHtml = av
        ? '<img class="avatar av-xs" src="' + esc(av) + '" alt="avatar" style="object-fit:cover;cursor:pointer;" onclick="openProfile(\'' + esc(u.id) + '\')">'
        : '<div class="av-placeholder av-xs avatar" style="font-size:12px;font-weight:700;background:linear-gradient(135deg,#1d9bf0,#7856ff);border-radius:50%;cursor:pointer;" onclick="openProfile(\'' + esc(u.id) + '\')">' + esc(initialsFromName(u.name)) + '</div>';
      return '<div class="suggest-item">' + avatarHtml + '<div class="user-info" style="cursor:pointer;" onclick="openProfile(\'' + esc(u.id) + '\')"><div class="user-name">' + esc(u.name) + (u.verified ? ' ✅' : '') + '</div><div class="user-handle">' + esc(u.handle) + ' · ' + esc(u.institute || 'JIS') + '</div></div><button class="follow-btn ' + (u.isFollowing ? 'following' : '') + '" data-follows-you="' + (u.followsYou ? '1' : '0') + '" onclick="toggleSuggestionFollow(\'' + esc(u.id) + '\',this)">' + followButtonLabel(!!u.isFollowing, !!u.followsYou) + '</button></div>';
    }).join('') : '<div style="color:var(--x-muted);font-size:13px;">No suggestions.</div>';
  } catch (_) {}
}
async function toggleSuggestionFollow(userId, btn) {
  const f = btn.classList.contains('following');
  try { const r = await apiRequest('/users/' + encodeURIComponent(userId) + '/follow', { method: f ? 'DELETE' : 'POST' }); const followsYou = !!r.followsYou; btn.dataset.followsYou = followsYou ? '1' : '0'; btn.classList.toggle('following', !!r.following); btn.textContent = followButtonLabel(!!r.following, followsYou); } catch (_) {}
}
async function loadTrends() { try { const r = await apiRequest('/trends'); const t = Array.isArray(r.trends) ? r.trends : []; const h = t.map(function (x) { return '<div class="trend-item"><div class="trend-tag">Trending at JIS</div><div class="trend-name">' + esc(x.hashtag || '#CampusX') + '</div><div class="trend-posts">' + Number(x.posts || 0).toLocaleString() + ' posts</div></div>'; }).join(''); const r1 = document.getElementById('right-trend-list'); const r2 = document.getElementById('explore-trend-list'); if (r1 && h) r1.innerHTML = h; if (r2 && h) r2.innerHTML = h; } catch (_) {} }
async function searchExplore(q) { const box = document.getElementById('explore-search-results'); if (!box) return; if (!q) { box.style.display = 'none'; box.innerHTML = ''; return; } try { const r = await apiRequest('/users/search?q=' + encodeURIComponent(q)); const users = Array.isArray(r.users) ? r.users : []; box.style.display = 'block'; box.innerHTML = users.length ? users.map(function (u) { return '<div class="suggest-item" style="border-bottom:1px solid var(--x-border);padding:10px 0;"><div class="av-placeholder av-xs avatar" style="font-size:12px;font-weight:700;background:linear-gradient(135deg,#1d9bf0,#7856ff);border-radius:50%;">' + esc(initialsFromName(u.name)) + '</div><div class="user-info" style="cursor:pointer;" onclick="openProfile(\'' + esc(u.id) + '\')"><div class="user-name">' + esc(u.name) + (u.verified ? ' ✅' : '') + '</div><div class="user-handle">' + esc(u.handle) + ' · ' + esc(u.institute || 'JIS') + '</div></div><button class="follow-btn" onclick="startChatWithUser(\'' + esc(u.id) + '\')">Message</button></div>'; }).join('') : '<div style="color:var(--x-muted);font-size:14px;">No users found.</div>'; } catch (_) {} }

const inlineMediaInput = document.getElementById('inline-media-input');
if (inlineMediaInput && inlineMediaInput.dataset.bindFeature !== '1') { inlineMediaInput.addEventListener('change', function (e) { const fs = Array.from(e.target.files || []); fs.forEach(function (f) { if (inlineMediaFiles.length < 4) inlineMediaFiles.push(f); }); e.target.value = ''; renderComposerMediaPreview('inline'); updateChar(); }); inlineMediaInput.dataset.bindFeature = '1'; }
const modalMediaInput = document.getElementById('modal-media-input');
if (modalMediaInput && modalMediaInput.dataset.bindFeature !== '1') { modalMediaInput.addEventListener('change', function (e) { const fs = Array.from(e.target.files || []); fs.forEach(function (f) { if (modalMediaFiles.length < 4) modalMediaFiles.push(f); }); e.target.value = ''; renderComposerMediaPreview('modal'); updateModalChar(); }); modalMediaInput.dataset.bindFeature = '1'; }
const replyMediaInput = document.getElementById('reply-media-input');
if (replyMediaInput && replyMediaInput.dataset.bindFeature !== '1') {
  replyMediaInput.addEventListener('change', function (e) {
    const key = String(activeReplyMediaPostId || '');
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!key || !files.length) return;
    if (!Array.isArray(replyDraftMedia[key])) replyDraftMedia[key] = [];
    files.forEach(function (f) {
      if (replyDraftMedia[key].length < 4) replyDraftMedia[key].push(f);
    });
    renderFeed(); renderProfilePosts();
    const b = document.getElementById('bookmark-list');
    if (b) b.innerHTML = bookmarkPostsData.length ? bookmarkPostsData.map(renderPost).join('') : '<div style="padding:24px;color:var(--x-muted);">No bookmarks yet.</div>';
    setTimeout(function () { const box = document.getElementById('reply-box-' + key); if (box) box.focus(); }, 30);
  });
  replyMediaInput.dataset.bindFeature = '1';
}
const chatAttachInput = document.getElementById('chat-attachment-input');
if (chatAttachInput && chatAttachInput.dataset.bindFeature !== '1') { chatAttachInput.addEventListener('change', async function (e) { const file = e.target.files && e.target.files[0]; e.target.value = ''; if (!file || !currentChatId) return; try { const fd = new FormData(); fd.append('media', file); const up = await apiRequest('/chats/uploads', { method: 'POST', body: fd }); const txt = (document.getElementById('chat-input-box').value || '').trim(); await apiRequest('/chats/' + encodeURIComponent(currentChatId) + '/messages', { method: 'POST', body: JSON.stringify({ content: txt, mediaUrl: up.url, type: up.type }) }); document.getElementById('chat-input-box').value = ''; await openConversation(currentChatId); showToast('📎 Attachment sent'); } catch (err) { showToast('❌ ' + (err && err.message ? err.message : 'Attachment failed')); } }); chatAttachInput.dataset.bindFeature = '1'; }
const exploreInput = document.getElementById('explore-search-input');
if (exploreInput && exploreInput.dataset.bindFeature !== '1') { exploreInput.addEventListener('input', function () { if (exploreSearchTimer) clearTimeout(exploreSearchTimer); const q = this.value.trim(); exploreSearchTimer = setTimeout(function () { searchExplore(q); }, 250); }); exploreInput.dataset.bindFeature = '1'; }
const rightSearch = document.getElementById('right-search-input');
if (rightSearch && rightSearch.dataset.bindFeature !== '1') { rightSearch.addEventListener('keydown', async function (e) { if (e.key !== 'Enter') return; const q = this.value.trim(); if (!q) return; showView('explore'); const ei = document.getElementById('explore-search-input'); if (ei) ei.value = q; await searchExplore(q); }); rightSearch.dataset.bindFeature = '1'; }

loadTrends(); loadSuggestions();
loadInstitutes();
