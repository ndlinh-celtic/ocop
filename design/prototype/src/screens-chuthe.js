/* Nhóm Chủ thể OCOP: S10–S19 (mobile-first) */
(function () {
  const O = window.OCOP, D = O.data, ic = O.icon, esc = O.esc, fmt = O.fmt;
  document.head.insertAdjacentHTML('beforeend', `<style>
  .ct-fl { display:flex; gap:12px; align-items:center; min-width:0; }
  .ct-fl > * { min-width:0; }
  .ct-hs { display:flex; gap:12px; align-items:center; padding:14px; border:1px solid var(--line); border-radius:18px; background:var(--surface); cursor:pointer; min-width:0; }
  .ct-hs:hover { border-color:var(--line-strong); box-shadow:var(--shadow-1); }
  .ct-hs .pi { width:48px; height:48px; border-radius:14px; display:grid; place-items:center; background:var(--brand-soft); color:var(--brand); flex:none; }
  .ct-hs .grow { flex:1; min-width:0; display:flex; flex-direction:column; gap:4px; }
  .ct-hs .grow b { font-weight:600; font-size:15.5px; }
  .ct-todo { display:flex; gap:14px; align-items:flex-start; padding:16px; border-radius:18px; border:1px solid color-mix(in srgb, var(--c-orange) 35%, transparent); background:color-mix(in srgb, var(--c-orange) 8%, var(--surface)); }
  .ct-todo .ti { width:44px; height:44px; border-radius:14px; display:grid; place-items:center; background:color-mix(in srgb, var(--c-orange) 18%, var(--surface)); color:var(--c-orange); flex:none; }
  .ct-count { display:flex; align-items:baseline; gap:6px; }
  .ct-count b { font-size:40px; font-weight:800; line-height:1; color:#fff; }
  .ct-doc { border:1.5px solid var(--line); border-radius:20px; padding:18px; background:var(--surface); display:flex; flex-direction:column; gap:12px; min-width:0; }
  .ct-doc.exp { border-color:var(--c-red); background:color-mix(in srgb, var(--c-red) 4%, var(--surface)); }
  .ct-doc.soon { border-color:color-mix(in srgb, var(--c-orange) 55%, transparent); }
  .ct-doc .dh { display:flex; gap:12px; align-items:flex-start; }
  .ct-doc .dh .di { width:42px; height:42px; border-radius:12px; display:grid; place-items:center; background:var(--brand-soft); color:var(--brand); flex:none; }
  .ct-res { position:sticky; top:0; }
  .ct-big { font-size:56px; font-weight:800; line-height:1; letter-spacing:-.02em; font-variant-numeric:tabular-nums; }
  .ct-big small { font-size:18px; color:var(--text-3); font-weight:500; }
  .ct-part { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:6px 10px; align-items:center; font-size:14px; }
  .ct-part .progress { grid-column:1 / -1; }
  .ct-chk { display:flex; gap:12px; align-items:flex-start; padding:12px 0; border-bottom:1px solid var(--line); }
  .ct-chk:last-child { border-bottom:0; }
  .ct-chk .ci { width:30px; height:30px; border-radius:50%; display:grid; place-items:center; flex:none; background:color-mix(in srgb, var(--t) 15%, var(--surface)); color:var(--t); }
  .ct-chk .ci .ic { width:16px; height:16px; stroke-width:2.4; }
  .ct-item { border:1px solid var(--line); border-radius:20px; background:var(--surface); padding:18px; display:flex; flex-direction:column; gap:12px; }
  .ct-item.done { border-color:color-mix(in srgb, var(--c-green) 40%, transparent); }
  .ct-next { display:flex; gap:14px; align-items:flex-start; padding:18px; border-radius:20px; background:var(--brand-soft); }
  .ct-next .ni { width:44px; height:44px; border-radius:14px; background:var(--brand); color:#fff; display:grid; place-items:center; flex:none; }
  .ct-hero-res { display:flex; gap:24px; align-items:center; flex-wrap:wrap; }
  .ct-hero-res .ct-big { color:#fff; } .ct-hero-res .stars { color:#FFD45C; } .ct-hero-res .stars .ic.off { color:rgba(255,255,255,.35); }
  .ct-hero-res .ct-big small { color:rgba(255,255,255,.8); }
  .ct-photos { display:grid; grid-template-columns:repeat(auto-fill, minmax(96px,1fr)); gap:10px; }
  .ct-photo { aspect-ratio:1; border-radius:14px; background:linear-gradient(135deg, var(--surface-3), var(--brand-soft)); display:grid; place-items:center; color:var(--brand); position:relative; border:1px solid var(--line); max-width:100%; }
  .ct-photo .main { position:absolute; left:6px; top:6px; font-size:11px; font-weight:700; background:var(--brand); color:var(--brand-ink); padding:1px 7px; border-radius:6px; }
  .ct-photo.add { border:2px dashed var(--line-strong); background:var(--surface-2); cursor:pointer; }
  .ct-cd { display:flex; gap:8px; }
  .ct-cd div { background:var(--surface-3); border-radius:12px; padding:8px 10px; text-align:center; min-width:56px; }
  .ct-cd b { display:block; font-size:22px; font-weight:800; font-variant-numeric:tabular-nums; line-height:1.1; }
  .ct-cd span { font-size:11.5px; color:var(--text-3); }
  @container main (max-width: 900px) { .ct-res { position:static; order:-1; } .ct-swap > :last-child { order:-1; } }
  @container main (max-width: 640px) { .scorebar .acts { margin-left:0; width:100%; } .scorebar .acts .btn { flex:1; } .ct-big { font-size:46px; } }
  </style>`);

  /* hồ sơ của chủ thể Cơ sở Mắm Bà Sáu */
  const MY = [
    { ma: 'HS-2026-0123', sp: 'Mắm cá linh khô', nhom: 'Thực phẩm', dot: 'Đợt 2026', st: 'hdxemxet', cn: '15/10/2026', step: 3, buoc: 'Hội đồng tỉnh đang xem xét', diem: null, sao: null, act: ['Xem', 's17', 'eye'] },
    { ma: 'HS-2026-0135', sp: 'Mắm thái đu đủ', nhom: 'Thực phẩm', dot: 'Đợt 2026', st: 'bosung', cn: '14/10/2026', step: 1, buoc: 'Xã yêu cầu bổ sung, hạn 20/10/2026', diem: null, sao: null, act: ['Bổ sung', 's18', 'file-pen-line'] },
    { ma: 'HS-2026-0132', sp: 'Khô cá lóc đồng', nhom: 'Thực phẩm', dot: 'Đợt 2026', st: 'nhap', cn: '12/10/2026', step: 0, buoc: 'Đang soạn, còn 2 bước', diem: null, sao: null, act: ['Tiếp tục soạn', 's13', 'pencil-line'] },
    { ma: 'HS-2025-0087', sp: 'Tôm khô Bà Sáu', nhom: 'Thực phẩm', dot: 'Đợt 2025', st: 'congnhan3', cn: '20/11/2025', step: 5, buoc: 'Đã có kết quả', diem: 64, sao: 3, act: ['Xem kết quả', 's19', 'award'] },
  ];
  const pIcon = (n) => O.nhomIcon(n);
  const hsCard = (h) => `<div class="ct-hs" data-go="${h.act[1]}"><span class="pi">${ic(pIcon(h.nhom))}</span><div class="grow"><b>${esc(h.sp)}</b><div class="row s8">${O.chip(h.st)}</div><span class="small muted">${esc(h.buoc)}</span></div>${ic('chevron-right')}</div>`;

  /* ================= S10 Trang chủ chủ thể ================= */
  O.screen('s10', {
    title: 'Trang chủ', code: 'S10', roles: ['chuthe'], device: 'Di động', crumbs: [],
    variants: [['default', 'Bình thường'], ['empty', 'Chưa có hồ sơ'], ['nodot', 'Chưa có đợt mở'], ['legal', 'Thiếu giấy tờ pháp lý']],
    render({ variant: v }) {
      const dotCard = v === 'nodot'
        ? O.card(`<div class="ct-fl" style="align-items:flex-start"><span class="nav-ico" style="background:var(--surface-3);color:var(--text-2);margin:0">${ic('calendar-clock')}</span><div class="stack s8"><h3>Chưa có đợt đánh giá nào đang mở</h3><p class="muted">Đợt đánh giá 2027 dự kiến mở nhận hồ sơ từ <b>01/03/2027</b>. Bạn vẫn có thể soạn trước hồ sơ và lưu nháp.</p></div></div>`)
        : `<section class="hero" style="min-height:0"><div class="hero-main"><span class="hero-tag" style="align-self:flex-start">${ic('calendar-range')} ${D.dot.ten}</span><h2 style="font-size:20px">Còn ${D.dot.conLai} ngày để nộp hồ sơ</h2><p style="color:rgba(255,255,255,.9)">Hạn nộp cho UBND xã: <b>${D.dot.hanXa}</b>. Hồ sơ nộp sau hạn sẽ chuyển sang đợt sau.</p></div><div class="hero-side" style="min-width:0;justify-content:center"><div class="ct-count"><b>${D.dot.conLai}</b><span>ngày còn lại</span></div></div></section>`;
      const legal = v === 'legal' ? O.banner({ tone: 'orange', icon: 'file-warning', title: 'Giấy chứng nhận VSATTP đã hết hạn', text: 'Cập nhật giấy tờ pháp lý trước khi nộp hồ sơ, nếu không hồ sơ sẽ bị chặn ở bước nộp.', actions: O.btn('Cập nhật', { kind: 'sm primary', go: 's11', size: 'sm' }) }) : '';
      const todo = v === 'empty' || v === 'nodot' ? '' : `<section class="stack s12"><h2>Việc cần làm</h2>
        <div class="ct-todo"><span class="ti">${ic('file-pen-line')}</span><div class="stack s8" style="flex:1;min-width:0"><b>Mắm thái đu đủ cần bổ sung minh chứng</b><span class="small muted">UBND Xã An Phú yêu cầu 4 mục. Hạn bổ sung <b>20/10/2026</b>, còn 1 ngày.</span><div>${O.btn('Bổ sung ngay', { kind: 'primary', icon: 'arrow-right', go: 's18' })}</div></div></div>
        <div class="ct-hs" data-go="s13"><span class="pi" style="background:var(--surface-3);color:var(--text-2)">${ic('pencil-line')}</span><div class="grow"><b>Hoàn thiện hồ sơ Khô cá lóc đồng</b><span class="small muted">Đã xong bước 1 và 2. Còn tự chấm điểm và nộp.</span></div>${ic('chevron-right')}</div></section>`;
      const list = v === 'empty'
        ? O.card(O.empty({ icon: 'sprout', title: 'Bạn chưa có hồ sơ sản phẩm nào', text: 'Chỉ cần 3 bước: nhập thông tin sản phẩm, tải minh chứng theo từng tiêu chí, rồi xem lại và nộp cho UBND xã.', action: `<div class="stack s12" style="align-items:center"><div class="row s8 small muted">${['Thông tin sản phẩm', 'Minh chứng', 'Nộp hồ sơ'].map((s, i) => `<span class="tag">${i + 1}. ${s}</span>`).join('')}</div>${O.btn('Tạo hồ sơ sản phẩm', { kind: 'primary lg', icon: 'plus', go: 's13' })}</div>` }))
        : `<section class="stack s12"><div class="row between"><h2>Hồ sơ của tôi</h2><a href="#s12" class="small strong">Xem tất cả</a></div><div class="grid g-2">${MY.slice(0, 4).map(hsCard).join('')}</div></section>`;
      return `${O.pageHead({ title: 'Xin chào, Nguyễn Thị Sáu', sub: 'Cơ sở Mắm Bà Sáu · Xã An Phú' })}
        ${legal}${dotCard}${todo}${list}
        ${O.card(`<div class="ct-fl"><span class="nav-ico" style="background:var(--brand-soft);color:var(--brand);margin:0">${ic('file-badge')}</span><div class="grow" style="flex:1;min-width:0"><b>Giấy tờ pháp lý</b><div class="small muted">${v === 'legal' ? '1 giấy tờ hết hạn, 1 sắp hết hạn' : '4 giấy tờ, 1 sắp hết hạn'}</div></div>${O.btn('Cập nhật', { kind: 'soft', size: 'sm', go: 's11' })}</div>`, { cls: 'tight' })}
        ${v !== 'nodot' ? `<button class="btn primary lg fab" data-go="s13">${ic('plus')}<span>Tạo hồ sơ sản phẩm</span></button>` : ''}`;
    },
  });

  /* ================= S11 Hồ sơ pháp lý ================= */
  const DOCS = [
    { loai: 'Giấy phép kinh doanh', so: '41H8-012345', cap: '12/03/2021', het: 'Không thời hạn', st: ['Còn hạn', 'green', 'circle-check'], f: 'Giay-phep-kinh-doanh.pdf', c: '' },
    { loai: 'Giấy chứng nhận VSATTP', so: '215/2023/ATTP-CNĐK', cap: '15/10/2023', het: '15/10/2026', st: ['Hết hạn', 'red', 'circle-x'], f: 'GCN-VSATTP-2023.pdf', c: 'exp' },
    { loai: 'Công bố chất lượng', so: '12/2025/MBS', cap: '05/01/2025', het: '05/12/2026', st: ['Sắp hết hạn', 'orange', 'clock'], f: 'Ban-tu-cong-bo-12-2025.pdf', c: 'soon' },
    { loai: 'Khác: Chứng nhận tập huấn ATTP', so: 'TH-2025-338', cap: '20/06/2025', het: '20/06/2028', st: ['Còn hạn', 'green', 'circle-check'], f: 'Chung-nhan-tap-huan.jpg', c: '' },
  ];
  const addDocDrawer = () => O.drawer({
    title: 'Thêm giấy tờ pháp lý', sub: 'Dùng chung cho mọi hồ sơ sản phẩm',
    body: `<div class="field"><label for="d-loai">Loại giấy tờ<span class="req">*</span></label><select class="select" id="d-loai"><option>Giấy phép kinh doanh</option><option selected>Giấy chứng nhận VSATTP</option><option>Công bố chất lượng</option><option>Khác</option></select></div>
      <div class="field"><label for="d-so">Số giấy<span class="req">*</span></label><input class="input" id="d-so" value="318/2026/ATTP-CNĐK"></div>
      <div class="form-grid"><div class="field"><label for="d-cap">Ngày cấp<span class="req">*</span></label><input class="input" id="d-cap" value="10/10/2026" inputmode="numeric"></div><div class="field"><label for="d-het">Ngày hết hạn</label><input class="input" id="d-het" value="10/10/2029" inputmode="numeric"><span class="hint">Để trống nếu không thời hạn</span></div></div>
      <div class="field"><label>Tệp đính kèm<span class="req">*</span></label>${O.drop('Kéo thả bản scan hoặc bấm để chọn', 'PDF, JPG, PNG. Tối đa 10 MB')}${O.file({ name: 'GCN-VSATTP-2026.pdf', size: '1,4 MB', type: 'pdf' }, { remove: true, progress: 72 })}</div>`,
    foot: `${O.btn('Hủy', { kind: 'ghost', attrs: 'data-close' })}${O.btn('Lưu giấy tờ', { kind: 'primary', attrs: 'data-close data-toast="Đã lưu giấy tờ pháp lý"' })}`,
  });
  O.screen('s11', {
    title: 'Hồ sơ pháp lý', code: 'S11', roles: ['chuthe'], device: 'Di động', crumbs: [],
    variants: [['default', 'Có giấy tờ'], ['empty', 'Chưa có giấy tờ']],
    render({ variant: v }) {
      const head = O.pageHead({ title: 'Hồ sơ pháp lý', sub: 'Giấy tờ của Cơ sở Mắm Bà Sáu, dùng chung cho tất cả hồ sơ sản phẩm.', actions: O.btn('Thêm giấy tờ', { kind: 'primary', icon: 'plus', id: 'add-doc' }) });
      if (v === 'empty') return head + O.card(O.empty({ icon: 'file-badge', title: 'Chưa có giấy tờ pháp lý', text: 'Thêm giấy phép kinh doanh và giấy chứng nhận VSATTP để có thể nộp hồ sơ sản phẩm.', action: O.btn('Thêm giấy tờ đầu tiên', { kind: 'primary', icon: 'plus', attrs: 'data-adddoc' }) }));
      return `${head}
        ${O.banner({ tone: 'red', icon: 'triangle-alert', title: 'Có 1 giấy tờ đã hết hạn', text: 'Giấy chứng nhận VSATTP hết hạn ngày 15/10/2026. Hồ sơ nộp mới sẽ bị chặn cho đến khi bạn cập nhật bản còn hạn.' })}
        <div class="grid g-2">${DOCS.map((d) => `<div class="ct-doc ${d.c}"><div class="dh"><span class="di">${ic('file-badge')}</span><div style="flex:1;min-width:0" class="stack s8"><b>${esc(d.loai)}</b><span>${O.tag(d.st[0], d.st[1], d.st[2])}</span></div></div>
          ${O.dl([['Số giấy', esc(d.so)], ['Ngày cấp', d.cap], ['Ngày hết hạn', d.het]])}
          ${O.file({ name: d.f, size: '1,2 MB', type: d.f.endsWith('jpg') ? 'jpg' : 'pdf' })}
          ${d.c === 'exp' ? O.btn('Cập nhật bản còn hạn', { kind: 'primary', icon: 'refresh-cw', attrs: 'data-adddoc' }) : d.c === 'soon' ? `<p class="small" style="color:var(--c-orange)">Còn 47 ngày. Nên chuẩn bị gia hạn.</p>` : ''}</div>`).join('')}</div>
        <p class="small faint">Cảnh báo tự động qua thông báo sẽ có ở giai đoạn sau. Hiện hệ thống chỉ hiển thị trạng thái theo ngày hết hạn.</p>`;
    },
    mount(root) { root.querySelectorAll('#add-doc,[data-adddoc]').forEach((b) => b.addEventListener('click', addDocDrawer)); },
  });

  /* ================= S12 Danh sách hồ sơ ================= */
  O.screen('s12', {
    title: 'Hồ sơ của tôi', code: 'S12', roles: ['chuthe'], device: 'Di động', crumbs: [],
    variants: [['default', 'Có dữ liệu'], ['empty', 'Trống'], ['loading', 'Đang tải'], ['error', 'Lỗi tải']],
    render({ variant: v }) {
      const head = O.pageHead({ title: 'Hồ sơ của tôi', sub: 'Tất cả hồ sơ sản phẩm qua các đợt đánh giá.', actions: O.btn('Tạo hồ sơ sản phẩm', { kind: 'primary', icon: 'plus', go: 's13' }) });
      const filters = `<div class="toolbar">${O.fchips([['Tất cả', 4], ['Đang soạn', 1], ['Đang xử lý', 1], ['Cần bổ sung', 1], ['Có kết quả', 1]])}<span class="spacer"></span><select class="select" style="width:auto;min-width:160px" aria-label="Lọc theo đợt"><option>Tất cả các đợt</option><option>Đợt 2026</option><option>Đợt 2025</option></select></div>`;
      let body;
      if (v === 'empty') body = O.empty({ icon: 'folder-open', title: 'Chưa có hồ sơ nào', text: 'Tạo hồ sơ sản phẩm đầu tiên để tham gia đợt đánh giá OCOP.', action: O.btn('Tạo hồ sơ sản phẩm', { kind: 'primary', icon: 'plus', go: 's13' }) });
      else if (v === 'loading') body = `<div style="padding:20px">${O.skeleton(4)}</div>`;
      else if (v === 'error') body = O.loadError('danh sách hồ sơ');
      else body = O.table({
        cols: [{ k: 'sp', l: 'Sản phẩm', sort: true }, { k: 'nhom', l: 'Nhóm sản phẩm' }, { k: 'dot', l: 'Đợt' }, { k: 'st', l: 'Trạng thái' }, { k: 'cn', l: 'Cập nhật', sort: true }, { k: 'kq', l: 'Hạng, điểm' }, { k: 'a', l: '', cls: 'r' }],
        rows: MY, pager: false,
        cell: (h, c) => ({ sp: O.prodCell(h), nhom: esc(h.nhom), dot: h.dot, st: O.chip(h.st), cn: h.cn, kq: h.sao ? `${O.stars(h.sao)} <span class="small muted">${h.diem} điểm</span>` : '<span class="faint">Chưa có</span>', a: O.btn(h.act[0], { kind: h.st === 'bosung' ? 'primary' : 'soft', size: 'sm', icon: h.act[2], go: h.act[1] }) })[c.k],
        card: (h) => `<div class="mcard"><div class="ct-fl" style="justify-content:space-between"><b>${esc(h.sp)}</b>${h.sao ? O.stars(h.sao) : ''}</div><span class="small faint">${h.ma} · ${h.dot}</span><div>${O.chip(h.st)}</div><span class="small muted">${esc(h.buoc)}</span>${O.btn(h.act[0], { kind: h.st === 'bosung' ? 'primary' : 'soft', icon: h.act[2], go: h.act[1], attrs: 'style="width:100%"' })}</div>`,
      });
      return `${head}${filters}${O.card(body, { cls: 'flush' })}`;
    },
  });

  /* ================= S13 Tạo và sửa hồ sơ ================= */
  const WZ = [['Thông tin chung', 's13'], ['Minh chứng theo tiêu chí', 's14'], ['Tự chấm điểm', 's15'], ['Xem lại và nộp', 's16']];
  const wzBar = (prev, next, nextLabel = 'Tiếp tục') => `<div class="scorebar"><span class="small muted row s8">${ic('circle-check')} Đã lưu 14:32</span><div class="acts">${O.btn('Lưu nháp', { kind: 'ghost', icon: 'save', attrs: 'data-toast="Đã lưu nháp lúc 14:33"' })}${prev ? O.btn('Quay lại', { icon: 'arrow-left', go: prev }) : ''}${O.btn(nextLabel, { kind: 'primary', icon: 'arrow-right', go: next })}</div></div>`;
  const draftHead = (step) => `${O.pageHead({ title: 'Khô cá lóc đồng', chips: `${O.chip('nhap')}<span class="tag">HS-2026-0132</span><span class="tag">${D.dot.ten}</span>` })}${O.wizard(WZ, step)}`;
  const CRUMB_DRAFT = [['Hồ sơ của tôi', 's12'], ['HS-2026-0132', 's12']];
  O.screen('s13', {
    title: 'Thông tin chung', navTitle: 'Tạo, sửa hồ sơ', code: 'S13', roles: ['chuthe'], device: 'Di động', crumbs: CRUMB_DRAFT,
    variants: [['default', 'Đang soạn'], ['errors', 'Lỗi từng trường'], ['version', 'Bộ tiêu chí đổi phiên bản']],
    render({ variant: v }) {
      const err = v === 'errors';
      const f = (id, label, val, { req, ta, hint, e, ph } = {}) => `<div class="field ${ta ? 'full' : ''}"><label for="${id}">${label}${req ? '<span class="req">*</span>' : ''}</label>${ta ? `<textarea class="textarea ${e ? 'invalid' : ''}" id="${id}" placeholder="${ph || ''}">${val}</textarea>` : `<input class="input ${e ? 'invalid' : ''}" id="${id}" value="${val}" placeholder="${ph || ''}">`}${e ? `<span class="err">${ic('circle-alert')}${e}</span>` : hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
      return `${draftHead(0)}
        ${v === 'version' ? O.banner({ tone: 'purple', icon: 'git-compare', title: 'Bộ tiêu chí vừa được cập nhật lên phiên bản 2.1', text: 'Thay đổi: tiêu chí B5 "Truy xuất nguồn gốc" tăng từ 3 lên 5 điểm; thêm tiêu chí C5 "Tiềm năng xuất khẩu". 1 minh chứng cần gắn lại.', actions: O.btn('Xem khác biệt', { size: 'sm', attrs: 'data-diff' }) }) : ''}
        ${err ? O.banner({ tone: 'red', icon: 'circle-alert', title: 'Còn 2 trường cần sửa', text: 'Kiểm tra các trường được đánh dấu đỏ bên dưới rồi bấm Tiếp tục.' }) : ''}
        ${O.card(`<div class="form-grid">
          ${f('p-ten', 'Tên sản phẩm', err ? '' : 'Khô cá lóc đồng', { req: 1, e: err ? 'Nhập tên sản phẩm, ví dụ "Khô cá lóc đồng".' : '' })}
          <div class="field"><label for="p-nhom">Nhóm sản phẩm<span class="req">*</span></label><select class="select" id="p-nhom">${D.nhom.map((n) => `<option ${n === 'Thực phẩm' ? 'selected' : ''}>${n}</option>`).join('')}</select><span class="hint">Nhóm quyết định bộ tiêu chí áp dụng</span></div>
          ${f('p-mota', 'Mô tả sản phẩm', 'Khô cá lóc làm từ cá lóc đồng đánh bắt mùa nước nổi, phơi nắng tự nhiên 2 ngày, không chất bảo quản.', { ta: 1 })}
          ${f('p-nl', 'Nguyên liệu và nguồn gốc', 'Cá lóc đồng thu mua từ 12 hộ đánh bắt tại Xã An Phú; muối hạt Bạc Liêu.', { ta: 1 })}
          ${f('p-qt', 'Quy trình sản xuất', 'Sơ chế, ướp muối 4 giờ, phơi nắng 2 ngày, đóng gói hút chân không.', { ta: 1 })}
          ${f('p-bb', 'Bao bì và nhãn mác', 'Túi hút chân không 250 g và 500 g, nhãn in đủ thông tin bắt buộc.', {})}
          ${f('p-dd', 'Địa điểm sản xuất', 'Ấp Phú Lợi, Xã An Phú', {})}
          ${f('p-cb', 'Số công bố chất lượng', err ? '12/2025' : '15/2026/MBS', { e: err ? 'Số công bố phải theo dạng số/năm/ký hiệu, ví dụ 15/2026/MBS.' : '' })}
          ${f('p-cbn', 'Ngày công bố', '02/02/2026', { hint: 'Định dạng dd/mm/yyyy' })}
          <div class="field full"><label>Ảnh sản phẩm</label><div class="ct-photos"><div class="ct-photo"><span class="main">Ảnh đại diện</span>${ic('image')}</div><div class="ct-photo">${ic('image')}</div><div class="ct-photo">${ic('image')}</div><label class="ct-photo add">${ic('camera')}<input type="file" class="sr" accept="image/*" multiple data-upload></label></div><span class="hint">Bấm giữ một ảnh để chọn làm ảnh đại diện. Tối đa 10 ảnh.</span></div>
          ${f('p-story', 'Bản sắc văn hóa, nguồn gốc, câu chuyện sản phẩm', 'Nghề làm khô cá ở An Phú có từ thời ông bà, gắn với mùa nước nổi tháng 9 đến tháng 11. Mỗi mẻ khô đều được phơi trên giàn tre trước sân nhà…', { ta: 1, hint: 'Viết như kể cho khách hàng nghe, khoảng 200 đến 500 chữ.' })}
        </div>`, { title: 'Bước 1. Thông tin chung', sub: 'Các trường có dấu * là bắt buộc.' })}
        ${wzBar(null, 's14')}`;
    },
    mount(root) {
      const sel = root.querySelector('#p-nhom');
      sel.addEventListener('change', () => {
        const nv = sel.value;
        O.confirm({ title: 'Đổi nhóm sản phẩm?', kind: 'danger', icon: 'triangle-alert', what: `Bộ tiêu chí sẽ chuyển sang nhóm "${esc(nv)}". 7 minh chứng đã gắn cần gắn lại theo tiêu chí mới.`, notify: 'Không ai, đây là hồ sơ nháp.', undo: 'Có, đổi lại nhóm "Thực phẩm" trước khi nộp.', confirmText: 'Đổi nhóm', onConfirm: () => O.toast('Đã đổi nhóm sản phẩm') });
        sel.value = 'Thực phẩm';
      });
      root.querySelector('[data-diff]')?.addEventListener('click', () => O.modal({ title: 'Khác biệt giữa phiên bản 2.0 và 2.1', icon: 'git-compare', body: `<div class="stack s12"><div class="ct-chk" style="--t:var(--c-orange)"><span class="ci">${ic('pencil')}</span><div><b>B5. Truy xuất nguồn gốc</b><div class="small">Điểm tối đa <span class="diff-old">3</span> <span class="diff-new">5</span></div></div></div><div class="ct-chk" style="--t:var(--c-green)"><span class="ci">${ic('plus')}</span><div><b>C5. Tiềm năng xuất khẩu</b><div class="small">Tiêu chí mới, tối đa 5 điểm. Chưa có minh chứng.</div></div></div><div class="ct-chk" style="--t:var(--c-red)"><span class="ci">${ic('unlink')}</span><div><b>1 minh chứng cần gắn lại</b><div class="small">Ke-hoach-xuat-khau.pdf trước gắn với C4.</div></div></div></div>`, foot: O.btn('Đã hiểu', { kind: 'primary', attrs: 'data-close' }) }));
    },
  });

  /* ================= S14 Minh chứng theo tiêu chí ================= */
  O.screen('s14', {
    title: 'Minh chứng theo tiêu chí', code: 'S14', roles: ['chuthe'], device: 'Di động', crumbs: CRUMB_DRAFT,
    render() {
      const has = D.tieuchi.filter((t) => t.ev > 0).length; // 16
      const shown = 12;
      const crit = (t, i) => {
        const ok = i % 3 !== 2 && t.ev > 0;
        const files = ok ? D.files.filter((f) => f.crit.startsWith(t.code)).concat(D.files.filter((f) => f.crit.startsWith(t.code)).length ? [] : [{ name: `Minh-chung-${t.code}.pdf`, size: '540 KB', type: 'pdf' }]) : [];
        return `<div class="crit ${i === 1 ? '' : 'closed'}"><div class="crit-head" data-toggle><span class="crit-code">${t.code}</span><span class="crit-name">${esc(t.name)}</span><span class="small muted nowrap">Tối đa ${t.max} điểm</span>${ok ? O.tag('Đã có', 'green', 'circle-check') : O.tag('Thiếu minh chứng', 'orange', 'circle-alert')}${ic('chevron-down', 'chev')}</div>
        <div class="crit-body">
          <details><summary class="small strong" style="cursor:pointer;color:var(--brand)">Cách đánh giá</summary><p class="small muted" style="margin-top:6px">Đánh giá dựa trên hồ sơ chứng minh và kiểm tra thực tế. Mức tối đa khi có đầy đủ minh chứng hợp lệ, còn hiệu lực.</p></details>
          <div><div class="label" style="margin-bottom:6px">Minh chứng yêu cầu</div><ul class="small muted" style="margin:0;padding-left:20px"><li>Hợp đồng, hóa đơn hoặc giấy tờ chứng minh</li><li>Ảnh chụp thực tế (nếu có)</li></ul></div>
          ${files.map((f) => O.file(f, { remove: true })).join('')}
          ${O.drop('Kéo thả tệp cho tiêu chí ' + t.code, 'PDF, JPG, PNG, DOCX. Tối đa 20 MB. Một tệp có thể gắn nhiều tiêu chí.', true)}
          <div class="field"><label for="gt-${t.code}">Giải trình</label><textarea class="textarea" id="gt-${t.code}" style="min-height:72px" placeholder="Giải thích thêm nếu minh chứng chưa thể hiện đủ">${i === 1 ? 'Hợp đồng thu mua với 12 hộ, kèm danh sách hộ và sản lượng năm 2025.' : ''}</textarea></div>
        </div></div>`;
      };
      let i = 0;
      return `${draftHead(1)}
        ${O.card(`<div class="stack s12"><div class="row between"><b>${shown} / ${D.tieuchi.length} tiêu chí đã có minh chứng</b><span class="small muted">${D.dot.phienBan}</span></div>${O.progress(shown, D.tieuchi.length, '', 'lg')}<p class="small muted">Tiêu chí thiếu minh chứng vẫn cho đi tiếp nhưng sẽ được đánh dấu ở bước nộp.</p></div>`, { cls: 'tight' })}
        ${D.parts.map((p) => `<section><div class="part-head"><h3>${p.name}</h3><span class="tag">Tối đa ${p.max} điểm</span></div>${D.tieuchi.filter((t) => t.part === p.id).map((t) => crit(t, i++)).join('')}</section>`).join('')}
        ${wzBar('s13', 's15')}`;
    },
  });

  /* ================= S15 Tự chấm điểm thử ================= */
  O.screen('s15', {
    title: 'Tự chấm điểm thử', code: 'S15', roles: ['chuthe'], device: 'Di động', crumbs: CRUMB_DRAFT,
    variants: [['partial', 'Chưa chấm hết'], ['full', 'Đã chấm đủ'], ['low', 'Dưới 50 điểm']],
    render({ variant: v }) {
      const val = (t, i) => (v === 'partial' ? (i > 13 ? '' : t.ttv) : v === 'low' ? Math.max(0, Math.round(t.ttv * 0.55)) : t.ttv);
      const list = D.parts.map((p) => `<section class="stack s8"><div class="part-head"><h3>${p.name}</h3><span class="pt" data-pt="${p.id}">0 / ${p.max}</span></div>${D.tieuchi.map((t, i) => [t, i]).filter(([t]) => t.part === p.id).map(([t, i]) => `<div class="crit"><div class="crit-head" style="cursor:default"><span class="crit-code">${t.code}</span><span class="crit-name">${esc(t.name)}${t.ev === 0 ? `<br>${O.tag('Chưa có minh chứng', 'orange', 'circle-alert')}` : ''}</span>${O.scoreInput({ id: 'sc-' + t.code, value: val(t, i), max: t.max, label: t.code + ' ' + t.name })}</div></div>`).join('')}</section>`).join('');
      const res = `<section class="card raised ct-res stack" id="s15-res"><div class="row between"><h2>Kết quả ước lượng</h2><span id="s15-tmp"></span></div>
        <div class="row" style="align-items:flex-end"><div class="ct-big"><span id="s15-total">0</span><small> / 100</small></div><div id="s15-stars"></div></div>
        <div class="stack s12">${D.parts.map((p) => `<div class="ct-part"><span>${p.name.replace(/^Phần (\w)\. /, 'Phần $1: ')}</span><b class="num" data-ps="${p.id}">0 / ${p.max}</b><div class="progress" data-pb="${p.id}"><i style="width:0"></i></div></div>`).join('')}</div>
        <div id="s15-warn"></div>
        <p class="small faint ct-fl" style="gap:8px;align-items:flex-start">${ic('info')}<span>Điểm tự chấm chỉ mang tính tham khảo, không phải kết quả chính thức.</span></p></section>`;
      return `${draftHead(2)}<div class="grid g-main ct-swap"><div class="stack s24">${list}</div>${res}</div>${wzBar('s14', 's16')}`;
    },
    mount(root) {
      const upd = () => {
        let filled = 0;
        const s = O.sumParts((t) => { const x = root.querySelector('#sc-' + t.code).value; if (x !== '') filled++; return x; });
        root.querySelector('#s15-total').textContent = s.T;
        D.parts.forEach((p) => { root.querySelector(`[data-ps="${p.id}"]`).textContent = `${s[p.id]} / ${p.max}`; root.querySelector(`[data-pt="${p.id}"]`).textContent = `${s[p.id]} / ${p.max}`; root.querySelector(`[data-pb="${p.id}"] i`).style.width = (s[p.id] / p.max) * 100 + '%'; });
        const r = O.rank(s.T);
        root.querySelector('#s15-stars').innerHTML = r ? `<div class="stack s8" style="gap:2px">${O.stars(r, 5, 'lg')}<span class="small strong">Ước lượng ${r} sao</span></div>` : `<span class="small strong" style="color:var(--c-red)">Chưa đạt</span>`;
        const incomplete = filled < D.tieuchi.length;
        root.querySelector('#s15-tmp').innerHTML = incomplete ? O.tag(`Ước lượng tạm thời · ${filled}/${D.tieuchi.length}`, 'orange', 'hourglass') : O.tag('Đã chấm đủ', 'green', 'circle-check');
        root.querySelector('#s15-warn').innerHTML = s.T < 50 && !incomplete ? O.banner({ tone: 'red', icon: 'circle-alert', title: 'Chưa đạt ngưỡng 3 sao (50 điểm)', text: 'Quay lại bổ sung minh chứng cho các tiêu chí còn thấp để cải thiện điểm.', actions: O.btn('Bổ sung minh chứng', { size: 'sm', go: 's14' }) }) : '';
        O.bind(root.querySelector('#s15-warn'));
      };
      root.addEventListener('input', (e) => { if (e.target.closest('[data-score]')) upd(); });
      upd();
    },
  });

  /* ================= S16 Xem lại và nộp ================= */
  O.screen('s16', {
    title: 'Xem lại và nộp', code: 'S16', roles: ['chuthe'], device: 'Di động', crumbs: CRUMB_DRAFT,
    variants: [['default', 'Chỉ có cảnh báo'], ['block', 'Có lỗi chặn'], ['closed', 'Đợt đã đóng'], ['done', 'Nộp thành công']],
    render({ variant: v }) {
      if (v === 'done') return `<div class="card raised" style="max-width:620px;margin:20px auto;width:100%"><div class="stack" style="align-items:center;text-align:center;gap:14px"><div class="big-ok">${ic('circle-check')}</div><h1>Đã nộp hồ sơ</h1><p class="muted">Hồ sơ <b>Khô cá lóc đồng</b> đã được chốt phiên bản và gửi tới UBND Xã An Phú.</p><div class="tag" style="font-size:16px;padding:8px 16px">Mã hồ sơ: <b style="margin-left:6px">HS-2026-0132</b></div></div>
        <hr class="divider" style="margin:20px 0"><h3 style="margin-bottom:12px">Bước tiếp theo</h3>${O.timeline([['landmark', 'blue', 'UBND xã tiếp nhận và kiểm tra', 'Thường trong 5 đến 7 ngày làm việc'], ['file-pen-line', 'orange', 'Nếu cần bổ sung, bạn sẽ nhận thông báo', 'Kèm danh sách mục và hạn bổ sung'], ['send', 'green', 'Xã gửi hồ sơ đạt sơ bộ lên tỉnh', `Trước hạn ${D.dot.hanXa}`]])}
        <div class="stack s8" style="margin-top:8px">${O.btn('Xem hồ sơ', { kind: 'primary lg', icon: 'eye', go: 's17', attrs: 'style="width:100%"' })}${O.btn('Về trang chủ', { kind: 'ghost', go: 's10', attrs: 'style="width:100%"' })}</div></div>`;
      const block = v === 'block', closed = v === 'closed';
      const chk = [
        ['ok', 'Đủ các trường bắt buộc', 'Thông tin chung đã nhập đầy đủ.'],
        block ? ['err', 'Giấy chứng nhận VSATTP đã hết hạn', 'Lỗi chặn. Cập nhật bản còn hạn trong Hồ sơ pháp lý.', 's11'] : ['ok', 'Giấy tờ pháp lý còn hạn', '4 giấy tờ, 1 sắp hết hạn (Công bố chất lượng).'],
        ['warn', '2 tiêu chí chưa có minh chứng', 'B5 Truy xuất nguồn gốc, C5 Tiềm năng xuất khẩu. Vẫn nộp được nhưng có thể bị yêu cầu bổ sung.', 's14'],
        ['ok', 'Đã tự chấm điểm thử', 'Ước lượng 78 điểm, 4 sao.'],
      ];
      const T = { ok: ['green', 'check'], warn: ['orange', 'triangle-alert'], err: ['red', 'x'] };
      const summary = O.card(`${O.dl([['Tên sản phẩm', 'Khô cá lóc đồng'], ['Nhóm sản phẩm', 'Thực phẩm'], ['Chủ thể', 'Cơ sở Mắm Bà Sáu'], ['Địa điểm sản xuất', 'Ấp Phú Lợi, Xã An Phú'], ['Công bố chất lượng', '15/2026/MBS, ngày 02/02/2026'], ['Ảnh sản phẩm', '3 ảnh']])}
        <hr class="divider" style="margin:18px 0"><h3 style="margin-bottom:12px">Minh chứng theo phần</h3><div class="stack s12">${D.parts.map((p) => { const ts = D.tieuchi.filter((t) => t.part === p.id); const n = ts.filter((t) => t.ev > 0).length; return `<div class="ct-part"><span>${p.name}</span><b class="num">${n} / ${ts.length} tiêu chí</b>${O.progress(n, ts.length, n < ts.length ? 'orange' : '')}</div>`; }).join('')}</div>`, { title: 'Tóm tắt hồ sơ', actions: O.btn('Sửa', { kind: 'ghost', size: 'sm', icon: 'pencil', go: 's13' }) });
      const check = `<section class="card raised stack ct-res"><h2>Kiểm tra trước khi nộp</h2>
        ${closed ? O.banner({ tone: 'red', icon: 'calendar-x', title: 'Đợt đánh giá 2026 đã đóng nhận hồ sơ', text: 'Hồ sơ được giữ nguyên dạng nháp. Bạn có thể chuyển sang đợt sau khi đợt mới mở.', actions: O.btn('Chuyển sang đợt 2027', { size: 'sm', attrs: 'data-toast="Đã đặt hồ sơ vào đợt 2027"' }) }) : `<div class="row between"><span class="small muted">Hạn nộp của đợt ${D.dot.hanXa}</span><div class="ct-cd"><div><b>05</b><span>ngày</span></div><div><b>14</b><span>giờ</span></div><div><b>26</b><span>phút</span></div></div></div>`}
        <div>${chk.map(([k, t, d, go]) => `<div class="ct-chk" style="--t:var(--c-${T[k][0]})"><span class="ci">${ic(T[k][1])}</span><div class="stack s8" style="gap:2px;flex:1;min-width:0"><b>${t}</b><span class="small muted">${d}</span>${go ? `<a href="#${go}" class="small strong">Đi tới sửa</a>` : ''}</div></div>`).join('')}</div>
        <label class="check"><input type="checkbox" id="s16-cf" ${closed ? 'disabled' : ''}><span>Tôi cam kết các thông tin và minh chứng trong hồ sơ là chính xác, trung thực và chịu trách nhiệm trước pháp luật.</span></label>
        <button class="btn primary lg" id="s16-submit" disabled>${ic('send')}<span>Nộp hồ sơ</span></button>
        ${block ? '<p class="small" style="color:var(--c-red)">Sửa lỗi chặn để có thể nộp.</p>' : ''}</section>`;
      return `${draftHead(3)}<div class="grid g-main ct-swap">${summary}${check}</div>`;
    },
    mount(root, { variant: v }) {
      const cf = root.querySelector('#s16-cf'), b = root.querySelector('#s16-submit');
      if (!cf) return;
      cf.addEventListener('change', () => { b.disabled = !cf.checked || v === 'block' || v === 'closed'; });
      b.addEventListener('click', () => O.confirm({ title: 'Nộp hồ sơ Khô cá lóc đồng?', icon: 'send', what: 'Sau khi nộp, hồ sơ được chốt phiên bản và gửi UBND xã. Muốn sửa phải chờ xã yêu cầu bổ sung.', notify: 'UBND Xã An Phú (cán bộ tiếp nhận) và bạn.', undo: 'Có thể rút hồ sơ trước khi xã bắt đầu xử lý.', confirmText: 'Nộp hồ sơ', onConfirm: () => O.go('s16', { variant: 'done' }) }));
    },
  });

  /* ================= S17 Chi tiết hồ sơ ================= */
  const STEXT = { danop: 'Hồ sơ của bạn đã được gửi tới UBND xã và đang chờ tiếp nhận.', hdxemxet: 'Hồ sơ của bạn đang được hội đồng tỉnh xem xét.', bosung: 'UBND xã cần bạn bổ sung một số minh chứng trước khi xét tiếp.' };
  O.screen('s17', {
    title: 'Chi tiết hồ sơ', code: 'S17', roles: ['chuthe'], device: 'Di động', crumbs: [['Hồ sơ của tôi', 's12']],
    variants: [['hd', 'Hội đồng đang xem xét'], ['danop', 'Vừa nộp, chờ xã']],
    render({ variant: v }) {
      const nop = v === 'danop';
      const h = nop ? { ma: 'HS-2026-0132', sp: 'Khô cá lóc đồng', st: 'danop', step: 1 } : { ma: 'HS-2026-0123', sp: 'Mắm cá linh khô', st: 'hdxemxet', step: 3 };
      const next = nop
        ? `<div class="ct-next"><span class="ni">${ic('landmark')}</span><div class="stack s8" style="flex:1;min-width:0"><b>Bước tiếp theo: UBND Xã An Phú tiếp nhận</b><span class="small muted">Người xử lý: Ngô Bảo Ngọc, cán bộ văn phòng. Dự kiến trước 25/10/2026.</span><div class="row s8">${O.btn('Rút hồ sơ', { kind: 'danger-ghost', size: 'sm', icon: 'undo-2', id: 's17-rut' })}</div></div></div>`
        : `<div class="ct-next"><span class="ni">${ic('users')}</span><div class="stack s8" style="flex:1;min-width:0"><b>Bước tiếp theo: Hội đồng tỉnh họp chốt điểm</b><span class="small muted">Hồ sơ đang ở Hội đồng đánh giá cấp tỉnh. Dự kiến có kết quả trước ${D.dot.hanTinh}. Bạn không cần làm gì thêm lúc này.</span></div></div>`;
      const overview = `<div class="stack">${next}${O.card(O.dl([['Mã hồ sơ', h.ma], ['Tên sản phẩm', h.sp], ['Nhóm sản phẩm', 'Thực phẩm'], ['Đợt', D.dot.ten], ['Chủ thể', 'Cơ sở Mắm Bà Sáu'], ['Xã/phường', 'Xã An Phú'], ['Ngày nộp', '02/04/2026 09:45'], ['Phiên bản hồ sơ', 'Phiên bản 2 (sau bổ sung)']]), { title: 'Thông tin hồ sơ', sub: 'Chỉ đọc. Hồ sơ đã nộp không sửa trực tiếp được.' })}</div>`;
      const ev = O.card(`<div class="stack s12">${D.parts.map((p) => `<div class="stack s8"><h3>${p.name}</h3>${D.files.filter((f) => f.crit.startsWith(p.id)).map((f) => O.file(f)).join('') || '<p class="small faint">Xem đầy đủ trong từng tiêu chí.</p>'}</div>`).join('')}</div>`);
      const hist = O.card(O.timeline([
        ['users', 'purple', 'Hội đồng tỉnh bắt đầu xem xét', '12/10/2026 08:30 · Thư ký Trần Thị B'],
        ['file-check-2', 'purple', 'Tổ tư vấn phát hành báo cáo thẩm định', '10/10/2026 16:10 · Hoàng Thị E'],
        ['arrow-up-right', 'blue', 'Sở NN&MT tiếp nhận hồ sơ', '05/05/2026 10:02 · Phan Thu Hà'],
        ['send', 'blue', 'UBND xã gửi hồ sơ lên tỉnh', '18/04/2026 15:20 · Lý do: đạt đánh giá sơ bộ'],
        ['file-pen-line', 'orange', 'Bạn nộp lại sau bổ sung', '14/04/2026 20:11 · Phiên bản 2'],
        ['file-warning', 'orange', 'UBND xã yêu cầu bổ sung 2 mục', '08/04/2026 09:00 · Ngô Bảo Ngọc'],
        ['send', 'green', 'Bạn nộp hồ sơ', '02/04/2026 09:45 · Phiên bản 1'],
      ]));
      const req = O.card(`<div class="list">${[['Bổ sung hợp đồng thu mua cá linh', 'Đã trả lời 14/04/2026'], ['Ảnh chụp khu phơi sạch', 'Đã trả lời 14/04/2026']].map(([t, s]) => `<div class="li"><span class="nav-ico" style="background:var(--surface-3);color:var(--c-green);margin:0">${ic('circle-check')}</span><div class="grow"><b>${t}</b><div class="small muted">${s}</div></div>${O.tag('Đã đóng', 'gray')}</div>`).join('')}</div>`, { title: 'Yêu cầu bổ sung', sub: 'Từ UBND Xã An Phú, ngày 08/04/2026' });
      const kq = O.card(O.empty({ icon: 'hourglass', title: 'Chưa có kết quả', text: 'Kết quả sẽ hiển thị tại đây sau khi hội đồng chốt điểm và Sở công bố.' }));
      return `${O.pageHead({ title: h.sp, chips: `${O.chip(h.st)}<span class="tag">${h.ma}</span><span class="tag">${D.dot.ten}</span>`, sub: STEXT[h.st] })}
        ${O.card(O.stepper(h.step, nop ? ['14/10/2026', '', '', '', ''] : undefined), { cls: 'tight' })}
        ${O.tabs([['tq', 'Tổng quan'], ['mc', 'Minh chứng'], ['ls', 'Lịch sử'], ['bs', 'Yêu cầu bổ sung', 2], ['kq', 'Kết quả']], { tq: overview, mc: ev, ls: hist, bs: req, kq }, { style: 'line' })}`;
    },
    mount(root) {
      root.querySelector('#s17-rut')?.addEventListener('click', () => O.confirm({ title: 'Rút hồ sơ Khô cá lóc đồng?', kind: 'danger', icon: 'undo-2', what: 'Hồ sơ chuyển sang trạng thái "Đã rút" và không được xét trong đợt này.', notify: 'UBND Xã An Phú.', undo: 'Không. Muốn tham gia lại phải tạo hồ sơ mới.', extra: `<div class="field"><label for="rut-ly">Lý do rút hồ sơ<span class="req">*</span></label><textarea class="textarea" id="rut-ly" placeholder="Ví dụ: cần hoàn thiện bao bì trước khi nộp"></textarea></div>`, confirmText: 'Rút hồ sơ', onConfirm: () => O.toast('Đã rút hồ sơ HS-2026-0132') }));
    },
  });

  /* ================= S18 Yêu cầu bổ sung và nộp lại ================= */
  const REQ = [
    { t: 'Bổ sung hợp đồng thu mua đu đủ với nông hộ', link: 'Tiêu chí A2: Nguồn gốc nguyên liệu', ans: 'Đã tải hợp đồng với 6 hộ trồng đu đủ tại ấp Phú Lợi.', file: 'Hop-dong-thu-mua-du-du.pdf' },
    { t: 'Ảnh chụp khu vực sơ chế có mái che', link: 'Tiêu chí A5: Bảo vệ môi trường', ans: 'Ảnh khu sơ chế sau khi làm mái tôn và nền xi măng.', file: 'Khu-so-che.jpg' },
    { t: 'Giấy chứng nhận VSATTP còn hiệu lực', link: 'Giấy tờ pháp lý: Giấy chứng nhận VSATTP', ans: '', file: '' },
    { t: 'Phiếu kiểm nghiệm chỉ tiêu vi sinh mới nhất', link: 'Tiêu chí C2: Chỉ tiêu an toàn thực phẩm', ans: '', file: '' },
  ];
  O.screen('s18', {
    title: 'Yêu cầu bổ sung', code: 'S18', roles: ['chuthe'], device: 'Di động', crumbs: [['Hồ sơ của tôi', 's12'], ['HS-2026-0135', 's17']],
    variants: [['default', 'Đang trả lời'], ['late', 'Quá hạn'], ['sent', 'Đã nộp lại']],
    render({ variant: v }) {
      const sent = v === 'sent';
      const item = (r, i) => { const done = sent || !!r.ans; return `<div class="ct-item ${done ? 'done' : ''}" data-item><div class="ct-fl" style="justify-content:space-between;align-items:flex-start"><b>${i + 1}. ${esc(r.t)}</b><span data-chip>${done ? O.tag('Đã trả lời', 'green', 'circle-check') : O.tag('Chưa trả lời', 'orange', 'circle-dashed')}</span></div>
        <a href="#${r.link.startsWith('Giấy') ? 's11' : 's14'}" class="small strong row s8">${ic('link')}${esc(r.link)}</a>
        <div class="field"><label for="ans-${i}">Trả lời</label><textarea class="textarea" id="ans-${i}" style="min-height:72px" ${sent ? 'readonly' : ''} placeholder="Mô tả nội dung bạn bổ sung">${esc(sent && !r.ans ? 'Đã tải bản cập nhật.' : r.ans)}</textarea></div>
        ${r.file || sent ? O.file({ name: r.file || `Bo-sung-muc-${i + 1}.pdf`, size: '960 KB', type: (r.file || '').endsWith('jpg') ? 'jpg' : 'pdf' }, { remove: !sent }) : ''}
        ${sent ? '' : O.drop('Kéo thả tệp bổ sung', 'PDF, JPG, PNG. Tối đa 20 MB', true)}</div>`; };
      return `${O.pageHead({ title: 'Mắm thái đu đủ', chips: `${O.chip(sent ? 'danop' : 'bosung')}<span class="tag">HS-2026-0135</span>` })}
        ${v === 'late' ? O.banner({ tone: 'red', icon: 'alarm-clock-off', title: 'Đã quá hạn bổ sung 2 ngày', text: 'Bạn vẫn có thể nộp lại vì cán bộ xã chưa đóng hồ sơ. Nộp càng sớm càng tốt.' }) : ''}
        ${sent ? O.lockband('Đã nộp lại phiên bản 3 lúc 19/10/2026 10:24', 'Chỉ đọc. UBND xã sẽ kiểm tra lại.') : ''}
        ${O.card(`<div class="row between top">${O.person('Ngô Bảo Ngọc', 'Cán bộ UBND Xã An Phú · Yêu cầu ngày 13/10/2026')}${v === 'late' ? O.tag('Quá hạn 17/10/2026', 'red', 'clock') : sent ? '' : `<div class="stack s8" style="gap:4px;align-items:flex-end"><span class="small muted">Hạn bổ sung 20/10/2026</span><div class="ct-cd"><div><b>01</b><span>ngày</span></div><div><b>09</b><span>giờ</span></div></div></div>`}</div><p class="ttv-note" style="margin-top:14px">Hồ sơ cơ bản đạt yêu cầu. Đề nghị bổ sung 4 mục dưới đây để xã hoàn tất đánh giá sơ bộ và gửi lên tỉnh.</p>`)}
        <div class="stack s12">${REQ.map(item).join('')}</div>
        ${sent ? '' : `<div class="scorebar"><div class="stack s8" style="gap:4px;flex:1;min-width:160px"><b id="s18-n">2 / 4 mục đã trả lời</b>${O.progress(2, 4, '', '')}</div><div class="acts">${O.btn('Lưu nháp', { kind: 'ghost', attrs: 'data-toast="Đã lưu nháp"' })}<button class="btn primary" id="s18-send" disabled>${ic('send')}<span>Nộp lại</span></button></div></div>`}`;
    },
    mount(root) {
      const send = root.querySelector('#s18-send'); if (!send) return;
      const items = [...root.querySelectorAll('[data-item]')];
      const upd = () => {
        let n = 0;
        items.forEach((it) => { const ok = it.querySelector('textarea').value.trim().length > 0; if (ok) n++; it.classList.toggle('done', ok); it.querySelector('[data-chip]').innerHTML = ok ? O.tag('Đã trả lời', 'green', 'circle-check') : O.tag('Chưa trả lời', 'orange', 'circle-dashed'); });
        root.querySelector('#s18-n').textContent = `${n} / ${items.length} mục đã trả lời`;
        root.querySelector('.scorebar .progress i').style.width = (n / items.length) * 100 + '%';
        send.disabled = n < items.length;
      };
      root.addEventListener('input', (e) => { if (e.target.matches('[data-item] textarea')) upd(); });
      send.addEventListener('click', () => O.confirm({ title: 'Nộp lại hồ sơ?', icon: 'send', what: 'Hồ sơ được chốt thành phiên bản 3 và gửi lại cho UBND Xã An Phú kiểm tra.', notify: 'Cán bộ Ngô Bảo Ngọc, UBND Xã An Phú.', undo: 'Không. Muốn sửa tiếp phải chờ xã yêu cầu bổ sung.', confirmText: 'Nộp lại', onConfirm: () => O.go('s18', { variant: 'sent' }) }));
      upd();
    },
  });

  /* ================= S19 Kết quả và giấy chứng nhận ================= */
  const IMPROVE = [['A5', 'Bảo vệ môi trường trong sản xuất', 'Đầu tư hệ thống xử lý nước thải.'], ['B3', 'Kênh phân phối', 'Mở rộng sang chuỗi siêu thị ngoài tỉnh.'], ['B5', 'Truy xuất nguồn gốc', 'Áp dụng mã truy xuất điện tử trên bao bì.']];
  O.screen('s19', {
    title: 'Kết quả và giấy chứng nhận', navTitle: 'Kết quả', code: 'S19', roles: ['chuthe'], device: 'Di động', crumbs: [['Hồ sơ của tôi', 's12'], ['HS-2026-0123', 's17']],
    variants: [['s4', '4 sao'], ['s3', '3 sao'], ['fail', 'Chưa đạt'], ['s5', 'Đã gửi đề nghị 5 sao'], ['closed', 'Đã đóng']],
    render({ variant: v }) {
      const V = { s4: { st: 'congnhan4', sao: 4, T: 78, A: 32, B: 18, C: 28 }, s3: { st: 'congnhan3', sao: 3, T: 64, A: 27, B: 15, C: 22 }, fail: { st: 'chuadat', sao: 0, T: 46, A: 20, B: 11, C: 15 }, s5: { st: 'de5sao', sao: 4, T: 92, A: 37, B: 23, C: 32 }, closed: { st: 'dadong', sao: 0, T: 91, A: 36, B: 23, C: 32 } }[v];
      const hero = `<section class="hero" style="min-height:0"><div class="hero-main"><div class="row s8"><span class="chip ${O.STATUS[V.st][1]}">${ic(O.STATUS[V.st][2])}${O.STATUS[V.st][0]}</span><span class="hero-tag">${D.dot.ten}</span></div><h1>Mắm cá linh khô</h1>
        <div class="ct-hero-res"><div class="ct-big">${V.T}<small> / 100 điểm</small></div>${V.sao && v !== 's5' ? `<div class="stack s8" style="gap:4px">${O.stars(V.sao, 5, 'xl')}<b>Đạt hạng ${V.sao} sao</b></div>` : ''}</div>
        <p style="color:rgba(255,255,255,.92)">${{ s4: 'Chúc mừng! Sản phẩm được công nhận OCOP 4 sao cấp tỉnh.', s3: 'Chúc mừng! Sản phẩm được công nhận OCOP 3 sao cấp tỉnh.', fail: 'Sản phẩm chưa đạt ngưỡng 3 sao ở đợt này. Đừng nản lòng, các gợi ý bên dưới giúp bạn chuẩn bị tốt cho đợt sau.', s5: 'Hồ sơ đạt từ 90 điểm, đã được Sở gửi đề nghị đánh giá 5 sao. Kết quả sẽ được thông báo bằng văn bản ngoài hệ thống.', closed: 'Hồ sơ đã được xử lý ngoài hệ thống. Vui lòng xem văn bản kết quả do Sở NN&MT gửi.' }[v]}</p></div></section>`;
      const parts = O.card(`<div class="stack">${D.parts.map((p) => `<div class="ct-part"><span>${p.name}</span><b class="num">${V[p.id]} / ${p.max}</b>${O.progress(V[p.id], p.max, '', 'lg')}</div>`).join('')}</div>`, { title: 'Điểm theo phần', sub: 'Điểm tổng hợp của hội đồng. Điểm từng thành viên không được công bố.' });
      const cmt = O.card(`<p class="ttv-note" style="font-size:15px;color:var(--text)">${v === 'fail' ? 'Sản phẩm có nguồn nguyên liệu địa phương rõ ràng và câu chuyện hấp dẫn. Tuy nhiên hồ sơ còn thiếu minh chứng về an toàn thực phẩm, bao bì chưa đủ thông tin bắt buộc và kênh phân phối còn hẹp.' : 'Sản phẩm mang đặc trưng mùa nước nổi, nguyên liệu địa phương rõ ràng, chất lượng cảm quan tốt. Cần cải thiện xử lý nước thải và mở rộng kênh phân phối để nâng hạng.'}</p><p class="small muted" style="margin-top:10px">Hội đồng đánh giá cấp tỉnh, họp ngày 15/10/2026</p>`, { title: 'Nhận xét của hội đồng' });
      const imp = O.card(`<div class="list">${IMPROVE.concat(v === 'fail' ? [['C2', 'Chỉ tiêu an toàn thực phẩm', 'Bổ sung phiếu kiểm nghiệm đầy đủ chỉ tiêu.'], ['B2', 'Bao bì, nhãn mác', 'Bổ sung hạn sử dụng và hướng dẫn bảo quản.']] : []).map(([c, n, g]) => `<div class="li"><span class="crit-code">${c}</span><div class="grow"><b>${n}</b><div class="small muted">${g}</div></div></div>`).join('')}</div>`, { title: 'Tiêu chí cần cải thiện' });
      const cert = `<section class="card stack"><div class="card-head" style="margin:0"><h2>Giấy chứng nhận</h2>${O.tag('Còn hiệu lực', 'green', 'circle-check')}</div>
        <div class="cert"><div class="stack s8" style="align-items:center"><span class="small">UBND ${D.tinh.toUpperCase()}</span><h3>GIẤY CHỨNG NHẬN SẢN PHẨM OCOP</h3>${O.stars(V.sao, 5, 'lg')}<b style="font-size:18px">Mắm cá linh khô</b><span>Cơ sở Mắm Bà Sáu · Xã An Phú</span><span class="small">Số hiệu: <b>OCOP-TM-2026-0042</b> · Ngày cấp 20/10/2026 · Hiệu lực 36 tháng</span></div></div>
        <div class="row top" style="gap:18px">${O.qr(42)}<div class="stack s8" style="flex:1;min-width:180px"><b>Mã QR xác thực</b><span class="small muted">In mã lên bao bì để người mua quét và kiểm tra tính xác thực của giấy chứng nhận.</span>${O.btn('Tải ảnh mã QR', { size: 'sm', icon: 'download', attrs: 'data-toast="Đang tải ảnh mã QR (PNG)"' })}</div></div>
        ${O.btn('Tải giấy chứng nhận (PDF)', { kind: 'primary lg', icon: 'download', attrs: 'data-toast="Đang tải OCOP-TM-2026-0042.pdf"' })}
        ${v === 's4' ? `<p class="small muted ct-fl" style="gap:8px;align-items:flex-start">${ic('trending-up')}<span>Sản phẩm thiếu 12 điểm để đạt ngưỡng đề nghị 5 sao (90 điểm). Có thể đăng ký nâng hạng ở đợt sau.</span></p>` : ''}</section>`;
      const s5 = O.card(O.timeline([['check', 'green', 'Hội đồng tỉnh chốt 92 điểm', '15/10/2026'], ['send', 'amber', 'Sở NN&MT gửi hồ sơ đề nghị 5 sao', '18/10/2026 · Công văn 1245/SNNMT-PTNT'], ['hourglass', 'gray', 'Chờ kết quả đánh giá 5 sao', 'Kết quả được thông báo bằng văn bản, không qua hệ thống']]), { title: 'Tiến trình đề nghị 5 sao' });
      const again = O.card(`<div class="row"><div class="stack s8" style="flex:1;min-width:200px;gap:2px"><b>Đăng ký lại ở đợt sau</b><span class="small muted">Tạo hồ sơ mới với thông tin được điền sẵn từ hồ sơ này.</span></div>${O.btn('Đăng ký lại', { kind: 'primary', icon: 'copy-plus', go: 's13' })}</div>`, { cls: 'tight' });
      const side = v === 's4' || v === 's3' ? cert : v === 's5' ? s5 : v === 'fail' ? again : O.card(O.empty({ icon: 'archive', title: 'Không có giấy chứng nhận trên hệ thống', text: 'Hồ sơ được xử lý ngoài hệ thống. Liên hệ Sở NN&MT để nhận văn bản kết quả.' }));
      return `${hero}<div class="grid g-main"><div class="stack">${parts}${cmt}${v === 'fail' || v === 's4' || v === 's3' ? imp : ''}</div><div class="stack">${side}${v === 's4' || v === 's3' ? again : ''}</div></div>`;
    },
  });
})();
