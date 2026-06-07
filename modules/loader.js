export function initLoader() {
  setTimeout(() => {
    const loader = document.getElementById("loading-screen");

    if (loader) {
      loader.classList.add("hidden");
    }
  }, 1000);
}
