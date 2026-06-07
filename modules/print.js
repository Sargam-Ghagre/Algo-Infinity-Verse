export function initPrint() {
  const exportBtn = document.getElementById("exportPdfBtn");

  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      window.print();
    });
  }
}