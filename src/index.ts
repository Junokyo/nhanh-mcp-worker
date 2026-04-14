import {
  callNhanhApi,
  callNhanhApiPaginated,
  dateToTimestamp,
  dateToEndTimestamp,
  type NhanhCredentials,
} from "./nhanh-client.js";

const ORDER_STATUS: Record<number, string> = {
  42: "Dang dong goi",
  43: "Cho thu gom",
  40: "Da dong goi",
  54: "Don moi",
  55: "Dang xac nhan",
  56: "Da xac nhan",
  57: "Cho khach xac nhan",
  58: "Hang van chuyen huy",
  59: "Dang chuyen",
  60: "Thanh cong",
  61: "That bai",
  63: "Khach huy",
  64: "He thong huy",
  68: "Het hang",
  71: "Dang chuyen hoan",
  72: "Da chuyen hoan",
  73: "Doi kho xuat hang",
  74: "Xac nhan hoan",
};
const SUCCESS_STATUSES = [60];

const MAX_DAYS_PER_QUERY = 31; // Nhanh.vn /order/list limit

/**
 * Split [fromDate, toDate] (dd/mm/yyyy) into chunks of <= MAX_DAYS_PER_QUERY days.
 * Returns list of [createdAtFrom, createdAtTo] Unix timestamp pairs.
 */
function splitDateRange(fromDate: string, toDate: string): Array<[number, number]> {
  const startTs = dateToTimestamp(fromDate);
  const endTs = dateToEndTimestamp(toDate);

  const chunks: Array<[number, number]> = [];
  const daySeconds = 86400;
  const chunkSeconds = MAX_DAYS_PER_QUERY * daySeconds;

  let cursor = startTs;
  while (cursor <= endTs) {
    const chunkEnd = Math.min(cursor + chunkSeconds - 1, endTs);
    chunks.push([cursor, chunkEnd]);
    cursor = chunkEnd + 1;
  }
  return chunks;
}

/** Fetch all orders across a date range, auto-splitting into 31-day chunks */
async function fetchOrdersAcrossRange(
  fromDate: string,
  toDate: string,
  creds: NhanhCredentials,
  extraFilters: Record<string, unknown> = {},
  options: { maxPagesPerChunk?: number; size?: number } = {}
): Promise<any[]> {
  const { maxPagesPerChunk = 20, size = 100 } = options;
  const chunks = splitDateRange(fromDate, toDate);
  const all: any[] = [];

  for (const [from, to] of chunks) {
    const filters = { ...extraFilters, createdAtFrom: from, createdAtTo: to };
    const orders = await callNhanhApiPaginated(
      "/order/list",
      { filters },
      creds,
      { maxPages: maxPagesPerChunk, size }
    );
    all.push(...orders);
  }
  return all;
}

const TOOLS = [
  {
    name: "check_token",
    description: "Kiem tra access token Nhanh.vn con han hay khong",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_orders",
    description: "Lay danh sach don hang theo ngay/trang thai. Date format: dd/mm/yyyy",
    inputSchema: {
      type: "object",
      properties: {
        fromDate: { type: "string", description: "Ngay bat dau, dd/mm/yyyy" },
        toDate: { type: "string", description: "Ngay ket thuc, dd/mm/yyyy" },
        statuses: {
          type: "array",
          items: { type: "number" },
          description: "Trang thai: 54=Moi, 42=Dong goi, 59=Dang chuyen, 60=Thanh cong, 63=Khach huy, 61=That bai",
        },
        maxPages: { type: "number" },
      },
    },
  },
  {
    name: "get_revenue_report",
    description: "Tinh doanh thu theo khoang thoi gian. Date format: dd/mm/yyyy",
    inputSchema: {
      type: "object",
      properties: {
        fromDate: { type: "string", description: "dd/mm/yyyy" },
        toDate: { type: "string", description: "dd/mm/yyyy" },
      },
      required: ["fromDate", "toDate"],
    },
  },
  {
    name: "get_top_products",
    description: "Top san pham ban chay. Date format: dd/mm/yyyy",
    inputSchema: {
      type: "object",
      properties: {
        fromDate: { type: "string", description: "dd/mm/yyyy" },
        toDate: { type: "string", description: "dd/mm/yyyy" },
        top: { type: "number" },
      },
      required: ["fromDate", "toDate"],
    },
  },
  {
    name: "get_inventory",
    description: "Xem ton kho san pham hien tai",
    inputSchema: {
      type: "object",
      properties: {
        keyword: { type: "string" },
        categoryId: { type: "number" },
        maxPages: { type: "number" },
      },
    },
  },
  {
    name: "get_bills",
    description:
      "Lay hoa don ban le tu /bill/imexs (mode=2). Chinh xac hon get_orders cho cua hang offline/POS. Date: dd/mm/yyyy",
    inputSchema: {
      type: "object",
      properties: {
        fromDate: { type: "string", description: "dd/mm/yyyy" },
        toDate: { type: "string", description: "dd/mm/yyyy" },
        maxPages: { type: "number" },
      },
      required: ["fromDate", "toDate"],
    },
  },
  {
    name: "get_customers",
    description: "Tim kiem khach hang",
    inputSchema: {
      type: "object",
      properties: {
        keyword: { type: "string" },
        maxPages: { type: "number" },
      },
    },
  },
];

function textResult(text: string) {
  return { content: [{ type: "text", text }] };
}

async function callTool(name: string, args: any, creds: NhanhCredentials): Promise<any> {
  try {
    switch (name) {
      case "check_token": {
        const result = await callNhanhApi("/app/checkaccesstoken", {}, creds);
        return textResult(JSON.stringify(result.data, null, 2));
      }

      case "get_orders": {
        let orders: any[];

        if (args.fromDate && args.toDate) {
          const extraFilters: any = {};
          if (args.statuses) extraFilters.statuses = args.statuses;
          orders = await fetchOrdersAcrossRange(
            args.fromDate,
            args.toDate,
            creds,
            extraFilters,
            { maxPagesPerChunk: args.maxPages || 100, size: 100 }
          );
        } else {
          const filters: any = {};
          if (args.fromDate) filters.createdAtFrom = dateToTimestamp(args.fromDate);
          if (args.toDate) filters.createdAtTo = dateToEndTimestamp(args.toDate);
          if (args.statuses) filters.statuses = args.statuses;

          orders = await callNhanhApiPaginated(
            "/order/list",
            { filters },
            creds,
            { maxPages: args.maxPages || 100, size: 100 }
          );
        }

        // Summary first, full data after — Claude can parse both
        const summary = {
          totalOrders: orders.length,
          statusBreakdown: orders.reduce((acc: Record<string, number>, o: any) => {
            const status = o.info?.status || 0;
            const name = ORDER_STATUS[status] || `Status ${status}`;
            acc[name] = (acc[name] || 0) + 1;
            return acc;
          }, {}),
          sample: orders.slice(0, 10),
        };

        return textResult(
          `Lay duoc ${orders.length} don hang (da load toan bo).\n\n${JSON.stringify(summary, null, 2)}`
        );
      }

      case "get_revenue_report": {
        const orders = await fetchOrdersAcrossRange(
          args.fromDate,
          args.toDate,
          creds,
          {},
          { maxPagesPerChunk: 100, size: 100 }
        );

        let totalRevenue = 0;
        let successRevenue = 0;
        let successCount = 0;
        const statusBreakdown: Record<string, number> = {};
        const dailyRevenue: Record<string, number> = {};

        for (const order of orders) {
          const status = order.info?.status || 0;
          const statusName = ORDER_STATUS[status] || `Status ${status}`;
          statusBreakdown[statusName] = (statusBreakdown[statusName] || 0) + 1;

          let orderTotal = 0;
          for (const p of order.products || []) {
            orderTotal += parseFloat(p.price || 0) * parseInt(p.quantity || 1);
          }
          totalRevenue += orderTotal;

          if (SUCCESS_STATUSES.includes(status)) {
            successRevenue += orderTotal;
            successCount++;
          }

          const createdAt = order.info?.createdAt || 0;
          const day = createdAt
            ? new Date(createdAt * 1000).toLocaleDateString("vi-VN")
            : "unknown";
          dailyRevenue[day] = (dailyRevenue[day] || 0) + orderTotal;
        }

        const report = {
          period: `${args.fromDate} - ${args.toDate}`,
          totalOrders: orders.length,
          totalRevenue: totalRevenue.toLocaleString("vi-VN") + " VND",
          successOrders: successCount,
          successRevenue: successRevenue.toLocaleString("vi-VN") + " VND",
          statusBreakdown,
          dailyBreakdown: Object.entries(dailyRevenue)
            .sort()
            .map(([date, amount]) => ({
              date,
              revenue: amount.toLocaleString("vi-VN") + " VND",
            })),
        };

        return textResult(JSON.stringify(report, null, 2));
      }

      case "get_top_products": {
        const orders = await fetchOrdersAcrossRange(
          args.fromDate,
          args.toDate,
          creds,
          {},
          { maxPagesPerChunk: 100, size: 100 }
        );

        const productMap: Record<string, { name: string; quantity: number; revenue: number }> = {};

        for (const order of orders) {
          for (const p of order.products || []) {
            const name = p.productName || p.name || `ID:${p.productId}`;
            if (!productMap[name]) productMap[name] = { name, quantity: 0, revenue: 0 };
            productMap[name].quantity += parseInt(p.quantity || 1);
            productMap[name].revenue += parseFloat(p.price || 0) * parseInt(p.quantity || 1);
          }
        }

        const sorted = Object.values(productMap)
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, args.top || 10)
          .map((p, i) => ({
            rank: i + 1,
            name: p.name,
            quantity: p.quantity,
            revenue: p.revenue.toLocaleString("vi-VN") + " VND",
          }));

        return textResult(
          `Top ${args.top || 10} san pham ban chay (${args.fromDate} - ${args.toDate}):\n\n${JSON.stringify(sorted, null, 2)}`
        );
      }

      case "get_inventory": {
        const filters: any = {};
        if (args.keyword) filters.name = args.keyword;
        if (args.categoryId) filters.categoryId = args.categoryId;

        const products = await callNhanhApiPaginated(
          "/product/list",
          { filters },
          creds,
          { maxPages: args.maxPages || 3, size: 50 }
        );

        const inventory = products.map((p: any) => ({
          id: p.idNhanh || p.id,
          name: p.name,
          code: p.code || "",
          inventory: p.inventory || p.remain || 0,
          price: p.price ? parseFloat(p.price).toLocaleString("vi-VN") + " VND" : "N/A",
        }));

        return textResult(
          `Tim thay ${inventory.length} san pham.\n\n${JSON.stringify(inventory.slice(0, 30), null, 2)}`
        );
      }

      case "get_bills": {
        // /bill/imexs returns bills with product details (including retail sales mode=2)
        const chunks = splitDateRange(args.fromDate, args.toDate);
        const all: any[] = [];

        for (const [from, to] of chunks) {
          const bills = await callNhanhApiPaginated(
            "/bill/imexs",
            {
              filters: {
                createdAtFrom: from,
                createdAtTo: to,
                mode: 2,
              },
            },
            creds,
            { maxPages: args.maxPages || 100, size: 100 }
          );
          all.push(...bills);
        }

        let totalRevenue = 0;
        const productMap: Record<string, { name: string; quantity: number; revenue: number }> = {};

        for (const bill of all) {
          for (const p of bill.products || []) {
            const qty = parseInt(p.quantity || 1);
            const price = parseFloat(p.price || 0);
            totalRevenue += price * qty;

            const name = p.productName || p.name || `ID:${p.productId}`;
            if (!productMap[name]) productMap[name] = { name, quantity: 0, revenue: 0 };
            productMap[name].quantity += qty;
            productMap[name].revenue += price * qty;
          }
        }

        const topProducts = Object.values(productMap)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 20)
          .map((p, i) => ({
            rank: i + 1,
            name: p.name,
            quantity: p.quantity,
            revenue: p.revenue.toLocaleString("vi-VN") + " VND",
          }));

        return textResult(
          JSON.stringify(
            {
              period: `${args.fromDate} - ${args.toDate}`,
              totalBills: all.length,
              totalRevenue: totalRevenue.toLocaleString("vi-VN") + " VND",
              topProductsByRevenue: topProducts,
            },
            null,
            2
          )
        );
      }

      case "get_customers": {
        const body: any = {};
        if (args.keyword) body.name = args.keyword;

        const customers = await callNhanhApiPaginated(
          "/customer/search",
          body,
          creds,
          { maxPages: args.maxPages || 3, size: 50 }
        );

        const list = customers.map((c: any) => ({
          id: c.id || c.idNhanh,
          name: c.name || c.customerName,
          phone: c.mobile || c.phone || "",
          email: c.email || "",
          address: c.address || "",
          totalOrders: c.totalOrder || 0,
          totalMoney: c.totalMoney
            ? parseFloat(c.totalMoney).toLocaleString("vi-VN") + " VND"
            : "N/A",
        }));

        return textResult(
          `Tim thay ${list.length} khach hang.\n\n${JSON.stringify(list.slice(0, 20), null, 2)}`
        );
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (e: any) {
    return textResult(`Error: ${e.message}`);
  }
}

async function handleRpc(body: any, creds: NhanhCredentials): Promise<any> {
  const { method, params, id } = body;

  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "nhanh-vn", version: "1.0.0" },
      },
    };
  }

  if (method === "notifications/initialized" || method === "notifications/cancelled") {
    return null; // no response for notifications
  }

  if (method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
  }

  if (method === "tools/call") {
    const { name, arguments: args } = params || {};
    const result = await callTool(name, args || {}, creds);
    return { jsonrpc: "2.0", id, result };
  }

  if (method === "ping") {
    return { jsonrpc: "2.0", id, result: {} };
  }

  return {
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  };
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Nhanh-Token, X-Nhanh-App-Id, X-Nhanh-Business-Id, Mcp-Session-Id, Mcp-Protocol-Version",
    "Access-Control-Expose-Headers": "Mcp-Session-Id",
  };
}

function extractCredentials(req: Request, url: URL): NhanhCredentials | null {
  const tokenHeader = req.headers.get("X-Nhanh-Token") || req.headers.get("x-nhanh-token");
  const appIdHeader = req.headers.get("X-Nhanh-App-Id") || req.headers.get("x-nhanh-app-id");
  const businessIdHeader =
    req.headers.get("X-Nhanh-Business-Id") || req.headers.get("x-nhanh-business-id");

  if (tokenHeader && appIdHeader && businessIdHeader) {
    return { accessToken: tokenHeader, appId: appIdHeader, businessId: businessIdHeader };
  }

  const token = url.searchParams.get("token");
  const appId = url.searchParams.get("appId");
  const businessId = url.searchParams.get("businessId");

  if (token && appId && businessId) {
    return { accessToken: token, appId, businessId };
  }

  return null;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    if (url.pathname === "/" && request.method === "GET") {
      return new Response(
        `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Nhanh.vn MCP Server</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 20px;line-height:1.6;color:#222}
code{background:#f4f4f4;padding:2px 6px;border-radius:4px}
pre{background:#f4f4f4;padding:12px;border-radius:8px;overflow-x:auto;font-size:13px}
a{color:#2563eb}</style></head>
<body>
<h1>Nhanh.vn MCP Server</h1>
<p>Remote MCP Server ket noi Claude AI voi Nhanh.vn.</p>
<h2>Cach dung</h2>
<ol>
<li>Mo <strong>claude.ai</strong> → Settings → Connectors → Add custom connector</li>
<li>URL: <code>https://resproxy.io/api/nhanh/mcp</code></li>
<li>Them 3 custom headers:
<pre>X-Nhanh-Token: &lt;access_token&gt;
X-Nhanh-App-Id: &lt;app_id&gt;
X-Nhanh-Business-Id: &lt;business_id&gt;</pre></li>
<li>Save → Dung duoc tren moi thiet bi</li>
</ol>
<p>Huong dan day du: <a href="https://github.com/Junokyo/nhanh-mcp">github.com/Junokyo/nhanh-mcp</a></p>
</body></html>`,
        { headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders() } }
      );
    }

    // Exchange endpoint - proxy Nhanh.vn getAccessToken API (avoid CORS issues)
    if (url.pathname === "/exchange" && request.method === "POST") {
      try {
        const { accessCode, appId, secretKey } = (await request.json()) as {
          accessCode?: string;
          appId?: string;
          secretKey?: string;
        };

        if (!accessCode || !appId || !secretKey) {
          return new Response(
            JSON.stringify({ error: "Missing accessCode, appId, or secretKey" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders() } }
          );
        }

        const resp = await fetch(
          `https://pos.open.nhanh.vn/v3.0/app/getaccesstoken?appId=${appId}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accessCode, secretKey }),
          }
        );
        const data = await resp.json();
        return new Response(JSON.stringify(data), {
          headers: { "Content-Type": "application/json", ...corsHeaders() },
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders() },
        });
      }
    }

    if (url.pathname === "/mcp" || url.pathname === "/sse") {
      const creds = extractCredentials(request, url);

      if (!creds) {
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32001,
              message:
                "Missing Nhanh.vn credentials. Provide via headers: X-Nhanh-Token, X-Nhanh-App-Id, X-Nhanh-Business-Id",
            },
            id: null,
          }),
          { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders() } }
        );
      }

      if (request.method !== "POST") {
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32600, message: "Only POST supported" },
            id: null,
          }),
          { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders() } }
        );
      }

      try {
        const body = await request.json();
        const result = await handleRpc(body, creds);

        if (result === null) {
          // Notification - return 202 Accepted with no body
          return new Response(null, { status: 202, headers: corsHeaders() });
        }

        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json", ...corsHeaders() },
        });
      } catch (error: any) {
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32603, message: `Internal error: ${error.message}` },
            id: null,
          }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders() } }
        );
      }
    }

    return new Response("Not found", { status: 404, headers: corsHeaders() });
  },
};
