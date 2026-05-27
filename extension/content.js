chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "EXTRACT_PAGE_DATA") {
    try {
      const title = document.title || ""
      const url = window.location.href

      // Extract visible text from the page — focus on job-relevant sections
      function getPageText() {
        const selectors = [
          "main", "article", "#job-description", ".job-description",
          "[data-testid='jobsearch-JobComponent']",
          ".jobs-description", ".job-details",
          ".description", "#jobDescriptionText",
          "[class*='job-desc']", "[class*='jobDesc']",
          "[class*='description']", "body"
        ]

        for (const sel of selectors) {
          const el = document.querySelector(sel)
          if (el) {
            const text = el.innerText || el.textContent || ""
            if (text.trim().length > 200) {
              return text.trim().slice(0, 3000)
            }
          }
        }
        return document.body?.innerText?.trim().slice(0, 3000) || ""
      }

      const pageText = getPageText()

      sendResponse({
        title,
        url,
        pageText,
        success: true
      })
    } catch (e) {
      sendResponse({ error: e.message, success: false })
    }
  }
  return true
})