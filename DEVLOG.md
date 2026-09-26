# 开发日志（Dev Log）

本地汽修档案管理系统（Local Automotive Archive System）

---

## 第一阶段：项目骨架 + 核心闭环（已完成）

**日期**：2026-09-08

### 目标
搭建可运行的桌面应用骨架，跑通"客户 → 车辆 → 工单 → 图片 → 收款"核心数据闭环，数据整包可携带。

### 技术选型（相对 PRD 的关键调整）
| 维度 | PRD 原方案 | 实际落地 | 原因 |
|------|-----------|----------|------|
| 桌面框架 | Tauri 2.x（备选 Electron） | **Electron 31** | 环境未装 Rust 工具链 |
| 本地数据库 | SQLite（better-sqlite3） | **sql.js（WASM SQLite）** | 环境无 C++ 编译工具、GitHub 下载不稳定；且天然跨机可移植，契合"数据文件夹可拷走" |
| 结构 | 前后端分离 | main/preload/renderer 三段式 | electron-vite 默认结构 |

### 已完成
- **项目工程**：electron-vite 三段构建、tsconfig 分 `node`/`web`、Ant Design 中文主题、HashRouter 路由。
- **数据目录**：默认建在 `D:\database`，右上角可"切换数据目录"（自选并改名）；配置存于 `userData/config.json`。
- **数据库**：sql.js 兼容封装（暴露近似 better-sqlite3 的同步 `prepare/get/all/run/exec/transaction`），一次建库含 PRD 全部 13 张表 + 索引；每次变更写入 `archive.db`。
- **业务层（services）**：客户 / 车辆 / 工单 / 配件 / 库存 / 收款全量 CRUD；客户等级（普通/银/金/钻石）；车辆档案（时间轴 = 工单+图片）；工单完成自动联动（扣库存、写里程、写保养、标记完成）；仪表盘统计。
- **图片**：复制进 `images/`、用 Electron `nativeImage` 生成缩略图、`archiveimg://` 自定义协议展示。
- **备份**：一键打包数据目录为 zip（`归档系统备份_日期.zip`）。
- **页面**：仪表盘、客户、车辆、车辆档案、工单列表、新建/详情工单、配件库存、设置。

### 已验证
- 主/渲染 `tsc` 全绿；`npm run build` 成功；`npm run dev` 正常启动并生成 `D:\database\archive.db`。
- sql.js 代表性查询（命名/位置参数、多参数、联表、`last_insert_rowid`、事务）全部通过。

### 运行
```
npm run dev      # 开发运行
npm run build    # 构建到 out/
```

---

## 第二阶段：增强功能（已完成）

**日期**：2026-09-08

### 本次实现
1. **打印工单 / 生成 PDF（含客户签字栏）**
   - 新增 A4 工单/结算单打印模板 `printTemplate.ts`（HTML+CSS，底部"客户确认/签字/日期"栏）。
   - 主进程 `print.ts`：`printToPDF` 转 PDF 存 `attachments/`；`webContents.print` 弹系统打印对话框；`exportText` 导出任意文本。
   - 工单详情页新增 **打印**、**导出 PDF** 按钮。

2. **报表中心（`/reports`）**
   - 营业报表（按时间段，日汇总）、客户分析、车型统计、保养项目统计、库存报表。
   - 每类可 **导出 CSV**（BOM 中文兼容）与 **导出 Excel**（HTML `.xls`，Excel 直接打开，本地无云）。

3. **预约（`/appointments`）**：精简 CRUD，日期/时间/客户/车辆/服务类型/状态（待接待/已到店/已完成/已取消/已爽约）。

4. **供应商（`/suppliers`）**：CRUD（名称/联系人/电话/地址/结账期限/备注）。

5. **仪表盘** 增：即将到期的 **保险/年检** 提醒。

6. **数据层**：`services.ts` 增加预约、供应商、报表查询；复用已有 `appointments`/`suppliers` 表，无需改库。

### 技术要点
- 打印/PDF 依赖 Electron 内置 `printToPDF` / `webContents.print`，模板由渲染层生成 HTML 字符串，无第三方打印库。
- 导出零依赖：CSV（`\ufeff` BOM）+ HTML 伪 `.xls`（Excel 可开），规避网络/原生依赖风险。

### 已验证
- 主/渲染 `tsc` 全绿；`npm run build` 成功；`npm run dev` 正常启动。
- 报表/到期 SQL 在 sql.js 下全部执行正确（营收、客户、车型、保养、库存、到期提醒）。

### 运行
```
npm run dev
```

---
