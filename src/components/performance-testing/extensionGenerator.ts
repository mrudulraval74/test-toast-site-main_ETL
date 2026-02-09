import JSZip from 'jszip';

export interface PerfExtensionConfig {
  appOrigin: string;
}

const browserApiPolyfill = `
const browserAPI = (function() {
  if (typeof browser !== 'undefined' && browser.runtime) return browser;
  if (typeof chrome !== 'undefined' && chrome.runtime) return chrome;
  throw new Error('No browser extension API available');
})();
`;

export const generatePerfRecorderExtension = async (config: PerfExtensionConfig): Promise<Blob> => {
  const zip = new JSZip();

  const manifestV3 = {
    manifest_version: 3,
    name: "Performance Test Recorder",
    version: "1.0.0",
    description: "Record HTTP requests for performance testing",
    permissions: ["activeTab", "webRequest", "storage"],
    host_permissions: ["<all_urls>"],
    action: {
      default_popup: "popup.html",
      default_icon: { "16": "icon.png", "48": "icon.png" }
    },
    background: { service_worker: "background.js" },
    content_scripts: [
      {
        matches: ["<all_urls>"],
        js: ["content.js"]
      }
    ]
  };

  const manifestV2 = {
    manifest_version: 2,
    name: "Performance Test Recorder",
    version: "1.0.0",
    description: "Record HTTP requests for performance testing",
    permissions: ["activeTab", "webRequest", "webRequestBlocking", "storage", "<all_urls>"],
    browser_action: { default_popup: "popup.html", default_icon: { "16": "icon.png" } },
    background: { scripts: ["background.js"], persistent: true },
    browser_specific_settings: { gecko: { id: "perf-recorder@wispr.dev" } },
    content_scripts: [
      {
        matches: ["<all_urls>"],
        js: ["content.js"]
      }
    ]
  };

  const contentJs = `${browserApiPolyfill}
// Listen for messages from the web page
window.addEventListener('message', (event) => {
  if (event.source !== window) return;

  if (event.data?.type === 'FROM_APP') {
    browserAPI.runtime.sendMessage(event.data.payload);
  }
});

// Listen for messages from the background script
browserAPI.runtime.onMessage.addListener((msg) => {
  window.postMessage(
    { type: 'FROM_EXTENSION', payload: msg },
    '*'
  );
});
`;

  const backgroundJs = `${browserApiPolyfill}
let recording = false;
let requests = [];
let appTabId = null;

browserAPI.runtime.onMessage.addListener((msg, sender, respond) => {
  if (msg.type === 'START_PERF_RECORDING') {
    recording = true;
    requests = [];
    appTabId = sender.tab?.id || null;
    respond({ success: true });
    return true;
  }
  if (msg.type === 'STOP_PERF_RECORDING') {
    recording = false;
    const data = [...requests];
    requests = [];
    respond({ success: true, requests: data });
    return true;
  }
  if (msg.type === 'GET_PERF_STATE') {
    respond({ recording, count: requests.length });
    return true;
  }
  return true;
});

browserAPI.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (!recording) return;
    
    // Track navigation separately (like BlazeMeter)
    if (details.type === 'main_frame') {
      requests.push({
        id: details.requestId,
        action: 'navigate',
        url: details.url,
        timestamp: details.timeStamp
      });
      
      if (appTabId) {
        browserAPI.tabs.sendMessage(appTabId, {
          type: 'PERF_STEP',
          step: {
            action: 'navigate',
            url: details.url,
            timestamp: details.timeStamp
          }
        }).catch(() => {});
      }
      return;
    }
    
    if (details.type !== 'xmlhttprequest' && details.type !== 'fetch') return;
    
    requests.push({
      id: details.requestId,
      method: details.method,
      url: details.url,
      timestamp: details.timeStamp,
      body: details.requestBody ? JSON.stringify(details.requestBody) : ''
    });
    
    // Send step to app tab via content script
    if (appTabId) {
      browserAPI.tabs.sendMessage(appTabId, {
        type: 'PERF_STEP',
        step: {
          action: 'http',
          method: details.method,
          url: details.url,
          timestamp: details.timeStamp
        }
      }).catch(() => {});
    }
  },
  { urls: ["<all_urls>"] },
  ["requestBody"]
);

browserAPI.webRequest.onCompleted.addListener(
  (details) => {
    if (!recording) return;
    const req = requests.find(r => r.id === details.requestId);
    if (req) {
      req.statusCode = details.statusCode;
      req.responseHeaders = details.responseHeaders;
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);
`;

  const popupHtml = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { width: 280px; padding: 16px; font-family: system-ui; background: #1a1a2e; color: white; }
    .title { font-size: 14px; font-weight: 600; margin-bottom: 12px; }
    .status { padding: 8px 12px; border-radius: 6px; margin-bottom: 12px; font-size: 13px; }
    .status.recording { background: #dc262620; border: 1px solid #dc2626; }
    .status.idle { background: #52525220; border: 1px solid #525252; }
    .btn { width: 100%; padding: 10px; border: none; border-radius: 6px; font-weight: 500; cursor: pointer; margin-bottom: 8px; }
    .btn-start { background: #22c55e; color: white; }
    .btn-stop { background: #dc2626; color: white; }
    .count { text-align: center; color: #a1a1aa; font-size: 12px; }
  </style>
</head>
<body>
  <div class="title">Performance Test Recorder</div>
  <div id="status" class="status idle">Ready to record</div>
  <button id="startBtn" class="btn btn-start">Start Recording</button>
  <button id="stopBtn" class="btn btn-stop" style="display:none">Stop Recording</button>
  <div id="count" class="count"></div>
  <script src="popup.js"></script>
</body>
</html>`;

  const popupJs = `${browserApiPolyfill}
const status = document.getElementById('status');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const countEl = document.getElementById('count');

function updateUI(recording, count = 0) {
  status.className = 'status ' + (recording ? 'recording' : 'idle');
  status.textContent = recording ? 'Recording...' : 'Ready to record';
  startBtn.style.display = recording ? 'none' : 'block';
  stopBtn.style.display = recording ? 'block' : 'none';
  countEl.textContent = recording ? count + ' requests captured' : '';
}

browserAPI.runtime.sendMessage({ type: 'GET_PERF_STATE' }, (r) => {
  if (r) updateUI(r.recording, r.count);
});

startBtn.onclick = () => {
  browserAPI.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    browserAPI.runtime.sendMessage({ type: 'START_PERF_RECORDING', appTabId: tabs[0].id }, (r) => {
      if (r && r.success) updateUI(true);
    });
  });
};

stopBtn.onclick = () => {
  browserAPI.runtime.sendMessage({ type: 'STOP_PERF_RECORDING' }, (r) => {
    if (r && r.success) {
      updateUI(false);
      const data = JSON.stringify(r.requests);
      navigator.clipboard.writeText(data).then(() => {
        alert(r.requests.length + ' requests copied to clipboard!\\nPaste in the app to import.');
      });
    }
  });
};

setInterval(() => {
  browserAPI.runtime.sendMessage({ type: 'GET_PERF_STATE' }, (r) => {
    if (r) updateUI(r.recording, r.count);
  });
}, 1000);
`;

  // Simple 16x16 red circle icon as data URL converted to PNG
  const iconPng = await createIconPng();

  const chromeFolder = zip.folder("chrome-edge")!;
  const firefoxFolder = zip.folder("firefox")!;

  chromeFolder.file("manifest.json", JSON.stringify(manifestV3, null, 2));
  chromeFolder.file("background.js", backgroundJs);
  chromeFolder.file("content.js", contentJs);
  chromeFolder.file("popup.html", popupHtml);
  chromeFolder.file("popup.js", popupJs);
  chromeFolder.file("icon.png", iconPng);

  firefoxFolder.file("manifest.json", JSON.stringify(manifestV2, null, 2));
  firefoxFolder.file("background.js", backgroundJs);
  firefoxFolder.file("content.js", contentJs);
  firefoxFolder.file("popup.html", popupHtml);
  firefoxFolder.file("popup.js", popupJs);
  firefoxFolder.file("icon.png", iconPng);

  const readme = `# Performance Test Recorder Extension

## Installation

### Chrome/Edge
1. Open chrome://extensions (or edge://extensions)
2. Enable "Developer mode"
3. Click "Load unpacked" and select the chrome-edge folder

### Firefox
1. Open about:debugging
2. Click "This Firefox" > "Load Temporary Add-on"
3. Select any file in the firefox folder

## Usage
1. Click the extension icon
2. Click "Start Recording"
3. Perform actions in the browser
4. Click "Stop Recording" - requests are copied to clipboard
5. Paste into the app's Recording tab import area
`;

  zip.file("README.md", readme);

  return await zip.generateAsync({ type: 'blob' });
};

async function createIconPng(): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 48;
  const ctx = canvas.getContext('2d')!;
  
  // Red circle
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.arc(24, 24, 20, 0, Math.PI * 2);
  ctx.fill();
  
  // White inner circle
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(24, 24, 8, 0, Math.PI * 2);
  ctx.fill();

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      blob!.arrayBuffer().then(buf => resolve(new Uint8Array(buf)));
    }, 'image/png');
  });
}

export const downloadPerfExtension = async (): Promise<void> => {
  const config: PerfExtensionConfig = {
    appOrigin: window.location.origin
  };
  
  const blob = await generatePerfRecorderExtension(config);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'perf-recorder-extension.zip';
  a.click();
  URL.revokeObjectURL(url);
};
