/**
 * 策划工作台 · 浏览器半侧（源码入口）
 *
 * ★ 本文件是 tsdown 的**打包入口**，产物是 `lib/client.js`——一个形如
 *   `window.__ModuleLoader__.load({ id, factory })` 的单 bundle。
 *   改本文件后必须 `npm run build`（或开着 `npm run watch`），否则 `lib/client.js` 是旧的。
 *
 * ★ 工单 02 是 expand 票：**不改任何产品行为**。这里只做了「能被打包」的最小改造——
 *   把原来的 `window.__ModuleLoader__.load({ … factory … })` 外壳换成 ESM 入口写法
 *   （顶部 `import * as React`、末尾 `export { apply, inject }`），
 *   外壳改由构建预设（`tsdown.config.ts`）重新套上；其余各行**一字未动**
 *   （所以正文仍保留原来嵌在 factory 里的两级缩进，归一化留给后续拆分票）。
 *
 * ★ 这里是**唯一源码**。`lib/client.js` 是构建产物，不要手改。
 */

import * as React from "react";

// ★ 工单 32 · 面板接线：`src/client.js` 不再保留内联副本，改为直接用 `src/pure/` 那份
//   （测试覆盖的就是它）。接线是**一次一个模块**做的，每步都过 `npm run build:safe`。
//   已接：path（toAbs）· topic（topicOf / isNoise / dateOf）· mdspec（parseMdSections / classifyHeading / mdSpecOf）· sessionpick（索引会话选择，0.2.0 兼容）· ledger（ledgerOf：设计台账派生 + 工单 17 的字段覆盖检查，工单 12 同批接线）
import { toAbs, featureRootOf } from "./pure/path.ts";
import { topicOf, isNoise, dateOf } from "./pure/topic.ts";
// mdspec：这一刀**带行为修复**——模块版 mdSpecOf 认 Windows 反斜杠（内联版只按 / 切）
import { parseMdSections, classifyHeading, mdSpecOf } from "./pure/mdspec.ts";
// 工单 12：功能详情的产物清单 / 三阶段 / 定稿有效性 / V 校验清单 —— 加载器走 `src/load/`（只吃 port），
//   桶分组与三阶段在 `src/pure/artifacts.ts`（测试覆盖的就是它，**这里不写副本**）。
import { loadFeatureDetail } from "./load/feature.ts";
// ★ 工单 32（接线）：设计台账派生（含工单 17 的**字段覆盖检查** `fieldCheck`）改用模块那一份。
//   原内联副本与模块版的差异**只有工单 17 加的那几行**（covSources / fieldCheck / notes），
//   于是面板上的 `fieldCheck` 一直是 undefined —— "悬空即报错"在面板里根本看不见。
import { ledgerOf } from "./pure/ledger.ts";
import {
	ARCHIVED_CACHED_NOTE,
	NO_ARCHIVE_INFO_NOTE,
	archivedFromSnapshot,
	configPathCandidates,
	containsPath,
	indexCacheKey,
	indexTitleFor,
	isArchivedId,
	mergeRows,
	normPath,
	pickIndexSession,
	pickWorkSession,
	rowsFromList,
	rowsFromStore,
	titleOf,
	workCacheDrop,
	workCacheGet,
	workCacheKey,
	workCachePut,
	workTitleFor
} from "./pure/sessionpick.ts";
// ★ 工单 15 · 就地改这条：失败 → **可读错误 + 下一步**（只有一份判定，面板不自己写一份 grep）
import { explainSendFailure, isSessionGone } from "./pure/sendfail.ts";
// ★ 工单 13/14 · 定稿工作面：解析（finalgdd）· 大纲树数据（finaltree）· 引用图与六类边（refgraph）
//   · 特殊块切分（split）· 三段式指令文本（instruction）。
//   这一批**全是 import，不再有内联副本** —— 面板跑的就是 `npm test` 覆盖的那份实现
//   （此前 `parseFinalGdd` / `buildRefGraph` / `impactOf` / `splitSpecial` / `checkFinals` 在下面各有一份副本，
//    其中 `buildRefGraph` 那份是**旧五类边**版本：第六类契约边在面板上根本看不见）。
import { checkFinals, parseFinalGdd, topBlockIndex } from "./pure/finalgdd.ts";
import { buildFinalTree } from "./pure/finaltree.ts";
import { EDGE_LEGEND, buildRefGraph, edgeLabelOf, impactOf } from "./pure/refgraph.ts";
import { splitSpecial } from "./pure/split.ts";
// 三段式（改哪儿 / 现状原文 / 影响范围）只有一份实现：面板上先给用户看，发出去的就是同一段
import { buildFixInstruction } from "./pure/instruction.ts";
// ★ 缺陷修复（2026-09-30「侧边栏要按 F5 才看得见」）：建完会话之后要补调**官方那条客户端入口**
//   （`workspaces.create` 把工作区行并进 store / `sessions.refresh` 重拉会话基线）。
//   判定（该调哪几刀、哪个做不到）在这个纯函数里，逐条用例在 `test/pure-storemerge.test.ts`；
//   组合根只负责按 steps 去调（`syncSidebarStores`）。**不要**在这里再造一套 store 写入。
import { planSidebarSync, sidebarSyncNeeded } from "./pure/storemerge.ts";
// ★ 工单 23 · 头脑风暴工作面：四入口的指令组装（`intake`）+ 分析产物归入口/两种新格式的解析（`analysisdoc`）
//   + 该工作面的加载器（`load/brainstorm`）。
//   ★ 这也是**收件箱内联副本的删除**：`INTAKE` 从这一票起就是模块那一份 —— 内联版与模块版逐行相同
//   （去缩进后 diff 只剩 `export` 一行），留着它只会让"新加四个入口"变成两份实现。
import { INTAKE } from "./pure/intake.ts";
import { loadBrainstorm } from "./load/brainstorm.ts";
// ★ 工单 24 · 文档生成工作面（「文档生成」那一格从"未实现"变成真的）：
//   · 两大部分 + 左树的数据 —— `drafttree.ts`（复用 `finalgdd.parseFinalGdd` + `finaltree.buildFinalTree`，
//     **不另写一份解析**，工单 24 第 5 条）；
//   · 配置支线走到哪 + 三个动作的三段式指令 —— `draftstep.ts`（口径引自 `gdd-pipeline.md` 与 spec.md:212）；
//   · 这一屏的加载器 —— `load/draft.ts`（读成稿 + 定稿 §6 + 读回回执，只吃 port）。
//   ★ 指令组装器与动作表**不在 client.js 里再抄一份**：`INTAKE` 暴露 `buildDraftInstruction` /
//     `DRAFT_ACTIONS`（`src/pure/intake.ts` 从 `draftstep.ts` re-export），与头脑风暴那条路同口径。
import { loadDraftWorkface } from "./load/draft.ts";
// ★ 工单 16 · 自动刷新与版本指纹 —— 判定全在 `src/pure/refresh.ts`（`test/pure-refresh.test.ts` 覆盖的就是它）：
//   帧怎么认（`parseFrame`）· 盯哪些目标（`watchPlan`）· 这一帧要重读哪些部件（`planReload` / `unionParts`）
//   · 自激防护（`acceptFrame`）· 指纹与"是不是最新"（`fingerprintOf` / `freshnessOf`）· 去抖合批（`shouldFlush`）
//   · stat 兜底核对（`stalePaths` / `mergeApplied`）。
//   组合根只做三件事：按 plan 去调官方通道、按 plan 去调加载器、把结果如实显示。
//   ★ 通道的真实形状（0.2.0 实测）：**目标定向 OS 监视、depth 0、任何写入者都发帧** —— 见该文件头。
import {
	FLUSH_QUIET_MS,
	RELOAD_PARTS,
	acceptFrame,
	fingerprintOf,
	freshnessOf,
	mergeApplied,
	parseFrame,
	planReload,
	shortDigest,
	shouldFlush,
	stalePaths,
	unionParts,
	watchPlan
} from "./pure/refresh.ts";

		const h = React.createElement;

		/**
		 * DSH 的静态 UI 库（`@deepseek-ai/dsh-client-ui-primitives`）在外壳播种的**冻结模块表**里，
		 * 可以直接 require —— 不需要改 package.json、不需要重启。
		 * ★ 但取不到时**不能让插件挂掉**：整块降级成 <pre> 纯文本渲染。
		 */
		let primitives = null;
		try { primitives = require("@deepseek-ai/dsh-client-ui-primitives"); }
		catch (e) { primitives = null; }

		/**
		 * 「收件箱 + 头脑风暴四入口」的纯逻辑（素材解析 / 主题派生 / 指令组装）。
		 *
		 * ★ 工单 23 起这里是 **import**，不再是内联副本：
		 *   —— 内联的那一份与 `src/pure/intake.ts` 逐行相同（去缩进后 diff 只剩 export 一行），
		 *      而工单 23 要往组装器里加四个新入口，留着副本必然长出第二份实现（本仓库反复踩过的坑）。
		 *   —— 早期"为什么内联"的理由（`/plugins/<pkg>/intake-parse.js` 404）针对的是**运行期再取一个模块**；
		 *      tsdown 打包后这些都只是同一 bundle 内的静态 import，与其它已接线的 pure 模块没有区别。
		 */

		/** 兼容旧命名：下面的组件与 handler 原本读 contract.*，统一指向内联实现 */
		const contract = INTAKE;
		const contractErr = "";

		/** 二进制 → base64（分块，避免 String.fromCharCode.apply 在大文件上爆栈） */
		function bytesToBase64(bytes) {
			const CH = 0x8000;
			let s = "";
			for (let i = 0; i < bytes.length; i += CH) {
				const chunk = bytes.subarray(i, i + CH);
				s += String.fromCharCode.apply(null, chunk);
			}
			return btoa(s);
		}

		/** 读文件字节（upload 通道要 base64 字符串；这一条只用于"大小未知的二进制"） */
		function readFileBytes(file, cap) {
			return new Promise((resolve, reject) => {
				const fr = new FileReader();
				fr.onerror = () => reject(new Error("读取文件失败"));
				fr.onload = () => {
					const buf = fr.result;
					if (cap && buf.byteLength > cap) { reject(new Error("文件超过 " + Math.round(cap / 1024) + " KB 上限")); return; }
					resolve(new Uint8Array(buf));
				};
				fr.readAsArrayBuffer(file);
			});
		}

		/** 读文件文本（浏览器能读就内联，省掉 agent 再读一次盘） */
		function readFileText(file, cap) {
			return new Promise((resolve, reject) => {
				const fr = new FileReader();
				fr.onerror = () => reject(new Error("读取文件失败"));
				fr.onload = () => resolve(String(fr.result || "").slice(0, cap || 200000));
				fr.readAsText(file);
			});
		}

		/** 面板 id：main keyed slot 与 sidebar.panellist 用同一个 id 关联 */
		const PANEL_ID = "sr-workbench";
		/** sr 工作区与配置表目录，相对会话 workspace 根 */
		const SR_WS = "GameDesignOS/workspace";
		const CONFIG_DIR = "planner/策划配置";

		// ════════════════════════════════════════════════════════════════
		// 一、文件名 → 功能主题 —— **工单 32 起改为 import `./pure/topic.ts`**
		//   （原内联的 PREFIXES / TAIL / topicOf / isNoise / dateOf 与模块那份逐字相同，
		//     删掉的是纯重复；改主题派生规则请改 `src/pure/topic.ts`，那里有测试）
		// ════════════════════════════════════════════════════════════════


		// ── 产物分类（设计 §3.2：**功能 = 目录**）──────────────────────────
		//   产物落在 `features\<主题>\` 的**子目录**里，所以分类就是"看子目录"——零猜测。
		//   `artifactBucket()` 是给 `gdd\` 内部用的：那一个子目录里混着成稿/定稿/审查/宣讲 HTML，
		//   得按文件名再分一次。
		//   ★ 这一层存在的意义：**别再往兼容层加东西**。
		//     新结构 `features\<主题>\`：按**子目录**分类，零猜测（目录本身就是答案）；
		//     旧结构（平铺的 proposals/analysis/decisions/evidence）：按**文件名前缀**分类 +
		//     `topicOf` 派生主题 —— 这是**兼容层，只减不增**。
		//   两种结构经这里产出**同一组桶**，下游（阶段条 / 产物页签 / 计数）不用分叉。
		//
		//   ⚠️ 2026-09-29 实测缺口：原实现只认 `concept-triage_ / feature-concept_ / sr-gdd-handoff_`
		//      三个前缀，于是 sr-analysis 的**体验报告 / 问题卡 / 复刻规格被静默丢弃**，
		//      `evidence\` 目录更是整个没扫 —— 竞品分析只剩"交接 JSON"能被看见。
		//   ★ `source\` —— **所有发给 agent 的源文件**（2026-09-29 你定义）：
		//      分析用的截图 / 录屏 / PV、旧文档原件、外部交付包（UE 交互交付物）…
		//      它是**输入**；`evidence\` 是分析**产出**的证据（抽帧 / 索引 / 时间戳账本 / readback）——
		//      两者是"喂进去的原料"与"做出来的证据"，不能混。
		//   ✗ `assets\` 不要：线框图跟着定稿走（`gdd\UI\`），没有独立的素材目录需求。
		const DIR_BUCKET = {
			analysis: "analysis", gdd: "gdd", decisions: "decisions",
			evidence: "evidence", source: "source", delivery: "delivery"
		};
		/** 桶 → byTopic 里的数组字段名（没有字段的进 others） */
		const BUCKET_FIELD = {
			final: "finals", review: "reviews", speech: "speeches",
			// ★ analysis 桶落到 `concept` 字段：**沿用旧字段名**，免得阶段条 / 产物页签 / PipelinePanel
			//   跟着改一遍。含义已从"3 种概念产物"扩为**全部头脑风暴产物**（6 种 analysis 产出）。
			analysis: "concept",
			evidence: "evidence", decisions: "decisions", source: "source",
			draft: "drafts", gdd: "drafts"
		};
		/** 旧结构：文件名前缀 → 桶。sr-* 各 skill 的产出全在这里 */
		const PREFIX_BUCKET = [
			["concept-triage_", "analysis"], ["feature-concept_", "analysis"],
			["experience-report_", "analysis"], ["issue-cards_", "analysis"],
			["replication-spec_", "analysis"], ["sr-gdd-handoff_", "analysis"],
			["evidence-index_", "evidence"], ["calibration_", "evidence"],
			["readback_", "evidence"], ["decision_", "decisions"],
			["smoke_", "others"], ["write_CS-", "others"]
		];
		/** 文件名 → 产物桶。**旧结构用**；新结构的 gdd\ 子目录里也要再细分，所以也会用到 */
		function artifactBucket(name) {
			const n = String(name || "");
			if (!n) return "others";
			if (/_定稿\.md$/i.test(n)) return "final";
			if (/_定稿_审查\.md$/i.test(n) || /_审查\.md$/i.test(n)) return "review";
			if (/_宣讲_.*\.html$/i.test(n)) return "speech";
			if (/_宣讲_.*\.content\.json$/i.test(n)) return "speechSrc";   // 派生件，不单独显示
			if (/_修订点\.md$/i.test(n)) return "gdd";
			for (const pk of PREFIX_BUCKET) if (n.indexOf(pk[0]) === 0) return pk[1];
			if (/\.md$/i.test(n)) return "draft";
			return "others";
		}

		/** 解析 md 顶部 frontmatter 的简单标量字段 */
		function parseFrontmatter(text) {
			const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text || "");
			if (!m) return null;
			const out = {};
			for (const line of m[1].split(/\r?\n/)) {
				const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
				if (kv) out[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
			}
			return out;
		}

		// ── 定稿有效性校验（V1）· 定稿结构解析（§6.2 大纲树 / §6.3）· 引用图（§6.4.1）· 特殊块切分 ──
		//   ★ 工单 13/14：这四块的**内联副本已全部删除**，改为 import 文件顶部那几个模块
		//     （`checkFinals` / `parseFinalGdd` / `buildRefGraph` / `impactOf` / `splitSpecial`）。
		//     本仓库的规矩：判据只有一份 —— 内联那份 `buildRefGraph` 停在"六类里的五类"，
		//     于是面板上的影响范围**永远看不到 `[契约]`**（正是本票要修的东西）。
		//     模块版另有 `refOf` / `fieldRowAt` / `edgeLabelOf` 三个给界面用的纯函数（见 import 处）。

		function errText(r, fallback) {
			if (!r) return fallback;
			const e = r.error;
			return e ? (e.message || e.code || fallback) : fallback;
		}

		// ════════════════════════════════════════════════════════════════
		// 二、数据加载
		// ════════════════════════════════════════════════════════════════

		/**
		 * 从 sr 本地配置读**绝对路径锚点**。
		 * ★ 不能硬编码相对路径让面板跟着"当前会话的工作区"走——你切到别的工作区的会话时就会读不到。
		 *   `read` 允许读工作区外路径（只有目录列举受限），所以这一步任何会话都能做。
		 * ★ `extraPaths`：**绝对**候选（组合根按"候选根"拼出来的，见 resolveIndexSession）。
		 *   浏览器半侧收不到插件 config（开发笔记坑 7），所以 `configPath` 在浏览器里是空的，
		 *   绝对路径只能由调用方补进来；末尾的相对候选留作最后兜底。
		 */
		async function loadSrPaths(read, sid, configPath, signal, extraPaths) {
			const cands = [];
			if (configPath) cands.push(configPath);
			for (const extra of (extraPaths || [])) if (extra) cands.push(extra);
			cands.push(".agents/skills/sr-askme/config.local.json");
			for (const p of cands) {
				const text = await readAllText(read, sid, p, signal, 200);
				if (!text) continue;
				try {
					const cfg = JSON.parse(text);
					if (cfg && cfg.sr_workspace) {
						return {
							srWs: String(cfg.sr_workspace).replace(/[\\/]+$/, ""),
							configRoot: String(cfg.config_root || "").replace(/[\\/]+$/, ""),
							// 从配置路径反推 skills 根（形状：<X>/.agents/skills || <X>/.agents/skills/sr-askme/config.local.json）
							skillsRoot: p.replace(/[\\/]sr-askme[\\/]config\.local\.json$/i, ""),
							configFile: p
						};
					}
				} catch (e) { /* 换下一个候选 */ }
			}
			return { srWs: "", configRoot: "", configFile: "(未找到 sr 配置)" };
		}

		/** 从各种目录列举返回值里取出文件名 */
		function fileNamesOf(v) {
			const e = (v && (v.entries || v.children || v.items)) || [];
			return e
				.filter((x) => {
					const k = x && (x.type || x.kind);
					return k === "file" || k === undefined;
				})
				.map((x) => x.name)
				.filter((n) => typeof n === "string" && n.length > 0);
		}

		/** 只取**子目录**名（fileNamesOf 只取文件，两者互补） */
		function dirNamesOf(v) {
			const e = (v && (v.entries || v.children || v.items)) || [];
			return e
				.filter((x) => x && (x.type === "directory" || x.kind === "directory"))
				.map((x) => x.name)
				.filter((n) => typeof n === "string" && n.length > 0);
		}

		/** 列子目录：与 listDir 同两条通道，但取目录 */
		async function listDirs(ctx, sid, absPath, signal, optional) {
			const ns = (ctx && ctx.remote) || {};
			if (ns.workspaceFiles && typeof ns.workspaceFiles.list === "function") {
				try {
					const r = await ns.workspaceFiles.list(sid, absPath, signal);
					if (r && r.ok === true) return dirNamesOf(r.value);
				} catch (e) { /* 落到通道② */ }
			}
			if (ns.workspace && typeof ns.workspace.list === "function") {
				try {
					const r = await ns.workspace.list(absPath, signal);
					if (r && r.ok === true) return dirNamesOf(r.value);
				} catch (e) { /* 继续 */ }
			}
			if (optional) return [];
			throw new Error("无法列举目录：" + absPath);
		}

		/**
		 * 列一层目录的**原始条目**（文件与子目录都要）。
		 * ★ 工单 12 新增：产物清单必须同时看到"文件"与"子目录"（`gdd\UI\`、`evidence\frames\`），
		 *   而 listDir / listDirs 各自只取一半。条目形状照 `WorkspacePort` 的 `ListResult`。
		 */
		async function listEntries(ctx, sid, absPath, signal) {
			const ns = (ctx && ctx.remote) || {};
			const norm = (v) => {
				const e = (v && (v.entries || v.children || v.items)) || [];
				return {
					entries: e.map((x) => {
						const k = x && (x.type || x.kind);
						return { name: x && x.name, type: k === "directory" ? "directory" : (k === undefined ? "unknown" : k) };
					}).filter((x) => typeof x.name === "string" && x.name.length > 0),
					truncated: !!(v && v.truncated)
				};
			};
			if (ns.workspaceFiles && typeof ns.workspaceFiles.list === "function") {
				try {
					const r = await ns.workspaceFiles.list(sid, absPath, signal);
					if (r && r.ok === true) return norm(r.value);
				} catch (e) { /* 落到通道② */ }
			}
			if (ns.workspace && typeof ns.workspace.list === "function") {
				try {
					const r = await ns.workspace.list(absPath, signal);
					if (r && r.ok === true) return norm(r.value);
				} catch (e) { /* 继续 */ }
			}
			// ★ 不吞错：载入层的 `optional` 列举会自己接住它（功能目录缺桶是常态）
			throw new Error("无法列举目录：" + absPath);
		}

		/**
		 * 组合根适配：把 ctx 的远程通道包成载入层要的 `WorkspacePort` **文件侧**形状。
		 * ★ 这是组合根该干的事（`src/client.js` 是唯一知道 ctx 的地方）；载入层因此能
		 *   与测试用同一个端口跑同一份实现（工单 32 的方向）。
		 *   指令侧五个方法**不包**：面板的指令出口仍是 `probe` / `remoteOpen`。
		 */
		function portOf(ctx, sid, read) {
			return {
				listDir: (absPath, signal) => listEntries(ctx, sid, absPath, signal),
				readText: async (path, range, signal) => {
					const r = await read(sid, path, range, signal);
					if (!r || r.ok !== true) {
						const e = r && r.error;
						throw new Error("读不到文件：" + ((e && (e.message || e.code)) || path));
					}
					return r.value;
				},
				/**
				 * ★ 工单 25 · `stat` —— 载入层用它拿**文件时间**。
				 *
				 * 为什么必须补这一条：`workspaceFiles.stat` 返回的 `version` 是
				 * `dev:ino:size:mtimeNs:ctimeNs`（实测，见 `src/pure/fsstamp.ts`），
				 * 第 4 段就是 mtime 纳秒 —— 定稿门靠它判「审查报告是不是比定稿旧」。
				 * 原先 `portOf` 只给了 `listDir` / `readText`，端口上没有 `stat`，
				 * 于是载入层那次调用被容错吃掉、时间恒为 0，面板只会一直说"看不到时间"
				 * （**实测踩出来的**：本票第一版就是这样，真机上定稿门永远不放行）。
				 *
				 * ★ 不进版本袋（`readWith`）：袋子是"屏幕上这份**内容**读的是哪一版"，
				 *   而 stat 不读内容；指纹那一侧照旧由 `statMany` 单独算。
				 */
				stat: async (absPath, signal) => {
					const ns = (ctx && ctx.remote) || {};
					const wf = ns.workspaceFiles;
					if (!wf || typeof wf.stat !== "function") throw new Error("remote.workspaceFiles.stat 不可用");
					const r = await wf.stat(sid, absPath, signal);
					if (!r || r.ok !== true) {
						const e = r && r.error;
						throw new Error("取不到文件版本：" + ((e && (e.message || e.code)) || absPath));
					}
					return r.value;
				}
			};
		}

		/**
		 * 目录列举：两条通道都试。
		 *   ① workspaceFiles.list(sessionId, path) —— 会话端口，**仅当该目录在会话工作区内**才可列
		 *   ② workspace.list(path) —— 工作区无关端口（若部署提供）
		 */
		async function listDir(ctx, sid, absPath, signal, optional) {
			const ns = (ctx && ctx.remote) || {};
			if (ns.workspaceFiles && typeof ns.workspaceFiles.list === "function") {
				try {
					const r = await ns.workspaceFiles.list(sid, absPath, signal);
					if (r && r.ok === true) return fileNamesOf(r.value);
				} catch (e) { /* 落到通道② */ }
			}
			if (ns.workspace && typeof ns.workspace.list === "function") {
				try {
					const r = await ns.workspace.list(absPath, signal);
					if (r && r.ok === true) return fileNamesOf(r.value);
				} catch (e) { /* 继续 */ }
			}
			if (optional) return [];
			throw new Error("无法列举目录：" + absPath);
		}

		async function readHead(read, sid, path, signal) {
			try {
				const r = await read(sid, path, { offset: 1, limit: 14 }, signal);
				if (!r || r.ok !== true) return null;
				return r.value.text;
			} catch (e) { return null; }
		}

		/** 分页读完整文本（read 按行分页，maxLines 默认 5000） */
		async function readAllText(read, sid, path, signal, capLines) {
			const cap = capLines || 20000;
			let offset = 1, out = [], guard = 0;
			while (guard++ < 40) {
				let r;
				try { r = await read(sid, path, { offset: offset, limit: 2000 }, signal); }
				catch (e) { return null; }
				if (!r || r.ok !== true) return out.length ? out.join("\n") : null;
				out.push(r.value.text);
				if (r.value.eof || r.value.lines === 0) break;
				offset += r.value.lines;
				if (offset > cap) break;
			}
			return out.join("\n");
		}

		/** 读契约 schema（决策记录以它为准绳；读不到就退化为"只列结构问题"） */
		async function loadDecisionSchema(read, sid, skillsRoot, signal) {
			const cands = [];
			if (skillsRoot) cands.push(skillsRoot + "/sr-askme/references/decision.schema.json");
			cands.push(".agents/skills/sr-askme/references/decision.schema.json");
			for (const p of cands) {
				const text = await readAllText(read, sid, p, signal, 2000);
				if (!text) continue;
				try { return JSON.parse(text); } catch (e) { /* 换下一个 */ }
			}
			return null;
		}

		/**
		 * 按 schema 校验一条决策记录（JSON Schema 的实用子集：
		 * required / enum / const / pattern / minItems / 数组元素 pattern / additionalProperties）
		 */
		function validateDecision(doc, schema) {
			const issues = [];
			const push = (field, value, rule) => issues.push({ field: field, value: value, rule: rule });
			if (!schema) return issues;
			const P = schema.properties || {};
			for (const k of (schema.required || [])) {
				if (doc[k] === undefined) push(k, "(缺失)", "必填字段缺失");
			}
			for (const k of Object.keys(P)) {
				const spec = P[k];
				const v = doc[k];
				if (v === undefined) continue;
				if (spec.const !== undefined && v !== spec.const) push(k, JSON.stringify(v), "必须为 " + JSON.stringify(spec.const));
				if (spec.enum && spec.enum.indexOf(v) < 0) push(k, JSON.stringify(v), "枚举外 · 合法值：" + spec.enum.join(" / "));
				if (spec.pattern && typeof v === "string" && !(new RegExp(spec.pattern)).test(v)) push(k, JSON.stringify(v), "不匹配 " + spec.pattern);
				if (spec.minItems !== undefined && Array.isArray(v) && v.length < spec.minItems) {
					push(k, v.length + " 条", "少于下限 minItems: " + spec.minItems);
				}
				const itemPat = spec.items && spec.items.pattern;
				if (itemPat && Array.isArray(v)) {
					for (const item of v) {
						if (typeof item === "string" && !(new RegExp(itemPat)).test(item)) {
							push(k, JSON.stringify(item), "元素不匹配 " + itemPat);
						}
					}
				}
			}
			if (schema.additionalProperties === false) {
				for (const k of Object.keys(doc)) {
					if (!P[k]) push(k, JSON.stringify(doc[k]).slice(0, 40), "schema 未声明的字段（additionalProperties: false）");
				}
			}
			return issues;
		}

		/** 读某功能的决策记录 + 校验 + 校准流水 */
		/**
		 * 决策台账（审计面）：决策记录 + 校准流水。
		 * ★ 收**功能根目录**而不是 srWs —— 功能 = 目录（§3.2），所以**不再需要 topicOf 过滤**：
		 *   目录已经天然隔离了。这是"新结构做扎实"的直接收益，少一层猜测、少一类错。
		 */
		async function loadLedger(ctx, read, sid, root, skillsRoot, signal) {
			const dir = root + "/decisions";
			const names = await listDir(ctx, sid, dir, signal, true);
			const mine = names.filter((n) => /^decision_.*\.json$/i.test(n));

			const schema = await loadDecisionSchema(read, sid, skillsRoot, signal);
			const records = [];
			for (const n of mine.slice().sort().reverse()) {
				const text = await readAllText(read, sid, dir + "/" + n, signal, 2000);
				let doc = null, parseErr = null;
				try { doc = JSON.parse(text); } catch (e) { parseErr = String((e && e.message) || e); }
				records.push({
					file: n,
					doc: doc,
					parseErr: parseErr,
					issues: doc ? validateDecision(doc, schema) : []
				});
			}

			// 校准流水（evidence\calibration_*.jsonl）
			const ev = await listDir(ctx, sid, root + "/evidence", signal, true);
			const calFiles = ev.filter((n) => /^calibration_.*\.jsonl$/i.test(n));
			const calibration = [];
			for (const n of calFiles) {
				const text = await readAllText(read, sid, root + "/evidence/" + n, signal, 2000);
				if (!text) continue;
				for (const line of text.split(/\r?\n/)) {
					const s = line.trim();
					if (!s) continue;
					try { calibration.push({ file: n, row: JSON.parse(s) }); } catch (e) { /* 跳过坏行 */ }
				}
			}

			// ★ 交接 JSON（analysis\sr-gdd-handoff_*.json）—— 头脑风暴结论的主要载体
			const an = await listDir(ctx, sid, root + "/analysis", signal, true);
			const handoffs = [];
			for (const n of an.filter((x) => /^sr-gdd-handoff_.*\.json$/i.test(x))) {
				const text = await readAllText(read, sid, root + "/analysis/" + n, signal, 2000);
				if (text) handoffs.push({ name: n, text: text });
			}

			// ★ 字段覆盖检查（工单 17）**不在这一层做**：它是**派生期**的事 ——
			//   `ledgerOf(L)` → `buildLedger(...)` 组装台账时顺手跑（源就在那条链上），
			//   结论在 `buildLedger(...).fieldCheck`（= `checkFieldCoverage` 的返回值本身）。
			//   ★ 这里再跑一遍就是第二份实现；工单 32 的方向正相反（面板跑被测试覆盖的那一份）。
			return {
				records: records, schema: schema, schemaOk: !!schema,
				calibration: calibration, calFiles: calFiles,
				handoffs: handoffs
			};
		}

		/** 从 loadLedger 的产物派生设计台账 —— 实现与理由见 `src/pure/ledger.ts` 的 `ledgerOf`（工单 32 接线） */

		/** 扫工作区 → 功能列表 */
		async function loadDashboard(ctx, read, sid, cwd, configPath, signal, extraPaths) {
			// ★ 先从 sr 配置拿**绝对路径**，不跟着当前会话的工作区走
			const P = await loadSrPaths(read, sid, configPath, signal, extraPaths);
			const srWs = P.srWs || SR_WS;
			const cfgDir = P.configRoot || CONFIG_DIR;
			if (!P.srWs) {
				const rel = await loadDashboardInner(ctx, read, sid, SR_WS, CONFIG_DIR, signal);
				rel.pathNote = "未读到 sr 配置（试过 " + P.configFile + "），已退回相对路径 " + SR_WS;
				rel.configFile = P.configFile;
				rel.cwd = cwd || "";
				return rel;
			}
			const out = await loadDashboardInner(ctx, read, sid, srWs, cfgDir, signal);
			out.srWs = srWs;
			out.configRoot = cfgDir;
			out.skillsRoot = P.skillsRoot || "";
			out.configFile = P.configFile;
			out.cwd = cwd || "";
			return out;
		}

		async function loadDashboardInner(ctx, read, sid, srWs, cfgDir, signal) {
			// ★★ 功能 = 目录（设计 §3.2）。**只认 `features\<主题>\`，代码里零兼容。**
			//    旧结构（平铺的 proposals/analysis/decisions/evidence）是"待清理的素材仓库"：
			//    素材已由 `migrate-to-features.js` 搬进新结构，面板**不再读它**，
			//    只统计还剩多少文件 —— 那个数字的唯一用途是提示你"可以删了"。
			const [featDirs, configNames] = await Promise.all([
				listDirs(ctx, sid, srWs + "/features", signal, true),
				listDir(ctx, sid, cfgDir, signal, true)
			]);

			const feats = [];
			for (const t of featDirs) {
				if (isNoise(t)) continue;
				const root = srWs + "/features/" + t;
				const f = {
					topic: t, root: root, ledgerFile: null,
					// concept 沿用旧字段名，含义 = **全部头脑风暴产物**（6 种 analysis 产出）
					concept: [], drafts: [], finals: [], reviews: [], speeches: [],
					decisions: [], evidence: [], source: [], evPacks: [], others: 0
				};
				// ① 七个标准子目录
				for (const sub in DIR_BUCKET) {
					const names = await listDir(ctx, sid, root + "/" + sub, signal, true);
					for (const n of names) {
						// gdd\ 里混着成稿/定稿/审查，要再细分；其余子目录直接按目录归桶
						const bucket = (sub === "gdd") ? artifactBucket(n) : DIR_BUCKET[sub];
						const field = BUCKET_FIELD[bucket];
						if (field) f[field].push(n); else f.others += 1;
					}
				}
				// ② 功能根下的设计台账（§7.2：台账在功能根，不在任何子目录）
				const rootFiles = await listDir(ctx, sid, root, signal, true);
				f.ledgerFile = rootFiles.filter((n) => /^设计台账.*\.md$/i.test(n))[0] || null;
				// ③ 证据包（`evidence\<名字>\` 这种子目录）
				for (const d of await listDirs(ctx, sid, root + "/evidence", signal, true)) {
					const inside = await listDir(ctx, sid, root + "/evidence/" + d, signal, true);
					f.evPacks.push({ dir: d, files: inside.length, sample: inside.slice(0, 6) });
				}
				feats.push(f);
			}

			// 旧结构残留统计 —— **只用于提示，不产出功能**
			let legacyLeft = 0;
			for (const d of ["proposals", "analysis", "decisions", "evidence", "inbox"]) {
				legacyLeft += (await listDir(ctx, sid, srWs + "/" + d, signal, true)).length;
			}

			// ★ 配置表只按主题**挂到已有功能上**，自己绝不创建功能
			//   （策划配置目录有 92 张表，它们不是功能，是功能的落地资源）
			const configByTopic = new Map();
			for (const n of configNames) {
				if (!/\.xlsx?m?$/i.test(n)) continue;
				const t = topicOf(n);
				if (isNoise(t)) continue;
				if (!configByTopic.has(t)) configByTopic.set(t, []);
				configByTopic.get(t).push(n);
			}

			const features = [];
			/** 定稿的绝对路径：**只有一种结构** —— `features\<主题>\gdd\` */
			const finalAbs = (f, name) => f.root + "/gdd/" + name;

			for (const f of feats) {
				f.finals.sort((a, b) => (dateOf(a) < dateOf(b) ? 1 : -1));
				f.reviews.sort().reverse();
				f.decisions.sort().reverse();
				const latest = f.finals[0] || null;   // finals 已按日期倒序
				// ★ 定稿以**日期**定最终版（口径不变）；但为了暴露"多份 active 并存"这个真实缺陷，
				//   这里把**每一份定稿的头部**都读一遍，交给 checkFinals 判（设计 §6.1 / §8 V1）。
				//   代价：每功能多 N-1 次 readHead；定稿通常 1–3 份，可接受。
				//   ★ 路径统一走 finalAbs —— 新结构 `features\<主题>\gdd\` 与旧结构 `proposals\` 都能读
				const finalHeads = await Promise.all(f.finals.map(async (name) => {
					const h = parseFrontmatter(await readHead(read, sid, finalAbs(f, name), signal));
					return { name: name, doc_type: h ? h.doc_type : null, status: h ? h.status : null };
				}));
				const finalCheck = checkFinals(finalHeads);
				const head = finalHeads.length ? finalHeads[0] : null;

				features.push({
					topic: f.topic,
					root: f.root,                    // ★ 功能的根目录 —— 一切读取都从它出发
					ledgerFile: f.ledgerFile,        // ★ 功能根下的设计台账（§7.2）
					docType: head ? head.doc_type : null,
					status: head ? head.status : null,
					finalCheck: finalCheck,          // ★ 定稿有效性（§6.1 / §8 V1）
					latestFinal: latest,
					latestDate: latest ? dateOf(latest) : "",
					finals: f.finals.length,
					reviews: f.reviews.length,
					speeches: f.speeches.length,
					decisions: f.decisions.length,
					evidence: f.evidence.length,
					evPacks: f.evPacks,
					sources: f.source.length,
					configs: configByTopic.get(f.topic) || [],
					others: f.others,
					historyCount: Math.max(0, f.finals.length - 1),
					openPath: latest ? finalAbs(f, latest) : null,
					// ★ A3 产物：留全文件名，按阶段分组
					files: {
						concept: f.concept.slice().sort(),
						draft: f.drafts.slice().sort(),
						final: f.finals.slice(),                    // 已按日期倒序
						review: f.reviews.slice().sort().reverse(),
						speech: f.speeches.slice().sort().reverse(),
						config: (configByTopic.get(f.topic) || []).slice().sort(),
						decision: f.decisions.slice().sort().reverse(),
						evidence: f.evidence.slice().sort(),
						source: f.source.slice().sort()
					},
					stageCounts: {
						concept: f.concept.length,
						draft: f.drafts.length,
						config: (configByTopic.get(f.topic) || []).length,
						final: f.finals.length,
						review: f.reviews.length,
						speech: f.speeches.length
					},
					stages: {
						concept: f.concept.length > 0,
						draft: f.drafts.length > 0 || f.finals.length > 0,
						config: (configByTopic.get(f.topic) || []).length > 0,
						final: f.finals.length > 0,
						review: f.reviews.length > 0,
						speech: f.speeches.length > 0
					}
				});
			}

			// ★ 不再过滤：**目录存在就是功能**（哪怕它暂时是空的）—— 这是"功能 = 目录"的直接推论
			features.sort((a, b) => (a.latestDate < b.latestDate ? 1 : -1));

			return {
				features: features,
				legacyLeft: legacyLeft,      // 旧结构还剩多少文件（唯一用途：提示你"可以删了"）
				counts: { features: features.length, configs: configNames.length },
				srWs: srWs,
				configRoot: cfgDir
			};
		}

		// ════════════════════════════════════════════════════════════════
		// 三、样式
		// ════════════════════════════════════════════════════════════════
		const C = {
			ink: "#1a1a1a", soft: "#c8c8c8", faint: "#e8e8e8", panel: "#fff", bg: "#fafafa",
			warn: "#b45309", bad: "#b91c1c", ok: "#15803d", muted: "#6b6b6b", link: "#2b6cb0"
		};
		function badge(text, tone) {
			const color = tone === "ok" ? C.ok : tone === "warn" ? C.warn : tone === "bad" ? C.bad : C.muted;
			return h("span", {
				key: "b:" + text,
				style: {
					display: "inline-block", fontFamily: "monospace", fontSize: "10px",
					border: "1px solid " + (tone ? color : C.soft), color: tone ? color : C.muted,
					borderRadius: "3px", padding: "0 5px", marginRight: "4px", whiteSpace: "nowrap"
				}
			}, text);
		}
		const STAGE_LABELS = [
			["concept", "概念"], ["draft", "成稿"], ["config", "配置"],
			["final", "定稿"], ["review", "审查"], ["speech", "宣讲"]
		];

		// ════════════════════════════════════════════════════════════════
		// 四、组件
		// ════════════════════════════════════════════════════════════════

		function Glyph({ size }) {
			return h("span", { style: { fontSize: (size === void 0 ? 16 : size) + "px", lineHeight: 1, fontWeight: 700 } }, "策");
		}

		/** 阶段进度：六段小徽章，完成的实心 */
		function StageBar(props) {
			const stages = props.stages || {};
			return h("div", { style: { display: "flex", gap: "3px", marginBottom: "7px", flexWrap: "wrap" } },
				STAGE_LABELS.map(([k, label]) => {
					const on = !!stages[k];
					return h("span", {
						key: k,
						style: {
							fontSize: "10px", fontFamily: "monospace", borderRadius: "3px", padding: "1px 5px",
							border: "1px solid " + (on ? C.ink : C.soft),
							background: on ? C.ink : "transparent",
							color: on ? "#fff" : "#aaa"
						}
					}, label);
				}));
		}

		/** 单个功能卡（作为组件渲染，不要当普通函数调用——它内部有 hooks） */
		function FeatureCard(props) {
			const f = props.feature;
			const onOpen = props.onOpen;
			const [hover, setHover] = React.useState(false);
			const clickable = !!f.openPath;
			const finalActive = f.status === "active";
			const waiting = props.attention === "pending";
			const stuck = !f.latestFinal
				? "卡在：尚未出定稿"
				: (finalActive ? "已定稿 · 可交程序" : "最终版状态：" + (f.status || "?"));

			// ★ 整张卡片**不可点**——只有底部的文件链接可点（对齐 DSH 会话里的文件链接习惯）
			return h("div", {
				onMouseEnter: () => setHover(true),
				onMouseLeave: () => setHover(false),
				style: {
					border: "1px solid " + (waiting ? C.warn : C.faint),
					borderLeft: "3px solid " + (waiting ? C.warn : (finalActive ? C.ok : C.soft)),
					borderRadius: "4px", padding: "10px 12px",
					background: C.panel,
					minWidth: "250px", flex: "1 1 250px"
				}
			}, [
				// ★ 待拍板横幅：放在最上面，一眼能看见，且可直接点进去回答
				waiting ? h("div", {
					key: "attn",
					onClick: (e) => { e.stopPropagation(); props.onAttention(f); },
					title: "点这里去回答",
					style: {
						margin: "-10px -12px 9px", padding: "7px 12px",
						background: C.warn, color: "#fff", fontSize: "12px", fontWeight: 600,
						cursor: "pointer", borderRadius: "3px 3px 0 0",
						display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px"
					}
				}, [
					h("span", { key: "t" }, "⚠ 等你拍板"),
					h("span", { key: "g", style: { fontWeight: 400, fontSize: "11px", opacity: 0.9 } }, "去回答 ›")
				]) : null,
				h("div", { key: "n", style: { display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px", flexWrap: "wrap" } }, [
					h("b", { key: "t", style: { fontSize: "13px" } }, f.topic),
					f.docType
						? badge(f.docType + " / " + (f.status || "?"), finalActive ? "ok" : null)
						: badge("无定稿", "warn")
				]),
				h(StageBar, { key: "s", stages: f.stages }),
				h("div", { key: "m", style: { fontSize: "11px", color: finalActive ? C.ok : C.muted, marginBottom: "5px" } }, stuck),
				h("div", { key: "c", style: { fontSize: "11px", color: C.muted } },
					"定稿 " + f.finals + " · 审查 " + f.reviews + " · 宣讲 " + f.speeches +
					" · 配置表 " + f.configs.length + " · 决策 " + f.decisions),
				// 最终版明确标出（按日期，最新即最终版）
				f.latestFinal ? h("div", {
					key: "v",
					style: {
						fontSize: "11px", color: C.muted, marginTop: "4px",
						borderTop: "1px solid " + C.faint, paddingTop: "4px"
					}
				}, [
					h("span", { key: "a", style: { fontFamily: "monospace" } },
						"最终版 " + f.latestDate.slice(0, 4) + "-" + f.latestDate.slice(4, 6) + "-" + f.latestDate.slice(6, 8)),
					f.historyCount > 0
						? h("span", { key: "b", style: { color: "#999" } }, " · 另有 " + f.historyCount + " 个历史版本")
						: null
				]) : null,
				// 底部：**可点的文件超链接**（对齐 DSH 会话里的文件链接）+「详情 ›」
				h("div", {
					key: "o",
					style: {
						display: "flex", justifyContent: "space-between", alignItems: "center",
						marginTop: "6px", gap: "8px", borderTop: "1px solid " + C.faint, paddingTop: "5px"
					}
				}, [
					clickable ? h("button", {
						key: "lnk", type: "button",
						onClick: () => onOpen(f),
						title: "点击打开：" + f.openPath,
						style: {
							font: "inherit", fontSize: "11px", fontFamily: "monospace",
							padding: 0, border: "none", background: "none",
							color: hover ? C.link : "#3b6ea5",
							cursor: "pointer",
							textDecoration: hover ? "underline" : "none",
							overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "175px"
						}
					}, "📄 " + f.latestFinal) : h("span", { key: "none", style: { fontSize: "11px", color: "#bbb" } }, "（无可打开文件）"),
					h("button", {
						key: "d", type: "button",
						onClick: () => props.onDetail(f),
						style: {
							font: "inherit", fontSize: "10px", padding: "1px 7px",
							border: "1px solid " + C.soft, background: "#fff",
							borderRadius: "3px", cursor: "pointer", color: C.ink, whiteSpace: "nowrap"
						}
					}, "详情 ›")
				])
			]);
		}

		/** 打开结果提示（成功/失败/诊断都显示在面板上，不藏 console） */
		function NoticeBar(props) {
			const n = props.notice;
			if (!n) return null;
			const isErr = n.kind === "err";
			return h("div", {
				style: {
					border: "1px solid " + (isErr ? C.bad : C.faint),
					borderLeft: "3px solid " + (isErr ? C.bad : n.kind === "ok" ? C.ok : C.soft),
					background: "#fff", borderRadius: "4px", padding: "8px 11px",
					fontSize: "12px", marginBottom: "12px",
					color: isErr ? C.bad : n.kind === "ok" ? C.ok : C.muted
				}
			}, [
				h("div", { key: "t", style: { wordBreak: "break-all", lineHeight: 1.7 } }, n.text),
				n.diag ? h("pre", {
					key: "d",
					style: {
						marginTop: "7px", marginBottom: 0, padding: "8px", fontSize: "11px",
						whiteSpace: "pre-wrap", background: C.bg, border: "1px solid " + C.faint,
						borderRadius: "3px", color: C.ink, fontFamily: "monospace", lineHeight: 1.65,
						userSelect: "text"
					}
				}, n.diag) : null
			]);
		}

		function RiskBar(d) {
			const noFinal = d.features.filter((f) => !f.latestFinal).length;
			const multi = d.features.filter((f) => f.historyCount > 0).length;
			const waiting = (d.features || []).filter((f) => d.attentionOf && d.attentionOf(f.topic) === "pending");
			// ★ V1 定稿有效性（设计 §6.1 / §8）：多份 active 并存 / 旧定稿未标 archived / 没有 active
			const hasIssue = (f, code) => !!(f.finalCheck && f.finalCheck.issues.some((i) => i.code === code));
			const dupActive = (d.features || []).filter((f) => f.finalCheck && f.finalCheck.actives.length > 1);
			const noActive = (d.features || []).filter((f) => hasIssue(f, "V1b"));
			const unarchived = (d.features || []).filter((f) => hasIssue(f, "V1c"));
			const items = [];
			if (dupActive.length) items.push("⛔ " + dupActive.length + " 个功能有多份 active 定稿：" +
				dupActive.map((f) => f.topic + "（" + f.finalCheck.actives.length + " 份）").join("、"));
			if (waiting.length) items.push("⚠ " + waiting.length + " 个功能在等你拍板：" + waiting.map((f) => f.topic).join("、"));
			if (noActive.length) items.push(noActive.length + " 个功能没有 active 定稿");
			if (unarchived.length) items.push(unarchived.length + " 个功能的旧定稿未标 archived");
			if (noFinal) items.push("尚未出定稿 " + noFinal + " 个");
			if (multi) items.push("有历史版本的 " + multi + " 个（以最新为最终版）");
			if (!items.length) items.push("未发现待办风险");
			const bad = dupActive.length > 0;
			const warn = bad || noFinal > 0 || waiting.length > 0;
			return h("div", {
				style: {
					border: "1px solid " + (bad ? C.bad : waiting.length ? C.warn : C.faint),
					borderLeft: "3px solid " + (bad ? C.bad : warn ? C.warn : C.ok),
					background: bad ? "#fef2f2" : waiting.length ? "#fff7ed" : "#fffdf7",
					borderRadius: "4px", padding: "9px 12px", fontSize: "12px",
					marginBottom: "12px", fontWeight: (bad || waiting.length) ? 600 : 400
				}
			}, items.join(" · "));
		}

		/** 错误边界：任何渲染异常都显示在面板里，而不是白屏 */
		class PanelErrorBoundary extends React.Component {
			constructor(props) { super(props); this.state = { err: null }; }
			static getDerivedStateFromError(err) { return { err: err }; }
			componentDidCatch(err, info) { console.error("[sr-workbench] 渲染失败", err, info); }
			render() {
				const e = this.state.err;
				if (!e) return this.props.children;
				return h("div", {
					style: {
						padding: "20px 24px", fontFamily: "system-ui, monospace", color: C.bad,
						height: "100%", overflow: "auto", boxSizing: "border-box", background: C.bg
					}
				}, [
					h("h1", { key: "t", style: { fontSize: "16px", margin: "0 0 10px", color: C.ink } }, "策划工作台 · 渲染失败"),
					h("div", { key: "m", style: { fontSize: "13px", marginBottom: "10px" } }, String((e && e.message) || e)),
					h("pre", {
						key: "s",
						style: {
							fontSize: "11px", whiteSpace: "pre-wrap", background: "#fff",
							border: "1px solid " + C.faint, borderRadius: "4px", padding: "10px", color: C.muted
						}
					}, String((e && e.stack) || "").slice(0, 3000))
				]);
			}
		}

		// ── 一级导航 ──────────────────────────────────────────────────
		const NAV = [
			{ id: "dashboard", label: "功能看板" },
			{ id: "assets", label: "设计资产" },
			{ id: "config", label: "配置表与多语言", soon: true },
			{ id: "knowledge", label: "知识库", soon: true }
		];
		/**
		 * 功能内部的**工作面**（设计 §4：三阶段）—— 与「资料页签」分两组显示。
		 *
		 * ★ 为什么不是"详情页的第七个页签"：规格说得很清楚 —— 点进一个功能，先按生命周期的三个阶段走
		 *   （头脑风暴 → 文档生成 → 定稿修订），台账 / 产物 / 界面图是**旁挂的资料页**（spec.md:30）。
		 *   把工作面混进同一排页签，等于把"阶段"与"资料"拉平，用户就看不出"现在该走哪一步"了。
		 * ★ 头脑风暴是**第一个工作面**（工单 23）；定稿修订则是工单 13/14 已经做出来的那一屏
		 *   （原来叫「定稿」页签，现在归进工作面组、名字改成「定稿修订」—— 语义没变，页签 label 里仍含「定稿」两字）。
		 * ★ 文档生成在**工单 24 做成了真的**（不再是「· 未实现」）：读成稿、按两大部分定位、看到配置支线走到哪。
		 */
		const DETAIL_STAGES = [
			{ id: "brainstorm", label: "头脑风暴" },      // ★ 工单 23：功能里的第一个工作面
			{ id: "draft", label: "文档生成" },           // ★ 工单 24：成稿 + 两大部分 + 配置支线走到哪
			{ id: "final", label: "定稿修订" }            // ★ 工单 13/14（大纲 + 正文 + 定位卡）
		];
		/** 进功能时落在哪一屏 = **第一个工作面**（工单 23：功能内部先走阶段，再看资料） */
		const ENTRY_TAB = "brainstorm";
		/** 功能详情的**资料页签**（旁挂：过程 / 产物 / 界面图，不是阶段） */
		const DETAIL_TABS = [
			{ id: "design", label: "设计台账" },
			{ id: "ledger", label: "决策台账" },
			{ id: "pipeline", label: "流水线" },
			{ id: "artifacts", label: "产物" },
			{ id: "ui", label: "界面图" }
		];

		function TabBar(props) {
			return h("div", {
				style: {
					display: "flex", gap: "4px", marginBottom: "14px",
					borderBottom: "1px solid " + C.faint, paddingBottom: "8px", flexWrap: "wrap"
				}
			}, props.items.map((it) => {
				const on = props.view === it.id;
				const soon = !!it.soon;
				return h("button", {
					key: it.id, type: "button",
					disabled: soon,
					onClick: soon ? void 0 : () => props.onPick(it.id),
					style: {
						font: "inherit", fontSize: "12px", padding: "4px 10px",
						border: "1px solid " + (on ? C.ink : C.faint),
						background: on ? C.ink : "transparent",
						color: soon ? "#c0c0c0" : (on ? "#fff" : C.ink),
						borderRadius: "4px", cursor: soon ? "default" : "pointer"
					}
				}, it.label + (soon ? " · 未实现" : ""));
			}));
		}

		// ── A4 决策台账 ───────────────────────────────────────────────
		const TH = { border: "1px solid " + C.faint, background: "#f7f7f7", padding: "5px 7px", textAlign: "left", fontSize: "11px", fontWeight: 600 };
		const TD = { border: "1px solid " + C.faint, padding: "5px 7px", verticalAlign: "top", fontSize: "11px" };

		function IssueTable(issues) {
			return h("table", { style: { width: "100%", borderCollapse: "collapse", marginTop: "6px" } }, [
				h("thead", { key: "h" }, h("tr", null, [
					h("th", { key: "f", style: Object.assign({}, TH, { width: "22%" }) }, "字段"),
					h("th", { key: "v", style: Object.assign({}, TH, { width: "26%" }) }, "实际值"),
					h("th", { key: "r", style: TH }, "违反")
				])),
				h("tbody", { key: "b" }, issues.map((it, i) => h("tr", { key: i }, [
					h("td", { key: "f", style: Object.assign({}, TD, { fontFamily: "monospace" }) }, it.field),
					h("td", { key: "v", style: Object.assign({}, TD, { fontFamily: "monospace" }) }, String(it.value)),
					h("td", { key: "r", style: Object.assign({}, TD, { color: C.bad }) }, it.rule)
				])))
			]);
		}

		/** 从可能是字符串/包装对象的返回值里取出 id 文本 */
		function idText(v) {
			if (typeof v === "string") return v;
			if (v && typeof v === "object") {
				const inner = v.value || v.sessionId || v.id;
				if (typeof inner === "string") return inner;
			}
			return "";
		}

		/** 小标题 + 内容块 */
		function blk(title, content) {
			return h("div", { key: title, style: { marginTop: "12px" } }, [
				h("div", { key: "t", style: { fontSize: "11px", fontWeight: 600, marginBottom: "5px", color: C.ink } }, title),
				h("div", { key: "c", style: { fontSize: "12px", lineHeight: 1.75 } }, content)
			]);
		}

		/**
		 * 把 decision_result 渲染成人话 —— **不显示原文 JSON**。
		 * 只显示：结论 / 条件完成 / 剩余待办 / 涉及文件 / 下一步 / 定稿门之后的修改。
		 */
		function ResultView(props) {
			const r = props.result;
			const doc = props.doc;
			if (!r || typeof r !== "object") return null;
			const out = [];

			// ① 结论（chosen 是选项 ID，回查选项正文）
			if (r.chosen) {
				const opts = (doc && Array.isArray(doc.options)) ? doc.options : [];
				const hit = opts.filter((o) => o && o.option_id === r.chosen)[0];
				out.push(blk("结论", [
					h("div", { key: "id", style: { fontFamily: "monospace", color: C.ok, marginBottom: "3px" } }, String(r.chosen)),
					hit && hit.action ? h("div", { key: "a" }, String(hit.action)) : null,
					hit && hit.expected_benefit ? h("div", { key: "b", style: { color: C.muted, fontSize: "11px", marginTop: "3px" } }, "预期收益：" + hit.expected_benefit) : null,
					hit && hit.main_risk ? h("div", { key: "c", style: { color: C.warn, fontSize: "11px" } }, "主要风险：" + hit.main_risk) : null
				]));
			}

			// ② 条件完成情况
			const cond = Array.isArray(r.conditions_completed) ? r.conditions_completed : [];
			if (cond.length) {
				const done = cond.filter((c) => c && c.done).length;
				out.push(blk("条件（已完成 " + done + " / " + cond.length + "）", cond.map((c, i) =>
					h("div", { key: i, style: { marginBottom: "6px" } }, [
						h("span", { key: "m", style: { color: c && c.done ? C.ok : C.warn, fontFamily: "monospace" } }, (c && c.done) ? "✓ " : "○ "),
						h("span", { key: "i" }, String((c && c.item) || "")),
						c && c.note ? h("div", { key: "n", style: { marginLeft: "17px", color: C.muted, fontSize: "11px" } }, String(c.note)) : null
					]))));
			}

			// ③ 剩余待办
			const rem = Array.isArray(r.remaining_items) ? r.remaining_items : [];
			if (rem.length) {
				out.push(blk("剩余待办（" + rem.length + "）", rem.map((x, i) =>
					h("div", { key: i, style: { marginBottom: "3px" } }, "· " + String((x && x.item) || x)))));
			}

			// ④ 涉及文件
			if (r.files && typeof r.files === "object" && !Array.isArray(r.files)) {
				const LBL = { final_gdd: "定稿", archived_draft: "已归档成稿", final_review: "审查报告", config_changed: "改动配置表" };
				out.push(blk("涉及文件", Object.keys(r.files).map((k) =>
					h("div", { key: k, style: { marginBottom: "3px" } }, [
						h("span", { key: "k", style: { color: C.muted } }, (LBL[k] || k) + "："),
						h("span", { key: "v", style: { fontFamily: "monospace" } }, Array.isArray(r.files[k]) ? r.files[k].join(" · ") : String(r.files[k]))
					]))));
			}

			// ⑤ 下一步
			if (r.next_step) out.push(blk("下一步", h("div", null, String(r.next_step))));

			// ⑥ 定稿门之后的修改
			const fixes = Array.isArray(r.post_gate_fixes) ? r.post_gate_fixes : [];
			if (fixes.length) {
				out.push(blk("定稿门之后的修改（" + fixes.length + " 条）", fixes.map((x, i) =>
					h("div", {
						key: i,
						style: { marginBottom: "7px", paddingLeft: "8px", borderLeft: "2px solid " + C.faint }
					}, [
						h("div", { key: "d", style: { fontFamily: "monospace", fontSize: "11px", color: C.muted } }, String((x && x.date) || "")),
						h("div", { key: "c" }, String((x && x.change) || "")),
						x && Array.isArray(x.sections) && x.sections.length
							? h("div", { key: "s", style: { marginTop: "3px" } }, x.sections.map((s, j) => h("span", {
								key: j,
								style: { fontSize: "10px", fontFamily: "monospace", border: "1px solid " + C.faint, borderRadius: "3px", padding: "0 4px", marginRight: "3px", color: C.muted }
							}, String(s))))
							: null
					]))));
			}

			if (!out.length) return h("div", { style: { fontSize: "12px", color: C.muted } }, "（这条记录的 decision_result 没有可读结论）");
			return h("div", null, out);
		}

		/**
		 * 拼绝对路径 —— **工单 32 起改为 import `./pure/path.ts` 的 `toAbs`**（不再内联副本）。
		 * 原内联实现与模块那份逐字相同（只差缩进），所以这里删掉的是纯重复。
		 * 保留这条注释是因为它记着两件容易踩的事：
		 *   ★ rel 可能**已经是绝对路径**（openPath 现在存的是 srWs 拼出来的绝对路径），
		 *     无条件前缀 cwd 会拼成 `D:\TimeMachine/D:\TimeMachine\...`。
		 *   ★ Windows 绝对路径同时把 `/` 归一成 `\`，避免混合分隔符。
		 */

		/**
		 * 设计台账（设计 §7）—— 一份"过程叙述"，不是数据列表。
		 *
		 * 渲染纪律（§7.4，可读性第一）：
		 *   ✅ 只有：阶段 → 日期 → 一句话结论
		 *   ❌ 不加徽章 / 不加记录 ID / 不加来源链接 / 不加搜索高亮
		 *   唯一允许的交互：点日期折叠当天条目（阅读辅助，不是信息掺杂）
		 * 来源校验区默认收起，并明确标注"这是校验信息，不是台账内容"。
		 */
		function DesignLedger(props) {
			const led = props.ledger;
			const [folded, setFolded] = React.useState({});
			const [showSrc, setShowSrc] = React.useState(false);
			if (!led) return h("p", { style: { color: C.muted, fontSize: "12px" } }, "正在读设计台账…");
			if (led.error) {
				return h("p", { style: { color: C.bad, fontSize: "12px", userSelect: "text" } }, "读台账失败：" + led.error);
			}
			if (!led.total) {
				return h("p", { style: { color: C.muted, fontSize: "12px" } },
					"台账为空 —— 这个功能还没有决策记录或校准流水。");
			}
			const fmtDate = (d) => (d && d.length === 8)
				? d.slice(0, 4) + "-" + d.slice(4, 6) + "-" + d.slice(6, 8)
				: (d || "（无日期）");

			const blocks = [];
			for (const st of led.stages) {
				if (!st.count) continue;
				blocks.push(h("div", {
					key: "s" + st.id,
					style: {
						marginTop: blocks.length ? "24px" : "0", fontSize: "13px", fontWeight: 700,
						color: C.ink, paddingBottom: "6px", borderBottom: "2px solid " + C.faint
					}
				}, st.name + "（" + st.count + " 条）"));

				for (const day of st.days) {
					const dk = st.id + "|" + day.date;
					const isFolded = !!folded[dk];
					const kids = [h("div", {
						key: "dt",
						onClick: () => { const nx = Object.assign({}, folded); nx[dk] = !isFolded; setFolded(nx); },
						style: {
							fontSize: "12px", fontWeight: 600, color: C.muted, marginTop: "12px",
							marginBottom: isFolded ? "0" : "5px", cursor: "pointer", userSelect: "none"
						}
					}, (isFolded ? "▸ " : "▾ ") + fmtDate(day.date) + "（" + day.items.length + " 条）")];
					if (!isFolded) {
						for (let i = 0; i < day.items.length; i++) {
							kids.push(h("div", {
								key: "i" + i,
								style: {
									fontSize: "12.5px", lineHeight: 1.75, color: C.ink,
									paddingLeft: "15px", marginBottom: "2px", userSelect: "text"
								}
							}, "· " + day.items[i].text));
						}
					}
					blocks.push(h("div", { key: "d" + dk }, kids));
				}
			}

			// 来源校验：默认收起，措辞明确它是"关于台账的元信息"，不是台账内容
			const st2 = (led.stats || { fromDecision: 0, fromJsonl: 0 });
			blocks.push(h("div", {
				key: "src",
				style: { marginTop: "28px", paddingTop: "10px", borderTop: "1px dashed " + C.faint }
			}, [
				h("div", {
					key: "t",
					onClick: () => setShowSrc(!showSrc),
					style: { fontSize: "11px", color: C.muted, cursor: "pointer", userSelect: "none" }
				}, (showSrc ? "▾ " : "▸ ") + "来源校验 —— 决策记录汇总 " + st2.fromDecision +
					" 条 · 校准流水补录 " + st2.fromJsonl + " 条（校验信息，不是台账内容）"),
				showSrc ? h("div", {
					key: "b",
					style: { fontSize: "11px", color: C.muted, marginTop: "6px", lineHeight: 1.75 }
				}, [
					"两个源缺一不可：决策记录的 calibrations 是权威汇总，但实测会漏——" +
					"联盟悬赏的 round 18（把 UI 文案改回）就只在校准 jsonl 里；" +
					"校准 jsonl 是 Gate 前的实时留痕，收口后归档。",
					(led.notes && led.notes.length)
						? h("div", { key: "n", style: { marginTop: "4px", color: C.warn } }, led.notes.join("；"))
						: null
				]) : null
			]));

			return h("div", { style: { maxWidth: "880px" } }, blocks);
		}

		/**
		 * 把定稿里的 HTML `<img …>` **抽出来单独渲染**，不交给 markdown 渲染器。
		 *
		 * ★ 为什么不用 `![](url)`：实测定稿的图是
		 *   `<img src="联盟悬赏UI/UI-M1 联盟悬赏主面板 · 常规难度.png" width="420" />`
		 *   —— URL 里**带空格和间隔号**，塞进 `![]()` 会让 markdown 解析崩掉
		 *   （实测症状：整个面板报 `Cannot read properties of undefined (reading 'code')`）。
		 *   抽出来自己渲染，既绕开解析器，也顺带能控制尺寸和做失败降级。
		 *
		 * ★ 工单 13：这两段的**内联副本已删**（`splitImgs` / `splitSpecial` 共 55 行），
		 *   改为 import `src/pure/split.ts` 那一份 —— 它被 `test/pure-split.test.ts` 逐条覆盖
		 *   （4 段 fenced code + 7 个 `<img>`，路径含空格与中点号）。
		 */

		/** 等宽代码块：**不经 markdown 渲染器**（实测它对 ``` 围栏会崩） */
		function CodeBlock(props) {
			return h("pre", {
				style: {
					margin: "6px 0", padding: "9px 11px", background: C.bg,
					border: "1px solid " + C.faint, borderRadius: "4px",
					fontSize: "11.5px", lineHeight: 1.65, fontFamily: "monospace",
					whiteSpace: "pre", overflowX: "auto", color: C.ink, userSelect: "text"
				}
			}, props.text);
		}

		/**
		 * 单张图：把定稿里的**相对路径**按定稿所在目录解析成绝对路径 → `/api/file` URL。
		 *
		 * ★ 失败**不显示破图**，而是退化成「用默认程序打开」——
		 *   真实定稿的图是 `<img src="UI/UI-M1 联盟悬赏主面板 · 常规难度.png">`：
		 *   路径含空格与中点号，`/api/file` 也可能因为权限/路径形态取不到。这时候
		 *   ① 面板里画一个虚线框说明发生了哪种失败；② 给一个按钮走系统默认程序打开（`props.onOpen`）。
		 *   虚线框上写明**解析出来的绝对路径**，用户能一眼看出是路径没解析对还是文件没读到。
		 */
		function ImgTag(props) {
			const [bad, setBad] = React.useState(false);
			const abs = (props.pathImages && props.pathImages.abs) ? props.pathImages.abs(props.src) : void 0;
			const url = abs ? fileUrl(abs) : void 0;
			const canOpen = !!(abs && typeof props.onOpen === "function");
			if (!url || bad) {
				return h("div", {
					style: {
						fontSize: "11px", color: C.muted, padding: "7px 10px", margin: "6px 0",
						border: "1px dashed " + C.soft, borderRadius: "4px", background: C.bg, userSelect: "text"
					}
				}, [
					h("div", { key: "t" }, "🖼 " + (props.alt || props.src) +
						(url ? "（面板内显示失败）" : "（路径没解析出来）")),
					abs ? h("div", {
						key: "p", style: { fontFamily: "monospace", fontSize: "10px", marginTop: "2px", wordBreak: "break-all" }
					}, abs) : null,
					canOpen ? h("button", {
						key: "o", type: "button", "data-open": abs,
						onClick: () => props.onOpen(abs),
						style: {
							font: "inherit", fontSize: "11px", marginTop: "6px", padding: "3px 10px",
							border: "1px solid " + C.ink, background: "#fff", borderRadius: "3px", cursor: "pointer"
						}
					}, "用默认程序打开") : null
				]);
			}
			return h("img", {
				src: url, alt: props.alt || "", "data-abs": abs,
				onError: () => setBad(true),
				style: {
					maxWidth: "440px", width: "100%", display: "block", margin: "6px 0",
					border: "1px solid " + C.faint, borderRadius: "4px", background: "#fff"
				}
			});
		}

		/** 块级错误边界：一块崩了不影响其他块，并且**说出是哪一块崩的** */
		class BlockBoundary extends React.Component {
			constructor(props) { super(props); this.state = { err: null }; }
			static getDerivedStateFromError(err) { return { err: err }; }
			componentDidCatch(err) { console.error("[sr-workbench] 块渲染失败", this.props.label, err); }
			render() {
				if (this.state.err) {
					return h("div", {
						style: {
							fontSize: "11px", color: C.bad, padding: "6px 9px", margin: "4px 0",
							border: "1px solid " + C.bad, borderRadius: "4px", background: "#fef2f2",
							userSelect: "text", lineHeight: 1.7
						}
					}, "⚠ 这一块渲染失败 · " + this.props.label + " —— " +
						String((this.state.err && this.state.err.message) || this.state.err));
				}
				return this.props.children;
			}
		}

		/**
		 * 定稿工作面（设计 §6.2 三栏 / §6.3 条目定位 / §6.4.1 影响范围）。
		 *
		 * ★ **左树 / 右正文 + 定位卡**。树的**数据**（章 → 组 → 条目、条目引用、行号、现状原文、
		 *   默认开合、哪些行不可单独引用）全部来自 `src/pure/finaltree.ts`：引用串就是引用图的键，
		 *   面板**不自己拼字符串**（拼错一个空格查图就是空集，界面上还看不出为什么）。
		 * ★ 分块渲染：解析器把定稿切成「章 / 组」块，每块一个带 `data-blk` 的 div，点树 → scrollIntoView
		 *   定位（**不依赖 markdown 渲染器支持行锚点**）；正文滚动时按 `topBlockIndex`（纯函数）
		 *   反推"现在在看哪一块"，树上的高亮跟着走。
		 * ★ 定位卡 = 条目引用 + 原文（带行号）+ 影响范围（**每一处标明属于哪一类边**，六类齐全）
		 *   + 三段式指令原文（`buildFixInstruction` 拼的，与真正发出去的是同一段）。
		 */
		function FinalDoc(props) {
			const d = props.doc;
			const [sel, setSel] = React.useState(null);
			const [openGrp, setOpenGrp] = React.useState({});
			const [item, setItem] = React.useState(null);
			const [intent, setIntent] = React.useState("");
			const [sendMsg, setSendMsg] = React.useState(null);
			const bodyRef = React.useRef(null);
			const graph = React.useMemo(() => (d && d.blocks ? buildRefGraph(d) : null), [d]);
			const tree = React.useMemo(() => (d && d.outline ? buildFinalTree(d, graph) : null), [d, graph]);

			if (!d) return h("p", { style: { color: C.muted, fontSize: "12px" } }, "正在读定稿…");
			if (d.empty) return h("p", { style: { color: C.muted, fontSize: "12px" } }, d.empty);
			if (d.error) return h("p", { style: { color: C.bad, fontSize: "12px", userSelect: "text" } }, d.error);
			if (!d.blocks || !d.blocks.length) {
				return h("p", { style: { color: C.muted, fontSize: "12px" } }, "定稿里没解析出章节结构。");
			}
			if (!tree || !tree.counts.chapters) {
				return h("p", { style: { color: C.muted, fontSize: "12px" } }, "定稿里没解析出章节结构。");
			}

			/** 相对路径 → **绝对路径**：按定稿所在目录解析（含空格与中点号也照原样拼，不做转义） */
			const absOf = (v) => {
				if (!v || typeof v !== "string") return void 0;
				if (!/\.(png|jpe?g|gif|webp|svg)$/i.test(v)) return void 0;
				const isAbs = /^[A-Za-z]:[\\/]/.test(v) || v.charAt(0) === "/";
				return isAbs ? v : String(d.dir).replace(/[\\/]+$/, "") + "/" + v;
			};
			const pathImages = {
				abs: absOf,
				resolve: (v) => { const a = absOf(v); return a ? fileUrl(a) : void 0; }
			};
			const goto = (idx) => {
				setSel(idx);
				const box = bodyRef.current;
				if (!box || !box.querySelector || idx < 0) return;
				const el = box.querySelector('[data-blk="' + idx + '"]');
				if (el && el.scrollIntoView) el.scrollIntoView({ block: "start" });
			};
			/**
			 * 正文滚动 → 树高亮跟随。判断只有一句：把每块顶边（相对滚动容器）交给纯函数
			 * `topBlockIndex` 取"已经越过顶边的最后一个块"。这里只负责取矩形。
			 */
			const onBodyScroll = () => {
				const box = bodyRef.current;
				if (!box || !box.querySelectorAll || !box.getBoundingClientRect) return;
				const els = box.querySelectorAll("[data-blk]");
				const boxTop = box.getBoundingClientRect().top;
				const tops = [];
				for (let i = 0; i < els.length; i++) {
					const r = els[i] && els[i].getBoundingClientRect ? els[i].getBoundingClientRect() : null;
					tops.push(r ? r.top - boxTop : NaN);
				}
				const i = topBlockIndex(tops);
				if (i >= 0 && i !== sel) setSel(i);
			};
			/** 行号 → 它所在的块 idx（影响范围里点一条，跳过去看） */
			const blockIdxOfLine = (line) => {
				for (let i = 0; i < d.blocks.length; i++) {
					const b = d.blocks[i];
					const n = String(b.text || "").split(/\r?\n/).length;
					if (line >= b.line && line < b.line + n) return i;
				}
				return -1;
			};

			/**
			 * 选中一条 → 出定位卡。
			 * `exclude` = 影响范围里**要排除的自指行**：条目/键/AC 是自己的定义行 ⇒ 排除它
			 * （"还牵动别处哪些地方"才是要点）；组与 §6 字段行不排除（组的标题行、字段的声明行
			 * 都是这一条自己的位置，留着并在卡上标明「自身」，这样处数与 14-impact-oracle 对得上）。
			 */
			const pick = (o, idx) => { setItem(o); setSendMsg(null); goto(idx); };
			const pickItem = (it, grpIdx) => pick({
				ref: it.ref, line: it.line, text: it.text, self: it.line, exclude: it.line,
				grain: it.grain, note: ""
			}, grpIdx);
			const pickGroup = (g) => {
				const names = g.items.map((x) => x.label);
				pick({
					ref: g.ref, line: g.line, text: g.text, self: g.line,
					exclude: null,                 // 组的标题行不排除（卡上标「（自身）」），处数与 14-impact-oracle 对齐
					grain: g.grain,
					note: !g.ref
						? "这一组不是引用图的实体（§4 到规则组、§5 到界面组、§6 到行）—— 只能定位，没有影响范围。"
						: "组内 " + g.items.length + " 条：" + names.slice(0, 14).join(" / ") + (names.length > 14 ? " …" : "")
				}, g.idx);
			};
			const pickChapter = (c) => pick({
				ref: "", line: c.line, text: c.text, self: c.line, exclude: null,
				grain: c.grain,
				note: "章不单独引用：改动按条落在组/条目上（§4 到规则组、§5 到界面组+条目、§6 到行、§7 到键、§10 到条目）。"
			}, c.idx);

			const impact = (item && item.ref && graph) ? impactOf(graph, item.ref, item.exclude) : [];
			/** 发给工作会话的那一份：**去掉自身那一行**（自指算影响没有意义） */
			const impactSend = impact.filter((h) => h.line !== (item && item.self));
			const impactArg = impactSend.map((h) => ({ line: h.line, where: h.where, kind: h.kind || "" }));
			const preview = (item && item.ref)
				? buildFixInstruction({
					path: d.path, ref: item.ref, before: item.text,
					intent: intent.trim(), impact: impactArg
				})
				: "";

			const send = () => {
				if (!item || !item.ref || !intent.trim() || !props.onFix) return;
				setSendMsg({ kind: "pending", text: "正在发给工作会话…" });
				props.onFix({
					path: d.path, ref: item.ref, before: item.text, intent: intent.trim(), impact: impactArg,
					// ★ 功能根（= 工作会话的 cwd，工单 15）：详情页给的更权威，缺了则由 fixRunner 从路径反推
					root: props.featureRoot || ""
				}).then(
					(r) => setSendMsg(r && r.ok
						? {
							kind: "ok", text: "已交给工作会话。",
							sid: r.sid || "", target: r.target || null,
							healed: !!r.healed, queued: !!r.queued, note: r.note || ""
						}
						: {
							kind: "err",
							text: (r && (r.message || r.note)) || "发送失败",
							next: (r && r.next) || "再按一次；仍失败就把这条错误发给开发者。",
							sid: (r && r.sid) || ""
						}),
					(e) => setSendMsg({ kind: "err", text: String((e && e.message) || e), next: "再按一次。" })
				);
			};
			/** 跳到某个会话（DSH 自己的 uiWorkspace.openSession）—— 失败也要说话 */
			const jump = (sid) => {
				if (!sid || !props.onOpenSession) {
					setSendMsg((m) => Object.assign({}, m || {}, { jumpErr: "面板拿不到「跳会话」的通道（onOpenSession 没挂上）。" }));
					return;
				}
				const r = props.onOpenSession(sid);
				if (r && r.ok === false) {
					setSendMsg((m) => Object.assign({}, m || {}, {
						jumpErr: "跳转失败：" + ((r.error && (r.error.message || r.error.code)) || "未知原因") +
							"　—— 你可以在左侧列表里按标题找到它。"
					}));
				}
			};

			// ── 左栏：大纲树（章 → 组 → 条目，逐级带行号）──────────────────
			//   ★ 默认开合来自数据（`finaltree` 给的 open）：**组级展开、章级收起** —— §7 有 49 个键。
			//   ★ 三处刻意的设计，都是为了让"能点的东西"一眼可见：
			//     ① 默认展开（组级）—— 收起状态下看不到条目，用户不知道能点
			//     ② 整行可点（展开/收起 + 定位一起做）—— 原来只有 10px 宽的 ▸，基本点不到
			//     ③ 不可单独引用的行**显灰 + 说明原因**（不假装能点）
			const LNUM = { fontSize: "9.5px", color: C.muted, fontFamily: "monospace", marginLeft: "6px", flex: "0 0 auto" };
			const lnum = (line) => h("span", { key: "L", style: LNUM }, "L" + line);
			const toc = [h("div", {
				key: "head",
				style: { fontSize: "11px", color: C.muted, marginBottom: "8px", lineHeight: 1.6, userSelect: "text" }
			}, [
				h("div", { key: "a" }, d.name + " · " + tree.counts.chapters + " 章 / " + tree.counts.groups + " 组 / " +
					tree.counts.items + " 个可引用条目"),
				h("div", { key: "b" }, "点条目 → 出定位卡（条目引用 + 原文 + 影响范围）；组级默认展开、章级默认收起")
			])];

			const itemRow = (it, grpIdx) => {
				const on = !!item && !!it.ref && item.ref === it.ref && item.line === it.line;
				const dead = !it.ref;
				return h("div", {
					key: "it" + it.line + "-" + (it.ref || it.label),
					onClick: dead ? void 0 : () => pickItem(it, grpIdx),
					title: dead ? (it.why || "这一行不可单独引用") : it.ref,
					"data-ref": it.ref || "",
					"data-line": String(it.line),
					style: {
						display: "flex", alignItems: "baseline",
						fontSize: "11px", cursor: dead ? "default" : "pointer", userSelect: "none",
						padding: "1px 4px 1px 22px", borderRadius: "3px",
						color: dead ? C.soft : (on ? "#fff" : C.muted),
						background: on ? C.link : "transparent",
						fontWeight: on ? 600 : 400,
						whiteSpace: "nowrap", overflow: "hidden"
					}
				}, [
					h("span", {
						key: "l", style: { overflow: "hidden", textOverflow: "ellipsis" }
					}, it.label),
					it.sub ? h("span", { key: "s", style: { color: dead ? C.soft : C.muted, marginLeft: "5px", fontSize: "10px" } }, it.sub) : null,
					h("span", { key: "sp", style: { flex: "1 1 auto" } }, ""),
					lnum(it.line)
				]);
			};

			for (const c of tree.chapters) {
				const chKey = "ch" + c.no;
				const chOpen = openGrp[chKey] === undefined ? c.open : !!openGrp[chKey];
				const cnt = [];
				if (c.groups.length) cnt.push(c.groups.length + " 组");
				if (c.items.length) cnt.push(c.items.length + " 条");
				if (c.skipped) cnt.push(c.skipped + " 行不可引用");
				toc.push(h("div", {
					key: "c" + c.no,
					onClick: () => {
						if (c.items.length) {
							const nx = Object.assign({}, openGrp);
							nx[chKey] = !chOpen;
							setOpenGrp(nx);
						}
						pickChapter(c);
					},
					title: c.text,
					"data-ch": c.no,
					style: {
						display: "flex", alignItems: "baseline", cursor: "pointer", userSelect: "none",
						fontSize: "12px", fontWeight: 600, margin: "8px 0 3px",
						color: sel === c.idx ? C.link : C.ink
					}
				}, [
					h("span", {
						key: "t",
						style: {
							fontSize: "9px", color: C.muted, marginRight: "4px",
							width: "9px", flex: "0 0 9px", textAlign: "center"
						}
					}, c.items.length ? (chOpen ? "▾" : "▸") : "·"),
					h("span", { key: "l" },
						"§" + c.no + " " + c.title + (!chOpen && cnt.length ? "  (" + cnt.join(" · ") + ")" : "")),
					h("span", { key: "sp", style: { flex: "1 1 auto" } }, ""),
					lnum(c.line)
				]));
				if (chOpen) {
					for (const it of c.items) toc.push(itemRow(it, c.idx));
				}

				// 组
				for (const g of c.groups) {
					const tag = g.id || g.no || "";
					const gkey = "g" + g.idx;
					const isOpen = openGrp[gkey] === undefined ? g.open : !!openGrp[gkey];
					const gc = g.items.length ? g.items.length + " 条" : "";
					const gs = g.skipped ? (gc ? " · " : "") + g.skipped + " 行不可引用" : "";
					toc.push(h("div", {
						key: gkey,
						onClick: () => {
							if (g.items.length) {
								const nx = Object.assign({}, openGrp);
								nx[gkey] = !isOpen;
								setOpenGrp(nx);
							}
							// 有标识的组（R1 / UI-M1 / 6.2…）出卡片；没有标识的组只定位
							if (tag) pickGroup(g);
							else goto(g.idx);
						},
						title: g.text,
						"data-group": tag,
						style: {
							display: "flex", alignItems: "baseline", cursor: "pointer", userSelect: "none",
							padding: "2px 0 2px 10px", borderRadius: "3px",
							borderLeft: "2px solid " + (sel === g.idx ? C.link : "transparent")
						}
					}, [
						h("span", {
							key: "t",
							style: {
								fontSize: "9px", color: C.muted, marginRight: "4px",
								width: "9px", flex: "0 0 9px", textAlign: "center"
							}
						}, g.items.length ? (isOpen ? "▾" : "▸") : "·"),
						h("span", {
							key: "l",
							style: { fontSize: "11.5px", color: sel === g.idx ? C.link : C.muted }
						}, (tag ? tag + "  " : "") + g.title + (gc || gs ? "  (" + gc + gs + ")" : "")),
						h("span", { key: "sp", style: { flex: "1 1 auto" } }, ""),
						lnum(g.line)
					]));
					if (isOpen) {
						for (const it of g.items) toc.push(itemRow(it, g.idx));
					}
				}
			}

			// ── 右栏：定位卡（选中时）+ 分块正文 ──────────────────────────
			const labelOf = (b) => {
				if (b.level === 2) return "§" + b.no + " " + (b.title || "");
				const id = b.id || b.no || "";
				const dup = b.no && b.chNo && String(b.no).indexOf(String(b.chNo) + ".") === 0;
				return (dup ? "" : "§" + (b.chNo || "?") + " ") + id + " " + (b.title || "");
			};
			/** 边类别标签的颜色：⑥ 契约单独一个醒目的红，其余各有色调（用户能一眼分辨"这条算不算数"） */
			const EDGE_TONE = { 引用: C.link, 同族: "#7c3aed", 归属: "#0f766e", 验收: C.ok, 文本: C.warn, 契约: C.bad };
			const edgeTag = (k, label) => h("span", {
				key: "k" + k,
				style: {
					fontSize: "10px", fontWeight: label === "契约" ? 700 : 400,
					color: label === "契约" ? "#fff" : (EDGE_TONE[label] || C.muted),
					background: label === "契约" ? C.bad : "transparent",
					borderRadius: "3px", padding: label === "契约" ? "0 4px" : 0,
					marginRight: "4px", flex: "0 0 auto"
				}
			}, "[" + label + "]");

			const card = item ? h("div", {
				key: "card",
				style: {
					border: "1px solid " + C.soft, borderLeft: "3px solid " + C.link, background: "#f8fbff",
					borderRadius: "4px", padding: "9px 11px", marginBottom: "10px",
					maxHeight: "42vh", overflow: "auto", flex: "0 0 auto"
				}
			}, [
				h("div", {
					key: "h",
					style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "3px" }
				}, [
					h("b", { key: "r", style: { fontSize: "12.5px", color: C.ink, fontFamily: "monospace" } },
						item.ref || "（不可单独引用）"),
					h("span", {
						key: "x",
						onClick: () => { setItem(null); setIntent(""); setSendMsg(null); },
						style: { fontSize: "11px", color: C.muted, cursor: "pointer", userSelect: "none" }
					}, "✕ 取消选择")
				]),
				h("div", { key: "g", style: { fontSize: "10.5px", color: C.muted, marginBottom: "6px" } },
					"引用粒度：" + item.grain + (item.note ? "　·　" + item.note : "")),
				h("div", { key: "b", style: { fontSize: "11.5px", marginBottom: "7px", userSelect: "text" } }, [
					h("div", { key: "t", style: { color: C.muted } }, "原文（L" + item.line + "）"),
					h("div", {
						key: "v",
						style: {
							color: C.ink, background: "#fff", border: "1px solid " + C.faint,
							borderRadius: "3px", padding: "5px 7px", marginTop: "3px", lineHeight: 1.7
						}
					}, item.text)
				]),
				h("div", { key: "i", style: { fontSize: "11.5px", marginBottom: "7px" } }, [
					h("div", { key: "t", style: { color: C.muted } },
						item.ref
							? ("影响范围 —— " + impact.length + " 处" +
								(item.exclude === null && item.self ? "（含它自己那一行 L" + item.self + "）" : "") +
								"；面板只扫**结构引用**，语义影响由 sr-gdd-fix 的 D11 负责")
							: "影响范围 —— 无（章不是引用图的实体）"),
					item.ref ? h("div", { key: "gz", style: { fontSize: "10px", color: C.muted, marginTop: "2px", lineHeight: 1.7 } },
						"边类别：" + EDGE_LEGEND.join("　")) : null,
					impact.length ? h("div", { key: "l", style: { marginTop: "3px" } },
						impact.map((hh, ii) => {
							const lab = edgeLabelOf(graph, item.ref, hh);
							return h("div", {
								key: ii,
								onClick: () => goto(blockIdxOfLine(hh.line)),
								title: "点它跳到正文里这一处",
								style: {
									display: "flex", alignItems: "baseline", cursor: "pointer",
									color: C.link, lineHeight: 1.75, userSelect: "text"
								}
							}, [
								edgeTag(ii, lab),
								h("span", { key: "L", style: { fontFamily: "monospace", flex: "0 0 auto" } },
									"L" + hh.line + (item.self === hh.line ? "（自身）" : "") + " "),
								h("span", { key: "w", style: { flex: "0 0 auto" } }, hh.where),
								h("span", { key: "x", style: { color: C.muted, marginLeft: "6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
									"—— " + String(hh.text || "").slice(0, 64))
							]);
						})
					) : h("div", { key: "n", style: { color: C.muted, marginTop: "3px" } },
						item.ref ? "· 全文没有其他地方提到它（空集就如实报空，不硬凑关联）" : "· 请选章里的组或条目")
				]),
				preview ? h("div", { key: "pv", style: { fontSize: "11px", marginBottom: "7px" } }, [
					h("div", { key: "t", style: { color: C.muted } },
						"三段式（改哪儿 / 现状原文 / 影响范围）—— 下面这段就是发给工作会话的原文："),
					h("pre", {
						key: "v",
						style: {
							margin: "3px 0 0", padding: "6px 8px", background: C.bg, border: "1px solid " + C.faint,
							borderRadius: "3px", fontFamily: "monospace", fontSize: "10.5px", lineHeight: 1.6,
							whiteSpace: "pre-wrap", color: C.ink, userSelect: "text", maxHeight: "16vh", overflow: "auto"
						}
					}, preview)
				]) : null,
				h("div", { key: "act", style: { display: "flex", gap: "6px", alignItems: "center" } }, [
					h("input", {
						key: "in", value: intent, placeholder: "要改成什么（一句话）",
						onChange: (e) => setIntent(e.target.value),
						style: {
							flex: "1 1 auto", font: "inherit", fontSize: "11.5px", padding: "5px 8px",
							border: "1px solid " + C.soft, borderRadius: "4px"
						}
					}),
					h("button", {
						key: "go", type: "button", disabled: !intent.trim() || !item.ref,
						onClick: send,
						style: {
							font: "inherit", fontSize: "11.5px", padding: "5px 12px", borderRadius: "4px",
							border: "1px solid " + (intent.trim() && item.ref ? C.link : C.soft),
							background: intent.trim() && item.ref ? C.link : "#fff",
							color: intent.trim() && item.ref ? "#fff" : C.muted,
							cursor: intent.trim() && item.ref ? "pointer" : "default"
						}
					}, "发到工作会话")
				]),
				// 目标说明：三段式会发给**这个功能的专属工作会话**（cwd = 功能目录，工单 15）
				item.ref && preview ? h("div", {
					key: "tg", "data-target": "work-session",
					style: { fontSize: "10px", color: C.muted, marginTop: "5px", lineHeight: 1.7, userSelect: "text" }
				}, "发到：本功能的专属工作会话" +
					(props.featureRoot ? "（cwd " + winPath(props.featureRoot) + "）" : "") +
					"　—— 不占用你自己的对话；发出去之后这里会给出「跳到那个会话」。") : null,
				sendMsg ? h("div", {
					key: "m",
					style: {
						fontSize: "11px", marginTop: "6px", lineHeight: 1.7, userSelect: "text",
						color: sendMsg.kind === "err" ? C.bad : (sendMsg.kind === "ok" ? C.ok : C.muted)
					}
				}, [
					h("div", { key: "t" }, (sendMsg.kind === "ok" ? "✓ " : (sendMsg.kind === "err" ? "✗ " : "")) + sendMsg.text),
					// 成功：说清发到哪儿了 + 一键跳过去（工单 15 第 5 条）
					sendMsg.kind === "ok" ? h("div", {
						key: "d", "data-sent": "ok", style: { color: C.muted, userSelect: "text" }
					}, [
						"目标：" + ((sendMsg.target && sendMsg.target.title) || "工作会话") +
						(sendMsg.sid ? "　会话 " + String(sendMsg.sid).slice(0, 12) + "…" : "") +
						(sendMsg.target && sendMsg.target.root ? "　cwd " + winPath(sendMsg.target.root) : "") +
						"　（" + pickSourceText(sendMsg.target && sendMsg.target.source) + "）",
						sendMsg.healed ? h("div", { key: "h", style: { color: C.warn } },
							"上一轮记的那条会话已经不在了 —— 已自动重建一条并重发。") : null,
						sendMsg.queued ? h("div", { key: "q", style: { color: C.warn } },
							"它正在跑别的活，这条指令排在队列里，等它跑完当前这一轮就会处理。") : null
					]) : null,
					// 失败：可读错误 + 下一步（不许静默无反应，工单 15 第 6 条）
					sendMsg.kind === "err" ? h("div", {
						key: "n", "data-sent": "fail", style: { color: C.ink }
					}, "下一步：" + (sendMsg.next || "再按一次。")) : null,
					// 一键跳到那个会话（成功/失败都能点：失败时去会话里自己发一遍原文）
					sendMsg.sid && props.onOpenSession ? h("button", {
						key: "j", type: "button", "data-jump": sendMsg.sid,
						onClick: () => jump(sendMsg.sid),
						style: {
							font: "inherit", fontSize: "11px", padding: "2px 9px", marginTop: "3px",
							border: "1px solid " + C.soft, background: "#fff", borderRadius: "4px", cursor: "pointer"
						}
					}, "跳到那个会话 ›") : null,
					sendMsg.jumpErr ? h("div", { key: "je", style: { color: C.bad } }, sendMsg.jumpErr) : null
				]) : null
			]) : null;

			const body = d.blocks.map((b, i) => h("div", {
				key: "b" + i,
				"data-blk": String(i),
				style: {
					padding: "2px 8px 4px 10px", marginBottom: "6px", borderRadius: "3px",
					borderLeft: "3px solid " + (sel === i ? C.link : "transparent"),
					background: sel === i ? "#f0f7ff" : "transparent"
				}
			}, h(BlockBoundary, { key: "bb", label: labelOf(b).trim() + "（L" + b.line + "）" },
				splitSpecial(b.text).map((p, j) => {
					if (p.t === "img") {
						return h(ImgTag, {
							key: "i" + j, src: p.v, alt: p.alt, pathImages: pathImages,
							onOpen: props.onOpen || null
						});
					}
					if (p.t === "code") return h(CodeBlock, { key: "c" + j, text: p.v });
					return h(Md, { key: "m" + j, text: p.v, pathImages: pathImages });
				})
			)));

			return h("div", { style: { display: "flex", gap: "16px", alignItems: "flex-start" } }, [
				h("div", {
					key: "toc",
					style: {
						flex: "0 0 272px", width: "272px", maxHeight: "68vh", overflow: "auto",
						borderRight: "1px solid " + C.faint, paddingRight: "10px"
					}
				}, toc),
				h("div", {
					key: "right",
					style: { flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column" }
				}, [
					card,
					h("div", {
						key: "body", ref: bodyRef, onScroll: onBodyScroll,
						style: { flex: "1 1 auto", minHeight: 0, maxHeight: "68vh", overflow: "auto" }
					}, body)
				])
			]);
		}

		function DecisionLedger(props) {
			const L = props.ledger;
			const [open, setOpen] = React.useState(null);
			if (!L) return h("p", { style: { color: C.muted, fontSize: "12px" } }, "正在读决策台账…");

			const bad = L.records.filter((r) => r.issues.length > 0 || r.parseErr);
			const sel = open === null ? null : L.records[open];
			const d = sel && sel.doc;
			const cov = props.coverage || null;

			return h("div", null, [
				// ⓪ ★ 工单 17：字段覆盖检查（"上游新增字段时不会漏掉一类决定"）
				//   —— 归类表在 `src/pure/fieldclass.ts`（85 行数据），这里只显示它的结论。
				cov ? h("div", {
					key: "cov",
					style: {
						border: "1px solid " + C.faint,
						borderLeft: "3px solid " + (cov.ok ? C.ok : C.bad),
						background: cov.ok ? "#f0fdf4" : "#fef2f2",
						borderRadius: "4px", padding: "10px 12px", marginBottom: "12px"
					}
				}, [
					h("div", { key: "t", style: { fontSize: "12px" } }, [
						h("b", { key: "a" }, "字段覆盖检查"),
						h("span", { key: "b", style: { color: C.muted } },
							"　" + L.records.length + " 份决策 + " + L.calibration.length + " 行校准 + " + L.handoffs.length + " 份交接" +
							"　检查 " + cov.checked + " 个键实例 / " + cov.distinct + " 个不同键" +
							"　悬空 " + cov.dangling.length + " · 待判定 " + cov.pending.length)
					]),
					cov.ok
						? h("div", { key: "ok", style: { fontSize: "11px", color: C.ok, marginTop: "4px" } },
							"每个键都已显式归类（收 / 不收 / 容器）—— 上游新增字段而没归类时会在这里**报 error**并指出是哪个文件。")
						: h("div", { key: "bad", style: { marginTop: "6px" } }, cov.issues.map((it, i) => h("div", {
							key: i, style: { fontSize: "11px", color: C.bad }
						}, "[" + it.code + "/" + it.level + "] " + it.msg + (it.files && it.files.length ? "　→ " + it.files.join("、") : "")))),
					h("div", { key: "cls", style: { fontSize: "10px", color: C.muted, fontFamily: "monospace", marginTop: "4px" } },
						"归类分布 " + Object.keys(cov.classes).sort().map((k) => k + " " + cov.classes[k]).join(" · "))
				]) : null,

				// ① 契约校验
				h("div", {
					key: "v",
					style: {
						border: "1px solid " + C.faint,
						borderLeft: "3px solid " + (bad.length ? C.bad : C.ok),
						background: "#fff", borderRadius: "4px", padding: "10px 12px", marginBottom: "12px"
					}
				}, [
					h("div", { key: "t", style: { fontSize: "12px", marginBottom: "4px" } }, [
						h("b", { key: "a" }, "契约校验"),
						h("span", { key: "b", style: { color: C.muted } },
							"　对照 " + (L.schemaOk ? "sr-askme/references/decision.schema.json" : "（schema 读不到，仅列结构问题）") +
							"　共 " + L.records.length + " 条，不合规 " + bad.length + " 条")
					]),
					bad.length
						? h("div", { key: "l" }, bad.map((r) => h("div", { key: r.file, style: { marginTop: "6px" } }, [
							h("div", { key: "n", style: { fontFamily: "monospace", fontSize: "11px", color: C.bad } }, r.file + (r.parseErr ? "（JSON 解析失败：" + r.parseErr + "）" : "")),
							r.issues.length ? IssueTable(r.issues) : null
						])))
						: h("div", { key: "ok", style: { fontSize: "11px", color: C.ok } }, "全部记录符合契约。")
				]),

				// ② 已拍板列表
				h("div", { key: "list", style: { background: "#fff", border: "1px solid " + C.faint, borderRadius: "4px", padding: "10px 12px", marginBottom: "12px" } }, [
					h("div", { key: "t", style: { fontSize: "12px", fontWeight: 600, marginBottom: "6px" } }, "已拍板列表（点一行看详情）"),
					L.records.length ? h("table", { key: "tb", style: { width: "100%", borderCollapse: "collapse" } }, [
						h("thead", { key: "h" }, h("tr", null, [
							h("th", { key: "1", style: TH }, "decision_id"),
							h("th", { key: "2", style: TH }, "标题"),
							h("th", { key: "3", style: Object.assign({}, TH, { width: "15%" }) }, "type"),
							h("th", { key: "4", style: Object.assign({}, TH, { width: "12%" }) }, "status"),
							h("th", { key: "5", style: Object.assign({}, TH, { width: "11%" }) }, "日期")
						])),
						h("tbody", { key: "b" }, L.records.map((r, i) => {
							const dd = r.doc || {};
							const tOk = L.schemaOk && L.schema.properties && L.schema.properties.decision_type &&
								L.schema.properties.decision_type.enum.indexOf(dd.decision_type) >= 0;
							const on = open === i;
							return h("tr", {
								key: r.file,
								onClick: () => setOpen(on ? null : i),
								style: { cursor: "pointer", background: on ? "#f0f6ff" : "transparent" }
							}, [
								h("td", { key: "1", style: Object.assign({}, TD, { fontFamily: "monospace" }) }, String(dd.decision_id || "—")),
								h("td", { key: "2", style: TD }, String(dd.title || r.file)),
								h("td", { key: "3", style: Object.assign({}, TD, { fontFamily: "monospace", color: tOk ? C.ink : C.bad }) }, String(dd.decision_type || "—") + (tOk ? "" : " ✗")),
								h("td", { key: "4", style: Object.assign({}, TD, { fontFamily: "monospace" }) }, String(dd.status || "—")),
								h("td", { key: "5", style: Object.assign({}, TD, { fontFamily: "monospace" }) }, String(dd.updated_at || dd.created_at || "").slice(0, 10))
							]);
						}))
					]) : h("div", { key: "n", style: { fontSize: "12px", color: C.muted } }, "本功能没有决策记录。")
				]),

				// ③ 决策详情
				sel ? h("div", { key: "detail", style: { background: "#fff", border: "1px solid " + C.faint, borderRadius: "4px", padding: "10px 12px", marginBottom: "12px" } }, [
					h("div", { key: "t", style: { fontSize: "12px", fontWeight: 600, marginBottom: "6px" } }, "决策详情 · " + sel.file),
					d ? h("table", { key: "tb", style: { width: "100%", borderCollapse: "collapse" } }, h("tbody", null,
						[
							["决策问题", d.decision_question],
							["当前默认动作", d.current_default_action],
							["边界状态", d.boundary_status],
							["stakes", d.stakes],
							["reversibility", d.reversibility],
							["owner", d.owner],
							["rollback_trigger", d.rollback_trigger]
						].map(([k, v]) => h("tr", { key: k }, [
							h("th", { key: "k", style: Object.assign({}, TH, { width: "20%" }) }, k),
							h("td", { key: "v", style: TD }, String(v === undefined || v === null ? "—" : v))
						]))
					)) : h("div", { key: "e", style: { fontSize: "12px", color: C.bad } }, "JSON 解析失败：" + sel.parseErr),
					d && Array.isArray(d.options) ? h("div", { key: "opt", style: { marginTop: "10px" } }, [
						h("div", { key: "t", style: { fontSize: "11px", fontWeight: 600, marginBottom: "4px" } }, "选项（" + d.options.length + " 条）"),
						h("table", { key: "tb", style: { width: "100%", borderCollapse: "collapse" } }, [
							h("thead", { key: "h" }, h("tr", null, [
								h("th", { key: "1", style: TH }, "option_id"),
								h("th", { key: "2", style: TH }, "action"),
								h("th", { key: "3", style: TH }, "expected_benefit"),
								h("th", { key: "4", style: TH }, "main_risk")
							])),
							h("tbody", { key: "b" }, d.options.map((o, i) => h("tr", { key: i }, [
								h("td", { key: "1", style: Object.assign({}, TD, { fontFamily: "monospace" }) }, String(o.option_id || "")),
								h("td", { key: "2", style: TD }, String(o.action || "")),
								h("td", { key: "3", style: TD }, String(o.expected_benefit || "")),
								h("td", { key: "4", style: TD }, String(o.main_risk || ""))
							])))
						])
					]) : null,
					d ? h(ResultView, { key: "res", result: d.decision_result, doc: d }) : null
				]) : null,

				// ④ 校准流水
				h("div", { key: "cal", style: { background: "#fff", border: "1px solid " + C.faint, borderRadius: "4px", padding: "10px 12px" } }, [
					h("div", { key: "t", style: { fontSize: "12px", fontWeight: 600, marginBottom: "6px" } },
						"校准流水（" + L.calibration.length + " 条 · " + L.calFiles.length + " 个文件）"),
					L.calibration.length ? h("div", { key: "tb" }, L.calibration.map((c, i) => {
						const row = c.row || {};
						return h("div", {
							key: i,
							style: { padding: "7px 0", borderTop: i ? "1px solid " + C.faint : "none" }
						}, [
							h("div", { key: "h", style: { fontSize: "10px", color: C.muted, fontFamily: "monospace", marginBottom: "3px" } },
								"第 " + (row.round === undefined ? "?" : row.round) + " 轮 · " + String(row.gate || "") +
								" · " + String(row.ts || "").slice(0, 16) + " · " + String(row.status || "")),
							// ★ 改动内容本身（这才是要看的）
							h("div", { key: "i", style: { fontSize: "12px", lineHeight: 1.7 } }, String(row.input || "(无描述)")),
							Array.isArray(row.affected) && row.affected.length
								? h("div", { key: "a", style: { marginTop: "4px" } }, row.affected.map((x, j) => h("span", {
									key: j,
									style: {
										fontSize: "10px", fontFamily: "monospace", border: "1px solid " + C.faint,
										borderRadius: "3px", padding: "0 5px", marginRight: "3px", color: C.muted
									}
								}, String(x))))
								: null
						]);
					})) : h("div", { key: "n", style: { fontSize: "12px", color: C.muted } }, "本功能没有校准流水。"),
					h("div", {
						key: "w",
						style: {
							marginTop: "8px", padding: "8px 10px", background: "#fff7ed",
							borderLeft: "3px solid " + C.warn, fontSize: "11px"
						}
					}, "⚠️ 校准流水不逐字存原话（sr 的既定口径）。这里能看到「第几轮、哪道门、影响了哪些条目」，看不到当时逐字的答复。")
				])
			]);
		}

		// ── A2 流水线：阶段 → 斜杠命令 ──────────────────────────────
		const STAGE_ORDER = ["concept", "draft", "config", "final", "review", "speech"];
		const STAGE_META = {
			concept: { label: "概念", cmd: "/sr-concept", desc: "创意评估与设计核三角" },
			draft: { label: "成稿", cmd: "/sr-gdd-human", desc: "写成稿（只有纯规则与设计）" },
			config: { label: "配置", cmd: "/sr-config", desc: "把规则落成配置表" },
			final: { label: "定稿", cmd: "/sr-gdd-ai", desc: "整合定稿，交程序" },
			review: { label: "审查", cmd: "/sr-gdd-review", desc: "只读审查定稿" },
			speech: { label: "宣讲", cmd: "/sr-gdd-html", desc: "出宣讲 HTML" }
		};

		/**
		 * 工作会话缓存：**可响应**，跨组件重挂载保留。
		 * key = `<预设>|<功能名>`；值 = 会话 id。
		 * 看板要靠它把「哪个功能在等你拍板」显示出来，所以写入时必须通知订阅者
		 * （否则在详情页建的会话，看板不知道）。
		 */
		const WORK_SESSIONS = new Map();
		const WORK_LISTENERS = new Set();
		const workKey = (presetId, topic) => presetId + "|" + (topic || "");
		const setWorkSession = (key, sid) => {
			if (!key) return;
			WORK_SESSIONS.set(key, sid);
			for (const l of [...WORK_LISTENERS]) { try { l(); } catch (e) { /* ignore */ } }
		};
		/** 订阅工作会话缓存（返回 Map；写入时会触发重渲染） */
		function useWorkSessions() {
			const [, bump] = React.useState(0);
			React.useEffect(() => {
				const l = () => bump((n) => n + 1);
				WORK_LISTENERS.add(l);
				return () => { WORK_LISTENERS.delete(l); };
			}, []);
			return WORK_SESSIONS;
		}

		/** 把 Remote 的原始错误翻成人话 */
		function humanError(r) {
			const m = String((r && r.error && (r.error.message || r.error.code)) || r || "");
			if (/without inject/.test(m)) return "工作台缺少必要权限声明，需要更新插件";
			if (/not found|no entry|不存在/i.test(m)) return "找不到目标（路径或会话可能已变）";
			if (/timeout|超时/i.test(m)) return "对方没有响应（超时）";
			if (/cancel|abort/i.test(m)) return "操作被取消";
			return m || "未知原因";
		}

		/**
		 * 工作会话的实时状态。
		 * 数据全部来自客户端会话模型（hook 订阅，**自动更新，不用轮询**）：
		 *   useSessions                      → SessionSummary { running, blank, updatedAt, projections }
		 *   useSessionPendingInteraction     → 该会话是否有待用户回答的交互
		 * ⚠ 不自己渲染问题正文：SessionPendingInteractionBase 只有 {key, kind, sessionId}，
		 *   正文由各领域插件声明合并贡献，猜不得。这里只报"有/无"并给跳转。
		 */
		function WorkSessionStatus(props) {
			const sid = props.sessionId;
			const useSessions = props.useSessions;
			const usePending = props.useSessionPendingInteraction;
			const onOpen = props.onOpen;

			// ★ hooks 必须无条件调用：条件放进 selector，不放在调用上
			const summary = useSessions ? useSessions((s) => (sid ? s.byId[sid] : void 0)) : void 0;
			const pending = usePending ? usePending((m) => (sid ? m.get(sid) : void 0)) : void 0;

			if (!sid) return null;

			const running = !!(summary && summary.running);
			const blank = !!(summary && summary.blank);
			const proj = (summary && summary.projections && summary.projections.values) || {};
			const title = typeof proj.title === "string" ? proj.title : "";
			const meta = proj.sessionListMetadata || {};
			const lastAt = meta.lastPromptAt || (summary && summary.updatedAt) || 0;

			const fmt = (t) => {
				if (!t) return "—";
				try {
					const d = new Date(t);
					const p = (n) => (n < 10 ? "0" : "") + n;
					return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
						" " + p(d.getHours()) + ":" + p(d.getMinutes());
				} catch (e) { return "—"; }
			};

			const state = running
				? { text: "运行中", color: C.ok, dot: "●" }
				: (pending ? { text: "等你回答", color: C.warn, dot: "⚠" }
					: (blank ? { text: "空白（还没开始）", color: C.muted, dot: "○" }
						: { text: "空闲", color: C.muted, dot: "○" }));

			const row = (k, v, color) => h("div", { key: k, style: { display: "flex", gap: "8px", fontSize: "12px", lineHeight: 1.95 } }, [
				h("span", { key: "k", style: { color: C.muted, minWidth: "62px", flex: "0 0 auto" } }, k),
				h("span", { key: "v", style: { color: color || C.ink, wordBreak: "break-all" } }, v)
			]);

			return h("div", {
				style: {
					border: "1px solid " + C.faint, borderRadius: "4px", background: "#fff",
					padding: "10px 13px", marginTop: "12px"
				}
			}, [
				h("div", { key: "t", style: { fontSize: "12px", fontWeight: 600, marginBottom: "5px" } }, "工作会话"),
				row("状态", state.dot + " " + state.text, state.color),
				title ? row("标题", title) : null,
				pending ? row("待回答", "有 1 项在等你（" + String(pending.kind || "未知类型") + "）", C.warn) : null,
				row("最近活动", fmt(lastAt)),
				row("会话 id", h("span", { style: { fontFamily: "monospace", fontSize: "11px" } }, String(sid))),
				h("div", { key: "act", style: { marginTop: "8px" } }, h("button", {
					type: "button",
					onClick: () => onOpen(sid),
					style: {
						font: "inherit", fontSize: "12px", padding: "4px 12px",
						border: "1px solid " + C.ink, background: "#fff", color: C.ink,
						borderRadius: "4px", cursor: "pointer"
					}
				}, "在会话里查看 ›"))
			]);
		}

		/**
		 * 待拍板问题卡片 —— A2 的闭环。
		 *
		 * 依据（读 `dsh-client-ui-user-questions` 得到）：注册进 pending 快照的就是
		 * `PendingQuestion` 实例，它的 `questions` 与 `answer()` 都是**公开成员**：
		 *   questions: AskUserQuestionItem[]  { id, question, detail?, header?, options?, multiSelect? }
		 *   answer({ answers: [{ id, selected: [标签], custom? }] })
		 * 所以面板里能读问题、能回答，不必跳去会话。
		 */
		function PendingQuestionCard(props) {
			const pending = props.pending;
			const questions = (pending && Array.isArray(pending.questions)) ? pending.questions : [];
			const [sel, setSel] = React.useState({});      // qid → [标签]
			const [text, setText] = React.useState({});    // qid → 自定义文本
			const [busy, setBusy] = React.useState(false);
			const [err, setErr] = React.useState("");
			const [done, setDone] = React.useState("");

			if (!questions.length) return null;

			const submit = (answers) => {
				setBusy(true); setErr(""); setDone("");
				let r;
				try { r = pending.answer({ answers: answers }); }
				catch (e) { setBusy(false); setErr(String((e && e.message) || e)); return; }
				Promise.resolve(r).then(
					() => { setBusy(false); setDone("已提交，等 skill 继续"); },
					(e) => { setBusy(false); setErr(String((e && e.message) || e)); }
				);
			};

			const pickSingle = (q, label) => submit([{ id: q.id, selected: [label] }]);
			const submitMulti = (q) => submit([{
				id: q.id,
				selected: sel[q.id] || [],
				custom: (text[q.id] || "").trim() || void 0
			}]);

			const toggle = (qid, label) => setSel((s) => {
				const cur = s[qid] || [];
				const next = cur.indexOf(label) >= 0 ? cur.filter((x) => x !== label) : cur.concat([label]);
				const out = {}; for (const k in s) out[k] = s[k]; out[qid] = next; return out;
			});

			return h("div", {
				style: {
					border: "1px solid " + C.warn, borderLeft: "3px solid " + C.warn,
					background: "#fffdf7", borderRadius: "4px", padding: "11px 13px", marginTop: "12px"
				}
			}, [
				h("div", { key: "h", style: { fontSize: "12px", fontWeight: 600, marginBottom: "7px", color: C.warn } },
					"⚠ 等你拍板（" + questions.length + " 个问题）"),

				...questions.map((q, qi) => {
					const opts = Array.isArray(q.options) ? q.options : [];
					const picked = sel[q.id] || [];
					return h("div", {
						key: "q" + qi,
						style: { borderTop: qi ? "1px solid " + C.faint : "none", paddingTop: qi ? "9px" : "0", marginTop: qi ? "9px" : "0" }
					}, [
						q.header ? h("div", { key: "hd", style: { fontSize: "11px", color: C.muted, fontFamily: "monospace", marginBottom: "2px" } }, String(q.header)) : null,
						h("div", { key: "q", style: { fontSize: "13px", lineHeight: 1.7, marginBottom: q.detail ? "3px" : "7px" } }, String(q.question || "")),
						q.detail ? h("div", { key: "d", style: { fontSize: "11px", color: C.muted, lineHeight: 1.7, marginBottom: "7px", whiteSpace: "pre-wrap" } }, String(q.detail)) : null,

						// 选项：单选点即答；多选累积后提交
						opts.length ? h("div", { key: "opts", style: { display: "flex", flexDirection: "column", gap: "5px" } },
							opts.map((o, oi) => {
								const label = typeof o === "string" ? o : String((o && (o.label || o.value)) || "");
								const desc = (o && typeof o === "object" && o.description) ? String(o.description) : "";
								const on = picked.indexOf(label) >= 0;
								return h("button", {
									key: oi, type: "button", disabled: busy,
									onClick: () => (q.multiSelect ? toggle(q.id, label) : pickSingle(q, label)),
									style: {
										font: "inherit", textAlign: "left", padding: "7px 10px",
										border: "1px solid " + (on ? C.ink : C.soft),
										background: on ? "#eef4ff" : "#fff",
										borderRadius: "4px", cursor: busy ? "default" : "pointer",
										opacity: busy ? 0.6 : 1
									}
								}, [
									h("div", { key: "l", style: { fontSize: "12px", fontWeight: on ? 600 : 400 } },
										(q.multiSelect ? (on ? "☑ " : "☐ ") : "") + label),
									desc ? h("div", { key: "dd", style: { fontSize: "11px", color: C.muted, marginTop: "2px", lineHeight: 1.6 } }, desc) : null
								]);
							})) : null,

						// 自由文本（"其他"）
						h("div", { key: "free", style: { display: "flex", gap: "6px", marginTop: "7px", alignItems: "center" } }, [
							h("input", {
								key: "i",
								value: text[q.id] || "",
								placeholder: opts.length ? "或直接写你的决定…" : "写下你的决定…",
								onChange: (e) => { const v = e.target.value; setText((t) => { const o = {}; for (const k in t) o[k] = t[k]; o[q.id] = v; return o; }); },
								style: {
									flex: "1 1 220px", fontSize: "12px", padding: "5px 8px",
									border: "1px solid " + C.soft, borderRadius: "4px", outline: "none", background: "#fff"
								}
							}),
							h("button", {
								key: "s", type: "button", disabled: busy || !(text[q.id] || "").trim(),
								onClick: () => submit([{ id: q.id, selected: [], custom: (text[q.id] || "").trim() }]),
								style: {
									font: "inherit", fontSize: "12px", padding: "5px 12px",
									border: "1px solid " + C.ink, background: "#fff", color: C.ink,
									borderRadius: "4px", cursor: busy ? "default" : "pointer"
								}
							}, "提交")
						]),

						q.multiSelect ? h("div", { key: "ms", style: { marginTop: "6px" } }, h("button", {
							type: "button", disabled: busy || !picked.length,
							onClick: () => submitMulti(q),
							style: {
								font: "inherit", fontSize: "12px", padding: "5px 12px",
								border: "1px solid " + C.ink, background: C.ink, color: "#fff",
								borderRadius: "4px", cursor: busy ? "default" : "pointer"
							}
						}, "提交所选（" + picked.length + "）")) : null
					]);
				}),

				done ? h("div", { key: "ok", style: { marginTop: "8px", fontSize: "12px", color: C.ok } }, done) : null,
				err ? h("div", { key: "er", style: { marginTop: "8px", fontSize: "12px", color: C.bad } }, "提交失败：" + err) : null
			]);
		}

		// ── A3 产物：阶段 → 子目录（用于拼绝对路径）──────────────────
		//   ★ `sub` 是**功能根目录下**的子目录名（单轨，§9.1.4）—— 打开文件时拼 `f.root + "/" + sub + "/" + name`。
		//     2026-09-29 修：原来拼的是旧结构 `srWs + "/" + sub`，单轨之后全部指错；
		//     同时补上 `evidence` / `source` 两组（原先根本没有，证据与源文件在页签里看不见）。
		const ARTIFACT_GROUPS = [
			{ key: "concept", label: "概念", sub: "analysis" },
			{ key: "draft", label: "成稿", sub: "gdd" },
			{ key: "final", label: "定稿", sub: "gdd" },
			{ key: "review", label: "审查", sub: "gdd" },
			{ key: "speech", label: "宣讲", sub: "delivery" },
			{ key: "evidence", label: "证据", sub: "evidence" },
			{ key: "source", label: "源文件", sub: "source" },
			{ key: "config", label: "配置表", sub: null },   // 在 config_root，不在功能目录
			{ key: "decision", label: "决策", sub: "decisions" }
		];

		/** 文件名里的日期 → YYYY-MM-DD */
		function fmtNameDate(name) {
			const m = /(\d{4})(\d{2})(\d{2})/.exec(String(name || ""));
			return m ? m[1] + "-" + m[2] + "-" + m[3] : "";
		}

		/**
		 * A3 · 功能详情 · 产物
		 * 按阶段分组列出该功能的全部产物，每行可点开（系统默认程序）。
		 */
		function ArtifactList(props) {
			const f = props.feature;
			const srWs = props.srWs || "";
			const configRoot = props.configRoot || "";
			const onOpen = props.onOpen;
			const [fold, setFold] = React.useState({});

			if (!f || !f.files) return h("div", { style: { color: C.muted, fontSize: "12px" } }, "没有产物数据。");

			const absOf = (groupKey, name) => {
				const g = ARTIFACT_GROUPS.filter((x) => x.key === groupKey)[0];
				if (!g) return "";
				if (g.sub === null) return (configRoot || srWs) + "/" + name;   // 配置表在 config_root
				return (f.root || srWs) + "/" + g.sub + "/" + name;            // ★ 从**功能根目录**出发
			};

			const total = ARTIFACT_GROUPS.reduce((n, g) => n + ((f.files[g.key] || []).length), 0);

			// 一致性提示（能算的都算，不算的不装作算了）
			const notes = [];
			if ((f.files.speech || []).length > 1) {
				notes.push("有 " + f.files.speech.length + " 份宣讲 HTML —— 源一致性需人工确认（工作台不解析 HTML 页脚）");
			}
			if ((f.files.final || []).length > 1) {
				notes.push("有 " + f.files.final.length + " 个定稿版本 —— 按日期，最新的是最终版");
			}

			return h("div", null, [
				h("div", { key: "sum", style: { fontSize: "12px", color: C.muted, marginBottom: "10px" } },
					"共 " + total + " 个产物　" + ARTIFACT_GROUPS
						.map((g) => g.label + " " + ((f.files[g.key] || []).length))
						.filter((s) => !/ 0$/.test(s))
						.join(" · ")),

				...notes.map((t, i) => h("div", {
					key: "n" + i,
					style: {
						border: "1px solid " + C.faint, borderLeft: "3px solid " + C.warn,
						background: "#fffdf7", borderRadius: "4px", padding: "8px 11px",
						fontSize: "12px", marginBottom: "8px"
					}
				}, "⚠ " + t)),

				...ARTIFACT_GROUPS.map((g) => {
					const names = f.files[g.key] || [];
					if (!names.length) return null;
					const isFinal = g.key === "final";
					return h("div", {
						key: g.key,
						style: {
							border: "1px solid " + C.faint, borderRadius: "4px",
							background: "#fff", marginBottom: "9px", overflow: "hidden"
						}
					}, [
						h("div", {
							key: "h",
							onClick: () => setFold((s) => { const o = {}; for (const k in s) o[k] = s[k]; o[g.key] = !s[g.key]; return o; }),
							style: {
								display: "flex", justifyContent: "space-between", alignItems: "center",
								padding: "7px 11px", background: C.bg, cursor: "pointer",
								borderBottom: fold[g.key] ? "none" : "1px solid " + C.faint
							}
						}, [
							h("span", { key: "l", style: { fontSize: "12px", fontWeight: 600 } }, g.label + "（" + names.length + "）"),
							h("span", { key: "t", style: { fontSize: "10px", color: C.muted } }, fold[g.key] ? "展开 ▸" : "收起 ▾")
						]),
						fold[g.key] ? null : h("div", { key: "b", style: { padding: "4px 0" } },
							names.map((n, i) => {
							 const abs = absOf(g.key, n);
							 const st = (isFinal && n === f.latestFinal) ? (f.status || "") : "";
							 return h("div", {
								key: i,
								style: {
									display: "flex", alignItems: "center", gap: "8px",
									padding: "5px 11px", borderTop: i ? "1px solid " + C.faint : "none"
								}
							 }, [
								h("span", {
									key: "b",
									style: {
										fontSize: "10px", fontFamily: "monospace", padding: "0 5px",
										border: "1px solid " + C.soft, borderRadius: "3px",
										color: (isFinal && n === f.latestFinal) ? C.ok : C.muted,
										whiteSpace: "nowrap"
									}
								}, (isFinal && n === f.latestFinal) ? "最终版" : g.label),
								h("button", {
									key: "n", type: "button",
									onClick: () => onOpen(abs),
									title: "点击打开：" + abs,
									style: {
										font: "inherit", fontSize: "12px", fontFamily: "monospace",
										padding: 0, border: "none", background: "none",
										color: "#3b6ea5", cursor: "pointer", textAlign: "left",
										overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
										flex: "1 1 auto", textDecoration: "none"
									}
								}, n),
								st ? h("span", { key: "s", style: { fontSize: "10px", color: C.ok, fontFamily: "monospace" } }, st) : null,
								fmtNameDate(n) ? h("span", { key: "d", style: { fontSize: "10px", color: C.muted, fontFamily: "monospace", whiteSpace: "nowrap" } }, fmtNameDate(n)) : null
							 ]);
							}))
					]);
				}),

				h("div", { key: "foot", style: { marginTop: "12px", fontSize: "11px", color: C.muted, lineHeight: 1.85 } }, [
					h("div", { key: "a" }, "产物来自工作区实时读取；类型由文件名派生，不另存索引。"),
					h("div", { key: "b" }, "点文件名用系统默认程序打开。")
				])
			]);
		}

		// ════════════════════════════════════════════════════════════════
		// 工单 12 · 功能详情：产物按**桶**分组（进 / 出 / 过程留痕）+ 三阶段 + "现在能用吗"
		//   ★ 分组、gdd 细分、三阶段都由 `src/pure/artifacts.ts` 算好（测试覆盖的就是它）。
		//     这里只渲染，**不在这里判"什么文件属于哪个桶"**。
		// ════════════════════════════════════════════════════════════════

		/** 定稿有效性 / V 校验清单的严重程度 → 颜色与词 */
		const CHECK_TONE = { error: { c: C.bad, t: "error" }, warn: { c: C.warn, t: "warn" }, info: { c: C.muted, t: "info" } };

		/** 定稿有效性的**一句话结论**（"现在能用吗"） */
		function finalVerdict(finalCheck) {
			if (!finalCheck) return { text: "（还没读）", tone: null };
			if (!finalCheck.all || !finalCheck.all.length) return { text: "没有定稿 —— 这个功能还交不了程序", tone: "warn" };
			if ((finalCheck.issues || []).some((i) => i.level === "error")) {
				return { text: "有阻断问题：" + finalCheck.issues.filter((i) => i.level === "error").map((i) => i.code).join(" / "), tone: "bad" };
			}
			if (finalCheck.currentFrom === "date") return { text: "没有 active 定稿（按日期取最新：" + finalCheck.current + "）", tone: "warn" };
			return { text: "可用：" + finalCheck.current + "（active）", tone: "ok" };
		}

		/** 今天（YYYYMMDD）—— 产出文件名里的日期由面板给定，纯函数那头不吃时钟 */
		function todayYmd() {
			const d = new Date();
			const p = (n) => (n < 10 ? "0" : "") + n;
			return "" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate());
		}

		/**
		 * ═══ 阶段一 · 头脑风暴工作面（工单 23 · 设计 §4.1 / §4.2）═══
		 *
		 * 四种入口**同一层级平铺、不分主次**（四张动作卡并列，谁也不是谁的前置）；
		 * 每张卡自己组装自己的指令（`INTAKE.buildBrainstormInstruction`，纯函数、有回归网），
		 * 产出规范一致地落 `features\<主题>\analysis\`。
		 *
		 * ★ 面板**不重画流程**：发起之后界面只说"阶段交给了 skill，进度与提问都在那个会话里"，
		 *   并给「跳到那个会话」——阶段内部怎么走由 skill 决定（工单 23 第 2 条）。
		 * ★ 两种新格式就地渲染（设计 §4.2）：旧文档分析=四段固定章节；
		 *   人工补充=**原话与结论并排** —— 一眼能看出 AI 有没有改动结论（工单 23 第 3 条 / 用户故事 10）。
		 * ★ 缺前提不静默：`blocked` + `next` 两行都显示（工单 23 第 4 条）。
		 */
		function BrainstormWorkface(props) {
			const data = props.data;
			const f = props.feature || {};
			const root = props.root || "";
			const exits = (data && data.notes) || [];
			const kinds = (INTAKE && INTAKE.BRAINSTORM_KINDS) || [];

			const [kind, setKind] = React.useState("analysis");
			const [mats, setMats] = React.useState("");
			const [goal, setGoal] = React.useState("");
			const [seed, setSeed] = React.useState("");
			const [seedMats, setSeedMats] = React.useState("");
			const [legacyPath, setLegacyPath] = React.useState("");
			const [legacyName, setLegacyName] = React.useState("");
			const [legacyNote, setLegacyNote] = React.useState("");
			const [title, setTitle] = React.useState("");
			const [quote, setQuote] = React.useState("");
			const [bounds, setBounds] = React.useState("");
			const [landing, setLanding] = React.useState("");
			const [author, setAuthor] = React.useState("");
			const [confidence, setConfidence] = React.useState("high");
			const [sendMsg, setSendMsg] = React.useState(null);
			const [opened, setOpened] = React.useState(null);

			const e = kinds.filter((x) => x.id === kind)[0] || kinds[0] || { id: "", label: "", hint: "", needs: "", output: "", handoff: "" };
			// ★ 四个入口各自的输入**各存一份**：换卡不会把上一张卡的内容带过去
			//   （"每种入口各自组装自己的指令"——输入也各自独立，才不会出现"我明明没填却发出去了"）
			const materials = (kind === "analysis")
				? INTAKE.parseMaterials(mats)
				: (kind === "legacy" ? INTAKE.parseMaterials(legacyPath) : (kind === "concept" ? INTAKE.parseMaterials(seedMats) : []));
			// ★ 卡上显示的就是**要发出去的原文**（组装只有一份实现：`src/pure/intake.ts`）
			const noteText = (kind === "concept") ? seed : (kind === "legacy" ? legacyNote : goal);
			const built = (INTAKE && e.id)
				? INTAKE.buildBrainstormInstruction(e.id, {
					root: root, date: todayYmd(), topic: f.topic || "",
					materials: materials, note: noteText,
					name: legacyName, title: title, quote: quote,
					bounds: bounds, landing: landing, author: author, confidence: confidence
				})
				: { instruction: "", blocked: "头脑风暴的组装器没加载上（intake 模块缺失）。", next: "" };

			const send = () => {
				if (built.blocked) {
					// 缺前提：给出可读提示 + 下一步，**不发指令**（也不装成功）
					setSendMsg({ kind: "blocked", text: built.blocked, next: built.next || "" });
					return;
				}
				if (typeof props.onSend !== "function") {
					setSendMsg({ kind: "err", text: "发送通道没挂上（onSend 缺失）。", next: "刷新页面；仍失败就把这条发给开发者。" });
					return;
				}
				setSendMsg({ kind: "pending", text: "正在发给该功能的专属工作会话…" });
				props.onSend(e.id, {
					text: built.instruction,
					materials: materials, note: noteText,
					name: legacyName, title: title, quote: quote,
					bounds: bounds, landing: landing, author: author, confidence: confidence,
					root: root
				}).then(
					(r) => setSendMsg(r && r.ok
						? { kind: "ok", text: "已交给工作会话。", sid: r.sid || "", target: r.target || null, healed: !!r.healed, queued: !!r.queued, note: r.note || "" }
						: {
							kind: "err",
							text: (r && (r.message || r.blocked || r.note)) || "发送失败",
							next: (r && r.next) || "再按一次；仍失败就把这条错误发给开发者。",
							sid: (r && r.sid) || ""
						}),
					(err) => setSendMsg({ kind: "err", text: String((err && err.message) || err), next: "再按一次。" })
				);
			};
			const jump = (sid) => {
				if (!sid || typeof props.onOpenSession !== "function") {
					setSendMsg((m) => Object.assign({}, m || {}, { jumpErr: "面板拿不到「跳会话」的通道（onOpenSession 没挂上）。" }));
					return;
				}
				const r = props.onOpenSession(sid);
				if (r && r.ok === false) {
					setSendMsg((m) => Object.assign({}, m || {}, {
						jumpErr: "跳转失败：" + ((r.error && (r.error.message || r.error.code)) || "未知原因") + "　—— 你可以在左侧列表里按标题找到它。"
					}));
				}
			};

			// ── 输入区（按入口不同的表单；四张卡本身是并列的，这个区是"选中那张卡的细节"）──
			const IN = {
				flex: "1 1 auto", font: "inherit", fontSize: "11.5px", padding: "5px 8px",
				border: "1px solid " + C.soft, borderRadius: "4px", boxSizing: "border-box"
			};
			const LABEL = { fontSize: "10.5px", color: C.muted, marginBottom: "3px" };
			const field = (key, label, value, set, placeholder, rows) => h("div", { key: key, style: { marginBottom: "7px" } }, [
				h("div", { key: "l", style: LABEL }, label),
				rows
					? h("textarea", {
						key: "i", value: value, placeholder: placeholder, rows: rows,
						onChange: (ev) => set(ev.target.value),
						style: Object.assign({}, IN, { width: "100%", resize: "vertical", fontFamily: "inherit" })
					})
					: h("input", {
						key: "i", value: value, placeholder: placeholder,
						onChange: (ev) => set(ev.target.value),
						style: Object.assign({}, IN, { width: "100%" })
					})
			]);
			const form = () => {
				if (e.id === "analysis") return [
					field("m", "素材（目录 / 文件路径 / 链接，可多行）", mats, setMats, "D:\\素材\\竞品_联盟 或 https://…", 2),
					field("g", "分析目标（选填）", goal, setGoal, "比如：看它的奖池概率与保底怎么配", 2)
				];
				if (e.id === "concept") return [
					field("s", "一句话创意（必填）", seed, setSeed, "比如：联盟成员一起打 BOSS，血量全盟共享", 2),
					field("m", "参考素材（选填，路径 / 链接）", seedMats, setSeedMats, "D:\\素材\\参考.png", 2)
				];
				if (e.id === "legacy") return [
					field("p", "旧文档路径（必填，目录或单个文件）", legacyPath, setLegacyPath, "D:\\旧案\\英雄改造v0.2.xlsx", 2),
					field("n", "名称（选填，产出文件名用它）", legacyName, setLegacyName, "英雄改造 v0.2"),
					field("g", "补充说明（选填）", legacyNote, setLegacyNote, "比如：只看改造消耗与失败返还", 2)
				];
				return [
					field("t", "标题（必填）", title, setTitle, "BOSS 血量按联盟共享"),
					field("q", "原话（必填 —— 逐字保留，AI 只整理格式）", quote, setQuote, "「BOSS 的血条应该是全盟共享的，一个人打全盟都能看到」", 3),
					field("b", "边界（选填）", bounds, setBounds, "仅在活动期间成立；活动结束血条重置", 2),
					field("l", "落点（选填，条目引用）", landing, setLanding, "§4 R2 · §5 UI-M1 UE2"),
					h("div", { key: "row", style: { display: "flex", gap: "7px" } }, [
						h("div", { key: "a", style: { flex: "1 1 auto" } }, field("au", "谁说的（选填）", author, setAuthor, "祖海潮")),
						h("div", { key: "c", style: { flex: "0 0 130px" } }, [
							h("div", { key: "cc", style: LABEL }, "可信度"),
							h("select", {
								key: "cs", value: confidence, onChange: (ev) => setConfidence(ev.target.value),
								style: Object.assign({}, IN, { width: "100%" })
							}, [
								h("option", { key: "h", value: "high" }, "high（可直接当规则口径）"),
								h("option", { key: "p", value: "pending" }, "pending（需补证据）")
							])
						])
					])
				];
			};

			// ── 卡（四张并列：同一层级的兄弟节点，没有主次）──
			const card = (k) => {
				const on = k.id === e.id;
				return h("button", {
					key: "card-" + k.id, type: "button", "data-card": k.id, "data-active": on ? "1" : "0",
					onClick: () => { setKind(k.id); setSendMsg(null); },
					style: {
						flex: "1 1 168px", minWidth: "168px", textAlign: "left", font: "inherit", cursor: "pointer",
						border: "1px solid " + (on ? C.ink : C.faint), borderTop: "3px solid " + (on ? C.ink : C.soft),
						background: on ? "#fff" : C.bg, borderRadius: "4px", padding: "7px 9px"
					}
				}, [
					h("div", { key: "t", style: { fontSize: "12px", fontWeight: 600, color: C.ink } }, k.label),
					h("div", { key: "h", style: { fontSize: "10px", color: C.link, fontFamily: "monospace", marginTop: "2px" } }, k.hint),
					h("div", { key: "n", style: { fontSize: "10px", color: C.muted, marginTop: "4px", lineHeight: 1.65 } }, "前置：" + k.needs),
					h("div", { key: "o", style: { fontSize: "10px", color: C.muted, marginTop: "3px", lineHeight: 1.65 } }, "产出：" + k.output)
				]);
			};

			// ── 两种新格式的渲染（设计 §4.2）──
			const secTitle = { fontSize: "11px", fontWeight: 600, color: C.ink, marginBottom: "2px" };
			const secBody = {
				fontSize: "11px", color: C.ink, whiteSpace: "pre-wrap", userSelect: "text", lineHeight: 1.7,
				background: "#fff", border: "1px solid " + C.faint, borderRadius: "3px", padding: "5px 7px"
			};
			const legacyView = (doc) => h("div", { key: "lv", "data-doc": "legacy", "data-name": doc.name }, [
				h("div", { key: "meta", style: { fontSize: "10.5px", color: C.muted, marginBottom: "6px", lineHeight: 1.7 } }, [
					h("div", { key: "a" }, "原件：" + (doc.source || "(frontmatter 里没写 source)") + "　（原件存 source\\ —— 产出文档的身份信息指回原件）"),
					h("div", { key: "b" }, "topic：" + (doc.topic || "(空)") + "　analyzed_at：" + (doc.analyzedAt || "(空)"))
				]),
				doc.missing && doc.missing.length
					? h("div", { key: "miss", "data-missing": doc.missing.join("|"), style: { fontSize: "11px", color: C.warn, marginBottom: "6px" } },
						"⚠ 缺 " + doc.missing.length + " 段固定章节：" + doc.missing.join(" / ") + " —— 这份产出不完整（四段一个都不能少）")
					: null,
				doc.sections.map((s, i) => h("div", { key: "s" + i, "data-sec": s.key, style: { marginBottom: "6px" } }, [
					h("div", { key: "t", style: secTitle }, (s.present ? "## " : "##（缺）") + s.label),
					s.key === "reuse" && s.present
						? h("table", { key: "tb", style: { width: "100%", borderCollapse: "collapse", fontSize: "10.5px" } }, [
							h("thead", { key: "h" }, h("tr", null, doc.reuse.header.map((c, j) => h("th", { key: j, style: TH }, c)))),
							h("tbody", { key: "b" }, doc.reuse.rows.map((r, j) => h("tr", { key: j }, r.map((c, m) => h("td", { key: m, style: TD }, c)))))
						])
						: h("div", { key: "b", style: secBody }, s.present ? (s.body || "（空）") : "（这一段没有）")
				])),
				doc.extra && doc.extra.length
					? h("div", { key: "ex", "data-extra": String(doc.extra.length), style: { fontSize: "10.5px", color: C.muted, marginTop: "4px" } },
						"其他章节（不认识的标题也不丢）：" + doc.extra.map((x) => x.title).join(" / "))
					: null
			]);
			/**
			 * 人工补充：**原话与结论并排**。
			 * 左列是原话那一行（逐字，`userSelect: text`），右列是 AI 整理的结论 —— 两列是同一个
			 * flex 行里的兄弟节点，所以"一眼能看出有没有被改动"这件事在界面上是物理成立的。
			 */
			const noteView = (doc) => h("div", { key: "hn", "data-doc": "humannote", "data-name": doc.name }, [
				h("div", { key: "meta", style: { fontSize: "10.5px", color: C.muted, marginBottom: "6px", lineHeight: 1.7 } }, [
					h("div", { key: "a" }, "confidence：" + (doc.confidence || "(空)") + "　date：" + (doc.date || "(空)") + "　author：" + (doc.author || "(空)") +
						"　（confidence 是唯一的可信度字段：high = 可直接当规则口径；pending = 下游引用要带标记）"),
					h("div", { key: "b" }, "topic：" + (doc.topic || "(空)") + "　标题：" + (doc.title || "(空)"))
				]),
				doc.quote.found
					? h("div", {
						key: "pair", "data-pair": "quote|conclusion",
						style: { display: "flex", gap: "10px", alignItems: "stretch", marginBottom: "7px" }
					}, [
						h("div", { key: "q", "data-side": "quote", style: { flex: "1 1 50%", minWidth: 0 } }, [
							h("div", { key: "t", style: secTitle }, "我说的话（原话 · 逐字）"),
							h("div", { key: "b", style: Object.assign({}, secBody, { borderLeft: "3px solid " + C.link }) }, doc.quote.raw)
						]),
						h("div", { key: "c", "data-side": "conclusion", style: { flex: "1 1 50%", minWidth: 0 } }, [
							h("div", { key: "t", style: secTitle }, "AI 整理的结论（并排比对：有没有改动我的结论）"),
							h("div", { key: "b", style: secBody }, doc.conclusion || "（这一段没有）")
						])
					])
					: h("div", { key: "noq", "data-side": "quote-missing", style: { fontSize: "11px", color: C.warn, marginBottom: "6px" } },
						"⚠ 这份产出里没有 `> 原话：…` 那一行 —— 按格式要求它必须逐字保留，否则看不出 AI 有没有改动结论。"),
				doc.sections.filter((s) => s.key !== "conclusion").map((s, i) => h("div", { key: "s" + i, "data-sec": s.key, style: { marginBottom: "6px" } }, [
					h("div", { key: "t", style: secTitle }, (s.present ? "## " : "##（缺）") + s.label),
					h("div", { key: "b", style: secBody }, s.present ? (s.body || "（空）") : "（这一段没有）")
				])),
				doc.extra && doc.extra.length
					? h("div", { key: "ex", "data-extra": String(doc.extra.length), style: { fontSize: "10.5px", color: C.muted, marginTop: "4px" } },
						"其他章节（不丢）：" + doc.extra.map((x) => x.title).join(" / "))
					: null
			]);

			const groups = (data && data.groups) || { entries: [], other: [], total: 0 };
			const docById = (id, name) => {
				const list = id === "legacy" ? ((data && data.legacy) || []) : ((data && data.humannote) || []);
				return list.filter((x) => x.name === name)[0] || null;
			};
			const fileRow = (g, file, i) => {
				const isNew = g.id === "legacy" || g.id === "humannote";
				const open = opened && opened.id === g.id && opened.name === file.name;
				return h("div", {
					key: "f" + g.id + i, "data-file": file.name,
					onClick: () => {
						if (isNew) setOpened(open ? null : { id: g.id, name: file.name });
						else if (props.onOpen) props.onOpen(root.replace(/\\+$/, "") + "\\" + String(file.rel || file.name).replace(/\//g, "\\"));
					},
					style: {
						fontSize: "11px", padding: "2px 4px", borderRadius: "3px", cursor: "pointer",
						background: open ? "#f0f7ff" : "transparent", color: C.ink
					}
				}, (isNew ? (open ? "▾ " : "▸ ") : "· ") + file.name + (isNew ? "　（新格式：点开看渲染）" : ""));
			};

			return h("div", { "data-workface": "brainstorm" }, [
				// ① 出口判据（设计 §4.3）—— analysis 空而 source 有料 ⇒ 建议先跑一次分析
				exits.length
					? h("div", {
						key: "exit", "data-exit": "note",
						style: { fontSize: "11.5px", color: C.warn, border: "1px solid " + C.faint, borderLeft: "3px solid " + C.warn, background: "#fffdf7", borderRadius: "4px", padding: "7px 10px", marginBottom: "10px" }
					}, exits.map((x, i) => h("div", { key: i }, "⚠ " + x)))
					: null,

				// ② 四张并列的动作卡（同一层级、不分主次）
				h("div", { key: "row", "data-row": "entrances", style: { display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" } },
					kinds.map(card)),

				// ③ 选中那张卡的输入 + **要发出去的原文**（逐字）
				h("div", {
					key: "detail", "data-entrance": e.id,
					style: { border: "1px solid " + C.faint, borderRadius: "4px", background: "#fff", padding: "9px 11px", marginBottom: "10px" }
				}, [
					h("div", { key: "h", style: { fontSize: "12px", marginBottom: "6px" } }, [
						h("b", { key: "b" }, e.label + "　"),
						h("span", { key: "s", style: { color: C.muted, fontSize: "10.5px" } }, e.hint + "　前置：" + e.needs + "　产出：" + e.output)
					]),
					h("div", { key: "f" }, form()),
					built.blocked
						? h("div", {
							key: "blk", "data-blocked": e.id,
							style: { fontSize: "11.5px", color: C.bad, background: "#fef2f2", border: "1px solid " + C.faint, borderRadius: "3px", padding: "6px 8px", marginBottom: "7px", lineHeight: 1.75 }
						}, [
							h("div", { key: "a" }, "✗ " + built.blocked),
							built.next ? h("div", { key: "b", style: { color: C.ink } }, "下一步：" + built.next) : null
						])
						: null,
					built.instruction
						? h("div", { key: "pv", style: { marginBottom: "7px" } }, [
							h("div", { key: "t", style: LABEL }, "这条入口组装出来的指令 —— 下面这段就是发给工作会话的原文（卡上看到的 = 发出去的）："),
							h("pre", {
								key: "v", "data-kind": e.id,
								style: {
									margin: "3px 0 0", padding: "6px 8px", background: C.bg, border: "1px solid " + C.faint,
									borderRadius: "3px", fontFamily: "monospace", fontSize: "10.5px", lineHeight: 1.6,
									whiteSpace: "pre-wrap", color: C.ink, userSelect: "text", maxHeight: "26vh", overflow: "auto"
								}
							}, built.instruction)
						])
						: null,
					h("div", { key: "act", style: { display: "flex", gap: "8px", alignItems: "center" } }, [
						h("button", {
							key: "go", type: "button", "data-send": e.id,
							onClick: send,
							style: {
								font: "inherit", fontSize: "11.5px", padding: "5px 12px", borderRadius: "4px",
								border: "1px solid " + (built.blocked ? C.soft : C.link),
								background: built.blocked ? "#fff" : C.link, color: built.blocked ? C.muted : "#fff",
								cursor: "pointer"
							}
						}, "发到工作会话"),
						h("span", { key: "n", style: { fontSize: "10.5px", color: C.muted } }, "发到：本功能的专属工作会话" + (root ? "（cwd " + winPath(root) + "）" : "") + "　—— 不占用你自己的对话")
					]),
					// 发起之后：**面板不重画流程**，只交代"阶段交给了谁"
					h("div", { key: "ho", "data-handoff": e.id, style: { fontSize: "10.5px", color: C.muted, marginTop: "5px", lineHeight: 1.7 } },
						"发起后：" + e.handoff + " —— 面板只给「跳到那个会话」。"),
					sendMsg ? h("div", {
						key: "m",
						style: { fontSize: "11px", marginTop: "6px", lineHeight: 1.75, color: sendMsg.kind === "err" || sendMsg.kind === "blocked" ? C.bad : (sendMsg.kind === "ok" ? C.ok : C.muted) }
					}, [
						h("div", { key: "t" }, (sendMsg.kind === "ok" ? "✓ " : (sendMsg.kind === "pending" ? "" : "✗ ")) + sendMsg.text),
						sendMsg.kind === "ok" ? h("div", {
							key: "d", "data-sent": "ok", style: { color: C.muted, userSelect: "text" }
						}, [
							// ★ 工单 23 第 2 条：这句话就是"面板不在会话里重画流程"的表达
							h("div", { key: "s" }, "阶段交给了 skill，进度与提问都在那个会话里 —— 面板不重画流程，跑完回本页重进就能看到产物。"),
							h("div", { key: "g" },
								"目标：" + ((sendMsg.target && sendMsg.target.title) || "工作会话") +
								(sendMsg.sid ? "　会话 " + String(sendMsg.sid).slice(0, 12) + "…" : "") +
								(sendMsg.target && sendMsg.target.root ? "　cwd " + winPath(sendMsg.target.root) : "") +
								"　（" + pickSourceText(sendMsg.target && sendMsg.target.source) + "）"),
							sendMsg.healed ? h("div", { key: "h", style: { color: C.warn } }, "上一轮记的那条会话已经不在了 —— 已自动重建一条并重发。") : null,
							sendMsg.queued ? h("div", { key: "q", style: { color: C.warn } }, "它正在跑别的活，这条指令排在队列里，等它跑完当前这一轮就会处理。") : null
						]) : null,
						sendMsg.kind === "err" || sendMsg.kind === "blocked"
							? h("div", { key: "n", "data-sent": "fail", style: { color: C.ink } }, "下一步：" + (sendMsg.next || "再按一次。"))
							: null,
						sendMsg.sid && props.onOpenSession ? h("button", {
							key: "j", type: "button", "data-jump": sendMsg.sid,
							onClick: () => jump(sendMsg.sid),
							style: {
								font: "inherit", fontSize: "11px", padding: "2px 9px", marginTop: "3px",
								border: "1px solid " + C.soft, background: "#fff", borderRadius: "4px", cursor: "pointer"
							}
						}, "跳到那个会话 ›") : null,
						sendMsg.jumpErr ? h("div", { key: "je", style: { color: C.bad } }, sendMsg.jumpErr) : null
					]) : null
				]),

				// ④ 已有的分析结论（按四入口分类 —— 四组恒在，空组 = 这一路还没走过）
				h("div", { key: "have", style: { border: "1px solid " + C.faint, borderRadius: "4px", background: C.bg, padding: "8px 10px" } }, [
					h("div", { key: "t", style: { fontSize: "11.5px", fontWeight: 600, marginBottom: "5px" } },
						"已有的分析结论（" + (groups.total || 0) + " 件，按入口分）" +
						(f && f.topic ? "　功能：" + f.topic : "")),
					!data ? h("div", { key: "ld", style: { fontSize: "11px", color: C.muted } }, "正在读 analysis\\ 里的产物…") : null,
					data && data.error ? h("div", { key: "er", style: { fontSize: "11px", color: C.bad } }, data.error) : null,
					data && !data.error
						? h("div", { key: "g" }, (groups.entries || []).map((g) => h("div", {
							key: "e" + g.id, "data-group": g.id,
							style: { marginBottom: "5px", borderTop: "1px solid " + C.faint, paddingTop: "5px" }
						}, [
							h("div", { key: "h", style: { fontSize: "11px" } }, [
								h("b", { key: "b" }, g.label),
								h("span", { key: "c", style: { color: C.muted } }, "　" + g.count + " 件" + (g.count === 0 ? "（这一路还没走过）" : ""))
							]),
							h("div", { key: "f" }, (g.files || []).map((file, i) => fileRow(g, file, i)))
						])).concat((groups.other && groups.other.length) ? [h("div", {
							key: "eother", "data-group": "other", style: { marginBottom: "5px", borderTop: "1px solid " + C.faint, paddingTop: "5px" }
						}, [
							h("div", { key: "h", style: { fontSize: "11px" } }, [h("b", { key: "b" }, "其他 / 来源未知"), h("span", { key: "c", style: { color: C.muted } }, "　" + groups.other.length + " 件（认不出属于哪一路，如实列出）")]),
							h("div", { key: "f" }, groups.other.map((file, i) => fileRow({ id: "other" }, file, i)))
						])] : []))
						: null,
					data && (data.unreadable || []).length
						? h("div", { key: "un", style: { fontSize: "10.5px", color: C.warn, marginTop: "4px" } },
							(data.unreadable || []).map((x, i) => h("div", { key: i }, "⚠ 读不动：" + x.name + "（" + x.why + "）")))
						: null,
					// 两种新格式的渲染（点上面的文件名展开）
					opened && opened.id === "legacy" && docById("legacy", opened.name) ? legacyView(docById("legacy", opened.name)) : null,
					opened && opened.id === "humannote" && docById("humannote", opened.name) ? noteView(docById("humannote", opened.name)) : null
				])
			]);
		}

		/**
		 * ★ 工单 24 · **文档生成工作面**（「文档生成」这一格从"未实现"变成真的）。
		 *
		 * 这一屏自上而下四件事，顺序就是"先看状态、再动手"：
		 *   ① **配置支线走到哪**（`configBranchState` 的结论原文，不是这里现算的）——
		 *      `gdd-pipeline.md` §一的四步链路（成稿 → 配置表 → 读回 → 定稿）+ 缺口逐条；
		 *   ② **三个动作卡**（写成稿 / 改成稿 / 发起整合定稿）—— 一条链，有先后，不是并列四入口；
		 *   ③ **两大部分**（§4 功能规则 / §5 用户体验与界面流程）—— 后续两条支线的依据，可点即定位；
		 *   ④ **左树 + 分块正文**（章 / 组 / 条目 + 1-based 行号；正文按块渲染 + **块级错误边界**）。
		 *
		 * ★ 数据全部来自 `loadDraftWorkface`（`src/load/draft.ts`）+ `src/pure/drafttree.ts` /
		 *   `draftstep.ts`：**面板不重新解析、不重新组装**——卡上看到的原文与发出去的是同一段字符串
		 *   （工单 15 / 23 立下的口径，这里照做）。
		 * ★ 面板**不重做 Excel**（spec.md:212）：配置表的存在性由看板按主题挂上来的真实文件名给，
		 *   字段/记录级的一切都在 skill 与配置表工具侧；这一屏只报状态。
		 */
		function DraftWorkface(props) {
			const data = props.data;
			const root = props.root || "";
			const doc = (data && data.doc) || null;
			const config = (data && data.config) || null;
			const notes = (data && data.notes) || [];
			const actions = (INTAKE && INTAKE.DRAFT_ACTIONS) || [];
			const phases = (INTAKE && INTAKE.DRAFT_PHASES) || [];
			const story = (data && data.story) || {};
			/** Y 形两层的动作 id（`DRAFT_PHASES`；表只有一份，这里只是按阶段取） */
			const cardIds = ((phases.filter((p) => p.key === "card")[0] || {}).ids) || [];
			const defOf = (id) => actions.filter((x) => x.id === id)[0] ||
				{ id: id, label: id, hint: "", needs: "", output: "", handoff: "" };
			const [act, setAct] = React.useState("create");
			const [seed, setSeed] = React.useState("");
			const [mats, setMats] = React.useState("");
			const [where, setWhere] = React.useState("");
			const [before, setBefore] = React.useState("§5");
			const [intent, setIntent] = React.useState("");
			/** 支线 B 的图路径（粘的 + 从 `gdd\UI\` 里挑的，逐行） */
			const [wirePaste, setWirePaste] = React.useState("");
			const [picked, setPicked] = React.useState([]);
			/** 三个「先展开输入/预览，再发」的入口 + 三个折叠区（两大部分 / 看正文 / 详情） */
			const [openCfg, setOpenCfg] = React.useState(false);
			const [openWire, setOpenWire] = React.useState(false);
			const [openInt, setOpenInt] = React.useState(false);
			const [openParts, setOpenParts] = React.useState(false);
			const [openBody, setOpenBody] = React.useState(false);
			const [openMachine, setOpenMachine] = React.useState(false);
			/** ★ 工单 25 · 定稿门（合流之后的落点）：首屏只给一行人话，明细折在这里 */
			const [openGate, setOpenGate] = React.useState(false);
			const [sendMsg, setSendMsg] = React.useState({});
			const [openG, setOpenG] = React.useState({});
			const [sel, setSel] = React.useState(-1);
			const bodyRef = React.useRef(null);

			const e = actions.filter((x) => x.id === act)[0] || actions[0] ||
				{ id: "", label: "", hint: "", needs: "", output: "", handoff: "" };

			/** 今天，`YYYY-MM-DD`（**只有一处**：指令预览与真正发出去的必须是同一天） */
			const today = (() => { const s = todayYmd(); return s.slice(0, 4) + "-" + s.slice(4, 6) + "-" + s.slice(6, 8); })();

			/** 组标识：有 `id`（R1 / UI-M1）用它，否则退回组号（5.0）——与 `finaltree.groupKey` 同口径 */
			const gk = (g) => String(g.id || g.no || "");
			/** 章号 → 它在哪一部分（两大部分高亮 + 组行上的归属标记） */
			const partOfNo = (no) => {
				const hit = (((doc && doc.parts) || []).filter((p) => p.no === String(no))[0]) || null;
				return hit ? hit.key : "";
			};
			/** 组行上标 §4 / §5（只标两大部分里的组，别处不标） */
			const partTag = (no) => {
				const k = partOfNo(no);
				return k === "rules" ? "§4 规则" : k === "ux" ? "§5 界面" : "";
			};

			// ★ 卡上显示的就是**要发出去的原文**（组装只有一份实现：`src/pure/draftstep.ts`）
			//   五个动作的公共入参**只拼一次**（`common`）—— 五个分支各自的差异由 `act` 决定。
			const common = {
				root: root, topic: (data && data.topic) || "", date: today,
				draftPath: (data && data.path) || "",
				configLabel: (config && config.label) || "",
				configMissing: (config && config.missing) || [],
				contract: (config && config.facts && config.facts.contract) || null,
				parts: (doc && doc.parts) || [],
				readbacks: (config && config.facts && config.facts.readbacks) || [],
				ascii: (data && data.ascii) || []
			};
			const build = (over) => (INTAKE && INTAKE.buildDraftInstruction)
				? INTAKE.buildDraftInstruction(Object.assign({}, common, { action: "create" }, over || {}))
				: { instruction: "", blocked: "文档生成的组装器没加载上（draftstep 模块缺失）。", next: "" };

			/** 支线 B 的输入（逐行；粘的 + 挑的，去重保序）—— **路径是唯一可靠输入** */
			const wirePaths = (() => {
				const out = [];
				const seen = {};
				const push = (s) => {
					const v = String(s == null ? "" : s).trim().replace(/^file:\/\/\/?/i, "");
					if (v === "" || seen[v]) return;
					seen[v] = true;
					out.push(v);
				};
				for (const x of picked) push(x);
				for (const line of String(wirePaste).split(/\r?\n/)) push(line);
				return out;
			})();

			/** 五个动作各自的「要发出去的原文」（组装只有一份实现；卡上看到的 = 发出去的） */
			const builtOf = (id) => {
				if (id === "create") return build({ action: "create", intent: seed, materials: INTAKE.parseMaterials(mats) });
				if (id === "revise") return build({ action: "revise", where: where, before: before, intent: intent });
				if (id === "config") return build({ action: "config", where: where, intent: intent });
				if (id === "wireframe") return build({ action: "wireframe", where: where, images: wirePaths });
				return build({ action: "integrate" });
			};
			const built = builtOf(e.id);
			const builtWire = builtOf("wireframe");
			const builtCfg = builtOf("config");
			const builtInt = builtOf("integrate");

			/** 发一条指令（正文由上面的组装器给；`built.blocked` 时**不发**，原样显示提示） */
			const sendOne = (id, b, tag) => {
				if (b.blocked) {
					setSendMsg((m) => Object.assign({}, m || {}, { [id]: { kind: "blocked", text: b.blocked, next: b.next || "" } }));
					return;
				}
				if (typeof props.onSend !== "function") {
					setSendMsg((m) => Object.assign({}, m || {}, { [id]: { kind: "err", text: "发送通道没挂上（onSend 缺失）。", next: "刷新页面；仍失败就把这条发给开发者。" } }));
					return;
				}
				setSendMsg((m) => Object.assign({}, m || {}, { [id]: { kind: "pending", text: "正在发给该功能的专属工作会话…" } }));
				props.onSend(id, { text: b.instruction, root: root }).then(
					(r) => setSendMsg((m) => Object.assign({}, m || {}, {
						[id]: r && r.ok
							? { kind: "ok", text: "已交给工作会话。", sid: r.sid || "", target: r.target || null, healed: !!r.healed, queued: !!r.queued, note: r.note || "" }
							: {
								kind: "err",
								text: (r && (r.message || r.blocked || r.note)) || "发送失败",
								next: (r && r.next) || "再按一次；仍失败就把这条错误发给开发者。",
								sid: (r && r.sid) || ""
							}
					})),
					(err) => setSendMsg((m) => Object.assign({}, m || {}, { [id]: { kind: "err", text: String((err && err.message) || err), next: "再按一次。" } }))
				);
			};
			const sendWire = () => sendOne("wireframe", builtWire);
			const sendCfg = () => sendOne("config", builtCfg);
			const sendInt = () => sendOne("integrate", builtInt);

			const jump = (sid) => {
				if (!sid || typeof props.onOpenSession !== "function") {
					setSendMsg((m) => Object.assign({}, m || {}, { jumpErr: "面板拿不到「跳会话」的通道（onOpenSession 没挂上）。" }));
					return;
				}
				const r = props.onOpenSession(sid);
				if (r && r.ok === false) {
					setSendMsg((m) => Object.assign({}, m || {}, {
						jumpErr: "跳转失败：" + ((r.error && (r.error.message || r.error.code)) || "未知原因") + "　—— 你可以在左侧列表里按标题找到它。"
					}));
				}
			};

			/** 点一条 → 正文滚到那一块（不依赖 markdown 渲染器支持行锚点） */
			const goto = (idx) => {
				setSel(Number(idx));
				const box = bodyRef.current;
				if (!box || !box.querySelector || Number(idx) < 0) return;
				const el = box.querySelector('[data-blk="' + Number(idx) + '"]');
				if (el && el.scrollIntoView) el.scrollIntoView({ block: "start" });
			};

			const IN = {
				flex: "1 1 auto", font: "inherit", fontSize: "11.5px", padding: "5px 8px",
				border: "1px solid " + C.soft, borderRadius: "4px", boxSizing: "border-box"
			};
			const LABEL = { fontSize: "10.5px", color: C.muted, marginBottom: "3px" };
			const field = (key, label, value, set, placeholder, rows) => h("div", { key: key, style: { marginBottom: "7px" } }, [
				h("div", { key: "l", style: LABEL }, label),
				rows
					? h("textarea", {
						key: "i", value: value, placeholder: placeholder, rows: rows,
						onChange: (ev) => set(ev.target.value),
						style: Object.assign({}, IN, { width: "100%", resize: "vertical", fontFamily: "inherit" })
					})
					: h("input", {
						key: "i", value: value, placeholder: placeholder,
						onChange: (ev) => set(ev.target.value),
						style: Object.assign({}, IN, { width: "100%" })
					})
			]);

			// ── 折叠区（**默认收起**：收起时里面的字根本不渲染，不是拿 CSS 藏）──
			//   `data-fold` = 这是哪一折，`data-open` = 0/1（渲染级 harness 靠它判"在不在首屏"）
			const fold = (key, title, open, onToggle, kids, extra) => h("div", {
				key: key, style: Object.assign({ marginTop: "10px" }, (extra && extra.style) || {})
			}, [
				h("button", {
					key: "s", type: "button", "data-fold": key, "data-open": open ? "1" : "0",
					"data-btn": extra && extra.btn ? extra.btn : "link",
					onClick: onToggle, "aria-expanded": open ? "true" : "false",
					style: {
						font: "inherit", fontSize: "12.5px", textAlign: "left", cursor: "pointer",
						border: "1px solid " + (extra && extra.solid ? C.soft : "transparent"),
						background: "#fff", borderRadius: "4px", padding: (extra && extra.solid ? "4px 10px" : "0"),
						color: (extra && extra.tone) || C.muted, textDecoration: (extra && extra.solid ? "none" : "underline")
					}
				}, [
					h("span", { key: "a", "data-fold-arrow": open ? "1" : "0" }, (open ? "▾ " : "▸ ")),
					h("span", { key: "b" }, title),
					open && extra && extra.openHint ? h("span", { key: "c", style: { color: C.muted, marginLeft: "6px" } }, extra.openHint) : null
				]),
				open ? h("div", { key: "b", "data-fold-body": key }, kids) : null
			]);

			/** 一行状态 + 一个小标记（**人话**：不带 `missing-pending` 这种机器口径） */
			const sayLine = (key, text, tone, chip) => h("div", {
				key: key, "data-say": key,
				style: { display: "flex", gap: "8px", alignItems: "baseline", flexWrap: "wrap" }
			}, [
				h("span", {
					key: "t", "data-say-text": key,
					style: { fontSize: "12.5px", lineHeight: "1.75", color: tone === "warn" ? C.ink : C.ink }
				}, text),
				chip ? h("span", {
					key: "c", "data-chip": key,
					style: {
						fontSize: "11.5px", color: tone === "ok" ? C.ok : tone === "warn" ? C.warn : C.muted,
						border: "1px solid " + (tone === "ok" ? C.ok : tone === "warn" ? C.warn : C.soft),
						borderRadius: "2px", padding: "0 5px", whiteSpace: "nowrap"
					}
				}, chip) : null
			]);

			/** 次按钮（首屏上除主按钮之外的一切动作都必须是它或链接） */
			const ghost = (key, label, onClick, title, dis) => h("button", {
				key: key, type: "button", "data-btn": "ghost", onClick: onClick, title: title || "",
				style: {
					font: "inherit", fontSize: "11.5px", padding: "4px 11px", borderRadius: "4px",
					border: "1px solid " + (dis ? C.faint : C.soft), background: "#fff",
					color: dis ? C.muted : C.ink, cursor: "pointer"
				}
			}, label);

			/** 指令预览 + 发送 + 回报（**预览就是发出去的原文**；卡上看到的 = 发出去的） */
			const actBlock = (key, id, b, goLabel, hint) => {
				// ★ 每个动作各记一份回报状态（`sendMsg[id]`）；**没发过时是 undefined** —— 这里必须
				//   先取到局部变量再判空（第一版写成 `sendMsg[id] ? … : sendMsg[id].kind` 是自相矛盾的，
				//   渲染层写成了"有才渲染、没发过却又要读 kind" ⇒ 渲染期 TypeError，实测踩到）。
				const m = (sendMsg || {})[id];
				return h("div", {
				key: key, "data-actbox": id,
				style: { marginTop: "8px", borderTop: "1px solid " + C.faint, paddingTop: "7px" }
			}, [
				b.blocked
					? h("div", {
						key: "blk", "data-blocked": id,
						style: { fontSize: "11.5px", color: C.bad, background: "#fef2f2", border: "1px solid " + C.faint, borderRadius: "3px", padding: "6px 8px", marginBottom: "7px", lineHeight: 1.75 }
					}, [
						h("div", { key: "a" }, "✗ " + b.blocked),
						b.next ? h("div", { key: "b", style: { color: C.ink } }, "下一步：" + b.next) : null
					])
					: null,
				b.instruction
					? h("div", { key: "pv", style: { marginBottom: "7px" } }, [
						h("div", { key: "t", style: LABEL }, "组出来的指令 —— 下面这段就是发给工作会话的原文（卡上看到的 = 发出去的）："),
						h("pre", {
							key: "v", "data-kind": id,
							style: {
								margin: "3px 0 0", padding: "6px 8px", background: C.bg, border: "1px solid " + C.faint,
								borderRadius: "3px", fontFamily: "monospace", fontSize: "10.5px", lineHeight: 1.6,
								whiteSpace: "pre-wrap", color: C.ink, userSelect: "text", maxHeight: "26vh", overflow: "auto"
							}
						}, b.instruction)
					])
					: null,
				h("div", { key: "act", style: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" } }, [
					h("button", {
						key: "go", type: "button", "data-send": id, onClick: b === builtWire ? sendWire : (b === builtCfg ? sendCfg : (b === builtInt ? sendInt : sendOne.bind(null, id, b))),
						style: {
							font: "inherit", fontSize: "11.5px", padding: "5px 12px", borderRadius: "4px",
							border: "1px solid " + (b.blocked ? C.soft : C.link),
							background: b.blocked ? "#fff" : C.link, color: b.blocked ? C.muted : "#fff", cursor: "pointer"
						}
					}, goLabel),
					h("span", { key: "n", style: { fontSize: "10.5px", color: C.muted } },
						hint || ("发到：本功能的专属工作会话" + (root ? "（cwd " + winPath(root) + "）" : "") + "　—— 不占用你自己的对话"))
				]),
				m ? h("div", {
					key: "m",
					style: { fontSize: "11px", marginTop: "6px", lineHeight: 1.75, color: m.kind === "err" || m.kind === "blocked" ? C.bad : (m.kind === "ok" ? C.ok : C.muted) }
				}, [
					h("div", { key: "t" }, (m.kind === "ok" ? "✓ " : (m.kind === "pending" ? "" : "✗ ")) + m.text),
					m.kind === "ok" ? h("div", { key: "d", "data-sent": "ok", style: { color: C.muted, userSelect: "text" } }, [
						h("div", { key: "s" }, "阶段交给了 skill，进度与提问都在那个会话里 —— 面板不重画流程，跑完回本页重进就能看到产物。"),
						h("div", { key: "g" },
							"目标：" + ((m.target && m.target.title) || "工作会话") +
							(m.sid ? "　会话 " + String(m.sid).slice(0, 12) + "…" : "") +
							(m.target && m.target.root ? "　cwd " + winPath(m.target.root) : "") +
							"　（" + pickSourceText(m.target && m.target.source) + "）"),
						m.healed ? h("div", { key: "h", style: { color: C.warn } }, "上一轮记的那条会话已经不在了 —— 已自动重建一条并重发。") : null,
						m.queued ? h("div", { key: "q", style: { color: C.warn } }, "它正在跑别的活，这条指令排在队列里，等它跑完当前这一轮就会处理。") : null
					]) : null,
					m.kind === "err" || m.kind === "blocked"
						? h("div", { key: "n", "data-sent": "fail", style: { color: C.ink } }, "下一步：" + (m.next || "再按一次。"))
						: null,
					m.sid && props.onOpenSession ? h("button", {
						key: "j", type: "button", "data-jump": m.sid,
						onClick: () => jump(m.sid),
						style: {
							font: "inherit", fontSize: "11px", padding: "2px 9px", marginTop: "3px",
							border: "1px solid " + C.soft, background: "#fff", borderRadius: "4px", cursor: "pointer"
						}
					}, "跳到那个会话 ›") : null
				]) : null
			]);
			};

			// ── 选中那张卡的输入（纸面动作各自的表单）──
			const form = () => {
				if (e.id === "create") return [
					field("s", "要写成什么（我的意图；选填 —— 空着就按上游材料与 VOI 门现场确认）", seed, setSeed,
						"比如：把 sr-analysis 的复刻规格落成成稿，重点写清出刀时机与难度推进", 2),
					field("m", "上游材料（选填，目录 / 文件路径 / 链接，可多行）", mats, setMats,
						"D:\\TimeMachine\\GameDesignOS\\workspace\\features\\联盟悬赏\\analysis\\feature-concept_联盟悬赏_20260918.md", 2)
				];
				if (e.id === "revise") return [
					field("w", "改哪儿（条目引用 / 章组号）", where, setWhere, "§4 R6 奖励　或　§5 UI-M1", 1),
					field("b", "现状原文（逐字 —— 行号会漂，原文不会）", before, setBefore,
						"| 终结奖励 | 击杀 BOSS（打出终结一击）的玩家获得… |", 3),
					field("t", "要改成什么（一句话）", intent, setIntent, "终结奖励与通关奖励合并为一个宝箱入口", 1)
				];
				return [];
			};

			// ── 动作卡（三张，**有先后**：写成稿 → 改成稿 → 发起整合定稿）──
			const card = (a) => {
				const on = a.id === e.id;
				return h("button", {
					key: "card-" + a.id, type: "button", "data-dcard": a.id, "data-active": on ? "1" : "0",
					onClick: () => { setAct(a.id); setSendMsg(null); },
					style: {
						flex: "1 1 200px", minWidth: "200px", textAlign: "left", font: "inherit", cursor: "pointer",
						border: "1px solid " + (on ? C.ink : C.faint), borderTop: "3px solid " + (on ? C.ink : C.soft),
						background: on ? "#fff" : C.bg, borderRadius: "4px", padding: "7px 9px"
					}
				}, [
					h("div", { key: "t", style: { fontSize: "12px", fontWeight: 600, color: C.ink } }, a.label),
					h("div", { key: "h", style: { fontSize: "10px", color: C.link, fontFamily: "monospace", marginTop: "2px" } }, a.hint),
					h("div", { key: "n", style: { fontSize: "10px", color: C.muted, marginTop: "4px", lineHeight: 1.65 } }, "前置：" + a.needs),
					h("div", { key: "o", style: { fontSize: "10px", color: C.muted, marginTop: "3px", lineHeight: 1.65 } }, "产出：" + a.output)
				]);
			};

			// ── ① 配置支线走到哪（**只进「详情」**：四步勾 / 字段行数 / 缺口清单 / 依据）──
			//   ★ 首屏上只留一句人话（`data.story.config`）——机器口径 `config.stage` / `config.label`
			//     原样留在这一块里，供"到底卡在哪"时核对（线框 A 第 2 条）。
			const STAGE_TONE = {
				"before-draft": C.muted, "rules-ready": C.link, "integrating": C.warn,
				"missing-pending": C.warn, "missing-nofields": C.warn, landed: C.ok
			};
			const tone = (config && STAGE_TONE[config.stage]) || C.muted;
			const cfgBox = config ? h("div", {
				key: "cfg", "data-config-stage": config.stage, "data-config-label": config.label,
				style: {
					border: "1px solid " + C.faint, borderLeft: "3px solid " + tone, background: "#fff",
					borderRadius: "4px", padding: "8px 11px", marginBottom: "10px"
				}
			}, [
				h("div", { key: "h", style: { display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" } }, [
					h("b", { key: "t", style: { fontSize: "12px" } }, "配置支线走到哪"),
					h("span", { key: "v", style: { fontSize: "12px", color: tone, fontWeight: 600 } }, config.label),
					h("span", { key: "m", style: { fontSize: "10.5px", color: C.muted, fontFamily: "monospace" } },
						"（机器口径 " + String((data && data.configMis && data.configMis.stage) || config.stage) + "）")
				]),
				h("div", { key: "r", "data-config-reason": config.reason, style: { fontSize: "10.5px", color: C.muted, marginTop: "4px", lineHeight: 1.75, userSelect: "text" } },
					"依据：" + config.reason),
				// 四步链路（成稿 → 配置表 → 读回 → 定稿），每步一个勾
				h("div", { key: "s", "data-config-steps": config.steps.map((x) => (x.done ? "✔" : "○") + x.key).join(","), style: { display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "6px" } },
					config.steps.map((x, i) => h("div", {
						key: i, "data-step": x.key, "data-done": x.done ? "1" : "0",
						style: {
							flex: "1 1 190px", minWidth: "190px", border: "1px solid " + (x.done ? C.ok : C.soft),
							borderLeft: "3px solid " + (x.done ? C.ok : C.soft), background: x.done ? "#f0fdf4" : "#fff",
							borderRadius: "4px", padding: "4px 8px"
						}
					}, [
						h("div", { key: "l", style: { fontSize: "10.5px", fontWeight: 600, color: x.done ? C.ok : C.muted } }, (x.done ? "✔ " : "○ ") + x.label),
						h("div", { key: "e", style: { fontSize: "10px", color: C.muted, fontFamily: "monospace", lineHeight: 1.6, wordBreak: "break-all" } }, x.evidence)
					]))),
				// 缺口 —— 缺什么写什么
				(config.missing || []).length
					? h("div", {
						key: "m", "data-config-missing": String(config.missing.length),
						style: { marginTop: "6px", borderTop: "1px solid " + C.faint, paddingTop: "5px" }
					}, [
						h("div", { key: "t", style: { fontSize: "11px", color: C.warn } }, "⚠ 缺口 / 缺件 " + config.missing.length + " 条（逐条）"),
						h("div", { key: "l", style: { marginTop: "3px" } },
							config.missing.map((m, i) => h("div", {
								key: i, "data-missing": String(i),
								style: { fontSize: "10.5px", color: C.ink, lineHeight: 1.75, userSelect: "text" }
							}, "· " + m)))
					])
					: h("div", { key: "nm", style: { fontSize: "11px", color: C.ok, marginTop: "5px" } }, "✔ 没有待配表缺口、没有缺件"),
				// 面板**不做**的事，写在脸上
				h("div", { key: "n", style: { fontSize: "10px", color: C.muted, marginTop: "5px", lineHeight: 1.7 } },
					"面板只显示配置支线走到哪（读定稿 §6 + `evidence\\readback_*` + 配置表文件名的存在性）—— " +
					"**配置表的读写仍在 /sr-config 与配置表工具侧**，这里不解析工作簿、不改表。"),
				h("div", { key: "p", style: { fontSize: "10px", color: C.muted, marginTop: "4px", lineHeight: 1.7 } },
					"措辞上的两种缺口（别混）：①「**是缺口**」= §6 / §6.5 里状态列确实写着「待配表」（上面缺口清单第 1 条那种）；" +
					"②「**面板看不到读回回执**」= `evidence\\readback_*` 一份都没有 —— **不等于**没验收过（回执可能还没落盘）。")
			]) : null;

			// ── ③ 两大部分 ──
			const partCard = (p) => h("button", {
				key: "part-" + p.key, type: "button", "data-part": p.key,
				onClick: () => goto(p.idx),
				title: "点它跳到正文里的这一部分",
				style: {
					flex: "1 1 320px", minWidth: "300px", textAlign: "left", font: "inherit", cursor: "pointer",
					border: "1px solid " + C.faint, borderLeft: "3px solid " + C.link, background: "#fff",
					borderRadius: "4px", padding: "7px 10px"
				}
			}, [
				h("div", { key: "t", style: { fontSize: "12px", fontWeight: 600, color: C.ink } },
					"§" + p.no + " " + p.label + "　"),
				h("div", { key: "n", style: { fontSize: "10.5px", color: C.muted, fontFamily: "monospace", marginTop: "2px" } },
					"L" + p.line + "–L" + p.endLine + "　" + p.groups + " 组 / " + p.items + " 条" + (p.skipped ? " / " + p.skipped + " 行不可引用" : "")),
				h("div", { key: "d", style: { fontSize: "10px", color: C.muted, marginTop: "3px", lineHeight: 1.65 } }, p.note)
			]);

			// ── ④ 左树（章 → 组 → 条目，逐级带行号）──
			const LNUM = { fontSize: "9.5px", color: C.muted, fontFamily: "monospace", marginLeft: "6px", flex: "0 0 auto" };
			const lnum = (line) => h("span", { key: "L", style: LNUM }, "L" + line);
			const toc = [];
			if (doc && doc.tree) {
				toc.push(h("div", {
					key: "head", style: { fontSize: "11px", color: C.muted, marginBottom: "8px", lineHeight: 1.6, userSelect: "text" }
				}, [
					h("div", { key: "a" }, (data && data.name) + " · " + doc.counts.chapters + " 章 / " + doc.counts.groups + " 组 / " +
						(doc.counts.rules + doc.counts.ues) + " 条（两大部分）"),
					h("div", { key: "b" }, "点任一行 → 右边正文滚到那一块；§4 / §5 是后面两条支线的依据")
				]));
				for (const c of doc.tree.chapters) {
					const ck = "ch" + c.no;
					const cOpen = openG[ck] === undefined ? c.open : !!openG[ck];
					const pk = partOfNo(c.no);
					const cnt = [];
					if (c.groups.length) cnt.push(c.groups.length + " 组");
					if (c.items.length) cnt.push(c.items.length + " 条");
					if (c.skipped) cnt.push(c.skipped + " 行不可引用");
					toc.push(h("div", {
						key: ck, "data-ch": c.no, "data-part": pk, title: c.text,
						onClick: () => {
							if (c.items.length) {
								const nx = Object.assign({}, openG);
								nx[ck] = !cOpen;
								setOpenG(nx);
							}
							goto(c.idx);
						},
						style: {
							display: "flex", alignItems: "baseline", cursor: "pointer", userSelect: "none",
							fontSize: "12px", fontWeight: 600, margin: "8px 0 3px",
							color: sel === c.idx ? C.link : (pk ? C.ink : C.muted)
						}
					}, [
						h("span", { key: "t", style: { fontSize: "9px", color: C.muted, marginRight: "4px", width: "9px", flex: "0 0 9px", textAlign: "center" } },
							c.items.length ? (cOpen ? "▾" : "▸") : "·"),
						h("span", { key: "l" },
							"§" + c.no + " " + c.title + (pk ? "  ★" : "") + (!cOpen && cnt.length ? "  (" + cnt.join(" · ") + ")" : "")),
						h("span", { key: "sp", style: { flex: "1 1 auto" } }, ""),
						lnum(c.line)
					]));
					if (cOpen) for (const it of c.items) toc.push(tocItem(it, c.idx, c.no));

					for (const g of c.groups) {
						const tag = gk(g);
						const gkey = "g" + g.idx;
						const isOpen = openG[gkey] === undefined ? g.open : !!openG[gkey];
						const gc = g.items.length ? g.items.length + " 条" : "";
						const gs = g.skipped ? (gc ? " · " : "") + g.skipped + " 行不可引用" : "";
						toc.push(h("div", {
							key: gkey, "data-group": tag, "data-ch": c.no, title: g.text,
							onClick: () => {
								if (g.items.length) {
									const nx = Object.assign({}, openG);
									nx[gkey] = !isOpen;
									setOpenG(nx);
								}
								goto(g.idx);
							},
							style: {
								display: "flex", alignItems: "baseline", cursor: "pointer", userSelect: "none",
								padding: "2px 0 2px 10px", borderRadius: "3px",
								borderLeft: "2px solid " + (sel === g.idx ? C.link : "transparent")
							}
						}, [
							h("span", { key: "t", style: { fontSize: "9px", color: C.muted, marginRight: "4px", width: "9px", flex: "0 0 9px", textAlign: "center" } },
								g.items.length ? (isOpen ? "▾" : "▸") : "·"),
							h("span", { key: "l", style: { fontSize: "11.5px", color: sel === g.idx ? C.link : C.muted } },
								(tag ? tag + "  " : "") + g.title + (gc || gs ? "  (" + gc + gs + ")" : "")),
							h("span", { key: "sp", style: { flex: "1 1 auto" } }, ""),
							lnum(g.line)
						]));
						if (isOpen) for (const it of g.items) toc.push(tocItem(it, g.idx, c.no));
					}
				}
			}

			function tocItem(it, idx, chNo) {
				// 条目级不高亮整块（同一个块里有好几条）—— 高亮留给章 / 组行与正文的块边框
				const on = false;
				const tag = partTag(chNo);
				return h("div", {
					key: "it" + chNo + "-" + it.line + "-" + it.label,
					"data-line": String(it.line), "data-label": String(it.label),
					"data-part": partOfNo(chNo),
					title: "L" + it.line + "　" + it.text,
					onClick: () => goto(idx),
					style: {
						display: "flex", alignItems: "baseline", fontSize: "11px", cursor: "pointer", userSelect: "none",
						padding: "1px 4px 1px 22px", borderRadius: "3px", color: on ? "#fff" : C.muted,
						background: on ? C.link : "transparent", whiteSpace: "nowrap", overflow: "hidden"
					}
				}, [
					h("span", { key: "l", style: { overflow: "hidden", textOverflow: "ellipsis" } }, it.label),
					tag ? h("span", { key: "p", style: { color: C.muted, marginLeft: "5px", fontSize: "9.5px" } }, tag) : null,
					h("span", { key: "sp", style: { flex: "1 1 auto" } }, ""),
					lnum(it.line)
				]);
			}

			// ── 右栏：分块正文（代码块与图片单独渲染 + 每块一个错误边界）──
			const labelOf = (b) => {
				if (b.level === 2) return "§" + b.no + " " + (b.title || "");
				const id = b.id || b.no || "";
				const dup = b.no && b.chNo && String(b.no).indexOf(String(b.chNo) + ".") === 0;
				return (dup ? "" : "§" + (b.chNo || "?") + " ") + id + " " + (b.title || "");
			};
			const absOf = (v) => {
				if (!v || typeof v !== "string") return void 0;
				if (!/\.(png|jpe?g|gif|webp|svg)$/i.test(v)) return void 0;
				const isAbs = /^[A-Za-z]:[\\/]/.test(v) || v.charAt(0) === "/";
				const dir = String((data && data.path) || "").replace(/[\\/][^\\/]*$/, "");
				return isAbs ? v : dir + "/" + v;
			};
			const pathImages = { abs: absOf, resolve: (v) => { const a = absOf(v); return a ? fileUrl(a) : void 0; } };
			const body = (doc && doc.doc && (doc.doc.blocks || []).length)
				? doc.doc.blocks.map((b, i) => h("div", {
					key: "b" + i, "data-blk": String(i),
					style: {
						padding: "2px 8px 4px 10px", marginBottom: "6px", borderRadius: "3px",
						borderLeft: "3px solid " + (sel === i ? C.link : "transparent"),
						background: sel === i ? "#f0f7ff" : "transparent"
					}
				}, h(BlockBoundary, { key: "bb", label: labelOf(b).trim() + "（L" + b.line + "）" },
					splitSpecial(b.text).map((p, j) => {
						if (p.t === "img") {
							return h(ImgTag, { key: "i" + j, src: p.v, alt: p.alt, pathImages: pathImages, onOpen: props.onOpen || null });
						}
						if (p.t === "code") return h(CodeBlock, { key: "c" + j, text: p.v });
						return h(Md, { key: "m" + j, text: p.v, pathImages: pathImages });
					})
				)))
				: null;

			// ── ② 纸面动作（写成稿 / 改成稿）—— **落在「看正文」那一折里**，不在首屏 ──
			const paperActs = h("div", {
				key: "acts", "data-row": "actions",
				style: { border: "1px solid " + C.faint, borderRadius: "4px", background: "#fff", padding: "9px 11px", marginBottom: "10px" }
			}, [
				h("div", { key: "h", style: { fontSize: "11.5px", fontWeight: 600, marginBottom: "6px" } },
					"成稿纸面上的动作（一条链，有先后：写成稿 → 改成稿）—— 它们改的是**规则与界面流程本身**"),
				h("div", { key: "row", "data-row": "actioncards", style: { display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" } },
					cardIds.map((id) => defOf(id)).map(card)),
				h("div", { key: "d", "data-action": e.id, style: { borderTop: "1px solid " + C.faint, paddingTop: "8px" } }, [
					h("div", { key: "t", style: { fontSize: "11.5px", marginBottom: "6px" } }, [
						h("b", { key: "b" }, e.label + "　"),
						h("span", { key: "s", style: { color: C.muted, fontSize: "10.5px" } }, e.hint + "　前置：" + e.needs)
					]),
					h("div", { key: "f" }, form()),
					actBlock("ab", e.id, built, "发到工作会话"),
					h("div", { key: "ho", "data-handoff": e.id, style: { fontSize: "10.5px", color: C.muted, marginTop: "5px", lineHeight: 1.7 } },
						"发起后：" + e.handoff + " —— 面板只给「跳到那个会话」。")
				])
			]);

			/** 「看正文」折里的内容：标题一栏 + 左树 + 分块正文（**默认收起**，点开才渲染） */
			//   ★ 只在**读到成稿**（`doc.tree` 在）时构造：认不出成稿时这一折整块不出现（不编内容）
			const foldBody = (doc && doc.tree)
				? h("div", { style: { display: "flex", flexDirection: "column", gap: "12px", marginTop: "4px" } }, [
					// ★ 纸面动作（写成稿 / 改成稿）与正文写在**同一折**里：
					//   它们是"改这份成稿"的动作，看正文的时候才用得上（工单 24c 的分层）
					paperActs,
					h("div", { key: "cols", style: { display: "flex", gap: "16px", alignItems: "flex-start" } }, [
						h("div", { key: "toc", style: { flex: "0 0 272px", width: "272px", maxHeight: "62vh", overflow: "auto", borderRight: "1px solid " + C.faint, paddingRight: "10px" } }, [
							h("div", { key: "head", style: { fontSize: "11px", color: C.muted, marginBottom: "8px", lineHeight: 1.7, userSelect: "text" } }, [
								h("div", { key: "a" }, (data && data.name) + " · " + doc.counts.chapters + " 章 / " + doc.counts.groups + " 组 / " +
									(doc.counts.rules + doc.counts.ues) + " 条（两大部分）"),
								h("div", { key: "b" }, "点任一行 → 右边正文滚到那一块；§4 / §5 是后面两条支线的依据")
							]),
							toc
						]),
						h("div", {
							key: "body", ref: bodyRef,
							style: { flex: "1 1 auto", minWidth: 0, maxHeight: "62vh", overflow: "auto" }
						}, body)
					])
				])
				: null;

			// ── ③ 支线 B（线框图）的**输入**：路径是唯一可靠输入 ⇒ 先展开、有输入才发 ──
			const wireInput = h("div", { key: "wi", "data-wire-input": "1", style: { marginTop: "7px" } }, [
				h("div", { key: "t", style: { fontSize: "11px", color: C.muted, lineHeight: 1.7, marginBottom: "5px" } },
					"面板拿不到二进制 —— **路径是唯一的可靠输入**。粘进下面这一框，或从 `gdd\\UI\\` 已备好的图里点一个（可多选）。"),
				field("wp", "界面图路径（一行一条；本机文件 / 目录 / 链接都行）", wirePaste, setWirePaste,
					"D:\\…\\features\\联盟悬赏\\gdd\\UI\\UI-M1 联盟悬赏主面板 · 常规难度.png", 2),
				(data && (data.uiImages || []).length)
					? h("div", { key: "pk", style: { marginBottom: "7px" } }, [
						h("div", { key: "l", style: LABEL }, "从 `gdd\\UI\\` 里挑（" + (data.uiImages || []).length + " 张；点一下加入/移出）"),
						h("div", { key: "r", style: { display: "flex", gap: "6px", flexWrap: "wrap" } },
							(data.uiImages || []).map((im, i) => {
								const on = picked.indexOf(im.abs) >= 0;
								return h("button", {
									key: "p" + i, type: "button", "data-pick": im.name, "data-picked": on ? "1" : "0",
									title: im.abs,
									onClick: () => setPicked((prev) => (prev.indexOf(im.abs) >= 0 ? prev.filter((x) => x !== im.abs) : prev.concat([im.abs]))),
									style: {
										font: "inherit", fontSize: "11px", padding: "3px 9px", borderRadius: "4px", cursor: "pointer",
										border: "1px solid " + (on ? C.ink : C.soft), background: on ? C.ink : "#fff",
										color: on ? "#fff" : C.ink
									}
								}, (on ? "✓ " : "") + im.name);
							}))
					])
					: h("div", { key: "np", "data-wire-none": "1", style: { fontSize: "11px", color: C.warn, marginBottom: "7px", lineHeight: 1.7 } },
						"`gdd\\UI\\` 里这次没列到界面图" + ((data && data.uiWhy) ? "（" + data.uiWhy + "）" : "") + " —— 那就把图**放进去**再回来，或直接粘一个别的路径。"),
				h("div", { key: "c", "data-wire-count": String(wirePaths.length), style: { fontSize: "11px", color: C.muted } },
					"已经给了 " + wirePaths.length + " 条路径。"),
				h("div", { key: "f", style: { fontSize: "10.5px", color: C.muted, marginTop: "4px", lineHeight: 1.7 } },
					"现状原文（面板读出来的 §5 ASCII 占位，会一并带进指令）：" +
					((data && (data.ascii || []).length)
						? (data.ascii || []).map((x) => "§" + x.no + (x.id ? " " + x.id : "") + " L" + x.line + "（约 " + x.lines + " 行）").join(" · ")
						: "这次没在 §5 里认出 ASCII 占位（可能已经是图片引用了）"))
			]);

			// ── 首屏（Y 形三层）────────────────────────────────────────────────
			//   ★ 判据（线框 A 注释 1）：**一屏只留一个主按钮**。`data-btn="primary"` 的那一颗恒为
			//     整合定稿；两条支线的动作一律 `data-btn="ghost"`，折叠入口一律 `data-btn="link"`。
			const noDoc = !(data && data.path);
			const topExtra = doc
				? "已就绪 · " + ((data && data.kb) || 0) + " KB · " + doc.counts.chapters + " 章"
				: (notes.length ? "还没读到成稿 —— 先看下面的说明" : "还没读到成稿");
			const top = h("div", {
				key: "top", "data-node": "top",
				style: { border: "1px solid " + C.faint, borderRadius: "4px", background: "#fff", padding: "11px 13px" }
			}, [
				h("div", { key: "r", style: { display: "flex", gap: "10px", alignItems: "baseline", flexWrap: "wrap", justifyContent: "space-between" } }, [
					h("span", { key: "t", "data-node-title": "top", style: { fontSize: "14px", fontWeight: 600, color: C.ink } },
						(data && data.date ? "成稿 · " + data.date : (doc ? "成稿" : "成稿（还没有）"))),
					h("span", { key: "m", "data-node-meta": "top", style: { fontSize: "12px", color: C.muted } }, topExtra)
				]),
				noDoc
					? h("div", { key: "n", style: { fontSize: "11.5px", color: C.muted, marginTop: "6px", lineHeight: 1.75 } },
						"这个功能目录的 `gdd\\` 里还没有成稿 —— 这一屏的第一个动作就是「写成稿」（在下面的〔看正文〕里）。")
					: null,
				doc && doc.parts.length
					? fold("parts", openParts ? "收起两大部分" : "两大部分（点开看，默认收起）", openParts, () => setOpenParts(!openParts),
						h("div", { key: "pp", style: { marginTop: "8px" } }, [
							h("div", { key: "row", "data-row": "parts", style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
								doc.parts.map(partCard)),
							h("div", { key: "n", style: { fontSize: "10.5px", color: C.muted, marginTop: "7px", lineHeight: 1.75 } },
								"这两部分是下面两条支线的依据：配置表从「功能规则」派生，线框图替换针对「用户体验与界面流程」。")
						]))
					: h("div", { key: "pn", style: { fontSize: "11.5px", color: doc ? C.warn : C.muted, marginTop: "8px", lineHeight: 1.75 } },
						doc
							? "⚠ 没认出两大部分（缺：" + doc.missingParts.join(" / ") + "）—— 面板不硬指一个章号，请核对成稿的章标题。"
							: "（还没读到成稿，两大部分为空）"),
				doc && doc.tree && (doc.tree.chapters || []).length
					? fold("body", openBody ? "收起正文" : "看正文（" + ((data && data.kb) || 0) + " KB / " + doc.lines + " 行 / " + doc.counts.chapters + " 章 —— 左树 + 分块正文，点开才读）",
						openBody, () => setOpenBody(!openBody), foldBody, { style: { marginTop: "8px" } })
					: null
			]);

			const branches = h("div", { key: "br", "data-node": "mid", style: { display: "grid", gap: "12px", gridTemplateColumns: "1fr 1fr" } }, [
				// 支线 A · 配置表
				h("div", {
					key: "a", "data-branch": "config",
					style: { border: "1px solid " + C.faint, borderRadius: "4px", background: "#fff", padding: "11px 13px" }
				}, [
					h("div", { key: "h", style: { display: "flex", gap: "8px", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap" } }, [
						h("span", { key: "n", style: { fontSize: "12.5px", fontWeight: 600 } }, "支线 A · 配置表"),
						h("span", {
							key: "s", "data-branch-state": "config",
							style: { fontSize: "11px", color: (story.config && story.config.tone) === "warn" ? C.warn : ((story.config && story.config.tone) === "ok" ? C.ok : C.muted) }
						}, (story.config && story.config.gap) ? "还有没填的" : "已就绪")
					]),
					sayLine("config", (story.config && story.config.label) || "（还没读到配置支线的状态）", (story.config && story.config.tone) || "info",
						(data && data.configMis && data.configMis.gapCount) ? "缺 " + data.configMis.gapCount + " 处" : ""),
					h("div", { key: "b", style: { marginTop: "9px", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" } }, [
						ghost("gc", openCfg ? "收起" : "去配表", () => setOpenCfg(!openCfg), "把「§4 的规则 → 哪张表 / 哪个字段 → 缺口在哪」组装成指令，发给本功能的专属工作会话"),
						h("span", { key: "h", style: { fontSize: "10.5px", color: C.muted } }, "跑 /sr-config：字段落表在那边做，面板不改表")
					]),
					openCfg ? h("div", { key: "oc", "data-wire-input": "config", style: { marginTop: "7px" } }, [
						field("ci", "这次要改的（选填，一句话）", intent, setIntent,
							"比如：把 §6.5 L363 的活动周期 / 排行过滤门槛 / 展示上限落到 A012-全局变量表", 2),
						actBlock("cb", "config", builtCfg, "发「去配表」到工作会话")
					]) : null
				]),
				// 支线 B · 线框图
				h("div", {
					key: "b", "data-branch": "wire",
					style: { border: "1px solid " + C.faint, borderRadius: "4px", background: "#fff", padding: "11px 13px" }
				}, [
					h("div", { key: "h", style: { display: "flex", gap: "8px", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap" } }, [
						h("span", { key: "n", style: { fontSize: "12.5px", fontWeight: 600 } }, "支线 B · 线框图"),
						h("span", {
							key: "s", "data-branch-state": "wire",
							style: { fontSize: "11px", color: (story.wire && story.wire.tone) === "warn" ? C.warn : C.muted }
						}, (data && (data.uiImages || []).length) ? "待提交 " + data.uiImages.length + " 张" : "还没有图")
					]),
					sayLine("wire", (story.wire && story.wire.label) || "（还没读到线框图支线的状态）", (story.wire && story.wire.tone) || "info",
						wirePaths.length ? "已给 " + wirePaths.length + " 条路径" : ""),
					h("div", { key: "b2", style: { marginTop: "9px", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" } }, [
						ghost("gw", openWire ? "收起" : "提交线框图", () => setOpenWire(!openWire), "先展开输入（粘路径，或从 gdd\\UI\\ 里挑），有输入才发指令"),
						h("span", { key: "h", style: { fontSize: "10.5px", color: C.muted } }, "落 §5：把 ASCII 占位换成 <img src=…>")
					]),
					openWire ? h("div", { key: "ow", style: { marginTop: "7px" } }, [
						wireInput,
						actBlock("wb", "wireframe", builtWire, "发「提交线框图」到工作会话")
					]) : null
				])
			]);

			/**
			 * ★ 工单 25 · **定稿门**（合流之后的落点）：这份定稿能不能交给程序。
			 *
			 * 三条口径（与本票的工单逐条对应）：
			 *   ① **审查是必经的一步** —— 没跑审查 / 报告比定稿旧 / 看不到时间，一律**不标为可用**（`gate.canHandOff`）；
			 *   ② **人话在首屏、口径在门里** —— 首屏只有一行 `定稿门 · <headline>`，三种告警与时间折进〔看定稿门〕；
			 *   ③ 判据**不在这里算** —— `gate` 是 `loadFeatureDetail` 里 `finalGate()` 的返回值（纯函数、有回归网）。
			 */
			const gate = (data && data.gate) || null;
			const gateLine = gate ? h("div", {
				key: "g", "data-gate": gate.state,
				style: { marginTop: "5px", display: "flex", gap: "8px", alignItems: "baseline", flexWrap: "wrap" }
			}, [
				h("span", {
					key: "s", "data-gate-say": "1",
					style: { fontSize: "12.5px", lineHeight: 1.7, color: gate.state === "ok" ? C.ok : C.ink }
				}, "定稿门 · " + gate.headline),
				gate.review && gate.review.state === "unknown-time"
					? h("span", { key: "u", "data-gate-notime": "1", style: { fontSize: "11px", color: C.warn } }, "看不到时间")
					: null
			]) : null;
			const gateBody = gate ? h("div", {
				key: "gb", "data-gate-body": "1",
				style: { fontSize: "12px", lineHeight: 1.85, border: "1px solid " + C.faint, borderRadius: "4px", background: "#fff", padding: "9px 12px" }
			}, [
				h("div", { key: "s", style: { color: C.ink } }, gate.say),
				gate.alarms.length
					? h("div", { key: "a", style: { marginTop: "7px" } }, gate.alarms.map((al, i) => h("div", {
						key: i, "data-gate-alarm": al.code,
						style: { color: al.level === "error" ? C.bad : C.ink }
					}, "· " + al.say)))
					: h("div", { key: "a0", style: { marginTop: "7px", color: C.ok } }, "· 没有告警：结构 / 审查 / 正文校验三条关都过了。"),
				h("div", {
					key: "r", "data-gate-review": gate.review.state,
					style: { marginTop: "7px", color: C.muted }
				}, "审查关：" + gate.review.say +
					(gate.review.finalAt
						? "　（定稿 " + gate.review.finalAt + (gate.review.reportAt ? " · 报告 " + gate.review.reportAt : "") + "）"
						: "")),
				gate.next
					? h("div", { key: "n", style: { marginTop: "7px" } }, "下一步：" + gate.next)
					: null,
				h("div", { key: "fp", style: { marginTop: "7px", fontSize: "10.5px", color: C.muted } },
					"判据来自 `finalgdd.checkFinals`（结构）/ `vchecks.checkV11`（审查）/ `vchecks`（正文校验）；时间取自宿主 `stat` 的版本串。")
			]) : null;

			const merge = h("div", {
				key: "mg", "data-node": "bottom",
				style: { border: "1px solid " + C.ink, borderRadius: "4px", padding: "13px 15px", display: "flex", gap: "12px", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }
			}, [
				h("div", { key: "t" }, [
					h("div", { key: "a", style: { fontSize: "14px", fontWeight: 600 } }, "合流 → 定稿"),
					h("div", { key: "b", style: { fontSize: "12px", color: C.muted, marginTop: "2px" } },
						"先整合（sr-gdd-ai），" + "必经审查" + "（sr-gdd-review），再成立定稿。"),
					// ★ 工单 25 · **定稿门**：合流完之后这份定稿**能不能交程序**（一句话，人话）
					gateLine,
					openInt
						? h("div", { key: "c", style: { fontSize: "10.5px", color: C.muted, marginTop: "4px", lineHeight: 1.7 } },
							"这个动作不发新东西 —— 它把「整合定稿」连同配置支线的现状（逐条带缺口）交给该功能的专属工作会话。整合结果（定稿与审查报告）由后续那一票承接，本屏不重画流程。")
						: null
				]),
				h("button", {
					key: "go", type: "button", "data-send": "integrate", "data-btn": "primary",
					onClick: () => { if (!openInt) setOpenInt(true); else sendInt(); },
					style: {
						font: "inherit", fontSize: "13px", fontWeight: 600, padding: "8px 18px", borderRadius: "4px",
						border: "1px solid " + C.ink, background: C.ink, color: "#fff", cursor: "pointer"
					}
				}, openInt ? "发到工作会话" : "发起整合定稿")
			]);

			// 主按钮的预览挂在合流块下面（点一次展开、再点一次发；先看清楚要发什么）
			const mergeBlock = h("div", { key: "mgb", "data-merge": "1" }, [
				merge,
				openInt
					? h("div", {
						key: "pv", "data-integrate-open": "1",
						style: { border: "1px solid " + C.faint, borderTop: "none", borderRadius: "0 0 4px 4px", background: "#fff", padding: "9px 13px" }
					}, [actBlock("ib", "integrate", builtInt, "发到工作会话")])
					: null,
				// ★ 工单 25 · 定稿门的**明细**：默认收起（首屏只留上面那一行）
				gate
					? fold("gate", openGate
						? "收起定稿门"
						: "看定稿门（" + (gate.alarms.length ? gate.alarms.length + " 处要处理" : "为什么可以交") + "）",
						openGate, () => setOpenGate(!openGate), gateBody, { style: { marginTop: "6px" } })
					: null
			]);

			// ── ④ 详情（**全折**：四步勾 / 字段行数 / 缺口清单 / 两大部分明细 / 指纹 / 会话 / 说明）──
			const machine = h("div", { key: "mc", style: { marginTop: "8px" } }, [
				notes.length
					? h("div", {
						key: "nt", "data-notes": String(notes.length),
						style: {
							fontSize: "11px", color: C.warn, border: "1px solid " + C.faint, borderLeft: "3px solid " + C.warn,
							background: "#fffdf7", borderRadius: "4px", padding: "7px 10px", marginBottom: "9px", lineHeight: 1.75
						}
					}, notes.map((x, i) => h("div", { key: i }, "⚠ " + x)))
					: null,
				cfgBox,
				h("dl", { key: "kv", style: { margin: "0 0 10px", display: "grid", gridTemplateColumns: "max-content 1fr", gap: "4px 12px", fontSize: "11px", color: C.ink, lineHeight: 1.8 } }, [
					h("dt", { key: "d1", style: { color: C.muted } }, "这一屏读的是"),
					h("dd", { key: "v1", style: { margin: 0, userSelect: "text" } },
						((data && data.name) || "（没有成稿）") + ((data && data.path) ? "　" + winPath(data.path) : "")),
					h("dt", { key: "d2", style: { color: C.muted } }, "会话"),
					h("dd", { key: "v2", style: { margin: 0, userSelect: "text" } },
						"目标：本功能的专属工作会话" + (root ? "（cwd " + winPath(root) + "）" : "") + "　—— 面板只给「跳到那个会话」"),
					h("dt", { key: "d3", style: { color: C.muted } }, "内容指纹"),
					h("dd", { key: "v3", style: { margin: 0, userSelect: "text" } },
						props.live
							? shortDigest(props.live.digest) + " · " + freshnessOf({ phase: props.live.phase, pending: props.live.pending, digest: props.live.digest, reason: props.live.reason }).text +
								" · 订阅 " + (Number(props.live.ready) || 0) + "/" + (Number(props.live.total) || 0)
							: "（这一屏没拿到订阅实况）"),
					h("dt", { key: "d4", style: { color: C.muted } }, "两大部分"),
					h("dd", { key: "v4", style: { margin: 0, userSelect: "text" } },
						doc && doc.parts.length
							? doc.parts.map((p) => "§" + p.no + " " + p.label + "　L" + p.line + "–L" + p.endLine + "　" + p.groups + " 组 / " + p.items + " 条").join("　·　")
							: "（没认出两大部分）"),
					h("dt", { key: "d5", style: { color: C.muted } }, "§5 的 ASCII 占位"),
					h("dd", { key: "v5", style: { margin: 0, userSelect: "text" } },
						(data && (data.ascii || []).length)
							? (data.ascii || []).map((x) => "§" + x.no + (x.id ? " " + x.id : "") + " L" + x.line + "（约 " + x.lines + " 行）").join("　·　")
							: "（§5 里没认出 ASCII 占位）"),
					h("dt", { key: "d6", style: { color: C.muted } }, "gdd\\UI\\ 里的图"),
					h("dd", { key: "v6", style: { margin: 0, userSelect: "text" } },
						(data && (data.uiImages || []).length)
							? (data.uiImages || []).length + " 张：" + (data.uiImages || []).map((x) => x.name).join(" / ")
							: "（没列到" + ((data && data.uiWhy) ? "：" + data.uiWhy : "") + "）"),
					h("dt", { key: "d7", style: { color: C.muted } }, "动作表"),
					h("dd", { key: "v7", style: { margin: 0, userSelect: "text" } },
						actions.map((a) => a.label + "（" + a.hint + "）").join("　·　"))
				]),
				h("div", { key: "fp", style: { fontSize: "10px", color: C.muted, lineHeight: 1.8 } },
					"面板只显示状态、不改文件；所有动作的指令都由 `src/pure/draftstep.ts` 组装，与卡上预览逐字相同。")
			]);

			return h("div", { "data-workface": "draft" }, [
				data && data.error
					? h("div", { key: "er", style: { fontSize: "12px", color: C.bad, marginBottom: "9px" } }, data.error)
					: null,
				!data ? h("div", { key: "ld", style: { fontSize: "12px", color: C.muted, marginBottom: "9px" } }, "正在读成稿…") : null,

				// ── Y 形（上 → 中 → 下）────────────────────────────────────────
				h("div", { key: "y", "data-y": "1", style: { display: "grid", gap: "14px", margin: "4px 0 14px" } }, [
					h("div", { key: "stem", "aria-hidden": "true", style: { height: "12px", borderLeft: "1px dashed " + C.soft, marginLeft: "26px" } }),
					top,
					h("div", { key: "fork", "aria-hidden": "true", style: { height: "12px", borderTop: "1px dashed " + C.soft, margin: "0 25% 0 26px" } }),
					branches,
					mergeBlock
				]),

				// ── 底部一条：指纹 + 〔详情〕（**默认收起**：机器口径全在里面）──
				h("div", {
					key: "strip",
					style: {
						display: "flex", gap: "10px", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap",
						borderTop: "1px solid " + C.faint, paddingTop: "9px", fontSize: "11px", color: C.muted
					}
				}, [
					h("span", { key: "t", "data-strip": "1", style: { lineHeight: 2 } },
						props.live ? "内容指纹 " + shortDigest(props.live.digest) + " · " + freshnessOf({ phase: props.live.phase, pending: props.live.pending, digest: props.live.digest, reason: props.live.reason }).text : "（没有订阅实况）"),
					fold("machine", openMachine ? "收起详情" : "详情（展开看落到哪一步 / 缺在哪 / 这一屏读的是哪一版）", openMachine, () => setOpenMachine(!openMachine),
						machine, { style: { marginTop: 0, flex: "1 1 auto" }, btn: "link" })
				])
			]);
		}

		/**
		 * ★ 工单 16 · 变更订阅条 + **版本指纹**（常显在最上面一行）。
		 *
		 * 一眼要看出三件事（这就是本票的验收口径）：
		 *   ① 屏幕上这份内容的**版本指纹**（8 位十六进制，来自宿主的 `version`）；
		 *   ② 它是不是最新的 —— `freshnessOf` 给的那一句话（已是最新 / 有 N 处新变化 / 不可用）；
		 *   ③ 订阅实况（几个目标就绪 / 被跳过几帧 / 最近一帧原文），**降级时如实说**。
		 *
		 * ★ 「刷新」按钮**任何状态下都在**：通道不可用时它是唯一出路（工单 16 的"不许假装修好了"）。
		 */
		function LiveBar(props) {
			const live = props.live || {};
			const f = freshnessOf({ phase: live.phase, pending: live.pending, digest: live.digest, reason: live.reason });
			const tone = f.state === "fresh" ? C.ok : f.state === "stale" ? C.warn : (f.state === "down" ? C.bad : C.muted);
			const skipped = Number(live.skipped) || 0;
			const changed = live.changed || [];
			return h("div", {
				"data-live": f.state,
				"data-digest": live.digest || "",
				"data-pending": String(live.pending || 0),
				"data-ready": String(live.ready || 0) + "/" + String(live.total || 0),
				"data-reloads": String(live.reloads || 0),
				"data-skipped": String(skipped),
				// 各部件"被点名重读"的次数（只增不减）—— 验收"只重读受影响的部分"看的就是它
				"data-rev": ["detail", "ledger", "final", "ui", "brain", "draft"].map((p) => p + ":" + (((props.rev || {})[p]) || 0)).join(","),
				style: {
					display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap",
					border: "1px solid " + C.faint, borderLeft: "3px solid " + tone,
					borderRadius: "4px", padding: "5px 10px", marginBottom: "8px", background: "#fff",
					fontSize: "11px"
				}
			}, [
				h("span", { key: "fp", style: { fontFamily: "monospace", color: C.ink }, title: "内容指纹 = 详情清单里每个文件的宿主版本（不透明串）的有序哈希；变了就说明磁盘上那份内容变了" },
					"内容指纹 " + shortDigest(live.digest)),
				h("span", { key: "st", "data-live-text": f.text, style: { color: tone, fontWeight: 600 } }, f.text),
				h("span", { key: "tgt", style: { color: C.muted } },
					live.phase === "off" ? "" :
						"订阅 " + (Number(live.ready) || 0) + "/" + (Number(live.total) || 0) + " 个目标" +
						(skipped ? "　跳过 " + skipped + " 帧（不是新内容）" : "")),
				props.onRefresh
					? h("button", {
						key: "rf", type: "button", "data-refresh": "manual",
						onClick: () => props.onRefresh(),
						title: "手动重读这个功能的全部数据（变更订阅不可用时的兜底）",
						style: { font: "inherit", fontSize: "11px", padding: "2px 9px", border: "1px solid " + C.soft, background: "#fff", borderRadius: "4px", cursor: "pointer" }
					}, "刷新")
					: null,
				changed.length
					? h("span", { key: "ch", style: { color: C.muted } }, "刚重读：" + changed.map((x) => String(x).split(/[\\/]/).slice(-2).join("/")).join("、"))
					: null,
				live.reason ? h("span", { key: "rs", style: { color: C.muted } }, live.reason) : null,
				// 原始帧留在这里：真机验收时"帧真的到了"要看得见，而不是只能听面板说
				live.frame
					? h("details", { key: "fr", style: { width: "100%" } }, [
						h("summary", { key: "s", style: { cursor: "pointer", color: C.muted } },
							"最近一帧（原始 JSON" + (live.at ? " · " + new Date(live.at).toLocaleTimeString() : "") + "）"),
						h("pre", {
							key: "p",
							style: { margin: "4px 0 0", padding: "6px", background: C.bg, border: "1px solid " + C.faint, borderRadius: "3px", fontSize: "10.5px", overflowX: "auto", whiteSpace: "pre-wrap" }
						}, live.frame)
					])
					: null
			]);
		}

		/**
		 * 功能详情 · 状态块：三阶段进度 + "现在能用吗" + V 校验清单。
		 * 放在**所有页签之上**，所以切到哪一屏都能看到（工单 12 的"详情页要能看到阶段进度与定稿有效性"）。
		 */
		function DetailStatus(props) {
			const d = props.detail;
			const onOpenFix = props.onOpenFix;
			if (!d) return h("div", { style: { fontSize: "12px", color: C.muted, marginBottom: "10px" } }, "正在读产物清单与校验清单…");
			if (d.error) return h("div", {
				style: {
					fontSize: "12px", color: C.bad, marginBottom: "10px", padding: "8px 11px",
					border: "1px solid " + C.faint, borderLeft: "3px solid " + C.bad, background: "#fef2f2", borderRadius: "4px"
				}
			}, d.error);

			const art = d.artifacts || { counts: {}, total: 0 };
			const cl = d.checklist || { issues: [], counts: {} };
			const v = finalVerdict(d.finalCheck);
			/** ★ 工单 25 · 定稿门（loadFeatureDetail 给的；拿不到才退回 `finalVerdict` 的老口径） */
			const g = d.gate || null;
			const tone = g
				? (g.state === "ok" ? C.ok : g.state === "blocked" ? C.warn : C.warn)
				: (v.tone === "bad" ? C.bad : v.tone === "warn" ? C.warn : v.tone === "ok" ? C.ok : C.muted);
			const usableTone = (g && g.state === "blocked") ? C.bad : tone;

			return h("div", { style: { marginBottom: "12px" } }, [
				// ① 三阶段进度
				h("div", {
					key: "stage",
					style: { display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "9px" }
				}, (d.stage ? d.stage.stages : []).map((s) => h("div", {
					key: s.key,
					style: {
						border: "1px solid " + (s.done ? C.ok : C.soft), borderLeft: "3px solid " + (s.done ? C.ok : C.soft),
						background: s.done ? "#f0fdf4" : "#fff", borderRadius: "4px", padding: "5px 10px", minWidth: "150px"
					}
				}, [
					h("div", { key: "l", style: { fontSize: "11px", fontWeight: 600, color: s.done ? C.ok : C.muted } }, (s.done ? "✔ " : "○ ") + s.label),
					h("div", { key: "e", style: { fontSize: "10px", color: C.muted, fontFamily: "monospace" } }, s.evidence)
				]))),
				// 产物一览（进 / 出 / 过程留痕）—— 明细在「产物」页签
				h("div", { key: "sum", style: { fontSize: "11px", color: C.muted, marginBottom: "9px" } },
					"产物 " + (art.total || 0) + " 个　" + (art.meanings || []).map((m) => m.label + " " + ((art.counts || {})[m.key] || 0)).join("　")),

				// ② "现在能用吗" = **定稿门**（工单 25）—— 人话在上，机器口径折进「原始判据」
				h("div", {
					key: "usable", "data-gate": g ? g.state : "none",
					style: {
						border: "1px solid " + C.faint, borderLeft: "3px solid " + usableTone,
						background: (g ? g.state === "ok" : v.tone === "ok") ? "#f0fdf4" : "#fffdf7",
						borderRadius: "4px", padding: "8px 11px", fontSize: "12px", marginBottom: "8px"
					}
				}, g
					? [
						h("div", { key: "t" }, [
							h("b", { key: "a" }, "现在能用吗："),
							h("span", { key: "b", "data-gate-say": "1", style: { color: usableTone, fontWeight: 600 } },
								g.state === "ok" ? "可以交给程序" : (g.state === "blocked" ? "还不能交给程序" : "还没有定稿")),
							h("span", { key: "c", style: { color: C.muted } }, "　" + g.say)
						]),
						// 三种情形（人话）+ 审查关 + 下一步
						g.alarms.length
							? h("div", { key: "al", style: { marginTop: "4px" } }, g.alarms.map((al, i) => h("div", {
								key: "a" + i, "data-gate-alarm": al.code,
								style: { fontSize: "11.5px", lineHeight: 1.8, color: al.level === "error" ? C.bad : C.ink }
							}, "· " + al.say)))
							: null,
						h("div", { key: "rv", "data-gate-review": g.review.state, style: { marginTop: "4px", fontSize: "11.5px", color: C.muted } },
							"审查关：" + g.review.say +
							(g.review.finalAt ? "　（定稿 " + g.review.finalAt + (g.review.reportAt ? " · 报告 " + g.review.reportAt : "") + "）" : "")),
						g.next ? h("div", { key: "nx", style: { marginTop: "4px", fontSize: "11.5px" } }, "下一步：" + g.next) : null,
						// 机器口径（V1 的三条原始 issue）折在这里 —— 判据可核对，但不上首屏
						h(Fold, {
							key: "raw",
							title: "原始判据（V1 的机器口径：" + (((d.finalCheck && d.finalCheck.issues) || []).length) + " 条）",
							defaultOpen: false,
							children: h("div", null, ((d.finalCheck && d.finalCheck.issues) || []).length
								? ((d.finalCheck && d.finalCheck.issues) || []).map((it, i) => h("div", {
									key: "i" + i, style: { fontSize: "11px", color: it.level === "error" ? C.bad : C.warn, marginTop: "3px", fontFamily: "monospace" }
								}, "[" + it.code + "/" + it.level + "] " + it.msg + (it.files && it.files.length ? "　→ " + it.files.join("、") : "")))
								: h("div", { style: { fontSize: "11px", color: C.muted } }, "（V1 没有报问题）"))
						})
					]
					: [
						h("div", { key: "t" }, [
							h("b", { key: "a" }, "现在能用吗："),
							h("span", { key: "b", style: { color: tone, fontWeight: 600 } }, v.text),
							h("span", { key: "c", style: { color: C.muted } },
								"　（按" + (d.finalCheck && d.finalCheck.currentFrom === "active" ? "active 标记" : "文件名日期") + "判定）")
						]),
						((d.finalCheck && d.finalCheck.issues) || []).map((it, i) => h("div", {
							key: "i" + i, style: { fontSize: "11px", color: it.level === "error" ? C.bad : C.warn, marginTop: "3px" }
						}, "[" + it.code + "/" + it.level + "] " + it.msg + (it.files && it.files.length ? "　→ " + it.files.join("、") : "")))
					]),

				// ③ V 校验清单（工单 30 的能力：V1+V3+V5+V6+V8+V11，带行号）
				h("div", {
					key: "checks",
					style: { border: "1px solid " + C.faint, borderRadius: "4px", background: "#fff", overflow: "hidden", marginBottom: "8px" }
				}, h(Fold, {
					title: "只读校验清单　error " + ((cl.counts || {}).error || 0) + " · warn " + ((cl.counts || {}).warn || 0) + " · info " + ((cl.counts || {}).info || 0) +
						"　（V1+V3+V5+V6+V8+V11；V5 是待办计数、V6/V8 干净时不出现在这里）",
					defaultOpen: !!(cl.counts && (cl.counts.error || cl.counts.warn)),
					children: h("div", null, (cl.issues || []).length
						? (cl.issues || []).map((it, i) => {
							const tt = CHECK_TONE[it.level] || CHECK_TONE.info;
							return h("div", {
								key: "ck" + i,
								style: { display: "flex", gap: "8px", fontSize: "11px", padding: "4px 0", borderTop: i ? "1px solid " + C.faint : "none", alignItems: "baseline" }
							}, [
								h("span", {
									key: "b",
									style: { fontFamily: "monospace", whiteSpace: "nowrap", border: "1px solid " + C.soft, borderRadius: "3px", padding: "0 5px", color: tt.c }
								}, it.code + " · " + tt.t),
								h("span", { key: "m", style: { flex: "1 1 auto", color: it.level === "info" ? C.muted : C.ink } }, it.msg),
								// 行号：能定位到定稿原文（点它打开定稿）
								(it.lines && it.lines.length)
									? h("button", {
										key: "l", type: "button", onClick: () => onOpenFix && onOpenFix(),
										title: "点开定稿，按这些行号定位",
										style: {
											font: "inherit", fontSize: "10px", fontFamily: "monospace", whiteSpace: "nowrap",
											border: "1px solid " + C.soft, background: "#fff", borderRadius: "3px",
											padding: "0 5px", cursor: "pointer", color: C.link
										}
									}, "L" + it.lines.join(" · L"))
									: null
							]);
						})
						: h("div", { style: { fontSize: "11px", color: C.ok } }, "六条校验都没有问题（真实数据上 V6/V8 干净时就是这个样子）。"))
				}))
			]);
		}

		/**
		 * 功能详情 · 产物（**按桶分组**：进 / 出 / 过程留痕）。
		 * 每条：细分标签（gdd 内才有）+ 文件名（点开用系统默认程序）+ 规范名 + 定稿结论 + 日期。
		 * ★ 清单来自 `detail.artifacts`（`src/pure/artifacts.ts` 算的），**与磁盘逐条对得上**。
		 */
		function ArtifactBuckets(props) {
			const f = props.feature;
			const d = props.detail;
			const srWs = props.srWs || "";
			const configRoot = props.configRoot || "";
			const onOpen = props.onOpen;
			const [fold, setFold] = React.useState({});
			if (!d) return h("div", { style: { color: C.muted, fontSize: "12px" } }, "正在读产物清单…");
			if (d.error) return h("div", { style: { color: C.bad, fontSize: "12px" } }, d.error);

			const art = d.artifacts || {};
			const groups = art.groups || [];
			const meanings = art.meanings || [];
			const configs = (f && f.configs) || [];
			const absOf = (file) => (f && f.root ? f.root : srWs) + "/" + file.rel;

			const rowOf = (file, i, clickAbs) => h("div", {
				key: "f" + i,
				style: { display: "flex", alignItems: "center", gap: "8px", padding: "5px 11px", borderTop: i ? "1px solid " + C.faint : "none" }
			}, [
				file.kindLabel
					? h("span", {
						key: "b",
						style: {
							fontSize: "10px", fontFamily: "monospace", padding: "0 5px", whiteSpace: "nowrap",
							border: "1px solid " + C.soft, borderRadius: "3px",
							color: file.kind === "final" ? C.ok : C.muted
						}
					}, file.kindLabel)
					: null,
				h("button", {
					key: "n", type: "button",
					onClick: () => onOpen(clickAbs),
					title: "点击打开：" + clickAbs,
					style: {
						font: "inherit", fontSize: "12px", fontFamily: "monospace", padding: 0, border: "none",
						background: "none", color: "#3b6ea5", cursor: "pointer", textAlign: "left",
						overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: "1 1 auto"
					}
				}, file.rel),
				file.spec ? h("span", { key: "s", style: { fontSize: "10px", color: C.muted } }, "规范：" + file.spec) : null,
				file.note ? h("span", {
					key: "nt", whiteSpace: "nowrap",
					style: { fontSize: "10px", color: /当前有效/.test(file.note) ? C.ok : C.warn, fontFamily: "monospace" }
				}, file.note) : null,
				fmtNameDate(file.name) ? h("span", { key: "d", style: { fontSize: "10px", color: C.muted, fontFamily: "monospace", whiteSpace: "nowrap" } }, fmtNameDate(file.name)) : null
			]);

			const groupBox = (g) => h("div", {
				key: g.key,
				style: { border: "1px solid " + C.faint, borderRadius: "4px", background: "#fff", marginBottom: "9px", overflow: "hidden" }
			}, [
				h("div", {
					key: "h",
					onClick: () => setFold((s) => { const o = {}; for (const k in s) o[k] = s[k]; o[g.key] = !s[g.key]; return o; }),
					style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 11px", background: C.bg, cursor: "pointer", borderBottom: fold[g.key] ? "none" : "1px solid " + C.faint }
				}, [
					h("span", { key: "l", style: { fontSize: "12px", fontWeight: 600 } }, [
						g.label + "（" + g.count + "）",
						h("span", { key: "d", style: { fontWeight: 400, fontSize: "11px", color: C.muted, fontFamily: "monospace" } }, g.dir ? "　" + g.dir + "/" : "")
					]),
					h("span", { key: "t", style: { fontSize: "10px", color: C.muted, maxWidth: "58%", textAlign: "right" } }, g.note + (fold[g.key] ? "　展开 ▸" : "　收起 ▾"))
				]),
				fold[g.key] ? null : (g.count
					? h("div", { key: "b", style: { padding: "4px 0" } }, g.files.map((x, i) => rowOf(x, i, absOf(x))))
					: h("div", { key: "e", style: { padding: "7px 11px", fontSize: "11px", color: C.muted } }, "（空）"))
			]);

			return h("div", null, [
				h("div", { key: "sum", style: { fontSize: "12px", color: C.muted, marginBottom: "10px" } },
					"共 " + (art.total || 0) + " 个产物　" + meanings.map((m) => m.label + " " + ((art.counts || {})[m.key] || 0)).join("　")),
				(art.notes || []).map((t, i) => h("div", {
					key: "n" + i,
					style: { border: "1px solid " + C.faint, borderLeft: "3px solid " + C.warn, background: "#fffdf7", borderRadius: "4px", padding: "7px 11px", fontSize: "11px", marginBottom: "8px" }
				}, "⚠ " + t)),
				h("div", { key: "hint", style: { fontSize: "11px", color: C.muted, marginBottom: "9px" } },
					"分组按**子目录**判（桶就是答案）；只有 gdd\\ 内部按文件名再细分一次。清单与磁盘逐条一致 —— 不是白名单过滤出来的。"),
				...meanings.map((m) => {
					const mine = groups.filter((g) => g.meaning === m.key);
					if (!mine.length) return null;
					return h("div", { key: "sec" + m.key, style: { marginBottom: "12px" } }, [
						h("div", { key: "t", style: { fontSize: "12px", fontWeight: 600, marginBottom: "6px" } }, m.label +
							h("span", { key: "c", style: { fontWeight: 400, color: C.muted } }, "　" + mine.reduce((n, g) => n + g.count, 0) + " 个")),
						...mine.map(groupBox)
					]);
				}),
				// 配置表：**不在功能目录里**（按主题挂靠）—— 单独一格，别混进上面的清单
				configs.length ? h("div", {
					key: "cfg",
					style: { border: "1px solid " + C.faint, borderLeft: "3px solid " + C.soft, borderRadius: "4px", background: "#fff", padding: "8px 11px", marginBottom: "9px" }
				}, [
					h("div", { key: "t", style: { fontSize: "12px", fontWeight: 600, marginBottom: "4px" } }, "配置表（" + configs.length + "）　按主题挂靠，不在功能目录内"),
					...configs.map((n, i) => h("div", { key: i, style: { padding: "2px 0" } }, h("button", {
						type: "button",
						onClick: () => onOpen((configRoot || srWs) + "/" + n),
						style: { font: "inherit", fontSize: "12px", fontFamily: "monospace", padding: 0, border: "none", background: "none", color: "#3b6ea5", cursor: "pointer" }
					}, n)))
				]) : null,
				h("div", { key: "old", style: { border: "1px solid " + C.faint, borderRadius: "4px", background: "#fff", overflow: "hidden" } }, h(Fold, {
					title: "按阶段看（旧的读法：概念 / 成稿 / 定稿 / 审查 / 宣讲 / 证据 / 决策）",
					children: h(ArtifactList, { feature: f, srWs: srWs, configRoot: configRoot, onOpen: onOpen })
				})),
				h("div", { key: "foot", style: { marginTop: "12px", fontSize: "11px", color: C.muted, lineHeight: 1.85 } }, [
					h("div", { key: "a" }, "产物来自工作区实时读取（列目录，不读索引文件）。"),
					h("div", { key: "b" }, "点一行用系统默认程序打开；失败会依次试「DSH 内置 openFile → 默认应用 → 文件管理器 reveal」并给出诊断。")
				])
			]);
		}

		/**
		 * 解析定稿的 §5 界面章 —— A5 的数据源。
		 *
		 * **真实格式**（实测 `联盟悬赏_20260923_定稿.md`）：
		 *   ## 5. 用户体验与界面流程
		 *   ### 5.0 界面清单总览
		 *   | 界面ID | 名称 | 进入方式 | 退出方式 |
		 *   | --- | --- | --- | --- |
		 *   | UI-M1 | 联盟悬赏主面板 | 联盟面板内【联盟悬赏】入口 | 返回联盟面板 |
		 *   边界声明：出刀战斗本体复用 BOSS 挑战……（紧跟表格的一段）
		 *   ### 5.1 UI-M1 联盟悬赏主面板
		 *   <img src="联盟悬赏UI/UI-M1 联盟悬赏主面板 · 常规难度.png" alt="…" width="420" />
		 *   | 编号 | 规则 |
		 *   | UE1 | … |
		 *
		 * 只做这几件事；**不解析 §5.5/5.6**（流程与全局规范不是"界面图"）。
		 */
		function parseInterfaceSection(text) {
			const all = String(text || "").split(/\r?\n/);
			// 定位 "## 5." 到下一个 "## " 之间（### 不会被 /^##\s/ 命中）
			let s = -1, e = all.length;
			for (let i = 0; i < all.length; i++) {
				if (s < 0 && /^##\s*5[.、\s]/.test(all[i])) { s = i; continue; }
				if (s >= 0 && /^##\s/.test(all[i])) { e = i; break; }
			}
			if (s < 0) return null;
			const sec = all.slice(s, e);

			// ① §5.0 表格 + 边界声明
			const uiRows = [];
			let boundary = "";
			let on = false;
			for (let i = 0; i < sec.length; i++) {
				const t = sec[i].trim();
				if (/^###\s*5\.0/.test(t)) { on = true; continue; }
				if (!on) continue;
				if (/^###\s/.test(t)) break;
				if (t.startsWith("|")) {
					const cells = t.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
					const isSep = cells.every((c) => /^:?-{2,}:?$/.test(c));
					if (cells.length >= 4 && !isSep && cells[0] !== "界面ID") {
						uiRows.push({ id: cells[0], name: cells[1], enter: cells[2], exit: cells[3] });
					}
				} else if (uiRows.length && t && !boundary) {
					boundary = t.replace(/^边界声明\s*[:：]\s*/, "");
				}
			}

			// ② 各 UI 小节：图片引用 + UE 规则条数
			const uis = [];
			for (let i = 0; i < sec.length; i++) {
				const m = /^###\s*5\.\d+\s+(UI-\S+)\s*(.*)$/.exec(sec[i].trim());
				if (!m) continue;
				let end = sec.length;
				for (let j = i + 1; j < sec.length; j++) { if (/^###\s/.test(sec[j].trim())) { end = j; break; } }
				const body = sec.slice(i + 1, end);
				const images = [];
				let ueCount = 0;
				for (const l of body) {
					const im = /<img[^>]*\bsrc\s*=\s*["']([^"']+)["']/i.exec(l);
					if (im) images.push(im[1]);
					if (/^\|\s*UE\d+/i.test(l.trim())) ueCount += 1;
				}
				uis.push({ id: m[1], title: m[2].trim(), images: images, ueCount: ueCount });
			}
			return { uiRows: uiRows, boundary: boundary, uis: uis, found: true };
		}

		/** 读某功能最新定稿的 §5 界面章（A5 数据源） */
		/** 读定稿的 §5（界面图用）。收**绝对路径** —— 只有 `features\<主题>\gdd\` 一种结构 */
		async function loadInterface(read, sid, absPath, signal) {
			if (!absPath) return { empty: "本功能还没有定稿，界面图在定稿的 §5。" };
			const text = await readAllText(read, sid, absPath, signal, 4000);
			if (!text) return { error: "读不到定稿：" + absPath };
			let parsed = null;
			try { parsed = parseInterfaceSection(text); }
			catch (e) { return { error: "解析 §5 失败：" + String((e && e.message) || e) }; }
			if (!parsed) return { empty: "定稿里没有 §5 界面章。" };
			parsed.file = String(absPath).split(/[\\/]/).pop();
			return parsed;
		}

		/** 本机图片 → 同源 URL（DSH 的 /api/file 路由；Windows 盘符绝对路径服务端也接受） */
		function fileUrl(abs) {
			try {
				const o = (typeof window !== "undefined" && window.location && window.location.origin) || "";
				return o + "/api/file?path=" + encodeURIComponent(abs);
			} catch (e) { return ""; }
		}

		/** 读资产索引（第一部分的数据源；由 scripts/refresh_asset_index.py 生成） */
		/**
		 * 读定稿全文并解析结构（设计 §6.2 定稿工作面）。
		 * ★ 收**绝对路径**（= 功能的 `openPath`）—— 面板不自己拼路径，
		 *   路径由调用方从功能目录算出来，所以目录结构怎么变都不用改这里。
		 */
		async function loadFinal(read, sid, absPath, signal) {
			if (!absPath) return { empty: "这个功能还没有定稿。" };
			const text = await readAllText(read, sid, absPath, signal, 6000);
			if (!text) return { error: "读不到定稿：" + absPath };
			const g = parseFinalGdd(text);
			g.path = absPath;
			g.dir = String(absPath).replace(/[\\/][^\\/]*$/, "");
			g.name = String(absPath).split(/[\\/]/).pop();
			return g;
		}

		async function loadIndex(read, sid, srWs, signal) {
			const text = await readAllText(read, sid, srWs + "/design-asset-index.json", signal, 8000);
			if (!text) return { error: "读不到 design-asset-index.json。先点「刷新索引」让 agent 生成它。" };
			let j = null;
			try { j = JSON.parse(text); }
			catch (e) { return { error: "索引 JSON 解析失败：" + String((e && e.message) || e) }; }
			if (!j || !Array.isArray(j.assets)) return { error: "索引结构不对：assets 不是数组。" };
			return {
				assets: j.assets, schemaVersion: j.schema_version, workspaceId: j.workspace_id,
				srWs: srWs
			};
		}

		// ── B1 设计资产列表 ──────────────────────────────────────────
		const ASSET_TYPE_LABEL = {
			concept: "概念", analysis: "分析", proposal: "成稿文档", decision: "决策",
			evidence: "证据", validation: "验证", inbox: "收集箱",
			assumption: "假设", experiment: "实验", "gate-result": "门结果",
			"workflow-run": "工作流", learning: "复盘规则", retrospective: "复盘",
			knowledge: "知识", "information-assessment": "信息评估"
		};
		const REVIEW_TONE = {
			accepted: "ok", reviewed: "ok", draft: null, needs_review: "warn",
			rejected: "bad", superseded: "warn"
		};
		const REVIEW_LABEL = {
			draft: "草稿", needs_review: "待审", reviewed: "已审", accepted: "已接受",
			rejected: "已驳回", superseded: "已被取代"
		};

		/** 收件箱允许内联的文本文件大小上限（超过就不内联，只记路径） */
		const INLINE_TEXT_CAP = 200000;

		/**
		 * 一个待发送的素材 → 显示用的 { name, size, err }
		 * 文本文件用 FileReader 读出来内联（浏览器自己就能读，省掉 agent 再读一次盘）；
		 * 二进制只记 fullPath（agent 读盘），拿不到路径就退化成大小未知的上传件。
		 */
		async function ingestFile(file) {
			const name = String((file && file.name) || "未命名文件");
			const size = Number((file && file.size) || 0);
			const fullPath = String((file && file.path) || "");
			const C0 = contract;
			const textExt = C0 ? C0.isTextExt(name) : false;
			const docExt = C0 ? C0.isDoc(name) : false;
			if (textExt) {
				try {
					const text = await readFileText(file, INLINE_TEXT_CAP);
					return { name: name, size: size, fullPath: fullPath, isText: true, text: text, orig: file };
				} catch (e) {
					return { name: name, size: size, fullPath: fullPath, isText: false, isDoc: docExt, upload: !fullPath, orig: file, err: "读取失败：" + String((e && e.message) || e) };
				}
			}
			// 二进制：有绝对路径 → 交给 agent 读盘；没有 → 走上传通道
			return { name: name, size: size, fullPath: fullPath, isText: false, isDoc: docExt, upload: !fullPath, orig: file };
		}

		/**
		 * ★ 收件箱 —— 四种输入方式的**统一入口**（拍板 2026-09-28：单框 + 四按钮并排，不做自动判型）。
		 *
		 * 分工（依据 outputs/四种输入方式产出规范-v1.md）：
		 *   方式 1 竞品分析   → 跑 sr-analysis（有决策门、有花费）
		 *   方式 2 问答式访谈 → 跑 sr-concept（有决策门、有花费）
		 *   方式 3 旧文档导入 → 只登记进 inbox/imported/（不跑 skill）
		 *   方式 4 人工补充   → 只登记进 inbox/manual/（不跑 skill）
		 *
		 * ★ 这个组件**不判断你输入的是哪一种** —— 四个按钮就是分类，按哪个就走哪条。
		 *   工作台读不到工作区文件系统之外的东西，也不猜你的意图。
		 */
		function IntakeBox(props) {
			const [raw, setRaw] = React.useState("");
			const [note, setNote] = React.useState("");
			const [files, setFiles] = React.useState([]);
			const [busyId, setBusyId] = React.useState("");
			const [msg, setMsg] = React.useState(null);
			const [drag, setDrag] = React.useState(false);
			const fileRef = React.useRef(null);

			if (!contract) {
				return h("div", {
					style: { border: "1px solid " + C.faint, borderLeft: "3px solid " + C.bad, background: "#fff", borderRadius: "4px", padding: "10px 12px", marginBottom: "12px", fontSize: "12px", color: C.bad }
				}, "收件箱逻辑没加载上（intake-parse.js）：" + (contractErr || "未知原因") + "　—— 其余屏不受影响。");
			}

			const materials = contract.parseMaterials(raw);
			const pathMats = materials.filter((m) => m.kind !== "text");
			const textMats = materials.filter((m) => m.kind === "text");
			const fullPathCount = files.filter((f) => f.fullPath).length;
			const noPath = files.filter((f) => !f.fullPath).map((f) => f.name);
			const derived = contract.deriveTopic(materials.concat(
				files.filter((f) => f.fullPath).map((f) => ({ kind: "file", path: f.fullPath }))
			));
			const noteAuto = note.trim() === "" && textMats.length > 0;
			const effectiveNote = noteAuto
				? textMats.map((m) => m.text).join("\n\n")
				: note;

			const addFiles = (list) => {
				const arr = [];
				for (const f of list) arr.push(f);
				if (arr.length === 0) return;
				setMsg(null);
				Promise.all(arr.map(ingestFile)).then((out) => setFiles((cur) => cur.concat(out)));
			};

			const removeFile = (i) => setFiles((cur) => cur.filter((_, k) => k !== i));

			const go = (id) => {
				if (busyId) return;
				setBusyId(id);
				setMsg(null);
				// ★ 必须接住**同步**抛错：submitIntake 是 async 函数、本身不会同步抛，
				//   但 handler 万一被换成同步实现，异常会跳过 .then 让 busyId 永久卡住（按钮全灰）。
				let p;
				try {
					p = props.onSubmit({
						kind: id,
						materials: materials,
						topic: derived,
						note: effectiveNote,
						files: files,
						upstream: ""
					});
				} catch (e) {
					setBusyId("");
					setMsg({ ok: false, text: "提交失败（同步抛错）：" + String((e && e.message) || e) });
					return;
				}
				Promise.resolve(p).then((r) => {
					setBusyId("");
					if (r && r.ok) {
						setMsg({ ok: true, text: r.note });
						setRaw("");
						setNote("");
						setFiles([]);
					} else {
						setMsg({ ok: false, text: (r && r.note) || "没能发出指令。" });
					}
				}, (e) => { setBusyId(""); setMsg({ ok: false, text: "失败：" + String((e && e.message) || e) }); });
			};

			const zone = {
				border: "1px dashed " + (drag ? C.ink : C.soft),
				background: drag ? "#f2f2f2" : "#fff",
				borderRadius: "4px", padding: "9px 11px", marginTop: "8px",
				fontSize: "11px", color: C.muted, textAlign: "center", cursor: "pointer"
			};

			const kb = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");

			return h("div", {
				key: "intake",
				style: { border: "1px solid " + C.ink, borderRadius: "6px", padding: "12px 14px", marginBottom: "13px", background: "#fff" }
			}, [
				h("div", { key: "hd", style: { display: "flex", alignItems: "baseline", gap: "9px", flexWrap: "wrap", marginBottom: "8px" } }, [
					h("span", { key: "t", style: { fontSize: "13px", fontWeight: 600 } }, "收件箱"),
					h("span", { key: "s", style: { fontSize: "11px", color: C.muted } },
						"四种输入方式都从这里进 —— 按你要做的那一种，别猜它算哪类")
				]),

				h("textarea", {
					key: "raw", value: raw, rows: 3,
					placeholder: "粘路径 / 贴链接 / 直接写一段话（多个路径请各占一行）",
					onChange: (e) => { setRaw(e.target.value); setMsg(null); },
					style: {
						width: "100%", boxSizing: "border-box", fontSize: "12px", lineHeight: 1.7,
						padding: "7px 9px", border: "1px solid " + C.soft, borderRadius: "4px",
						outline: "none", resize: "vertical", fontFamily: "inherit", background: "#fff"
					}
				}),

				h("div", {
					key: "zone", style: zone,
					onClick: () => { if (fileRef.current) fileRef.current.click(); },
					onDragOver: (e) => { e.preventDefault(); if (!drag) setDrag(true); },
					onDragLeave: () => setDrag(false),
					onDrop: (e) => {
						e.preventDefault(); setDrag(false);
						const dt = e.dataTransfer;
						if (dt && dt.files && dt.files.length > 0) addFiles(dt.files);
					}
				}, "把文件 / 文件夹拖到这里，或点这里选择文件（文本类自动读成内容；其余记路径，由 agent 去读）"),

				h("input", {
					key: "fi", type: "file", multiple: true, ref: fileRef,
					style: { display: "none" },
					onChange: (e) => { addFiles(e.target.files || []); e.target.value = ""; }
				}),

				files.length > 0 ? h("div", { key: "fl", style: { display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "7px" } },
					files.map((f, i) => h("span", {
						key: "f" + i,
						style: {
							display: "inline-flex", alignItems: "center", gap: "6px",
							fontSize: "11px", padding: "3px 8px", borderRadius: "12px",
							border: "1px solid " + (f.err ? C.bad : C.soft),
							background: f.err ? "#fff" : "#f7f7f7", color: f.err ? C.bad : C.ink
						}
					}, [
						h("span", { key: "n" }, f.name + "　" + (f.size ? kb(f.size) : "大小未知") +
							(f.isText ? "　已读入" : f.fullPath ? "　记路径" : "　上传")),
						h("button", {
							key: "x", type: "button", onClick: () => removeFile(i),
							style: { font: "inherit", border: "none", background: "transparent", cursor: "pointer", color: C.muted, padding: 0 }
						}, "✕")
					])) ) : null,

				h("input", {
					key: "nt", value: note, placeholder: "备注 / 分析目标 / 正文（可空；空则自动取输入框里的散文）",
					onChange: (e) => { setNote(e.target.value); setMsg(null); },
					style: {
						width: "100%", boxSizing: "border-box", fontSize: "12px", padding: "5px 8px",
						border: "1px solid " + C.soft, borderRadius: "4px", outline: "none",
						background: "#fff", marginTop: "7px"
					}
				}),

				h("div", { key: "meta", style: { fontSize: "11px", color: C.muted, lineHeight: 1.9, marginTop: "6px" } }, [
					h("div", { key: "a" }, "识别到的素材：" + materials.length + " 项（其中路径/链接 " + pathMats.length + " 项，散文 " + textMats.length + " 段）" +
						(files.length > 0 ? "，文件 " + files.length + " 个" : "")),
					h("div", { key: "b" }, "将归档到功能主题：" + (derived || "（还看不出来 —— 给个素材或写一句标题）")),
					noteAuto ? h("div", { key: "c" }, "备注自动取输入框里的散文：" + String(effectiveNote).replace(/\s+/g, " ").slice(0, 80) + (String(effectiveNote).length > 80 ? "…" : "")) : null,
					noPath.length > 0 ? h("div", { key: "d", style: { color: C.warn } }, "⚠ 这些文件拿不到本机路径，只能作为会话附件上传（agent 读不到内容）：" + noPath.join("、")) : null
				]),

				h("div", { key: "btns", style: { display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px" } },
					contract.INTAKE_KINDS.map((k) => h("button", {
						key: k.id, type: "button", disabled: !!busyId,
						title: k.needs,
						onClick: () => go(k.id),
						style: {
							font: "inherit", textAlign: "left", cursor: busyId ? "default" : "pointer",
							padding: "7px 11px", borderRadius: "4px",
							border: "1px solid " + (busyId === k.id ? C.ink : C.soft),
							background: busyId === k.id ? C.ink : "#fff",
							color: busyId === k.id ? "#fff" : C.ink
						}
					}, [
						h("div", { key: "l", style: { fontSize: "12px", fontWeight: 600 } },
							(busyId === k.id ? "已发出 · " : "") + k.label),
						h("div", { key: "h", style: { fontSize: "10px", color: busyId === k.id ? "#ddd" : C.muted } }, k.hint)
					]))),

				msg ? h("div", {
					key: "m",
					style: {
						marginTop: "9px", padding: "7px 10px", borderRadius: "4px", fontSize: "11px", lineHeight: 1.85,
						border: "1px solid " + (msg.ok ? C.ok : C.bad), color: msg.ok ? C.ok : C.bad, background: "#fff"
					}
				}, msg.text) : null,

				props.refs ? h("div", {
					key: "rf",
					style: { marginTop: "9px", paddingTop: "8px", borderTop: "1px solid " + C.faint, fontSize: "11px", color: C.muted, lineHeight: 1.9 }
				}, [
					h("div", { key: "a" }, "跑这一趟的下游产物（点开看）："),
					props.refs.map((x, i) => h("div", { key: "r" + i }, [
						h("button", {
							key: "b", type: "button",
							onClick: () => props.onOpenRef(x.abs),
							style: { font: "inherit", fontSize: "11px", border: "none", background: "transparent", color: C.ink, cursor: "pointer", padding: 0, textDecoration: "underline" }
						}, x.label)
					]))
				]) : null
			]);
		}

		/**
		 * B1 · 设计资产列表
		 * 数据源：workspace/design-asset-index.json（由 refresh_asset_index.py 生成）
		 */
		function AssetsPanel(props) {
			const data = props.data;
			const [type, setType] = React.useState("__all__");
			const [rev, setRev] = React.useState("__all__");
			const [q, setQ] = React.useState("");
			const [busy, setBusy] = React.useState(false);
			const [note, setNote] = React.useState(null);
			const [openAsset, setOpenAsset] = React.useState(null);
			const [tool, setTool] = React.useState("");
			const [impPath, setImpPath] = React.useState("");
			const [impNote, setImpNote] = React.useState("");
			const [mTitle, setMTitle] = React.useState("");
			const [mBody, setMBody] = React.useState("");
			const [mUp, setMUp] = React.useState("");
			const onOpen = props.onOpen;
			const onRefresh = props.onRefresh;

			const tbtn = (key, label, active, onPick) => h("button", {
				key: key, type: "button", disabled: busy,
				onClick: onPick,
				style: {
					font: "inherit", fontSize: "12px", padding: "5px 13px",
					border: "1px solid " + (active ? C.ink : C.soft),
					background: active ? C.ink : "#fff",
					color: active ? "#fff" : C.ink,
					borderRadius: "4px", cursor: busy ? "default" : "pointer"
				}
			}, label);

			if (!data) return h("div", { style: { color: C.muted, fontSize: "12px" } }, "正在读资产索引…");

			// 阅读器（B2）
			if (openAsset) {
				return h(AssetReader, {
					asset: openAsset, srWs: data.srWs, read: props.read,
					onBack: () => setOpenAsset(null), onOpen: onOpen
				});
			}
			if (data.error) {
				return h("div", null, [
					h("div", { key: "e", style: { border: "1px solid " + C.bad, borderLeft: "3px solid " + C.bad, background: "#fff", borderRadius: "4px", padding: "10px 12px", fontSize: "12px", color: C.bad, marginBottom: "10px" } }, data.error),
					props.onRefresh ? h("div", { key: "a" }, h("button", {
						type: "button",
						onClick: () => { setBusy(true); setNote(null); props.onRefresh().then((t) => { setBusy(false); setNote(t); }); },
						disabled: busy,
						style: { font: "inherit", fontSize: "12px", padding: "6px 14px", border: "1px solid " + C.ink, background: C.ink, color: "#fff", borderRadius: "4px", cursor: "pointer" }
					}, busy ? "已发出指令，等 agent 跑完…" : "刷新资产索引")) : null,					note ? h("div", { key: "n", style: { marginTop: "9px", fontSize: "12px", color: C.muted } }, note) : null
				]);
			}

			const all = data.assets;
			const byId = {};
			for (const a of all) byId[a.asset_id] = a;

			// 计数
			const typeCounts = {}, revCounts = {};
			for (const a of all) {
				typeCounts[a.asset_type] = (typeCounts[a.asset_type] || 0) + 1;
				revCounts[a.review_status] = (revCounts[a.review_status] || 0) + 1;
			}

			const filtered = all.filter((a) => {
				if (type !== "__all__" && a.asset_type !== type) return false;
				if (rev !== "__all__" && a.review_status !== rev) return false;
				if (q) {
					const hay = (a.asset_id + " " + a.path + " " + (a.title || "")).toLowerCase();
					if (hay.indexOf(q.toLowerCase()) < 0) return false;
				}
				return true;
			}).sort((x, y) => (x.asset_id < y.asset_id ? -1 : 1));

			const chip = (label, count, active, onPick, key) => h("button", {
				key: key, type: "button", onClick: onPick,
				style: {
					font: "inherit", fontSize: "11px", padding: "3px 10px",
					border: "1px solid " + (active ? C.ink : C.faint),
					background: active ? C.ink : "#fff",
					color: active ? "#fff" : C.ink,
					borderRadius: "12px", cursor: "pointer", whiteSpace: "nowrap"
				}
			}, label + (count === void 0 ? "" : " " + count));

			const linkRefs = (refs) => (refs || []).map((r) => {
				const t = byId[r];
				return t ? (ASSET_TYPE_LABEL[t.asset_type] || t.asset_type) + " " + r : r;
			}).join("、");

			return h("div", null, [
				h("div", { key: "sum", style: { fontSize: "12px", color: C.muted, marginBottom: "10px" } },
					"索引 schema " + (data.schemaVersion || "?") + " · 工作区 " + (data.workspaceId || "?") + "　共 " + all.length + " 条资产"),

				// ★ 收件箱：四种输入方式的统一入口（拍板 2026-09-28）
				props.onIntake ? h(IntakeBox, {
					key: "intake",
					onSubmit: props.onIntake,
					refs: props.intakeRefs,
					onOpenRef: onOpen
				}) : null,

				// ↓ 旧的「导入旧文档 / 人工补充」双窗口已并入上面的收件箱；保留代码仅为回退，入口不再显示。
				// 工具栏：三种"改文件"的动作，全部交给 agent（工作台自己写不了文件）
				(onRefresh && tool === "__legacy__") ? h("div", { key: "rf", style: { marginBottom: "11px" } }, [
					h("div", { key: "btns", style: { display: "flex", gap: "7px", flexWrap: "wrap", marginBottom: "7px" } }, [
						tbtn("b1", busy ? "已发出指令…" : "刷新资产索引", tool === "", () => { setTool(""); setNote(null); setBusy(true); props.onRefresh().then((t) => { setBusy(false); setNote(t); }); }),
						tbtn("b2", "导入旧文档", tool === "import", () => { setTool(tool === "import" ? "" : "import"); setNote(null); }),
						tbtn("b3", "人工补充", tool === "manual", () => { setTool(tool === "manual" ? "" : "manual"); setNote(null); })
					]),
					h("div", { key: "hint", style: { fontSize: "11px", color: C.muted } },
						"工作台不自己改文件 —— 这三个动作都只是把意图发给 agent，由它执行")
				]) : null,

				// 方式 3 · 导入旧文档
				tool === "import" ? h("div", {
					key: "imp",
					style: { border: "1px solid " + C.faint, borderLeft: "3px solid " + C.ink, background: "#fff", borderRadius: "4px", padding: "11px 13px", marginBottom: "11px" }
				}, [
					h("div", { key: "t", style: { fontSize: "12px", fontWeight: 600, marginBottom: "6px" } }, "方式 3 · 导入旧文档"),
					h("div", { key: "d", style: { fontSize: "11px", color: C.muted, lineHeight: 1.8, marginBottom: "8px" } }, [
						h("div", { key: "a" }, "选一个旧方案 / 旧文档所在目录（本机任意位置）。"),
						h("div", { key: "b" }, "导入件放 " + "inbox/imported/" + "，登记为 inbox / 待审，**不提升为正式资产**（旧文档是参考材料，供成稿时按章节对照）。")
					]),
					h("div", { key: "row", style: { display: "flex", gap: "7px", alignItems: "center", flexWrap: "wrap", marginBottom: "7px" } }, [
						h("button", {
							key: "p", type: "button", disabled: busy || !props.onPickDir,
							onClick: () => {
								setBusy(true);
								props.onPickDir().then((r) => {
									setBusy(false);
									if (r && r.ok && r.value) { setImpPath(String(r.value)); setNote(null); }
									else if (r && r.ok && !r.value) setNote("已取消选择。");
									else setNote("选择目录失败：" + humanError(r));
								});
							},
							style: { font: "inherit", fontSize: "12px", padding: "5px 12px", border: "1px solid " + C.ink, background: "#fff", borderRadius: "4px", cursor: "pointer" }
						}, "选择目录…"),
						h("input", {
							key: "i", value: impPath, placeholder: "或直接粘贴目录路径",
							onChange: (e) => setImpPath(e.target.value),
							style: { flex: "1 1 260px", fontSize: "12px", padding: "5px 8px", border: "1px solid " + C.soft, borderRadius: "4px", outline: "none", fontFamily: "monospace", background: "#fff" }
						})
					]),
					h("input", {
						key: "n", value: impNote, placeholder: "备注（可选，例如：V0.3 完整策划案，成稿时按章节对照）",
						onChange: (e) => setImpNote(e.target.value),
						style: { width: "100%", boxSizing: "border-box", fontSize: "12px", padding: "5px 8px", border: "1px solid " + C.soft, borderRadius: "4px", outline: "none", background: "#fff", marginBottom: "8px" }
					}),
					h("button", {
						key: "go", type: "button", disabled: busy || !impPath,
						onClick: () => { setBusy(true); setNote(null); props.onImport(impPath, impNote).then((t) => { setBusy(false); setNote(t); setTool(""); }); },
						style: { font: "inherit", fontSize: "12px", padding: "6px 15px", border: "1px solid " + C.ink, background: busy || !impPath ? "#888" : C.ink, color: "#fff", borderRadius: "4px", cursor: busy || !impPath ? "default" : "pointer" }
					}, "确认导入")
				]) : null,

				// 方式 4 · 人工补充
				tool === "manual" ? h("div", {
					key: "man",
					style: { border: "1px solid " + C.faint, borderLeft: "3px solid " + C.ink, background: "#fff", borderRadius: "4px", padding: "11px 13px", marginBottom: "11px" }
				}, [
					h("div", { key: "t", style: { fontSize: "12px", fontWeight: 600, marginBottom: "6px" } }, "方式 4 · 人工补充"),
					h("div", { key: "d", style: { fontSize: "11px", color: C.muted, lineHeight: 1.8, marginBottom: "8px" } },
						"写入 inbox/manual/，登记为 inbox / 待审。想到一条规则、边界情况或口径，随手记下来即可 —— 不用先想归类。"),
					h("input", {
						key: "ti", value: mTitle, placeholder: "标题（例如：联盟榜同分时的排序口径）",
						onChange: (e) => setMTitle(e.target.value),
						style: { width: "100%", boxSizing: "border-box", fontSize: "12px", padding: "5px 8px", border: "1px solid " + C.soft, borderRadius: "4px", outline: "none", background: "#fff", marginBottom: "7px" }
					}),
					h("textarea", {
						key: "bo", value: mBody, placeholder: "正文（自由文本）",
						onChange: (e) => setMBody(e.target.value),
						rows: 7,
						style: { width: "100%", boxSizing: "border-box", fontSize: "12px", lineHeight: 1.7, padding: "7px 9px", border: "1px solid " + C.soft, borderRadius: "4px", outline: "none", background: "#fff", resize: "vertical", fontFamily: "inherit", marginBottom: "7px" }
					}),
					h("div", { key: "up", style: { display: "flex", gap: "7px", alignItems: "center", flexWrap: "wrap", marginBottom: "8px" } }, [
						h("span", { key: "l", style: { fontSize: "11px", color: C.muted } }, "补充的是哪份资产（可选）"),
						h("select", {
							key: "s", value: mUp, onChange: (e) => setMUp(e.target.value),
							style: { flex: "1 1 280px", fontSize: "12px", padding: "4px 7px", border: "1px solid " + C.soft, borderRadius: "4px", background: "#fff" }
						}, [
							h("option", { key: "", value: "" }, "（不指定）"),
							...all.filter((a) => a.asset_type !== "inbox").map((a) =>
								h("option", { key: a.asset_id, value: a.asset_id }, a.asset_id + "　" + String(a.path)))
						])
					]),
					h("button", {
						key: "go", type: "button", disabled: busy || !mTitle.trim() || !mBody.trim(),
						onClick: () => {
							setBusy(true); setNote(null);
							props.onManual(mTitle.trim(), mBody, mUp).then((t) => {
								setBusy(false); setNote(t); setTool(""); setMTitle(""); setMBody(""); setMUp("");
							});
						},
						style: { font: "inherit", fontSize: "12px", padding: "6px 15px", border: "1px solid " + C.ink, background: busy || !mTitle.trim() || !mBody.trim() ? "#888" : C.ink, color: "#fff", borderRadius: "4px", cursor: "pointer" }
					}, "保存到收集箱")
				]) : null,

				note ? h("div", { key: "nt", style: { border: "1px solid " + C.faint, borderLeft: "3px solid " + C.ok, background: "#fff", borderRadius: "4px", padding: "8px 11px", fontSize: "12px", marginBottom: "11px", color: C.ok } }, note) : null,

				// 筛选
				h("div", { key: "f1", style: { display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "7px" } }, [
					chip("全部", all.length, type === "__all__", () => setType("__all__"), "t0"),
					...Object.keys(typeCounts).sort().map((k) => chip(ASSET_TYPE_LABEL[k] || k, typeCounts[k], type === k, () => setType(k), "t" + k))
				]),
				h("div", { key: "f2", style: { display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "9px", alignItems: "center" } }, [
					chip("全部审核态", void 0, rev === "__all__", () => setRev("__all__"), "r0"),
					...Object.keys(revCounts).sort().map((k) => chip(REVIEW_LABEL[k] || k, revCounts[k], rev === k, () => setRev(k), "r" + k)),
					h("input", {
						key: "q", value: q, placeholder: "搜索 id / 路径 / 标题…",
						onChange: (e) => setQ(e.target.value),
						style: {
							flex: "1 1 180px", maxWidth: "280px", fontSize: "12px", padding: "3px 8px",
							border: "1px solid " + C.soft, borderRadius: "12px", outline: "none", background: "#fff"
						}
					}),
					h("span", { key: "n", style: { fontSize: "11px", color: C.muted } }, "显示 " + filtered.length + " / " + all.length)
				]),

				// 列表
				filtered.length ? h("div", { key: "list", style: { border: "1px solid " + C.faint, borderRadius: "4px", background: "#fff", overflow: "hidden" } },
					filtered.map((a, i) => {
						const tone = REVIEW_TONE[a.review_status] === void 0 ? null : REVIEW_TONE[a.review_status];
						const refs = [];
						if (a.supersedes && a.supersedes.length) refs.push("取代 " + linkRefs(a.supersedes));
						if (a.upstream_assets && a.upstream_assets.length) refs.push("上游 " + linkRefs(a.upstream_assets));
						if (a.downstream_assets && a.downstream_assets.length) refs.push("下游 " + linkRefs(a.downstream_assets));
						return h("div", {
							key: a.asset_id || i,
							style: { padding: "8px 11px", borderTop: i ? "1px solid " + C.faint : "none" }
						}, [
							h("div", { key: "r1", style: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" } }, [
								h("span", { key: "id", style: { fontFamily: "monospace", fontSize: "11px", color: C.muted, minWidth: "150px" } }, String(a.asset_id || "")),
								badge(ASSET_TYPE_LABEL[a.asset_type] || a.asset_type, null),
								a.review_status ? badge(REVIEW_LABEL[a.review_status] || a.review_status, tone) : null,
								a.format ? badge(a.format, null) : null,
								a.source_skill ? h("span", { key: "sk", style: { fontSize: "10px", color: C.muted, fontFamily: "monospace" } }, a.source_skill) : null
							]),
							h("div", { key: "r2", style: { marginTop: "3px" } }, h("button", {
								type: "button",
								onClick: () => setOpenAsset(a),
								title: "在面板里阅读：" + a.path,
								style: {
									font: "inherit", fontSize: "12px", fontFamily: "monospace", padding: 0,
									border: "none", background: "none", color: "#3b6ea5", cursor: "pointer",
									textAlign: "left", maxWidth: "100%", overflow: "hidden",
									textOverflow: "ellipsis", whiteSpace: "nowrap"
								}
							}, String(a.path || ""))),
							refs.length ? h("div", { key: "r3", style: { marginTop: "3px", fontSize: "11px", color: C.muted } }, refs.join("　·　")) : null
						]);
					})) : h("div", { key: "none", style: { color: C.muted, fontSize: "12px" } }, "没有匹配的资产。"),

				h("div", { key: "foot", style: { marginTop: "12px", fontSize: "11px", color: C.muted, lineHeight: 1.85 } }, [
					h("div", { key: "a" }, "资产索引由 scripts/refresh_asset_index.py 生成；工作台只读它，不自己维护。"),
					h("div", { key: "b" }, "扫描范围：analysis / decisions / evidence / proposals 四个目录。运行包与副本不在索引内。")
				])
			]);
		}

		// ── 内容阅读器（B2）──────────────────────────────────────────
		/** 按扩展名判类型 */
		function extOf(p) {
			const m = /\.([A-Za-z0-9]+)$/.exec(String(p || ""));
			return m ? m[1].toLowerCase() : "";
		}
		const IMG_EXT = { png: 1, jpg: 1, jpeg: 1, gif: 1, webp: 1, svg: 1, bmp: 1 };
		const MD_EXT = { md: 1, markdown: 1 };
		const JSON_EXT = { json: 1 };
		const TEXT_EXT = { txt: 1, yml: 1, yaml: 1, csv: 1, py: 1, js: 1, ts: 1, html_: 1 };

		/** 值 → 一行短文本 */
		function shortVal(v) {
			if (v === null) return "null";
			if (v === void 0) return "—";
			if (typeof v === "boolean") return v ? "true" : "false";
			if (typeof v === "number") return String(v);
			if (typeof v === "string") return v;
			if (Array.isArray(v)) return "[" + v.length + " 项]";
			return "{" + Object.keys(v).length + " 个字段}";
		}
		const isScalar = (v) => v === null || typeof v !== "object";
		const isObjArray = (v) => Array.isArray(v) && v.length > 0 && v.every((x) => x && typeof x === "object" && !Array.isArray(x));

		/**
		 * 通用「可读 JSON」渲染器 —— 这是"json 不方便阅读"的正解。
		 * 标量成行 / 对象成节 / 对象数组成表 / 长文本成块。
		 */
		function ReadableJson(props) {
			const v = props.value;
			const depth = props.depth || 0;
			const pad = 12 + depth * 12;

			if (isScalar(v)) {
				return h("div", { style: { fontSize: "12px", lineHeight: 1.75, whiteSpace: "pre-wrap", wordBreak: "break-word" } }, shortVal(v));
			}
			if (Array.isArray(v)) {
				if (v.length === 0) return h("div", { style: { fontSize: "12px", color: C.muted } }, "（空）");
				if (isObjArray(v)) {
					const keys = [];
					for (const it of v) for (const k of Object.keys(it)) if (keys.indexOf(k) < 0) keys.push(k);
					return h("div", { style: { overflowX: "auto" } }, h("table", { style: { borderCollapse: "collapse", width: "100%", fontSize: "11px" } }, [
						h("thead", { key: "h" }, h("tr", null, keys.map((k) => h("th", {
							key: k, style: { border: "1px solid " + C.faint, background: C.bg, padding: "4px 7px", textAlign: "left", whiteSpace: "nowrap" }
						}, k)))),
						h("tbody", { key: "b" }, v.map((it, i) => h("tr", { key: i }, keys.map((k) => {
							const cell = it[k];
							return h("td", {
								key: k,
								style: { border: "1px solid " + C.faint, padding: "4px 7px", verticalAlign: "top", maxWidth: "320px" }
							}, isScalar(cell)
								? h("span", { style: { whiteSpace: "pre-wrap", wordBreak: "break-word" } }, shortVal(cell))
								: h("span", { style: { color: C.muted } }, shortVal(cell)));
						}))))
					]));
				}
				return h("div", { style: { display: "flex", flexDirection: "column", gap: "4px" } },
					v.map((x, i) => h("div", { key: i, style: { display: "flex", gap: "7px" } }, [
						h("span", { key: "i", style: { color: C.muted, fontFamily: "monospace", fontSize: "11px" } }, String(i + 1) + "."),
						h("span", { key: "v", style: { flex: "1 1 auto" } }, isScalar(x)
							? h("span", { style: { fontSize: "12px", whiteSpace: "pre-wrap", wordBreak: "break-word" } }, shortVal(x))
							: h(ReadableJson, { value: x, depth: depth + 1 }))
					])));
			}
			// 对象
			const keys = Object.keys(v);
			if (!keys.length) return h("div", { style: { fontSize: "12px", color: C.muted } }, "（空对象）");
			return h("div", null, keys.map((k) => {
				const val = v[k];
				const scalar = isScalar(val);
				return h("div", {
					key: k,
					style: { display: "flex", gap: "9px", paddingLeft: pad + "px", marginBottom: "3px", alignItems: "flex-start" }
				}, [
					h("span", {
						key: "k",
						style: {
							fontSize: "11px", fontFamily: "monospace", color: C.muted,
							minWidth: "120px", flex: "0 0 auto", paddingTop: scalar ? "1px" : "0"
						}
					}, k),
					h("span", { key: "v", style: { flex: "1 1 auto", minWidth: 0 } }, scalar
						? h("span", {
							style: {
								fontSize: "12px", whiteSpace: "pre-wrap", wordBreak: "break-word",
								display: "block", lineHeight: 1.7
							}
						}, shortVal(val))
						: h(ReadableJson, { value: val, depth: depth + 1 }))
				]);
			}));
		}

		/** 单个资产的内容阅读器（B2）*/
		function AssetReader(props) {
			const a = props.asset;
			const srWs = props.srWs || "";
			const onBack = props.onBack;
			const onOpen = props.onOpen;
			const [text, setText] = React.useState(void 0);   // undefined=加载中 null=读不到
			const [docDir, setDocDir] = React.useState("");
			const read = props.read;

			const abs = a ? srWs + "/" + a.path : "";
			const ext = extOf(a ? a.path : "");

			React.useEffect(() => {
				if (!a || !read || !srWs) { setText(null); return; }
				if (IMG_EXT[ext]) { setText(""); return; }        // 图片不需要读文本
				let cancelled = false;
				setText(void 0);
				const dir = String(a.path).replace(/[^\\/]+$/, "");
				setDocDir(dir);
				read(srWs + "/" + a.path).then(
					(t) => { if (!cancelled) setText(t); },
					() => { if (!cancelled) setText(null); }
				);
				return () => { cancelled = true; };
			}, [a ? a.asset_id : "", a ? a.path : "", srWs]);

			if (!a) return null;

			const body = [];

			// 图片
			if (IMG_EXT[ext]) {
				body.push(h("img", {
					key: "img", src: fileUrl(abs), alt: a.path,
					style: { maxWidth: "100%", border: "1px solid " + C.faint, borderRadius: "4px", background: C.bg, display: "block" }
				}));
			}
			// HTML：/api/file 带 `CSP: sandbox; default-src 'none'`，内嵌会变成无样式文本 → 不内嵌
			else if (ext === "html" || ext === "htm") {
				body.push(h("div", {
					key: "html",
					style: { border: "1px solid " + C.faint, borderLeft: "3px solid " + C.warn, background: "#fffdf7", borderRadius: "4px", padding: "11px 13px", fontSize: "12px", lineHeight: 1.8 }
				}, [
					h("div", { key: "a" }, "HTML 交付物不在面板里内嵌渲染。"),
					h("div", { key: "b", style: { color: C.muted } },
						"原因：/api/file 路由带 `Content-Security-Policy: sandbox; default-src 'none'`，内嵌会丢掉全部样式。"),
					h("div", { key: "c", style: { color: C.muted } }, "点上面的「用默认程序打开」会在浏览器里正常显示。")
				]));
			}
			// markdown —— 按产出规范渲染（有规范走 SpecMdView，没有才按原文）
			else if (MD_EXT[ext] && typeof text === "string") {
				const absDir = srWs + (docDir ? "/" + String(docDir).replace(/\/$/, "") : "");
				const pathImages = {
					resolve: (v) => {
						if (!v || typeof v !== "string") return void 0;
						if (!/\.(png|jpe?g|gif|webp|svg)$/i.test(v)) return void 0;
						const isAbs = /^[A-Za-z]:[\\/]/.test(v) || v.charAt(0) === "/";
						return fileUrl(isAbs ? v : absDir.replace(/[\\/]+$/, "") + "/" + v);
					}
				};
				const spec = mdSpecOf(a.path);
				body.push(h("div", {
					key: "note",
					style: {
						fontSize: "11px", marginBottom: "9px", padding: "6px 10px",
						border: "1px solid " + C.faint, borderLeft: "3px solid " + (spec ? C.ok : C.soft),
						background: spec ? "#f0fdf4" : C.bg, borderRadius: "4px", color: spec ? C.ok : C.muted
					}
				}, spec
					? "按产出规范渲染 · " + spec.name + "（治理/备料/样本元信息已折叠；未见过的章节收进「其他章节」不会丢）"
					: "这类产出还没有规范，按原文渲染"));
				body.push(spec
					? h(SpecMdView, { key: "md", text: text, spec: spec, pathImages: pathImages })
					: h(Md, { key: "md", text: text, pathImages: pathImages }));
			}
			// JSON / JSONL
			else if ((JSON_EXT[ext] || ext === "jsonl") && typeof text === "string") {
				if (ext === "jsonl") {
					const rows = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
					body.push(h("div", { key: "l", style: { fontSize: "11px", color: C.muted, marginBottom: "7px" } }, rows.length + " 行"));
					body.push(h("div", { key: "r" }, rows.map((l, i) => {
						let v = null, bad = false;
						try { v = JSON.parse(l); } catch (e) { bad = true; }
						return h("div", {
							key: i,
							style: { border: "1px solid " + C.faint, borderRadius: "4px", background: "#fff", padding: "8px 10px", marginBottom: "6px" }
						}, bad
							? h("pre", { style: PRESTYLE }, l)
							: h(ReadableJson, { value: v }));
					})));
				} else {
					let v = null, bad = false;
					try { v = JSON.parse(text); } catch (e) { bad = true; }
					const base = String(a.path).split("/").pop() || "";
					if (bad) {
						body.push(h("div", {
							key: "j",
							style: { border: "1px solid " + C.faint, borderRadius: "4px", background: "#fff", padding: "11px 13px" }
						}, [h("div", { key: "e", style: { fontSize: "12px", color: C.bad, marginBottom: "6px" } }, "JSON 解析失败，原始文本如下："),
							h("pre", { key: "p", style: PRESTYLE }, text)]));
					} else if (/^issue-cards_/i.test(base)) {
						body.push(h("div", {
							key: "note",
							style: { fontSize: "11px", marginBottom: "9px", padding: "6px 10px", border: "1px solid " + C.faint, borderLeft: "3px solid " + C.ok, background: "#f0fdf4", borderRadius: "4px", color: C.ok }
						}, "按产出规范渲染 · 问题卡（只显示设计相关字段；路径与素材源已省略）"));
						body.push(h(IssueCardsView, { key: "ic", data: v }));
					} else if (/^sr-gdd-handoff_/i.test(base)) {
						body.push(h("div", {
							key: "note",
							style: { fontSize: "11px", marginBottom: "9px", padding: "6px 10px", border: "1px solid " + C.faint, borderLeft: "3px solid " + C.ok, background: "#f0fdf4", borderRadius: "4px", color: C.ok }
						}, "按产出规范渲染 · 交接件（设计核 / 已拍板事实 / 未闭合假设 / 待决问题 / 已闭合假设；路径与 id 收进溯源）"));
						body.push(h(HandoffView, { key: "ho", data: v }));
					} else {
						body.push(h("div", {
							key: "note",
							style: { fontSize: "11px", marginBottom: "9px", padding: "6px 10px", border: "1px solid " + C.faint, borderLeft: "3px solid " + C.warn, background: "#fffdf7", borderRadius: "4px", color: C.warn }
						}, "这类 JSON 还没有产出规范，按结构渲染（可能含元数据噪声）"));
						body.push(h("div", {
							key: "j",
							style: { border: "1px solid " + C.faint, borderRadius: "4px", background: "#fff", padding: "11px 13px" }
						}, h(ReadableJson, { value: v })));
					}
				}
			}
			// 其他文本
			else if (typeof text === "string") {
				body.push(h("pre", { key: "t", style: PRESTYLE }, text.slice(0, 200000)));
			}
			else if (text === void 0) {
				body.push(h("div", { key: "l", style: { color: C.muted, fontSize: "12px" } }, "正在读取…"));
			}
			else {
				body.push(h("div", { key: "n", style: { color: C.muted, fontSize: "12px" } }, "读不到内容（可能不是文本文件）。用默认程序打开试试。"));
			}

			const refLine = [];
			if (a.supersedes && a.supersedes.length) refLine.push("取代 " + a.supersedes.join("、"));
			if (a.upstream_assets && a.upstream_assets.length) refLine.push("上游 " + a.upstream_assets.join("、"));
			if (a.downstream_assets && a.downstream_assets.length) refLine.push("下游 " + a.downstream_assets.join("、"));

			return h("div", null, [
				h("div", { key: "bar", style: { display: "flex", gap: "8px", alignItems: "center", marginBottom: "10px", flexWrap: "wrap" } }, [
					h("button", {
						key: "b", type: "button", onClick: onBack,
						style: { font: "inherit", fontSize: "12px", padding: "4px 11px", border: "1px solid " + C.soft, background: "#fff", borderRadius: "4px", cursor: "pointer" }
					}, "‹ 返回列表"),
					badge(ASSET_TYPE_LABEL[a.asset_type] || a.asset_type, null),
					a.review_status ? badge(REVIEW_LABEL[a.review_status] || a.review_status, REVIEW_TONE[a.review_status]) : null,
					h("button", {
						key: "o", type: "button", onClick: () => onOpen(abs),
						style: { font: "inherit", fontSize: "12px", padding: "4px 11px", border: "1px solid " + C.ink, background: "#fff", borderRadius: "4px", cursor: "pointer" }
					}, "用默认程序打开")
				]),
				h("div", { key: "meta", style: { fontSize: "11px", color: C.muted, marginBottom: "10px", lineHeight: 1.8 } }, [
					h("div", { key: "p", style: { fontFamily: "monospace", wordBreak: "break-all" } }, String(a.asset_id || "") + "　" + a.path),
					a.source_skill ? h("div", { key: "s" }, "来源技能：" + a.source_skill) : null,
					refLine.length ? h("div", { key: "r" }, refLine.join("　·　")) : null
				]),
				...body
			]);
		}
		const PRESTYLE = {
			fontSize: "11px", fontFamily: "monospace", whiteSpace: "pre-wrap",
			wordBreak: "break-word", background: C.bg, border: "1px solid " + C.faint,
			borderRadius: "3px", padding: "10px", margin: 0,
			maxHeight: "70vh", overflow: "auto", userSelect: "text", lineHeight: 1.6
		};

		// ══════════════════════════════════════════════════════════════
		// ══════════════════════════════════════════════════════════════
		// 二、规范驱动的 md 读取 —— **工单 32 起改为 import ./pure/mdspec.ts**
		//   三分法：设计信息（显示）/ 元数据（省略）/ 治理自检（折叠）
		//   通用规则：置顶区 → 主体区 → 折叠区（含「未知章节不丢」）
		//   ★ 这一刀**不是纯去重**：模块版的 mdSpecOf 用 split(/[\\/]/)，修掉了内联版只按 / 切、
		//     Windows 反斜杠路径六种章节规范全匹配不上的缺陷（工单 03 收尾时修的那条）。
		// ══════════════════════════════════════════════════════════════

		/** 一段 markdown（用 DSH 的 MarkdownText；取不到则降级 <pre>） */
		function Md(props) {
			const text = props.text || "";
			if (primitives && primitives.MarkdownText) {
				return h("div", { style: { fontSize: "13px", lineHeight: 1.85, color: C.ink } },
					h(primitives.MarkdownText, { text: text, pathImages: props.pathImages }));
			}
			return h("pre", { style: PRESTYLE }, text);
		}

		function SectionBlock(props) {
			const s = props.section;
			return h("div", { key: props.k, style: { marginBottom: "14px" } }, [
				h("div", {
					key: "h",
					style: {
						fontSize: "13px", fontWeight: 600, marginBottom: "6px", color: C.ink,
						borderBottom: "1px solid " + C.faint, paddingBottom: "4px"
					}
				}, s.title),
				h(Md, { key: "b", text: s.body, pathImages: props.pathImages })
			]);
		}

		/**
		 * 按规范渲染一份 markdown 产出：
		 * 置顶区 → 主体区 → 折叠区（治理/备料）→「其他章节」（未知的不丢）
		 */
		function SpecMdView(props) {
			const text = props.text;
			const spec = props.spec;
			const pathImages = props.pathImages;
			const [open, setOpen] = React.useState({});

			const sections = parseMdSections(text);
			if (!sections.length) return h("pre", { style: PRESTYLE }, text);

			const top = [], body = [], fold = [], unknown = [];
			for (const s of sections) {
				const cls = classifyHeading(s.title, spec ? spec.sections : []);
				if (cls === "skip") continue;
				if (cls === "top") top.push(s);
				else if (cls === "body") body.push(s);
				else if (cls === "fold") fold.push(s);
				else unknown.push(s);      // ★ 未知章节不丢
			}

			const foldGroup = (label, items, keyPrefix, tone) => items.length ? h("div", {
				key: keyPrefix,
				style: { border: "1px solid " + C.faint, borderRadius: "4px", background: "#fff", marginBottom: "9px", overflow: "hidden" }
			}, [
				h("div", {
					key: "h",
					onClick: () => setOpen((o) => { const n = {}; for (const k in o) n[k] = o[k]; n[keyPrefix] = !o[keyPrefix]; return n; }),
					style: {
						display: "flex", justifyContent: "space-between", alignItems: "center",
						padding: "7px 11px", background: C.bg, cursor: "pointer",
						borderBottom: open[keyPrefix] ? "1px solid " + C.faint : "none"
					}
				}, [
					h("span", { key: "t", style: { fontSize: "11px", color: tone || C.muted } }, label + "（" + items.length + " 节）"),
					h("span", { key: "g", style: { fontSize: "10px", color: C.muted } }, open[keyPrefix] ? "收起 ▾" : "展开 ▸")
				]),
				open[keyPrefix] ? h("div", { key: "b", style: { padding: "10px 11px" } },
					items.map((s, i) => h(SectionBlock, { key: i, k: keyPrefix + i, section: s, pathImages: pathImages }))) : null
			]) : null;

			return h("div", null, [
				// 置顶区
				top.length ? h("div", {
					key: "top",
					style: {
						border: "1px solid " + C.faint, borderLeft: "3px solid " + C.ink,
						background: "#fff", borderRadius: "4px", padding: "11px 13px", marginBottom: "12px"
					}
				}, top.map((s, i) => h(SectionBlock, { key: i, k: "top" + i, section: s, pathImages: pathImages }))) : null,
				// 主体区
				body.map((s, i) => h(SectionBlock, { key: i, k: "b" + i, section: s, pathImages: pathImages })),
				// 折叠区
				foldGroup("治理 / 自检 / 备料", fold, "fold"),
				foldGroup("其他章节（未在规范白名单内，保留不丢）", unknown, "unk", C.warn)
			]);
		}

		/** 问题卡（issue-cards_*.json 规范） */
		function IssueCardsView(props) {
			const d = props.data || {};
			const meta = d.meta || {};
			const cards = Array.isArray(d.issue_cards) ? d.issue_cards : [];
			const unc = Array.isArray(d.uncertain_observations) ? d.uncertain_observations : [];
			const row = (k, v, color) => v ? h("div", { key: k, style: { display: "flex", gap: "9px", fontSize: "12px", lineHeight: 1.8 } }, [
				h("span", { key: "k", style: { color: C.muted, minWidth: "78px", flex: "0 0 auto" } }, k),
				h("span", { key: "v", style: { color: color || C.ink, flex: "1 1 auto", whiteSpace: "pre-wrap", wordBreak: "break-word" } }, v)
			]) : null;
			return h("div", null, [
				h("div", { key: "m", style: { border: "1px solid " + C.faint, borderRadius: "4px", background: "#fff", padding: "10px 13px", marginBottom: "12px" } }, [
					row("主题", (meta.topic || "") + (meta.date ? "　" + meta.date : "")),
					row("诊断包", meta.diagnosis_pack),
					row("分析视角", (meta.analysis_modes || []).join(" · ")),
					row("样本边界", meta.sample_boundary),
					row("置信上限", meta.confidence_cap, C.warn)
				]),
				...cards.map((c, i) => h("div", {
					key: i,
					style: {
						border: "1px solid " + C.faint,
						borderLeft: "3px solid " + (c.priority === "P1" ? C.bad : c.priority === "P2" ? C.warn : C.soft),
						borderRadius: "4px", background: "#fff", padding: "10px 13px", marginBottom: "9px"
					}
				}, [
					h("div", { key: "h", style: { display: "flex", gap: "8px", alignItems: "center", marginBottom: "6px", flexWrap: "wrap" } }, [
						badge(String(c.priority || ""), c.priority === "P1" ? "bad" : c.priority === "P2" ? "warn" : null),
						h("span", { key: "i", style: { fontFamily: "monospace", fontSize: "11px", color: C.muted } }, String(c.issue_id || "")),
						c.owner ? badge(c.owner, null) : null,
						c.unsupported_by_sample ? badge("无样本支持", "warn") : null
					]),
					cardRow("症状", c.symptom, C.ink),
					cardRow("根因假设", c.root_cause_hypothesis),
					cardRow("影响", c.impact),
					cardRow("修法", c.fix_action, C.ok),
					c.validation ? h("div", { key: "v", style: { marginTop: "5px", borderTop: "1px solid " + C.faint, paddingTop: "5px" } }, [
						h("div", { key: "t", style: { fontSize: "11px", color: C.muted, marginBottom: "2px" } }, "验证方案"),
						h("div", { key: "b", style: { fontSize: "12px", lineHeight: 1.8, paddingLeft: "9px" } }, [
							cardRow("指标", c.validation.metric, C.ink, true),
							cardRow("方法", c.validation.method, C.ink, true),
							cardRow("通过线", c.validation.pass_threshold, C.ok, true),
							cardRow("停止条件", c.validation.stop_condition, C.bad, true)
						])
					]) : null,
					(c.evidence_refs && c.evidence_refs.length) ? h("div", { key: "e", style: { marginTop: "5px", fontSize: "11px", color: C.muted, fontFamily: "monospace" } },
						"证据：" + c.evidence_refs.join("　")) : null
				])),
				unc.length ? h("div", { key: "u", style: { border: "1px solid " + C.faint, borderLeft: "3px solid " + C.warn, background: "#fffdf7", borderRadius: "4px", padding: "10px 13px" } }, [
					h("div", { key: "t", style: { fontSize: "12px", fontWeight: 600, marginBottom: "5px" } }, "不确定观察（" + unc.length + "）"),
					...unc.map((u, i) => h("div", { key: i, style: { fontSize: "12px", lineHeight: 1.8 } }, [
						h("span", { key: "i", style: { fontFamily: "monospace", fontSize: "11px", color: C.muted } }, String(u.evidence_id || "") + "　"),
						h("span", { key: "n" }, String(u.note || ""))
					]))
				]) : null
			]);
		}
		function cardRow(k, v, color, compact) {
			if (!v) return null;
			return h("div", { key: k, style: { display: "flex", gap: "8px", fontSize: compact ? "11px" : "12px", lineHeight: 1.8, alignItems: "flex-start" } }, [
				h("span", { key: "k", style: { color: C.muted, minWidth: compact ? "52px" : "60px", flex: "0 0 auto" } }, k),
				h("span", { key: "v", style: { color: color || C.ink, flex: "1 1 auto", whiteSpace: "pre-wrap", wordBreak: "break-word" } }, String(v))
			]);
		}

		/** 交接件（sr-gdd-handoff_*.json 规范）：5 区块，其余折叠 */
		function HandoffView(props) {
			const d = props.data || {};
			const [showSrc, setShowSrc] = React.useState(false);
			const nucleus = d.chosen_nucleus || {};
			const al = d.assumption_ledger || {};
			const facts = Array.isArray(d.calibrated_facts) ? d.calibrated_facts : [];
			const openA = Array.isArray(al.open) ? al.open : [];
			const closedA = Array.isArray(al.closed) ? al.closed : [];
			const questions = Array.isArray(d.open_questions_for_gdd) ? d.open_questions_for_gdd : [];
			const materials = d.materials || {};

			const block = (key, title, tone, children) => children ? h("div", {
				key: key,
				style: {
					border: "1px solid " + C.faint,
					borderLeft: "3px solid " + (tone || C.soft),
					borderRadius: "4px", background: "#fff", padding: "10px 13px", marginBottom: "10px"
				}
			}, [
				h("div", { key: "t", style: { fontSize: "12px", fontWeight: 600, marginBottom: "6px" } }, title),
				...children
			]) : null;

			return h("div", null, [
				h("div", { key: "top", style: { fontSize: "12px", color: C.muted, marginBottom: "10px" } },
					(d.topic || "") + "　" + (d.source_skill || "") + " → " + (d.target_skill || "")),

				// ① 设计核
				block("n", "① 设计核" + (nucleus.id ? "（" + nucleus.id + "）" : ""), C.ink, [
					nucleus.statement ? h("div", { key: "s", style: { fontSize: "13px", lineHeight: 1.85, marginBottom: "6px" } }, String(nucleus.statement)) : null,
					cardRow("核心张力", nucleus.key_tension),
					cardRow("组合", nucleus.combination),
					nucleus.kill_signal ? h("div", {
						key: "k",
						style: { marginTop: "6px", borderTop: "1px solid " + C.faint, paddingTop: "6px", fontSize: "12px", lineHeight: 1.8, color: C.bad }
					}, [h("span", { key: "l", style: { color: C.muted } }, "Kill Signal　"), String(nucleus.kill_signal)]) : null
				]),

				// ② 已拍板事实
				block("f", "② 已拍板事实（" + facts.length + "）", C.ok,
					facts.map((t, i) => h("div", { key: i, style: { fontSize: "12px", lineHeight: 1.85, marginBottom: "4px", paddingLeft: "9px", borderLeft: "2px solid " + C.faint } }, String(t)))),

				// ③ 未闭合假设
				block("o", "③ 未闭合假设（" + openA.length + "）", C.warn,
					openA.map((a, i) => h("div", { key: i, style: { fontSize: "12px", lineHeight: 1.8, marginBottom: "7px" } }, [
						h("div", { key: "d" }, [
							h("span", { key: "i", style: { fontFamily: "monospace", color: C.muted } }, String(a.id || "") + "　"),
							h("span", { key: "t" }, String(a.desc || ""))
						]),
						h("div", { key: "m", style: { marginLeft: "9px", color: C.muted, fontSize: "11px" } },
							"影响 " + String(a.impact || "?") + "　·　怎么验：" + String(a.validate || "?"))
					]))),

				// ④ 待决问题
				block("q", "④ 留给成稿的待决问题（" + questions.length + "）", C.ink,
					questions.map((t, i) => h("div", { key: i, style: { fontSize: "12px", lineHeight: 1.85, marginBottom: "4px" } }, "· " + String(t)))),

				// ⑤ 已闭合假设（一行带过）
				closedA.length ? h("div", { key: "c", style: { fontSize: "11px", color: C.muted, marginBottom: "10px" } },
					"⑤ 已闭合假设：" + closedA.join("、")) : null,

				d.next_step ? h("div", { key: "ns", style: { fontSize: "12px", lineHeight: 1.8, marginBottom: "10px" } }, [
					h("span", { key: "l", style: { color: C.muted } }, "下一步　"),
					String(d.next_step)
				]) : null,

				// 溯源（折叠）
				h("div", { key: "src", style: { border: "1px solid " + C.faint, borderRadius: "4px", background: C.bg, overflow: "hidden" } }, [
					h("div", {
						key: "h",
						onClick: () => setShowSrc(!showSrc),
						style: { padding: "7px 11px", cursor: "pointer", display: "flex", justifyContent: "space-between", fontSize: "11px", color: C.muted }
					}, [h("span", { key: "t" }, "溯源（路径 / id / 引用）"), h("span", { key: "g" }, showSrc ? "收起 ▾" : "展开 ▸")]),
					showSrc ? h("div", { key: "b", style: { padding: "0 11px 10px", fontSize: "11px", fontFamily: "monospace", color: C.muted, lineHeight: 1.8, wordBreak: "break-all" } }, [
						h("div", { key: "i" }, "handoff_id: " + String(d.handoff_id || "") + "　created_at: " + String(d.created_at || "")),
						Object.keys(materials).filter((k) => k !== "original_brief_note").map((k, i) =>
							h("div", { key: "m" + i }, k + ": " + String(materials[k]))),
						d.risk_register_ref ? h("div", { key: "r" }, "risk_register_ref: " + String(d.risk_register_ref)) : null,
						d.config_prediction_ref ? h("div", { key: "p" }, "config_prediction_ref: " + String(d.config_prediction_ref)) : null
					]) : null
				]),
				materials.original_brief_note ? h("div", {
					key: "obn",
					style: { marginTop: "9px", border: "1px solid " + C.faint, borderLeft: "3px solid " + C.warn, background: "#fffdf7", borderRadius: "4px", padding: "9px 12px", fontSize: "12px", lineHeight: 1.8 }
				}, ["旧文档说明　", String(materials.original_brief_note)]) : null
			]);
		}

		/** 折叠块（A5 用） */
		function Fold(props) {
			const [open, setOpen] = React.useState(!!props.defaultOpen);
			return h("div", { style: props.style }, [
				h("div", {
					key: "h",
					onClick: () => setOpen(!open),
					style: {
						display: "flex", justifyContent: "space-between", alignItems: "center",
						padding: "7px 11px", background: C.bg, cursor: "pointer",
						borderBottom: open ? "1px solid " + C.faint : "none"
					}
				}, [
					h("span", { key: "t", style: { fontSize: "12px", fontWeight: 600 } }, props.title),
					h("span", { key: "g", style: { fontSize: "10px", color: C.muted } }, open ? "收起 ▾" : "展开 ▸")
				]),
				open ? h("div", { key: "b", style: { padding: "9px 11px" } }, props.children) : null
			]);
		}

		/**
		 * A5 · 功能详情 · 界面图
		 * ① §5.0 界面清单快照　② Figma 提示条（折叠，只提示不执行）
		 * ③ 每个 UI 的骨架图（内嵌；失败则退化为打开）　④ 边界声明
		 */
		function InterfacePanel(props) {
			const data = props.data;
			const srWs = props.srWs || "";
			const onOpen = props.onOpen;
			const [broken, setBroken] = React.useState({});

			if (!data) return h("div", { style: { color: C.muted, fontSize: "12px" } }, "正在读定稿的 §5…");
			if (data.error) return h("div", { style: { color: C.bad, fontSize: "12px" } }, data.error);
			if (data.empty) return h("div", { style: { color: C.muted, fontSize: "12px" } }, data.empty);

			const rows = data.uiRows || [];
			const uis = data.uis || [];
			const imgTotal = uis.reduce((n, u) => n + u.images.length, 0);
			const ueTotal = uis.reduce((n, u) => n + u.ueCount, 0);
			const markBroken = (k) => setBroken((s) => { const o = {}; for (const x in s) o[x] = s[x]; o[k] = true; return o; });

			return h("div", null, [
				h("div", { key: "sum", style: { fontSize: "12px", color: C.muted, marginBottom: "10px" } },
					"来自定稿 " + (data.file || "") + "　界面 " + rows.length + " 个 · 骨架图 " + imgTotal + " 张 · UE 规则 " + ueTotal + " 条"),

				// ② Figma 提示条（只提示不执行）
				h("div", {
					key: "figma",
					style: {
						border: "1px solid " + C.faint, borderLeft: "3px solid " + C.warn,
						background: "#fffdf7", borderRadius: "4px", marginBottom: "11px"
					}
				}, h(Fold, {
					title: "本节含 " + imgTotal + " 张界面图 · 可用 Figma MCP 生成线框图 · 手工触发",
					children: h("div", { style: { fontSize: "12px", lineHeight: 1.9, color: C.ink } }, [
						h("div", { key: "a" }, "工作台**不代跑**这一步（成本、TTY 授权与外部副作用都由你决定）。"),
						h("div", { key: "b" }, "做法：把上面对应 UI 的 ASCII 图/骨架图交给 Figma MCP，新建 Figma Draft；生成后把 Draft 链接记回 §5。"),
						h("div", { key: "c", style: { color: C.muted } }, "参考：成稿到线框图-提示方案.md · S0 实测报告.md")
					])
				})),

				// ① §5.0 界面清单
				rows.length ? h("div", {
					key: "tbl",
					style: { border: "1px solid " + C.faint, borderRadius: "4px", background: "#fff", overflow: "hidden", marginBottom: "11px" }
				}, [
					h("div", { key: "t", style: { fontSize: "12px", fontWeight: 600, padding: "7px 11px", background: C.bg, borderBottom: "1px solid " + C.faint } }, "§5.0 界面清单（" + rows.length + "）"),
					h("div", { key: "b", style: { padding: "0" } }, rows.map((r, i) => h("div", {
						key: i,
						style: { display: "flex", gap: "9px", padding: "6px 11px", borderTop: i ? "1px solid " + C.faint : "none", fontSize: "12px", lineHeight: 1.7 }
					}, [
						h("span", { key: "i", style: { fontFamily: "monospace", fontSize: "11px", color: C.muted, minWidth: "52px", flex: "0 0 auto" } }, r.id),
						h("span", { key: "n", style: { fontWeight: 600, minWidth: "110px", flex: "0 0 auto" } }, r.name),
						h("span", { key: "e", style: { flex: "1 1 200px", color: C.muted } }, "进入：" + r.enter),
						h("span", { key: "x", style: { flex: "0 1 160px", color: C.muted } }, "退出：" + r.exit)
					])))
				]) : null,

				// ③ 各 UI 的骨架图
				...uis.map((u) => h("div", {
					key: u.id,
					style: { border: "1px solid " + C.faint, borderRadius: "4px", background: "#fff", marginBottom: "10px", overflow: "hidden" }
				}, [
					h("div", {
						key: "h",
						style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 11px", background: C.bg, borderBottom: "1px solid " + C.faint }
					}, [
						h("span", { key: "t", style: { fontSize: "12px", fontWeight: 600 } }, u.id + "　" + (u.title || "")),
						h("span", { key: "c", style: { fontSize: "10px", color: C.muted, fontFamily: "monospace" } }, "UE " + u.ueCount + " 条 · 图 " + u.images.length)
					]),
					h("div", { key: "b", style: { padding: "10px 11px", display: "flex", flexWrap: "wrap", gap: "10px" } },
						u.images.length ? u.images.map((rel, i) => {
							const abs = srWs + "/proposals/" + rel;
							const name = String(rel).split("/").pop();
							return h("div", { key: i, style: { flex: "1 1 300px", maxWidth: "460px" } }, [
								broken[abs]
									? h("div", {
										key: "f",
										style: { border: "1px dashed " + C.soft, borderRadius: "4px", padding: "18px", textAlign: "center", fontSize: "11px", color: C.muted }
									}, [
										h("div", { key: "a" }, "图片未能在面板内显示"),
										h("button", {
											key: "b", type: "button",
											onClick: () => onOpen(abs),
											style: { font: "inherit", fontSize: "11px", marginTop: "6px", padding: "3px 10px", border: "1px solid " + C.ink, background: "#fff", borderRadius: "3px", cursor: "pointer" }
										}, "用默认程序打开")
									])
									: h("img", {
										key: "i",
										src: fileUrl(abs),
										alt: name,
										onError: () => markBroken(abs),
										style: { width: "100%", border: "1px solid " + C.faint, borderRadius: "4px", background: C.bg, display: "block" }
									}),
								h("div", { key: "n", style: { marginTop: "4px" } }, h("button", {
									type: "button",
									onClick: () => onOpen(abs),
									title: abs,
									style: {
										font: "inherit", fontSize: "10px", fontFamily: "monospace", padding: 0,
										border: "none", background: "none", color: "#3b6ea5", cursor: "pointer",
										textAlign: "left", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
									}
								}, name))
							]);
						}) : [h("span", { key: "none", style: { fontSize: "11px", color: C.muted } }, "该界面还没有骨架图引用")])
				])),

				// ④ 边界声明
				data.boundary ? h("div", {
					key: "bd",
					style: {
						border: "1px solid " + C.faint, borderLeft: "3px solid " + C.soft,
						background: C.bg, borderRadius: "4px", padding: "9px 11px",
						fontSize: "11px", lineHeight: 1.8, color: C.ink
					}
				}, [
					h("div", { key: "t", style: { fontWeight: 600, marginBottom: "3px" } }, "边界声明（§5.0）"),
					h("div", { key: "b" }, data.boundary)
				]) : null,

				h("div", { key: "foot", style: { marginTop: "12px", fontSize: "11px", color: C.muted, lineHeight: 1.85 } }, [
					h("div", { key: "a" }, "界面清单与骨架图引用**从定稿 §5 现场解析**，不另存索引。"),
					h("div", { key: "b" }, "「Draft 记账表」与「漏画/多画对账」还没做——那需要 §5 里记回 Draft 链接，目前定稿里没有这个字段。")
				])
			]);
		}

		/** 折叠起来的原始返回，给需要深究时看 */
		function RawDetail(props) {
			const [open, setOpen] = React.useState(false);
			if (!props.text) return null;
			return h("div", { style: { marginTop: "6px" } }, [
				h("button", {
					key: "b", type: "button",
					onClick: () => setOpen(!open),
					style: {
						font: "inherit", fontSize: "10px", padding: "1px 7px", border: "1px solid " + C.soft,
						background: "#fff", borderRadius: "3px", cursor: "pointer", color: C.muted
					}
				}, open ? "收起技术详情" : "技术详情"),
				open ? h("pre", {
					key: "p",
					style: {
						marginTop: "5px", marginBottom: 0, padding: "8px", fontSize: "10px",
						whiteSpace: "pre-wrap", background: C.bg, border: "1px solid " + C.faint,
						borderRadius: "3px", maxHeight: "240px", overflow: "auto",
						fontFamily: "monospace", userSelect: "text", color: C.muted
					}
				}, props.text) : null
			]);
		}

		/**
		 * A2 流水线（A2 屏）。
		 * 面向策划：六段进度 + 一个「推进一步」。
		 * 通道验证在背后自动做，失败用人话说，原始返回折叠在「技术详情」里。
		 */
		function PipelinePanel(props) {
			const f = props.feature;
			const probe = props.probe;
			const presetId = props.presetId || "sr-workbench";
			const cwd = props.cwd;
			const projectRoot = props.projectRoot || "";
			const cacheKey = workKey(presetId, f ? f.topic : "");
			const [workSid, setWorkSidState] = React.useState(() => WORK_SESSIONS.get(cacheKey) || "");
			const setWorkSid = (v) => { setWorkSidState(v); setWorkSession(cacheKey, v); };
			const [busy, setBusy] = React.useState(false);
			const [msg, setMsg] = React.useState(null);
			const [detail, setDetail] = React.useState("");
			const [wsNote, setWsNote] = React.useState("");

			// ★ hooks 无条件调用：待拍板问题（工作会话那一格）
			const usePending = props.useSessionPendingInteraction;
			const pending = usePending ? usePending((m) => (workSid ? m.get(workSid) : void 0)) : void 0;

			if (!f) return h("div", { style: { color: C.muted, fontSize: "12px" } }, "没有选中功能。");

			const stages = f.stages || {};
			const doneCount = STAGE_ORDER.filter((k) => stages[k]).length;
			const nextKey = STAGE_ORDER.filter((k) => !stages[k])[0] || null;
			const meta = nextKey ? STAGE_META[nextKey] : null;

			const setErr = (text, raw) => { setMsg({ kind: "err", text: text }); setDetail(raw || ""); };
			const setOk = (text) => { setMsg({ kind: "ok", text: text }); setDetail(""); };

			/** 推进一步：确保工作会话 → 执行该阶段的斜杠命令 */
			const advance = () => {
				if (!meta) return;
				setBusy(true);
				setMsg({ kind: "pending", text: "正在准备…" });
				setDetail("");

				// ★ 建会话时必须带 workspaceId，否则会话落进左侧「未分组」而不是项目分组。
				//   工作区 id 用 workspace.create({path}) 按路径查（已存在时返回 created:false）。
				// ★ 会话必须带 workspaceId，否则落进左侧「未分组」。
				//   优先用「当前会话所属的工作区」（与 DSH 新会话按钮同源）；
				//   退而用配置的 projectRoot 按路径查；都没有才用 cwd 兜底。
				const createInProject = () => {
					const info = probe.workspaceInfo();
					// ★ 建完一律补一次「并进客户端 store」（侧边栏立刻看得见，不用 F5）——
					//   判定与理由见组合根的 `syncSidebarStores`（这里经 `probe.syncSidebar` 调它）；
					//   结果（`cr`）原样返回，下面那条链一字不动。
					const createdIn = (path, p) => Promise.resolve(p).then(
						(cr) => (cr && cr.ok && typeof probe.syncSidebar === "function"
							? probe.syncSidebar(path || "").then(() => cr)
							: cr)
					);
					if (info && info.id) {
						setWsNote("当前会话的工作区：「" + (info.title || info.id) + "」（" + (info.path || "?") + "）");
						return createdIn(info.path, probe.create(info.id, "", presetId));
					}
					if (projectRoot) {
						return probe.ensureWorkspace(projectRoot).then((wr) => {
							if (!wr.ok) {
								setWsNote("按 projectRoot 查工作区失败：" + humanError(wr));
								return wr;
							}
							const w = wr.value && wr.value.workspace;
							if (!w || !w.workspaceId) {
								setWsNote("工作区已登记但没拿到 workspaceId");
								return { ok: false, error: { message: "工作区已登记但没拿到 workspaceId" } };
							}
							setWsNote("按 projectRoot " + (wr.value.created ? "新建" : "匹配到") + "工作区「" + w.title + "」");
							return createdIn(projectRoot, probe.create(w.workspaceId, "", presetId));
						});
					}
					setWsNote("未识别当前会话的工作区 —— 会话可能落进「未分组」" +
						(info && info.error ? "（读取异常：" + info.error + "）" : ""));
					return createdIn(cwd, probe.create("", cwd, presetId));
				};

				const ensure = workSid
					? Promise.resolve({ ok: true, value: { sessionId: workSid } })
					: createInProject();

				ensure.then((cr) => {
					if (!cr.ok) {
						setBusy(false);
						setErr("无法为工作台创建会话：" + humanError(cr) +
							"（工作区 " + (projectRoot || "(未配置 projectRoot)") + "）。",
							JSON.stringify(cr, null, 1));
						return;
					}
					const sid = idText(cr.value && cr.value.sessionId) || workSid;
					setWorkSid(sid);

					const line = meta.cmd + " " + f.topic;
					setMsg({ kind: "pending", text: "已启动「" + meta.label + "」，正在把 " + line + " 交给会话…" });

					// ★ skill 不是宿主命令：`commands.execute` 只认 /compact /plan /goal 这类已注册命令，
					//   对 skill 返回 undefined（静默无事发生）。
					//   正确做法与 composer 一致：把 `/skill-name 参数` 当**普通提示词**发出去，
					//   由 host 端的 skill 解析注入指令。
					probe.prompt(sid, line).then((er) => {
						setBusy(false);
						if (er.ok) {
							setOk("已把「" + meta.label + "」交给工作会话（" + line + "）。" +
								"进度与提问在那个会话里看——在左侧列表点开它即可。");
							setDetail(JSON.stringify(er.value, null, 1));
						} else {
							setErr("无法启动「" + meta.label + "」：" + humanError(er), JSON.stringify(er, null, 1));
						}
					});
				});
			};

			return h("div", null, [
				// ① 六段进度
				h("div", {
					key: "bar",
					style: {
						display: "flex", gap: "6px", flexWrap: "wrap",
						marginBottom: "12px", alignItems: "center"
					}
				}, STAGE_ORDER.map((k) => {
					const on = !!stages[k];
					const isNext = k === nextKey;
					return h("div", {
						key: k,
						style: {
							fontSize: "12px", padding: "5px 12px", borderRadius: "4px",
							border: "1px solid " + (on ? C.ok : (isNext ? C.ink : C.soft)),
							background: on ? "#f0fdf4" : (isNext ? "#fff" : "#fafafa"),
							color: on ? C.ok : (isNext ? C.ink : "#aaa"),
							fontWeight: isNext ? 600 : 400
						}
					}, (on ? "✓ " : "") + STAGE_META[k].label);
				})),

				// ② 结论行
				h("div", {
					key: "sum",
					style: {
						border: "1px solid " + C.faint, borderRadius: "4px", background: "#fff",
						padding: "11px 13px", marginBottom: "12px", fontSize: "12px", lineHeight: 1.9
					}
				}, [
					h("div", { key: "a" }, "已完成 " + doneCount + " / 6 个阶段" +
						(f.latestDate ? "　最终版 " + f.latestDate.slice(0, 4) + "-" + f.latestDate.slice(4, 6) + "-" + f.latestDate.slice(6, 8) : "")),
					h("div", { key: "b", style: { color: meta ? C.ink : C.ok } },
						meta
							? "下一步：「" + meta.label + "」——" + meta.desc
							: "已走完六个阶段，可以交程序了。")
				]),

				// ③ 动作
				meta ? h("div", { key: "act", style: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginBottom: "12px" } }, [
					h("button", {
						key: "go", type: "button", disabled: busy,
						onClick: advance,
						style: {
							font: "inherit", fontSize: "13px", padding: "7px 16px",
							border: "1px solid " + C.ink, background: busy ? "#888" : C.ink,
							color: "#fff", borderRadius: "4px", cursor: busy ? "default" : "pointer"
						}
					}, busy ? "执行中…" : "推进一步：「" + meta.label + "」"),
					h("span", { key: "w", style: { fontSize: "11px", color: C.muted } },
						"会在工作会话里执行 " + meta.cmd + " " + f.topic)
				]) : null,

				// ④ 结果
				msg ? h("div", {
					key: "msg",
					style: {
						border: "1px solid " + (msg.kind === "err" ? C.bad : C.faint),
						borderLeft: "3px solid " + (msg.kind === "err" ? C.bad : msg.kind === "ok" ? C.ok : C.soft),
						background: "#fff", borderRadius: "4px", padding: "10px 12px",
						fontSize: "12px", lineHeight: 1.75,
						color: msg.kind === "err" ? C.bad : msg.kind === "ok" ? C.ok : C.muted
					}
				}, [h("div", { key: "t" }, msg.text), h(RawDetail, { key: "d", text: detail })]) : null,

				// ⑤ 工作会话实时状态
				workSid ? h(WorkSessionStatus, {
					key: "ws", sessionId: workSid,
					useSessions: props.useSessions,
					useSessionPendingInteraction: props.useSessionPendingInteraction,
					onOpen: (sid) => {
						const r = probe.openSession(sid);
						if (!r.ok) setErr("无法打开会话：" + humanError(r), JSON.stringify(r, null, 1));
					}
				}) : null,

				// ⑥ 待拍板：直接在面板里回答（A2 闭环）
				h(PendingQuestionCard, { key: "pq", pending: pending }),

				// ⑥ 底部说明
				h("div", { key: "foot", style: { marginTop: "14px", fontSize: "11px", color: C.muted, lineHeight: 1.85 } }, [
					h("div", { key: "a" }, "工作台不在这里重画流程——它把阶段交给 sr 的 skill，进度与提问都在那个会话里。"),
					h("div", { key: "b" }, "预设：" + presetId + (projectRoot ? "　兜底工作区根：" + projectRoot : "")),
					wsNote ? h("div", { key: "d", style: { color: C.ink } }, "工作区归属：" + wsNote) : null
				])
			]);
		}

		/**
		 * 索引会话的来源（面板要**如实说出**"这条会话是怎么来的" —— 排障全靠它）。
		 * 与 pure 层 `SessionPick.source` 一一对应，外加组合根自己的 "created"。
		 */
		function sessionSourceText(s) {
			if (!s) return "(未解析)";
			const map = {
				cache: "上次那条（本地缓存）",
				title: "按标题「策划工作台·索引」认回",
				cwd: "按 cwd 覆盖 sr 工作区根匹配",
				main: "用户当前选中的那条（兜底）",
				recent: "最近更新的那条（兜底）",
				created: "新建（已登记工作区并命名）"
			};
			const tag = map[s.source] || String(s.source || "?");
			const sid = s.sid ? "：" + String(s.sid).slice(0, 14) + "…" : "";
			return tag + sid + (s.sessionTitle ? "「" + s.sessionTitle + "」" : "");
		}

		/**
		 * **工作会话**的来源（工单 15）—— 与索引会话那套分开写，因为来源不同：
		 * 工作会话按"每个功能一条"认，认领凭据是标题 `策划工作台·工作（主题）`。
		 */
		function pickSourceText(s) {
			const map = {
				memory: "这次页面里已经认过它",
				cache: "上次那条（本地缓存）",
				title: "按标题「策划工作台·工作」认回",
				created: "新建（已登记功能工作区并命名）"
			};
			return map[s] || String(s || "?");
		}

		/**
		 * 显示用路径：混合分隔符统一成 `\`。
		 * ★ 只改**显示**，不改传给 Remote 的字符串（`workspace.create` / `session.create` 收到的一字不动）——
		 *   那串路径是工单 12 就存在的既有形状（`D:\…\workspace/features/…`，两种分隔符 Windows 都认），
		 *   本票不借机改行为。
		 */
		function winPath(p) {
			return String(p === null || p === undefined ? "" : p).replace(/\//g, "\\");
		}

		/** 全局面板：A1 功能看板 */		function Panel(props) {
			// ★ 工单 32（0.2.0 兼容）：面板**不再读"用户当前选中的会话"**。
			//   0.1.5 时这里读 `sessions.current`，而 0.2.0 的会话快照里没有 `current` 了
			//   （"当前会话"改由 `byId[id].retainedBy.mainView > 0` 表达）⇒ sessionId 恒为 undefined
			//   ⇒ 面板永远显示「先在左侧选一个会话…」，点会话也没用。
			//   现在：store 快照只当**候选线索**，真正的会话由 `resolveIndexSession` 解析
			//   （标题认领 → 缓存 → cwd 覆盖 sr 根 → 新建），见 apply 里的注释。
			const useSessions = props.useSessions;
			const useWorkspaces = props.useWorkspaces;
			// ★ hooks 必须无条件调用：条件只放在"这个 hook 存不存在"上（跨渲染稳定）
			const sessionsSnap = useSessions ? useSessions((s) => s) : null;
			const wsSnap = useWorkspaces ? useWorkspaces((s) => s) : null;
			const sessionRows = React.useMemo(() => rowsFromStore(sessionsSnap), [sessionsSnap]);
			const wsPaths = React.useMemo(
				() => ((wsSnap && wsSnap.items) || []).map((w) => w && w.path).filter(Boolean),
				[wsSnap]
			);
			// 索引会话解析结果：`{ sid, cwd, root, srWs, source, ... }`
			const [idx, setIdx] = React.useState(null);
			const sessionId = idx && idx.sid ? idx.sid : void 0;
			const cwd = idx && idx.cwd ? idx.cwd : void 0;
			const [state, setState] = React.useState({ phase: "idle" });
			const [q, setQ] = React.useState("");
			const [notice, setNotice] = React.useState(null);
			const [view, setView] = React.useState("dashboard");       // dashboard | detail | assets | config | knowledge
			const [detailTopic, setDetailTopic] = React.useState(null);
			// ★ 工单 23：进功能先落在**第一个工作面**（头脑风暴）；`final` = 定稿修订工作面，其余是资料页签
			const [dtab, setDtab] = React.useState(ENTRY_TAB);
			const [ledger, setLedger] = React.useState(null);
			const [iface, setIface] = React.useState(null);
			const [finalDoc, setFinalDoc] = React.useState(null);
			const [indexData, setIndexData] = React.useState(null);
			// ★ 工单 12：功能详情的产物清单 / 三阶段 / 定稿有效性 / V 校验清单（进详情时读一次）
			const [detail, setDetail] = React.useState(null);
			// ★ 工单 23：头脑风暴工作面的数据（已有的分析结论 + 两种新格式的解析结果）
			const [brain, setBrain] = React.useState(null);
			// ★ 工单 24：文档生成工作面的数据（成稿的两大部分与左树 + 配置支线走到哪）
			const [draft, setDraft] = React.useState(null);
			/**
			 * ★ 工单 16：详情里每一份数据都盖一个"这是哪个功能的"戳（`__topic`），渲染时对不上
			 *   当前功能就**不当数**。两个作用合在一起：
			 *     ① 换功能时**不需要任何清空动作**（旧数据自动失效，不会闪一个上一个功能的内容）；
			 *     ② 重读（自动刷新）时**保留屏幕上的旧数据** —— 不整屏重挂、不丢用户选中的条目。
			 */
			const ofTopic = (r) => (r && r.__topic !== undefined && r.__topic !== detailTopic ? null : r);
			/** 盖上当前功能的戳（组合根该干的事：结果属于哪一次请求由调用方知道） */
			const stamped = (r) => Object.assign({}, r, { __topic: detailTopic });
			/** 详情数据中"属于当前功能的那一份"（下面所有渲染与判断都用它，不再直接用 detail） */
			const dview = ofTopic(detail);
			// ★ 台账在**渲染期**从 ledger 派生（不是加载期冻结），见 ledgerOf 的注释
			const designLedger = React.useMemo(() => ledgerOf(ofTopic(ledger)), [ledger, detailTopic]);
			// ════════════════════════════════════════════════════════════════
			// ★ 工单 16 · 自动刷新与版本指纹
			//   三个状态：`rev`（各部件重读计数，只增不减）· `live`（订阅与指纹，给人看的）
			//   · 四个 ref（版本袋 / 已应用版本 / 待落批 / 定时器）。
			//   判定全在 `src/pure/refresh.ts`；这里只负责"按它说的去调、把结果如实显示"。
			// ════════════════════════════════════════════════════════════════
			const [rev, setRev] = React.useState({ detail: 0, ledger: 0, final: 0, ui: 0, brain: 0, draft: 0 });
			const [live, setLive] = React.useState({ phase: "off", reason: "", ready: 0, total: 0, digest: "", pending: 0, changed: [], frame: "", at: 0, reloads: 0, skipped: 0 });
			/** 读文件时收下的版本袋（`portOf` 往里写）—— 指纹与自激防护的凭据 */
			const bagRef = React.useRef({});
			/** 已经"读进屏幕"的 路径 → version */
			const appliedRef = React.useRef({});
			/** stat 核对时"上次看见的目录版本"（目录版本只在这里记，见 `checkNow`） */
			const dirSeenRef = React.useRef({});
			/** 当前这一批待落的变更（去抖用） */
			const batchRef = React.useRef(null);
			const timerRef = React.useRef(null);
			/** 渲染期把"最新一次的落盘实施"和"当前上下文"挂上，定时器回调不必重造闭包 */
			const flushRef = React.useRef(null);
			const ctxRef = React.useRef({});
			/** 当前订阅计划（轮询核对要知道盯了哪些目录） */
			const planRef = React.useRef(null);
			/**
			 * ★ 工单 24：**这一批变更碰到的是不是文档生成工作面依赖的桶**（`gdd\` / `evidence\`）。
			 *   判据 = 帧里的路径是不是那两份订阅目标之一 —— 订阅目标是**逐个目录**给的
			 *   （见 `watchPlan`），所以"帧长什么样"就能说出"哪个桶变了"。
			 *   `detail`（产物清单）是**所有桶的共主**：任何桶变了它都会换，只盯着它就会在
			 *   `analysis\` 变了的时候也把 39 KB 的成稿白读一遍（实测踩过）。
			 *   `false` = 这一轮的变更不在这一屏依赖的桶里（跳过）；其余情况（进功能 / 手动刷新 /
			 *   切页签 / stat 核对）一律照读。
			 */
			const draftBucketRef = React.useRef(true);
			/** 这一轮订阅已经 ready 了几个目标（判"帧永不 ready"的降级） */
			const readyCountRef = React.useRef(0);
			/** 订阅回调的**最新**一份（换一次渲染就换一个闭包，但不能因此重开订阅） */
			const onLiveEventRef = React.useRef(null);
			const loader = props.__loader;
			const remoteOpen = props.__remoteOpen;
			const ledgerLoader = props.__ledger;
			const finalLoader = props.__final;
			const fixRunner = props.__fix;
			const interfaceLoader = props.__interfaces;
			const indexLoader = props.__index;
			const detailLoader = props.__detail;
			// ★ 工单 23：头脑风暴工作面的加载器 + 四入口的发送出口（走**工单 15 那条链路**，不是新通道）
			const brainstormLoader = props.__brainstorm;
			const brainstormRunner = props.__sendBrainstorm;
			// ★ 工单 24：文档生成工作面（成稿 + 配置支线）+ 三个动作的发送出口（**同一条链路**）
			const draftLoader = props.__draft;
			const draftRunner = props.__sendDraft;
			const diagnose = props.__diagnose;
			const probe = props.__probe;
			// ★ 工单 16：变更订阅 / 批量 stat（都是官方通道，包在组合根里）
			const watchRunner = props.__watch;
			const statManyRunner = props.__statMany;

			// ★ 看板要能看出「哪个功能在等你拍板」。
			//   hooks 无条件调用；订阅整张 pending 表 + 工作会话缓存，在渲染体里算。
			const usePendingMap = props.useSessionPendingInteraction;
			const workMap = useWorkSessions();
			const pendingMap = usePendingMap ? usePendingMap((m) => m) : null;
			/** 功能名 → 'pending'（该功能的会话正等你拍板） */
			const attentionOf = (topic) => {
				if (!pendingMap) return null;
				const sid = workMap.get(workKey("sr-workbench", topic));
				if (sid && pendingMap.get(sid)) return "pending";
				return null;
			};

			/**
			 * 打开一个工作区文件。**每一步都有超时**，保证有限时间内一定给出结果。
			 *   ① DSH 内置 openFile（会话节点树里的文件链接用它；全局面板里的行为未知）
			 *   ② openWorkspacePath —— 系统默认应用
			 *   ③ openWorkspacePath action:"reveal" —— 在文件管理器里显示
			 * ★ 之前 ① 没包超时，一挂就永远停在"正在打开"——那正是你看到的现象。
			 */
			const STEP_MS = 3500;
			const withTimeout = (name, fn, ms) => {
				let p;
				try { p = Promise.resolve(fn()); }
				catch (e) {
					return Promise.reject(new Error(name + "：同步抛错 " + String((e && e.message) || e)));
				}
				return Promise.race([
					p,
					new Promise((_, rej) => setTimeout(
						() => rej(new Error(name + "：超过 " + Math.round((ms || STEP_MS) / 1000) + " 秒未响应")),
						ms || STEP_MS
					))
				]);
			};

			const handleOpen = (f, relOverride) => {
				const rel = relOverride || (f && f.openPath);
				if (!rel) { setNotice({ kind: "err", text: "没有可打开的文件" }); return; }
				const abs = toAbs(cwd, rel);
				setNotice({ kind: "pending", text: "正在打开：" + abs });

				const builtin = props.openFile;
				const hasBuiltin = typeof builtin === "function";
				const steps = [];
				if (hasBuiltin) steps.push(["DSH 内置 openFile", () => builtin(rel)]);
				steps.push(["默认应用", () => remoteOpen({ path: abs }, "默认应用")]);
				steps.push(["文件管理器 reveal", () => remoteOpen({ path: abs, action: "reveal" }, "reveal")]);

				const errs = [];
				const next = (i) => {
					if (i >= steps.length) {
						setNotice({ kind: "err", text: "三种方式都失败 ｜ " + errs.join(" ｜ "), diag: "探测中…" });
						Promise.resolve()
							.then(() => (diagnose ? diagnose() : Promise.resolve("(无诊断)")))
							.then(
								(t) => setNotice({
									kind: "err",
									text: "三种方式都失败 ｜ " + errs.join(" ｜ "),
									diag: "typeof props.openFile = " + typeof builtin + "\n" + String(t || "")
								}),
								(e) => setNotice({
									kind: "err",
									text: "三种方式都失败 ｜ " + errs.join(" ｜ "),
									diag: "typeof props.openFile = " + typeof builtin + "\n诊断本身失败：" + String((e && e.message) || e)
								})
							);
						return;
					}
					const name = steps[i][0];
					withTimeout(name, steps[i][1]).then(
						() => setNotice({ kind: "ok", text: "已打开（" + name + "）：" + rel }),
						(e) => { errs.push(String((e && e.message) || e)); next(i + 1); }
					);
				};
				next(0);
			};

			/**
			 * ① 解析索引会话 → ② 扫看板。
			 * ★ 依赖数组是空的：解析在**面板挂载时做一次**（结果进 localStorage 缓存，
			 *   下次直接认回来）。跟着会话快照重算会让看板每次有会话更新就重扫一遍。
			 */
			React.useEffect(() => {
				let cancelled = false;
				const ac = new AbortController();
				setState({ phase: "loading" });
				const resolve = props.__resolve;
				if (typeof resolve !== "function") {
					setState({ phase: "error", error: "索引会话解析器没挂上（__resolve 缺失）。" });
					return () => { cancelled = true; ac.abort(); };
				}
				Promise.resolve()
					.then(() => resolve({ rows: sessionRows, wsPaths: wsPaths, signal: ac.signal }))
					.then((res) => {
						if (cancelled) return;
						if (!res || res.ok !== true || !res.sid) {
							setState({
								phase: "nosession",
								error: (res && res.error) || "",
								note: (res && res.note) || []
							});
							return;
						}
						setIdx(res);
						return loader(res.sid, res.cwd, ac.signal, res.extraPaths).then(
							(data) => { if (!cancelled) setState({ phase: "ready", data: data, session: res }); },
							(err) => { if (!cancelled) setState({ phase: "error", error: String((err && err.message) || err), session: res }); }
						);
					})
					.then(void 0, (err) => {
						if (!cancelled) setState({ phase: "error", error: "解析索引会话失败：" + String((err && err.message) || err) });
					});
				return () => { cancelled = true; ac.abort(); };
			}, []);

			// ════════════════════════════════════════════════════════════════
			// ★ 工单 16 · 自动刷新：订阅 → 去抖合批 → **只重读受影响的那几处**
			//
			// 分工（照着 `src/pure/refresh.ts` 的文件头读）：
			//   · 组合根（这里）只做三件事：按 `watchPlan` 去开订阅、按 `planReload` 去触发重读、
			//     把 `freshnessOf` 那句话如实显示出来；
			//   · 判定（帧怎么认 / 该重读什么 / 什么叫"同一份内容"）**全在纯函数层**，有测试；
			//   · 重读**不整屏重挂**：给每个部件一个只增不减的重读计数（`rev`），
			//     加载 effect 把它挂在依赖数组上 —— 只有被点名的那几个部件会重跑，
			//     其余部件的状态（用户选中的条目、滚动位置、组件的 key）原样不动。
			// ════════════════════════════════════════════════════════════════

			/** 当前功能卡（看板数据里那一条）—— 功能根与"当前最终版"都从它来 */
			const curFeature = React.useMemo(() => {
				const d0 = state.phase === "ready" ? state.data : null;
				if (!d0 || !detailTopic) return null;
				return ((d0.features || []).filter((x) => x.topic === detailTopic)[0]) || null;
			}, [state, detailTopic]);
			const featureRoot = (curFeature && curFeature.root) || "";
			/** 当前正在看的那一个文件（详情里的最终版）—— 窄订阅 + 低频轮询的对象 */
			const openFinal = (curFeature && curFeature.openPath) || "";
			const srWsOf = (state.phase === "ready" && state.data) ? (state.data.srWs || "") : "";

			/** 渲染期把最新上下文挂上：定时器与订阅回调不在渲染闭包里，但读的必须是这一刻的值 */
			ctxRef.current = {
				view: view, dtab: dtab, topic: detailTopic,
				root: featureRoot, srWs: srWsOf, openPath: openFinal
			};

			/** 详情清单 → 绝对路径数组（指纹与 stat 批核对都用它） */
			const listingAbs = (detailData) => {
				if (!detailData || detailData.error || !detailData.artifacts) return [];
				const root = String(detailData.root || "").replace(/\\+$/, "");
				if (root === "") return [];
				return (detailData.artifacts.allPaths || []).map((rel) => root + "\\" + String(rel).replace(/\//g, "\\"));
			};

			/** 重读一个部件：把它的计数 +1（加载 effect 依赖它，于是只有它重跑） */
			const bumpParts = (parts) => {
				const bump = {};
				// ★ 工单 24：`brain`（头脑风暴）与 `draft`（文档生成）也进名单 —— 在此之前
				//   `planReload` 已经会点名 `brain`，但这里没接，那一票的"只重读受影响的部分"里
				//   头脑风暴其实是靠 `detail` 间接重跑的。现在两个工作面各自有独立的计数：
				//   切到哪一屏、哪一屏在屏幕上都由它决定，`LiveBar` 的 `data-rev` 也看得见。
				for (const p of ["detail", "ledger", "final", "ui", "brain", "draft"]) if ((parts || []).indexOf(p) >= 0) bump[p] = 1;
				if (Object.keys(bump).length === 0) return;
				setRev((prev) => {
					const next = Object.assign({}, prev);
					for (const k of Object.keys(bump)) next[k] = (prev[k] || 0) + 1;
					return next;
				});
			};

			/**
			 * 看板重读。**保留旧数据直到新数据到手**（不清空、不显示"正在读"）——
			 * 否则每次后台变化都会把屏幕闪一下。
			 */
			const reloadBoard = () => {
				if (typeof loader !== "function" || !sessionId || state.phase !== "ready") return;
				const ac = new AbortController();
				loader(sessionId, cwd, ac.signal, (idx && idx.extraPaths) || []).then(
					(data) => setState((prev) => (prev.phase === "ready" ? Object.assign({}, prev, { data: data }) : prev)),
					() => { /* 重读失败：保留旧数据，界面上"已是最新"那句话不会被编出来 */ }
				);
			};

			/**
			 * 落一次重读（自动与手动共用一个出口）。
			 * @param parts 要重读的部件（`unionParts` 的结论，或手动刷新时给全集）
			 */
			const applyReload = (parts) => {
				if ((parts || []).indexOf("board") >= 0) reloadBoard();
				bumpParts(parts);
				setLive((prev) => Object.assign({}, prev, { pending: 0, reloads: prev.reloads + 1 }));
			};
			flushRef.current = applyReload;

			/**
			 * 手动刷新（**永远保留的兜底**）：所有部件重读一遍。
			 * ★ 通道不可用时（没有索引会话 / 宿主不支持 watch / 帧永不 ready）它就派上用场 ——
			 *   所以这个按钮**任何状态下都在**，降级时界面上会明说"用「刷新」或 F5"。
			 */
			const onManualRefresh = () => applyReload(RELOAD_PARTS);

			/** 版本袋 → "已应用"，并按当前清单刷新指纹 */
			const commitBag = (detailData) => {
				appliedRef.current = mergeApplied(appliedRef.current, bagRef.current);
				const paths = listingAbs(detailData);
				const fp = fingerprintOf(appliedRef.current, paths);
				setLive((prev) => Object.assign({}, prev, { digest: fp.digest }));
				return fp;
			};

			/**
			 * 详情清单里每个文件 `stat` 一遍 —— 版本指纹的**完整**凭据。
			 * ★ 为什么值得多花这一轮：`read` 只覆盖"面板真的读过的文件"（定稿头部、analysis 产物…），
			 *   而清单里还有 24 个里没被读过的那些（图片、宣讲稿）。stat 只取元数据、不取内容，
			 *   一次 20~40 个调用的代价换"指纹真的等于这个功能目录的当前状态"。
			 * ★ 它也是**正确性底线**的落点：帧通道漏了（watch 不支持 / 更深一层）时，
			 *   下一次重读会把真版本收回来 → `stalePaths` 能判出来。
			 */
			const sweepVersions = (detailData) => {
				if (typeof statManyRunner !== "function" || !sessionId) return;
				const paths = listingAbs(detailData);
				if (paths.length === 0) return;
				const ac = new AbortController();
				statManyRunner(sessionId, paths, ac.signal).then(
					(map) => {
						appliedRef.current = mergeApplied(appliedRef.current, map);
						const fp = fingerprintOf(appliedRef.current, paths);
						setLive((prev) => Object.assign({}, prev, { digest: fp.digest }));
					},
					() => { /* stat 批失败：指纹留在上一份，界面照实显示旧指纹（不编新的） */ }
				);
			};

			/** 去抖合批：静默 300ms 落一次；一直在写也不能超过 1.5s（判据在纯函数里） */
			const scheduleFlush = () => {
				if (timerRef.current) clearTimeout(timerRef.current);
				const tick = () => {
					const b = batchRef.current;
					if (!b) { timerRef.current = null; return; }
					if (!shouldFlush(b, Date.now())) { timerRef.current = setTimeout(tick, 120); return; }
					timerRef.current = null;
					batchRef.current = null;
					const parts = unionParts(b.plans);
					setLive((prev) => Object.assign({}, prev, { changed: b.why.slice(-8), at: Date.now() }));
					if (flushRef.current) flushRef.current(parts);
				};
				timerRef.current = setTimeout(tick, FLUSH_QUIET_MS);
			};

			/** 把一条"该重读了"的路径塞进当前批（帧与 stat 核对共用） */
			const enqueueChange = (path, version, reason) => {
				// ★ 目录版本**当场记下**（唯一记它的地方）：核对时不再为同一个目录版本反复重读。
				//   文件的版本不在这里记 —— 它要由重读（stat 批）收回来，这样重读失败时还能再被发现。
				if (version && planRef.current && (planRef.current.dirs || []).some((d) => normPath(d) === normPath(path))) {
					dirSeenRef.current = mergeApplied(dirSeenRef.current, { [path]: version });
				}
				const b = batchRef.current || (batchRef.current = { firstAt: Date.now(), lastAt: 0, plans: [], paths: {}, why: [] });
				b.lastAt = Date.now();
				b.paths[normPath(path)] = version || "";
				b.plans.push(planReload({ path: path }, { root: ctxRef.current.root, srWs: ctxRef.current.srWs }));
				// ★ 工单 24：这一批是不是碰到了"文档生成工作面依赖的桶"（gdd\ 顶层 / evidence\）
				const targets = (planRef.current && planRef.current.targets) || [];
				const hit = targets.filter((tp) => normPath(tp) === normPath(path))[0] || "";
				if (hit !== "") {
					const rel = String(ctxRef.current.root || "") !== "" && containsPath(ctxRef.current.root, hit)
						? normPath(hit).slice(normPath(ctxRef.current.root).length + 1)
						: "";
					const seg = String(rel).split("\\")[0].toLowerCase();
					draftBucketRef.current = (seg === "gdd" || seg === "evidence");
				} else {
					draftBucketRef.current = false;      // 别的桶（analysis / decisions / …）
				}
				b.why.push(path + (reason ? "（" + reason + "）" : ""));
				setLive((prev) => Object.assign({}, prev, { phase: "on", pending: Object.keys(b.paths).length }));
				scheduleFlush();
			};

			/** 收到一帧（或一条订阅状态）—— 组合根回调，可能在 React 之外 */
			const onLiveEvent = (ev) => {
				const e = ev || {};
				if (e.kind === "ready") {
					readyCountRef.current = Number(e.ready) || (readyCountRef.current + 1);
					setLive((prev) => Object.assign({}, prev, { phase: "on", ready: readyCountRef.current, total: Number(e.total) || prev.total, reason: "" }));
					return;
				}
				if (e.kind === "down") {
					setLive((prev) => Object.assign({}, prev, { phase: "down", reason: e.reason || "订阅建立失败" }));
					return;
				}
				if (e.kind === "error") {
					setLive((prev) => Object.assign({}, prev, {
						phase: prev.ready > 0 ? prev.phase : "down",
						reason: "订阅报错：" + (e.error || "原因未知") + "（这个目标的自动跟随停了）"
					}));
					return;
				}
				if (e.kind === "end") {
					setLive((prev) => Object.assign({}, prev, { phase: "down", reason: "订阅被宿主结束（目标可能被删了）" }));
					return;
				}
				if (e.kind !== "frame") return;
				const parsed = parseFrame(e.frame);
				if (!parsed) {
					setLive((prev) => Object.assign({}, prev, { skipped: prev.skipped + 1 }));
					return;
				}
				if (parsed.kind === "ready") {
					readyCountRef.current = readyCountRef.current + 1;
					setLive((prev) => Object.assign({}, prev, { phase: "on", ready: readyCountRef.current }));
					return;
				}
				const notice = parsed.change;
				// ★ 自激防护：同一份内容（version 相同）不重读 —— 判定在 `acceptFrame` 里
				const verdict = acceptFrame(notice, { applied: appliedRef.current, file: ctxRef.current.openPath });
				if (!verdict.accept) {
					setLive((prev) => Object.assign({}, prev, { skipped: prev.skipped + 1 }));
					return;
				}
				setLive((prev) => Object.assign({}, prev, { frame: JSON.stringify(e.frame), at: Date.now() }));
				enqueueChange(notice.path, notice.version, notice.absent ? "目标已不在" : "");
			};
			onLiveEventRef.current = onLiveEvent;

			/**
			 * stat 核对（切回面板 / 焦点回来 / 低频轮询）—— **正确性底线**。
			 * 帧通道可能不可用或漏（更深一层、watch 不支持），这条不依赖帧：
			 * 直接拿当前文件与被订阅目录的版本与"屏幕上那份"比，不一致就重读。
			 *
			 * ★ 两边的**记账不同**，这是为了不出现"每 15 秒重读一次"的慢自激：
			 *   · **文件**：与 `applied` 比；不一致**不**在这里改 `applied` —— 真版本要由重读
			 *     （stat 批）收回来。好处：重读失败时下一轮还会再发现（每 15 秒重试一次，不是死循环）。
			 *   · **目录**：与 `dirSeen` 比；看见的版本由 `enqueueChange` 当场记下 ——
			 *     重读只 stat 清单里的文件、**不 stat 目录**，不记的话同一个目录版本会被每一轮
			 *     核对都判成"不一致"，于是每 15 秒白重读一次。
			 */
			const checkNow = () => {
				if (typeof statManyRunner !== "function" || !sessionId || !ctxRef.current.root) return;
				const dirs = ((planRef.current && planRef.current.dirs) || []).slice();
				const files = ctxRef.current.openPath ? [ctxRef.current.openPath] : [];
				if (dirs.length === 0 && files.length === 0) return;
				const ac = new AbortController();
				statManyRunner(sessionId, files.concat(dirs), ac.signal).then((map) => {
					const dirKeys = {};
					for (const d of dirs) dirKeys[normPath(d)] = true;
					const fileMap = {}, dirMap = {};
					for (const p of Object.keys(map)) {
						if (dirKeys[normPath(p)]) dirMap[p] = map[p]; else fileMap[p] = map[p];
					}
					const staleFiles = stalePaths(appliedRef.current, fileMap);
					const staleDirs = stalePaths(dirSeenRef.current, dirMap);
					if (staleFiles.length === 0 && staleDirs.length === 0) return;
					// 目录版本的记账在 `enqueueChange` 里（唯一一处）；这里只负责判与入队
					for (const p of staleDirs.concat(staleFiles)) enqueueChange(p, map[p], "stat 核对发现不一致");
				}, () => { /* stat 失败：这次核对放弃，绝不假装"已是最新" */ });
			};

			/**
			 * ★ 进功能 / 在功能里换工作面时订阅变更（工单 16 的主刀）。
			 *
			 * 三个不许省的细节：
			 *   ① 用**索引会话**的 id 订阅（`list` 与 `changes` 都锁在会话工作区内 —— 开发笔记坑 3），
			 *      而功能目录在 SR 根之下，所以只有 cwd 覆盖 SR 根的索引会话看得见它；
			 *   ② 目标要**逐个目录**给（0.2.0 的 watch 是 depth 0：只订阅功能根看不见 `gdd\` 里的写入）；
			 *   ③ 离开功能 / 换工作面就 `abort`（信号）+ 释放订阅（`dispose`）—— 不留悬挂的流。
			 */
			const watchKey = (dview && !dview.error && String(dview.root || "") === String(featureRoot || "") && featureRoot !== "")
				? "d:" + ((dview.dirs || []).join("|")) + "#n:" + ((dview.nestedDirs || []).join("|"))
				: "";
			React.useEffect(() => {
				if (view !== "detail" || !detailTopic || !sessionId || state.phase !== "ready" || !featureRoot || watchKey === "") {
					setLive((prev) => Object.assign({}, prev, { phase: "off", ready: 0, total: 0 }));
					return;
				}
				if (typeof watchRunner !== "function") {
					setLive((prev) => Object.assign({}, prev, { phase: "down", reason: "订阅器没挂上（__watch 缺失）" }));
					return;
				}
				const plan = watchPlan({
					root: featureRoot,
					dirs: (dview && dview.dirs) || [],
					nested: (dview && dview.nestedDirs) || [],
					file: openFinal
				});
				planRef.current = plan;
				readyCountRef.current = 0;
				setLive((prev) => Object.assign({}, prev, {
					phase: "connecting", ready: 0, total: plan.targets.length,
					reason: plan.dropped.length ? "有 " + plan.dropped.length + " 个目标超出订阅上限（这些位置不会自动跟随）" : ""
				}));
				const ac = new AbortController();
				const handle = watchRunner(sessionId, plan.targets, onLiveEventRef.current, ac.signal);
				// 「帧永不 ready」也要如实降级：8 秒一条 ready 都没有 ⇒ 不说自己在跟随
				const t = setTimeout(() => {
					if (ac.signal.aborted || readyCountRef.current > 0) return;
					setLive((prev) => Object.assign({}, prev, { phase: "down", reason: "订阅建起来了但一直没有就绪帧（宿主可能不支持 watch）" }));
				}, 8000);
				return () => {
					ac.abort();
					clearTimeout(t);
					if (handle && typeof handle.dispose === "function") handle.dispose();
				};
			}, [view, detailTopic, sessionId, state.phase, featureRoot, watchKey, openFinal]);

			/** 低频轮询 + 焦点回来核对：用户盯着改的就是"当前这一个文件" */
			React.useEffect(() => {
				if (view !== "detail" || !sessionId || state.phase !== "ready") return;
				const id = setInterval(() => checkNow(), 15000);
				const onFocus = () => {
					try { if (typeof document !== "undefined" && document.hidden) return; } catch (e) { /* 无 document：照样核 */ }
					checkNow();
				};
				try {
					window.addEventListener("focus", onFocus);
					document.addEventListener("visibilitychange", onFocus);
				} catch (e) { /* 无 window/document：只留轮询 */ }
				return () => {
					clearInterval(id);
					try {
						window.removeEventListener("focus", onFocus);
						document.removeEventListener("visibilitychange", onFocus);
					} catch (e) { /* 同上 */ }
				};
			}, [view, detailTopic, sessionId, state.phase, openFinal]);

			/** 换功能就把版本与订阅状态清干净（否则新功能的指纹会掺进上一个功能的文件） */
			const topicSeenRef = React.useRef("");
			React.useEffect(() => {
				if (topicSeenRef.current === detailTopic) return;
				topicSeenRef.current = detailTopic;
				appliedRef.current = {};
				dirSeenRef.current = {};
				bagRef.current = {};
				batchRef.current = null;
				planRef.current = null;
				draftSigRef.current = "";
				setLive({ phase: "off", reason: "", ready: 0, total: 0, digest: "", pending: 0, changed: [], frame: "", at: 0, reloads: 0, skipped: 0 });
			}, [detailTopic]);

			/**
			 * ★ 工单 12：进「功能详情」时读**产物清单 + 校验清单**。
			 * 一次读，两个页签与状态块共用（不按页签重复扫盘）。
			 * 与看板的边界：看板只给"卡片级"结论（finalCheck 等）；这里给详情级（逐文件、逐条校验）。
			 *
			 * ★ 工单 16 两处改动：
			 *   ① 依赖里多了 `rev.detail` —— 变更订阅判定"该重读详情"时，**只有这一条 effect 重跑**；
			 *   ② 不再在开头 `setDetail(null)`：重读期间**保留屏幕上的旧数据**（不清屏、不丢用户
			 *      已展开的条目），换功能时的清空改由渲染期的 `detail.root === f.root` 守卫负责。
			 */
			React.useEffect(() => {
				if (view !== "detail" || !detailTopic || !sessionId || state.phase !== "ready") { setDetail(null); return; }
				const d0 = state.data;
				const feat = (d0.features || []).filter((x) => x.topic === detailTopic)[0];
				if (!feat || !feat.root) { setDetail({ error: "拿不到功能根目录：详情读不了。" }); return; }
				let cancelled = false;
				const ac = new AbortController();
				if (typeof detailLoader !== "function") {
					setDetail({ error: "详情加载器没挂上（__detail 缺失）。" });
					return () => { cancelled = true; ac.abort(); };
				}
				detailLoader(sessionId, feat.root, ac.signal, bagRef.current).then(
					(r) => {
						if (cancelled) return;
						setDetail(stamped(r));
						// 指纹：先按"读到了哪几个"给一个，再 stat 一遍清单把它补成完整的
						commitBag(r);
						sweepVersions(r);
					},
					(e) => { if (!cancelled) setDetail(stamped({ error: "读产物清单失败：" + String((e && e.message) || e) })); }
				);
				return () => { cancelled = true; ac.abort(); };
			}, [view, detailTopic, sessionId, state.phase, rev.detail]);

			/**
			 * ★ 工单 23：进「头脑风暴」工作面时读**已有的分析结论** + 两种新格式的解析。
			 *
			 * 依赖 `detail`：产物清单是工单 12 那份（**同一份来源**），这里只拿 `analysis` 组做事 ——
			 * 不重新列目录，免得"面板列出的产物"与"工作面认出的结论"两处对不上。
			 * 出口判据那一句话也是搬 `detail.stage.note`（在 `artifacts.ts` 里算的），这一层不重算。
			 */
			React.useEffect(() => {
				if (view !== "detail" || dtab !== "brainstorm" || !sessionId || state.phase !== "ready") { setBrain(null); return; }
				const dready = ofTopic(detail);
				if (!dready || dready.error) { setBrain(null); return; }
				if (typeof brainstormLoader !== "function") {
					setBrain({ error: "头脑风暴加载器没挂上（__brainstorm 缺失）。" });
					return;
				}
				const root = dready.root || "";
				if (!root) { setBrain({ error: "拿不到功能根目录：头脑风暴读不了。" }); return; }
				const group = ((dready.artifacts && dready.artifacts.groups) || []).filter((g) => g.key === "analysis")[0];
				const files = (group && group.files) || [];
				let cancelled = false;
				const ac = new AbortController();
				brainstormLoader(sessionId, { root: root, files: files, stage: dready.stage }, ac.signal, bagRef.current).then(
					(r) => { if (!cancelled) setBrain(stamped(r)); },
					(e) => { if (!cancelled) setBrain(stamped({ error: "读分析产物失败：" + String((e && e.message) || e) })); }
				);
				return () => { cancelled = true; ac.abort(); };
			}, [view, dtab, detailTopic, sessionId, state.phase, detail]);

			/** ★ 工单 24：文档生成工作面已经读过的**那一批变更的签名**（同一批只读一遍盘） */
			const draftSigRef = React.useRef("");
			/** ★ 工单 24：文档生成工作面的**重读代数**（`rev.detail + rev.draft`，只增不减） */
			const draftGenRef = React.useRef(-1);
			/**
			 * ★ 工单 24：进「文档生成」工作面时读**成稿（两大部分 + 左树）**与**配置支线走到哪**。
			 *
			 * 依赖 `detail`（工单 12 的产物清单是**同一份来源**：`gdd\` 与 `evidence\` 组的文件清单）——
			 * 不重新列目录，免得"面板列出的产物"与"工作面读的那份成稿"两处对不上（与头脑风暴同一条纪律）。
			 * 另见下面 effect 里的两处说明：为什么**不把 `rev.draft` 当依赖**、以及那道"输入清单没变就不重读"的闸门。
			 */
			React.useEffect(() => {
				if (view !== "detail" || dtab !== "draft" || !sessionId || state.phase !== "ready") { setDraft(null); draftSigRef.current = ""; draftGenRef.current = -1; return; }
				const dready = ofTopic(detail);
				if (!dready || dready.error) { setDraft(null); draftSigRef.current = ""; draftGenRef.current = -1; return; }
				if (typeof draftLoader !== "function") {
					setDraft({ error: "文档生成加载器没挂上（__draft 缺失）。" });
					return;
				}
				const root = dready.root || "";
				if (!root) { setDraft({ error: "拿不到功能根目录：这一屏读不了。" }); return; }
				const groups = (dready.artifacts && dready.artifacts.groups) || [];
				const gdd = groups.filter((g) => g.key === "gdd")[0];
				const ev = groups.filter((g) => g.key === "evidence")[0];
				/**
				 * ★ **一次重读只读一遍盘**：这条 effect 的依赖里**没有** `rev.draft` ——
				 *   它认的是 `detail`（工单 12 的产物清单）。`planReload` 对 `gdd\` 与 `evidence\`
				 *   两处都同时点名 `detail` 与 `draft`，所以"该重读这一屏"的那一帧必然先把 `detail`
				 *   换掉，这条 effect 跟着重跑一次 —— 依赖里再加 `rev.draft` 只会把同一份 39 KB 的成稿
				 *   在前后的两次渲染里各读一遍（实测过：一条 gdd 帧读两次）。
				 *   `rev.draft` 仍然照常累加（刷新条上的 `data-rev` 看得见它被点名），只是不当依赖用。
				 *
				 * ★ 闸门看**两件事一起**：① **这一批变更的代数**（`rev.detail + rev.draft`，见下面 `gen`）
				 *   ② 面板已经读到过内容（`draft` 非空）。少看任何一条都不行：
				 *   · 只看 ① ⇒ 组件被重新挂载时（`draft` 是 null）永远不读 —— 这一屏一直空着
				 *     （这是实测踩出来的：闸门漏了 ② 时面板空屏）；
				 *   · 只看 ② ⇒ **同一批里被调用两次**时会各读一遍 39 KB（一次原子替换会来两条帧）。
				 *   `sig`（清单 + 宿主版本）留着给人排障看，不作判据 —— 它会被 stat 批更新掉。
				 */
				const verOf = (rel) => String(appliedRef.current[normPath(root + "\\" + String(rel).replace(/\//g, "\\"))] || "?");
				const gddFiles = (gdd && gdd.files) || [];
				const evFiles = (ev && ev.files) || [];
				/**
				 * ★ `gen` = **这一批变更的代数**（`rev.detail + rev.draft`）：一次重读只算一代，
				 *   所以"同一批里被调用两次"的第二跳会被闸门挡掉（内容没变，白读一遍盘）。
				 *   而 `rev` 每次重读都 +1 ⇒ 下一批的 `gen` 更大 ⇒ **原地改文件名不变**也照读。
				 */
				const gen = (Number(rev.detail) || 0) + (Number(rev.draft) || 0);
				const sig = gen + "\u0001" + root + "\u0001" + (gdd && gdd.count) + "\u0001" +
					gddFiles.map((x) => x.name + "@" + verOf(x.rel || "gdd/" + x.name)).join(",") + "\u0001" +
					evFiles.map((x) => x.name + "@" + verOf(x.rel || "evidence/" + x.name)).join(",") + "\u0001" +
					String((dready.finalCheck && dready.finalCheck.current) || "") + "\u0001" +
					(((curFeature && curFeature.configs) || []).join(","));
				const sameGen = draftGenRef.current === gen;
				// ★ 判据 = **"这一代已经读过、并且读出了内容"**。
				//   为什么不比 `sig`：同一代里 `applied` 的版本会被 stat 批更新，`sig` 因此会变，
				//   于是"同一批"里会各读一遍 39 KB（实测踩过：一条帧读两遍）。
				//   代数（`rev.detail + rev.draft`）只在**真正重读**时才变，所以以它为准：
				//   同一批只读一遍；下一批照读（`gen` 变大）—— **原地改文件名不变**也能看见。
				// 跳过（两个理由之一）：① 这一批变更不在这一屏依赖的桶里（`gdd\` / `evidence\`）；
				// ② 同一代里已经读过、并读出了内容。其余情况照读（进功能 / 手动刷新 / 切页签 / stat 核对）。
				const skip = (sameGen && !!draft && dready.root === (draft && draft.root)) || draftBucketRef.current === false;
				if (skip) return;
				draftBucketRef.current = true;
				draftGenRef.current = gen;
				draftSigRef.current = sig;
				let cancelled = false;
				const ac = new AbortController();
				draftLoader(sessionId, {
					root: root,
					gddFiles: gddFiles,
					evidenceFiles: evFiles.map((x) => x.name),
					finalCheck: dready.finalCheck,
					// ★ 工单 25：定稿门（合流 → 定稿 的落点）—— 判据在 detail 那一层算好，这里只搬
					gate: dready.gate,
					configFiles: (curFeature && curFeature.configs) || [],
					// ★ 配置表存在性以**真目录的列举**为准（看板按主题挂上来的那份只当兜底）
					configRoot: (d && d.configRoot) || ""
				}, ac.signal, bagRef.current).then(
					(r) => { if (!cancelled) setDraft(stamped(r)); },
					(e) => { if (!cancelled) setDraft(stamped({ error: "读成稿失败：" + String((e && e.message) || e) })); }
				);
				return () => { cancelled = true; ac.abort(); };
			}, [view, dtab, detailTopic, sessionId, state.phase, detail]);

			// 进「功能详情」时加载该功能的决策台账（§3.2：从**功能根目录**读）
			// ★ 工单 16：依赖里多了 `rev.ledger` —— 只有 decisions/ 或 evidence/ 变了才会重读它
			React.useEffect(() => {
				if (view !== "detail" || !detailTopic || !sessionId) { setLedger(null); return; }
				let cancelled = false;
				const ac = new AbortController();
				const d = state.phase === "ready" ? state.data : null;
				const feat = ((d && d.features) || []).filter((x) => x.topic === detailTopic)[0];
				if (!feat || !feat.root) { setLedger(null); return; }
				ledgerLoader(sessionId, feat.root, d && d.skillsRoot, ac.signal, bagRef.current).then(
					(L) => { if (!cancelled) setLedger(stamped(L)); },
					(e) => { if (!cancelled) setLedger(stamped({ records: [], calibration: [], calFiles: [], schemaOk: false, error: String((e && e.message) || e) })); }
				);
				return () => { cancelled = true; ac.abort(); };
			}, [view, detailTopic, sessionId, state.phase, rev.ledger]);

			// 进「定稿」页签时读定稿全文并解析结构（§6.2）
			// ★ 工单 16：依赖里多了 `rev.final` —— 只有 gdd/ 顶层变了才重读定稿全文
			React.useEffect(() => {
				if (view !== "detail" || dtab !== "final" || !sessionId || state.phase !== "ready") { setFinalDoc(null); return; }
				const d0 = state.data;
				const feat = (d0.features || []).filter((x) => x.topic === detailTopic)[0];
				if (!feat || !feat.openPath) { setFinalDoc({ empty: "本功能还没有定稿。" }); return; }
				let cancelled = false;
				const ac = new AbortController();
				finalLoader(sessionId, feat.openPath, ac.signal, bagRef.current).then(
					(g) => { if (!cancelled) setFinalDoc(stamped(g)); },
					(e) => { if (!cancelled) setFinalDoc(stamped({ error: "读定稿失败：" + String((e && e.message) || e) })); }
				);
				return () => { cancelled = true; ac.abort(); };
			}, [view, detailTopic, dtab, sessionId, state.phase, rev.final]);

			// 进「界面图」时读定稿的 §5
			// ★ 工单 16：依赖里多了 `rev.ui` —— gdd/ 变了就重读界面图（改 png 也算）
			React.useEffect(() => {
				if (view !== "detail" || dtab !== "ui" || !sessionId || state.phase !== "ready") { setIface(null); return; }
				const d0 = state.data;
				const feat = (d0.features || []).filter((x) => x.topic === detailTopic)[0];
				if (!feat || !feat.openPath) { setIface({ empty: "本功能还没有定稿，界面图在定稿的 §5。" }); return; }
				let cancelled = false;
				const ac = new AbortController();
				interfaceLoader(sessionId, feat.openPath, ac.signal, bagRef.current).then(
					(r) => { if (!cancelled) setIface(stamped(r)); },
					(e) => { if (!cancelled) setIface(stamped({ error: "读取失败：" + String((e && e.message) || e) })); }
				);
				return () => { cancelled = true; ac.abort(); };
			}, [view, dtab, detailTopic, sessionId, state.phase, rev.ui]);

			// 进「设计资产」时读索引
			React.useEffect(() => {
				if (view !== "assets" || !sessionId || state.phase !== "ready") { setIndexData(null); return; }
				let cancelled = false;
				const ac = new AbortController();
				setIndexData(null);
				indexLoader(sessionId, state.data.srWs, ac.signal).then(
					(r) => { if (!cancelled) setIndexData(r); },
					(e) => { if (!cancelled) setIndexData({ error: "读取失败：" + String((e && e.message) || e) }); }
				);
				return () => { cancelled = true; ac.abort(); };
			}, [view, sessionId, state.phase]);

			const shell = (children) => h("div", {
				style: {
					padding: "18px 22px", fontFamily: "system-ui, 'Microsoft YaHei', sans-serif",
					color: C.ink, height: "100%", overflow: "auto", boxSizing: "border-box", background: C.bg
				}
			}, children);

			/** 一级导航当前项：功能详情归在「功能看板」下 */
			const navView = view === "detail" ? "dashboard" : view;
			/** 标题 + 一级导航（做进 head，所有分支自动带上） */
			const head = (sub) => h("div", { key: "hd" }, [
				h("div", { key: "row", style: { display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "12px" } }, [
					h("h1", { key: "t", style: { fontSize: "18px", margin: 0 } }, "策划工作台"),
					h("span", { key: "s", style: { fontSize: "12px", color: C.muted } }, sub)
				]),
				h(TabBar, {
					key: "nav",
					items: NAV,
					view: navView,
					onPick: (id) => { setView(id); setDetailTopic(null); }
				})
			]);

			if (state.phase === "nosession") return shell([head("功能看板 · A1"),
				h("p", { key: "p", style: { color: C.bad } }, "工作台没能拿到可用会话（索引会话没解析出来）。"),
				h("div", { key: "e", style: { color: C.muted, fontSize: "12px", lineHeight: 1.9, marginTop: "8px" } },
					(state.error ? ["原因：" + state.error] : []).concat(state.note || [])),
				h("div", { key: "h", style: { color: C.muted, fontSize: "12px", lineHeight: 1.95, marginTop: "10px" } }, [
					h("div", { key: "a" }, "① 索引会话的取法：缓存 → 标题「策划工作台·索引」→ cwd 覆盖 sr 根 → 新建；都不成才会到这里。"),
					h("div", { key: "b" }, "② 目录列举限定在会话工作区内（文件读取不受限）——所以索引会话的 cwd 必须覆盖 sr 工作区根。")
				])]);
			if (state.phase === "idle" || state.phase === "loading") return shell([head("功能看板 · A1"),
				h("p", { key: "p", style: { color: C.muted } }, "正在解析索引会话并读工作区…")]);
			if (state.phase === "error") return shell([head("功能看板 · A1"),
				h("p", { key: "p", style: { color: C.bad } }, "读取失败：" + state.error),
				h("div", { key: "h", style: { color: C.muted, fontSize: "12px", lineHeight: 1.95, marginTop: "10px" } }, [
					h("div", { key: "a" }, "① 面板锚定方式：读 sr 配置的 sr_workspace 字段（绝对路径），不跟当前选中会话走。"),
					h("div", { key: "b" }, "② 索引会话：" + sessionSourceText(state.session) + "　cwd = " + (cwd || "(未解析)")),
					h("div", { key: "c" }, "③ 常见原因：sr 配置没读到（候选根里没有 .agents\\skills\\sr-askme\\config.local.json），或锚点不在索引会话的工作区内。"),
					h("div", { key: "d" }, "④ 目录列举限定在工作区内；文件读取不受限。")
				])]);

			const d = state.data;
			// ── 功能详情（二级视图）──────────────────────────────
			if (view === "detail") {
				const f = d.features.filter((x) => x.topic === detailTopic)[0];
				// ★ 工单 16：只把**属于当前功能**的那几份数据交给下面的组件（`__topic` 的戳）
				const brainV = ofTopic(brain);
				const draftV = ofTopic(draft);
				const ledgerV = ofTopic(ledger);
				const finalV = ofTopic(finalDoc);
				const ifaceV = ofTopic(iface);
				return shell([
					head("功能详情 · " + detailTopic),
					h("div", { key: "sub", style: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px", flexWrap: "wrap" } }, [
						h("button", {
							key: "back", type: "button",
							onClick: () => setView("dashboard"),
							style: { font: "inherit", fontSize: "12px", padding: "3px 9px", border: "1px solid " + C.soft, background: "#fff", borderRadius: "4px", cursor: "pointer" }
						}, "‹ 返回功能看板"),
						f ? badge(f.docType ? f.docType + " / " + (f.status || "?") : "无定稿", f.status === "active" ? "ok" : null) : null,
						f && f.latestFinal ? h("span", { key: "v", style: { fontSize: "11px", color: C.muted, fontFamily: "monospace" } }, "最终版 " + f.latestFinal) : null,
						f && f.openPath ? h("button", {
							key: "open", type: "button",
							onClick: () => handleOpen(f),
							style: { font: "inherit", fontSize: "11px", padding: "3px 9px", border: "1px solid " + C.soft, background: "#fff", borderRadius: "4px", cursor: "pointer" }
						}, "打开最终版") : null
					]),
					// ★ 工单 16：**变更订阅与版本指纹**（放在最上面一行，一眼看出"屏幕上的是不是最新"）
					h(LiveBar, { key: "live", live: live, rev: rev, onRefresh: onManualRefresh }),
					h(NoticeBar, { key: "nt", notice: notice }),
					// ★ 工单 12：状态块放在页签**之上** —— 切到哪一屏都能看到三阶段与"现在能用吗"
					h(DetailStatus, { key: "st", detail: dview, feature: f, onOpenFix: () => { setDtab("final"); if (f && f.openPath) handleOpen(f); } }),
					// ★ 工单 23：功能内部先分**工作面**（三阶段）与**资料页签**两组 ——
					//   第一组是"这个功能该走哪一步"，第二组是"旁挂的过程/产物/界面图"（spec.md:30）。
					h("div", { key: "stages", style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" } }, [
						h("span", { key: "l", style: { fontSize: "10.5px", color: C.muted, flex: "0 0 auto" } }, "工作面"),
						h(TabBar, { key: "b", items: DETAIL_STAGES, view: dtab, onPick: setDtab })
					]),
					h("div", { key: "mtabs", style: { display: "flex", alignItems: "center", gap: "8px" } }, [
						h("span", { key: "l", style: { fontSize: "10.5px", color: C.muted, flex: "0 0 auto" } }, "资料"),
						h(TabBar, { key: "b", items: DETAIL_TABS, view: dtab, onPick: setDtab })
					]),
					dtab === "brainstorm"
						? h(BrainstormWorkface, {
							key: "bw",
							data: brainV,
							feature: f,
							root: (dview && dview.root) || "",
							srWs: d.srWs,
							onSend: typeof brainstormRunner === "function"
								? (kind, input) => brainstormRunner(d && d.srWs, kind, input, {
									// 会话候选：store 快照带着 cwd / running；空则由组合根补一次 session.list
									rows: sessionRows
								})
								: null,
							onOpenSession: (sid) => probe.openSession(sid),
							onOpen: (abs) => handleOpen(null, abs)
						})
						: dtab === "draft"
						? h(DraftWorkface, {
							key: "dw",
							data: draftV,
							feature: f,
							// ★ 工单 24c：指纹 / 订阅实况进「详情」（首屏只留人话），所以这里要把 live 传下去
							live: live,
							root: (dview && dview.root) || "",
							srWs: d.srWs,
							onSend: typeof draftRunner === "function"
								? (action, input) => draftRunner(d && d.srWs, action, input, { rows: sessionRows })
								: null,
							onOpenSession: (sid) => probe.openSession(sid),
							onOpen: (abs) => handleOpen(null, abs)
						})
						: dtab === "ledger"
						? h(DecisionLedger, {
							key: "lg", ledger: ledgerV,
							// ★ 工单 17 的能力（字段覆盖检查）：结论来自 `buildLedger(...).fieldCheck`
							//   —— 就是 `src/pure/fieldclass.ts` 的 `checkFieldCoverage` 的返回值本身，
							//   面板只显示它，**不重跑一遍**（否则就是第二份实现）。
							coverage: designLedger ? designLedger.fieldCheck : null
						})
						: dtab === "pipeline"
							? h(PipelinePanel, {
								key: "pp-" + (f ? f.topic : ""),
								feature: f, probe: probe,
								sessionId: sessionId, cwd: cwd, projectRoot: props.__projectRoot,
								useSessions: props.useSessions,
								useSessionPendingInteraction: props.useSessionPendingInteraction
							})
							: dtab === "artifacts"
								? h(ArtifactBuckets, {
									key: "ab", feature: f, detail: dview,
									srWs: d.srWs, configRoot: d.configRoot,
									onOpen: (abs) => handleOpen(null, abs)
								})
								: dtab === "ui"
									? h(InterfacePanel, {
										key: "if", data: ifaceV, srWs: d.srWs,
										onOpen: (abs) => handleOpen(null, abs)
									})
									: dtab === "design"
										? h(DesignLedger, { key: "dl", ledger: designLedger })
										: dtab === "final"
											? h(FinalDoc, {
												key: "fd", doc: finalV,
												// ★ 工单 15：三段式发给**该功能的专属工作会话**
												//   （cwd = `features\<主题>\`；root 由功能详情给出，最权威）
												featureRoot: (dview && dview.root) || "",
												onFix: (req) => fixRunner(d && d.srWs, req, {
													root: (dview && dview.root) || "",
													// 会话候选：store 快照带着 cwd / running；空则由组合根补一次 session.list
													rows: sessionRows
												}),
												onOpenSession: (sid) => probe.openSession(sid),
												// 图片加载失败时退化成「用默认程序打开」——走与产物清单同一条打开链路
												onOpen: (abs) => handleOpen(null, abs)
											})
										: h("div", { key: "soon", style: { color: C.muted, fontSize: "12px" } }, "这一屏还没做。")
				]);
			}

			// ── 设计资产（B1）────────────────────────────────────
			if (view === "assets") {
				const wsPath = (indexData && indexData.srWs) || (state.phase === "ready" ? state.data.srWs : "");
				return shell([
					head("设计资产"),
					h(NoticeBar, { key: "nt", notice: notice }),
					h(AssetsPanel, {
						key: "ap", data: indexData,
						onOpen: (abs) => handleOpen(null, abs),
						read: props.__readText ? (abs) => props.__readText(sessionId, abs) : null,
						onRefresh: props.__refreshIndex ? () => props.__refreshIndex(wsPath) : null,
						onPickDir: props.__pickDir || null,
						onImport: props.__importDocs ? (p, n) => props.__importDocs(wsPath, p, n) : null,
						onManual: props.__addManual ? (t, b, u) => props.__addManual(wsPath, t, b, u) : null,
						// ★ 收件箱：四种输入方式的统一入口（拍板 2026-09-28）
						onIntake: props.__intake ? (src) => props.__intake(Object.assign({}, src, { srWs: wsPath })) : null,
						intakeRefs: props.__intakeRefs && wsPath ? props.__intakeRefs(wsPath) : null
					})
				]);
			}

			// ── 其余一级视图（占位）──────────────────────────────
			if (view !== "dashboard") {
				const label = (NAV.filter((x) => x.id === view)[0] || {}).label || view;
				return shell([
					head(label),
					h("div", {
						key: "soon",
						style: { border: "1px dashed " + C.soft, borderRadius: "4px", padding: "30px", textAlign: "center", color: C.muted, fontSize: "12px" }
					}, "「" + label + "」还没做 —— 屏清单见 工作台界面清单.md")
				]);
			}

			const filtered = q ? d.features.filter((f) => f.topic.toLowerCase().indexOf(q.toLowerCase()) >= 0) : d.features;

			return shell([
				head("功能看板 · A1"),
				// ① 顶栏：锚点路径（来自 sr 配置）+ 搜索
				h("div", { key: "top", style: { display: "flex", gap: "8px", alignItems: "center", marginBottom: "12px", flexWrap: "wrap" } }, [
					h("span", {
						key: "p", title: d.srWs || "(未读到 sr 配置)",
						style: {
							fontSize: "11px", fontFamily: "monospace", color: C.muted,
							maxWidth: "360px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
						}
					}, "锚点 " + (d.srWs || "(相对路径兜底)")),
					h("input", {
						key: "q", value: q, placeholder: "搜索功能名…",
						onChange: (e) => setQ(e.target.value),
						style: {
							flex: "1 1 200px", maxWidth: "300px", fontSize: "12px", padding: "4px 8px",
							border: "1px solid " + C.soft, borderRadius: "4px", outline: "none", background: "#fff"
						}
					}),
					h("span", { key: "n", style: { fontSize: "11px", color: C.muted } },
						filtered.length + " / " + d.features.length + " 个功能"),
					// ★ 工单 16：看板级别的「刷新」——看板不订阅变更（只在功能里订阅），
					//   所以这个按钮是看板唯一的"重读一遍"入口，通道降级时照旧在。
					h("button", {
						key: "rf", type: "button", "data-refresh": "manual",
						onClick: () => onManualRefresh(),
						title: "重读工作区（看板 + 当前功能）",
						style: { font: "inherit", fontSize: "11px", padding: "3px 9px", border: "1px solid " + C.soft, background: "#fff", borderRadius: "4px", cursor: "pointer" }
					}, "刷新看板")
				]),
				// ② 打开结果提示（含失败时的通道诊断）
				h(NoticeBar, { key: "nt", notice: notice }),
				// ③ 风险条
				h(RiskBar, { key: "risk", features: d.features, attentionOf: attentionOf }),
				// ④ 功能卡
				h("div", { key: "grid", style: { display: "flex", flexWrap: "wrap", gap: "10px" } },
					filtered.length
						? filtered.map((f) => h(FeatureCard, {
							key: f.topic,
							feature: f,
							attention: attentionOf(f.topic),
							onOpen: handleOpen,
							// ★ 工单 23：卡的「详情 ›」进的是**第一个工作面**（头脑风暴），不是资料页签
							onDetail: (x) => { setDetailTopic(x.topic); setDtab(ENTRY_TAB); setView("detail"); },
							onAttention: (x) => { setDetailTopic(x.topic); setDtab("pipeline"); setView("detail"); }
						}))
						: [h("div", { key: "none", style: { color: C.muted, fontSize: "12px" } }, "没有匹配的功能。")]),
				// ⑤ 来源说明
				h("div", { key: "foot", style: { marginTop: "16px", fontSize: "11px", color: C.muted, lineHeight: 1.8 } }, [
					h("div", { key: "a" }, "锚点：sr 配置 " + (d.configFile || "?") + (d.pathNote ? " · " + d.pathNote : "")),
					h("div", { key: "b" }, "扫描：" + (d.srWs || SR_WS) + "\\features\\ → **" + d.counts.features + " 个功能**" +
					" · 配置表 " + d.counts.configs +
					(d.legacyLeft ? "　｜　旧结构还剩 " + d.legacyLeft + " 个文件（素材，确认后可删）" : "")),
					h("div", { key: "c" }, "状态派生自定稿头部 doc_type/status，工作台不另存状态；底部 📄 链接打开最终版。"),
					h("div", { key: "d" }, "索引会话：" + sessionSourceText(state.session) +
						"　cwd " + (cwd || "(未解析)") +
						(state.session && state.session.note && state.session.note.length
							? "　｜　" + state.session.note.join("；") : "")),
					// ★ 工单 16：自动刷新的**承诺边界**写在看板上（能看见的话术 = 面板的诚实口径）
					h("div", { key: "e" }, "自动刷新：进功能后订阅该功能的目录变更（宿主的目标级文件监视，" +
						"写入者不限 —— agent 工具、脚本、外部编辑器都算）；看板不订阅，用「刷新看板」或 F5。")
				])
			]);
		}

		// ════════════════════════════════════════════════════════════════
		// 五、插件
		// ════════════════════════════════════════════════════════════════

		/**
		 * ★ Cordis 要求**服务必须声明注入**；未注入的服务**访问即同步抛错**。
		 * 但反过来：把可选依赖写进 inject，一旦它没被提供，**整个插件就不激活（面板消失）**。
		 * 折中：核心服务（slots/remote）写进 inject 保证插件一定能装上；
		 * 可选依赖（sessions/workspaces/uiWorkspace）用 `ctx.get(name)` 取——返回 undefined 而不抛，
		 * 功能降级但插件照常工作。
		 */
		const inject = [
			"slots", "remote",
			"remote.workspaceFiles", "remote.session",
			"remote.agentPresets", "remote.commands", "remote.workspace",
			"remote.directoryPicker", "remote.fileUploads"
		];

		/** 安全取一个可选服务（可能为 undefined，不抛） */
		const svc = (ctx, name) => {
			try { return ctx.get(name); } catch (e) { return void 0; }
		};

		/** 把一次 Remote 调用的结果原样收成可显示对象（同步抛错也接住） */
		const safeCall = (name, fn) => {
			let p;
			try { p = Promise.resolve(fn()); }
			catch (e) {
				return Promise.resolve({ name: name, ok: false, error: { message: "同步抛错 " + String((e && e.message) || e) } });
			}
			return p.then(
				(r) => ({ name: name, ok: !!(r && r.ok), value: r && r.value, error: r && r.error }),
				(e) => ({ name: name, ok: false, error: { message: String((e && e.message) || e) } })
			);
		};

		/**
		 * ★ 插件配置是 apply 的**第二个参数**（cordis 核心：`runtime.callback(this.ctx, this.config)`）。
		 *   从 ctx 上取 config 会抛 `cannot get property "config" without inject`——config 不是服务。
		 */
		function apply(ctx, config) {
			const read = (sid, path, range, signal) => ctx.remote.workspaceFiles.read(sid, path, range, signal);
			// 可选配置：sr 配置文件的路径。不给就用会话相对的默认候选。
			const cfg = config || {};
			const configPath = cfg.configPath || cfg.srConfigPath || "";
			/** DSH 工作区根：会话要建在它下面，才会落进左侧对应的分组而不是「未分组」 */
			const projectRoot = cfg.projectRoot || "";
			const loader = (sid, cwd, signal, extraPaths) => loadDashboard(ctx, read, sid, cwd, configPath, signal, extraPaths);

			/**
			 * ★ 工单 16 · **版本袋**：给 `read` 包一层，凡成功读到文件就记下
			 *   `绝对路径 → version`。这一袋就是"屏幕上那份内容到底读的是哪一版"的凭据：
			 *   版本指纹由它算、"同一份内容不再重读"（自激防护）拿它比对。
			 * ★ 收版本是**组合根**的事（载入层只吃 port、不认识 version），所以包在这里，
			 *   而不是改四个加载器的签名。
			 */
			const readWith = (bag) => (bag
				? (sid, p, range, signal) => read(sid, p, range, signal).then((r) => {
					if (r && r.ok === true && r.value && typeof r.value.version === "string" && r.value.version !== "") {
						bag[String(r.value.absolutePath || p)] = r.value.version;
					}
					return r;
				})
				: read);

			const ledgerLoader = (sid, root, skillsRoot, signal, bag) =>
				loadLedger(ctx, readWith(bag), sid, root, skillsRoot, signal);
			const interfaceLoader = (sid, absPath, signal, bag) =>
				loadInterface(readWith(bag), sid, absPath, signal);
			/** 定稿工作面（§6.2）：收**绝对路径**（= 功能的 openPath） */
			const finalLoader = (sid, absPath, signal, bag) => loadFinal(readWith(bag), sid, absPath, signal);
			/**
			 * ★ 工单 12 · 功能详情：产物清单（按桶）+ 三阶段 + 定稿有效性 + V 校验清单。
			 * 收**功能根目录**（`features\<主题>\`）—— 功能 = 目录，所以不再需要 topicOf 过滤。
			 * 这里只把 ctx 包成端口（`portOf`），实现全在 `src/load/feature.ts` + `src/pure/artifacts.ts`。
			 * ★ 工单 16：`portOf` 的 `read` 换成 `readWith(bag)` —— 端口照旧只认 `{listDir, readText}`，
			 *   版本收集发生在它下面一层。
			 */
			const detailLoader = (sid, root, signal, bag) =>
				loadFeatureDetail(portOf(ctx, sid, readWith(bag)), { root: root, signal: signal });
			/**
			 * ★ 工单 23 · 头脑风暴工作面：把产物清单里 `analysis` 组交给加载器（只读那一个桶），
			 *   出口判据那句话也是搬 `detail.stage`。这里只做编排，判据全在 `src/load/brainstorm.ts`
			 *   + `src/pure/analysisdoc.ts`（有测试）。
			 */
			const brainstormLoader = (sid, opts, signal, bag) =>
				loadBrainstorm(portOf(ctx, sid, readWith(bag)), Object.assign({}, opts, { signal: signal }));
			/**
			 * ★ 工单 24 · 文档生成工作面：把 `gdd\` 与 `evidence\` 的产物清单交给加载器（只读那两个桶），
			 *   配置表**存在性**用看板按主题挂上来的真实文件名（既有通道，不重新列配置目录）。
			 *   判据全在 `src/load/draft.ts` + `src/pure/drafttree.ts` / `draftstep.ts`（有测试）。
			 */
			const draftLoader = (sid, opts, signal, bag) =>
				loadDraftWorkface(portOf(ctx, sid, readWith(bag)), Object.assign({}, opts, { signal: signal }));
			const indexLoader = (sid, srWs, signal) => loadIndex(read, sid, srWs, signal);
			/** 按绝对路径读文本（阅读器用） */
			const readTextFile = (sid, abs) => readAllText(read, sid, abs, void 0, 4000);

			// ════════════════════════════════════════════════════════════════
			// ★ 工单 16 · 给面板用的两条**官方通道**（组合根是唯一知道 ctx 的地方）
			//   · `stat`     —— 版本指纹 / 切回面板与低频轮询时的核对（正确性底线）
			//   · `changes`  —— 变更订阅（自动刷新的增强）
			// ════════════════════════════════════════════════════════════════

			/** `remote.workspaceFiles` 命名空间（未注入/宿主没提供时返回 null，不抛） */
			const workspaceFilesNs = () => {
				try {
					const ns = ctx.remote && ctx.remote.workspaceFiles;
					return ns || null;
				} catch (e) { return null; }
			};

			/**
			 * 批量 `stat`：一条 `remote.workspaceFiles.stat(sessionId, path, signal)`
			 * → `{absolutePath, version, bytes?}`（`version` 是**不透明**新鲜度串，只比对不解析）。
			 *
			 * 用来做两件事：① 版本指纹的**完整**凭据（清单里每个文件都要有版本）；
			 * ② 切回面板 / 切功能 / 切页签 / 低频轮询时的核对 —— 这条**不依赖帧通道**，
			 * 所以它是"我读到的是不是最新"的正确性底线。
			 *
			 * ★ 单个文件失败（刚好被删 / 读不到）**不拖垮整批**：它不进结果表，
			 *   指纹那边会如实反映"这个文件拿不到版本"（`fingerprintOf` 的 `missing`）。
			 */
			const statMany = async (sid, paths, signal) => {
				const out = {};
				const ns = workspaceFilesNs();
				if (!ns || typeof ns.stat !== "function") return out;
				for (const p of (paths || [])) {
					if (signal && signal.aborted) break;
					try {
						const r = await ns.stat(sid, p, signal);
						if (r && r.ok === true && r.value && typeof r.value.version === "string" && r.value.version !== "") {
							out[String(r.value.absolutePath || p)] = r.value.version;
						}
					} catch (e) { /* 单个失败不算整批失败 */ }
				}
				return out;
			};

			/**
			 * ═══ 变更订阅：一个目标一条流（官方 `changes`）═══
			 *
			 * `remote.workspaceFiles.changes(sessionId, path, signal)` → `AsyncIterable`：
			 *   `{kind:'ready'}` / `{kind:'change', change:{absolutePath, version}}`
			 *   / `{kind:'change', change:{absolutePath, absent:true}}`。
			 *
			 * ★ 0.2.0 的实测口径（`_16-channel-evidence.txt`，宿主级探针跑的就是装在这台机器上的官方实现）：
			 *   宿主侧 `WorkspaceChangeFeed.follow()` → `ctx.fs.watch()` 是**目标定向的 OS 监视**
			 *   （`dsh-fs-local` 用 chokidar，`depth: 0`）⇒
			 *     · **任何写入者都会发帧**（tool-fs 的 write/edit、会话里的 `pwsh`、外部编辑器保存、原子替换）；
			 *     · 覆盖率 = 被订阅目标的**直接子项**（两层深的写入不发帧）⇒ 目录必须**逐个**订阅；
			 *     · 一次原子替换会产生两条帧（目录一条、文件一条）⇒ 上层必须去抖合批。
			 * ★ 失败**不吞**（四种都如实回调，界面据此降级成"用刷新按钮"）：
			 *   ① 命名空间/方法不可用 ② 调用同步抛错或没返回可迭代 ③ 迭代中报错 ④ 流被宿主结束。
			 *
			 * @returns `{ dispose }` —— 面板离开功能/卸载时调它（外加 `signal.abort()`，双保险）
			 */
			const watchTargets = (sid, targets, onEvent, signal) => {
				const iters = [];
				const ns = workspaceFilesNs();
				if (!ns || typeof ns.changes !== "function") {
					onEvent({ kind: "down", reason: "remote.workspaceFiles.changes 不可用（没注入或宿主没提供）" });
					return { dispose: () => {} };
				}
				for (const target of (targets || []).slice()) {
					const run = async () => {
						let iter = null;
						try {
							iter = ns.changes(sid, target, signal);
							if (!iter || typeof iter[Symbol.asyncIterator] !== "function") {
								onEvent({ kind: "down", reason: "changes 没有返回可迭代对象（宿主版本可能不匹配）" });
								return;
							}
						} catch (e) {
							onEvent({ kind: "down", reason: "调 changes 就抛错：" + String((e && e.message) || e) });
							return;
						}
						iters.push(iter);
						try {
							for await (const frame of iter) {
								if (signal && signal.aborted) break;
								onEvent({ kind: "frame", target: target, frame: frame });
							}
							if (!signal || !signal.aborted) onEvent({ kind: "end", target: target });
						} catch (e) {
							if (signal && signal.aborted) return;
							const err = (e && (e.code || e.message)) || e;
							onEvent({ kind: "error", target: target, error: String(err) });
						}
					};
					void run();
				}
				return {
					dispose: () => {
						for (const it of iters) {
							try { if (it && typeof it.return === "function") void it.return(); } catch (e) { /* 已经关了 */ }
						}
					}
				};
			};

			/**
			 * 低层：在 `root` 这个目录上**建一条带可识别标题的会话**（工作区 → 会话 → 改名）。
			 * ★ 顺序里踩过的坑只留一处（开发笔记坑 8）：`session.create` 的 `workspaceId` 与 `cwd`
			 *   **互斥** —— 拿不到 workspaceId 时才退回给 cwd（会话会落进「未分组」，但可用）。
			 */
			const createSessionAt = async (root, title, preset) => {
				const note = [];
				const ws = await probe.ensureWorkspace(root);
				const wsId = ws.ok && ws.value && ws.value.workspace ? ws.value.workspace.workspaceId : "";
				if (!ws.ok) note.push("按路径登记工作区失败（改用 cwd 建会话）：" + humanError(ws));
				const cr = await probe.create(wsId, root, preset || "sr-workbench");
				if (!cr.ok) return { sid: "", error: humanError(cr), outcome: cr, note: note };
				const sid = idText(cr.value && cr.value.sessionId);
				if (!sid) return { sid: "", error: "会话已创建，但拿不到 sessionId。", outcome: cr, note: note };
				if (title) {
					const rn = await probe.renameSession(sid, title);
					if (!rn.ok) note.push("会话建好了但改名失败（下次按缓存认回来）：" + humanError(rn));
				}
				// ★ 建完补一次「并进客户端 store」（官方那两刀）——不补的话侧边栏要按 F5 才看得见
				//   （2026-09-30 实测缺陷；判定与理由见 `syncSidebarStores` 的注释）。
				const sync = await syncSidebarStores(root);
				for (const n of sync.notes) note.push(n);
				return { sid: sid, error: "", outcome: cr, note: note, title: title || "" };
			};

			/**
			 * ═══ 该功能的**专属工作会话**（工单 15 · 规格「三层会话」）═══
			 *
			 * 与索引会话**分工不同、因此分开**：
			 *   · 索引会话：cwd = SR workspace 根，只负责扫描看板（`list` 限定在会话工作区内）；
			 *   · 工作会话：cwd = `features\<主题>\`（功能专属工作区），**面板发出的指令都发给它**
			 *     —— 这样"干活"不占用户自己的对话（用户故事 23）。
			 *
			 * 认领顺序（三家都不是"每次刷新新建一条"，用户故事 27）：
			 *   内存（同一次页面会话内）→ localStorage 缓存 → **标题认领**（`策划工作台·工作（主题）`）
			 *   → 都没有才新建（建完一定 `rename`，下次就靠标题认回来）。
			 * 判定规则全在纯函数 `pickWorkSession` 里（含"绝不认用户的会话"这条纪律）。
			 */
			const ensureFeatureWorkSession = async (root, rowsIn, opts) => {
				const o = opts || {};
				const note = [];
				const title = workTitleFor(root);
				const key = workKey("sr-workbench", root);
				// ★ 归档集（侧边栏看不见的会话**不算可用**）—— 认了它 = 指令发进去、界面什么也没有
				//   （2026-09-30 实测缺陷；取值与降级见 `sidebarArchived`）。
				const arch = sidebarArchived();
				if (arch.ids === null) note.push(NO_ARCHIVE_INFO_NOTE + "（" + arch.reason + "）");
				// 两个"上次用的那条"（内存 / localStorage）里，只要有一条已被归档，就都不算了：
				// 归档 ≠ 删除，它还在列表里、还能被 prompt，但用户**看不见**它 —— 那正是本缺陷的形状。
				const staleMemory = o.fresh ? "" : (WORK_SESSIONS.get(key) || "");
				const staleCache = o.fresh ? "" : workCacheGet(workCacheRaw(), root);
				if (isArchivedId(arch.ids, staleMemory) || isArchivedId(arch.ids, staleCache)) {
					WORK_SESSIONS.delete(key);
					workCacheSet(root, null);
					note.push(ARCHIVED_CACHED_NOTE);
				}
				if (o.fresh) {
					WORK_SESSIONS.delete(key);
					workCacheSet(root, null);
				} else if (staleMemory !== "" && !isArchivedId(arch.ids, staleMemory)) {
					return { ok: true, sid: staleMemory, source: "memory", title: title, root: root, running: false, note: note };
				}
				// 候选：store 快照先（带着 cwd / running）——
				// ★ 认不着时再补一次 `remote.session.list`：store 行的 `title` 要等 host 投影下来
				//   （`SessionSummary.title` 是 "absent until the host projects one"），
				//   而列表里的标题在 `projections.values.title`。少了这一步，"清掉缓存"之后
				//   会看不见自己起过名的会话 ⇒ 每次刷新又新建一条（用户故事 27）。
				//   ★ 但列表**不按归档过滤**（`SessionListRequest` 只有可选 cursor）——所以两条
				//   通道的候选都要过归档这一关（`pickWorkSession` 的 `archived` 参数）。
				let rows = (rowsIn || []).filter((r) => r && r.id && r.id !== o.exclude);
				const cached = isArchivedId(arch.ids, staleCache) ? "" : staleCache;
				let hit = pickWorkSession(rows, root, { cachedId: cached, archived: arch.ids });
				if (!hit) {
					const L = await probe.listSessions(o.signal);
					if (L.ok) {
						rows = mergeRows(rows, rowsFromList(L.value).filter((r) => r.id !== o.exclude));
						hit = pickWorkSession(rows, root, { cachedId: cached, archived: arch.ids });
					} else if (rows.length === 0) {
						note.push("会话列表读取失败：" + humanError(L));
					}
				}
				if (hit) {
					setWorkSession(key, hit.id);
					workCacheSet(root, hit.id);
					return {
						ok: true, sid: hit.id, source: hit.source, root: root,
						title: titleOf(hit.row) || title, running: !!hit.row.running, row: hit.row, note: note
					};
				}
				const made = await createSessionAt(root, title, "sr-workbench");
				for (const n of made.note) note.push(n);
				if (made.error) return { ok: false, sid: "", error: made.error, outcome: made.outcome, root: root, note: note };
				setWorkSession(key, made.sid);
				workCacheSet(root, made.sid);
				return { ok: true, sid: made.sid, source: "created", root: root, title: made.title, running: false, note: note };
			};

			/**
			 * 在（复用的）工作会话里跑一条指令。
			 * ★ 所有"改文件"的动作都走这里 —— 工作台在 Remote 层没有写能力，
			 *   只能把意图交给 agent，由它用工具去写。
			 */
			/**
			 * 确保有一个可用的「工作会话」（按 preset + 主题缓存复用）。
			 * ★ 建会话用 workspaceId，**不要再给 cwd** —— host 明确拒绝两者同时给。
			 * ★ 这一条服务于**不属于任何功能**的入口（资产索引刷新 / 收件箱导入），
			 *   所以它的 cwd 是 sr 工作区根；**功能里的"就地改这条"走
			 *   `ensureFeatureWorkSession`**（cwd = 功能目录，工单 15）。
			 */
			const ensureWorkSession = async (srWs) => {
				try {
					const info = workspaceInfo();
					const wsId = info && info.id ? info.id : "";
					// 绝对路径兜底：拿不到工作区 id 时用路径建（影响分组归属，不影响可用性）
					const key = workKey("sr-workbench", wsId || srWs || "__assets__");
					const mem = WORK_SESSIONS.get(key) || "";
					// ★ 归档集：内存里记的那条若已被归档（侧边栏看不见）⇒ 不算可用，另建一条
					//   （这条路径也会发指令；见 `sidebarArchived`）
					if (mem && !isArchivedId(sidebarArchived().ids, mem)) return { sid: mem, error: "" };
					if (mem) WORK_SESSIONS.delete(key);
					if (wsId) {
						// ★ 给了工作区 id 就**不能**再给 cwd（互斥）；cwd 由工作区自己的 path 决定
						const cr = await probe.create(wsId, "", "sr-workbench");
						if (!cr.ok) return { sid: "", error: "无法创建工作会话：" + humanError(cr) };
						const sid = idText(cr.value && cr.value.sessionId);
						if (!sid) return { sid: "", error: "会话已创建，但拿不到 sessionId。" };
						setWorkSession(key, sid);
						// ★ 建完补一次「并进客户端 store」（侧边栏立刻看得见；见 syncSidebarStores）
						await syncSidebarStores((info && info.path) || srWs || "");
						return { sid: sid, error: "" };
					}
					const made = await createSessionAt(srWs || "", "", "sr-workbench");
					if (made.error) return { sid: "", error: made.error };
					setWorkSession(key, made.sid);
					return { sid: made.sid, error: "" };
				} catch (e) {
					return { sid: "", error: "建会话失败：" + String((e && e.message) || e) };
				}
			};

			/**
			 * ═══ 面板唯一的「发进该功能的专属工作会话」链路（工单 15 立的，工单 23 复用的就是这一条）═══
			 *
			 *   认领 → （会话没了就）自愈重建 → **重发一次**；失败一律给「可读错误 + 下一步」。
			 *   `fixRunner`（就地改这条）与 `brainstormRunner`（头脑风暴四入口）**共用这一段** ——
			 *   两条路发出的东西除正文外一模一样（同一会话、同一 mode、同一自愈、同一错误话术），
			 *   也**不会各自长出一个发送通道**（工单 23 的硬要求）。
			 *
			 * @param root 功能根（cwd = `features\<主题>\`）
			 * @param text 要发的正文（调用方用纯函数组装，卡上显示的就是它）
			 * @param c    `{ rows }` 会话候选 · `{ signal }`
			 * @returns `{ ok, sid, sent, healed, queued, target, message?, next?, note? }`
			 */
			const sendFeatureInstruction = async (root, text, c) => {
				const cc = c || {};
				const targetOf = (got) => ({
					root: root, title: (got && got.title) || workTitleFor(root),
					source: (got && got.source) || "", running: !!(got && got.running)
				});
				const attempt = async (fresh, exclude) => {
					const got = await ensureFeatureWorkSession(root, cc.rows, {
						fresh: fresh, exclude: exclude, signal: cc.signal
					});
					if (!got.ok) return { got: got, r: null };
					const r = await probe.prompt(got.sid, text);
					return { got: got, r: r };
				};

				let a = await attempt(false, "");
				// ★ 自愈：那条会话**已经不在**（session/not-found）→ 清缓存、重建一条、**重发一次**
				let healed = false;
				if (a.got && a.got.ok && a.r && a.r.ok !== true && isSessionGone(a.r)) {
					a = await attempt(true, a.got.sid);
					healed = true;
				}
				if (!a.got.ok) {
					const f = explainSendFailure(a.got.outcome || { message: a.got.error });
					return {
						ok: false, sid: "", sent: text, target: targetOf(a.got), healed: healed,
						message: f.message, next: f.next, note: f.message + "　" + f.next
					};
				}
				if (!a.r || a.r.ok !== true) {
					const f = explainSendFailure(a.r);
					return {
						ok: false, sid: a.got.sid, sent: text, target: targetOf(a.got), healed: healed,
						message: f.message, next: f.next, note: f.message + "　" + f.next
					};
				}
				return {
					ok: true, sid: a.got.sid, sent: text, healed: healed,
					queued: !!a.got.running, target: targetOf(a.got),
					// ★ 建完的降级说明（例如"取不到官方 workspaces 客户端服务 ⇒ 这次要刷新页面才看得见"）
					//   一并显示 —— 缺陷修复的诚实口径：**不许装成"侧边栏已经刷新了"**。
					note: "已交给工作会话。" + (a.got.running ? "它正在跑别的活，这条指令排在队列里。" : "") +
						(a.got.note && a.got.note.length ? "　" + a.got.note.join("；") : "")
				};
			};

			/**
			 * 「就地改这条」（设计 §6.3 条目引用 + §6.4.1 影响范围）。
			 *
			 * ★ 面板不写文件 —— 它只把「改哪儿、改成什么」说到 agent 不用再找的程度：
			 *   带**条目引用**（§5 UI-M1 UE3）+ **现状原文**（行号会漂，原文不会）
			 *   + **面板扫出的结构引用**（让 agent 少一步搜索）。
			 * ★ 语义影响仍然交给 sr-gdd-fix 的 D11 影响面闭合 —— 面板不越界（文本里写着）。
			 * ★ 文本由 `buildFixInstruction`（`src/pure/instruction.ts`）拼 —— 与定位卡上
			 *   **给用户看的那段逐字相同**（工单 14：先看后发，看到的就是要发的）。
			 * ★ 发到**该功能的专属工作会话**（cwd = `features\<主题>\`，工单 15）——
			 *   发送本身走 `sendFeatureInstruction`（工单 23 抽出的那一段，两条路共用）。
			 *
			 * @param srWs  SR 工作区根（拿不到功能根时的最后兜底）
			 * @param req   `{ path, ref, before, intent, impact }`
			 * @param extra `{ root }` 功能根（详情页给的更权威）· `{ rows }` 会话候选
			 * @returns `{ ok, sid, sent, healed, queued, target, message?, next?, note? }`
			 */
			const fixRunner = async (srWs, req, extra) => {
				const c = extra || {};
				if (!req || !req.path || !req.ref) return { ok: false, note: "缺少定稿路径或条目引用。" };
				const text = buildFixInstruction({
					path: req.path, ref: req.ref, before: req.before, intent: req.intent, impact: req.impact
				});
				// 功能根：详情页给的更权威；否则从 `features\<主题>\gdd\…` 反推
				const root = c.root || featureRootOf(req.path) || srWs || "";
				if (!root) {
					return {
						ok: false, sent: text,
						message: "算不出这条定稿属于哪个功能目录。",
						next: "从「功能详情 › 定稿」页签进来再发一次（工作会话要建在 `features\\<主题>\\` 下）。",
						note: "算不出这条定稿属于哪个功能目录。"
					};
				}
				return sendFeatureInstruction(root, text, c);
			};

			/**
			 * ★ 工单 23 · 头脑风暴四入口的出口：**复用**上面那条链路，只是正文由四入口各自的
			 *   组装器给出（`INTAKE.buildBrainstormInstruction`，与卡上预览逐字相同）。
			 *
			 * ★ 缺前提**不发**（也不静默）：把 `blocked` + `next` 原样回给界面 —— 界面显示的
			 *   与这里判定的是同一份（判定只在纯函数里）。
			 * ★ 指令正文由界面传进来（`input.text`）—— 这样"卡上看到的 = 发出去的"是**同一段字符串**，
			 *   不存在"再组装一次、拼出第二份"的可能（工单 15 的验收口径，这里照做）。
			 *
			 * @returns `{ ok, sid, sent, healed, queued, target, message?, next?, note? }` 或
			 *          `{ ok:false, blocked, next, sent:"" }`（缺前提）
			 */
			const brainstormRunner = async (srWs, kind, input, extra) => {
				const c = extra || {};
				const inp = input || {};
				const root = String(inp.root || c.root || "").replace(/\\+$/, "");
				if (!root) {
					return {
						ok: false, sent: "",
						blocked: "拿不到这个功能的功能目录（`features\\<主题>\\`）。",
						next: "从「功能详情 › 头脑风暴」进来再发一次 —— 指令要发给该功能的专属工作会话（cwd = 功能目录）。"
					};
				}
				// 正文以界面传的那一段为准（逐字）；万一是别的调用方，退回自己组装一次
				let text = String(inp.text || "");
				if (text === "") {
					const built = INTAKE.buildBrainstormInstruction(kind, Object.assign({}, inp, { root: root }));
					if (built.blocked) return { ok: false, sent: "", blocked: built.blocked, next: built.next || "" };
					text = built.instruction;
				}
				return sendFeatureInstruction(root, text, c);
			};

			/**
			 * ★ 工单 24 · 文档生成三个动作的出口：**复用** `sendFeatureInstruction`（工单 15 立的、
			 *   工单 23 抽出的那一条），只是正文由 `buildDraftInstruction` 给出（与卡上预览逐字相同）。
			 *
			 * ★ 与 `brainstormRunner` 的**唯一区别**：这里**不重算正文** —— 正文以界面传进来的那一段为准
			 *   （`input.text`）；只有"别的调用方直接调"时才退回自己组装一次。缺前提（`built.blocked`）
			 *   由界面拦下并显示，这一层不发。
			 *
			 * @returns `{ ok, sid, sent, healed, queued, target, message?, next?, note? }`
			 */
			const draftRunner = async (srWs, action, input, extra) => {
				const c = extra || {};
				const inp = input || {};
				const root = String(inp.root || c.root || "").replace(/\\+$/, "");
				if (!root) {
					return {
						ok: false, sent: "",
						blocked: "拿不到这个功能的功能目录（`features\\<主题>\\`）。",
						next: "从「功能详情 › 文档生成」进来再发一次 —— 指令要发给该功能的专属工作会话（cwd = 功能目录）。"
					};
				}
				const text = String(inp.text || "");
				if (text === "") {
					return { ok: false, sent: "", blocked: "这条指令是空的（界面没有把组装好的正文传过来）。", next: "刷新页面再试一次；仍失败就把这条发给开发者。" };
				}
				return sendFeatureInstruction(root, text, c);
			};

			const runInWorkSession = async (instruction) => {
				try {
					const info = workspaceInfo();
					const key = workKey("sr-workbench", "__assets__");
					let sid = WORK_SESSIONS.get(key) || "";
					let syncNotes = [];
					// ★ 归档集：内存里记的那条若已被归档（侧边栏看不见）⇒ 不算可用，另建一条
					//   （这条路径会发指令；同 `ensureFeatureWorkSession` 的口径）
					if (sid && isArchivedId(sidebarArchived().ids, sid)) {
						WORK_SESSIONS.delete(key);
						sid = "";
					}
					if (!sid) {
						const cr = info && info.id
							? await probe.create(info.id, "", "sr-workbench")
							: await probe.create("", "", "sr-workbench");
						if (!cr.ok) return "无法创建工作会话：" + humanError(cr);
						sid = idText(cr.value && cr.value.sessionId);
						if (!sid) return "会话已创建，但拿不到 sessionId。";
						setWorkSession(key, sid);
						// ★ 建完补一次「并进客户端 store」（侧边栏立刻看得见；见 syncSidebarStores）
						const sync = await syncSidebarStores((info && info.path) || "");
						syncNotes = sync.notes;
					}
					const r = await probe.prompt(sid, instruction);
					if (!r.ok) return "指令发送失败：" + humanError(r);
					return "已交给工作会话。跑完后回本页重进即可看到新索引。" +
						(syncNotes.length ? "　" + syncNotes.join("；") : "");
				} catch (e) {
					return "失败：" + String((e && e.message) || e);
				}
			};
			const REFRESH_LINE = (win) =>
				"请在 " + win + " 下运行 `python scripts/refresh_asset_index.py`，刷新 design-asset-index.json，" +
				"并报告：新增了哪些资产、移除了哪些、哪些被新版本取代。";

			/** 刷新资产索引 */
			const refreshIndex = async (srWs) => {
				if (!srWs) return "拿不到工作区路径，无法刷新。";
				return runInWorkSession(REFRESH_LINE(String(srWs).replace(/\//g, "\\")));
			};

			/** 方式 3 · 导入旧文档（落 inbox/imported/，只登记不提升） */
			const importOldDocs = async (srWs, srcPath, note) => {
				if (!srWs) return "拿不到工作区路径。";
				if (!srcPath) return "没有选择目录。";
				const win = String(srWs).replace(/\//g, "\\");
				const line = "【导入旧文档】把 " + srcPath + " 作为参考资料导入工作区：\n" +
					"1) 在 " + win + "\\inbox\\imported\\ 下建一个以该目录名命名的子目录，把其中的文档复制进去（只复制文档，跳过图片/视频等大文件；不转换格式、不改内容）；\n" +
					"2) 运行 `python scripts/refresh_asset_index.py` 重新生成索引；\n" +
					"3) 报告导入了哪些文件、索引新增了几条。\n" +
					"注意：导入件只登记为 inbox / needs_review，**不要**提升为正式资产，也**不要**改动任何 sr skill。" +
					(note ? "\n补充说明：" + note : "");
				return runInWorkSession(line);
			};

			/** 方式 4 · 人工补充（落 inbox/manual/，只登记不提升） */
			const addManualNote = async (srWs, title, body, upstream) => {
				if (!srWs) return "拿不到工作区路径。";
				if (!title || !body) return "标题与正文都要填。";
				const win = String(srWs).replace(/\//g, "\\");
				const safe = String(title).replace(/[\\/:*?"<>|]/g, "_").slice(0, 60);
				const line = "【人工补充】在 " + win + "\\inbox\\manual\\ 下新建 " + safe + ".md，内容如下：\n" +
					"---\ntitle: " + String(title) + "\nsource: human" +
					(upstream ? "\nupstream_asset: " + upstream : "") + "\n---\n\n" + String(body) + "\n\n" +
					"然后运行 `python scripts/refresh_asset_index.py` 重新生成索引，并报告新增条目。" +
					"\n注意：只登记为 inbox / needs_review，**不要**提升为正式资产，也**不要**改动任何 sr skill。";
				return runInWorkSession(line);
			};

			/**
			 * 上传一个文件到**当前会话**（拿不到本机路径时的退路 —— **只留收据，内容读不到**）。
			 * ★ 返回的 attachmentId 是不透明 id，**没有宿主路径**（`fileHostPath` 只给可信同进程消费方）。
			 *   所以上传件 agent 读不到内容：这里**不把它挂进 prompt 的 content**，
			 *   只在指令里写明"收到过、读不到、需要就向我要路径"（见 intakeByKind 第 2 步）。
			 */
			const uploadForSession = async (sid, f) => {
				const bytes = await readFileBytes(f, 64 * 1024 * 1024);
				const r = await safeCall("fileUploads.upload", () => ctx.remote.fileUploads.upload(sid, {
					data: bytesToBase64(bytes),
					name: String(f.name || "upload.bin")
				}));
				if (!r.ok) return { name: String(f.name || ""), error: humanError(r) };
				const file = (r.value && (r.value.file || r.value)) || {};
				return { name: file.name || String(f.name || ""), attachmentId: file.attachmentId, bytes: file.bytes };
			};

			/** 素材数组里"要 agent 去读的路径"有多少条 */
			const pathRefsOf = (rows) => (rows || []).filter((m) => m && (m.kind === "file" || m.kind === "dir")).length;

			/**
			 * ★ 收件箱的唯一出口：把四种输入方式组装好的指令发进工作会话。
			 *   组装逻辑在 `lib/intake-parse.js`（同一份代码有离线回归 test-intake.mjs）。
			 *   这里只做三件事：校验前置 → 处理拿不到路径的文件 → 发指令。
			 */
			const intakeByKind = async (src) => {
				const input = src || {};
				if (!contract) return { ok: false, note: "收件箱逻辑没加载上（intake-parse.js）。" };
				const srWs = (src && src.srWs) || "";
				if (!srWs) return { ok: false, note: "拿不到 sr 工作区路径（工作台锚点配置读不到）。" };

				// 1) 拿不到本机路径的文件 → 上传到工作会话（与下面用的是同一个会话）
				const uploads = [];
				const upErr = [];
				const pathFiles = (input.files || []).filter((f) => f.fullPath && !f.err);
				const noPathFiles = (input.files || []).filter((f) => !f.fullPath && !f.err);
				let sid = null;
				if (noPathFiles.length > 0) {
					const got = await ensureWorkSession(srWs);
					if (got.error) return { ok: false, note: got.error };
					sid = got.sid;
					for (const f of noPathFiles) {
						const u = await uploadForSession(sid, f.orig || { name: f.name, size: f.size });
						if (u.attachmentId) uploads.push(u); else upErr.push(u.name + "（" + u.error + "）");
					}
				}

				// 2) 组装指令（路径入参 / 备注 / 主题）
				const rawTexts = (input.materials || []).filter((m) => m.kind === "text").map((m) => m.text);
				const inline = (input.files || []).filter((f) => f.isText && !f.err)
					.map((f) => "【文件：" + f.name + "】\n" + String(f.text || "").slice(0, INLINE_TEXT_CAP));
				const note = [String(input.note || "").trim()].concat(inline).filter((x) => x !== "").join("\n\n");
				const materialPaths = (input.materials || [])
					.concat(pathFiles.map((f) => ({ kind: "file", path: f.fullPath })));
				const built = contract.buildInstruction(input.kind, {
					materials: materialPaths,
					note: note,
					title: input.topic,
					upstream: input.upstream,
					srWs: srWs
				});
				if (built.blocked) return { ok: false, note: built.blocked };
				let instruction = built.instruction;
				if (inline.length > 0) instruction += "\n\n以下是随指令内联的文件内容（浏览器已读出，不必再读盘）：\n" + inline.join("\n\n");
				if (rawTexts.length > 0 && pathRefsOf(materialPaths) === 0) instruction += "\n\n我在输入框里写的原文：\n" + rawTexts.join("\n\n");
				if (uploads.length > 0) instruction += "\n\n另：本次随消息收到 " + uploads.length + " 个文件（会话附件：" + uploads.map((u) => u.name).join("、") + "）。\n" +
					"**这些文件没有可用路径，你读不到它们的内容** —— 不要假装读过。若这个文件对本次任务必要，请告诉我要它做什么、并请我补一个本机绝对路径。";
				if (upErr.length > 0) instruction += "\n注意：这些文件上传失败，本次没有带上：" + upErr.join("、") + "。";

				// 3) 发出（不带 file block —— 上传件没有宿主路径，agent 读不到内容）
				if (sid === null) {
					const got = await ensureWorkSession(srWs);
					if (got.error) return { ok: false, note: got.error };
					sid = got.sid;
				}
				const sent = await probe.prompt(sid, instruction);
				if (!sent.ok) return { ok: false, note: "指令发送失败：" + humanError(sent) };
				const warn = uploads.length > 0
					? "　⚠ 其中 " + uploads.length + " 个文件没有本机路径，agent 读不到内容（已如实写在指令里）；要用它们请补一个绝对路径。"
					: "";
				return {
					ok: true, sid: sid, kind: input.kind,
					note: "已交给工作会话" + (sid ? "（" + String(sid).slice(0, 8) + "…）" : "") + "。" +
						"它在那个会话里跑，跑完回本页重进就能看到；会话里有决策门时，进度与提问都在那儿。" + warn
				};
			};

			/**
			 * 「跑这一趟之后去哪儿看产物」——面板里的常驻跳转。
			 * ★ 只给路径，不假装知道跑没跑完（工作台读不到会话内部状态就如实说）。
			 */
			const intakeRefs = (srWs) => {
				if (!srWs) return [];
				const abs = String(srWs).replace(/\//g, "\\").replace(/\\+$/, "");
				return [
					{ label: "决策记录目录：" + abs + "\\decisions", abs: abs + "\\decisions" },
					{ label: "分析产出目录：" + abs + "\\analysis", abs: abs + "\\analysis" },
					{ label: "收集箱：" + abs + "\\inbox", abs: abs + "\\inbox" }
				];
			};

			/**
			 * 用系统默认程序打开一个工作区文件。
			 * ★ host 的 openWorkspacePath(request, signal) 会调 signal.throwIfAborted()，
			 *   signal 是**必传**的；不给会抛 TypeError。
			 * request 不带 sessionId，故传绝对路径。
			 */
			/**
			 * 直接调 host 的 openWorkspacePath —— **不加超时**，由调用方统一包超时。
			 * ★ host 的 openWorkspacePath(request, signal) 会调 signal.throwIfAborted()，
			 *   signal 是**必传**的；不给会抛 TypeError。
			 * request 不带 sessionId，故传绝对路径。
			 */
			const remoteOpen = (req, label) => {
				// ★ 访问 ctx.remote.session 本身就可能同步抛错（未注入）——必须包起来
				let sessionNs;
				try { sessionNs = ctx.remote && ctx.remote.session; }
				catch (e) {
					return Promise.reject(new Error(
						label + "：remote.session 未注入（" + String((e && e.message) || e) + "）"
					));
				}
				if (!sessionNs || typeof sessionNs.openWorkspacePath !== "function") {
					return Promise.reject(new Error(
						label + "：remote.session.openWorkspacePath 不可用 · 可用命名空间：" +
						Object.keys(ctx.remote || {}).join(", ")
					));
				}
				const ac = new AbortController();
				return Promise.resolve(sessionNs.openWorkspacePath(req, ac.signal)).then((r) => {
					if (!r || r.ok !== true) {
						const e = r && r.error;
						throw new Error(label + "：" + ((e && (e.message || e.code)) || "返回失败"));
					}
					return true;
				});
			};

			/**
			 * 诊断：打开失败时把通道实况探出来（不再盲猜）。
			 * 返回可读文本，直接显示在面板上。
			 */
			const diagnose = async () => {
				const L = [];
				try { L.push("remote 命名空间：" + Object.keys(ctx.remote || {}).join(", ")); }
				catch (e) { L.push("列命名空间抛错：" + String((e && e.message) || e)); }
				let s = null;
				try { s = ctx.remote && ctx.remote.session; }
				catch (e) { L.push("访问 remote.session 抛错：" + String((e && e.message) || e)); }
				L.push("typeof remote.session = " + typeof s);
				if (!s) return L.join("\n");
				L.push("typeof session.openWorkspacePath = " + typeof s.openWorkspacePath);
				L.push("typeof session.canOpenWorkspacePath = " + typeof s.canOpenWorkspacePath);
				try {
					if (typeof s.canOpenWorkspacePath === "function") {
						const r = await s.canOpenWorkspacePath();
						L.push("canOpenWorkspacePath() = " + (r && r.ok === true ? String(r.value) : "失败 " + JSON.stringify(r && r.error)));
					}
				} catch (e) { L.push("canOpenWorkspacePath() 抛错：" + String((e && e.message) || e)); }
				try {
					if (typeof s.workspaceDesktop === "function") {
						const r = await s.workspaceDesktop();
						L.push("workspaceDesktop() = " + JSON.stringify(r && r.ok === true ? r.value : (r && r.error)));
					} else L.push("workspaceDesktop：客户端无此方法");
				} catch (e) { L.push("workspaceDesktop() 抛错：" + String((e && e.message) || e)); }
				return L.join("\n");
			};

			/**
			 * A2 通道探测：把「列预设 / 列斜杠命令 / 建 sr 工作会话 / 执行命令」四步
			 * 的结果原样报出来。**先确认通道，再搭界面。**
			 */
			/**
			 * 取「列表型」服务的 snapshot store —— **两个版本都认**：
			 *   · 0.1.5：服务名 `sessions` / `workspaces`
			 *   · 0.2.0：同一批服务还在（`dsh-api-*-controller` 的客户端半侧），
			 *     另外多了 UI 域服务 `uiSession` / `uiWorkspace`（面板 slot 侧用它拿 hook）。
			 * 两个版本都返回 `{ getSnapshot, subscribe }`，所以判据是"有 list.getSnapshot"。
			 */
			const storeOf = (svcName, ownerName) => {
				const direct = svc(ctx, svcName);
				if (direct && direct.list && typeof direct.list.getSnapshot === "function") return direct.list;
				const owner = svc(ctx, ownerName);
				const inner = owner && owner[svcName];
				if (inner && inner.list && typeof inner.list.getSnapshot === "function") return inner.list;
				return null;
			};

			/**
			 * ═══ 侧边栏的「已归档」集（2026-09-30 实测缺陷修复）════════════════════════
			 *
			 * 缺陷：面板认领会话时**不看归档状态**，于是认领了一条"已归档（侧边栏不可见）"
			 * 的会话 —— 指令发进去了（会话日志 13:35 仍有写入），用户却什么也看不到，
			 * 判定"面板没反应，F5 都不出现"。
			 *
			 * 归档 = **工作区层的显示过滤**，不是删除：归档的会话照样出现在 `remote.session.list`
			 * 里（`SessionListRequest` 只有可选 `cursor`，列表**不按归档过滤**，
			 * `dsh-api-session-controller/lib/types/types.d.ts:262`），
			 * 只是官方侧边栏按 `archivedSessionIds` 把行藏起来（`ArchivedFilter`）。
			 * 所以"能不能被认领"不能只看它在不在列表里 —— **必须看它在界面上可不可见**。
			 *
			 * 唯一权威读口子就是官方客户端 workspace store 的快照
			 * （`ClientWorkspaceModel.buildSnapshot()` 里的 `archivedSessionIds`，
			 * `dsh-api-workspace-controller/lib/types/client/model.d.ts:12`；
			 * 官方半侧自己也是这么用的：`dsh-client-ui-workspace/lib/client.js:801` 挑空白会话时排除它）。
			 * 我们**只读**它 —— 不 patch 官方半侧、不自己维护一份归档表。
			 *
			 * ★ 拿不到时（服务没提供 / 快照形状变了）**如实降级**，绝不静默假装知道：
			 *   返回 `ids: null`，调用方把 `NO_ARCHIVE_INFO_NOTE` 显示到面板上。
			 *   降级行为 = **退回旧行为**（不做排除，照旧认领），因为"排除"这件事此刻无从判定；
			 *   代价与补救写在提示里（去侧边栏「已归档」里取消归档）。
			 *
			 * @returns `{ ids, reason }` —— `ids: string[] | null`（`null` = 拿不到）
			 */
			const sidebarArchived = () => {
				try {
					const store = storeOf("workspaces", "uiWorkspace");
					if (!store) return { ids: null, reason: "取不到官方 workspaces 客户端服务" };
					const ids = archivedFromSnapshot(store.getSnapshot());
					if (ids === null) return { ids: null, reason: "快照里没有 archivedSessionIds" };
					return { ids: ids, reason: "" };
				} catch (e) {
					return { ids: null, reason: String((e && e.message) || e) };
				}
			};

			/**
			 * 「用户当前选中的会话」。
			 * ★ **0.2.0 没有 `state.current` 了** —— 官方 `dsh-client-ui-layout` 与
			 *   `dsh-client-ui-workspace` 一律用 `byId[id].retainedBy.mainView > 0` 算"当前会话"。
			 *   0.1.5 时代面板读的 `sessions.current` 在 0.2.0 恒为 undefined —— 这正是
			 *   「面板永远显示'先在左侧选一个会话'」的直接原因（看板自己已不再依赖它，
			 *   见 `resolveIndexSession`；这里只服务于"工作会话落进哪个工作区分组"）。
			 */
			const currentSessionId = () => {
				const store = storeOf("sessions", "uiSession");
				if (!store) return "";
				let snap = null;
				try { snap = store.getSnapshot(); } catch (e) { return ""; }
				if (!snap) return "";
				if (typeof snap.current === "string" && snap.current) return snap.current;   // 0.1.5
				const byId = snap.byId || {};
				for (const id of Object.keys(byId)) {
					const row = byId[id];
					if (row && row.retainedBy && Number(row.retainedBy.mainView) > 0) return id;
				}
				return "";
			};

			const workspaceInfo = () => {
				try {
					const store = storeOf("workspaces", "uiWorkspace");
					if (!store) return { id: "", title: "", path: "", error: "workspaces 服务不可用" };
					const ws = store.getSnapshot();
					const cur = currentSessionId();
					if (!cur) return { id: "", title: "", path: "" };
					const hit = (ws.items || []).filter(
						(it) => it && Array.isArray(it.sessionIds) && it.sessionIds.indexOf(cur) >= 0
					)[0];
					return hit
						? { id: hit.workspaceId, title: hit.title || "", path: hit.path || "" }
						: { id: "", title: "", path: "" };
				} catch (e) {
					return { id: "", title: "", path: "", error: String((e && e.message) || e) };
				}
			};

			/**
			 * ═══ 建完就把新工作区 / 新会话并进**客户端 store**（侧边栏立刻看得见）═══
			 *
			 * 缺陷（2026-09-30 实测）：面板建完工作区 + 会话之后，侧边栏**要按 F5 才出现**
			 * 那个工作区分组与新会话行。根因：面板走的是**裸 Remote**
			 * （`remote.workspace.create` / `remote.session.create` / `remote.session.rename`），
			 * 只把结果返回给调用方，**没人把它并进客户端 store** —— 而侧边栏读的正是那两个 store。
			 * 官方「新会话」按钮之所以建完立刻看得见，是因为它走的是**官方客户端服务**那条路
			 * （`dsh-client-ui-workspace/lib/client.js:846 startSession` → `:808 sessions.create`）。
			 *
			 * 所以这里照抄官方那两刀（**不自己写 store 写入**）：
			 *   ① `workspaces.create({path})`
			 *      —— `dsh-api-workspace-controller/lib/client.js:393 create` →
			 *         `:51 ClientWorkspaceModel.create` → `:53 upsert(result.value.workspace)`。
			 *         官方的「新增工作区」也是调它（`dsh-client-ui-workspace/lib/client.js:4282`）。
			 *         按路径查是**幂等**的：已存在就返回当前视图（连 `sessionIds` 一起，所以新会话
			 *         会被这个分组认领，不再落进「未分组」）。
			 *   ② `sessions.refresh()`
			 *      —— `dsh-api-session-controller/lib/client.js:3258 refresh` →
			 *         `:2603 SessionManager.refreshList`（`session.list` 拉一次基线，
			 *         连 `projections.values.title` 一起装上 —— 就是我们刚 `rename` 的那个标题）。
			 *         客户端**重连时官方自己**也是这么重建基线的（同文件 `:2923 handleConnected`）。
			 *
			 * ★ 为什么不直接用官方的 `sessions.create`（它自带 placeholder 合并）：它**丢 `agentPreset`**
			 *   （同文件 `:2680-2686` 的 payload 只带 workspaceId/sessionId 或 cwd/sessionId，
			 *   而 `SessionCreateRequest.agentPreset` 是 host 支持的字段，见该包 `types.d.ts:283`）。
			 *   工作台的工作会话必须带 `sr-workbench` 这个预设，所以创建仍旧走裸 Remote，
			 *   建完再用官方这两刀把 store 补齐 —— 这是**正规口子**（官方自己的"重拉基线"入口）。
			 *
			 * ★ 探服务用 `ctx.get`（不是 inject）：这两个服务任何一个没被提供时，写进 inject
			 *   会让**整个插件不激活**；探不到就按 `planSidebarSync` 如实降级并说清"要刷新页面"。
			 *
			 * @param path 这次会话建在哪个目录（工作区分组按它认领）；`""` = 无归属（未分组）
			 * @returns `{ plan, notes }` —— notes 是**给人看**的降级说明（空数组 = 都做到了）
			 */
			const syncSidebarStores = async (path) => {
				let workspacesSvc = null;
				let sessionsSvc = null;
				try { workspacesSvc = svc(ctx, "workspaces"); } catch (e) { workspacesSvc = null; }
				try { sessionsSvc = svc(ctx, "sessions"); } catch (e) { sessionsSvc = null; }
				const plan = planSidebarSync({
					path: path || "",
					services: {
						workspaces: !!(workspacesSvc && typeof workspacesSvc.create === "function"),
						sessions: !!(sessionsSvc && typeof sessionsSvc.refresh === "function")
					}
				});
				const notes = plan.notes.slice();
				if (!sidebarSyncNeeded(plan)) return { plan: plan, notes: notes };
				// ★ 官方客户端服务**直接返回值 / 直接抛错**（不是 Remote 的 `{ok,value,error}` 形状），
				//   所以不能过 `safeCall`（它会把这些返回值判成 ok:false）—— 这里另包一层。
				const tryCall = async (name, fn) => {
					try { return { name: name, ok: true, value: await fn() }; }
					catch (e) { return { name: name, ok: false, error: { message: String((e && e.message) || e) } }; }
				};
				for (const step of plan.steps) {
					if (step === "workspaces.create") {
						const r = await tryCall("workspaces.create", () => workspacesSvc.create({ path: plan.resolvePath }));
						if (!r.ok) notes.push("工作区分组没能即时并进侧边栏（" + humanError(r) + "）。");
					} else {
						const r = await tryCall("sessions.refresh", () => sessionsSvc.refresh());
						if (!r.ok) notes.push("会话行没能即时并进侧边栏（" + humanError(r) + "）。");
					}
				}
				return { plan: plan, notes: notes };
			};

			const probe = {
				/** 建完补一次「并进客户端 store」（侧边栏立刻看得见）—— 唯一实现在组合根，组件只调它 */
				syncSidebar: (path) => syncSidebarStores(path),
				presets: () => safeCall("agentPresets.list", () => ctx.remote.agentPresets.list()),
				commands: (sid) => safeCall("commands.list", () => ctx.remote.commands.list(sid)),
				/**
				 * 列会话（0.2.0 仍有 `session/list`；`SessionListRequest` 现在只有可选的 `cursor`）。
				 * ★ 返回的 `items[].projections.values.title` 就是持久标题（host 把 `title`
				 *   注册成投影后随列表一起下发）。0.1.5 的 `title` 在行上。
				 */
				listSessions: (signal) => safeCall("session.list",
					() => ctx.remote.session.list({}, signal)),
				/** 给会话改名 —— 索引会话的「可识别标题」凭据（`{ sessionId, title }`） */
				renameSession: (sid, title) => safeCall("session.rename",
					() => ctx.remote.session.rename({ sessionId: sid, title: title })),
				/** 按路径查/建工作区 —— 已存在时返回 created:false 并给出 workspaceId */
				ensureWorkspace: (path) => safeCall("workspace.create",
					() => ctx.remote.workspace.create({ path: path })),
				create: (workspaceId, cwd, preset) => safeCall("session.create", () => {
					// ★ host 明确拒绝同时给 workspaceId 与 cwd：
					//   "session.create accepts workspaceId or cwd, not both"（gateway/bad-request）
					//   给了 workspaceId 就用工作区自己的 path 当 cwd。
					const req = workspaceId
						? { workspaceId: workspaceId, agentPreset: preset }
						: { cwd: cwd || void 0, agentPreset: preset };
					return ctx.remote.session.create(req);
				}),
				exec: (sid, line) => safeCall("commands.execute",
					() => ctx.remote.commands.execute(sid, line, [])),
				prompt: (sid, text) => safeCall("session.prompt", () => ctx.remote.session.prompt({
					requestId: "wb-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
					sessionId: sid,
					mode: "queue",
					// ★ 不挂 file block：上传件的 attachmentId 没有宿主路径，agent 读不到内容
					//   （见 IntakeBox 的 noPath 警告）。挂上去只会让人以为"它读过了"。
					content: [{ type: "text", text: text }]
				})),
				workspaceInfo: workspaceInfo,
				/** 原生目录选择器（用于"导入旧文档"） */
				pickDirectory: () => safeCall("directoryPicker.pick",
					() => ctx.remote.directoryPicker.pick()),
				/** 跳到某个会话（DSH 自己的服务；会把中栏切回对话） */
				openSession: (sid) => {
					try {
						if (!sid) return { ok: false, error: { message: "没有会话 id" } };
						const uw = svc(ctx, "uiWorkspace");
						if (!uw || typeof uw.openSession !== "function") {
							return { ok: false, error: { message: "uiWorkspace 服务不可用" } };
						}
						uw.openSession(sid);
						return { ok: true, value: { opened: true } };
					} catch (e) {
						return { ok: false, error: { message: String((e && e.message) || e) } };
					}
				}
			};

			// ════════════════════════════════════════════════════════════════
			// 索引会话（工单 32 · 0.2.0 兼容）
			// ════════════════════════════════════════════════════════════════

			/**
			 * 本机兜底工作区根。
			 * ★ 浏览器半侧**收不到**插件 config（开发笔记坑 7），所以 `configPath` / `projectRoot`
			 *   在浏览器里都是空的 —— 绝对路径只能自己推。候选根（见下）来自
			 *   ① 工作区列表 ② 每个会话的 cwd ③ 这个兜底。
			 */
			const DEFAULT_ROOT = "D:\\TimeMachine";
			/** 索引会话用的预设（随包分发，见 cordis.patch.yml 的 sr-workbench 行） */
			const INDEX_PRESET = "sr-workbench";

			/** 上一次用的索引会话（按 sr 根记；隐私模式/无 localStorage 时静默降级成"每次都重新认"）。 */
			const cacheRead = () => {
				try {
					if (typeof localStorage === "undefined" || !localStorage) return null;
					const raw = localStorage.getItem(indexCacheKey());
					if (!raw) return null;
					const v = JSON.parse(raw);
					return v && typeof v.sid === "string" && v.sid ? v : null;
				} catch (e) { return null; }
			};
			const cacheWrite = (srWs, sid) => {
				try {
					if (typeof localStorage === "undefined" || !localStorage) return;
					localStorage.setItem(indexCacheKey(), JSON.stringify({ srWs: srWs || "", sid: sid }));
				} catch (e) { /* 无缓存也能用 */ }
			};

			/**
			 * ═══ 工作会话的缓存（工单 15）═══
			 * 索引会话一条工作区一个（`sr-wb.index.v1`）；工作会话**一个功能一条**，
			 * 所以值是一张"功能根 → 会话 id"的表。读/写/删的**判定全在纯函数里**
			 * （`workCacheGet` / `workCachePut` / `workCacheDrop`，坏 JSON 一律当空表），
			 * 这里只负责碰 localStorage。
			 */
			const workCacheRaw = () => {
				try {
					if (typeof localStorage === "undefined" || !localStorage) return null;
					return localStorage.getItem(workCacheKey());
				} catch (e) { return null; }
			};
			/** 写/删一条（`sid` 传 null = 删掉这个功能的记录，会话失效自愈时用） */
			const workCacheSet = (root, sid) => {
				try {
					if (typeof localStorage === "undefined" || !localStorage) return;
					const raw = workCacheRaw();
					const next = sid === null || sid === void 0
						? workCacheDrop(raw, root)
						: workCachePut(raw, root, sid);
					localStorage.setItem(workCacheKey(), next);
				} catch (e) { /* 无缓存也能用（只是下次多认一次） */ }
			};

			/** 从配置路径反推 skills 根（形状：`<X>/.agents/skills`） */
			const skillsRootOf = (p) => String(p).replace(/[\\/]sr-askme[\\/]config\.local\.json$/i, "");

			/**
			 * 解析「索引会话」—— 面板**不再依赖"用户当前选中的会话"**（ADR 0005 / 工单 07）。
			 *
			 * 顺序（每步都有理由，别简化）：
			 *   1. 先挑一条**任何可用**的会话：只为读 sr 配置 —— `read` 不受工作区限制（坑 3）。
			 *   2. 按候选根读 `config.local.json`（绝对值优先）→ 拿到绝对锚点 `sr_workspace`。
			 *   3. 索引会话必须**能列 root 下的目录** —— `workspaceFiles.list` 限定在会话的工作区内（坑 3），
			 *      所以只从"cwd 覆盖 root"的那几条里认领：缓存 → 标题前缀 → cwd 覆盖 → 当前选中；
			 *      一条都没有才**新建**（`workspace/create` 幂等 → `session.create({workspaceId})`
			 *      → `session.rename` 起可识别标题，下次按标题认回来，不会每次刷新都新建）。
			 *
			 * 返回：`{ ok, sid, cwd, root, srWs, source, extraPaths, configFile, skillsRoot, configRoot, note }`
			 */
			const resolveIndexSession = async (opts) => {
				const o = opts || {};
				const signal = o.signal;
				const note = [];
				let rows = (o.rows || []).filter((r) => r && r.id);
				const cached = cacheRead();
				const storeRowCount = rows.length;
				// ★ 归档集：认领索引会话时也要排除（侧边栏看不见的会话不算可用）。
				//   缓存里记的那条若已被归档 ⇒ 当作"不可用"（不指名它），下面按 ②③ 认别的或新建。
				const arch = sidebarArchived();
				if (arch.ids === null) note.push(NO_ARCHIVE_INFO_NOTE + "（" + arch.reason + "）");
				const cachedSid = cached && cached.sid ? String(cached.sid) : "";
				const cachedArchived = isArchivedId(arch.ids, cachedSid);
				if (cachedArchived) note.push(ARCHIVED_CACHED_NOTE);

				// 候选根：显式提示 → 工作区列表 → 会话 cwd → 本机兜底
				const roots = [];
				if (o.rootHint) roots.push(o.rootHint);
				for (const p of (o.wsPaths || [])) roots.push(p);
				for (const r of rows) if (r.cwd) roots.push(r.cwd);
				roots.push(DEFAULT_ROOT);

				// 0) 客户端 store 空时补一次远程列表（0.2.0 仍有 session/list）
				let listOk = rows.length > 0;
				if (rows.length === 0) {
					const L = await probe.listSessions(signal);
					if (L.ok) { rows = rowsFromList(L.value); listOk = true; }
					else note.push("会话列表读取失败：" + humanError(L));
				}

				// 1) 读配置只需要"一条能读文件的会话"
				//   ★ 这一步**不排除归档**（也有意与下面的正式认领不同）：它只被 `read` 用，
				//     不显示、更不发指令 —— 用户看不见它不影响任何结果；反过来排除它会在
				//     "用户把会话都归档了"时读不到 sr 配置、把锚点退回默认根。只是缓存里那条
				//     已归档时不再指名它。
				const boot = pickIndexSession(rows, "", {
					cachedId: cachedArchived ? "" : cachedSid, allowForeign: true
				});

				// 2) 读 sr 配置 → 绝对锚点
				const cands = configPathCandidates(roots);
				let cfgPath = "";
				let cfg = null;
				if (boot) {
					for (const p of cands) {
						const text = await readAllText(read, boot.id, p, signal, 200);
						if (!text) continue;
						try {
							const parsed = JSON.parse(text);
							if (parsed && parsed.sr_workspace) { cfg = parsed; cfgPath = p; break; }
						} catch (e) { /* 换下一个候选 */ }
					}
				}
				const srWs = cfg ? String(cfg.sr_workspace).replace(/[\\/]+$/, "") : "";
				const root = srWs || o.rootHint || DEFAULT_ROOT;
				if (!cfg) note.push("没读到 sr 配置（试过 " + cands.length + " 个候选路径），锚点退回 " + root);
				if (storeRowCount === 0) note.push("客户端会话快照为空，已走 remote.session.list。");

				// 3) 索引会话：必须是"cwd 覆盖 root"的那一类，**且没被归档**（侧边栏看得见才算可用）
				const able = rows.filter((r) => containsPath(r.cwd, root));
				const hit = pickIndexSession(able, root, {
					cachedId: cachedArchived ? "" : cachedSid, archived: arch.ids
				});
				if (hit) {
					cacheWrite(root, hit.id);
					return {
						ok: true, sid: hit.id,
						cwd: hit.row.cwd || root, root: root, srWs: srWs,
						source: hit.source, sessionTitle: hit.row.title || "",
						extraPaths: cfgPath ? [cfgPath] : [],
						configFile: cfgPath, skillsRoot: cfgPath ? skillsRootOf(cfgPath) : "",
						configRoot: cfg ? String(cfg.config_root || "").replace(/[\\/]+$/, "") : "",
						note: note
					};
				}

				// 一条都没有 → 新建。★ 列表本身就读不到时**不许建**（不然会攒出一堆空会话）
				if (!listOk) {
					return { ok: false, sid: "", error: "读不到会话列表：" + note.join("；"), note: note };
				}
				const ws = await probe.ensureWorkspace(root);
				const wsId = ws.ok && ws.value && ws.value.workspace ? ws.value.workspace.workspaceId : "";
				if (!ws.ok) note.push("按路径登记工作区失败（改用 cwd 建会话）：" + humanError(ws));
				// ★ workspaceId 与 cwd **互斥**（host 明确拒绝两者同时给）—— probe.create 内部已分流
				const cr = await probe.create(wsId, root, INDEX_PRESET);
				if (!cr.ok) {
					return { ok: false, sid: "", error: "无法创建索引会话：" + humanError(cr), note: note };
				}
				const sid = idText(cr.value && cr.value.sessionId);
				if (!sid) return { ok: false, sid: "", error: "会话已创建，但拿不到 sessionId。", note: note };
				const title = indexTitleFor(root);
				const rn = await probe.renameSession(sid, title);
				if (!rn.ok) note.push("索引会话建好了但改名失败（下次按 cwd 认回来）：" + humanError(rn));
				cacheWrite(root, sid);
				// ★ 索引会话也是"新工作区 + 新会话"，同样要补一刀（不然侧边栏要 F5 才出现）
				const sync = await syncSidebarStores(root);
				for (const n of sync.notes) note.push(n);
				return {
					ok: true, sid: sid, cwd: root, root: root, srWs: srWs,
					source: "created", sessionTitle: rn.ok ? title : "",
					extraPaths: cfgPath ? [cfgPath] : [],
					configFile: cfgPath, skillsRoot: cfgPath ? skillsRootOf(cfgPath) : "",
					configRoot: cfg ? String(cfg.config_root || "").replace(/[\\/]+$/, "") : "",
					note: note,
					createdWorkspace: !!(ws.ok && ws.value && ws.value.created)
				};
			};

			function PanelBound(props) {
				return h(PanelErrorBoundary, null,
					h(Panel, Object.assign({}, props, {
						__loader: loader, __remoteOpen: remoteOpen, __ledger: ledgerLoader, __final: finalLoader,
						__fix: fixRunner,
						// ★ 工单 23：头脑风暴工作面（数据 + 发送出口；发送复用 `sendFeatureInstruction`）
						__brainstorm: brainstormLoader,
						__sendBrainstorm: brainstormRunner,
						// ★ 工单 24：文档生成工作面（成稿 + 配置支线；发送**同一条链路**）
						__draft: draftLoader,
						__sendDraft: draftRunner,
						__diagnose: diagnose, __probe: probe, __projectRoot: projectRoot,
						__interfaces: interfaceLoader, __index: indexLoader, __detail: detailLoader,
						__resolve: resolveIndexSession,
						// ★ 工单 16：变更订阅 / 版本 stat（面板的自动刷新与指纹就靠这两个出口）
						__watch: watchTargets, __statMany: statMany,
						__refreshIndex: refreshIndex, __readText: readTextFile,
						__pickDir: probe.pickDirectory,
						__importDocs: importOldDocs, __addManual: addManualNote,
						// ★ 收件箱（四种输入方式的统一入口）
						__intake: intakeByKind, __intakeRefs: intakeRefs
					})));
			}

			ctx.slots.inject("main", function* () {
				yield ctx.slots.register({ name: "main", key: PANEL_ID }, PanelBound);
			});
			ctx.slots.inject("sidebar.panellist", function* () {
				yield ctx.slots.register(
					{ name: "sidebar.panellist", id: PANEL_ID, order: 100, label: "策划工作台" },
					Glyph
				);
			});
		}

export { apply, inject };

