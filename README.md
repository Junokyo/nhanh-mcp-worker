# Nhanh.vn MCP Server — Cloudflare Worker

Remote MCP Server cho Nhanh.vn, deploy trên Cloudflare Workers. Cho phép Claude AI (web, mobile, desktop) kết nối Nhanh.vn từ mọi thiết bị.

**Dành cho người dùng cuối**: Xem hướng dẫn setup tại https://resproxy.io/nhanh (không cần code).

**Dành cho developer self-host**: Xem hướng dẫn bên dưới.

---

## Kiến trúc

```
Claude AI (claude.ai / mobile / desktop)
  ↓ JSON-RPC over HTTPS
Cloudflare Worker
  ↓ API calls with user credentials
Nhanh.vn API v3.0
```

- Credentials (access token, app ID, business ID) truyền qua URL query params hoặc HTTP headers
- Không lưu credentials ở server — mỗi request tự mang theo
- Stateless, scale tự động trên Cloudflare edge network

## Endpoints

| Path | Method | Mô tả |
|------|--------|-------|
| `/` | GET | Landing page |
| `/mcp` | POST | MCP JSON-RPC endpoint |
| `/exchange` | POST | Đổi accessCode → accessToken (proxy Nhanh API, tránh CORS) |

## Tools MCP

| Tool | Mô tả |
|------|-------|
| `check_token` | Kiểm tra token còn hạn |
| `get_orders` | Danh sách đơn hàng theo ngày/trạng thái |
| `get_revenue_report` | Doanh thu + breakdown theo trạng thái + theo ngày |
| `get_top_products` | Top sản phẩm bán chạy |
| `get_inventory` | Tồn kho sản phẩm |
| `get_customers` | Tìm kiếm khách hàng |

## Self-host

### 1. Clone & install

```bash
git clone https://github.com/Junokyo/nhanh-mcp-worker.git
cd nhanh-mcp-worker
npm install
```

### 2. Login Cloudflare

```bash
npx wrangler login
```

### 3. Đổi `name` trong `wrangler.toml`

```toml
name = "your-worker-name"   # URL sẽ là https://your-worker-name.<account>.workers.dev
```

### 4. Deploy

```bash
npx wrangler deploy
```

### 5. Dev local

```bash
npx wrangler dev
# Worker chạy ở http://localhost:8787
```

## Credentials

Worker yêu cầu 3 credentials của Nhanh.vn:

| Param | Header alternative | Mô tả |
|-------|-------------------|-------|
| `token` | `X-Nhanh-Token` | Access Token (lấy qua OAuth) |
| `appId` | `X-Nhanh-App-Id` | App ID tạo tại open.nhanh.vn |
| `businessId` | `X-Nhanh-Business-Id` | ID shop, trả về khi đổi accessToken |

### Via URL (Claude.ai connector)

```
https://<worker-url>/mcp?token=<access_token>&appId=<app_id>&businessId=<business_id>
```

### Via Headers (cho custom clients)

```http
POST /mcp HTTP/1.1
Content-Type: application/json
X-Nhanh-Token: <access_token>
X-Nhanh-App-Id: <app_id>
X-Nhanh-Business-Id: <business_id>

{"jsonrpc":"2.0", ...}
```

## Test local/deployed

```bash
curl -s "https://<worker-url>/mcp" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "X-Nhanh-Token: <token>" \
  -H "X-Nhanh-App-Id: <app_id>" \
  -H "X-Nhanh-Business-Id: <business_id>" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Các repo liên quan

- **https://github.com/Junokyo/nhanh-mcp** — bản stdio (Node.js local) cho Claude Desktop
- **Setup wizard frontend**: https://resproxy.io/nhanh (private code trong proxy-landing)

## Lưu ý bảo mật

- Worker không lưu token ở đâu cả — mỗi request tự mang
- Anyone có connector URL = có thể truy cập shop Nhanh.vn của bạn → không share public
- Token có hạn 1 năm, khi expire cần lấy mới

## License

MIT
