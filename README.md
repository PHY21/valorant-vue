# VALORANT Atlas

Vue 3 电竞数据图鉴，从 PHP 数据库课程作业独立升级的前端求职作品。

- **在线 Demo**：https://phy21.github.io/valorant-vue/
- **原 PHP 课程项目**：https://github.com/PHY21/valorant-web （独立保留）

## 已实现

- 总览、选手图鉴、战队档案、赛事中心、特工图鉴与详情页。
- 名称、赛区、定位、年份、级别组合筛选，查询条件同步 URL，列表分页。
- Vue Router Hash 路由与按路由懒加载，支持静态部署及刷新深链接。
- 按收录场次加权的 Rating、ACS、K/D 排行；双选手数据对比。
- 支持选手和战队收藏。战队对比可查看直接交手的系列赛比分、日期、胜方及比赛原始页，以及两队对所有收录对手的战绩。
- Pinia 管理数据、登录状态和本地收藏；localStorage 持久化与损坏状态恢复。
- Supabase 邮箱密码注册、邮箱验证码验证、登录、退出、会话恢复及邮件找回密码；路由守卫和 Postgres RLS 限制未登录访问。部署与实际验收状态见 [在线账号部署](docs/在线账号部署.md)。
- 响应式布局、手机导航、键盘跳转、空数据/异常链接/加载失败状态及图片回退。
- GitHub Actions 自动测试、构建并部署 GitHub Pages。

## 实现边界

图鉴 JSON 通过 Supabase 受限数据表读取；账号、图鉴和新评价均依赖后端。未登录或未验证邮箱不能使用图鉴，服务异常时明确提示，不会模拟成功。收藏和升级前的评价仍仅保存在当前浏览器，旧评价不会自动公开。原 PHP 账号不迁移，新服务需要单独注册。密码直接交给认证服务，业务代码不保存密码。本版使用真实邮箱注册并验证，忘记密码可接收邮箱验证码再设置新密码。旧用户名账号记录保留，但不能进入新版，需用真实邮箱重新注册。

数据来自原项目提交版 SQL：264 名选手、48 支战队、57 场赛事、29 名特工、2,141 条成绩记录。它们是课程示例数据，并非实时或经官方核验的战绩。没有导出用户、密码哈希、私人评论和日志。原 PHP 版本使用最大值榜单，本版改为按场次加权均值；页面明确展示计算口径，不声称官方排名。

## 本地运行

网站管理入口为 `/#/admin`。唯一站点管理员绑定到已验证账号的 UUID，绑定仅可由项目运维在私有数据库表中配置。后台支持从 VLR 选手资料页拉取候选值、逐字段审核、手动编辑、查看最近 50 次发布及分页查看账号权限。用户目录只显示脱敏邮箱与最近登录时间。发布时核对旧值，修改和记录在同一个事务提交。

需要 Node.js 22.12+ 或 24 LTS。

```bash
npm ci
npm run dev
npm test
npm run build
npm run preview
```

## 项目结构

```text
src/components/     共享选手卡、头像、标题组件
src/views/          各路由页面
src/stores/         Pinia 数据、账号和本地交互状态
src/lib/            筛选、加权统计、存储恢复函数
src/style.css       响应式布局与视觉样式
public/img/         继承的选手照片
scripts/            从 SQL 生成演示数据的工具
tests/              数据行为与异常输入测试
supabase/           图鉴种子、账号/评价表和 RLS 迁移
docs/               设计、验收记录与面试演示说明
```

数据导出写入 supabase/catalog.seed.json，不进入公开构建目录；导入由数据库管理员完成。Python 3 导出程序不执行 SQL：

```bash
python scripts/export_data.py "原项目/Valorant数据库_期末作业.sql"
```

将原项目 `img/` 复制到 `public/img/` 即可复用照片。Vue 项目不需要运行 PHP 或 MySQL。修改后推送 `main`，Actions 会测试、构建并更新线上 Demo。

## 素材

直接交手来自 [VLR.gg 2024](https://www.vlr.gg/vct-2024)、[2025](https://www.vlr.gg/vct-2025) 与 [2026 赛季](https://www.vlr.gg/vct-2026)的已完成比赛。快照保存在 `supabase/team-matches.json`，导出脚本将它合并到会员图鉴。每条记录的 `id` 对应 VLR.gg 比赛页。数据限本站 48 支战队之间具有明确数字比分的比赛。

特工详情页的中文技能导览由本站将特工立绘、技能说明与 Riot Games 的四段技能演示剪辑而成，使用同站托管的 H.264 MP4。原版介绍视频保留为外部链接。技能卡优先播放官方演示，加载失败时切换到本站导览的对应时间段。各段官方素材地址见 [agent-guides.json](supabase/agent-guides.json)。

VALORANT 品牌、选手照片等素材归各自权利人所有，本项目为非官方学习与作品展示。图标使用 Lucide，字体使用 Barlow Condensed / DM Sans，字体无法加载时使用系统字体。
