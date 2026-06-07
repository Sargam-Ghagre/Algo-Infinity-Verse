import { initLoader } from "./modules/loader.js";
import { initTheme } from "./modules/theme.js";
import { initNavbar } from "./modules/navbar.js";
import { initPrint } from "./modules/print.js";
import { initScrollTop } from "./modules/scrollTop.js";

document.addEventListener("DOMContentLoaded", () => {
  console.log("Cheat Sheets Page Initialized");

  initLoader();
  initTheme();
  initNavbar();
  initPrint();
  initScrollTop();
});