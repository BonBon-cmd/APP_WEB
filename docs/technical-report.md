# Báo cáo kỹ thuật Lab01 - Nhóm 27

## 1. Giới thiệu
Dự án gồm 3 phần: Static Web Server, HTTP Client, và Network Monitoring. Mục tiêu là xây dựng hệ thống web phục vụ file tĩnh, API, client HTTP tự xây dựng, và phân tích traffic mạng.

## 2. Cấu trúc dự án
```
lab01-nhom27/
├── README.md
├── package.json
├── server.js
├── client.js
├── monitor.js
├── public/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── screenshots/
│   ├── network-analysis.png
│   ├── server-running.png
│   └── api-response.png
├── docs/
│   └── technical-report.md
└── presentation/
    └── slides.pdf
```

## 3. Hướng dẫn sử dụng
- Cài đặt: `npm install`
- Chạy server: `npm start`
- Truy cập web: `http://localhost:3000`
- Kiểm thử client: `node client.js`
- Giám sát mạng: `node monitor.js`

## 4. Mô tả chức năng
### 4.1 Static Web Server
- Sử dụng Express.js phục vụ file tĩnh (HTML, CSS, JS).
- API `/api/server-info` trả về thông tin hệ thống, timestamp.
- Xử lý lỗi 404, 500, custom HTTP headers.
- Giao diện responsive, nút lấy thông tin server qua AJAX.

### 4.2 HTTP Client
- Tự xây dựng client dùng Node.js `http`/`https`.
- Hỗ trợ GET/POST, xử lý lỗi, log chi tiết request/response.
- Kiểm thử với server local, GitHub API, JSONPlaceholder, lỗi server.

### 4.3 Network Monitoring
- Sử dụng DevTools bắt request, phân tích static vs dynamic.
- Script monitor đo latency, headers, status.
- Lưu ảnh màn hình vào `screenshots/`.

## 5. Kiểm thử
- Đã kiểm thử các trường hợp GET/POST, lỗi server, external API.
- Ảnh minh họa kết quả kiểm thử trong thư mục `screenshots/`.

### Kết quả kiểm thử HTTP Client

**1. GET local**
Client gửi GET tới `http://localhost:3000/api/server-info` và nhận về thông tin hệ thống, timestamp. Kết quả trả về đúng dữ liệu server.

**2. GET lỗi server**
Client gửi GET tới một server không tồn tại (`http://localhost:9999`), nhận lỗi `ECONNREFUSED`. Client xử lý và log lỗi ra màn hình.

**3. GET external (GitHub API)**
Client gửi GET tới GitHub API (`https://api.github.com`) và nhận về JSON thông tin API của GitHub. Đã thêm header `User-Agent` nên request được chấp nhận.

**4. POST test (JSONPlaceholder)**
Client gửi POST tới endpoint test (`https://jsonplaceholder.typicode.com/posts`) với dữ liệu mẫu, nhận về object đã tạo. Kết quả đúng yêu cầu.

**Tổng kết:**
Các chức năng GET/POST, xử lý lỗi, gửi request tới server local và external đều hoạt động đúng, đáp ứng yêu cầu phần B của đề bài.

## 6. Phân tích network

**1. Phân tích bằng DevTools:**
  - Static files (index.html, style.css, script.js) tải qua GET, thường có cache, latency thấp.
  - Dynamic API (/api/server-info) trả về JSON, có custom headers, latency phụ thuộc xử lý server.
  - Có thể quan sát rõ các loại request, thời gian tải, response headers qua tab Network.

**2. Kết quả kiểm thử monitor.js:**
  - Khi chạy `node monitor.js`, script đo được latency (thời gian phản hồi), status code (200 OK), và các headers của server.
  - Ví dụ kết quả thực tế:
    ```
    Status: 200
    Latency: 25 ms
    Headers: {
      'x-powered-by': 'Nhóm 27',
      'x-server-timestamp': '2025-08-12T06:04:56.207Z',
      ...
    }
    ```

**3. Nhận xét chi tiết:**
  - Static files tải nhanh, ít bị ảnh hưởng bởi xử lý server, thường được cache bởi trình duyệt.
  - Dynamic API có thể có latency cao hơn, phụ thuộc vào logic xử lý và tài nguyên hệ thống.
  - Custom headers giúp nhận diện và kiểm tra thông tin server từ phía client, ví dụ `x-powered-by`, `x-server-timestamp`.
  - Khi kiểm thử bằng DevTools, có thể thấy rõ sự khác biệt giữa request static (tải file) và dynamic (gọi API).
  - Ảnh chụp màn hình minh họa các loại request đã lưu trong thư mục `screenshots/`.
