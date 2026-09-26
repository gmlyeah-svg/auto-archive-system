# AutoArchive · 本地汽修档案管理系统

一个人（或店主本人）在自己电脑上用的、**数据整包可拷走**的汽修档案管理工具。
桌面单机应用，**无需服务器、无需联网、无需数据库服务**，双击即用。

## 特性

- **数据即文件夹**：所有业务数据 + 图片 + 附件装在一个"数据目录"里，拷贝即完整备份，整包可迁移。
- **开单为核心**：新建工单页内联快速建档（客户 / 车辆 / 员工），接待新客户全程不跳页。
- **工单驱动**：一次录入，自动更新车辆档案、库存、收款与经营统计。
- **车辆档案时间轴**：一辆车的全部保养/维修/改装记录 + 图片一屏回顾。
- **打印 / 导出 PDF**：A4 工单/结算单，含客户确认签字栏；带打印预览，导出自动打开。
- **报表 + 导出**：营业 / 客户 / 车型 / 保养 / 库存报表，可导出 CSV / Excel。
- **到期提醒**：保养 / 保险 / 年检，支持提前 N 天、颜色分级、可忽略。
- **库存**：入库 / 出库 / 盘点流水，低库存预警。
- **预约、供应商、技师（操作人）** 等。

## 技术栈

| 层 | 选型 |
|----|------|
| 桌面壳 | Electron 31（electron-vite 三段式：main / preload / renderer） |
| 前端 | React 18 + TypeScript + Vite + Ant Design |
| 本地数据库 | **sql.js（WASM SQLite）**，产出单文件 `archive.db` |
| 图片 | 文件系统 `images/` + `nativeImage` 缩略图 + 自定义协议展示 |
| 打包 | electron-builder（Windows 绿色版） |

> 采用 sql.js（WASM）而非原生 `better-sqlite3`：无需本地 C++ 编译工具、跨机可移植，契合"数据文件夹随身走"。

## 快速开始

```bash
npm install
npm run dev        # 开发运行
npm run build      # 构建到 out/
npm run pack       # 打包 Windows 绿色版到 release/win-unpacked/
```

打包产物 `release/win-unpacked/AutoArchive.exe` 可整个文件夹拷到任意 64 位 Windows 双击运行。

## 数据目录

默认 `D:\database`（无 D 盘时回退到"文档/本地汽修档案数据"），结构：

```
<数据目录>/
├── archive.db        # 全部业务数据
├── config.json
├── images/           # 按工单归档的图片与缩略图
└── attachments/      # 打印/导出的 PDF 等文档附件（按工单归档）
```

## 项目结构

```
src/
├── main/        # 主进程：数据目录、SQLite(sql.js)、IPC、图片、打印、备份
├── preload/     # 安全桥接（contextBridge）
├── renderer/    # 渲染层：React 页面与组件
└── shared/      # 共享类型
```

- `PRD-本地归档系统.md` —— 需求文档
- `DEVLOG.md` —— 开发日志
- `使用教程.html` / `使用教程.txt` —— 面向使用者的教程
