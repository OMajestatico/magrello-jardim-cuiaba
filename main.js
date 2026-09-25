(() => {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  if (window.lucide) lucide.createIcons({ attrs: { 'stroke-width': 1.7 } });

  const topbar = $('.topbar');
  const onScroll = () => topbar?.classList.toggle('scrolled', window.scrollY > 24);
  onScroll();
  addEventListener('scroll', onScroll, { passive: true });

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduced && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const delay = Number(entry.target.dataset.delay || 0);
        setTimeout(() => entry.target.classList.add('is-visible'), delay);
        io.unobserve(entry.target);
      });
    }, { threshold: .12, rootMargin: '0px 0px -4% 0px' });
    $$('.reveal').forEach(el => io.observe(el));
  } else {
    $$('.reveal').forEach(el => el.classList.add('is-visible'));
  }

  const menu = $('#mobileMenu');
  const menuButton = $('.menu-btn');
  let lockedY = 0;

  // Lock the page without turning <body> into position:fixed.
  // That old technique changed the document scroll position and, because the page
  // uses scroll-behavior:smooth, opening/closing the menu visibly nudged the page.
  const restoreScrollInstantly = () => {
    const html = document.documentElement;
    const previousBehavior = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';
    window.scrollTo({ left: 0, top: lockedY, behavior: 'auto' });
    html.style.scrollBehavior = previousBehavior;
  };

  const openMenu = () => {
    if (!menu || menu.classList.contains('open')) return;
    lockedY = window.scrollY;
    document.documentElement.classList.add('menu-scroll-lock');
    menu.classList.add('open');
    menu.setAttribute('aria-hidden', 'false');
    menuButton?.setAttribute('aria-expanded', 'true');

    // Safety correction for browsers that adjust the root scroller when overflow changes.
    requestAnimationFrame(restoreScrollInstantly);
  };
  const closeMenu = () => {
    if (!menu || !menu.classList.contains('open')) return;
    menu.classList.remove('open');
    menu.setAttribute('aria-hidden', 'true');
    menuButton?.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('menu-scroll-lock');

    // Restore on the same frame, with smooth scrolling temporarily disabled.
    restoreScrollInstantly();
    requestAnimationFrame(restoreScrollInstantly);
  };
  menuButton?.addEventListener('click', openMenu);
  $$('[data-close-menu]').forEach(el => el.addEventListener('click', closeMenu));
  $$('.menu-links a').forEach(a => a.addEventListener('click', (e) => {
    e.preventDefault();
    const target = document.querySelector(a.getAttribute('href'));
    closeMenu();
    requestAnimationFrame(() => setTimeout(() => target?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' }), 40));
  }));
  addEventListener('keydown', e => { if (e.key === 'Escape' && menu?.classList.contains('open')) closeMenu(); });

  const backTop = $('.back-top');
  backTop?.addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({ left: 0, top: 0, behavior: reduced ? 'auto' : 'smooth' });
  });

  // Carousel engine: one real stage at a time, centered, mandatory snap and clickable dots.
  const carouselByTrack = new Map();

  const setupCarousel = (trackSel, dotsSel) => {
    const track = $(trackSel);
    const dotsHost = $(dotsSel);
    if (!track) return;
    const slides = [...track.children].filter(el => el.matches('.flavour-card, .gallery-card'));
    if (!slides.length) return;

    let activeIndex = 0;
    let scrollTimer = 0;

    const setEdgePadding = () => {
      const first = slides[0];
      const last = slides[slides.length - 1];
      const left = Math.max(0, (track.clientWidth - first.getBoundingClientRect().width) / 2);
      const right = Math.max(0, (track.clientWidth - last.getBoundingClientRect().width) / 2);
      track.style.paddingLeft = `${left}px`;
      track.style.paddingRight = `${right}px`;
    };

    const nearestIndex = () => {
      const tr = track.getBoundingClientRect();
      const center = tr.left + tr.width / 2;
      let best = 0;
      let distance = Infinity;
      slides.forEach((slide, i) => {
        const r = slide.getBoundingClientRect();
        const d = Math.abs((r.left + r.width / 2) - center);
        if (d < distance) { distance = d; best = i; }
      });
      return best;
    };

    const renderDots = () => {
      if (!dotsHost) return [];
      dotsHost.innerHTML = '';
      return slides.map((_, i) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'track-dot';
        dot.setAttribute('aria-label', `Ir para item ${i + 1} de ${slides.length}`);
        dot.addEventListener('click', () => goTo(i));
        dotsHost.appendChild(dot);
        return dot;
      });
    };

    const dots = renderDots();

    const updateActive = (force = false) => {
      const next = nearestIndex();
      if (!force && next === activeIndex) return;
      activeIndex = next;
      dots.forEach((dot, i) => {
        dot.classList.toggle('is-active', i === activeIndex);
        dot.setAttribute('aria-current', i === activeIndex ? 'true' : 'false');
      });
    };

    const goTo = (index) => {
      activeIndex = Math.max(0, Math.min(slides.length - 1, index));
      slides[activeIndex].scrollIntoView({
        behavior: reduced ? 'auto' : 'smooth',
        block: 'nearest',
        inline: 'center'
      });
      dots.forEach((dot, i) => dot.classList.toggle('is-active', i === activeIndex));
    };

    track.addEventListener('scroll', () => {
      updateActive();
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        // Final correction keeps the image exactly centered after a fling/drag.
        const i = nearestIndex();
        const slide = slides[i];
        const desired = slide.offsetLeft + slide.offsetWidth / 2 - track.clientWidth / 2;
        if (Math.abs(track.scrollLeft - desired) > 2) {
          track.scrollTo({ left: desired, behavior: reduced ? 'auto' : 'smooth' });
        }
        updateActive(true);
      }, 110);
    }, { passive: true });

    const refresh = () => {
      const keep = activeIndex;
      setEdgePadding();
      requestAnimationFrame(() => {
        const slide = slides[keep];
        const desired = slide.offsetLeft + slide.offsetWidth / 2 - track.clientWidth / 2;
        track.scrollLeft = desired;
        updateActive(true);
      });
    };

    carouselByTrack.set(track, { slides, goTo, get activeIndex(){ return nearestIndex(); }, refresh });
    refresh();
    addEventListener('resize', refresh, { passive: true });
  };

  setupCarousel('#flavourTrack', '#flavourDots');
  setupCarousel('#galleryTrack', '#galleryDots');

  // Arrow controls now move exactly one card, not some mysterious percentage of the screen.
  $$('[data-scroll-next], [data-scroll-prev]').forEach(btn => {
    btn.addEventListener('click', () => {
      const selector = btn.dataset.scrollNext || btn.dataset.scrollPrev;
      const track = $(selector);
      const carousel = carouselByTrack.get(track);
      if (!carousel) return;
      const direction = btn.dataset.scrollNext ? 1 : -1;
      carousel.goTo(carousel.activeIndex + direction);
    });
  });

  // Desktop drag only. Touch stays native, allowing vertical page scroll without hostage negotiations.
  $$('.drag-scroll').forEach(track => {
    let startX = 0, startScroll = 0, active = false;
    track.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      active = true;
      startX = e.clientX;
      startScroll = track.scrollLeft;
      track.classList.add('dragging');
      track.setPointerCapture(e.pointerId);
    });
    track.addEventListener('pointermove', e => {
      if (!active) return;
      track.scrollLeft = startScroll - (e.clientX - startX);
    });
    const stop = e => {
      if (!active) return;
      active = false;
      track.classList.remove('dragging');
      if (e.pointerId && track.hasPointerCapture?.(e.pointerId)) track.releasePointerCapture(e.pointerId);
      const carousel = carouselByTrack.get(track);
      if (carousel) carousel.goTo(carousel.activeIndex);
    };
    track.addEventListener('pointerup', stop);
    track.addEventListener('pointercancel', stop);
    track.addEventListener('mouseleave', e => { if (active && e.buttons === 0) stop(e); });
  });

  if (!reduced && matchMedia('(hover:hover) and (pointer:fine)').matches) {
    $$('.tilt-card').forEach(card => {
      const base = getComputedStyle(card).transform === 'none' ? '' : getComputedStyle(card).transform;
      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - .5;
        const y = (e.clientY - r.top) / r.height - .5;
        card.style.transform = `${base === 'none' ? '' : base} perspective(900px) rotateX(${(-y*3.2).toFixed(2)}deg) rotateY(${(x*4.2).toFixed(2)}deg) translateZ(2px)`;
      });
      card.addEventListener('mouseleave', () => card.style.transform = '');
    });
  }
})();
