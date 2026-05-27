const API = "http://127.0.0.1:8001";

async function getToken() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: "GET_TOKEN" }, res => resolve(res?.token || null));
  });
}

async function getPageData() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: "GET_PAGE_DATA" }, res => resolve(res || null));
  });
}

function showView(id) {
  ["view-loading", "view-login", "view-job", "view-dashboard"].forEach(v => {
    document.getElementById(v).style.display = "none";
  });
  document.getElementById(id).style.display = "block";
}

function isJobPage(title, url, pageText) {
  const text = (title + " " + url + " " + pageText).toLowerCase();
  const jobKeywords = ["job", "career", "vacancy", "position", "role", "hiring",
    "recruit", "apply", "internship", "placement", "graduate", "apply now"];
  return jobKeywords.some(k => text.includes(k));
}

async function extractWithClaude(title, url, pageText, token) {
  const prompt = `You are a job page analyser. Extract the company name and job title from this job page.

PAGE TITLE: ${title}
PAGE URL: ${url}
PAGE CONTENT (first 3000 chars):
${pageText.slice(0, 3000)}

RULES:
- company: the actual hiring employer. Not job boards (LinkedIn, Indeed, Reed etc). Extract from page content.
- job_title: exact job title only. Strip reference numbers, dates, locations, and company name if appended. E.g. "Applied Scientist Intern, Amazon University Talent Acquisition" → "Applied Scientist Intern". "Data Analyst (22491)" → "Data Analyst". "Graduate Trainee - London - September 2026" → "Graduate Trainee".
- is_job_page: true if this is a single job listing page, false if it is a search results page or non-job page.

Respond with ONLY valid JSON:
{
  "is_job_page": true or false,
  "company": "exact company name or null",
  "job_title": "clean job title only or null"
}`;

  try {
    const res = await fetch(`${API}/ai/extract-job`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ prompt })
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch (e) {
    return null;
  }
}

async function checkDuplicate(company, role, url, token) {
  try {
    const res = await fetch(`${API}/duplicate/check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        company,
        role,
        job_url: url,
      })
    });

    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function addToTracker(company, role, url, token) {
  const res = await fetch(`${API}/applications/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({
      company: company || "Unknown Company",
      role: role || "General Application",
      platform: "other",
      job_url: url,
      status: "applied",
    })
  });
  return res.ok;
}

async function loadStats(token) {
  try {
    const [userRes, analyticsRes] = await Promise.all([
      fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API}/applications/analytics`, { headers: { Authorization: `Bearer ${token}` } }),
    ]);

    if (!userRes.ok) return false;

    const user = await userRes.json();
    const analytics = await analyticsRes.json();

    document.getElementById("user-email").textContent = user.email;
    document.getElementById("stat-total").textContent = analytics.total_applications;
    document.getElementById("stat-week").textContent = analytics.this_week;
    document.getElementById("stat-process").textContent = analytics.by_status?.in_process || 0;
    document.getElementById("stat-response").textContent =
      Math.round((analytics.response_rate || 0) * 100) + "%";

    return true;
  } catch (e) {
    return false;
  }
}

async function init() {
  showView("view-loading");

  const token = await getToken();
  if (!token) { showView("view-login"); return; }

  // Verify token
  try {
    const res = await fetch(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      chrome.runtime.sendMessage({ type: "CLEAR_TOKEN" });
      showView("view-login");
      return;
    }
  } catch (e) {
    showView("view-login");
    return;
  }

  // Get page data from content script
  const pageData = await getPageData();

  if (!pageData || pageData.error || !isJobPage(pageData.title || "", pageData.url || "", pageData.pageText || "")) {
    // Not a job page — show stats dashboard
    const ok = await loadStats(token);
    if (ok) showView("view-dashboard");
    else { chrome.runtime.sendMessage({ type: "CLEAR_TOKEN" }); showView("view-login"); }
    return;
  }

  // It's a job page — extract company and role using Claude
  showView("view-loading");
  document.querySelector("#view-loading p").textContent = "Analysing job page...";

  const extracted = await extractWithClaude(pageData.title, pageData.url, pageData.pageText, token);

  const company = extracted?.company || "";
  const role = extracted?.job_title || "";

  // Pre-fill form fields
  document.getElementById("job-company").value = company;
  document.getElementById("job-role").value = role;

  if (!extracted?.is_job_page || (!company && !role)) {
    // Couldn't detect — show manual entry
    document.getElementById("result-unknown").style.display = "block";
    document.getElementById("add-anyway-btn").style.display = "block";
    showView("view-job");
    return;
  }

  // Check for duplicate
  const dupResult = await checkDuplicate(company, role, pageData.url, token);

  if (dupResult?.is_duplicate) {
    const match = dupResult.matched_application;
    const appliedDate = match?.applied_at
      ? new Date(match.applied_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : "date unknown";
    const statusLabel = match?.status?.replace(/_/g, ' ') || "applied";
    const detail = document.getElementById("duplicate-detail");
    detail.innerHTML = `
      <strong>${match?.company || company}</strong> — ${match?.role || role}<br>
      Applied: ${appliedDate}<br>
      Status: ${statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1)}
    `;
    document.getElementById("result-duplicate").style.display = "block";
    document.getElementById("add-anyway-btn").style.display = "block";
  } else {
    const detail = document.getElementById("new-detail");
    detail.innerHTML = `<strong>${company}</strong> — ${role}`;
    document.getElementById("result-new").style.display = "block";
    document.getElementById("add-btn").style.display = "block";
  }

  showView("view-job");
}

document.addEventListener("DOMContentLoaded", () => {

  // Login
  document.getElementById("login-btn").addEventListener("click", async () => {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const errorEl = document.getElementById("login-error");

    if (!email || !password) { errorEl.textContent = "Please enter email and password"; return; }

    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
      });

      if (!res.ok) { errorEl.textContent = "Incorrect email or password"; return; }

      const data = await res.json();
      chrome.runtime.sendMessage({ type: "SET_TOKEN", token: data.access_token });
      init();
    } catch (e) {
      errorEl.textContent = "Could not connect to ApplyWise server";
    }
  });

  // Add to tracker
  document.getElementById("add-btn").addEventListener("click", async () => {
    const company = document.getElementById("job-company").value.trim();
    const role = document.getElementById("job-role").value.trim();
    const token = await getToken();
    const pageData = await getPageData();

    const btn = document.getElementById("add-btn");
    btn.textContent = "Adding...";
    btn.disabled = true;

    const ok = await addToTracker(company, role, pageData?.url || "", token);

    if (ok) {
      btn.textContent = "✅ Added!";
      btn.style.background = "#166534";
      setTimeout(() => window.close(), 1500);
    } else {
      btn.textContent = "Failed — try again";
      btn.disabled = false;
    }
  });

  // Add anyway (even if duplicate)
  document.getElementById("add-anyway-btn").addEventListener("click", async () => {
    const company = document.getElementById("job-company").value.trim();
    const role = document.getElementById("job-role").value.trim();
    const token = await getToken();
    const pageData = await getPageData();

    const btn = document.getElementById("add-anyway-btn");
    btn.textContent = "Adding...";
    btn.disabled = true;

    const ok = await addToTracker(company, role, pageData?.url || "", token);

    if (ok) {
      btn.textContent = "✅ Added!";
      setTimeout(() => window.close(), 1500);
    } else {
      btn.textContent = "Failed — try again";
      btn.disabled = false;
    }
  });

  // Open dashboard
  document.getElementById("go-dashboard-btn").addEventListener("click", () => {
    chrome.tabs.create({ url: "http://localhost:5173" });
  });
  document.getElementById("go-dashboard-btn2").addEventListener("click", () => {
    chrome.tabs.create({ url: "http://localhost:5173" });
  });

  // Logout
  document.getElementById("logout-btn").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "CLEAR_TOKEN" });
    showView("view-login");
  });
  document.getElementById("logout-btn-job").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "CLEAR_TOKEN" });
    showView("view-login");
  });

  init();
});