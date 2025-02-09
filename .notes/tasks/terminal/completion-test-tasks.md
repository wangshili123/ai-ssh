# 补全功能测试任务清单

## 1. 基础命令补全测试 ✅
- [x] 输入 `g` 应该提示 git, grep 等命令
- [x] 输入 `do` 应该提示 docker, dotnet 等命令
- [x] 输入 `py` 应该提示 python, python3 等命令

## 2. 文件路径补全测试 ✅
- [x] 输入 `cd` 后空格，应该显示当前目录下的文件和文件夹
- [x] 输入 `ls ./` 应该显示当前目录下的内容
- [x] 输入 `cat ../` 应该显示上级目录的内容

## 3. Git 命令补全测试
- [x] 基础命令补全 ✅
  - [x] 输入 `git ch` 应该提示 checkout, cherry-pick 等
  - [x] 输入 `git co` 应该提示 commit, config 等
  - [x] 输入 `git pu` 应该提示 push, pull 等

- [x] 参数补全 ✅
  - [x] `git checkout -` 应该提示 -b, --branch 等选项
  - [x] `git commit -` 应该提示 -m, -a 等选项
  - [x] `git push -` 应该提示 --force, --all 等选项

- [x] 分支名补全（暂不实现）✅
  - [x] `git checkout ` 后应该列出本地分支
  - [x] `git merge ` 后应该列出可合并的分支
  - [x] `git push origin ` 后应该列出本地分支

## 4. Docker 命令补全测试
- [x] 基础命令补全 ✅
  - [x] 输入 `docker co` 应该提示 container, compose 等
  - [x] 输入 `docker im` 应该提示 image, images 等
  - [x] 输入 `docker ne` 应该提示 network 等

- [x] 参数补全 ✅
  - [x] `docker run --` 应该提示 --name, --network 等选项
  - [x] `docker exec -` 应该提示 -i, -t 等选项
  - [x] `docker build -` 应该提示 -t, -f 等选项

- [x] 容器/镜像补全 ✅
  - [x] `docker start ` 后应该列出已停止的容器
  - [x] `docker logs ` 后应该列出运行中的容器
  - [x] `docker rmi ` 后应该列出本地镜像

## 5. 系统命令补全测试
- [x] ls 命令 ✅
  - [x] `ls -` 应该提示 -l, -a, -h 等选项
  - [x] `ls --` 应该提示 --all, --human-readable 等选项

- [x] chmod 命令 ✅
  - [x] `chmod -` 应该提示 -R, -r 等选项
  - [x] `chmod u+` 应该提示 r, w, x 等权限

- [x] kill 命令 ✅
  - [x] `kill -` 应该提示 -9, -15 等信号选项
  - [x] `kill ` 后应该列出进程 PID

## 6. 变量补全测试
- [x] 基础变量补全 ✅
  - [x] `echo $HO` 应该补全为 $HOME
  - [x] `echo $PA` 应该补全为 $PATH
  - [x] `echo $US` 应该补全为 $USER

- [x] 变量赋值补全 ✅
  - [x] `export NEW_VAR=$HO` 应该在赋值语句中补全变量
  - [x] `PATH=$PA` 应该补全为 PATH=$PATH

## 7. 历史命令补全测试
- [x] 基础历史补全 ✅
  - [x] 按上下箭头应该显示最近的命令
  - [x] `!g` 应该显示最近的以 g 开头的命令
  - [x] `!d` 应该显示最近的以 d 开头的命令

## 8. 特殊场景补全测试
- [x] 带空格的路径补全 ✅
  - [x] `cd "Program Fi` 应该正确补全带空格的路径
  - [x] `ls "My Doc` 应该正确补全带空格的文件名

- [x] 管道命令补全 ✅
  - [x] `ls | gr` 应该补全为 grep
  - [x] `ps aux | aw` 应该补全为 awk

- [x] 重定向补全 ✅
  - [x] `echo "hello" > te` 应该补全文件名
  - [x] `cat < co` 应该补全文件名

## 9. 上下文感知补全测试
- [ ] Git 上下文感知
  - [ ] 在 Git 仓库目录下输入 `git` 应该优先提示常用的 Git 命令
  - [ ] 在非 Git 仓库目录下输入 `git` 应该优先提示 `init` 和 `clone`
  - [ ] 在有未提交文件时输入 `git` 应该优先提示 `add` 和 `commit`
  - [ ] 在有未推送提交时输入 `git` 应该优先提示 `push`

- [ ] Docker 上下文感知
  - [ ] 在有 Dockerfile 的目录下输入 `docker` 应该优先提示 `build`
  - [ ] 在有 docker-compose.yml 的目录下输入 `docker` 应该优先提示 `compose`
  - [ ] 当有容器运行时输入 `docker` 应该优先提示容器相关命令

- [ ] 项目类型上下文感知
  - [ ] 在 Node.js 项目目录下输入命令应该优先提示 `npm` 和 `node` 相关命令
  - [ ] 在 Python 项目目录下输入命令应该优先提示 `python` 和 `pip` 相关命令
  - [ ] 在 .NET 项目目录下输入命令应该优先提示 `dotnet` 相关命令

- [ ] 文件类型上下文感知
  - [ ] 对 .js 文件使用 `node` 命令时应该提供相关参数补全
  - [ ] 对 .py 文件使用 `python` 命令时应该提供相关参数补全
  - [ ] 对 .sh 文件使用 `bash` 命令时应该提供相关参数补全

- [ ] 环境变量上下文感知
  - [ ] 在不同项目环境下应该提供相应的环境变量补全
  - [ ] 在 Docker 环境中应该提供容器相关的环境变量补全
  - [ ] 在虚拟环境中应该提供相应的环境变量补全

## 10. SSH 相关补全测试
- [ ] 主机补全
  - [ ] `ssh user@` 后应该显示已知主机
  - [ ] `scp file user@` 后应该显示已知主机

- [ ] 远程路径补全
  - [ ] `scp user@host:~/` 后应该显示远程主机的目录内容
  - [ ] `rsync user@host:~/` 后应该显示远程主机的目录内容

## 测试注意事项
1. 每完成一项测试，请在对应项目前的 `[ ]` 中打上 `x` 标记为已完成
2. 如果发现任何问题，请记录在下方的问题日志中：

## 问题日志
- 问题1：[描述问题]
  - 复现步骤：
  - 期望结果：
  - 实际结果：
  - 解决状态：

- 问题2：[描述问题]
  - 复现步骤：
  - 期望结果：
  - 实际结果：
  - 解决状态：

## 补全性能测试
- [ ] 基础命令补全响应时间 < 50ms
- [ ] 文件路径补全响应时间 < 100ms
- [ ] Git 分支补全响应时间 < 200ms
- [ ] Docker 容器列表补全响应时间 < 300ms
- [ ] 历史命令补全响应时间 < 50ms

## 测试环境记录
- 操作系统：
- Node.js 版本：
- 测试时间：
- 测试人员： 