/**
 * eRAKSHAK Smart Security System - Mobile AI Camera Companion Logic
 * Developed by Justice League • Dept of ETC, SBJAIN
 */

const API_BASE = '';
const DEVICE_ID = 'erakshak-nodemcu-01';

let currentStream = null;
let facingMode = 'user';

// Camera & UI Elements
const video = document.getElementById('cameraVideo');
const toggleCamBtn = document.getElementById('toggleCameraBtn');
const scanBox = document.getElementById('scanTargetBox');
const nameText = document.getElementById('subjectNameText');
const statusText = document.getElementById('subjectStatusText');
const feedback = document.getElementById('simFeedback');
const simAuthBtn = document.getElementById('simAuthBtn');
const simUnauthBtn = document.getElementById('simUnauthBtn');

async function initCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (feedback) feedback.textContent = 'Webcam API not supported or permissions required.';
    return;
  }
  try {
    if (currentStream) {
      currentStream.getTracks().forEach(t => t.stop());
    }
    currentStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facingMode }
    });
    if (video) video.srcObject = currentStream;
  } catch (err) {
    console.warn('Camera stream notice:', err.message);
    if (feedback) feedback.textContent = 'Camera ready (Simulated or device webcam)';
  }
}

if (toggleCamBtn) {
  toggleCamBtn.addEventListener('click', () => {
    facingMode = facingMode === 'user' ? 'environment' : 'user';
    initCamera();
  });
}

// Simulated Face Recognition Triggers
if (simAuthBtn) {
  simAuthBtn.addEventListener('click', async () => {
    if (scanBox) scanBox.className = 'scan-target-box';
    if (nameText) nameText.textContent = 'Harsh Thombre';
    if (statusText) {
      statusText.textContent = 'AUTHORIZED';
      statusText.style.color = '#10b981';
    }
    if (feedback) feedback.textContent = '✓ Authorized access verified. Sending record to cloud...';

    try {
      await fetch(`${API_BASE}/api/mobile/${DEVICE_ID}/face-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          result: 'AUTHORIZED',
          personName: 'Harsh Thombre',
          confidence: 0.95,
          distanceCm: 45
        })
      });
      if (feedback) feedback.textContent = '✓ Access granted recorded in cloud!';
    } catch (err) {
      if (feedback) feedback.textContent = 'Logged locally: ' + err.message;
    }
  });
}

if (simUnauthBtn) {
  simUnauthBtn.addEventListener('click', async () => {
    if (scanBox) scanBox.className = 'scan-target-box unauthorized';
    if (nameText) nameText.textContent = 'Unknown Intruder';
    if (statusText) {
      statusText.textContent = 'UNAUTHORIZED';
      statusText.style.color = '#ef4444';
    }
    if (feedback) feedback.textContent = '🚨 Unauthorized intruder! Dispatching emergency Gmail & SMS alerts...';

    try {
      const res = await fetch(`${API_BASE}/api/mobile/${DEVICE_ID}/face-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          result: 'UNAUTHORIZED',
          personName: 'Unknown Intruder',
          confidence: 0.32,
          distanceCm: 25
        })
      });
      await res.json();
      if (feedback) feedback.textContent = '🚨 Security alerts dispatched via Gmail / SMS!';
    } catch (err) {
      if (feedback) feedback.textContent = 'Alert queued: ' + err.message;
    }
  });
}

// Heartbeat reporting
setInterval(async () => {
  try {
    await fetch(`${API_BASE}/api/mobile/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pairingCode: '849201',
        cameraStatus: 'READY',
        recognitionStatus: 'READY',
      })
    });
  } catch {}
}, 10000);

// Start camera on page load
initCamera();
