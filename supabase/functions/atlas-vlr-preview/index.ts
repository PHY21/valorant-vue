import { profileUrl, parseProfile } from "./profile.mjs";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
function response(data: unknown, status = 200) {
  return Response.json(data, { status, headers });
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return response({ error: "仅支持 POST" }, 405);
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return response({ error: "请先登录" }, 401);
  try {
    // Use the caller's session for the database authorization check. No service key.
    const verify = await fetch(
      Deno.env.get("SUPABASE_URL") + "/rest/v1/rpc/atlas_is_admin",
      {
        method: "POST",
        headers: {
          Authorization: auth,
          apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
          "Content-Type": "application/json",
        },
        body: "{}",
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!verify.ok || (await verify.json()) !== true)
      return response({ error: "仅管理员可同步资料" }, 403);
    const body = await req.json().catch(() => null),
      url = profileUrl(body?.url);
    if (!url)
      return response({ error: "请输入完整的 VLR.gg 选手资料页地址" }, 400);
    const upstream = await fetch(url, {
      redirect: "manual",
      headers: { Accept: "text/html" },
      signal: AbortSignal.timeout(12000),
    });
    if (
      !upstream.ok ||
      !upstream.headers.get("content-type")?.includes("text/html")
    )
      return response(
        { error: "VLR 暂未返回选手资料，请检查链接或稍后重试。" },
        502,
      );
    const html = await upstream.text();
    if (html.length > 2000000) return response({ error: "来源页面异常" }, 502);
    return response(parseProfile(html, url));
  } catch {
    return response({ error: "无法读取或识别来源页，本次没有修改资料。" }, 502);
  }
});
