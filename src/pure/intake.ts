/**
 * 收件箱纯逻辑：素材解析 / 主题派生 / 指令组装
 *
 * ★ 工单 03（WorkspacePort 接缝）从 `src/client.js` **逐字搬来**，只做了整体去缩进与补 export；
 *   正文一字未改（行为不变的证据：临时 harness 对真实工作区数据做迁移前后 deepEqual）。
 * 这一份原来内联在 client.js 里（因为当时只能有一个文件）；现在它是真模块，legacy 的两份副本与防漂移比对脚本随之删除。
 *
 * ★ 工单 23（头脑风暴工作面）**加了一组新入口**（`buildBrainstormInstruction`）：
 *   竞品分析 / 问答式访谈 / 旧文档分析 / 人工补充 —— 与老收件箱的四种方式**不是同一套语义**
 *   （老方式 3/4 只登记进 `inbox\`；新入口的产出全部落功能目录的 `analysis\`，且旧文档分析 / 人工补充
 *   有**固定格式**，见设计 §4.2）。
 *
 * ★ 工单 24（文档生成工作面）继续照这条纪律走：动作表与三段式组装器都在 `./draftstep.ts`，
 *   这里只 **re-export**（`DRAFT_ACTIONS` / `buildDraftInstruction`）—— 面板侧读 `INTAKE` 就够，
 *   不会出现"client.js 里再抄一份"的第二份实现。
 *
 * ★ 工单 31（收口）：**老收件箱那一组删掉了** —— `INTAKE_KINDS`（四种方式的表）与
 *   `buildInstruction`（四种方式的组装器），以及只被它们引用的 `DOC_EXT` / `TEXT_EXT` /
 *   `isDoc` / `isTextExt` / `safeName` / `extOf`。
 *   它们当时被"原样保留"的唯一理由是**设计资产屏还在用**（见本文件原来的注释）；那一屏属被砍的
 *   「设计资产」模块（设计 §3.4），随本票删除、面板侧的内联副本也早已接到这一份 ⇒ 引用清零。
 *   现在这份模块**只有一种做法**：头脑风暴四入口 + 文档生成的动作表。
 */

import { ENTRANCES, humanNoteName, legacyDocName } from "./analysisdoc.ts";
import { DRAFT_ACTIONS_TABLE, DRAFT_PHASES, buildDraftInstruction } from "./draftstep.ts";

const INTAKE = (function () {
	const isWinAbs = (p) => /^[A-Za-z]:[\\/]/.test(p) || /^\\\\/.test(p) || /^[\\/]/.test(p);
	const isHttp = (p) => /^https?:\/\//i.test(p);

	/** 路径统一成 Windows 反斜杠（指令里给 agent 看的形态） */
	const winOf = (p) => String(p == null ? "" : p).replace(/\//g, "\\").replace(/\\+$/, "");

	/** 单个素材字符串 → [{ kind, path|text }] */
	function parseMaterial(raw) {
		const s = String(raw == null ? "" : raw).trim();
		if (s === "") return [];
		if (isHttp(s)) return [{ kind: "url", path: s }];
		if (isWinAbs(s)) {
			const bare = s.replace(/[\\/]+$/, "");
			const isDir = /^[A-Za-z]:$/.test(bare) || /^\\\\[^\\]+$/.test(bare) || (!/\.[A-Za-z0-9]{1,8}$/.test(bare));
			return [{ kind: isDir ? "dir" : "file", path: bare }];
		}
		return [{ kind: "text", text: s }];
	}

	/** 文本块 → 素材数组（按行拆：绝对路径/URL 逐行成项，其余并为 text） */
	function parseMaterials(raw) {
		const out = [];
		const pending = [];
		const flush = () => {
			const t = pending.join("\n").trim();
			if (t !== "") out.push({ kind: "text", text: t });
			pending.length = 0;
		};
		for (const line of String(raw == null ? "" : raw).split(/\r?\n/)) {
			const t = line.trim();
			if (t !== "" && (isWinAbs(t) || isHttp(t))) {
				flush();
				for (const it of parseMaterial(t)) out.push(it);
			} else {
				pending.push(line);
			}
		}
		flush();
		return out;
	}

	/** 路径尾段 → 名字（两平台分隔符都认） */
	function baseName(p) {
		const s = String(p == null ? "" : p).replace(/[\\/]+$/, "");
		const parts = s.split(/[\\/]/);
		return parts[parts.length - 1] || s;
	}

	/** 从素材派生功能主题（去扩展名、去日期、去尾部噪音） */
	function deriveTopic(materials) {
		const list = materials || [];
		const pick = list.filter((m) => m && (m.kind === "file" || m.kind === "dir"))[0]
			|| list.filter((m) => m && m.kind === "url")[0]
			|| list.filter((m) => m && m.kind === "text")[0];
		if (!pick) return "";
		let n;
		if (pick.kind === "url") {
			n = String(pick.path).replace(/^https?:\/\//i, "").split(/[/?#]/).filter((x) => x !== "")[0] || "";
		} else if (pick.kind === "text") {
			// ★ 文本素材没有 path —— 取 text（此前取 path，导致主题恒为空）
			n = String(pick.text || "").split(/\r?\n/)[0];
		} else {
			n = baseName(pick.path || "");
		}
		if (pick.kind === "dir") return n;
		n = n.replace(/\.[A-Za-z0-9]{1,8}$/, "");
		n = n.replace(/[_\-\s]*\d{8}(?:[_\-\s.]|$)/, " ");
		n = n.replace(/[_\-\s]*(定稿_审查|定稿|审查|宣讲|修订点|UIUE|UI|md版本|人读版|设计稿|初稿|草案)$/, "");
		n = n.replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();
		return n;
	}

	/** 素材清单 → 中文可读列表 */
	function describeMaterials(materials) {
		const list = materials || [];
		if (list.length === 0) return "（无）";
		return list.map((m, i) => {
			const no = i + 1;
			if (m.kind === "dir") return no + ". 目录：" + m.path;
			if (m.kind === "file") return no + ". 文件：" + m.path;
			if (m.kind === "url") return no + ". 链接：" + m.path;
			const one = String(m.text || "").replace(/\s+/g, " ");
			return no + ". 文本：" + (one.length > 300 ? one.slice(0, 300) + "…" : one);
		}).join("\n");
	}

	/** 素材清单里有没有可当"路径素材"的东西 */
	function hasPathMaterial(materials) {
		return (materials || []).some((m) => m && (m.kind === "file" || m.kind === "dir" || m.kind === "url"));
	}

	/**
	 * ★ 工单 23 · 头脑风暴四入口各自的指令（设计 §4.1 / §4.2）。
	 *
	 * 与已被工单 31 删掉的老 `buildInstruction` 的三点不同（那是**另一套语义**，不是这里的改写）：
	 *   ① 产出落到**这个功能自己的** `features\<主题>\analysis\`（不是工作区根的 `inbox\`）；
	 *   ② 旧文档分析 / 人工补充有**固定格式**（四段章节 / `> 原话：` + 结论 + 边界 + 落点）；
	 *   ③ 前置不满足时**连"下一步怎么做"一起给**（`blocked` + `next`）—— 缺前提不静默。
	 *
	 * ★ 文件名的唯一出处是 `./analysisdoc.ts` 的 `legacyDocName` / `humanNoteName`：
	 *   指令里写下的名字，必须与读取侧（`analysisDocKind`）认得的名字一致。
	 * ★ `date` 由调用方给（面板用今天）—— 纯函数不吃时钟，测试才能逐字断言。
	 */
	function buildBrainstormInstruction(kind, input) {
		const inp = input || {};
		const e = ENTRANCES.filter((x) => x.id === kind)[0];
		if (!e) {
			return { instruction: "", blocked: "未知的头脑风暴入口：" + String(kind), next: "四个入口是：竞品分析 / 问答式访谈 / 旧文档分析 / 人工补充。" };
		}
		const materials = inp.materials || [];
		const note = String(inp.note == null ? "" : inp.note).trim();
		const root = winOf(inp.root);
		const date = String(inp.date || "");
		const topic = String(inp.topic || "").trim() || deriveTopic(materials);
		// 入口① 拿不到功能目录 ⇒ 不猜、不发（工作会话要建在功能目录上，cwd 错了产出就落错地方）
		if (root === "") {
			return {
				instruction: "",
				blocked: "拿不到这个功能的功能目录（`features\\<主题>\\`）。",
				next: "从「功能详情 › 头脑风暴」进来再发一次 —— 指令要发给该功能的专属工作会话（cwd = 功能目录）。"
			};
		}
		const outDir = root + "\\analysis";
		const srcDir = root + "\\source";
		const tail = "阶段交给了 skill / 会话里的 AI：" + e.handoff.replace(/（面板不重画流程）$/, "") +
			" —— 有决策门就停下来等我拍板，不要自己往下走。";

		if (kind === "analysis") {
			if (!hasPathMaterial(materials)) {
				return {
					instruction: "",
					blocked: "「竞品分析」需要一份素材：目录、文件路径或链接（截图 / 录屏 / PV / 商店页）。",
					next: "在「素材」里粘一条本机绝对路径或链接；纯文字不会被当成素材（要写文字请走「人工补充」或「问答式访谈」）。"
				};
			}
			const L = [
				"【头脑风暴 · 竞品分析】请执行 `/sr-analysis`（走 `/sr-analysis <素材路径或链接>` 的正常调用，不要改动该 skill）。",
				"素材：",
				describeMaterials(materials),
				"分析目标：" + (note || "（未指定——按 sr-analysis 第 1 步 VOI 门现场确认）")
			];
			if (topic) L.push("功能主题（用于产出命名与归档）：" + topic);
			L.push("产出落点：" + outDir + "\\（文件名按 sr-analysis 自己的产出规范：experience-report_*.md / issue-cards_*.json / replication-spec_*.md / sr-gdd-handoff_*.json；证据包落 " + root + "\\evidence\\）");
			L.push(tail);
			return { instruction: L.join("\n"), blocked: "", next: "" };
		}

		if (kind === "concept") {
			const seed = note || (materials.filter((m) => m.kind === "text")[0] || {}).text || "";
			if (String(seed).trim() === "") {
				return {
					instruction: "",
					blocked: "「问答式访谈」需要一句创意：在输入框里写下你想做的玩法或功能。",
					next: "在「一句话创意」里写一句（比如：联盟成员一起打 BOSS，血量全盟共享）；有参考素材就把路径一并粘上。"
				};
			}
			const pathMats = materials.filter((m) => m.kind !== "text");
			const L = [
				"【头脑风暴 · 问答式访谈】请执行 `/sr-concept`（走 `/sr-concept <一句话创意>` 的正常调用，不要改动该 skill）。",
				"创意：" + String(seed).replace(/\s+/g, " ").trim()
			];
			L.push(pathMats.length > 0 ? "已有材料（有就给路径）：" : "已有材料：没有。");
			if (pathMats.length > 0) L.push(describeMaterials(pathMats));
			if (topic) L.push("功能主题（用于产出命名与归档）：" + topic);
			L.push("产出落点：" + outDir + "\\（concept-triage_*.md → feature-concept_*.md → sr-gdd-handoff_*.json，文件名按 sr-concept 自己的产出规范）");
			L.push("定位：本项目（文明之跃）新功能/新玩法。");
			L.push(tail);
			return { instruction: L.join("\n"), blocked: "", next: "" };
		}

		if (kind === "legacy") {
			const pathMats = materials.filter((m) => m.kind === "file" || m.kind === "dir");
			if (pathMats.length === 0) {
				return {
					instruction: "",
					blocked: "「旧文档分析」需要旧文档的路径（旧策划案 / 脑图 / 表格；目录或单个文件都行）。",
					next: "把旧文档拖进来，或粘它的本机绝对路径（.docx / .xlsx / .md / .pdf 都可）。"
				};
			}
			const name = String(inp.name || "").trim() || deriveTopic(pathMats) || "旧文档";
			const produced = legacyDocName(name, date);
			const L = [
				"【头脑风暴 · 旧文档分析】把这份旧文档**转换 + 分析**后落成固定格式（不要整份照抄成 md —— 分析这一步的价值是给出可用的结论）。",
				"旧文档：",
				describeMaterials(pathMats),
				"步骤：",
				"1) 原件进原料桶：若它不在 " + srcDir + "\\ 下，先把原件（**保持原文件名**）放进 " + srcDir + "\\，此后原件只存这里、不再往别处复制。",
				"2) 产出 " + outDir + "\\" + produced + "，frontmatter 必须是：",
				"---",
				"doc_type: legacy_analysis",
				"topic: " + (topic || "<功能主题>"),
				"source: source/<原件文件名>",
				"analyzed_at: " + (date || "<YYYYMMDD>"),
				"---",
				"（`source:` 指向原件在 `source\\` 里的位置 —— 产出文档的身份信息必须指回原件。）",
				"3) 正文按**四段固定章节**，标题逐字用这几个、一个都不少：",
				"## 仍然有效的结论",
				"## 已废弃 / 不适用",
				"## 可复用条目（表格：旧文档位置 | 内容 | 去向）",
				"## 原文（转换后）（保留章节结构的全文，放在文件末尾 —— 追溯时要能回到原始表述，但不能挡着结论）",
				"4)「已废弃 / 不适用」的每一条**都要写理由**（否则下次还会有人把废弃结论捡回来）；某一节没有内容就写「（无）」，不要删掉这一节。",
				tail
			];
			if (note) L.push("补充说明：" + note);
			return { instruction: L.join("\n"), blocked: "", next: "" };
		}

		if (kind === "humannote") {
			const title = String(inp.title || "").trim();
			const quote = String(inp.quote == null ? "" : inp.quote).trim();
			if (title === "") {
				return {
					instruction: "",
					blocked: "「人工补充」需要一个标题（它同时是产出文件名与文档一级标题）。",
					next: "在「标题」里写一句话，比如：BOSS 血量按联盟共享。"
				};
			}
			if (quote === "") {
				return {
					instruction: "",
					blocked: "「人工补充」需要你的原话 —— 原话是这份文档唯一的结论来源。",
					next: "把你想说的那句原话写进「原话（逐字保留）」；AI 只整理格式，不改你的结论。"
				};
			}
			const bounds = String(inp.bounds == null ? "" : inp.bounds).trim();
			const landing = String(inp.landing == null ? "" : inp.landing).trim();
			const author = String(inp.author == null ? "" : inp.author).trim();
			const confidence = String(inp.confidence || "high").trim();
			const produced = humanNoteName(title, date);
			const L = [
				"【头脑风暴 · 人工补充】把我的原话整理成 " + outDir + "\\" + produced + "（**只整理格式，不许改动结论**）。",
				"标题：" + title,
				"我的原话（**逐字保留**，不许改写、不许摘要、不许润色）：",
				"「" + quote + "」"
			];
			if (bounds) L.push("边界（我给的，照抄进「边界」）：" + bounds.replace(/\s+/g, " "));
			if (landing) L.push("落点（我给的，照抄进「落点」）：" + landing.replace(/\s+/g, " "));
			L.push(
				"产出格式：",
				"---",
				"doc_type: human_note",
				"topic: " + (topic || "<功能主题>"),
				"confidence: " + confidence + "          # high | pending（pending = 需补证据或验证，下游引用时要带标记）",
				"date: " + (date || "<YYYYMMDD>"),
				"author: " + (author || "<谁说的>"),
				"---",
				"",
				"# " + title,
				"",
				"> 原话：「" + quote + "」",
				"",
				"## 结论",
				"<把原话整理成可被下游消费的规则口径 —— 原话本身就是结论，你只能让它更清楚，不能改它的意思>",
				"",
				"## 边界",
				"- <我给了就照抄；没给写「（待定）」并在会话里问我>",
				"",
				"## 落点",
				"- <条目引用，如 §4 R2 BOSS 与难度推进 / §5 UI-M1 UE2 血条区；没给写「（待定）」>",
				"要求：",
				"1) `> 原话：…` 那一行**逐字保留**；它与「结论」在面板上是**并排显示**的 —— 我一眼就能看出你有没有改动结论。",
				"2) 结论里若必须补推断（原话没说到的部分），单独写清补的是哪一步，不要混进原话里。",
				"3) 边界 / 落点我没给就写「（待定）」并问我，别自己编。",
				tail
			);
			return { instruction: L.join("\n"), blocked: "", next: "" };
		}

		return { instruction: "", blocked: "未知的头脑风暴入口：" + String(kind), next: "四个入口是：竞品分析 / 问答式访谈 / 旧文档分析 / 人工补充。" };
	}

	return {
		// ★ 工单 31：老收件箱的 `INTAKE_KINDS` / `buildInstruction` 已删（连同只被它们引用的
		//   `DOC_EXT` / `TEXT_EXT` / `extOf` / `isDoc` / `isTextExt` / `safeName`）——
		//   "四种输入方式"这个语义现在只有一种做法：`BRAINSTORM_KINDS`（四入口）。
		BRAINSTORM_KINDS: ENTRANCES,
		// ★ 工单 24：文档生成工作面的动作 + 三段式组装器（表只有一份，在 `./draftstep.ts`）
		//   ★ 工单 24c：`DRAFT_PHASES` 也一并 re-export —— Y 形两层（纸面动作 / 支线出口）
		//     各画哪些动作由它给，**界面不再自己列 id**（列 id 就会变成第二份定义）。
		DRAFT_ACTIONS: DRAFT_ACTIONS_TABLE,
		DRAFT_PHASES: DRAFT_PHASES,
		parseMaterial: parseMaterial, parseMaterials: parseMaterials,
		baseName: baseName,
		deriveTopic: deriveTopic,
		describeMaterials: describeMaterials, hasPathMaterial: hasPathMaterial,
		buildBrainstormInstruction: buildBrainstormInstruction,
		buildDraftInstruction: buildDraftInstruction
	};
})();

export { INTAKE };
