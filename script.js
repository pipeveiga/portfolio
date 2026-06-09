const header = document.querySelector(".site-header");
const year = document.querySelector("#year");

function updateHeader() {
  if (!header) return;
  header.dataset.elevated = window.scrollY > 12 ? "true" : "false";
}

function setupReveal() {
  const items = document.querySelectorAll(".reveal");

  if (!("IntersectionObserver" in window)) {
    items.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.15 },
  );

  items.forEach((item) => observer.observe(item));
}

if (year) {
  year.textContent = new Date().getFullYear();
}

setupReveal();
updateHeader();

window.addEventListener("scroll", updateHeader, { passive: true });

if (document.body.classList.contains("cv-page") && window.location.hash === "#print") {
  window.addEventListener("load", () => window.print());
}
