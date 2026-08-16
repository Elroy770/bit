const form = document.querySelector("#form");
const message = document.querySelector("#message");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.className = "";
  message.textContent = "שומר...";
  try {
    const response = await fetch("/api/transactions", {
      method: "POST",
      body: new FormData(form),
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      form.reset();
      message.className = "ok";
      message.textContent = "העסקה נשמרה בהצלחה";
    } else if (response.status === 401) {
      message.className = "danger";
      message.textContent = "שמירת העסקה דורשת התחברות למערכת.";
    } else {
      message.className = "danger";
      message.textContent = body.detail || "שמירה נכשלה";
    }
  } catch (error) {
    message.className = "danger";
    message.textContent = "לא ניתן להתחבר לשרת";
  }
});
