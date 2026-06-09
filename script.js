const header = document.querySelector(".site-header");
const year = document.querySelector("#year");

function updateHeader() {
  header.dataset.elevated = window.scrollY > 12 ? "true" : "false";
}

year.textContent = new Date().getFullYear();
updateHeader();

window.addEventListener("scroll", updateHeader, { passive: true });
