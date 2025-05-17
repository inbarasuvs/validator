// Elements
const requestTableBody = document.getElementById('requestTableBody');
const requestDetails = document.getElementById('requestDetails');
const clearBtn = document.getElementById('clearBtn');
const captureBtn = document.getElementById('captureBtn');
const filterInput = document.getElementById('filterInput');
const providerFilter = document.getElementById('providerFilter');

// State
let requests = [];
let selectedRequestId = null;
let isCapturing = true;
let filterText = '';
let selectedProvider = 'all';

// Connect to the background script
const backgroundPageConnection = chrome.runtime.connect({
  name: "panel-page"
});

// Request initial data
backgroundPageConnection.postMessage({
  action: "getRequests",
  tabId: chrome.devtools.inspectedWindow.tabId
});

// Listen for messages from the background script
backgroundPageConnection.onMessage.addListener(message => {
  if (message.action === 'newRequest') {
    addRequest(message.request);
  } else if (message.requests) {
    requests = message.requests;
    renderRequestTable();
  }
});

// Listen for new requests from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'newRequest') {
    addRequest(message.request);
  } else if (message.action === 'tabUpdated' && 
            message.tabId === chrome.devtools.inspectedWindow.tabId) {
    // Tab was updated, refresh our data
    chrome.runtime.sendMessage({ action: 'getRequests' }, response => {
      if (response && response.requests) {
        requests = response.requests;
        renderRequestTable();
        clearDetails();
      }
    });
  }
  return true;
});

// Add a new request to our list
function addRequest(request) {
  // Only add if it's for the current tab
  if (request.tabId !== chrome.devtools.inspectedWindow.tabId) return;
  
  requests.unshift(request);
  
  // Apply filters
  if (matchesFilters(request)) {
    renderRequest(request);
  }
}

// Render the entire request table
function renderRequestTable() {
  requestTableBody.innerHTML = '';
  
  const filteredRequests = requests.filter(matchesFilters);
  
  if (filteredRequests.length === 0) {
    requestTableBody.innerHTML = `
      <tr>
        <td colspan="3" class="placeholder">No requests captured yet</td>
      </tr>
    `;
    return;
  }
  
  filteredRequests.forEach(renderRequest);
  
  // Re-select the currently selected request if it's still in the list
  if (selectedRequestId) {
    const selectedRow = document.querySelector(`tr[data-id="${selectedRequestId}"]`);
    if (selectedRow) {
      selectedRow.classList.add('selected');
    } else {
      clearDetails();
    }
  }
}

// Check if a request matches the current filters
function matchesFilters(request) {
  // Provider filter
  if (selectedProvider !== 'all' && request.provider !== selectedProvider) {
    return false;
  }
  
  // Text filter
  if (filterText) {
    const searchText = filterText.toLowerCase();
    const matchesUrl = request.url.toLowerCase().includes(searchText);
    const matchesProvider = request.provider.toLowerCase().includes(searchText);
    
    // Check if search text matches any parameter
    let matchesParam = false;
    if (request.parsedData) {
      matchesParam = Object.entries(request.parsedData).some(([key, value]) => {
        return key.toLowerCase().includes(searchText) || 
               (value && value.toString().toLowerCase().includes(searchText));
      });
    }
    
    if (!matchesUrl && !matchesProvider && !matchesParam) {
      return false;
    }
  }
  
  return true;
}

// Render a single request row
function renderRequest(request) {
  const row = document.createElement('tr');
  row.dataset.id = request.id;
  
  const time = new Date(request.timestamp);
  const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  
  row.innerHTML = `
    <td>${timeStr}</td>
    <td>${request.provider}</td>
    <td>${truncateUrl(request.url)}</td>
  `;
  
  row.addEventListener('click', () => {
    selectRequest(request);
  });
  
  // Either prepend or update
  const existingRow = requestTableBody.querySelector(`tr[data-id="${request.id}"]`);
  if (existingRow) {
    requestTableBody.replaceChild(row, existingRow);
  } else {
    // If we're filtering and this is the first row, clear the "no requests" message
    if (requestTableBody.querySelector('.placeholder')) {
      requestTableBody.innerHTML = '';
    }
    requestTableBody.prepend(row);
  }
}

// Truncate URL for display
function truncateUrl(url) {
  const maxLength = 60;
  if (url.length <= maxLength) return url;
  
  const parsedUrl = new URL(url);
  const baseUrl = parsedUrl.origin + parsedUrl.pathname;
  
  if (baseUrl.length > maxLength - 3) {
    return baseUrl.substring(0, maxLength - 3) + '...';
  }
  
  return baseUrl + '...';
}

// Select a request and show its details
function selectRequest(request) {
  // Update UI
  const allRows = requestTableBody.querySelectorAll('tr');
  allRows.forEach(row => row.classList.remove('selected'));
  
  const selectedRow = requestTableBody.querySelector(`tr[data-id="${request.id}"]`);
  if (selectedRow) {
    selectedRow.classList.add('selected');
  }
  
  selectedRequestId = request.id;
  
  // Display details
  const time = new Date(request.timestamp);
  const timeStr = time.toLocaleString();
  
  let detailsHtml = `
    <div class="request-header">
      <h3>${request.provider}</h3>
      <div class="request-time">${timeStr}</div>
    </div>
    
    <div class="request-url">
      <div class="param-name">URL:</div>
      <div class="param-value">${request.url}</div>
      <button class="copy-button" data-copy="${request.url}">Copy</button>
    </div>
  `;
  
  if (request.parsedData && Object.keys(request.parsedData).length > 0) {
    detailsHtml += `
      <h4>Parameters</h4>
      <table class="param-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    for (const [key, value] of Object.entries(request.parsedData)) {
      detailsHtml += `
        <tr>
          <td class="param-name">${key}</td>
          <td class="param-value">${value}</td>
        </tr>
      `;
    }
    
    detailsHtml += `
        </tbody>
      </table>
    `;
  }
  
  requestDetails.innerHTML = detailsHtml;
  
  // Add copy button functionality
  const copyButtons = requestDetails.querySelectorAll('.copy-button');
  copyButtons.forEach(button => {
    button.addEventListener('click', () => {
      const textToCopy = button.dataset.copy;
      navigator.clipboard.writeText(textToCopy)
        .then(() => {
          button.textContent = 'Copied!';
          setTimeout(() => {
            button.textContent = 'Copy';
          }, 2000);
        });
    });
  });
}

// Clear selected request details
function clearDetails() {
  selectedRequestId = null;
  requestDetails.innerHTML = `<div class="placeholder">Select a request to view details</div>`;
  
  const allRows = requestTableBody.querySelectorAll('tr');
  allRows.forEach(row => row.classList.remove('selected'));
}

// Toggle request capturing
function toggleCapture() {
  isCapturing = !isCapturing;
  captureBtn.textContent = isCapturing ? 'Pause Capture' : 'Resume Capture';
  
  chrome.runtime.sendMessage({ 
    action: 'toggleCapture',
    capture: isCapturing
  });
}

// Clear all requests
function clearRequests() {
  chrome.runtime.sendMessage({ action: 'clearRequests' }, () => {
    requests = [];
    renderRequestTable();
    clearDetails();
  });
}

// Apply filters
function applyFilters() {
  filterText = filterInput.value.trim();
  selectedProvider = providerFilter.value;
  renderRequestTable();
}

// Event listeners
clearBtn.addEventListener('click', clearRequests);
captureBtn.addEventListener('click', toggleCapture);
filterInput.addEventListener('input', applyFilters);
providerFilter.addEventListener('change', applyFilters);

// Initialize
function initialize() {
  chrome.runtime.sendMessage({ action: 'getRequests' }, response => {
    if (response && response.requests) {
      requests = response.requests;
      renderRequestTable();
    }
  });
}

// Run initialization when the page loads
window.addEventListener('load', initialize);