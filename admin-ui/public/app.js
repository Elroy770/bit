const $ = (selector) => document.querySelector(selector);

const loginPanel = $("#login-panel");
const loginForm = $("#login-form");
const loginMessage = $("#login-message");
const loginSubmit = $("#login-submit");
const appContent = $("#app-content");
const sessionActions = $("#session-actions");
const userChip = $("#user-chip");
const searchInput = $("#search");
const debtInput = $("#debt");
const selectAll = $("#select-all");
const tableBody = $("#customers");
const emptyState = $("#empty");
const detail = $("#detail");
const message = $("#message");
const whatsappButton = $("#whatsapp");
const selectionChip = $("#selection-chip");
const toast = $("#toast");

const selected = new Set();
let customers = [];
let openPhone = null;
let searchTimer = null;
let toastTimer = null;

const money = (value) => {
  const number = Number(value);
  return `${(Number.isFinite(number) ? number : 0).toFixed(2)} ₪`;
};

const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
};

function element(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  Object.entries(options.attrs || {}).forEach(([key, value]) =>
    node.setAttribute(key, value),
  );
  Object.entries(options.dataset || {}).forEach(([key, value]) => {
    node.dataset[key] = value;
  });
  node.append(...children);
  return node;
}

function setMessage(text, kind = "") {
  message.textContent = text;
  message.className = `msg ${kind}`.trim();
}

function showToast(text, kind = "ok") {
  toast.textContent = text;
  toast.className = `toast ${kind}`;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 3500);
}

function setLoading(button, loading) {
  button.classList.toggle("is-loading", loading);
  button.disabled = loading;
}

async function request(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

function showLogin() {
  appContent.hidden = true;
  sessionActions.hidden = true;
  loginPanel.hidden = false;
  userChip.textContent = "";
}

function showApp(username) {
  loginPanel.hidden = true;
  appContent.hidden = false;
  sessionActions.hidden = false;
  userChip.textContent = username ? `מחובר: ${username}` : "מחובר";
}

function updateSelectionUi() {
  const count = selected.size;
  whatsappButton.disabled = count === 0;
  selectionChip.hidden = count === 0;
  selectionChip.textContent = `${count} נבחרו`;
  const rows = [...tableBody.querySelectorAll("tr")];
  rows.forEach((row) =>
    row.classList.toggle("is-selected", selected.has(row.dataset.phone)),
  );
  selectAll.checked = count > 0 && count === customers.length;
  selectAll.indeterminate = count > 0 && count < customers.length;
}

function renderStats(dashboard) {
  $("#stat-debt").textContent = money(dashboard.total_debt);
  $("#stat-debtors").textContent = String(dashboard.customers_in_debt ?? 0);
  $("#stat-customers").textContent = String(customers.length);
  $("#stat-paid").textContent = money(
    customers.reduce(
      (total, customer) => total + Number(customer.total_paid || 0),
      0,
    ),
  );
}

function renderCustomers() {
  tableBody.replaceChildren(
    ...customers.map((customer) => {
      const inDebt = Number(customer.balance) > 0;
      const checkbox = element("input", {
        attrs: {
          type: "checkbox",
          "aria-label": `בחירת ${customer.name || customer.phone}`,
        },
      });
      checkbox.checked = selected.has(customer.phone);
      checkbox.dataset.action = "select";

      return element("tr", { dataset: { phone: customer.phone } }, [
        element("td", {}, [checkbox]),
        element("td", { text: customer.name || "ללא שם" }),
        element("td", { className: "num", text: customer.phone || "-" }),
        element("td", {
          className: "num",
          text: String(customer.transaction_count || 0),
        }),
        element("td", {
          className: `num ${inDebt ? "text-debt" : "text-ok"}`,
          text: money(customer.balance),
        }),
        element("td", {}, [
          element("button", {
            className: "btn btn-secondary btn-sm",
            text: "פירוט",
            attrs: { type: "button" },
            dataset: { action: "detail" },
          }),
        ]),
      ]);
    }),
  );
  emptyState.hidden = customers.length > 0;
  updateSelectionUi();
}

async function load() {
  const query = new URLSearchParams({
    search: searchInput.value.trim(),
    debt_only: String(debtInput.checked),
  });
  const [dashboardResult, customersResult] = await Promise.all([
    request("/api/dashboard"),
    request(`/api/customers?${query}`),
  ]);

  if (
    dashboardResult.response.status === 401 ||
    customersResult.response.status === 401
  ) {
    showLogin();
    loginMessage.textContent = "פג תוקף ההתחברות. התחבר מחדש.";
    loginMessage.className = "msg danger";
    return;
  }

  if (!dashboardResult.response.ok || !customersResult.response.ok) {
    setMessage("לא ניתן לטעון נתונים מהשרת.", "danger");
    return;
  }

  customers = Array.isArray(customersResult.body) ? customersResult.body : [];
  const visiblePhones = new Set(customers.map((customer) => customer.phone));
  [...selected].forEach((phone) => {
    if (!visiblePhones.has(phone)) selected.delete(phone);
  });

  setMessage("");
  renderCustomers();
  renderStats(dashboardResult.body || {});
}

function renderDetail(customer) {
  const inDebt = Number(customer.balance) > 0;
  const header = element("div", { className: "detail-head" }, [
    element("h2", { text: `${customer.name || "ללא שם"} · ${customer.phone}` }),
    element("button", {
      className: "btn btn-ghost btn-sm",
      text: "סגור",
      attrs: { type: "button" },
      dataset: { action: "close-detail" },
    }),
  ]);

  const meta = element("div", { className: "detail-meta" }, [
    element("span", {
      className: "chip",
      text: `חיובים: ${money(customer.total_amount)}`,
    }),
    element("span", {
      className: "chip",
      text: `שולם: ${money(customer.total_paid)}`,
    }),
    element("span", {
      className: `badge ${inDebt ? "badge-debt" : "badge-ok"}`,
      text: inDebt ? `חוב: ${money(customer.balance)}` : "אין חוב",
    }),
  ]);

  const transactions = (customer.transactions || []).map((transaction) => {
    const settled = Number(transaction.balance) === 0;
    const paidField = element("div", { className: "field" }, [
      element("label", {
        text: "שולם (₪)",
        attrs: { for: `paid-${transaction.id}` },
      }),
      element("input", {
        attrs: {
          id: `paid-${transaction.id}`,
          type: "number",
          step: "0.01",
          min: "0",
          max: String(transaction.amount),
          value: String(transaction.paid_amount ?? 0),
        },
      }),
    ]);

    const actions = element("div", { className: "transaction-actions" }, [
      paidField,
      element("button", {
        className: "btn btn-primary btn-sm",
        text: "עדכן",
        attrs: { type: "button" },
        dataset: { action: "pay", id: String(transaction.id) },
      }),
      element("button", {
        className: "btn btn-secondary btn-sm",
        text: "סמן כשולם במלואו",
        attrs: { type: "button" },
        dataset: {
          action: "pay-full",
          id: String(transaction.id),
          amount: String(transaction.amount),
        },
      }),
    ]);

    const children = [
      element("div", { className: "transaction-head" }, [
        element("strong", {
          text: `${formatDate(transaction.created_at)} · ${money(transaction.amount)}`,
        }),
        element("span", {
          className: `badge ${settled ? "badge-ok" : "badge-debt"}`,
          text: settled ? "שולם" : `נותר ${money(transaction.balance)}`,
        }),
      ]),
    ];

    if (transaction.note)
      children.push(
        element("p", { className: "transaction-note", text: transaction.note }),
      );
    children.push(actions);

    if (transaction.receipt_path) {
      const url = `/api/receipts/${encodeURIComponent(transaction.receipt_path)}`;
      children.push(
        element("div", {}, [
          element("a", {
            text: "פתיחת הקבלה בחלון חדש",
            attrs: { href: url, target: "_blank", rel: "noopener noreferrer" },
          }),
          element("img", {
            className: "receipt",
            attrs: { src: url, alt: "צילום קבלה", loading: "lazy" },
          }),
        ]),
      );
    }

    return element("article", { className: "transaction" }, children);
  });

  detail.replaceChildren(
    header,
    meta,
    ...(transactions.length
      ? transactions
      : [
          element("p", {
            className: "empty-state",
            text: "אין עסקאות ללקוח זה.",
          }),
        ]),
  );
  detail.hidden = false;
}

async function showCustomer(phone) {
  const { response, body } = await request(
    `/api/customers/${encodeURIComponent(phone)}`,
  );
  if (!response.ok) {
    showToast("לא ניתן לטעון את פרטי הלקוח", "danger");
    return;
  }
  openPhone = phone;
  renderDetail(body);
  detail.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function pay(id, value) {
  const { response, body } = await request(`/api/transactions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paid_amount: value }),
  });
  if (!response.ok) {
    showToast(
      typeof body.detail === "string" ? body.detail : "העדכון נכשל",
      "danger",
    );
    return;
  }
  showToast("התשלום עודכן");
  await load();
  if (openPhone) await showCustomer(openPhone);
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage.textContent = "מתחבר...";
  loginMessage.className = "msg";
  setLoading(loginSubmit, true);
  const data = new FormData(loginForm);
  try {
    const { response, body } = await request("/api/auth/login", {
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
      loginForm.reset();
      showApp(body.username);
      await load();
    } else if (response.ok) {
      loginMessage.textContent = "למשתמש אין הרשאת אדמין.";
      loginMessage.className = "msg danger";
    } else {
      loginMessage.textContent =
        typeof body.detail === "string"
          ? body.detail
          : "שם משתמש או סיסמה שגויים";
      loginMessage.className = "msg danger";
    }
  } catch {
    loginMessage.textContent = "לא ניתן להתחבר לשרת";
    loginMessage.className = "msg danger";
  } finally {
    setLoading(loginSubmit, false);
  }
});

$("#toggle-password").addEventListener("click", () => {
  const input = $("#login-password");
  const isPassword = input.type === "password";
  input.type = isPassword ? "text" : "password";
  $("#toggle-password").textContent = isPassword ? "הסתר" : "הצג";
});

searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(load, 300);
});

debtInput.addEventListener("change", load);
$("#refresh").addEventListener("click", load);

selectAll.addEventListener("change", () => {
  selected.clear();
  if (selectAll.checked)
    customers.forEach((customer) => selected.add(customer.phone));
  tableBody.querySelectorAll("input[data-action='select']").forEach((input) => {
    input.checked = selectAll.checked;
  });
  updateSelectionUi();
});

tableBody.addEventListener("change", (event) => {
  const input = event.target.closest("input[data-action='select']");
  if (!input) return;
  const phone = input.closest("tr").dataset.phone;
  input.checked ? selected.add(phone) : selected.delete(phone);
  updateSelectionUi();
});

tableBody.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action='detail']");
  if (!button) return;
  showCustomer(button.closest("tr").dataset.phone);
});

detail.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  if (button.dataset.action === "close-detail") {
    detail.hidden = true;
    detail.replaceChildren();
    openPhone = null;
    return;
  }
  if (button.dataset.action === "pay") {
    pay(button.dataset.id, $(`#paid-${button.dataset.id}`).value);
  }
  if (button.dataset.action === "pay-full") {
    pay(button.dataset.id, button.dataset.amount);
  }
});

whatsappButton.addEventListener("click", () => {
  const debtors = customers.filter(
    (customer) => selected.has(customer.phone) && Number(customer.balance) > 0,
  );
  if (!debtors.length) {
    showToast("לא נבחרו לקוחות עם חוב פתוח", "danger");
    return;
  }
  debtors.forEach((customer) => {
    const phone = customer.phone
      .replace(/[\s-]/g, "")
      .replace(/^0/, "972")
      .replace(/^\+/, "");
    const text = `שלום ${customer.name || ""}, נותר חוב פתוח של ${money(customer.balance)} מהקניות האחרונות. נשמח אם תוכל להעביר את הסכום בביט. תודה!`;
    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener",
    );
  });
});

$("#logout").addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  selected.clear();
  customers = [];
  openPhone = null;
  detail.hidden = true;
  detail.replaceChildren();
  tableBody.replaceChildren();
  showLogin();
});

(async function start() {
  try {
    const response = await fetch("/api/auth/me");
    if (!response.ok) return showLogin();
    const user = await response.json();
    if (user.role !== "admin") {
      showLogin();
      loginMessage.textContent = "המשתמש המחובר אינו משתמש אדמין.";
      loginMessage.className = "msg danger";
      return;
    }
    showApp(user.username);
    await load();
  } catch {
    showLogin();
    loginMessage.textContent = "אין חיבור לשרת.";
    loginMessage.className = "msg danger";
  }
})();
