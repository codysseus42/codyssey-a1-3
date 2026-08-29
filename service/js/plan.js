const SESSION_LIMIT = 3;

const form = document.getElementById("plan-form");
const generateBtn = document.getElementById("generate-btn");
const loading = document.getElementById("loading");
const alertBox = document.getElementById("alert");
const alertTitle = document.getElementById("alert-title");
const alertMessage = document.getElementById("alert-message");
const limitNote = document.getElementById("limit-note");
const wishField = document.getElementById("wish");
const result = document.getElementById("result");
const resultSummary = document.getElementById("result-summary");
const resultPlaces = document.getElementById("result-places");
const saveWarning = document.getElementById("save-warning");

let nIntervId;

init();

function init() {
  restoreFromQuery();
  updateLimitNote();
  form.addEventListener("submit", handleSubmit);
}

function updateLimitNote() {
  const usage = TravelStorage.getUsage();
  if (usage.count >= SESSION_LIMIT) {
    limitNote.textContent = "오늘 만들 수 있는 계획을 모두 사용했어요. 내일 다시 시도해 주세요.";
    limitNote.hidden = false;
  } else {
    limitNote.hidden = true;
  }
}

function restoreFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  if (!id) {
    // const radio = form.querySelector(`input[name="city"][value="gangneung"]`);//scope달라서 괜찮으려나?
    // radio.checked = true;
    return;
  }
  const plan = TravelStorage.getPlan(id);
  if (!plan) {
    limitNote.textContent = "요청한 계획을 찾을 수 없어 새로 작성합니다.";
    limitNote.hidden = false;
    return;
  }

  const radio = form.querySelector(`input[name="city"][value="${plan.cityKey}"]`);
  if (radio) radio.checked = true
  wishField.value = plan.wish;

  if (Array.isArray(plan.places) && plan.places.length > 0) {
    renderResult({ summary: plan.summary || "", places: plan.places });
  }
}

function handleSubmit(event) {
  event.preventDefault();
  hideAlert();

  const cityKey = getSelectedCityKey();
  const wish = wishField.value;

  const validation = validateInput(cityKey, wish);
  if (!validation.ok) {
    showAlert("입력값을 확인해 주세요", validation.message);
    return;
  }

  const usage = TravelStorage.getUsage();
  if (usage.count >= SESSION_LIMIT) {
    showAlert(
      "오늘 만들 수 있는 계획을 모두 사용했어요",
      "하루에 만들 수 있는 계획은 3개까지예요. 내일 다시 시도해 주세요."
    );
    return;
  }

  runGenerate(cityKey, wish);
}

function getSelectedCityKey() {
  const checked = form.querySelector('input[name="city"]:checked');
  return checked ? checked.value : "";
}

function validateInput(cityKey, wish) {
  if (!cityKey) {
    return { ok: false, message: "여행할 도시를 선택해 주세요." };
  }
  if (wish.trim().length === 0) {
    return { ok: false, message: "희망사항을 입력해 주세요." };
  }
  if (wish.length > 500) {
    return { ok: false, message: "희망사항은 500자 이하로 입력해 주세요." };
  }
  return { ok: true };
}

async function runGenerate(cityKey, wish) {
  showLoading();
  setSubmitDisabled(true);

  let data;
  try {
    const res = await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city: cityKey, wish }),
    });
    data = await res.json();

  } catch (e) {
    hideLoading();
    setSubmitDisabled(false);
    showAlert("서버에 연결하지 못했습니다", "네트워크 상태를 확인한 뒤 다시 시도해 주세요.");
    return;
  }

  hideLoading();
  setSubmitDisabled(false);

  if (!data || typeof data !== "object") {
    showAlert("서버에 연결하지 못했습니다", "네트워크 상태를 확인한 뒤 다시 시도해 주세요.");
    return;
  }

  if (!data.ok) {
    const mapped = mapFailureToAlert(data);
    showAlert(mapped.title, mapped.message);
    return;
  }

  TravelStorage.incrementUsage();
  updateLimitNote();
  renderResult(data);
  persistPlan(cityKey, wish, data);
}

function mapFailureToAlert(data) {
  switch (data.reason) {
    case "invalid_wish":
      return { title: "요청을 다시 확인해 주세요", message: data.message };
    case "tour_api_failed":
      return {
        title: "관광 정보를 불러오지 못했습니다",
        message: "잠시 후 다시 시도해 주세요. 계속되면 관계자에게 문의해 주세요.",
      };
    case "ai_failed":
      return { title: "여행 계획을 만들지 못했습니다", message: "잠시 후 다시 시도해 주세요." };
    case "bad_request":
      return { title: "입력값을 확인해 주세요", message: "입력값을 다시 확인한 뒤 시도해 주세요." };
    default:
      return { title: "여행 계획을 만들지 못했습니다", message: "잠시 후 다시 시도해 주세요." };
  }
}

function persistPlan(cityKey, wish, data) {
  const plan = {
    id: String(Date.now()),
    city: data.city,
    cityKey,
    wish,
    summary: data.summary,
    createdAt: new Date().toISOString(),
    places: data.places,
  };
  const saved = TravelStorage.savePlan(plan);
  saveWarning.hidden = saved;
  if (!saved) {
    saveWarning.textContent = "계획을 저장하지 못했습니다. 저장 공간을 확인해 주세요.";
  }
}

function renderResult(data) {
  resultSummary.textContent = data.summary || "";

  resultPlaces.textContent = "";
  (data.places || []).forEach((place) => {
    resultPlaces.appendChild(renderPlaceCard(place));
  });

  saveWarning.hidden = true;
  result.hidden = false;
}

function renderPlaceCard(place) {
  const card = document.createElement("article");
  card.className = "card place-card";

  const order = document.createElement("span");
  order.className = "place-order";
  order.textContent = String(place.order);
  card.appendChild(order);

  const title = document.createElement("h3");
  title.textContent = place.title;
  card.appendChild(title);

  const meta = document.createElement("p");
  meta.className = "place-meta";
  meta.textContent = `${place.category} · ${place.kind}`;
  card.appendChild(meta);

  if (place.addr) {
    const addr = document.createElement("p");
    addr.textContent = place.addr;
    card.appendChild(addr);
  }

  const reason = document.createElement("p");
  reason.textContent = place.reason;
  card.appendChild(reason);

  if (place.image) {
    const img = document.createElement("img");
    img.className = "place-image";
    img.src = place.image;
    img.alt = place.title;
    card.appendChild(img);
  }

  const mapLink = buildKakaoMapLink(place.title, place.mapx, place.mapy);
  if (mapLink) {
    const a = document.createElement("a");
    a.href = mapLink;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = "지도에서 보기";
    card.appendChild(a);
  }

  return card;
}

function buildKakaoMapLink(title, mapx, mapy) {
  if (!mapx || !mapy) return "";
  return `https://map.kakao.com/link/to/${encodeURIComponent(title)},${mapy},${mapx}`;
}

function showAlert(title, message) {
  alertTitle.textContent = title;
  alertMessage.textContent = message;
  alertBox.hidden = false;
}

function hideAlert() {
  alertBox.hidden = true;
}

const loadingText = document.getElementById("loading-text");
let timerId = null;

function showLoading() {
  loading.hidden = false;
  let count = 0;
  timerId = setInterval(() => {
    count += 1;
    let countSecs;
    if(count%3==1)
          countSecs='.'
    else if(count%3 == 2)
          countSecs='..'
    else
          countSecs='...'
    loadingText.textContent =
      `여행 계획을 만드는 중입니다. 다소 시간이 걸릴 수 있습니다${countSecs} (${count})`;
  }, 1000);
}

function hideLoading() {
  clearInterval(timerId);
  timerId = null;
  loadingText.textContent = '여행 계획을 만드는 중입니다…'
  loading.hidden = true;
}

function setSubmitDisabled(disabled) {
  generateBtn.disabled = disabled;
}
