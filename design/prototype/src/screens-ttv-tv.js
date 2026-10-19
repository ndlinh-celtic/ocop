/* Màn hình Tổ tư vấn (S50–S53) và Thành viên hội đồng (S60–S63) */
(function () {
  const O = window.OCOP, D = O.data, ic = O.icon, esc = O.esc, fmt = O.fmt;
  document.head.insertAdjacentHTML('beforeend', `<style>
  .crit-head .score { margin-left: auto; }
  .crit-head .orig { font-weight: 600; }
  .crit-meta { font-size: 12.5px; color: var(--text-3); font-weight: 400; }
  .flagbtn { border: 1px dashed var(--line-strong); background: var(--surface); border-radius: 999px; padding: 5px 12px; font-size: 13px; cursor: pointer; color: var(--text-2); display: inline-flex; gap: 6px; align-items: center; min-height: 34px; }
  .flagbtn .ic { width: 14px; height: 14px; }
  .flagbtn.on { border-style: solid; border-color: color-mix(in srgb, var(--t) 45%, transparent); background: color-mix(in srgb, var(--t) 13%, var(--surface)); color: color-mix(in srgb, var(--t) 80%, var(--text)); font-weight: 600; }
  .save-ind { font-size: 12.5px; color: var(--text-3); display: inline-flex; gap: 6px; align-items: center; }
  .save-ind .ic { width: 14px; height: 14px; }
  .cmp { display: inline-flex; gap: 6px; align-items: center; font-size: 13px; padding: 6px 12px; border-radius: 999px; background: var(--surface-3); color: var(--text-2); }
  .cmp b { color: var(--text); font-variant-numeric: tabular-nums; }
  .ttv-item { display: grid; grid-template-columns: 44px minmax(0,1fr) auto; gap: 10px; padding: 12px 0; border-bottom: 1px solid var(--line); align-items: start; }
  .ttv-item:last-child { border-bottom: 0; }
  .ttv-item .sv { font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .outc { display: flex; flex-direction: column; gap: 4px; align-items: center; }
  .outc small { font-size: 11.5px; color: var(--text-3); max-width: 170px; line-height: 1.35; }
  .s63t td:first-child, .s63t th:first-child { min-width: 250px; }
  .s63t td:first-child .small { white-space: normal; }
  .crit-head .crit-name { flex: 1 1 220px; }
  @container main (max-width: 640px) { .split .scorebar { gap: 8px; padding: 10px 12px; } .split .scorebar .parts, .split .scorebar [data-ned] { display: none; } .split .scorebar .total { font-size: 22px; } }
  .kbd-hint { display: flex; gap: 12px; flex-wrap: wrap; font-size: 12.5px; color: var(--text-3); align-items: center; }
  .note-row { display: grid; grid-template-columns: 110px minmax(0,1fr) 40px; gap: 8px; align-items: start; }
  @container main (max-width: 640px) { .note-row { grid-template-columns: minmax(0,1fr) 40px; } .note-row .select { grid-column: 1 / -1; } .scorebar .acts { margin-left: 0; width: 100%; } .scorebar .acts .btn { flex: 1; } }
  </style>`);

  const TC = (code) => D.tieuchi.find((t) => t.code === code);
  const PARTS = D.parts;
  const TTV_V = 2;
  const evFiles = (t) => {
    const real = D.files.filter((f) => f.crit.startsWith(t.code + ':')).map((f) => f.name);
    const out = real.slice(0, t.ev);
    for (let i = out.length; i < t.ev; i++) out.push(`${t.code}-minh-chung-${i + 1}.pdf`);
    return out;
  };
  const sumBy = (getter) => O.sumParts(getter);
  const ttvTotals = sumBy((t) => t.ttv);
  const n1 = (v) => fmt(v, Number.isInteger(v) ? 0 : 1);
  const hdr = (h) => `<div class="row s8">${O.chip(h.st)}<span class="tag">${esc(h.nhom)}</span><span class="tag">${esc(D.dot.ten)}</span></div>`;

  /* ======= thông tin hồ sơ, minh chứng, biên bản xã (dùng chung S51, S61) ======= */
  const infoPanel = (h) => O.dl([
    ['Mã hồ sơ', h.ma], ['Sản phẩm', esc(h.sp)], ['Nhóm sản phẩm', esc(h.nhom)], ['Chủ thể', esc(h.ct)], ['Xã/phường', esc(h.xa)],
    ['Người đại diện', 'Nguyễn Thị Sáu · 0918 ••• 247'], ['Ngày xã chuyển tỉnh', '05/05/2026'], ['Đợt', esc(D.dot.ten)],
    ['Mô tả', 'Cá linh non mùa nước nổi, ướp muối và phơi khô theo cách truyền thống của vùng Đồng Tháp Mười. Đóng gói hút chân không 250 g và 500 g.'],
  ]);
  const evidencePanel = () => PARTS.map((p) => `<div class="stack s8"><h4 class="muted">${p.name}</h4>${D.tieuchi.filter((t) => t.part === p.id).map((t) => { const fs = evFiles(t); return `<div class="row top nowrap" style="padding:8px 0;border-bottom:1px solid var(--line)"><span class="crit-code">${t.code}</span><div class="stack s8" style="flex:1;min-width:0;gap:6px"><span class="small strong">${esc(t.name)}</span><div class="row s8">${fs.length ? fs.map(O.fileChip).join('') : O.tag('Thiếu minh chứng', 'orange', 'file-warning')}</div></div></div>`; }).join('')}</div>`).join('<div style="height:14px"></div>');
  const xaPanel = () => `<div class="stack s12">${O.banner({ tone: 'green', icon: 'landmark', title: 'UBND Xã An Phú kết luận: Đủ điều kiện chuyển tỉnh', text: 'Biên bản số 14/BB-UBND ngày 03/05/2026, người ký: Chủ tịch UBND xã.' })}
    ${[['Nguồn gốc nguyên liệu', 'Đạt', 'green', 'Cá linh thu mua tại địa phương, có sổ ghi chép.'], ['Lao động địa phương', 'Đạt', 'green', '18 lao động thường trú tại xã.'], ['Bản sắc văn hóa và trí tuệ bản địa', 'Cần xác minh', 'orange', 'Cần đối chiếu tư liệu về nghề làm mắm truyền thống của hộ.']].map(([n, r, tone, c], i) => `<div class="card tight"><div class="row between"><b>${i + 1}. ${n}</b>${O.tag(r, tone)}</div><p class="small muted" style="margin-top:6px">${c}</p></div>`).join('')}
    ${O.file({ name: 'Bien-ban-so-bo-xa-An-Phu.pdf', size: '410 KB', type: 'pdf', crit: 'Đã ký' })}</div>`;

  /* ======= S50 Hàng đợi thẩm định ======= */
  const Q = [
    { ma: 'HS-2026-0131', rep: 'nhap', han: '17/10/2026', con: -2 },
    { ma: 'HS-2026-0130', rep: 'chua', han: '18/10/2026', con: -1 },
    { ma: 'HS-2026-0129', rep: 'chua', han: '22/10/2026', con: 3 },
    { ma: 'HS-2026-0123', rep: 'v2', han: '25/10/2026', con: 6 },
    { ma: 'HS-2026-0125', rep: 'nhap', han: '28/10/2026', con: 9 },
    { ma: 'HS-2026-0124', rep: 'v1', han: '28/10/2026', con: 9 },
  ];
  const repChip = (r) => r === 'chua' ? O.tag('Chưa bắt đầu', 'gray', 'circle-dashed') : r === 'nhap' ? O.tag('Nháp', 'blue', 'pencil-line') : O.tag(`Đã phát hành phiên bản ${r.slice(1)}`, 'purple', 'file-check-2');
  const dueChip = (con) => con < 0 ? O.tag(`Quá hạn ${-con} ngày`, 'red', 'alarm-clock') : con <= 3 ? O.tag(`Còn ${con} ngày`, 'orange', 'clock') : O.tag(`Còn ${con} ngày`, 'gray', 'clock');
  O.screen('s50', {
    title: 'Hàng đợi thẩm định', code: 'S50', roles: ['ttv'], device: 'Máy tính', crumbs: [['Tổ tư vấn', 's50']],
    variants: [['default', 'Mặc định'], ['overdue', 'Nhiều hồ sơ quá hạn'], ['empty', 'Danh sách trống'], ['loading', 'Đang tải']],
    render({ variant }) {
      const rows = Q.map((q) => Object.assign({}, O.hs(q.ma), q));
      const act = (r) => r.rep === 'chua' ? O.btn('Bắt đầu thẩm định', { kind: 'primary', size: 'sm', icon: 'play', go: 's51' }) : r.rep === 'nhap' ? O.btn('Tiếp tục', { kind: 'soft', size: 'sm', icon: 'arrow-right', go: 's51' }) : O.btn('Xem báo cáo', { size: 'sm', icon: 'file-text', go: 's52', attrs: `data-params='{"variant":"published"}'` });
      const body = variant === 'empty'
        ? O.empty({ icon: 'inbox', title: 'Chưa có hồ sơ nào được giao cho bạn', text: 'Khi thư ký hội đồng phân công, hồ sơ sẽ xuất hiện ở đây và bạn nhận được thông báo.' })
        : variant === 'loading' ? `<div style="padding:24px">${O.skeleton(6)}</div>`
        : O.table({
          cols: [{ l: 'Hồ sơ', sort: true }, { l: 'Nhóm sản phẩm' }, { l: 'Người phân công' }, { l: 'Hạn xử lý', sort: true }, { l: 'Báo cáo Tổ tư vấn' }, { l: '', cls: 'r' }],
          rows: variant === 'overdue' ? rows.filter((r) => r.con < 4) : rows,
          rowAttrs: (r) => r.con < 0 ? 'style="background:color-mix(in srgb,var(--c-red) 6%,transparent)"' : '',
          cell: (r, c) => c.l === 'Hồ sơ' ? O.prodCell(r) : c.l === 'Nhóm sản phẩm' ? `<span class="small">${esc(r.nhom)}</span>` : c.l === 'Người phân công' ? `<div class="row s8 nowrap">${O.avatar('Trần Thị B', 'sm')}<span class="small">Trần Thị B</span></div>` : c.l === 'Hạn xử lý' ? `<div class="stack s8" style="gap:4px"><span class="small strong">${r.han}</span>${dueChip(r.con)}</div>` : c.l === 'Báo cáo Tổ tư vấn' ? repChip(r.rep) : act(r),
          card: (r) => `<div class="mcard"><div class="row between nowrap"><b>${esc(r.sp)}</b>${dueChip(r.con)}</div><span class="small muted">${r.ma} · ${esc(r.nhom)}</span><div class="row">${repChip(r.rep)}<span class="spacer"></span>${act(r)}</div></div>`,
          total: 6,
        });
      return `${O.pageHead({ title: 'Hàng đợi thẩm định', sub: `${D.dot.ten} · Chế độ chấm: ${D.dot.cheDo}. Sắp xếp theo hạn xử lý gần nhất.` })}
      ${variant === 'overdue' ? O.banner({ tone: 'red', icon: 'alarm-clock', title: '2 hồ sơ đã quá hạn thẩm định', text: 'Thư ký hội đồng đã được thông báo. Hoàn thành báo cáo sớm để hội đồng kịp xem xét trước hạn đánh giá của tỉnh 30/06/2026.' }) : ''}
      <div class="grid g-4">${O.stat({ label: 'Được giao', value: 6, icon: 'inbox', tone: 'green' })}${O.stat({ label: 'Chưa bắt đầu', value: 2, icon: 'circle-dashed', tone: 'gray', sub: '1 hồ sơ quá hạn' })}${O.stat({ label: 'Đang thẩm định', value: 2, icon: 'search-check', tone: 'blue' })}${O.stat({ label: 'Đã phát hành', value: 2, icon: 'file-check-2', tone: 'purple' })}</div>
      <section class="card flush"><div style="padding:18px 20px" class="toolbar">${O.fchips([['Tất cả', 6], ['Chưa bắt đầu', 2], ['Đang thẩm định', 2], ['Đã phát hành', 2]], variant === 'overdue' ? 0 : 0)}<span class="spacer"></span>${O.search('Tìm mã, sản phẩm')}</div>${body}</section>`;
    },
  });

  /* ======= S51 Thẩm định và chấm điểm đề xuất ======= */
  let s51 = null;
  const initS51 = () => {
    s51 = {};
    D.tieuchi.forEach((t) => { s51[t.code] = { v: t.ttv, can: t.can, refs: evFiles(t).slice(0, 2), flags: new Set() }; });
    ['C4', 'C5'].forEach((c) => { s51[c].v = ''; s51[c].can = ''; });
    s51.B5.can = ''; s51.B5.flags.add('thieu'); s51.C5.flags.add('xacminh'); s51.A5.flags.add('luuy');
  };
  const FLAGS = [['thieu', 'Thiếu minh chứng', 'orange', 'file-warning'], ['xacminh', 'Cần xác minh', 'blue', 'search'], ['luuy', 'Lưu ý cho hội đồng', 'purple', 'flag']];
  const s51Crit = (t) => {
    const s = s51[t.code]; const scored = s.v !== ''; const missing = scored && !s.can.trim();
    const status = !scored ? O.tag('Chưa chấm', 'gray') : missing ? O.tag('Thiếu căn cứ', 'red', 'circle-alert') : O.tag('Đủ căn cứ', 'green', 'check');
    const open = !scored || missing || s.flags.size;
    return `<div class="crit ${open ? '' : 'closed'}" data-code="${t.code}">
      <div class="crit-head" data-toggle><span class="crit-code">${t.code}</span><div class="crit-name">${esc(t.name)}<div class="crit-meta row s8" style="margin-top:4px"><span data-status>${status}</span><span>Tối đa ${t.max} điểm · ${t.ev} minh chứng</span></div></div>${O.scoreInput({ id: 'td-' + t.code, value: s.v, max: t.max, label: 'Điểm đề xuất ' + t.code })}${ic('chevron-down', 'chev')}</div>
      <div class="crit-body">
        <div class="field"><label for="can-${t.code}">Căn cứ<span class="req">*</span></label><textarea class="textarea" style="min-height:70px" id="can-${t.code}" data-can placeholder="Nêu căn cứ cho điểm đề xuất, dẫn chiếu minh chứng cụ thể">${esc(s.can)}</textarea><span class="hint">Bắt buộc khi đã nhập điểm.</span></div>
        <div class="stack s8" style="gap:6px"><span class="label">Viện dẫn minh chứng</span><div class="row s8" data-refs>${s.refs.map(O.fileChip).join('')}<button type="button" class="btn sm ghost" data-addref>${ic('plus')}<span>Thêm</span></button></div></div>
        <div class="row s8">${FLAGS.map(([k, l, tone, i]) => `<button type="button" class="flagbtn ${s.flags.has(k) ? 'on' : ''}" style="--t:var(--c-${tone})" data-flag="${k}" aria-pressed="${s.flags.has(k)}">${ic(i)}${l}</button>`).join('')}</div>
      </div></div>`;
  };
  O.screen('s51', {
    title: 'Thẩm định và chấm điểm đề xuất', navTitle: 'Thẩm định hồ sơ', code: 'S51', roles: ['ttv'], device: 'Máy tính', crumbs: [['Hàng đợi thẩm định', 's50'], ['HS-2026-0123', 's50']],
    render() {
      if (!s51) initS51();
      const h = O.hs('HS-2026-0123');
      const t = sumBy((x) => s51[x.code].v);
      const scoredN = D.tieuchi.filter((x) => s51[x.code].v !== '').length;
      const doc = `<section class="card">${O.tabs([['info', 'Thông tin hồ sơ'], ['ev', 'Minh chứng', D.tieuchi.reduce((a, x) => a + x.ev, 0)], ['xa', 'Biên bản sơ bộ của xã']], { info: infoPanel(h), ev: evidencePanel(), xa: xaPanel() }, { active: 'ev', style: 'line' })}</section>`;
      const form = `<div class="stack">
        ${PARTS.map((p) => `<div><div class="part-head"><h3>${p.name}</h3><span class="pt"><span data-pt="${p.id}">${t[p.id]}</span> / ${p.max}</span></div>${D.tieuchi.filter((x) => x.part === p.id).map(s51Crit).join('')}</div>`).join('')}
        <div class="scorebar"><div><div class="tiny muted">Tổng điểm đề xuất</div><div class="total"><span data-tot>${t.T}</span><small> / 100</small></div></div>
          <div class="stack s8" style="gap:4px"><div class="parts">${PARTS.map((p) => `<span>${p.id} <b data-pb="${p.id}">${t[p.id]}</b>/${p.max}</span>`).join('')}</div><span class="small muted"><span data-scored>${scoredN}</span>/18 tiêu chí đã chấm · <span class="save-ind" data-save>${ic('cloud')}Đã lưu nháp 14:32</span></span></div>
          <div class="acts">${O.btn('Lưu nháp', { icon: 'save', attrs: 'data-savebtn' })}${O.btn('Chuyển sang soạn báo cáo Tổ tư vấn', { kind: 'primary', icon: 'arrow-right', attrs: 'data-next' })}</div></div></div>`;
      return `${O.pageHead({ title: esc(h.sp), sub: `${h.ma} · ${esc(h.ct)} · ${esc(h.xa)} · Hạn thẩm định 25/10/2026`, chips: hdr(Object.assign({}, h, { st: 'thamdinh' })), actions: O.btn('Đề nghị Sở trả về xã', { kind: 'danger-ghost', icon: 'undo-2', attrs: 'data-return' }) })}
      <div class="kbd-hint"><span>${ic('keyboard')} Phím tắt:</span><span><kbd>Tab</kbd> ô điểm kế tiếp</span><span><kbd>↑</kbd><kbd>↓</kbd> tăng giảm điểm</span><span><kbd>Alt</kbd>+<kbd>M</kbd> mở minh chứng của tiêu chí đang nhập</span></div>
      ${O.split(doc, form, { docLabel: 'Tài liệu', formLabel: 'Chấm đề xuất' })}`;
    },
    mount(root) {
      const saveInd = root.querySelector('[data-save]'); let tm;
      const dirty = () => { saveInd.innerHTML = `${ic('loader')}Đang lưu…`; clearTimeout(tm); tm = setTimeout(() => { const d = new Date(); saveInd.innerHTML = `${ic('cloud')}Đã lưu nháp ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }, 900); };
      const upd = () => { const t = sumBy((x) => s51[x.code].v); PARTS.forEach((p) => { root.querySelector(`[data-pt="${p.id}"]`).textContent = t[p.id]; root.querySelector(`[data-pb="${p.id}"]`).textContent = t[p.id]; }); root.querySelector('[data-tot]').textContent = t.T; root.querySelector('[data-scored]').textContent = D.tieuchi.filter((x) => s51[x.code].v !== '').length; };
      const status = (c) => { const s = s51[c.dataset.code]; const scored = s.v !== ''; const missing = scored && !s.can.trim(); c.querySelector('[data-status]').innerHTML = !scored ? O.tag('Chưa chấm', 'gray') : missing ? O.tag('Thiếu căn cứ', 'red', 'circle-alert') : O.tag('Đủ căn cứ', 'green', 'check'); };
      root.querySelectorAll('.crit[data-code]').forEach((c) => {
        const code = c.dataset.code, s = s51[code];
        const inp = c.querySelector('input[type=number]'), can = c.querySelector('[data-can]');
        inp.addEventListener('input', () => { s.v = inp.value === '' ? '' : +inp.value; status(c); upd(); dirty(); c.classList.remove('flag-err'); });
        inp.addEventListener('focus', () => (root.dataset.focus = code));
        can.addEventListener('input', () => { s.can = can.value; can.classList.remove('invalid'); c.classList.remove('flag-err'); status(c); dirty(); });
        c.querySelectorAll('[data-flag]').forEach((b) => b.addEventListener('click', () => { const k = b.dataset.flag; s.flags.has(k) ? s.flags.delete(k) : s.flags.add(k); b.classList.toggle('on'); b.setAttribute('aria-pressed', s.flags.has(k)); dirty(); }));
        c.querySelector('[data-addref]').addEventListener('click', (e) => {
          e.stopPropagation();
          const all = [...new Set([...evFiles(TC(code)), ...D.files.map((f) => f.name)])].filter((n) => !s.refs.includes(n));
          const p = O.pop(e.currentTarget, `<div class="pop-h">${ic('paperclip')}Chọn minh chứng đã gắn</div>${all.slice(0, 6).map((n) => `<button class="opt" data-pick="${esc(n)}">${ic('file-text')}<span>${esc(n)}</span></button>`).join('')}`);
          p.querySelectorAll('[data-pick]').forEach((o) => o.addEventListener('click', () => { s.refs.push(o.dataset.pick); const wrap = c.querySelector('[data-refs]'); const add = wrap.querySelector('[data-addref]'); add.insertAdjacentHTML('beforebegin', O.fileChip(o.dataset.pick)); const nc = add.previousElementSibling; nc.addEventListener('click', (ev) => { ev.stopPropagation(); O.previewFile(nc.dataset.preview); }); O.closePop(); dirty(); }));
        });
      });
      root.querySelector('[data-savebtn]').addEventListener('click', () => O.toast('Đã lưu nháp phiếu thẩm định'));
      root.querySelector('[data-next]').addEventListener('click', () => {
        let first = null, nScore = 0, nCan = 0;
        root.querySelectorAll('.crit[data-code]').forEach((c) => { const s = s51[c.dataset.code]; const bad = s.v === '' || !s.can.trim(); if (s.v === '') nScore++; else if (!s.can.trim()) nCan++; c.classList.toggle('flag-err', bad); if (bad) { c.classList.remove('closed'); if (s.v !== '' && !s.can.trim()) c.querySelector('[data-can]').classList.add('invalid'); if (s.v === '') c.querySelector('.score').classList.add('invalid'); first = first || c; } });
        if (first) { O.toast(`Còn ${nScore} tiêu chí chưa chấm và ${nCan} tiêu chí thiếu căn cứ`, true); first.scrollIntoView({ block: 'center' }); return; }
        O.go('s52');
      });
      root.querySelector('[data-return]').addEventListener('click', () => {
        const el = O.modal({ title: 'Đề nghị Sở trả hồ sơ về xã', icon: 'undo-2', tone: 'orange', body: `<p class="muted">Tổ tư vấn không tự trả hồ sơ. Đề nghị được gửi tới cán bộ Sở; Sở quyết định có trả về UBND Xã An Phú hay không.</p><div class="field"><label for="rt-ly">Lý do đề nghị<span class="req">*</span></label><textarea class="textarea" id="rt-ly" placeholder="Ví dụ: thiếu phiếu kiểm nghiệm chỉ tiêu kim loại nặng, không thể thẩm định tiêu chí C2"></textarea></div><div class="field"><label>Tiêu chí liên quan</label><div class="row s8">${['B5', 'C2', 'C5'].map((c) => `<label class="check"><input type="checkbox" ${c === 'B5' ? 'checked' : ''}>${c}</label>`).join('')}</div></div>`, foot: `${O.btn('Hủy', { kind: 'ghost', attrs: 'data-close' })}${O.btn('Gửi đề nghị tới Sở', { kind: 'primary', icon: 'send', attrs: 'data-send' })}` });
        el.querySelector('[data-send]').addEventListener('click', () => { const ta = el.querySelector('#rt-ly'); if (!ta.value.trim()) { ta.classList.add('invalid'); return; } el.remove(); O.toast('Đã gửi đề nghị tới Sở NN&MT'); });
      });
      root.addEventListener('keydown', (e) => { if (e.altKey && e.key.toLowerCase() === 'm') { e.preventDefault(); const t = TC(root.dataset.focus || 'A1'); O.previewFile(evFiles(t)[0] || D.files[0].name); } });
    },
  });

  /* ======= Báo cáo Tổ tư vấn (bản xem trước) ======= */
  const NOTES = [['A5', 'Cơ sở chưa có hệ thống xử lý nước thải riêng, đề nghị hội đồng cân nhắc khi chấm.'], ['B5', 'Chưa có mã truy xuất điện tử; nên khuyến nghị bổ sung trong kết quả.'], ['C5', 'Đơn hàng xuất khẩu mới ở mức thử nghiệm.']];
  const ttvDoc = (ver) => `<div class="doc-page">
    <div class="doc-hd"><div><b>SỞ NN&MT TỈNH MẪU</b><br>TỔ TƯ VẤN</div><div><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br>Độc lập - Tự do - Hạnh phúc</div></div>
    <h3>BÁO CÁO THẨM ĐỊNH CỦA TỔ TƯ VẤN</h3><p style="text-align:center"><i>Phiên bản ${ver} · Hồ sơ HS-2026-0123</i></p>
    <p><b>Sản phẩm:</b> Mắm cá linh khô. <b>Chủ thể:</b> Cơ sở Mắm Bà Sáu, Xã An Phú. <b>Nhóm:</b> Thực phẩm.</p>
    <table><thead><tr><th>Mã</th><th>Tiêu chí</th><th>Tối đa</th><th>Đề xuất</th><th>Căn cứ</th></tr></thead><tbody>
    ${PARTS.map((p) => `<tr><td colspan="5"><b>${p.name}</b> (${ttvTotals[p.id]}/${p.max})</td></tr>${D.tieuchi.filter((t) => t.part === p.id).map((t) => `<tr><td>${t.code}</td><td>${esc(t.name)}</td><td style="text-align:center">${t.max}</td><td style="text-align:center"><b>${t.ttv}</b></td><td>${esc(t.can)}</td></tr>`).join('')}`).join('')}
    <tr><td colspan="3"><b>Tổng điểm đề xuất</b></td><td style="text-align:center" class="hl"><b>${ttvTotals.T}</b></td><td>Hạng gợi ý: 4 sao</td></tr></tbody></table>
    <p><b>Nhận xét tổng hợp:</b> Sản phẩm có tính đặc thù cao, gắn với mùa nước nổi, nguyên liệu địa phương ổn định. Cần cải thiện xử lý môi trường và truy xuất nguồn gốc điện tử.</p>
    <p><b>Điểm cần hội đồng lưu ý:</b></p><ul>${NOTES.map(([c, n]) => `<li>${c}: ${n}</li>`).join('')}</ul>
    <p style="text-align:right;margin-top:18px"><i>Tổ trưởng Tổ tư vấn</i><br><br><b>Hoàng Thị E</b></p></div>`;

  /* ======= S52 Soạn và phát hành báo cáo Tổ tư vấn ======= */
  O.screen('s52', {
    title: 'Soạn và phát hành báo cáo Tổ tư vấn', navTitle: 'Báo cáo Tổ tư vấn', code: 'S52', roles: ['ttv'], device: 'Máy tính', crumbs: [['Hàng đợi thẩm định', 's50'], ['HS-2026-0123', 's51']],
    variants: [['draft', 'Nháp'], ['published', 'Đã phát hành'], ['confirmed', 'Thành viên đã xác nhận phiếu']],
    render({ variant }) {
      const pub = variant !== 'draft';
      const ver = variant === 'draft' ? 2 : 2;
      const verChip = pub ? O.tag(`Phiên bản ${ver} đã phát hành`, 'purple', 'lock') : O.tag(`Nháp phiên bản ${ver}`, 'blue', 'pencil-line');
      const checks = [['Đủ điểm đề xuất cho 18/18 tiêu chí', true], ['Mọi tiêu chí có điểm đều có căn cứ', true], ['Có nhận xét tổng hợp', true], ['Đã gắn tiêu chí cho các điểm cần lưu ý', true]];
      const compose = pub
        ? `${variant === 'confirmed' ? O.banner({ tone: 'gray', icon: 'eye-off', title: 'Không thể sửa báo cáo này', text: 'Đã có thành viên hội đồng xác nhận phiếu chấm dựa trên phiên bản 2, nên nút sửa bị ẩn. Liên hệ thư ký hội đồng nếu cần điều chỉnh.' }) : O.banner({ tone: 'purple', icon: 'lock', title: 'Phiên bản 2 đã khóa', text: 'Phát hành lúc 14/10/2026 16:05 bởi Hoàng Thị E. Muốn chỉnh phải tạo phiên bản 3 và ghi lý do sửa.', actions: O.btn('Tạo phiên bản 3', { kind: 'primary', size: 'sm', icon: 'file-plus-2', attrs: 'data-newver' }) })}
          ${O.card(O.dl([['Đã gửi tới', '4 thành viên hội đồng được phân công'], ['Đã sao chép', 'Vào 2 phiếu chấm (xem S53)'], ['Tổng điểm đề xuất', `${ttvTotals.T} điểm · gợi ý 4 sao`]]), { title: 'Tình trạng phát hành' })}`
        : `${O.card(`<div class="stack">
            <div class="field"><label for="nx">Nhận xét tổng hợp<span class="req">*</span></label><textarea class="textarea" id="nx" style="min-height:120px">Sản phẩm có tính đặc thù cao, gắn với mùa nước nổi, nguyên liệu địa phương ổn định. Cần cải thiện xử lý môi trường và truy xuất nguồn gốc điện tử.</textarea></div>
            <div class="stack s8"><span class="label">Điểm cần hội đồng lưu ý</span><div class="stack s8" data-notes>${NOTES.map(([c, n], i) => noteRow(c, n, i)).join('')}</div><button type="button" class="link-btn" data-addnote>${ic('plus')}Thêm điểm lưu ý</button></div></div>`, { title: 'Soạn báo cáo', actions: verChip })}`;
      const side = `<div class="stack">
        ${compose}
        ${O.card(`<div class="stack s8">${checks.map(([l, ok]) => `<div class="row s8 nowrap">${ic(ok ? 'circle-check' : 'circle-x')}<span>${l}</span></div>`).join('').replace(/class="ic "/g, 'class="ic cell-ok"')}</div>`, { title: 'Kiểm tra trước phát hành', actions: O.tag('Đã đạt 4/4', 'green', 'check') })}
        ${O.card(`${O.timeline([['file-check-2', 'purple', 'Phiên bản 2 · 14/10/2026 16:05', 'Lý do sửa: bổ sung căn cứ tiêu chí C2 sau khi có phiếu kiểm nghiệm mới'], ['file-check-2', 'gray', 'Phiên bản 1 · 08/10/2026 10:20', 'Phát hành lần đầu']])}<div class="stack s8 small" style="background:var(--surface-2);padding:12px 14px;border-radius:12px"><b>So sánh nhanh phiên bản 1 và 2</b><span>C2: <span class="diff-old">5</span> <span class="diff-new">6</span> điểm</span><span>B1 căn cứ: <span class="diff-old">Đang chờ bản tự công bố</span> <span class="diff-new">Bản tự công bố số 12/2025/MBS, còn hiệu lực</span></span><span>Tổng: <span class="diff-old">77</span> <span class="diff-new">78</span></span></div>`, { title: 'Lịch sử phiên bản' })}
        ${pub ? '' : `<div class="stack s8">${O.btn('Phát hành báo cáo Tổ tư vấn', { kind: 'primary', size: 'lg', icon: 'send', attrs: 'data-publish' })}<span class="tiny muted" style="text-align:center">Chỉ tổ trưởng hoặc người được giao mới phát hành được. Tổ tư vấn không chốt điểm và không quyết định công nhận.</span></div>`}
      </div>`;
      return `${O.pageHead({ title: 'Báo cáo Tổ tư vấn: Mắm cá linh khô', sub: 'HS-2026-0123 · Cơ sở Mắm Bà Sáu · Xã An Phú', chips: `<div class="row s8">${O.chip(pub ? 'cobaocao' : 'thamdinh')}${verChip}</div>`, actions: `${O.btn('Quay lại phiếu thẩm định', { kind: 'ghost', icon: 'arrow-left', go: 's51' })}${O.btn('Tải PDF', { icon: 'download', attrs: 'data-toast="Đang tạo tệp PDF báo cáo"' })}` })}
      <div class="grid g-main"><div style="min-width:0;overflow-x:auto">${ttvDoc(ver)}</div>${side}</div>`;
    },
    mount(root) {
      const notes = root.querySelector('[data-notes]');
      root.querySelector('[data-addnote]')?.addEventListener('click', () => { notes.insertAdjacentHTML('beforeend', noteRow('', '', notes.children.length)); O.bind(notes.lastElementChild); bindRm(); });
      const bindRm = () => root.querySelectorAll('[data-rmnote]').forEach((b) => (b.onclick = () => b.closest('.note-row').remove()));
      bindRm();
      root.querySelector('[data-publish]')?.addEventListener('click', () => O.confirm({ title: 'Phát hành báo cáo Tổ tư vấn phiên bản 2?', what: 'Báo cáo Tổ tư vấn sẽ bị khóa thành phiên bản 2, thành viên được phân công sẽ nhận thông báo.', notify: '4 thành viên hội đồng được phân công và thư ký hội đồng.', undo: 'Không. Muốn chỉnh phải tạo phiên bản 3 và ghi lý do sửa.', confirmText: 'Phát hành', icon: 'send', onConfirm: () => { O.toast('Đã phát hành báo cáo Tổ tư vấn phiên bản 2'); O.go('s52', { variant: 'published' }); } }));
      root.querySelector('[data-newver]')?.addEventListener('click', () => {
        const el = O.modal({ title: 'Tạo phiên bản 3 của báo cáo', icon: 'file-plus-2', body: `<p class="muted">Phiên bản 2 giữ nguyên. Các phiếu đã sao chép không bị thay đổi; thành viên sẽ thấy thông báo có phiên bản mới.</p><div class="field"><label for="ly-v3">Lý do sửa<span class="req">*</span></label><textarea class="textarea" id="ly-v3" placeholder="Ví dụ: điều chỉnh căn cứ tiêu chí B3 theo minh chứng chủ thể bổ sung"></textarea></div>`, foot: `${O.btn('Hủy', { kind: 'ghost', attrs: 'data-close' })}${O.btn('Tạo bản nháp phiên bản 3', { kind: 'primary', attrs: 'data-v3' })}` });
        el.querySelector('[data-v3]').addEventListener('click', () => { const t = el.querySelector('#ly-v3'); if (!t.value.trim()) { t.classList.add('invalid'); return; } el.remove(); O.toast('Đã tạo bản nháp phiên bản 3'); O.go('s52', { variant: 'draft' }); });
      });
    },
  });
  function noteRow(code, text, i) {
    return `<div class="note-row"><select class="select" id="nt-c-${i}" aria-label="Tiêu chí">${['<option value="">Tiêu chí…</option>', ...D.tieuchi.map((t) => `<option ${t.code === code ? 'selected' : ''}>${t.code}</option>`)].join('')}</select><input class="input" id="nt-t-${i}" value="${esc(text)}" placeholder="Điều hội đồng cần lưu ý"><button type="button" class="icon-btn" style="width:40px;height:40px" data-rmnote aria-label="Xóa dòng">${ic('trash-2')}</button></div>`;
  }

  /* ======= S53 Sao chép sang phiếu chấm ======= */
  const MEM = ['Nguyễn Văn A', 'Lê Văn C', 'Phạm Thị D', 'Đặng Quốc G'];
  const SRC = [
    { ma: 'HS-2026-0123', v: 2, copied: 'Đã sao chép phiên bản 1', out: ['upd', 'edit', 'upd', 'conf'] },
    { ma: 'HS-2026-0124', v: 1, copied: 'Chưa sao chép', out: ['new', 'new', 'coi', 'new'] },
    { ma: 'HS-2026-0128', v: 2, copied: 'Đã sao chép phiên bản 1', out: ['conf', 'upd', 'new', 'upd'] },
  ];
  const OUT = { new: ['Phiếu mới sẽ được điền sẵn', 'green', 'file-plus-2', ''], upd: ['Cập nhật phiếu chưa chỉnh', 'blue', 'refresh-cw', ''], edit: ['Bỏ qua', 'orange', 'skip-forward', 'Thành viên đã chỉnh phiếu, không ghi đè'], conf: ['Bỏ qua', 'orange', 'skip-forward', 'Thành viên đã xác nhận phiếu'], coi: ['Bỏ qua', 'red', 'ban', 'Xung đột lợi ích với hồ sơ này'] };
  let s53 = null, s53p = null;
  O.screen('s53', {
    title: 'Sao chép sang phiếu chấm', code: 'S53', roles: ['ttv'], device: 'Máy tính', crumbs: [['Tổ tư vấn', 's50']],
    variants: [['ttv', 'Chế độ dựa trên Tổ tư vấn'], ['direct', 'Chế độ chấm trực tiếp']],
    render({ variant, params }) {
      if (!s53 || s53p !== params) { s53 = { step: 0, sel: new Set(['HS-2026-0123', 'HS-2026-0124']), scope: 'all', crit: new Set(D.tieuchi.map((t) => t.code)), rcp: 'all', mem: new Set(MEM), done: false }; s53p = params; }
      if (variant === 'direct') return `${O.pageHead({ title: 'Sao chép sang phiếu chấm' })}${O.card(O.empty({ icon: 'eye-off', title: 'Màn hình này không dùng trong đợt hiện tại', text: `${D.dot.ten} áp dụng chế độ chấm trực tiếp, nên mục "Sao chép sang phiếu chấm" bị ẩn khỏi menu. Thành viên hội đồng tự chấm từ đầu trên phiếu của mình.`, action: O.btn('Về hàng đợi thẩm định', { kind: 'soft', go: 's50' }) }))}`;
      const st = s53;
      const head = O.pageHead({ title: 'Sao chép báo cáo Tổ tư vấn sang phiếu chấm', sub: 'Đưa điểm và căn cứ đề xuất vào phiếu chấm của thành viên hội đồng. Sao chép là một chiều, hệ thống lưu giá trị gốc và ghi nhật ký.' });
      if (st.done) {
        const rows = SRC.filter((s) => st.sel.has(s.ma));
        let ok = 0; const skipped = [];
        rows.forEach((s) => s.out.forEach((o, i) => { if (!st.mem.has(MEM[i])) return; if (o === 'new' || o === 'upd') ok++; else skipped.push([s, MEM[i], OUT[o][3]]); }));
        return `${head}<section class="card"><div class="empty" style="padding:24px 10px"><div class="big-ok">${ic('check')}</div><h2>Đã sao chép vào ${ok} phiếu chấm</h2><p>Thành viên được phân công đã nhận thông báo. Thao tác được ghi vào nhật ký hoạt động lúc 19/10/2026 ${new Date().toTimeString().slice(0, 5)}.</p><div class="row" style="justify-content:center">${O.btn('Xem nhật ký', { kind: 'ghost', icon: 'scroll-text', attrs: 'data-toast="Nhật ký chỉ quản trị xem được (S74)"' })}${O.btn('Về hàng đợi', { kind: 'soft', go: 's50' })}</div></div></section>
        ${O.card(`<div class="list">${skipped.map(([s, m, why]) => `<div class="li">${O.avatar(m, 'sm')}<div class="grow"><b>${m}</b><div class="small muted">${s.ma} · ${esc(O.hs(s.ma).sp)}</div></div>${O.tag(why, 'orange')}</div>`).join('')}</div>`, { title: `Phiếu bị bỏ qua (${skipped.length})`, sub: 'Liên hệ các thành viên này nếu cần họ cập nhật theo phiên bản mới.', actions: O.btn('Nhắc thành viên', { kind: 'primary', size: 'sm', icon: 'bell-ring', attrs: 'data-toast="Đã gửi nhắc tới các thành viên bị bỏ qua"' }) })}`;
      }
      const wiz = O.wizard([['Chọn hồ sơ và phiên bản'], ['Phạm vi và người nhận'], ['Xem trước và xác nhận']], st.step);
      let body = '';
      if (st.step === 0) {
        body = O.card(`<div class="tbl-wrap"><table class="tbl"><thead><tr><th class="c" style="width:44px"></th><th>Hồ sơ</th><th>Phiên bản báo cáo</th><th>Trạng thái sao chép</th><th>Thành viên</th></tr></thead><tbody>${SRC.map((s) => { const h = O.hs(s.ma); return `<tr class="${st.sel.has(s.ma) ? 'sel' : ''}"><td class="c"><input type="checkbox" data-pick="${s.ma}" ${st.sel.has(s.ma) ? 'checked' : ''} aria-label="Chọn ${s.ma}"></td><td>${O.prodCell(h)}</td><td>${O.tag('Phiên bản ' + s.v, 'purple', 'file-check-2')}</td><td>${s.copied === 'Chưa sao chép' ? O.tag(s.copied, 'gray') : O.tag(s.copied, 'teal', 'copy-check')}</td><td><span class="small">4 thành viên</span></td></tr>`; }).join('')}</tbody></table></div>`, { title: 'Hồ sơ đã có báo cáo Tổ tư vấn phát hành', sub: 'Chỉ hiển thị hồ sơ có báo cáo đã phát hành. Chọn một hoặc nhiều hồ sơ.', cls: 'flush', actions: '' }).replace('class="card-head"', 'class="card-head" style="padding:20px 20px 0"');
      } else if (st.step === 1) {
        const critList = st.scope === 'pick' ? `<div class="grid g-3" style="margin-top:6px">${PARTS.map((p) => `<div class="stack s8"><b class="small">${p.name}</b>${D.tieuchi.filter((t) => t.part === p.id).map((t) => `<label class="check"><input type="checkbox" data-crit="${t.code}" ${st.crit.has(t.code) ? 'checked' : ''}>${t.code}. ${esc(t.name)}</label>`).join('')}</div>`).join('')}</div>` : '';
        const memList = st.rcp === 'pick' ? `<div class="stack s8" style="margin-top:6px">${MEM.map((m) => `<label class="check" style="align-items:center"><input type="checkbox" data-mem="${m}" ${st.mem.has(m) ? 'checked' : ''}>${O.avatar(m, 'sm')}<span>${m}${m === 'Phạm Thị D' ? ` ${O.tag('Xung đột lợi ích: HS-2026-0124', 'red', 'ban')}` : ''}</span></label>`).join('')}</div>` : '';
        body = `<div class="grid g-2">${O.card(`<div class="radio-cards"><label class="radio-card"><input type="radio" name="scope" value="all" ${st.scope === 'all' ? 'checked' : ''}><span><b>Toàn bộ tiêu chí</b><br><span class="small muted">18 tiêu chí, Phần A, B, C</span></span></label><label class="radio-card"><input type="radio" name="scope" value="pick" ${st.scope === 'pick' ? 'checked' : ''}><span><b>Chọn tiêu chí</b><br><span class="small muted">Đã chọn ${st.crit.size} tiêu chí</span></span></label></div>${critList}`, { title: 'Phạm vi sao chép' })}
        ${O.card(`<div class="radio-cards"><label class="radio-card"><input type="radio" name="rcp" value="all" ${st.rcp === 'all' ? 'checked' : ''}><span><b>Tất cả thành viên được phân công</b><br><span class="small muted">4 thành viên</span></span></label><label class="radio-card"><input type="radio" name="rcp" value="pick" ${st.rcp === 'pick' ? 'checked' : ''}><span><b>Chọn từng người</b><br><span class="small muted">Đã chọn ${st.mem.size} người</span></span></label></div>${memList}${O.banner({ tone: 'orange', icon: 'ban', text: 'Phạm Thị D bị loại khỏi hồ sơ HS-2026-0124 do xung đột lợi ích và sẽ được bỏ qua tự động.' })}`, { title: 'Người nhận' })}</div>`;
      } else {
        const rows = SRC.filter((s) => st.sel.has(s.ma));
        const cnt = { new: 0, upd: 0, skip: 0 };
        rows.forEach((s) => s.out.forEach((o, i) => { if (!st.mem.has(MEM[i])) return; o === 'new' ? cnt.new++ : o === 'upd' ? cnt.upd++ : cnt.skip++; }));
        body = `<div class="grid g-3">${O.stat({ label: 'Phiếu mới', value: cnt.new, icon: 'file-plus-2', tone: 'green' })}${O.stat({ label: 'Cập nhật phiếu chưa chỉnh', value: cnt.upd, icon: 'refresh-cw', tone: 'blue' })}${O.stat({ label: 'Bỏ qua', value: cnt.skip, icon: 'skip-forward', tone: 'orange', sub: 'Đã chỉnh, đã xác nhận hoặc xung đột lợi ích' })}</div>
        ${O.card(`<div class="tbl-wrap"><table class="tbl mat"><thead><tr><th>Hồ sơ</th>${MEM.filter((m) => st.mem.has(m)).map((m) => `<th>${m}</th>`).join('')}</tr></thead><tbody>${rows.map((s) => `<tr><td>${O.prodCell(O.hs(s.ma))}<div class="tiny faint" style="margin-left:40px">Phiên bản ${s.v} · ${st.scope === 'all' ? '18 tiêu chí' : st.crit.size + ' tiêu chí'}</div></td>${MEM.map((m, i) => { if (!st.mem.has(m)) return ''; const o = OUT[s.out[i]]; return `<td class="${s.out[i] === 'new' || s.out[i] === 'upd' ? '' : 'cell-diff'}"><div class="outc">${O.tag(o[0], o[1], o[2])}${o[3] ? `<small>${o[3]}</small>` : ''}</div></td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`, { title: 'Kết quả dự kiến', sub: 'Phiếu thành viên đã chỉnh hoặc đã xác nhận không bao giờ bị ghi đè.' }).replace('class="card"', 'class="card" style="padding-bottom:6px"')}
        ${O.banner({ tone: 'blue', icon: 'info', text: 'Sao chép là một chiều. Hệ thống lưu giá trị gốc của Tổ tư vấn trên từng phiếu và ghi nhật ký người thực hiện, phiên bản nguồn, người nhận.' })}`;
      }
      const canNext = st.step === 0 ? st.sel.size > 0 : st.step === 1 ? st.mem.size > 0 && (st.scope === 'all' || st.crit.size > 0) : true;
      return `${head}${wiz}${body}<div class="row">${st.step > 0 ? O.btn('Quay lại', { kind: 'ghost', icon: 'arrow-left', attrs: 'data-back' }) : ''}<span class="spacer"></span><span class="small muted">${st.step === 0 ? `Đã chọn ${st.sel.size} hồ sơ` : ''}</span>${st.step < 2 ? O.btn('Tiếp tục', { kind: 'primary', icon: 'arrow-right', attrs: `data-nextstep ${canNext ? '' : 'disabled'}` }) : O.btn('Xác nhận sao chép', { kind: 'primary', icon: 'copy-check', attrs: 'data-docopy' })}</div>`;
    },
    mount(root) {
      const st = s53; if (!st) return;
      root.querySelectorAll('[data-pick]').forEach((c) => c.addEventListener('change', () => { c.checked ? st.sel.add(c.dataset.pick) : st.sel.delete(c.dataset.pick); O.rerender(); }));
      root.querySelectorAll('[data-crit]').forEach((c) => c.addEventListener('change', () => { c.checked ? st.crit.add(c.dataset.crit) : st.crit.delete(c.dataset.crit); O.rerender(); }));
      root.querySelectorAll('[data-mem]').forEach((c) => c.addEventListener('change', () => { c.checked ? st.mem.add(c.dataset.mem) : st.mem.delete(c.dataset.mem); O.rerender(); }));
      root.querySelectorAll('input[name=scope]').forEach((r) => r.addEventListener('change', () => { st.scope = r.value; O.rerender(); }));
      root.querySelectorAll('input[name=rcp]').forEach((r) => r.addEventListener('change', () => { st.rcp = r.value; if (r.value === 'all') st.mem = new Set(MEM); O.rerender(); }));
      root.querySelectorAll('.wizard .ws').forEach((w, i) => { if (i < st.step) { w.addEventListener('click', () => { st.step = i; O.rerender(); }); } });
      root.querySelector('[data-back]')?.addEventListener('click', () => { st.step--; O.rerender(); });
      root.querySelector('[data-nextstep]')?.addEventListener('click', () => { st.step++; O.rerender(); });
      root.querySelector('[data-docopy]')?.addEventListener('click', () => O.confirm({ title: 'Xác nhận sao chép?', what: `Điền điểm và căn cứ của Tổ tư vấn vào phiếu chấm của thành viên cho ${st.sel.size} hồ sơ. Phiếu đã chỉnh hoặc đã xác nhận được giữ nguyên.`, notify: 'Các thành viên nhận phiếu mới hoặc phiếu được cập nhật.', undo: 'Không tự hoàn tác. Thành viên vẫn tự điều chỉnh được trên phiếu của mình.', confirmText: 'Sao chép', icon: 'copy-check', onConfirm: () => { st.done = true; O.rerender(); O.toast('Đã sao chép dữ liệu Tổ tư vấn'); } }));
    },
  });

  /* ======= S60 Hồ sơ được phân công ======= */
  const ASG = [
    { ma: 'HS-2026-0124', rep: 1, ph: 'chua' },
    { ma: 'HS-2026-0125', rep: 0, ph: 'chua' },
    { ma: 'HS-2026-0123', rep: 2, ph: 'dang' },
    { ma: 'HS-2026-0128', rep: 2, ph: 'xn' },
    { ma: 'HS-2026-0126', rep: 3, ph: 'xn' },
  ];
  const PH = { chua: ['Chưa xem xét', 'gray', 'circle-dashed'], dang: ['Đang xem xét', 'blue', 'pencil-line'], xn: ['Đã xác nhận', 'green', 'badge-check'] };
  const phChip = (k) => O.tag(PH[k][0], PH[k][1], PH[k][2]);
  const repChip2 = (v) => v ? O.tag(`Có báo cáo Tổ tư vấn ${v}`, 'purple', 'file-check-2') : O.tag('Chưa có báo cáo Tổ tư vấn', 'gray');
  O.screen('s60', {
    title: 'Hồ sơ được phân công', code: 'S60', roles: ['thanhvien'], device: 'Cả hai', crumbs: [['Thành viên hội đồng', 's60']],
    variants: [['default', 'Mặc định'], ['empty', 'Chưa được phân công']],
    render({ variant }) {
      const rows = ASG.map((a) => Object.assign({}, O.hs(a.ma), a));
      const act = (r) => r.ph === 'xn' ? O.btn('Xem phiếu', { size: 'sm', icon: 'eye', go: 's61', attrs: `data-params='{"variant":"locked"}'` }) : O.btn('Mở phiếu chấm', { kind: r.ph === 'dang' ? 'soft' : 'primary', size: 'sm', icon: 'clipboard-pen', go: 's61' });
      if (variant === 'empty') return `${O.pageHead({ title: 'Hồ sơ được phân công' })}${O.card(O.empty({ icon: 'clipboard-list', title: 'Bạn chưa được phân công hồ sơ nào', text: 'Thư ký hội đồng sẽ phân công hồ sơ cho bạn. Bạn sẽ nhận thông báo khi có hồ sơ cần xem xét.' }))}`;
      return `${O.pageHead({ title: 'Hồ sơ được phân công', sub: `${D.dot.ten} · Hạn chấm của đợt 25/10/2026 (còn 6 ngày)` })}
      ${O.banner({ tone: 'amber', icon: 'clock', title: '2 hồ sơ chưa xem xét, còn 6 ngày tới hạn chấm', text: 'Mỗi phiếu chấm mất khoảng 20 phút khi đã có báo cáo Tổ tư vấn.', actions: O.btn('Mở hồ sơ đầu tiên', { kind: 'amber', size: 'sm', go: 's61' }) })}
      <div class="grid g-3">${O.stat({ label: 'Chưa xem xét', value: 2, icon: 'circle-dashed', tone: 'gray' })}${O.stat({ label: 'Đang xem xét', value: 1, icon: 'pencil-line', tone: 'blue' })}${O.stat({ label: 'Đã xác nhận', value: 2, icon: 'badge-check', tone: 'green' })}</div>
      <section class="card flush"><div style="padding:18px 20px" class="toolbar">${O.fchips([['Tất cả', 5], ['Chưa xem xét', 2], ['Đang xem xét', 1], ['Đã xác nhận', 2]])}</div>
      ${O.table({ cols: [{ l: 'Hồ sơ' }, { l: 'Nhóm sản phẩm' }, { l: 'Báo cáo Tổ tư vấn' }, { l: 'Phiếu của bạn' }, { l: 'Hạn' }, { l: '', cls: 'r' }], rows, pager: false,
        cell: (r, c) => c.l === 'Hồ sơ' ? O.prodCell(r) : c.l === 'Nhóm sản phẩm' ? `<span class="small">${esc(r.nhom)}</span>` : c.l === 'Báo cáo Tổ tư vấn' ? repChip2(r.rep) : c.l === 'Phiếu của bạn' ? phChip(r.ph) : c.l === 'Hạn' ? '<span class="small">25/10/2026</span>' : act(r),
        card: (r) => `<div class="mcard"><div class="row between nowrap"><b>${esc(r.sp)}</b>${phChip(r.ph)}</div><span class="small muted">${r.ma} · ${esc(r.nhom)} · Hạn 25/10/2026</span><div class="row">${repChip2(r.rep)}</div>${act(r).replace('btn ', 'btn block ')}</div>` })}</section>`;
    },
  });

  /* ======= S61 Phiếu chấm ======= */
  let sheet = null;
  const initSheet = () => { sheet = { ttv: {}, direct: {}, cmt: 'Sản phẩm đặc trưng tốt, cần lưu ý xử lý nước thải trước khi mở rộng sản xuất.' }; D.tieuchi.forEach((t) => { const e = D.tvEdits[t.code]; sheet.ttv[t.code] = { v: e ? e.v : t.ttv, ly: e ? e.ly : '', cmt: '' }; sheet.direct[t.code] = { v: '', ly: '', cmt: '' }; }); };
  const ttvBadge = `<span class="src-badge src-ttv">${ic('copy')}Từ Tổ tư vấn (phiên bản ${TTV_V})</span>`;
  const editBadge = `<span class="src-badge src-edit">${ic('pencil')}Đã chỉnh</span>`;
  const isEdited = (t, s) => s.v !== '' && +s.v !== t.ttv;
  const sheetCrit = (t, mode, locked) => {
    const s = sheet[mode === 'direct' ? 'direct' : 'ttv'][t.code]; const ed = mode !== 'direct' && isEdited(t, s); const fs = evFiles(t);
    return `<div class="crit ${ed ? 'flag-edit' : 'closed'}" data-code="${t.code}">
      <div class="crit-head" data-toggle><span class="crit-code">${t.code}</span><div class="crit-name">${esc(t.name)}<div class="crit-meta row s8" style="margin-top:4px">${mode !== 'direct' ? `<span data-badge>${ed ? editBadge : ttvBadge}</span>` : ''}<span>Tối đa ${t.max} điểm · ${fs.length} minh chứng</span></div></div>
        ${mode !== 'direct' ? `<span class="orig" data-orig title="Điểm đề xuất của Tổ tư vấn" ${ed ? '' : 'hidden'}>${t.ttv}</span>` : ''}
        ${O.scoreInput({ id: 'sc-' + t.code, value: s.v, max: t.max, cls: ed ? 'edited' : '', disabled: locked, label: 'Điểm ' + t.code })}${ic('chevron-down', 'chev')}</div>
      <div class="crit-body">
        ${mode !== 'direct' ? `<div class="ttv-note"><b>Căn cứ của Tổ tư vấn:</b> ${esc(t.can)}<div class="row s8" style="margin-top:8px">${fs.map(O.fileChip).join('') || O.tag('Không có minh chứng', 'orange')}</div></div>` : `<div class="row s8">${fs.map(O.fileChip).join('') || O.tag('Không có minh chứng', 'orange')}</div>`}
        ${mode !== 'direct' ? `<div class="field" data-reason ${ed ? '' : 'hidden'}><label for="ly-${t.code}">Lý do điều chỉnh<span class="req">*</span></label><textarea class="textarea" style="min-height:64px" id="ly-${t.code}" ${locked ? 'readonly' : ''} placeholder="Vì sao điểm của bạn khác đề xuất của Tổ tư vấn">${esc(s.ly)}</textarea><span class="err" data-lyerr hidden>${ic('circle-alert')}Nhập lý do vì điểm khác đề xuất của Tổ tư vấn (${t.ttv}).</span></div>` : ''}
        <div class="field"><label for="cm-${t.code}">Nhận xét tiêu chí <span class="faint">(tùy chọn)</span></label><textarea class="textarea" style="min-height:52px" id="cm-${t.code}" ${locked ? 'readonly' : ''}>${esc(s.cmt)}</textarea></div>
        ${!locked && mode !== 'direct' ? `<div><button type="button" class="btn sm ghost" data-restore ${ed ? '' : 'hidden'}>${ic('rotate-ccw')}<span>Khôi phục theo Tổ tư vấn</span></button></div>` : ''}
      </div></div>`;
  };
  const ttvPanel = () => `<div class="stack">
    <div class="row between">${O.tag('Phiên bản 2 · phát hành 14/10/2026', 'purple', 'file-check-2')}${O.btn('Mở bản PDF', { size: 'sm', kind: 'ghost', icon: 'file-text', attrs: 'data-preview="Bao-cao-TTV-HS-2026-0123-v2.pdf"' })}</div>
    <div class="row" style="gap:24px"><div><div class="tiny muted">Tổng điểm đề xuất</div><b style="font-size:26px">${ttvTotals.T}</b><span class="faint"> / 100</span></div><div><div class="tiny muted">Hạng gợi ý</div>${O.stars(4)}</div><div class="parts small muted">A ${ttvTotals.A}/40 · B ${ttvTotals.B}/25 · C ${ttvTotals.C}/35</div></div>
    <div class="ttv-note"><b>Nhận xét tổng hợp:</b> Sản phẩm có tính đặc thù cao, gắn với mùa nước nổi, nguyên liệu địa phương ổn định. Cần cải thiện xử lý môi trường và truy xuất nguồn gốc điện tử.</div>
    <div class="stack s8"><b class="small">Điểm cần hội đồng lưu ý</b>${NOTES.map(([c, n]) => `<div class="row s8 nowrap top small"><span class="crit-code">${c}</span><span>${n}</span></div>`).join('')}</div>
    <div>${D.tieuchi.map((t) => `<div class="ttv-item"><span class="crit-code">${t.code}</span><div class="small"><b>${esc(t.name)}</b><div class="muted">${esc(t.can)}</div></div><span class="sv">${t.ttv} / ${t.max}</span></div>`).join('')}</div></div>`;
  const s61Render = ({ variant }) => {
    if (!sheet) initSheet();
    const h = O.hs('HS-2026-0123');
    const mode = variant === 'direct' ? 'direct' : 'ttv'; const locked = variant === 'locked';
    const st = sheet[mode === 'direct' ? 'direct' : 'ttv'];
    const t = sumBy((x) => st[x.code].v);
    const nEd = mode === 'direct' ? 0 : D.tieuchi.filter((x) => isEdited(x, st[x.code])).length;
    const tabs = mode === 'direct' ? [['ev', 'Minh chứng'], ['info', 'Thông tin hồ sơ']] : [['ttv', 'Báo cáo Tổ tư vấn'], ['ev', 'Minh chứng'], ['info', 'Thông tin hồ sơ']];
    const doc = `<section class="card">${O.tabs(tabs, { ttv: ttvPanel(), ev: evidencePanel(), info: infoPanel(h) }, { style: 'line' })}</section>`;
    const cmp = mode === 'direct' ? '' : `<span class="cmp" data-cmp>${cmpText(t.T)}</span>`;
    const form = `<div class="stack">
      ${locked ? O.lockband('Bạn đã xác nhận phiếu lúc 16/10/2026 10:24', 'Phiếu đã khóa. Muốn sửa phải có yêu cầu từ hội đồng.') : mode === 'ttv' ? O.banner({ tone: 'purple', icon: 'info', title: 'Có phiên bản mới của báo cáo Tổ tư vấn', text: 'Phiên bản 2 đã phát hành 14/10/2026. Phiếu của bạn không bị thay đổi; xem khác biệt ở tab Báo cáo Tổ tư vấn.' }) : O.banner({ tone: 'blue', icon: 'pencil-ruler', text: 'Đợt này chấm trực tiếp: ô điểm để trống, bạn chấm từ đầu theo minh chứng.' })}
      ${PARTS.map((p) => `<div><div class="part-head"><h3>${p.name}</h3><span class="pt"><span data-pt="${p.id}">${t[p.id]}</span> / ${p.max}</span></div>${D.tieuchi.filter((x) => x.part === p.id).map((x) => sheetCrit(x, mode, locked)).join('')}</div>`).join('')}
      ${O.card(`<div class="stack"><div class="field"><label for="cm-all">Nhận xét chung</label><textarea class="textarea" id="cm-all" ${locked ? 'readonly' : ''}>${esc(sheet.cmt)}</textarea></div><div class="stack s8"><span class="label">Bằng chứng kiểm tra đính kèm</span>${O.file({ name: 'Anh-kiem-tra-thuc-te-xuong.jpg', size: '1,8 MB', type: 'jpg' }, { remove: !locked })}${locked ? '' : O.drop('Kéo thả bằng chứng kiểm tra vào đây', 'Ảnh hoặc PDF, tối đa 20 MB', true)}</div></div>`, { title: 'Nhận xét và bằng chứng' })}
      <div class="scorebar"><div><div class="tiny muted">Tổng điểm của bạn</div><div class="total"><span data-tot>${t.T}</span><small> / 100</small></div></div>
        <div class="stack s8" style="gap:6px"><div class="parts">${PARTS.map((p) => `<span>${p.id} <b data-pb="${p.id}">${t[p.id]}</b>/${p.max}</span>`).join('')}</div><div class="row s8">${cmp}${mode === 'direct' ? '' : `<span class="small muted"><span data-ned>${nEd}</span> tiêu chí đã chỉnh</span>`}</div></div>
        <div class="acts">${locked ? O.btn('Về danh sách', { kind: 'soft', icon: 'arrow-left', go: 's60' }) : `${O.btn('Lưu nháp', { icon: 'save', attrs: 'data-toast="Đã lưu nháp phiếu chấm"' })}${O.btn('Xác nhận phiếu', { kind: 'primary', icon: 'shield-check', attrs: 'data-confirm' })}`}</div></div></div>`;
    return `${O.pageHead({ title: `Phiếu chấm: ${esc(h.sp)}`, sub: `${h.ma} · ${esc(h.ct)} · ${esc(h.xa)} · Hạn chấm 25/10/2026`, chips: `<div class="row s8">${locked ? O.tag('Đã xác nhận', 'green', 'badge-check') : O.tag('Đang xem xét', 'blue', 'pencil-line')}${O.tag(mode === 'direct' ? 'Chấm trực tiếp' : 'Dựa trên Tổ tư vấn', 'teal', mode === 'direct' ? 'pencil-ruler' : 'copy')}<span class="tag">${esc(h.nhom)}</span></div>`, actions: `${O.btn('', { kind: 'ghost', icon: 'chevron-left', attrs: 'aria-label="Hồ sơ trước" data-toast="Hồ sơ trước: HS-2026-0124"' })}<span class="small muted" style="align-self:center">2 / 5</span>${O.btn('', { kind: 'ghost', icon: 'chevron-right', attrs: 'aria-label="Hồ sơ sau" data-toast="Hồ sơ sau: HS-2026-0125"' })}` })}
    ${locked ? '' : `<div class="kbd-hint hide-m"><span>${ic('keyboard')} Phím tắt:</span><span><kbd>Tab</kbd> ô điểm kế tiếp</span><span><kbd>↑</kbd><kbd>↓</kbd> tăng giảm điểm</span><span><kbd>Alt</kbd>+<kbd>M</kbd> mở minh chứng của tiêu chí</span></div>`}
    ${O.split(doc, form, { docLabel: mode === 'direct' ? 'Minh chứng' : 'Báo cáo và minh chứng', formLabel: 'Phiếu chấm' })}`;
  };
  function cmpText(total) { const d = total - ttvTotals.T; return `${ic('git-compare')}So với Tổ tư vấn: ${ttvTotals.T} → <b>${total}</b> (${d > 0 ? '+' + d : d < 0 ? '−' + -d : '±0'})`; }
  const s61Mount = (root, ctx) => {
    const mode = ctx.variant === 'direct' ? 'direct' : 'ttv'; const locked = ctx.variant === 'locked';
    const st = sheet[mode === 'direct' ? 'direct' : 'ttv'];
    const upd = () => { const t = sumBy((x) => st[x.code].v); PARTS.forEach((p) => { root.querySelector(`[data-pt="${p.id}"]`).textContent = t[p.id]; root.querySelector(`[data-pb="${p.id}"]`).textContent = t[p.id]; }); root.querySelector('[data-tot]').textContent = t.T; const c = root.querySelector('[data-cmp]'); if (c) c.innerHTML = cmpText(t.T); const ne = root.querySelector('[data-ned]'); if (ne) ne.textContent = D.tieuchi.filter((x) => isEdited(x, st[x.code])).length; };
    const refresh = (c) => {
      if (mode === 'direct') return; const t = TC(c.dataset.code), s = st[t.code], ed = isEdited(t, s);
      c.classList.toggle('flag-edit', ed); c.querySelector('[data-badge]').innerHTML = ed ? editBadge : ttvBadge; c.querySelector('[data-orig]').hidden = !ed; c.querySelector('[data-reason]').hidden = !ed; const r = c.querySelector('[data-restore]'); if (r) r.hidden = !ed; c.querySelector('.score').classList.toggle('edited', ed);
      if (ed) c.classList.remove('closed'); if (!ed) { c.classList.remove('flag-err'); c.querySelector('[data-lyerr]').hidden = true; }
    };
    root.querySelectorAll('.crit[data-code]').forEach((c) => {
      const code = c.dataset.code, s = st[code], inp = c.querySelector('input[type=number]');
      inp.addEventListener('focus', () => (root.dataset.focus = code));
      if (locked) return;
      inp.addEventListener('input', () => { s.v = inp.value === '' ? '' : +inp.value; refresh(c); upd(); c.classList.remove('flag-err'); });
      const ly = c.querySelector(`#ly-${code}`); if (ly) ly.addEventListener('input', () => { s.ly = ly.value; ly.classList.remove('invalid'); c.querySelector('[data-lyerr]').hidden = true; c.classList.remove('flag-err'); });
      const cm = c.querySelector(`#cm-${code}`); cm.addEventListener('input', () => (s.cmt = cm.value));
      c.querySelector('[data-restore]')?.addEventListener('click', () => { s.v = TC(code).ttv; s.ly = ''; inp.value = s.v; if (ly) ly.value = ''; refresh(c); upd(); c.classList.add('closed'); O.toast(`Đã khôi phục ${code} theo Tổ tư vấn`); });
    });
    root.querySelector('#cm-all')?.addEventListener('input', (e) => (sheet.cmt = e.target.value));
    root.querySelector('[data-confirm]')?.addEventListener('click', () => {
      let first = null, n = 0;
      root.querySelectorAll('.crit[data-code]').forEach((c) => {
        const t = TC(c.dataset.code), s = st[t.code];
        const out = s.v === '' || s.v > t.max || s.v < 0; const noLy = mode !== 'direct' && isEdited(t, s) && !s.ly.trim();
        c.querySelector('.score').classList.toggle('invalid', out);
        if (mode !== 'direct') { c.querySelector(`#ly-${t.code}`).classList.toggle('invalid', noLy); c.querySelector('[data-lyerr]').hidden = !noLy; }
        c.classList.toggle('flag-err', out || noLy); if (out || noLy) { n++; c.classList.remove('closed'); first = first || c; }
      });
      if (first) { O.toast(`${n} tiêu chí cần sửa trước khi xác nhận`, true); first.scrollIntoView({ block: 'center' }); return; }
      openOtp('default', mode);
    });
    root.addEventListener('keydown', (e) => { if (e.altKey && e.key.toLowerCase() === 'm') { e.preventDefault(); const t = TC(root.dataset.focus || 'A1'); O.previewFile(evFiles(t)[0] || D.files[0].name); } });
  };
  O.screen('s61', {
    title: 'Phiếu chấm', code: 'S61', roles: ['thanhvien'], device: 'Máy tính, máy tính bảng', crumbs: [['Hồ sơ được phân công', 's60'], ['HS-2026-0123', 's60']],
    variants: [['ttv', 'Dựa trên Tổ tư vấn'], ['direct', 'Chấm trực tiếp'], ['locked', 'Đã xác nhận']],
    render: s61Render, mount: s61Mount,
  });

  /* ======= S62 Xác nhận phiếu chấm (OTP) ======= */
  function openOtp(variant, mode = 'ttv') {
    if (!sheet) initSheet();
    const st = sheet[mode === 'direct' ? 'direct' : 'ttv'];
    const t = sumBy((x) => st[x.code].v);
    const eds = mode === 'direct' ? [] : D.tieuchi.filter((x) => isEdited(x, st[x.code]));
    const wrong = variant === 'wrong', exp = variant === 'expired';
    const body = `<div class="row" style="gap:20px"><div><div class="tiny muted">Tổng điểm</div><b style="font-size:30px">${t.T}</b><span class="faint"> / 100</span></div><div class="parts small muted">A ${t.A}/40 · B ${t.B}/25 · C ${t.C}/35<br>Hạng tương ứng: ${O.rankText(t.T)}</div></div>
      ${mode === 'direct' ? `<div class="conseq"><div>${ic('pencil-ruler')}<span>Chấm trực tiếp 18 tiêu chí.</span></div></div>` : `<div class="conseq"><div>${ic('copy')}<span>Giữ nguyên <b>${18 - eds.length} tiêu chí</b> theo Tổ tư vấn, điều chỉnh <b>${eds.length} tiêu chí</b>.</span></div></div>
      <div class="stack s8"><b class="small">Các tiêu chí đã chỉnh</b>${eds.map((x) => `<div class="row s8 nowrap top small" style="padding:8px 0;border-bottom:1px solid var(--line)"><span class="crit-code">${x.code}</span><div style="flex:1;min-width:0"><b>${esc(x.name)}</b>: <span class="orig">${x.ttv}</span> → <b>${st[x.code].v}</b><div class="muted">${esc(st[x.code].ly)}</div></div></div>`).join('')}</div>`}
      ${O.banner({ tone: 'red', icon: 'lock', title: 'Phiếu sẽ bị khóa. Muốn sửa phải có yêu cầu từ hội đồng.', text: 'Thư ký hội đồng nhận thông báo phiếu đã xác nhận, không thấy giá trị điểm.' })}
      <div class="field"><label for="otp62-0">Mã OTP từ ứng dụng xác thực</label>${O.otp('otp62', wrong)}
      ${wrong ? `<span class="err">${ic('circle-alert')}Mã không đúng. Còn 2 lần thử trước khi bị khóa 15 phút.</span>` : exp ? `<span class="err">${ic('clock')}Mã đã hết hạn. Mở ứng dụng xác thực để lấy mã mới.</span>` : `<span class="hint">Mã gồm 6 số, đổi sau mỗi 30 giây.</span>`}</div>`;
    const el = O.modal({ title: 'Xác nhận phiếu chấm', icon: 'shield-check', tone: 'blue', body, foot: `${O.btn('Xem lại phiếu', { kind: 'ghost', attrs: 'data-close' })}${O.btn('Xác nhận phiếu', { kind: 'primary', icon: 'shield-check', attrs: 'data-otpok' })}` });
    if (wrong) el.querySelectorAll('.otp input').forEach((i, k) => (i.value = '482915'[k]));
    el.querySelector('[data-otpok]').addEventListener('click', () => {
      const v = [...el.querySelectorAll('.otp input')].map((i) => i.value).join('');
      if (v.length < 6) { el.querySelector('.otp').classList.add('invalid'); O.toast('Nhập đủ 6 số của mã OTP', true); return; }
      el.remove(); O.toast('Đã xác nhận phiếu chấm HS-2026-0123'); O.go('s61', { variant: 'locked' });
    });
    return el;
  }
  O.screen('s62', {
    title: 'Xác nhận phiếu chấm (OTP)', code: 'S62', roles: ['thanhvien'], device: 'Cả hai', crumbs: [['Hồ sơ được phân công', 's60'], ['Phiếu chấm', 's61']],
    variants: [['default', 'Nhập mã'], ['wrong', 'Mã sai'], ['expired', 'Mã hết hạn']],
    render: (ctx) => s61Render({ variant: 'ttv' }),
    mount(root, ctx) { s61Mount(root, { variant: 'ttv' }); openOtp(ctx.variant); },
  });

  /* ======= S63 Điểm tổng hợp sau khi đủ phiếu ======= */
  const OTHER = { 'Nguyễn Văn A': { A4: 3, C1: 9 }, 'Phạm Thị D': { B3: 4, C1: 6, A5: 2 }, 'Đặng Quốc G': { C5: 3 } };
  const mScore = (m, t) => m === 'Lê Văn C' ? (D.tvEdits[t.code] ? D.tvEdits[t.code].v : t.ttv) : (OTHER[m][t.code] ?? t.ttv);
  O.screen('s63', {
    title: 'Điểm tổng hợp', code: 'S63', roles: ['thanhvien'], device: 'Cả hai', crumbs: [['Thành viên hội đồng', 's60']],
    variants: [['du', 'Đủ phiếu'], ['chua', 'Chưa đủ phiếu'], ['dachot', 'Đã chốt']],
    render({ variant }) {
      const h = O.hs('HS-2026-0123');
      const head = O.pageHead({ title: `Điểm tổng hợp: ${esc(h.sp)}`, sub: `${h.ma} · ${esc(h.ct)} · Chỉ đọc, không có thao tác chốt điểm`, chips: `<div class="row s8">${variant === 'dachot' ? O.chip('dachot') : variant === 'du' ? O.tag('Sẵn sàng chốt', 'green', 'circle-check') : O.chip('hdxemxet')}</div>`, actions: `${O.btn('', { kind: 'ghost', icon: 'chevron-left', attrs: 'aria-label="Hồ sơ trước" data-toast="Hồ sơ trước: HS-2026-0128"' })}<span class="small muted" style="align-self:center">1 / 3</span>${O.btn('', { kind: 'ghost', icon: 'chevron-right', attrs: 'aria-label="Hồ sơ sau" data-toast="Hồ sơ sau: HS-2026-0126"' })}` });
      if (variant === 'chua') return `${head}${O.card(`<div class="empty"><div class="eart">${ic('eye-off')}</div><h3>Điểm của các thành viên khác sẽ hiển thị khi hồ sơ đủ phiếu xác nhận</h3><p>Đã có 3 / 4 phiếu xác nhận. Khi phiếu cuối cùng được xác nhận, bảng so sánh sẽ mở cho tất cả thành viên để họp thống nhất.</p><div style="width:240px">${O.progress(3, 4, '', 'lg')}</div>${O.btn('Xem phiếu của tôi', { kind: 'soft', go: 's61', attrs: `data-params='{"variant":"locked"}'` })}</div>`)}`;
      const agg = (t) => MEM.reduce((a, m) => a + mScore(m, t), 0) / MEM.length;
      const sum = (f) => { const r = { A: 0, B: 0, C: 0 }; D.tieuchi.forEach((t) => (r[t.part] += f(t))); r.T = r.A + r.B + r.C; return r; };
      const mt = Object.fromEntries(MEM.map((m) => [m, sum((t) => mScore(m, t))]));
      const at = sum(agg);
      const r1 = (v) => fmt(Math.round(v * 10) / 10, Number.isInteger(Math.round(v * 10) / 10) ? 0 : 1);
      const rows = PARTS.map((p) => `<tr class="part-row"><td colspan="2">${p.name}</td>${MEM.map((m) => `<td>${mt[m][p.id]}</td>`).join('')}<td>${ttvTotals[p.id]}</td><td>${r1(at[p.id])}</td></tr>` + D.tieuchi.filter((t) => t.part === p.id).map((t) => {
        const vals = MEM.map((m) => mScore(m, t)); const mx = Math.max(...vals), mn = Math.min(...vals); const gap = mx - mn >= 2;
        return `<tr><td><span class="crit-code">${t.code}</span> <span class="small">${esc(t.name)}</span></td><td>${t.max}</td>${MEM.map((m, i) => { const v = vals[i]; const cl = gap && (v === mx || v === mn) ? 'cell-gap' : v !== t.ttv ? 'cell-diff' : ''; const why = m === 'Lê Văn C' && D.tvEdits[t.code] ? D.tvEdits[t.code].ly : v !== t.ttv ? 'Lý do điều chỉnh do thành viên ghi trên phiếu' : ''; return `<td class="${cl}" ${why ? `title="${esc(why)}"` : ''}>${v}</td>`; }).join('')}<td>${t.ttv}</td><td><b>${r1(agg(t))}</b>${gap ? ` <span title="Lệch lớn giữa các thành viên">${ic('triangle-alert', 'cell-bad')}</span>` : ''}</td></tr>`;
      }).join('')).join('');
      const table = `<div class="tbl-wrap" style="border-radius:0"><table class="tbl mat s63t"><thead><tr><th>Tiêu chí</th><th>Tối đa</th>${MEM.map((m) => `<th>${m}${m === 'Lê Văn C' ? '<br><span class="tiny">(Bạn)</span>' : ''}</th>`).join('')}<th>Đề xuất Tổ tư vấn</th><th>Tổng hợp</th></tr></thead><tbody>${rows}<tr class="total-row"><td colspan="2">Tổng điểm</td>${MEM.map((m) => `<td>${mt[m].T}</td>`).join('')}<td>${ttvTotals.T}</td><td>${r1(at.T)}</td></tr></tbody></table></div>`;
      const s = O.rank(at.T);
      const side = `<div class="stack">${O.card(`<div class="stack s12" style="align-items:flex-start">${O.stars(s, 5, 'lg')}<div><b style="font-size:34px">${r1(at.T)}</b><span class="faint"> / 100 điểm</span></div><span class="small muted">Điểm tổng hợp = trung bình cộng 4 phiếu đã xác nhận.</span><div class="stack s8 small" style="width:100%">${[[3, 50], [4, 70], [5, 90]].map(([k, v]) => `<div class="row between"><span>${O.stars(k, k)}</span><span>từ ${v} điểm</span></div>`).join('')}</div>${O.banner({ tone: 'green', icon: 'target', text: `Cao hơn ngưỡng 4 sao ${r1(at.T - 70)} điểm; còn ${r1(90 - at.T)} điểm tới ngưỡng 5 sao.` })}</div>`, { title: 'Gợi ý hạng' })}
        ${O.card(`<div class="stack s8 small"><div class="row s8 nowrap"><span class="tag cell-diff">7</span>Khác đề xuất Tổ tư vấn</div><div class="row s8 nowrap"><span class="tag cell-gap">9</span>Lệch từ 2 điểm giữa các thành viên</div><span class="muted">Di chuột vào ô để xem lý do điều chỉnh.</span></div>`, { title: 'Chú giải' })}</div>`;
      return `${head}${variant === 'dachot' ? O.lockband('Đã chốt điểm bởi Nguyễn Văn A (chủ tịch hội đồng), 18/10/2026 15:40', 'Mọi ô chỉ đọc. Kết quả chính thức: 4 sao.') : O.banner({ tone: 'green', icon: 'users', title: 'Đủ 4 / 4 phiếu xác nhận', text: 'Bảng dùng để họp thống nhất. Thư ký và chủ tịch hội đồng chốt điểm trong cuộc họp.' })}
      <div class="grid g-main"><section class="card flush">${table}</section>${side}</div>`;
    },
  });
})();
