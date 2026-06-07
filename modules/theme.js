export function initTheme() {
  const toggle = document.getElementById("darkModeToggle");
  if (!toggle) return;

  const icon = toggle.querySelector("i");

  const savedMode = localStorage.getItem("darkMode");

  if (savedMode === "light") {
    document.body.classList.add("light-mode");

    if (icon) {
      icon.classList.remove("fa-moon");
      icon.classList.add("fa-sun");
    }
  }

  toggle.addEventListener("click", () => {
    document.body.classList.toggle("light-mode");

    const isLight = document.body.classList.contains("light-mode");

    if (icon) {
      icon.classList.toggle("fa-moon");
      icon.classList.toggle("fa-sun");
    }

    localStorage.setItem("darkMode", isLight ? "light" : "dark");
  });
}