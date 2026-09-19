# Hướng Dẫn Cài Đặt & Tạo Ứng Dụng Cho iPhone / iPad (iOS)

Khác với Android (cho phép mở file `.apk` cài trực tiếp), hệ điều hành iOS của Apple quản lý bảo mật rất nghiêm ngặt thông qua chứng chỉ số (Code Signing). **Sudo9ku** hỗ trợ 3 phương án để chạy trên iPhone/iPad:

---

## ⚡ Cách 1: Cài Đặt Trực Tiếp Qua Safari (Khuyên Dùng - Nhanh Nhất, 100% Miễn Phí)
> **Không cần máy tính, không cần máy Mac, không cần tài khoản Apple Developer ($99/năm), hoạt động hoàn toàn Offline!**

Apple hỗ trợ chuẩn **Apple WebClip / Progressive Web App (PWA)** cực kỳ tối ưu:

1. Trên iPhone hoặc iPad, mở trình duyệt **Safari** và truy cập vào link web Sudo9ku:
   - Khi chạy trong mạng nội bộ Wi-Fi: `http://<IP_MÁY_TÍNH>:3000/` (ví dụ `http://192.168.1.146:3000/`)
   - Hoặc truy cập link trực tuyến đã triển khai trên Render / Vercel / GitHub Pages.
2. Chạm vào nút **Chia sẻ (Share)** ở thanh dưới cùng của Safari (biểu tượng **hình ô vuông có mũi tên trỏ lên ⎋**).
3. Cuộn xuống danh sách tùy chọn và chọn **"Thêm vào MH chính"** (*Add to Home Screen ➕*).
4. Nhấn nút **Thêm (Add)** ở góc trên bên phải.

### ✨ Trải nghiệm khi cài qua Safari:
- Biểu tượng **Sudo9ku** (logo số 9 màu cyan sắc nét) sẽ nằm ngay trên màn hình chính iPhone của bạn.
- Khi mở lên, ứng dụng chạy **toàn màn hình (Standalone)**, ẩn thanh địa chỉ Safari, giao diện chuẩn native app.
- Nhờ **Service Worker (`sw.js`)**, toàn bộ mã nguồn, logic giải đố và hình ảnh đã được lưu vào bộ nhớ máy, bạn có thể bật Chế độ máy bay (tắt Wi-Fi/4G) mà ứng dụng vẫn giải Sudoku bình thường!

---

## 🛠 Cách 2: Tự Động Build File `.ipa` Qua GitHub Actions & Cài Bằng Sideloadly / AltStore
> **Dành cho bạn muốn có file cài đặt `.ipa` thật để cài vào iPhone mà không cần sở hữu máy Mac!**

Dự án đã được tích hợp sẵn luồng **GitHub Actions CI/CD** chạy trên máy chủ **macOS 14 (Apple Silicon)** của GitHub:

### 1. Cách lấy file `.ipa`:
1. Đẩy mã nguồn lên GitHub (`git push origin main`).
2. Vào repository trên GitHub: [github.com/tiennood/sudo9ku](https://github.com/tiennood/sudo9ku) ➔ Chọn tab **Actions**.
3. Chọn workflow **"Build iOS App & IPA"** vừa chạy.
4. Cuộn xuống phần **Artifacts** ➔ Bấm tải file **`Sudo9ku-iOS-IPA`** (giải nén sẽ có file `Sudo9ku.ipa`).

### 2. Cách cài đặt file `.ipa` vào iPhone:
- **Dùng phần mềm Sideloadly (Miễn phí trên Windows/Mac):**
  1. Tải [Sideloadly](https://sideloadly.io/) về máy tính Windows của bạn.
  2. Cắm cáp kết nối iPhone với máy tính.
  3. Kéo thả file `Sudo9ku.ipa` vào cửa sổ Sideloadly.
  4. Nhập tài khoản Apple ID miễn phí của bạn và bấm **Start**.
  5. Sau 1 phút, ứng dụng Sudo9ku sẽ được cài đặt trực tiếp vào iPhone!
- **Dùng AltStore hoặc TrollStore:**
  - Nếu máy đã cài AltStore hoặc TrollStore, chỉ cần chia sẻ file `Sudo9ku.ipa` vào AltStore để cài đặt.

---

## 💻 Cách 3: Mở Bằng Xcode Trên Máy Mac (Dành Cho Lập Trình Viên)
Nếu bạn có máy tính Mac:
1. Mở thư mục dự án trên Mac.
2. Nhấp đúp vào file `ios/Sudo9ku.xcodeproj` để mở bằng **Xcode**.
3. Cắm cáp iPhone vào Mac hoặc chọn máy ảo iOS Simulator.
4. Trong phần **Signing & Capabilities**, chọn Team Apple ID của bạn.
5. Nhấn tổ hợp phím **Cmd + R (Run)** để biên dịch và cài đặt trực tiếp lên thiết bị.

---

## 📂 Cấu Trúc Mã Nguồn iOS Native:
- `ios/Sudo9ku.xcodeproj`: File dự án Xcode chuẩn.
- `ios/Sudo9ku/ViewController.swift`: Điều khiển `WKWebView`, nạp tài nguyên offline, quyền truy cập Camera.
- `ios/Sudo9ku/Info.plist`: Cấu hình quyền `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`.
- `ios/Sudo9ku/Assets.xcassets`: Bộ icon ứng dụng cho iPhone & iPad.
- `ios/Sudo9ku/www/`: Toàn bộ mã nguồn web đóng gói offline.
- `.github/workflows/build-ios.yml`: Tự động biên dịch `.ipa` trên cloud macOS.
