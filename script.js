const header = document.querySelector(".site-header");
const year = document.querySelector("#year");
const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

function updateHeader() {
  if (!header) return;
  header.dataset.elevated = window.scrollY > 12 ? "true" : "false";
}

function updateParallax() {
  if (motionQuery.matches) return;
  document.documentElement.style.setProperty("--scroll-y", `${window.scrollY}px`);
}

function setupReveal() {
  const revealItems = document.querySelectorAll(".reveal");

  if (!("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
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
    { rootMargin: "0px 0px -12% 0px", threshold: 0.16 },
  );

  revealItems.forEach((item) => observer.observe(item));
}

if (year) {
  year.textContent = new Date().getFullYear();
}

setupReveal();
updateHeader();
updateParallax();

window.addEventListener("scroll", () => {
  updateHeader();
  updateParallax();
}, { passive: true });
