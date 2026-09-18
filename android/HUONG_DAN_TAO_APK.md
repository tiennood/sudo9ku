# Hướng Dẫn Cài Đặt & Tạo File APK Cho Điện Thoại Android

Dự án **Sudoku Vision** hỗ trợ 2 cách chuyển đổi thành ứng dụng Android hoàn chỉnh:

---

## ⚡ Cách 1: Cài Đặt Trực Tiếp Vào Android (Khuyên Dùng - Nhanh Nhất 1 Phút)
> **Không cần cài Android Studio, không cần cắm cáp máy tính, chạy hoàn toàn Offline!**

Android (thông qua trình duyệt Google Chrome, Samsung Internet, Brave) hỗ trợ chuẩn **WebAPK / PWA**:

1. Đảm bảo điện thoại kết nối chung Wi-Fi với máy tính lần đầu để tải app.
2. Trên điện thoại, mở trình duyệt **Chrome** và truy cập:
   ```text
   http://192.168.1.146:3000/
   ```
   *(Hoặc quét mã QR trên màn hình máy tính)*.
3. Nhấn vào biểu tượng **menu 3 dấu chấm (⋮)** ở góc trên bên phải Chrome.
4. Chọn **"Cài đặt ứng dụng"** (hoặc **"Thêm vào Màn hình chính"** / **Install App**).
5. Nhấn **Cài đặt**:
   - Hệ điều hành Android sẽ tự động tạo một ứng dụng **Sudoku Vision** với logo biểu tượng riêng trên màn hình chính và trong danh sách ứng dụng (App Drawer).
   - Khi mở lên, ứng dụng chạy **toàn màn hình (Standalone)**, không có thanh địa chỉ trình duyệt, cảm giác 100% như app native.
   - Nhờ có **Service Worker** lưu sẵn toàn bộ mã nguồn trên máy, bạn có thể tắt máy tính hoặc tắt Wi-Fi/4G mà ứng dụng vẫn hoạt động bình thường!

---

## 🛠 Cách 2: Mở & Build File `.apk` Bằng Android Studio

Nếu bạn muốn có file cài đặt `.apk` để chia sẻ hoặc cài qua cổng USB:

Toàn bộ mã nguồn dự án Android native đã được tạo sẵn trong thư mục `android/`:
- **Ngôn ngữ:** Java + Modern Android WebView
- **Quyền hạn (Permissions):** Tích hợp sẵn quyền `CAMERA`, `READ_MEDIA_IMAGES` và `FileProvider`.
- **Chụp ảnh:** Tích hợp `WebChromeClient.onShowFileChooser` kích hoạt Camera native của Android.
- **Tài nguyên offline:** Mã nguồn web được đóng gói sẵn trong `app/src/main/assets/www/` (chạy offline độc lập).

### Các bước Build APK:
1. Tải và cài đặt **[Android Studio](https://developer.android.com/studio)** (nếu chưa có).
2. Mở Android Studio -> Chọn **Open** -> Chọn thư mục `android/` trong dự án này.
3. Chờ Android Studio tải Gradle và đồng bộ mã nguồn (Gradle Sync).
4. Để xuất file `.apk`:
   - Vào menu trên thanh công cụ: **Build** -> **Build Bundle(s) / APK(s)** -> chọn **Build APK(s)**.
5. Sau khi build xong:
   - File APK sẽ nằm tại đường dẫn:
     ```text
     android/app/build/outputs/apk/debug/app-debug.apk
     ```
6. Bạn chỉ cần gửi file `app-debug.apk` này sang điện thoại Android (qua Zalo, Google Drive, Bluetooth...) và nhấn vào file để cài đặt trực tiếp.
