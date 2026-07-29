export interface XtreamConfig {
  host: string;
  username: string;
  password: string;
}

export function getXtreamConfig(): XtreamConfig {
  const host = process.env.XTREAM_HOST || "nvr.xcm9xplus.org:2052";
  const username = process.env.XTREAM_USERNAME || "66764023";
  const password = process.env.XTREAM_PASSWORD || "13715132950979";

  return { host, username, password };
}

export function buildUpstreamPlayerUrl(
  action: string,
  extraParams: Record<string, string> = {}
): string {
  const { host, username, password } = getXtreamConfig();
  const formattedHost = host.startsWith("http://") || host.startsWith("https://")
    ? host
    : `http://${host}`;

  const url = new URL(`${formattedHost}/player_api.php`);
  url.searchParams.set("username", username);
  url.searchParams.set("password", password);
  url.searchParams.set("action", action);

  for (const [key, value] of Object.entries(extraParams)) {
    // Exclude security sensitive query keys passed by client
    if (key.toLowerCase() !== "username" && key.toLowerCase() !== "password" && key.toLowerCase() !== "action") {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

export function buildUpstreamStreamUrl(
  type: string,
  streamId: string,
  container?: string
): string {
  const { host, username, password } = getXtreamConfig();
  const formattedHost = host.startsWith("http://") || host.startsWith("https://")
    ? host
    : `http://${host}`;

  let finalStreamId = streamId;
  let finalContainer = container;

  // Handle streamId already including container (e.g. 45012.mp4)
  if (streamId.includes(".")) {
    const parts = streamId.split(".");
    finalStreamId = parts[0];
    if (!finalContainer) {
      finalContainer = parts[1];
    }
  }

  if (!finalContainer) {
    finalContainer = type === "live" ? "ts" : "mp4";
  }

  return `${formattedHost}/${type}/${username}/${password}/${finalStreamId}.${finalContainer}`;
}
