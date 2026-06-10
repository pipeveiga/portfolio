const header = document.querySelector(".site-header");
const year = document.querySelector("#year");
const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

function updateHeader() {
  if (!header) return;
  header.dataset.elevated = window.scrollY > 12 ? "true" : "false";
}

function setupReveal() {
  const items = document.querySelectorAll(".reveal");

  // Stagger: los reveals hermanos entran en cascada
  const groups = new Map();
  items.forEach((item) => {
    const parent = item.parentElement;
    const index = groups.get(parent) ?? 0;
    item.style.setProperty("--reveal-delay", `${Math.min(index * 90, 270)}ms`);
    groups.set(parent, index + 1);
  });

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

function setupSpotlight() {
  document.querySelectorAll(".card-glow").forEach((card) => {
    card.addEventListener("mousemove", (event) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      card.style.setProperty("--my", `${event.clientY - rect.top}px`);
    });
  });
}

function setupTilt() {
  if (prefersReducedMotion) return;

  document.querySelectorAll(".project-screen").forEach((screen) => {
    screen.addEventListener("mousemove", (event) => {
      const rect = screen.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      screen.style.setProperty("--ry", `${(px * 4).toFixed(2)}deg`);
      screen.style.setProperty("--rx", `${(-py * 3).toFixed(2)}deg`);
    });

    screen.addEventListener("mouseleave", () => {
      screen.style.setProperty("--ry", "0deg");
      screen.style.setProperty("--rx", "0deg");
    });
  });
}

function setupParallax() {
  const bg = document.querySelector(".hero-bg");
  if (!bg || prefersReducedMotion) return;

  let ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      if (y < window.innerHeight * 1.2) {
        bg.style.transform = `translate3d(0, ${(y * 0.22).toFixed(1)}px, 0)`;
      }
      ticking = false;
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
}

function setupActiveNav() {
  const links = new Map();
  document
    .querySelectorAll(".glass-nav a[href^='#']:not(.brand)")
    .forEach((link) => {
      const section = document.getElementById(link.getAttribute("href").slice(1));
      if (section) links.set(section, link);
    });

  if (!links.size || !("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          links.forEach((link) => link.classList.remove("is-active"));
          links.get(entry.target)?.classList.add("is-active");
        }
      });
    },
    { rootMargin: "-40% 0px -55% 0px" },
  );

  links.forEach((_, section) => observer.observe(section));
}

if (year) {
  year.textContent = new Date().getFullYear();
}

setupReveal();
setupSpotlight();
setupTilt();
setupParallax();
setupActiveNav();
updateHeader();

window.addEventListener("scroll", updateHeader, { passive: true });

if (document.body.classList.contains("cv-page") && window.location.hash === "#print") {
  window.addEventListener("load", () => window.print());
}
