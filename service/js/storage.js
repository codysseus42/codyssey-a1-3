(function () {
  "use strict";

  const KEY_PLANS = "travelPlanner:plans";
  const KEY_USAGE = "travelPlanner:usage";

  function todayString() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function getPlans() {
    const plans = readJSON(KEY_PLANS, []);
    if (!Array.isArray(plans)) return [];
    return plans.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function getPlan(id) {
    const plans = readJSON(KEY_PLANS, []);
    if (!Array.isArray(plans)) return null;
    return plans.find((p) => p.id === id) || null;
  }

  function savePlan(plan) {
    const plans = readJSON(KEY_PLANS, []);
    const next = Array.isArray(plans) ? plans : [];
    next.push(plan);
    return writeJSON(KEY_PLANS, next);
  }

  function deletePlan(id) {
    const plans = readJSON(KEY_PLANS, []);
    const next = (Array.isArray(plans) ? plans : []).filter((p) => p.id !== id);
    return writeJSON(KEY_PLANS, next);
  }

  function getUsage() {
    const usage = readJSON(KEY_USAGE, null);
    const today = todayString();
    if (!usage || usage.date !== today) {
      return { date: today, count: 0 };
    }
    return usage;
  }

  function incrementUsage() {
    const current = getUsage();
    const next = { date: current.date, count: current.count + 1 };
    writeJSON(KEY_USAGE, next);
    return next;
  }

  window.TravelStorage = {
    getPlans,
    getPlan,
    savePlan,
    deletePlan,
    getUsage,
    incrementUsage,
  };
})();
