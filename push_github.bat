@echo off
:: 强制UTF-8编码，解决中文乱码
chcp 65001 >nul 2>&1
cls

echo ======================== Git 一键推送脚本 ========================
echo 仓库地址：git@github.com:regedit05-droid/new_dyl.git
echo 关联账号：regedit05-droid
echo ==================================================================
echo.

:: 1. 检查是否在Git仓库根目录（核心修复）
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误：当前目录不是Git仓库根目录！
    echo 请将此脚本放在包含 .git 文件夹的目录下执行
    pause
    exit /b 1
)

:: 2. 切换到main分支
echo 🔄 切换到main分支...
git checkout main >nul 2>&1
if errorlevel 1 (
    echo ⚠️  本地无main分支，自动创建并切换...
    git branch -M main
)

:: 3. 添加所有文件（修复中文解析错误）
echo 📥 添加所有文件到暂存区...
git add --all
if errorlevel 1 (
    echo ❌ 错误：添加文件失败！
    echo 原因：当前目录不是Git仓库，或文件被占用
    pause
    exit /b 1
)

:: 4. 提交代码（用英文备注避免编码问题）
set "commit_msg=Update code - %date% %time:~0,8%"
echo 📝 提交代码，备注：%commit_msg%
git commit -m "%commit_msg%"
if errorlevel 1 (
    echo ℹ️  提示：无文件修改，跳过提交
)

:: 5. 拉取远程代码
echo 📤 拉取远程main分支最新内容...
git pull origin main --allow-unrelated-histories >nul 2>&1
if errorlevel 1 (
    echo ⚠️  拉取失败（远程无更新），直接推送
)

:: 6. 推送代码（替换为你的SSH私钥文件名！）
echo 🚀 推送代码到GitHub...
set "GIT_SSH_COMMAND=ssh -i ~/.ssh/id_ed25519_regedit"
git push -u origin main

:: 7. 结果判断
if %errorlevel% equ 0 (
    echo.
    echo ✅ 推送成功！
    echo 仓库地址：https://github.com/regedit05-droid/new_dyl
) else (
    echo.
    echo ❌ 推送失败！检查项：
    echo 1. SSH私钥文件名是否正确
    echo 2. 是否在Git仓库根目录执行
    echo 3. regedit05-droid账号权限
)

echo.
echo ======================== 操作完成 ========================
pause