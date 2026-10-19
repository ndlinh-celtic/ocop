/* Màn hình nhóm UBND xã/phường (S20–S25) và Sở NN&MT (S30–S35). */
(function () {
  const O = window.OCOP, D = O.data, ic = O.icon, esc = O.esc, fmt = O.fmt;

  document.head.insertAdjacentHTML('beforeend', `<style>
  .stepper .st .stx { display:flex; flex-direction:column; }
  .round-card { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:18px; align-items:center; }
  .countdown { display:flex; flex-direction:column; align-items:center; justify-content:center; width:112px; height:112px; border-radius:28px; background:var(--brand-soft); color:var(--brand-deep); flex:none; }
  .countdown b { font-size:40px; line-height:1; font-weight:750; font-variant-numeric:tabular-nums; }
  .countdown span { font-size:12.5px; }
  .hero .countdown { background:rgba(255,255,255,.16); color:#fff; border:1px solid rgba(255,255,255,.3); }
  .milestones { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; }
  .milestones > div { padding:10px 12px; border-radius:14px; background:rgba(255,255,255,.12); border:1px solid rgba(255,255,255,.22); font-size:13px; }
  .milestones b { display:block; font-size:15px; color:#fff; }
  .milestones .now { background:rgba(255,255,255,.95); color:var(--hero-a); }
  .milestones .now b { color:#0F2A1B; }
  .actbar { display:flex; gap:10px; align-items:center; flex-wrap:wrap; padding:12px 16px; border-radius:20px; background:var(--surface); border:1px solid var(--line); position:sticky; bottom:0; z-index:4; box-shadow:var(--shadow-2); }
  .doccheck { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:12px; align-items:center; padding:12px 0; border-bottom:1px solid var(--line); }
  .doccheck:last-child { border-bottom:0; }
  .xcheck { border:1px solid var(--line); border-radius:18px; padding:18px; display:flex; flex-direction:column; gap:12px; background:var(--surface); }
  .xcheck .xh { display:flex; gap:12px; align-items:flex-start; flex-wrap:wrap; }
  .xcheck .xn { width:32px; height:32px; border-radius:10px; display:grid; place-items:center; background:var(--brand-soft); color:var(--brand-deep); font-weight:700; flex:none; }
  .conclude { border-radius:18px; padding:18px; border:1.5px solid var(--line-strong); background:var(--surface-2); display:flex; flex-direction:column; gap:12px; }
  .conclude.ok { border-color:color-mix(in srgb,var(--c-green) 50%,transparent); background:color-mix(in srgb,var(--c-green) 8%,var(--surface)); }
  .conclude.bad { border-color:color-mix(in srgb,var(--c-red) 45%,transparent); background:color-mix(in srgb,var(--c-red) 7%,var(--surface)); }
  .req-item { border:1px solid var(--line); border-radius:16px; padding:14px; display:flex; flex-direction:column; gap:10px; background:var(--surface-2); }
  .notif-preview { border:1px dashed var(--line-strong); border-radius:16px; padding:14px; display:flex; gap:12px; background:var(--surface); }
  .pkg li { display:flex; gap:10px; align-items:flex-start; padding:7px 0; list-style:none; font-size:14px; }
  .pkg { margin:0; padding:0; }
  .pkg .ok { color:var(--c-green); } .pkg .miss { color:var(--c-orange); }
  .filterbar { position:sticky; top:0; z-index:5; background:color-mix(in srgb,var(--bg) 92%,transparent); backdrop-filter:blur(8px); padding:10px 0; display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
  .filterbar .select { width:auto; min-width:150px; flex:1; max-width:230px; }
  .round-li { display:flex; gap:12px; align-items:center; padding:14px; border-radius:16px; border:1px solid var(--line); cursor:pointer; background:var(--surface); }
  .round-li.on { border-color:var(--brand); background:var(--brand-soft); }
  .stack-bars { display:flex; flex-direction:column; gap:12px; }
  .abc { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px; }
  .abc .col { display:flex; flex-direction:column; gap:6px; }
  .abc .dist { display:flex; gap:4px; align-items:flex-end; height:110px; }
  .abc .dist i { flex:1; border-radius:6px 6px 3px 3px; background:color-mix(in srgb,var(--t) 70%,var(--surface)); }
  @container main (max-width:760px) { .milestones { grid-template-columns:repeat(2,minmax(0,1fr)); } .round-card { grid-template-columns:minmax(0,1fr); } }
  @container main (max-width:520px) { .abc { grid-template-columns:minmax(0,1fr); } .filterbar .select { max-width:none; min-width:0; flex:1 1 140px; } }
  </style>`);

  const xaHs = () => D.hoso.filter((h) => ['Xã An Phú'].includes(h.xa) || ['danop', 'bosung', 'nhap'].includes(h.st));
  const canboXa = ['Ngô Bảo Ngọc', 'Trương Văn Lực', 'Đinh Thị Nga'];
  const xaStatus = { danop: 'Chờ tiếp nhận', bosung: 'Cần bổ sung', chuyentinh: 'Đã gửi tỉnh' };
  const goRow = (h, scr) => `class="clickable" data-go="${scr}" data-params='${JSON.stringify({ ma: h.ma })}'`;
  const hanCell = (h, urgent) => `<span class="row s8 nowrap ${urgent ? 'cell-bad' : ''}">${ic(urgent ? 'alarm-clock' : 'calendar')}${h.han}</span>`;

  /* ================= S24: Tạo yêu cầu bổ sung (dùng chung, cả chế độ Trả về xã) ================= */
  const critOpts = () => `<option value="">Chọn tiêu chí hoặc giấy tờ</option><optgroup label="Giấy tờ pháp lý"><option>Giấy phép kinh doanh</option><option>Giấy chứng nhận VSATTP</option><option>Công bố chất lượng</option></optgroup>${D.parts.map((p) => `<optgroup label="${esc(p.name)}">${D.tieuchi.filter((t) => t.part === p.id).map((t) => `<option>${t.code}: ${esc(t.name)}</option>`).join('')}</optgroup>`).join('')}`;
  let reqSeq = 0;
  const reqItem = (content = '', link = '') => { const n = ++reqSeq; return `<div class="req-item" data-req><div class="row between"><b class="small">Mục yêu cầu</b><button type="button" class="icon-btn" style="width:34px;height:34px" data-rm aria-label="Xóa mục">${ic('trash-2')}</button></div><div class="field"><label for="rq-c-${n}">Nội dung cần bổ sung<span class="req">*</span></label><textarea class="textarea" id="rq-c-${n}" style="min-height:70px" data-rqtext>${esc(content)}</textarea></div><div class="form-grid"><div class="field"><label for="rq-l-${n}">Liên kết tới</label><select class="select" id="rq-l-${n}">${critOpts().replace(`<option>${link}</option>`, `<option selected>${link}</option>`)}</select></div><div class="field"><label for="rq-n-${n}">Ghi chú</label><input class="input" id="rq-n-${n}" placeholder="Không bắt buộc"></div></div></div>`; };

  function s24Form(mode, h, prefill = true) {
    const tra = mode === 'tra';
    return `${tra ? O.banner({ tone: 'orange', icon: 'undo-2', title: 'Trả về xã', text: 'Hồ sơ trả về theo đề nghị của Tổ tư vấn. Xã nhận được nhận xét và chuyển yêu cầu bổ sung cho chủ thể.' }) : ''}
      <div class="row s8">${O.chip(h.st)}<span class="small muted">${esc(h.ma)} · ${esc(h.sp)} · ${esc(h.ct)}</span></div>
      ${tra ? `<div class="form-grid"><div class="field"><label for="rq-xa">Xã nhận hồ sơ<span class="req">*</span></label><select class="select" id="rq-xa">${D.xa.map((x) => `<option ${x === h.xa ? 'selected' : ''}>${x}</option>`).join('')}</select></div><div class="field"><label for="rq-from">Theo đề nghị của</label><input class="input" id="rq-from" value="Tổ tư vấn: ${esc(h.ttv || 'Hoàng Thị E')}" readonly></div><div class="field full"><label for="rq-cm">Nhận xét gửi xã<span class="req">*</span></label><textarea class="textarea" id="rq-cm">Minh chứng tiêu chí A2 và C2 không khớp với thông tin trong hồ sơ, đề nghị xã kiểm tra lại với chủ thể.</textarea></div></div>` : ''}
      <div class="stack s12" data-reqlist>${prefill ? reqItem('Bổ sung hợp đồng thu mua cá linh với các hộ đánh bắt (bản có chữ ký hai bên).', 'A2: Nguồn gốc nguyên liệu') + reqItem('Phiếu kiểm nghiệm còn hiệu lực trong 6 tháng gần nhất.', 'C2: Chỉ tiêu an toàn thực phẩm') : ''}</div>
      <div data-noreq ${prefill ? 'hidden' : ''}>${O.banner({ tone: 'gray', icon: 'list-plus', text: 'Chưa có mục yêu cầu nào. Thêm ít nhất một mục để gửi.' })}</div>
      ${O.btn('Thêm mục yêu cầu', { kind: 'soft', icon: 'plus', size: 'sm', attrs: 'data-addreq' })}
      <div class="form-grid"><div class="field"><label for="rq-due">Hạn bổ sung<span class="req">*</span></label><input class="input" type="date" id="rq-due" value="2026-10-30"><span class="hint">Chủ thể thấy đếm ngược tới hạn này</span></div></div>
      <div class="stack s8"><span class="label">Xem trước thông báo chủ thể nhận</span><div class="notif-preview"><span class="nic" style="width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:color-mix(in srgb,var(--c-orange) 14%,var(--surface));color:var(--c-orange);flex:none">${ic('file-warning')}</span><div class="small"><b>Hồ sơ ${esc(h.sp)} cần bổ sung minh chứng, hạn 30/10/2026</b><div class="muted"><span data-reqcount>2</span> mục cần bổ sung · ${tra ? 'Trả về từ Sở NN&MT' : 'UBND ' + esc(h.xa)}</div></div></div></div>`;
  }
  function bindS24(root, mode, h, onDone) {
    const list = root.querySelector('[data-reqlist]');
    const upd = () => { const n = list.querySelectorAll('[data-req]').length; root.querySelector('[data-noreq]').hidden = n > 0; root.querySelector('[data-reqcount]').textContent = n; const s = root.querySelector('[data-sendreq]'); if (s) s.disabled = n === 0; };
    root.querySelector('[data-addreq]').addEventListener('click', () => { list.insertAdjacentHTML('beforeend', reqItem()); upd(); list.lastElementChild.querySelector('textarea').focus(); });
    list.addEventListener('click', (e) => { const b = e.target.closest('[data-rm]'); if (b) { b.closest('[data-req]').remove(); upd(); } });
    root.querySelector('[data-sendreq]')?.addEventListener('click', () => { const empty = [...list.querySelectorAll('[data-rqtext]')].filter((t) => !t.value.trim()); if (empty.length) { empty.forEach((t) => t.classList.add('invalid')); O.toast('Nhập nội dung cho mọi mục yêu cầu', true); return; } onDone && onDone(); O.toast(mode === 'tra' ? `Đã trả hồ sơ ${h.ma} về ${h.xa}` : `Đã gửi yêu cầu bổ sung. Hồ sơ chuyển sang "Cần bổ sung"`); });
    upd();
  }
  O.openS24 = (mode = 'xa', ma) => {
    const h = O.hs(ma || 'HS-2026-0123');
    const el = O.drawer({ title: mode === 'tra' ? 'Trả hồ sơ về xã' : 'Tạo yêu cầu bổ sung', sub: `${h.ma} · ${h.sp}`, body: s24Form(mode, h), foot: `${O.btn('Hủy', { kind: 'ghost', attrs: 'data-close' })}${O.btn(mode === 'tra' ? 'Trả về xã' : 'Gửi yêu cầu', { kind: 'primary', icon: 'send', attrs: 'data-sendreq' })}` });
    bindS24(el, mode, h, () => { el.previousElementSibling?.remove(); el.remove(); });
  };

  /* ================= S23: Checklist đánh giá sơ bộ ================= */
  const S23_ITEMS = [
    ['Nguồn gốc nguyên liệu', 'Nguyên liệu chính có nguồn gốc tại địa phương, có hợp đồng hoặc cam kết thu mua.', 'Hop-dong-thu-mua-ca-linh.pdf', 0, 'Cá linh thu mua từ 12 hộ trong xã, đã đối chiếu hợp đồng.'],
    ['Lao động địa phương', 'Sử dụng lao động là người địa phương, có danh sách lao động.', 'Anh-xuong-san-xuat.jpg', 0, 'Danh sách 22 lao động, 18 người cư trú tại xã.'],
    ['Bản sắc văn hóa và trí tuệ bản địa', 'Sản phẩm gắn với câu chuyện, nghề truyền thống hoặc tri thức của địa phương.', 'Ke-hoach-kinh-doanh-2026.docx', -1, ''],
  ];
  function s23Html(locked = false) {
    return `<div class="stack" data-s23>
      ${O.banner({ tone: 'blue', icon: 'info', text: 'Chọn kết quả cho cả ba mục. "Cần xác minh" bắt buộc có nhận xét. Hệ thống đề xuất kết luận khi đủ ba mục.' })}
      ${S23_ITEMS.map(([t, d, f, v, cm], i) => `<div class="xcheck" data-xi="${i}"><div class="xh"><span class="xn">${i + 1}</span><div style="flex:1;min-width:200px"><b>${t}</b><div class="small muted">${d}</div></div>${locked ? O.tag(['Đạt', 'Không đạt', 'Cần xác minh'][Math.max(0, v)], 'green', 'check') : `<div class="seg choice" data-choice>${[['Đạt', 'ok', 'check'], ['Không đạt', 'bad', 'x'], ['Cần xác minh', 'warn', 'circle-help']].map(([l, k, i2], j) => `<button type="button" class="${j === v ? 'on ' + k : ''}" data-k="${k}">${ic(i2)}${l}</button>`).join('')}</div>`}</div>
        <div class="grid g-2" style="gap:12px"><div class="field"><label for="x23-${i}">Nhận xét <span class="faint" data-reqmark></span></label><textarea class="textarea" id="x23-${i}" style="min-height:64px" ${locked ? 'readonly' : ''} placeholder="Ghi nhận khi kiểm tra">${esc(cm)}</textarea><span class="err" data-err hidden>${ic('circle-alert')}Mục "Cần xác minh" cần có nhận xét nêu điều cần xác minh.</span></div><div class="field"><span class="label">Tệp đối chiếu</span><div class="row s8">${O.fileChip(f)}<button type="button" class="link-btn small" data-toast="Mở tab Minh chứng">${ic('folder-search')}Xem minh chứng liên quan</button></div></div></div></div>`).join('')}
      <div class="conclude" data-conclude></div>
    </div>`;
  }
  function bindS23(root) {
    const box = root.querySelector('[data-s23]'); if (!box) return;
    const vals = S23_ITEMS.map((x) => ['ok', 'ok', null][S23_ITEMS.indexOf(x)]);
    box.querySelectorAll('[data-xi]').forEach((it) => {
      const i = +it.dataset.xi; const ta = it.querySelector('textarea');
      const check = () => { const need = vals[i] === 'warn'; it.querySelector('[data-reqmark]').textContent = need ? '(bắt buộc)' : ''; const bad = need && !ta.value.trim(); it.querySelector('[data-err]').hidden = !bad; ta.classList.toggle('invalid', bad); };
      it.querySelectorAll('[data-choice] button').forEach((b) => b.addEventListener('click', () => { it.querySelectorAll('[data-choice] button').forEach((x) => (x.className = x === b ? 'on ' + x.dataset.k : '')); vals[i] = b.dataset.k; check(); concl(); }));
      ta.addEventListener('input', () => { check(); concl(); });
    });
    const cbox = box.querySelector('[data-conclude]');
    let override = false;
    function concl() {
      const missing = vals.filter((v) => !v).length;
      const needCm = [...box.querySelectorAll('[data-xi]')].some((it, i) => vals[i] === 'warn' && !it.querySelector('textarea').value.trim());
      if (missing) { cbox.className = 'conclude'; cbox.innerHTML = `<div class="row s8">${ic('hourglass')}<b>Chưa có kết luận</b></div><span class="small muted">Còn ${missing} mục chưa chọn kết quả.</span>`; return; }
      const ok = vals.every((v) => v === 'ok');
      cbox.className = 'conclude ' + (ok ? 'ok' : 'bad');
      cbox.innerHTML = `<div class="row s8"><span class="small muted">Hệ thống đề xuất</span>${ok ? O.tag('Đủ điều kiện chuyển tỉnh', 'green', 'circle-check') : O.tag('Chưa đủ điều kiện', 'red', 'circle-x')}</div>
        <p class="small">${ok ? 'Cả ba mục đều Đạt. Hồ sơ có thể đưa vào biên bản gửi tỉnh.' : 'Có mục Không đạt hoặc Cần xác minh. Hồ sơ chưa nên chuyển tỉnh.'}</p>
        ${needCm ? O.banner({ tone: 'red', icon: 'circle-alert', text: 'Bổ sung nhận xét cho mục "Cần xác minh" trước khi xác nhận.' }) : ''}
        <label class="check"><input type="checkbox" data-override ${override ? 'checked' : ''}><span>Tôi không đồng ý với đề xuất và đổi kết luận</span></label>
        <div class="field" data-ovr ${override ? '' : 'hidden'}><label for="x23-ly">Lý do đổi kết luận<span class="req">*</span></label><textarea class="textarea" id="x23-ly" style="min-height:64px"></textarea></div>
        <div class="row">${O.btn('Lưu nháp', { kind: 'ghost', icon: 'save', attrs: 'data-toast="Đã lưu nháp đánh giá sơ bộ"' })}${O.btn('Xác nhận kết luận', { kind: 'primary', icon: 'check', attrs: `data-cf ${needCm ? 'disabled' : ''}` })}</div>`;
      cbox.querySelector('[data-override]').addEventListener('change', (e) => { override = e.target.checked; cbox.querySelector('[data-ovr]').hidden = !override; });
      cbox.querySelector('[data-cf]').addEventListener('click', () => { if (override && !cbox.querySelector('#x23-ly').value.trim()) { cbox.querySelector('#x23-ly').classList.add('invalid'); O.toast('Nhập lý do đổi kết luận', true); return; } O.toast('Đã ghi nhận kết luận đánh giá sơ bộ'); });
      O.bind(cbox);
    }
    concl();
  }

  /* ================= Chi tiết hồ sơ dùng chung (S22, S33) ================= */
  const overviewTab = (h) => { const c = D.chuthe.find((x) => x.ten === h.ct) || D.chuthe[0]; return `<div class="grid g-2">${O.card(O.kv([['building', 'Chủ thể', esc(h.ct)], ['tag', 'Loại tổ chức', c.loai], ['user', 'Người đại diện', c.dd], ['phone', 'Số điện thoại', c.sdt], ['hash', 'Mã số thuế', c.mst], ['map-pin', 'Xã/phường', esc(h.xa)]]), { title: 'Thông tin chủ thể' })}${O.card(O.kv([['package', 'Sản phẩm', esc(h.sp)], ['layers', 'Nhóm sản phẩm', esc(h.nhom)], ['calendar', 'Ngày nộp', h.nhan || 'Chưa nộp'], ['calendar-range', 'Đợt', D.dot.ten], ['list-checks', 'Bộ tiêu chí', D.dot.phienBan], ['paperclip', 'Minh chứng', '28 tệp, 16/18 tiêu chí']]), { title: 'Thông tin sản phẩm' })}</div>`; };
  const evidenceTab = () => `<div class="stack">${D.parts.map((p) => O.card(`<div class="stack s12">${D.tieuchi.filter((t) => t.part === p.id).slice(0, 4).map((t) => `<div class="row top" style="padding:6px 0;border-bottom:1px solid var(--line)"><span class="crit-code">${t.code}</span><div style="flex:1;min-width:180px"><b class="small">${esc(t.name)}</b><div class="row s8" style="margin-top:6px">${t.ev ? D.files.slice(0, t.ev).map((f) => O.fileChip(f.name)).join('') : O.tag('Thiếu minh chứng', 'orange', 'file-warning')}</div></div><span class="small faint">Tối đa ${t.max}</span></div>`).join('')}<button class="link-btn small" data-toast="Hiện toàn bộ tiêu chí">Xem tất cả tiêu chí ${p.id}</button></div>`, { title: `${p.name}`, sub: `Tối đa ${p.max} điểm` })).join('')}</div>`;
  const historyTab = (h) => O.card(O.timeline([
    ['send', 'blue', `Chủ thể nộp hồ sơ`, `${h.nhan || '02/04/2026'} 09:40 · Nguyễn Thị Sáu`],
    ['inbox', 'green', 'UBND xã tiếp nhận, phân công Ngô Bảo Ngọc', '03/04/2026 08:15 · Trương Văn Lực'],
    ['file-warning', 'orange', 'Yêu cầu bổ sung 2 mục', '05/04/2026 14:02 · Ngô Bảo Ngọc · Lý do: thiếu hợp đồng thu mua'],
    ['refresh-cw', 'blue', 'Chủ thể nộp lại (phiên bản 2)', '09/04/2026 10:21 · Nguyễn Thị Sáu'],
    ['clipboard-check', 'green', 'Hoàn thành đánh giá sơ bộ: Đủ điều kiện', '15/04/2026 16:30 · Ngô Bảo Ngọc'],
  ]), { title: 'Lịch sử xử lý' });
  const docCheckTab = (locked) => O.card(`<div>${[['Đơn đăng ký tham gia đánh giá', 1], ['Phương án hoặc kế hoạch kinh doanh', 1], ['Giấy phép kinh doanh (bản sao)', 1], ['Giấy chứng nhận đủ điều kiện VSATTP', 1], ['Bản công bố chất lượng sản phẩm', 1], ['Phiếu kiểm nghiệm sản phẩm', 0], ['Ảnh sản phẩm và bao bì', 1]].map(([t, ok], i) => `<div class="doccheck"><div class="row s8">${ic('file-text')}<span>${t}</span>${!ok ? O.tag('Chưa thấy trong hồ sơ', 'orange') : ''}</div>${locked ? O.tag(ok ? 'Đủ' : 'Thiếu', ok ? 'green' : 'red') : O.seg(['Đủ', 'Thiếu'], ok ? 0 : 1)}</div>`).join('')}</div>`, { title: 'Danh mục tài liệu bắt buộc', sub: '6/7 tài liệu đủ' });

  /* ================= S20 ================= */
  O.screen('s20', {
    title: 'Trang chủ UBND xã', navTitle: 'Trang chủ', code: 'S20', roles: ['xa'], device: 'Máy tính', crumbs: [],
    variants: [['default', 'Mặc định'], ['noround', 'Không có đợt mở'], ['unassigned', 'Chưa được phân công'], ['loading', 'Đang tải']],
    render(ctx) {
      const head = O.pageHead({ title: 'Xin chào, Ngô Bảo Ngọc', sub: `UBND Xã An Phú · ${D.dot.ten}`, actions: O.btn('Lập biên bản gửi tỉnh', { kind: 'primary', icon: 'send', go: 's25' }) });
      if (ctx.variant === 'noround') return head + O.card(O.empty({ icon: 'calendar-off', title: 'Chưa có đợt đánh giá nào đang mở', text: 'Sở NN&MT dự kiến mở Đợt đánh giá 2027 vào 01/02/2027. Xã sẽ nhận thông báo khi đợt mở.', action: O.btn('Xem hồ sơ các đợt trước', { kind: 'soft', go: 's21' }) }));
      if (ctx.variant === 'loading') return head + `<div class="grid g-4">${[1, 2, 3, 4].map(() => `<div class="stat"><div class="skel" style="width:50%"></div><div class="skel" style="height:30px;width:40%"></div></div>`).join('')}</div>` + O.card(O.skeleton(5));
      const stats = `<div class="grid g-4">${O.stat({ label: 'Chờ tiếp nhận', value: 4, sub: '2 hồ sơ nộp hôm nay', icon: 'inbox', tone: 'blue', go: 's21' })}${O.stat({ label: 'Đang xử lý', value: 6, sub: 'Kiểm tra và đánh giá sơ bộ', icon: 'loader', tone: 'purple', go: 's21' })}${O.stat({ label: 'Đã gửi tỉnh', value: 9, sub: 'Trong đợt hiện tại', icon: 'send', tone: 'green', go: 's21' })}${O.stat({ label: 'Cần bổ sung', value: 2, sub: '1 hồ sơ quá hạn bổ sung', icon: 'file-warning', tone: 'orange', go: 's21' })}</div>`;
      const round = O.card(`<div class="round-card"><div class="stack s12"><div class="row s8">${O.tag('Đang mở', 'green', 'circle-dot')}<span class="small muted">${D.dot.phienBan}</span></div><h2>${D.dot.ten}</h2><div class="kv"><div>${ic('calendar-clock')}<div><div class="k">Hạn gửi tỉnh</div><div class="v">${D.dot.hanXa}</div></div></div><div>${ic('folder-check')}<div><div class="k">Đủ điều kiện, chưa gửi</div><div class="v">3 hồ sơ</div></div></div></div></div><div class="countdown"><b>${D.dot.conLai}</b><span>ngày còn lại</span></div></div>`, { foot: O.btn('Lập biên bản và gửi tỉnh', { kind: 'soft', icon: 'arrow-right', size: 'sm', go: 's25' }) });
      const rows = D.hoso.filter((h) => ['danop', 'bosung', 'chuyentinh', 'nhap'].includes(h.st)).slice(0, 5);
      const list = ctx.variant === 'unassigned' ? O.empty({ icon: 'user-round-x', title: 'Bạn chưa được phân công hồ sơ nào', text: 'Lãnh đạo xã sẽ phân công hồ sơ trong danh sách hồ sơ tại xã.', action: O.btn('Mở danh sách hồ sơ', { kind: 'soft', go: 's21' }) })
        : `<div class="list">${rows.map((h, i) => `<div class="li clickable" style="flex-wrap:wrap" data-go="s22" data-params='${JSON.stringify({ ma: h.ma })}'>${O.prodCell(h)}<div class="grow hide-m small muted">${esc(h.ct)}</div><div class="hide-m">${h.pt ? O.person(h.pt) : O.tag('Chưa phân công', 'gray')}</div>${O.chip(h.st)}${hanCell(h, i < 2)}</div>`).join('')}</div>`;
      return head + stats + `<div class="grid g-main">${O.card(list, { title: 'Hồ sơ cần xử lý trước hạn', sub: 'Sắp theo hạn xử lý gần nhất', actions: O.btn('Xem tất cả', { kind: 'ghost', size: 'sm', go: 's21' }) })}<div class="stack">${round}${O.card(O.hbars([{ l: 'Thực phẩm', v: 9 }, { l: 'Đồ uống', v: 3 }, { l: 'Thủ công mỹ nghệ', v: 2 }, { l: 'Du lịch cộng đồng', v: 1 }]), { title: 'Hồ sơ theo nhóm sản phẩm' })}</div></div>`;
    },
  });

  /* ================= S21 ================= */
  O.screen('s21', {
    title: 'Danh sách hồ sơ tại xã', navTitle: 'Hồ sơ tại xã', code: 'S21', roles: ['xa'], device: 'Máy tính', crumbs: [['Trang chủ', 's20']],
    variants: [['default', 'Mặc định'], ['empty', 'Danh sách trống'], ['error', 'Lỗi tải']],
    render(ctx) {
      const rows = D.hoso.filter((h) => !['nhap'].includes(h.st)).slice(0, 9).map((h, i) => ({ ...h, xaSt: ['danop', 'danop', 'bosung', 'thamdinh', 'chuyentinh', 'chuyentinh', 'danop', 'bosung', 'chuyentinh'][i] }));
      const head = O.pageHead({ title: 'Hồ sơ tại xã', sub: `UBND Xã An Phú · ${D.dot.ten}`, actions: O.btn('Xuất Excel', { icon: 'file-spreadsheet', attrs: 'data-toast="Đang xuất tệp Excel 24 hồ sơ"' }) + O.btn('Gửi lên tỉnh', { kind: 'primary', icon: 'send', go: 's25' }) });
      const tools = `<div class="stack s12" style="padding:18px 18px 12px">${O.fchips([['Tất cả', 24], ['Chờ tiếp nhận', 4], ['Đang xử lý', 6], ['Cần bổ sung', 2], ['Đã gửi tỉnh', 9]], 0)}<div class="toolbar">${O.search()}<select class="select" style="width:auto" aria-label="Người phụ trách"><option>Mọi người phụ trách</option>${canboXa.map((c) => `<option>${c}</option>`).join('')}</select><select class="select" style="width:auto" aria-label="Nhóm sản phẩm"><option>Mọi nhóm sản phẩm</option>${D.nhom.map((n) => `<option>${n}</option>`).join('')}</select></div>${O.bulkbar(0, `${O.btn('Phân công cho…', { kind: 'primary', icon: 'user-plus', size: 'sm', attrs: 'data-assign' })}${O.btn('Xuất Excel', { size: 'sm', icon: 'download', attrs: 'data-toast="Đang xuất các hồ sơ đã chọn"' })}`)}</div>`;
      if (ctx.variant === 'empty') return head + O.card(O.empty({ icon: 'inbox', title: 'Chưa có hồ sơ nào nộp về xã', text: 'Khi chủ thể nộp hồ sơ, hồ sơ xuất hiện ở đây với trạng thái "Chờ tiếp nhận". Bạn có thể tạo tài khoản hộ cho hộ sản xuất cần hỗ trợ.', action: O.btn('Hướng dẫn chủ thể nộp hồ sơ', { kind: 'soft', icon: 'book-open' }) }), { cls: 'flush' });
      if (ctx.variant === 'error') return head + O.card(O.loadError('danh sách hồ sơ'));
      const st = (k) => k === 'thamdinh' ? O.tag('Đang xử lý', 'purple', 'loader') : O.chip(k);
      const table = O.table({
        select: true, total: 24,
        cols: [{ k: 'sp', l: 'Sản phẩm', sort: true }, { k: 'ct', l: 'Chủ thể' }, { k: 'nhom', l: 'Nhóm' }, { k: 'nhan', l: 'Ngày nhận', sort: true }, { k: 'pt', l: 'Phụ trách' }, { k: 'st', l: 'Trạng thái' }, { k: 'han', l: 'Hạn', sort: true }],
        rows, rowAttrs: (h) => goRow(h, 's22'),
        cell: (h, c, i) => c.k === 'sp' ? O.prodCell(h) : c.k === 'pt' ? (i < 2 ? `<span class="faint small">Chưa phân công</span>` : `<span class="row s8 nowrap">${O.avatar(canboXa[i % 3], 'sm')}${canboXa[i % 3]}</span>`) : c.k === 'st' ? st(h.xaSt) : c.k === 'han' ? hanCell(h, i === 2) : c.k === 'ct' ? `<span class="small">${esc(h.ct)}</span>` : c.k === 'nhom' ? `<span class="tag">${esc(h.nhom.split(',')[0])}</span>` : esc(h[c.k] || ''),
        card: (h, i) => `<div class="mcard" data-go="s22" data-params='${JSON.stringify({ ma: h.ma })}'>${O.prodCell(h)}<div class="row s8">${st(h.xaSt)}<span class="spacer"></span>${hanCell(h, i === 2)}</div><div class="small muted">${esc(h.ct)}</div>${O.btn(h.xaSt === 'danop' ? 'Tiếp nhận' : 'Mở hồ sơ', { kind: 'soft', size: 'sm' })}</div>`,
      });
      return head + `<section class="card flush">${tools}${table}</section>`;
    },
    mount(root) {
      root.querySelector('[data-assign]')?.addEventListener('click', () => {
        const n = root.querySelectorAll('[data-sel]:checked').length;
        const el = O.modal({ title: `Phân công ${n} hồ sơ`, icon: 'user-plus', body: `<div class="stack s8">${canboXa.map((c, i) => `<label class="radio-card"><input type="radio" name="asg" ${i === 0 ? 'checked' : ''}>${O.avatar(c, 'sm')}<span style="flex:1"><b style="font-weight:600">${c}</b><br><span class="tiny muted">Đang phụ trách ${[5, 3, 2][i]} hồ sơ</span></span></label>`).join('')}</div><div class="field"><label for="asg-note">Ghi chú cho cán bộ</label><input class="input" id="asg-note" placeholder="Không bắt buộc"></div>`, foot: `${O.btn('Hủy', { kind: 'ghost', attrs: 'data-close' })}${O.btn('Phân công', { kind: 'primary', attrs: 'data-ok' })}` });
        el.querySelector('[data-ok]').addEventListener('click', () => { el.remove(); O.toast(`Đã phân công ${n} hồ sơ`); });
      });
    },
  });

  /* ================= S22 ================= */
  O.screen('s22', {
    title: 'Chi tiết hồ sơ tại xã', navTitle: 'Chi tiết hồ sơ', code: 'S22', roles: ['xa'], device: 'Máy tính', crumbs: [['Hồ sơ tại xã', 's21']],
    variants: [['default', 'Đang kiểm tra'], ['wrongxa', 'Không thuộc địa bàn'], ['sent', 'Đã chuyển tỉnh (chỉ đọc)']],
    render(ctx) {
      const h = { ...O.hs(ctx.params.ma || 'HS-2026-0123') }; const sent = ctx.variant === 'sent';
      h.st = sent ? 'chuyentinh' : 'danop';
      const tabs = O.tabs([['tq', 'Tổng quan'], ['mc', 'Minh chứng', 28], ['kt', 'Kiểm tra tài liệu'], ['sb', 'Đánh giá sơ bộ'], ['ls', 'Lịch sử']], { tq: overviewTab(h), mc: evidenceTab(), kt: docCheckTab(sent), sb: s23Html(sent), ls: historyTab(h) }, { style: 'line', active: ctx.params.tab || 'tq' });
      return `${sent ? O.lockband('Hồ sơ đã chuyển tỉnh ngày 18/04/2026', 'Chỉ đọc. Sở NN&MT đang xử lý.') : ''}
        ${ctx.variant === 'wrongxa' ? O.banner({ tone: 'orange', icon: 'map-pin-off', title: 'Hồ sơ không thuộc địa bàn Xã An Phú', text: 'Địa điểm sản xuất ghi trong hồ sơ thuộc Xã Bình Thạnh. Chuyển hồ sơ sang xã đúng để tiếp tục xử lý.', actions: O.btn('Chuyển sang xã đúng', { kind: 'primary', size: 'sm', icon: 'arrow-right-left', attrs: 'data-movexa' }) }) : ''}
        ${O.pageHead({ title: esc(h.sp), chips: `${O.chip(h.st)}<span class="code-tag">${h.ma}</span><span class="tag">${esc(h.nhom)}</span>`, sub: `${esc(h.ct)} · ${esc(h.xa)} · Nộp ${h.nhan} · Phụ trách: Ngô Bảo Ngọc` })}
        ${O.card(O.stepper(sent ? 2 : 1, ['02/04/2026', '18/04/2026', '', '', '']), { cls: 'tight' })}
        ${tabs}
        ${sent ? '' : `<div class="actbar"><span class="small muted hide-m">${ic('info')} Bước hiện tại: kiểm tra tài liệu và đánh giá sơ bộ</span><span class="spacer"></span>${O.btn('Loại hồ sơ', { kind: 'danger-ghost', icon: 'circle-x', attrs: 'data-reject' })}${O.btn('Yêu cầu bổ sung', { icon: 'file-warning', attrs: 'data-req24' })}${O.btn('Đề xuất chuyển tỉnh', { kind: 'primary', icon: 'arrow-up-right', attrs: 'data-propose' })}</div>`}`;
    },
    mount(root, ctx) {
      const h = O.hs(ctx.params.ma || 'HS-2026-0123');
      bindS23(root);
      root.querySelector('[data-req24]')?.addEventListener('click', () => O.openS24('xa', h.ma));
      root.querySelector('[data-movexa]')?.addEventListener('click', () => O.confirm({ title: 'Chuyển hồ sơ sang Xã Bình Thạnh?', what: 'Hồ sơ rời khỏi danh sách của Xã An Phú và chuyển cho UBND Xã Bình Thạnh.', notify: 'UBND Xã Bình Thạnh và chủ thể.', undo: 'Không. Xã Bình Thạnh có thể chuyển lại nếu sai.', confirmText: 'Chuyển hồ sơ', onConfirm: () => O.toast('Đã chuyển hồ sơ sang Xã Bình Thạnh') }));
      root.querySelector('[data-reject]')?.addEventListener('click', () => {
        const el = O.confirm({ title: `Loại hồ sơ ${h.sp}?`, kind: 'danger', what: 'Hồ sơ chuyển sang "Không đạt sơ bộ" và dừng xử lý trong đợt này.', notify: `Chủ thể ${h.ct}.`, undo: 'Không. Chủ thể có thể nộp hồ sơ mới ở đợt sau.', confirmText: 'Loại hồ sơ', extra: `<div class="field"><label for="rj-ly">Lý do loại<span class="req">*</span></label><textarea class="textarea" id="rj-ly" placeholder="Lý do sẽ được gửi cho chủ thể"></textarea></div>`, onConfirm: () => O.toast('Đã loại hồ sơ và thông báo cho chủ thể') });
        const ok = el.querySelector('[data-ok]'); const ly = el.querySelector('#rj-ly'); ok.disabled = true; ly.addEventListener('input', () => (ok.disabled = !ly.value.trim()));
      });
      root.querySelector('[data-propose]')?.addEventListener('click', () => O.confirm({ title: 'Đề xuất chuyển tỉnh?', what: 'Hồ sơ được đánh dấu "Đủ điều kiện" và đưa vào danh sách lập biên bản gửi tỉnh.', notify: 'Lãnh đạo xã (người ký biên bản).', undo: 'Có, trước khi biên bản được gửi lên tỉnh.', confirmText: 'Đề xuất', onConfirm: () => { O.toast('Đã đưa hồ sơ vào danh sách gửi tỉnh'); O.go('s25'); } }));
    },
  });

  /* ================= S23 ================= */
  O.screen('s23', {
    title: 'Checklist đánh giá sơ bộ', navTitle: 'Đánh giá sơ bộ', code: 'S23', roles: ['xa'], device: 'Máy tính', crumbs: [['Hồ sơ tại xã', 's21'], ['HS-2026-0123', 's22']],
    variants: [['default', 'Đang đánh giá'], ['locked', 'Đã xác nhận']],
    render(ctx) {
      const h = O.hs('HS-2026-0123');
      return `${O.pageHead({ title: 'Đánh giá sơ bộ', chips: `<span class="code-tag">${h.ma}</span>`, sub: `${esc(h.sp)} · ${esc(h.ct)}. Màn hình này nằm trong tab "Đánh giá sơ bộ" của chi tiết hồ sơ.`, actions: O.btn('Về chi tiết hồ sơ', { kind: 'ghost', icon: 'arrow-left', go: 's22' }) })}
      ${ctx.variant === 'locked' ? O.lockband('Kết luận đã xác nhận ngày 15/04/2026', 'Ngô Bảo Ngọc · Đủ điều kiện chuyển tỉnh') : ''}
      <div class="grid g-main"><div>${s23Html(ctx.variant === 'locked')}</div><div class="stack">${O.card(`<div class="stack s12">${D.files.slice(0, 4).map((f) => O.file(f)).join('')}</div>`, { title: 'Minh chứng liên quan', sub: 'Bấm để xem nhanh' })}${O.card(O.dl([['Chủ thể', esc(h.ct)], ['Nhóm', esc(h.nhom)], ['Địa điểm', 'Ấp 3, Xã An Phú'], ['Lao động', '22 người (18 địa phương)']]), { title: 'Tóm tắt hồ sơ' })}</div></div>`;
    },
    mount(root) { bindS23(root); },
  });

  /* ================= S24 ================= */
  O.screen('s24', {
    title: 'Tạo yêu cầu bổ sung', navTitle: 'Yêu cầu bổ sung', code: 'S24', roles: ['xa', 'so'], device: 'Máy tính', crumbs: [['Hồ sơ tại xã', 's21'], ['HS-2026-0123', 's22']],
    variants: [['xa', 'Xã yêu cầu chủ thể'], ['tra', 'Sở trả về xã'], ['empty', 'Chưa có mục']],
    render(ctx) {
      const h = O.hs('HS-2026-0123'); const mode = ctx.variant === 'tra' ? 'tra' : 'xa';
      return `${O.pageHead({ title: mode === 'tra' ? 'Trả hồ sơ về xã' : 'Tạo yêu cầu bổ sung', sub: 'Trên hệ thống thật, biểu mẫu mở dưới dạng ngăn trượt từ màn chi tiết hồ sơ.', actions: O.btn('Mở dạng ngăn trượt', { kind: 'soft', icon: 'panel-right-open', attrs: 'data-open24' }) })}
      <div class="grid g-main"><section class="card"><div class="stack" data-s24page>${s24Form(mode, h, ctx.variant !== 'empty')}<div class="row" style="justify-content:flex-end">${O.btn('Hủy', { kind: 'ghost', go: 's22' })}${O.btn(mode === 'tra' ? 'Trả về xã' : 'Gửi yêu cầu', { kind: 'primary', icon: 'send', attrs: 'data-sendreq' })}</div></div></section>
      <div class="stack">${O.card(`<div class="stack s12 small"><div class="row s8">${ic('circle-check')}<span>Mỗi mục nêu rõ cần bổ sung gì và gắn với tiêu chí hoặc giấy tờ.</span></div><div class="row s8">${ic('circle-check')}<span>Chủ thể thấy hạn bổ sung và đếm ngược trên điện thoại.</span></div><div class="row s8">${ic('circle-check')}<span>Gửi xong, hồ sơ chuyển sang "Cần bổ sung".</span></div></div>`, { title: 'Lưu ý' })}</div></div>`;
    },
    mount(root, ctx) { const mode = ctx.variant === 'tra' ? 'tra' : 'xa'; bindS24(root.querySelector('[data-s24page]'), mode, O.hs('HS-2026-0123')); root.querySelector('[data-open24]').addEventListener('click', () => O.openS24(mode)); },
  });

  /* ================= S25 ================= */
  O.screen('s25', {
    title: 'Lập biên bản và gửi lên tỉnh', navTitle: 'Gửi lên tỉnh', code: 'S25', roles: ['xa'], device: 'Máy tính', crumbs: [['Trang chủ', 's20']],
    variants: [['default', 'Mặc định'], ['late', 'Quá hạn gửi'], ['unsigned', 'Chưa tải bản đã ký']],
    render(ctx) {
      const el = [['HS-2026-0123', 'Mắm cá linh khô', 'Cơ sở Mắm Bà Sáu', 1], ['HS-2026-0132', 'Khô cá lóc đồng', 'Cơ sở Mắm Bà Sáu', 1], ['HS-2026-0126', 'Gạo thơm An Phú', 'HTX Nông sản Xanh An Phú', 1], ['HS-2026-0140', 'Bánh phồng tôm', 'Hộ Lâm Văn Tư', 0]];
      const late = ctx.variant === 'late'; const signed = ctx.variant !== 'unsigned';
      const left = O.card(`<div class="stack s8" data-elig>${el.map(([ma, sp, ct, on]) => `<label class="radio-card" style="align-items:flex-start"><input type="checkbox" ${on ? 'checked' : ''} data-pick style="margin-top:3px"><span style="flex:1;min-width:0"><b style="font-weight:600">${sp}</b><br><span class="tiny muted">${ma} · ${ct}</span><br>${O.tag('Đạt sơ bộ', 'green', 'check')}</span></label>`).join('')}</div>`, { title: 'Hồ sơ đạt sơ bộ', sub: '4 hồ sơ chưa gửi tỉnh' });
      const doc = `<section class="card" style="background:var(--surface-3)"><div class="card-head"><h2>Xem trước tài liệu</h2><span class="spacer"></span>${O.seg(['Biên bản', 'Văn bản đề xuất'], 0)}</div><div class="doc-page"><div class="doc-hd"><div><b>UBND XÃ AN PHÚ</b><br>Số: 14/BB-UBND</div><div><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><u>Độc lập - Tự do - Hạnh phúc</u><br><i>An Phú, ngày 25 tháng 04 năm 2026</i></div></div><h3>BIÊN BẢN</h3><h4 style="font-weight:400;margin-bottom:12px">Đánh giá sơ bộ sản phẩm OCOP ${D.dot.ten}</h4><p>Hôm nay, tại trụ sở UBND Xã An Phú, Tổ đánh giá sơ bộ của xã đã tiến hành kiểm tra hồ sơ và đánh giá sơ bộ các sản phẩm đăng ký tham gia Chương trình OCOP như sau:</p><table><thead><tr><th>TT</th><th>Mã hồ sơ</th><th>Sản phẩm</th><th>Chủ thể</th><th>Kết luận</th></tr></thead><tbody data-docrows>${el.filter((x) => x[3]).map(([ma, sp, ct], i) => `<tr><td>${i + 1}</td><td>${ma}</td><td>${sp}</td><td>${ct}</td><td>Đủ điều kiện</td></tr>`).join('')}</tbody></table><p>Tổ đánh giá thống nhất đề nghị UBND xã gửi hồ sơ các sản phẩm trên về Sở Nông nghiệp và Môi trường để tổ chức đánh giá, phân hạng cấp tỉnh.</p><div class="doc-hd" style="margin-top:22px"><div><b>THƯ KÝ</b><br><br><br>Ngô Bảo Ngọc</div><div><b>CHỦ TỊCH UBND XÃ</b><br><br><br>Trương Văn Lực</div></div></div></section>`;
      const right = `<div class="stack">${O.card(`<div class="stack s12"><div class="field"><label for="s25-dot">Đợt gửi</label><select class="select" id="s25-dot"><option>${D.dot.ten}</option><option>Đợt đánh giá 2027 (dự kiến)</option></select></div><div class="row">${late ? `<div class="countdown" style="background:color-mix(in srgb,var(--c-red) 12%,var(--surface));color:var(--c-red);width:96px;height:96px"><b style="font-size:24px">Quá</b><span>2 ngày</span></div>` : `<div class="countdown" style="width:96px;height:96px"><b style="font-size:32px">${D.dot.conLai}</b><span>ngày còn lại</span></div>`}<div class="small muted" style="flex:1">Hạn gửi tỉnh<br><b style="color:var(--text)">${D.dot.hanXa}</b></div></div>${late ? O.banner({ tone: 'red', icon: 'alarm-clock-off', text: 'Đợt đã quá hạn gửi. Chuyển hồ sơ sang đợt kế tiếp hoặc liên hệ Sở xin gia hạn.' }) : ''}</div>`, { title: 'Đợt và hạn gửi', cls: 'tight' })}
        ${O.card(`<div class="stack s12">${O.btn('Tải bản nháp Word', { icon: 'file-down', size: 'sm', attrs: 'data-toast="Đang tải bản nháp Word"' })}${O.btn('Tải bản nháp PDF', { icon: 'file-down', size: 'sm', attrs: 'data-toast="Đang tải bản nháp PDF"' })}<span class="label">Bản đã ký số</span>${signed ? O.file({ name: 'Bien-ban-14-BB-UBND-da-ky.pdf', size: '420 KB', type: 'pdf' }, { remove: true }) : O.drop('Tải lên bản đã ký', 'PDF đã ký số ngoài hệ thống', true)}${!signed ? O.banner({ tone: 'orange', icon: 'triangle-alert', text: 'Chưa có bản đã ký. Vẫn có thể gửi nếu Sở chấp nhận, nhưng cần bổ sung sau.' }) : ''}</div>`, { title: 'Tài liệu', cls: 'tight' })}
        ${O.btn('Gửi lên tỉnh', { kind: 'primary', icon: 'send', size: 'lg', attrs: `data-send25 ${late ? 'disabled' : ''}` })}</div>`;
      return `${O.pageHead({ title: 'Lập biên bản và gửi lên tỉnh', sub: 'Chọn hồ sơ đạt sơ bộ, kiểm tra biên bản sinh từ mẫu, tải lên bản đã ký rồi gửi Sở NN&MT.' })}<div class="grid g-3col">${left}${doc}${right}</div>`;
    },
    mount(root) {
      const picks = root.querySelectorAll('[data-pick]');
      root.querySelector('[data-send25]')?.addEventListener('click', () => { const n = [...picks].filter((p) => p.checked).length; if (!n) return O.toast('Chọn ít nhất một hồ sơ', true); O.confirm({ title: `Gửi ${n} hồ sơ lên tỉnh?`, what: `${n} hồ sơ cùng biên bản số 14/BB-UBND được gửi vào ${D.dot.ten}. Hồ sơ chuyển sang "Đã chuyển tỉnh" và xã không sửa được nữa.`, notify: 'Sở NN&MT và chủ thể của từng hồ sơ.', undo: 'Không. Muốn rút lại phải liên hệ Sở.', confirmText: 'Gửi lên tỉnh', icon: 'send', onConfirm: () => O.toast(`Đã gửi ${n} hồ sơ lên tỉnh`) }); });
    },
  });

  /* ================= S30 ================= */
  O.screen('s30', {
    title: 'Trang chủ Sở NN&MT', navTitle: 'Trang chủ', code: 'S30', roles: ['so', 'thuky'], device: 'Máy tính', crumbs: [],
    variants: [['default', 'Mặc định'], ['none', 'Chưa có đợt']],
    render(ctx) {
      if (ctx.variant === 'none') return O.pageHead({ title: 'Tổng quan đánh giá OCOP', sub: D.so }) + O.card(O.empty({ icon: 'calendar-plus', title: 'Chưa có đợt đánh giá nào', text: 'Tạo đợt đánh giá để các xã và chủ thể bắt đầu nộp hồ sơ.', action: O.btn('Tạo đợt', { kind: 'primary', icon: 'plus', go: 's31' }) }));
      const hero = `<section class="hero"><div class="hero-main"><div class="row s8"><span class="hero-tag">Giai đoạn: ${D.dot.giaiDoan}</span><span class="hero-tag">${D.dot.cheDo}</span><span class="hero-tag">${D.dot.phienBan}</span></div><h1>${D.dot.ten}</h1><div class="milestones"><div>Mở đợt<b>01/02/2026</b></div><div>Hạn nộp xã<b>${D.dot.hanXa}</b></div><div class="now">Hạn đánh giá tỉnh<b>${D.dot.hanTinh}</b></div><div>Kết thúc<b>31/12/2026</b></div></div><div class="hero-meta"><span class="row s8">${ic('folder-open')} 128 hồ sơ từ 18 xã/phường</span><span class="row s8">${ic('users')} Hội đồng 5 thành viên, Tổ tư vấn 3 người</span></div></div><div class="hero-side" style="align-items:flex-end"><div class="countdown"><b>12</b><span>ngày tới hạn tỉnh</span></div>${O.btn('Quản lý đợt', { kind: 'soft', size: 'sm', go: 's31' })}</div></section>`;
      const stats = `<div class="grid g-4">${O.stat({ label: 'Chờ tiếp nhận', value: 7, sub: 'Từ 4 xã', icon: 'inbox', tone: 'blue', go: 's32' })}${O.stat({ label: 'Đang thẩm định', value: 23, sub: 'Tổ tư vấn', icon: 'search-check', tone: 'purple', go: 's32' })}${O.stat({ label: 'Đang chấm', value: 31, sub: 'Hội đồng xem xét', icon: 'users', tone: 'teal', go: 's32' })}${O.stat({ label: 'Đã chốt', value: 42, sub: '6 hồ sơ từ 90 điểm', icon: 'lock', tone: 'green', go: 's32' })}</div>`;
      const funnel = [['Đã nộp', 128], ['Đạt sơ bộ, chuyển tỉnh', 115], ['Đã có báo cáo Tổ tư vấn', 84], ['Đủ phiếu thành viên', 61], ['Đã chốt điểm', 42], ['Công nhận 3–4 sao', 33]];
      const fun = O.card(`<div class="funnel">${funnel.map(([l, v]) => `<div class="fs"><span>${l}</span><div class="track"><i style="width:${(v / 128) * 100}%"></i></div><b>${v}</b></div>`).join('')}</div>`, { title: 'Phễu hồ sơ của đợt', sub: 'Số hồ sơ đã qua từng bước' });
      const months = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
      const vals = [6, 14, 31, 22, 18, 9, 12, 27, 19, 0, 0];
      const chart = O.card(`${O.bars(months.map((l, i) => ({ l, v: vals[i] || 0.4, tip: vals[i] ? [['Nộp mới', vals[i]], ['Đã chốt', Math.round(vals[i] * 0.4)], ['Thời gian xử lý', fmt(18 + i * 1.5, 1) + ' ngày']] : null })), { max: 40, hl: 7, height: 230 })}<div class="kpis"><div><b>21,5 ngày</b><span>Xử lý trung bình</span></div><div><b>74,2</b><span>Điểm trung bình</span></div><div><b>128</b><span>Hồ sơ trong đợt</span></div></div>`, { title: 'Hồ sơ theo tháng', info: true, actions: `<select class="select" style="width:auto;min-height:38px;border-radius:999px" aria-label="Năm"><option>2026</option><option>2025</option></select>` });
      const todo = O.card(`<div class="list">${[['inbox', 'blue', '7 hồ sơ chờ tiếp nhận', 'Xã An Phú 3, Phường Tân Hòa 2, Xã Phú Hữu 2', 's32', 'Tiếp nhận'], ['star', 'amber', '2 hồ sơ từ 90 điểm chờ xuất gói 5 sao', 'Gạo thơm An Phú (92), Nước mắm nhĩ cá cơm (93)', 's34', 'Xuất gói'], ['git-fork', 'purple', '5 hồ sơ chưa phân công Tổ tư vấn', 'Mới tiếp nhận trong tuần', 's41', 'Phân công'], ['file-warning', 'orange', '3 đề nghị trả về xã từ Tổ tư vấn', 'Cần Sở xem xét và trả về', 's32', 'Xem']].map(([i, t, a, b, g, l]) => `<div class="li"><span class="stat" style="padding:0;border:0;background:none;--t:var(--c-${t})"><span class="ico">${ic(i)}</span></span><div class="grow"><b>${a}</b><div class="small muted">${b}</div></div>${O.btn(l, { kind: 'soft', size: 'sm', go: g })}</div>`).join('')}</div>`, { title: 'Việc cần xử lý' });
      return O.pageHead({ title: 'Tổng quan đánh giá OCOP', sub: D.so, actions: O.btn('Thống kê', { icon: 'chart-column', go: 's35' }) }) + hero + stats + `<div class="grid g-main"><div class="stack">${chart}${todo}</div>${fun}</div>`;
    },
  });

  /* ================= S31 ================= */
  const rounds = [['Đợt đánh giá 2026', 'Đang chấm', 'purple', 3], ['Đợt bổ sung 2026', 'Soạn thảo', 'gray', 0], ['Đợt đánh giá 2025', 'Kết thúc', 'green', 4], ['Đợt đánh giá 2024', 'Kết thúc', 'green', 4]];
  O.screen('s31', {
    title: 'Quản lý đợt đánh giá', navTitle: 'Đợt đánh giá', code: 'S31', roles: ['so'], device: 'Máy tính', crumbs: [['Trang chủ', 's30']],
    variants: [['default', 'Đợt đang chấm (khóa trường)'], ['draft', 'Đợt soạn thảo'], ['overlap', 'Lỗi chồng lấn']],
    render(ctx) {
      const draft = ctx.variant !== 'default'; const sel = draft ? 1 : 0; const r = rounds[sel];
      const steps = ['Soạn thảo', 'Đang mở', 'Đã đóng nhận hồ sơ', 'Đang chấm', 'Kết thúc'];
      const lock = (f) => (draft ? f : f.replace('<select class="select"', '<select class="select" disabled'));
      const ov = ctx.variant === 'overlap';
      const list = `<div class="stack s8">${rounds.map(([t, s, tone], i) => `<div class="round-li ${i === sel ? 'on' : ''}" data-toast="Mở ${t}"><span class="nav-ico" style="background:var(--surface-3);margin:0">${ic('calendar-range')}</span><div style="flex:1;min-width:0"><b>${t}</b><div class="tiny muted">${i === 1 ? 'Chưa mở' : i === 0 ? '01/02 đến 30/06/2026' : 'Đã hoàn thành'}</div></div>${O.tag(s, tone)}</div>`).join('')}</div>`;
      const form = `<section class="card"><div class="card-head"><div style="flex:1"><h2>${r[0]}</h2><p class="small muted">${draft ? 'Đợt chưa mở, có thể sửa mọi trường.' : 'Đợt đã mở: phiên bản bộ tiêu chí và chế độ chấm bị khóa.'}</p></div>${O.tag(r[1], r[2])}</div>
        ${O.stepper(r[3], ['10/01/2026', '01/02/2026', '30/04/2026', '05/05/2026', ''], steps)}
        <div class="divider" style="margin:20px 0"></div>
        <div class="form-grid">
          <div class="field"><label for="r-ten">Tên đợt<span class="req">*</span></label><input class="input" id="r-ten" value="${r[0]}"></div>
          <div class="field"><label for="r-nam">Năm<span class="req">*</span></label><input class="input" id="r-nam" value="2026" inputmode="numeric"></div>
          <div class="field"><label for="r-hx">Hạn nộp của xã<span class="req">*</span></label><input class="input ${ov ? 'invalid' : ''}" type="date" id="r-hx" value="${draft ? (ov ? '2026-06-15' : '2026-10-31') : '2026-04-30'}">${ov ? `<span class="err">${ic('circle-alert')}Trùng với thời gian của Đợt đánh giá 2026 (01/02 đến 30/06/2026). Chọn ngày sau 30/06/2026.</span>` : ''}</div>
          <div class="field"><label for="r-ht">Hạn đánh giá của tỉnh<span class="req">*</span></label><input class="input" type="date" id="r-ht" value="${draft ? '2026-12-15' : '2026-06-30'}"><span class="hint">Phải sau hạn nộp của xã</span></div>
          <div class="field full"><span class="label">Chế độ chấm ${draft ? '' : ic('lock')}</span><div class="radio-cards"><label class="radio-card"><input type="radio" name="r-mode" ${draft ? '' : 'disabled'}><span><b style="font-weight:600">Chấm trực tiếp</b><br><span class="tiny muted">Thành viên tự chấm từ đầu</span></span></label><label class="radio-card"><input type="radio" name="r-mode" checked ${draft ? '' : 'disabled'}><span><b style="font-weight:600">Dựa trên Tổ tư vấn</b><br><span class="tiny muted">Sao chép báo cáo vào phiếu chấm</span></span></label></div></div>
          ${lock(`<div class="field full"><label for="r-pb">Phiên bản bộ tiêu chí áp dụng ${draft ? '' : ic('lock')}</label><select class="select" id="r-pb"><option>${D.dot.phienBan} · phát hành 05/01/2026</option><option>Bộ tiêu chí 2025 (v1.4)</option></select></div>`)}
          <div class="field full"><label for="r-gc">Ghi chú</label><textarea class="textarea" id="r-gc" style="min-height:70px">${draft ? 'Đợt bổ sung cho các sản phẩm du lịch cộng đồng.' : ''}</textarea></div>
        </div>
        <div class="card-foot">${draft ? `${O.btn('Lưu nháp', { kind: 'ghost', icon: 'save', attrs: 'data-toast="Đã lưu đợt"' })}<span class="spacer"></span>${O.btn('Mở đợt', { kind: 'primary', icon: 'play', attrs: `data-open ${ov ? 'disabled' : ''}` })}` : `${O.btn('Gia hạn', { icon: 'calendar-plus', attrs: 'data-extend' })}<span class="spacer"></span>${O.btn('Kết thúc đợt', { kind: 'danger-ghost', icon: 'flag', attrs: 'data-end' })}`}</div></section>`;
      return O.pageHead({ title: 'Quản lý đợt đánh giá', sub: 'Tạo, mở, đóng và kết thúc các đợt đánh giá của tỉnh.', actions: O.btn('Tạo đợt', { kind: 'primary', icon: 'plus', attrs: 'data-variant="draft"' }) }) + `<div class="grid g-side">${O.card(list, { title: 'Các đợt', cls: 'tight' })}${form}</div>`;
    },
    mount(root) {
      root.querySelector('[data-open]')?.addEventListener('click', () => O.confirm({ title: 'Mở Đợt bổ sung 2026?', what: 'Đợt chuyển sang "Đang mở". Phiên bản bộ tiêu chí và chế độ chấm bị khóa.', notify: 'UBND 18 xã/phường và toàn bộ chủ thể có tài khoản.', undo: 'Không. Chỉ có thể gia hạn hoặc kết thúc đợt.', confirmText: 'Mở đợt', icon: 'play', onConfirm: () => O.toast('Đã mở đợt và gửi thông báo') }));
      root.querySelector('[data-extend]')?.addEventListener('click', () => { const el = O.modal({ title: 'Gia hạn đợt', icon: 'calendar-plus', body: `<div class="form-grid"><div class="field"><label for="ex-k">Hạn được gia hạn</label><select class="select" id="ex-k"><option>Hạn đánh giá của tỉnh</option><option>Hạn nộp của xã</option></select></div><div class="field"><label for="ex-d">Ngày mới</label><input class="input" type="date" id="ex-d" value="2026-07-15"></div><div class="field full"><label for="ex-ly">Lý do gia hạn<span class="req">*</span></label><textarea class="textarea" id="ex-ly"></textarea></div></div>`, foot: `${O.btn('Hủy', { kind: 'ghost', attrs: 'data-close' })}${O.btn('Gia hạn', { kind: 'primary', attrs: 'data-ok' })}` }); el.querySelector('[data-ok]').addEventListener('click', () => { const ly = el.querySelector('#ex-ly'); if (!ly.value.trim()) { ly.classList.add('invalid'); return O.toast('Nhập lý do gia hạn', true); } el.remove(); O.toast('Đã gia hạn đợt'); }); });
      root.querySelector('[data-end]')?.addEventListener('click', () => O.confirm({ title: 'Kết thúc Đợt đánh giá 2026?', kind: 'danger', what: 'Đợt đóng hoàn toàn, không nhận thêm phiếu chấm hay chốt điểm.', notify: 'Hội đồng, Tổ tư vấn và các xã.', undo: 'Không.', typeWord: 'KẾT THÚC', confirmText: 'Kết thúc đợt', onConfirm: () => O.toast('Đã kết thúc đợt') }));
    },
  });

  /* ================= S32 ================= */
  const stepOf = { danop: 'UBND xã', chuyentinh: 'Sở tiếp nhận', thamdinh: 'Tổ tư vấn', cobaocao: 'Hội đồng', hdxemxet: 'Hội đồng', daxacnhan: 'Hội đồng', dachot: 'Cấp chứng nhận', congnhan4: 'Hoàn tất', chuadat: 'Hoàn tất', de5sao: 'Ngoài hệ thống', bosung: 'Chủ thể', nhap: 'Chủ thể' };
  O.screen('s32', {
    title: 'Danh sách hồ sơ toàn tỉnh', navTitle: 'Hồ sơ toàn tỉnh', code: 'S32', roles: ['so'], device: 'Máy tính', crumbs: [['Trang chủ', 's30']],
    variants: [['default', 'Mặc định'], ['empty', 'Trống'], ['nores', 'Lọc không có kết quả']],
    render(ctx) {
      const head = O.pageHead({ title: 'Hồ sơ toàn tỉnh', sub: `${D.dot.ten} · 128 hồ sơ từ 18 xã/phường`, actions: O.btn('Xuất Excel', { icon: 'file-spreadsheet', attrs: 'data-toast="Đang xuất 128 hồ sơ ra Excel"' }) });
      const tools = `<div class="stack s12" style="padding:18px 18px 12px">${O.fchips([['Tất cả', 128], ['Chờ tiếp nhận', 7], ['Đang thẩm định', 23], ['Đang chấm', 31], ['Đã chốt', 42], ['Cần bổ sung', 4]], ctx.variant === 'nores' ? 1 : 0)}<div class="toolbar">${O.search('Tìm theo mã, sản phẩm, chủ thể (không cần dấu)', 's32-q')}<select class="select" style="width:auto" aria-label="Xã"><option>Mọi xã/phường</option>${D.xa.map((x) => `<option>${x}</option>`).join('')}</select>${O.btn('Bộ lọc nâng cao', { icon: 'sliders-horizontal', attrs: 'data-adv' })}<a href="#s32" class="link-btn small" data-toast="Đã lọc hồ sơ chờ tiếp nhận">${ic('filter')}Chờ tiếp nhận</a></div>${O.bulkbar(0, `${O.btn('Tiếp nhận', { kind: 'primary', size: 'sm', icon: 'check', attrs: 'data-accept' })}${O.btn('Trả về xã', { size: 'sm', icon: 'undo-2', attrs: 'data-return' })}${O.btn('Xuất Excel', { size: 'sm', icon: 'download', attrs: 'data-toast="Đang xuất các hồ sơ đã chọn"' })}`)}</div>`;
      if (ctx.variant === 'empty') return head + O.card(O.empty({ icon: 'folder-open', title: 'Chưa có hồ sơ nào từ các xã', text: 'Hồ sơ xuất hiện khi UBND xã gửi biên bản lên tỉnh. Hạn gửi của đợt là ' + D.dot.hanXa + '.' }), { cls: 'flush' });
      if (ctx.variant === 'nores') return head + `<section class="card flush">${tools}${O.empty({ icon: 'search-x', title: 'Không có hồ sơ khớp bộ lọc', text: 'Thử bỏ bớt điều kiện lọc hoặc tìm không dấu, ví dụ "mam ca linh".', action: O.btn('Xóa bộ lọc', { kind: 'soft', attrs: 'data-variant="default"' }) })}</section>`;
      const table = O.table({
        select: true, total: 128,
        cols: [{ k: 'sp', l: 'Sản phẩm', sort: true }, { k: 'ct', l: 'Chủ thể' }, { k: 'xa', l: 'Xã/phường' }, { k: 'nhom', l: 'Nhóm' }, { k: 'st', l: 'Trạng thái' }, { k: 'buoc', l: 'Bước đang xử lý' }, { k: 'diem', l: 'Điểm', cls: 'r', sort: true }, { k: 'han', l: 'Hạn', sort: true }],
        rows: D.hoso, rowAttrs: (h) => goRow(h, 's33'),
        cell: (h, c) => c.k === 'sp' ? O.prodCell(h) : c.k === 'st' ? O.chip(h.st) : c.k === 'diem' ? (h.diem != null ? `<b>${h.diem}</b>` : '<span class="faint">—</span>') : c.k === 'buoc' ? `<span class="small">${stepOf[h.st] || ''}</span>` : c.k === 'nhom' ? `<span class="tag">${esc(h.nhom.split(',')[0])}</span>` : c.k === 'han' ? hanCell(h, false) : `<span class="small">${esc(h[c.k] || '')}</span>`,
        card: (h) => `<div class="mcard" data-go="s33" data-params='${JSON.stringify({ ma: h.ma })}'>${O.prodCell(h)}<div class="row s8">${O.chip(h.st)}${h.diem != null ? `<b>${h.diem} điểm</b>` : ''}</div><div class="small muted">${esc(h.ct)} · ${esc(h.xa)}</div></div>`,
      });
      return head + `<section class="card flush">${tools}${table}</section>`;
    },
    mount(root) {
      root.querySelector('[data-adv]')?.addEventListener('click', () => O.drawer({ title: 'Bộ lọc nâng cao', body: `<div class="stack">${[['Đợt', [D.dot.ten, 'Đợt đánh giá 2025']], ['Xã/phường', D.xa], ['Nhóm sản phẩm', D.nhom], ['Chế độ chấm', ['Dựa trên Tổ tư vấn', 'Chấm trực tiếp']]].map(([l, o], i) => `<div class="field"><label for="adv-${i}">${l}</label><select class="select" id="adv-${i}"><option>Tất cả</option>${o.map((x) => `<option>${x}</option>`).join('')}</select></div>`).join('')}<div class="field"><span class="label">Khoảng điểm</span><div class="row nowrap"><input class="input" placeholder="Từ" aria-label="Điểm từ"><input class="input" placeholder="Đến" aria-label="Điểm đến"></div></div><div class="field"><span class="label">Hạng</span><div class="fchips" data-chips>${['3 sao', '4 sao', 'Từ 90 điểm', 'Chưa đạt'].map((x) => `<button type="button" class="fchip">${x}</button>`).join('')}</div></div><label class="check"><input type="checkbox"> Chỉ hồ sơ quá hạn xử lý</label></div>`, foot: `${O.btn('Xóa bộ lọc', { kind: 'ghost', attrs: 'data-close' })}${O.btn('Áp dụng', { kind: 'primary', attrs: 'data-close data-toast="Đã áp dụng bộ lọc"' })}` }));
      root.querySelector('[data-accept]')?.addEventListener('click', () => { const n = root.querySelectorAll('[data-sel]:checked').length; O.confirm({ title: `Tiếp nhận ${n} hồ sơ?`, what: 'Hồ sơ chuyển sang bước phân công Tổ tư vấn.', notify: 'Chủ thể và UBND xã gửi hồ sơ.', undo: 'Có thể trả về xã sau khi tiếp nhận.', confirmText: 'Tiếp nhận', onConfirm: () => O.toast(`Đã tiếp nhận ${n} hồ sơ`) }); });
      root.querySelector('[data-return]')?.addEventListener('click', () => O.openS24('tra', 'HS-2026-0129'));
    },
  });

  /* ================= S33 ================= */
  O.screen('s33', {
    title: 'Chi tiết hồ sơ tại tỉnh', navTitle: 'Chi tiết hồ sơ', code: 'S33', roles: ['so'], device: 'Máy tính', crumbs: [['Hồ sơ toàn tỉnh', 's32']],
    variants: [['default', 'Chờ tiếp nhận'], ['scoring', 'Đang chấm']],
    render(ctx) {
      const scoring = ctx.variant === 'scoring';
      const h = { ...O.hs(ctx.params.ma || (scoring ? 'HS-2026-0123' : 'HS-2026-0129')) };
      if (!scoring && ['hdxemxet', 'cobaocao', 'daxacnhan', 'thamdinh'].includes(h.st)) h.st = 'chuyentinh';
      const xaReport = O.card(`<div class="stack s12"><div class="row s8">${O.tag('Đủ điều kiện chuyển tỉnh', 'green', 'circle-check')}<span class="small muted">Biên bản 14/BB-UBND ngày 25/04/2026</span></div>${['Nguồn gốc nguyên liệu', 'Lao động địa phương', 'Bản sắc văn hóa và trí tuệ bản địa'].map((t) => `<div class="row between" style="border-bottom:1px solid var(--line);padding:8px 0"><span>${t}</span>${O.tag('Đạt', 'green', 'check')}</div>`).join('')}${O.file({ name: 'Bien-ban-14-BB-UBND-da-ky.pdf', size: '420 KB', type: 'pdf' })}</div>`, { title: `Biên bản sơ bộ của ${esc(h.xa)}` });
      const members = D.hoidong.filter((m) => m.vt !== 'Thư ký').slice(0, 4);
      const ttvTab = O.card(`<div class="stack">${O.banner({ tone: 'gray', icon: 'eye-off', text: 'Sở chỉ xem trạng thái xử lý. Điểm của từng thành viên không hiển thị ở đây.' })}<div class="kv"><div>${ic('clipboard-check')}<div><div class="k">Báo cáo Tổ tư vấn</div><div class="v">${scoring ? 'Đã phát hành phiên bản 2 · 10/10/2026' : 'Chưa phân công'}</div></div></div><div>${ic('user')}<div><div class="k">Tổ tư vấn phụ trách</div><div class="v">${scoring ? 'Hoàng Thị E' : 'Chưa có'}</div></div></div></div><div class="list">${members.map((m, i) => `<div class="li">${O.person(m.ten, m.cv)}<span class="spacer"></span>${!scoring ? O.tag('Chưa phân công', 'gray') : i < 2 ? O.tag('Đã xác nhận', 'green', 'badge-check') : i === 2 ? O.tag('Đang xem xét', 'purple', 'loader') : O.tag('Chưa mở', 'gray')}</div>`).join('')}</div></div>`, { title: 'Thẩm định và chấm điểm', sub: scoring ? '2/4 phiếu đã xác nhận' : '' });
      const tabs = O.tabs([['tq', 'Tổng quan'], ['mc', 'Minh chứng', 28], ['bb', 'Biên bản sơ bộ của xã'], ['td', 'Thẩm định và chấm điểm'], ['ls', 'Lịch sử']], { tq: overviewTab(h), mc: evidenceTab(), bb: xaReport, td: ttvTab, ls: historyTab(h) }, { style: 'line', active: scoring ? 'td' : 'tq' });
      return `${O.pageHead({ title: esc(h.sp), chips: `${O.chip(h.st)}${O.tag('Chế độ: ' + D.dot.cheDo, 'teal', 'copy')}<span class="code-tag">${h.ma}</span>`, sub: `${esc(h.ct)} · ${esc(h.xa)} · ${esc(h.nhom)}`, actions: `${O.btn('Trả về xã', { icon: 'undo-2', attrs: 'data-return' })}${scoring ? O.btn('Xem phân công', { kind: 'primary', icon: 'git-fork', go: 's41' }) : O.btn('Tiếp nhận', { kind: 'primary', icon: 'check', attrs: 'data-accept' }) + O.btn('Phân công', { kind: 'soft', icon: 'git-fork', go: 's41' })}` })}
      ${O.card(O.stepper(scoring ? 3 : 2, ['02/04/2026', '18/04/2026', '05/05/2026', '', '']), { cls: 'tight' })}${tabs}`;
    },
    mount(root, ctx) {
      root.querySelector('[data-return]')?.addEventListener('click', () => O.openS24('tra', ctx.params.ma || 'HS-2026-0129'));
      root.querySelector('[data-accept]')?.addEventListener('click', () => O.confirm({ title: 'Tiếp nhận hồ sơ?', what: 'Hồ sơ chuyển sang bước phân công Tổ tư vấn và thành viên hội đồng.', notify: 'Chủ thể và UBND xã.', undo: 'Có thể trả về xã sau khi tiếp nhận.', confirmText: 'Tiếp nhận', onConfirm: () => O.toast('Đã tiếp nhận hồ sơ') }));
    },
  });

  /* ================= S34 ================= */
  O.screen('s34', {
    title: 'Hồ sơ 5 sao: xuất gói hồ sơ', navTitle: 'Hồ sơ 5 sao', code: 'S34', roles: ['so'], device: 'Máy tính', crumbs: [['Trang chủ', 's30']],
    variants: [['default', 'Đã chốt, chờ xuất'], ['sent', 'Đã gửi đề nghị'], ['empty', 'Chưa có hồ sơ']],
    render(ctx) {
      const head = O.pageHead({ title: 'Đề xuất 5 sao', sub: 'Hồ sơ đạt từ 90 điểm. Hệ thống chỉ hỗ trợ xuất gói hồ sơ và đánh dấu trạng thái.' }) + O.banner({ tone: 'amber', icon: 'info', title: 'Gửi và nhận kết quả thực hiện ngoài hệ thống', text: 'Sở gửi gói hồ sơ bằng văn bản tới Bộ NN&MT. Bộ không dùng hệ thống này. Sản phẩm mẫu và văn bản gốc nộp trực tiếp.' });
      if (ctx.variant === 'empty') return head + O.card(O.empty({ icon: 'star', title: 'Chưa có hồ sơ đủ điều kiện', text: 'Hồ sơ xuất hiện ở đây khi được chốt điểm từ 90 điểm trở lên.' }));
      const sent = ctx.variant === 'sent';
      const rows = [O.hs('HS-2026-0126'), O.hs('HS-2026-0134'), { ...O.hs('HS-2026-0124'), sp: 'Trà mãng cầu sấy lạnh', ma: 'HS-2026-0141', diem: 90, st: 'de5sao' }].map((h, i) => ({ ...h, st: sent && i === 0 ? 'de5sao' : h.st }));
      const sel = rows[0];
      const table = O.table({ pager: false, cols: [{ k: 'sp', l: 'Sản phẩm' }, { k: 'xa', l: 'Xã/phường' }, { k: 'diem', l: 'Điểm', cls: 'r' }, { k: 'st', l: 'Trạng thái' }, { k: 'goi', l: 'Gói hồ sơ' }], rows, rowAttrs: (h, i) => `class="${i === 0 ? 'sel' : ''}"`, cell: (h, c, i) => c.k === 'sp' ? O.prodCell(h) : c.k === 'diem' ? `<b>${h.diem}</b>` : c.k === 'st' ? O.chip(h.st) : c.k === 'goi' ? (i === 0 ? O.tag('Thiếu 1/7', 'orange', 'triangle-alert') : O.tag('Đủ 7/7', 'green', 'check')) : `<span class="small">${esc(h[c.k])}</span>`, card: (h) => `<div class="mcard">${O.prodCell(h)}<div class="row s8">${O.chip(h.st)}<b>${h.diem} điểm</b></div></div>` });
      const pkg = [['Hồ sơ sản phẩm', 1], ['Minh chứng theo tiêu chí (31 tệp)', 1], ['Báo cáo đánh giá của Tổ tư vấn', 1], ['Báo cáo đánh giá của Hội đồng', 1], ['Quyết định phê duyệt kết quả của Chủ tịch UBND tỉnh', 0], ['Bảng điểm tổng hợp', 1], ['Bản nháp văn bản đề nghị của UBND tỉnh', 1]];
      const panel = O.card(`<div class="stack"><div class="row s8">${O.stars(5)}<b>${sel.diem} điểm</b>${O.chip(sel.st)}</div><div class="small muted">${esc(sel.ct)} · ${esc(sel.xa)}</div><span class="label">Nội dung trong gói</span><ul class="pkg">${pkg.map(([t, ok]) => `<li>${ok ? `<span class="ok">${ic('circle-check')}</span>` : `<span class="miss">${ic('circle-alert')}</span>`}<span>${t}${ok ? '' : ' <span class="tiny muted">(chưa tải lên)</span>'}</span></li>`).join('')}</ul>${O.banner({ tone: 'orange', icon: 'triangle-alert', text: 'Thiếu 1 tài liệu bắt buộc. Vẫn có thể xuất gói, kèm danh sách tài liệu còn thiếu.' })}
        <div class="row">${O.btn('Xuất ZIP', { kind: 'primary', icon: 'file-archive', attrs: 'data-toast="Đang tạo gói ZIP (48 MB)"' })}${O.btn('Xuất PDF', { icon: 'file-down', attrs: 'data-toast="Đang tạo tệp PDF tổng hợp"' })}</div>
        <div class="divider"></div>
        ${sent ? `<div class="kv one"><div>${ic('send')}<div><div class="k">Đã gửi đề nghị</div><div class="v">Công văn 1287/SNNMT-PTNT · 12/10/2026</div></div></div></div><span class="small muted">Khi có văn bản kết quả từ Bộ, chọn một trong hai thao tác:</span><div class="row">${O.btn('Chuyển về công nhận cấp tỉnh', { kind: 'soft', icon: 'award', go: 's45' })}${O.btn('Đóng hồ sơ', { kind: 'danger-ghost', icon: 'archive', attrs: 'data-close34' })}</div>` : O.btn('Đánh dấu đã gửi', { kind: 'amber', icon: 'send', attrs: 'data-mark' })}</div>`, { title: esc(sel.sp), sub: sel.ma });
      return head + `<div class="grid g-main"><section class="card flush">${table}</section>${panel}</div>`;
    },
    mount(root) {
      root.querySelector('[data-mark]')?.addEventListener('click', () => { const el = O.modal({ title: 'Đánh dấu đã gửi đề nghị 5 sao', icon: 'send', tone: 'amber', body: `<p class="muted">Hồ sơ chuyển sang "Đã gửi đề nghị 5 sao". Chủ thể nhận thông báo rằng kết quả sẽ được gửi bằng văn bản.</p><div class="form-grid"><div class="field"><label for="m-cv">Số công văn</label><input class="input" id="m-cv" placeholder="Ví dụ 1287/SNNMT-PTNT"><span class="hint">Không bắt buộc</span></div><div class="field"><label for="m-d">Ngày gửi</label><input class="input" type="date" id="m-d" value="2026-10-12"><span class="hint">Không bắt buộc</span></div></div>`, foot: `${O.btn('Hủy', { kind: 'ghost', attrs: 'data-close' })}${O.btn('Đánh dấu đã gửi', { kind: 'primary', attrs: 'data-ok' })}` }); el.querySelector('[data-ok]').addEventListener('click', () => { el.remove(); O.toast('Đã đánh dấu gửi đề nghị 5 sao'); O.setVariant('sent'); }); });
      root.querySelector('[data-close34]')?.addEventListener('click', () => { const el = O.modal({ title: 'Đóng hồ sơ', icon: 'archive', tone: 'gray', body: `<p class="muted">Hồ sơ chuyển sang "Đã đóng (xử lý ngoài hệ thống)". Không có giấy chứng nhận cấp tỉnh.</p><div class="field"><label for="cl-n">Ghi chú</label><textarea class="textarea" id="cl-n"></textarea></div><div class="field"><span class="label">Văn bản kết quả (không bắt buộc)</span>${O.drop('Tải lên văn bản kết quả', 'PDF', true)}</div>`, foot: `${O.btn('Hủy', { kind: 'ghost', attrs: 'data-close' })}${O.btn('Đóng hồ sơ', { kind: 'danger', attrs: 'data-ok' })}` }); el.querySelector('[data-ok]').addEventListener('click', () => { el.remove(); O.toast('Đã đóng hồ sơ'); }); });
    },
  });

  /* ================= S35 ================= */
  O.screen('s35', {
    title: 'Thống kê và xuất báo cáo', navTitle: 'Thống kê', code: 'S35', roles: ['so', 'xa'], device: 'Máy tính', crumbs: [['Trang chủ', 's30']],
    variants: [['default', 'Mặc định'], ['nodata', 'Chưa đủ dữ liệu']],
    render(ctx) {
      const isXa = ctx.role === 'xa';
      const fb = `<div class="filterbar"><select class="select" aria-label="Đợt"><option>${D.dot.ten}</option><option>Đợt đánh giá 2025</option></select><select class="select" aria-label="Nhóm sản phẩm"><option>Mọi nhóm sản phẩm</option>${D.nhom.map((n) => `<option>${n}</option>`).join('')}</select><select class="select" aria-label="Đơn vị" ${isXa ? 'disabled' : ''}>${isXa ? '<option>Xã An Phú</option>' : `<option>Mọi xã/phường</option>${D.xa.map((x) => `<option>${x}</option>`).join('')}`}</select><select class="select" aria-label="Hạng"><option>Mọi hạng</option><option>3 sao</option><option>4 sao</option><option>Đề nghị 5 sao</option></select><span class="spacer"></span>${O.btn('Excel', { icon: 'file-spreadsheet', size: 'sm', attrs: 'data-toast="Đang xuất báo cáo Excel"' })}${O.btn('PDF', { icon: 'file-down', size: 'sm', attrs: 'data-toast="Đang xuất báo cáo PDF"' })}</div>`;
      const head = O.pageHead({ title: 'Thống kê và báo cáo', sub: isXa ? 'Phạm vi: Xã An Phú. Cán bộ xã chỉ thấy số liệu của xã mình.' : 'Phạm vi: toàn tỉnh', chips: O.tag('Đợt 2', 'gray') });
      if (ctx.variant === 'nodata') return head + fb + O.card(O.empty({ icon: 'chart-no-axes-column', title: 'Chưa đủ dữ liệu để thống kê', text: 'Bộ lọc hiện tại chỉ có 2 hồ sơ. Thử chọn đợt khác hoặc bỏ bớt điều kiện lọc.', action: O.btn('Bỏ bộ lọc', { kind: 'soft', attrs: 'data-variant="default"' }) }));
      const k = isXa ? [15, '73%', 6, 3, 0, '19,2'] : [128, '68%', 21, 12, 6, '21,5'];
      const kpi = `<div class="grid g-4" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">${O.stat({ label: 'Tổng hồ sơ', value: k[0], icon: 'folder-open', tone: 'blue' })}${O.stat({ label: 'Tỷ lệ đạt', value: k[1], sub: 'Trên hồ sơ đã chốt', icon: 'percent', tone: 'green' })}${O.stat({ label: 'Hồ sơ 3 sao', value: k[2], icon: 'star', tone: 'amber' })}${O.stat({ label: 'Hồ sơ 4 sao', value: k[3], icon: 'star', tone: 'amber' })}${O.stat({ label: 'Đề nghị 5 sao', value: k[4], icon: 'sparkles', tone: 'purple' })}${O.stat({ label: 'Xử lý trung bình', value: k[5], sub: 'ngày', icon: 'timer', tone: 'teal' })}</div>`;
      const byStatus = O.card(O.bars([['Nộp', 7], ['Sơ bộ', 13], ['Thẩm định', 23], ['Chấm', 31], ['Đã chốt', 42], ['Công nhận', 33]].map(([l, v]) => ({ l, v, tip: [['Hồ sơ', v]] })), { max: 50, height: 220, hl: 4 }), { title: 'Hồ sơ theo trạng thái' });
      const byGroup = O.card(O.hbars([{ l: 'Thực phẩm', v: 58 }, { l: 'Đồ uống', v: 24 }, { l: 'Dược liệu', v: 17 }, { l: 'Thủ công mỹ nghệ', v: 15 }, { l: 'Cây cảnh', v: 8 }, { l: 'Du lịch cộng đồng', v: 6 }], 60), { title: 'Theo nhóm sản phẩm' });
      const byXa = O.card(`${O.hbars([{ l: 'Xã An Phú', v: 15, parts: [[6, 'green'], [3, 'amber'], [6, 'gray']] }, { l: 'Phường Tân Hòa', v: 12, parts: [[4, 'green'], [2, 'amber'], [6, 'gray']] }, { l: 'Xã Bình Thạnh', v: 11, parts: [[5, 'green'], [1, 'amber'], [5, 'gray']] }, { l: 'Xã Long Điền', v: 9, parts: [[3, 'green'], [2, 'amber'], [4, 'gray']] }, { l: 'Xã Phú Hữu', v: 8, parts: [[2, 'green'], [3, 'amber'], [3, 'gray']] }], 16)}<div class="legend" style="margin-top:14px"><span><i style="background:var(--c-green)"></i>3 sao</span><span><i style="background:var(--c-amber)"></i>4 sao trở lên</span><span><i style="background:var(--c-gray)"></i>Đang xử lý, chưa đạt</span></div>`, { title: 'Theo xã/phường' });
      const dist = (t, arr) => `<div class="dist" style="--t:var(--c-${t})">${arr.map((v) => `<i style="height:${v}%" title="${v} hồ sơ"></i>`).join('')}</div>`;
      const abc = O.card(`<div class="abc">${[['A', 40, 'green', [8, 15, 30, 62, 88, 54, 20], '29,4'], ['B', 25, 'blue', [12, 26, 48, 80, 52, 18], '17,1'], ['C', 35, 'purple', [6, 18, 40, 70, 90, 46, 14], '25,8']].map(([p, m, t, a, avg]) => `<div class="col"><b>Phần ${p}</b><span class="tiny muted">Tối đa ${m} · trung bình ${avg}</span>${dist(t, a)}<div class="row between tiny faint"><span>0</span><span>${m}</span></div></div>`).join('')}</div>`, { title: 'Phân bố điểm Phần A, B, C', sub: 'Số hồ sơ theo khoảng điểm, hồ sơ đã chốt' });
      const tbl = `<section class="card flush"><div class="card-head" style="padding:18px 18px 0"><h2>Bảng chi tiết</h2></div>${O.table({ total: 128, cols: [{ k: 'sp', l: 'Sản phẩm', sort: true }, { k: 'xa', l: 'Xã/phường', sort: true }, { k: 'nhom', l: 'Nhóm', sort: true }, { k: 'diem', l: 'Điểm', cls: 'r', sort: true }, { k: 'sao', l: 'Hạng', sort: true }, { k: 'st', l: 'Trạng thái' }], rows: D.hoso.filter((h) => h.diem != null && (!isXa || h.xa === 'Xã An Phú')), cell: (h, c) => c.k === 'sp' ? O.prodCell(h) : c.k === 'diem' ? `<b>${h.diem}</b>` : c.k === 'sao' ? (h.sao ? O.stars(h.sao) : '<span class="faint small">Chưa đạt</span>') : c.k === 'st' ? O.chip(h.st) : `<span class="small">${esc(h[c.k])}</span>`, card: (h) => `<div class="mcard">${O.prodCell(h)}<div class="row s8">${h.sao ? O.stars(h.sao) : ''}<b>${h.diem} điểm</b></div></div>` })}</section>`;
      return head + fb + kpi + `<div class="grid g-2">${byStatus}${byGroup}${byXa}${abc}</div>` + tbl;
    },
  });
})();
