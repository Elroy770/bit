let selected = [];
let openCustomerPhone = null;
const loginForm = document.querySelector("#login-form");
const loginPanel = document.querySelector("#login-panel");
const appContent = document.querySelector("#app-content");
const loginMessage = document.querySelector("#login-message");
const money = (value) => {
  const number = Number(value);
  return `${Number.isFinite(number) ? number.toFixed(2) : "0.00"} ₪`;
};

async function jsonResponse(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function showAuthenticatedApp() {
  const response = await fetch("/api/auth/me");
  if (!response.ok) return;
  const user = await response.json();
  if (user.role !== "admin") {
    loginMessage.textContent = "המשתמש אינו משתמש אדמין.";
    return;
  }
  loginPanel.hidden = true;
  appContent.hidden = false;
  load();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage.textContent = "מתחבר...";
  const data = new FormData(loginForm);
  const { response, body } = await jsonResponse("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: data.get("username"),
      password: data.get("password"),
      remember: data.get("remember") === "on",
    }),
  });
  if (response.ok && body.role === "admin") {
    loginMessage.textContent = "";
    loginPanel.hidden = true;
    appContent.hidden = false;
    load();
  } else {
    loginMessage.textContent = response.ok ? "למשתמש אין הרשאת אדמין." : (body.detail || "פרטי התחברות שגויים");
  }
});

async function load() {
  const search = document.querySelector("#search").value;
  const debtOnly = document.querySelector("#debt").checked;
  const query = new URLSearchParams({ search, debt_only: debtOnly });
  const [dashboardResult, customersResult] = await Promise.all([
    jsonResponse("/api/dashboard"),
    jsonResponse(`/api/customers?${query}`),
  ]);
  const dashboard = dashboardResult.response.ok ? dashboardResult.body : {};
  const customers = customersResult.response.ok && Array.isArray(customersResult.body) ? customersResult.body : [];
  document.querySelector("#summary").innerHTML = `<div class="card">סה"כ חוב<br><b>${money(dashboard.total_debt)}</b></div><div class="card">לקוחות חייבים<br><b>${Number.isFinite(Number(dashboard.customers_in_debt)) ? dashboard.customers_in_debt : 0}</b></div>`;
  document.querySelector("#customers").innerHTML = customers.map((customer) => `<tr><td><input type="checkbox" onchange="toggle('${customer.phone}')"></td><td>${customer.name || "ללא שם"}</td><td>${customer.phone || "-"}</td><td>${customer.transaction_count || 0}</td><td class="${Number(customer.balance) > 0 ? "danger" : "ok"}">${money(customer.balance)}</td><td><button onclick="show('${customer.phone}')">פירוט</button></td></tr>`).join("");
  const message = document.querySelector("#message");
  if (!dashboardResult.response.ok || !customersResult.response.ok) {
    message.className = "danger";
    message.textContent = "לא ניתן לטעון נתונים.";
  } else {
    message.textContent = "";
  }
}

function toggle(phone) {
  selected.includes(phone) ? selected = selected.filter((item) => item !== phone) : selected.push(phone);
}

async function show(phone) {
  openCustomerPhone = phone;
  const { response, body } = await jsonResponse(`/api/customers/${phone}`);
  if (!response.ok) return;
  document.querySelector("#detail").innerHTML = `<h2>${body.name} — ${body.phone}</h2><p>חיובים: ${money(body.total_amount)} | שולם: ${money(body.total_paid)} | חוב: ${money(body.balance)}</p>` + (body.transactions || []).map((transaction) => `<article class="card"><b>${new Date(transaction.created_at).toLocaleDateString("he-IL")}</b> — ${money(transaction.amount)} — ${Number(transaction.balance) === 0 ? "שולם" : "לא שולם"}<br>${transaction.note || ""}<br><label>שולם: <input id="paid-${transaction.id}" type="number" value="${transaction.paid_amount || 0}" step="0.01"><button onclick="pay(${transaction.id})">עדכן</button></label>${transaction.receipt_path ? `<div><a href="/api/receipts/${encodeURIComponent(transaction.receipt_path)}" target="_blank" rel="noopener">הצג קבלה</a><br><img class="receipt" src="/api/receipts/${encodeURIComponent(transaction.receipt_path)}" alt="קבלה" loading="lazy"></div>` : ""}</article>`).join("");
}

async function pay(id) {
  const paid = document.querySelector(`#paid-${id}`).value;
  const { response } = await jsonResponse(`/api/transactions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paid_amount: paid }) });
  document.querySelector("#message").textContent = response.ok ? "עודכן" : "העדכון נכשל";
  await load();
  if (response.ok && openCustomerPhone) await show(openCustomerPhone);
}

async function whatsapp() {
  for (const phone of selected) {
    const { response, body } = await jsonResponse(`/api/customers/${phone}`);
    if (response.ok && Number(body.balance) > 0) window.open(`https://wa.me/${phone.replace(/^0/, "972")}?text=${encodeURIComponent(`שלום ${body.name}, נשאר לך חוב של ${money(body.balance)} מהקניות האחרונות. נשמח אם תוכל להעביר את הסכום בביט. תודה!`)}`, "_blank");
  }
}

document.querySelector("#logout").addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  appContent.hidden = true;
  loginPanel.hidden = false;
  loginForm.reset();
});

showAuthenticatedApp();
