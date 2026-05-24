# A9 仓位计算器

一个 React + TypeScript 前端、Node.js + TypeScript 后端的合约仓位计算与仓位记录项目。

## 功能

- 根据账户资金、亏损比例、入场价格、止损价格、杠杆计算仓位。
- 默认开仓手续费和平仓手续费均为 `0.05%`，可手动修改。
- 输出风险金额、止损亏损比例、总亏损比例、仓位价值、仓位数量和所需保证金。
- 支持保存、查看、删除仓位记录。
- 仓位记录包含品种、方向、入场价、止损、止盈、杠杆、仓位价值、仓位数量、风险金额、备注和日期。
- 后端使用 MySQL 持久化仓位记录（默认 `root` / `root`，端口 `3306`，库名 `a9_calculator`）。
- 首次启动且数据库为空时，会自动将 `server/data/positions.json` 中的历史数据迁移到 MySQL。

## 启动

### 一键启动（推荐）

**macOS**：在 Finder 中双击项目根目录下的 `start-dev.command`，会自动安装缺失依赖并同时启动前后端。

或在终端执行：

```bash
chmod +x scripts/start-dev.sh
./scripts/start-dev.sh
```

按 `Ctrl+C` 可同时停止前后端。

### 分别启动

前端和后端是两个独立项目，各自维护自己的 `node_modules`。

后端（需本地已启动 MySQL）：

```bash
cd server
cp .env.example .env   # 首次运行：复制并按需修改配置
npm install
npm run dev
```

配置项在 `server/.env` 中维护（`PORT`、`DB_HOST`、`DB_PORT`、`DB_USER`、`DB_PASSWORD`、`DB_NAME`）。

前端：

```bash
cd client
npm install
npm run dev
```

前端默认地址：http://localhost:5173

后端默认地址：http://localhost:4000

## 计算公式

```text
风险金额 = 账户资金 * 亏损比例
价格止损亏损比例 = abs(入场价格 - 止损价格) / 入场价格
总亏损比例 = 价格止损亏损比例 + 开仓手续费率 + 平仓手续费率
仓位价值 = 风险金额 / 总亏损比例
仓位数量 = 仓位价值 / 入场价格
所需保证金 = 仓位价值 / 杠杆
```
