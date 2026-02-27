# iOS Secure Delivery Template (Clone to Private Repo)

这是一个“公开模板仓库”，核心目标是让其他用户：

1. 克隆这套脚本与 workflow
2. 新建自己的私有仓库
3. 直接上传 IPA 到 App Store Connect

> 注意：实际运行仓库必须是 **Private**。

## What it does

`deploy.sh` 会执行以下流程：

1. 本地创建临时 GitHub Release
2. 上传 `package.ipa`、`AuthKey.p8`、`issuer_id.txt`、`key_id.txt`
3. 触发 GitHub Actions `upload.yml`
4. 云端执行 `xcrun altool --upload-app`
5. 无论成功失败都删除临时 Release 与 tag

## Quick Start

1. Fork/clone 本模板。
2. 在 GitHub 上创建你自己的 **private repo**，并推送代码。
3. 启用 Actions（仓库 Settings -> Actions）。
4. 先执行一键初始化：

```bash
chmod +x bootstrap.sh deploy.sh
./bootstrap.sh
```

5. 再执行上传（首次推荐交互模式）：

```bash
./deploy.sh
```

首次会引导你输入：

- 开发者邮箱
- Issuer ID
- Key ID
- `.p8` 文件路径（可拖入终端）

然后拖入 IPA 路径并回车即可。

## Common commands

```bash
# 首次初始化（自动写入当前 origin 到 profiles/settings.env）
./bootstrap.sh

# 手动指定私有仓库
./bootstrap.sh --repo your-org/your-private-repo --branch main

# 交互式向导
./deploy.sh

# 列出 profile
./deploy.sh --list-profiles

# 指定 profile 上传
./deploy.sh --profile dev_a /absolute/path/app.ipa

# 指定仓库/分支
./deploy.sh --profile dev_a /absolute/path/app.ipa --repo your-org/your-private-repo --branch main

# 仅检查本地依赖与参数
./deploy.sh --profile dev_a /absolute/path/app.ipa --check
```

## Local files

- `profiles/accounts.json`：本地账户配置（已在 `.gitignore`）
- `profiles/settings.env`：默认仓库/分支（已在 `.gitignore`）
- `profiles/example.env`：配置示例
- `bootstrap.sh`：私有化后的首次初始化脚本

## Authentication

`deploy.sh` 优先使用 `GH_TOKEN`。若未设置，会尝试读取本机 git credential。

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
./bootstrap.sh
./deploy.sh
```

3. 路径输入支持两种格式（脚本会自动转换）：
- Linux 路径：`/mnt/c/Users/you/Desktop/app.ipa`
- Windows 路径：`C:\Users\you\Desktop\app.ipa`
