const list = document.getElementById("plan-list");
const emptyNote = document.getElementById("empty-note");

render();

function render() {
  const plans = TravelStorage.getPlans();

  list.textContent = "";

  if (plans.length === 0) {
    emptyNote.hidden = false;
    return;
  }
  emptyNote.hidden = true;

  plans.forEach((plan) => {
    list.appendChild(renderPlanItem(plan));
  });
}

function renderPlanItem(plan) {
  const li = document.createElement("li");
  li.className = "plan-item";

  const link = document.createElement("a");
  link.className = "plan-item-link";
  link.href = `plan.html?id=${encodeURIComponent(plan.id)}`;
  link.textContent = `${plan.city} 여행 계획 (${formatDateTime(plan.createdAt)})`;
  li.appendChild(link);

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "plan-item-delete";
  deleteBtn.textContent = "삭제";
  deleteBtn.addEventListener("click", () => handleDelete(plan.id));
  li.appendChild(deleteBtn);

  return li;
}

function handleDelete(id) {
  if (!window.confirm("이 계획을 삭제할까요?")) return;
  TravelStorage.deletePlan(id);
  render();
}

function formatDateTime(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${min}`;
}
