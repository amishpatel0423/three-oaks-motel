/* ═══════════════════════════════════════════
   THREE OAKS MOTEL — MAIN.JS
═══════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SET FOOTER YEAR
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SET DEFAULT DATE VALUES
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const dayAfter = new Date(today);
  dayAfter.setDate(today.getDate() + 2);

  function formatDate(d) {
    return d.toISOString().split('T')[0];
  }

  const dateInputs = ['bar-checkin', 'checkin'];
  const checkoutInputs = ['bar-checkout', 'checkout'];

  dateInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = formatDate(tomorrow); el.min = formatDate(today); }
  });

  checkoutInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = formatDate(dayAfter); el.min = formatDate(tomorrow); }
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // NAVBAR SCROLL BEHAVIOR
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const navbar = document.getElementById('navbar');
  const scrollTopBtn = document.getElementById('scroll-top');

  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;

    // Sticky nav style
    if (scrollY > 60) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }

    // Scroll-to-top button
    if (scrollY > 400) {
      scrollTopBtn.classList.add('visible');
    } else {
      scrollTopBtn.classList.remove('visible');
    }

    // Active nav link tracking
    updateActiveNav();

    // Parallax hero
    const heroBg = document.getElementById('hero-bg');
    if (heroBg) {
      heroBg.style.transform = `translateY(${scrollY * 0.3}px) scale(1.05)`;
    }
  }, { passive: true });

  // Scroll to top
  if (scrollTopBtn) {
    scrollTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ACTIVE NAV LINK
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function updateActiveNav() {
    const sections = document.querySelectorAll('section[id], div[id]');
    const navLinks = document.querySelectorAll('.nav-link');
    let current = '';

    sections.forEach(section => {
      const top = section.offsetTop - 100;
      if (window.scrollY >= top) {
        current = section.id;
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${current}`) {
        link.classList.add('active');
      }
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // HAMBURGER MOBILE MENU
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('nav-links');

  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      navLinks.classList.toggle('open');
      const isOpen = navLinks.classList.contains('open');
      hamburger.setAttribute('aria-expanded', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';

      // Animate hamburger
      const spans = hamburger.querySelectorAll('span');
      if (isOpen) {
        spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
        spans[1].style.opacity = '0';
        spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
      } else {
        spans[0].style.transform = '';
        spans[1].style.opacity = '';
        spans[2].style.transform = '';
      }
    });

    // Close menu on nav link click
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('open');
        document.body.style.overflow = '';
        const spans = hamburger.querySelectorAll('span');
        spans.forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
      });
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SCROLL ANIMATIONS (Intersection Observer)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const animateEls = document.querySelectorAll('[data-animate]');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const delay = parseInt(entry.target.dataset.delay || 0);
        setTimeout(() => {
          entry.target.classList.add('animated');
        }, delay);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  animateEls.forEach(el => observer.observe(el));

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // COUNTER ANIMATION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const counterEls = document.querySelectorAll('[data-count]');

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  counterEls.forEach(el => counterObserver.observe(el));

  function animateCounter(el) {
    const target = parseInt(el.dataset.count);
    const duration = 1800;
    const start = performance.now();

    function update(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target);
      if (progress < 1) requestAnimationFrame(update);
      else el.textContent = target;
    }

    requestAnimationFrame(update);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TESTIMONIALS SLIDER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const track = document.getElementById('testimonials-track');
  const cards = track ? Array.from(track.querySelectorAll('.testimonial-card')) : [];
  const dotsContainer = document.getElementById('slider-dots');
  const prevBtn = document.getElementById('slider-prev');
  const nextBtn = document.getElementById('slider-next');

  let currentSlide = 0;
  let slidesPerView = getSlidesPerView();
  let maxSlide = Math.max(0, cards.length - slidesPerView);
  let autoSlideTimer;

  function getSlidesPerView() {
    if (window.innerWidth <= 768) return 1;
    if (window.innerWidth <= 1024) return 2;
    return 3;
  }

  function buildDots() {
    if (!dotsContainer) return;
    dotsContainer.innerHTML = '';
    const numDots = Math.ceil(cards.length / slidesPerView);
    for (let i = 0; i < numDots; i++) {
      const dot = document.createElement('button');
      dot.className = 'slider-dot' + (i === 0 ? ' active' : '');
      dot.setAttribute('aria-label', `Review ${i + 1}`);
      dot.addEventListener('click', () => goToSlide(i));
      dotsContainer.appendChild(dot);
    }
  }

  function updateDots() {
    if (!dotsContainer) return;
    const dots = dotsContainer.querySelectorAll('.slider-dot');
    const activeDotIdx = Math.floor(currentSlide / 1);
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === Math.min(currentSlide, dots.length - 1));
    });
  }

  function goToSlide(idx) {
    currentSlide = Math.max(0, Math.min(idx, maxSlide));
    if (track) {
      const cardWidth = cards[0] ? cards[0].offsetWidth + 24 : 0;
      track.style.transform = `translateX(-${currentSlide * cardWidth}px)`;
    }
    updateDots();
  }

  function nextSlide() {
    currentSlide = currentSlide >= maxSlide ? 0 : currentSlide + 1;
    goToSlide(currentSlide);
  }

  function prevSlide() {
    currentSlide = currentSlide <= 0 ? maxSlide : currentSlide - 1;
    goToSlide(currentSlide);
  }

  function startAutoSlide() {
    autoSlideTimer = setInterval(nextSlide, 4500);
  }

  function stopAutoSlide() {
    clearInterval(autoSlideTimer);
  }

  if (cards.length > 0) {
    buildDots();
    startAutoSlide();

    if (prevBtn) prevBtn.addEventListener('click', () => { stopAutoSlide(); prevSlide(); startAutoSlide(); });
    if (nextBtn) nextBtn.addEventListener('click', () => { stopAutoSlide(); nextSlide(); startAutoSlide(); });

    // Touch swipe support
    let touchStartX = 0;
    if (track) {
      track.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
      track.addEventListener('touchend', e => {
        const diff = touchStartX - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 40) {
          stopAutoSlide();
          diff > 0 ? nextSlide() : prevSlide();
          startAutoSlide();
        }
      }, { passive: true });
    }

    window.addEventListener('resize', () => {
      slidesPerView = getSlidesPerView();
      maxSlide = Math.max(0, cards.length - slidesPerView);
      currentSlide = 0;
      buildDots();
      goToSlide(0);
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GALLERY LIGHTBOX
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const galleryItems = document.querySelectorAll('.gallery-item');
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxClose = document.getElementById('lightbox-close');

  galleryItems.forEach(item => {
    item.addEventListener('click', () => {
      const src = item.dataset.src;
      const img = item.querySelector('img');
      const alt = img ? img.alt : 'Gallery image';
      if (lightboxImg) { lightboxImg.src = src; lightboxImg.alt = alt; }
      if (lightbox) lightbox.classList.add('open');
      document.body.style.overflow = 'hidden';
    });
  });

  if (lightboxClose) {
    lightboxClose.addEventListener('click', closeLightbox);
  }

  if (lightbox) {
    lightbox.addEventListener('click', e => {
      if (e.target === lightbox) closeLightbox();
    });
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeLightbox();
  });

  function closeLightbox() {
    if (lightbox) lightbox.classList.remove('open');
    document.body.style.overflow = '';
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // BOOKING FORM VALIDATION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const bookingForm = document.getElementById('booking-form');
  const bookingSuccess = document.getElementById('booking-success');

  if (bookingForm) {
    bookingForm.addEventListener('submit', e => {
      e.preventDefault();
      if (validateForm()) {
        bookingForm.style.display = 'none';
        if (bookingSuccess) bookingSuccess.classList.add('show');
        window.scrollTo({ top: document.getElementById('booking').offsetTop - 80, behavior: 'smooth' });
      }
    });
  }

  function validateForm() {
    const requiredFields = bookingForm.querySelectorAll('[required]');
    let valid = true;

    requiredFields.forEach(field => {
      field.classList.remove('error');
      if (!field.value.trim()) {
        field.classList.add('error');
        valid = false;
        if (valid === false && field === requiredFields[0]) {
          field.focus();
        }
      }
    });

    // Email validation
    const emailField = document.getElementById('email');
    if (emailField && emailField.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailField.value)) {
      emailField.classList.add('error');
      valid = false;
    }

    // Date validation
    const checkin = document.getElementById('checkin');
    const checkout = document.getElementById('checkout');
    if (checkin && checkout && checkin.value && checkout.value) {
      if (new Date(checkout.value) <= new Date(checkin.value)) {
        checkout.classList.add('error');
        valid = false;
      }
    }

    return valid;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // BOOKING BAR DATE SYNC
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const barCheckin = document.getElementById('bar-checkin');
  const barCheckout = document.getElementById('bar-checkout');
  const barRoom = document.getElementById('bar-room');

  if (barCheckin) {
    barCheckin.addEventListener('change', () => {
      if (barCheckout && barCheckout.value <= barCheckin.value) {
        const d = new Date(barCheckin.value);
        d.setDate(d.getDate() + 1);
        barCheckout.value = formatDate(d);
      }
      // Sync to main form
      const mainCheckin = document.getElementById('checkin');
      if (mainCheckin) mainCheckin.value = barCheckin.value;
    });
  }

  if (barCheckout) {
    barCheckout.addEventListener('change', () => {
      const mainCheckout = document.getElementById('checkout');
      if (mainCheckout) mainCheckout.value = barCheckout.value;
    });
  }

  if (barRoom) {
    barRoom.addEventListener('change', () => {
      const roomType = document.getElementById('room-type');
      if (roomType) roomType.value = barRoom.value;
    });
  }

  // Validate checkout date in main form
  const checkinMain = document.getElementById('checkin');
  const checkoutMain = document.getElementById('checkout');
  if (checkinMain) {
    checkinMain.addEventListener('change', () => {
      if (checkoutMain && checkoutMain.value && checkoutMain.value <= checkinMain.value) {
        const d = new Date(checkinMain.value);
        d.setDate(d.getDate() + 1);
        checkoutMain.value = formatDate(d);
      }
    });
  }

}); // end DOMContentLoaded

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GLOBAL FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function scrollToBooking() {
  const booking = document.getElementById('booking');
  if (booking) {
    booking.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function preselectRoom(roomType) {
  // Preselect room in the booking form
  const roomSelect = document.getElementById('room-type');
  if (roomSelect) roomSelect.value = roomType;

  // Also sync bar room
  const barRoom = document.getElementById('bar-room');
  if (barRoom) barRoom.value = roomType;
}

function resetForm() {
  const bookingForm = document.getElementById('booking-form');
  const bookingSuccess = document.getElementById('booking-success');
  if (bookingForm) {
    bookingForm.reset();
    bookingForm.style.display = '';
  }
  if (bookingSuccess) bookingSuccess.classList.remove('show');
}
