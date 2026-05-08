const API = "http://127.0.0.1:8001";

async function getToken() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: "GET_TOKEN" }, res => resolve(res?.token || null));
  });
}

async function init() {
  const token = await getToken();

  if (!token) {
    show("login-view");
    return;
  }

  try {
    const res = await fetch(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      chrome.runtime.sendMessage({ type: "CLEAR_TOKEN" });
      show("login-view");
      return;
    }

    const user = await res.json();
    document.getElementById("user-email").textContent = user.email;

    const analyticsRes = await fetch(`${API}/applications/analytics`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const analytics = await analyticsRes.json();

    document.getElementById("stat-total").textContent = analytics.total_applications;
    document.getElementById("stat-week").textContent = analytics.this_week;
    document.getElementById("stat-process").textContent = analytics.by_status?.in_process || 0;
    document.getElementById("stat-response").textContent =
      Math.round((analytics.response_rate || 0) * 100) + "%";

    show("dashboard-view");

  } catch (e) {
    show("login-view");
  }
}

function show(id) {
  document.getElementById("loading").style.display = "none";
  document.getElementById("login-view").style.display = "none";
  document.getElementById("dashboard-view").style.display = "none";
  document.getElementById(id).style.display = "block";
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("login-btn").addEventListener("click", async () => {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const errorEl = document.getElementById("login-error");

    if (!email || !password) {
      errorEl.textContent = "Please enter email and password";
      return;
    }

    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
      });

      if (!res.ok) {
        errorEl.textContent = "Incorrect email or password";
        return;
      }

      const data = await res.json();
      chrome.runtime.sendMessage({ type: "SET_TOKEN", token: data.access_token });
      init();

    } catch (e) {
      errorEl.textContent = "Could not connect to ApplyWise server";
    }
  });

  document.getElementById("logout-btn").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "CLEAR_TOKEN" });
    show("login-view");
  });

  init();
});