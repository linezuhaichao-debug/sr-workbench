# 策划工作台作为可分发插件包，独立成仓库

插件现在住在 `outputs\_dsh-panel-test\dsh-client-ui-sr-workbench\`——不在任何仓库里，没有 lockfile、没有 `node_modules`、没有构建链，挂载靠 `~/.dsh/profiles/web/cordis.patch.yml` 里一行本地路径 `insert`。而 skill 侧唯一的仓库 `sr-team-skills` 是**纯 markdown 镜像**（安装 = 覆盖式复制目录，无安装脚本），本机 `D:\TimeMachine\GameDesignOS\` 全树搜不到任何插件位置。

因此：**插件独立成一个仓库**（不塞进 `sr-team-skills`，也不寄生在 `GameDesignOS\` 下）；**构建产物 `lib/` 入库**；安装 = clone + 在 workbench profile 的 `cordis.patch.yml` 里加一行 `insert`；本机开发用 junction 指向仓库，不留第二份手写副本。

理由：skill 与插件的分发模型不同——skill 靠"复制目录"，插件靠"启动前 `lib/client.js` 已构建"。混在一个仓库，那套覆盖式复制规则迟早会误伤 `node_modules\` / `lib\`。本机没有私有 registry（`npm config get registry` = 公网 npmjs，无 `.npmrc`），产物入库是让"clone 即安装"成立的唯一低成本办法。

## Consequences

- 仓库里要带构建产物，README 必须写明"改源码后先 build 再提交"，否则 clone 下来就是坏的。
- 本机的第二份副本（`outputs\_dsh-panel-test\` 下那份）要撤掉，改用 junction，避免出现第三种漂移。
- `CONTEXT.md` 与 `docs/adr/` 随包进仓库。
