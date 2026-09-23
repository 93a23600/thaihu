// ==========================================================================
// Tên file: tu-dong-luu-file.js
// Chức năng: Tự động lưu dữ liệu chia theo từng ngày (GMT+7) vào thư mục ổ cứng.
//            Tự chốt dữ liệu trước khi reset và duy trì file mục lục tổng để truy xuất ngược.
// ==========================================================================

let backupDirHandle = null;
let autoSaveDebounceTimeout = null;

// 1. Hàm lấy chuỗi ngày hiện tại chuẩn giờ Việt Nam (YYYY-MM-DD)
function getTodayStringGMT7() {
    return new Intl.DateTimeFormat('en-CA', { 
        timeZone: 'Asia/Ho_Chi_Minh', 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
    }).format(new Date());
}

// 2. Mở cơ sở dữ liệu IndexedDB để ghi nhớ quyền truy cập thư mục
function openVaultDB() {
    return new Promise((resolve, reject) => {
        let req = indexedDB.open("VL2_BACKUP_VAULT", 1);
        req.onupgradeneeded = (e) => e.target.result.createObjectStore("handles");
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e);
    });
}

async function saveDirHandleToVault(handle) {
    try {
        let db = await openVaultDB();
        let tx = db.transaction("handles", "readwrite");
        tx.objectStore("handles").put(handle, "folder_backup");
    } catch(e) { console.warn("Lỗi lưu DirectoryHandle:", e); }
}

async function getDirHandleFromVault() {
    try {
        let db = await openVaultDB();
        return new Promise((resolve) => {
            let tx = db.transaction("handles", "readonly");
            let req = tx.objectStore("handles").get("folder_backup");
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        });
    } catch(e) { return null; }
}

// 3. Kết nối thư mục lưu trữ trên máy tính
async function connectAutoSaveFile() {
    try {
        // Mở cửa sổ chọn thư mục lưu trữ (chỉ cần chọn 1 thư mục duy nhất)
        backupDirHandle = await window.showDirectoryPicker();
        await saveDirHandleToVault(backupDirHandle);

        // Ghi dữ liệu ngay lập tức
        await writeDataToFileSilent();
        updateAutoSaveButtonUI(true);
        if (typeof logUserAction === 'function') logUserAction("Đã liên kết thành công thư mục lưu trữ tự động theo ngày.");
    } catch (err) {
        console.warn("Hủy chọn thư mục sao lưu:", err);
    }
}

// 4. Khôi phục quyền truy cập thư mục khi mở lại trang web
async function restoreSavedDirectoryHandle() {
    let savedHandle = await getDirHandleFromVault();
    if (savedHandle) {
        try {
            // Kiểm tra và xin lại quyền đọc/ghi mà không cần mở lại hộp thoại duyệt thư mục
            const opts = { mode: 'readwrite' };
            if ((await savedHandle.queryPermission(opts)) === 'granted') {
                backupDirHandle = savedHandle;
                updateAutoSaveButtonUI(true);
            } else {
                updateAutoSaveButtonUI(false);
            }
        } catch (e) {
            updateAutoSaveButtonUI(false);
        }
    } else {
        updateAutoSaveButtonUI(false);
    }
}

// 5. Hàm thu thập gói dữ liệu đầy đủ của thời điểm hiện tại
function buildFullSnapshotPackage() {
    const todayStr = getTodayStringGMT7();
    return {
        date: todayStr,
        lastUpdatedTime: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
        timestamp: Date.now(),
        settings: {
            materialPrice: document.getElementById('input-material-price')?.value || localStorage.getItem('HEADER_MAT_PRICE') || "0.15",
            goldRate: document.getElementById('input-gold-rate')?.value || localStorage.getItem('HEADER_GOLD_RATE') || "155.000",
            ticketPrice: document.getElementById('input-ticket-price')?.value || localStorage.getItem('HEADER_TICKET_PRICE') || "24",
            refundPrice: document.getElementById('input-refund-price')?.value || localStorage.getItem('HEADER_REFUND_PRICE') || "16"
        },
        systemDatabase: (typeof systemDatabase !== 'undefined') ? systemDatabase : {}
    };
}

// 6. Ghi dữ liệu âm thầm: Tách thành file riêng cho từng ngày + Cập nhật file mục lục tổng
async function writeDataToFileSilent() {
    if (!backupDirHandle || typeof systemDatabase === 'undefined') return;

    try {
        const todayStr = getTodayStringGMT7();
        const snapshotData = buildFullSnapshotPackage();
        const jsonContent = JSON.stringify(snapshotData, null, 2);

        // A. GHI ĐÈ TIẾN ĐỘ VÀO FILE RIÊNG CỦA NGÀY HÔM NAY (du_lieu_YYYY-MM-DD.json)
        const dailyFileName = `du_lieu_${todayStr}.json`;
        const fileHandle = await backupDirHandle.getFileHandle(dailyFileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(jsonContent);
        await writable.close();

        // B. CẬP NHẬT FILE MỤC LỤC TỔNG (danh_muc_lich_su.json) ĐỂ SAU NÀY TRUY XUẤT NGƯỢC
        let masterIndex = {};
        try {
            const indexFileHandle = await backupDirHandle.getFileHandle('danh_muc_lich_su.json', { create: true });
            const existingFile = await indexFileHandle.getFile();
            const text = await existingFile.text();
            if (text) masterIndex = JSON.parse(text);
        } catch (e) {
            masterIndex = { files: [] };
        }

        if (!masterIndex.files) masterIndex.files = [];
        if (!masterIndex.files.includes(dailyFileName)) {
            masterIndex.files.push(dailyFileName);
            masterIndex.files.sort();
        }
        masterIndex.lastSavedDate = todayStr;
        masterIndex.lastSavedTime = snapshotData.lastUpdatedTime;

        const indexFileHandle = await backupDirHandle.getFileHandle('danh_muc_lich_su.json', { create: true });
        const indexWritable = await indexFileHandle.createWritable();
        await indexWritable.write(JSON.stringify(masterIndex, null, 2));
        await indexWritable.close();

    } catch (e) {
        console.error("Lỗi tự động ghi file ra ổ cứng:", e);
    }
}

// 7. Tự động lưu sau mỗi cú click (Debounce 300ms)
document.addEventListener('click', () => {
    if (backupDirHandle) {
        clearTimeout(autoSaveDebounceTimeout);
        autoSaveDebounceTimeout = setTimeout(writeDataToFileSilent, 300);
    }
});

// 8. Tự động kiểm tra chuyển ngày lúc 00:00:00 (GMT+7) để tách sang file ngày mới
function monitorDayTransitionGMT7() {
    const today = getTodayStringGMT7();
    const lastDay = localStorage.getItem('AUTO_SAVE_LAST_ACTIVE_DAY');
    if (lastDay && lastDay !== today) {
        // Vừa bước qua ngày mới: Ghi ngay trạng thái đầu ngày cho file mới
        writeDataToFileSilent();
        localStorage.setItem('AUTO_SAVE_LAST_ACTIVE_DAY', today);
    } else if (!lastDay) {
        localStorage.setItem('AUTO_SAVE_LAST_ACTIVE_DAY', today);
    }
}
setInterval(monitorDayTransitionGMT7, 30000);

// 9. Cập nhật giao diện nút bấm
function updateAutoSaveButtonUI(isConnected) {
    let btn = document.getElementById('btn-auto-save-link');
    if (btn) {
        if (isConnected) {
            btn.className = "bg-emerald-600/30 text-emerald-300 border border-emerald-500 px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer";
            btn.innerHTML = `** Auto-Save: BẬT`;
            btn.title = "Đang tự động lưu file riêng theo ngày vào thư mục đã chọn";
        } else {
            btn.className = "bg-gray-800 hover:bg-gray-700 text-amber-300 border border-amber-500/50 px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer";
            btn.innerHTML = `** Chọn Thư Mục Auto-Save`;
            btn.title = "Bấm để chọn thư mục lưu trữ tự động theo ngày";
        }
    }
}

// Khởi chạy kiểm tra khi trang web nạp xong
window.addEventListener('load', () => {
    restoreSavedDirectoryHandle();
    monitorDayTransitionGMT7();
});

window.connectAutoSaveFile = connectAutoSaveFile;
window.writeDataToFileSilent = writeDataToFileSilent;
