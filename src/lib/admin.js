export const labels = {
  real_name: "姓名",
  nationality: "国家或地区",
  team_id: "所属战队",
  player_role: "定位",
  status: "状态",
  bio: "简介",
  vlr_url: "VLR 资料页",
};
export const roles = ["决斗者", "先锋", "控场", "哨卫", "自由位"];
export const statuses = ["现役", "不活跃", "替补", "退役"];
export function differences(player, next) {
  return Object.entries(next)
    .filter(
      ([key, v]) => Object.hasOwn(labels, key) && (player[key] ?? null) !== v,
    )
    .map(([key, after]) => ({ key, before: player[key] ?? null, after }));
}
const normalize = (s) => s.normalize("NFKC").trim().toLowerCase();
export function sourceProposal(player, profile, teams) {
  if (normalize(profile.ign) !== normalize(player.ign))
    throw Error("来源选手 ID 与当前选手不一致，请核对链接。");
  if (
    player.vlr_url &&
    player.vlr_url.split("/")[4] !== profile.url.split("/")[4]
  )
    throw Error("该选手已绑定另一个 VLR 编号，请核对来源。");
  const values = { vlr_url: profile.url };
  if (profile.real_name) values.real_name = profile.real_name;
  if (profile.nationality) values.nationality = profile.nationality;
  let note = "";
  const club =
    profile.teams.length === 1
      ? teams.filter((t) =>
          [t.team_name, t.team_tag].some(
            (name) => normalize(name) === normalize(profile.teams[0]),
          ),
        )
      : [];
  if (club.length === 1) values.team_id = club[0].team_id;
  else
    note = profile.teams.length
      ? "来源战队未能唯一匹配：" + profile.teams.join("、") + "。请手动核实。"
      : "来源未标明当前战队，保留现有队伍。";
  return { values, note };
}
export function adminError(error) {
  if (error?.code === "42501") return "当前账号没有管理权限。";
  if (error?.message?.includes("STALE_PLAYER"))
    return "这份资料刚被更新。请刷新资料，重新核对差异。";
  if (error?.message?.includes("DUPLICATE_MATCH"))
    return "该场比赛已经收录，请勿重复发布。";
  if (error?.message?.includes("COMMENT_GONE"))
    return "这条评论已被删除，请刷新列表。";
  if (error?.message?.includes("PROTECTED_OWNER"))
    return "站长权限不能通过后台更改。";
  if (/INVALID_|UNKNOWN_/.test(error?.message || ""))
    return "资料值无效，请核对后再发布。";
  return "操作未完成，请检查网络并刷新记录后再试。";
}
