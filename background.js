// Provider patterns to detect analytics and marketing tools
const providers = {
  'Google Analytics': {
    patterns: [
      'google-analytics.com/collect',
      'google-analytics.com/j/collect',
      'analytics.google.com/g/collect'
    ],
    parseUrl: function(url) {
      const parsedUrl = new URL(url);
      return Object.fromEntries(parsedUrl.searchParams);
    }
  },
  'Adobe Analytics': {
    patterns: [
      '/b/ss/',
      '.sc.omtrdc.net'
    ],
    parseUrl: function(url) {
      const parsedUrl = new URL(url);
      return Object.fromEntries(parsedUrl.searchParams);
    }
  },
  'Meta Pixel': {
    patterns: [
      'facebook.com/tr/',
      'connect.facebook.net'
    ],
    parseUrl: function(url) {
      const parsedUrl = new URL(url);
      return Object.fromEntries(parsedUrl.searchParams);
    }
  },
  'Google Tag Manager': {
    patterns: [
      'googletagmanager.com'
    ],
    parseUrl: function(url) {
      const parsedUrl = new URL(url);
      return Object.fromEntries(parsedUrl.searchParams);
    }
  }
};

// Storage for captured requests
let capturedRequests = [];
let isCapturing = true;
const MAX_REQUESTS = 1000;

// Listen for network requests
chrome.webRequest.onBeforeRequest.addListener(
  handleRequest,
  { urls: ["<all_urls>"] },
  ["requestBody"]
);

// Handle each request
function handleRequest(details) {
  if (!isCapturing) return;
  
  const { url, method, requestId, timeStamp, tabId } = details;
  
  // Check if this request matches any of our patterns
  let providerMatch = null;
  let parsedData = null;
  
  for (const [provider, config] of Object.entries(providers)) {
    if (config.patterns.some(pattern => url.includes(pattern))) {
      providerMatch = provider;
      parsedData = config.parseUrl(url);
      break;
    }
  }
  
  // If we matched a provider, add the request to our list
  if (providerMatch) {
    const request = {
      id: requestId,
      provider: providerMatch,
      url: url,
      method: method,
      timestamp: timeStamp,
      tabId: tabId,
      parsedData: parsedData
    };
    
    capturedRequests.unshift(request);
    
    // Limit number of stored requests
    if (capturedRequests.length > MAX_REQUESTS) {
      capturedRequests.pop();
    }
    
    // Notify the DevTools panel
    chrome.runtime.sendMessage({
      action: 'newRequest',
      request: request
    });
  }
}

// Handle messages from DevTools or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getRequests') {
    sendResponse({ requests: capturedRequests });
  } else if (message.action === 'clearRequests') {
    capturedRequests = [];
    sendResponse({ success: true });
  } else if (message.action === 'toggleCapture') {
    isCapturing = message.capture;
    sendResponse({ capturing: isCapturing });
  }
  return true; // Needed for async sendResponse
});

// When a tab is updated, notify the devtools
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    chrome.runtime.sendMessage({
      action: 'tabUpdated',
      tabId: tabId
    });
  }
});
