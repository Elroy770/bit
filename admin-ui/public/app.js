let selected = [];
const money = (value) => {
  const number = Number(value);
  return `${Number.isFinite(number) ? number.toFixed(2) : "0.00"} ₪`;
};

async function jsonResponse(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function load() {
  const search = document.querySelector("#search").value;
  const debtOnly = document.querySelector("#debt").checked;
  const query = new URLSearchParams({ search, debt_only: debtOnly });
  const [dashboardResult, customersResult] = await Promise.all([
    jsonResponse("/api/dashboard"),
    jsonResponse(`/api/customers?${query}`),
  ]);

  const dashboard = dashboardResult.response.ok ? dashboardResult.body : {};
  const customers = customersResult.response.ok && Array.isArray(customersResult.body)
    ? customersResult.body
    : [];

  document.querySelector("#summary").innerHTML = `
    <div class="card">סה"כ חוב<br><b>${money(dashboard.total_debt)}</b></div>
    <div class="card">לקוחות חייבים<br><b>${Number.isFinite(Number(dashboard.customers_in_debt)) ? dashboard.customers_in_debt : 0}</b></div>`;

  document.querySelector("#customers").innerHTML = customers.map((customer) => `
    <tr>
      <td><input type="checkbox" onchange="toggle('${customer.phone}')"></td>
      <td>${customer.name || "ללא שם"}</td>
      <td>${customer.phone || "-"}</td>
      <td>${customer.transaction_count || 0}</td>
      <td class="${Number(customer.balance) > 0 ? "danger" : "ok"}">${money(customer.balance)}</td>
      <td><button onclick="show('${customer.phone}')">פירוט</button></td>
    </tr>`).join("");

  const message = document.querySelector("#message");
  if (!dashboardResult.response.ok || !customersResult.response.ok) {
    message.className = "danger";
    message.textContent = "לא ניתן לטעון נתונים: נדרשת התחברות למערכת.";
  } else {
    message.textContent = "";
  }
}

function toggle(phone) {
  selected.includes(phone)
    ? selected = selected.filter((item) => item !== phone)
    : selected.push(phone);
}

async function show(phone) {
  const { response, body } = await jsonResponse(`/api/customers/${phone}`);
  if (!response.ok) {
    document.querySelector("#message").textContent = "לא ניתן לטעון את פרטי הלקוח.";
    return;
  }
  const customer = body;
  document.querySelector("#detail").innerHTML = `
    <h2>${customer.name} — ${customer.phone}</h2>
    <p>חיובים: ${money(customer.total_amount)} | שולם: ${money(customer.total_paid)} | חוב: ${money(customer.balance)}</p>`
    + (customer.transactions || []).map((transaction) => `
      <article class="card">
        <b>${new Date(transaction.created_at).toLocaleDateString("he-IL")}</b>
        — ${money(transaction.amount)} — ${Number(transaction.balance) === 0 ? "שולם" : "לא שולם"}<br>
        ${transaction.note || ""}<br>
        <label>שולם:
          <input id="paid-${transaction.id}" type="number" value="${transaction.paid_amount || 0}" step="0.01">
          <button onclick="pay(${transaction.id})">עדכן</button>
        </label>
      </article>`).join("");
}

async function pay(id) {
  const paid = document.querySelector(`#paid-${id}`).value;
  const { response } = await jsonResponse(`/api/transactions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paid_amount: paid }),
  });
  document.querySelector("#message").textContent = response.ok
    ? "עודכן"
    : "העדכון נכשל: נדרשת התחברות למערכת.";
  load();
}

async function whatsapp() {
  for (const phone of selected) {
    const { response, body } = await jsonResponse(`/api/customers/${phone}`);
    if (response.ok && Number(body.balance) > 0) {
      window.open(`https://wa.me/${phone.replace(/^0/, "972")}?text=${encodeURIComponent(
        `שלום ${body.name}, נשאר לך חוב של ${money(body.balance)} מהקניות האחרונות. נשמח אם תוכל להעביר את הסכום בביט. תודה!`
      )}`, "_blank");
    }
  }
}

load();
