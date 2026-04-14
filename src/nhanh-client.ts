const BASE_URL = "https://pos.open.nhanh.vn/v3.0";
const RATE_LIMIT_DELAY = 250;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface NhanhCredentials {
  accessToken: string;
  appId: string;
  businessId: string;
}

export function dateToTimestamp(dateStr: string): number {
  const [d, m, y] = dateStr.split("/").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, -7, 0, 0));
  return Math.floor(date.getTime() / 1000);
}

export function dateToEndTimestamp(dateStr: string): number {
  return dateToTimestamp(dateStr) + 86400 - 1;
}

export async function callNhanhApi(
  endpoint: string,
  body: Record<string, unknown>,
  creds: NhanhCredentials
): Promise<any> {
  const url = `${BASE_URL}${endpoint}?appId=${creds.appId}&businessId=${creds.businessId}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: creds.accessToken,
    },
    body: JSON.stringify(body),
  });

  const data: any = await response.json();

  if (data.code !== 1) {
    const messages = Array.isArray(data.messages)
      ? data.messages.join(", ")
      : data.messages || "No message";
    throw new Error(
      `Nhanh API error: ${data.errorCode || "UNKNOWN"} - ${messages}`
    );
  }

  return data;
}

export async function callNhanhApiPaginated(
  endpoint: string,
  body: Record<string, unknown>,
  creds: NhanhCredentials,
  options: { maxPages?: number; size?: number } = {}
): Promise<any[]> {
  const { maxPages = 10, size = 100 } = options;
  const allData: any[] = [];
  let paginatorNext: any = null;
  let page = 0;

  while (page < maxPages) {
    const requestBody: any = { ...body };
    requestBody.paginator = { size };
    if (paginatorNext) requestBody.paginator.next = paginatorNext;

    const result = await callNhanhApi(endpoint, requestBody, creds);

    const data = result.data;
    if (data) {
      if (Array.isArray(data)) {
        allData.push(...data);
      } else if (typeof data === "object") {
        const entries = Object.values(data);
        if (entries.length > 0 && typeof entries[0] === "object") {
          allData.push(...entries);
        } else {
          allData.push(data);
        }
      }
    }

    if (result.paginator && result.paginator.next) {
      paginatorNext = result.paginator.next;
      page++;
      await sleep(RATE_LIMIT_DELAY);
    } else {
      break;
    }
  }

  return allData;
}
