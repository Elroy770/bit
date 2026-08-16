const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

const $ = (selector) => document.querySelector(selector);

const loginPanel = $("#login-panel");
const loginForm = $("#login-form");
const loginMessage = $("#login-message");
const loginSubmit = $("#login-submit");
const appContent = $("#app-content");
const sessionActions = $("#session-actions");
const userChip = $("#user-chip");
const form = $("#form");
const message = $("#message");
const submitButton = $("#submit");
const amountInput = $("#amount");
const paidInput = $("#paid_amount");
const phoneInput = $("#phone");
const nameInput = $("#name");
const customerLookup = $("#customer-lookup");
const receiptInput = $("#receipt");
const fileDrop = $("#file-drop");
const fileName = $("#file-name");
const preview = $("#preview");
const previewImage = $("#preview-image");
const toast = $("#toast");
const recentList = $("#recent");

const recent = [];
let previewUrl = null;
let toastTimer = null;

const money = (value) => {
  const number = Number(value);
  return `${(Number.isFinite(number) ? number : 0).toFixed(2)} ₪`;
};

function setLoading(button, loading) {
  button.classList.toggle("is-loading", loading);
  button.disabled = loading;
}

function setMessage(element, text, kind = "") {
  element.textContent = text;
  element.className = `msg ${kind}`.trim();
}

function formatApiError(body, fallback) {
  if (typeof body?.detail === "string") return body.detail;
  if (Array.isArray(body?.detail)) {
    return body.detail.map((item) => item.msg || item.message || "נתון לא תקין").join("; ");
  }
  return fallback;
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
  $("#name").focus();
}

function updateSummary() {
  const amount = Number(amountInput.value) || 0;
  const paid = Math.min(Number(paidInput.value) || 0, amount);
  $("#sum-amount").textContent = money(amount);
  $("#sum-paid").textContent = money(paid);
  const balance = Math.max(amount - paid, 0);
  const balanceElement = $("#sum-balance");
  balanceElement.textContent = money(balance);
  balanceElement.className = balance > 0 ? "text-debt" : "text-ok";
}

function clearReceipt() {
  receiptInput.value = "";
  fileName.textContent = "גרור לכאן תמונה או לחץ לבחירה";
  preview.hidden = true;
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }
}

function applyReceipt(file) {
  if (!file) return clearReceipt();
  if (!file.type.startsWith("image/")) {
    clearReceipt();
    showToast("ניתן להעלות תמונות בלבד", "danger");
    return;
  }
  if (file.size > MAX_RECEIPT_BYTES) {
    clearReceipt();
    showToast("הקובץ גדול מדי (עד 5MB)", "danger");
    return;
  }
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(file);
  previewImage.src = previewUrl;
  fileName.textContent = file.name;
  preview.hidden = false;
}

function renderRecent() {
  if (!recent.length) {
    recentList.innerHTML = "";
    const empty = document.createElement("li");
    empty.textContent = "עדיין לא נשמרו עסקאות.";
    recentList.append(empty);
    return;
  }
  recentList.replaceChildren(
    ...recent.map((item) => {
      const row = document.createElement("li");
      const name = document.createElement("b");
      name.textContent = item.name;
      row.append(
        name,
        ` · ${money(item.amount)} · נותר ${money(item.balance)} · ${item.time}`,
      );
      return row;
    }),
  );
}

async function checkAuth() {
  try {
    const response = await fetch("/api/auth/me");
    if (!response.ok) return showLogin();
    const user = await response.json();
    if (user.role !== "cashier") {
      showLogin();
      setMessage(loginMessage, "המשתמש המחובר אינו משתמש קופה.", "danger");
      return;
    }
    showApp(user.username);
  } catch {
    showLogin();
    setMessage(loginMessage, "אין חיבור לשרת.", "danger");
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(loginMessage, "מתחבר...");
  setLoading(loginSubmit, true);
  const data = new FormData(loginForm);
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: data.get("username"),
        password: data.get("password"),
        remember: data.get("remember") === "on",
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok && body.role === "cashier") {
      setMessage(loginMessage, "");
      loginForm.reset();
      showApp(body.username);
    } else if (response.ok) {
      setMessage(loginMessage, "למשתמש אין הרשאת קופה.", "danger");
    } else {
      setMessage(
        loginMessage,
        typeof body.detail === "string"
          ? body.detail
          : "שם משתמש או סיסמה שגויים",
        "danger",
      );
    }
  } catch {
    setMessage(loginMessage, "לא ניתן להתחבר לשרת", "danger");
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

[amountInput, paidInput].forEach((input) =>
  input.addEventListener("input", updateSummary),
);

$("#paid-shortcuts").addEventListener("click", (event) => {
  const button = event.target.closest("[data-paid]");
  if (!button) return;
  const amount = Number(amountInput.value) || 0;
  const map = { none: 0, half: amount / 2, full: amount };
  paidInput.value = (map[button.dataset.paid] || 0).toFixed(2);
  updateSummary();
});

async function lookupCustomer() {
  const normalized = phoneInput.value.replace(/[\s-]/g, "");
  if (!/^\+?[0-9]{7,15}$/.test(normalized)) {
    customerLookup.textContent = "";
    return;
  }
  customerLookup.textContent = "בודק לקוח...";
  try {
    const response = await fetch(`/api/customers/lookup?phone=${encodeURIComponent(normalized)}`);
    if (response.ok) {
      const customer = await response.json();
      nameInput.value = customer.name || "";
      customerLookup.textContent = customer.name ? `נמצא לקוח קיים: ${customer.name}` : "";
    } else if (response.status === 404) {
      customerLookup.textContent = "לקוח חדש";
    } else if (response.status === 401) {
      showLogin();
      setMessage(loginMessage, "פג תוקף ההתחברות. התחבר מחדש.", "danger");
    } else {
      customerLookup.textContent = "לא ניתן לבדוק את הלקוח";
    }
  } catch {
    customerLookup.textContent = "לא ניתן לבדוק את הלקוח";
  }
}

phoneInput.addEventListener("blur", () => {
  const normalized = phoneInput.value.replace(/[\s-]/g, "");
  const valid = normalized === "" || /^\+?[0-9]{7,15}$/.test(normalized);
  phoneInput.setAttribute("aria-invalid", String(!valid));
  phoneInput.value = normalized;
  if (valid && normalized) lookupCustomer();
});

receiptInput.addEventListener("change", () =>
  applyReceipt(receiptInput.files[0]),
);
$("#clear-receipt").addEventListener("click", clearReceipt);

["dragenter", "dragover"].forEach((type) =>
  fileDrop.addEventListener(type, (event) => {
    event.preventDefault();
    fileDrop.classList.add("is-dragging");
  }),
);

["dragleave", "drop"].forEach((type) =>
  fileDrop.addEventListener(type, (event) => {
    event.preventDefault();
    fileDrop.classList.remove("is-dragging");
  }),
);

fileDrop.addEventListener("drop", (event) => {
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  const transfer = new DataTransfer();
  transfer.items.add(file);
  receiptInput.files = transfer.files;
  applyReceipt(file);
});

form.addEventListener("reset", () => {
  clearReceipt();
  phoneInput.removeAttribute("aria-invalid");
  setMessage(message, "");
  setTimeout(updateSummary);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;

  const amount = Number(amountInput.value) || 0;
  const paid = Number(paidInput.value) || 0;
  if (paid > amount) {
    setMessage(message, "הסכום ששולם גדול מסכום העסקה", "danger");
    return;
  }

  setMessage(message, "שומר...");
  setLoading(submitButton, true);
  try {
    const response = await fetch("/api/transactions", {
      method: "POST",
      body: new FormData(form),
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      recent.unshift({
        name: body.name,
        amount: body.amount,
        balance: body.balance,
        time: new Date().toLocaleTimeString("he-IL", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      });
      recent.splice(8);
      renderRecent();
      form.reset();
      clearReceipt();
      updateSummary();
      setMessage(message, "");
      showToast("העסקה נשמרה בהצלחה");
      $("#name").focus();
    } else if (response.status === 401) {
      showLogin();
      setMessage(loginMessage, "פג תוקף ההתחברות. התחבר מחדש.", "danger");
    } else {
      setMessage(
        message,
        formatApiError(body, "שמירת העסקה נכשלה"),
        "danger",
      );
      showToast("שמירת העסקה נכשלה", "danger");
    }
  } catch {
    setMessage(message, "לא ניתן להתחבר לשרת", "danger");
  } finally {
    setLoading(submitButton, false);
  }
});

$("#logout").addEventListener("click", async () => {
  const response = await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
  form.reset();
  clearReceipt();
  updateSummary();
  if (!response || !response.ok) {
    setMessage(message, "ההתנתקות נכשלה. נסה שוב.", "danger");
    return;
  }
  showLogin();
  setMessage(loginMessage, "התנתקת בהצלחה.", "ok");
});

updateSummary();
renderRecent();
checkAuth();
