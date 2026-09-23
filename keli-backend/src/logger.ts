export function logInfo(tag: string, message: string, meta?: any) {
  const time = new Date().toLocaleTimeString();
  const metaStr = meta ? ` | ${JSON.stringify(meta)}` : "";
  console.log(`\x1b[36m[${time}]\x1b[0m \x1b[32m[${tag}]\x1b[0m ${message}${metaStr}`);
}

export function logWarn(tag: string, message: string, meta?: any) {
  const time = new Date().toLocaleTimeString();
  const metaStr = meta ? ` | ${JSON.stringify(meta)}` : "";
  console.warn(`\x1b[36m[${time}]\x1b[0m \x1b[33m[${tag}]\x1b[0m ${message}${metaStr}`);
}

export function logError(tag: string, message: string, meta?: any) {
  const time = new Date().toLocaleTimeString();
  const metaStr = meta ? ` | ${JSON.stringify(meta)}` : "";
  console.error(`\x1b[36m[${time}]\x1b[0m \x1b[31m[${tag}]\x1b[0m ${message}${metaStr}`);
}

export function requestLogger(req: any, res: any, next: any) {
  const start = Date.now();
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";

  res.on("finish", () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const statusColor = status >= 400 ? "\x1b[31m" : status >= 300 ? "\x1b[33m" : "\x1b[32m";
    const method = req.method;
    const url = req.originalUrl || req.url;

    // Filter out static asset noise unless err
    if (url.startsWith("/assets/") && status < 400) {
      return;
    }

    console.log(
      `\x1b[36m[${new Date().toLocaleTimeString()}]\x1b[0m ` +
      `\x1b[35m[HTTP]\x1b[0m ` +
      `${method} ${url} ${statusColor}${status}\x1b[0m ` +
      `${duration}ms - IP: ${ip}`
    );
  });

  next();
}
