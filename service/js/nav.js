(function () {
  "use strict";

  const THEME_KEY = "travelPlanner:theme";

  function readStoredTheme() {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch (e) {
      return null;
    }
  }

  function writeStoredTheme(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {
      /* 저장 실패해도 화면 전환은 유지한다 */
    }
  }

  function applyStoredTheme() {
    const stored = readStoredTheme();
    if (stored === "light" || stored === "dark") {
      document.documentElement.setAttribute("data-theme", stored);
    }
  }

  function currentTheme() {
    const attr = document.documentElement.getAttribute("data-theme");
    if (attr === "light" || attr === "dark") return attr;
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dark" : "light";
  }

  function toggleTheme() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    writeStoredTheme(next);
  }

  function markCurrentPage() {
    const current = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".nav-link").forEach((link) => {
      if (link.getAttribute("href") === current) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function setupThemeToggle() {
    const btn = document.getElementById("theme-toggle");
    if (btn) btn.addEventListener("click", toggleTheme);
  }

  function setupMenuToggle() {
    const menuToggle = document.getElementById("menu-toggle");
    const mobileMenu = document.getElementById("mobile-menu");
    if (!menuToggle || !mobileMenu) return;

    function closeMenu() {
      mobileMenu.hidden = true;
      menuToggle.setAttribute("aria-expanded", "false");
    }

    function openMenu() {
      mobileMenu.hidden = false;
      menuToggle.setAttribute("aria-expanded", "true");
    }

    menuToggle.addEventListener("click", () => {
      if (mobileMenu.hidden) openMenu();
      else closeMenu();
    });

    mobileMenu.addEventListener("click", (event) => {
      if (event.target.tagName === "A") closeMenu();
    });

    document.addEventListener("click", (event) => {
      if (mobileMenu.hidden) return;
      if (mobileMenu.contains(event.target) || menuToggle.contains(event.target)) return;
      closeMenu();
    });
  }

  applyStoredTheme();
  markCurrentPage();
  setupThemeToggle();
  setupMenuToggle();
})();
