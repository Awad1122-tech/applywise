chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.type === "GET_TOKEN") {
    chrome.storage.local.get(["token"], (result) => {
      sendResponse({ token: result.token || null });
    });
    return true;
  }

  if (message.type === "SET_TOKEN") {
    chrome.storage.local.set({ token: message.token }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === "CLEAR_TOKEN") {
    chrome.storage.local.remove(["token"], () => {
      sendResponse({ success: true });
    });
    return true;
  }

  // Keep service worker alive
  if (message.type === "PING") {
    sendResponse({ pong: true });
    return true;
  }

});

// Prevent service worker from going inactive
chrome.runtime.onInstalled.addListener(() => {
  console.log("ApplyWise background ready");
});