const API_URL = "http://127.0.0.1:8000";

const platforms = {
  linkedin: {
    match: () => window.location.href.includes("linkedin.com/jobs"),
    getJob: () => ({
      company: document.querySelector(".job-details-jobs-unified-top-card__company-name")?.innerText?.trim(),
      role: document.querySelector(".job-details-jobs-unified-top-card__job-title")?.innerText?.trim(),
      job_url: window.location.href,
    }),
  },
  indeed: {
    match: () => window.location.href.includes("indeed.com"),
    getJob: () => ({
      company: document.querySelector("[data-company-name]")?.innerText?.trim() ||
                document.querySelector(".jobsearch-CompanyInfoWithoutHeaderImage")?.innerText?.trim(),
      role: document.querySelector(".jobsearch-JobInfoHeader-title")?.innerText?.trim(),
      job_url: window.location.href,
    }),
  },
  workday: {
    match: () => window.location.href.includes("workday.com"),
    getJob: () => ({
      company: document.querySelector("[data-automation-id='jobPostingHeader'] h3")?.innerText?.trim() ||
                document.title.split("-")[1]?.trim(),
      role: document.querySelector("[data-automation-id='jobPostingHeader'] h2")?.innerText?.trim() ||
            document.querySelector("h2")?.innerText?.trim(),
      job_url: window.location.href,
    }),
  },
  greenhouse: {
    match: () => window.location.href.includes("greenhouse.io"),
    getJob: () => ({
      company: document.querySelector(".company-name")?.innerText?.trim() ||
                document.title.split("-")[1]?.trim(),
      role: document.querySelector("h1.app-title")?.innerText?.trim() ||
            document.querySelector("h1")?.innerText?.trim(),
      job_url: window.location.href,
    }),
  },
  lever: {
    match: () => window.location.href.includes("lever.co"),
    getJob: () => ({
      company: document.querySelector(".main-header-logo img")?.alt?.trim() ||
                document.title.split("-")[1]?.trim(),
      role: document.querySelector("h2")?.innerText?.trim(),
      job_url: window.location.href,
    }),
  },
  nhs: {
    match: () => window.location.href.includes("jobs.nhs.uk"),
    getJob: () => ({
      company: document.querySelector("span[class*='caption']")?.innerText?.trim(),
      role: document.querySelector("h1")?.innerText?.trim(),
      job_url: window.location.href,
    }),
  },
  civilservice: {
    match: () => window.location.href.includes("civilservicejobs.service.gov.uk"),
    getJob: () => ({
      company: document.querySelector(".org-title")?.innerText?.trim(),
      role: document.querySelector("h1")?.innerText?.trim(),
      job_url: window.location.href,
    }),
  },
};

function detectPlatform() {
  for (const [name, platform] of Object.entries(platforms)) {
    if (platform.match()) return { name, ...platform };
  }
  return null;
}

function showBanner(message, isDuplicate) {
  document.getElementById("applywise-banner")?.remove();

  const banner = document.createElement("div");
  banner.id = "applywise-banner";
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 999999;
    padding: 12px 20px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    font-weight: 500;
    text-align: center;
    background: ${isDuplicate ? "#dc2626" : "#16a34a"};
    color: white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  `;

  banner.innerHTML = `
    <span>⚠️ ApplyWise: ${message}</span>
    <button onclick="document.getElementById('applywise-banner').remove()" style="
      margin-left: 16px;
      background: rgba(255,255,255,0.2);
      border: none;
      color: white;
      padding: 4px 10px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    ">Dismiss</button>
  `;

  document.body.prepend(banner);

  if (!isDuplicate) {
    setTimeout(() => banner.remove(), 8000);
  }
}

async function checkForDuplicate() {
  const platform = detectPlatform();
  if (!platform) return;

  await new Promise(resolve => setTimeout(resolve, 2000));

  const jobInfo = platform.getJob();
  if (!jobInfo.company || !jobInfo.role) return;

  const { token } = await chrome.runtime.sendMessage({ type: "GET_TOKEN" });
  if (!token) return;

  try {
    const response = await fetch(`${API_URL}/duplicate/check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(jobInfo),
    });

    if (!response.ok) return;

    const result = await response.json();

    if (result.is_duplicate) {
      showBanner(result.message, true);
    }

  } catch (error) {
    console.log("ApplyWise: could not reach API", error);
  }
}

checkForDuplicate();

let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    setTimeout(checkForDuplicate, 1500);
  }
}).observe(document, { subtree: true, childList: true });