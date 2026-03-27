# iOS Secure Delivery Template (Clone to Private Repo)

这是一个“公开模板仓库”，核心目标是让其他用户：

1. 克隆这套脚本与 workflow
2. 新建自己的私有仓库
3. 通过桌面端把 IPA 上传到 App Store Connect

> 注意：实际运行仓库必须是 **Private**，桌面端会把最小运行集同步到这个私有仓库。

## Recommended User Path

普通用户建议这样使用：

1. 克隆这个公开模板仓库到本地
2. 创建一个你自己的 GitHub 私有仓库
3. 打开桌面端，在设置页填写私有仓库、分支和 token
4. 在桌面端里点击“初始化仓库”
5. 添加 Apple profile 并开始上传

CLI 现在主要保留给兼容、调试和高级用法。

## What it does

`scripts/deploy.sh` 会执行以下流程：

1. 本地创建临时 GitHub Release
2. 上传 `package.ipa`、`AuthKey.p8`、`issuer_id.txt`、`key_id.txt`
3. 触发 GitHub Actions `upload.yml`
4. 云端执行 `xcrun altool --upload-app`
5. 无论成功失败都删除临时 Release 与 tag

桌面端“初始化仓库”现在默认同步的是最小运行集，而不是整个公开模板仓库。默认会包含：

- `.github/workflows/upload.yml`
- `scripts/`
- `profiles/example.env`
- `.gitignore`
- 最小 README

## Desktop App

仓库现在包含一个桌面端封装工程：[`desktop/`](/Users/sk/Documents/appstore-dis-oss/desktop)

设计原则：

- 不改现有上传链路
- 继续复用 `scripts/deploy.sh` / `scripts/deploy.ps1` / `scripts/bootstrap.sh` / `scripts/bootstrap.ps1`
- 桌面端只负责图形界面、配置保存、脚本调用、输出展示和最近任务状态

桌面端当前包含：

- 设置页：配置 GitHub 仓库、分支、token、Apple profiles
- 上传页：选择 profile、选择 IPA、触发上传、查看脚本输出
- Tauri bridge：读写现有 `profiles/accounts.json` 和 `profiles/settings.env`

### Desktop Quick Start

推荐普通用户直接从桌面端开始：

1. 启动桌面端
2. 在设置页填写 GitHub repo、branch、token
3. 测试连接并初始化私有仓库
4. 添加 Apple profile
5. 在上传页选择 IPA 并开始上传

完整使用说明见 [user-guide.md](/Users/sk/Documents/appstore-dis-oss/docs/user-guide.md)。

### Desktop Dev

前端依赖：

```bash
cd desktop
npm install
npm run build
```

如果要真正运行 Tauri 桌面壳，还需要本机先安装 Rust toolchain，因为当前仓库只完成了 `desktop/src-tauri` 工程代码，未在这个环境里执行过 `tauri dev`：

- `rustc`
- `cargo`

安装完 Rust 后，可以继续尝试：

```bash
cd desktop
npm run tauri:dev
```

更多桌面端开发说明见 [desktop-dev.md](/Users/sk/Documents/appstore-dis-oss/docs/desktop-dev.md)。

## Project Structure

```text
.
├── .github/workflows/upload.yml
├── desktop/
├── docs/
├── profiles/
└── scripts/
```

- `desktop/`：Tauri + React 桌面端
- `scripts/`：底层 CLI 执行器
- `profiles/`：本地配置与账户数据
- `docs/`：开发和使用文档

## Recommended Flow

当前推荐顺序：

1. 优先使用桌面端完成仓库设置、profile 管理和上传
2. 需要排查问题或批量操作时，再直接使用 `scripts/` 下的 CLI
3. GitHub Actions 继续作为实际云端上传执行器

## Before You Start

你需要先准备好：

- 一个 GitHub 账号
- 一个你自己创建的 **private repo**
- 一个 GitHub Personal Access Token
- Apple 上传资料：`.ipa`、`AuthKey.p8`、`Issuer ID`、`Key ID`

GitHub token 建议至少包含这些权限：

- `repo`
- `workflow`

## CLI Guide (macOS / Linux)

### 1. 安装本地工具

确保本机可用：

- `git`
- `bash`
- `curl`
- `jq`

如果没有 `jq`，可用 Homebrew 安装：

```bash
brew install jq
```

### 2. 克隆公开仓库

```bash
git clone https://github.com/your-org/appstore-dis-oss.git
cd appstore-dis-oss
```

### 3. 在 GitHub 创建你自己的私有仓库

例如：`yourname/ios-upload-private`

### 4. 把本地仓库推到你的私有仓库

```bash
git remote remove origin
git remote add origin https://github.com/yourname/ios-upload-private.git
git branch -M main
git push -u origin main
```

如果 `git push` 时要求认证：

- 用户名：填你的 GitHub 用户名
- 密码：填你的 GitHub Personal Access Token，不是 GitHub 登录密码

### 5. 启用私有仓库的 Actions

GitHub 页面路径：

```text
Settings -> Actions
```

### 6. 在本地设置 GitHub token

```bash
export GH_TOKEN="your_github_token"
```

如果你想长期生效，可以写进 shell 配置文件，例如 `~/.zshrc`。

### 7. 初始化本地配置

```bash
chmod +x scripts/bootstrap.sh scripts/deploy.sh
./scripts/bootstrap.sh
```

也可以手动指定仓库和分支：

```bash
./scripts/bootstrap.sh --repo yourname/ios-upload-private --branch main
```

### 8. 首次上传

```bash
./scripts/deploy.sh
```

首次会提示你输入：

- 开发者邮箱
- `Issuer ID`
- `Key ID`
- `.p8` 文件路径
- `.ipa` 文件路径

### 9. 后续直接上传

```bash
./scripts/deploy.sh --profile dev_a /absolute/path/app.ipa
```

### 10. 只检查配置

```bash
./scripts/deploy.sh --profile dev_a /absolute/path/app.ipa --check
```

## CLI Guide (Windows PowerShell)

Windows 用户现在可以直接使用 PowerShell，不需要 WSL。

### 1. 安装本地工具

安装 [Git for Windows](https://git-scm.com/download/win)，并确保 `git` 可用。

### 2. 克隆这个公开仓库

```powershell
git clone https://github.com/your-org/appstore-dis-oss.git
cd appstore-dis-oss
```

### 3. 在 GitHub 新建你自己的空私有仓库

例如：`yourname/ios-upload-private`

### 4. 把本地仓库推送到你的私有仓库

```powershell
git remote remove origin
git remote add origin https://github.com/yourname/your-private-repo.git
git branch -M main
git push -u origin main
```

如果 `git push` 时要求认证：

- 用户名：填你的 GitHub 用户名
- 密码：填你的 GitHub Personal Access Token，不是 GitHub 登录密码

### 5. 到你的私有仓库页面启用 Actions

```text
Settings -> Actions
```

推送完成后，你的私有仓库里会自动包含：

- 代码
- PowerShell 脚本
- GitHub Actions 工作流 `.github/workflows/upload.yml`

### 6. 在 PowerShell 中设置 GitHub token

```powershell
$env:GH_TOKEN = "your_github_token"
```

### 7. 初始化私有仓库配置

```powershell
.\scripts\bootstrap.ps1
```

或手动指定：

```powershell
.\scripts\bootstrap.ps1 -Repo your-org/your-private-repo -Branch main
```

### 8. 首次上传

```powershell
.\scripts\deploy.ps1
```

首次会提示输入：

- 开发者邮箱
- `Issuer ID`
- `Key ID`
- `.p8` 文件路径
- `.ipa` 文件路径

### 9. 后续直接上传

```powershell
.\scripts\deploy.ps1 -Profile dev_a -IpaPath C:\absolute\path\app.ipa
```

### 10. 手动指定仓库或只检查配置

```powershell
.\scripts\deploy.ps1 -Profile dev_a -IpaPath C:\absolute\path\app.ipa -Repo your-org/your-private-repo -Branch main
.\scripts\deploy.ps1 -Profile dev_a -IpaPath C:\absolute\path\app.ipa -Check
```

## Common commands

```bash
./scripts/bootstrap.sh
./scripts/bootstrap.sh --repo your-org/your-private-repo --branch main
./scripts/deploy.sh
./scripts/deploy.sh --list-profiles
./scripts/deploy.sh --profile dev_a /absolute/path/app.ipa
./scripts/deploy.sh --profile dev_a /absolute/path/app.ipa --repo your-org/your-private-repo --branch main
./scripts/deploy.sh --profile dev_a /absolute/path/app.ipa --check
```

```powershell
.\scripts\bootstrap.ps1
.\scripts\bootstrap.ps1 -Repo your-org/your-private-repo -Branch main
.\scripts\deploy.ps1
.\scripts\deploy.ps1 -ListProfiles
.\scripts\deploy.ps1 -Profile dev_a -IpaPath C:\absolute\path\app.ipa
.\scripts\deploy.ps1 -Profile dev_a -IpaPath C:\absolute\path\app.ipa -Repo your-org/your-private-repo -Branch main
.\scripts\deploy.ps1 -Profile dev_a -IpaPath C:\absolute\path\app.ipa -Check
```

## Local files

- `profiles/accounts.json`：本地账户配置（已在 `.gitignore`）
- `profiles/settings.env`：默认仓库/分支（已在 `.gitignore`）
- `profiles/example.env`：配置示例
- `scripts/bootstrap.sh`：macOS / Linux 初始化脚本
- `scripts/bootstrap.ps1`：Windows PowerShell 初始化脚本
- `scripts/deploy.sh`：macOS / Linux 上传脚本
- `scripts/deploy.ps1`：Windows PowerShell 上传脚本

## Authentication

`scripts/deploy.sh` 优先使用 `GH_TOKEN`。若未设置，会尝试读取本机 git credential。

`scripts/deploy.ps1` 也优先使用 `GH_TOKEN`。若未设置，会尝试读取本机 git credential。

建议使用具备以下权限的 token：

- `repo`（私有仓库）
- `workflow`

## Security notes

- 此流程会短时间把上传材料放在临时 Release 资产中，所以仓库必须是 **private**。
- 临时 Release 与 tag 会在 workflow 最后清理（`if: always()`）。
- 不要提交任何真实凭据文件到 git。

## Requirements

本地：

- `bash`
- `curl`
- `jq`
- `git`

GitHub Actions runner：

- `macos-latest`（已在 workflow 中设置）

## WSL support (Windows)

支持在 Windows 的 WSL 环境中使用（推荐 `Ubuntu on WSL2`）。

1. 在 WSL 安装依赖：

```bash
sudo apt update
sudo apt install -y bash curl jq git
```

2. 按普通 Linux 步骤执行：

```bash
./scripts/bootstrap.sh
./scripts/deploy.sh
```

3. 路径输入支持两种格式（脚本会自动转换）：
- Linux 路径：`/mnt/c/Users/you/Desktop/app.ipa`
- Windows 路径：`C:\Users\you\Desktop\app.ipa`
