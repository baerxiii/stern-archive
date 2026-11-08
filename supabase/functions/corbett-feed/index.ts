const FEED_URL = "https://www.corbettreport.com/newrss.xml";
const MAX_BYTES = 20 * 1024 * 1024;
const headers = {
  "Access-Control-Allow-Origin": "https://baerxiii.github.io",
  "Content-Type": "text/plain; charset=utf-8",
  "X-Content-Type-Options": "nosniff"
};

Deno.serve(async (request) => {
  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers });
  }

  try {
    const response = await fetch(FEED_URL, {
      redirect: "error",
      signal: AbortSignal.timeout(20000),
      headers: { Accept: "application/rss+xml, application/xml, text/xml" }
    });
    if (!response.ok) {
      console.error("Feed returned HTTP", response.status);
      return new Response(`Feed returned HTTP ${response.status}.`, { status: 502, headers });
    }
    if (!response.body) {
      return new Response("The feed was empty.", { status: 502, headers });
    }

    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        return new Response("The feed is too large.", { status: 502, headers });
      }
      chunks.push(value);
    }

    const body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new Response(body, {
      headers: { ...headers, "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=300" }
    });
  } catch (error) {
    console.error("Could not retrieve the feed", error);
    return new Response("Could not retrieve the feed from its provider.", { status: 502, headers });
  }
});
