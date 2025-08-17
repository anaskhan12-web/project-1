(function(){
  const STORAGE_KEYS = {
    USERS: 'ta_users',
    CURRENT_USER: 'ta_current_user',
    ROSTER: 'ta_roster',
    ATTENDANCE_PREFIX: 'ta_attendance_',
    PAYMENTS: 'ta_payments'
  };

  function showToast(message) {
    let el = document.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2200);
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getUsers() {
    return readJson(STORAGE_KEYS.USERS, []);
  }

  function setUsers(users) {
    writeJson(STORAGE_KEYS.USERS, users);
  }

  function getCurrentUserEmail() {
    return localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
  }

  function setCurrentUserEmail(email) {
    if (email) localStorage.setItem(STORAGE_KEYS.CURRENT_USER, email);
    else localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  }

  function getRoster() {
    return readJson(STORAGE_KEYS.ROSTER, []);
  }

  function setRoster(roster) {
    writeJson(STORAGE_KEYS.ROSTER, roster);
  }

  function getAttendance(dateKey) {
    return readJson(STORAGE_KEYS.ATTENDANCE_PREFIX + dateKey, {});
  }

  function setAttendance(dateKey, data) {
    writeJson(STORAGE_KEYS.ATTENDANCE_PREFIX + dateKey, data);
  }

  function getPayments() {
    return readJson(STORAGE_KEYS.PAYMENTS, []);
  }

  function setPayments(list) {
    writeJson(STORAGE_KEYS.PAYMENTS, list);
  }

  function formatDateKey(date) {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }

  function initials(name) {
    return (name||'').split(/\s+/).filter(Boolean).map(s=>s[0]?.toUpperCase()).slice(0,2).join('') || 'TA';
  }

  function setupNavActiveLink() {
    const href = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a').forEach(a => {
      const file = a.getAttribute('href');
      if (file === href || (href === 'index.html' && file === './')) {
        a.classList.add('active');
      }
    });
  }

  function setupAuthNav() {
    const email = getCurrentUserEmail();
    const user = getUsers().find(u => u.email === email);
    const authSlot = document.querySelector('#auth-slot');
    if (!authSlot) return;

    if (user) {
      authSlot.innerHTML = `
        <div class="inline">
          <span class="badge" title="${user.fullName}">${initials(user.fullName)}</span>
          <button class="btn" id="logout-btn">Logout</button>
        </div>
      `;
      const btn = document.querySelector('#logout-btn');
      if (btn) btn.addEventListener('click', () => {
        setCurrentUserEmail(null);
        showToast('Logged out');
        setTimeout(()=> location.href = 'index.html', 600);
      });
    } else {
      authSlot.innerHTML = `
        <a class="btn" href="login.html">Login</a>
        <a class="btn primary" href="signup.html">Sign up</a>
      `;
    }
  }

  function requireAuth(redirectBackTo) {
    const email = getCurrentUserEmail();
    if (!email) {
      const back = redirectBackTo || location.pathname.split('/').pop();
      location.href = `login.html?next=${encodeURIComponent(back)}`;
      return false;
    }
    return true;
  }

  function handleSignup() {
    const form = document.querySelector('#signup-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fullName = form.fullName.value.trim();
      const email = form.email.value.trim().toLowerCase();
      const password = form.password.value;
      const course = form.course.value;

      if (!fullName || !email || !password) {
        showToast('Please fill all required fields');
        return;
      }

      const users = getUsers();
      if (users.some(u => u.email === email)) {
        showToast('Account already exists. Please login.');
        return;
      }

      users.push({ fullName, email, password, course, createdAt: Date.now() });
      setUsers(users);
      setCurrentUserEmail(email);
      showToast('Welcome to TEAM ACADEMY!');
      const next = new URLSearchParams(location.search).get('next') || 'index.html';
      setTimeout(()=> location.href = next, 800);
    });

    const toggle = document.querySelector('#toggle-signup-password');
    if (toggle) toggle.addEventListener('click', () => {
      const input = document.querySelector('#signup-password');
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  }

  function handleLogin() {
    const form = document.querySelector('#login-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = form.email.value.trim().toLowerCase();
      const password = form.password.value;
      const users = getUsers();
      const user = users.find(u => u.email === email && u.password === password);
      if (!user) {
        showToast('Invalid credentials');
        return;
      }
      setCurrentUserEmail(user.email);
      showToast('Welcome back!');
      const next = new URLSearchParams(location.search).get('next') || 'index.html';
      setTimeout(()=> location.href = next, 600);
    });

    const toggle = document.querySelector('#toggle-login-password');
    if (toggle) toggle.addEventListener('click', () => {
      const input = document.querySelector('#login-password');
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  }

  function handleAttendance() {
    const page = document.querySelector('[data-page="attendance"]');
    if (!page) return;
    if (!requireAuth('attendance.html')) return;

    const dateInput = document.querySelector('#attendance-date');
    const rosterList = document.querySelector('#roster-list');
    const addStudentForm = document.querySelector('#add-student-form');

    if (dateInput) {
      if (!dateInput.value) {
        dateInput.valueAsDate = new Date();
      }
      dateInput.addEventListener('change', () => renderAttendance());
    }

    function renderRoster() {
      const roster = getRoster();
      const dateKey = formatDateKey(dateInput.value || new Date());
      const attendanceMap = getAttendance(dateKey);
      rosterList.innerHTML = '';
      roster.forEach((student, index) => {
        const status = attendanceMap[student.id] || 'absent';
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${index+1}</td>
          <td>${student.name}</td>
          <td><span class="badge">${student.course || '-'}</span></td>
          <td>
            <div class="inline">
              <button class="btn ${status==='present'?'primary':''}" data-action="mark" data-id="${student.id}" data-value="present">Present</button>
              <button class="btn ${status==='absent'?'primary':''}" data-action="mark" data-id="${student.id}" data-value="absent">Absent</button>
            </div>
          </td>
        `;
        rosterList.appendChild(row);
      });
    }

    function renderAttendance() {
      renderRoster();
    }

    document.addEventListener('click', (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const action = target.getAttribute('data-action');
      if (action === 'mark') {
        const id = target.getAttribute('data-id');
        const value = target.getAttribute('data-value');
        const key = formatDateKey(dateInput.value || new Date());
        const data = getAttendance(key);
        data[id] = value;
        setAttendance(key, data);
        renderAttendance();
      }
    });

    if (addStudentForm) {
      addStudentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = addStudentForm.name.value.trim();
        const course = addStudentForm.course.value;
        if (!name) { showToast('Enter a student name'); return; }
        const roster = getRoster();
        const id = 'S' + Math.random().toString(36).slice(2,9).toUpperCase();
        roster.push({ id, name, course });
        setRoster(roster);
        addStudentForm.reset();
        showToast('Student added');
        renderAttendance();
      });
    }

    renderAttendance();
  }

  function handlePayments() {
    const page = document.querySelector('[data-page="fees"]');
    if (!page) return;
    if (!requireAuth('fees.html')) return;

    const roster = getRoster();
    const studentFilter = document.querySelector('#payment-student-filter');
    const studentInput = document.querySelector('#payment-student-input');
    const historyBody = document.querySelector('#payments-history');

    // Populate students
    const optionsHtml = roster.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    if (studentFilter) {
      studentFilter.innerHTML = '<option value="">All students</option>' + optionsHtml;
    }
    if (studentInput) {
      studentInput.innerHTML = '<option value="">Select student</option>' + optionsHtml;
    }

    function renderHistory() {
      const payments = getPayments();
      const filter = studentFilter?.value || '';
      const filtered = filter ? payments.filter(p => p.studentId === filter) : payments;
      historyBody.innerHTML = '';
      filtered.slice().reverse().forEach((p, i) => {
        const tr = document.createElement('tr');
        const stu = roster.find(s => s.id === p.studentId);
        tr.innerHTML = `
          <td>${i+1}</td>
          <td>${stu?stu.name:p.studentId}</td>
          <td>${p.course || '-'}</td>
          <td>₹ ${Number(p.amount).toFixed(2)}</td>
          <td>${new Date(p.createdAt).toLocaleString()}</td>
        `;
        historyBody.appendChild(tr);
      });
    }

    const form = document.querySelector('#payment-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const studentId = form.student.value;
        const course = form.course.value;
        const amount = parseFloat(form.amount.value);
        if (!studentId || !amount) { showToast('Select student and enter amount'); return; }
        const payments = getPayments();
        payments.push({ id: 'P' + Date.now(), studentId, course, amount, createdAt: Date.now() });
        setPayments(payments);
        showToast('Payment recorded');
        form.reset();
        renderHistory();
      });
    }

    if (studentFilter) studentFilter.addEventListener('change', renderHistory);

    renderHistory();
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupNavActiveLink();
    setupAuthNav();
    handleSignup();
    handleLogin();
    handleAttendance();
    handlePayments();
  });
})();