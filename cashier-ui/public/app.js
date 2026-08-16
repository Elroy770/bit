const loginForm = document.querySelector("#login-form");
const loginPanel = document.querySelector("#login-panel");
const appContent = document.querySelector("#app-content");
const loginMessage = document.querySelector("#login-message");
const form = document.querySelector("#form");
const message = document.querySelector("#message");

async function checkAuth() {
  const response = await fetch("/api/auth/me");
  if (response.ok) {
    const user = await response.json();
    if (user.role !== "cashier") {
      loginMessage.textContent = "המשתמש אינו משתמש קופה.";
      return;
    }
    loginPanel.hidden = true;
    appContent.hidden = false;
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage.textContent = "מתחבר...";
  const data = new FormData(loginForm);
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: data.get("username"),
      password: data.get("password"),
      remember: data.get("remember") === "on",
    }),
  });
  if (response.ok) {
    loginMessage.textContent = "";
    loginPanel.hidden = true;
    appContent.hidden = false;
    form.querySelector("[autofocus]").focus();
  } else {
    const body = await response.json().catch(() => ({}));
    loginMessage.textContent = body.detail || "פרטי התחברות שגויים";
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.className = "";
  message.textContent = "שומר...";
  try {
    const response = await fetch("/api/transactions", { method: "POST", body: new FormData(form) });
    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      form.reset();
      message.className = "ok";
      message.textContent = "העסקה נשמרה בהצלחה";
    } else {
      message.className = "danger";
      message.textContent = response.status === 401 ? "פג תוקף ההתחברות. התחבר מחדש." : (body.detail || "שמירה נכשלה");
    }
  } catch {
    message.className = "danger";
    message.textContent = "לא ניתן להתחבר לשרת";
  }
});

document.querySelector("#logout").addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  appContent.hidden = true;
  loginPanel.hidden = false;
  loginForm.reset();
});

checkAuth();
