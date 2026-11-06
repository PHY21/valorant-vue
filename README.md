# VALORANT Atlas

Vue 3 电竞数据图鉴，从 PHP 数据库课程作业独立升级的前端求职作品。

- **在线 Demo**：https://phy21.github.io/valorant-vue/
- **原 PHP 课程项目**：https://github.com/PHY21/valorant-web （独立保留）

## 已实现

- 总览、选手图鉴、战队档案、赛事中心、特工图鉴与详情页。
- 名称、赛区、定位、年份、级别组合筛选，查询条件同步 URL，列表分页。
- Vue Router Hash 路由与按路由懒加载，支持静态部署及刷新深链接。
- 按收录场次加权的 Rating、ACS、K/D 排行；双选手数据对比。
- Pinia 管理数据、登录状态和本地收藏；localStorage 持久化与损坏状态恢复。
- Supabase 用户名密码注册、登录、退出与会话恢复代码；公开评价及 Postgres 作者权限。真实后端已部署并通过注册、登录及跨账号权限验收，详见 [在线账号部署](docs/在线账号部署.md)。
- 响应式布局、手机导航、键盘跳转、空数据/异常链接/加载失败状态及图片回退。
- GitHub Actions 自动测试、构建并部署 GitHub Pages。

## 实现边界

图鉴数据使用静态 JSON；在线账号与新评价依赖 Supabase 后端，未配置时页面明确提示不可用，不会模拟注册成功。收藏和升级前的评价仍仅保存在当前浏览器，旧评价不会自动公开。原 PHP 账号不迁移，新服务需要单独注册。密码直接交给认证服务，业务代码不保存密码。本版注册不收集邮箱，暂不支持密码找回，请保存好账号密码。

数据来自原项目提交版 SQL：264 名选手、48 支战队、57 场赛事、29 名特工、2,141 条成绩记录。它们是课程示例数据，并非实时或经官方核验的战绩。没有导出用户、密码哈希、私人评论和日志。原 PHP 版本使用最大值榜单，本版改为按场次加权均值；页面明确展示计算口径，不声称官方排名。

## 本地运行

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
public/data/        脱敏静态 JSON
public/img/         继承的选手照片
scripts/            从 SQL 生成演示数据的工具
tests/              数据行为与异常输入测试
supabase/           账号昵称、公开评价表和 RLS 迁移
docs/               设计、验收记录与面试演示说明
```

数据导出使用 Python 3，不执行 SQL，也不访问数据库：

```bash
python scripts/export_data.py "原项目/Valorant数据库_期末作业.sql"
```

将原项目 `img/` 复制到 `public/img/` 即可复用照片。Vue 项目不需要运行 PHP 或 MySQL。修改后推送 `main`，Actions 会测试、构建并更新线上 Demo。

## 素材

VALORANT 品牌、选手照片等素材归各自权利人所有，本项目为非官方学习与作品展示。图标使用 Lucide，字体使用 Barlow Condensed / DM Sans，字体无法加载时使用系统字体。
