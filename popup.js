// Elements
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const toggleCaptureBtn = document.getElementById('toggleCaptureBtn');
const clearBtn = document.getElementById('clearBtn');
const requestCount = document.getElementById('requestCount');
const providerCount = document.getElementById('providerCount');
const openDevToolsLink = document.getElementById('openDevToolsLink');

// State
let isCapturing = true;

// Initialize popup
function initializePopup() {
  // Get current capture status
  chrome.runtime.sendMessage({ action: 'getCapturingStatus' }, response => {
    if (response) {
      isCapturing = response.capturing;
      updateCaptureUI();
    }
  });
  
  // Get current request stats
  updateStats();
}

// Update the capture UI elements
function updateCaptureUI() {
  if (isCapturing) {
    statusIndicator.className = 'status-indicator active';
    statusText.textContent = 'Capture Active';
    toggleCaptureBtn.textContent = 'Pause Capture';
  } else {
    statusIndicator.className = 'status-indicator inactive';
    statusText.textContent = 'Capture Paused';
    toggleCaptureBtn.textContent = 'Resume Capture';
  }
}

// Update request statistics
function updateStats() {
  chrome.runtime.sendMessage({ action: 'getRequests' }, response => {
    if (response && response.requests) {
      const requests = response.requests;
      
      // Update request count
      requestCount.textContent = requests.length;
      
      // Count unique providers
      const uniqueProviders = new Set();
      requests.forEach(request => {
        uniqueProviders.add(request.provider);
      });
      
      providerCount.textContent = uniqueProviders.size;
    }
  });
}

// Toggle request capturing
function toggleCapture() {
  isCapturing = !isCapturing;
  
  chrome.runtime.sendMessage({ 
    action: 'toggleCapture',
    capture: isCapturing
  }, response => {
    if (response) {
      isCapturing = response.capturing;
      updateCaptureUI();
    }
  });
}

// Clear all requests
function clearRequests() {
  chrome
