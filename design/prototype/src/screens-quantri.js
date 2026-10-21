/* Màn hình Quản trị hệ thống: S70 đến S74 */
(function () {
  const O = window.OCOP; const D = O.data; const ic = O.icon; const esc = O.esc;
  document.head.insertAdjacentHTML('beforeend', `<style>
  .qt-filters { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap:12px; }
  @container main (max-width: 900px) { .qt-filters { grid-template-columns: repeat(2, minmax(0,1fr)); } }
  @container main (max-width: 520px) { .qt-filters { grid-template-columns: minmax(0,1fr); } }
  .qt-roles { display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap:10px 16px; }
  @container main (max-width: 520px) { .qt-roles { grid-template-columns: minmax(0,1fr); } }
  .qt-sw { display:flex; gap:12px; align-items:flex-start; padding:12px 0; border-bottom:1px solid var(--line); }
  .qt-sw:last-child { border-bottom:0; }
  .qt-sw .tx { flex:1; min-width:0; }
  .qt-sw .tx small { display:block; color:var(--text-3); font-size:12.5px; }
  .qt-err { display:flex; gap:10px; align-items:flex-start; padding:10px 12px; border-radius:12px; cursor:pointer; border:1px solid var(--line); background:var(--surface); text-align:left; width:100%; }
  .qt-err:hover { border-color: var(--line-strong); background: var(--surface-2); }
  .qt-err .ic { margin-top:2px; }
  .qt-thr { display:grid; grid-template-columns: auto minmax(0,1fr) 72px; gap:10px; align-items:center; }
  .qt-thr .input { min-height:40px; text-align:right; padding:6px 10px; }
  .qt-ev { display:flex; align-items:center; gap:8px; }
  .qt-ev .input { min-height:40px; }
  .qt-fields { display:flex; flex-wrap:wrap; gap:6px; }
  .qt-fields code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size:12px; padding:3px 8px; border-radius:8px; background:var(--brand-soft); color:var(--brand-deep); }
  .qt-diff { display:grid; grid-template-columns: 130px minmax(0,1fr) minmax(0,1fr); gap:0; border:1px solid var(--line); border-radius:14px; overflow:hidden; font-size:13.5px; }
  .qt-diff > div { padding:9px 12px; border-bottom:1px solid var(--line); min-width:0; overflow-wrap:anywhere; }
  .qt-diff > .h { background:var(--surface-2); font-weight:600; color:var(--text-2); font-size:12.5px; }
  .qt-diff > div:nth-last-child(-n+3) { border-bottom:0; }
  .qt-tree-wrap { max-height: 640px; overflow-y:auto; margin: 0 -8px; padding: 0 4px; }
  </style>`);

  const ROLE_LIST = ['Chủ thể', 'Cán bộ xã', 'Cán bộ Sở', 'Thư ký', 'Chủ tịch hội đồng', 'Tổ tư vấn', 'Tổ trưởng Tổ tư vấn', 'Thành viên', 'Quản trị'];
  const sel = (id, opts, label) => `<div class="field"><label for="${id}">${label}</label><select class="select" id="${id}">${opts.map((o) => `<option>${esc(o)}</option>`).join('')}</select></div>`;
  const sw = (id, title, sub, on = true, dis = false) => `<div class="qt-sw"><div class="tx"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</div><label class="switch"><input type="checkbox" id="${id}" ${on ? 'checked' : ''} ${dis ? 'disabled' : ''} aria-label="${esc(title)}"><span></span></label></div>`;

  /* ================= S70 ================= */
  const USERS = [
    { ten: 'Phan Thu Hà', dv: 'Sở NN&MT', vt: ['Cán bộ Sở', 'Thư ký'], pv: 'Toàn tỉnh', tt: 'on', tfa: true, email: 'ha.pt@snnmt.tinhmau.gov.vn' },
    { ten: 'Nguyễn Văn A', dv: 'Sở NN&MT', vt: ['Chủ tịch hội đồng'], pv: 'Toàn tỉnh · Đợt 2026', tt: 'on', tfa: true, email: 'a.nv@snnmt.tinhmau.gov.vn' },
    { ten: 'Trần Thị B', dv: 'Sở NN&MT', vt: ['Thư ký'], pv: 'Toàn tỉnh · Đợt 2026', tt: 'on', tfa: true, email: 'b.tt@snnmt.tinhmau.gov.vn' },
    { ten: 'Lê Văn C', dv: 'Sở Y tế', vt: ['Thành viên'], pv: 'Đợt 2026', tt: 'on', tfa: true, email: 'c.lv@syt.tinhmau.gov.vn' },
    { ten: 'Đặng Quốc G', dv: 'Trường ĐH Cần Thơ', vt: ['Thành viên'], pv: 'Đợt 2026', tt: 'on', tfa: false, email: 'g.dq@ctu.edu.vn' },
    { ten: 'Hoàng Thị E', dv: 'Chi cục PTNT', vt: ['Tổ trưởng Tổ tư vấn', 'Tổ tư vấn'], pv: 'Đợt 2026', tt: 'on', tfa: true, email: 'e.ht@ccptnt.tinhmau.gov.vn' },
    { ten: 'Vũ Văn F', dv: 'Trung tâm Khuyến nông', vt: ['Tổ tư vấn', 'Thành viên'], pv: 'Đợt 2026', tt: 'on', tfa: true, conflict: true, email: 'f.vv@ttkn.tinhmau.gov.vn' },
    { ten: 'Ngô Bảo Ngọc', dv: 'UBND Xã An Phú', vt: ['Cán bộ xã'], pv: 'Xã An Phú', tt: 'on', tfa: false, email: 'ngoc.nb@anphu.tinhmau.gov.vn' },
    { ten: 'Huỳnh Văn Tài', dv: 'UBND Xã Bình Thạnh', vt: ['Cán bộ xã'], pv: 'Xã Bình Thạnh', tt: 'lock', tfa: false, email: 'tai.hv@binhthanh.tinhmau.gov.vn' },
    { ten: 'Đỗ Minh Quân', dv: 'Trung tâm CNTT', vt: ['Quản trị'], pv: 'Toàn hệ thống', tt: 'on', tfa: true, email: 'quan.dm@cntt.tinhmau.gov.vn' },
  ];
  const needs2fa = (u) => u.vt.some((r) => ['Chủ tịch hội đồng', 'Thư ký', 'Thành viên', 'Tổ tư vấn', 'Tổ trưởng Tổ tư vấn', 'Quản trị'].includes(r));
  const tfaChip = (u) => (u.tfa ? O.tag('Đã bật', 'green', 'shield-check') : needs2fa(u) ? O.tag('Chưa bật', 'red', 'shield-alert') : O.tag('Không bắt buộc', 'gray'));
  const ttChip = (u) => (u.tt === 'on' ? O.tag('Hoạt động', 'green', 'circle-check') : O.tag('Đã khóa', 'gray', 'lock'));

  function userDrawer(u) {
    const body = `
      ${u.conflict ? O.banner({ tone: 'red', icon: 'triangle-alert', title: 'Vai trò xung đột', text: 'Người này vừa là thành viên Tổ tư vấn vừa là thành viên chấm hồ sơ HS-2026-0124. Hệ thống sẽ chặn chấm hồ sơ này; đề nghị thư ký thay người.' }) : ''}
      ${!u.tfa && needs2fa(u) ? O.banner({ tone: 'orange', icon: 'shield-alert', title: 'Chưa bật xác thực hai lớp', text: 'Vai trò hội đồng và quản trị bắt buộc bật 2FA. Người dùng sẽ bị chặn thao tác cho đến khi bật xong.' }) : ''}
      <div class="row">${O.avatar(u.ten, 'lg')}<div class="stack s8" style="gap:2px"><h3>${esc(u.ten)}</h3><span class="small muted">${esc(u.dv)} · ${esc(u.email)}</span><div class="row s8">${ttChip(u)}${tfaChip(u)}</div></div></div>
      ${O.tabs([['tt', 'Thông tin'], ['vt', 'Vai trò và phạm vi'], ['ls', 'Lịch sử cấp quyền']], {
        tt: `<div class="form-grid"><div class="field"><label for="u-ten">Họ tên</label><input class="input" id="u-ten" value="${esc(u.ten)}"></div><div class="field"><label for="u-dv">Đơn vị</label><input class="input" id="u-dv" value="${esc(u.dv)}"></div><div class="field"><label for="u-em">Email</label><input class="input" id="u-em" value="${esc(u.email)}"></div><div class="field"><label for="u-sdt">Số điện thoại</label><input class="input" id="u-sdt" value="0913 ••• 482"><span class="hint">Che bớt theo quy định bảo vệ dữ liệu cá nhân</span></div></div>`,
        vt: `<div class="stack">
          <div class="label">Vai trò (chọn nhiều)</div>
          <div class="qt-roles">${ROLE_LIST.map((r, i) => `<label class="check"><input type="checkbox" id="u-r${i}" ${u.vt.includes(r) ? 'checked' : ''}>${r}</label>`).join('')}</div>
          <hr class="divider">
          <div class="label">Phạm vi dữ liệu</div>
          <div class="form-grid">${sel('u-pxa', ['Tất cả xã/phường', ...D.xa], 'Xã/phường')}${sel('u-ptinh', [D.tinh], 'Tỉnh')}${sel('u-pdot', [D.dot.ten, 'Đợt đánh giá 2025', 'Tất cả các đợt'], 'Đợt')}</div>
          ${u.vt.some((r) => r.includes('Tổ tư vấn')) ? `<hr class="divider"><div class="label">Cấu hình riêng cho Tổ tư vấn</div><div>${sw('u-copy', 'Quyền sao chép dữ liệu sang phiếu chấm', 'Cho phép đưa báo cáo Tổ tư vấn vào phiếu của thành viên', true)}${sw('u-noover', 'Không ghi đè phiếu đã chỉnh hoặc đã xác nhận', 'Quy tắc bắt buộc của hệ thống, không tắt được', true, true)}</div>` : ''}
        </div>`,
        ls: O.timeline([
          ['user-plus', 'green', 'Tạo tài khoản', '02/01/2026 08:30 · Đỗ Minh Quân'],
          ['shield-plus', 'blue', `Gán vai trò ${esc(u.vt[0])}`, '05/01/2026 10:12 · Đỗ Minh Quân · theo QĐ 112/QĐ-SNNMT'],
          ['map-pin', 'purple', `Phạm vi dữ liệu: ${esc(u.pv)}`, '05/01/2026 10:13 · Đỗ Minh Quân'],
          ...(u.vt[1] ? [['shield-plus', 'blue', `Gán thêm vai trò ${esc(u.vt[1])}`, '14/03/2026 15:40 · Đỗ Minh Quân']] : []),
        ]),
      }, { style: 'line' })}`;
    const d = O.drawer({ title: 'Chi tiết tài khoản', sub: esc(u.ten), body, foot: `${O.btn('Khóa tài khoản', { kind: 'danger-ghost', icon: 'lock', attrs: 'data-q="lock"' })}${O.btn('Đặt lại mật khẩu', { icon: 'key-round', attrs: 'data-q="pw"' })}${O.btn('Đặt lại 2FA', { icon: 'smartphone', attrs: 'data-q="2fa"' })}${O.btn('Lưu thay đổi', { kind: 'primary', icon: 'save', attrs: 'data-toast="Đã lưu vai trò và phạm vi" data-close' })}` });
    d.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.q;
      if (k === 'lock') O.confirm({ kind: 'danger', title: `Khóa tài khoản ${esc(u.ten)}?`, what: 'Người dùng bị đăng xuất khỏi mọi thiết bị và không đăng nhập được. Phiếu chấm và dữ liệu đã nhập được giữ nguyên.', notify: 'Người dùng (qua email) và thư ký hội đồng nếu là thành viên hội đồng.', undo: 'Có. Quản trị có thể mở khóa bất cứ lúc nào.', confirmText: 'Khóa tài khoản', onConfirm: () => O.toast('Đã khóa tài khoản') });
      if (k === 'pw') O.confirm({ title: 'Đặt lại mật khẩu?', what: 'Hệ thống gửi liên kết đặt mật khẩu mới, mật khẩu hiện tại hết hiệu lực ngay.', notify: `${esc(u.email)}`, undo: 'Không. Người dùng phải đặt mật khẩu mới.', confirmText: 'Gửi liên kết', onConfirm: () => O.toast('Đã gửi liên kết đặt lại mật khẩu') });
      if (k === '2fa') O.confirm({ kind: 'danger', title: 'Đặt lại xác thực hai lớp?', what: 'Ứng dụng xác thực cũ và mã dự phòng hết hiệu lực. Lần đăng nhập tới người dùng phải quét mã QR mới.', notify: 'Người dùng (qua email). Thao tác được ghi vào nhật ký.', undo: 'Không.', confirmText: 'Đặt lại 2FA', onConfirm: () => O.toast('Đã đặt lại 2FA') });
    }));
  }

  O.screen('s70', {
    title: 'Tài khoản và vai trò', code: 'S70', roles: ['quantri'], device: 'Máy tính', crumbs: [['Quản trị', 's70']],
    variants: [['default', 'Mặc định'], ['loading', 'Đang tải'], ['empty', 'Không có kết quả'], ['error', 'Lỗi tải']],
    render(ctx) {
      const v = ctx.variant;
      const rows = v === 'empty' ? [] : USERS;
      const table = v === 'loading' ? `<div style="padding:20px">${O.skeleton(6)}</div>` : v === 'error' ? O.loadError('danh sách tài khoản') : v === 'empty' ? O.empty({ icon: 'search-x', title: 'Không có tài khoản phù hợp bộ lọc', text: 'Thử bỏ bớt bộ lọc hoặc tìm không dấu.', action: O.btn('Xóa bộ lọc', { kind: 'soft', icon: 'filter-x' }) }) : O.table({
        select: true, total: 148,
        cols: [{ l: 'Họ tên', sort: true }, { l: 'Đơn vị', sort: true }, { l: 'Vai trò' }, { l: 'Phạm vi' }, { l: 'Trạng thái' }, { l: '2FA' }, { l: '', w: '48px' }],
        rows, rowAttrs: (r, i) => `class="clickable" data-u="${i}"`,
        cell: (u, c) => ({ 'Họ tên': O.person(u.ten, u.email.replace(/^(.{3}).*@/, '$1•••@'), u.conflict ? `<span title="Vai trò xung đột" style="color:var(--c-red)">${ic('triangle-alert')}</span>` : ''), 'Đơn vị': esc(u.dv), 'Vai trò': `<div class="row s8">${u.vt.map((r) => O.tag(r, r.includes('Tổ') ? 'purple' : r === 'Quản trị' ? 'teal' : r.includes('xã') ? 'blue' : 'green')).join('')}</div>`, 'Phạm vi': `<span class="small">${esc(u.pv)}</span>`, 'Trạng thái': ttChip(u), '2FA': tfaChip(u), '': `<span class="faint">${ic('chevron-right')}</span>` }[c.l]),
        card: (u, i) => `<div class="mcard" data-u="${i}">${O.person(u.ten, u.dv)}<div class="row s8">${u.vt.map((r) => O.tag(r, 'green')).join('')}</div><div class="row s8">${ttChip(u)}${tfaChip(u)}</div></div>`,
      });
      return `
      ${O.pageHead({ title: 'Tài khoản và vai trò', sub: 'Tạo tài khoản cán bộ, gán nhiều vai trò và phạm vi dữ liệu. Mọi thay đổi quyền được ghi vào nhật ký.', actions: `${O.btn('Xuất Excel', { icon: 'file-spreadsheet' })}${O.btn('Tạo tài khoản', { kind: 'primary', icon: 'user-plus', attrs: 'data-new' })}` })}
      ${O.banner({ tone: 'red', icon: 'triangle-alert', title: '1 vai trò xung đột cần xử lý', text: 'Vũ Văn F vừa là thành viên Tổ tư vấn vừa là thành viên chấm hồ sơ HS-2026-0124 (Trà thảo mộc túi lọc).', actions: O.btn('Xem', { size: 'sm', attrs: 'data-u="6"' }) })}
      ${O.banner({ tone: 'orange', icon: 'shield-alert', title: '1 tài khoản hội đồng chưa bật 2FA', text: 'Đặng Quốc G (thành viên hội đồng) chưa thể chấm điểm cho đến khi bật xác thực hai lớp.' })}
      <div class="grid g-4">${O.stat({ label: 'Tổng tài khoản', value: '148', icon: 'users', sub: '126 chủ thể, 22 cán bộ' })}${O.stat({ label: 'Hội đồng và Tổ tư vấn', value: '8', icon: 'gavel', tone: 'purple' })}${O.stat({ label: 'Chưa bật 2FA (bắt buộc)', value: '1', icon: 'shield-alert', tone: 'red' })}${O.stat({ label: 'Đã khóa', value: '3', icon: 'lock', tone: 'gray' })}</div>
      <section class="card flush">
        <div style="padding:18px 20px" class="stack s12">
          <div class="toolbar">${O.search('Tìm theo họ tên, email, đơn vị')}${O.fchips([['Tất cả', 148], ['Cán bộ', 22], ['Chủ thể', 126], ['Chưa bật 2FA', 1], ['Đã khóa', 3]])}</div>
          <div class="qt-filters">${sel('f-dv', ['Tất cả đơn vị', 'Sở NN&MT', 'UBND xã/phường', 'Hội đồng', 'Tổ tư vấn'], 'Đơn vị')}${sel('f-vt', ['Tất cả vai trò', ...ROLE_LIST], 'Vai trò')}${sel('f-tt', ['Tất cả trạng thái', 'Hoạt động', 'Đã khóa'], 'Trạng thái')}${sel('f-2fa', ['Tất cả', 'Đã bật', 'Chưa bật'], '2FA')}</div>
          ${O.bulkbar(0, `${O.btn('Gán vai trò…', { size: 'sm', icon: 'shield-plus' })}${O.btn('Khóa', { size: 'sm', icon: 'lock' })}`)}
        </div>
        ${table}
      </section>`;
    },
    mount(root) {
      root.querySelectorAll('[data-u]').forEach((el) => el.addEventListener('click', (e) => { if (e.target.closest('input')) return; userDrawer(USERS[+el.dataset.u]); }));
      root.querySelector('[data-new]')?.addEventListener('click', () => {
        const d = O.drawer({ title: 'Tạo tài khoản cán bộ', body: `<div class="form-grid"><div class="field full"><label for="n-ten">Họ tên<span class="req">*</span></label><input class="input" id="n-ten" placeholder="Ví dụ: Nguyễn Văn Bình"></div><div class="field"><label for="n-em">Email công vụ<span class="req">*</span></label><input class="input" id="n-em" placeholder="ten@donvi.tinhmau.gov.vn"></div>${sel('n-dv', ['Sở NN&MT', 'UBND Xã An Phú', 'UBND Xã Bình Thạnh', 'Sở Y tế', 'Sở Công Thương'], 'Đơn vị')}</div><div class="label">Vai trò</div><div class="qt-roles">${ROLE_LIST.slice(1).map((r, i) => `<label class="check"><input type="checkbox" id="n-r${i}">${r}</label>`).join('')}</div>${O.banner({ tone: 'blue', icon: 'info', text: 'Tài khoản hội đồng và quản trị phải bật 2FA ở lần đăng nhập đầu tiên.' })}`, foot: `${O.btn('Hủy', { kind: 'ghost', attrs: 'data-close' })}${O.btn('Tạo và gửi lời mời', { kind: 'primary', icon: 'send', attrs: 'data-close data-toast="Đã tạo tài khoản và gửi email mời"' })}` });
      });
    },
  });

  /* ================= S71 ================= */
  const VERS = [
    { ten: 'Bộ tiêu chí 2026 (v2.1)', cc: 'QĐ 26/2026/QĐ-TTg', hl: '01/03/2026', st: 'pub', dot: 1, ph: '20/02/2026' },
    { ten: 'Bộ tiêu chí 2026 (v2.2, nháp)', cc: 'QĐ 26/2026/QĐ-TTg, sửa đổi nhóm du lịch', hl: '01/01/2027', st: 'draft', dot: 0, ph: '' },
    { ten: 'Bộ tiêu chí 2025 (v1.3)', cc: 'QĐ 148/QĐ-TTg', hl: '01/03/2025', st: 'pub', dot: 1, ph: '15/02/2025' },
    { ten: 'Bộ tiêu chí 2024 (v1.2)', cc: 'QĐ 148/QĐ-TTg', hl: '01/03/2024', st: 'pub', dot: 0, ph: '10/02/2024' },
    { ten: 'Thử nghiệm cây cảnh (nháp)', cc: 'Chưa có văn bản', hl: '', st: 'draft', dot: 0, ph: '' },
  ];
  O.screen('s71', {
    title: 'Danh sách phiên bản bộ tiêu chí', navTitle: 'Phiên bản bộ tiêu chí', code: 'S71', roles: ['quantri'], device: 'Máy tính', crumbs: [['Quản trị', 's70']],
    variants: [['default', 'Mặc định'], ['empty', 'Chưa có phiên bản']],
    render(ctx) {
      const body = ctx.variant === 'empty' ? O.empty({ icon: 'list-tree', title: 'Chưa có phiên bản bộ tiêu chí', text: 'Tạo phiên bản đầu tiên theo văn bản căn cứ hiện hành, rồi phát hành để dùng cho đợt đánh giá.', action: O.btn('Tạo phiên bản', { kind: 'primary', icon: 'plus', go: 's72' }) }) : O.table({
        pager: false,
        cols: [{ l: 'Tên phiên bản', sort: true }, { l: 'Văn bản căn cứ' }, { l: 'Ngày hiệu lực', sort: true }, { l: 'Trạng thái' }, { l: 'Số đợt đang dùng', cls: 'c' }, { l: 'Ngày phát hành' }, { l: 'Hành động', cls: 'r' }],
        rows: VERS,
        cell: (r, c, i) => ({
          'Tên phiên bản': `<div class="row s8 nowrap">${r.st === 'pub' ? `<span class="faint" title="Đã khóa">${ic('lock')}</span>` : `<span class="faint">${ic('pencil-line')}</span>`}<b>${esc(r.ten)}</b></div>`,
          'Văn bản căn cứ': `<span class="small">${esc(r.cc)}</span>`, 'Ngày hiệu lực': r.hl || '<span class="faint">Chưa đặt</span>',
          'Trạng thái': r.st === 'pub' ? O.tag('Đã phát hành', 'green', 'lock') : O.tag('Nháp', 'gray', 'pencil-line'),
          'Số đợt đang dùng': r.dot ? `<b>${r.dot}</b>` : '<span class="faint">0</span>', 'Ngày phát hành': r.ph || '<span class="faint">—</span>',
          'Hành động': `<div class="row s8" style="justify-content:flex-end;flex-wrap:nowrap">${O.btn('Mở', { size: 'sm', kind: 'soft', go: 's72', attrs: `data-params='{"variant":"${r.st === 'pub' ? 'published' : 'draft'}"}'` })}${O.btn('', { size: 'sm', icon: 'copy-plus', attrs: `data-clone="${i}" title="Tạo phiên bản mới từ bản này" aria-label="Tạo phiên bản mới từ bản này"` })}${r.st === 'draft' && !r.dot ? O.btn('', { size: 'sm', kind: 'danger-ghost', icon: 'trash-2', attrs: `data-del="${i}" title="Xóa" aria-label="Xóa"` }) : ''}</div>`,
        }[c.l]),
        card: (r) => `<div class="mcard"><div class="row between"><b>${esc(r.ten)}</b>${r.st === 'pub' ? O.tag('Đã phát hành', 'green', 'lock') : O.tag('Nháp', 'gray')}</div><span class="small muted">${esc(r.cc)} · hiệu lực ${r.hl || 'chưa đặt'}</span>${O.btn('Mở', { size: 'sm', kind: 'soft', go: 's72' })}</div>`,
      });
      return `${O.pageHead({ title: 'Phiên bản bộ tiêu chí', sub: 'Phiên bản đã phát hành là bất biến. Muốn thay đổi, tạo phiên bản mới từ bản đó.', actions: O.btn('Tạo phiên bản mới', { kind: 'primary', icon: 'plus', go: 's72', attrs: `data-params='{"variant":"draft"}'` }) })}
      <section class="card flush">${body}</section>`;
    },
    mount(root) {
      root.querySelectorAll('[data-clone]').forEach((b) => b.addEventListener('click', () => { const r = VERS[+b.dataset.clone]; O.confirm({ title: 'Tạo phiên bản mới từ bản này?', what: `Sao chép toàn bộ cấu trúc, tiêu chí và ngưỡng hạng của "${esc(r.ten)}" thành một bản nháp mới.`, notify: 'Không gửi thông báo.', undo: 'Có. Bản nháp chưa dùng có thể xóa.', confirmText: 'Tạo bản nháp', onConfirm: () => O.go('s72', { variant: 'draft' }) }); }));
      root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { const r = VERS[+b.dataset.del]; O.confirm({ kind: 'danger', title: 'Xóa bản nháp?', what: `Xóa vĩnh viễn "${esc(r.ten)}". Bản nháp chưa được đợt nào sử dụng.`, notify: 'Không gửi thông báo. Thao tác được ghi vào nhật ký.', undo: 'Không.', confirmText: 'Xóa bản nháp', onConfirm: () => O.toast('Đã xóa bản nháp') }); }));
    },
  });

  /* ================= S72 ================= */
  // Lựa chọn hiện tại trong cây: {type:'crit', code} | {type:'part', id} | {type:'group'} | {type:'ver'}
  let sel72 = { type: 'crit', code: 'A2' };
  let group72 = 0;
  const DESC_MISSING = 'B5';
  function treeHtml(ro) {
    const g = D.nhom[group72];
    return `<div class="tree">
      <div class="tn ${sel72.type === 'ver' ? 'on' : ''}" data-node='{"type":"ver"}'>${ic('book-marked')}<span class="tx">Bộ tiêu chí 2026 (v2.2)</span></div>
      ${D.nhom.map((n, gi) => `<div class="tn lv1 ${gi === group72 && sel72.type === 'group' ? 'on' : ''}" data-group="${gi}">${ro ? '' : `<span class="grip">${ic('grip-vertical')}</span>`}${ic(gi === group72 ? 'chevron-down' : 'chevron-right')}<span class="tx">${esc(n)}</span></div>
        ${gi === group72 ? D.parts.map((p) => `<div class="tn lv2 ${sel72.type === 'part' && sel72.id === p.id ? 'on' : ''}" data-node='{"type":"part","id":"${p.id}"}'>${ro ? '' : `<span class="grip">${ic('grip-vertical')}</span>`}${ic('folder')}<span class="tx">Phần ${p.id} · ${p.max} điểm</span></div>
          ${D.tieuchi.filter((t) => t.part === p.id).map((t) => `<div class="tn lv3 ${sel72.type === 'crit' && sel72.code === t.code ? 'on' : ''}" data-node='{"type":"crit","code":"${t.code}"}'>${ro ? '' : `<span class="grip">${ic('grip-vertical')}</span>`}<span class="tx"><b>${t.code}</b> ${esc(t.name)}</span>${t.code === DESC_MISSING && g === 'Thực phẩm' ? `<span style="color:var(--c-red)">${ic('circle-alert')}</span>` : ''}</div>`).join('')}`).join('') : ''}`).join('')}
    </div>`;
  }
  function formHtml(ro) {
    const R = ro ? 'readonly' : ''; const Dis = ro ? 'disabled' : '';
    if (sel72.type === 'part') {
      const p = D.parts.find((x) => x.id === sel72.id); const n = D.tieuchi.filter((t) => t.part === p.id); const sum = n.reduce((a, t) => a + t.max, 0);
      return `<div class="stack"><div class="row"><span class="crit-code">Phần ${p.id}</span><h2 style="flex:1">Thông tin phần</h2></div>
        <div class="form-grid"><div class="field full"><label for="p-ten">Tên phần</label><input class="input" id="p-ten" value="${esc(p.name)}" ${R}></div><div class="field"><label for="p-max">Tổng điểm tối đa</label><input class="input" id="p-max" type="number" value="${p.max}" ${R}><span class="hint">Tổng điểm tối đa các tiêu chí trong phần: ${sum}</span></div><div class="field"><label>Số tiêu chí</label><input class="input" value="${n.length}" readonly></div></div>
        ${sum === p.max ? O.banner({ tone: 'green', icon: 'circle-check', text: `Tổng điểm các tiêu chí khớp với điểm tối đa của phần (${p.max}).` }) : O.banner({ tone: 'red', icon: 'circle-alert', text: `Tổng điểm các tiêu chí (${sum}) khác điểm tối đa (${p.max}).` })}</div>`;
    }
    if (sel72.type === 'group' || sel72.type === 'ver') {
      return `<div class="stack"><h2>${sel72.type === 'ver' ? 'Thông tin phiên bản' : esc(D.nhom[group72])}</h2><div class="form-grid">${sel72.type === 'ver' ? `<div class="field full"><label for="v-ten">Tên phiên bản</label><input class="input" id="v-ten" value="Bộ tiêu chí 2026 (v2.2)" ${R}></div><div class="field"><label for="v-cc">Văn bản căn cứ</label><input class="input" id="v-cc" value="QĐ 26/2026/QĐ-TTg" ${R}></div><div class="field"><label for="v-hl">Ngày hiệu lực</label><input class="input" id="v-hl" value="01/01/2027" ${R}></div>` : `<div class="field full"><label>Áp dụng bộ tiêu chí</label><div class="radio-cards"><label class="radio-card"><input type="radio" name="gmode" checked ${Dis}>Bộ tiêu chí riêng</label><label class="radio-card"><input type="radio" name="gmode" ${Dis}>Dùng chung với Thực phẩm</label></div></div>`}</div></div>`;
    }
    const t = D.tieuchi.find((x) => x.code === sel72.code) || D.tieuchi[0];
    const missing = t.code === DESC_MISSING;
    const evs = ['Hợp đồng hoặc hóa đơn thu mua nguyên liệu', 'Xác nhận vùng nguyên liệu của UBND xã', 'Ảnh vùng nguyên liệu'].slice(0, t.code === 'A2' ? 3 : 2);
    return `<div class="stack">
      <div class="row"><span class="crit-code">${t.code}</span><h2 style="flex:1;min-width:0">${esc(t.name)}</h2><span class="tag">Phần ${t.part}</span></div>
      <div class="form-grid">
        <div class="field"><label for="c-ma">Mã tiêu chí<span class="req">*</span></label><input class="input" id="c-ma" value="${t.code}" ${R}></div>
        <div class="field"><label for="c-max">Điểm tối đa<span class="req">*</span></label><input class="input" id="c-max" type="number" min="0" value="${t.max}" ${R}></div>
        <div class="field full"><label for="c-ten">Tên tiêu chí<span class="req">*</span></label><input class="input" id="c-ten" value="${esc(t.name)}" ${R}></div>
        <div class="field full"><label for="c-mt">Mô tả cách đánh giá<span class="req">*</span></label><textarea class="textarea ${missing ? 'invalid' : ''}" id="c-mt" ${R} placeholder="Nêu căn cứ để chấm từng mức điểm">${missing ? '' : 'Đánh giá mức độ chủ động và tính ổn định của nguồn nguyên liệu. Có hợp đồng thu mua hoặc vùng nguyên liệu riêng tại địa phương được điểm tối đa.'}</textarea>${missing ? `<span class="err">${ic('circle-alert')}Chưa có mô tả. Thành viên hội đồng cần mô tả để chấm thống nhất.</span>` : ''}</div>
      </div>
      <div class="field"><span class="label">Minh chứng yêu cầu</span><div class="stack s8">${evs.map((e, i) => `<div class="qt-ev">${ro ? '' : `<span class="faint">${ic('grip-vertical')}</span>`}<input class="input" id="c-ev${i}" value="${e}" ${R}>${ro ? '' : `<button class="icon-btn" style="width:40px;height:40px" aria-label="Xóa minh chứng">${ic('x')}</button>`}</div>`).join('')}${ro ? '' : `<button class="link-btn" type="button">${ic('plus')}Thêm minh chứng</button>`}</div></div>
      <div class="field"><span class="label">Mức điểm gợi ý (tùy chọn)</span>
        <div class="tbl-wrap" style="border:1px solid var(--line);border-radius:14px"><table class="tbl"><thead><tr><th style="width:90px">Điểm</th><th>Điều kiện</th></tr></thead><tbody>
        ${[[t.max, 'Có hợp đồng dài hạn, vùng nguyên liệu tại địa phương'], [Math.ceil(t.max * 0.6), 'Có hợp đồng thu mua, nguồn trong tỉnh'], [1, 'Mua tự do, không có chứng từ']].map(([d, c], i) => `<tr><td><input class="input" style="min-height:38px" id="c-l${i}" value="${d}" ${R}></td><td><input class="input" style="min-height:38px" id="c-lt${i}" value="${c}" ${R}></td></tr>`).join('')}
        </tbody></table></div></div>
    </div>`;
  }
  function checksHtml() {
    const sums = D.nhom.map((n, i) => ({ n, s: i === 5 ? 95 : 100 }));
    const errs = [
      { tone: 'red', icon: 'circle-x', t: 'Du lịch cộng đồng: tổng điểm tối đa 95, cần 100', node: { type: 'group', g: 5 } },
      { tone: 'red', icon: 'circle-x', t: 'Mã B3 bị trùng ở nhóm Đồ uống', node: { type: 'crit', code: 'B3', g: 1 } },
      { tone: 'orange', icon: 'circle-alert', t: 'B5 Truy xuất nguồn gốc thiếu mô tả cách đánh giá', node: { type: 'crit', code: 'B5', g: 0 } },
    ];
    return `<div class="stack s12">
      <div class="row"><h3 style="flex:1">Kiểm tra</h3>${O.tag('3 lỗi', 'red')}</div>
      ${errs.map((e, i) => `<button type="button" class="qt-err" data-err='${JSON.stringify(e.node)}'><span style="color:var(--c-${e.tone})">${ic(e.icon)}</span><span class="small" style="flex:1">${e.t}</span><span class="faint">${ic('arrow-right')}</span></button>`).join('')}
      <details><summary class="small muted" style="cursor:pointer">Tổng điểm theo nhóm sản phẩm</summary><div class="stack s8" style="margin-top:8px">${sums.map((x) => `<div class="row between small"><span style="min-width:0;flex:1">${esc(x.n)}</span><b style="color:var(--c-${x.s === 100 ? 'green' : 'red'})">${x.s}/100</b></div>`).join('')}</div></details>
    </div>`;
  }
  function thrHtml(ro) {
    const R = ro ? 'readonly' : '';
    return `<div class="stack s12"><h3>Ngưỡng hạng</h3>
      ${[[3, 50, 'c-green'], [4, 70, 'c-green'], [5, 90, 'c-amber']].map(([s, v]) => `<div class="qt-thr">${O.stars(s, s)}<span class="small muted">Từ</span><input class="input" id="thr${s}" value="${v}" ${R} aria-label="Ngưỡng ${s} sao"></div>`).join('')}
      <span class="hint small faint">Dưới 50 điểm: Chưa đạt. Từ 90 điểm: Sở xuất gói đề nghị 5 sao.</span>
      <div class="field"><label for="thr-rule">Quy tắc tính điểm tổng hợp</label><select class="select" id="thr-rule" ${ro ? 'disabled' : ''}><option>Trung bình cộng các thành viên</option><option>Trung bình sau khi bỏ cao nhất và thấp nhất</option></select></div>
    </div>`;
  }
  O.screen('s72', {
    title: 'Trình soạn bộ tiêu chí', code: 'S72', roles: ['quantri'], device: 'Máy tính', crumbs: [['Quản trị', 's70'], ['Bộ tiêu chí', 's71']],
    variants: [['draft', 'Bản nháp'], ['published', 'Đã phát hành'], ['dirty', 'Có thay đổi chưa lưu']],
    render(ctx) {
      const ro = ctx.variant === 'published';
      return `
      ${O.pageHead({ title: ro ? 'Bộ tiêu chí 2026 (v2.1)' : 'Bộ tiêu chí 2026 (v2.2)', chips: ro ? O.tag('Đã phát hành', 'green', 'lock') : O.tag('Nháp', 'gray', 'pencil-line') + (ctx.variant === 'dirty' ? O.tag('Có thay đổi chưa lưu', 'orange', 'circle-dot') : '<span class="small faint">Đã lưu 14:32</span>'), sub: 'Căn cứ QĐ 26/2026/QĐ-TTg. Điểm tối đa từng phần lấy từ cấu hình này, không viết cứng trong giao diện.',
        actions: ro ? O.btn('Tạo phiên bản mới từ bản này', { kind: 'primary', icon: 'copy-plus', go: 's72', attrs: `data-params='{"variant":"draft"}'` }) : `${O.btn('Chạy thử', { icon: 'play', attrs: 'data-try' })}${O.btn('Lưu', { icon: 'save', attrs: 'data-toast="Đã lưu bản nháp"' })}${O.btn('Phát hành phiên bản', { kind: 'primary', icon: 'rocket', attrs: 'data-pub' })}` })}
      ${ro ? O.lockband('Phiên bản đã phát hành là chỉ đọc', 'Đang dùng cho Đợt đánh giá 2026. Muốn thay đổi, tạo phiên bản mới từ bản này.') : ''}
      ${ctx.variant === 'dirty' ? O.banner({ tone: 'orange', icon: 'triangle-alert', title: 'Bạn có thay đổi chưa lưu', text: 'Rời màn hình bây giờ sẽ mất các thay đổi ở tiêu chí A2 và ngưỡng 4 sao.', actions: `${O.btn('Bỏ thay đổi', { size: 'sm', kind: 'ghost' })}${O.btn('Lưu', { size: 'sm', kind: 'primary', attrs: 'data-toast="Đã lưu"' })}` }) : ''}
      <div class="row">
        <span class="label">Nhóm sản phẩm</span>
        <select class="select" id="grp-sw" style="max-width:360px">${D.nhom.map((n, i) => `<option value="${i}" ${i === group72 ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
        ${O.btn('So sánh với nhóm…', { icon: 'git-compare', attrs: 'data-cmp' })}
      </div>
      <div class="grid g-3col">
        <section class="card tight"><div class="card-head" style="margin-bottom:8px"><h3 style="flex:1">Cấu trúc</h3>${ro ? '' : O.btn('', { size: 'sm', icon: 'plus', attrs: 'aria-label="Thêm tiêu chí" data-toast="Đã thêm tiêu chí mới vào Phần A"' })}</div><div class="qt-tree-wrap">${treeHtml(ro)}</div></section>
        <section class="card" id="s72-form">${formHtml(ro)}</section>
        <div class="stack">
          <section class="card tight">${checksHtml()}</section>
          <section class="card tight">${thrHtml(ro)}</section>
        </div>
      </div>`;
    },
    mount(root) {
      root.querySelectorAll('[data-node]').forEach((n) => n.addEventListener('click', () => { sel72 = JSON.parse(n.dataset.node); O.rerender(); }));
      root.querySelectorAll('[data-group]').forEach((n) => n.addEventListener('click', () => { group72 = +n.dataset.group; sel72 = { type: 'group' }; O.rerender(); }));
      root.querySelectorAll('[data-err]').forEach((n) => n.addEventListener('click', () => { const e = JSON.parse(n.dataset.err); group72 = e.g; sel72 = e.type === 'group' ? { type: 'group' } : e; O.rerender(); }));
      root.querySelector('#grp-sw')?.addEventListener('change', (e) => { group72 = +e.target.value; O.rerender(); });
      root.querySelector('[data-cmp]')?.addEventListener('click', () => {
        const other = D.tieuchi.map((t) => ({ ...t, max2: t.code === 'A7' ? 10 : t.code === 'C5' ? 0 : t.max }));
        O.modal({ title: 'So sánh bộ tiêu chí giữa hai nhóm', wide: true, icon: 'git-compare', body: `<div class="row">${O.tag(D.nhom[group72], 'green')}<span class="faint">${ic('arrow-left-right')}</span><select class="select" id="cmp-g" style="max-width:320px">${D.nhom.map((n, i) => `<option ${i === 5 ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
          <div class="tbl-wrap" style="border:1px solid var(--line);border-radius:14px"><table class="tbl"><thead><tr><th>Mã</th><th>Tiêu chí</th><th class="r">${esc(D.nhom[group72])}</th><th class="r">Du lịch cộng đồng</th></tr></thead><tbody>${other.map((t) => `<tr class="${t.max !== t.max2 ? 'sel' : ''}"><td><b>${t.code}</b></td><td>${esc(t.name)}</td><td class="r">${t.max}</td><td class="r">${t.max !== t.max2 ? `<span class="diff-new">${t.max2 || 'Không áp dụng'}</span>` : t.max2}</td></tr>`).join('')}</tbody></table></div>`, foot: O.btn('Đóng', { attrs: 'data-close' }) });
      });
      root.querySelector('[data-try]')?.addEventListener('click', () => {
        const sums = O.sumParts((t) => t.ttv);
        O.modal({ title: 'Chạy thử phiếu chấm', wide: true, icon: 'play', body: `${O.banner({ tone: 'blue', icon: 'flask-conical', text: 'Xem trước phiếu chấm với dữ liệu mẫu (Mắm cá linh khô). Không lưu điểm.' })}
          ${D.parts.map((p) => `<div class="part-head"><h3>${p.name}</h3><span class="pt">${sums[p.id]} / ${p.max}</span></div>${D.tieuchi.filter((t) => t.part === p.id).slice(0, 3).map((t) => `<div class="crit"><div class="crit-head"><span class="crit-code">${t.code}</span><span class="crit-name">${esc(t.name)}</span>${O.scoreInput({ id: 'try-' + t.code, value: t.ttv, max: t.max, label: t.name })}</div></div>`).join('')}`).join('')}
          <div class="scorebar"><span class="total">${sums.T}<small> / 100</small></span>${O.stars(O.rank(sums.T))}<span class="muted small">${O.rankText(sums.T)}</span></div>`, foot: O.btn('Đóng', { attrs: 'data-close' }) });
      });
      root.querySelector('[data-pub]')?.addEventListener('click', () => O.confirm({ kind: 'danger', title: 'Phát hành phiên bản Bộ tiêu chí 2026 (v2.2)?', what: 'Phiên bản phát hành là bất biến, muốn đổi phải tạo phiên bản mới. Phiên bản sẽ có trong danh sách chọn khi tạo đợt đánh giá.', notify: 'Cán bộ Sở phụ trách đợt đánh giá.', undo: 'Không.', extra: O.banner({ tone: 'red', icon: 'circle-x', text: 'Còn 3 lỗi kiểm tra. Cần sửa hết trước khi phát hành.' }), typeWord: 'PHÁT HÀNH', confirmText: 'Phát hành', onConfirm: () => O.toast('Đã phát hành phiên bản') }));
    },
  });

  /* ================= S73 ================= */
  const XA = [
    ['27100', 'Xã An Phú', '01/07/2025', 'Xã An Phú, Xã Phú Lâm (sáp nhập)'], ['27103', 'Xã Bình Thạnh', '01/07/2025', ''], ['27106', 'Phường Tân Hòa', '01/07/2025', 'Phường 1, Phường 3 (sáp nhập)'],
    ['27109', 'Xã Long Điền', '01/07/2025', ''], ['27112', 'Xã Phú Hữu', '01/07/2025', 'Xã Phú Hữu, Xã Phú Mỹ (sáp nhập)'],
  ];
  const TPL = [
    ['Phiếu đăng ký', 'Phiếu đăng ký', 'v1', true, 'docx'], ['Báo cáo tự đánh giá', 'Báo cáo tự đánh giá', 'v1', true, 'docx'], ['Báo cáo đánh giá cấp xã', 'Báo cáo đánh giá cấp xã', 'v3', true, 'docx'], ['Bảng tổng hợp điểm', 'Bảng tổng hợp', 'v2', true, 'xlsx'],
    ['Biên bản họp hội đồng', 'Biên bản họp', 'v1', true, 'docx'], ['Quyết định công nhận', 'Quyết định', 'v4', true, 'docx'], ['Giấy chứng nhận OCOP', 'Giấy chứng nhận', 'v2', true, 'pdf'], ['Thư thông báo kết quả', 'Thư kết quả', 'v1', false, 'docx'],
  ];
  const FIELDS = ['ten_san_pham', 'ma_ho_so', 'ten_chu_the', 'xa_phuong', 'nhom_san_pham', 'diem_tong', 'diem_phan_a', 'diem_phan_b', 'diem_phan_c', 'hang_sao', 'so_hieu', 'ngay_cap', 'ten_dot'];
  O.screen('s73', {
    title: 'Danh mục và mẫu văn bản', navTitle: 'Danh mục', code: 'S73', roles: ['quantri'], device: 'Máy tính', crumbs: [['Quản trị', 's70']],
    render() {
      const nhom = `<section class="card flush"><div class="list" style="padding:4px 20px">${D.nhom.map((n, i) => `<div class="li"><span class="faint" style="cursor:grab">${ic('grip-vertical')}</span><span class="tag">${i + 1}</span><span class="avatar sm" style="--av:var(--brand-soft);color:var(--brand)">${ic(O.nhomIcon(n))}</span><div class="grow"><b style="font-weight:600">${esc(n)}</b><div class="tiny faint">${i === 5 ? 'Bộ tiêu chí riêng' : 'Dùng bộ tiêu chí chung'}</div></div><label class="switch"><input type="checkbox" id="nh${i}" checked aria-label="Bật ${esc(n)}"><span></span></label></div>`).join('')}</div></section>
        <p class="small faint">Tên nhóm lấy theo văn bản chính thức. Kéo để sắp xếp thứ tự hiển thị; tắt để ẩn khỏi danh sách chọn khi tạo hồ sơ mới (hồ sơ cũ không đổi).</p>`;
      const xa = `<section class="card flush"><div style="padding:16px 20px" class="toolbar">${O.search('Tìm mã hoặc tên xã/phường')}<span class="spacer"></span>${O.btn('Nhập từ Excel', { icon: 'file-up' })}${O.btn('Thêm xã/phường', { kind: 'primary', icon: 'plus' })}</div>${O.table({ pager: false, cols: [{ l: 'Mã', sort: true }, { l: 'Tên xã/phường', sort: true }, { l: 'Ngày hiệu lực' }, { l: 'Tên cũ khi sáp nhập' }, { l: '', w: '60px' }], rows: XA, cell: (r, c) => ({ 'Mã': `<span class="code">${r[0]}</span>`, 'Tên xã/phường': `<b>${r[1]}</b>`, 'Ngày hiệu lực': r[2], 'Tên cũ khi sáp nhập': r[3] ? `<span class="small muted">${r[3]}</span>` : '<span class="faint">—</span>', '': O.btn('', { size: 'sm', kind: 'ghost', icon: 'pencil', attrs: 'aria-label="Sửa"' }) }[c.l]), card: (r) => `<div class="mcard"><div class="row between"><b>${r[1]}</b><span class="code">${r[0]}</span></div><span class="small muted">Hiệu lực ${r[2]}${r[3] ? ' · ' + r[3] : ''}</span></div>` })}</section>`;
      const tpl = `<div class="grid g-main">
        <section class="card flush">${O.table({ pager: false, cols: [{ l: 'Mẫu' }, { l: 'Loại' }, { l: 'Phiên bản' }, { l: 'Trạng thái' }], rows: TPL, rowAttrs: (r, i) => `class="clickable ${i === 4 ? 'sel' : ''}"`, cell: (r, c) => ({ 'Mẫu': O.file({ name: r[0] + '.' + r[4], size: r[4].toUpperCase(), type: r[4] }).replace('class="file"', 'class="file" style="border:0;padding:0;background:none"'), 'Loại': O.tag(r[1], 'gray'), 'Phiên bản': `<b>${r[2]}</b>`, 'Trạng thái': r[3] ? O.tag('Đang dùng', 'green', 'circle-check') : O.tag('Chưa dùng', 'gray') }[c.l]), card: (r) => `<div class="mcard"><b>${r[0]}</b><div class="row s8">${O.tag(r[1], 'gray')}<span class="tag">${r[2]}</span></div></div>` })}</section>
        <section class="card"><div class="stack">
          <div class="row"><h3 style="flex:1">Quyết định công nhận</h3>${O.tag('v4 · Đang dùng', 'green')}</div>
          ${O.banner({ tone: 'blue', icon: 'info', text: 'Mẫu đang được Đợt đánh giá 2026 sử dụng. Sửa mẫu sẽ tạo phiên bản v5, không ảnh hưởng tài liệu đã sinh.' })}
          ${O.drop('Kéo thả mẫu Word hoặc PDF vào đây', 'DOCX hoặc PDF, tối đa 10 MB', true)}
          <div class="field"><span class="label">Trường tự điền tìm thấy trong mẫu</span><div class="qt-fields">${FIELDS.map((f) => `<code>{{${f}}}</code>`).join('')}</div></div>
          <div class="field"><span class="label">Lịch sử phiên bản</span>${O.timeline([['file-plus-2', 'green', 'v4 · thêm trường số hiệu', '12/02/2026 · Đỗ Minh Quân'], ['file', 'gray', 'v3 · sửa căn cứ pháp lý', '05/01/2026 · Đỗ Minh Quân']])}</div>
          <div class="row">${O.btn('Xem trước', { icon: 'eye', attrs: 'data-tplprev' })}${O.btn('Tải mẫu', { icon: 'download', attrs: 'data-toast="Đang tải mẫu v4"' })}</div>
        </div></section></div>
        <p class="small faint">Phần quản lý mẫu văn bản là giả định của bản mô tả, cần nhóm nghiệp vụ xác nhận phạm vi.</p>`;
      return `${O.pageHead({ title: 'Danh mục và mẫu văn bản', sub: 'Danh mục dùng chung cho mọi đợt đánh giá của tỉnh.' })}
      ${O.tabs([['nhom', 'Nhóm sản phẩm', 6], ['xa', 'Xã/phường', XA.length], ['tpl', 'Mẫu văn bản', TPL.length]], { nhom, xa, tpl }, { style: 'line' })}`;
    },
    mount(root) {
      root.querySelector('[data-tplprev]')?.addEventListener('click', () => O.modal({ title: 'Xem trước: Quyết định công nhận', wide: true, icon: 'eye', body: `<div class="doc-page"><div class="doc-hd"><div><b>UBND ${D.tinh.toUpperCase()}</b><br>Số: {{so_quyet_dinh}}</div><div><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br>Độc lập - Tự do - Hạnh phúc</div></div><h3>QUYẾT ĐỊNH</h3><h4>Về việc công nhận sản phẩm đạt chuẩn OCOP ${D.tinh} năm <span class="hl">{{ten_dot}}</span></h4><p style="margin-top:14px">Điều 1. Công nhận sản phẩm <span class="hl">{{ten_san_pham}}</span> của <span class="hl">{{ten_chu_the}}</span>, <span class="hl">{{xa_phuong}}</span> đạt <span class="hl">{{hang_sao}}</span> với tổng điểm <span class="hl">{{diem_tong}}</span>.</p><p>Điều 2. Giấy chứng nhận số <span class="hl">{{so_hieu}}</span> có hiệu lực 36 tháng kể từ <span class="hl">{{ngay_cap}}</span>.</p></div>`, foot: O.btn('Đóng', { attrs: 'data-close' }) }));
    },
  });

  /* ================= S74 ================= */
  const LOG = [
    ['19/10/2026 10:42:18', 'Hoàng Thị E', 'Sao chép dữ liệu Tổ tư vấn', 'HS-2026-0123 · 4 phiếu', '10.12.•••.24', 'copy', 'purple'],
    ['19/10/2026 09:15:03', 'Đỗ Minh Quân', 'Thay đổi quyền', 'Tài khoản Vũ Văn F', '10.12.•••.8', 'shield', 'blue'],
    ['18/10/2026 16:30:44', 'Trần Thị B', 'Chốt điểm', 'HS-2026-0126 · Gạo thơm An Phú', '10.12.•••.31', 'lock', 'green'],
    ['18/10/2026 15:02:11', 'Nguyễn Văn A', 'Mở khóa', 'HS-2026-0127 · phiếu Phạm Thị D', '10.12.•••.19', 'lock-open', 'orange'],
    ['18/10/2026 11:20:56', 'Lê Văn C', 'Xác nhận phiếu chấm', 'HS-2026-0128', '113.161.•••.77', 'badge-check', 'purple'],
    ['18/10/2026 08:47:30', 'Phan Thu Hà', 'Xem dữ liệu nhạy cảm', 'Hồ sơ pháp lý Cơ sở Mắm Bà Sáu', '10.12.•••.24', 'eye', 'gray'],
    ['17/10/2026 17:05:12', 'Hoàng Thị E', 'Phát hành báo cáo Tổ tư vấn', 'HS-2026-0123 · phiên bản 2', '10.12.•••.24', 'file-check-2', 'purple'],
    ['17/10/2026 14:33:09', 'Đỗ Minh Quân', 'Đặt lại 2FA', 'Tài khoản Đặng Quốc G', '10.12.•••.8', 'smartphone', 'blue'],
  ];
  function logDrawer(r) {
    const head = `<div class="stack s8">${O.dl([['Thời gian', r[0]], ['Người dùng', esc(r[1])], ['Hành động', `${O.tag(r[2], r[6], r[5])}`], ['Đối tượng', esc(r[3])], ['Địa chỉ IP', `<span class="code">${r[4]}</span>`], ['Thiết bị', 'Chrome 129 · Windows 11']])}</div>`;
    let body;
    if (r[2] === 'Sao chép dữ liệu Tổ tư vấn') {
      body = `${head}<hr class="divider"><div class="row s8"><b>Phiên bản nguồn:</b>${O.tag('Báo cáo Tổ tư vấn phiên bản 2', 'purple', 'file-check-2')}</div>
        <div class="stack s8"><b>Người nhận</b><div class="row s8">${['Lê Văn C', 'Phạm Thị D', 'Đặng Quốc G'].map((n) => O.tag(n, 'green', 'user-check')).join('')}${O.tag('Nguyễn Văn A: bỏ qua, đã chỉnh phiếu', 'orange', 'skip-forward')}</div></div>
        <div class="stack s8"><b>Điểm gốc Tổ tư vấn và điểm thành viên Lê Văn C đã xác nhận</b>
        <div class="tbl-wrap" style="border:1px solid var(--line);border-radius:14px"><table class="tbl"><thead><tr><th>Tiêu chí</th><th class="r">Tổ tư vấn</th><th class="r">Thành viên xác nhận</th><th>Lý do</th></tr></thead><tbody>${D.tieuchi.slice(0, 18).filter((t, i) => i < 6 || D.tvEdits[t.code]).map((t) => { const e = D.tvEdits[t.code]; return `<tr class="${e ? 'sel' : ''}"><td><b>${t.code}</b> <span class="small">${esc(t.name)}</span></td><td class="r">${t.ttv}/${t.max}</td><td class="r">${e ? `<b style="color:var(--c-orange)">${e.v}</b>` : t.ttv}</td><td class="small muted">${e ? esc(e.ly) : 'Giữ nguyên'}</td></tr>`; }).join('')}</tbody></table></div></div>`;
    } else {
      const rows = r[2] === 'Thay đổi quyền' ? [['Vai trò', 'Tổ tư vấn', 'Tổ tư vấn, Thành viên'], ['Phạm vi', 'Đợt 2026', 'Đợt 2026'], ['Quyền sao chép', 'Bật', 'Bật']] : r[2] === 'Mở khóa' ? [['Trạng thái phiếu', 'Đã xác nhận', 'Đang xem xét'], ['Lý do', '—', 'Hội đồng yêu cầu xem lại tiêu chí C2'], ['Văn bản', '—', 'Biên bản họp 18/10/2026']] : r[2] === 'Chốt điểm' ? [['Trạng thái hồ sơ', 'Sẵn sàng chốt', 'Đã chốt điểm'], ['Điểm tổng hợp', '—', '92,0'], ['Hạng gợi ý', '—', '5 sao (đề nghị)']] : [['Trạng thái', 'Trước thao tác', 'Sau thao tác']];
      body = `${head}<hr class="divider"><b>Giá trị trước và sau</b><div class="qt-diff"><div class="h">Trường</div><div class="h">Trước</div><div class="h">Sau</div>${rows.map(([k, a, b]) => `<div class="small muted">${k}</div><div>${a === b ? a : `<span class="diff-old">${a}</span>`}</div><div>${a === b ? b : `<span class="diff-new">${b}</span>`}</div>`).join('')}</div>`;
    }
    O.drawer({ title: 'Chi tiết nhật ký', sub: r[0], body: body + `<p class="small faint">${ic('lock')} Nhật ký chỉ đọc, không sửa hay xóa được.</p>`, foot: O.btn('Đóng', { attrs: 'data-close' }) });
  }
  O.screen('s74', {
    title: 'Nhật ký hoạt động', code: 'S74', roles: ['quantri'], device: 'Máy tính', crumbs: [['Quản trị', 's70']],
    variants: [['default', 'Mặc định'], ['loading', 'Đang tải'], ['empty', 'Không có kết quả']],
    render(ctx) {
      const t = ctx.variant === 'loading' ? `<div style="padding:20px">${O.skeleton(6)}</div>` : ctx.variant === 'empty' ? O.empty({ icon: 'search-x', title: 'Không có sự kiện trong khoảng thời gian này', text: 'Mở rộng khoảng thời gian hoặc bỏ bớt bộ lọc.' }) : O.table({
        total: 12480, cols: [{ l: 'Thời gian', sort: true }, { l: 'Người dùng' }, { l: 'Hành động' }, { l: 'Đối tượng' }, { l: 'Địa chỉ IP' }, { l: '', w: '40px' }],
        rows: LOG, rowAttrs: (r, i) => `class="clickable" data-log="${i}"`,
        cell: (r, c) => ({ 'Thời gian': `<span class="nowrap small">${r[0]}</span>`, 'Người dùng': O.person(r[1]), 'Hành động': O.tag(r[2], r[6], r[5]), 'Đối tượng': `<span class="small">${esc(r[3])}</span>`, 'Địa chỉ IP': `<span class="code">${r[4]}</span>`, '': `<span class="faint">${ic('chevron-right')}</span>` }[c.l]),
        card: (r, i) => `<div class="mcard" data-log="${i}"><div class="row between">${O.tag(r[2], r[6], r[5])}<span class="tiny faint">${r[0]}</span></div><span class="small"><b>${esc(r[1])}</b> · ${esc(r[3])}</span></div>`,
      });
      return `${O.pageHead({ title: 'Nhật ký hoạt động', sub: 'Mọi thao tác quan trọng và mọi lần truy cập dữ liệu nhạy cảm đều được ghi lại. Nhật ký chỉ đọc.', actions: O.btn('Xuất Excel', { icon: 'file-spreadsheet', attrs: 'data-toast="Đang xuất 12.480 dòng ra Excel"' }) })}
      <section class="card tight"><div class="qt-filters">${sel('l-u', ['Tất cả người dùng', 'Hoàng Thị E', 'Trần Thị B', 'Đỗ Minh Quân'], 'Người dùng')}${sel('l-a', ['Tất cả hành động', 'Sao chép dữ liệu Tổ tư vấn', 'Chốt điểm', 'Mở khóa', 'Thay đổi quyền', 'Xác nhận phiếu chấm'], 'Hành động')}${sel('l-o', ['Tất cả đối tượng', 'Hồ sơ', 'Phiếu chấm', 'Tài khoản', 'Bộ tiêu chí'], 'Loại đối tượng')}<div class="field"><label for="l-hs">Hồ sơ</label><input class="input" id="l-hs" placeholder="Mã hồ sơ, ví dụ HS-2026-0123"></div><div class="field"><label for="l-t1">Từ ngày</label><input class="input" id="l-t1" value="01/10/2026"></div><div class="field"><label for="l-t2">Đến ngày</label><input class="input" id="l-t2" value="19/10/2026"></div></div></section>
      ${O.fchips([['Tất cả', '12.480'], ['Sao chép dữ liệu Tổ tư vấn', 42], ['Chốt điểm', 18], ['Mở khóa', 2], ['Thay đổi quyền', 31]])}
      <section class="card flush">${t}</section>`;
    },
    mount(root) { root.querySelectorAll('[data-log]').forEach((el) => el.addEventListener('click', () => logDrawer(LOG[+el.dataset.log]))); },
  });
})();
