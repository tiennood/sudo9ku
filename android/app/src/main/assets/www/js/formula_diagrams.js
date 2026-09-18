/**
 * formula_diagrams.js
 * Thư viện hình ảnh minh họa trực quan 9 công thức và kỹ thuật giải Sudoku.
 * Cho phép xem thumbnail trực tiếp trong sổ tay và phóng to xem hình ảnh chi tiết.
 */

export const FORMULA_DIAGRAMS = {
  'naked-single': {
    key: 'naked-single',
    title: '1. Đơn lẻ trần (Naked Single)',
    badge: 'Cơ bản',
    badgeClass: 'diff-easy',
    summary: 'Đếm các số đã có xung quanh: Nếu trên Hàng, Cột và Khối đã có đủ 8 số khác nhau, ô này chỉ còn duy nhất 1 số còn thiếu!',
    quickRule: 'Ô chỉ còn đúng 1 ứng viên hợp lệ duy nhất.',
    steps: [
      { label: 'Bước 1 (Quan sát)', text: 'Nhìn vào ô trống và kiểm tra các số đã xuất hiện trên cùng Hàng, Cột và Khối 3x3.' },
      { label: 'Bước 2 (Loại trừ)', text: 'Các số 1, 2, 3, 4, 5, 7, 8, 9 đều đã xuất hiện ở các ô xung quanh.' },
      { label: 'Bước 3 (Điền số)', text: 'Chỉ còn duy nhất số 6 chưa có. Điền ngay số 6 vào ô trung tâm!' }
    ],
    svg: `
      <svg viewBox="0 0 540 320" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="background: #0f172a; border-radius: 12px; font-family: system-ui, sans-serif;">
        <defs>
          <linearGradient id="ns-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#10b981"/>
            <stop offset="100%" stop-color="#059669"/>
          </linearGradient>
          <filter id="ns-glow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <!-- Background Grid Highlight -->
        <rect x="30" y="115" width="480" height="50" fill="rgba(56, 189, 248, 0.08)" rx="6"/>
        <rect x="235" y="20" width="50" height="240" fill="rgba(232, 168, 124, 0.08)" rx="6"/>
        <!-- Rays -->
        <line x1="35" y1="140" x2="505" y2="140" stroke="#38bdf8" stroke-width="2" stroke-dasharray="6,4" opacity="0.6"/>
        <line x1="260" y1="25" x2="260" y2="255" stroke="#fb923c" stroke-width="2" stroke-dasharray="6,4" opacity="0.6"/>
        
        <!-- Row Cells -->
        <g fill="#1e293b" stroke="#475569" stroke-width="1.5">
          <rect x="50" y="115" width="50" height="50" rx="6"/><text x="75" y="148" fill="#94a3b8" font-size="22" font-weight="bold" text-anchor="middle">1</text>
          <rect x="110" y="115" width="50" height="50" rx="6"/><text x="135" y="148" fill="#94a3b8" font-size="22" font-weight="bold" text-anchor="middle">3</text>
          <rect x="170" y="115" width="50" height="50" rx="6"/><text x="195" y="148" fill="#94a3b8" font-size="22" font-weight="bold" text-anchor="middle">5</text>
          <!-- Center Target Cell -->
          <rect x="235" y="115" width="50" height="50" rx="8" fill="url(#ns-grad)" stroke="#34d399" stroke-width="3" filter="url(#ns-glow)"/>
          <text x="260" y="150" fill="#ffffff" font-size="28" font-weight="900" text-anchor="middle">6</text>
          <rect x="300" y="115" width="50" height="50" rx="6"/><text x="325" y="148" fill="#94a3b8" font-size="22" font-weight="bold" text-anchor="middle">7</text>
          <rect x="360" y="115" width="50" height="50" rx="6"/><text x="385" y="148" fill="#94a3b8" font-size="22" font-weight="bold" text-anchor="middle">8</text>
          <rect x="420" y="115" width="50" height="50" rx="6"/><text x="445" y="148" fill="#94a3b8" font-size="22" font-weight="bold" text-anchor="middle">2</text>
        </g>
        
        <!-- Column Cells (Above and Below Center) -->
        <g fill="#1e293b" stroke="#475569" stroke-width="1.5">
          <rect x="235" y="30" width="50" height="35" rx="6"/><text x="260" y="55" fill="#94a3b8" font-size="20" font-weight="bold" text-anchor="middle">4</text>
          <rect x="235" y="72" width="50" height="35" rx="6"/><text x="260" y="97" fill="#94a3b8" font-size="20" font-weight="bold" text-anchor="middle">9</text>
          <rect x="235" y="172" width="50" height="35" rx="6"/><text x="260" y="197" fill="#94a3b8" font-size="20" font-weight="bold" text-anchor="middle">8</text>
          <rect x="235" y="214" width="50" height="35" rx="6"/><text x="260" y="239" fill="#94a3b8" font-size="20" font-weight="bold" text-anchor="middle">1</text>
        </g>

        <!-- Callout Badge -->
        <g transform="translate(130, 275)">
          <rect x="0" y="0" width="280" height="32" rx="16" fill="rgba(16, 185, 129, 0.2)" stroke="#10b981" stroke-width="1.5"/>
          <text x="140" y="21" fill="#34d399" font-size="13" font-weight="bold" text-anchor="middle">✓ Đã có đủ 1, 2, 3, 4, 5, 7, 8, 9 ➔ Ô là 6!</text>
        </g>
      </svg>
    `
  },

  'hidden-single': {
    key: 'hidden-single',
    title: '2. Đơn lẻ ẩn (Hidden Single)',
    badge: 'Cơ bản',
    badgeClass: 'diff-easy',
    summary: 'Dùng mắt chiếu các đường chặn của số 7 vào một Khối 3x3: Cả 8 ô khác đều bị chặn, số 7 bắt buộc phải nằm ở ô còn lại!',
    quickRule: 'Số X chỉ có thể đặt vào đúng 1 ô duy nhất trong Hàng, Cột hoặc Khối.',
    steps: [
      { label: 'Bước 1 (Chiếu tia)', text: 'Các số 7 ở hàng trên và cột bên cạnh chiếu tia gióng ngang dọc qua khối 3x3.' },
      { label: 'Bước 2 (Chặn ô)', text: '8 ô trong khối hoặc đã có số sẵn, hoặc nằm trên đường tia gióng bị chặn.' },
      { label: 'Bước 3 (Điền số)', text: 'Chỉ còn duy nhất ô (Hàng 3, Cột 2) không bị chặn. Số 7 bắt buộc thuộc về ô này!' }
    ],
    svg: `
      <svg viewBox="0 0 540 320" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="background: #0f172a; border-radius: 12px; font-family: system-ui, sans-serif;">
        <!-- External Numbers Projecting Rays -->
        <g fill="#334155" stroke="#64748b" stroke-width="1.5">
          <!-- External Top Col 1 -->
          <rect x="180" y="15" width="40" height="40" rx="6"/><text x="200" y="42" fill="#fb923c" font-size="22" font-weight="bold" text-anchor="middle">7</text>
          <!-- External Left Row 1 -->
          <rect x="75" y="80" width="40" height="40" rx="6"/><text x="95" y="107" fill="#fb923c" font-size="22" font-weight="bold" text-anchor="middle">7</text>
          <!-- External Left Row 2 -->
          <rect x="75" y="140" width="40" height="40" rx="6"/><text x="95" y="167" fill="#fb923c" font-size="22" font-weight="bold" text-anchor="middle">7</text>
        </g>

        <!-- Red / Orange Blocking Rays -->
        <rect x="115" y="85" width="280" height="30" fill="rgba(239, 68, 68, 0.15)" stroke="rgba(239, 68, 68, 0.4)" stroke-dasharray="4,4"/>
        <rect x="115" y="145" width="280" height="30" fill="rgba(239, 68, 68, 0.15)" stroke="rgba(239, 68, 68, 0.4)" stroke-dasharray="4,4"/>
        <rect x="185" y="55" width="30" height="210" fill="rgba(239, 68, 68, 0.15)" stroke="rgba(239, 68, 68, 0.4)" stroke-dasharray="4,4"/>

        <!-- 3x3 Box Container -->
        <rect x="170" y="70" width="190" height="190" rx="10" fill="rgba(30, 41, 59, 0.7)" stroke="#38bdf8" stroke-width="3"/>

        <!-- 3x3 Grid Cells -->
        <g fill="#1e293b" stroke="#475569" stroke-width="1.5">
          <!-- Row 1 -->
          <rect x="180" y="80" width="50" height="50" rx="6" fill="#450a0a" stroke="#ef4444"/><text x="205" y="112" fill="#f87171" font-size="18" text-anchor="middle">❌</text>
          <rect x="240" y="80" width="50" height="50" rx="6" fill="#450a0a" stroke="#ef4444"/><text x="265" y="112" fill="#f87171" font-size="18" text-anchor="middle">❌</text>
          <rect x="300" y="80" width="50" height="50" rx="6"/><text x="325" y="112" fill="#94a3b8" font-size="20" font-weight="bold" text-anchor="middle">1</text>
          <!-- Row 2 -->
          <rect x="180" y="140" width="50" height="50" rx="6" fill="#450a0a" stroke="#ef4444"/><text x="205" y="172" fill="#f87171" font-size="18" text-anchor="middle">❌</text>
          <rect x="240" y="140" width="50" height="50" rx="6"/><text x="265" y="172" fill="#94a3b8" font-size="20" font-weight="bold" text-anchor="middle">5</text>
          <rect x="300" y="140" width="50" height="50" rx="6" fill="#450a0a" stroke="#ef4444"/><text x="325" y="172" fill="#f87171" font-size="18" text-anchor="middle">❌</text>
          <!-- Row 3 -->
          <rect x="180" y="200" width="50" height="50" rx="6" fill="#450a0a" stroke="#ef4444"/><text x="205" y="232" fill="#f87171" font-size="18" text-anchor="middle">❌</text>
          <!-- TARGET WINNER CELL -->
          <rect x="240" y="200" width="50" height="50" rx="8" fill="#059669" stroke="#34d399" stroke-width="3"/>
          <text x="265" y="234" fill="#ffffff" font-size="26" font-weight="900" text-anchor="middle">7</text>
          <rect x="300" y="200" width="50" height="50" rx="6"/><text x="325" y="232" fill="#94a3b8" font-size="20" font-weight="bold" text-anchor="middle">9</text>
        </g>

        <!-- Callout Badge -->
        <g transform="translate(110, 275)">
          <rect x="0" y="0" width="320" height="32" rx="16" fill="rgba(245, 158, 11, 0.2)" stroke="#f59e0b" stroke-width="1.5"/>
          <text x="160" y="21" fill="#fbbf24" font-size="12" font-weight="bold" text-anchor="middle">⚡ 8 ô bị chặn ➔ Ô duy nhất nhận được số 7!</text>
        </g>
      </svg>
    `
  },

  'naked-pair': {
    key: 'naked-pair',
    title: '3. Cặp đôi trần (Naked Pair)',
    badge: 'Trung cấp',
    badgeClass: 'diff-medium',
    summary: 'Hai ô trên cùng 1 Hàng/Khối chỉ chứa đúng 2 số {3, 7} ➔ Khóa chặt hai số này, loại bỏ 3 và 7 khỏi tất cả các ô khác!',
    quickRule: '2 ô cùng giữ đúng 2 ứng viên {X, Y} ⇒ Xóa X, Y khỏi phần còn lại của đơn vị.',
    steps: [
      { label: 'Bước 1 (Nhận diện)', text: 'Tìm thấy đúng 2 ô trong Hàng chỉ có 2 số nháp giống hệt nhau: {3, 7}.' },
      { label: 'Bước 2 (Khóa cặp)', text: 'Hai ô này bắt buộc phải chia nhau số 3 và số 7 (nếu ô này là 3 thì ô kia là 7 và ngược lại).' },
      { label: 'Bước 3 (Xóa ứng viên)', text: 'Xóa sạch ứng viên 3 và 7 khỏi các ô khác trên cùng Hàng để làm lộ ra nước đi mới!' }
    ],
    svg: `
      <svg viewBox="0 0 540 320" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="background: #0f172a; border-radius: 12px; font-family: system-ui, sans-serif;">
        <!-- Row Container -->
        <rect x="30" y="90" width="480" height="80" rx="10" fill="rgba(30, 41, 59, 0.6)" stroke="#475569" stroke-width="2"/>
        
        <!-- Cells -->
        <!-- Cell 1 -->
        <rect x="45" y="100" width="65" height="60" rx="8" fill="#1e293b" stroke="#64748b"/>
        <text x="77" y="125" fill="#94a3b8" font-size="12" text-anchor="middle">1, 5</text>
        
        <!-- Cell 2: NAKED PAIR A -->
        <rect x="125" y="100" width="65" height="60" rx="8" fill="rgba(245, 158, 11, 0.25)" stroke="#f59e0b" stroke-width="2.5"/>
        <text x="157" y="136" fill="#fbbf24" font-size="20" font-weight="bold" text-anchor="middle">{3, 7}</text>

        <!-- Cell 3: ELIMINATION -->
        <rect x="205" y="100" width="65" height="60" rx="8" fill="#1e293b" stroke="#ef4444"/>
        <text x="237" y="125" fill="#94a3b8" font-size="12" text-anchor="middle">2, <tspan fill="#f87171" text-decoration="line-through">3</tspan>, 8</text>
        <text x="237" y="148" fill="#f87171" font-size="10" font-weight="bold" text-anchor="middle">❌ Xóa 3</text>

        <!-- Cell 4: NAKED PAIR B -->
        <rect x="285" y="100" width="65" height="60" rx="8" fill="rgba(245, 158, 11, 0.25)" stroke="#f59e0b" stroke-width="2.5"/>
        <text x="317" y="136" fill="#fbbf24" font-size="20" font-weight="bold" text-anchor="middle">{3, 7}</text>

        <!-- Cell 5: ELIMINATION -->
        <rect x="365" y="100" width="65" height="60" rx="8" fill="#1e293b" stroke="#ef4444"/>
        <text x="397" y="125" fill="#94a3b8" font-size="12" text-anchor="middle">4, <tspan fill="#f87171" text-decoration="line-through">7</tspan>, 9</text>
        <text x="397" y="148" fill="#f87171" font-size="10" font-weight="bold" text-anchor="middle">❌ Xóa 7</text>

        <!-- Cell 6 -->
        <rect x="445" y="100" width="55" height="60" rx="8" fill="#1e293b" stroke="#64748b"/>
        <text x="472" y="136" fill="#38bdf8" font-size="20" font-weight="bold" text-anchor="middle">6</text>

        <!-- Connector arc between pair -->
        <path d="M 157 95 Q 237 50 317 95" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-dasharray="4,4"/>
        <text x="237" y="60" fill="#fbbf24" font-size="13" font-weight="bold" text-anchor="middle">🔒 Khóa cặp {3, 7}</text>

        <!-- Bottom Explanation -->
        <g transform="translate(80, 210)">
          <rect x="0" y="0" width="380" height="50" rx="10" fill="rgba(239, 68, 68, 0.1)" stroke="rgba(239, 68, 68, 0.3)"/>
          <text x="190" y="24" fill="#fca5a5" font-size="13" font-weight="bold" text-anchor="middle">💡 Hai ô vàng giữ trọn số 3 và 7.</text>
          <text x="190" y="42" fill="#cbd5e1" font-size="12" text-anchor="middle">Loại bỏ hoàn toàn 3 và 7 khỏi các ô còn lại trên cùng hàng!</text>
        </g>
      </svg>
    `
  },

  'hidden-pair': {
    key: 'hidden-pair',
    title: '4. Cặp đôi ẩn (Hidden Pair)',
    badge: 'Nâng cao',
    badgeClass: 'diff-hard',
    summary: 'Hai số {2, 8} chỉ có thể xuất hiện tại 2 ô duy nhất trong Khối ➔ Xóa sạch mọi số nháp thừa khác trong 2 ô này!',
    quickRule: '2 số X, Y chỉ xuất hiện ở 2 ô trong đơn vị ⇒ Xóa mọi ứng viên khác khỏi 2 ô đó.',
    steps: [
      { label: 'Bước 1 (Đếm tần suất)', text: 'Kiểm tra Khối 3x3: Nhận thấy số 2 và 8 chỉ xuất hiện ở đúng ô A và ô B.' },
      { label: 'Bước 2 (Khẳng định)', text: 'Vì 2 và 8 không thể nằm ở đâu khác, ô A và B chắc chắn phải là {2, 8}.' },
      { label: 'Bước 3 (Thanh lọc)', text: 'Xóa các số nháp rác (như 1, 4, 5) khỏi 2 ô này để cô lập cặp số {2, 8}.' }
    ],
    svg: `
      <svg viewBox="0 0 540 320" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="background: #0f172a; border-radius: 12px; font-family: system-ui, sans-serif;">
        <!-- Left: Before -->
        <g transform="translate(40, 40)">
          <text x="90" y="15" fill="#94a3b8" font-size="14" font-weight="bold" text-anchor="middle">Trước khi áp dụng</text>
          <rect x="0" y="30" width="180" height="90" rx="10" fill="#1e293b" stroke="#475569" stroke-width="2"/>
          <rect x="15" y="45" width="65" height="60" rx="6" fill="#334155" stroke="#f59e0b" stroke-width="2"/>
          <text x="47" y="70" fill="#cbd5e1" font-size="11" text-anchor="middle"><tspan fill="#f87171">1</tspan>, <tspan fill="#fbbf24" font-weight="bold">2</tspan></text>
          <text x="47" y="90" fill="#cbd5e1" font-size="11" text-anchor="middle"><tspan fill="#f87171">5</tspan>, <tspan fill="#fbbf24" font-weight="bold">8</tspan></text>
          
          <rect x="100" y="45" width="65" height="60" rx="6" fill="#334155" stroke="#f59e0b" stroke-width="2"/>
          <text x="132" y="70" fill="#cbd5e1" font-size="11" text-anchor="middle"><tspan fill="#fbbf24" font-weight="bold">2</tspan>, <tspan fill="#f87171">4</tspan></text>
          <text x="132" y="90" fill="#cbd5e1" font-size="11" text-anchor="middle"><tspan fill="#fbbf24" font-weight="bold">8</tspan></text>
          <text x="90" y="145" fill="#f87171" font-size="11" text-anchor="middle">Chứa nhiều ứng viên rác</text>
        </g>

        <!-- Big Arrow -->
        <g transform="translate(245, 95)">
          <path d="M 0 15 L 35 15 L 35 5 L 50 20 L 35 35 L 35 25 L 0 25 Z" fill="#38bdf8"/>
          <text x="25" y="-5" fill="#38bdf8" font-size="11" font-weight="bold" text-anchor="middle">Lọc rác</text>
        </g>

        <!-- Right: After -->
        <g transform="translate(320, 40)">
          <text x="90" y="15" fill="#34d399" font-size="14" font-weight="bold" text-anchor="middle">Sau khi thanh lọc</text>
          <rect x="0" y="30" width="180" height="90" rx="10" fill="#1e293b" stroke="#10b981" stroke-width="2"/>
          <rect x="15" y="45" width="65" height="60" rx="6" fill="rgba(16, 185, 129, 0.25)" stroke="#10b981" stroke-width="2.5"/>
          <text x="47" y="82" fill="#34d399" font-size="18" font-weight="bold" text-anchor="middle">{2, 8}</text>
          
          <rect x="100" y="45" width="65" height="60" rx="6" fill="rgba(16, 185, 129, 0.25)" stroke="#10b981" stroke-width="2.5"/>
          <text x="132" y="82" fill="#34d399" font-size="18" font-weight="bold" text-anchor="middle">{2, 8}</text>
          <text x="90" y="145" fill="#34d399" font-size="11" font-weight="bold" text-anchor="middle">Đã xóa sạch 1, 4, 5!</text>
        </g>

        <!-- Bottom Banner -->
        <g transform="translate(70, 225)">
          <rect x="0" y="0" width="400" height="45" rx="8" fill="rgba(56, 189, 248, 0.12)" stroke="#38bdf8" stroke-width="1.5"/>
          <text x="200" y="22" fill="#7dd3fc" font-size="13" font-weight="bold" text-anchor="middle">💡 Số 2 và 8 chỉ có thể nằm tại 2 ô này trong khối.</text>
          <text x="200" y="38" fill="#cbd5e1" font-size="11" text-anchor="middle">Mọi ứng viên khác trong 2 ô đều bị loại trừ!</text>
        </g>
      </svg>
    `
  },

  'pointing': {
    key: 'pointing',
    title: '5. Khóa ứng viên (Pointing)',
    badge: 'Nâng cao',
    badgeClass: 'diff-hard',
    summary: 'Trong Khối 3x3, tất cả số 4 đều nằm trên cùng một Hàng ➔ Bắn tia xóa số 4 trên phần còn lại của Hàng đó bên ngoài khối!',
    quickRule: 'X trong Khối chỉ nằm trên 1 Hàng/Cột ⇒ Xóa X khỏi phần còn lại của Hàng/Cột đó.',
    steps: [
      { label: 'Bước 1 (Nhìn trong khối)', text: 'Trong Khối 1, chỉ có 2 ô ở Hàng 2 có thể chứa số 4.' },
      { label: 'Bước 2 (Bắn tia ra ngoài)', text: 'Số 4 của khối này chắc chắn phải nằm trên Hàng 2. Do đó Hàng 2 bên ngoài khối không thể có số 4 nữa.' },
      { label: 'Bước 3 (Xóa số 4 ngoài khối)', text: 'Xóa toàn bộ ứng viên 4 ở các ô cùng Hàng 2 thuộc các khối khác!' }
    ],
    svg: `
      <svg viewBox="0 0 540 320" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="background: #0f172a; border-radius: 12px; font-family: system-ui, sans-serif;">
        <!-- Row 2 Ray extending right -->
        <rect x="60" y="95" width="440" height="50" fill="rgba(56, 189, 248, 0.12)" stroke="rgba(56, 189, 248, 0.4)" stroke-dasharray="6,4"/>
        
        <!-- Box 1 (Left) -->
        <rect x="50" y="45" width="150" height="150" rx="10" fill="rgba(30, 41, 59, 0.8)" stroke="#38bdf8" stroke-width="2.5"/>
        <text x="125" y="35" fill="#38bdf8" font-size="12" font-weight="bold" text-anchor="middle">Khối 3x3</text>

        <!-- Cells in Box 1 Row 2 with candidate 4 -->
        <rect x="60" y="100" width="40" height="40" rx="6" fill="#1e293b" stroke="#64748b"/>
        <rect x="105" y="100" width="40" height="40" rx="6" fill="rgba(56, 189, 248, 0.3)" stroke="#38bdf8" stroke-width="2"/>
        <text x="125" y="126" fill="#38bdf8" font-size="16" font-weight="bold" text-anchor="middle">4</text>

        <rect x="150" y="100" width="40" height="40" rx="6" fill="rgba(56, 189, 248, 0.3)" stroke="#38bdf8" stroke-width="2"/>
        <text x="170" y="126" fill="#38bdf8" font-size="16" font-weight="bold" text-anchor="middle">4</text>

        <!-- Laser Beam Arrow out of box -->
        <line x1="205" y1="120" x2="480" y2="120" stroke="#38bdf8" stroke-width="3" stroke-dasharray="8,4"/>
        <polygon points="490,120 475,112 475,128" fill="#38bdf8"/>
        <text x="280" y="85" fill="#38bdf8" font-size="13" font-weight="bold">⚡ Bắn tia dọc theo Hàng</text>

        <!-- External Cells along Row 2 with 4 eliminated -->
        <g transform="translate(230, 100)">
          <rect x="0" y="0" width="45" height="40" rx="6" fill="#1e293b" stroke="#ef4444"/>
          <text x="22" y="24" fill="#f87171" font-size="12" font-weight="bold" text-anchor="middle">❌ 4</text>

          <rect x="60" y="0" width="45" height="40" rx="6" fill="#1e293b" stroke="#64748b"/>
          <text x="82" y="25" fill="#94a3b8" font-size="16" text-anchor="middle">7</text>

          <rect x="120" y="0" width="45" height="40" rx="6" fill="#1e293b" stroke="#ef4444"/>
          <text x="142" y="24" fill="#f87171" font-size="12" font-weight="bold" text-anchor="middle">❌ 4</text>

          <rect x="180" y="0" width="45" height="40" rx="6" fill="#1e293b" stroke="#ef4444"/>
          <text x="202" y="24" fill="#f87171" font-size="12" font-weight="bold" text-anchor="middle">❌ 4</text>
        </g>

        <!-- Bottom Banner -->
        <g transform="translate(50, 225)">
          <rect x="0" y="0" width="440" height="50" rx="10" fill="rgba(239, 68, 68, 0.12)" stroke="rgba(239, 68, 68, 0.3)"/>
          <text x="220" y="22" fill="#fca5a5" font-size="13" font-weight="bold" text-anchor="middle">🎯 Số 4 bị khóa thẳng hàng trong Khối.</text>
          <text x="220" y="40" fill="#cbd5e1" font-size="11" text-anchor="middle">Toàn bộ ứng viên 4 bên ngoài khối trên Hàng này đều bị xóa sạch!</text>
        </g>
      </svg>
    `
  },

  'box-line': {
    key: 'box-line',
    title: '6. Loại trừ Hàng-Khối (Box-Line Reduction)',
    badge: 'Nâng cao',
    badgeClass: 'diff-hard',
    summary: 'Trên Hàng 5, số 5 chỉ có thể nằm trong phạm vi của Khối 4 ➔ Xóa số 5 khỏi các hàng khác trong Khối 4!',
    quickRule: 'X trên Hàng chỉ nằm trong 1 Khối ⇒ Xóa X khỏi phần còn lại của Khối đó.',
    steps: [
      { label: 'Bước 1 (Nhìn trên Hàng)', text: 'Quét Hàng 5: Nhận thấy ứng viên 5 chỉ xuất hiện ở các ô thuộc Khối 4.' },
      { label: 'Bước 2 (Khẳng định)', text: 'Hàng 5 bắt buộc phải nhận số 5 tại Khối 4 này.' },
      { label: 'Bước 3 (Xóa trong khối)', text: 'Các ô khác thuộc Khối 4 (ở Hàng 4 và Hàng 6) không được phép chứa số 5 nữa!' }
    ],
    svg: `
      <svg viewBox="0 0 540 320" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="background: #0f172a; border-radius: 12px; font-family: system-ui, sans-serif;">
        <!-- Box Outline -->
        <rect x="180" y="45" width="180" height="180" rx="10" fill="rgba(30, 41, 59, 0.8)" stroke="#f59e0b" stroke-width="2.5"/>
        <text x="270" y="35" fill="#fbbf24" font-size="13" font-weight="bold" text-anchor="middle">Khối 4</text>

        <!-- Horizontal Highlight on Row 5 -->
        <rect x="40" y="110" width="460" height="50" fill="rgba(245, 158, 11, 0.15)" stroke="rgba(245, 158, 11, 0.4)" stroke-dasharray="6,4"/>
        <text x="100" y="100" fill="#fbbf24" font-size="12" font-weight="bold">Hàng 5 chỉ có 5 ở đây</text>

        <!-- Cells inside Box 4 -->
        <!-- Row 4 (Above): ELIMINATE 5 -->
        <rect x="195" y="55" width="45" height="45" rx="6" fill="#1e293b" stroke="#ef4444"/>
        <text x="217" y="83" fill="#f87171" font-size="13" font-weight="bold" text-anchor="middle">❌ 5</text>
        <rect x="248" y="55" width="45" height="45" rx="6" fill="#1e293b" stroke="#64748b"/>
        <text x="270" y="83" fill="#94a3b8" font-size="16" text-anchor="middle">2</text>
        <rect x="300" y="55" width="45" height="45" rx="6" fill="#1e293b" stroke="#ef4444"/>
        <text x="322" y="83" fill="#f87171" font-size="13" font-weight="bold" text-anchor="middle">❌ 5</text>

        <!-- Row 5 (Center): ONLY 5 ON ROW -->
        <rect x="195" y="112" width="45" height="45" rx="6" fill="rgba(245, 158, 11, 0.3)" stroke="#f59e0b" stroke-width="2"/>
        <text x="217" y="141" fill="#fbbf24" font-size="20" font-weight="bold" text-anchor="middle">5</text>
        <rect x="248" y="112" width="45" height="45" rx="6" fill="rgba(245, 158, 11, 0.3)" stroke="#f59e0b" stroke-width="2"/>
        <text x="270" y="141" fill="#fbbf24" font-size="20" font-weight="bold" text-anchor="middle">5</text>
        <rect x="300" y="112" width="45" height="45" rx="6" fill="#1e293b" stroke="#64748b"/>
        <text x="322" y="141" fill="#94a3b8" font-size="16" text-anchor="middle">8</text>

        <!-- Row 6 (Below): ELIMINATE 5 -->
        <rect x="195" y="170" width="45" height="45" rx="6" fill="#1e293b" stroke="#ef4444"/>
        <text x="217" y="198" fill="#f87171" font-size="13" font-weight="bold" text-anchor="middle">❌ 5</text>
        <rect x="248" y="170" width="45" height="45" rx="6" fill="#1e293b" stroke="#64748b"/>
        <text x="270" y="198" fill="#94a3b8" font-size="16" text-anchor="middle">9</text>
        <rect x="300" y="170" width="45" height="45" rx="6" fill="#1e293b" stroke="#64748b"/>
        <text x="322" y="198" fill="#94a3b8" font-size="16" text-anchor="middle">1</text>

        <!-- Bottom Banner -->
        <g transform="translate(60, 245)">
          <rect x="0" y="0" width="420" height="45" rx="8" fill="rgba(239, 68, 68, 0.12)" stroke="rgba(239, 68, 68, 0.3)"/>
          <text x="210" y="20" fill="#fca5a5" font-size="12" font-weight="bold" text-anchor="middle">Hàng 5 đòi hỏi số 5 phải nằm trong khối này.</text>
          <text x="210" y="36" fill="#cbd5e1" font-size="11" text-anchor="middle">Do đó số 5 ở Hàng 4 và Hàng 6 của khối này bị xóa bỏ!</text>
        </g>
      </svg>
    `
  },

  'x-wing': {
    key: 'x-wing',
    title: '7. Cánh chữ X (X-Wing)',
    badge: 'Cực khó',
    badgeClass: 'diff-extreme',
    summary: 'Số 9 chỉ nằm ở 2 cột giống nhau trên 2 hàng riêng biệt ➔ Tạo thành hình chữ nhật X ➔ Xóa số 9 trên toàn bộ 2 cột đó!',
    quickRule: 'X chỉ có ở 2 cột C1, C2 trên 2 hàng R1, R2 ⇒ Xóa X khỏi C1, C2 ở các hàng khác.',
    steps: [
      { label: 'Bước 1 (Nhận diện 4 góc)', text: 'Hàng 2 chỉ có số 9 ở Cột 2 và Cột 8. Hàng 7 cũng chỉ có số 9 ở Cột 2 và Cột 8.' },
      { label: 'Bước 2 (Mô hình chữ X)', text: 'Số 9 bắt buộc phải nằm ở 2 góc chéo nhau của hình chữ nhật.' },
      { label: 'Bước 3 (Xóa số 9 trên 2 cột)', text: 'Không còn ô nào khác trên Cột 2 và Cột 8 được phép chứa số 9!' }
    ],
    svg: `
      <svg viewBox="0 0 540 320" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="background: #0f172a; border-radius: 12px; font-family: system-ui, sans-serif;">
        <!-- Two Columns Highlight -->
        <rect x="100" y="30" width="60" height="230" fill="rgba(239, 68, 68, 0.1)" stroke="rgba(239, 68, 68, 0.3)" stroke-dasharray="4,4"/>
        <text x="130" y="20" fill="#f87171" font-size="12" font-weight="bold" text-anchor="middle">Cột 2</text>

        <rect x="380" y="30" width="60" height="230" fill="rgba(239, 68, 68, 0.1)" stroke="rgba(239, 68, 68, 0.3)" stroke-dasharray="4,4"/>
        <text x="410" y="20" fill="#f87171" font-size="12" font-weight="bold" text-anchor="middle">Cột 8</text>

        <!-- Big Glowing 'X' Connecting the 4 Corners -->
        <line x1="130" y1="65" x2="410" y2="215" stroke="#38bdf8" stroke-width="3" opacity="0.8"/>
        <line x1="130" y1="215" x2="410" y2="65" stroke="#38bdf8" stroke-width="3" opacity="0.8"/>

        <!-- 4 Corners (The Wings) -->
        <!-- Corner 1 (R2, C2) -->
        <rect x="105" y="45" width="50" height="45" rx="8" fill="#0284c7" stroke="#38bdf8" stroke-width="2.5"/>
        <text x="130" y="74" fill="#ffffff" font-size="22" font-weight="900" text-anchor="middle">9</text>

        <!-- Corner 2 (R2, C8) -->
        <rect x="385" y="45" width="50" height="45" rx="8" fill="#0284c7" stroke="#38bdf8" stroke-width="2.5"/>
        <text x="410" y="74" fill="#ffffff" font-size="22" font-weight="900" text-anchor="middle">9</text>

        <!-- Corner 3 (R7, C2) -->
        <rect x="105" y="195" width="50" height="45" rx="8" fill="#0284c7" stroke="#38bdf8" stroke-width="2.5"/>
        <text x="130" y="224" fill="#ffffff" font-size="22" font-weight="900" text-anchor="middle">9</text>

        <!-- Corner 4 (R7, C8) -->
        <rect x="385" y="195" width="50" height="45" rx="8" fill="#0284c7" stroke="#38bdf8" stroke-width="2.5"/>
        <text x="410" y="224" fill="#ffffff" font-size="22" font-weight="900" text-anchor="middle">9</text>

        <!-- Eliminations along columns -->
        <g fill="#1e293b" stroke="#ef4444" stroke-width="1.5">
          <rect x="110" y="105" width="40" height="30" rx="4"/><text x="130" y="125" fill="#f87171" font-size="11" font-weight="bold" text-anchor="middle">❌ 9</text>
          <rect x="110" y="145" width="40" height="30" rx="4"/><text x="130" y="165" fill="#f87171" font-size="11" font-weight="bold" text-anchor="middle">❌ 9</text>
          <rect x="390" y="105" width="40" height="30" rx="4"/><text x="410" y="125" fill="#f87171" font-size="11" font-weight="bold" text-anchor="middle">❌ 9</text>
          <rect x="390" y="145" width="40" height="30" rx="4"/><text x="410" y="165" fill="#f87171" font-size="11" font-weight="bold" text-anchor="middle">❌ 9</text>
        </g>

        <!-- Row labels -->
        <text x="35" y="72" fill="#94a3b8" font-size="12" font-weight="bold">Hàng 2</text>
        <text x="35" y="222" fill="#94a3b8" font-size="12" font-weight="bold">Hàng 7</text>

        <!-- Bottom Banner -->
        <g transform="translate(60, 265)">
          <rect x="0" y="0" width="420" height="36" rx="18" fill="rgba(14, 165, 233, 0.2)" stroke="#0ea5e9" stroke-width="1.5"/>
          <text x="210" y="23" fill="#38bdf8" font-size="12" font-weight="bold" text-anchor="middle">✈️ Cánh chữ X khóa 4 góc ➔ Xóa toàn bộ số 9 trên 2 cột!</text>
        </g>
      </svg>
    `
  },

  'xy-wing': {
    key: 'xy-wing',
    title: '8. Cánh chữ Y (XY-Wing)',
    badge: 'Nâng cao',
    badgeClass: 'diff-hard',
    summary: 'Ô Trục {3, 8} điều khiển 2 Cánh {3, 5} và {8, 5} ➔ Ô nhìn thấy cả 2 Cánh chắc chắn không thể chứa số 5!',
    quickRule: 'Trục (XY) nhìn Cánh 1 (XZ) và Cánh 2 (YZ) ⇒ Xóa Z ở các ô nhìn thấy cả 2 Cánh.',
    steps: [
      { label: 'Bước 1 (Tìm Trục & Cánh)', text: 'Ô Trục chứa {3, 8}. Cánh 1 chứa {3, 5}. Cánh 2 chứa {8, 5}.' },
      { label: 'Bước 2 (Lý luận logic)', text: 'Nếu Trục là 3 ➔ Cánh 1 bắt buộc là 5. Nếu Trục là 8 ➔ Cánh 2 bắt buộc là 5. Kiểu gì cũng có một Cánh nhận số 5!' },
      { label: 'Bước 3 (Triệt tiêu)', text: 'Ô giao thoa nhìn thấy cả 2 Cánh tuyệt đối không thể là 5. Xóa ngay ứng viên 5!' }
    ],
    svg: `
      <svg viewBox="0 0 540 320" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="background: #0f172a; border-radius: 12px; font-family: system-ui, sans-serif;">
        <!-- Connector Lines -->
        <line x1="270" y1="75" x2="130" y2="175" stroke="#fb923c" stroke-width="2.5" stroke-dasharray="6,4"/>
        <line x1="270" y1="75" x2="410" y2="175" stroke="#fb923c" stroke-width="2.5" stroke-dasharray="6,4"/>
        <line x1="130" y1="175" x2="270" y2="235" stroke="#ef4444" stroke-width="2" stroke-dasharray="4,4"/>
        <line x1="410" y1="175" x2="270" y2="235" stroke="#ef4444" stroke-width="2" stroke-dasharray="4,4"/>

        <!-- PIVOT CELL (Top Center) -->
        <g transform="translate(235, 45)">
          <rect x="0" y="0" width="70" height="55" rx="10" fill="rgba(251, 146, 60, 0.25)" stroke="#fb923c" stroke-width="3"/>
          <text x="35" y="24" fill="#fb923c" font-size="11" font-weight="bold" text-anchor="middle">Ô TRỤC</text>
          <text x="35" y="45" fill="#ffffff" font-size="18" font-weight="900" text-anchor="middle">{3, 8}</text>
        </g>

        <!-- PINCER 1 (Left) -->
        <g transform="translate(95, 145)">
          <rect x="0" y="0" width="70" height="55" rx="10" fill="rgba(56, 189, 248, 0.25)" stroke="#38bdf8" stroke-width="2.5"/>
          <text x="35" y="22" fill="#38bdf8" font-size="10" font-weight="bold" text-anchor="middle">CÁNH 1</text>
          <text x="35" y="44" fill="#ffffff" font-size="18" font-weight="900" text-anchor="middle">{3, <tspan fill="#34d399">5</tspan>}</text>
        </g>

        <!-- PINCER 2 (Right) -->
        <g transform="translate(375, 145)">
          <rect x="0" y="0" width="70" height="55" rx="10" fill="rgba(56, 189, 248, 0.25)" stroke="#38bdf8" stroke-width="2.5"/>
          <text x="35" y="22" fill="#38bdf8" font-size="10" font-weight="bold" text-anchor="middle">CÁNH 2</text>
          <text x="35" y="44" fill="#ffffff" font-size="18" font-weight="900" text-anchor="middle">{8, <tspan fill="#34d399">5</tspan>}</text>
        </g>

        <!-- TARGET INTERSECTION CELL (Bottom Center) -->
        <g transform="translate(230, 205)">
          <rect x="0" y="0" width="80" height="60" rx="10" fill="rgba(239, 68, 68, 0.2)" stroke="#ef4444" stroke-width="3"/>
          <text x="40" y="22" fill="#fca5a5" font-size="10" font-weight="bold" text-anchor="middle">GIAO THOA</text>
          <text x="40" y="42" fill="#ffffff" font-size="14" font-weight="bold" text-anchor="middle">1, <tspan fill="#f87171" text-decoration="line-through">5</tspan>, 6</text>
          <text x="40" y="55" fill="#f87171" font-size="10" font-weight="bold" text-anchor="middle">❌ Xóa 5</text>
        </g>

        <!-- Bottom Explanation -->
        <g transform="translate(50, 275)">
          <text x="220" y="20" fill="#cbd5e1" font-size="12" font-weight="bold" text-anchor="middle">Dù Trục nhận 3 hay 8, một trong hai Cánh bắt buộc nhận số 5 ➔ Ô giao thoa bị xóa 5!</text>
        </g>
      </svg>
    `
  },

  'branching': {
    key: 'branching',
    title: '9. Phản chứng Nishio (Proof by Contradiction)',
    badge: 'Ác mộng',
    badgeClass: 'diff-extreme',
    summary: 'Thử giả thiết số 1 kéo theo dây chuyền domino bế tắc ➔ Bác bỏ số 1, khẳng định 100% ô này phải nhận số 6!',
    quickRule: 'Giả thiết v_sai ⇒ Chuỗi domino dẫn tới mâu thuẫn ⇒ Phủ định giả thiết, khẳng định v_đúng.',
    steps: [
      { label: 'Bước 1 (Chọn nhánh)', text: 'Ô cờ khó có 2 ứng viên {1, 6}. Ta lập giả thiết thử đặt ô này = 1.' },
      { label: 'Bước 2 (Hiệu ứng Domino)', text: 'Số 1 ép ô kế tiếp phải nhận số khác, kéo theo hàng loạt nước đi bắt buộc.' },
      { label: 'Bước 3 (Chạm mâu thuẫn)', text: 'Dẫn tới 1 ô trống không còn số nào có thể điền (Bế tắc 💥). Bác bỏ số 1, khẳng định ô là 6!' }
    ],
    svg: `
      <svg viewBox="0 0 540 320" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="background: #0f172a; border-radius: 12px; font-family: system-ui, sans-serif;">
        <!-- Start Cell (Center Left) -->
        <g transform="translate(40, 115)">
          <rect x="0" y="0" width="85" height="70" rx="10" fill="#1e293b" stroke="#38bdf8" stroke-width="2.5"/>
          <text x="42" y="24" fill="#38bdf8" font-size="11" font-weight="bold" text-anchor="middle">Ô BIVALUE</text>
          <text x="42" y="52" fill="#ffffff" font-size="22" font-weight="bold" text-anchor="middle">{1, 6}</text>
        </g>

        <!-- Branch A: Top (Hypothesis = 1) -->
        <path d="M 130 135 C 180 135, 170 65, 220 65" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-dasharray="6,4"/>
        <g transform="translate(225, 35)">
          <rect x="0" y="0" width="270" height="60" rx="10" fill="rgba(239, 68, 68, 0.15)" stroke="#ef4444" stroke-width="2"/>
          <text x="135" y="24" fill="#f87171" font-size="13" font-weight="bold" text-anchor="middle">❌ Giả thiết: Ô = 1</text>
          <text x="135" y="45" fill="#fca5a5" font-size="11" text-anchor="middle">Kéo theo Domino ➔ 💥 MÂU THUẪN (Bế tắc)</text>
        </g>

        <!-- Branch B: Bottom (Truth = 6) -->
        <path d="M 130 165 C 180 165, 170 215, 220 215" fill="none" stroke="#10b981" stroke-width="3"/>
        <g transform="translate(225, 185)">
          <rect x="0" y="0" width="270" height="65" rx="10" fill="rgba(16, 185, 129, 0.25)" stroke="#10b981" stroke-width="2.5"/>
          <text x="135" y="26" fill="#34d399" font-size="14" font-weight="bold" text-anchor="middle">✓ BÁC BỎ 1 ➔ KHẲNG ĐỊNH: Ô = 6</text>
          <text x="135" y="48" fill="#a7f3d0" font-size="12" font-weight="bold" text-anchor="middle">Chân lý logic duy nhất (Q.E.D)!</text>
        </g>

        <!-- Bottom Banner -->
        <g transform="translate(50, 275)">
          <rect x="0" y="0" width="440" height="32" rx="16" fill="rgba(255, 255, 255, 0.05)" stroke="#475569"/>
          <text x="220" y="21" fill="#cbd5e1" font-size="12" text-anchor="middle">Phản chứng toán học nghiêm ngặt: Chứng minh sai để khẳng định chân lý!</text>
        </g>
      </svg>
    `
  }
};

/**
 * Quản lý Modal Xem Hình Ảnh Minh Họa Công Thức
 */
export class FormulaDiagramViewer {
  constructor() {
    this.currentKey = 'naked-single';
    this.keys = Object.keys(FORMULA_DIAGRAMS);
    this.initDOM();
  }

  initDOM() {
    this.modal = document.getElementById('formula-diagram-modal');
    this.titleElem = document.getElementById('diagram-modal-title');
    this.badgeElem = document.getElementById('diagram-modal-badge');
    this.summaryElem = document.getElementById('diagram-modal-summary');
    this.svgContainer = document.getElementById('diagram-modal-svg-container');
    this.stepsContainer = document.getElementById('diagram-modal-steps');
    this.counterElem = document.getElementById('diagram-modal-counter');

    this.btnClose = document.getElementById('btn-close-diagram-modal');
    this.btnPrev = document.getElementById('btn-prev-diagram');
    this.btnNext = document.getElementById('btn-next-diagram');

    if (this.btnClose) {
      this.btnClose.addEventListener('click', () => this.close());
    }

    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) this.close();
      });
    }

    if (this.btnPrev) {
      this.btnPrev.addEventListener('click', () => this.prev());
    }

    if (this.btnNext) {
      this.btnNext.addEventListener('click', () => this.next());
    }

    // Lắng nghe phím mũi tên trái phải khi modal đang mở
    window.addEventListener('keydown', (e) => {
      if (!this.modal || !this.modal.classList.contains('active')) return;
      if (e.key === 'ArrowLeft') this.prev();
      if (e.key === 'ArrowRight') this.next();
      if (e.key === 'Escape') this.close();
    });
  }

  /**
   * Mở modal xem hình ảnh minh họa cho công thức theo key
   */
  open(key = 'naked-single') {
    if (!FORMULA_DIAGRAMS[key]) {
      key = 'naked-single';
    }
    this.currentKey = key;
    this.render();
    if (this.modal) {
      this.modal.classList.add('active', 'show');
    }
  }

  close() {
    if (this.modal) {
      this.modal.classList.remove('active', 'show');
    }
  }

  prev() {
    const curIdx = this.keys.indexOf(this.currentKey);
    const nextIdx = (curIdx - 1 + this.keys.length) % this.keys.length;
    this.currentKey = this.keys[nextIdx];
    this.render();
  }

  next() {
    const curIdx = this.keys.indexOf(this.currentKey);
    const nextIdx = (curIdx + 1) % this.keys.length;
    this.currentKey = this.keys[nextIdx];
    this.render();
  }

  render() {
    const data = FORMULA_DIAGRAMS[this.currentKey];
    if (!data) return;

    if (this.titleElem) {
      this.titleElem.textContent = data.title;
    }

    if (this.badgeElem) {
      this.badgeElem.textContent = data.badge;
      this.badgeElem.className = `diff-badge ${data.badgeClass}`;
    }

    if (this.summaryElem) {
      this.summaryElem.innerHTML = `💡 <strong>Tóm tắt cốt lõi:</strong> ${data.summary}`;
    }

    if (this.svgContainer) {
      this.svgContainer.innerHTML = data.svg;
    }

    if (this.stepsContainer) {
      this.stepsContainer.innerHTML = data.steps.map(s => `
        <div class="diagram-step-item">
          <strong style="color: var(--teal); display: block; margin-bottom: 2px;">${s.label}:</strong>
          <span style="color: var(--text-muted); font-size: 0.82rem; line-height: 1.4;">${s.text}</span>
        </div>
      `).join('');
    }

    if (this.counterElem) {
      const idx = this.keys.indexOf(this.currentKey) + 1;
      this.counterElem.textContent = `${idx} / ${this.keys.length}`;
    }
  }

  /**
   * Chèn các khối xem hình ảnh vào từng thẻ trong Sổ tay công thức
   */
  injectThumbnailsIntoHandbook() {
    const cardMap = {
      'naked-single': 'guide-naked-single',
      'hidden-single': 'guide-hidden-single',
      'naked-pair': 'guide-naked-pair',
      'hidden-pair': 'guide-hidden-pair',
      'pointing': 'guide-pointing',
      'box-line': 'guide-box-line-reduction',
      'x-wing': 'guide-x-wing',
      'xy-wing': 'guide-xy-wing',
      'branching': 'guide-branching'
    };

    Object.entries(cardMap).forEach(([key, cardId]) => {
      const card = document.getElementById(cardId);
      if (!card) return;

      const data = FORMULA_DIAGRAMS[key];
      if (!data) return;

      // Kiểm tra nếu đã có khối hình ảnh thì không thêm trùng
      let previewCard = card.querySelector('.formula-diagram-preview-card');
      if (!previewCard) {
        previewCard = document.createElement('div');
        previewCard.className = 'formula-diagram-preview-card';
        previewCard.dataset.formulaKey = key;

        previewCard.innerHTML = `
          <div class="diagram-preview-header">
            <span class="diagram-preview-tag">🖼️ Hình ảnh minh họa trực quan (Bấm để xem)</span>
            <span class="diagram-quick-rule">${data.quickRule}</span>
          </div>
          <div class="diagram-thumb-wrap">
            ${data.svg}
            <div class="diagram-overlay-hint">
              <span class="zoom-icon">🔍</span>
              <span class="zoom-text">Ấn vào để phóng to xem chi tiết</span>
            </div>
          </div>
          <div class="diagram-action-bar">
            <button type="button" class="btn btn-primary btn-sm btn-zoom-diagram" style="width: 100%; font-weight: 700;">
              🖼️ Ấn dô để xem hình ảnh minh họa chi tiết
            </button>
          </div>
        `;

        // Chèn vào ngay sau formula-steps-list (trước formula-applied-box)
        const stepsList = card.querySelector('.formula-steps-list');
        if (stepsList) {
          stepsList.insertAdjacentElement('afterend', previewCard);
        } else {
          card.appendChild(previewCard);
        }

        // Bắt sự kiện click
        previewCard.addEventListener('click', () => {
          this.open(key);
        });
      }
    });
  }
}
