"""Export only public course data from the original SQL dump; never execute SQL."""
import json, re, sys
from pathlib import Path
source=Path(sys.argv[1]).read_text(encoding='utf-8-sig')
allowed=['region','team','player','agent','tournament','player_agent','player_tournament_stats','team_tournament']
def tuples(text):
    rows=[]; row=[]; token=''; quoted=False; was_quoted=False; depth=0; i=0
    while i<len(text):
        c=text[i]
        if quoted:
            if c=='\\':
                i+=1; c=text[i]; token+= {'n':'\n','r':'\r','t':'\t','0':'\0'}.get(c,c)
            elif c=="'":
                if i+1<len(text) and text[i+1]=="'": token+="'"; i+=1
                else: quoted=False
            else: token+=c
        elif c=="'": quoted=True; was_quoted=True
        elif c=='(': depth=1; row=[]; token=''; was_quoted=False
        elif depth and c in ',)':
            value=token if was_quoted else (None if token.strip()=='NULL' else float(token) if '.' in token else int(token))
            row.append(value); token=''; was_quoted=False
            if c==')': rows.append(row); depth=0
        elif depth: token+=c
        i+=1
    return rows
data={}
for name in allowed:
    schema=re.search(r'CREATE TABLE `'+name+r'` \((.*?)\) ENGINE=',source,re.S).group(1)
    columns=re.findall(r'^\s+`(\w+)`',schema,re.M)
    rows=[]
    for insert in re.finditer(r'^INSERT INTO `'+name+r'` VALUES (.*);$',source,re.M):
        rows.extend(dict(zip(columns,row,strict=True)) for row in tuples(insert.group(1)))
    data[name]=rows
out=Path(__file__).resolve().parents[1]/'supabase/catalog.seed.json'
data['team_matches']=json.loads(out.with_name('team-matches.json').read_text(encoding='utf8'))
guides=json.loads(out.with_name('agent-guides.json').read_text(encoding='utf8'))
for agent in data['agent']:
    slug=agent['agent_name'].lower().replace('/','-')
    if slug in guides:
        agent['abilities']=guides[slug]
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf8')
print({name:len(rows) for name,rows in data.items()})
