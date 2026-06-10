const header = document.querySelector(".site-header");
const year = document.querySelector("#year");
const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

function updateHeader() {
  if (!header) return;
  header.dataset.elevated = window.scrollY > 12 ? "true" : "false";
}

function setupReveal() {
  const items = document.querySelectorAll(".reveal");

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
  if (prefersReducedMotion || !finePointer) return;

  document.querySelectorAll(".project-screen").forEach((screen) => {
    screen.addEventListener("mousemove", (event) => {
      const rect = screen.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      screen.style.setProperty("--ry", `${(px * 5).toFixed(2)}deg`);
      screen.style.setProperty("--rx", `${(-py * 4).toFixed(2)}deg`);
    });

    screen.addEventListener("mouseleave", () => {
      screen.style.setProperty("--ry", "0deg");
      screen.style.setProperty("--rx", "0deg");
    });
  });
}

function setupParallax() {
  const bg = document.querySelector(".hero-bg");
  const images = Array.from(document.querySelectorAll(".screen-image"));
  if (prefersReducedMotion) return;

  let ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      if (bg && y < window.innerHeight * 1.2) {
        bg.style.transform = `translate3d(0, ${(y * 0.22).toFixed(1)}px, 0)`;
      }
      const vh = window.innerHeight;
      images.forEach((img) => {
        const rect = img.getBoundingClientRect();
        if (rect.bottom < -200 || rect.top > vh + 200) return;
        const center = rect.top + rect.height / 2;
        const t = (center - vh / 2) / vh;
        img.style.setProperty("--img-py", `${(-t * 28).toFixed(1)}px`);
      });
      ticking = false;
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
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

function splitHero() {
  const title = document.querySelector(".hero-title");
  if (!title) return;
  let counter = 0;
  title.querySelectorAll(".word").forEach((word) => {
    const text = word.textContent;
    word.textContent = "";
    [...text].forEach((ch) => {
      const span = document.createElement("span");
      span.className = "char";
      span.style.setProperty("--i", counter++);
      span.textContent = ch;
      word.appendChild(span);
    });
  });
  title.classList.add("is-split");
}

function setupProgressBar() {
  const bar = document.querySelector(".page-progress");
  if (!bar) return;

  let ticking = false;
  function update() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const pct = max > 0 ? window.scrollY / max : 0;
      bar.style.transform = `scaleX(${pct.toFixed(4)})`;
      ticking = false;
    });
  }

  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();
}

function setupCursor() {
  if (!finePointer || prefersReducedMotion) {
    document.body.classList.add("no-custom-cursor");
    return;
  }

  const dot = document.querySelector(".cursor-dot");
  const ring = document.querySelector(".cursor-ring");
  if (!dot || !ring) {
    document.body.classList.add("no-custom-cursor");
    return;
  }

  let mx = window.innerWidth / 2;
  let my = window.innerHeight / 2;
  let rx = mx;
  let ry = my;

  window.addEventListener(
    "mousemove",
    (event) => {
      mx = event.clientX;
      my = event.clientY;
      dot.style.transform = `translate3d(${mx}px, ${my}px, 0) translate(-50%, -50%)`;
    },
    { passive: true },
  );

  function loop() {
    rx += (mx - rx) * 0.2;
    ry += (my - ry) * 0.2;
    ring.style.transform = `translate3d(${rx.toFixed(2)}px, ${ry.toFixed(
      2,
    )}px, 0) translate(-50%, -50%)`;
    requestAnimationFrame(loop);
  }
  loop();

  document.addEventListener("mouseleave", () =>
    document.body.classList.add("cursor-hidden"),
  );
  document.addEventListener("mouseenter", () =>
    document.body.classList.remove("cursor-hidden"),
  );

  const hoverTargets = document.querySelectorAll(
    "a, button, .project-screen, .glass-card, .scroll-hint, [data-cursor='hover']",
  );
  hoverTargets.forEach((el) => {
    el.addEventListener("mouseenter", () => ring.classList.add("is-hover"));
    el.addEventListener("mouseleave", () => ring.classList.remove("is-hover"));
  });

  const tightTargets = document.querySelectorAll(
    "p, h1, h2, h3, span:not(.dot), li, label, input, textarea",
  );
  tightTargets.forEach((el) => {
    el.addEventListener("mouseenter", () => {
      if (!ring.classList.contains("is-hover")) ring.classList.add("is-tight");
    });
    el.addEventListener("mouseleave", () => ring.classList.remove("is-tight"));
  });

  document.addEventListener("mousedown", () => ring.classList.add("is-tight"));
  document.addEventListener("mouseup", () => ring.classList.remove("is-tight"));
}

function setupMagnetic() {
  if (!finePointer || prefersReducedMotion) return;
  const strength = 0.28;
  const radius = 90;

  document.querySelectorAll("[data-magnetic]").forEach((el) => {
    el.addEventListener("mousemove", (event) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = event.clientX - cx;
      const dy = event.clientY - cy;
      const dist = Math.hypot(dx, dy);
      const max = Math.max(rect.width, rect.height) / 2 + radius;
      if (dist > max) return;
      el.style.setProperty("--mx-mag", `${(dx * strength).toFixed(1)}px`);
      el.style.setProperty("--my-mag", `${(dy * strength).toFixed(1)}px`);
    });

    el.addEventListener("mouseleave", () => {
      el.style.setProperty("--mx-mag", "0px");
      el.style.setProperty("--my-mag", "0px");
    });
  });
}

if (year) {
  year.textContent = new Date().getFullYear();
}

splitHero();
setupReveal();
setupSpotlight();
setupTilt();
setupParallax();
setupActiveNav();
setupProgressBar();
setupCursor();
setupMagnetic();
updateHeader();

window.addEventListener("scroll", updateHeader, { passive: true });

if (document.body.classList.contains("cv-page") && window.location.hash === "#print") {
  window.addEventListener("load", () => window.print());
}
