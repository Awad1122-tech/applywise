const API_URL = "http://127.0.0.1:8001";

// ─── Platform Definitions ───────────────────────────────────────────────────

const platforms = {

  linkedin: {
    match: () => window.location.href.includes("linkedin.com/jobs"),
    getJob: () => {
      const company =
        document.querySelector(".job-details-jobs-unified-top-card__company-name a")?.innerText?.trim() ||
        document.querySelector(".job-details-jobs-unified-top-card__company-name")?.innerText?.trim() ||
        document.querySelector("[data-tracking-control-name='public_jobs_topcard-org-name']")?.innerText?.trim() ||
        document.querySelector(".topcard__org-name-link")?.innerText?.trim() ||
        document.querySelector(".jobs-unified-top-card__company-name")?.innerText?.trim();

      const role =
        document.querySelector(".job-details-jobs-unified-top-card__job-title h1")?.innerText?.trim() ||
        document.querySelector(".job-details-jobs-unified-top-card__job-title")?.innerText?.trim() ||
        document.querySelector(".jobs-unified-top-card__job-title")?.innerText?.trim() ||
        document.querySelector("h1.topcard__title")?.innerText?.trim() ||
        document.querySelector("h1")?.innerText?.trim();

      return { company, role, job_url: window.location.href, platform: "linkedin" };
    },
    applyButton: () =>
      document.querySelector(".jobs-apply-button--top-card button") ||
      document.querySelector("[data-control-name='jobdetails_topcard_inapply']") ||
      document.querySelector(".jobs-apply-button") ||
      Array.from(document.querySelectorAll("button")).find(b =>
        b.innerText?.toLowerCase().includes("easy apply") ||
        b.innerText?.toLowerCase().includes("apply now")
      ),
  },

  indeed: {
    match: () => window.location.href.includes("indeed.com"),
    getJob: () => {
      const company =
        document.querySelector("[data-company-name]")?.innerText?.trim() ||
        document.querySelector(".jobsearch-CompanyInfoWithoutHeaderImage")?.innerText?.trim() ||
        document.querySelector(".css-1ioi40n")?.innerText?.trim() ||
        document.querySelector("[data-testid='inlineHeader-companyName']")?.innerText?.trim() ||
        document.querySelector(".jobsearch-InlineCompanyRating-companyHeader")?.innerText?.trim();

      const role =
        document.querySelector(".jobsearch-JobInfoHeader-title")?.innerText?.trim() ||
        document.querySelector("[data-testid='jobsearch-JobInfoHeader-title']")?.innerText?.trim() ||
        document.querySelector(".css-1b02lze")?.innerText?.trim() ||
        document.querySelector("h1.jobsearch-JobInfoHeader-title")?.innerText?.trim() ||
        document.querySelector("h1")?.innerText?.trim();

      return { company, role, job_url: window.location.href, platform: "indeed" };
    },
    applyButton: () =>
      document.querySelector("#indeedApplyButton") ||
      document.querySelector("[data-testid='IndeedApplyButton']") ||
      document.querySelector(".jobsearch-IndeedApplyButton-newDesign") ||
      Array.from(document.querySelectorAll("button")).find(b =>
        b.innerText?.toLowerCase().includes("apply now") ||
        b.innerText?.toLowerCase().includes("apply on company site")
      ),
  },

  reed: {
    match: () => window.location.href.includes("reed.co.uk"),
    getJob: () => {
      const company =
        document.querySelector("[data-qa='publisher-link']")?.innerText?.trim() ||
        document.querySelector(".recruiter-details h3")?.innerText?.trim() ||
        document.querySelector(".employer-name")?.innerText?.trim();

      const role =
        document.querySelector("h1[data-qa='job-title']")?.innerText?.trim() ||
        document.querySelector("h1.job-header__title")?.innerText?.trim() ||
        document.querySelector("h1")?.innerText?.trim();

      return { company, role, job_url: window.location.href, platform: "reed" };
    },
    applyButton: () =>
      document.querySelector("[data-qa='apply-button']") ||
      Array.from(document.querySelectorAll("button, a")).find(b =>
        b.innerText?.toLowerCase().includes("apply now") ||
        b.innerText?.toLowerCase().includes("apply for this job")
      ),
  },

  totaljobs: {
    match: () => window.location.href.includes("totaljobs.com"),
    getJob: () => {
      const company =
        document.querySelector(".job-header__company-name")?.innerText?.trim() ||
        document.querySelector("[itemprop='hiringOrganization'] [itemprop='name']")?.innerText?.trim() ||
        document.querySelector(".employer-name")?.innerText?.trim();

      const role =
        document.querySelector("h1.job-header__title")?.innerText?.trim() ||
        document.querySelector("h1[itemprop='title']")?.innerText?.trim() ||
        document.querySelector("h1")?.innerText?.trim();

      return { company, role, job_url: window.location.href, platform: "totaljobs" };
    },
    applyButton: () =>
      Array.from(document.querySelectorAll("button, a")).find(b =>
        b.innerText?.toLowerCase().includes("apply now") ||
        b.innerText?.toLowerCase().includes("apply for this job")
      ),
  },

  cvlibrary: {
    match: () => window.location.href.includes("cv-library.co.uk"),
    getJob: () => {
      const company =
        document.querySelector(".company-name")?.innerText?.trim() ||
        document.querySelector("[itemprop='hiringOrganization']")?.innerText?.trim();

      const role =
        document.querySelector("h1.job-title")?.innerText?.trim() ||
        document.querySelector("h1")?.innerText?.trim();

      return { company, role, job_url: window.location.href, platform: "cv_library" };
    },
    applyButton: () =>
      Array.from(document.querySelectorAll("button, a")).find(b =>
        b.innerText?.toLowerCase().includes("apply now")
      ),
  },

  workday: {
    match: () => window.location.href.includes("workday.com"),
    getJob: () => {
      const company =
        document.querySelector("[data-automation-id='jobPostingHeader'] h3")?.innerText?.trim() ||
        document.title.split(" - ")[1]?.trim() ||
        document.title.split("|")[1]?.trim();

      const role =
        document.querySelector("[data-automation-id='jobPostingHeader'] h2")?.innerText?.trim() ||
        document.querySelector("[data-automation-id='jobPostingHeader'] h1")?.innerText?.trim() ||
        document.querySelector("h2")?.innerText?.trim();

      return { company, role, job_url: window.location.href, platform: "workday" };
    },
    applyButton: () =>
      document.querySelector("[data-automation-id='applyNowButton']") ||
      Array.from(document.querySelectorAll("button")).find(b =>
        b.innerText?.toLowerCase().includes("apply")
      ),
  },

  greenhouse: {
    match: () => window.location.href.includes("greenhouse.io") || window.location.href.includes("boards.greenhouse.io"),
    getJob: () => {
      const company =
        document.querySelector(".company-name")?.innerText?.trim() ||
        document.querySelector("#header .company-name")?.innerText?.trim() ||
        document.title.split(" - ")[1]?.trim();

      const role =
        document.querySelector("h1.app-title")?.innerText?.trim() ||
        document.querySelector("#header h1")?.innerText?.trim() ||
        document.querySelector("h1")?.innerText?.trim();

      return { company, role, job_url: window.location.href, platform: "greenhouse" };
    },
    applyButton: () =>
      document.querySelector("#submit_app") ||
      Array.from(document.querySelectorAll("button")).find(b =>
        b.innerText?.toLowerCase().includes("submit application") ||
        b.innerText?.toLowerCase().includes("apply")
      ),
  },

  lever: {
    match: () => window.location.href.includes("lever.co") || window.location.href.includes("jobs.lever.co"),
    getJob: () => {
      const company =
        document.querySelector(".main-header-logo img")?.alt?.trim() ||
        document.querySelector(".main-header-logo")?.innerText?.trim() ||
        document.title.split(" - ")[1]?.trim();

      const role =
        document.querySelector(".posting-headline h2")?.innerText?.trim() ||
        document.querySelector("h2")?.innerText?.trim();

      return { company, role, job_url: window.location.href, platform: "other" };
    },
    applyButton: () =>
      document.querySelector(".postings-btn") ||
      Array.from(document.querySelectorAll("button, a")).find(b =>
        b.innerText?.toLowerCase().includes("apply for this job")
      ),
  },

  nhs: {
    match: () => window.location.href.includes("jobs.nhs.uk"),
    getJob: () => {
      const company =
        document.querySelector("span[class*='caption']")?.innerText?.trim() ||
        document.querySelector(".nhsuk-caption-l")?.innerText?.trim() ||
        document.querySelector("[class*='employer']")?.innerText?.trim();

      const role =
        document.querySelector("h1")?.innerText?.trim();

      return { company, role, job_url: window.location.href, platform: "nhs_jobs" };
    },
    applyButton: () =>
      Array.from(document.querySelectorAll("button, a")).find(b =>
        b.innerText?.toLowerCase().includes("apply online") ||
        b.innerText?.toLowerCase().includes("apply for this job")
      ),
  },

  civilservice: {
    match: () => window.location.href.includes("civilservicejobs.service.gov.uk"),
    getJob: () => {
      const company =
        document.querySelector(".org-title")?.innerText?.trim() ||
        document.querySelector(".department-name")?.innerText?.trim();

      const role =
        document.querySelector("h1")?.innerText?.trim();

      return { company, role, job_url: window.location.href, platform: "civil_service" };
    },
    applyButton: () =>
      Array.from(document.querySelectorAll("button, a")).find(b =>
        b.innerText?.toLowerCase().includes("apply now") ||
        b.innerText?.toLowerCase().includes("start application")
      ),
  },

  gradcracker: {
    match: () => window.location.href.includes("gradcracker.com"),
    getJob: () => {
      const company =
        document.querySelector(".company-name")?.innerText?.trim() ||
        document.querySelector("h2.company")?.innerText?.trim();

      const role =
        document.querySelector("h1.job-title")?.innerText?.trim() ||
        document.querySelector("h1")?.innerText?.trim();

      return { company, role, job_url: window.location.href, platform: "gradcracker" };
    },
    applyButton: () =>
      Array.from(document.querySelectorAll("button, a")).find(b =>
        b.innerText?.toLowerCase().includes("apply now")
      ),
  },

  brightnetwork: {
    match: () => window.location.href.includes("brightnetwork.co.uk"),
    getJob: () => {
      const company =
        document.querySelector(".employer-name")?.innerText?.trim() ||
        document.querySelector("[class*='company']")?.innerText?.trim();

      const role =
        document.querySelector("h1")?.innerText?.trim();

      return { company, role, job_url: window.location.href, platform: "brightnetwork" };
    },
    applyButton: () =>
      Array.from(document.querySelectorAll("button, a")).find(b =>
        b.innerText?.toLowerCase().includes("apply now") ||
        b.innerText?.toLowerCase().includes("apply for role")
      ),
  },

};

// ─── Core Logic ─────────────────────────────────────────────────────────────

function detectPlatform() {
  for (const [name, platform] of Object.entries(platforms)) {
    if (platform.match()) return { name, ...platform };
  }
  return null;
}

function showBanner(message, type = "info") {
  document.getElementById("applywise-banner")?.remove();

  const colors = {
    duplicate: "#dc2626",  // red
    success: "#16a34a",    // green
    warning: "#d97706",    // amber
    info: "#2563eb",       // blue
  };

  const icons = {
    duplicate: "⚠️",
    success: "✅",
    warning: "⚠️",
    info: "ℹ️",
  };

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
    background: ${colors[type] || colors.info};
    color: white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  `;

  banner.innerHTML = `
    <span>${icons[type]} ApplyWise: ${message}</span>
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

  if (type !== "duplicate") {
    setTimeout(() => banner.remove(), 6000);
  }
}

async function getToken() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: "GET_TOKEN" }, res => resolve(res?.token || null));
  });
}

async function checkForDuplicate(platform, jobInfo) {
  const token = await getToken();
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
      showBanner(result.message, "duplicate");
    }

  } catch (error) {
    console.log("ApplyWise: could not reach API", error);
  }
}

async function trackApplication(platform, jobInfo) {
  const token = await getToken();
  if (!token) return;

  try {
    const response = await fetch(`${API_URL}/applications/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        company: jobInfo.company || "Unknown Company",
        role: jobInfo.role || "Unknown Role",
        platform: jobInfo.platform || "other",
        job_url: jobInfo.job_url,
        status: "applied",
      }),
    });

    if (response.ok) {
      showBanner(`Tracked! ${jobInfo.role} at ${jobInfo.company} saved to ApplyWise.`, "success");
    }

  } catch (error) {
    console.log("ApplyWise: could not track application", error);
  }
}

function watchApplyButton(platform) {
  const checkButton = () => {
    const btn = platform.applyButton?.();
    if (!btn || btn.dataset.applywiseWatched) return;

    btn.dataset.applywiseWatched = "true";

    btn.addEventListener("click", async () => {
      await new Promise(r => setTimeout(r, 1500)); // wait for page to process
      const jobInfo = platform.getJob();
      if (jobInfo.company && jobInfo.role) {
        await trackApplication(platform, jobInfo);
      }
    });
  };

  // Check immediately and keep checking as page loads
  checkButton();
  setTimeout(checkButton, 2000);
  setTimeout(checkButton, 4000);
}

async function init() {
  const platform = detectPlatform();
  if (!platform) return;

  // Wait for page to fully load
  await new Promise(resolve => setTimeout(resolve, 2500));

  const jobInfo = platform.getJob();

  console.log("ApplyWise detected:", platform.name, jobInfo);

  if (!jobInfo.company && !jobInfo.role) {
    console.log("ApplyWise: could not extract job info from page");
    return;
  }

  // Check for duplicates when visiting a job page
  if (jobInfo.company && jobInfo.role) {
    await checkForDuplicate(platform, jobInfo);
  }

  // Watch for apply button clicks to auto-track
  watchApplyButton(platform);
}

// ─── Run ────────────────────────────────────────────────────────────────────

init();

// Re-run on URL changes (for single-page apps like LinkedIn)
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    setTimeout(init, 2000);
  }
}).observe(document, { subtree: true, childList: true });