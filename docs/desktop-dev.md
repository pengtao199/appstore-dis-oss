# 桌面端开发说明

## 当前定位

桌面端是这个项目的主入口。

它负责：

- 编辑仓库设置和本地 profile
- 调用 `scripts/` 下的脚本
- 展示上传输出和最近一次 workflow 状态

它不负责：

- 重写上传流程
- 直接替代 GitHub Actions

## 目录

- `desktop/src/`：React 界面
- `desktop/src-tauri/src/`：Tauri 命令层、配置读写、脚本调用、GitHub API

## 本地开发

前端构建：

```bash
cd desktop
npm install
npm run build
```

Tauri 开发运行：

```bash
cd desktop
npm run tauri:dev
```

## 依赖

桌面端前端：

- Node.js
- npm

桌面端壳：

- Rust toolchain
- cargo

## 当前实现边界

- 仓库设置和 profiles 仍保存在仓库根目录 `profiles/`
- 桌面端通过 Tauri 调用 `scripts/deploy.sh`、`scripts/deploy.ps1`
- “初始化仓库”会把当前模板仓库 `HEAD` 同步到目标私有仓库

## 开发注意事项

- 调整脚本目录时，要同步修改 `desktop/src-tauri/src/commands.rs`
- 调整本地配置结构时，要同步修改 `desktop/src-tauri/src/config.rs`
- 调整上传输出文本时，要同步检查 `desktop/src/lib/parseOutput.ts`
