# 用户使用说明

## 推荐使用方式

普通用户优先使用桌面端。

桌面端提供：

- 仓库设置
- GitHub token 配置
- App Store Connect profile 管理
- IPA 上传入口
- 最近一次任务状态查看

## 开始前准备

你需要准备：

- GitHub 私有仓库
- GitHub Personal Access Token
- `.ipa`
- `AuthKey.p8`
- `Issuer ID`
- `Key ID`

## 桌面端流程

1. 打开桌面端，进入设置页。
2. 填写 GitHub 仓库、分支和 token。
3. 保存并测试连接。
4. 点击“初始化仓库”，把模板同步到你的私有仓库。
5. 添加一个或多个 Apple 上传 profile。
6. 进入上传页，选择 profile 和 IPA。
7. 发起上传并查看输出。

## CLI 兼容用法

如果需要手动执行，可以使用：

```bash
./scripts/bootstrap.sh
./scripts/deploy.sh
```

Windows PowerShell：

```powershell
.\scripts\bootstrap.ps1
.\scripts\deploy.ps1
```

## 本地文件

- `profiles/accounts.json`：本地 profile 列表
- `profiles/settings.env`：默认仓库和分支
- `profiles/example.env`：示例配置

这些本地状态文件默认不会提交到 git。
