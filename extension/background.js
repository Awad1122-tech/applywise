const keepAlive = () => setInterval(chrome.runtime.getPlatformInfo, 20000)
chrome.runtime.onStartup.addListener(keepAlive)
keepAlive()

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.type === "GET_TOKEN") {
    chrome.storage.local.get(["token"], (result) => {
      sendResponse({ token: result.token || null })
    })
    return true
  }

  if (message.type === "SET_TOKEN") {
    chrome.storage.local.set({ token: message.token }, () => {
      sendResponse({ success: true })
    })
    return true
  }

  if (message.type === "CLEAR_TOKEN") {
    chrome.storage.local.remove(["token"], () => {
      sendResponse({ success: true })
    })
    return true
  }

  if (message.type === "GET_PAGE_DATA") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) { sendResponse({ error: "no tab" }); return }
      chrome.tabs.sendMessage(tabs[0].id, { type: "EXTRACT_PAGE_DATA" }, (response) => {
        if (chrome.runtime.lastError) {
          sendResponse({ error: chrome.runtime.lastError.message })
        } else {
          sendResponse(response)
        }
      })
    })
    return true
  }

  if (message.type === "PING") {
    sendResponse({ pong: true })
    return true
  }

})

chrome.runtime.onInstalled.addListener(() => {
  console.log("ApplyWise background ready")
})