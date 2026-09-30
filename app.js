(() => {
  const KEY = 'capsule.v1';
  const $ = s => document.querySelector(s);
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
  const save = l => localStorage.setItem(KEY, JSON.stringify(l));
  const fmt = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'long' });
  const num = new Intl.NumberFormat('fa-IR');
  const el = (tag, props = {}, ...kids) => {
    const n = Object.assign(document.createElement(tag), props);
    kids.forEach(k => n.append(k));
    return n;
  };
  // تاریخ باز شدن: ابتدای روز انتخاب‌شده به وقت محلی
  const at = d => new Date(d + 'T00:00:00').getTime();
  const isOpen = c => Date.now() >= at(c.unlock);

  function remaining(c) {
    const ms = at(c.unlock) - Date.now();
    const d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4);
    return d > 0 ? `${num.format(d)} روز و ${num.format(h)} ساعت مانده` : `${num.format(h)} ساعت و ${num.format(m)} دقیقه مانده`;
  }

  // لینک اشتراک: فقط متن (عکس در لینک نمی‌گنجد)
  const enc = o => btoa(unescape(encodeURIComponent(JSON.stringify(o))));
  const dec = s => JSON.parse(decodeURIComponent(escape(atob(s))));
  const shareLink = c => `${location.origin}${location.pathname}#c=${enc({ title: c.title, msg: c.msg, from: c.from, unlock: c.unlock })}`;

  function show(c) {
    $('#dbody').replaceChildren(
      el('h3', { textContent: c.title }),
      el('div', { className: 'meta', textContent: `${c.from ? 'از ' + c.from + ' · ' : ''}قفل‌شده در ${fmt.format(c.created)} · باز شد در ${fmt.format(at(c.unlock))}` }),
      el('p', { textContent: c.msg }),
      ...(c.photo ? [el('img', { src: c.photo, alt: 'عکس کپسول' })] : [])
    );
    $('#dlg').showModal();
  }

  function render() {
    const list = load().sort((a, b) => at(a.unlock) - at(b.unlock));
    const box = $('#list');
    if (!list.length) return box.replaceChildren(el('div', { className: 'empty', textContent: 'هنوز کپسولی نساخته‌ای. اولین پیام برای آینده را بنویس.' }));
    box.replaceChildren(...list.map(c => {
      const open = isOpen(c);
      const openBtn = el('button', { className: 'ghost', textContent: open ? 'باز کن' : 'قفل است', disabled: !open });
      openBtn.onclick = () => show(c);
      const share = el('button', { className: 'ghost', textContent: 'کپی لینک' });
      share.onclick = async () => {
        try { await navigator.clipboard.writeText(shareLink(c)); share.textContent = 'کپی شد'; }
        catch { prompt('لینک را کپی کن:', shareLink(c)); }
      };
      const del = el('button', { className: 'ghost', textContent: 'حذف' });
      del.onclick = () => { if (confirm('این کپسول حذف شود؟')) { save(load().filter(x => x.id !== c.id)); render(); } };
      return el('div', { className: 'cap' + (open ? ' ready' : '') },
        el('div', { className: 'orb', textContent: open ? '✨' : '🔒' }),
        el('div', {}, el('h3', { textContent: c.title }),
          el('small', { textContent: open ? 'آماده‌ی باز شدن' : `${fmt.format(at(c.unlock))} · ${remaining(c)}` })),
        el('div', { className: 'acts' }, openBtn, share, del));
    }));
  }

  function shrink(file) {
    return new Promise(res => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 640 / Math.max(img.width, img.height));
        const cv = el('canvas', { width: img.width * k, height: img.height * k });
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        res(cv.toDataURL('image/jpeg', .7));
      };
      img.src = URL.createObjectURL(file);
    });
  }

  const form = $('#form');
  form.unlock.min = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  form.onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(form), file = f.get('photo');
    const c = { id: crypto.randomUUID(), created: Date.now(), title: f.get('title').trim(), msg: f.get('msg').trim(),
      from: f.get('from').trim(), unlock: f.get('unlock'), photo: file && file.size ? await shrink(file) : '' };
    try { save([...load(), c]); } catch { return alert('فضای ذخیره‌سازی پر است. عکس کوچک‌تری انتخاب کن.'); }
    form.reset(); render();
    $('#list').scrollIntoView({ behavior: 'smooth' });
  };

  // دریافت کپسول از لینک
  function incoming() {
    const m = location.hash.match(/^#c=(.+)$/);
    if (!m) return;
    try {
      const c = dec(m[1]), box = $('#incoming');
      const btn = el('button', { className: 'seal', textContent: 'ذخیره در کپسول‌های من' });
      btn.onclick = () => { save([...load(), { ...c, id: crypto.randomUUID(), created: Date.now(), photo: '' }]); history.replaceState(null, '', location.pathname); box.hidden = true; render(); };
      box.replaceChildren(el('h2', { textContent: 'کپسولی برایت فرستاده‌اند' }),
        el('p', { textContent: `«${c.title}»${c.from ? ' از ' + c.from : ''} · باز شدن: ${fmt.format(at(c.unlock))}` }), btn);
      box.hidden = false;
    } catch { /* لینک نامعتبر */ }
  }

  $('#close').onclick = () => $('#dlg').close();
  $('#export').onclick = () => {
    const a = el('a', { href: URL.createObjectURL(new Blob([JSON.stringify(load())], { type: 'application/json' })), download: 'capsules.json' });
    a.click();
  };
  $('#import').onchange = async e => {
    try {
      const inc = JSON.parse(await e.target.files[0].text()), have = new Set(load().map(c => c.id));
      save([...load(), ...inc.filter(c => c.id && !have.has(c.id))]); render();
    } catch { alert('فایل معتبر نیست.'); }
  };

  incoming(); render(); setInterval(render, 30000);
})();
