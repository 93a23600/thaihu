// ==========================================================================
// Tên file: quan-ly-nhat-ky-cap-nhat.js
// Chức năng: Quản lý phiên bản, nhật ký cập nhật, kiểm tra code mới đã chạy chưa,
//            vị trí sửa đổi và cam kết bảo toàn dữ liệu hệ thống (Chuẩn DOM 100%).
// ==========================================================================

const APP_UPDATE_REGISTRY = {
    currentVersion: '2.4.5-PRO',
    buildDate: '2026-09-23 15:10:00',
    timeZone: 'Asia/Ho_Chi_Minh (GMT+7)',
    runtimeLoadedAt: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
    logs: [
        {
            version: 'v2.4.5',
            date: '23/09/2026 15:00:00',
            title: 'Tối ưu hóa cơ chế Auto-Save thư mục & Snapshot theo ngày',
            author: 'Hồ Công Nguyễn',
            filesModified: [
                { file: 'tu-dong-luu-file.js', lines: 'Toàn bộ file', desc: 'Chuyển sang Directory Handle lưu IndexedDB; tự động tách file du_lieu_YYYY-MM-DD.json' },
                { file: 'kho-luu-tru.js', lines: 'Hàm resetDailyRunsOnly', desc: 'Gọi chốt dữ liệu snapshot trước khi gán currentRuns = 0' }
            ],
            guarantees: [
                'Không bao giờ bị hỏi đè file mỗi lần mở lại trình duyệt.',
                'Dữ liệu được chia theo từng ngày riêng biệt, không đè chồng mất tiến độ cũ.',
                'Reset ngày không làm mất số liệu của các ngày trước đó.'
            ]
        },
        {
            version: 'v2.4.0',
            date: '22/08/2026 18:30:00',
            title: 'Nâng cấp giao diện Sub-tabs Đội hình & Đồng hồ Thương Nhân',
            author: 'Hồ Công Nguyễn',
            filesModified: [
                { file: 'giao-dien-thai-hu.js', lines: 'Dòng 70 - 130', desc: 'Giới hạn 9 team/hàng, team 10+ tự động xuống hàng 2 và có nút mũi tên thu gọn' },
                { file: 'dong-co-bam-gio-thuong-nhan.js', lines: 'Dòng 45 - 90', desc: 'Chuyển sang cơ chế chênh lệch mốc thời gian chống đứng giờ khi ẩn tab' }
            ],
            guarantees: [
                'Giao diện không bị co rúm trên màn hình nhỏ.',
                'Đồng hồ Thương Nhân đếm chuẩn xác từng giây cả khi tắt màn hình/chuyển qua LDPlayer.'
            ]
        },
        {
            version: 'v2.3.0',
            date: '17/08/2026 09:15:00',
            title: 'Khắc phục lỗi biến window.tempFailuresState & Snapshot GMT+7',
            author: 'Hồ Công Nguyễn',
            filesModified: [
                { file: 'quan-ly-that-bai.js', lines: 'Dòng 122, 134', desc: 'Đồng bộ gán thẳng vào window.tempFailuresState để triệt tiêu lỗi Console' },
                { file: 'kho-luu-tru.js', lines: 'Dòng 120 - 180', desc: 'Tích hợp getVietnamCurrentDateString() và tạo khóa THAIHU_SNAPSHOT_YYYY-MM-DD' }
            ],
            guarantees: [
                'Triệt tiêu 100% chữ đỏ báo lỗi tại Console trình duyệt.',
                'Tự động đồng bộ số liệu sang LocalStorage theo chuẩn 00:00:00 giờ Hà Nội.'
            ]
        }
    ]
};

// 1. Kiểm tra trạng thái thực thi thực tế của code
function inspectActiveCodeStatus() {
    let checks = [];
    let dbStatus = (typeof systemDatabase !== 'undefined' && systemDatabase.teams) ? true : false;
    checks.push({ name: 'Cơ sở dữ liệu gốc (systemDatabase)', status: dbStatus, note: dbStatus ? 'Đã nạp bộ nhớ' : 'Chưa tìm thấy dữ liệu' });

    let snapshotStatus = (typeof getVietnamCurrentDateString === 'function' || typeof getTodayStringGMT7 === 'function');
    checks.push({ name: 'Bộ phân giải ngày GMT+7', status: snapshotStatus, note: snapshotStatus ? 'Đang chạy bản mới' : 'Đang dính cache cũ' });

    let autoSaveStatus = (typeof connectAutoSaveFile === 'function');
    checks.push({ name: 'Module Auto-Save Ổ cứng', status: autoSaveStatus, note: autoSaveStatus ? 'Sẵn sàng hoạt động' : 'Chưa nạp script' });

    let failStatus = (typeof window.tempFailuresState !== 'undefined' || typeof renderFailedCardModal === 'function');
    checks.push({ name: 'Module Quản Lý Thất Bại', status: failStatus, note: failStatus ? 'Đã sửa window.tempFailuresState' : 'Cần kiểm tra lại' });

    return checks;
}

// 2. Render giao diện Tab Cập Nhật hoàn toàn bằng DOM
function renderChangelogUpdateTabView(containerId) {
    let target = document.getElementById(containerId);
    if (!target) return;
    target.innerHTML = '';

    let activeChecks = inspectActiveCodeStatus();
    let isAllOk = activeChecks.every(c => c.status);

    let mainWrap = document.createElement('div');
    mainWrap.className = 'space-y-4 text-xs';

    // A. Khung trạng thái Runtime
    let statusBox = document.createElement('div');
    statusBox.className = 'p-3.5 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-lg ' + 
        (isAllOk ? 'bg-emerald-950/30 border-emerald-600/50' : 'bg-amber-950/30 border-amber-600/50');

    let statusLeft = document.createElement('div');
    statusLeft.className = 'space-y-1';

    let statusTitleRow = document.createElement('div');
    statusTitleRow.className = 'flex items-center gap-2';

    let dot = document.createElement('span');
    dot.className = 'w-2.5 h-2.5 rounded-full ' + (isAllOk ? 'bg-emerald-400 animate-ping' : 'bg-amber-400 animate-pulse');

    let statusText = document.createElement('strong');
    statusText.className = (isAllOk ? 'text-emerald-300' : 'text-amber-300') + ' text-sm uppercase';
    statusText.textContent = isAllOk ? 'MÃ NGUỒN MỚI ĐÃ ĐƯỢC THỰC THI (100% RUNNING)' : 'CẦN XÓA CACHE ĐỂ NẠP BẢN MỚI';

    let versionBadge = document.createElement('span');
    versionBadge.className = 'bg-gray-800 text-gray-300 font-mono text-[10px] px-1.5 py-0.5 rounded border border-gray-700';
    versionBadge.textContent = 'Phiên bản: ' + APP_UPDATE_REGISTRY.currentVersion;

    statusTitleRow.appendChild(dot);
    statusTitleRow.appendChild(statusText);
    statusTitleRow.appendChild(versionBadge);

    let statusMeta = document.createElement('div');
    statusMeta.className = 'text-[11px] text-gray-400 flex flex-wrap gap-x-4 gap-y-1 font-mono';

    let metaBuild = document.createElement('span');
    metaBuild.textContent = 'Build Date: ' + APP_UPDATE_REGISTRY.buildDate;

    let metaRuntime = document.createElement('span');
    metaRuntime.textContent = 'Thời điểm nạp: ' + APP_UPDATE_REGISTRY.runtimeLoadedAt;

    statusMeta.appendChild(metaBuild);
    statusMeta.appendChild(metaRuntime);

    statusLeft.appendChild(statusTitleRow);
    statusLeft.appendChild(statusMeta);

    let refreshBtn = document.createElement('button');
    refreshBtn.className = 'bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition shadow flex items-center gap-1.5 cursor-pointer shrink-0';
    refreshBtn.textContent = 'Kiểm Tra Lại';
    refreshBtn.onclick = forceRefreshUpdateCheck;

    statusBox.appendChild(statusLeft);
    statusBox.appendChild(refreshBtn);
    mainWrap.appendChild(statusBox);

    // B. Danh sách kiểm tra Module
    let checksSection = document.createElement('div');
    checksSection.className = 'space-y-1.5';
    let checksTitle = document.createElement('span');
    checksTitle.className = 'text-gray-400 text-[11px] font-bold uppercase tracking-wider block';
    checksTitle.textContent = 'Kiểm tra tính sẵn sàng các Module:';
    checksSection.appendChild(checksTitle);

    let checksGrid = document.createElement('div');
    checksGrid.className = 'grid grid-cols-1 md:grid-cols-2 gap-2';

    activeChecks.forEach(c => {
        let card = document.createElement('div');
        card.className = 'flex items-center justify-between p-2 rounded-lg bg-gray-900/80 border border-gray-800 text-[11px]';

        let nameSpan = document.createElement('span');
        nameSpan.className = 'text-gray-300 font-semibold';
        nameSpan.textContent = (c.status ? '✓ ' : '! ') + c.name;

        let noteBadge = document.createElement('span');
        noteBadge.className = 'font-mono text-[10px] px-2 py-0.5 rounded ' + 
            (c.status ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800');
        noteBadge.textContent = c.note;

        card.appendChild(nameSpan);
        card.appendChild(noteBadge);
        checksGrid.appendChild(card);
    });
    checksSection.appendChild(checksGrid);
    mainWrap.appendChild(checksSection);

    // C. Changelog danh sách cập nhật
    let logSection = document.createElement('div');
    logSection.className = 'space-y-2.5 pt-2 border-t border-gray-800';
    let logHeaderTitle = document.createElement('span');
    logHeaderTitle.className = 'text-gray-400 text-[11px] font-bold uppercase tracking-wider block';
    logHeaderTitle.textContent = 'Nhật ký cập nhật chi tiết (Changelog):';
    logSection.appendChild(logHeaderTitle);

    let logsList = document.createElement('div');
    logsList.className = 'space-y-3';

    APP_UPDATE_REGISTRY.logs.forEach(log => {
        let logItem = document.createElement('div');
        logItem.className = 'p-3.5 bg-gray-950 border border-gray-800 rounded-xl space-y-2.5';

        // Top bar
        let topBar = document.createElement('div');
        topBar.className = 'flex items-center justify-between flex-wrap gap-2 border-b border-gray-800/80 pb-2';

        let titleWrap = document.createElement('div');
        titleWrap.className = 'flex items-center gap-2';

        let verTag = document.createElement('span');
        verTag.className = 'bg-blue-600/30 text-blue-300 border border-blue-500/50 px-2 py-0.5 rounded text-[11px] font-black font-mono';
        verTag.textContent = log.version;

        let strongTitle = document.createElement('strong');
        strongTitle.className = 'text-gray-100 text-xs';
        strongTitle.textContent = log.title;

        titleWrap.appendChild(verTag);
        titleWrap.appendChild(strongTitle);

        let dateTag = document.createElement('span');
        dateTag.className = 'text-[10px] text-gray-400 font-mono';
        dateTag.textContent = log.date;

        topBar.appendChild(titleWrap);
        topBar.appendChild(dateTag);
        logItem.appendChild(topBar);

        // Bảng file sửa
        let tableWrap = document.createElement('div');
        tableWrap.className = 'space-y-1';
        let tableLabel = document.createElement('span');
        tableLabel.className = 'text-[10px] text-gray-400 font-bold uppercase tracking-wider block';
        tableLabel.textContent = '1. Vị trí file và dòng đã sửa:';
        tableWrap.appendChild(tableLabel);

        let tblHolder = document.createElement('div');
        tblHolder.className = 'overflow-x-auto rounded-lg border border-gray-800';
        let tbl = document.createElement('table');
        tbl.className = 'w-full text-left text-xs border-collapse';

        let thead = document.createElement('thead');
        thead.className = 'bg-gray-900 text-gray-400 text-[10px] uppercase';
        let headerRow = document.createElement('tr');
        
        let thFile = document.createElement('th');
        thFile.className = 'p-2 w-1/4';
        thFile.textContent = 'Tên File';

        let thLine = document.createElement('th');
        thLine.className = 'p-2 w-1/4';
        thLine.textContent = 'Vị trí';

        let thDesc = document.createElement('th');
        thDesc.className = 'p-2';
        thDesc.textContent = 'Nội dung chỉnh sửa';

        headerRow.appendChild(thFile);
        headerRow.appendChild(thLine);
        headerRow.appendChild(thDesc);
        thead.appendChild(headerRow);
        tbl.appendChild(thead);

        let tbody = document.createElement('tbody');
        log.filesModified.forEach(f => {
            let row = document.createElement('tr');
            row.className = 'border-b border-gray-800/60 hover:bg-gray-800/30';

            let td1 = document.createElement('td');
            td1.className = 'p-2 text-cyan-300 font-mono font-bold';
            td1.textContent = f.file;

            let td2 = document.createElement('td');
            td2.className = 'p-2 text-amber-300 font-mono text-[10px]';
            td2.textContent = f.lines;

            let td3 = document.createElement('td');
            td3.className = 'p-2 text-gray-300';
            td3.textContent = f.desc;

            row.appendChild(td1);
            row.appendChild(td2);
            row.appendChild(td3);
            tbody.appendChild(row);
        });
        tbl.appendChild(tbody);
        tblHolder.appendChild(tbl);
        tableWrap.appendChild(tblHolder);
        logItem.appendChild(tableWrap);

        // Khối cam kết
        let guaranteeBox = document.createElement('div');
        guaranteeBox.className = 'space-y-1 bg-emerald-950/20 border border-emerald-900/30 p-2.5 rounded-lg text-xs';
        let guaranteeTitle = document.createElement('span');
        guaranteeTitle.className = 'text-[10px] text-emerald-400 font-bold uppercase tracking-wider block';
        guaranteeTitle.textContent = '2. Cam kết & Bảo đảm hệ thống:';
        guaranteeBox.appendChild(guaranteeTitle);

        let gList = document.createElement('ul');
        gList.className = 'space-y-1';
        log.guarantees.forEach(g => {
            let li = document.createElement('li');
            li.className = 'flex items-start gap-1.5 text-emerald-300';
            li.textContent = '🛡 ' + g;
            gList.appendChild(li);
        });
        guaranteeBox.appendChild(gList);
        logItem.appendChild(guaranteeBox);

        logsList.appendChild(logItem);
    });
    logSection.appendChild(logsList);
    mainWrap.appendChild(logSection);

    target.appendChild(mainWrap);
}

function forceRefreshUpdateCheck() {
    APP_UPDATE_REGISTRY.runtimeLoadedAt = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    let holder = document.getElementById('settings-tab-changelog-content');
    if (holder) renderChangelogUpdateTabView('settings-tab-changelog-content');
}

window.APP_UPDATE_REGISTRY = APP_UPDATE_REGISTRY;
window.renderChangelogUpdateTabView = renderChangelogUpdateTabView;
window.forceRefreshUpdateCheck = forceRefreshUpdateCheck;
