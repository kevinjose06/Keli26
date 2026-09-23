const IS_DEV = true;

export const clientLogger = {
  info: (tag: string, message: string, data?: any) => {
    if (!IS_DEV) return;
    const time = new Date().toLocaleTimeString();
    console.log(
      `%c[${time}] %c[${tag}]%c ${message}`,
      "color: #888; font-weight: normal;",
      "color: #3b82f6; font-weight: bold;",
      "color: inherit;",
      data !== undefined ? data : ""
    );
  },

  success: (tag: string, message: string, data?: any) => {
    if (!IS_DEV) return;
    const time = new Date().toLocaleTimeString();
    console.log(
      `%c[${time}] %c[${tag}]%c ${message}`,
      "color: #888; font-weight: normal;",
      "color: #22c55e; font-weight: bold;",
      "color: inherit;",
      data !== undefined ? data : ""
    );
  },

  warn: (tag: string, message: string, data?: any) => {
    if (!IS_DEV) return;
    const time = new Date().toLocaleTimeString();
    console.warn(
      `%c[${time}] %c[${tag}]%c ${message}`,
      "color: #888; font-weight: normal;",
      "color: #eab308; font-weight: bold;",
      "color: inherit;",
      data !== undefined ? data : ""
    );
  },

  error: (tag: string, message: string, data?: any) => {
    if (!IS_DEV) return;
    const time = new Date().toLocaleTimeString();
    console.error(
      `%c[${time}] %c[${tag}]%c ${message}`,
      "color: #888; font-weight: normal;",
      "color: #ef4444; font-weight: bold;",
      "color: inherit;",
      data !== undefined ? data : ""
    );
  },

  route: (fromPath: string, toPath: string) => {
    if (!IS_DEV) return;
    const time = new Date().toLocaleTimeString();
    console.log(
      `%c[${time}] %c[ROUTING]%c ${fromPath} ➔ ${toPath}`,
      "color: #888; font-weight: normal;",
      "color: #a855f7; font-weight: bold;",
      "color: #d8b4fe;"
    );
  }
};
