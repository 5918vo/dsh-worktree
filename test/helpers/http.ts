import { Readable } from 'node:stream'

export interface RouteResponse {
  status: number
  headers: any
  body: any
}

export interface CallOptions {
  method?: string
  url: string
  headers?: Record<string, string>
  body?: unknown
}

/**
 * Invoke a registered HTTP route handler with a minimal fake Node IncomingMessage
 * / ServerResponse pair. Mirrors exactly what the web server passes in, so the
 * handler's own body parsing, token check and JSON serialization are exercised.
 */
export async function callRoute(
  handler: (req: any, res: any) => void | Promise<void>,
  opts: CallOptions,
): Promise<RouteResponse> {
  const chunks = opts.body === undefined ? [] : [Buffer.from(JSON.stringify(opts.body), 'utf8')]
  const req: any = Readable.from(chunks)
  req.method = opts.method || 'GET'
  req.url = opts.url
  req.headers = Object.assign({}, opts.headers || {})
  const res: any = {
    status: 0,
    headers: null as any,
    raw: null as any,
    writeHead(status: number, headers: any) {
      this.status = status
      this.headers = headers
    },
    end(chunk: any) {
      this.raw = chunk
    },
  }
  await handler(req, res)
  let body: any = null
  try {
    body = res.raw ? JSON.parse(String(res.raw)) : null
  } catch {
    body = res.raw
  }
  return { status: res.status, headers: res.headers, body }
}

export function findRoute(routes: any[], path: string): any {
  const route = routes.find((r) => r.path === path)
  if (!route) throw new Error(`route not registered: ${path} (have: ${routes.map((r) => r.path).join(', ')})`)
  return route
}
