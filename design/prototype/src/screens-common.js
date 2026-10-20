/* Màn hình chung: S01 đăng nhập, S02 đăng ký, S03 tài khoản, S04 thông báo, S90 tìm kiếm, S91 xem trước tệp, S92 lỗi, S80 xác thực QR */
(function () {
  const O = OCOP, D = O.data, ic = O.icon, esc = O.esc;

  document.head.insertAdjacentHTML('beforeend', `<style>
  .auth-layout{display:grid;grid-template-columns:minmax(0,460px) minmax(0,360px);gap:24px;justify-content:center;align-items:stretch;margin-block:auto;width:100%}
  .auth-layout.wide{grid-template-columns:minmax(0,600px) minmax(0,340px)}
  .auth-layout .auth-card{max-width:none;margin:0}
  .auth-brand{display:flex;align-items:center;gap:12px}
  .auth-brand b{display:block;font-size:17px;font-weight:700}
  .auth-help{border-radius:28px;padding:28px;color:#fff;background:radial-gradient(360px 220px at 20% 115%,rgba(255,255,255,.18),transparent 70%),linear-gradient(150deg,var(--hero-a),var(--hero-b) 60%,var(--hero-c));display:flex;flex-direction:column;gap:14px;position:relative;overflow:hidden}
  .auth-help h2{color:#fff}
  .auth-help .hero-pill{flex-wrap:wrap}
  .auth-help .sel{user-select:all}
  .auth-help .feat{display:flex;gap:10px;align-items:flex-start;font-size:14px;color:rgba(255,255,255,.92)}
  @container main (max-width:860px){.auth-layout,.auth-layout.wide{grid-template-columns:minmax(0,1fr)}.auth-help{padding:20px;border-radius:22px}}
  .or-line{display:flex;align-items:center;gap:12px;color:var(--text-3);font-size:13px}.or-line::before,.or-line::after{content:"";flex:1;height:1px;background:var(--line)}
  .pv-toolbar{display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:6px;border-radius:14px;background:var(--surface-2);border:1px solid var(--line);font-size:13.5px}
  .pv-toolbar .icon-btn{width:36px;height:36px}
  .pv-stage{background:var(--surface-3);border-radius:16px;padding:18px;overflow:auto;max-height:62vh;display:flex;justify-content:safe center;align-items:flex-start}
  .pv-stage .doc-page{flex:none;transition:width .15s}
  .pv-img{flex:none;aspect-ratio:4/3;border-radius:12px;background:radial-gradient(220px 140px at 70% 30%,var(--amber-soft),transparent 70%),linear-gradient(135deg,var(--brand-soft),var(--surface-2));display:grid;place-items:center;color:var(--brand);border:1px solid var(--line)}
  .pv-img .ic{width:64px;height:64px;stroke-width:1.3}
  .noti .nb b{font-weight:500}
  .noti-day{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);padding:14px 16px 6px;font-weight:600}
  .err-wrap{margin-block:auto;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:32px;align-items:center;max-width:960px;width:100%;margin-inline:auto}
  .err-code{font-size:110px;font-weight:800;line-height:1;letter-spacing:-.04em;background:linear-gradient(120deg,var(--hero-a),var(--hero-c));-webkit-background-clip:text;background-clip:text;color:transparent}
  .err-art{aspect-ratio:1;max-width:340px;width:100%;margin:0 auto;border-radius:40%;background:radial-gradient(circle at 30% 30%,color-mix(in srgb,var(--leaf) 30%,transparent),transparent 60%),var(--brand-soft);display:grid;place-items:center;color:var(--brand)}
  .err-art .ic{width:120px;height:120px;stroke-width:1.1}
  @container main (max-width:720px){.err-wrap{grid-template-columns:minmax(0,1fr);text-align:center;gap:16px}.err-wrap .row{justify-content:center}.err-art{max-width:180px}.err-art .ic{width:72px;height:72px}.err-code{font-size:76px}}
  .qr-page{max-width:480px;width:100%;margin:0 auto;display:flex;flex-direction:column;gap:16px}
  .qr-head{display:flex;align-items:center;gap:12px;padding:6px 2px}
  .prod-photo{aspect-ratio:16/10;border-radius:18px;background:radial-gradient(260px 160px at 70% 25%,var(--amber-soft),transparent 70%),linear-gradient(135deg,var(--brand-soft),var(--surface-3));display:grid;place-items:center;color:var(--c-amber);border:1px solid var(--line)}
  .prod-photo .ic{width:72px;height:72px;stroke-width:1.2}
  .backup-codes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
  .backup-codes code{padding:8px 10px;border-radius:10px;background:var(--surface-2);border:1px solid var(--line);text-align:center;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px;letter-spacing:.06em}
  @container main (max-width:520px){.rg-types{grid-template-columns:minmax(0,1fr)}}
  .dim{opacity:.42;pointer-events:none;filter:grayscale(.4)}
  .setup-step{display:grid;grid-template-columns:32px minmax(0,1fr);gap:12px}
  .setup-step .n{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:var(--brand-soft);color:var(--brand-deep);font-weight:700}
  .secret{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;user-select:all;background:var(--surface-2);border:1px dashed var(--line-strong);padding:6px 10px;border-radius:8px;font-size:13.5px;overflow-wrap:anywhere}
  .filter-group{display:flex;flex-direction:column;gap:8px;padding:14px 0;border-bottom:1px solid var(--line)}
  .filter-group:last-of-type{border-bottom:0}
  .filter-group .check{font-size:14px}
  .rule-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 12px;font-size:12.5px;color:var(--text-3)}
  .rule-list span{display:flex;gap:6px;align-items:center}.rule-list .ic{width:14px;height:14px}
  .rule-list .ok{color:var(--c-green)}
  </style>`);

  /* ---------- tiện ích ---------- */
  const strip = (s) => [...String(s ?? '')].map((c) => c.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')[0] || c).join('').toLowerCase();
  O.strip = strip;
  const mmss = (s) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  function countdown(el, secs, fmtFn = mmss, done, loop = false) {
    if (!el) return; const start = secs;
    el.textContent = fmtFn(secs);
    const t = setInterval(() => {
      if (!document.body.contains(el)) return clearInterval(t);
      secs--; if (secs < 0) { if (loop) secs = start; else { clearInterval(t); done && done(); return; } }
      el.textContent = fmtFn(secs);
      if (secs === 0 && !loop) { clearInterval(t); done && done(); }
    }, 1000);
  }
  const homeOf = (role) => (O.MENUS[role] || [['catalog']])[0][0];
  const targetFor = (role) => ({ chuthe: 's17', xa: 's22', so: 's33', thuky: 's43', ttv: 's51', thanhvien: 's61', quantri: 's74' }[role] || 's33');
  function pwScore(v) { return [v.length >= 8, /[A-ZĐ]/.test(v), /\d/.test(v), /[^\w\s]/.test(v)].filter(Boolean).length; }
  function bindPw(root, inputId, meterId, labelId, rulesId) {
    const inp = root.querySelector('#' + inputId); if (!inp) return;
    const upd = () => {
      const v = inp.value; const s = v ? pwScore(v) : 0;
      root.querySelectorAll(`#${meterId} i`).forEach((i, k) => i.classList.toggle('on', k < s));
      const l = root.querySelector('#' + labelId); if (l) l.textContent = v ? ['Rất yếu', 'Yếu', 'Trung bình', 'Khá', 'Mạnh'][s] : 'Chưa nhập';
      if (rulesId) { const r = root.querySelectorAll(`#${rulesId} > span`); [v.length >= 8, /[A-ZĐ]/.test(v), /\d/.test(v), /[^\w\s]/.test(v)].forEach((ok, k) => { if (r[k]) { r[k].classList.toggle('ok', ok); r[k].querySelector('.ic').outerHTML = ic(ok ? 'circle-check' : 'circle'); } }); }
    };
    inp.addEventListener('input', upd); upd();
  }
  const pwField = (id, label, { value = '', meter = false, auto = 'current-password', ph = '' } = {}) => `<div class="field"><label for="${id}">${label}<span class="req">*</span></label><div class="input-icon">${ic('lock')}<input class="input" type="password" id="${id}" value="${esc(value)}" autocomplete="${auto}" placeholder="${ph}" style="padding-right:52px"><span class="suffix"><button type="button" class="icon-btn" style="width:38px;height:38px;border:0;background:none" data-pw="${id}" aria-label="Hiện mật khẩu">${ic('eye')}</button></span></div>${meter ? `<div class="pw-meter" id="${id}-m"><i></i><i></i><i></i><i></i></div><div class="row between tiny"><span class="muted">Độ mạnh: <b id="${id}-l">Chưa nhập</b></span></div><div class="rule-list" id="${id}-r"><span>${ic('circle')}Ít nhất 8 ký tự</span><span>${ic('circle')}Có chữ hoa</span><span>${ic('circle')}Có chữ số</span><span>${ic('circle')}Có ký tự đặc biệt</span></div>` : ''}</div>`;
  const brand = `<div class="auth-brand"><span class="logo-mark">${ic('sprout')}</span><div><b>OCOP ${D.tinh}</b><span class="small muted">Hệ thống đánh giá, phân hạng sản phẩm</span></div></div>`;
  const helpPanel = (title = 'Cần hỗ trợ đăng nhập?') => `<aside class="auth-help">
      <h2>${title}</h2>
      <p style="opacity:.92">Bộ phận hỗ trợ của Sở Nông nghiệp và Môi trường làm việc từ 7:30 đến 17:00, thứ Hai đến thứ Sáu.</p>
      <div class="stack s8"><div class="hero-pill">Điện thoại <b class="sel">0292 3 820 456</b></div><div class="hero-pill">Email <b class="sel">hotro.ocop@tinhmau.gov.vn</b></div></div>
      <div class="stack s12 hide-m" style="margin-top:auto;padding-top:12px">
        <div class="feat">${ic('file-check-2')}<span>Nộp hồ sơ, bổ sung minh chứng và theo dõi trạng thái trực tuyến.</span></div>
        <div class="feat">${ic('shield-check')}<span>Thành viên hội đồng và quản trị đăng nhập bằng xác thực hai lớp.</span></div>
        <div class="feat">${ic('qr-code')}<span>Giấy chứng nhận có mã QR để người mua kiểm tra tính xác thực.</span></div>
      </div>
    </aside>`;

  /* ---------- thông báo mẫu ---------- */
  const NOTI = [
    { icon: 'file-warning', tone: 'orange', title: 'Hồ sơ Mắm cá linh khô cần bổ sung minh chứng, hạn 20/10/2026', sub: 'HS-2026-0123 · UBND Xã An Phú', at: '10 phút trước', day: 'Hôm nay', unread: true, go: 's18', type: 'bosung' },
    { icon: 'file-check-2', tone: 'purple', title: 'Có báo cáo Tổ tư vấn mới cho hồ sơ HS-2026-0124', sub: 'Trà thảo mộc túi lọc · Phiên bản 2', at: '1 giờ trước', day: 'Hôm nay', unread: true, go: 's61', type: 'ttv' },
    { icon: 'calendar-clock', tone: 'amber', title: 'Đợt đánh giá 2026 đóng nhận hồ sơ sau 5 ngày', sub: 'Hạn nộp của xã: 30/04/2026', at: '08:00', day: 'Hôm nay', unread: true, go: 's31', type: 'han' },
    { icon: 'badge-check', tone: 'green', title: 'Hồ sơ Mật ong rừng tràm đã có kết quả đánh giá', sub: 'HS-2026-0127 · Mở hồ sơ để xem chi tiết', at: '18/10/2026 16:20', day: 'Trước đó', go: 's19', type: 'trangthai' },
    { icon: 'send', tone: 'blue', title: 'UBND Xã An Phú đã gửi hồ sơ Gạo thơm An Phú lên tỉnh', sub: 'Báo cáo đánh giá cấp xã số 05/BC-UBND', at: '17/10/2026 10:05', day: 'Trước đó', go: 's32', type: 'trangthai' },
    { icon: 'users', tone: 'purple', title: 'Bạn được phân công chấm hồ sơ Nón lá làng nghề', sub: 'HS-2026-0125 · Hạn của đợt 28/10/2026', at: '16/10/2026 14:30', day: 'Trước đó', go: 's60', type: 'phancong' },
    { icon: 'wrench', tone: 'gray', title: 'Hệ thống bảo trì từ 22:00 đến 23:30 ngày 25/10/2026', sub: 'Thông báo hệ thống', at: '15/10/2026 09:00', day: 'Trước đó', go: 's92', params: { variant: 'baotri' }, type: 'baotri' },
  ];
  const notiItem = (n) => `<div class="noti ${n.unread ? 'unread' : ''}" style="--t:var(--c-${n.tone})" data-go="${n.go}" ${n.params ? `data-params='${JSON.stringify(n.params)}'` : ''} role="link" tabindex="0"><span class="nic">${ic(n.icon)}</span><div class="nb"><b>${esc(n.title)}</b><small>${esc(n.sub)} · ${n.at}</small></div></div>`;

  O.openBell = (anchor) => {
    const p = O.pop(anchor, `<div class="pop-h">${ic('bell')}Thông báo <span class="badge-n">3</span><span class="spacer"></span><button class="link-btn small" data-markall>Đánh dấu đã đọc tất cả</button></div>
      <div style="max-height:380px;overflow:auto;width:min(390px,calc(100vw - 32px))">${NOTI.slice(0, 5).map(notiItem).join('')}</div>
      <div class="pop-f"><span class="muted">Nội dung thông báo không chứa điểm chi tiết</span><a href="#s04" data-go="s04">Xem tất cả</a></div>`);
    p.querySelector('[data-markall]').addEventListener('click', (e) => { e.stopPropagation(); p.querySelectorAll('.noti.unread').forEach((n) => n.classList.remove('unread')); p.querySelector('.badge-n')?.remove(); O.toast('Đã đánh dấu đọc tất cả'); });
    return p;
  };

  /* ---------- S90 bảng lệnh ---------- */
  function hl(text, q) {
    if (!q) return esc(text);
    const st = strip(text), sq = strip(q).trim(); const i = st.indexOf(sq);
    if (i < 0 || !sq) return esc(text);
    const chars = [...String(text)];
    return esc(chars.slice(0, i).join('')) + '<mark>' + esc(chars.slice(i, i + sq.length).join('')) + '</mark>' + esc(chars.slice(i + sq.length).join(''));
  }
  const matchHs = (q) => { const s = strip(q).trim(); if (!s) return []; return D.hoso.filter((h) => [h.ma, h.sp, h.ct, h.xa, h.nhom].some((x) => strip(x).includes(s))); };

  O.openSearch = () => {
    O.closeAll();
    const layer = document.getElementById('layer');
    layer.insertAdjacentHTML('beforeend', `<div class="overlay" data-ov id="cmdk" style="align-items:flex-start;padding-top:8vh"><div class="modal cmdk" role="dialog" aria-modal="true" aria-label="Tìm kiếm toàn cục">
      <div class="cin">${ic('search')}<input id="cmdk-in" placeholder="Tìm theo tên sản phẩm, mã hồ sơ, tên chủ thể…" autocomplete="off" aria-label="Từ khóa"><kbd>Esc</kbd></div>
      <div id="cmdk-res" style="overflow:auto;max-height:56vh"></div>
      <div class="modal-foot" style="justify-content:space-between;align-items:center"><span class="tiny muted"><kbd>↑</kbd> <kbd>↓</kbd> chọn · <kbd>Enter</kbd> mở · Tìm không phân biệt dấu</span><a href="#s90" data-go="s90" class="small strong">Xem trang kết quả đầy đủ</a></div>
    </div></div>`);
    const el = document.getElementById('cmdk'); O.bind(el);
    const inp = el.querySelector('#cmdk-in'), res = el.querySelector('#cmdk-res');
    const tgt = targetFor(O.state.role);
    const paint = () => {
      const q = inp.value;
      if (!strip(q).trim()) {
        const menu = (O.MENUS[O.state.role] || []).slice(0, 4);
        res.innerHTML = `<div class="grp"><h4>Tìm gần đây</h4>${['mam ca linh', 'HS-2026-0124', 'Xã Bình Thạnh'].map((r) => `<div class="it" data-q="${r}">${ic('history')}<span>${r}</span></div>`).join('')}</div><div class="grp"><h4>Đi nhanh</h4>${menu.map(([id, l, i]) => `<div class="it" data-nav="${id}">${ic(i)}<span>${l}</span><span class="spacer"></span><span class="tiny faint">${O.screens[id]?.code || ''}</span></div>`).join('')}</div>`;
      } else {
        const hs = matchHs(q).slice(0, 6);
        const ct = [...new Set(D.hoso.filter((h) => strip(h.ct).includes(strip(q).trim())).map((h) => h.ct))].slice(0, 3);
        res.innerHTML = !hs.length && !ct.length
          ? `<div class="empty" style="padding:30px 20px"><div class="eart" style="width:64px;height:64px">${ic('search-x')}</div><b>Không có kết quả cho “${esc(q)}”</b><p class="small">Thử gõ không dấu, gõ ngắn hơn hoặc tìm theo mã hồ sơ.</p></div>`
          : `${hs.length ? `<div class="grp"><h4>Hồ sơ</h4>${hs.map((h) => `<div class="it" data-hs="${h.ma}"><span class="avatar sm" style="--av:var(--brand-soft);color:var(--brand)">${ic(O.nhomIcon(h.nhom))}</span><div style="flex:1;min-width:0"><b style="font-weight:600">${hl(h.sp, q)}</b><div class="tiny muted">${hl(h.ma, q)} · ${hl(h.ct, q)} · ${esc(h.xa)}</div></div><span class="hide-m">${O.chip(h.st)}</span></div>`).join('')}</div>` : ''}${ct.length ? `<div class="grp"><h4>Chủ thể</h4>${ct.map((c) => `<div class="it" data-q="${esc(c)}">${ic('building-2')}<span>${hl(c, q)}</span></div>`).join('')}</div>` : ''}`;
      }
      const its = [...res.querySelectorAll('.it')]; if (its[0]) its[0].classList.add('on');
      its.forEach((it) => {
        it.addEventListener('mouseenter', () => { its.forEach((x) => x.classList.remove('on')); it.classList.add('on'); });
        it.addEventListener('click', () => {
          if (it.dataset.q) { inp.value = it.dataset.q; paint(); inp.focus(); return; }
          el.remove();
          if (it.dataset.nav) return O.go(it.dataset.nav);
          O.go(tgt, { id: it.dataset.hs });
        });
      });
    };
    inp.addEventListener('input', paint);
    inp.addEventListener('keydown', (e) => {
      const its = [...res.querySelectorAll('.it')]; let i = its.findIndex((x) => x.classList.contains('on'));
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!its.length) return; its[i]?.classList.remove('on'); i = (i + (e.key === 'ArrowDown' ? 1 : -1) + its.length) % its.length; its[i].classList.add('on'); its[i].scrollIntoView({ block: 'nearest' }); }
      if (e.key === 'Enter') { e.preventDefault(); its[i]?.click(); }
    });
    paint(); setTimeout(() => inp.focus(), 30);
  };

  /* ---------- S91 xem trước tệp ---------- */
  const DOC_TITLES = {
    'Giay-phep-kinh-doanh.pdf': ['GIẤY CHỨNG NHẬN ĐĂNG KÝ HỘ KINH DOANH', 'Số: 52A8012345 · Đăng ký lần đầu: 14/06/2019'],
    'Hop-dong-thu-mua-ca-linh.pdf': ['HỢP ĐỒNG THU MUA NGUYÊN LIỆU', 'Số: 03/2026/HĐTM · Về việc thu mua cá linh mùa nước nổi'],
    'Phieu-kiem-nghiem-KN0915.pdf': ['PHIẾU KẾT QUẢ KIỂM NGHIỆM', 'Số: KN-0915 · Mẫu: Mắm cá linh khô'],
  };
  function docPage(f, page, pages) {
    const [t, s] = DOC_TITLES[f.name] || [f.name.replace(/\.[^.]+$/, '').replace(/-/g, ' ').toUpperCase(), 'Tài liệu minh chứng'];
    const kn = f.name.startsWith('Phieu-kiem-nghiem');
    return `<div class="doc-hd"><div><b>TRUNG TÂM KỸ THUẬT<br>TIÊU CHUẨN ĐO LƯỜNG CHẤT LƯỢNG</b></div><div><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><u>Độc lập - Tự do - Hạnh phúc</u></div></div>
      <h3>${esc(t)}</h3><p style="text-align:center;font-style:italic;margin:4px 0 16px">${esc(s)}</p>
      ${kn && page === 1 ? `<table><tr><th>Chỉ tiêu</th><th>Kết quả</th><th>Giới hạn</th><th>Đánh giá</th></tr><tr><td>Tổng số vi sinh vật hiếu khí</td><td>3,2 × 10³ CFU/g</td><td>≤ 10⁵</td><td>Đạt</td></tr><tr class="hl"><td>Coliforms</td><td>&lt; 10 CFU/g</td><td>≤ 10²</td><td>Đạt</td></tr><tr><td>Histamin</td><td>142 mg/kg</td><td>≤ 400</td><td>Đạt</td></tr><tr><td>Chì (Pb)</td><td>KPH</td><td>≤ 0,5 mg/kg</td><td>Đạt</td></tr></table>` : ''}
      <p>Căn cứ Luật An toàn thực phẩm và các văn bản hướng dẫn thi hành; căn cứ nhu cầu và năng lực của các bên, hôm nay ngày 02 tháng 04 năm 2026 tại Xã An Phú, ${esc(D.tinh)}, các bên thống nhất nội dung như sau.</p>
      <p style="margin-top:10px">Điều ${page}. Bên B cung cấp cá linh tươi đánh bắt tại địa phương trong mùa nước nổi, bảo đảm nguồn gốc rõ ràng, không sử dụng hóa chất bảo quản. Số lượng dự kiến 12 tấn mỗi vụ, giao theo từng đợt.</p>
      <p style="margin-top:10px">Bên A có trách nhiệm thanh toán đúng hạn, ghi chép sổ nhập nguyên liệu để phục vụ truy xuất nguồn gốc.</p>
      <p style="text-align:right;margin-top:28px;font-size:12px">Trang ${page}/${pages}</p>`;
  }
  function pvPaint(host, st) {
    const files = D.files; const f = st.f;
    const t = f.type; const canView = ['pdf', 'jpg', 'png'].includes(t);
    const pages = t === 'pdf' ? 3 : 1;
    const titleEl = host.querySelector('[data-pv-title]'); if (titleEl) titleEl.textContent = f.name;
    const subEl = host.querySelector('[data-pv-sub]'); if (subEl) subEl.textContent = `${t.toUpperCase()} · ${f.size}`;
    let stage;
    if (st.state === 'noperm') stage = O.empty({ icon: 'shield-x', title: 'Bạn không đủ quyền xem tệp này', text: 'Tệp thuộc hồ sơ chưa được phân công cho bạn. Liên hệ thư ký hội đồng để được cấp quyền xem.' });
    else if (st.state === 'scan') stage = O.empty({ icon: 'scan-search', title: 'Tệp đang được quét và xử lý', text: 'Hệ thống đang kiểm tra an toàn và tạo bản xem trước. Việc này thường mất dưới một phút.', action: `<div style="width:220px">${O.progress(64, 100)}<div class="tiny muted" style="margin-top:6px">Đã xử lý 64%</div></div>` });
    else if (st.state === 'unsupported' || !canView) stage = O.empty({ icon: 'file-x-2', title: 'Không xem trước được định dạng này', text: `Tệp ${t.toUpperCase()} cần tải về và mở bằng phần mềm phù hợp.`, action: O.btn('Tải xuống', { kind: 'primary', icon: 'download', attrs: 'data-toast="Đang tải xuống tệp…"' }) });
    else {
      const w = Math.round(st.zoom * 5.4);
      stage = `<div class="pv-toolbar">
          <button class="icon-btn" data-pv="pp" aria-label="Trang trước" ${st.page <= 1 ? 'disabled' : ''}>${ic('chevron-up')}</button><span class="nowrap">Trang <b>${st.page}</b> / ${pages}</span><button class="icon-btn" data-pv="np" aria-label="Trang sau" ${st.page >= pages ? 'disabled' : ''}>${ic('chevron-down')}</button>
          <span class="spacer"></span>
          <button class="icon-btn" data-pv="zo" aria-label="Thu nhỏ">${ic('zoom-out')}</button><b class="num" style="min-width:46px;text-align:center">${st.zoom}%</b><button class="icon-btn" data-pv="zi" aria-label="Phóng to">${ic('zoom-in')}</button><button class="icon-btn" data-pv="fit" aria-label="Vừa khung">${ic('scan')}</button>
        </div>
        <div class="pv-stage">${t === 'pdf' ? `<div class="doc-page" style="width:${w}px">${docPage(f, st.page, pages)}</div>` : `<div class="pv-img" style="width:${w}px">${ic(t === 'png' ? 'tag' : 'image')}</div>`}</div>`;
    }
    const critTxt = f.crit.startsWith('Hồ sơ') ? f.crit : 'Tiêu chí ' + f.crit;
    host.querySelector('[data-pv-body]').innerHTML = `${O.banner({ tone: 'green', icon: 'link-2', title: 'Gắn với tiêu chí', text: esc(critTxt) })}
      ${stage}
      ${O.kv([['user', 'Người tải lên', esc(f.by)], ['clock', 'Thời gian', f.at], ['hard-drive', 'Dung lượng', f.size], ['file', 'Loại tệp', t.toUpperCase()]])}`;
    const foot = host.querySelector('[data-pv-foot]');
    foot.innerHTML = `${O.btn('', { icon: 'chevron-left', attrs: `data-pv="pf" aria-label="Tệp trước" ${st.i <= 0 ? 'disabled' : ''}` })}<span class="small muted nowrap">Tệp ${st.i + 1} / ${files.length}</span>${O.btn('', { icon: 'chevron-right', attrs: `data-pv="nf" aria-label="Tệp sau" ${st.i >= files.length - 1 ? 'disabled' : ''}` })}<span class="spacer"></span>${st.state === 'noperm' ? '' : O.btn('Tải xuống', { kind: 'primary', icon: 'download', attrs: 'data-toast="Đang tải xuống tệp…"' })}`;
    O.bind(host.querySelector('[data-pv-body]')); O.bind(foot);
    host.querySelectorAll('[data-pv]').forEach((b) => b.addEventListener('click', () => {
      const a = b.dataset.pv;
      if (a === 'zi') st.zoom = Math.min(200, st.zoom + 25);
      if (a === 'zo') st.zoom = Math.max(50, st.zoom - 25);
      if (a === 'fit') st.zoom = 100;
      if (a === 'pp') st.page = Math.max(1, st.page - 1);
      if (a === 'np') st.page = Math.min(pages, st.page + 1);
      if (a === 'pf' || a === 'nf') { st.i = Math.max(0, Math.min(files.length - 1, st.i + (a === 'nf' ? 1 : -1))); st.f = files[st.i]; st.page = 1; if (st.state === 'unsupported') st.state = ''; }
      pvPaint(host, st);
    }));
  }
  function pvState(name, state = '') {
    let i = D.files.findIndex((x) => x.name === name);
    let f = D.files[i];
    if (i < 0) { const ext = (String(name).split('.').pop() || 'pdf').toLowerCase(); f = { name, size: '—', type: ext, crit: 'Minh chứng của hồ sơ', by: 'Chủ thể', at: '—' }; i = 0; }
    return { i, f, zoom: 100, page: 1, state };
  }
  O.previewFile = (name, state = '') => {
    const full = document.getElementById('app').classList.contains('is-mobile');
    const el = O.drawer({ title: `<span data-pv-title>${esc(name)}</span>`, sub: '<span data-pv-sub></span>', body: '<div data-pv-body class="stack"></div>', foot: '<div data-pv-foot class="row s8" style="width:100%"></div>', full });
    el.querySelector('.drawer-body').style.padding = '16px 20px';
    pvPaint(el, pvState(name, state));
    return el;
  };

  /* =================== S01 Đăng nhập và 2FA =================== */
  O.screen('s01', {
    title: 'Đăng nhập', code: 'S01', layout: 'bare', device: 'Cả hai',
    variants: [['login', 'Đăng nhập'], ['2fa', 'Nhập mã 2FA'], ['wrong', 'Sai mật khẩu'], ['locked', 'Tạm khóa'], ['expired', 'Phiên hết hạn'], ['role', 'Chọn vai trò']],
    render({ variant: v }) {
      let card;
      if (v === '2fa') {
        card = `${brand}
          <div class="stack s8"><span class="mic" style="width:48px;height:48px;border-radius:16px;display:grid;place-items:center;background:var(--brand-soft);color:var(--brand)">${ic('shield-check')}</span><h1>Xác thực hai lớp</h1><p class="muted">Nhập mã 6 số trong ứng dụng xác thực (Google Authenticator, Microsoft Authenticator) cho tài khoản <b>lev••@soyte.tinhmau.gov.vn</b>.</p></div>
          <form class="stack" id="f2fa" novalidate>
            <div class="field"><label>Mã xác thực</label>${O.otp('otp2fa')}<span class="err" id="otp-err" hidden>${ic('circle-alert')}Nhập đủ 6 số. Mã gồm các chữ số trong ứng dụng.</span><span class="hint">${ic('timer')} Mã hiện tại còn hiệu lực <b id="otp-cd">00:28</b></span></div>
            <label class="check"><input type="checkbox" id="trust"> Tin cậy thiết bị này trong 30 ngày</label>
            <button class="btn primary lg block" type="submit">${ic('log-in')}<span>Xác nhận và đăng nhập</span></button>
          </form>
          <div class="row between small"><a href="#s01" data-go="s01">${ic('arrow-left')} Quay lại</a><button class="link-btn" id="lost2fa">Mất mã xác thực?</button></div>`;
      } else if (v === 'role') {
        const roles = [['so', 'Cán bộ Sở NN&MT', 'Quản lý đợt, tiếp nhận hồ sơ, báo cáo'], ['thuky', 'Thư ký hội đồng', 'Phân công, tiến độ chấm, chốt điểm']];
        card = `${brand}
          <div class="stack s8"><h1>Chọn vai trò làm việc</h1><p class="muted">Tài khoản <b>Phan Thu Hà</b> có 2 vai trò. Bạn có thể đổi vai trò bất cứ lúc nào ở đầu trang.</p></div>
          <div class="stack s8" id="role-pick">${roles.map(([k, n, d], i) => `<label class="radio-card" style="align-items:flex-start"><input type="radio" name="role" value="${k}" ${i === 0 ? 'checked' : ''} style="margin-top:3px"><span class="role-dot" style="width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:var(--brand-soft);color:var(--brand);flex:none">${ic(O.ROLES[k].icon)}</span><span><b style="font-weight:600">${n}</b><br><span class="small muted">${d}</span></span></label>`).join('')}</div>
          <label class="check"><input type="checkbox" checked id="role-def"> Dùng làm vai trò mặc định cho lần đăng nhập sau</label>
          <button class="btn primary lg block" id="role-go">${ic('arrow-right')}<span>Vào hệ thống</span></button>`;
      } else {
        const banners = {
          wrong: O.banner({ tone: 'red', icon: 'circle-alert', title: 'Thông tin đăng nhập không đúng', text: 'Kiểm tra lại email hoặc tên đăng nhập và mật khẩu, chú ý chữ hoa và bộ gõ tiếng Việt. Còn 2 lần thử trước khi tài khoản bị tạm khóa.' }),
          locked: O.banner({ tone: 'orange', icon: 'lock', title: 'Tài khoản tạm khóa do đăng nhập sai nhiều lần', text: `Thử lại sau <b id="lock-cd">14:52</b>, hoặc dùng "Quên mật khẩu?" để đặt lại.` }),
          expired: O.banner({ tone: 'blue', icon: 'clock', title: 'Phiên làm việc đã hết hạn', text: 'Đăng nhập lại để quay về trang bạn đang làm: Phiếu chấm HS-2026-0123.' }),
        };
        const bad = v === 'wrong';
        card = `${brand}
          <div class="stack s8"><h1>Đăng nhập</h1><p class="muted">Dùng tài khoản do hệ thống cấp hoặc tài khoản chủ thể đã đăng ký.</p></div>
          ${banners[v] || ''}
          <form class="stack" id="flogin" novalidate>
            <div class="field"><label for="lg-user">Email hoặc tên đăng nhập<span class="req">*</span></label><div class="input-icon">${ic('mail')}<input class="input ${bad ? 'invalid' : ''}" id="lg-user" autocomplete="username" value="${v === 'login' ? '' : 'levanc@soyte.tinhmau.gov.vn'}" placeholder="vd: tenban@email.com"></div></div>
            ${pwField('lg-pw', 'Mật khẩu', { value: v === 'login' ? '' : 'matkhau123', ph: 'Nhập mật khẩu' })}
            <div class="row between"><label class="check small"><input type="checkbox" id="lg-rem"> Ghi nhớ đăng nhập</label><button type="button" class="link-btn small" data-toast="Đã gửi liên kết đặt lại mật khẩu tới email của bạn">Quên mật khẩu?</button></div>
            <button class="btn primary lg block" type="submit" ${v === 'locked' ? 'disabled' : ''}>${ic('log-in')}<span>Đăng nhập</span></button>
          </form>
          <div class="or-line">Chủ thể chưa có tài khoản?</div>
          ${O.btn('Đăng ký tài khoản chủ thể', { kind: 'soft', icon: 'user-plus', go: 's02', attrs: 'style="width:100%"' })}`;
      }
      return `<div class="auth-layout"><div class="auth-card">${card}</div>${helpPanel(v === '2fa' ? 'Không nhận được mã?' : 'Cần hỗ trợ đăng nhập?')}</div>`;
    },
    mount(root, { variant: v }) {
      const fl = root.querySelector('#flogin');
      if (fl) fl.addEventListener('submit', (e) => { e.preventDefault(); const u = root.querySelector('#lg-user'), p = root.querySelector('#lg-pw'); if (!u.value || !p.value) { [u, p].forEach((x) => x.classList.toggle('invalid', !x.value)); return O.toast('Nhập email hoặc tên đăng nhập và mật khẩu', true); } O.setVariant('2fa'); });
      countdown(root.querySelector('#lock-cd'), 892);
      countdown(root.querySelector('#otp-cd'), 28, mmss, null, true);
      const f2 = root.querySelector('#f2fa');
      if (f2) {
        f2.addEventListener('submit', (e) => { e.preventDefault(); const code = [...root.querySelectorAll('#otp2fa input')].map((i) => i.value).join(''); const err = root.querySelector('#otp-err'); if (code.length < 6) { root.querySelector('#otp2fa').classList.add('invalid'); err.hidden = false; return; } O.state.role = 'thanhvien'; O.toast('Đăng nhập thành công'); O.go(homeOf('thanhvien')); });
        root.querySelector('#lost2fa').addEventListener('click', () => O.modal({ title: 'Mất mã xác thực hai lớp', icon: 'life-buoy', body: `<p>Nếu bạn đổi điện thoại hoặc xóa ứng dụng xác thực, có hai cách lấy lại quyền truy cập:</p><div class="conseq"><div>${ic('key-round')}<span><b>Dùng mã dự phòng</b> đã tải về khi bật xác thực hai lớp. Mỗi mã dùng được một lần.</span></div><div>${ic('headset')}<span><b>Liên hệ quản trị hệ thống</b> để đặt lại 2FA: 0292 3 820 456 hoặc hotro.ocop@tinhmau.gov.vn. Bạn cần xác minh danh tính.</span></div></div>`, foot: `${O.btn('Đóng', { kind: 'ghost', attrs: 'data-close' })}${O.btn('Nhập mã dự phòng', { kind: 'primary', attrs: 'data-close data-toast="Nhập mã dự phòng 8 ký tự vào ô mã"' })}` }));
      }
      const rg = root.querySelector('#role-go');
      if (rg) rg.addEventListener('click', () => { const r = root.querySelector('input[name=role]:checked').value; O.state.role = r; O.go(homeOf(r)); O.toast('Đang làm việc với vai trò ' + O.ROLES[r].name); });
    },
  });

  /* =================== S02 Đăng ký tài khoản chủ thể =================== */
  O.screen('s02', {
    title: 'Đăng ký tài khoản chủ thể', code: 'S02', layout: 'bare', device: 'Di động',
    variants: [['form', 'Biểu mẫu 3 bước'], ['trung', 'Trùng mã số thuế'], ['email', 'Kiểm tra email'], ['xong', 'Thành công']],
    render({ variant: v }) {
      const steps = [['Thông tin tổ chức'], ['Liên hệ'], ['Xác thực email']];
      if (v === 'xong') {
        return `<div class="auth-layout wide"><div class="auth-card" style="align-items:center;text-align:center">${brand}<div class="big-ok">${ic('circle-check')}</div><h1>Tạo tài khoản thành công</h1><p class="muted">Email <b>sau.nguyen••@gmail.com</b> đã được xác thực. Bước tiếp theo: bổ sung giấy tờ pháp lý của cơ sở để dùng chung cho các hồ sơ sản phẩm.</p><div class="conseq" style="text-align:left;width:100%"><div>${ic('file-badge')}<span>Giấy phép kinh doanh, giấy chứng nhận VSATTP, công bố chất lượng</span></div><div>${ic('clock')}<span>Mất khoảng 5 phút nếu bạn có sẵn ảnh chụp giấy tờ</span></div></div>${O.btn('Bổ sung giấy tờ pháp lý', { kind: 'primary', size: 'lg', icon: 'arrow-right', go: 's11', attrs: 'style="width:100%"' })}${O.btn('Để sau, vào Trang chủ', { kind: 'ghost', go: 's10' })}</div>${helpPanel('Bước tiếp theo')}</div>`;
      }
      const dup = v === 'trung';
      const s1 = `<div class="stack" data-step="0">
          <div class="field"><span class="label">Loại tổ chức<span class="req">*</span></span><div class="radio-cards rg-types">${[['Doanh nghiệp', 'building-2'], ['Hợp tác xã', 'users'], ['Hộ sản xuất', 'house']].map(([l, i], k) => `<label class="radio-card"><input type="radio" name="loai" ${k === 2 ? 'checked' : ''}>${ic(i)}<span>${l}</span></label>`).join('')}</div></div>
          <div class="field"><label for="rg-ten">Tên tổ chức hoặc họ tên chủ hộ<span class="req">*</span></label><input class="input" id="rg-ten" value="Cơ sở Mắm Bà Sáu"></div>
          <div class="field"><label for="rg-mst">Mã số thuế hoặc số định danh<span class="req">*</span></label><input class="input ${dup ? 'invalid' : ''}" id="rg-mst" inputmode="numeric" value="${dup ? '0312456891' : ''}" placeholder="10 hoặc 12 chữ số">${dup ? `<span class="err">${ic('circle-alert')}Mã số thuế này đã có tài khoản. Nếu đó là cơ sở của bạn, hãy khôi phục tài khoản.</span>` : '<span class="hint">Hộ sản xuất dùng số định danh cá nhân (12 số) của chủ hộ</span>'}</div>
          <div class="field"><label for="rg-xa">Xã/phường<span class="req">*</span></label><div class="input-icon">${ic('map-pin')}<input class="input" id="rg-xa" list="rg-xa-list" placeholder="Gõ để tìm xã/phường" value="Xã An Phú"></div><datalist id="rg-xa-list">${D.xa.map((x) => `<option value="${x}">`).join('')}</datalist></div>
          ${dup ? O.banner({ tone: 'orange', icon: 'user-round-search', title: 'Có thể bạn đã có tài khoản', text: 'Tài khoản đăng ký với mã số thuế 0312•••891 dùng email sa•••@gmail.com.', actions: O.btn('Khôi phục tài khoản', { size: 'sm', kind: 'soft', attrs: 'data-toast="Đã gửi hướng dẫn khôi phục tới sa•••@gmail.com"' }) }) : ''}
          ${O.banner({ tone: 'green', icon: 'hand-helping', text: 'Hộ sản xuất cần giúp đỡ? Liên hệ UBND xã để được cán bộ hỗ trợ tạo tài khoản.' })}
        </div>`;
      const s2 = `<div class="stack" data-step="1" hidden>
          <div class="field"><label for="rg-dd">Người đại diện<span class="req">*</span></label><div class="input-icon">${ic('user')}<input class="input" id="rg-dd" value="Nguyễn Thị Sáu"></div></div>
          <div class="form-grid"><div class="field"><label for="rg-sdt">Số điện thoại<span class="req">*</span></label><div class="input-icon">${ic('phone')}<input class="input" id="rg-sdt" inputmode="tel" value="0918 452 247"></div></div>
          <div class="field"><label for="rg-mail">Email<span class="req">*</span></label><div class="input-icon">${ic('mail')}<input class="input" id="rg-mail" type="email" value="sau.nguyen.mam@gmail.com"></div><span class="hint">Dùng để đăng nhập và nhận thông báo</span></div></div>
          ${pwField('rg-pw', 'Mật khẩu', { meter: true, auto: 'new-password', ph: 'Tối thiểu 8 ký tự' })}
          ${pwField('rg-pw2', 'Nhập lại mật khẩu', { auto: 'new-password' })}
          <label class="check"><input type="checkbox" id="rg-agree"><span>Tôi đồng ý với <button type="button" class="link-btn" data-policy="dk">Điều khoản sử dụng</button> và <button type="button" class="link-btn" data-policy="ds">Chính sách bảo vệ dữ liệu cá nhân</button> của hệ thống.</span></label>
          <span class="err" id="rg-agree-err" hidden style="font-size:12.5px;color:var(--c-red)">Cần đồng ý điều khoản và chính sách dữ liệu cá nhân để tạo tài khoản.</span>
        </div>`;
      const s3 = `<div class="stack" data-step="2" hidden style="align-items:center;text-align:center">
          <div class="big-ok" style="--t:var(--c-blue)">${ic('mail-check')}</div>
          <h2>Kiểm tra hộp thư của bạn</h2>
          <p class="muted">Đã gửi liên kết xác thực tới <b>sau.nguyen••••@gmail.com</b>. Mở email và bấm "Xác thực tài khoản". Liên kết có hiệu lực trong 24 giờ.</p>
          <div class="conseq" style="text-align:left;width:100%"><div>${ic('inbox')}<span>Không thấy email? Kiểm tra mục Thư rác hoặc Quảng cáo.</span></div><div>${ic('pencil')}<span>Gõ sai địa chỉ? <button type="button" class="link-btn" data-back>Sửa email</button></span></div></div>
          <button type="button" class="btn block" id="resend" disabled>${ic('rotate-cw')}<span>Gửi lại email sau <b id="resend-cd">00:45</b></span></button>
          <button type="button" class="btn ghost sm" data-go="s02" data-params='{"variant":"xong"}'>Bản mẫu: giả lập đã bấm liên kết xác thực</button>
        </div>`;
      return `<div class="auth-layout wide"><div class="auth-card">
          ${brand}
          <div class="stack s8"><h1>Đăng ký tài khoản chủ thể</h1><p class="muted">Dành cho doanh nghiệp, hợp tác xã và hộ sản xuất muốn tham gia đánh giá OCOP.</p></div>
          <div id="rg-wz">${O.wizard(steps, v === 'email' ? 2 : 0)}</div>
          <form class="stack" id="frg" novalidate>${s1}${s2}${s3}
            <div class="row" id="rg-nav"><button type="button" class="btn ghost" id="rg-back" hidden>${ic('arrow-left')}<span>Quay lại</span></button><span class="spacer"></span><button type="submit" class="btn primary lg" id="rg-next">${ic('arrow-right')}<span>Tiếp tục</span></button></div>
          </form>
          <p class="small muted" style="text-align:center">Đã có tài khoản? <a href="#s01">Đăng nhập</a></p>
        </div>${helpPanel('Hỗ trợ đăng ký')}</div>`;
    },
    mount(root, { variant: v }) {
      let step = v === 'email' ? 2 : 0;
      const steps = [['Thông tin tổ chức'], ['Liên hệ'], ['Xác thực email']];
      const show = () => {
        root.querySelectorAll('[data-step]').forEach((s) => (s.hidden = +s.dataset.step !== step));
        root.querySelector('#rg-wz').innerHTML = O.wizard(steps, step);
        root.querySelector('#rg-back').hidden = step !== 1;
        root.querySelector('#rg-nav').hidden = step === 2;
        root.querySelector('#rg-next span').textContent = step === 1 ? 'Tạo tài khoản' : 'Tiếp tục';
        if (step === 2) countdown(root.querySelector('#resend-cd'), 45, mmss, () => { const b = root.querySelector('#resend'); if (b) { b.disabled = false; b.querySelector('span').textContent = 'Gửi lại email xác thực'; } });
      };
      show();
      bindPw(root, 'rg-pw', 'rg-pw-m', 'rg-pw-l', 'rg-pw-r');
      root.querySelector('#rg-back').addEventListener('click', () => { step = 0; show(); });
      root.querySelector('[data-back]')?.addEventListener('click', () => { step = 1; show(); });
      root.querySelector('#resend').addEventListener('click', () => O.toast('Đã gửi lại email xác thực'));
      root.querySelector('#frg').addEventListener('submit', (e) => {
        e.preventDefault();
        if (step === 0) {
          const m = root.querySelector('#rg-mst');
          if (v === 'trung') return O.toast('Mã số thuế đã có tài khoản. Chọn Khôi phục tài khoản.', true);
          if (!m.value.trim()) { m.classList.add('invalid'); if (!m.parentElement.querySelector('.err')) m.insertAdjacentHTML('afterend', `<span class="err">${ic('circle-alert')}Nhập mã số thuế (10 số) hoặc số định danh (12 số).</span>`); return; }
          step = 1; return show();
        }
        if (step === 1) {
          const ag = root.querySelector('#rg-agree'), err = root.querySelector('#rg-agree-err');
          const pw = root.querySelector('#rg-pw'), pw2 = root.querySelector('#rg-pw2');
          let ok = true;
          if (pwScore(pw.value) < 3) { pw.classList.add('invalid'); ok = false; } else pw.classList.remove('invalid');
          if (pw.value !== pw2.value || !pw2.value) { pw2.classList.add('invalid'); ok = false; } else pw2.classList.remove('invalid');
          err.hidden = ag.checked; if (!ag.checked) ok = false;
          if (!ok) return O.toast('Kiểm tra lại mật khẩu và ô đồng ý chính sách', true);
          step = 2; show();
        }
      });
      root.querySelectorAll('[data-policy]').forEach((b) => b.addEventListener('click', () => O.modal({ title: b.dataset.policy === 'ds' ? 'Chính sách bảo vệ dữ liệu cá nhân' : 'Điều khoản sử dụng', icon: 'shield-check', body: `<p class="muted small">Nội dung chính thức do Sở NN&MT ${D.tinh} cung cấp. Tóm tắt các điểm chính:</p><div class="conseq"><div>${ic('database')}<span>Hệ thống thu thập họ tên, số định danh, số điện thoại và email để xác minh chủ thể và gửi thông báo về hồ sơ.</span></div><div>${ic('eye-off')}<span>Số định danh và số điện thoại được che bớt ở danh sách và nhật ký; trang công khai không hiển thị thông tin cá nhân.</span></div><div>${ic('scroll-text')}<span>Mọi lần truy cập dữ liệu nhạy cảm đều được ghi nhật ký.</span></div><div>${ic('user-x')}<span>Bạn có quyền yêu cầu xem, sửa hoặc xóa dữ liệu cá nhân theo quy định.</span></div></div>`, foot: O.btn('Đã hiểu', { kind: 'primary', attrs: 'data-close' }) })));
    },
  });

  /* =================== S03 Tài khoản cá nhân và bảo mật =================== */
  O.screen('s03', {
    title: 'Tài khoản và bảo mật', code: 'S03', crumbs: [], device: 'Cả hai',
    variants: [['default', 'Đã bật 2FA'], ['setup', 'Đang bật 2FA'], ['batbuoc', 'Bắt buộc bật 2FA']],
    render({ variant: v, role }) {
      const R = O.ROLES[role];
      const must = v === 'batbuoc';
      const tfaOn = v === 'default';
      const codes = ['K7QF-29MD', 'P3XA-81LT', 'B9WE-47RC', 'H2NV-63ZS', 'T5GU-18KJ', 'M8YD-52PB', 'Q4CR-90HW', 'E6LZ-35FN'];
      const setup = `<div class="stack">
          <div class="setup-step"><span class="n">1</span><div class="stack s8"><b>Quét mã QR bằng ứng dụng xác thực</b><span class="small muted">Google Authenticator, Microsoft Authenticator hoặc ứng dụng tương tự.</span><div class="row top">${O.qr(11)}<div class="stack s8" style="flex:1;min-width:160px"><span class="small muted">Không quét được? Nhập khóa này:</span><span class="secret">JBSW Y3DP EHPK 3PXP L4MQ</span>${O.btn('Sao chép khóa', { size: 'sm', icon: 'copy', attrs: 'data-copy="JBSWY3DPEHPK3PXPL4MQ"' })}</div></div></div></div>
          <div class="setup-step"><span class="n">2</span><div class="stack s8"><b>Nhập mã 6 số để kiểm tra</b>${O.otp('tfa-otp')}<span class="err" id="tfa-err" hidden>${ic('circle-alert')}Mã chưa đúng hoặc đã hết hạn. Nhập mã mới nhất trong ứng dụng.</span></div></div>
          <div class="setup-step"><span class="n">3</span><div class="stack s8"><b>Lưu mã dự phòng</b><span class="small muted">Dùng khi mất điện thoại. Mỗi mã dùng được một lần.</span><div class="backup-codes">${codes.map((c) => `<code>${c}</code>`).join('')}</div><div class="row s8">${O.btn('Tải mã dự phòng', { size: 'sm', icon: 'download', attrs: 'data-toast="Đã tải tệp ma-du-phong-OCOP.txt"' })}${O.btn('Sao chép', { size: 'sm', icon: 'copy', attrs: `data-copy="${codes.join(' ')}"` })}</div></div></div>
          <div class="row">${O.btn('Bật xác thực hai lớp', { kind: 'primary', icon: 'shield-check', id: 'tfa-on' })}</div>
        </div>`;
      const tfaCard = O.card(tfaOn
        ? `<div class="stack"><div class="row">${O.tag('Đã bật', 'green', 'shield-check')}<span class="small muted">Từ 12/03/2026 · Ứng dụng Microsoft Authenticator</span></div><p class="small muted">Mỗi lần đăng nhập, bạn nhập thêm mã 6 số trong ứng dụng. Còn 6 mã dự phòng chưa dùng.</p><div class="row s8">${O.btn('Xem mã dự phòng', { size: 'sm', icon: 'key-round', id: 'show-codes' })}${O.btn('Đổi thiết bị xác thực', { size: 'sm', icon: 'smartphone', attrs: 'data-variant-go="setup"' })}</div></div>`
        : setup, { title: 'Xác thực hai lớp', sub: 'Bắt buộc với vai trò hội đồng, Tổ tư vấn và quản trị', actions: tfaOn ? '' : O.tag('Chưa bật', must ? 'red' : 'orange', 'shield-alert'), cls: must ? 'raised' : '' });
      const dim = must ? 'dim' : '';
      const info = O.card(`<div class="stack"><div class="row">${O.avatar(R.user, 'lg')}<div><b style="font-size:17px">${esc(R.user)}</b><div class="small muted">${esc(R.name)} · ${esc(R.unit)}</div></div><span class="spacer"></span>${O.btn('Đổi ảnh', { size: 'sm', kind: 'ghost', icon: 'camera' })}</div>
          <div class="form-grid">
            <div class="field"><label for="ac-ten">Họ và tên</label><input class="input" id="ac-ten" value="${esc(R.user)}"></div>
            <div class="field"><label for="ac-cv">Chức vụ</label><input class="input" id="ac-cv" value="Chuyên viên"></div>
            <div class="field"><label for="ac-mail">Email</label><input class="input" id="ac-mail" value="${strip(R.user).replace(/\s+/g, '.')}@tinhmau.gov.vn"></div>
            <div class="field"><label for="ac-sdt">Số điện thoại</label><input class="input" id="ac-sdt" value="0912 345 678"></div>
            <div class="field full"><label for="ac-dv">Đơn vị</label><input class="input" id="ac-dv" value="${esc(R.unit)}" readonly><span class="hint">Đơn vị và vai trò do quản trị hệ thống cấp</span></div>
          </div>
          <div class="stack s8"><span class="label">Vai trò được gán</span><div class="row s8">${O.tag(R.name, 'green', R.icon)}${role === 'so' || role === 'thuky' ? O.tag(role === 'so' ? 'Thư ký hội đồng' : 'Cán bộ Sở NN&MT', 'gray') : ''}<span class="tag">Phạm vi: ${role === 'xa' || role === 'chuthe' ? 'Xã An Phú' : 'Toàn tỉnh'}</span></div></div></div>`,
        { title: 'Thông tin cá nhân', foot: `<span class="small muted">Đã lưu 14:32</span><span class="spacer"></span>${O.btn('Lưu thay đổi', { kind: 'primary', attrs: 'data-toast="Đã lưu thông tin cá nhân"' })}`, cls: dim });
      const pw = O.card(`<form class="stack" id="fpw" novalidate>${pwField('pw-old', 'Mật khẩu hiện tại')}${pwField('pw-new', 'Mật khẩu mới', { meter: true, auto: 'new-password' })}${pwField('pw-new2', 'Nhập lại mật khẩu mới', { auto: 'new-password' })}<div>${O.btn('Đổi mật khẩu', { kind: 'primary', icon: 'key-round', attrs: 'type="submit"' }).replace('type="button" ', '')}</div></form>`, { title: 'Đổi mật khẩu', cls: dim });
      const sess = O.card(`<div class="list">${[['monitor', 'Chrome trên Windows', 'Sở NN&MT · 113.161.•••.24', 'Đang dùng', true], ['smartphone', 'Safari trên iPhone', '18/10/2026 21:14 · 27.72.•••.9', ''], ['laptop', 'Edge trên Windows', '15/10/2026 08:02 · 113.161.•••.31', '']].map(([i, d, s, cur, me]) => `<div class="li"><span class="stat" style="padding:0;border:0;background:none"><span class="ico" style="--t:var(--c-${me ? 'green' : 'gray'})">${ic(i)}</span></span><div class="grow"><b style="font-weight:600">${d}</b><div class="small muted">${s}</div></div>${me ? O.tag(cur, 'green') : O.btn('Đăng xuất', { size: 'sm', kind: 'danger-ghost', attrs: 'data-logout' })}</div>`).join('')}</div>`,
        { title: 'Phiên đăng nhập', sub: 'Các thiết bị đang đăng nhập tài khoản của bạn', actions: O.btn('Đăng xuất thiết bị khác', { size: 'sm', icon: 'log-out', id: 'logout-all' }), cls: dim });
      return `${O.pageHead({ title: 'Tài khoản và bảo mật', sub: 'Quản lý thông tin liên hệ, mật khẩu, xác thực hai lớp và phiên đăng nhập.' })}
        ${must ? O.banner({ tone: 'red', icon: 'shield-alert', title: `Vai trò ${esc(R.name)} bắt buộc bật xác thực hai lớp`, text: 'Các chức năng khác đang bị tạm chặn. Hoàn thành 3 bước ở thẻ Xác thực hai lớp để tiếp tục làm việc.' }) : ''}
        <div class="grid g-2">${must ? `<div class="stack">${tfaCard}${info}</div><div class="stack">${pw}${sess}</div>` : `<div class="stack">${info}${sess}</div><div class="stack">${tfaCard}${pw}</div>`}</div>`;
    },
    mount(root, { variant: v }) {
      bindPw(root, 'pw-new', 'pw-new-m', 'pw-new-l', 'pw-new-r');
      root.querySelector('#fpw')?.addEventListener('submit', (e) => { e.preventDefault(); const o = root.querySelector('#pw-old'), n = root.querySelector('#pw-new'), n2 = root.querySelector('#pw-new2'); let ok = true; [[o, !!o.value], [n, pwScore(n.value) >= 3], [n2, n2.value && n2.value === n.value]].forEach(([x, g]) => { x.classList.toggle('invalid', !g); if (!g) ok = false; }); O.toast(ok ? 'Đã đổi mật khẩu. Các thiết bị khác sẽ phải đăng nhập lại.' : 'Kiểm tra lại các trường mật khẩu', !ok); });
      root.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', () => { const t = b.dataset.copy; (navigator.clipboard?.writeText(t) || Promise.reject()).then(() => O.toast('Đã sao chép'), () => O.toast('Hãy chọn và sao chép thủ công', true)); }));
      root.querySelector('#tfa-on')?.addEventListener('click', () => { const code = [...root.querySelectorAll('#tfa-otp input')].map((i) => i.value).join(''); if (code.length < 6) { root.querySelector('#tfa-otp').classList.add('invalid'); root.querySelector('#tfa-err').hidden = false; return; } O.toast('Đã bật xác thực hai lớp'); O.setVariant('default'); });
      root.querySelector('[data-variant-go]')?.addEventListener('click', () => O.setVariant('setup'));
      root.querySelector('#show-codes')?.addEventListener('click', () => O.confirm({ title: 'Xem mã dự phòng', kind: 'otp', what: 'Hiển thị 6 mã dự phòng còn hiệu lực.', notify: 'Bạn nhận email cảnh báo về lần xem mã này.', undo: 'Không cần hoàn tác.', confirmText: 'Xem mã', onConfirm: () => O.toast('Đã xác thực, mã dự phòng hiển thị trong 60 giây') }));
      root.querySelectorAll('[data-logout]').forEach((b) => b.addEventListener('click', () => { b.closest('.li').remove(); O.toast('Đã đăng xuất khỏi thiết bị'); }));
      root.querySelector('#logout-all')?.addEventListener('click', () => O.confirm({ title: 'Đăng xuất khỏi các thiết bị khác?', what: '2 phiên đăng nhập khác sẽ kết thúc ngay. Phiên hiện tại vẫn giữ.', notify: 'Email của bạn.', undo: 'Không hoàn tác được. Đăng nhập lại trên thiết bị đó nếu cần.', confirmText: 'Đăng xuất', icon: 'log-out', onConfirm: () => { root.querySelectorAll('[data-logout]').forEach((b) => b.closest('.li').remove()); O.toast('Đã đăng xuất 2 thiết bị khác'); } }));
    },
  });

  /* =================== S04 Thông báo =================== */
  O.screen('s04', {
    title: 'Thông báo', code: 'S04', crumbs: [], device: 'Cả hai',
    variants: [['page', 'Trang đầy đủ'], ['dropdown', 'Menu từ chuông'], ['empty', 'Không có thông báo'], ['loading', 'Đang tải']],
    render({ variant: v }) {
      const group = (items) => { const days = [...new Set(items.map((n) => n.day))]; return days.map((d) => `<div class="noti-day">${d}</div>${items.filter((n) => n.day === d).map(notiItem).join('')}`).join(''); };
      const emptyAll = O.empty({ icon: 'bell-off', title: 'Bạn chưa có thông báo nào', text: 'Khi hồ sơ đổi trạng thái, có yêu cầu bổ sung hoặc được phân công, thông báo sẽ xuất hiện ở đây.', action: O.btn('Về Trang chủ', { kind: 'soft', icon: 'house', go: homeOf(O.state.role) }) });
      const emptyUnread = O.empty({ icon: 'check-check', title: 'Bạn đã đọc hết thông báo', text: 'Không còn thông báo chưa đọc.' });
      const list = (items, emp) => (v === 'loading' ? `<div style="padding:16px">${O.skeleton(6)}</div>` : v === 'empty' || !items.length ? emp : `<div id="noti-list">${group(items)}</div>`);
      const unread = NOTI.filter((n) => n.unread);
      const types = [['bosung', 'Yêu cầu bổ sung hồ sơ', true], ['trangthai', 'Thay đổi trạng thái hồ sơ', true], ['ttv', 'Báo cáo Tổ tư vấn mới', true], ['phancong', 'Phân công chấm, thẩm định', true], ['han', 'Nhắc hạn của đợt', true], ['baotri', 'Bảo trì hệ thống', false]];
      return `${O.pageHead({ title: 'Thông báo', sub: 'Bấm vào thông báo để mở đúng màn hình liên quan.', actions: v === 'page' || v === 'dropdown' ? O.btn('Đánh dấu đã đọc tất cả', { icon: 'check-check', id: 'markall' }) : '' })}
        <div class="grid g-main">
          <section class="card flush"><div style="padding:14px 16px 0">${O.tabs([['all', 'Tất cả', v === 'empty' ? 0 : NOTI.length], ['unread', 'Chưa đọc', v === 'empty' ? 0 : unread.length]], { all: list(NOTI, emptyAll), unread: list(unread, emptyUnread) }, { style: 'line' })}</div></section>
          <div class="stack">
            ${O.card(`<div class="list">${types.map(([k, l, on]) => `<label class="li" style="cursor:pointer"><span class="grow">${l}</span><span class="switch"><input type="checkbox" ${on ? 'checked' : ''} aria-label="${l}" data-toast="Đã lưu cài đặt nhận email"><span></span></span></label>`).join('')}</div>`, { title: 'Nhận thông báo qua email', sub: 'Thông báo trong ứng dụng luôn bật' })}
            ${O.banner({ tone: 'gray', icon: 'eye-off', text: 'Thông báo không chứa điểm chi tiết. Mở hồ sơ để xem kết quả trong phạm vi quyền của bạn.' })}
          </div>
        </div>`;
    },
    mount(root, { variant: v }) {
      root.querySelector('#markall')?.addEventListener('click', () => { root.querySelectorAll('.noti.unread').forEach((n) => n.classList.remove('unread')); O.toast('Đã đánh dấu đọc tất cả'); });
      if (v === 'dropdown') setTimeout(() => { const b = [...document.querySelectorAll('[data-act=bell]')].find((x) => x.offsetParent); if (b) O.openBell(b); }, 50);
    },
  });

  /* =================== S90 Tìm kiếm toàn cục =================== */
  O.screen('s90', {
    title: 'Kết quả tìm kiếm', code: 'S90', crumbs: [], device: 'Máy tính',
    variants: [['results', 'Kết quả'], ['palette', 'Bảng lệnh khi gõ'], ['none', 'Không có kết quả'], ['loading', 'Đang tải']],
    render({ variant: v, role }) {
      const q = v === 'none' ? 'nuoc mam ca ro' : 'mam';
      const scope = role === 'xa' || role === 'chuthe' ? 'Xã An Phú' : role === 'thanhvien' || role === 'ttv' ? 'hồ sơ được phân công' : 'toàn tỉnh';
      const fg = (title, body) => `<div class="filter-group"><span class="label">${title}</span>${body}</div>`;
      const filters = O.card(`<div class="stack" style="gap:0">
          ${fg('Đợt', `<select class="select" id="ft-dot"><option>Đợt đánh giá 2026</option><option>Đợt đánh giá 2025</option><option>Tất cả các đợt</option></select>`)}
          ${fg('Xã/phường', D.xa.map((x, i) => `<label class="check"><input type="checkbox" ${v === 'none' && i === 0 ? 'checked' : ''}> ${x}</label>`).join(''))}
          ${fg('Nhóm sản phẩm', D.nhom.slice(0, 5).map((x) => `<label class="check"><input type="checkbox"> ${x}</label>`).join('') + '<button class="link-btn small" type="button">Xem thêm 1 nhóm</button>')}
          ${fg('Trạng thái', `<div class="fchips">${['Đang thẩm định', 'Hội đồng đang xem xét', 'Đã chốt điểm', 'Cần bổ sung'].map((s, i) => `<button type="button" class="fchip ${v === 'none' && i === 2 ? 'on' : ''}" onclick="this.classList.toggle('on')">${s}</button>`).join('')}</div>`)}
          ${fg('Hạng', [5, 4, 3].map((n) => `<label class="check"><input type="checkbox"> ${O.stars(n)} <span class="small muted">${n} sao</span></label>`).join(''))}
        </div>`, { title: `${ic('sliders-horizontal')} Bộ lọc`, actions: O.btn('Xóa', { size: 'sm', kind: 'ghost', attrs: 'data-toast="Đã xóa bộ lọc"' }), foot: O.btn('Lưu bộ lọc này', { kind: 'soft', icon: 'bookmark-plus', attrs: 'data-toast="Đã lưu bộ lọc &quot;Hồ sơ đã chốt Xã An Phú&quot;" style="width:100%"' }), cls: 'tight' });
      const resultsBox = `<div id="sr-results"></div>`;
      return `${O.pageHead({ title: 'Tìm kiếm', sub: `Kết quả trong phạm vi quyền của bạn: ${scope}. Tìm không phân biệt dấu tiếng Việt.` })}
        <div class="card tight"><div class="row"><div class="input-icon" style="flex:1;min-width:220px">${ic('search')}<input class="input" id="sr-q" value="${q}" aria-label="Từ khóa" style="font-size:16px"></div><span class="hide-m small muted">Mở nhanh ở mọi trang: <kbd>Ctrl</kbd> <kbd>K</kbd></span></div>
        <div class="row s8" style="margin-top:12px"><span class="small muted">Bộ lọc đã lưu:</span><button type="button" class="tag" data-toast="Đã áp dụng bộ lọc">${ic('bookmark')} Hồ sơ 4 sao Xã An Phú</button><button type="button" class="tag" data-toast="Đã áp dụng bộ lọc">${ic('bookmark')} Chờ tiếp nhận quá 7 ngày</button></div></div>
        <div class="grid g-side">${filters}<div class="stack">${v === 'loading' ? O.card(O.skeleton(6)) : resultsBox}</div></div>`;
    },
    mount(root, { variant: v, role }) {
      const box = root.querySelector('#sr-results'); const inp = root.querySelector('#sr-q');
      const tgt = targetFor(role);
      const paint = () => {
        if (!box) return;
        const q = inp.value; let hs = matchHs(q);
        if (v === 'none') hs = [];
        if (!hs.length) {
          box.innerHTML = O.card(O.empty({ icon: 'search-x', title: `Không tìm thấy kết quả cho “${esc(q)}”`, text: 'Thử gõ không dấu hoặc ngắn hơn (ví dụ "mam ca"), tìm theo mã hồ sơ, hoặc bớt bộ lọc đang áp dụng.', action: `<div class="row s8" style="justify-content:center"><span class="chip t-gray plain">Xã An Phú ${ic('x')}</span><span class="chip t-gray plain">Đã chốt điểm ${ic('x')}</span></div>${O.btn('Xóa tất cả bộ lọc', { kind: 'soft', icon: 'filter-x', attrs: 'data-toast="Đã xóa bộ lọc"' })}` }));
          O.bind(box); return;
        }
        const cts = [...new Set(hs.map((h) => h.ct))];
        box.innerHTML = `<div class="row"><b>Tìm thấy ${hs.length} hồ sơ và ${cts.length} chủ thể</b><span class="small muted">cho “${esc(q)}”</span></div>
          ${O.card(O.table({ cols: [{ k: 'sp', l: 'Sản phẩm', sort: true }, { k: 'ct', l: 'Chủ thể' }, { k: 'xa', l: 'Xã/phường' }, { k: 'st', l: 'Trạng thái' }, { k: 'd', l: 'Điểm', cls: 'r' }], rows: hs, pager: false,
            cell: (h, c) => c.k === 'sp' ? `<div class="prod"><span class="avatar sm" style="--av:var(--brand-soft);color:var(--brand)">${ic(O.nhomIcon(h.nhom))}</span><div><b>${hl(h.sp, q)}</b><small>${hl(h.ma, q)} · ${esc(h.nhom)}</small></div></div>` : c.k === 'ct' ? hl(h.ct, q) : c.k === 'st' ? O.chip(h.st) : c.k === 'd' ? (h.diem != null && role !== 'chuthe' ? `<b class="num">${h.diem}</b>` : '<span class="faint">—</span>') : esc(h[c.k]),
            rowAttrs: (h) => `class="clickable" data-go="${tgt}" data-params='${JSON.stringify({ id: h.ma })}'`,
            card: (h) => `<div class="mcard" data-go="${tgt}" data-params='${JSON.stringify({ id: h.ma })}'><div class="row between"><b>${hl(h.sp, q)}</b>${O.chip(h.st)}</div><span class="small muted">${hl(h.ma, q)} · ${hl(h.ct, q)} · ${esc(h.xa)}</span></div>` }), { title: 'Hồ sơ', cls: 'flush', actions: '' }).replace('<div class="card-head">', '<div class="card-head" style="padding:18px 20px 0">')}
          ${O.card(`<div class="list">${cts.map((c) => { const h = hs.find((x) => x.ct === c); const n = D.hoso.filter((x) => x.ct === c).length; return `<div class="li">${O.avatar(c)}<div class="grow"><b style="font-weight:600">${hl(c, q)}</b><div class="small muted">${esc(h.xa)} · ${n} hồ sơ</div></div>${O.btn('Xem hồ sơ', { size: 'sm', kind: 'ghost', icon: 'arrow-right' })}</div>`; }).join('')}</div>`, { title: 'Chủ thể' })}`;
        O.bind(box);
      };
      inp?.addEventListener('input', paint); paint();
      if (v === 'palette') setTimeout(() => { O.openSearch(); const i = document.getElementById('cmdk-in'); if (i) { i.value = 'mam ca'; i.dispatchEvent(new Event('input')); } }, 60);
    },
  });

  /* =================== S91 Xem trước tệp =================== */
  O.screen('s91', {
    title: 'Xem trước tệp', code: 'S91', crumbs: [['Hồ sơ HS-2026-0123', 's33']], device: 'Cả hai',
    variants: [['drawer', 'Ngăn trượt'], ['full', 'Toàn màn hình'], ['unsupported', 'Không xem trước được'], ['scan', 'Đang quét, xử lý'], ['noperm', 'Không đủ quyền']],
    render({ variant: v }) {
      const intro = O.pageHead({ title: 'Minh chứng: Mắm cá linh khô', chips: `${O.chip('hdxemxet')}<span class="tag">HS-2026-0123</span>`, sub: 'Bấm biểu tượng con mắt để xem tệp ngay, không cần tải về. Ngăn xem trước hiển thị tệp gắn với tiêu chí nào.' });
      if (v === 'full') {
        return `${intro}<section class="card flush" id="pv-inline"><div class="drawer-head"><div style="flex:1;min-width:0"><h2 data-pv-title></h2><div class="small muted" data-pv-sub></div></div>${O.btn('Thu về ngăn trượt', { size: 'sm', icon: 'minimize-2', attrs: 'data-variant-go="drawer"' })}</div><div class="drawer-body" data-pv-body style="padding:16px 20px"></div><div class="drawer-foot"><div data-pv-foot class="row s8" style="width:100%"></div></div></section>`;
      }
      return `${intro}${O.card(`<div class="stack s8">${D.files.map((f) => O.file(f)).join('')}</div>`, { title: 'Tệp minh chứng (6)', sub: 'Theo tiêu chí trong bộ tiêu chí 2026', actions: O.btn('Mở lại bản xem trước', { size: 'sm', kind: 'soft', icon: 'eye', id: 'reopen' }) })}`;
    },
    mount(root, { variant: v }) {
      const nameFor = { unsupported: 'Ke-hoach-kinh-doanh-2026.docx', scan: 'Phieu-kiem-nghiem-KN0915.pdf', noperm: 'Hop-dong-thu-mua-ca-linh.pdf' };
      if (v === 'full') { const host = root.querySelector('#pv-inline'); pvPaint(host, pvState('Hop-dong-thu-mua-ca-linh.pdf')); host.querySelector('[data-variant-go]').addEventListener('click', () => O.setVariant('drawer')); return; }
      const open = () => O.previewFile(nameFor[v] || 'Hop-dong-thu-mua-ca-linh.pdf', v === 'drawer' ? '' : v);
      root.querySelector('#reopen')?.addEventListener('click', open);
      setTimeout(open, 40);
    },
  });

  /* =================== S92 Trang lỗi và bảo trì =================== */
  O.screen('s92', {
    title: 'Trang lỗi và bảo trì', code: 'S92', layout: 'bare', device: 'Cả hai',
    variants: [['404', 'Không tìm thấy (404)'], ['403', 'Không có quyền (403)'], ['500', 'Lỗi hệ thống (500)'], ['baotri', 'Bảo trì']],
    render({ variant: v }) {
      const home = O.btn('Về Trang chủ', { kind: 'primary', icon: 'house', size: 'lg', go: homeOf(O.state.role) });
      const C = {
        '404': ['404', 'map-pinned', 'Không tìm thấy trang', 'Đường dẫn có thể đã thay đổi, hồ sơ đã bị rút hoặc bạn gõ nhầm địa chỉ.', `${home}${O.btn('Tìm hồ sơ', { icon: 'search', size: 'lg', attrs: 'data-search' })}`, ''],
        '403': ['403', 'shield-x', 'Bạn không có quyền truy cập trang này', 'Trang thuộc phạm vi của vai trò khác hoặc hồ sơ chưa được phân công cho bạn.', `${home}${O.btn('Gửi yêu cầu cấp quyền', { icon: 'send', size: 'lg', attrs: 'data-toast="Đã gửi yêu cầu tới quản trị hệ thống"' })}`,
          `<div class="conseq" style="text-align:left"><b>Cách xin quyền</b><div>${ic('repeat')}<span>Kiểm tra vai trò đang dùng ở đầu trang, bạn có thể cần chuyển vai trò.</span></div><div>${ic('user-cog')}<span>Nhờ thư ký hội đồng phân công hồ sơ, hoặc quản trị hệ thống cấp thêm vai trò.</span></div></div>`],
        '500': ['500', 'server-crash', 'Hệ thống gặp sự cố', 'Thao tác của bạn chưa được thực hiện. Dữ liệu đã lưu trước đó không bị ảnh hưởng. Thử lại sau ít phút.', `${O.btn('Thử lại', { kind: 'primary', icon: 'rotate-cw', size: 'lg', attrs: 'data-toast="Đang thử lại…"' })}${O.btn('Về Trang chủ', { icon: 'house', size: 'lg', go: homeOf(O.state.role) })}`,
          `<div class="conseq" style="text-align:left"><div>${ic('hash')}<span>Mã sự cố: <b class="code" style="user-select:all">INC-20261019-4F7A</b> ${O.btn('Sao chép', { size: 'sm', kind: 'ghost', icon: 'copy', attrs: 'data-copy="INC-20261019-4F7A"' })}</span></div><div>${ic('headset')}<span>Gửi mã này cho bộ phận hỗ trợ: 0292 3 820 456</span></div></div>`],
        baotri: ['', 'wrench', 'Hệ thống đang bảo trì', 'Sở NN&MT đang nâng cấp hệ thống để phục vụ đợt đánh giá 2026. Dữ liệu và bản nháp của bạn được giữ nguyên.', `${O.btn('Tải lại trang', { kind: 'primary', icon: 'rotate-cw', size: 'lg', attrs: 'data-toast="Hệ thống vẫn đang bảo trì"' })}`,
          `<div class="conseq" style="text-align:left"><div>${ic('calendar-clock')}<span>Thời gian dự kiến: <b>22:00 đến 23:30, ngày 25/10/2026</b></span></div><div>${ic('timer')}<span>Còn khoảng <b id="mt-cd">00:42:10</b></span></div>${O.progress(54, 100)}</div>`],
      }[v];
      return `<div class="err-wrap"><div class="stack" style="gap:18px">${C[0] ? `<div class="err-code">${C[0]}</div>` : `<div>${brand}</div>`}<h1 style="font-size:28px">${C[2]}</h1><p class="muted" style="font-size:16px">${C[3]}</p>${C[5]}<div class="row">${C[4]}</div></div><div class="err-art">${ic(C[1])}</div></div>`;
    },
    mount(root, { variant: v }) {
      root.querySelector('[data-search]')?.addEventListener('click', () => O.openSearch());
      root.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', () => { (navigator.clipboard?.writeText(b.dataset.copy) || Promise.reject()).then(() => O.toast('Đã sao chép mã sự cố'), () => O.toast('Hãy chọn và sao chép mã thủ công', true)); }));
      if (v === 'baotri') countdown(root.querySelector('#mt-cd'), 42 * 60 + 10, (s) => '00:' + mmss(s));
    },
  });

  /* =================== S80 Trang xác thực mã QR (công khai) =================== */
  O.screen('s80', {
    title: 'Xác thực mã QR', code: 'S80', layout: 'bare', device: 'Di động',
    variants: [['ok', 'Hợp lệ'], ['expired', 'Hết hiệu lực'], ['invalid', 'Không xác thực được']],
    render({ variant: v }) {
      const head = `<header class="qr-head"><span class="logo-mark">${ic('sprout')}</span><div style="flex:1;min-width:0"><b style="font-size:16px;display:block">Xác thực sản phẩm OCOP</b><span class="small muted">${D.so}</span></div></header>`;
      const foot = `<p class="tiny muted" style="text-align:center">Trang công khai, không hiển thị điểm chi tiết hay thông tin cá nhân. Đã quét lúc 11:47, 19/10/2026.</p>`;
      if (v === 'invalid') {
        return `<div class="qr-page">${head}<section class="card" style="text-align:center;align-items:center;display:flex;flex-direction:column;gap:14px"><div class="big-ok" style="--t:var(--c-red)">${ic('circle-x')}</div><h1>Không xác thực được</h1><p class="muted">Mã không hợp lệ hoặc không có trong hệ thống. Sản phẩm có thể dùng nhãn OCOP không đúng quy định.</p><div class="conseq" style="text-align:left;width:100%"><div>${ic('phone')}<span>Liên hệ Sở NN&MT: <b style="user-select:all">0292 3 820 456</b></span></div><div>${ic('mail')}<span><b style="user-select:all">ocop@sonnmt.tinhmau.gov.vn</b></span></div><div>${ic('map-pin')}<span>Số 12 Đường Hòa Bình, Phường Tân Hòa, ${D.tinh}</span></div></div>${O.btn('Quét lại mã', { kind: 'soft', icon: 'scan-line', attrs: 'data-toast="Mở camera của điện thoại để quét lại" style="width:100%"' })}</section>${foot}</div>`;
      }
      const exp = v === 'expired';
      const P = exp ? { sp: 'Bánh pía sầu riêng', ct: 'Cơ sở Bánh Tân Huê', xa: 'Phường Tân Hòa', so: 'OCOP-TM-2023-0118', cap: '15/03/2023', hl: '15/03/2026', sao: 3 } : { sp: 'Mắm cá linh khô', ct: 'Cơ sở Mắm Bà Sáu', xa: 'Xã An Phú', so: 'OCOP-TM-2026-0042', cap: '12/10/2026', hl: '12/10/2029', sao: 4 };
      return `<div class="qr-page">${head}
        <section class="card" style="display:flex;flex-direction:column;gap:16px">
          <div class="row nowrap" style="gap:16px"><div class="big-ok" style="--t:var(--c-${exp ? 'orange' : 'green'});width:72px;height:72px;flex:none">${ic(exp ? 'triangle-alert' : 'badge-check')}</div><div><h1 style="font-size:22px">${exp ? 'Giấy chứng nhận đã hết hiệu lực' : 'Giấy chứng nhận hợp lệ'}</h1><p class="small muted">${exp ? `Hết hiệu lực từ ngày ${P.hl}. Sản phẩm chưa được đánh giá lại.` : `Còn hiệu lực đến ${P.hl}`}</p></div></div>
          <div class="prod-photo">${ic(exp ? 'cookie' : 'fish')}</div>
          <div class="stack s8"><div class="row between"><h2>${P.sp}</h2>${O.stars(P.sao, 5, 'lg')}</div><span class="tag" style="align-self:flex-start">Sản phẩm OCOP ${P.sao} sao · Nhóm Thực phẩm</span></div>
          <dl class="dl"><dt>Chủ thể</dt><dd>${P.ct}</dd><dt>Xã/phường</dt><dd>${P.xa}, ${D.tinh}</dd><dt>Số hiệu</dt><dd class="code" style="font-size:14px">${P.so}</dd><dt>Ngày cấp</dt><dd>${P.cap}</dd><dt>Hiệu lực</dt><dd>${exp ? `<span class="chip t-orange">${ic('clock')}Hết hạn ${P.hl}</span>` : `<span class="chip t-green">${ic('check')}Đến ${P.hl}</span>`}</dd><dt>Cơ quan cấp</dt><dd>UBND ${D.tinh}</dd></dl>
          ${exp ? O.banner({ tone: 'orange', icon: 'info', text: 'Nếu sản phẩm vẫn ghi nhãn OCOP, bạn có thể liên hệ Sở NN&MT: 0292 3 820 456.' }) : ''}
        </section>${foot}</div>`;
    },
  });
})();
