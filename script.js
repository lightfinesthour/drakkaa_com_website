(() => {
  const releases = window.RELEASES || [];
  const $ = (sel, root = document) => root.querySelector(sel);

  const formatDate = (iso) =>
    new Date(iso + 'T00:00:00').toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' });
  const shortDate = (iso) =>
    new Date(iso + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' });
  const typeLabel = (r) => (r.type === 'SINGLE' ? 'Single' : r.type === 'EP' ? 'EP' : 'Album');
  const albumUrl = (r) => `https://open.spotify.com/album/${r.id}`;
  const cover = (r) => `assets/covers/${r.slug}.jpg`;
  const cover2x = (r) => `assets/covers/${r.slug}@2x.jpg`;

  // ---------- Releases ----------

  function card(r) {
    const a = document.createElement('a');
    a.className = 'card';
    a.href = albumUrl(r);
    a.target = '_blank';
    a.rel = 'noopener';
    a.dataset.id = r.id;
    a.style.setProperty('--tint', r.tint);
    a.setAttribute('aria-label', `Play ${r.title}`);

    const art = document.createElement('span');
    art.className = 'card__art';
    const img = document.createElement('img');
    img.src = cover(r);
    img.srcset = `${cover(r)} 300w, ${cover2x(r)} 640w`;
    img.sizes = '(max-width: 480px) 45vw, 240px';
    img.alt = '';
    img.width = 300;
    img.height = 300;
    img.loading = 'lazy';
    const play = document.createElement('span');
    play.className = 'play';
    art.append(img, play);

    const title = document.createElement('span');
    title.className = 'card__title';
    title.textContent = r.title;
    const meta = document.createElement('span');
    meta.className = 'card__meta';
    meta.textContent =
      `${shortDate(r.date)} · ${typeLabel(r)}` + (r.tracks > 1 ? ` · ${r.tracks} tracks` : '');

    a.append(art, title, meta);

    const links = document.createElement('span');
    links.className = 'card__links';
    for (const [name, url] of [
      ['Spotify', albumUrl(r)],
      ['Apple Music', r.apple && `https://music.apple.com/album/${r.apple}`],
      ['Tidal', r.tidal && `https://tidal.com/album/${r.tidal}`],
      ['YouTube', r.youtube && `https://www.youtube.com/playlist?list=${r.youtube}`],
    ]) {
      if (!url) continue;
      const l = document.createElement('a');
      l.href = url;
      l.target = '_blank';
      l.rel = 'noopener';
      l.textContent = name;
      l.setAttribute('aria-label', `${r.title} on ${name}`);
      links.append(l);
    }

    const li = document.createElement('li');
    li.append(a, links);
    return li;
  }

  function renderReleases() {
    const root = $('[data-releases]');
    const byYear = new Map();
    for (const r of releases) {
      const y = r.date.slice(0, 4);
      if (!byYear.has(y)) byYear.set(y, []);
      byYear.get(y).push(r);
    }
    for (const [year, list] of byYear) {
      const section = document.createElement('section');
      section.className = 'year';
      const head = document.createElement('div');
      head.className = 'year__head';
      const h = document.createElement('h3');
      h.className = 'year__num';
      h.textContent = year;
      const count = document.createElement('span');
      count.className = 'year__count';
      count.textContent = `${list.length} release${list.length === 1 ? '' : 's'}`;
      head.append(h, count);
      const grid = document.createElement('ul');
      grid.className = 'grid';
      grid.append(...list.map(card));
      section.append(head, grid);
      root.append(section);
    }
  }

  function renderLatest() {
    const r = releases[0];
    if (!r) return;
    const link = $('[data-latest]');
    link.href = albumUrl(r);
    link.dataset.id = r.id;
    link.setAttribute('aria-label', `Play the latest release, ${r.title}`);
    const img = $('[data-latest-cover]');
    img.src = cover(r);
    img.srcset = `${cover(r)} 1x, ${cover2x(r)} 2x`;
    $('[data-latest-title]').textContent = r.title;
    $('[data-latest-meta]').textContent = `${typeLabel(r)} · ${formatDate(r.date)}`;
    $('[data-count]').textContent = releases.length;
  }

  // ---------- Player ----------
  // Uses Spotify's iFrame API. Until it has loaded (or if it is blocked), the
  // cover links simply open Spotify in a new tab.

  let api = null;
  let controller = null;
  let creating = false;
  let currentId = null;
  const dock = $('[data-dock]');

  window.onSpotifyIframeApiReady = (IFrameAPI) => { api = IFrameAPI; };

  function setDockHeight() {
    document.documentElement.style.setProperty('--dock-h', dock.hidden ? '0px' : `${dock.offsetHeight}px`);
  }

  function mark(id, playing) {
    for (const el of document.querySelectorAll('[data-id]')) {
      const on = el.dataset.id === id;
      el.classList.toggle('is-current', on);
      el.classList.toggle('is-playing', on && playing);
    }
  }

  function play(id) {
    const uri = `spotify:album:${id}`;
    dock.hidden = false;
    setDockHeight();

    if (controller) {
      if (id === currentId) {
        controller.togglePlay();
      } else {
        currentId = id;
        mark(id, false);
        controller.loadUri(uri);
        controller.play();
      }
      return;
    }

    currentId = id;
    mark(id, false);
    if (creating) return;
    creating = true;
    api.createController($('[data-embed]'), { uri, width: '100%', height: 80 }, (c) => {
      controller = c;
      c.addListener('playback_update', (e) => mark(currentId, !e.data.isPaused));
      c.addListener('ready', () => {
        // A different cover may have been picked while the player was loading.
        if (currentId !== id) c.loadUri(`spotify:album:${currentId}`);
        c.play();
      });
    });
  }

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[data-id]');
    if (!link || !api || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    play(link.dataset.id);
  });

  $('[data-dock-close]').addEventListener('click', () => {
    if (controller) controller.pause();
    dock.hidden = true;
    setDockHeight();
    mark(null, false);
  });

  window.addEventListener('resize', setDockHeight);

  // ---------- Hero wave ----------
  // The red line from the logo, running through the wordmark.

  function wave() {
    const canvas = $('.hero__wave');
    const ctx = canvas.getContext('2d');
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0, raf = 0, visible = true;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(performance.now());
    }

    function draw(now) {
      const t = still ? 2.4 : now / 1000;
      ctx.clearRect(0, 0, w, h);
      const lines = [
        { amp: 0.20, speed: 0.55, alpha: 1, width: Math.max(2, w / 420) },
        { amp: 0.13, speed: -0.4, alpha: 0.45, width: 1.5 },
        { amp: 0.27, speed: 0.3, alpha: 0.22, width: 1 },
      ];
      lines.forEach((l, i) => {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 4) {
          const p = x / w;
          const swell = 0.35 + 0.65 * Math.sin(Math.PI * p);
          const y =
            h * 0.56 +
            Math.sin(p * 7 + t * l.speed + i * 1.7) * h * l.amp * swell +
            Math.sin(p * 19 - t * l.speed * 1.6 + i) * h * l.amp * 0.22;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(228, 0, 43, ${l.alpha})`;
        ctx.lineWidth = l.width;
        ctx.lineJoin = 'round';
        ctx.stroke();
      });
    }

    function loop(now) {
      draw(now);
      if (visible && !still) raf = requestAnimationFrame(loop);
    }

    new ResizeObserver(resize).observe(canvas);
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible && !still) raf = requestAnimationFrame(loop);
    }).observe(canvas);
  }

  renderReleases();
  renderLatest();
  wave();
  $('[data-year]').textContent = new Date().getFullYear();
})();
