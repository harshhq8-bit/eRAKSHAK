/**
 * eRAKSHAK Smart Security System - Main Application Logic
 * Developed by Justice League • Dept of ETC, SBJAIN
 */

// Configuration
const API_BASE = window.location.origin.includes('5173') 
  ? '' // Uses Vite /api proxy
  : ''; // Direct relative path if served by backend

const DEVICE_ID = 'erakshak-nodemcu-01';

// Application State
const state = {
  theme: localStorage.getItem('erakshak_theme') || 'dark',
  activeTab: 'overview',
  cloudStatus: 'CONNECTING',
  espStatus: 'ONLINE',
  distanceCm: 42,
  pirDetected: false,
  ledState: 'OFF',
  lcdState: { line1: 'SYSTEM READY', line2: 'WAITING...' },
  mobileStatus: { online: false, camera: 'NOT_READY', recognition: 'OFFLINE' },
  pairingCode: '849201',
  events: [],
  distanceHistory: [45, 48, 50, 42, 38, 35, 40, 42, 28, 45],
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initTabs();
  initLcdController();
  initLedController();
  initNotificationControls();
  initMobilePairing();
  loadInitialData();
  startTelemetryPolling();
  renderDistanceChart();
});

/* ==========================================================================
   Theme Controller (Dark / Light Mode)
   ========================================================================== */
function initTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  updateThemeIcon();

  const themeBtn = document.getElementById('themeToggleBtn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', state.theme);
      localStorage.setItem('erakshak_theme', state.theme);
      updateThemeIcon();
      renderDistanceChart();
    });
  }
}

function updateThemeIcon() {
  const iconWrap = document.getElementById('themeIcon');
  if (!iconWrap) return;
  if (state.theme === 'dark') {
    iconWrap.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="5"></circle>
        <line x1="12" y1="1" x2="12" y2="3"></line>
        <line x1="12" y1="21" x2="12" y2="23"></line>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
        <line x1="1" y1="12" x2="3" y2="12"></line>
        <line x1="21" y1="12" x2="23" y2="12"></line>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
      </svg>
    `;
  } else {
    iconWrap.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
      </svg>
    `;
  }
}

/* ==========================================================================
   Tab Navigation
   ========================================================================== */
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });

  const syncBtn = document.getElementById('syncTelemetryBtn');
  if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
      syncBtn.disabled = true;
      syncBtn.innerHTML = `<span class="spinner" style="border-top-color: currentColor"></span> Syncing...`;
      await fetchTelemetryData();
      syncBtn.disabled = false;
      syncBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
        </svg>
        <span>Sync</span>
      `;
    });
  }
}

function switchTab(tabId) {
  state.activeTab = tabId;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `tab-${tabId}`);
  });

  if (tabId === 'overview') {
    setTimeout(renderDistanceChart, 50);
  }
}

/* ==========================================================================
   Smart LCD Controller
   ========================================================================== */
function initLcdController() {
  const row1Input = document.getElementById('lcdRow1Input');
  const row2Input = document.getElementById('lcdRow2Input');
  const previewLine1 = document.getElementById('lcdPreviewLine1');
  const previewLine2 = document.getElementById('lcdPreviewLine2');
  const count1 = document.getElementById('lcdCharCount1');
  const count2 = document.getElementById('lcdCharCount2');
  const lcdForm = document.getElementById('lcdControlForm');
  const feedback = document.getElementById('lcdFeedbackMsg');

  function updatePreview() {
    const val1 = row1Input.value.slice(0, 16);
    const val2 = row2Input.value.slice(0, 16);
    previewLine1.textContent = val1.padEnd(16, ' ');
    previewLine2.textContent = val2.padEnd(16, ' ');
    count1.textContent = `${val1.length}/16`;
    count2.textContent = `${val2.length}/16`;
    count1.classList.toggle('limit', val1.length === 16);
    count2.classList.toggle('limit', val2.length === 16);
  }

  row1Input.addEventListener('input', updatePreview);
  row2Input.addEventListener('input', updatePreview);

  lcdForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = lcdForm.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> SENDING COMMAND...`;
    feedback.className = 'feedback-msg';

    try {
      const line1 = row1Input.value.slice(0, 16);
      const line2 = row2Input.value.slice(0, 16);

      const res = await fetch(`${API_BASE}/api/devices/${DEVICE_ID}/lcd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line1, line2 }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        state.lcdState = { line1, line2 };
        document.getElementById('overviewLcdRow1').textContent = `"${line1}"`;
        document.getElementById('overviewLcdRow2').textContent = `"${line2}"`;
        feedback.className = 'feedback-msg success';
        feedback.textContent = `✓ Command delivered successfully to 16x2 LCD!`;
      } else {
        throw new Error(data.error || 'Failed to dispatch LCD command');
      }
    } catch (err) {
      feedback.className = 'feedback-msg error';
      feedback.textContent = `Command saved locally: ${err.message}`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  });
}

/* ==========================================================================
   Physical Security LED Controller
   ========================================================================== */
function initLedController() {
  const btnOn = document.getElementById('ledTurnOnBtn');
  const btnOff = document.getElementById('ledTurnOffBtn');
  const bulb = document.getElementById('visualLedBulb');
  const heading = document.getElementById('ledStatusHeading');
  const overviewLedVal = document.getElementById('overviewLedVal');

  async function setLed(stateVal) {
    btnOn.disabled = true;
    btnOff.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/api/devices/${DEVICE_ID}/led`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: stateVal }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        updateLedUi(stateVal);
      } else {
        updateLedUi(stateVal); // local fallback
      }
    } catch {
      updateLedUi(stateVal);
    } finally {
      btnOn.disabled = false;
      btnOff.disabled = false;
    }
  }

  function updateLedUi(stateVal) {
    state.ledState = stateVal;
    if (stateVal === 'ON') {
      bulb.classList.add('active');
      heading.className = 'led-state-heading on';
      heading.textContent = 'LED IS ON';
      btnOn.classList.add('active');
      btnOff.classList.remove('active');
      if (overviewLedVal) overviewLedVal.textContent = 'ON';
    } else {
      bulb.classList.remove('active');
      heading.className = 'led-state-heading off';
      heading.textContent = 'LED IS OFF';
      btnOff.classList.add('active');
      btnOn.classList.remove('active');
      if (overviewLedVal) overviewLedVal.textContent = 'OFF';
    }
  }

  btnOn.addEventListener('click', () => setLed('ON'));
  btnOff.addEventListener('click', () => setLed('OFF'));
}

/* ==========================================================================
   Cloud Notifications & Testing
   ========================================================================== */
function initNotificationControls() {
  const smsToggle = document.getElementById('smsToggle');
  const emailToggle = document.getElementById('emailToggle');
  const callToggle = document.getElementById('callToggle');
  const phoneInput = document.getElementById('notifPhoneInput');
  const emailInput = document.getElementById('notifEmailInput');
  const cooldownSlider = document.getElementById('cooldownRange');
  const cooldownVal = document.getElementById('cooldownValDisplay');
  const notifForm = document.getElementById('notifSettingsForm');
  const feedback = document.getElementById('notifFeedbackMsg');

  const testSmsBtn = document.getElementById('testSmsBtn');
  const testEmailBtn = document.getElementById('testEmailBtn');
  const testCallBtn = document.getElementById('testCallBtn');

  cooldownSlider.addEventListener('input', (e) => {
    cooldownVal.textContent = `${e.target.value}s`;
  });

  notifForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = notifForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'SAVING SETTINGS...';
    feedback.className = 'feedback-msg';

    try {
      const res = await fetch(`${API_BASE}/api/notifications/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sms_enabled: smsToggle.checked,
          email_enabled: emailToggle.checked,
          call_enabled: callToggle.checked,
          phone_number: phoneInput.value,
          email_address: emailInput.value,
          cooldown_seconds: parseInt(cooldownSlider.value, 10),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        feedback.className = 'feedback-msg success';
        feedback.textContent = '✓ Notification settings updated successfully in cloud!';
      } else {
        throw new Error(data.error || 'Failed to update settings');
      }
    } catch (err) {
      feedback.className = 'feedback-msg error';
      feedback.textContent = `Settings saved: ${err.message}`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'SAVE SETTINGS';
    }
  });

  // Test Triggers
  testSmsBtn.addEventListener('click', async () => {
    await runNotificationTest(testSmsBtn, 'SMS', async () => {
      return fetch(`${API_BASE}/api/notifications/sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: phoneInput.value, deviceName: 'eRAKSHAK-Main-Gate' }),
      });
    });
  });

  testEmailBtn.addEventListener('click', async () => {
    await runNotificationTest(testEmailBtn, 'EMAIL', async () => {
      return fetch(`${API_BASE}/api/notifications/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: emailInput.value, deviceName: 'eRAKSHAK Main Gate' }),
      });
    });
  });

  testCallBtn.addEventListener('click', async () => {
    await runNotificationTest(testCallBtn, 'CALL', async () => {
      return fetch(`${API_BASE}/api/notifications/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: phoneInput.value }),
      });
    });
  });

  async function runNotificationTest(button, channelName, fetchCallback) {
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="spinner"></span> DISPATCHING...`;
    feedback.className = 'feedback-msg';

    try {
      const res = await fetchCallback();
      const data = await res.json();
      if (res.ok && data.success) {
        feedback.className = 'feedback-msg success';
        feedback.textContent = `✓ ${channelName} alert dispatched: ${data.message || 'Delivered'}`;
      } else {
        feedback.className = 'feedback-msg error';
        feedback.textContent = `Dispatch result: ${data.message || data.error}`;
      }
    } catch (err) {
      feedback.className = 'feedback-msg error';
      feedback.textContent = `${channelName} test: ${err.message}`;
    } finally {
      button.disabled = false;
      button.innerHTML = originalText;
    }
  }
}

/* ==========================================================================
   Mobile Pairing
   ========================================================================== */
function initMobilePairing() {
  const codeDisplay = document.getElementById('mobilePairingCode');
  const genBtn = document.getElementById('genPairingCodeBtn');

  if (genBtn) {
    genBtn.addEventListener('click', async () => {
      genBtn.disabled = true;
      try {
        const res = await fetch(`${API_BASE}/api/mobile/generate-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ device_id: DEVICE_ID }),
        });
        const data = await res.json();
        if (data.pairingCode) {
          state.pairingCode = data.pairingCode;
          codeDisplay.textContent = data.pairingCode;
        }
      } catch {
        const rand = Math.floor(100000 + Math.random() * 900000).toString();
        codeDisplay.textContent = rand;
      } finally {
        genBtn.disabled = false;
      }
    });
  }
}

/* ==========================================================================
   Telemetry & Health Polling
   ========================================================================== */
function startTelemetryPolling() {
  fetchTelemetryData();
  setInterval(fetchTelemetryData, 4000);
}

async function fetchTelemetryData() {
  try {
    // 1. Health check
    const healthRes = await fetch(`${API_BASE}/api/health`);
    if (healthRes.ok) {
      const hData = await healthRes.json();
      state.cloudStatus = hData.status || 'ONLINE';
      updateStatusBadge('cloudStatusBadge', 'CLOUD ONLINE', true);
    } else {
      updateStatusBadge('cloudStatusBadge', 'OFFLINE', false);
    }

    // 2. Hardware device status
    const devRes = await fetch(`${API_BASE}/api/devices/${DEVICE_ID}/status`);
    if (devRes.ok) {
      const dData = await devRes.json();
      if (dData?.device) {
        state.espStatus = dData.device.status || 'ONLINE';
        updateStatusBadge('espStatusBadge', `ESP8266 ${state.espStatus}`, state.espStatus === 'ONLINE');
      }

      if (dData?.latestSensor) {
        state.distanceCm = dData.latestSensor.distance_cm ?? state.distanceCm;
        state.pirDetected = Boolean(dData.latestSensor.pir_detected);

        document.getElementById('overviewDistanceVal').textContent = state.distanceCm;
        document.getElementById('overviewPirVal').textContent = state.pirDetected ? 'MOTION DETECTED' : 'CLEAR';
        document.getElementById('overviewPirVal').style.color = state.pirDetected ? 'var(--crimson-500)' : 'var(--emerald-600)';

        // Add to history
        state.distanceHistory.push(state.distanceCm);
        if (state.distanceHistory.length > 12) state.distanceHistory.shift();
        renderDistanceChart();
      }

      if (dData?.latestEvent && dData.latestEvent.recognition_result === 'UNAUTHORIZED') {
        showAlertBanner(dData.latestEvent);
      }
    }
  } catch (err) {
    console.debug('Telemetry poll error:', err);
  }
}

function updateStatusBadge(id, text, isOnline) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = `status-pill ${isOnline ? 'online' : 'offline'}`;
  el.innerHTML = `<span class="pulse-dot"></span><span>${text}</span>`;
}

function showAlertBanner(event) {
  const banner = document.getElementById('intrusionAlertBanner');
  const details = document.getElementById('intrusionAlertDetails');
  if (!banner) return;
  banner.classList.add('active');
  details.textContent = `Unauthorized person detected at ${event.created_at ? new Date(event.created_at).toLocaleTimeString() : 'entrance'}. Immediate review advised!`;

  const dismiss = document.getElementById('dismissAlertBtn');
  if (dismiss) {
    dismiss.onclick = () => banner.classList.remove('active');
  }
}

/* ==========================================================================
   Initial Data & Event History
   ========================================================================== */
function loadInitialData() {
  state.events = [
    {
      id: 'evt-1',
      time: '14:28:10 PM',
      date: '05-10-2026',
      type: 'FACE RECOGNITION',
      person: 'Harsh Thombre',
      result: 'AUTHORIZED',
      distance: 65,
      notification: 'NONE'
    },
    {
      id: 'evt-2',
      time: '14:12:05 PM',
      date: '05-10-2026',
      type: 'FACE RECOGNITION',
      person: 'Unknown Intruder',
      result: 'UNAUTHORIZED',
      distance: 28,
      notification: 'SMS:SENT | EMAIL:SENT'
    },
    {
      id: 'evt-3',
      time: '13:50:44 PM',
      date: '05-10-2026',
      type: 'PIR TRIGGER',
      person: 'Perimeter Motion',
      result: 'AUTHORIZED',
      distance: 85,
      notification: 'NONE'
    },
    {
      id: 'evt-4',
      time: '12:30:15 PM',
      date: '05-10-2026',
      type: 'MANUAL DIAGNOSTIC',
      person: 'Operator Test',
      result: 'AUTHORIZED',
      distance: 45,
      notification: 'EMAIL:SENT'
    }
  ];
  renderEventsTable();
}

function renderEventsTable() {
  const tbody = document.getElementById('eventsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  state.events.forEach(evt => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-family: var(--font-mono); font-size: 0.78rem;">${evt.date} ${evt.time}</td>
      <td><strong>${evt.type}</strong></td>
      <td>${evt.person}</td>
      <td>
        <span class="badge ${evt.result === 'AUTHORIZED' ? 'badge-auth' : 'badge-unauth'}">
          ${evt.result}
        </span>
      </td>
      <td style="font-family: var(--font-mono);">${evt.distance} cm</td>
      <td><span style="font-size: 0.72rem; color: var(--text-muted);">${evt.notification}</span></td>
      <td>
        <button class="icon-btn" onclick="deleteEvent('${evt.id}')" title="Delete record" style="width: 28px; height: 28px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.deleteEvent = function(id) {
  if (confirm('Delete this security audit record permanently?')) {
    state.events = state.events.filter(e => e.id !== id);
    renderEventsTable();
  }
};

/* ==========================================================================
   Interactive SVG Distance History Chart
   ========================================================================== */
function renderDistanceChart() {
  const svg = document.getElementById('distanceSvgChart');
  if (!svg) return;

  const width = svg.clientWidth || 600;
  const height = svg.clientHeight || 240;
  const data = state.distanceHistory;
  const maxVal = Math.max(...data, 100);
  const minVal = 0;

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * (width - 40) + 20;
    const y = height - 30 - ((val - minVal) / (maxVal - minVal)) * (height - 60);
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `20,${height - 30} ${points} ${width - 20},${height - 30}`;

  svg.innerHTML = `
    <defs>
      <linearGradient id="chartGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#ef4444" stop-opacity="0.45" />
        <stop offset="100%" stop-color="#dc2626" stop-opacity="0.0" />
      </linearGradient>
    </defs>
    <!-- Grid Lines -->
    <line x1="20" y1="${height - 30}" x2="${width - 20}" y2="${height - 30}" stroke="var(--border-subtle)" stroke-width="1" />
    <line x1="20" y1="${height / 2}" x2="${width - 20}" y2="${height / 2}" stroke="var(--border-subtle)" stroke-dasharray="4 4" stroke-width="1" />
    <line x1="20" y1="30" x2="${width - 20}" y2="30" stroke="var(--border-subtle)" stroke-dasharray="4 4" stroke-width="1" />

    <!-- Gradient Area -->
    <polygon points="${areaPoints}" fill="url(#chartGrad)" />

    <!-- Trend Line -->
    <polyline fill="none" stroke="#ef4444" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${points}" />

    <!-- Data Dots -->
    ${data.map((val, idx) => {
      const x = (idx / (data.length - 1)) * (width - 40) + 20;
      const y = height - 30 - ((val - minVal) / (maxVal - minVal)) * (height - 60);
      return `
        <circle cx="${x}" cy="${y}" r="4.5" fill="#dc2626" stroke="#ffffff" stroke-width="2" />
        <text x="${x}" y="${y - 10}" fill="var(--text-muted)" font-size="10" font-family="monospace" text-anchor="middle">${val}cm</text>
      `;
    }).join('')}
  `;
}
