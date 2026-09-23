import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { clientLogger } from "../utils/logger";

export function RouteLogger() {
  const location = useLocation();
  const prevPathRef = useRef<string>(location.pathname);

  useEffect(() => {
    const currentPath = location.pathname + location.search;
    if (prevPathRef.current !== currentPath) {
      clientLogger.route(prevPathRef.current, currentPath);
      prevPathRef.current = currentPath;
    } else {
      clientLogger.info("ROUTING INIT", `Initial route loaded: ${currentPath}`);
    }
  }, [location]);

  return null;
}
