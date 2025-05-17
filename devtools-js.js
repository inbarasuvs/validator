// Create a panel in Chrome DevTools
chrome.devtools.panels.create(
  "WebTagDebugger",            // Panel title
  "../icons/icon16.png",       // Icon path
  "panel/panel.html",          // Panel HTML page
  (panel) => {
    // Panel created callback if needed
    console.log("WebTagDebugger panel created");
  }
);