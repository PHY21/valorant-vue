export function profileUrl(raw) {
  if (typeof raw !== "string" || raw.length > 240) return null;
  const match =
    /^https:\/\/(?:www\.)?vlr\.gg\/player\/([1-9]\d{0,9})\/([a-z0-9_%-]+)\/?$/i.exec(
      raw.trim(),
    );
  return match
    ? "https://www.vlr.gg/player/" + match[1] + "/" + match[2]
    : null;
}
function plain(value) {
  return (value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(
      /&(?:amp|quot|#39|apos|nbsp);/g,
      (e) =>
        ({
          "&amp;": "&",
          "&quot;": '"',
          "&#39;": "'",
          "&apos;": "'",
          "&nbsp;": " ",
        })[e],
    )
    .replace(/\s+/g, " ")
    .trim();
}
export function parseProfile(html, url) {
  const header = html.match(
    /<h1\b[^>]*class="[^"]*wf-title[^"]*"[^>]*>([\s\S]*?)<\/h1>([\s\S]*?)<div class="wf-nav"/i,
  );
  const canonical = profileUrl(
    html.match(/<link rel="canonical" href="([^"]+)"/i)?.[1],
  );
  if (!header || !canonical || url.split("/")[4] !== canonical.split("/")[4])
    throw Error("无法核实该选手资料页");
  const name = plain(header[1]);
  if (!name || name.length > 100) throw Error("无法识别选手 ID");
  const fullName = plain(
    header[2].match(
      /<h2[^>]*class="player-real-name[^"]*"[^>]*>([\s\S]*?)<\/h2>/i,
    )?.[1],
  );
  const country = header[2]
    .match(/class="flag mod-([a-z]{2})"/i)?.[1]
    ?.toUpperCase();
  const section =
    html.match(
      /<h2[^>]*>\s*Current Teams\s*<\/h2>([\s\S]*?)(?=<h2\b|$)/i,
    )?.[1] || "";
  const teams = [];
  for (const m of section.matchAll(
    /<a\b[^>]*href="\/team\/[^"]+"[^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    const team = plain(
      m[1].match(
        /<div[^>]*style="[^"]*font-weight:\s*500[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      )?.[1],
    );
    if (team) teams.push(team);
  }
  return {
    url: canonical,
    ign: name,
    real_name: fullName,
    nationality: country
      ? new Intl.DisplayNames(["zh-CN"], { type: "region" }).of(country)
      : "",
    teams,
  };
}
