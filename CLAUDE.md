# Nhanh.vn MCP Project — Project Notes

> **Tách biệt với ResProxy landing page!** Dự án này chỉ liên quan đến Nhanh.vn + Claude MCP, không phải proxy service.

## Tổng quan

Kết nối Nhanh.vn với Claude AI qua Model Context Protocol (MCP). Cho phép sếp hỏi doanh thu/đơn hàng/tồn kho bằng tiếng Việt trực tiếp trong Claude.

## Kiến trúc (3 thành phần)

```
User (Claude)
   ↓
resproxy.io
   ├── /nhanh, /nhanh/auth, /nhanh/huong-dan        ← Setup Wizard UI
   └── /api/nhanh/*  (Vercel rewrite)               ← Traffic proxy
       ↓
Cloudflare Worker (nhanh-mcp.junokyo7.workers.dev)  ← MCP Server thật
   ↓
Nhanh.vn API v3.0
```

## 3 Repo liên quan

| Repo | Path local | Mục đích |
|------|-----------|----------|
| **proxy-landing** | `C:\Users\Admin\Desktop\resproxy\proxy-landing` | Wizard UI + Vercel rewrite. Routes: `/nhanh`, `/nhanh/auth`, `/nhanh/huong-dan`. Rewrite `/api/nhanh/*` → Worker (trong `next.config.ts`) |
| **nhanh-mcp-worker** | `C:\Users\Admin\Desktop\nhanh-mcp-worker` | Cloudflare Worker, JSON-RPC MCP HTTP. Main file: `src/index.ts`. Deploy: `npx wrangler deploy` |
| **nhanh-mcp** | `C:\Users\Admin\Desktop\nhanh-mcp` | Bản local stdio (Claude Desktop). Không dùng cho user thường |

## URL quan trọng

| URL | Mục đích |
|-----|----------|
| `https://resproxy.io/nhanh` | Trang bắt đầu setup (sếp nhập App ID) |
| `https://resproxy.io/nhanh/auth` | Callback OAuth — đổi accessCode→token, tạo connector URL |
| `https://resproxy.io/nhanh/huong-dan` | Hướng dẫn chi tiết |
| `https://resproxy.io/api/nhanh/mcp` | MCP endpoint (branded) — Claude gọi vào đây |
| `https://resproxy.io/api/nhanh/exchange` | Endpoint đổi accessCode (proxy Nhanh API tránh CORS) |
| `https://nhanh-mcp.junokyo7.workers.dev` | Worker URL gốc (deploy target của Vercel rewrite) |

## Credentials flow

1. Sếp tạo app trên `open.nhanh.vn` → có **App ID** + **Secret Key**
2. Bật Open API (tài khoản Giám đốc)
3. OAuth redirect: `nhanh.vn/oauth?appId=X&returnLink=resproxy.io/nhanh/auth`
4. Callback nhận `?accessCode=XXX` (hiệu lực 10 phút)
5. Frontend POST `{accessCode, appId, secretKey}` → `/api/nhanh/exchange`
6. Worker đổi lấy **accessToken** (hiệu lực 1 năm) + **businessId**
7. Frontend tạo Connector URL: `resproxy.io/api/nhanh/mcp?token=...&appId=...&businessId=...`
8. Sếp dán vào `claude.ai` → Settings → Connectors

## 6 MCP Tools

| Tool | Nhanh.vn API | Mô tả |
|------|--------------|-------|
| `check_token` | `/app/checkaccesstoken` | Check token còn hạn |
| `get_orders` | `/order/list` | Lấy đơn hàng theo ngày/trạng thái |
| `get_revenue_report` | `/order/list` (aggregate) | Tính doanh thu + breakdown |
| `get_top_products` | `/order/list` (aggregate) | Top sản phẩm bán chạy |
| `get_inventory` | `/product/list` | Tồn kho |
| `get_customers` | `/customer/search` | Tìm khách hàng |

## Nhanh.vn API v3 quirks

- Method: **POST** cho tất cả
- `appId` + `businessId` trên **query string**
- `Authorization` header: **accessToken thô** (KHÔNG có `Bearer` prefix)
- Date filters: **Unix timestamp** (không phải string dd/mm/yyyy)
- Request body: `{ filters: {...}, paginator: { size, next } }`
- Pagination: copy nguyên object `result.paginator.next` → gửi lại ở request sau
- Rate limit: 150 req / 30s → cần `await sleep(250ms)` giữa các trang
- Order status codes: `60=Thành công`, `54=Đơn mới`, `42=Đang đóng gói`, `63=Khách hủy`, `61=Thất bại`, `59=Đang chuyển`, `71=Đang chuyển hoàn`

## Dev workflow

### Cập nhật Worker
```bash
cd C:\Users\Admin\Desktop\nhanh-mcp-worker
# sửa src/index.ts hoặc src/nhanh-client.ts
npx wrangler deploy
git add . && git commit && git push
```

### Cập nhật Wizard UI (resproxy.io)
```bash
cd C:\Users\Admin\Desktop\resproxy\proxy-landing
# sửa src/app/nhanh/*
npx next build  # verify
git add . && git commit && git push  # Vercel auto-deploy
```

## Security model

- **Credentials đi qua URL query params** (Claude Connector chỉ hỗ trợ 1 custom header)
- Worker **KHÔNG lưu** credentials — mỗi request tự mang theo
- `resproxy.io` rewrite không log body (Vercel edge rewrite, transparent)
- Token có hạn 1 năm — hết hạn sếp phải làm lại flow

## Các sếp dùng

Mỗi sếp có shop Nhanh.vn riêng → mỗi người tự setup từ `resproxy.io/nhanh`, nhận Connector URL riêng với token của họ. Không chia sẻ URL cho nhau được.

## File docs khác

- `README.md` (repo này) — doc cho developer self-host
- `../nhanh-mcp/README.md` — hướng dẫn user dùng bản stdio local
- `../HUONG-DAN-SU-DUNG-NHANH-CLAUDE.md` — file markdown gửi sếp (có thể xuất PDF/Word)
