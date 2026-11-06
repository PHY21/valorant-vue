export function catalogRows(data,kind) {
 return ['player','team','tournament','agent'].includes(kind)&&Array.isArray(data?.[kind])?data[kind]:[]
}
export function filterPlayers(players,{q='',region='',role=''}={}) {
 const query=q.trim().toLowerCase()
 return players.filter(p=>(!query||`${p.ign} ${p.real_name||''} ${p.team_tag||''}`.toLowerCase().includes(query))&&(!region||p.region_code===region)&&(!role||p.player_role===role))
}
export function compareStats(stats,id) {
 const rows=stats.filter(s=>s.player_id===Number(id)&&s.matches_played>0)
 if(!rows.length)return null
 const matches=rows.reduce((n,s)=>n+Number(s.matches_played),0)
 const result={matches}
 for(const key of ['rating','acs','kd']) {
  const available=rows.filter(s=>s[key]!=null&&Number.isFinite(Number(s[key])))
  const weight=available.reduce((n,s)=>n+Number(s.matches_played),0)
  result[key]=weight?available.reduce((n,s)=>n+Number(s[key])*Number(s.matches_played),0)/weight:null
 }
 return result
}
export function rankPlayers(players,stats,{tournament='',metric='rating'}={}) {
 const rows=tournament?stats.filter(s=>s.tournament_id===Number(tournament)):stats
 return players.flatMap(p=>{
  const summary=compareStats(rows,p.player_id)
  return summary&&summary.matches>=3&&summary[metric]!=null?[{...p,...summary,value:summary[metric]}]:[]
 }).sort((a,b)=>b.value-a.value||a.player_id-b.player_id)
}
export const number=(value,digits=0)=>value==null?'—':Number(value).toLocaleString('zh-CN',{maximumFractionDigits:digits,minimumFractionDigits:digits})
