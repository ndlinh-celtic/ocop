/* Nhóm Hội đồng đánh giá cấp tỉnh: S40 đến S45 (vai trò thư ký, chủ tịch hội đồng). */
(function () {
  const O = window.OCOP, D = O.data, ic = O.icon, esc = O.esc, fmt = O.fmt;
  document.head.insertAdjacentHTML('beforeend', `<style>
  .hd-mtx td.on { color: var(--brand); }
  .hd-mtx td .ck { width: 34px; height: 34px; border-radius: 10px; border: 1.5px solid var(--line-strong); display: inline-grid; place-items: center; cursor: pointer; background: var(--surface); color: var(--brand-ink); }
  .hd-mtx td .ck.on { background: var(--brand); border-color: var(--brand); }
  .hd-mtx td .ck.coi { border-style: dashed; color: var(--c-red); background: color-mix(in srgb, var(--c-red) 10%, var(--surface)); cursor: not-allowed; }
  .hd-mtx tr.short td { background: color-mix(in srgb, var(--c-orange) 8%, transparent); }
  .hd-mtx tr.short td:first-child { box-shadow: inset 3px 0 0 var(--c-orange); }
  .hd-mtx tr.pick td { background: var(--brand-soft); }
  .hd-mtx .select { min-height: 38px; padding: 6px 10px; font-size: 13.5px; min-width: 150px; }
  .hd-st { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; white-space: nowrap; }
  .hd-st.s0 { color: var(--text-3); } .hd-st.s1 { color: var(--c-blue); } .hd-st.s2 { color: var(--c-green); }
  .hd-cmp td, .hd-cmp th { text-align: center; }
  .hd-cmp td:first-child, .hd-cmp th:first-child { text-align: left; min-width: 290px; }
  @container main (max-width: 640px) { .hd-cmp td:first-child, .hd-cmp th:first-child { min-width: 170px; max-width: 170px; } }
  .hd-s41 { grid-template-columns: minmax(0, 1fr) 300px; }
  @container main (max-width: 1100px) { .hd-s41 { grid-template-columns: minmax(0, 1fr); } }
  .hd-cmp td.cl { cursor: pointer; font-weight: 600; }
  .hd-cmp td.ttvc { background: var(--surface-2); }
  .hd-cmp td.agg { font-weight: 700; color: var(--brand-deep); }
  .hd-cmp th .person { justify-content: center; }
  .hd-legend span { display: inline-flex; align-items: center; gap: 6px; }
  .hd-legend i { width: 14px; height: 14px; border-radius: 4px; display: inline-block; }
  .hd-doclist .li { padding: 10px 12px; border-radius: 14px; border: 1px solid transparent; cursor: pointer; }
  .hd-doclist .li.on { background: var(--brand-soft); border-color: color-mix(in srgb, var(--brand) 30%, transparent); }
  .hd-doclist .li:hover { background: var(--surface-2); }
  .hd-rank { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 6px 0 4px; }
  .hd-rank .big { font-size: 46px; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; }
  .hd-thr { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .hd-thr div { border: 1px solid var(--line); border-radius: 12px; padding: 8px; text-align: center; font-size: 12.5px; color: var(--text-2); }
  .hd-thr div.on { border-color: var(--brand); background: var(--brand-soft); color: var(--brand-deep); font-weight: 600; }
  .hd-load { display: inline-flex; gap: 4px; align-items: center; font-size: 11.5px; font-weight: 600; color: var(--text-3); }
  </style>`);

  const TV = ['Lê Văn C', 'Phạm Thị D', 'Nguyễn Văn A', 'Trần Thị B'];
  const TVROLE = { 'Lê Văn C': 'Thành viên', 'Phạm Thị D': 'Thành viên', 'Nguyễn Văn A': 'Chủ tịch', 'Trần Thị B': 'Thư ký' };
  // Điểm thành viên sinh xác định từ đề xuất Tổ tư vấn
  const DIFF = {
    'Phạm Thị D': { A4: [-1, 'Liên kết mới ở mức thỏa thuận miệng, chưa có hợp đồng.'], C1: [-3, 'Mẫu thử có vị mặn gắt, màu sẫm hơn mô tả trong hồ sơ.'], B4: [1, 'Có thêm kênh quảng bá trên truyền hình địa phương.'] },
    'Nguyễn Văn A': { A5: [-1, 'Đồng ý với nhận xét về xử lý nước thải.'], C2: [1, 'Phiếu kiểm nghiệm đạt toàn bộ chỉ tiêu.'] },
    'Trần Thị B': { A7: [1, 'Câu chuyện sản phẩm có ấn phẩm song ngữ.'] },
  };
  function sc(m, t) {
    if (m === 'Lê Văn C') { const e = D.tvEdits[t.code]; return e ? e.v : t.ttv; }
    const d = (DIFF[m] || {})[t.code]; return d ? Math.max(0, Math.min(t.max, t.ttv + d[0])) : t.ttv;
  }
  function reason(m, t) { if (m === 'Lê Văn C') return D.tvEdits[t.code]?.ly; return (DIFF[m] || {})[t.code]?.[1]; }
  const agg = (t) => TV.reduce((a, m) => a + sc(m, t), 0) / TV.length;
  const spread = (t) => { const v = TV.map((m) => sc(m, t)); return Math.max(...v) - Math.min(...v); };
  const f1 = (n) => fmt(n, 1);
  const tfaChip = (ok) => (ok ? O.tag('Đã bật 2FA', 'green', 'shield-check') : O.tag('Chưa bật 2FA', 'orange', 'shield-alert'));
  const roleTag = (vt) => O.tag(vt, { 'Chủ tịch': 'amber', 'Thư ký': 'blue', 'Tổ trưởng': 'purple' }[vt] || 'gray');
  const short = (n) => n;

  /* ================= S40 ================= */
  O.screen('s40', {
    title: 'Quản lý hội đồng', navTitle: 'Hội đồng', code: 'S40', roles: ['thuky'], device: 'Máy tính',
    crumbs: [['Hội đồng', 's40']],
    variants: [['default', 'Đang lập'], ['short', 'Chưa đủ thành viên'], ['approved', 'Đã phê duyệt']],
    render(ctx) {
      const v = ctx.variant, locked = v === 'approved';
      const hd = v === 'short' ? D.hoidong.slice(0, 3) : D.hoidong;
      const rows = (list, kind) => O.table({
        cols: [{ l: 'Họ tên' }, { l: 'Chức vụ, đơn vị' }, { l: 'Chuyên môn' }, { l: 'Vai trò' }, { l: 'Tài khoản' }, { l: '', cls: 'r', w: '60px' }],
        rows: list, pager: false,
        cell: (r, c) => ({ 'Họ tên': O.person(r.ten), 'Chức vụ, đơn vị': `<div>${esc(r.cv)}</div><div class="small faint">${esc(r.dv)}</div>`, 'Chuyên môn': esc(r.cm), 'Vai trò': roleTag(r.vt), 'Tài khoản': `<div class="row s8">${O.tag('Hoạt động', 'green')}${tfaChip(r.tfa)}</div>`, '': locked ? `<span class="faint">${ic('lock')}</span>` : `<button class="icon-btn" style="width:36px;height:36px" data-toast="Đã mở chỉnh sửa ${esc(r.ten)}" aria-label="Sửa">${ic('pencil')}</button>` }[c.l]),
        card: (r) => `<div class="mcard">${O.person(r.ten, r.cv + ' · ' + r.dv, roleTag(r.vt))}<div class="row s8">${tfaChip(r.tfa)}</div></div>`,
      });
      const banner = v === 'short'
        ? O.banner({ tone: 'orange', icon: 'users', title: 'Hội đồng chưa đủ số thành viên tối thiểu', text: 'Cấu hình yêu cầu tối thiểu 5 thành viên hội đồng. Hiện có 3. Thêm thành viên trước khi đề nghị phê duyệt.', actions: O.btn('Thêm thành viên', { kind: 'primary', size: 'sm', icon: 'user-plus', attrs: 'data-hd-add' }) })
        : locked ? O.lockband('Danh sách đã được phê duyệt', 'Quyết định số 215/QĐ-UBND ngày 20/09/2026. Mọi thay đổi phải ghi lý do và được lưu nhật ký.')
        : O.banner({ tone: 'orange', icon: 'shield-alert', title: '1 thành viên chưa bật xác thực hai lớp', text: 'Đặng Quốc G cần bật 2FA trước khi được mở phiếu chấm.', actions: O.btn('Gửi nhắc', { size: 'sm', attrs: 'data-toast="Đã gửi nhắc bật 2FA"' }) });
      const acts = locked ? O.btn('Đề nghị chỉnh sửa', { icon: 'file-pen', attrs: 'data-hd-edit' })
        : `${O.btn('Thêm thành viên', { icon: 'user-plus', attrs: 'data-hd-add' })}${O.btn('Đề nghị phê duyệt', { kind: 'primary', icon: 'send', attrs: `data-hd-approve ${v === 'short' ? 'disabled' : ''}` })}`;
      const chips = locked ? O.tag('Đã phê duyệt', 'green', 'badge-check') : O.tag('Đang lập danh sách', 'blue', 'pencil-line');
      const deci = (t, so, ngay, file) => `<div class="stack s8"><span class="small faint">${t}</span><div class="row s8"><b>${so}</b><span class="muted small">ngày ${ngay}</span></div>${O.fileChip(file)}</div>`;
      return `
      ${O.pageHead({ title: 'Hội đồng đánh giá, phân hạng sản phẩm OCOP cấp tỉnh', sub: `${D.dot.ten} · ${D.so}`, chips, actions: acts })}
      ${banner}
      <div class="grid g-main">
        ${O.card(`<div class="grid g-2">
            ${deci('Quyết định thành lập Hội đồng', '198/QĐ-UBND', '05/09/2026', 'QD-198-thanh-lap-hoi-dong.pdf')}
            ${deci('Quyết định thành lập Tổ tư vấn', '199/QĐ-UBND', '05/09/2026', 'QD-199-thanh-lap-to-tu-van.pdf')}
          </div>
          <hr class="divider" style="margin:18px 0">
          <div class="grid g-2">
            ${O.person('Nguyễn Văn A', 'Phó Giám đốc Sở NN&MT', roleTag('Chủ tịch'))}
            ${O.person('Trần Thị B', 'Trưởng phòng Phát triển nông thôn', roleTag('Thư ký'))}
          </div>`, { title: 'Thông tin hội đồng', sub: 'Thành lập theo QĐ 1489 cùng Tổ tư vấn', actions: locked ? '' : O.btn('Sửa', { kind: 'ghost', size: 'sm', icon: 'pencil', attrs: 'data-toast="Mở biểu mẫu thông tin hội đồng"' }) })}
        ${O.card(`<div class="stack s12">
            <div class="row between"><span class="muted">Thành viên hội đồng</span><b class="num">${hd.length} / 5 tối thiểu</b></div>${O.progress(hd.length, 5, hd.length < 5 ? 'orange' : 'green')}
            <div class="row between"><span class="muted">Thành viên Tổ tư vấn</span><b class="num">${D.totuvan.length} / 2 tối thiểu</b></div>${O.progress(3, 3, 'green')}
            <div class="row between"><span class="muted">Đã bật 2FA</span><b class="num">${hd.filter((x) => x.tfa).length + 3} / ${hd.length + 3}</b></div>
          </div>`, { title: 'Điều kiện phê duyệt' })}
      </div>
      <section class="card" style="padding:14px 0 0"><div style="padding:0 14px">${O.tabs([['hd', 'Hội đồng', hd.length], ['ttv', 'Tổ tư vấn', D.totuvan.length]], { hd: rows(hd), ttv: rows(D.totuvan) })}</div></section>`;
    },
    mount(root, ctx) {
      root.querySelectorAll('[data-hd-add]').forEach((b) => b.addEventListener('click', () => {
        const el = O.modal({ title: 'Thêm thành viên', icon: 'user-plus', body: `
          ${O.seg(['Chọn tài khoản có sẵn', 'Đề nghị quản trị tạo mới'], 0)}
          ${O.search('Tìm theo họ tên, email, đơn vị')}
          <div class="list">${[['Đặng Quốc G', 'Trường Đại học Cần Thơ'], ['Huỳnh Thanh L', 'Sở Khoa học và Công nghệ'], ['Châu Mỹ N', 'Liên minh HTX tỉnh']].map(([n, d], i) => `<label class="li clickable" style="cursor:pointer">${O.person(n, d)}<span class="spacer"></span><input type="radio" name="hd-pick" ${i === 1 ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--brand)"></label>`).join('')}</div>
          <div class="form-grid"><div class="field"><label for="hd-role">Vai trò</label><select class="select" id="hd-role"><option>Thành viên hội đồng</option><option>Thành viên Tổ tư vấn</option><option>Tổ trưởng Tổ tư vấn</option></select></div><div class="field"><label for="hd-cm">Chuyên môn</label><input class="input" id="hd-cm" value="Khoa học công nghệ"></div></div>
          <p class="small muted">Một người không thể vừa là thành viên Tổ tư vấn vừa chấm cùng một hồ sơ. Hệ thống sẽ chặn khi phân công.</p>`,
          foot: `${O.btn('Hủy', { kind: 'ghost', attrs: 'data-close' })}${O.btn('Thêm vào hội đồng', { kind: 'primary', attrs: 'data-close data-toast="Đã thêm Huỳnh Thanh L vào hội đồng"' })}` });
        O.bind(el);
      }));
      root.querySelector('[data-hd-approve]')?.addEventListener('click', () => O.confirm({ title: 'Gửi đề nghị phê duyệt danh sách', what: 'Danh sách 5 thành viên hội đồng và 3 thành viên Tổ tư vấn được gửi Chủ tịch UBND tỉnh (hoặc người được ủy quyền) xác nhận bằng văn bản.', notify: 'Văn phòng UBND tỉnh, chủ tịch hội đồng.', undo: 'Có thể rút đề nghị khi chưa được phê duyệt.', confirmText: 'Gửi đề nghị', icon: 'send', onConfirm: () => O.toast('Đã gửi đề nghị phê duyệt') }));
      root.querySelector('[data-hd-edit]')?.addEventListener('click', () => O.modal({ title: 'Đề nghị chỉnh sửa danh sách đã phê duyệt', icon: 'file-pen', tone: 'orange', body: `<div class="field"><label for="hd-why">Lý do chỉnh sửa<span class="req">*</span></label><textarea class="textarea" id="hd-why" placeholder="Ví dụ: Thay thành viên do nghỉ hưu"></textarea><span class="hint">Lý do được ghi vào nhật ký hoạt động.</span></div>`, foot: `${O.btn('Hủy', { kind: 'ghost', attrs: 'data-close' })}${O.btn('Mở khóa để chỉnh', { kind: 'primary', attrs: 'data-close data-toast="Đã ghi lý do, danh sách mở để chỉnh"' })}` }));
    },
  });

  /* ================= S41 ================= */
  const assign = { 'HS-2026-0123': [1, 1, 1, 1, 0], 'HS-2026-0124': [1, 1, 0, 1, 0], 'HS-2026-0125': [1, 0, 0, 1, 0], 'HS-2026-0128': [1, 1, 1, 0, 0], 'HS-2026-0129': [0, 0, 0, 0, 0], 'HS-2026-0126': [0, 1, 1, 1, 1] };
  const s41rows = () => D.hoso.filter((h) => assign[h.ma]);
  O.screen('s41', {
    title: 'Phân công hồ sơ và chế độ chấm', navTitle: 'Phân công', code: 'S41', roles: ['thuky'], device: 'Máy tính',
    crumbs: [['Hội đồng', 's40']],
    variants: [['default', 'Chưa có phiếu'], ['locked', 'Đã có phiếu (khóa chế độ)'], ['empty', 'Chưa có hồ sơ']],
    render(ctx) {
      const v = ctx.variant;
      const M = D.hoidong;
      if (v === 'empty') return `${O.pageHead({ title: 'Phân công hồ sơ' })}${O.card(O.empty({ icon: 'git-fork', title: 'Chưa có hồ sơ nào được Sở tiếp nhận', text: 'Hồ sơ xuất hiện ở đây sau khi cán bộ Sở tiếp nhận từ các xã.', action: O.btn('Xem hồ sơ toàn tỉnh', { kind: 'primary', go: 's32' }) }))}`;
      const load = M.map((m, j) => Object.values(assign).reduce((a, r) => a + r[j], 0));
      const rows = s41rows();
      const sel = rows[0];
      const modeBar = O.card(`<div class="row" style="gap:16px">
          <div class="stack s8" style="gap:2px;flex:1;min-width:220px"><b>Chế độ chấm của đợt</b><span class="small muted">Áp dụng cho mọi hồ sơ trong ${D.dot.ten}</span></div>
          ${v === 'locked' ? `<div class="seg" style="opacity:.6"><button disabled>Chấm trực tiếp</button><button class="on" disabled>${ic('lock')}Dựa trên Tổ tư vấn</button></div>` : O.seg(['Chấm trực tiếp', 'Dựa trên Tổ tư vấn'], 1)}
          <div class="row s8">${O.btn('Phân công theo nhóm sản phẩm', { size: 'sm', icon: 'layers', attrs: 'data-auto="nhom"' })}${O.btn('Phân công ngẫu nhiên cân bằng', { size: 'sm', icon: 'shuffle', attrs: 'data-auto="rand"' })}</div>
        </div>${v === 'locked' ? `<div style="margin-top:14px">${O.banner({ tone: 'gray', icon: 'lock', text: 'Không đổi được chế độ chấm vì đã có 14 phiếu được mở hoặc xác nhận. Đổi chế độ lúc này làm sai lệch phiếu đã có.' })}</div>` : ''}`, { cls: 'tight' });
      const head = `<tr><th>Hồ sơ</th><th>Tổ tư vấn phụ trách</th>${M.map((m, j) => `<th><div class="stack s8" style="gap:2px;align-items:center"><span>${esc(short(m.ten))}</span><span class="hd-load">${ic('briefcase')}${load[j]} hồ sơ</span></div></th>`).join('')}<th>Số người chấm</th></tr>`;
      const body = rows.map((h, i) => {
        const a = assign[h.ma]; const n = a.reduce((x, y) => x + y, 0); const isShort = n < 3;
        return `<tr class="${isShort ? 'short' : ''} ${i === 0 ? 'pick' : ''}" data-row="${h.ma}" style="cursor:pointer"><td>${O.prodCell(h)}</td><td><select class="select" aria-label="Tổ tư vấn phụ trách">${['Chưa chọn', ...D.totuvan.map((t) => t.ten)].map((t) => `<option ${t === (h.ttv || 'Chưa chọn') ? 'selected' : ''}>${t}</option>`).join('')}</select></td>${a.map((x, j) => {
          const coi = h.ma === 'HS-2026-0126' && j === 4;
          return `<td class="c">${coi ? `<span class="ck coi" title="Xung đột lợi ích: là người thân của chủ thể">${ic('ban')}</span>` : `<span class="ck ${x ? 'on' : ''}" data-ck role="checkbox" aria-checked="${!!x}" tabindex="0">${x ? ic('check') : ''}</span>`}</td>`;
        }).join('')}<td class="c">${isShort ? O.tag(`${n} / 3`, 'orange', 'triangle-alert') : O.tag(`${n} / 3`, 'green', 'check')}</td></tr>`;
      }).join('');
      const side = O.card(`<div class="stack s12">
          <div class="row s8">${O.chip(sel.st)}</div>
          ${O.dl([['Mã hồ sơ', sel.ma], ['Chủ thể', esc(sel.ct)], ['Xã/phường', sel.xa], ['Nhóm', sel.nhom], ['Tổ tư vấn', sel.ttv || 'Chưa chọn']])}
          <hr class="divider">
          <b>Người chấm (4)</b>
          <div class="list">${TV.map((m) => `<div class="li">${O.person(m, TVROLE[m])}</div>`).join('')}</div>
          ${O.banner({ tone: 'orange', icon: 'user-x', title: 'Ghi chú xung đột lợi ích', text: 'HS-2026-0126: Đặng Quốc G là người thân của chủ thể. Thư ký đã thay bằng Phạm Thị D, lý do được ghi vào hồ sơ.' })}
        </div>`, { title: 'Chi tiết hồ sơ', sub: esc(sel.sp) });
      return `
      ${O.pageHead({ title: 'Phân công hồ sơ và chọn chế độ chấm', sub: 'Mỗi hồ sơ cần tối thiểu 3 thành viên chấm và 1 thành viên Tổ tư vấn phụ trách.', actions: O.btn('Lưu phân công', { kind: 'primary', icon: 'save', attrs: 'data-toast="Đã lưu phân công, thành viên nhận thông báo"' }) })}
      ${modeBar}
      <div class="grid hd-s41" style="align-items:start">
        <section class="card flush"><div class="tbl-wrap"><table class="tbl mat hd-mtx"><thead>${head}</thead><tbody>${body}</tbody></table></div>
        <div class="pager"><span class="row s8">${ic('triangle-alert')} 2 hồ sơ chưa đủ số người chấm</span></div></section>
        ${side}
      </div>`;
    },
    mount(root) {
      const toggle = (c) => { const on = !c.classList.contains('on'); c.classList.toggle('on', on); c.innerHTML = on ? ic('check') : ''; c.setAttribute('aria-checked', on); recount(c.closest('tr')); };
      const recount = (tr) => { const n = tr.querySelectorAll('.ck.on').length; tr.classList.toggle('short', n < 3); tr.lastElementChild.innerHTML = n < 3 ? O.tag(`${n} / 3`, 'orange', 'triangle-alert') : O.tag(`${n} / 3`, 'green', 'check'); };
      root.querySelectorAll('[data-ck]').forEach((c) => { c.addEventListener('click', (e) => { e.stopPropagation(); toggle(c); }); c.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(c); } }); });
      root.querySelectorAll('.ck.coi').forEach((c) => c.addEventListener('click', (e) => { e.stopPropagation(); O.toast('Không phân công được: xung đột lợi ích với chủ thể', true); }));
      root.querySelectorAll('tr[data-row]').forEach((tr) => tr.addEventListener('click', (e) => { if (e.target.closest('select')) return; root.querySelectorAll('tr[data-row]').forEach((x) => x.classList.toggle('pick', x === tr)); }));
      root.querySelectorAll('[data-auto]').forEach((b) => b.addEventListener('click', () => {
        root.querySelectorAll('tr[data-row]').forEach((tr, i) => { tr.querySelectorAll('[data-ck]').forEach((c, j) => { const on = b.dataset.auto === 'nhom' ? j < 3 || (i % 2 && j === 3) : (i + j) % 5 < 3; c.classList.toggle('on', on); c.innerHTML = on ? ic('check') : ''; }); recount(tr); });
        O.toast(b.dataset.auto === 'nhom' ? 'Đã phân công theo nhóm sản phẩm' : 'Đã phân công ngẫu nhiên, mỗi người 3 đến 4 hồ sơ');
      }));
    },
  });

  /* ================= S42 ================= */
  // 0 chưa mở, 1 đang xem xét, 2 đã xác nhận
  const PROG = { 'HS-2026-0123': [2, 2, 2, 2], 'HS-2026-0124': [2, 1, 2, 0], 'HS-2026-0125': [0, 0, 1, 0], 'HS-2026-0128': [2, 2, 2, 2], 'HS-2026-0126': [2, 2, 2, 2], 'HS-2026-0127': [2, 2, 1, 2] };
  const ST = [['Chưa mở', 'circle-dashed', 's0'], ['Đang xem xét', 'loader', 's1'], ['Đã xác nhận', 'circle-check', 's2']];
  O.screen('s42', {
    title: 'Tiến độ chấm của đợt', navTitle: 'Tiến độ chấm', code: 'S42', roles: ['thuky'], device: 'Máy tính',
    crumbs: [['Hội đồng', 's40']],
    variants: [['default', 'Đang chấm'], ['loading', 'Đang tải'], ['error', 'Lỗi tải']],
    render(ctx) {
      const R = O.ROLES.thuky;
      const head = O.pageHead({ title: `Chào ${R.user.split(' ').pop()}, đây là tiến độ chấm`, sub: `${D.dot.ten} · Hạn đánh giá của tỉnh ${D.dot.hanTinh} · Chế độ: ${D.dot.cheDo}`, actions: `${O.btn('Nhắc thành viên chưa xác nhận', { icon: 'bell-ring', attrs: 'data-remind' })}${O.btn('Mở bảng chốt điểm', { kind: 'primary', icon: 'lock', go: 's43' })}` });
      if (ctx.variant === 'loading') return head + O.card(O.skeleton(6));
      if (ctx.variant === 'error') return head + O.card(O.loadError('tiến độ chấm'));
      const rows = D.hoso.filter((h) => PROG[h.ma]);
      const all = rows.flatMap((h) => PROG[h.ma]); const done = all.filter((x) => x === 2).length;
      const ready = rows.filter((h) => PROG[h.ma].every((x) => x === 2)).length;
      const gapRows = ['HS-2026-0123'];
      const stats = `<div class="grid g-4">
        ${O.stat({ label: 'Phiếu đã xác nhận', value: `${done}<span class="faint" style="font-size:18px"> / ${all.length}</span>`, icon: 'badge-check', tone: 'green' })}
        ${O.stat({ label: 'Hồ sơ sẵn sàng chốt', value: ready, icon: 'lock-open', tone: 'blue', go: 's43' })}
        ${O.stat({ label: 'Phiếu đang xem xét', value: all.filter((x) => x === 1).length, icon: 'loader', tone: 'purple' })}
        ${O.stat({ label: 'Phiếu chưa mở', value: all.filter((x) => x === 0).length, icon: 'circle-dashed', tone: 'orange', sub: 'Gần hạn 25/10/2026' })}
      </div>`;
      const table = O.table({
        matrix: true, pager: false,
        cols: [{ l: 'Hồ sơ' }, ...TV.map((m) => ({ l: esc(short(m)), m })), { l: 'Trạng thái hồ sơ' }, { l: 'Cờ' }],
        rows,
        cell: (h, c) => {
          const p = PROG[h.ma]; const full = p.every((x) => x === 2);
          if (c.l === 'Hồ sơ') return O.prodCell(h);
          if (c.m) { const s = ST[p[TV.indexOf(c.m)]]; return `<span class="hd-st ${s[2]}">${ic(s[1])}${s[0]}</span>`; }
          if (c.l === 'Trạng thái hồ sơ') return full ? O.tag('Sẵn sàng chốt', 'green', 'lock-open') : O.tag('Đang chấm', 'purple', 'loader');
          return full && gapRows.includes(h.ma) ? O.tag('Lệch điểm lớn', 'red', 'triangle-alert') : '<span class="faint">—</span>';
        },
        card: (h) => { const p = PROG[h.ma]; const full = p.every((x) => x === 2); return `<div class="mcard">${O.prodCell(h)}<div class="row s8">${full ? O.tag('Sẵn sàng chốt', 'green', 'lock-open') : O.tag('Đang chấm', 'purple')}${O.progress(p.filter((x) => x === 2).length, 4)}</div></div>`; },
      });
      return `${head}${stats}
      ${O.card(`<div class="row between" style="margin-bottom:8px"><span class="muted">Phiếu đã xác nhận trên toàn đợt</span><b class="num">${Math.round((done / all.length) * 100)}%</b></div>${O.progress(done, all.length, '', 'lg')}
        <div class="legend" style="margin-top:12px">${ST.map((s) => `<span class="hd-st ${s[2]}">${ic(s[1])}${s[0]}</span>`).join('')}<span class="row s8">${ic('eye-off')} Giá trị điểm không hiển thị trước khi hồ sơ đủ phiếu</span></div>`, { cls: 'tight' })}
      ${O.card(table, { cls: 'flush' })}`;
    },
    mount(root) {
      root.querySelector('[data-remind]')?.addEventListener('click', () => O.confirm({ title: 'Nhắc thành viên chưa xác nhận phiếu', what: 'Gửi thông báo trong ứng dụng và email tới 3 thành viên còn phiếu chưa xác nhận (Phạm Thị D, Nguyễn Văn A, Trần Thị B).', notify: '3 thành viên hội đồng. Nội dung không chứa điểm.', undo: 'Không thu hồi được thông báo đã gửi.', confirmText: 'Gửi nhắc', icon: 'bell-ring', onConfirm: () => O.toast('Đã gửi nhắc 3 thành viên') }));
    },
  });

  /* ================= S43 ================= */
  const S43LIST = ['HS-2026-0123', 'HS-2026-0128', 'HS-2026-0126'];
  O.screen('s43', {
    title: 'Tổng hợp điểm và chốt', navTitle: 'Chốt điểm', code: 'S43', roles: ['thuky'], device: 'Máy tính',
    crumbs: [['Tiến độ chấm', 's42']],
    variants: [['default', 'Đủ phiếu'], ['pending', 'Chưa đủ phiếu'], ['locked', 'Đã chốt']],
    render(ctx) {
      const v = ctx.variant, locked = v === 'locked', pending = v === 'pending';
      const h = O.hs(ctx.params.id || 'HS-2026-0123');
      const idx = Math.max(0, S43LIST.indexOf(h.ma));
      const tot = O.sumParts(agg); const ttv = O.sumParts((t) => t.ttv);
      const mt = TV.map((m) => O.sumParts((t) => sc(m, t)));
      const star = O.rank(tot.T);
      const next = [50, 70, 90].find((x) => x > tot.T);
      const cellM = (m, t) => {
        if (pending && m !== 'Lê Văn C' && m !== 'Nguyễn Văn A') return '<span class="faint">ẩn</span>';
        return sc(m, t);
      };
      let body = '';
      D.parts.forEach((p) => {
        body += `<tr class="part-row"><td>${p.name}</td>${TV.map((m, j) => `<td>${pending && j % 2 ? '' : fmt(mt[j][p.id])}</td>`).join('')}<td>${ttv[p.id]}</td><td>${f1(tot[p.id])} / ${p.max}</td></tr>`;
        D.tieuchi.filter((t) => t.part === p.id).forEach((t) => {
          const gap = !pending && spread(t) >= 3;
          body += `<tr><td><span class="crit-code" style="margin-right:8px">${t.code}</span>${esc(t.name)} <span class="faint small">/ ${t.max}</span></td>${TV.map((m) => {
            const s = sc(m, t); const diff = s !== t.ttv && !(pending && m !== 'Lê Văn C' && m !== 'Nguyễn Văn A');
            return `<td class="${diff ? 'cl cell-diff' : ''} ${gap ? 'cell-gap' : ''}" ${diff ? `data-why="${esc(m)}|${t.code}"` : ''}>${cellM(m, t)}</td>`;
          }).join('')}<td class="ttvc">${t.ttv}</td><td class="agg">${pending ? '—' : f1(agg(t))}</td></tr>`;
        });
      });
      body += `<tr class="total-row"><td>Tổng điểm</td>${mt.map((x, j) => `<td>${pending && j % 2 ? '' : x.T}</td>`).join('')}<td>${ttv.T}</td><td>${pending ? '—' : f1(tot.T)}</td></tr>`;
      const head = `<tr><th>Tiêu chí</th>${TV.map((m) => `<th>${esc(short(m))}<div class="tiny faint" style="font-weight:500">${TVROLE[m]}</div></th>`).join('')}<th>Đề xuất Tổ tư vấn</th><th>Tổng hợp</th></tr>`;
      const switcher = `<div class="row s8"><button class="icon-btn" ${idx > 0 ? `data-go="s43" data-params='{"id":"${S43LIST[idx - 1]}"}'` : 'disabled style="opacity:.4"'} aria-label="Hồ sơ trước">${ic('chevron-left')}</button><span class="small muted num">${idx + 1} / ${S43LIST.length}</span><button class="icon-btn" ${idx < S43LIST.length - 1 ? `data-go="s43" data-params='{"id":"${S43LIST[idx + 1]}"}'` : 'disabled style="opacity:.4"'} aria-label="Hồ sơ sau">${ic('chevron-right')}</button></div>`;
      const top = locked ? O.lockband('Điểm đã chốt, mọi ô chỉ đọc', 'Chốt bởi Nguyễn Văn A (chủ tịch) lúc 16:42 ngày 18/10/2026. Mở khóa xử lý ngoài giao diện này theo quy chế.')
        : pending ? O.banner({ tone: 'orange', icon: 'hourglass', title: 'Hồ sơ chưa đủ phiếu xác nhận (2 / 4)', text: 'Điểm của thành viên chưa xác nhận được ẩn. Nút chốt điểm mở khi tất cả thành viên được phân công đã xác nhận phiếu.' })
        : O.banner({ tone: 'green', icon: 'badge-check', title: 'Đủ 4 / 4 phiếu xác nhận', text: 'Hội đồng có thể họp thống nhất và chốt điểm. Có 1 tiêu chí lệch lớn giữa các thành viên (C1).' });
      const rankCard = O.card(`<div class="hd-rank">
          <span class="small muted">Điểm tổng hợp (trung bình ${TV.length} thành viên)</span>
          <span class="big">${pending ? '—' : f1(tot.T)}</span>
          ${pending ? '<span class="muted small">Chờ đủ phiếu</span>' : `${O.stars(star, 5, 'lg')}<b>${O.rankText(tot.T)}</b>`}
        </div>
        <div class="hd-thr">${[[3, 50], [4, 70], [5, 90]].map(([s, x]) => `<div class="${!pending && star === s ? 'on' : ''}">${s} sao<br><b>từ ${x}</b></div>`).join('')}</div>
        ${!pending && next ? `<p class="small muted" style="margin-top:12px">${ic('trending-up')} Cách ngưỡng ${O.rank(next)} sao <b>${f1(next - tot.T)} điểm</b>. Ngưỡng theo ${D.dot.phienBan}.</p>` : ''}
        <hr class="divider" style="margin:16px 0">
        <div class="field"><label for="hd-cmt">Nhận xét tổng hợp của hội đồng</label><textarea class="textarea" id="hd-cmt" ${locked ? 'readonly' : ''}>Sản phẩm có đặc trưng vùng mùa nước nổi, nguồn nguyên liệu địa phương ổn định. Cần đầu tư hệ thống xử lý nước thải và mã truy xuất nguồn gốc điện tử.</textarea><span class="hint">Nội dung này được gửi tới chủ thể cùng kết quả.</span></div>
        <div style="margin-top:14px">${locked ? O.btn('Đã chốt', { kind: 'block', icon: 'lock', attrs: 'disabled' }) : O.btn('Chốt điểm', { kind: 'danger block', icon: 'lock', attrs: `data-lock ${pending ? 'disabled' : ''}` })}</div>`, { title: 'Gợi ý hạng', info: true });
      return `
      ${O.pageHead({ title: esc(h.sp), sub: `${h.ma} · ${esc(h.ct)} · ${h.nhom}`, chips: `${O.chip(locked ? 'dachot' : 'daxacnhan')}${O.tag(D.dot.cheDo, 'purple', 'file-check-2')}`, actions: switcher })}
      ${top}
      <div class="grid g-main">
        <div class="stack">
          <section class="card flush"><div class="tbl-wrap" style="border-radius:var(--r-xl) var(--r-xl) 0 0"><table class="tbl mat hd-cmp"><thead>${head}</thead><tbody>${body}</tbody></table></div>
          <div class="pager hd-legend"><span><i style="background:color-mix(in srgb,var(--c-orange) 25%,transparent)"></i>Khác đề xuất Tổ tư vấn (bấm để xem lý do)</span><span><i style="background:color-mix(in srgb,var(--c-red) 20%,transparent)"></i>Lệch lớn giữa thành viên (từ 3 điểm)</span></div></section>
        </div>
        <div class="stack">${rankCard}</div>
      </div>`;
    },
    mount(root, ctx) {
      root.querySelectorAll('[data-why]').forEach((td) => td.addEventListener('click', (e) => {
        e.stopPropagation();
        const [m, code] = td.dataset.why.split('|'); const t = D.tieuchi.find((x) => x.code === code);
        O.pop(td, `<div class="pop-h">${ic('pencil-line')}${esc(m)} điều chỉnh ${code}</div><div style="padding:0 16px 14px;max-width:320px" class="stack s8"><div class="row s8"><span class="orig">${t.ttv}</span>${ic('arrow-right')}<b>${sc(m, t)} / ${t.max}</b><span class="src-badge src-edit">Đã chỉnh</span></div><p class="small">${esc(reason(m, t))}</p></div>`);
      }));
      root.querySelector('[data-lock]')?.addEventListener('click', () => {
        const tot = O.sumParts(agg);
        O.confirm({ title: 'Chốt điểm hồ sơ', kind: 'danger', what: `Sau khi chốt, điểm bị khóa và không sửa được trên giao diện. Điểm tổng hợp ${f1(tot.T)}, hạng gợi ý ${O.rankText(tot.T)}.`, notify: 'Thư ký, chủ tịch hội đồng và cán bộ Sở. Chủ thể chưa nhận kết quả cho tới khi công bố.', undo: 'Không. Mở khóa phải theo quy trình ngoài giao diện và được ghi nhật ký.', typeWord: 'CHỐT', confirmText: 'Chốt điểm', icon: 'lock', extra: `<div class="row s8">${O.stars(O.rank(tot.T))}<b>${O.rankText(tot.T)}</b><span class="muted">· ${f1(tot.T)} điểm</span></div>`, onConfirm: () => { O.toast('Đã chốt điểm HS-2026-0123'); O.setVariant('locked'); } });
      });
    },
  });

  /* ================= S44 ================= */
  const DOCS = [
    ['tonghop', 'Bảng tổng hợp điểm', 'table-2', 'Đã ký', 'v2'],
    ['bienban', 'Biên bản họp hội đồng', 'file-text', 'Nháp', 'v1'],
    ['quyetdinh', 'Quyết định công nhận', 'stamp', 'Nháp', 'v1'],
  ];
  const docHd = `<div class="doc-hd"><div><b>UBND TỈNH MẪU</b><br>HỘI ĐỒNG ĐÁNH GIÁ, PHÂN HẠNG<br>SẢN PHẨM OCOP CẤP TỈNH</div><div><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><u>Độc lập - Tự do - Hạnh phúc</u><br><i>Tỉnh Mẫu, ngày 18 tháng 10 năm 2026</i></div></div>`;
  function docBody(k, draft) {
    const rows = D.hoso.filter((h) => h.diem).slice(0, 7);
    const wm = draft ? `<div style="text-align:center;color:#b33;font-weight:700;letter-spacing:.2em;margin-bottom:8px">BẢN NHÁP</div>` : '';
    if (k === 'tonghop') return `${wm}${docHd}<h3>BẢNG TỔNG HỢP KẾT QUẢ ĐÁNH GIÁ, PHÂN HẠNG</h3><p style="text-align:center"><i>${D.dot.ten}</i></p><table><thead><tr><th>TT</th><th>Sản phẩm</th><th>Chủ thể</th><th>A</th><th>B</th><th>C</th><th>Tổng</th><th>Hạng</th></tr></thead><tbody>${rows.map((h, i) => `<tr><td>${i + 1}</td><td>${esc(h.sp)}</td><td>${esc(h.ct)}</td><td>${Math.round(h.diem * 0.41)}</td><td>${Math.round(h.diem * 0.23)}</td><td>${h.diem - Math.round(h.diem * 0.41) - Math.round(h.diem * 0.23)}</td><td><b>${h.diem}</b></td><td>${h.sao ? h.sao + ' sao' : 'Chưa đạt'}</td></tr>`).join('')}</tbody></table><p>Ghi chú: sản phẩm từ 90 điểm được đề nghị UBND tỉnh gửi đánh giá 5 sao (thực hiện ngoài hệ thống).</p>`;
    if (k === 'bienban') return `${wm}${docHd}<h3>BIÊN BẢN HỌP HỘI ĐỒNG</h3><h4>Đánh giá, phân hạng sản phẩm OCOP ${D.dot.ten.toLowerCase()}</h4><p>Hôm nay, lúc 14 giờ 00 ngày 18/10/2026, tại ${D.so}, Hội đồng tiến hành họp đánh giá, phân hạng sản phẩm OCOP.</p><p><b>I. Thành phần tham dự:</b> ${D.hoidong.map((m) => `${m.ten} (${m.vt.toLowerCase()})`).join('; ')}.</p><p><b>II. Nội dung:</b> Hội đồng xem xét báo cáo của Tổ tư vấn, phiếu chấm của các thành viên đối với <span class="hl">7 sản phẩm</span>; thống nhất điểm tổng hợp theo phương pháp trung bình cộng.</p><p><b>III. Kết luận:</b> Đề nghị công nhận <span class="hl">4 sản phẩm 4 sao, 1 sản phẩm 3 sao</span>; 2 sản phẩm từ 90 điểm đề nghị đánh giá 5 sao; 1 sản phẩm chưa đạt.</p><p>Biên bản kết thúc lúc 16 giờ 45 cùng ngày.</p><div class="doc-hd" style="margin-top:24px"><div><b>THƯ KÝ</b><br><br><br>Trần Thị B</div><div><b>CHỦ TỊCH HỘI ĐỒNG</b><br><br><br>Nguyễn Văn A</div></div>`;
    return `${wm}<div class="doc-hd"><div><b>ỦY BAN NHÂN DÂN<br>TỈNH MẪU</b><br>Số: ......./QĐ-UBND</div><div><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><u>Độc lập - Tự do - Hạnh phúc</u></div></div><h3>QUYẾT ĐỊNH</h3><h4>Về việc công nhận kết quả đánh giá, phân hạng sản phẩm OCOP ${D.dot.ten.toLowerCase()}</h4><p style="text-align:center"><b>CHỦ TỊCH ỦY BAN NHÂN DÂN TỈNH MẪU</b></p><p><i>Căn cứ Quyết định số 26/2026/QĐ-TTg; xét đề nghị của Hội đồng đánh giá, phân hạng sản phẩm OCOP cấp tỉnh,</i></p><p style="text-align:center"><b>QUYẾT ĐỊNH:</b></p><p><b>Điều 1.</b> Công nhận <span class="hl">05 sản phẩm</span> đạt sản phẩm OCOP cấp tỉnh (danh sách kèm theo).</p><p><b>Điều 2.</b> Giấy chứng nhận có giá trị 36 tháng kể từ ngày ký.</p><p><b>Điều 3.</b> Chánh Văn phòng UBND tỉnh, Giám đốc Sở NN&MT và các chủ thể có tên tại Điều 1 chịu trách nhiệm thi hành.</p>`;
  }
  O.screen('s44', {
    title: 'Biên bản và quyết định', navTitle: 'Văn bản', code: 'S44', roles: ['thuky'], device: 'Máy tính',
    crumbs: [['Hội đồng', 's40']],
    variants: [['default', 'Đã chốt toàn bộ'], ['partial', 'Chưa chốt toàn bộ hồ sơ']],
    render(ctx) {
      const partial = ctx.variant === 'partial';
      const cur = ctx.params.doc || 'tonghop';
      const d = DOCS.find((x) => x[0] === cur);
      const status = partial ? 'Nháp' : d[3];
      const list = O.card(`<div class="stack s12"><select class="select" aria-label="Chọn đợt"><option>${D.dot.ten}</option><option>Đợt đánh giá 2025</option></select>
        <div class="list hd-doclist">${DOCS.map(([k, n, i, st, ver]) => `<div class="li ${k === cur ? 'on' : ''}" data-go="s44" data-params='{"id":"x","doc":"${k}","variant":"${ctx.variant}"}'><span class="nav-ico" style="background:var(--surface-3);margin:0">${ic(i)}</span><div class="grow"><b style="font-weight:600;font-size:14px">${n}</b><div class="row s8">${partial || st === 'Nháp' ? O.tag('Nháp', 'gray') : O.tag('Đã ký', 'green', 'pen-line')}<span class="tiny faint">${ver}</span></div></div></div>`).join('')}</div></div>`, { title: 'Tài liệu của đợt' });
      const actions = O.card(`<div class="stack s12">
          <div class="field"><label for="hd-tpl">Mẫu áp dụng</label><select class="select" id="hd-tpl"><option>${d[1]} (mẫu v3, 01/09/2026)</option></select><a href="#s73" class="small">Quản lý mẫu văn bản</a></div>
          ${O.btn('Sinh từ mẫu', { kind: 'primary block', icon: 'wand-sparkles', attrs: `data-toast="Đã sinh ${partial ? 'bản nháp ' : ''}${d[1].toLowerCase()} từ mẫu"` })}
          <div class="row s8">${O.btn('Tải Word', { size: 'sm', icon: 'file-down', attrs: 'data-toast="Đang tải bản Word"' })}${O.btn('Tải PDF', { size: 'sm', icon: 'file-down', attrs: 'data-toast="Đang tải bản PDF"' })}</div>
          <hr class="divider">
          <b>Tải lên bản đã ký</b>
          ${partial ? `<p class="small muted">Chỉ tải lên bản ký khi đã chốt toàn bộ hồ sơ của đợt.</p>` : status === 'Đã ký' ? O.file({ name: 'Bang-tong-hop-da-ky.pdf', size: '1,8 MB', type: 'pdf', crit: 'Ký ngày 18/10/2026' }) : O.drop('Kéo thả bản đã ký số', 'PDF đã ký số ngoài hệ thống', true)}
          <hr class="divider">
          <b>Lịch sử phiên bản</b>
          ${O.timeline([['file-check-2', 'green', 'v2 · Chốt lại sau mở khóa HS-2026-0128', '18/10/2026 17:10 · Trần Thị B'], ['file-text', 'gray', 'v1 · Sinh từ mẫu', '18/10/2026 16:50 · Trần Thị B']])}
        </div>`, { title: 'Thao tác' });
      return `
      ${O.pageHead({ title: 'Biên bản và quyết định', sub: `Sinh văn bản từ mẫu, tải bản đã ký. ${D.dot.ten}.` })}
      ${partial ? O.banner({ tone: 'orange', icon: 'triangle-alert', title: 'Chưa chốt toàn bộ hồ sơ của đợt', text: 'Còn 3 / 10 hồ sơ chưa chốt điểm. Hiện chỉ sinh được bản nháp.', actions: O.btn('Mở bảng chốt điểm', { size: 'sm', go: 's43' }) }) : ''}
      <div class="grid g-3col">
        ${list}
        <section class="stack s12"><div class="row"><h2 style="flex:1">${d[1]}</h2>${status === 'Đã ký' ? O.tag('Đã ký', 'green', 'pen-line') : O.tag('Nháp', 'gray', 'pencil-line')}</div><div class="doc-page">${docBody(cur, partial || status === 'Nháp')}</div></section>
        ${actions}
      </div>`;
    },
  });

  /* ================= S45 ================= */
  O.screen('s45', {
    title: 'Cấp giấy chứng nhận và gửi kết quả', navTitle: 'Chứng nhận', code: 'S45', roles: ['thuky'], device: 'Máy tính',
    crumbs: [['Hội đồng', 's40']],
    variants: [['default', 'Mặc định'], ['dup', 'Lỗi trùng số hiệu'], ['empty', 'Không có hồ sơ chờ cấp']],
    render(ctx) {
      const v = ctx.variant;
      const pend = [
        { ...O.hs('HS-2026-0123'), sao: 4, so: 'OCOP-TM-2026-0042' },
        { ...O.hs('HS-2026-0124'), sao: 4, so: 'OCOP-TM-2026-0043' },
        { ...O.hs('HS-2026-0128'), sao: 3, so: 'OCOP-TM-2026-0044' },
        { ...O.hs('HS-2026-0134'), sao: 4, so: v === 'dup' ? 'OCOP-TM-2026-0043' : 'OCOP-TM-2026-0045', src: true },
      ];
      const sel = pend[0];
      const pendTbl = v === 'empty' ? O.empty({ icon: 'award', title: 'Không có hồ sơ chờ cấp chứng nhận', text: 'Hồ sơ xuất hiện ở đây sau khi hội đồng chốt điểm và quyết định công nhận được ký.' }) : `
        ${O.bulkbar(0, `${O.btn('Sinh giấy chứng nhận', { kind: 'primary', size: 'sm', icon: 'file-badge', attrs: 'data-toast="Đã sinh giấy chứng nhận cho các hồ sơ đã chọn"' })}`)}
        ${O.table({ select: true, pager: false,
          cols: [{ l: 'Sản phẩm' }, { l: 'Hạng' }, { l: 'Số hiệu dự kiến' }, { l: 'Trạng thái' }],
          rows: pend, rowAttrs: (r, i) => (i === 0 ? 'class="sel"' : ''),
          cell: (r, c) => ({ 'Sản phẩm': `${O.prodCell(r)}<div class="tiny faint" style="margin:4px 0 0 40px">${esc(r.ct)}</div>${r.src ? `<div style="margin-top:6px">${O.tag('Chuyển từ hồ sơ 5 sao', 'amber', 'corner-down-left')}</div>` : ''}`, 'Chủ thể': esc(r.ct), 'Hạng': O.stars(r.sao), 'Số hiệu dự kiến': `<span class="nowrap code ${v === 'dup' && r.so === 'OCOP-TM-2026-0043' ? 'cell-bad strong' : ''}">${r.so}</span>${v === 'dup' && r.so === 'OCOP-TM-2026-0043' ? `<div class="tiny cell-bad">Trùng số hiệu</div>` : ''}`, 'Trạng thái': r.src ? O.tag('Chưa sinh', 'gray') : O.tag('Đã sinh, chờ ký', 'blue') }[c.l]),
          card: (r) => `<div class="mcard">${O.prodCell(r)}<div class="row s8">${O.stars(r.sao)}<span class="code small">${r.so}</span></div></div>` })}`;
      const preview = O.card(`<div class="cert">
          <div class="tiny" style="letter-spacing:.1em">ỦY BAN NHÂN DÂN TỈNH MẪU</div>
          <h3 style="margin:10px 0 6px;font-size:20px">GIẤY CHỨNG NHẬN</h3>
          <div class="small">Sản phẩm đạt tiêu chuẩn OCOP cấp tỉnh</div>
          <div style="margin:14px 0 6px">${O.stars(sel.sao, 5, 'lg')}</div>
          <div style="font-size:19px;font-weight:700">${esc(sel.sp)}</div>
          <div class="small">Chủ thể: ${esc(sel.ct)} · ${sel.xa}</div>
          <div class="row" style="justify-content:space-between;margin-top:18px;align-items:flex-end;text-align:left">
            <div class="small">Số hiệu: <b>${sel.so}</b><br>Ngày cấp: 20/10/2026<br>Hiệu lực: 36 tháng</div>
            <div style="text-align:center">${O.qr(4)}<div class="tiny">Mã QR (Đợt 2)</div></div>
          </div>
        </div>
        <div class="stack s12" style="margin-top:16px">
          ${O.drop('Tải lên bản đã ký', 'PDF đã ký số ngoài hệ thống', true)}
          ${O.btn('Công bố cho chủ thể', { kind: 'primary block', icon: 'send', attrs: 'data-publish' })}
        </div>`, { title: 'Xem trước chứng nhận', sub: sel.ma });
      const tabPending = `${v === 'dup' ? O.banner({ tone: 'red', icon: 'circle-x', title: 'Số hiệu OCOP-TM-2026-0043 bị trùng', text: 'Hai hồ sơ đang dùng cùng số hiệu. Bấm "Cấp lại số hiệu" để lấy số kế tiếp từ bộ đếm.', actions: O.btn('Cấp lại số hiệu', { size: 'sm', attrs: 'data-toast="Đã cấp số hiệu OCOP-TM-2026-0045"' }) }) : ''}
        <div class="grid g-main">${O.card(pendTbl, { cls: 'flush' })}${v === 'empty' ? '' : preview}</div>`;
      const fail = O.hs('HS-2026-0133');
      const tabFail = `<div class="grid g-main">
        ${O.card(O.table({ pager: false, cols: [{ l: 'Sản phẩm' }, { l: 'Chủ thể' }, { l: 'Điểm' }, { l: 'Thư kết quả' }], rows: [fail], rowAttrs: () => 'class="sel"', cell: (r, c) => ({ 'Sản phẩm': O.prodCell(r), 'Chủ thể': esc(r.ct), 'Điểm': `<b>${r.diem}</b> / 100`, 'Thư kết quả': O.tag('Chưa gửi', 'orange') }[c.l]) }), { cls: 'flush' })}
        ${O.card(`<div class="stack s12">
          <div class="grid g-3">${[['A', 18, 40], ['B', 12, 25], ['C', 16, 35]].map(([p, s, m]) => `<div class="stack s8"><span class="small muted">Phần ${p}</span><b class="num">${s} / ${m}</b>${O.progress(s, m, 'orange')}</div>`).join('')}</div>
          <div class="field"><label for="hd-letter">Nội dung thư</label><textarea class="textarea" id="hd-letter" style="min-height:150px">Kính gửi Cơ sở Mứt Út Hiền,

Hội đồng đánh giá, phân hạng sản phẩm OCOP cấp tỉnh thông báo sản phẩm Mứt dừa non đạt 46/100 điểm, chưa đạt ngưỡng 3 sao (50 điểm). Hội đồng ghi nhận nỗ lực của cơ sở và mong cơ sở tiếp tục hoàn thiện để đăng ký lại ở đợt sau.</textarea></div>
          <div class="field"><span class="label">Tiêu chí cần cải thiện</span><div class="row s8">${['B1 Công bố chất lượng', 'B5 Truy xuất nguồn gốc', 'C2 Chỉ tiêu an toàn thực phẩm', 'C4 Hệ thống quản lý chất lượng'].map((x) => O.tag(x, 'orange')).join('')}</div></div>
          ${O.btn('Gửi cho chủ thể', { kind: 'primary', icon: 'send', attrs: 'data-sendfail' })}
        </div>`, { title: 'Thư kết quả', sub: 'Điền sẵn từ điểm đã chốt và nhận xét của hội đồng' })}
      </div>`;
      const issued = [O.hs('HS-2026-0127'), { ...O.hs('HS-2026-0126'), sp: 'Bánh pía sầu riêng', ma: 'HS-2025-0088', sao: 3 }, { ...O.hs('HS-2026-0124'), sp: 'Trà atiso', ma: 'HS-2023-0031', sao: 3 }];
      const tabIssued = O.card(O.table({ pager: false, cols: [{ l: 'Số hiệu' }, { l: 'Sản phẩm' }, { l: 'Hạng' }, { l: 'Ngày cấp' }, { l: 'Hiệu lực' }, { l: '', cls: 'r' }], rows: issued,
        cell: (r, c, i) => ({ 'Số hiệu': `<span class="code">${['OCOP-TM-2026-0038', 'OCOP-TM-2025-0091', 'OCOP-TM-2023-0012'][i]}</span>`, 'Sản phẩm': O.prodCell(r), 'Hạng': O.stars(r.sao), 'Ngày cấp': ['02/10/2026', '15/11/2025', '20/10/2023'][i], 'Hiệu lực': i === 2 ? O.tag('Hết hiệu lực 20/10/2026', 'orange', 'clock') : O.tag('Còn hiệu lực', 'green', 'check'), '': O.btn('PDF', { size: 'sm', icon: 'download', attrs: 'data-toast="Đang tải giấy chứng nhận"' }) }[c.l]),
        card: (r, i) => `<div class="mcard">${O.prodCell(r)}<div class="row s8">${O.stars(r.sao)}${i === 2 ? O.tag('Hết hiệu lực', 'orange') : O.tag('Còn hiệu lực', 'green')}</div></div>` }), { cls: 'flush' });
      return `
      ${O.pageHead({ title: 'Cấp giấy chứng nhận và gửi kết quả', sub: 'Số hiệu được cấp tự động theo bộ đếm của đợt.' })}
      ${O.tabs([['pending', 'Chờ cấp chứng nhận', v === 'empty' ? 0 : 4], ['issued', 'Đã cấp', 3], ['fail', 'Không đạt', 1]], { pending: tabPending, issued: tabIssued, fail: tabFail })}`;
    },
    mount(root) {
      root.querySelector('[data-publish]')?.addEventListener('click', () => O.confirm({ title: 'Công bố kết quả cho chủ thể', what: 'Chủ thể Cơ sở Mắm Bà Sáu xem được kết quả, nhận xét và tải giấy chứng nhận OCOP-TM-2026-0042.', notify: 'Chủ thể (trong ứng dụng và email), UBND Xã An Phú.', undo: 'Không. Sau khi công bố, mọi chỉnh sửa phải cấp lại giấy chứng nhận.', confirmText: 'Công bố', icon: 'send', onConfirm: () => O.toast('Đã công bố kết quả cho chủ thể') }));
      root.querySelector('[data-sendfail]')?.addEventListener('click', () => O.confirm({ title: 'Gửi thư kết quả', what: 'Thư kết quả được gửi tới Cơ sở Mứt Út Hiền, kèm điểm theo phần và tiêu chí cần cải thiện.', notify: 'Chủ thể, UBND Phường Tân Hòa.', undo: 'Không thu hồi được thư đã gửi.', confirmText: 'Gửi thư', icon: 'send', onConfirm: () => O.toast('Đã gửi thư kết quả') }));
    },
  });
})();
