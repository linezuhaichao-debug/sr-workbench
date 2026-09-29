# 插件源码改为多模块 TypeScript，用 tsdown 产出单个 bundle

原实现把浏览器半侧手写成一个 166 KB 的 `lib/client.js`，并在设计文档 §2.4 把它写成"物理约束（设计不得违反）"。**这条约束不成立**：`@deepseek-ai/dsh-client-modules` 只要求"启动前 `lib/client.js` 已被构建"、每包只服务 `exports["./client"]` 一个 bundle——官方客户端插件（如 `@deepseek-ai/dsh-client-ui-plan`）就是 TS + JSX 用 `tsdown` 打包成单个 `lib/client.js`。"运行期只有一个 bundle"与"源码多模块"并不冲突，手写单文件是"不装构建工具链"这条路线付的代价。

代价已经实际付出：16 条正则式自查、未声明标识符导致的渲染白屏只能靠事后沙箱执行（`check-sandbox.js`）发现、测试靠哨兵字符串切片（`src.slice(a, b)` + `new Function`）抽出代码来跑。

因此：**源码拆成多模块 TypeScript，用 `tsdown` 产出单个 `lib/client.js`；React 走平台基座模块表（external）。** 纯函数层成为真正的模块，测试直接 `import`。

## Consequences

- 开发循环多一个 watch 进程；交付前必须先 build 出 `lib/client.js`，否则插件激活时报缺 bundle。
- §6.1 的四条纪律（纯函数层零依赖、IO 层不写、指令层是唯一副作用出口、组件层只吃 props）**保留**，但改由目录结构与静态检查维持，而不是靠自律。
- §6.7 的哨兵切片测试与 `check-sandbox.js` **删除**；"测试要跑真实数据"这条纪律保留，实现换成直接 import。
