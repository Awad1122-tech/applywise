const API_URL = "http://127.0.0.1:8001";

async function getToken() {
  return new Promise(resolve => {
    chrome.storage.local.get(["token"], (result) => {
      resolve(result.token || null)
    })
  })
}

function parseFromTitle() {
  const title = document.title || ""

  const genericWords = [
    "jobs", "job", "careers", "career", "graduate", "graduates",
    "vacancy", "vacancies", "recruitment", "hiring", "work", "employment",
    "gradcracker", "indeed", "linkedin", "reed", "totaljobs", "monster",
    "glassdoor", "brightnetwork", "prospects", "milkround", "stem",
    "students", "careers for stem students", "find your perfect job"
  ]

  function isGeneric(str) {
    const lower = str.toLowerCase().trim()
    return genericWords.some(w => lower === w || lower.includes(w))
  }

  let parts = title.split("|").map(p => p.trim()).filter(p => p.length > 0)

  if (parts.length <= 1) {
    parts = title.split(/[-–]/).map(p => p.trim()).filter(p => p.length > 0)
  }

  if (parts.length === 0) return { role: null, company: null }

  const role = parts[0]

  let company = null
  for (let i = 1; i < parts.length; i++) {
    if (!isGeneric(parts[i])) {
      company = parts[i].replace(/\s*Hub\s*$/i, "").trim()
      break
    }
  }

  return { role, company }
}

function extractJobInfo() {
  const url = window.location.href
  let company = null
  let role = null

  const platformSelectors = [
    {
      match: url.includes("linkedin.com"),
      company: [
        ".job-details-jobs-unified-top-card__company-name a",
        ".job-details-jobs-unified-top-card__company-name",
        ".jobs-unified-top-card__company-name",
        ".topcard__org-name-link",
      ],
      role: [
        ".job-details-jobs-unified-top-card__job-title h1",
        ".jobs-unified-top-card__job-title",
        "h1.topcard__title",
        "h1",
      ]
    },
    {
      match: url.includes("indeed.com"),
      company: [
        "[data-testid='inlineHeader-companyName']",
        "[data-company-name]",
        ".jobsearch-CompanyInfoWithoutHeaderImage",
      ],
      role: [
        "[data-testid='jobsearch-JobInfoHeader-title']",
        ".jobsearch-JobInfoHeader-title",
        "h1",
      ]
    },
    {
      match: url.includes("reed.co.uk"),
      company: ["[data-qa='publisher-link']", ".employer-name"],
      role: ["h1[data-qa='job-title']", "h1"],
    },
    {
      match: url.includes("totaljobs.com"),
      company: [".job-header__company-name", ".employer-name"],
      role: ["h1.job-header__title", "h1"],
    },
    {
      match: url.includes("cv-library.co.uk"),
      company: [".company-name", "[itemprop='hiringOrganization']"],
      role: ["h1.job-title", "h1"],
    },
    {
      match: url.includes("workday.com") || url.includes("myworkdayjobs.com"),
      company: () => parseFromTitle().company,
      role: ["[data-automation-id='jobPostingHeader'] h2", "h1", "h2"],
    },
    {
      match: url.includes("greenhouse.io"),
      company: [".company-name", "#header .company-name"],
      role: ["h1.app-title", "#header h1", "h1"],
    },
    {
      match: url.includes("lever.co"),
      company: [".main-header-logo img", ".main-header-logo"],
      role: [".posting-headline h2", "h2"],
    },
    {
      match: url.includes("jobs.nhs.uk"),
      company: [".nhsuk-caption-l", "[class*='employer']"],
      role: ["h1"],
    },
    {
      match: url.includes("civilservicejobs.service.gov.uk"),
      company: [".org-title", ".department-name"],
      role: ["h1"],
    },
    {
      match: url.includes("gradcracker.com"),
      company: () => parseFromTitle().company,
      role: ["h1"],
    },
    {
      match: url.includes("brightnetwork.co.uk"),
      company: [".employer-name", "[class*='company']"],
      role: ["h1"],
    },
    {
      match: url.includes("amazon.jobs"),
      company: () => "Amazon",
      role: ["h1"],
    },
    {
      match: url.includes("oraclecloud.com") || url.includes("taleo.net"),
      company: () => {
        const logo = document.querySelector("img[alt]")
        if (logo?.alt && logo.alt.length < 50 && logo.alt.length > 1) return logo.alt
        return parseFromTitle().company
      },
      role: ["h1", ".jobTitle", "[class*='job-title']"],
    },
  ]

  for (const p of platformSelectors) {
    if (p.match) {
      if (typeof p.company === "function") {
        company = p.company()
      } else {
        for (const sel of p.company || []) {
          const el = document.querySelector(sel)
          if (el) { company = el.innerText?.trim() || el.alt?.trim(); break }
        }
      }

      if (typeof p.role === "function") {
        role = p.role()
      } else {
        for (const sel of p.role || []) {
          const el = document.querySelector(sel)
          if (el) { role = el.innerText?.trim(); break }
        }
      }

      if (company || role) break
    }
  }

  if (!company || !role) {
    const parsed = parseFromTitle()
    if (!role && parsed.role) role = parsed.role
    if (!company && parsed.company) company = parsed.company
  }

  if (!role) role = document.querySelector("h1")?.innerText?.trim()
  if (!company) {
    try {
      company = new URL(url).hostname.replace("www.", "").split(".")[0]
      company = company.charAt(0).toUpperCase() + company.slice(1)
    } catch {}
  }

  return { company, role, job_url: url, platform: "other" }
}

function isJobPage() {
  const url = window.location.href.toLowerCase()
  const title = document.title.toLowerCase()

  const jobKeywords = [
    "job", "career", "vacancy", "position", "role", "hiring",
    "recruit", "apply", "internship", "placement", "graduate"
  ]

  const hasJobUrl = jobKeywords.some(k => url.includes(k))
  const hasJobTitle = jobKeywords.some(k => title.includes(k))
  const hasApplyButton = !!Array.from(document.querySelectorAll("button, a")).find(b =>
    b.innerText?.toLowerCase().includes("apply")
  )

  return (hasJobUrl || hasJobTitle) && hasApplyButton
}

function showBanner(message, type = "info") {
  document.getElementById("applywise-banner")?.remove()

  const colors = {
    duplicate: "#dc2626",
    success: "#16a34a",
    warning: "#d97706",
    info: "#2563eb",
  }

  const icons = {
    duplicate: "⚠️",
    success: "✅",
    warning: "⚠️",
    info: "ℹ️",
  }

  const banner = document.createElement("div")
  banner.id = "applywise-banner"
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
  `

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
  `

  document.body.prepend(banner)

  if (type !== "duplicate") {
    setTimeout(() => banner.remove(), 6000)
  }
}

async function checkForDuplicate(jobInfo) {
  const token = await getToken()
  if (!token) {
    console.log("ApplyWise: no token found, user not logged in")
    return
  }

  try {
    const response = await fetch(`${API_URL}/duplicate/check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(jobInfo),
    })

    if (!response.ok) {
      console.log("ApplyWise: duplicate check failed", response.status)
      return
    }

    const result = await response.json()
    console.log("ApplyWise duplicate check result:", result)

    if (result.is_duplicate) {
      showBanner(result.message, "duplicate")
    } else {
      console.log("ApplyWise: no duplicate found for", jobInfo.company, "-", jobInfo.role)
    }

  } catch (error) {
    console.log("ApplyWise: could not reach API", error)
  }
}

async function trackApplication(jobInfo) {
  const token = await getToken()
  if (!token) return

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
    })

    if (response.ok) {
      showBanner(`Tracked! ${jobInfo.role} at ${jobInfo.company} saved to ApplyWise.`, "success")
    }

  } catch (error) {
    console.log("ApplyWise: could not track application", error)
  }
}

function watchApplyButton(jobInfo) {
  const checkButton = () => {
    const btn = Array.from(document.querySelectorAll("button, a")).find(b =>
      b.innerText?.toLowerCase().includes("apply") &&
      !b.dataset.applywiseWatched
    )

    if (!btn) return
    btn.dataset.applywiseWatched = "true"

    btn.addEventListener("click", async () => {
      await new Promise(r => setTimeout(r, 1500))
      const updatedInfo = extractJobInfo()
      if (updatedInfo.company && updatedInfo.role) {
        await trackApplication(updatedInfo)
      }
    })
  }

  checkButton()
  setTimeout(checkButton, 2000)
  setTimeout(checkButton, 4000)
}

async function init() {
  await new Promise(resolve => setTimeout(resolve, 2500))

  if (!isJobPage()) {
    console.log("ApplyWise: not a job page, skipping")
    return
  }

  const jobInfo = extractJobInfo()
  console.log("ApplyWise detected job:", jobInfo)

  if (!jobInfo.company && !jobInfo.role) {
    console.log("ApplyWise: could not extract job info")
    return
  }

  await checkForDuplicate(jobInfo)
  watchApplyButton(jobInfo)
}

init()

let lastUrl = location.href
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href
    setTimeout(init, 2000)
  }
}).observe(document, { subtree: true, childList: true })