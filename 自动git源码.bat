@echo off
echo "-------Begin-------"
git status
::set /p msg=请输入提交注释:
git add site/
git commit -m %date:~0,4%年%date:~5,2%月%date:~8,2%日
::git pull
GIT_SSH_COMMAND="ssh -i C:/Users/wmj02/.ssh/id_ed25519_regedit" git push
echo 推送成功：【魔法重生】
echo "--------End!--------"
pause