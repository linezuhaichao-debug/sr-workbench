window.__ModuleLoader__.load({
	id: "dsh-client-ui-sr-workbench",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react = require("react");
		react = __toESM(react, 1);
		//#region src/pure/path.ts
		/**
		* 路径归一：相对路径 → 绝对路径
		*
		* ★ 工单 03（WorkspacePort 接缝）从 `src/client.js` **逐字搬来**，只做了整体去缩进与补 export；
		*   正文一字未改（行为不变的证据：临时 harness 对真实工作区数据做迁移前后 deepEqual）。
		* rel 可能已经是绝对路径（openPath 存的是绝对路径），无条件前缀 cwd 会拼出 `D:\X/D:\X\…`。
		*/
		function toAbs(cwd, rel) {
			if (!rel) return "";
			let p = String(rel);
			const isWinAbs = /^[A-Za-z]:[\\/]/.test(p);
			if (!(isWinAbs || /^[\\/]/.test(p) || /^\\\\/.test(p))) p = (cwd ? String(cwd).replace(/[\\/]+$/, "") + "\\" : "") + p;
			if (isWinAbs || /^[A-Za-z]:/.test(p)) p = p.replace(/\//g, "\\");
			return p;
		}
		/**
		* 从定稿的绝对路径算出**功能根**（`features\<主题>\`）—— 工作会话的 cwd（工单 15）。
		*
		* 只有一种结构：`<功能根>\gdd\<文件>`（CONTEXT.md 的产物桶：`gdd\` 是"出"的桶）。
		* 所以规则是：**最后一个 `gdd` 段之前的全部**。找不到 `gdd` 段（或它后面没有文件）时
		* 退成"文件所在目录"——宁可退，也不要因为形状不合预期就返回空。
		*
		* ★ 为什么不让调用方自己 `dirname` 两次：那样"功能根"就有两处判据了（本仓库的规矩：
		*   判据只有一份）。真实调用方（面板）另有 `detail.root` 更权威，这个函数是**兜底**。
		*/
		function featureRootOf(filePath) {
			if (filePath === null || filePath === void 0) return "";
			const p = String(filePath).replace(/\//g, "\\").replace(/\\+$/, "");
			if (p === "") return "";
			const parts = p.split("\\");
			const end = !/\.[^\\]*$/.test(parts[parts.length - 1] || "") ? parts.length : parts.length - 1;
			if (end <= 0) return "";
			for (let i = end - 1; i >= 1; i--) if (parts[i].toLowerCase() === "gdd") return parts.slice(0, i).join("\\");
			return parts.slice(0, end).join("\\");
		}
		//#endregion
		//#region src/pure/topic.ts
		/**
		* 文件名 → 功能主题（去重是这段的核心）
		*
		* ★ 工单 03（WorkspacePort 接缝）从 `src/client.js` **逐字搬来**，只做了整体去缩进与补 export；
		*   正文一字未改（行为不变的证据：临时 harness 对真实工作区数据做迁移前后 deepEqual）。
		* 同一功能的不同阶段/版本收敛到同一个键；配置表文件名也走这里。
		*/
		const PREFIXES = [
			"sr-gdd-handoff_",
			"concept-triage_",
			"feature-concept_",
			"experience-report_",
			"issue-cards_",
			"replication-spec_",
			"evidence-index_",
			"calibration_",
			"smoke_",
			"readback_",
			"decision_",
			"write_CS-"
		];
		/** 尾部噪音后缀（成对剥，直到剥不动） */
		const TAIL = /[_\-\s]*(定稿_审查|定稿|审查|宣讲|修订点|UIUE|UI|md版本|人读版|设计稿)$/;
		/**
		* 从文件名派生功能主题。目标：同一功能的不同阶段/版本**收敛到同一个键**。
		* `联盟悬赏_20260921_定稿.md` / `联盟悬赏（联盟boss）.txt` / `联盟悬赏-md版本.rar` → 联盟悬赏
		* `readback_A079_神话宝库_20260916.md` / `smoke_英雄圣物_20260923.png` → 神话宝库 / 英雄圣物
		*/
		function topicOf(name) {
			let s = String(name).replace(/(\.[A-Za-z0-9]+)+$/, "");
			for (const p of PREFIXES) if (s.startsWith(p)) {
				s = s.slice(p.length);
				break;
			}
			s = s.replace(/^[AB]\d{3}[_\-]/, "");
			const d = s.search(/[_\-\s]\d{8}(?:[_\-\s.]|$)/);
			if (d > 0) s = s.slice(0, d);
			s = s.replace(/[（(][^）)]*[）)]/g, "");
			let prev;
			do {
				prev = s;
				s = s.replace(TAIL, "");
			} while (s !== prev);
			return s.replace(/[_\-\s]+$/, "").trim();
		}
		/** 明显的噪音主题（脚本名、编号、过短）——不当作功能 */
		function isNoise(t) {
			if (!t || t.length <= 1) return true;
			if (/^\d/.test(t)) return true;
			if (/^(CS|DEC|EVD|ASM|EXP|GATE|WRUN|LRN|VOI|ISSUE)[-_]/i.test(t)) return true;
			if (/^[A-Za-z]{1,2}$/.test(t)) return true;
			return false;
		}
		/** 文件名里的日期 YYYYMMDD（没有则空串） */
		function dateOf(name) {
			const m = /(\d{8})/.exec(String(name));
			return m ? m[1] : "";
		}
		//#endregion
		//#region src/pure/mdspec.ts
		/**
		* 产出规范驱动的章节切分与归类（四种输入方式产出规范-v1 §五）
		*
		* ★ 工单 03（WorkspacePort 接缝）从 `src/client.js` **逐字搬来**，只做了整体去缩进与补 export；
		*   正文一字未改（行为不变的证据：临时 harness 对真实工作区数据做迁移前后 deepEqual）。
		* 三分法：设计信息（显示）/ 元数据（省略）/ 治理自检（折叠）；未知章节不丢。
		*/
		function parseMdSections(text) {
			const lines = String(text || "").split(/\r?\n/);
			const out = [];
			let cur = null;
			for (const line of lines) {
				const m = /^(#{1,2})\s+(.*)$/.exec(line);
				if (m && m[1].length === 2) {
					if (cur) out.push(cur);
					cur = {
						title: m[2].trim(),
						body: []
					};
					continue;
				}
				if (cur) cur.body.push(line);
			}
			if (cur) out.push(cur);
			return out.map((s) => ({
				title: s.title,
				body: s.body.join("\n").replace(/^\s+|\s+$/g, "")
			}));
		}
		/** 标题 → 归类；cls: top(置顶) / body(主体) / fold(折叠) / skip(省略) */
		function classifyHeading(title, rules) {
			for (const r of rules) if (r.re.test(title)) return r.cls;
			return null;
		}
		const MD_SPECS = [
			{
				name: "体验报告",
				match: /^experience-report_/i,
				sections: [
					{
						re: /一句话总评/,
						cls: "top"
					},
					{
						re: /是否值得复刻/,
						cls: "top"
					},
					{
						re: /核心机制拆解/,
						cls: "body"
					},
					{
						re: /功能账本/,
						cls: "body"
					},
					{
						re: /问题列表与问题卡/,
						cls: "body"
					},
					{
						re: /画面序列拆解/,
						cls: "body"
					},
					{
						re: /验证计划/,
						cls: "body"
					},
					{
						re: /样本边界门|决策声明|品类路由|工具与访问状态/,
						cls: "fold"
					},
					{
						re: /治理检查/,
						cls: "fold"
					},
					{
						re: /样本元信息|结构化输出/,
						cls: "skip"
					}
				]
			},
			{
				name: "复刻规格",
				match: /^replication-spec_/i,
				sections: [
					{
						re: /待裁决取舍清单/,
						cls: "top"
					},
					{
						re: /迁移边界/,
						cls: "top"
					},
					{
						re: /功能规则候选/,
						cls: "body"
					},
					{
						re: /UI 结构与交互流程/,
						cls: "body"
					},
					{
						re: /数值表现/,
						cls: "fold"
					},
					{
						re: /推断配置项/,
						cls: "fold"
					},
					{
						re: /样本边界/,
						cls: "fold"
					}
				]
			},
			{
				name: "设计核三角报告",
				match: /^concept-triage_/i,
				sections: [
					{
						re: /Design Nucleus Options/,
						cls: "top"
					},
					{
						re: /Assumption Ledger/,
						cls: "top"
					},
					{
						re: /Original Idea/,
						cls: "body"
					},
					{
						re: /Concept Seed Extraction/,
						cls: "body"
					},
					{
						re: /Player Verb Inventory/,
						cls: "body"
					},
					{
						re: /Action-Goal Alignment/,
						cls: "body"
					},
					{
						re: /Recommended Next Step/,
						cls: "body"
					},
					{
						re: /Case Visibility|External Evidence Status|Quality Gate/,
						cls: "fold"
					},
					{
						re: /治理引用/,
						cls: "skip"
					}
				]
			},
			{
				name: "功能设计稿",
				match: /^feature-concept_/i,
				sections: [
					{
						re: /Player Promise/,
						cls: "top"
					},
					{
						re: /Core Loop/,
						cls: "top"
					},
					{
						re: /Validation Plan/,
						cls: "top"
					},
					{
						re: /Key Systems/,
						cls: "body"
					},
					{
						re: /Uncertainty Calibration/,
						cls: "body"
					},
					{
						re: /Scope Gate/,
						cls: "body"
					},
					{
						re: /Assumption Ledger/,
						cls: "body"
					},
					{
						re: /Risk Register/,
						cls: "body"
					},
					{
						re: /下一步/,
						cls: "body"
					},
					{
						re: /Production Feasibility/,
						cls: "fold"
					},
					{
						re: /配置项预测/,
						cls: "fold"
					}
				]
			},
			{
				name: "证据索引",
				match: /^evidence-index_/i,
				sections: [
					{
						re: /Evidence Index/,
						cls: "top"
					},
					{
						re: /置信度说明/,
						cls: "body"
					},
					{
						re: /时间戳账本/,
						cls: "fold"
					}
				]
			},
			{
				name: "读回验收报告",
				match: /^readback_/i,
				sections: [
					{
						re: /结论/,
						cls: "top"
					},
					{
						re: /必达项对照/,
						cls: "body"
					},
					{
						re: /追加项/,
						cls: "fold"
					},
					{
						re: /报告头/,
						cls: "fold"
					}
				]
			}
		];
		function mdSpecOf(path) {
			const name = String(path || "").split(/[\\/]/).pop() || "";
			for (const s of MD_SPECS) if (s.match.test(name)) return s;
			return null;
		}
		//#endregion
		//#region src/pure/buckets.ts
		/**
		* 产物分类（功能 = 目录；sub 目录本身即答案）
		*
		* ★ 工单 03（WorkspacePort 接缝）从 `src/client.js` **逐字搬来**，只做了整体去缩进与补 export；
		*   正文一字未改（行为不变的证据：临时 harness 对真实工作区数据做迁移前后 deepEqual）。
		* 新结构按子目录归桶；gdd\ 内部再按文件名细分（artifactBucket）。旧结构前缀表只减不增。
		*/
		const DIR_BUCKET$1 = {
			analysis: "analysis",
			gdd: "gdd",
			decisions: "decisions",
			evidence: "evidence",
			source: "source",
			delivery: "delivery"
		};
		/**
		* `gdd\` 内部的细分（工单 12：「gdd\ 内部再按文件名细分一次」）。
		*
		* 判据全在**文件名**上——这是**唯一**允许按文件名分的地方，因为 `gdd\` 是一个
		* 混装目录（成稿 / 定稿 / 审查 / 修订点 / 定稿派生的 HTML）。别的桶一律按目录归类。
		*
		* 返回值 → 显示标签：
		*   final 定稿 · finalHtml 定稿 HTML · review 审查 · fixpoints 修订点 · draft 成稿 · others 其它
		*/
		function gddKindOf(name) {
			const n = String(name || "");
			if (!n) return "others";
			if (/_定稿_审查\.md$/i.test(n) || /_审查\.md$/i.test(n)) return "review";
			if (/_定稿\.md$/i.test(n)) return "final";
			if (/_定稿\.html?$/i.test(n)) return "finalHtml";
			if (/_修订点\.md$/i.test(n)) return "fixpoints";
			if (/_宣讲_.*\.html$/i.test(n)) return "speech";
			if (/_宣讲_.*\.content\.json$/i.test(n)) return "speechSrc";
			if (/\.md$/i.test(n)) return "draft";
			return "others";
		}
		/** gdd 细分 kind → 面板上的短标签 */
		const GDD_KIND_LABEL = {
			final: "定稿",
			finalHtml: "定稿 HTML",
			review: "审查",
			fixpoints: "修订点",
			draft: "成稿",
			speech: "宣讲",
			speechSrc: "宣讲源",
			others: "其它"
		};
		//#endregion
		//#region src/pure/fieldclass.ts
		/**
		* 字段归类表（79 个真实键 + 4 个"代码在读但本功能数据里没有"的键）。
		*
		* 来源：`17-classify-fields.mjs`（工单 17 的交付物，已在真实数据上跑出「悬空 0」）
		* → 这里**逐行搬成仓库内的数据模块**，`why` / `take` 一字不改，便于与本仓库的检查结果对账。
		*/
		const LEDGER_FIELD_CLASSIFICATION = {
			"decision_result": {
				klass: "container",
				why: "容器：它的每个子键各自归类",
				take: "—"
			},
			"options": {
				klass: "container",
				why: "容器：候选集合；子键一律 exclude_proposal",
				take: "—"
			},
			"options[].*": {
				klass: "container",
				why: "容器（数组元素）：子键一律 exclude_proposal",
				take: "—"
			},
			"materials": {
				klass: "container",
				why: "容器：输入材料清单",
				take: "—"
			},
			"assumption_ledger": {
				klass: "container",
				why: "容器：假设台账",
				take: "—"
			},
			"chosen_nucleus": {
				klass: "container",
				why: "容器：设计核",
				take: "—"
			},
			"title": {
				klass: "collect",
				why: "决策记录标题本身就是一句完整的拍板结论（旧实现已在收）",
				take: "j.title"
			},
			"decision_question": {
				klass: "collect",
				why: "摆给人选的那个问题——台账叙述的起点（与结论成对可读）",
				take: "j.decision_question（可与 title 同行合并展示）"
			},
			"decision_type": {
				klass: "collect",
				why: "判阶段的依据（门名缺失时按它判阶段）",
				take: "用于 stageOfDecision，不单独成行"
			},
			"gate": {
				klass: "collect",
				why: "判阶段的依据（有门名则按门名判阶段）",
				take: "用于 stageOfGate，不单独成行"
			},
			"owner": {
				klass: "collect",
				why: "谁负责这次决定（人）——与 accepted_by 同类",
				take: "j.owner"
			},
			"accepted_by": {
				klass: "collect",
				why: "谁拍的板（人做的决定的第一要件）",
				take: "j.accepted_by"
			},
			"accepted_reason": {
				klass: "collect",
				why: "接受理由——人给的理由就该进叙述",
				take: "j.accepted_reason"
			},
			"current_default_action": {
				klass: "collect",
				why: "门内「不改会怎样」的默认动作，是本次拍板的对照物",
				take: "j.current_default_action"
			},
			"reversibility": {
				klass: "collect",
				why: "可逆性由门内定（决策属性）",
				take: "j.reversibility"
			},
			"stakes": {
				klass: "collect",
				why: "赌注大小由门内定（决策属性）",
				take: "j.stakes"
			},
			"boundary_status": {
				klass: "collect",
				why: "边界状态由门内定（决策属性）",
				take: "j.boundary_status"
			},
			"rollback_trigger": {
				klass: "collect",
				why: "回滚触发条件属设计约束",
				take: "j.rollback_trigger"
			},
			"decision_result.combination": {
				klass: "collect",
				why: "选定设计核组合（旧实现已在收）",
				take: "r.combination"
			},
			"decision_result.chosen": {
				klass: "collect",
				why: "被选中的候选编号（配合 options 才能读成人话）",
				take: "r.chosen（不单独成行，用于定位被选项）"
			},
			"decision_result.gate": {
				klass: "collect",
				why: "门名（判阶段用）",
				take: "用于 stageOfGate，不单独成行"
			},
			"decision_result.note": {
				klass: "collect",
				why: "为什么这么选（旧实现已在收）",
				take: "r.note"
			},
			"decision_result.kill_signal": {
				klass: "collect",
				why: "证伪条件属设计约束（旧实现已在收）",
				take: "r.kill_signal"
			},
			"decision_result.calibrations": {
				klass: "collect",
				why: "**台账主体**：门内每一轮用户拍板要点（旧实现已在收）",
				take: "r.calibrations[].input + .gate + .ts"
			},
			"decision_result.gdd_draft_gate": {
				klass: "collect",
				why: "成稿门结果（旧实现已在收）",
				take: "r.gdd_draft_gate.{chosen,result,handoff_target,note}"
			},
			"decision_result.settled_choices": {
				klass: "collect",
				why: "逐条拍板选择（代码在读；本功能数据里没有，诸神降临有 T1–T7）",
				take: "r.settled_choices.*（value/text/note）"
			},
			"decision_result.settled_choices.*": {
				klass: "collect",
				why: "逐条拍板选择（代码在读）",
				take: "r.settled_choices.*（value/text/note）"
			},
			"decision_result.handoff_gate": {
				klass: "collect",
				why: "交接门结果（代码在读）",
				take: "r.handoff_gate.{chosen,result,handoff_target,note}"
			},
			"handoff_gate.handoff_target": {
				klass: "collect",
				why: "交接门结果（代码在读）",
				take: "r.handoff_gate.handoff_target"
			},
			"chosen_nucleus.statement": {
				klass: "collect",
				why: "设计核一句话（旧实现已在收）",
				take: "cn.statement"
			},
			"chosen_nucleus.combination": {
				klass: "collect",
				why: "设计核组合",
				take: "cn.combination"
			},
			"chosen_nucleus.key_tension": {
				klass: "collect",
				why: "设计核的核心张力（拍板依据）",
				take: "cn.key_tension"
			},
			"chosen_nucleus.kill_signal": {
				klass: "collect",
				why: "设计核的证伪信号",
				take: "cn.kill_signal"
			},
			"chosen_nucleus.id": {
				klass: "collect",
				why: "设计核编号（定位用）",
				take: "cn.id（不单独成行）"
			},
			"calibrated_facts": {
				klass: "collect",
				why: "已确认下来的设计口径（旧实现已在收，是头脑风暴阶段的主要载体）",
				take: "j.calibrated_facts[]"
			},
			"assumption_ledger.closed": {
				klass: "collect",
				why: "已确认假设（旧实现已在收）",
				take: "al.closed[]"
			},
			"assumption_ledger.open": {
				klass: "collect",
				why: "未决假设——它是「当时还没定」的如实记录",
				take: "al.open[]"
			},
			"open_questions_for_gdd": {
				klass: "collect",
				why: "留给成稿的未决问题（人当时认下的待办性结论）",
				take: "j.open_questions_for_gdd[]"
			},
			"input": {
				klass: "collect",
				why: "校准流水里的用户原话（旧实现已在收）",
				take: "calibration.jsonl 的 input"
			},
			"affected": {
				klass: "collect",
				why: "该轮拍板影响了哪些条目——「这条决定牵动了什么」的结构信息",
				take: "calibration.affected[]（可作同行后缀）"
			},
			"next_step": {
				klass: "exclude_agent",
				why: "交接口径的下一步动作",
				take: "—"
			},
			"decision_result.files": {
				klass: "exclude_agent",
				why: "agent 改了哪些文件",
				take: "—"
			},
			"decision_result.changes": {
				klass: "exclude_agent",
				why: "agent 的技术改动清单（代码注释已明确不收）",
				take: "—"
			},
			"decision_result.post_gate_fixes": {
				klass: "exclude_agent",
				why: "门后修复改动汇总（审计面）",
				take: "—"
			},
			"decision_result.post_gate_fix_20260929": {
				klass: "exclude_agent",
				why: "同上（按日期分文件）",
				take: "—"
			},
			"decision_result.conditions_completed": {
				klass: "exclude_agent",
				why: "执行细节（代码注释已明确不收）",
				take: "—"
			},
			"decision_result.remaining_items": {
				klass: "exclude_agent",
				why: "执行细节（代码注释已明确不收）",
				take: "—"
			},
			"decision_result.open_items": {
				klass: "exclude_agent",
				why: "落地待办（审计面）",
				take: "—"
			},
			"decision_result.diagram_swap": {
				klass: "exclude_agent",
				why: "线框图替换动作（代码注释已明确不收）",
				take: "—"
			},
			"decision_result.config_action": {
				klass: "exclude_agent",
				why: "配置侧动作记录",
				take: "—"
			},
			"decision_result.impact_scan": {
				klass: "exclude_agent",
				why: "影响面扫描结果（工具产物）",
				take: "—"
			},
			"decision_result.verification": {
				klass: "exclude_agent",
				why: "验证动作记录",
				take: "—"
			},
			"decision_result.report_path": {
				klass: "exclude_agent",
				why: "产物路径",
				take: "—"
			},
			"decision_result.handoff_json": {
				klass: "exclude_agent",
				why: "产物路径",
				take: "—"
			},
			"decision_result.feature_concept": {
				klass: "exclude_agent",
				why: "产物路径",
				take: "—"
			},
			"decision_result.gdd_draft": {
				klass: "exclude_agent",
				why: "产物路径",
				take: "—"
			},
			"decision_result.knowledge_base_note": {
				klass: "exclude_agent",
				why: "知识库笔记指针",
				take: "—"
			},
			"decision_result.next_step": {
				klass: "exclude_agent",
				why: "下一步动作（不是已做的决定）",
				take: "—"
			},
			"decision_result.mode": {
				klass: "exclude_agent",
				why: "运行模式（工具参数）",
				take: "—"
			},
			"schema_version": {
				klass: "exclude_meta",
				why: "契约版本",
				take: "—"
			},
			"decision_id": {
				klass: "exclude_meta",
				why: "ID（台账按设计要求不显示 ID）",
				take: "—"
			},
			"handoff_id": {
				klass: "exclude_meta",
				why: "ID",
				take: "—"
			},
			"status": {
				klass: "exclude_meta",
				why: "状态词（台账明确不加状态词）",
				take: "—"
			},
			"topic": {
				klass: "exclude_meta",
				why: "主题名",
				take: "—"
			},
			"source_skill": {
				klass: "exclude_meta",
				why: "来源 skill",
				take: "—"
			},
			"target_skill": {
				klass: "exclude_meta",
				why: "去向 skill",
				take: "—"
			},
			"created_at": {
				klass: "exclude_meta",
				why: "时间戳（排序/分组用）",
				take: "—"
			},
			"updated_at": {
				klass: "exclude_meta",
				why: "时间戳（排序/分组用）",
				take: "—"
			},
			"ts": {
				klass: "exclude_meta",
				why: "排序/分组键",
				take: "—"
			},
			"round": {
				klass: "exclude_meta",
				why: "排序键（去重要用），不是台账内容",
				take: "—"
			},
			"evidence_refs": {
				klass: "exclude_meta",
				why: "引用列表（空值多）",
				take: "—"
			},
			"assumption_refs": {
				klass: "exclude_meta",
				why: "引用列表",
				take: "—"
			},
			"experiment_refs": {
				klass: "exclude_meta",
				why: "引用列表",
				take: "—"
			},
			"gate_refs": {
				klass: "exclude_meta",
				why: "引用列表",
				take: "—"
			},
			"config_prediction_ref": {
				klass: "exclude_meta",
				why: "引用指针",
				take: "—"
			},
			"risk_register_ref": {
				klass: "exclude_meta",
				why: "引用指针",
				take: "—"
			},
			"materials.concept_triage_report": {
				klass: "exclude_meta",
				why: "输入材料路径",
				take: "—"
			},
			"materials.decision_record": {
				klass: "exclude_meta",
				why: "输入材料路径",
				take: "—"
			},
			"materials.feature_concept": {
				klass: "exclude_meta",
				why: "输入材料路径",
				take: "—"
			},
			"materials.original_brief": {
				klass: "exclude_meta",
				why: "输入材料路径",
				take: "—"
			},
			"materials.original_brief_note": {
				klass: "exclude_meta",
				why: "输入材料备注",
				take: "—"
			},
			"options[].option_id": {
				klass: "exclude_proposal",
				why: "候选编号",
				take: "—（只用于解析 chosen）"
			},
			"options[].action": {
				klass: "exclude_proposal",
				why: "候选动作描述；**只当 chosen 指向它时**才以「结论」形态出现",
				take: "—（经 r.chosen 定位后由 combination/title 表达）"
			},
			"options[].expected_benefit": {
				klass: "exclude_proposal",
				why: "候选的预期收益（agent 说的）",
				take: "—"
			},
			"options[].main_risk": {
				klass: "exclude_proposal",
				why: "候选的主要风险（agent 说的）",
				take: "—"
			}
		};
		/** 键的归一：`options[] . action` / `options[]. action` → `options[].action`（交付物表格排版会多空格） */
		function normalizeFieldKey(key) {
			return String(key).replace(/\[\]\s*\.\s*/g, "[].").trim();
		}
		/** 查归类表：先精确，再数组元素通配（`options[].action` → `options[].*`），最后父级通配（`a.b.C` → `a.b.*`） */
		function classifyField(key) {
			const k = normalizeFieldKey(key);
			const exact = LEDGER_FIELD_CLASSIFICATION[k];
			if (exact) return exact;
			const arr = k.replace(/\[\]\.[^.]*$/, "[].*");
			if (arr !== k && LEDGER_FIELD_CLASSIFICATION[arr]) return LEDGER_FIELD_CLASSIFICATION[arr];
			const star = k.replace(/\.[^.]+$/, ".*");
			if (star !== k && LEDGER_FIELD_CLASSIFICATION[star]) return LEDGER_FIELD_CLASSIFICATION[star];
			return null;
		}
		/**
		* 一条记录里"必须已归类"的键：顶层键 + 一级子键（对象值）+ **顶层**数组的元素键。
		* 与 17 交付物的口径一致（见文件头的覆盖深度声明）。
		*/
		function fieldKeysOf(doc) {
			const out = [];
			if (!doc || typeof doc !== "object" || Array.isArray(doc)) return out;
			const obj = doc;
			for (const k of Object.keys(obj)) {
				out.push(k);
				const v = obj[k];
				if (Array.isArray(v)) {
					const first = v.find((x) => x && typeof x === "object" && !Array.isArray(x));
					if (first) for (const k2 of Object.keys(first)) out.push(k + "[]." + k2);
				} else if (v && typeof v === "object") for (const k2 of Object.keys(v)) out.push(k + "." + k2);
			}
			return out;
		}
		function docOf(src) {
			if (src.doc) return src.doc;
			if (!src.text) return null;
			try {
				return JSON.parse(src.text);
			} catch (e) {
				return null;
			}
		}
		/**
		* 字段覆盖检查（17 的核心）：遍历所有源记录里"必须已归类"的键 → 逐个查归类表
		* → **表里没有 = error**（不是警告），并指明是哪个文件里的哪个键。
		*
		* @param input.sources `{where, doc|text}` 列表（决策记录 / 校准流水行 / 交接 JSON 都算）
		*/
		function checkFieldCoverage(input) {
			const sources = input && input.sources || [];
			const dangling = [];
			const pending = [];
			const classes = {};
			const distinct = /* @__PURE__ */ new Set();
			let checked = 0;
			for (const src of sources) {
				if (!src || !src.where) continue;
				const doc = docOf(src);
				if (!doc) continue;
				for (const raw of fieldKeysOf(doc)) {
					checked++;
					const k = normalizeFieldKey(raw);
					distinct.add(k);
					const rule = classifyField(k);
					if (!rule) {
						dangling.push({
							key: k,
							where: src.where
						});
						continue;
					}
					if (rule.klass === "pending_user") {
						pending.push({
							key: k,
							where: src.where
						});
						continue;
					}
					classes[rule.klass] = (classes[rule.klass] || 0) + 1;
				}
			}
			const unknown = dangling.concat(pending);
			return {
				checked,
				distinct: distinct.size,
				keys: Array.from(distinct).sort(),
				classes,
				dangling,
				pending,
				unknown,
				ok: unknown.length === 0,
				issues: unknown.map((u) => ({
					code: "V17",
					level: "error",
					msg: "字段 `" + u.key + "` 未归类（" + u.where + "）——谁来读它、收不收必须显式判定：不归类就不允许落库，先在 src/pure/fieldclass.ts 的归类表里加一行",
					lines: [],
					files: [u.where]
				}))
			};
		}
		//#endregion
		//#region src/pure/ledger.ts
		/**
		* 设计台账派生（设计 §7）
		*
		* ★ 工单 03（WorkspacePort 接缝）从 `src/client.js` **逐字搬来**，只做了整体去缩进与补 export；
		*   正文一字未改（行为不变的证据：临时 harness 对真实工作区数据做迁移前后 deepEqual）。
		* 从已有结构化源实时派生：决策记录 / 校准 jsonl / 交接 JSON。不新增文件。
		*
		* ★ 工单 17 补的那一步：**字段覆盖检查**（`./fieldclass.ts`）——
		*   派生过程本身就把每条源记录的键过一遍归类表，**悬空即报错**（error，不是警告）。
		*   检查跑在"派生时已经 parse 好的 doc"上，不再多读一次磁盘。
		*/
		function stageOfGate(gate) {
			const g = String(gate || "");
			if (/设计核|交接门|概念|设计稿迭代/.test(g)) return 1;
			if (/gdd-fix|修订门|定稿修订|定稿门后/i.test(g)) return 3;
			if (/成稿门|定稿门|成稿|定稿/.test(g)) return 2;
			return 2;
		}
		/** 没有 gate 字段时，用 decision_type 判阶段 */
		function stageOfDecision(dt) {
			const t = String(dt || "");
			if (/concept|prototype|idea|information|validation|scope_gate/.test(t)) return 1;
			return 2;
		}
		const LEDGER_STAGES = [
			"阶段一 · 头脑风暴",
			"阶段二 · 文档生成",
			"阶段三 · 定稿修订"
		];
		function buildLedger(inputs) {
			const decs = inputs && inputs.decisions || [];
			const cals = inputs && inputs.calibrations || [];
			const hoffs = inputs && inputs.handoffs || [];
			const items = [];
			const notes = [];
			const d8 = (s) => String(s || "").slice(0, 10).replace(/-/g, "");
			const covSources = [];
			for (const h of hoffs) {
				if (!h) continue;
				let j = h.doc || null;
				if (!j && h.text) try {
					j = JSON.parse(h.text);
				} catch (e) {
					continue;
				}
				if (!j) continue;
				covSources.push({
					where: "analysis/" + h.name,
					doc: j
				});
				const date = d8(j.created_at);
				const ts = String(j.created_at || "");
				const src = h.name + " · 交接";
				const cn = j.chosen_nucleus;
				if (cn && cn.statement) items.push({
					stage: 1,
					date,
					ts,
					src,
					text: "设计核：" + cn.statement
				});
				for (const f of j.calibrated_facts || []) if (f) items.push({
					stage: 1,
					date,
					ts,
					src,
					text: String(f)
				});
				const al = j.assumption_ledger;
				if (al && Array.isArray(al.closed) && al.closed.length) items.push({
					stage: 1,
					date,
					ts,
					src,
					text: "已确认假设（" + al.closed.length + " 项）：" + al.closed.join(" / ")
				});
			}
			for (const d of decs) {
				if (!d) continue;
				let j = d.doc || null;
				if (!j && d.text) try {
					j = JSON.parse(d.text);
				} catch (e) {
					notes.push("决策记录解析失败：" + d.name);
					continue;
				}
				if (!j) continue;
				covSources.push({
					where: "decisions/" + d.name,
					doc: j
				});
				const r = j && j.decision_result || {};
				const date = d8(j.updated_at || j.created_at);
				const ts = String(j.created_at || j.updated_at || "");
				const stage = r.gate ? stageOfGate(r.gate) : stageOfDecision(j.decision_type);
				const line = r.combination ? "选定设计核：" + r.combination : String(j.title || "").trim();
				if (line) items.push({
					stage,
					date,
					ts,
					src: d.name,
					text: line
				});
				const sc = r.settled_choices;
				if (sc && typeof sc === "object") for (const k in sc) {
					let v = sc[k];
					if (v && typeof v === "object") v = v.text || v.note || v.value || "";
					if (!v) continue;
					items.push({
						stage,
						date,
						ts,
						src: d.name,
						text: String(v).trim()
					});
				}
				for (const gk of ["gdd_draft_gate", "handoff_gate"]) {
					const g = r[gk];
					if (!g || typeof g !== "object") continue;
					const label = gk === "gdd_draft_gate" ? "成稿门" : "交接门";
					const what = String(g.chosen || g.result || "").trim();
					const to = g.handoff_target ? " → " + String(g.handoff_target).trim() : "";
					const why = g.note ? "（" + String(g.note).trim() + "）" : "";
					if (what || to || why) items.push({
						stage,
						date,
						ts,
						src: d.name,
						text: label + "：" + what + to + why
					});
				}
				if (typeof r.note === "string" && r.note.trim()) items.push({
					stage,
					date,
					ts,
					src: d.name,
					text: r.note.trim()
				});
				if (typeof r.kill_signal === "string" && r.kill_signal.trim()) items.push({
					stage: 1,
					date,
					ts,
					src: d.name,
					text: "证伪条件：" + r.kill_signal.trim()
				});
				for (const c of r.calibrations || []) {
					if (!c || !c.input) continue;
					items.push({
						stage: stageOfGate(c.gate),
						date: d8(c.ts),
						ts: String(c.ts || ""),
						src: d.name + " · 迭代",
						round: c.round,
						text: c.input
					});
				}
			}
			const seen = new Set(items.filter((i) => i.round !== void 0 && i.round !== null).map((i) => String(i.round)));
			let fromJsonl = 0;
			for (const c of cals) {
				let rows = c && c.rows || null;
				if (!rows) {
					rows = [];
					for (const ln of String(c && c.text || "").split(/\r?\n/)) {
						const s = ln.trim();
						if (!s || s.charAt(0) !== "{") continue;
						try {
							rows.push(JSON.parse(s));
						} catch (e) {}
					}
				}
				for (const o of rows) {
					if (o) covSources.push({
						where: "evidence/" + c.name,
						doc: o
					});
					if (!o || !o.input) continue;
					const rk = String(o.round);
					if (seen.has(rk)) continue;
					seen.add(rk);
					fromJsonl++;
					items.push({
						stage: stageOfGate(o.gate),
						date: d8(o.ts),
						ts: String(o.ts || ""),
						src: c.name,
						round: o.round,
						text: o.input
					});
				}
			}
			const stages = [];
			for (let s = 1; s <= 3; s++) {
				const mine = items.filter((i) => i.stage === s).sort((a, b) => String(a.ts) < String(b.ts) ? -1 : 1);
				const byDate = /* @__PURE__ */ new Map();
				for (const it of mine) {
					if (!byDate.has(it.date)) byDate.set(it.date, []);
					byDate.get(it.date).push(it);
				}
				stages.push({
					id: s,
					name: LEDGER_STAGES[s - 1],
					count: mine.length,
					days: Array.from(byDate.entries()).map((kv) => ({
						date: kv[0],
						items: kv[1]
					}))
				});
			}
			const fieldCheck = checkFieldCoverage({ sources: covSources });
			for (const u of fieldCheck.unknown) notes.push("未归类字段：" + u.key + "（" + u.where + "）");
			return {
				stages,
				total: items.length,
				notes,
				stats: {
					fromDecision: items.length - fromJsonl,
					fromJsonl
				},
				fieldCheck
			};
		}
		/**
		* 从 loadLedger 的产物派生设计台账（设计 §7）。
		*
		* ★ 刻意放在**渲染期**算，而不是加载期：
		*   ① 加载期算的话，`ledger` 这坨 state 就把"当时的派生结果"冻住了——
		*      代码热更新后，state 还是旧结构（没有新字段），于是界面上明明有数据却显示"台账为空"；
		*   ② 渲染期算则数据一变就重算，不依赖"加载那一刻的代码版本"。
		*   纯函数、零 IO，代价可忽略。
		*/
		function ledgerOf(L) {
			if (!L || !L.records) return null;
			if (L.error) return {
				error: L.error,
				stages: [],
				total: 0,
				notes: [],
				stats: {
					fromDecision: 0,
					fromJsonl: 0
				},
				fieldCheck: null
			};
			const calByFile = /* @__PURE__ */ new Map();
			for (const c of L.calibration || []) {
				if (!calByFile.has(c.file)) calByFile.set(c.file, []);
				calByFile.get(c.file).push(c.row);
			}
			return buildLedger({
				decisions: L.records.map((r) => ({
					name: r.file,
					doc: r.doc
				})),
				calibrations: Array.from(calByFile.entries()).map((kv) => ({
					name: kv[0],
					rows: kv[1]
				})),
				handoffs: L.handoffs || []
			});
		}
		//#endregion
		//#region src/pure/artifacts.ts
		/**
		* 功能详情 · 产物清单（工单 12）
		*
		* 口径（工单 12 逐条）：
		*   ① **只认子目录、不猜文件名**：桶由"文件在哪个子目录下"决定（`DIR_BUCKET`），
		*      唯一允许按文件名细分的地方是 `gdd\`（一个混装目录：成稿 / 定稿 / 审查 / 修订点 / 定稿 HTML）。
		*   ② `gdd\` 的细分与 `artifactBucket` **同源**（`buckets.gddKindOf`），不另写一套判据。
		*   ③ `mdSpecOf`（`./mdspec.ts`，工单 32 已接的模块）用来给**分析类 md** 标注产出规范名
		*      （体验报告 / 复刻规格 / 设计核三角报告 …）。★ 它**只作标注，不作过滤**：
		*      认不出来也照样列出（否则又变成"猜文件名"）。
		*      实测：它的六种规范里没有一种匹配 `gdd\` 的文件（`mdSpecOf("联盟悬赏_20260923_定稿.md") === null`），
		*      所以 gdd 的细分用 `gddKindOf`——两件事不要混。
		*   ④ 三个含义（`MEANINGS`）来自 `CONTEXT.md` 的产物桶定义：进 = 原料；出 = 产物；过程留痕。
		*   ⑤ **一个文件都不许静默丢**：不是桶的目录、功能根下的散文件，都如实出现在 `未归桶` 组里。
		*      这条是"详情页列出的产物与磁盘实际一致"（工单 12 的验收句）的前提。
		*   ⑥ 三阶段进度用设计 §4.2 的口径（有无分析产物 / 有无成稿 / 有无定稿），阶段名取自
		*      `./ledger.ts` 的 `LEDGER_STAGES`（台账的同一组阶段名，不另起名字）。
		*
		* 纯函数、零 IO：目录列举由调用方（`src/load/feature.ts`）读进来。
		*/
		/** 桶的三个含义 + 「未归桶」兜底（顺序即面板上的显示顺序） */
		const MEANINGS = [
			{
				key: "in",
				label: "进 · 原料"
			},
			{
				key: "out",
				label: "出 · 产物"
			},
			{
				key: "trace",
				label: "过程留痕"
			},
			{
				key: "other",
				label: "未归桶（如实列出，不丢）"
			}
		];
		/** 六个标准桶 → 面板分组（`dir` 必须与 `DIR_BUCKET` 的键一致） */
		const BUCKET_GROUPS = [
			{
				dir: "source",
				label: "原料",
				meaning: "in",
				note: "喂进去的源文件（截图 / 录屏 / 旧文档原件 / UE 交付物）"
			},
			{
				dir: "analysis",
				label: "分析产出",
				meaning: "out",
				note: "头脑风暴产物（体验报告 / 问题卡 / 复刻规格 / 概念 / 交接 JSON …）"
			},
			{
				dir: "gdd",
				label: "文档（gdd）",
				meaning: "out",
				note: "成稿 / 定稿 / 审查 / 修订点 —— 这一层按文件名再细分"
			},
			{
				dir: "delivery",
				label: "交付",
				meaning: "out",
				note: "对外产出（宣讲 HTML / AI 读版 …）"
			},
			{
				dir: "decisions",
				label: "决策记录",
				meaning: "trace",
				note: "Human Gate 的结构化留痕（审计面）"
			},
			{
				dir: "evidence",
				label: "证据",
				meaning: "trace",
				note: "分析产出的证据（抽帧 / 索引 / 时间戳账本 / 校准流水）"
			}
		];
		/** gdd 组内的显示顺序（定稿最前——它是"现在能用吗"的答案） */
		const GDD_ORDER = [
			"final",
			"finalHtml",
			"review",
			"fixpoints",
			"draft",
			"ui",
			"nested",
			"others"
		];
		const cmp = (a, b) => a < b ? -1 : a > b ? 1 : 0;
		/** 一个条目 → 视图模型（含 gdd 细分 kind 与规范名标注） */
		function fileOf(dir, name, sub) {
			const inGdd = dir === "gdd";
			let kind = "file";
			if (inGdd) kind = sub ? /^ui$/i.test(sub) ? "ui" : "nested" : gddKindOf(name);
			else if (sub) kind = "nested";
			const spec = mdSpecOf(name);
			const labelOf = () => {
				if (inGdd) return sub ? kind === "ui" ? "界面图" : "子目录" : GDD_KIND_LABEL[kind] || "其它";
				if (sub) return "子目录";
				return "";
			};
			return {
				name,
				rel: dir ? sub ? dir + "/" + sub + "/" + name : dir + "/" + name : name,
				dir,
				subdir: sub || "",
				kind,
				kindLabel: labelOf(),
				spec: spec ? String(spec.name || "") : "",
				note: ""
			};
		}
		/** 组内排序：gdd 按细分顺序（定稿在前），定稿之间按**文件名日期倒序**（最新在前），其余按文件名 */
		function sortFiles(key, files) {
			if (key === "gdd") files.sort((a, b) => {
				const d = GDD_ORDER.indexOf(a.kind) - GDD_ORDER.indexOf(b.kind);
				if (d !== 0) return d;
				if (a.kind === "final" && b.kind === "final") {
					const da = dateOf(a.name), db = dateOf(b.name);
					if (da !== db) return da < db ? 1 : -1;
				}
				return cmp(a.name, b.name);
			});
			else files.sort((a, b) => cmp(a.rel, b.rel));
			return files;
		}
		/**
		* 产物清单 → 按桶分组（详情页「产物」页签的数据源）。
		*
		* @returns `groups`（含空桶，空桶也要显示"0"，否则人以为漏了）、`allPaths`（对账用：
		*   "面板会列出的清单" 就是它，可拿去与磁盘递归列举逐条 diff）、`counts`。
		*/
		function featureArtifacts(input) {
			const inp = input || {};
			const dirs = inp.dirs || {};
			const groups = [];
			const pushGroup = (g) => {
				const files = g.files || [];
				groups.push({
					key: g.key,
					dir: g.dir,
					label: g.label,
					meaning: g.meaning,
					meaningLabel: (MEANINGS.find((m) => m.key === g.meaning) || {}).label || "",
					note: g.note || "",
					knowledge: !!g.knowledge,
					count: files.length,
					files
				});
			};
			for (const g of BUCKET_GROUPS) {
				const d = dirs[g.dir] || {};
				const files = [];
				for (const n of d.files || []) files.push(fileOf(g.dir, n, ""));
				for (const sub of Object.keys(d.nested || {}).sort()) for (const n of (d.nested || {})[sub]) files.push(fileOf(g.dir, n, sub));
				pushGroup({
					key: g.dir,
					dir: g.dir,
					label: g.label,
					meaning: g.meaning,
					note: g.note,
					knowledge: true,
					files: sortFiles(g.dir, files)
				});
			}
			for (const dir of Object.keys(dirs).filter((x) => !DIR_BUCKET$1[x]).sort()) {
				const d = dirs[dir] || {};
				const files = [];
				for (const n of d.files || []) files.push(fileOf(dir, n, ""));
				for (const sub of Object.keys(d.nested || {}).sort()) for (const n of (d.nested || {})[sub]) files.push(fileOf(dir, n, sub));
				pushGroup({
					key: dir,
					dir,
					label: dir,
					meaning: "other",
					note: "这个目录不是标准产物桶",
					files: sortFiles(dir, files)
				});
			}
			const rootFiles = (inp.rootFiles || []).slice().sort();
			if (rootFiles.length) pushGroup({
				key: "root",
				dir: "",
				label: "功能根（散文件）",
				meaning: "other",
				note: "不在任何桶里 —— 如功能身份文件 / 设计台账",
				files: rootFiles.map((n) => fileOf("", n, ""))
			});
			const allPaths = [];
			const counts = {
				in: 0,
				out: 0,
				trace: 0,
				other: 0
			};
			for (const g of groups) {
				counts[g.meaning] = (counts[g.meaning] || 0) + g.count;
				for (const f of g.files) allPaths.push(f.rel);
			}
			const total = allPaths.length;
			return {
				groups,
				meanings: MEANINGS,
				counts,
				total,
				allPaths,
				/** 如实声明列举深度：更深层的子目录没有展开（有就报出来，不假装列全了） */
				notes: (inp.deepDirs || []).map((d) => "未展开更深一层：" + d),
				/** 只列**已有内容**的组（面板默认渲染这些；空桶在摘要行里用 0 表示） */
				nonEmpty: groups.filter((g) => g.count > 0).map((g) => g.key)
			};
		}
		/** 从产物清单取"某桶有几个文件"（0 也如实返回） */
		function countOf$1(artifacts, dir) {
			const g = (artifacts && artifacts.groups || []).find((x) => x.key === dir);
			return g ? g.count : 0;
		}
		/** 某桶里细分 kind 的个数（如 gdd 里几份定稿） */
		function countKind(artifacts, dir, kind) {
			const g = (artifacts && artifacts.groups || []).find((x) => x.key === dir);
			if (!g) return 0;
			return g.files.filter((f) => f.kind === kind).length;
		}
		/**
		* 三阶段进度（设计 §4.2「走到哪了」：有无分析产物 / 有无成稿 / 有无定稿）。
		* 阶段名与设计台账同一组（`LEDGER_STAGES`），免得两个页面对"阶段一"的理解不一样。
		*/
		function stageProgress(artifacts) {
			const analysis = countOf$1(artifacts, "analysis");
			const source = countOf$1(artifacts, "source");
			const draft = countKind(artifacts, "gdd", "draft");
			const finals = countKind(artifacts, "gdd", "final");
			const reviews = countKind(artifacts, "gdd", "review");
			const fixpoints = countKind(artifacts, "gdd", "fixpoints");
			const stageList = [
				{
					key: "brainstorm",
					label: LEDGER_STAGES[0],
					done: analysis > 0,
					evidence: "分析产物 " + analysis + " 件"
				},
				{
					key: "draft",
					label: LEDGER_STAGES[1],
					done: draft + finals > 0,
					evidence: "成稿 " + draft + " · 定稿 " + finals
				},
				{
					key: "review",
					label: LEDGER_STAGES[2],
					done: finals > 0,
					evidence: "定稿 " + finals + " · 审查 " + reviews + (fixpoints ? " · 修订点 " + fixpoints : "")
				}
			];
			const done = stageList.filter((s) => s.done).length;
			const note = analysis === 0 && source > 0 ? "source 里有 " + source + " 个源文件，但 analysis 还是空的 —— 建议先跑一次分析（原始素材不能直接当结论用）" : "";
			return {
				stages: stageList,
				done,
				total: stageList.length,
				note
			};
		}
		/**
		* 把"当前有效定稿"标到 gdd 组里的定稿条目上 —— 面板不用自己判（判据只在 `checkFinals` 里）。
		* 三个标注：当前有效 / 也标 active（未归档）/ 历史版本。
		*/
		function annotateFinals(artifacts, finalCheck) {
			const cur = finalCheck && finalCheck.current;
			const actives = new Set(finalCheck && finalCheck.actives || []);
			for (const g of artifacts && artifacts.groups || []) {
				if (g.key !== "gdd") continue;
				for (const f of g.files) {
					if (f.kind !== "final") continue;
					if (cur && f.name === cur) f.note = finalCheck.currentFrom === "active" ? "当前有效（active）" : "当前有效（按日期取最新；没有 active）";
					else if (actives.has(f.name)) f.note = "也标 active —— 未归档，取代关系只是派生的";
					else f.note = "历史版本";
				}
			}
			return artifacts;
		}
		//#endregion
		//#region src/pure/finalgdd.ts
		/**
		* 定稿解析与定稿有效性校验（设计 §6.1 / §6.2 / §8 V1）
		*
		* ★ 工单 03（WorkspacePort 接缝）从 `src/client.js` **逐字搬来**，只做了整体去缩进与补 export；
		*   正文一字未改（行为不变的证据：临时 harness 对真实工作区数据做迁移前后 deepEqual）。
		* frontmatter 标量 · checkFinals（多份 active / 旧稿未归档 / 无 active）· parseFinalGdd（章/组/条目 + 1-based 行号）。
		*
		* ★ 修复（工单 03 收尾）：`checkFinals` 排序用的 `dateOf` 漏了 import —— 在 client.js 里它是同层自由变量，
		*   搬成模块后就成了自由变量，调用即 `ReferenceError: dateOf is not defined`。
		*   这正是 ADR 0001 删掉 `check-sandbox.js` 后必须补回的那张网（见 eslint.config.js 在 pure/ 上开的 no-undef）。
		*/
		/** 解析 md 顶部 frontmatter 的简单标量字段 */
		function parseFrontmatter$1(text) {
			const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text || "");
			if (!m) return null;
			const out = {};
			for (const line of m[1].split(/\r?\n/)) {
				const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
				if (kv) out[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
			}
			return out;
		}
		function checkFinals(finals) {
			const list = (Array.isArray(finals) ? finals : []).slice().sort((a, b) => dateOf(a.name) < dateOf(b.name) ? 1 : -1);
			const st = (f) => String(f && f.status || "").trim().toLowerCase();
			const actives = list.filter((f) => st(f) === "active").map((f) => f.name);
			const pending = list.filter((f) => st(f) === "pending").map((f) => f.name);
			const issues = [];
			if (actives.length > 1) issues.push({
				code: "V1",
				level: "error",
				files: actives,
				msg: "同时有 " + actives.length + " 份 active 定稿——文件自身没有 archived 标记，取代关系是派生的"
			});
			else if (list.length > 1 && actives.length === 1) {
				const others = list.filter((f) => f.name !== actives[0] && st(f) !== "archived");
				if (others.length) issues.push({
					code: "V1c",
					level: "warn",
					files: others.map((f) => f.name),
					msg: others.length + " 份旧定稿未标 archived（当前按日期视为历史版本）"
				});
			}
			if (list.length && !actives.length && !pending.length) issues.push({
				code: "V1b",
				level: "warn",
				files: list.map((f) => f.name),
				msg: "没有 active 定稿——provisional / blocked / 或缺头部字段"
			});
			return {
				current: actives.length ? actives[0] : list[0] ? list[0].name : null,
				currentFrom: actives.length ? "active" : "date",
				actives,
				pending,
				issues,
				all: list
			};
		}
		function parseFinalGdd(text) {
			const src = String(text || "");
			const lines = src.split(/\r?\n/);
			const meta = parseFrontmatter$1(src) || {};
			let title = "", fence = false, cur = null;
			const blocks = [];
			const outline = [];
			const start = (level, no, id, t, ln) => {
				const b = {
					level,
					no,
					id,
					title: t,
					line: ln,
					text: [],
					rows: []
				};
				blocks.push(b);
				cur = b;
				if (level === 2) outline.push({
					no,
					title: t,
					line: ln,
					idx: blocks.length - 1,
					rows: b.rows,
					children: []
				});
				else if (outline.length) {
					const parent = outline[outline.length - 1];
					b.chNo = parent.no;
					parent.children.push({
						no,
						id,
						title: t,
						line: ln,
						idx: blocks.length - 1,
						rows: b.rows
					});
				}
				return b;
			};
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				const ln = i + 1;
				if (/^\s*(```|~~~)/.test(line)) {
					fence = !fence;
					if (cur) cur.text.push(line);
					continue;
				}
				if (fence) {
					if (cur) cur.text.push(line);
					continue;
				}
				if (!blocks.length && !cur) {
					const mt = /^#\s+(.+?)\s*$/.exec(line);
					if (mt) {
						title = mt[1];
						continue;
					}
				}
				const m2 = /^##\s+(\d+)[.、]?\s*(.*)$/.exec(line);
				if (m2) {
					start(2, m2[1], "", (m2[2] || "").trim(), ln).text.push(line);
					continue;
				}
				const m3 = /^###\s+(.+?)\s*$/.exec(line);
				if (m3) {
					const raw = m3[1];
					let no = "", id = "", t = raw;
					const a = /^(R\d+)\s+(.+)$/.exec(raw);
					const b2 = /^(\d+\.\d+)\s+(UI-M\d+)\s*(.*)$/.exec(raw);
					const c2 = /^(\d+\.\d+)\s+(.+)$/.exec(raw);
					if (a) {
						id = a[1];
						t = a[2];
					} else if (b2) {
						no = b2[1];
						id = b2[2];
						t = (b2[3] || b2[2]).trim();
					} else if (c2) {
						no = c2[1];
						t = c2[2];
					}
					start(3, no, id, t, ln).text.push(line);
					continue;
				}
				if (!cur) continue;
				if (/^\s*\|.*\|\s*$/.test(line)) {
					const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((s) => s.trim());
					const first = cells[0] || "";
					if (/^:?-{2,}:?$/.test(first.replace(/\s/g, ""))) {
						const last = cur.rows[cur.rows.length - 1];
						if (last && last.line === ln - 1) cur.rows.pop();
					} else if (first) cur.rows.push({
						key: first,
						line: ln,
						cells: cells.length,
						text: line.trim()
					});
				}
				cur.text.push(line);
			}
			for (const b of blocks) b.text = b.text.join("\n").replace(/^\s+|\s+$/g, "");
			let groups = 0, rows = 0;
			for (const b of blocks) {
				rows += b.rows.length;
				if (b.level === 3) groups++;
			}
			return {
				meta,
				title,
				blocks,
				outline,
				stats: {
					chapters: outline.length,
					groups,
					rows
				}
			};
		}
		/**
		* 正文滚动到哪儿了 → 大纲该高亮哪一块（设计 §6.2「点大纲跳正文，正文滚动时大纲高亮跟随」）。
		*
		* `tops` = 每个块顶边相对**滚动容器**顶边的偏移（`getBoundingClientRect()` 相减得到，单位随意）。
		* 口径：取**顶边已经越过 `slack` 的最后一个块**；一个都没越过（还停在第一块上方）就取第 0 块。
		*
		* ★ 抽成纯函数的原因：这一步是"跟随"里唯一有判断的部分，DOM 那半边只剩取矩形的胶水；
		*   放在这里才能离线测（真机上滚一下看不出的边界：第一块还没滚到、块高小于 slack）。
		*/
		function topBlockIndex(tops, slack = 8) {
			if (!Array.isArray(tops) || !tops.length) return -1;
			const lim = Number.isFinite(slack) ? slack : 8;
			let best = 0;
			for (let i = 0; i < tops.length; i++) {
				const t = Number(tops[i]);
				if (!Number.isFinite(t)) continue;
				if (t <= lim) best = i;
			}
			return best;
		}
		//#endregion
		//#region src/pure/fsstamp.ts
		/**
		* 宿主版本串 → **时间**（工单 25 · V11 升级的地基）
		*
		* ── 为什么要解析一个"不透明"的串 ─────────────────────────────────────────────
		* 工单 16 立的纪律是「`version` 是不透明串，面板从不解析它」——**这条纪律本身没变**：
		* 面板仍然不拿它当"内容标识"用（指纹、自激防护那一侧照旧只比对、不解析）。
		* 但工单 25 要回答一个问题：**"审查报告是不是比定稿旧"**。DSH 的**列举通道**只有
		* `name` / `type` / `size?`（`WorkspaceDirectoryEntry`）——**不给 mtime**；
		* 唯一可能带时间的就是 `stat` 的 `version`。于是本票先实测它到底是不是含时间（见下）。
		*
		* ── 实测（2026-09-30 · `_25-stat-probe.mjs` / `_25-stat-evidence.txt`）──────────
		* 装在盘上的官方实现是**唯一**口径（面板拿到的就是它产出的）：
		*
		*   `dsh-fs-local/lib/index.js` :144
		*     /** Opaque version token from high-resolution identity and freshness metadata. *\/
		*     function versionOf(info) {
		*       return FsVersion(`${info.dev}:${info.ino}:${info.size}:${info.mtimeNs}:${info.ctimeNs}`);
		*     }
		*   `dsh-api-workspace-files/lib/types/index.js` :371
		*     statOf(target, info) → { absolutePath, version: info.version, bytes: info.size }
		*
		* 真机上对 7 个真实文件逐个比对：版本串的 5 段与 node `statSync(p,{bigint:true})` 的
		* `dev / ino / size / mtimeNs / ctimeNs` **逐字段全等**，第 4 段换算出的人类时间 = 文件的 mtime。
		* ⇒ 第 4 段就是 **mtime 纳秒**。
		*
		* ── 因此本模块的口径 ────────────────────────────────────────────────────────
		* · **认不出来就返回 `null` / `0`**，绝不猜 —— 上层据此如实说"面板看不到时间"
		*   （`finalgate.ts` 的 `unknown-time` 分支就是这么用的：判不了 ⇒ **不默认它有效**）。
		* · 只认**严格 5 段十进制**：少一段、多一段、带 `dev` 这种非数字前缀，一律当作不认识。
		*   理由：这个形状是官方**私有**约定（源码注释自称 opaque），跨版本可能变；宁可判不了，
		*   也不要拿半个串去猜出一个错的时间——那会让"报告比定稿旧"变成一句假话。
		* · `mtimeNs` 是 19 位（~1.79e18），超出 `Number.MAX_SAFE_INTEGER` ⇒ **按字符串截掉后 6 位**
		*   得到毫秒（13 位，安全），不走浮点除法、不用 BigInt（浏览器半侧不引入新依赖）。
		*/
		/** 版本串的形状：`dev:ino:size:mtimeNs:ctimeNs`（全是十进制，不含正负号） */
		const STAMP_RE = /^(\d{1,20}):(\d{1,20}):(\d{1,20}):(\d{1,20}):(\d{1,20})$/;
		/**
		* 解析一个版本串 → `Stamp`；**认不出来返回 `null`**（不抛错、不猜）。
		*
		* @param version - 宿主 `stat` / `read` / change 帧里的 `version`
		*/
		function stampOf(version) {
			const s = String(version == null ? "" : version);
			const m = STAMP_RE.exec(s);
			if (!m) return null;
			const ns = m[4];
			const msPart = ns.length > 6 ? ns.slice(0, ns.length - 6) : "0";
			const ms = Number(msPart);
			if (!Number.isFinite(ms) || ms < 9466848e5 || ms > 41024448e5) return null;
			return {
				ns,
				ms,
				dev: m[1],
				ino: m[2],
				size: m[3],
				ctimeNs: m[5]
			};
		}
		/**
		* 版本串 → epoch 毫秒；**认不出来给 `0`**（= "面板看不到时间"，不是 1970 年）。
		* 上层用 `> 0` 判"这份文件的时间拿到了没有"。
		*/
		function mtimeOf(version) {
			const st = stampOf(version);
			return st ? st.ms : 0;
		}
		/** epoch 毫秒 → `2026-09-30 13:17`（本地时区，人话）；拿到 0 / 非法值给空串（不编时间） */
		function atText(ms) {
			const n = Number(ms);
			if (!Number.isFinite(n) || n <= 0) return "";
			const d = new Date(n);
			if (isNaN(d.getTime())) return "";
			const p = (x) => (x < 10 ? "0" : "") + x;
			return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
		}
		//#endregion
		//#region src/pure/finalgate.ts
		/**
		* 定稿门（工单 25）—— 把"判据的输出"翻成**人话** + 一句"这份定稿能不能交程序"
		*
		* ── 它是翻译层，不是第二个判据层 ──────────────────────────────────────────────
		* 判据只有一份实现：
		*   · V1（多份 active / 旧稿未归档 / 无 active）→ `./finalgdd.ts` 的 `checkFinals`
		*   · V11（审查报告缺失 / 比定稿旧）→ `./vchecks.ts` 的 `checkV11`（工单 30）
		*   · V3 / V5 / V6 / V8 → `./vchecks.ts` 的 `scanFinalChecks`（经 `gddChecklist` 汇总）
		* 本模块**只做**三件事：
		*   ① 把上面那些机器口径翻成**人话**（面板上读得懂）；
		*   ② 明确"**没跑审查就不算可用**"（工单 25 第 2 条）—— 审查是**必经**一步；
		*   ③ 给一句结论：**能不能交程序**（工单 25 第 6 条的落点）。
		*
		* ── 一条硬口径：判不了 ≠ 有效 ────────────────────────────────────────────────
		* `checkV11` 在"拿不到时间"时（`mtime` 缺省 = 0）算不出 `stale`，于是它的 `hit` 会是 false
		* ——那是"没发现问题"，**不是"审过了"**。所以这一层单独看时间：
		*   匹配到的审查报告**任何一份时间未知** ⇒ 一律判 `unknown-time`（**不放行**），
		* 并在界面上如实写"面板看不到时间，无法判断新旧"。这一条是本票第 3 条的验收点。
		* （时间从哪来：`./fsstamp.ts` —— 宿主 `stat` 的版本串第 4 段是 mtime 纳秒，已实测。）
		*
		* ── 结论的判定顺序（固定，文档化）────────────────────────────────────────────
		*   ① 没有定稿（`none`）                     → 交不了
		*   ② 结构告警：多份「可用」/ 一份都没有      → 先别交（先决定哪一份是当前有效）
		*   ③ 审查关：缺失 / 比定稿旧 / 看不到时间    → 先别交（**必经**）
		*   ④ 阻断级正文校验（V3 / V6 这类 error）    → 先别交
		*   ⑤ 其余（warn / info）                    → 可以交，但清单在〔详情〕里
		* 顺序理由：②决定"哪一份才是当前有效"，不定下来谈审查没有意义；③是流程必经；
		* ④是正文级硬伤。三档都过了才说"可以交程序"。
		*/
		/** `a / b`（把人话里的文件名列表拼起来；超过 3 个就截断，界面上不堆) */
		function names(list, max = 3) {
			const xs = (list || []).map(String).filter((x) => x !== "");
			if (xs.length <= max) return xs.join(" / ");
			return xs.slice(0, max).join(" / ") + " 等 " + xs.length + " 份";
		}
		/**
		* 审查关（工单 25 第 2 / 第 3 条）。
		*
		* @param v11     - `checkV11` 的结论（逐字匹配规则在那边，本层不重写：`_审查.md` 且文件名以定稿名去 `_定稿.md` 后的前缀开头）
		* @param finalMs - 当前定稿的时间（0 = 看不到）
		* @param reviewMs - 审查报告的时间表（0/缺省 = 看不到）
		*/
		function reviewGateOf(input) {
			const fin = String(input.finalCheck && input.finalCheck.current || "");
			const v11 = input.v11 || {};
			const match = (v11.match || []).map(String);
			const stale = (v11.stale || []).map(String);
			const finalMs = Number(input.finalMs) || 0;
			const msOf = (n) => Number((input.reviewMs || {})[n]) || 0;
			const finalAt = atText(finalMs);
			if (!fin) return {
				state: "no-final",
				matched: 0,
				report: "",
				reportAt: "",
				finalAt: "",
				say: "还没有定稿，审查这一步还没到。"
			};
			if (!match.length) return {
				state: "missing",
				matched: 0,
				report: "",
				reportAt: "",
				finalAt,
				say: "还差审查这一步：" + fin + " 没有对照的审查报告（`_审查.md`）—— 没跑审查，面板不把它算作可用。"
			};
			if (finalMs <= 0 || match.some((n) => msOf(n) <= 0)) return {
				state: "unknown-time",
				matched: match.length,
				report: names(match),
				reportAt: "",
				finalAt,
				say: "面板看不到时间，无法判断审查报告是不是比定稿旧（命中的审查报告 " + match.length + " 份：" + names(match) + "）—— 判不了就不当作有效。"
			};
			if (match.length > stale.length) {
				const newest = match.slice().sort((a, b) => msOf(b) - msOf(a))[0];
				return {
					state: "fresh",
					matched: match.length,
					report: newest,
					reportAt: atText(msOf(newest)),
					finalAt,
					say: "审查报告比定稿新：" + newest + "（" + atText(msOf(newest)) + "）晚于定稿（" + finalAt + "）。"
				};
			}
			const newestStale = stale.slice().sort((a, b) => msOf(b) - msOf(a))[0] || match[0];
			return {
				state: "stale",
				matched: match.length,
				report: newestStale,
				reportAt: atText(msOf(newestStale)),
				finalAt,
				say: "审查报告比定稿旧：" + names(stale) + "（" + atText(msOf(newestStale)) + "）早于定稿（" + finalAt + "）—— 这一版还没被审过。"
			};
		}
		/**
		* 定稿门：把 V1 / V11 / error 级校验翻成人话 + 一句"能不能交程序"。
		*/
		function finalGate(input) {
			const inp = input || {};
			const fc = inp.finalCheck || null;
			const all = fc && fc.all || [];
			const actives = (fc && fc.actives || []).map(String);
			const current = fc && fc.current || null;
			const currentFrom = String(fc && fc.currentFrom || "");
			const review = reviewGateOf(inp);
			const alarms = [];
			const issues = fc && fc.issues || [];
			for (const it of issues) {
				const code = String(it.code || "");
				const files = (it.files || []).map(String);
				if (code === "V1") alarms.push({
					code: "V1",
					level: "error",
					files,
					say: "同时有 " + files.length + " 份定稿标着「可用」：" + names(files) + " —— 旧的那份没标「归档」，面板按文件名日期把 " + String(current || files[0]) + " 当当前有效的那一份。交程序之前得先定下来哪一份算数。"
				});
				else if (code === "V1c") alarms.push({
					code: "V1c",
					level: "warn",
					files,
					say: "旧定稿没标「归档」：" + names(files) + " —— 面板按文件名日期把它当历史版本，但文件自己没这么说。"
				});
				else if (code === "V1b") alarms.push({
					code: "V1b",
					level: "warn",
					files,
					say: "有 " + all.length + " 份定稿，但没有一份标着「可用」（`status: active`）—— 面板只能按文件名日期挑一份给你看。"
				});
			}
			if (!all.length) alarms.push({
				code: "V1b",
				level: "warn",
				files: [],
				say: "这个功能还没有定稿 —— 成稿有了也还没整合成能交程序的那一份。"
			});
			if (review.state === "missing" || review.state === "stale" || review.state === "unknown-time") alarms.push({
				code: "V11",
				level: review.state === "unknown-time" ? "warn" : "warn",
				files: review.report ? review.report.split(" / ") : current ? [current] : [],
				say: review.say
			});
			for (const e of inp.errors || []) {
				const code = String(e.code || "");
				if (code === "V1" || code === "V1b" || code === "V1c") continue;
				alarms.push({
					code,
					level: "error",
					files: (e.files || []).map(String),
					say: String(e.msg || "")
				});
			}
			const structError = alarms.some((a) => a.level === "error" && (a.code === "V1" || a.code === "V1b"));
			/** ★ ③「没有任何可用定稿」：有定稿、但**一份都没标「可用」**（`active`）—— 也算结构性问题，不放行 */
			const noActive = all.length > 0 && !actives.length;
			const bodyError = alarms.filter((a) => a.level === "error" && !(a.code === "V1" || a.code === "V1b"));
			const none = !all.length;
			let state = "ok";
			let headline = "";
			let next = "";
			if (none) {
				state = "none";
				headline = "还没有定稿 —— 交不了程序（先跑一次「发起整合定稿」）";
				next = "在这个功能的「文档生成」里点〔发起整合定稿〕；跑完 sr-gdd-ai 再跑 sr-gdd-review，审查报告是**必经**的一步。";
			} else if (structError) {
				state = "blocked";
				headline = "先别交程序 —— 同时有 " + actives.length + " 份定稿标着「可用」（旧的那份没归档）";
				next = "先把旧的那份改成 `status: archived`（走 /sr-gdd-fix，或直接改头部字段）；面板随后只认日期最新的那一份。";
			} else if (noActive) {
				state = "blocked";
				headline = "先别交程序 —— 没有一份定稿标着「可用」";
				next = "让当前这份定稿的头部写上 `status: active`（sr-gdd-ai 整合完会写；手改也行）—— 面板只把标了「可用」的那份当当前有效。";
			} else if (review.state === "missing") {
				state = "blocked";
				headline = "先别交程序 —— 还差审查这一步";
				next = "在该功能的工作会话里跑一次 /sr-gdd-review（审查 `" + String(current) + "`）；审查报告落在 `gdd\\` 下、文件名带上这份定稿的前缀。";
			} else if (review.state === "stale") {
				state = "blocked";
				headline = "先别交程序 —— 审查报告比定稿旧";
				next = "重跑一次 /sr-gdd-review（让它审当前这一版）；报告的时间要比定稿新，面板才认。";
			} else if (review.state === "unknown-time") {
				state = "blocked";
				headline = "先别交程序 —— 面板看不到时间，判不了审查报告的新旧";
				next = "面板拿不到这两份文件的时间（宿主 `stat` 的版本串不是预期的形状）⇒ 判不了就不当有效。兜底：跑一次 /sr-gdd-review 出新报告；或让人把两份文件的修改时间告诉你。";
			} else if (bodyError.length) {
				state = "blocked";
				headline = "先别交程序 —— 还有 " + bodyError.length + " 条阻断级校验没过（" + Array.from(new Set(bodyError.map((a) => a.code))).join(" / ") + "）";
				next = "按〔详情〕里那条清单的行号改掉它们，再回这一屏。";
			} else {
				state = "ok";
				headline = "可以交程序 —— " + String(current);
				next = "";
			}
			const from = currentFrom === "date" ? "没有一份标着「可用」，面板按文件名日期取的最新一份" : "按 `status: active` + 文件名日期（功能身份 = 目录，不靠猜文件名里的别的花样）";
			const say = none ? headline : "当前有效：" + String(current) + "（" + from + "）。" + (state === "ok" ? "三道关都过了 —— 审查关：" + review.say : headline + "。");
			return {
				state,
				headline,
				say,
				next,
				alarms,
				review,
				current,
				currentFrom,
				canHandOff: state === "ok"
			};
		}
		//#endregion
		//#region src/pure/vchecks.ts
		/**
		* 定稿只读校验 V3 / V5 / V6 / V8 / V11（工单 30）+ 汇总「校验清单」接口
		*
		* 目标：**跑之前就把问题暴露**——这些检查全部只看定稿正文与文件名，不读配置表、不跑构建。
		* V1（同主题多份 active 定稿）已经由 `./finalgdd.ts` 的 `checkFinals` 实现，本模块**不重写它**，
		* 只把它的 issues 与这里五条汇总成同一张清单（面板告警条用）。
		*
		* ── 三条判据是**真实数据实测**出来的，别按直觉改（依据：30-v-checks-baseline.md）────────
		*   1. V6 是**单向**的：只有「§4 规则引用的配置字段、§6 没声明」算问题。
		*      反方向（§6 按整表声明了字段、§4 没引用）**不是问题**——真实定稿上它有 13 处，属正常。
		*      ⇒ 反方向只作为 `declsWithoutRef` 如实报数，**绝不生成 issue**。
		*   2. V8 必须区分「定义处」与「引用处」：`UE{n}` 在 §5 是**条目定义行**（表格第一列），
		*      在 §4/§10 与散文中只是提及；并且有 `{n}{字母}` 后缀族（`UE3` 与 `UE3a` 同族）。
		*      ⇒ **只有 §5 定义行判重号与跳号**。按"出现次数"判重会在真实定稿上得到 7 个假阳性
		*        （UE12/UE14 等只是被 §4 与散文反复提到）。
		*   3. V11 的判据 = 当前有效定稿**没有**逐字匹配的 `_审查.md`，或该审查报告比定稿旧。
		*
		* ★ 工单 14：§4 引用 / §6 声明的**取数**在这里抽成 `extractFieldRefs` / `extractFieldDecls`
		*   （V6 与 `./refgraph.ts` 的⑥契约关联边**共用同一口径**，避免两处正则各自漂移）；
		*   「整表 + 括号里逐字段列举」那一形态另开 `extractRowFieldRefs`，**只给契约边用、不进 V6**。
		*
		* 纯函数、零 IO：定稿正文、定稿候选（文件名/frontmatter/时间）、审查报告清单都由调用方读进来。
		*/
		/**
		* 五条校验的规格表（**严重程度集中在这里**，改一处就够；不散在函数体里）。
		* 依据：30 的验收口径 —— 重复键 / 漏配 / 编号重号 = error；审查报告缺失或过旧 = warn（交程序前该补审）；
		* 「待配表」计数 = info（是**待办计数**，不是缺陷：真实定稿里 5 处都是"数值待配"的如实标注）。
		*/
		const VCHECK_SPECS = {
			V3: {
				level: "error",
				title: "§7 多语言文本键重复",
				rule: "§7 表里同一个键出现两次 = 后一条覆盖前一条，文案与程序取到的值不一致"
			},
			V5: {
				level: "info",
				title: "「待配表」计数",
				rule: "统计正文里标了「待配表」的条目数——它们是数值待配的如实标注，不是缺陷，只在告警条上计数"
			},
			V6: {
				level: "error",
				title: "§4 引用的配置字段在 §6 没声明",
				rule: "§4 规则行的配置字段列引用了某个字段（`表.字段` 写法），§6 配置契约必须逐字声明它；反方向（§6 声明了但 §4 没引用）不算问题"
			},
			V8: {
				level: "warn",
				title: "§5 交互条目编号重号 / 跳号",
				rule: "只在 §5 的条目定义行（表格第一列 = UE{n}）判：同一编号定义两次 = 重号（更要紧，下游引用会指错）；编号不连续 = 跳号（多为漏删/漏加，未必致命）。§4/§10 的提及与 {n}{字母} 后缀族都不算。★ 2026-09-30 按用户口径从 error 降为 warn（见 issue 14/30 的验收记录）"
			},
			V11: {
				level: "warn",
				title: "审查报告缺失或比定稿旧",
				rule: "当前有效定稿应有逐字匹配的 `_审查.md`，且审查报告不得比定稿旧——否则这份定稿没被审过就当成了有效稿"
			}
		};
		/** 拆行（统一 CRLF / LF） */
		function linesOf(text) {
			return String(text == null ? "" : text).split(/\r?\n/);
		}
		/**
		* 每行所属的章号与章标题：`## 4. 功能规则` → 章号 "4"、标题 "4. 功能规则"。
		* 只认 level-2 标题（`## `）：`### 5.1 …` 属于 §5 的行，不新开章。
		*/
		function chaptersOf(lines) {
			const nos = [];
			const titles = [];
			let no = "";
			let title = "";
			for (let i = 0; i < lines.length; i++) {
				const m = /^##\s+(\d+)[.、]?\s*(.*)$/.exec(lines[i]);
				if (m) {
					no = m[1];
					title = lines[i].replace(/^#+\s*/, "").trim();
				}
				nos.push(no);
				titles.push(title);
			}
			return {
				nos,
				titles
			};
		}
		/** 出现次数（不用正则，避免把待配表当模式） */
		function countOf(line, needle) {
			let n = 0;
			let at = line.indexOf(needle);
			while (at >= 0) {
				n++;
				at = line.indexOf(needle, at + needle.length);
			}
			return n;
		}
		/** §7 里"一个键定义一次"的行：`| alli_boss_panel_title | 联盟悬赏 | 新增 |` */
		function checkV3(lines, chaps) {
			const byKey = /* @__PURE__ */ new Map();
			for (let i = 0; i < lines.length; i++) {
				if (chaps.nos[i] !== "7") continue;
				const m = /^\|\s*([A-Za-z0-9_]+)\s*\|/.exec(lines[i]);
				if (!m) continue;
				const at = byKey.get(m[1]);
				if (at) at.push(i + 1);
				else byKey.set(m[1], [i + 1]);
			}
			const dup = [];
			for (const kv of byKey) if (kv[1].length > 1) dup.push({
				key: kv[0],
				lines: kv[1]
			});
			return {
				code: "V3",
				level: VCHECK_SPECS.V3.level,
				title: VCHECK_SPECS.V3.title,
				rule: VCHECK_SPECS.V3.rule,
				hit: dup.length > 0,
				keys: byKey.size,
				dup
			};
		}
		/** 正文里标了「待配表」的条目（含 `**待配表**——…` 这种强调写法）。count=行数、occurrences=标记次数。 */
		function checkV5(lines, chaps) {
			const MARK = "待配表";
			const hits = [];
			let occurrences = 0;
			for (let i = 0; i < lines.length; i++) {
				const n = countOf(lines[i], MARK);
				if (!n) continue;
				occurrences += n;
				hits.push({
					line: i + 1,
					chapter: chaps.titles[i],
					text: lines[i].trim()
				});
			}
			return {
				code: "V5",
				level: VCHECK_SPECS.V5.level,
				title: VCHECK_SPECS.V5.title,
				rule: VCHECK_SPECS.V5.rule,
				hit: hits.length > 0,
				count: hits.length,
				occurrences,
				hits
			};
		}
		/**
		* §4 的配置字段引用：反引号里形如 `` `A012-全局变量表.alliBossDailyAttackCount` `` 的写法。
		* ★ 实测边界：正则在**反引号内容以标识符收尾**时才算引用 —— 这正好排掉三类噪音：
		*   `` `A079-联盟悬赏.xlsx!BOSS表` 全行（bossName / weakness / …）``（整表引用，逐字段无声明）
		*   `` `A028-功能开启表.xlsx!功能开启.id=536` ``（值引用，不是字段名）
		*   `` `A079-联盟悬赏.xlsx!难度表.终极难度` ``（中文字段名，不是英文字段）
		*/
		const REF_RE = /`([^`]*?[!.]\s*)([A-Za-z][A-Za-z0-9_]*)`/g;
		/** §6 声明的字段：表里第 3 格（`| 中文字段 | 英文字段 | … |`）整格就是一个反引号字段名 */
		const DECL_RE = /^`([A-Za-z][A-Za-z0-9_]*)`$/;
		/** §4 的 `表.字段` 引用（逐字沿用 V6 的正则与边界，见上面 REF_RE 的注释） */
		function extractFieldRefs(lines, chaps) {
			const c = chaps || chaptersOf(lines);
			const out = [];
			for (let i = 0; i < lines.length; i++) {
				if (c.nos[i] !== "4") continue;
				REF_RE.lastIndex = 0;
				let m = REF_RE.exec(lines[i]);
				while (m) {
					out.push({
						line: i + 1,
						ref: m[0].slice(1, -1),
						field: m[2]
					});
					m = REF_RE.exec(lines[i]);
				}
			}
			return out;
		}
		/** §6 的字段声明行（第 3 格整格是 `` `英文字段` ``；§6.5 那类三列表不算） */
		function extractFieldDecls(lines, chaps) {
			const c = chaps || chaptersOf(lines);
			const out = [];
			for (let i = 0; i < lines.length; i++) {
				if (c.nos[i] !== "6") continue;
				const cells = lines[i].split("|").map((s) => s.trim());
				if (cells.length < 6) continue;
				const m = DECL_RE.exec(cells[2] || "");
				if (m) out.push({
					line: i + 1,
					field: m[1],
					text: lines[i].trim()
				});
			}
			return out;
		}
		/**
		* 「整表 + 括号里逐字段列举」形态：`` `A079-联盟悬赏.xlsx!BOSS表` 全行（bossName / weakness / … 等） ``。
		*
		* ★ 这一形态**不进 V6**：V6 判的是"引用的字段 §6 没声明"，整表引用没有逐字段的引用点。
		*   它只服务⑥契约关联边，且列举出的字段名照旧要和 §6 的声明**逐字对上**才连边（见 refgraph.ts）。
		* ★ 边界（宁可少判；已在 test/pure-refgraph.test.ts 锁住"认哪些 / 不认哪些"）：
		*   · 反引号内容必须以**非 ASCII 的表名**收尾（`!BOSS表`）——`!BOSS表.rotateIndex` 归 REF_RE 那一类；
		*   · 紧跟其后必须是 `全行（` —— `…!难度表` 第 21 行（clearDropId/killDropId 为空）` 那种行号引用不认；
		*   · 列举项只收"整项就是一个标识符"的（可带尾随中文注释或「等」字），散文里的英文词不当字段名。
		*/
		const ROW_REF_RE = /`([^`]*)`\s*全行\s*[（(]([^）)]*)[）)]/g;
		const IDENT_RE = /^[A-Za-z][A-Za-z0-9_]*$/;
		function extractRowFieldRefs(lines, chaps) {
			const c = chaps || chaptersOf(lines);
			const out = [];
			for (let i = 0; i < lines.length; i++) {
				if (c.nos[i] !== "4") continue;
				ROW_REF_RE.lastIndex = 0;
				let m = ROW_REF_RE.exec(lines[i]);
				while (m) {
					const ref = m[1].trim();
					const tail = ref.split(/[!.]/).pop() || "";
					if (/[!.]/.test(ref) && tail && !IDENT_RE.test(tail)) {
						const fields = [];
						for (const raw of m[2].split(/[\/、,，]/)) {
							const name = raw.trim().replace(/[^\x00-\x7F]+$/, "").trim();
							if (IDENT_RE.test(name) && fields.indexOf(name) < 0) fields.push(name);
						}
						if (fields.length) out.push({
							line: i + 1,
							ref,
							fields
						});
					}
					m = ROW_REF_RE.exec(lines[i]);
				}
			}
			return out;
		}
		function checkV6(lines, chaps) {
			const refs = extractFieldRefs(lines, chaps);
			const declared = extractFieldDecls(lines, chaps);
			const declSet = new Set(declared.map((d) => d.field));
			const missing = refs.filter((r) => !declSet.has(r.field));
			const unref = declared.filter((d) => !refs.some((r) => r.field === d.field));
			return {
				code: "V6",
				level: VCHECK_SPECS.V6.level,
				title: VCHECK_SPECS.V6.title,
				rule: VCHECK_SPECS.V6.rule,
				hit: missing.length > 0,
				refCount: refs.length,
				declCount: declared.length,
				refsWithoutDecl: missing,
				declsWithoutRef: unref
			};
		}
		/** 定义行：§5 表格第一列就是编号，`| UE17a | …` */
		const DEF_ROW_RE = /^\|\s*(UE\d+[a-z]?)\s*\|/;
		/** 任何位置的编号出现（定义 + 提及），用于报数；**不参与判问题** */
		const UE_RE$1 = /\bUE(\d+)([a-z]?)\b/g;
		function checkV8(lines, chaps) {
			const occ = [];
			for (let i = 0; i < lines.length; i++) {
				UE_RE$1.lastIndex = 0;
				let m = UE_RE$1.exec(lines[i]);
				while (m) {
					occ.push({
						line: i + 1,
						raw: m[0],
						n: Number(m[1]),
						suffix: m[2],
						chapter: chaps.nos[i],
						definition: false
					});
					m = UE_RE$1.exec(lines[i]);
				}
			}
			const defs = [];
			for (let i = 0; i < lines.length; i++) {
				if (chaps.nos[i] !== "5") continue;
				const m = DEF_ROW_RE.exec(lines[i]);
				if (!m) continue;
				const raw = m[1];
				const dm = /^UE(\d+)([a-z]?)$/.exec(raw);
				defs.push({
					raw,
					n: Number(dm[1]),
					suffix: dm[2],
					line: i + 1
				});
				const first = occ.find((o) => o.line === i + 1 && o.raw === raw);
				if (first) first.definition = true;
			}
			const byRaw = /* @__PURE__ */ new Map();
			for (const d of defs) {
				const at = byRaw.get(d.raw);
				if (at) at.push(d.line);
				else byRaw.set(d.raw, [d.line]);
			}
			const dup = [];
			for (const kv of byRaw) if (kv[1].length > 1) dup.push({
				raw: kv[0],
				n: defs.find((d) => d.raw === kv[0]).n,
				lines: kv[1]
			});
			const byN = /* @__PURE__ */ new Map();
			for (const d of defs) {
				const at = byN.get(d.n);
				if (at) {
					if (at.indexOf(d.raw) < 0) at.push(d.raw);
				} else byN.set(d.n, [d.raw]);
			}
			const nums = Array.from(byN.keys()).sort((a, b) => a - b);
			const gaps = [];
			for (let i = 1; i < nums.length; i++) for (let g = nums[i - 1] + 1; g < nums[i]; g++) gaps.push(g);
			const families = nums.filter((n) => byN.get(n).length > 1).map((n) => ({
				n,
				raws: byN.get(n)
			}));
			const undefinedRefs = Array.from(new Set(occ.filter((o) => !o.definition).map((o) => o.n))).filter((n) => !byN.has(n)).sort((a, b) => a - b);
			return {
				code: "V8",
				level: VCHECK_SPECS.V8.level,
				title: VCHECK_SPECS.V8.title,
				rule: VCHECK_SPECS.V8.rule,
				hit: dup.length > 0 || gaps.length > 0,
				total: occ.length,
				unique: nums.length,
				range: nums.length ? [nums[0], nums[nums.length - 1]] : null,
				definitions: defs.length,
				references: occ.filter((o) => !o.definition).length,
				gaps,
				dup,
				families,
				undefinedRefs
			};
		}
		function timeOf(v) {
			if (v == null) return 0;
			if (typeof v === "number") return v;
			if (v instanceof Date) return v.getTime();
			const t = Date.parse(String(v));
			return isNaN(t) ? 0 : t;
		}
		/**
		* @param input.final   当前有效定稿（`{name, mtime}`）—— name 是带 `_定稿.md` 的文件名
		* @param input.reviews `gdd\` 下所有 `*_审查.md`（`{name, mtime}`）
		*/
		function checkV11(input) {
			const fin = input && input.final || {};
			const name = String(fin.name || "");
			if (!name) return {
				code: "V11",
				level: VCHECK_SPECS.V11.level,
				title: VCHECK_SPECS.V11.title,
				rule: VCHECK_SPECS.V11.rule,
				hit: false,
				final: "",
				finalTime: 0,
				match: [],
				stale: [],
				reviewsInDir: (input && input.reviews || []).map((r) => r.name)
			};
			const base = name.replace(/_定稿\.md$/i, "");
			const all = input && input.reviews || [];
			const matched = all.filter((r) => /_审查\.md$/i.test(String(r.name)) && base && String(r.name).indexOf(base) === 0);
			const matchedSorted = matched.slice().sort((a, b) => timeOf(b.mtime) - timeOf(a.mtime));
			const newest = matchedSorted.length ? matchedSorted[0] : null;
			const stale = matched.filter((r) => timeOf(r.mtime) < timeOf(fin.mtime));
			const hit = !newest || stale.length === matched.length;
			return {
				code: "V11",
				level: VCHECK_SPECS.V11.level,
				title: VCHECK_SPECS.V11.title,
				rule: VCHECK_SPECS.V11.rule,
				hit,
				final: name,
				finalTime: timeOf(fin.mtime),
				match: matched.map((r) => r.name),
				stale: stale.map((r) => r.name),
				reviewsInDir: all.map((r) => r.name)
			};
		}
		/** 五条检查一次跑完（输入一份定稿正文） */
		function scanFinalChecks(text) {
			const lines = linesOf(text);
			const chaps = chaptersOf(lines);
			return {
				lines: lines.length,
				V3: checkV3(lines, chaps),
				V5: checkV5(lines, chaps),
				V6: checkV6(lines, chaps),
				V8: checkV8(lines, chaps)
			};
		}
		const LEVEL_RANK = {
			error: 0,
			warn: 1,
			info: 2
		};
		function issueOf(code, level, msg, lines, files) {
			return {
				code,
				level,
				msg,
				lines,
				files
			};
		}
		/**
		* 把 V1（`./finalgdd.ts` 的 checkFinals）+ V3 / V5 / V6 / V8 / V11 汇成一张**校验清单**。
		*
		* 返回：
		*   · `issues`  —— 告警条直接渲染的扁平清单（按 error → warn → info、同级别按 code 排）
		*   · `checks`  —— 六条检查的完整结果（想展开看细节、想点行号定位就用它）
		*   · `counts`  —— 各严重程度条数（面板上的一行摘要）
		*   · `current` / `currentFrom` —— 当前有效定稿是谁、按什么判定（**不靠文件名猜**）
		*
		* ★ 为什么 V5 也进 issues：它是 info 级——告警条能区分严重程度，info 是"如实报数"那一档。
		* ★ V6 方向② / V8 的提及与后缀族 **不进 issues**（见文件头三条判据）。
		*/
		function gddChecklist(input) {
			const inp = input || {};
			const fc = checkFinals((inp.finals || []).slice());
			const checks = { V1: fc };
			const issues = [];
			for (const it of fc.issues || []) issues.push(issueOf(it.code, it.level || "warn", String(it.msg || ""), [], it.files || []));
			const scan = scanFinalChecks(inp.text || "");
			checks.V3 = scan.V3;
			checks.V5 = scan.V5;
			checks.V6 = scan.V6;
			checks.V8 = scan.V8;
			if (scan.V3.hit) for (const d of scan.V3.dup) issues.push(issueOf("V3", scan.V3.level, "§7 文本键重复定义 `" + d.key + "`（后一条会覆盖前一条）", d.lines, []));
			if (scan.V5.hit) issues.push(issueOf("V5", scan.V5.level, "「待配表」标记 " + scan.V5.count + " 处（数值待配置，不是缺陷）", scan.V5.hits.map((h) => h.line), []));
			if (scan.V6.hit) for (const r of scan.V6.refsWithoutDecl) issues.push(issueOf("V6", scan.V6.level, "§4 引用了配置字段 `" + r.field + "`（`" + r.ref + "`），但 §6 没有声明它", [r.line], []));
			if (scan.V8.hit) {
				for (const d of scan.V8.dup) issues.push(issueOf("V8", scan.V8.level, "§5 条目编号重号 `" + d.raw + "`（同族 " + d.lines.length + " 次定义）", d.lines, []));
				if (scan.V8.gaps.length) issues.push(issueOf("V8", scan.V8.level, "§5 条目编号跳号：缺 " + scan.V8.gaps.map((g) => "UE" + g).join("、"), [], []));
			}
			const currentName = fc.current || null;
			const v11 = checkV11({
				final: currentName ? {
					name: currentName,
					mtime: inp.mtime
				} : null,
				reviews: inp.reviews || []
			});
			checks.V11 = v11;
			if (currentName && v11.hit) {
				const why = v11.match.length ? "审查报告比定稿旧（" + v11.stale.join("、") + "）" : "没有逐字匹配的审查报告";
				issues.push(issueOf("V11", v11.level, "当前有效定稿 `" + currentName + "` 未通过审查关：" + why, [], [currentName]));
			}
			issues.sort((a, b) => {
				const d = (LEVEL_RANK[a.level] || 0) - (LEVEL_RANK[b.level] || 0);
				return d !== 0 ? d : a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
			});
			const counts = {
				error: 0,
				warn: 0,
				info: 0
			};
			for (const it of issues) counts[it.level] = (counts[it.level] || 0) + 1;
			return {
				current: currentName,
				currentFrom: fc.currentFrom,
				checks,
				issues,
				counts
			};
		}
		//#endregion
		//#region src/load/read.ts
		/** 目录列举返回值 → 文件名（只取文件） */
		function fileNamesOf$1(listing) {
			return (listing && listing.entries || []).filter((x) => x.type === "file" || x.type === "unknown").map((x) => x.name).filter((n) => typeof n === "string" && n.length > 0);
		}
		/** 目录列举返回值 → 子目录名（与 fileNamesOf 互补） */
		function dirNamesOf$1(listing) {
			return (listing && listing.entries || []).filter((x) => x.type === "directory").map((x) => x.name).filter((n) => typeof n === "string" && n.length > 0);
		}
		/** 列一层目录（只取文件）。`optional` 时列不出来返回 `[]`。 */
		async function listFiles(port, absPath, signal, optional) {
			try {
				return fileNamesOf$1(await port.listDir(absPath, signal));
			} catch (e) {
				if (optional) return [];
				throw new Error("无法列举目录：" + absPath);
			}
		}
		/** 列一层目录（只取子目录）。`optional` 时列不出来返回 `[]`。 */
		async function listDirs$1(port, absPath, signal, optional) {
			try {
				return dirNamesOf$1(await port.listDir(absPath, signal));
			} catch (e) {
				if (optional) return [];
				throw new Error("无法列举目录：" + absPath);
			}
		}
		/** 只读文件开头 14 行（读 frontmatter 够用）。读不到返回 `null`。 */
		async function readHead$1(port, path, signal) {
			try {
				return (await port.readText(path, {
					offset: 1,
					limit: 14
				}, signal)).text;
			} catch (e) {
				return null;
			}
		}
		/** 分页读完整文本（读了半截就失败时，返回已经读到的部分，口径与迁移前一致）。 */
		async function readAllText$1(port, path, signal, capLines) {
			const cap = capLines || 2e4;
			let offset = 1;
			const out = [];
			let guard = 0;
			while (guard++ < 40) {
				let r;
				try {
					r = await port.readText(path, {
						offset,
						limit: 2e3
					}, signal);
				} catch (e) {
					return out.length ? out.join("\n") : null;
				}
				out.push(r.text);
				if (r.eof || r.lines === 0) break;
				offset += r.lines;
				if (offset > cap) break;
			}
			return out.join("\n");
		}
		//#endregion
		//#region src/load/feature.ts
		/**
		* 功能详情加载器（工单 12）：产物清单（按桶分组）+ 三阶段 + 定稿有效性 + V 校验清单。
		*
		* 口径：
		*   · **只吃 port**，只读；列举深度**声明为两层**（功能根 → 子目录 → 再下一层）。
		*     更深层如实报出来（`deepDirs`），不假装列全了 —— "面板列出的产物与磁盘实际一致"
		*     这条验收句靠的就是"不静默丢"。
		*   · 桶的归类、gdd 的细分、三阶段全在 `../pure/artifacts.ts`（纯函数、有测试）；
		*     这里只做 IO 与编排。
		*   · V1 定稿有效性用 `../pure/finalgdd.ts` 的 `checkFinals`；V3/V5/V6/V8/V11 + V1 汇总
		*     用 `../pure/vchecks.ts` 的 `gddChecklist`（工单 30 的能力，本票把它接进面板）。
		*   · ★ 工单 25：**时间**从宿主的 `stat` 版本串里取（`../pure/fsstamp.ts`，第 4 段 = mtime 纳秒，
		*     实测见该文件头）—— 于是 V11 的"审查报告是不是比定稿旧"从**判不了**变成**判得出来**；
		*     取不到时间时**如实降级**（`finalGate` 的 `unknown-time`：判不了就不放行，不默认有效）。
		*   · 定稿门（"这份定稿能不能交程序"）由 `../pure/finalgate.ts` 给 —— 它只把上面那几条判据
		*     翻成人话，**不重算判据**。
		*/
		/**
		* 扫一个功能目录 → 原始清单（**只照子目录走，不按文件名过滤**）。
		* 返回的键与 `pure/artifacts.ts` 的 `FeatureListing` 一致。
		*/
		async function scanFeatureListing(port, options) {
			const root = options.root;
			const signal = options.signal;
			const rootFiles = await listFiles(port, root, signal, true);
			const rootDirs = await listDirs$1(port, root, signal, true);
			const dirs = {};
			const deepDirs = [];
			/** ★ 工单 16：真正**存在**的那两层目录（`gdd/UI` 这种），订阅变更时要逐个盯着它们 */
			const nestedDirs = [];
			for (const sub of rootDirs) {
				const dirPath = root + "/" + sub;
				const files = await listFiles(port, dirPath, signal, true);
				const subdirs = await listDirs$1(port, dirPath, signal, true);
				const nested = {};
				for (const sd of subdirs) {
					nested[sd] = await listFiles(port, dirPath + "/" + sd, signal, true);
					nestedDirs.push(sub + "/" + sd);
					const deeper = await listDirs$1(port, dirPath + "/" + sd, signal, true);
					if (deeper.length) deepDirs.push(sub + "/" + sd + "（还有 " + deeper.length + " 个子目录）");
				}
				dirs[sub] = {
					files,
					nested
				};
			}
			return {
				rootFiles,
				dirs,
				nestedDirs,
				deepDirs
			};
		}
		/**
		* ★ 工单 25：拿**文件时间**（epoch ms）—— 枚举通道不给 mtime，唯一来源是宿主 `stat` 的版本串
		* （第 4 段 = mtime 纳秒；实测链见 `../pure/fsstamp.ts` 的文件头）。
		*
		* 口径：
		*   · **认不出来给 0**（= 看不到时间），绝不拿半个串猜时间；0 会让定稿门判 `unknown-time` 而不放行。
		*   · 单个文件 stat 失败**不拖垮整批**（刚好被删 / 权限），那一个就是 0 —— 界面上如实反映。
		*   · 只 stat **定稿与审查报告**这几个（真实功能里 2~5 个），不给整份产物清单每个都来一遍。
		*/
		async function mtimeMsOf(port, absPath, signal) {
			try {
				const st = await port.stat(absPath, signal);
				return mtimeOf(st && st.version);
			} catch (e) {
				return 0;
			}
		}
		/**
		* 功能详情的完整视图模型。
		*
		* @returns `{ root, artifacts, stage, finalCheck, checklist, gate, notes }`
		*   · `artifacts.groups` —— 按桶分组（含空桶与"未归桶"），每条带 gdd 细分 kind 与规范名标注
		*   · `artifacts.allPaths` —— **面板会列出的清单**（对账用：与磁盘递归列举逐条 diff 应为 0）
		*   · `stage` —— 三阶段进度
		*   · `finalCheck` —— `checkFinals` 原样结论（V1）
		*   · `checklist` —— `gddChecklist`（V1 + V3/V5/V6/V8/V11，带 level 与行号；V11 的"新旧"用真时间）
		*   · `gate` —— `finalGate`：**这份定稿能不能交程序**（人话；审查是必经一步）
		*/
		async function loadFeatureDetail(port, options) {
			const root = options.root;
			const signal = options.signal;
			const listing = await scanFeatureListing(port, options);
			const artifacts = featureArtifacts(listing);
			const notes = (artifacts.notes || []).slice();
			const gddGroup = artifacts.groups.find((g) => g.key === "gdd");
			const gddFiles = gddGroup && gddGroup.files || [];
			const finalFiles = gddFiles.filter((f) => !f.subdir && f.kind === "final");
			const reviewFiles = gddFiles.filter((f) => !f.subdir && f.kind === "review");
			const heads = [];
			for (const f of finalFiles) {
				const abs = root + "/gdd/" + f.name;
				const head = parseFrontmatter$1(await readHead$1(port, abs, signal) || "");
				heads.push({
					name: f.name,
					doc_type: head ? head.doc_type : null,
					status: head ? head.status : null,
					mtime: await mtimeMsOf(port, abs, signal)
				});
			}
			const finalCheck = checkFinals(heads);
			annotateFinals(artifacts, finalCheck);
			const current = finalCheck.current || null;
			let text = "";
			if (current) {
				const t = await readAllText$1(port, root + "/gdd/" + current, signal, 6e3);
				if (t === null) {
					notes.push("当前有效定稿 `" + current + "` 读不到正文 —— 正文类校验（V3/V5/V6/V8）本轮为空。");
					text = "";
				} else text = t;
			}
			const reviewMs = {};
			for (const f of reviewFiles) reviewMs[f.name] = await mtimeMsOf(port, root + "/gdd/" + f.name, signal);
			const currentMs = current ? Number((heads.filter((h) => h.name === current)[0] || {}).mtime) || 0 : 0;
			const checklist = gddChecklist({
				text,
				finals: heads,
				reviews: reviewFiles.map((f) => ({
					name: f.name,
					mtime: Number(reviewMs[f.name]) || 0
				})),
				mtime: currentMs
			});
			const gate = finalGate({
				finalCheck,
				v11: (checklist.checks || {}).V11,
				finalMs: currentMs,
				reviewMs,
				errors: (checklist.issues || []).filter((it) => it.level === "error")
			});
			if (current) {
				if (currentMs > 0) notes.push("时间来源：宿主 `stat` 的版本串（`dev:ino:size:mtimeNs:ctimeNs` 的第 4 段 = mtime 纳秒）—— V11 据此判「审查报告是否比定稿旧」，这次的结论：" + gate.review.state + "。");
				else notes.push("面板**看不到时间**（宿主 `stat` 的版本串不是预期的 5 段形状）—— 「审查报告是否比定稿旧」判不了；定稿门因此**不放行**（判不了就不当有效）。");
			}
			return {
				root,
				artifacts,
				stage: stageProgress(artifacts),
				finalCheck,
				checklist,
				gate,
				notes,
				dirs: Object.keys(listing.dirs),
				nestedDirs: listing.nestedDirs || []
			};
		}
		//#endregion
		//#region src/pure/sessionpick.ts
		/**
		* 「索引会话」的选择 —— 把"面板该用哪条会话"变成**纯函数**（零依赖、零全局）。
		*
		* 为什么需要它（工单 32 · DSH 0.2.0 兼容）：
		*   · 0.1.5 的会话列表快照里有 `current`（用户当前选中的会话），面板直接拿它当 sessionId；
		*   · 0.2.0 **没有 `current` 了** —— "当前会话"改成由 `byId[id].retainedBy.mainView > 0` 表达
		*     （官方 `dsh-client-ui-layout` 与 `dsh-client-ui-workspace` 都是这么算的），
		*     于是面板永远拿不到 sessionId ⇒ 永远停在「先在左侧选一个会话…」。
		*   · 规格（ADR 0005 / 工单 07）本来就要面板**不跟随当前选中会话**：它自己认领或创建一条
		*     cwd 覆盖 SR workspace 根的「索引会话」，`list` / `read` 全走它。
		*
		* ★ 本模块只回答"从候选中挑哪一条"，**所有 IO 留在组合根**（`src/client.js`）：
		*   `remote.session.list` / `rename` / `create`、`localStorage` 都不许进 pure 层。
		*
		* ★ 为什么"cwd 覆盖 sr 根"是硬条件：`workspaceFiles.read` 可以读工作区外的文件，
		*   但 `workspaceFiles.list` 被**限定在会话的工作区内**（开发笔记坑 3）。挑一条 cwd 不覆盖
		*   sr 根的会话 ⇒ `features\` 列不出来 ⇒ 看板 0 个功能（还会静默判成"没有功能"）。
		*/
		/** 索引会话的标题（认领凭据；`session.rename` 设定的显式标题不会被自动标题覆盖）。 */
		const INDEX_TITLE = "策划工作台·索引";
		/** 取不到归档集时的那句话（面板照实说，绝不装成"我知道它在侧边栏可见"）。 */
		const NO_ARCHIVE_INFO_NOTE = "取不到侧边栏的「已归档」集（官方 workspaces 快照里没有 archivedSessionIds）：这次无法确认目标会话在侧边栏可见 —— 若发完看不到它，去侧边栏「已归档」里取消归档即可。";
		/** 上次用的那条已被归档时的那句话（归档 ≠ 删除，所以要说清"它不算可用"）。 */
		const ARCHIVED_CACHED_NOTE = "上次用的那条会话已被你在侧边栏归档（归档 ≠ 删除，只是不显示）：它不算可用，这次没用它。";
		/** 归档集合归一成查找用的 Set；**拿不到**（null / undefined / 坏形状）时返回 `null`。 */
		function archivedIdSet(archived) {
			if (archived instanceof Set) {
				const out = /* @__PURE__ */ new Set();
				for (const one of archived) {
					const s = one === null || one === void 0 ? "" : String(one);
					if (s !== "") out.add(s);
				}
				return out;
			}
			if (Array.isArray(archived)) {
				const out = /* @__PURE__ */ new Set();
				for (const one of archived) {
					const s = one === null || one === void 0 ? "" : String(one);
					if (s !== "") out.add(s);
				}
				return out;
			}
			return null;
		}
		/**
		* 这个 id 是不是已归档。
		* ★ **拿不到归档集时一律判否**（= 不排除 = 旧行为）——降级绝不静默：调用方要按
		*   `NO_ARCHIVE_INFO_NOTE` 把"我不知道"如实说出来。
		*/
		function isArchivedId(archived, id) {
			const set = archivedIdSet(archived);
			return set !== null && typeof id === "string" && id !== "" && set.has(id);
		}
		/**
		* 从候选里**剔掉**已归档的那些（它们点不出来：侧边栏不显示）。
		* ★ 拿不到归档集时**原样返回**（向后兼容：不传归档集 = 旧行为）。
		*/
		function withoutArchived(rows, archived) {
			const list = (rows || []).filter((r) => r && r.id);
			const set = archivedIdSet(archived);
			if (set === null) return list;
			return list.filter((r) => !set.has(String(r.id)));
		}
		/**
		* 官方 `workspaces` 客户端服务的**快照** → 归档 id 表。
		* `null` = 这个快照里**没有**归档集（拿不到 ⇒ 调用方如实降级，别当成空表）。
		* 形状判据只有一处（这里），将来官方改字段只改这一个函数。
		*/
		function archivedFromSnapshot(snap) {
			if (!snap || typeof snap !== "object") return null;
			const raw = snap.archivedSessionIds;
			if (!Array.isArray(raw)) return null;
			const out = [];
			for (const one of raw) {
				const s = one === null || one === void 0 ? "" : String(one);
				if (s !== "") out.push(s);
			}
			return out;
		}
		/** 路径归一：统一成反斜杠、去掉尾部分隔符、小写（Windows 大小写不敏感）。 */
		function normPath(p) {
			if (p === null || p === void 0) return "";
			return String(p).replace(/\//g, "\\").replace(/\\+$/, "").toLowerCase();
		}
		/** 两个路径是不是同一个（Windows 口径）。空值一律判否。 */
		function samePath(a, b) {
			const x = normPath(a);
			const y = normPath(b);
			return x !== "" && x === y;
		}
		/**
		* `root` 是不是 `p` 的祖先（或就是 `p` 本身）。
		* ★ 必须按分隔符判，不能 `startsWith`：`D:\TimeMachine2` 不在 `D:\TimeMachine` 里面。
		*/
		function containsPath(root, p) {
			const r = normPath(root);
			const t = normPath(p);
			if (r === "" || t === "") return false;
			return t === r || t.indexOf(r + "\\") === 0;
		}
		/** 标题是不是本工作台的索引会话（按前缀认领，允许尾部再带说明）。 */
		function isIndexTitle(t) {
			return typeof t === "string" && t.indexOf("策划工作台·索引") === 0;
		}
		/** 一条候选的"名字"：显式标题优先，其次展示名。 */
		function titleOf(row) {
			if (!row) return "";
			if (typeof row.title === "string" && row.title !== "") return row.title;
			if (typeof row.display === "string" && row.display !== "") return row.display;
			return "";
		}
		const num = (v) => typeof v === "number" && isFinite(v) ? v : 0;
		/**
		* 会话行 / 列表项里的**权限预设**读法 —— 形状判据只有这一处。
		*
		* 三种形状（都实测过或由官方源码推出）：
		*   · `session/list` 的行：`it.projections.values.permissions.currentValue`
		*     （投影 `permissions` 的视图是 `selectionSchema = { currentValue: string }`，
		*      见 `dsh-permission-presets/lib/index.js:187-201`）
		*   · 0.2.0 客户端 store 的行：`row.projectionValues.permissions`（**扁平**的 键→视图 表，
		*      见 `dsh-api-session-controller/lib/client.js:3511`）
		*   · 退一步：`row.permissions`（视图本体或裸字符串）
		*
		* 读不到一律返回 `""` —— 调用方要如实说"读不回来"，**不许**把空值当成"它已经不动了"。
		*/
		function presetOfProjections(p) {
			if (!p || typeof p !== "object") return "";
			const bag = p;
			const nested = bag.projections && typeof bag.projections === "object" ? bag.projections.values : void 0;
			const views = [
				bag.values,
				bag.projectionValues,
				nested,
				bag
			];
			for (const v of views) {
				if (!v || typeof v !== "object") continue;
				const perm = v.permissions;
				if (typeof perm === "string" && perm !== "") return perm;
				if (perm && typeof perm === "object") {
					const cur = perm.currentValue;
					if (typeof cur === "string" && cur !== "") return cur;
				}
			}
			return "";
		}
		/** 一条候选的权限预设（读不到 → `""`）。 */
		function presetOfRow(row) {
			if (!row) return "";
			return typeof row.preset === "string" ? row.preset : "";
		}
		/** 取 updatedAt 最大的一条（并列时保持原顺序，保证确定性）。 */
		function newest(rows) {
			let best = null;
			for (const r of rows) {
				if (!r || !r.id) continue;
				if (best === null || num(r.updatedAt) > num(best.updatedAt)) best = r;
			}
			return best;
		}
		/** 给定 sr 根时：cwd 与 sr 根完全相等的排在"祖先目录"前面（更贴规格里那条索引会话）。 */
		function preferExactRoot(rows, root) {
			if (!root) return rows;
			const exact = rows.filter((r) => samePath(r.cwd, root));
			return exact.length > 0 ? exact : rows;
		}
		/**
		* 客户端 store 快照 → 候选行。**同时吃 0.1.5 与 0.2.0 两种形状**：
		*   · 0.2.0（dsh-api-session-controller client）：`{ ids, byId }`，行上是 `{id, title, displayTitle, cwd, updatedAt, blank, retainedBy}`
		*   · 0.1.5：`{ current, byId }`（甚至只有 `current`）
		*/
		function rowsFromStore(state) {
			if (!state) return [];
			const byId = state.byId || {};
			const ids = Array.isArray(state.ids) ? state.ids.map(String) : Object.keys(byId);
			const current = typeof state.current === "string" ? state.current : "";
			const out = [];
			const seen = {};
			for (const id of ids) {
				const r = byId[id] || {};
				if (!id) continue;
				seen[id] = true;
				out.push({
					id,
					title: typeof r.title === "string" ? r.title : void 0,
					display: typeof r.displayTitle === "string" ? r.displayTitle : void 0,
					cwd: typeof r.cwd === "string" ? r.cwd : void 0,
					updatedAt: num(r.updatedAt),
					blank: r.blank === true,
					running: r.running === true,
					preset: presetOfProjections(r),
					main: id === current || !!(r.retainedBy && num(r.retainedBy.mainView) > 0)
				});
			}
			if (!seen[current] && current !== "") out.push({
				id: current,
				main: true
			});
			return out;
		}
		/** `remote.session.list` 的返回 → 候选行（0.2.0：标题在 `projections.values.title` 里）。 */
		function rowsFromList(value) {
			const items = value && (value.items || value.sessions) || [];
			const out = [];
			for (const it of items) {
				if (!it) continue;
				const id = it.sessionId || it.id;
				if (!id) continue;
				const pv = it.projections && it.projections.values;
				const projTitle = pv && typeof pv.title === "string" ? pv.title : void 0;
				out.push({
					id: String(id),
					title: typeof it.title === "string" && it.title !== "" ? it.title : projTitle,
					display: typeof it.displayTitle === "string" ? it.displayTitle : void 0,
					cwd: typeof it.cwd === "string" ? it.cwd : void 0,
					updatedAt: num(it.updatedAt),
					blank: it.blank === true,
					running: it.running === true,
					preset: presetOfProjections(it),
					main: false
				});
			}
			return out;
		}
		/**
		* 合并两份候选（同一 id 一拍）：**先来的字段优先，先来的空字段由后来的补上**。
		*
		* ★ 为什么要"补空"而不是"先来的整条赢"：两份候选来自不同通道，各有各的缺项 ——
		*   客户端 store 行带着 `main` / `displayTitle` / `running`，但 `title` 要等 host 投影下来
		*   （`SessionSummary.title`："absent until the host projects one"）；
		*   `session/list` 的标题在 `projections.values.title` 里，却没有 `main`。
		*   若整条赢，store 的"没标题"会把列表里的标题**抹掉** ⇒ 标题认领静默失效
		*   （索引会话还有 cwd 兜底，工作会话就只有标题这一条凭据 ⇒ 每次刷新新建一条，用户故事 27）。
		*/
		function mergeRows(primary, extra) {
			const out = [];
			const at = {};
			const fill = (dst, src) => {
				const merged = { id: dst.id };
				for (const k of [
					"title",
					"display",
					"cwd",
					"updatedAt",
					"blank",
					"main",
					"running",
					"preset"
				]) {
					const d = dst[k];
					const s = src[k];
					merged[k] = d === void 0 || d === "" || d === null ? s : d;
				}
				return merged;
			};
			for (const r of (primary || []).concat(extra || [])) {
				if (!r || !r.id) continue;
				if (at[r.id] === void 0) {
					at[r.id] = out.length;
					out.push(r);
					continue;
				}
				out[at[r.id]] = fill(out[at[r.id]], r);
			}
			return out;
		}
		/**
		* 挑一条索引会话。
		*
		* ★ 工单 07 的核心纪律：**索引会话必须是"面板自己的"**。
		*   所有权凭据只有两条（工单第 3 条：只能靠标题 + 缓存）：
		*     ① 标题以 `INDEX_TITLE` 开头（`session.rename` 设定的显式标题）；
		*     ② 缓存里那条 —— 而且必须是**面板自己写的**缓存（`mine`）。
		*   为什么要"我自己写的"这个标记：旧版本（工单 32 那一版）在"cwd 覆盖 sr 根"命中时
		*   **会把用户的会话写进缓存**（`缓存 = 借来的那条`），所以旧缓存不可信 —— 见 `IndexCache`。
		*   "cwd 覆盖 sr 根"**不再是所有权凭据**：用户自己的会话（cwd = `D:\TimeMachine`）是
		*   sr 根的祖先目录，一样"覆盖" —— 那正是本票要修的现象（面板借用户的会话当扫描口径）。
		*
		* 顺序（前一条命中就不再往下走）：
		*   ⓪ `opts.archived` —— 先剔掉已归档的那些（侧边栏看不见的会话不算可用）；
		*   ① `opts.cachedId` —— 上次用的那条，**在"自己的"里**、且（给了 root 时）cwd 覆盖 root；
		*   ② 标题认领 —— 自己的标题 + cwd 覆盖 root（精确等于 root 的先于祖先目录），取最新；
		*   ③ 一条自己的都没有 ⇒ **返回 null**（调用方去新建；**绝不借用户的会话**）；
		*   ④ `opts.borrow` —— 允许"随便借一条"的兜底（只有 `boot` 用它：那一步只 `read` 配置文件，
		*      不扫描、不订阅、不发指令 —— 借谁的都不影响结果）。借的顺序：cwd 覆盖 → 当前选中 → 最近更新。
		*/
		function pickIndexSession(rows, srWs, opts) {
			const o = opts || {};
			const live = withoutArchived(rows || [], o.archived);
			if (live.length === 0) return null;
			const own = live.filter((r) => isIndexTitle(titleOf(r)));
			const able = srWs ? own.filter((r) => containsPath(r.cwd, srWs)) : own;
			if (o.cachedId) {
				const hit = able.filter((r) => r.id === o.cachedId)[0];
				if (hit) return {
					id: hit.id,
					source: "cache",
					row: hit,
					others: Math.max(0, able.length - 1)
				};
			}
			if (able.length > 0) {
				const best = newest(srWs ? preferExactRoot(able, srWs) : able);
				if (best) return {
					id: best.id,
					source: "title",
					row: best,
					others: Math.max(0, able.length - 1)
				};
			}
			if (!(o.borrow || o.allowForeign)) return null;
			if (o.cachedId) {
				const hit = live.filter((r) => r.id === o.cachedId)[0];
				if (hit) return {
					id: hit.id,
					source: "cache",
					row: hit
				};
			}
			if (srWs) {
				const inside = live.filter((r) => containsPath(r.cwd, srWs));
				if (inside.length > 0) {
					const best = newest(preferExactRoot(inside, srWs));
					if (best) return {
						id: best.id,
						source: "cwd",
						row: best
					};
				}
			}
			const mains = live.filter((r) => r.main);
			if (mains.length > 0) {
				const best = newest(mains);
				if (best) return {
					id: best.id,
					source: "main",
					row: best
				};
			}
			const best = newest(live);
			if (best) return {
				id: best.id,
				source: "recent",
				row: best
			};
			return null;
		}
		/**
		* 面板自己的索引会话里，**cwd 列不出 sr 根**的那些（换过工作区地方之后留下的旧条目）。
		* 调用方用它如实说一句"旧的那条没用了"，而不是闷着新建一条。
		*/
		function staleIndexRows(rows, srWs, archived) {
			const own = withoutArchived(rows || [], archived).filter((r) => isIndexTitle(titleOf(r)));
			if (!srWs) return [];
			return own.filter((r) => !containsPath(r.cwd, srWs));
		}
		/** 旧索引会话失效时的那句话（归档 ≠ 删除，所以要说清"它还在，只是没用了"）。 */
		function staleIndexNote(prevCwd) {
			return "以前那条索引会话（cwd = " + (String(prevCwd === null || prevCwd === void 0 ? "" : prevCwd) || "?") + "）不在 SR 工作区根里、从它那里列不出 `features\\`：这次没用它（它还在侧边栏，可直接归档）。";
		}
		/**
		* 借一条会话，用来**列举 SR 工作区之外的目录**（只读）。
		*
		* ★ 为什么需要它（工单 07 实测出来的）：
		*   索引会话的 cwd = **SR 工作区根**，而 host 侧的目录列举是**按会话 cwd 圈定**的 ——
		*   `dsh-api-workspace-files/lib/index.js:411` 把 scope 定成
		*   `workspaceRoot = header.cwd ?? sandboxPolicy.workspaceRoot`，`:500` `list` 再走
		*   `confine(root, workspaceRoot, …)`，越界直接报
		*   `workspace-file/outside-workspace`（"Directory is outside the workspace"）；
		*   文件头也写着 "Directory listings and change observations remain workspace-scoped"
		*   （**读**不受这个限制：`read` 走文件系统的读权限，可以读工作区之外）。
		*   于是 `config_root`（本机 `D:\TimeMachine\planner\策划配置`，在 SR 工作区**之外**）
		*   从索引会话里列不出来 ⇒ 看板的配置表清单、配置支线的"工作簿有没有同名文件"全都失明。
		*   旧版本之所以没露出来，是因为它**借了用户的会话**（cwd = `D:\TimeMachine`，公共祖先）当扫描口径。
		*
		* ★ 这条会话只被 `list` 用（不订阅、不发指令、不显示）——所以这里明确**允许借**：
		*   面板对"我的会话"的所有权纪律（标题 + 自己写的缓存）管的是**索引/工作会话的认领**，
		*   不是"能不能借一条会话读文件"（读配置那一步本来就是借的，见 `resolveIndexSession` 第 1 步）。
		*
		* 挑法：cwd **覆盖** `needPath`（祖先或本身）的里面，取 **cwd 最长（最贴近、暴露面最小）** 的那条；
		* 并列取 updatedAt 最新。一条都没有 → `null`（调用方如实说"列不了"，**不许**编缺件）。
		*/
		function pickListingSession(rows, needPath, opts) {
			const live = withoutArchived(rows || [], opts && opts.archived).filter((r) => r && r.id && r.id !== (opts && opts.exclude));
			if (!needPath) return null;
			const covering = live.filter((r) => containsPath(r.cwd, needPath));
			if (covering.length === 0) return null;
			let best = null;
			for (const r of covering) {
				if (best === null) {
					best = r;
					continue;
				}
				const a = normPath(r.cwd).length, b = normPath(best.cwd).length;
				if (a > b || a === b && num(r.updatedAt) > num(best.updatedAt)) best = r;
			}
			return best ? {
				id: best.id,
				source: "recent",
				row: best
			} : null;
		}
		/** 借不到"能列这个目录"的会话时的那句话（如实说清"核不了"，不编缺件）。 */
		function noListingSessionNote(needPath) {
			return "没有一条会话的 cwd 覆盖 `" + String(needPath || "?") + "` ⇒ 这个目录（在 SR 工作区之外）列不出来：面板对其中文件的**存在性一律按「核不了」处理**（不编缺件；想让它可核，在左侧建一条 cwd 覆盖该目录的会话即可）。";
		}
		/** sr 配置的默认文件名（相对"工作区根"）。 */
		const SR_CONFIG_REL = "\\.agents\\skills\\sr-askme\\config.local.json";
		/**
		* 候选配置路径：每个候选根一个**绝对路径**，最后兜一条**相对路径**
		* （相对路径由 host 按会话 cwd 解析 —— 那是 0.1.5 时代唯一能用的那条，留着当兜底）。
		*
		* ★ 浏览器半侧收不到插件 config（开发笔记坑 7），所以 `configPath` 在浏览器里是空的，
		*   绝对路径只能自己按"候选根"拼 —— 候选根来自工作区列表 / 会话 cwd / 默认根。
		*/
		function configPathCandidates(roots) {
			const out = [];
			const seen = {};
			for (const raw of roots || []) {
				if (raw === null || raw === void 0) continue;
				const base = String(raw).replace(/[\\/]+$/, "");
				if (base === "") continue;
				const abs = base + SR_CONFIG_REL;
				const key = normPath(abs);
				if (seen[key]) continue;
				seen[key] = true;
				out.push(abs);
			}
			out.push(".agents/skills/sr-askme/config.local.json");
			return out;
		}
		/** localStorage 里记"这条工作区用哪条索引会话"的键（只在组合根里读写）。 */
		function indexCacheKey() {
			return "sr-wb.index.v1";
		}
		/** 缓存原文 → 条目；坏 JSON / 形状不对 → `null`（一律当成"没有缓存"，绝不抛）。 */
		function indexCacheParse(raw) {
			if (typeof raw !== "string" || raw === "") return null;
			try {
				const v = JSON.parse(raw);
				if (!v || typeof v !== "object") return null;
				const sid = typeof v.sid === "string" ? v.sid : "";
				if (sid === "") return null;
				return {
					srWs: typeof v.srWs === "string" ? v.srWs : "",
					sid,
					mine: v.mine === true,
					title: typeof v.title === "string" ? v.title : ""
				};
			} catch (e) {
				return null;
			}
		}
		/** 写一条缓存（**只有自己建完才调它** —— 这就是 `mine` 的来源）。 */
		function indexCacheSerialize(srWs, sid, title) {
			return JSON.stringify({
				srWs: String(srWs === null || srWs === void 0 ? "" : srWs),
				sid: String(sid === null || sid === void 0 ? "" : sid),
				mine: true,
				title: String(title === null || title === void 0 ? "" : title)
			});
		}
		/**
		* 缓存里这条**能不能当所有权凭据**。
		* ★ 只有 `mine: true` 才算（旧版本写的不算 —— 它可能是借来的用户会话）。
		*/
		function indexCacheOwned(entry) {
			return !!(entry && entry.mine === true && entry.sid !== "");
		}
		/** 旧缓存作废时的那句话（说清"不是你的会话被删了"，而是"那条不是我的"）。 */
		const FOREIGN_CACHE_NOTE = "上次记的索引会话不是面板自己建的（旧版本曾按「cwd 覆盖」借用过你的会话）：这条缓存已作废，这次重新认领或新建一条属于面板的索引会话。";
		/** `session.rename` 的标题：带工作区名，便于人一眼看出这条会话是干什么的。 */
		function indexTitleFor(srWs) {
			const base = normPath(srWs).split("\\").filter(Boolean).pop() || "";
			return base ? INDEX_TITLE + "（" + base + "）" : INDEX_TITLE;
		}
		/**
		* 工作会话的标题（认领凭据）。
		* ★ 与索引会话（`策划工作台·索引`）**分开**：索引会话的 cwd 是 SR workspace 根、只负责扫描；
		*   工作会话的 cwd 是 `features\<主题>\`、只负责干活（规格「三层会话」）。
		*/
		const WORK_TITLE = "策划工作台·工作";
		/**
		* 「不属于任何功能」的工作会话（资产索引刷新 / 收件箱导入）的标题。
		* ★ 它是**第三类**：cwd = SR 工作区根（不是功能目录），但也**会收到指令**（不是索引会话）。
		*   给它一个可识别标题的唯一目的是"下次还认得回来"—— 没有标题时面板每次刷新都会新建一条
		*   （`ensureWorkSession` 只有内存缓存，刷新即丢）。
		*/
		const WORK_ROOT_TITLE = "策划工作台·工作（SR 工作区）";
		/** 功能主题 = 功能目录名（`features\<主题>\` 的最后一段）。空值一律给空串。 */
		function featureTopicOf(root) {
			return normPath(root).split("\\").filter(Boolean).pop() || "";
		}
		/** 标题是不是本工作台的工作会话（按前缀认领，允许尾部再带说明）。 */
		function isWorkTitle(t) {
			return typeof t === "string" && t.indexOf("策划工作台·工作") === 0;
		}
		/** 工作会话该有的标题：`策划工作台·工作（联盟悬赏）`。 */
		function workTitleFor(root) {
			const topic = featureTopicOf(root);
			return topic ? WORK_TITLE + "（" + topic + "）" : WORK_TITLE;
		}
		/**
		* 挑一条**该功能的**工作会话。
		*
		* 顺序（前一条命中就不再往下走）：
		*   ⓪ `opts.archived` —— **先剔掉已归档的那些**：这条会话是**要被发指令**的，
		*      用户看不见它 = 指令发进去了、界面什么也没有（2026-09-30 实测缺陷）。不传 = 旧行为；
		*   ① `opts.cachedId` —— 面板上次给这个功能用的那条，**且 cwd 就是功能根**；
		*   ② 标题认领 —— 标题以 `WORK_TITLE` 开头，**且 cwd 就是功能根**（自己建的会话，清缓存也能认回）；
		*   ③ 没有 → 返回 null（调用方去建；建完一定 `rename` 成 `workTitleFor(root)`，下次就靠 ② 认回来）。
		*
		* ★ 为什么**不**像索引会话那样兜一条"cwd 落在功能根里的任意会话"：
		*   工作会话会被面板**发指令**（索引会话只被读）。认一条用户自己的会话 = 往用户的对话里插活，
		*   正是用户故事 23 要避免的（"我的对话不被工作任务的来回打断"）。
		*   所以这里只认"我们自己的凭据"：缓存里的 id，或我们命名过的标题。
		* ★ 为什么 cwd 必须**恰好等于**功能根（不是 contains）：工作会话的 cwd = 功能文件夹本身；
		*   落在别处（比如 SR 根、别的功能）说明它不是这个功能的工作会话。
		*/
		function pickWorkSession(rows, featureRoot, opts) {
			const o = opts || {};
			const root = normPath(featureRoot);
			if (root === "") return null;
			const live = withoutArchived(rows || [], o.archived).filter((r) => samePath(r.cwd, root));
			if (live.length === 0) return null;
			if (o.cachedId) {
				const hit = live.filter((r) => r.id === o.cachedId)[0];
				if (hit) return {
					id: hit.id,
					source: "cache",
					row: hit,
					others: Math.max(0, live.length - 1)
				};
			}
			const named = live.filter((r) => isWorkTitle(titleOf(r)));
			const best = newest(named);
			if (best) return {
				id: best.id,
				source: "title",
				row: best,
				others: Math.max(0, named.length - 1)
			};
			return null;
		}
		/**
		* localStorage 里记"每个功能用哪条工作会话"的键（只在组合根里读写）。
		* ★ 与索引会话的键分开：索引会话一条工作区一个，工作会话**一个功能一条**，所以值是一张表。
		*/
		function workCacheKey() {
			return "sr-wb.work.v1";
		}
		/** 缓存原文（可能是坏 JSON / 空）→ 表。坏值一律当空表，绝不抛。 */
		function workCacheTable(raw) {
			if (typeof raw !== "string" || raw === "") return {};
			try {
				const v = JSON.parse(raw);
				if (!v || typeof v !== "object") return {};
				const out = {};
				for (const k of Object.keys(v)) {
					const one = v[k];
					if (typeof one === "string" && one !== "") out[k] = one;
				}
				return out;
			} catch (e) {
				return {};
			}
		}
		/** 这张表里，这个功能用的是哪条工作会话（没有 → 空串）。 */
		function workCacheGet(raw, featureRoot) {
			const root = normPath(featureRoot);
			if (root === "") return "";
			return workCacheTable(raw)[root] || "";
		}
		/** 写回一条（返回**新的**缓存原文；组合根负责 `setItem`）。 */
		function workCachePut(raw, featureRoot, sid) {
			const root = normPath(featureRoot);
			const t = workCacheTable(raw);
			if (root !== "" && typeof sid === "string" && sid !== "") t[root] = sid;
			return JSON.stringify(t);
		}
		/** 删掉一条（会话失效自愈时用；返回新的缓存原文）。 */
		function workCacheDrop(raw, featureRoot) {
			const root = normPath(featureRoot);
			const t = workCacheTable(raw);
			if (root !== "") delete t[root];
			return JSON.stringify(t);
		}
		/**
		* 「完全权限」的机器值。
		* 依据：`dsh-permission-presets/lib/index.js:151-156`（presets 里的 `danger-full-access`
		* = sandbox `danger-full-access` + approval `never`），客户端标签见
		* `dsh-client-ui-permission-presets/lib/client.js:231`（`FULL_ACCESS_PRESET`）。
		*/
		const PERMISSION_FULL = "danger-full-access";
		/**
		* 切预设的**唯一**通道：官方注册的斜杠命令 `/permission <preset>`。
		*
		* ★ 为什么是命令而不是某个 remote 方法：`dsh-permission-presets` 只对外暴露一个 remote
		*   （`permissionPresets/catalog`，见 `.../typert.remote-client.js`）——**没有 set 方法**；
		*   官方自己切预设就是那条命令（`lib/index.js:207-226` 注册 `permission` 命令，
		*   官方 plan 插件也是这么发命令的：`dsh-client-ui-plan/lib/client.js:704`
		*   `remote.commands.execute(sessionId, "/plan off", [])`）。
		*/
		function permissionCommandLine(preset) {
			return "/permission " + (typeof preset === "string" && preset !== "" ? preset : PERMISSION_FULL);
		}
		/** 这条会话**当前**是不是「完全权限」——`true` 才需要动手；读不到（`""`）一律不动。 */
		function needsFullAccess(preset) {
			return typeof preset === "string" && preset !== "" && preset !== "danger-full-access";
		}
		/**
		* 由 `remote.permissionPresets.catalog()` 的返回（`{ options, defaultOptions, defaultPreset }`，
		* 形状见 `dsh-permission-presets/lib/typert.remote-client.js`）决定**要不要切**。
		*
		* ★ 为什么以"进程默认预设"为准：新会话是**播种**默认预设的
		*   （`lib/index.js:198-201` `ctx.on("session/created", pinInitialPermission)`），
		*   所以默认已是完全权限时，新工作会话建出来就是完全权限，**面板不需要再切**——
		*   这时如实说一句"本机默认就是完全权限"，而不是多发一条命令装样子。
		* ★ 读不到（catalog 不可用 / 形状变了）时**按最坏情况切一次**：宁可在日志里多一条命令，
		*   也不要让"配置支线写 config_root / gtgenerator 工作目录"被沙箱拦下来。
		*/
		function permissionPlanOf(catalog) {
			const obj = catalog && typeof catalog === "object" ? catalog : null;
			const def = obj && typeof obj.defaultPreset === "string" ? obj.defaultPreset : "";
			if (def === "danger-full-access") return {
				needed: false,
				preset: PERMISSION_FULL,
				why: "default=" + PERMISSION_FULL,
				note: "本机 profile 的默认权限预设已是「完全权限」（permission.defaultPreset = danger-full-access）：新建的会话本身就是完全权限，不用再切。"
			};
			if (def === "") return {
				needed: true,
				preset: PERMISSION_FULL,
				why: "unreadable",
				note: "读不到本机的默认权限预设（`permissionPresets.catalog` 不可用或形状变了）：按最坏情况给这条工作会话切一次「完全权限」。"
			};
			return {
				needed: true,
				preset: PERMISSION_FULL,
				why: "default=" + def,
				note: "本机默认权限预设是「" + def + "」，不是完全权限：这条工作会话已切成「完全权限」——否则功能文件夹之外的产出（配置支线写 config_root、gtgenerator 工作目录）会被拦。"
			};
		}
		/**
		* 切完之后那句话（含**读回**证据）。
		* @param execOk   命令本身成功没有
		* @param execText 命令返回的人话（`preset danger-full-access` / 错误文本）
		* @param readback 重新拉列表读回的该会话预设（`permissions.currentValue`，读不到 = `""`）
		*/
		function permissionResultNote(execOk, execText, readback) {
			const want = PERMISSION_FULL;
			const got = typeof readback === "string" ? readback : "";
			const text = String(execText === null || execText === void 0 ? "" : execText);
			if (!execOk) return "没能把这条工作会话切到完全权限（" + (text || "命令失败") + "）：功能文件夹之外的产出可能被拦 —— 在左侧点开这条会话，手动发 `/permission danger-full-access` 即可。";
			if (got === want) return "已把这条工作会话切成「完全权限」（读回 permissions = " + got + "）。";
			if (got !== "") return "切权限的命令返回成功，但读回仍是「" + got + "」（不是完全权限）：以读回为准，功能文件夹之外的产出可能被拦。";
			return "已发切换命令（返回：" + (text || "无文本") + "），但**读不回**当前预设：如果产物被拦，在左侧点开这条会话手动发 `/permission danger-full-access`。";
		}
		//#endregion
		//#region src/pure/sendfail.ts
		/** 把 `{ok:false,error:{code,message}}` / `Error` / 字符串统一成"码 + 人话"。 */
		function parts(err) {
			if (err === null || err === void 0) return {
				code: "",
				message: ""
			};
			if (typeof err === "string") return {
				code: "",
				message: err
			};
			const anyErr = err;
			const inner = anyErr.error || anyErr;
			const code = typeof inner.code === "string" ? inner.code : "";
			let message = "";
			if (typeof inner.message === "string") message = inner.message;
			else if (inner !== null && inner !== void 0) try {
				message = JSON.stringify(inner);
			} catch (e) {
				message = String(inner);
			}
			return {
				code,
				message
			};
		}
		/**
		* 会话是不是**已经不在了**（可自愈的那一类）。
		* 判据同时看码与人话：0.2.0 给 `session/not-found`，旧版/网关可能只给一句
		* `no such session` / `no entry` / `找不到目标`（面板此前的 `humanError` 就是这么认的）。
		* ★ `workspace-file/not-found` **不算**：那是"文件找不到"，重建会话也解决不了它。
		*/
		function isSessionGone(err) {
			const { code, message } = parts(err);
			const s = (code + " " + message).toLowerCase();
			if (/workspace-file\//.test(s)) return false;
			if (/not-found|not_found|no such session|session.*missing|no entry/.test(s)) return true;
			return /找不到目标|会话不存在|会话已不存在/.test(code + " " + message);
		}
		/** 失败 → 可读错误 + 下一步（面板直接显示这两句，不再自己写一份判断）。 */
		function explainSendFailure(err) {
			const { code, message } = parts(err);
			const s = (code + " " + message).toLowerCase();
			if (isSessionGone(err)) return {
				code: "gone",
				message: "这条工作会话已经不在了（被关掉、删掉，或换了机器）。",
				next: "面板已经就着重建了一条并重发一次；若仍失败，点「跳到那个会话」自己把指令再发一遍。"
			};
			if (/agent-busy|session-busy|busy/.test(s)) return {
				code: "busy",
				message: "那条工作会话正在跑别的活（忙碌）。",
				next: "指令走的是排队模式，等它跑完当前这一轮就会处理；点「跳到那个会话」能看着它跑。"
			};
			if (/writer-held|writer_held|locked|占用/.test(s)) return {
				code: "writer",
				message: "那条会话被另一个进程/窗口占着（writer-held）——现在谁都写不进去。",
				next: "把占用它的那个窗口或实例关掉，再按一次「发到工作会话」。"
			};
			if (/permission|forbidden|unauthor|denied|not permitted|沙箱|权限/.test(s)) return {
				code: "perm",
				message: "权限不够：这条会话的沙箱不让它写这个位置。",
				next: "在那个工作会话里跑一下 `/permission danger-full-access`，再按一次「发到工作会话」。"
			};
			if (/timeout|timed out|超时/.test(s)) return {
				code: "timeout",
				message: "对方没有响应（超时）。",
				next: "再按一次；连着超时说明实例忙，过一会儿再试。"
			};
			if (/without inject|not available|unavailable|未注入|不可用|缺少|bad-request/.test(s)) return {
				code: "unavailable",
				message: "发送通道不可用（面板缺注入的服务，或宿主拒绝了这次请求）。",
				next: "刷新一次页面（F5）再试；仍失败就点「跳到那个会话」手动发 —— 指令原文就在上面那段。"
			};
			return {
				code: "other",
				message: message || "发送失败（远端没有给原因）。",
				next: "再按一次；仍失败就把这条错误连同上面的条目引用一起发给开发者。"
			};
		}
		//#endregion
		//#region src/pure/refgraph.ts
		/**
		* 引用图与影响范围（设计 §6.4.1）
		*
		* ★ 工单 03（WorkspacePort 接缝）从 `src/client.js` **逐字搬来**，只做了整体去缩进与补 export；
		*   正文一字未改（行为不变的证据：临时 harness 对真实工作区数据做迁移前后 deepEqual）。
		* ★ 工单 14 补上第六类边：⑥ 契约关联（§4「配置字段」列 ↔ §6 声明的字段行）。
		* 只算结构可判定的边：显式引用 / 编号同族 / 界面归属 / 验收关联 / 文本关联 / 契约关联。不做语义推断。
		* ★ 工单 13/14 接线：本模块另导出三件**给界面用**的纯函数 —— `refOf`（条目引用的唯一构造口径）、
		*   `fieldRowAt`（§6 字段行按行号回查键）、`edgeLabelOf`（把六类边叫给人听）。
		*   它们都不改 `byRef` 的 hits：旧五类边的输出一字不变。
		*/
		const REF_TOKEN_RE = /(UE\d+[a-z]?|AC\d+|R\d+|UI-M\d+|[a-z][a-z0-9_]{3,})/g;
		/** ⑥ 契约关联边的命中标记（六类边里唯一新增的 kind；②同族是 `family`，其余五类不带 kind） */
		const CONTRACT_KIND = "contract";
		/**
		* 条目引用的**唯一构造口径**（CONTEXT.md 的粒度规则）——
		*   `§4 R6`（§4 到规则组）· `§5 UI-M1 UE3`（§5 到界面组 + 条目）· `§7 alli_boss_x`（§7 到键）
		*   `§10 AC8`（§10 到条目）· `§6 难度表.clearDropId`（§6 到行：表名 + 字段，在本文件末尾按声明行生成）
		*
		* ★ 为什么要有它：引用串就是 `byRef` 的键。**面板自己拼字符串迟早拼错一个空格**，
		*   拼错了查图就是空集、还看不出为什么 —— 所以构造键的地方（`buildRefGraph`）与
		*   生成引用的地方（`finaltree.ts` / 面板定位卡）必须同源，只留这一份。
		* ★ 与搬家前的内联写法逐字等价：`(gr.id || gr.no || "")` 取组标识、无组标识时不留双空格。
		*/
		function refOf(no, group, key) {
			const g = String(group == null ? "" : group).trim();
			const k = String(key == null ? "" : key).trim();
			return ("§" + String(no == null ? "" : no) + (g ? " " + g : "") + (k ? " " + k : "")).trim();
		}
		/**
		* 行号 → **§6 字段行**的可引用键与字段名（`{ ref, field, table }`）；不是字段声明行返回 null。
		*
		* ★ 为什么按行号回查：§6 的字段行**不在** `doc.outline` 的 `rows` 里（解析器把表格第一列当条目，
		*   而字段声明表的第 3 格才是字段名），所以面板在树上画 §6 时只能拿行号回来问图。
		*   口径只此一份：键就是 `buildRefGraph` 生成的那个（含同名字段的退化路径）。
		*/
		function fieldRowAt(graph, line) {
			if (!graph || !graph.byRef) return null;
			for (const kv of graph.byRef) {
				const e = kv[1];
				if (e && e.kind === "field" && e.line === line) return {
					ref: kv[0],
					field: String(e.field || ""),
					table: String(e.table || "")
				};
			}
			return null;
		}
		/** 标签 → 六类边的全名（面板图例用；下标即①–⑥的顺序） */
		const EDGE_LEGEND = [
			"① 显式引用 —— 全文提到这个编号/键的位置",
			"② 编号同族 —— 同组内 UE3 ↔ UE3a 这类子情形",
			"③ 界面归属 —— §5 界面组自己名下的行、§5.0 清单里那一行",
			"④ 验收关联 —— §10 里写了这个编号的行",
			"⑤ 文本关联 —— §7 文本键 ↔ 提及它的位置",
			"⑥ 契约关联 —— §4 配置字段 ↔ §6 声明它的那一行"
		];
		/** 定位串（`§4 R6 奖励` / `§10 10. 验收标准`）→ 章号；取不到返回 "" */
		function chapterOfLabel(where) {
			const m = /^§(\d+)/.exec(String(where == null ? "" : where));
			return m ? m[1] : "";
		}
		function edgeLabelOf(graph, ref, hit) {
			const h = hit || {};
			const e = graph && graph.byRef && ref ? graph.byRef.get(ref) || {} : {};
			if (h.kind === "family") return "同族";
			if (h.kind === "contract") return "契约";
			if (e.kind === "field") return "契约";
			if (e.kind === "textkey") return "文本";
			const where = String(h.where || "");
			if (chapterOfLabel(where) === "10") return "验收";
			const r = String(ref || "");
			if (e.kind === "group" && /^§5 UI-M\d+$/.test(r) && (where === r || where.indexOf(r + " ") === 0 || where.indexOf("§5 5.0 ") === 0)) return "归属";
			return "引用";
		}
		/**
		* ⑥ 契约关联的账（`buildRefGraph` 返回的 `contract`）—— 如实报数，错了能一眼看见：
		*   · `refs`      §4 的 `表.字段` 引用条数（= V6 的 refCount）
		*   · `decls`     §6 声明出来的字段行数（= V6 的 declCount）
		*   · `rowRefs`   「整表 + 括号里列举字段」那种形态的条数（只服务本边，V6 不算）
		*   · `edges`     实际连出的边数（两个方向各记一次命中）
		*   · `unmatched` §4 引用了、§6 没声明的字段（真实定稿为空；有值说明有字段漏配）
		*/
		function emptyContract() {
			return {
				refs: 0,
				decls: 0,
				rowRefs: 0,
				edges: 0,
				unmatched: []
			};
		}
		/**
		* `g.blocks` → 按**绝对行号**索引的正文行（行号与编辑器一致；块与块之间不重叠，缺的位留空串）。
		* 契约关联要按行号回查"这一行属于哪个组"与"原文是什么"，而解析结果里只有块起始行号。
		*/
		function linesFromBlocks(blocks) {
			const out = [];
			for (const b of blocks) {
				const seg = String(b.text == null ? "" : b.text).split(/\r?\n/);
				for (let i = 0; i < seg.length; i++) out[b.line + i - 1] = seg[i];
			}
			for (let i = 0; i < out.length; i++) if (out[i] === void 0) out[i] = "";
			return out;
		}
		/** 行号 → `{ ref, where }`：所在 level-3 组的引用串（`§4 R6`）与定位串（`§4 R6 奖励`，与①扫描同口径） */
		function ownersOf(blocks) {
			const owner = /* @__PURE__ */ new Map();
			for (const b of blocks) {
				const seg = String(b.text == null ? "" : b.text).split(/\r?\n/);
				const where = b.level === 2 ? "§" + b.no + " " + b.title : "§" + (b.chNo || "?") + " " + (b.id || b.no || "") + " " + b.title;
				const ref = b.level === 3 ? refOf(b.chNo || "?", b.id || b.no || "", "") : "";
				for (let i = 0; i < seg.length; i++) owner.set(b.line + i, {
					ref,
					where: where.trim(),
					title: b.title || "",
					no: b.no || ""
				});
			}
			return owner;
		}
		function buildRefGraph(g) {
			if (!g || !g.outline) return {
				byRef: /* @__PURE__ */ new Map(),
				vocabSize: 0,
				edgeCount: 0,
				contract: emptyContract()
			};
			const vocab = /* @__PURE__ */ new Map();
			const add = (tk, kind, ref) => {
				if (tk && !vocab.has(tk)) vocab.set(tk, {
					kind,
					ref
				});
			};
			for (const c of g.outline) {
				for (const r of c.rows) if (/^AC\d+$/.test(r.key)) add(r.key, "ac", refOf(c.no, "", r.key));
				else if (/^[a-z][a-z0-9_]{3,}$/.test(r.key) && c.no === "7") add(r.key, "textkey", refOf("7", "", r.key));
				for (const gr of c.children) {
					const gid = gr.id || gr.no || "";
					if (gr.id) add(gr.id, "group", refOf(c.no, gid, ""));
					for (const r of gr.rows) if (/^(UE\d+[a-z]?|AC\d+)$/.test(r.key)) add(r.key, "row", refOf(c.no, gid, r.key));
				}
			}
			if (!vocab.size) return {
				byRef: /* @__PURE__ */ new Map(),
				vocabSize: 0,
				edgeCount: 0,
				contract: emptyContract()
			};
			const hits = /* @__PURE__ */ new Map();
			for (const b of g.blocks) {
				const where = b.level === 2 ? "§" + b.no + " " + b.title : "§" + (b.chNo || "?") + " " + (b.id || b.no || "") + " " + b.title;
				const lines = String(b.text || "").split(/\r?\n/);
				for (let i = 0; i < lines.length; i++) {
					const txt = lines[i];
					if (!txt) continue;
					REF_TOKEN_RE.lastIndex = 0;
					let m, seen;
					while ((m = REF_TOKEN_RE.exec(txt)) !== null) {
						const tk = m[1];
						if (!vocab.has(tk)) continue;
						seen = seen || {};
						if (seen[tk]) continue;
						seen[tk] = 1;
						if (!hits.has(tk)) hits.set(tk, []);
						hits.get(tk).push({
							line: b.line + i,
							where: where.trim(),
							text: txt.trim()
						});
					}
				}
			}
			const byRef = /* @__PURE__ */ new Map();
			let edges = 0;
			for (const kv of vocab.entries()) {
				const tk = kv[0], meta = kv[1];
				const list = hits.get(tk) || [];
				byRef.set(meta.ref, {
					token: tk,
					kind: meta.kind,
					hits: list
				});
				edges += list.length;
			}
			for (const c of g.outline) for (const gr of c.children) {
				const fam = {};
				for (const r of gr.rows) {
					const m = /^([A-Za-z][A-Za-z\-]*\d+)([a-z])?$/.exec(r.key);
					if (!m) continue;
					if (!fam[m[1]]) fam[m[1]] = [];
					fam[m[1]].push(r);
				}
				for (const k in fam) {
					if (fam[k].length < 2) continue;
					const gid = gr.id || gr.no || "";
					for (const me of fam[k]) {
						const e = byRef.get(refOf(c.no, gid, me.key));
						if (!e) continue;
						for (const other of fam[k]) {
							if (other === me) continue;
							e.hits.push({
								line: other.line,
								where: refOf(c.no, gid, other.key),
								text: other.text || "",
								kind: "family"
							});
							edges++;
						}
					}
				}
			}
			const contract = emptyContract();
			const cblocks = Array.isArray(g.blocks) ? g.blocks : [];
			if (cblocks.length) {
				const lines = linesFromBlocks(cblocks);
				const owner = ownersOf(cblocks);
				const decls = extractFieldDecls(lines);
				contract.decls = decls.length;
				const byField = /* @__PURE__ */ new Map();
				const declKey = /* @__PURE__ */ new Map();
				const used = /* @__PURE__ */ new Set();
				for (const d of decls) {
					const o = owner.get(d.line) || {
						title: "",
						no: ""
					};
					const table = String(o.title || "").split(/[（(]/)[0].trim() || String(o.no || "?");
					let key = "§6 " + table + "." + d.field;
					if (used.has(key) || byRef.has(key)) key = "§6 " + (o.no || "?") + "." + d.field;
					if (used.has(key) || byRef.has(key)) key = key + "（L" + d.line + "）";
					used.add(key);
					declKey.set(d.line, key);
					byRef.set(key, {
						token: d.field,
						kind: "field",
						field: d.field,
						table,
						line: d.line,
						hits: []
					});
					const at = byField.get(d.field);
					if (at) at.push(d);
					else byField.set(d.field, [d]);
				}
				const link = (groupRef, groupWhere, viaLine, d) => {
					const key = declKey.get(d.line);
					const entry = key ? byRef.get(key) : null;
					if (!entry) return;
					const groupEntry = groupRef ? byRef.get(groupRef) : null;
					if (groupEntry && !groupEntry.hits.some((h) => h.line === d.line)) {
						groupEntry.hits.push({
							line: d.line,
							where: key,
							text: d.text,
							kind: CONTRACT_KIND,
							field: d.field,
							via: viaLine
						});
						edges++;
						contract.edges++;
					}
					if (!entry.hits.some((h) => h.line === viaLine)) {
						entry.hits.push({
							line: viaLine,
							where: groupWhere,
							text: lines[viaLine - 1] || "",
							kind: CONTRACT_KIND,
							field: d.field
						});
						edges++;
						contract.edges++;
					}
				};
				const refs = extractFieldRefs(lines);
				contract.refs = refs.length;
				for (const r of refs) {
					const o = owner.get(r.line) || {};
					const ds = byField.get(r.field) || [];
					if (!ds.length) {
						contract.unmatched.push({
							line: r.line,
							field: r.field,
							ref: r.ref,
							form: "table.field"
						});
						continue;
					}
					for (const d of ds) link(o.ref || "", o.where || "", r.line, d);
				}
				const rowRefs = extractRowFieldRefs(lines);
				contract.rowRefs = rowRefs.length;
				for (const rr of rowRefs) {
					const o = owner.get(rr.line) || {};
					for (const f of rr.fields) {
						const ds = byField.get(f) || [];
						if (!ds.length) {
							contract.unmatched.push({
								line: rr.line,
								field: f,
								ref: rr.ref,
								form: "row"
							});
							continue;
						}
						for (const d of ds) link(o.ref || "", o.where || "", rr.line, d);
					}
				}
			}
			return {
				byRef,
				vocabSize: vocab.size,
				edgeCount: edges,
				contract
			};
		}
		/** 某个条目的影响范围：它自己的定义处 + 全文提到它的其他地方（去掉自身） */
		function impactOf(graph, ref, selfLine) {
			if (!graph || !graph.byRef) return [];
			const e = graph.byRef.get(ref);
			if (!e) return [];
			return e.hits.filter((h) => h.line !== selfLine);
		}
		//#endregion
		//#region src/pure/finaltree.ts
		/**
		* 定稿大纲树的**数据**（工单 13 的左边那棵树）—— 纯函数：`parseFinalGdd` 的结果 + `buildRefGraph` 的图
		* → 章 → 组 → 条目；每条能点的地方都带 **1-based 行号** 与 **条目引用**。
		*
		* ── 为什么树要单独成模块（而不是写在客户端的渲染函数里）────────────────────────
		*   ① 引用串就是引用图的键（`byRef` 的 key）——键拼错一个空格，查图就是空集、界面上还看不出为什么。
		*      所以键一律由 `refgraph.refOf` / `refgraph.fieldRowAt` 生成，**面板不自己拼字符串**。
		*   ② 「哪些行能单独引用、哪些不能」是**产品口径**，必须能被离线测试逐条比对
		*      （`test/pure-finaltree.test.ts` 对着 13-parse-oracle.md 数：§4 10 组 49 条 / §5 28 条 / §7 49 键 / §10 15 条）。
		*
		* ── 条目引用的粒度（CONTEXT.md，按章不同）────────────────────────────────────
		*   §4 到**规则组**（组内条目不单独编号，D1 纪律）⇒ 组内每一条都指向组引用 `§4 R6`，
		*     但**原文仍是点中的那一条**（`items[].line` 是该规则自己的行号）；
		*   §5 到**界面组 + 条目**（`§5 UI-M1 UE3`）· §6 到**行**（`§6 难度表.clearDropId`）·
		*   §7 到**键**（`§7 alli_boss_x`）· §10 到**条目**（`§10 AC8`）。
		*
		* ── 默认开合（工单 13 硬要求）─────────────────────────────────────────────
		*   **组级条目默认展开、章级条目默认收起** —— §7 有 49 个键，全展开会把树淹掉。
		*   这里给的是数据（`open` 字段），不是样式：渲染层照它给初始 state。
		*
		* ── 不可单独引用的行**不假装能点** ─────────────────────────────────────────
		*   `ref: ""` + `why`（原因），界面上显灰并把原因挂在 tooltip 上。真实定稿里这类行是：
		*   §2/§8/§9/§11 的表格行、§5.0 界面清单的 4 行、§6 的非字段行（中文字段/三列表）。
		*
		* ── 每条都带「现状原文」──────────────────────────────────────────────────
		*   `text` 是该行的 markdown 原文（章/组是标题行），`grain` 是这一类的粒度说明。
		*   定位卡上"行号会漂、原文不会"靠的就是这两个字段 —— 界面不自己回读文件、也不自己拼引用。
		*/
		/** §5 的交互条目编号（`UE3` / `UE3a`） */
		const UE_RE = /^UE\d+[a-z]?$/;
		/** §10 的验收条目编号 */
		const AC_RE = /^AC\d+$/;
		/** §7 的多语言文本键（与 `buildRefGraph` 的词表同一个判据） */
		const TEXTKEY_RE = /^[a-z][a-z0-9_]{3,}$/;
		/** 组标识：有 `UI-M1` / `R1` 用它，否则退回组号 `5.0` / `6.2` */
		function groupKey(gr) {
			return String(gr && gr.id || gr && gr.no || "");
		}
		/** 块 idx → 它的**标题行原文**（`doc.blocks[i].text` 的第一行；取不到返回空串） */
		function headingOf(blocks, idx) {
			const i = Number(idx);
			if (!blocks || !Number.isFinite(i) || i < 0 || i >= blocks.length) return "";
			return String(blocks[i] && blocks[i].text || "").split(/\r?\n/)[0].trim();
		}
		/** 引用粒度的说明（按章不同，与 CONTEXT.md 的规则逐字对应）—— 定位卡直接显示这句 */
		function grainOf(no, isGroup, isField) {
			if (isField || no === "6") return "§6 到行（表名 + 字段）";
			if (no === "4") return isGroup ? "§4 到规则组" : "§4 到规则组（组内条目不单独编号）";
			if (no === "5") return isGroup ? "§5 到界面组" : "§5 到界面组 + 条目";
			if (no === "7") return "§7 到键";
			if (no === "10") return "§10 到条目";
			return isGroup ? "组级引用" : "章级引用";
		}
		/**
		* 章级表格行 → 条目：只有 §7 的文本键与 §10 的 AC 是**可引用实体**（与词表同一个判据）；
		* §2/§8/§9/§11 的表格行（玩家动词、范围门、埋点、交接）不在词表里 ⇒ 显灰。
		*/
		function chapterItemOf(no, row) {
			if (no === "7" && TEXTKEY_RE.test(row.key)) return {
				ref: refOf("7", "", row.key),
				line: row.line,
				label: row.key,
				text: String(row.text || ""),
				grain: grainOf("7", false, false),
				why: ""
			};
			if (AC_RE.test(row.key)) return {
				ref: refOf(no, "", row.key),
				line: row.line,
				label: row.key,
				text: String(row.text || ""),
				grain: grainOf(no, false, false),
				why: ""
			};
			return null;
		}
		/**
		* 建树。`doc` = `parseFinalGdd` 的结果；`graph` = `buildRefGraph(doc)` 的结果（可空）。
		* 不做 IO、不改输入。
		*/
		function buildFinalTree(doc, graph) {
			const outline = doc && doc.outline || [];
			const blocks = doc && doc.blocks || [];
			const known = (ref) => !!(graph && graph.byRef && ref && graph.byRef.has(ref));
			const chapters = [];
			let nGroups = 0, nItems = 0, nSkipped = 0;
			for (const c of outline) {
				const ch = {
					no: String(c.no || ""),
					title: String(c.title || ""),
					line: Number(c.line) || 0,
					text: headingOf(blocks, c.idx),
					ref: "",
					grain: "章不是引用图的实体",
					idx: Number(c.idx) || 0,
					open: false,
					items: [],
					groups: [],
					skipped: 0
				};
				for (const r of c.rows || []) {
					const it = chapterItemOf(ch.no, r);
					if (!it) {
						ch.skipped++;
						continue;
					}
					if (!known(it.ref)) it.why = "引用图里没有这个键（面板显示不了它的影响范围）";
					ch.items.push(it);
					nItems++;
				}
				for (const gr of c.children || []) {
					const gid = groupKey(gr);
					const gref = refOf(ch.no, gid, "");
					const g = {
						no: String(gr.no || ""),
						id: String(gr.id || ""),
						title: String(gr.title || ""),
						line: Number(gr.line) || 0,
						text: headingOf(blocks, gr.idx),
						ref: known(gref) ? gref : "",
						grain: grainOf(ch.no, true, false),
						idx: Number(gr.idx) || 0,
						open: true,
						items: [],
						skipped: 0
					};
					for (const r of gr.rows || []) {
						const line = Number(r.line) || 0;
						const raw = String(r.text || "");
						if (ch.no === "4") {
							g.items.push({
								ref: known(gref) ? gref : "",
								line,
								label: String(r.key || ""),
								text: raw,
								grain: grainOf("4", false, false),
								why: known(gref) ? "" : "§4 的引用粒度到规则组，但引用图里没有这个组"
							});
							nItems++;
						} else if (ch.no === "5") {
							if (UE_RE.test(String(r.key || ""))) {
								g.items.push({
									ref: refOf(ch.no, gid, r.key),
									line,
									label: String(r.key),
									text: raw,
									grain: grainOf("5", false, false),
									why: ""
								});
								nItems++;
							} else {
								g.skipped++;
								nSkipped++;
							}
						} else if (ch.no === "6") {
							const f = fieldRowAt(graph, line);
							if (f) {
								g.items.push({
									ref: f.ref,
									line,
									label: String(r.key || ""),
									sub: f.field,
									text: raw,
									grain: grainOf("6", false, true),
									why: ""
								});
								nItems++;
							} else {
								g.skipped++;
								nSkipped++;
							}
						} else {
							g.skipped++;
							nSkipped++;
						}
					}
					ch.groups.push(g);
					nGroups++;
				}
				nSkipped += ch.skipped;
				chapters.push(ch);
			}
			return {
				chapters,
				counts: {
					chapters: chapters.length,
					groups: nGroups,
					items: nItems,
					skipped: nSkipped
				}
			};
		}
		//#endregion
		//#region src/pure/split.ts
		/**
		* 把渲染器支持不稳的两种结构抽出来：围栏代码块 + HTML <img>
		*
		* ★ 工单 03（WorkspacePort 接缝）从 `src/client.js` **逐字搬来**，只做了整体去缩进与补 export；
		*   正文一字未改（行为不变的证据：临时 harness 对真实工作区数据做迁移前后 deepEqual）。
		* 实测定稿的 <img src> 带空格与间隔号、``` 围栏会让 markdown 渲染器崩；抽出来自己渲染。
		*/
		function splitImgs(text) {
			const s = String(text || "");
			const re = /<img\s+[^>]*?src\s*=\s*["']([^"']+)["'][^>]*?\/?>/gi;
			const parts = [];
			let last = 0, m;
			while ((m = re.exec(s)) !== null) {
				if (m.index > last) parts.push({
					t: "md",
					v: s.slice(last, m.index)
				});
				const alt = /alt\s*=\s*["']([^"']*)["']/i.exec(m[0]);
				parts.push({
					t: "img",
					v: m[1],
					alt: alt ? alt[1] : ""
				});
				last = m.index + m[0].length;
			}
			if (last < s.length) parts.push({
				t: "md",
				v: s.slice(last)
			});
			return parts.length ? parts : [{
				t: "md",
				v: s
			}];
		}
		function splitSpecial(text) {
			const s = String(text || "");
			const parts = [];
			const re = /^[ \t]*(`{3,}|~{3,})[ \t]*([^\n]*)\n([\s\S]*?)^[ \t]*\1[ \t]*$/gm;
			let last = 0, m;
			while ((m = re.exec(s)) !== null) {
				if (m.index > last) parts.push({
					t: "md",
					v: s.slice(last, m.index)
				});
				parts.push({
					t: "code",
					v: String(m[3]).replace(/\n$/, ""),
					lang: (m[2] || "").trim()
				});
				last = m.index + m[0].length;
			}
			if (last < s.length) parts.push({
				t: "md",
				v: s.slice(last)
			});
			const out = [];
			for (const p of parts.length ? parts : [{
				t: "md",
				v: s
			}]) {
				if (p.t !== "md") {
					out.push(p);
					continue;
				}
				for (const q of splitImgs(p.v)) out.push(q);
			}
			return out.length ? out : [{
				t: "md",
				v: s
			}];
		}
		//#endregion
		//#region src/pure/instruction.ts
		/**
		* 影响范围里要标出来的边类别 —— 用户得能判断"这条算不算数"（工单 14）。
		* ★ 其余五类边的命中是"全文提到它的位置"，没有 kind（指令里也就不加标签），逐字保持原样。
		*/
		const KIND_LABEL = {
			family: "同族",
			contract: "契约"
		};
		function buildFixInstruction(req) {
			const L = [];
			L.push("/sr-gdd-fix " + req.path);
			L.push("改 " + req.ref + "。");
			L.push("现状：" + String(req.before || "").trim());
			L.push("要改成：" + String(req.intent || "").trim());
			if (req.impact && req.impact.length) {
				L.push("连带影响（工作台按结构引用扫出，供参考；语义影响请按 D11 自行扫全）：");
				for (const h of req.impact.slice(0, 12)) {
					const label = h.kind ? KIND_LABEL[h.kind] : "";
					L.push("  · L" + h.line + (label ? " [" + label + "] " : " ") + h.where);
				}
			}
			return L.join("\n");
		}
		//#endregion
		//#region src/pure/storemerge.ts
		/** 取不到 workspaces 客户端服务时的那句话（面板照实说，不装"已经即时生效"）。 */
		const NO_WORKSPACES_SERVICE = "取不到官方 workspaces 客户端服务：新工作区分组这次不会即时出现在侧边栏（要刷新页面）。";
		/** 取不到 sessions 客户端服务时的那句话。 */
		const NO_SESSIONS_SERVICE = "取不到官方 sessions 客户端服务：新会话行这次不会即时出现在侧边栏（要刷新页面）。";
		/**
		* 算出"建完之后补哪几刀"。
		*
		* 顺序是**刻意**的：先把工作区行解析回来（分组与它的 `sessionIds` 到位），再重拉会话基线
		* —— 反过来会出现一瞬间"会话已在 store 里、但没有任何分组认领它"的「未分组」闪一下。
		*/
		function planSidebarSync(input) {
			const path = typeof input.path === "string" ? input.path.trim() : "";
			const services = input.services || {
				workspaces: false,
				sessions: false
			};
			const resolvePath = path !== "" && services.workspaces === true ? path : "";
			const refreshSessions = services.sessions === true;
			const steps = [];
			if (resolvePath !== "") steps.push("workspaces.create");
			if (refreshSessions) steps.push("sessions.refresh");
			const notes = [];
			if (path !== "" && services.workspaces !== true) notes.push(NO_WORKSPACES_SERVICE);
			if (services.sessions !== true) notes.push(NO_SESSIONS_SERVICE);
			return {
				resolvePath,
				refreshSessions,
				steps,
				notes
			};
		}
		/**
		* 这一步自己**需不需要**出手（一看就懂的自查口，组合根与测试都用它）：
		* 一条都不用调 = 这次没什么可合并的（例如两个服务都取不到）。
		*/
		function sidebarSyncNeeded(plan) {
			return plan.steps.length > 0;
		}
		//#endregion
		//#region src/pure/analysisdoc.ts
		/**
		* 头脑风暴工作面（工单 23）· 四入口归类 + 两种新格式的解析
		*
		* 出处（逐条对着写的，不自己编）：
		*   · 设计 §4.1 —— 四种入口**没有先后**、四张并列的动作卡、产出全部落 `features\<主题>\analysis\`
		*   · 设计 §4.2.1 —— 旧文档分析 → `analysis\legacy-analysis_<名称>_<日期>.md`，
		*     **四段固定章节**（仍然有效 / 已废弃 / 可复用 / 原文（转换后）），frontmatter 的 `source:` 指向 `source\` 里的原件
		*   · 设计 §4.2.2 —— 人工补充 → `analysis\human-note_<标题>_<日期>.md`，
		*     正文固定保留 `> 原话：…` 一行，**面板上原话与结论并排显示**（一眼看出 AI 有没有改动结论）
		*   · 四种输入方式产出规范 v1 §七.3 —— 每个按钮的前置条件
		*
		* ★ 纯函数、零 IO：目录列举与读文件都在 `src/load/brainstorm.ts`，这里只做归类与解析。
		* ★ **四入口的那张表只有这一份**（`ENTRANCES`）：UI 的卡片、指令里的前置条件、"已有的分析结论"的归类
		*   都读它 —— 表里加一条，三处一起动，不会各说各的（`intake.ts` 直接 re-export 这一份）。
		* ★ 认不出来的东西**不丢**：旧文档分析里多出来的章节进 `extra`，人工补充里多出来的章节进 `extra`，
		*   面板把它们收进「其他章节」——这与 `mdspec` 的「未知章节不丢」是同一条纪律。
		*/
		/** 四种并列入口 —— 顺序即面板上的顺序（设计 §4.1 的表，一行不多一行不少） */
		const ENTRANCES = [
			{
				id: "analysis",
				label: "竞品分析",
				hint: "跑 /sr-analysis",
				needs: "截图 / 录屏 / PV / 商店页（目录、文件路径或链接）",
				prereq: "path",
				output: "analysis\\experience-report_*.md · issue-cards_*.json · replication-spec_*.md · sr-gdd-handoff_*.json · evidence\\",
				handoff: "阶段交给了 skill，进度与提问都在那个会话里（面板不重画流程）"
			},
			{
				id: "concept",
				label: "问答式访谈",
				hint: "跑 /sr-concept",
				needs: "一句创意（可附参考素材路径）",
				prereq: "seed",
				output: "analysis\\concept-triage_*.md → feature-concept_*.md → sr-gdd-handoff_*.json",
				handoff: "阶段交给了 skill，进度与提问都在那个会话里（面板不重画流程）"
			},
			{
				id: "legacy",
				label: "旧文档分析",
				hint: "AI 转换 + 分析",
				needs: "旧策划案 / 脑图 / 表格（目录或文件路径）",
				prereq: "path",
				output: "analysis\\legacy-analysis_<名称>_<日期>.md（四段固定章节）· 原件进 source\\",
				handoff: "阶段交给了会话里的 AI 转换 + 分析，进度与提问都在那个会话里（面板不重画流程）"
			},
			{
				id: "humannote",
				label: "人工补充",
				hint: "AI 只整理格式",
				needs: "标题 + 原话（想到什么写什么）",
				prereq: "title+quote",
				output: "analysis\\human-note_<标题>_<日期>.md（原话与结论并排）",
				handoff: "阶段交给了会话里的 AI 整理，进度与提问都在那个会话里（面板不重画流程）"
			}
		];
		/** 旧文档分析的四段固定章节（设计 §4.2.1）——顺序即面板上的顺序，`re` 认标题里的关键词 */
		const LEGACY_SECTIONS = [
			{
				key: "valid",
				label: "仍然有效的结论",
				re: /仍然有效/
			},
			{
				key: "dropped",
				label: "已废弃 / 不适用",
				re: /已废弃|不适用/
			},
			{
				key: "reuse",
				label: "可复用条目",
				re: /可复用/
			},
			{
				key: "raw",
				label: "原文（转换后）",
				re: /^原文/
			}
		];
		/** 人工补充的固定正文（设计 §4.2.2）；`quote` 不在正文里 —— 它是独立的 `> 原话：…` 行 */
		const NOTE_SECTIONS = [
			{
				key: "conclusion",
				label: "结论",
				re: /^结论/
			},
			{
				key: "bounds",
				label: "边界",
				re: /^边界/
			},
			{
				key: "landing",
				label: "落点",
				re: /^落点/
			}
		];
		const LEGACY_PREFIX = /^legacy-analysis_/i;
		const NOTE_PREFIX = /^human-note_/i;
		/** 文件名 → 两种新格式之一（"" = 不是这两种格式） */
		function analysisDocKind(name) {
			const base = String(name == null ? "" : name).split(/[\\/]/).pop() || "";
			if (LEGACY_PREFIX.test(base)) return "legacy";
			if (NOTE_PREFIX.test(base)) return "humannote";
			return "";
		}
		/** 文件名/标题 → 安全的文件名片段（产出文件名用；与 intake.safeName 同口径，但这边不依赖 intake） */
		function nameSafe(p, limit) {
			const s = String(p == null ? "" : p).replace(/[\\/:*?"<>|]/g, "_").replace(/[\r\n\t]/g, " ").replace(/\s+/g, " ").trim();
			const cap = limit || 60;
			return s.length > cap ? s.slice(0, cap) : s;
		}
		/** 旧文档分析的产出文件名（**唯一出处**：指令里写的名字必须与读取侧认得的一致） */
		function legacyDocName(name, date) {
			return "legacy-analysis_" + (nameSafe(String(name == null ? "" : name).split(/[\\/]/).pop() || "", 60).replace(/\.[A-Za-z0-9]{1,8}$/, "") || "旧文档") + "_" + String(date || "") + ".md";
		}
		/** 人工补充的产出文件名（**唯一出处**，同上） */
		function humanNoteName(title, date) {
			return "human-note_" + (nameSafe(title, 60) || "补充") + "_" + String(date || "") + ".md";
		}
		/** 章节体（按 `re` 认标题）→ 固定段 + 认不出来的「其他章节」 */
		function splitSections(text, specs) {
			const found = {};
			const extra = [];
			for (const s of parseMdSections(text)) {
				const hit = specs.filter((sp) => sp.re.test(s.title))[0];
				if (hit && !found[hit.key]) found[hit.key] = {
					key: hit.key,
					label: hit.label,
					title: s.title,
					body: s.body
				};
				else extra.push({
					title: s.title,
					body: s.body
				});
			}
			const sections = specs.map((sp) => found[sp.key] || {
				key: sp.key,
				label: sp.label,
				title: "",
				body: "",
				present: false
			});
			for (const s of sections) if (s.present === void 0) s.present = !!s.title;
			return {
				sections,
				extra,
				missing: sections.filter((s) => !s.present).map((s) => s.label)
			};
		}
		/** md 表格 → 行（`| a | b | c |`；跳过分隔行） */
		function mdTableRows(body) {
			const rows = [];
			for (const line of String(body || "").split(/\r?\n/)) {
				const t = line.trim();
				if (t.charAt(0) !== "|") continue;
				const cells = t.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
				if (cells.every((c) => /^:?-{2,}:?$/.test(c) || c === "")) continue;
				rows.push(cells);
			}
			return rows;
		}
		/** 一级标题（`# xxx`）—— 文档标题，不进章节 */
		function docTitle(text) {
			const m = /^#\s+(.+)$/m.exec(String(text || ""));
			return m ? m[1].trim() : "";
		}
		/**
		* `> 原话：「…」` 那一行 —— **逐字**取出来（这是"AI 有没有改动我的结论"的唯一凭据）。
		*
		* 认三种写法（都取整行原文）：`> 原话：「…」` / `> 原话：…` / `> 原话: "…"`。
		* @returns `{ raw, text, found }` · `raw` = 整行原文（含 `> 原话：`），`text` = 引导语之后的部分（逐字）
		*/
		function parseQuote(text) {
			const lines = String(text || "").split(/\r?\n/);
			for (const line of lines) {
				const m = /^>\s*原话\s*[:：]\s*(.*)$/.exec(line.trim());
				if (m) return {
					raw: line.trim(),
					text: m[1].trim(),
					found: true
				};
			}
			return {
				raw: "",
				text: "",
				found: false
			};
		}
		/**
		* 旧文档分析（设计 §4.2.1）→ 视图模型。
		*
		* @returns `{ name, kind, front, title, sections, reuse, extra, missing, raw }`
		*   · `sections` 恒有四段（`present:false` = 这一段缺了，面板**如实说缺**，不静默）
		*   · `reuse.rows` = 「可复用条目」表格的 `旧文档位置 | 内容 | 去向`
		*   · `raw` = 「原文（转换后）」的正文（追溯用）
		*/
		function parseLegacyAnalysis(text, name) {
			const body = String(text || "");
			const front = parseFrontmatter$1(body) || {};
			const split = splitSections(body, LEGACY_SECTIONS);
			const reuse = split.sections.filter((s) => s.key === "reuse")[0] || { body: "" };
			const rawSec = split.sections.filter((s) => s.key === "raw")[0] || { body: "" };
			return {
				name: String(name || ""),
				kind: "legacy",
				front,
				docType: String(front.doc_type || ""),
				topic: String(front.topic || ""),
				source: String(front.source || ""),
				analyzedAt: String(front.analyzed_at || ""),
				title: docTitle(body),
				sections: split.sections,
				reuse: {
					header: mdTableRows(reuse.body)[0] || [],
					rows: mdTableRows(reuse.body).slice(1)
				},
				extra: split.extra,
				missing: split.missing,
				raw: String(rawSec.body || "")
			};
		}
		/**
		* 人工补充（设计 §4.2.2）→ 视图模型。
		*
		* @returns `{ name, kind, front, title, quote, conclusion, bounds, landing, sections, extra, missing }`
		*   · `quote` = `> 原话：…` 那一行（逐字）；`conclusion` = 「结论」段正文 —— 面板把这两个**并排**显示
		*/
		function parseHumanNote(text, name) {
			const body = String(text || "");
			const front = parseFrontmatter$1(body) || {};
			const split = splitSections(body, NOTE_SECTIONS);
			const body1 = (k) => {
				const s = split.sections.filter((x) => x.key === k)[0] || { body: "" };
				return String(s.body || "");
			};
			return {
				name: String(name || ""),
				kind: "humannote",
				front,
				docType: String(front.doc_type || ""),
				topic: String(front.topic || ""),
				confidence: String(front.confidence || ""),
				date: String(front.date || ""),
				author: String(front.author || ""),
				title: docTitle(body),
				quote: parseQuote(body),
				conclusion: body1("conclusion"),
				bounds: body1("bounds"),
				landing: body1("landing"),
				sections: split.sections,
				extra: split.extra,
				missing: split.missing
			};
		}
		/** 交接件 JSON 的来源 skill（`sr-analysis` / `sr-concept`）—— 只看这一处，不做别的推断 */
		function sourceSkillOf(jsonText) {
			const m = /"source_skill"\s*:\s*"([^"]*)"/.exec(String(jsonText || ""));
			return m ? m[1] : "";
		}
		/**
		* 一条分析产物属于哪个入口（设计 §4.1 的产出表 + 产出规范 v1 §五）。
		*
		* 判据顺序（**不猜**）：文件名前缀（两种新格式）→ md 规范名（`mdspec` 的六种）
		* → 交接件看它自己的 `source_skill` 字段（认不出就归「其他/来源未知」，不硬塞进某一路）。
		*/
		function entryOfAnalysis(name, sourceSkill) {
			const base = String(name == null ? "" : name).split(/[\\/]/).pop() || "";
			const k = analysisDocKind(base);
			if (k) return k;
			if (/^issue-cards_/i.test(base)) return "analysis";
			const spec = mdSpecOf(base);
			if (spec) {
				const n = String(spec.name || "");
				if (n === "体验报告" || n === "复刻规格" || n === "证据索引") return "analysis";
				if (n === "设计核三角报告" || n === "功能设计稿") return "concept";
			}
			if (/^sr-gdd-handoff_/i.test(base)) {
				const s = String(sourceSkill || "");
				if (s === "sr-analysis") return "analysis";
				if (s === "sr-concept") return "concept";
				return "other";
			}
			return "other";
		}
		/**
		* 分析产物清单 → 按四入口分组的「已有的分析结论」。
		*
		* @param files `[{ name, rel, subdir?, skill? }]`（`skill` = 交接件 JSON 里读到的 `source_skill`）
		* @returns `{ entries, other, counts }` —— `entries` 恒有四组（空组也如实出现：0 条 = "这一路还没走过"）
		*/
		function groupAnalyses(files) {
			const list = Array.isArray(files) ? files : [];
			const entries = ENTRANCES.map((e) => ({
				id: e.id,
				label: e.label,
				count: 0,
				files: []
			}));
			const other = [];
			for (const f of list) {
				const id = entryOfAnalysis(f && f.name, f && f.skill);
				const g = entries.filter((e) => e.id === id)[0];
				if (g) {
					g.files.push(f);
					g.count++;
				} else other.push(f);
			}
			const counts = {};
			for (const e of entries) counts[e.id] = e.count;
			return {
				entries,
				other,
				counts,
				total: list.length
			};
		}
		//#endregion
		//#region src/pure/draftstep.ts
		/**
		* 文档生成工作面（工单 24）—— 「文档生成」这一阶段的两件事，**纯函数、零 IO**：
		*
		*   ① **配置支线走到哪**（设计 §4.5 → spec.md:51-52 / Out of Scope:212）：
		*      `parseConfigContract` 读定稿 §6 的**字段行**（与 §6.5 的缺口表分开），
		*      `configBranchState` 把「有没有配置契约、走到哪一步」算成**一句话 + 一串事实**。
		*   ② **这一阶段的动作**：`buildDraftInstruction` 组装三段式——**改哪儿 / 现状原文 / 影响范围**，
		*      与 `instruction.ts`（定稿修订）、`intake.ts`（头脑风暴）**同一套口径**，不是第三套协议。
		*
		* ── 口径的出处（逐条引原文，不自己编）────────────────────────────────────────
		*   · `gdd-pipeline.md` §一·三份产出：「配置相关内容：成稿 = **零**——规则里不出现字段名、表名、
		*     『对应哪个字段』式中文字；配置表 = 全部；定稿 = 全部（§6 配置契约）」。
		*     ⇒ 「配置支线」的契约载体是**定稿 §6**，成稿里根本不该有它 —— 所以这一屏只报**走到哪**。
		*   · `gdd-pipeline.md` §一：「方向是规则优先：`/sr-config` 从成稿的规则**派生**配置字段与记录」。
		*   · `gdd-pipeline.md` §二 的章节对应表：
		*       §6 范围门 → 定稿 §8 · §11 数值待定项 → 「能在配置表里读到的标 `表名.字段名`，未落表的标"待配表"」·
		*       「— → §6 配置契约  从配置表读回：中文字段 / 英文字段 / 结构 / 含义 / **状态（已有、新增、新增命名待定、待配表）**」。
		*   · `sr-gdd-human/SKILL.md` §产出规范：产出 `proposals\<主题>_<日期>.md`（本工作区为 `gdd\`），
		*     形态基准 `resources/templates/feature-gdd-human.md`；「结果章 §1–§12 只有纯规则与设计」。
		*   · spec.md:212（Out of Scope）：「**Excel / 配置表编辑**——配置表在 `sr-config` 与 Unreal/Excel 侧；
		*     面板**只显示配置支线走到哪**」。
		*
		* ── 两个刻意的"不"──────────────────────────────────────────────────────────
		*   · **不重做 Excel**：这里不解析任何工作簿。配置表的**存在性**由既有通道给（看板的 `configs`，
		*     按主题挂上来的真实文件名），字段/记录级的一切都在 skill 与配置表工具侧。
		*   · **不猜**：读不到、认不出、缺件，一律如实报（`unknown` / `missing` / `notes`），
		*     不把"没看到"写成"没有"（那条纪律在 23 的 `unreadable` 上已经立过一次）。
		*/
		/** `A079-联盟悬赏.xlsx` / `A006-掉落表.xlsx` 这种工作簿名（配置表命名的既有形状） */
		const WORKBOOK_RE = /[A-Za-z]\d{2,4}-[^\s`，,、）)]+\.xlsx?m?/g;
		/** 反引号里的英文字段名（`clearDropId` / `alliBossDailyAttackCount`） */
		const FIELD_RE = /`([A-Za-z_][A-Za-z0-9_.]*)`/;
		/** 配置契约的组标题（`### 6.2 BOSS表（…）`）；后面的 `6.5 掉落引用与缺口` 也是这个形状 */
		const CONFIG_GROUP_RE = /^###\s+(\d+(?:\.\d+)*)\s*(.*)$/;
		/**
		* 从定稿全文里读 §6 的**配置契约**（设计 §4.5 / `gdd-pipeline.md` §二的章节对应）。
		*
		* ★ 只认**字段表**：表头是「中文字段 | 英文字段 | 数据结构 | 含义 | 状态」，第二列是反引号英文字段名。
		*   §6.5 的缺口表（表头「掉落段 | 记录 | 状态」）没有英文字段列 ⇒ 不进 `fields`，只进 `otherRows`——
		*   它不是字段契约，是**缺口的说明**，混进来会把"字段数"算虚。
		* ★ 行号是 1-based，与 `parseFinalGdd` / `finaltree` 同一口径（定位卡的"原文（L###）"要能对上）。
		*/
		function parseConfigContract(text) {
			const src = String(text == null ? "" : text);
			const lines = src.split(/\r?\n/);
			const out = {
				present: false,
				line: 0,
				workbooks: [],
				fields: [],
				pending: [],
				notedGaps: [],
				otherRows: 0
			};
			if (src === "") return out;
			const doc = parseFinalGdd(src);
			const ch = (doc.outline || []).filter((c) => String(c.no) === "6")[0];
			if (!ch) return out;
			out.present = true;
			out.line = Number(ch.line) || 0;
			const blocks = doc.blocks || [];
			const cur = blocks[Number(ch.idx)];
			if (cur && typeof cur.text === "string") {
				const seen = {};
				const found = cur.text.match(WORKBOOK_RE) || [];
				for (const w of found) {
					if (w === "xlsx" || w === "xlsm") continue;
					if (seen[w]) continue;
					seen[w] = true;
					out.workbooks.push(w);
				}
			}
			let endLine = lines.length + 1;
			for (const b of blocks) {
				const bl = Number(b.line) || 0;
				if (bl > out.line && b.level === 2) {
					endLine = bl;
					break;
				}
			}
			let group = "";
			for (let i = out.line; i < endLine && i <= lines.length; i++) {
				const raw = lines[i - 1];
				const gm = CONFIG_GROUP_RE.exec(raw);
				if (gm) {
					group = (gm[1] + " " + (gm[2] || "")).trim();
					continue;
				}
				if (!/^\s*\|/.test(raw)) continue;
				const cells = raw.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((s) => s.trim());
				if (cells.length < 3) continue;
				const first = cells[0] || "";
				if (/^:?-{2,}:?$/.test(first.replace(/\s/g, ""))) continue;
				if (first === "中文字段") continue;
				const fm = FIELD_RE.exec(cells[1] || "");
				if (!fm) {
					out.otherRows += 1;
					const st = cells[cells.length - 1] || "";
					if (/待配表/.test(st)) out.notedGaps.push({
						line: i,
						group,
						cn: first,
						status: st,
						text: raw.trim()
					});
					continue;
				}
				const status = cells[cells.length - 1] || "";
				const row = {
					line: i,
					group,
					cn: first,
					field: fm[1],
					status,
					pending: /待配表/.test(status),
					text: raw.trim()
				};
				out.fields.push(row);
				if (row.pending) out.pending.push(row);
			}
			return out;
		}
		/** 读回验收回执的文件名判据（`sr-config` 的产出：`evidence\readback_<表>_<主题>_<日期>.md`） */
		const READBACK_RE = /^readback_/i;
		/**
		* 读回验收回执 ← `evidence\` 的文件名（**只按文件名**，与其余桶的归类口径一致）。
		*/
		function readbacksOf(names, relOf) {
			const out = [];
			for (const n of Array.isArray(names) ? names : []) {
				const name = String(n || "");
				if (!READBACK_RE.test(name)) continue;
				const m = /_(\d{8})(?:\.md)?$/i.exec(name);
				out.push({
					name,
					rel: relOf ? String(relOf(name)) : "evidence/" + name,
					date: m ? m[1] : ""
				});
			}
			return out.sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : a.name < b.name ? -1 : 1);
		}
		/** 判据串（面板与测试都读它，不各写一份） */
		const STEP_KEYS = [
			{
				key: "draft",
				label: "成稿（纯规则，零配置指代）"
			},
			{
				key: "contract",
				label: "配置表派生（/sr-config 从 §4 规则派生字段与记录）"
			},
			{
				key: "readback",
				label: "读回验收（evidence\\readback_*）"
			},
			{
				key: "final",
				label: "整合定稿（§6 配置契约）"
			}
		];
		/**
		* 四步链路 → 「走到哪」。
		*
		* ★ 判据只有两处来源：**盘上的成稿/定稿头部**（`doc_type` / `status`，`gdd-pipeline.md` §一·补的口径）
		*   与**定稿 §6 的字段行**。面板不猜中间过程（那过程在会话里，面板看不见就如实说看不见）。
		* ★ 「读回验收」这一步**只认事实**：有没有 `evidence\readback_*`。没有就是没有 ——
		*   它不等于"没验收过"（回执可能还没落盘），所以 `missing` 里的措辞是"没有回执"，不是"没验收"。
		*/
		function configBranchState(facts) {
			const f = facts || {};
			const draft = f.draft || {
				exists: false,
				name: "",
				status: "",
				docType: "",
				line: 0,
				archived: false
			};
			const fin = f.final || {
				exists: false,
				name: "",
				status: "",
				docType: "",
				line: 0
			};
			const c = f.contract || {
				present: false,
				line: 0,
				workbooks: [],
				fields: [],
				pending: [],
				notedGaps: [],
				otherRows: 0
			};
			const rbs = f.readbacks || [];
			const missingFiles = f.referencedMissing || [];
			const cfgFiles = f.configFiles || [];
			const pendingFields = c.pending || [];
			const notedGaps = c.notedGaps || [];
			const gapCount = pendingFields.length + notedGaps.length;
			const draftDone = !!draft.exists;
			const readbackDone = rbs.length > 0;
			const finalDone = !!fin.exists && !!c.present;
			let stage = "before-draft";
			let label = "";
			let reason = "";
			if (!draftDone && !fin.exists) {
				stage = "before-draft";
				label = "还没开始 —— 成稿还没写出来（这一屏的第一个动作就是写它）";
				reason = "功能目录 `gdd\\` 里没有成稿（`doc_type: draft_gdd`）。配置支线的输入端是成稿 §4 的规则，规则还没落纸 ⇒ 派生无从谈起。";
			} else if (!fin.exists) {
				stage = "rules-ready";
				label = draft.archived ? "等配置表 —— 成稿已归档，定稿尚未产出（配置字段应由 /sr-config 从 §4 规则派生）" : "规则就绪 —— 定稿还没产出；/sr-config 现在可以从 §4 的规则派生字段与记录了";
				reason = "成稿 `" + draft.name + "`（doc_type " + (draft.docType || "?") + " / status " + (draft.status || "?") + "）在盘上；功能目录里还没有定稿，所以还没有 §6 配置契约可读。";
			} else if (!c.present) {
				stage = "integrating";
				label = "整合中 —— 有定稿，但它还没有 §6 配置契约";
				reason = "定稿 `" + fin.name + "`（status " + (fin.status || "?") + "）里没有 `## 6. 配置契约` 这一章 ⇒ 配置与规则的整合这一步没做完。";
			} else if (gapCount > 0) {
				stage = "missing-pending";
				label = "配置表已派生，还有 " + gapCount + " 处「待配表」缺口没闭 —— 交程序前应闭掉或明确列为待办";
				reason = "§6 共 " + c.fields.length + " 个字段行、" + c.workbooks.length + " 个工作簿；" + (pendingFields.length ? "其中 " + pendingFields.length + " 个字段行的状态是**待配表**" : "") + (pendingFields.length && notedGaps.length ? "；" : "") + (notedGaps.length ? "另有 " + notedGaps.length + " 行缺口说明写着**待配表**（" + notedGaps.map((g) => "L" + g.line + " " + g.cn).join(" / ") + "）" : "") + "。（`gdd-pipeline.md` §二：§11 数值待定项里未落表的标「待配表」。）";
			} else if (c.fields.length === 0) {
				stage = "missing-nofields";
				label = "配置契约是空的 —— §6 有章没有字段行";
				reason = "定稿 `" + fin.name + "` 有 §6（L" + c.line + "）但解析不出字段行（认得出却没解析的行 " + c.otherRows + " 条）⇒ 要么还没写，要么格式与契约表的形状不一致。";
			} else {
				stage = "landed";
				label = "配置字段全部落地（§6 " + c.fields.length + " 个字段行 / " + c.workbooks.length + " 个工作簿，无待配表缺口）";
				reason = "定稿 `" + fin.name + "` 的 §6 里每一行的状态都不是「待配表」。";
			}
			const steps = [
				{
					key: STEP_KEYS[0].key,
					label: STEP_KEYS[0].label,
					done: draftDone,
					evidence: draftDone ? draft.name + "　L" + draft.line + "　" + (draft.docType || "?") + " / " + (draft.status || "?") : "gdd\\ 里没有成稿（`<主题>_<日期>.md`）"
				},
				{
					key: STEP_KEYS[1].key,
					label: STEP_KEYS[1].label,
					done: c.fields.length > 0,
					evidence: c.fields.length > 0 ? "§6 字段行 " + c.fields.length + " 个；工作簿 " + (c.workbooks.length ? c.workbooks.join(" / ") : "（章引言里没写工作簿名）") : c.present ? "§6 存在但还没有字段行" : "还没有 §6 配置契约（定稿侧读不到）"
				},
				{
					key: STEP_KEYS[2].key,
					label: STEP_KEYS[2].label,
					done: readbackDone,
					evidence: readbackDone ? rbs.length + " 份回执：`" + rbs.map((r) => r.name).join("` / `") + "`" : "evidence\\ 里没有 `readback_*` 回执"
				},
				{
					key: STEP_KEYS[3].key,
					label: STEP_KEYS[3].label,
					done: finalDone,
					evidence: fin.exists ? fin.name + "　L" + fin.line + "　" + (fin.docType || "?") + " / " + (fin.status || "?") + (c.present ? "　§6 在 L" + c.line : "　（没有 §6）") : "gdd\\ 里没有定稿（`<主题>_<日期>_定稿.md`）"
				}
			];
			const missing = [];
			for (const r of pendingFields) missing.push("待配表（字段行）：L" + r.line + " " + r.group + " · " + r.cn + "（" + r.status + "）");
			for (const g of notedGaps) missing.push("待配表（缺口说明）：L" + g.line + " " + g.group + " · " + g.cn + "（" + g.status + "）");
			for (const w of missingFiles) missing.push("§6 引用的工作簿在配置目录里没有同名文件：" + w + "（面板按文件名核，不解析工作簿）");
			if (fin.exists && c.present && !readbackDone) missing.push("没有读回验收回执（`evidence\\readback_*` 一份都没有）—— 不代表「没验收过」，只代表**面板看不到回执**");
			if (fin.exists && !c.present) missing.push("定稿里没有 `## 6. 配置契约` —— 配置字段与规则的对应还没落纸");
			if (!fin.exists) missing.push("还没有定稿 —— 配置契约的载体是定稿 §6（成稿里按契约口径**不含任何配置内容**）");
			if (cfgFiles.length === 0 && c.fields.length > 0) missing.push("按主题挂上来的配置表文件 0 个（命名对不上？）—— 这里只显示存在性，不改表");
			return {
				stage,
				label,
				reason,
				steps,
				missing,
				facts: f
			};
		}
		/**
		* 三个动作 —— 顺序即面板上的顺序。**不并排、有先后**（与头脑风暴四入口相反）：
		* `gdd-pipeline.md` §一·三份产出是一条链（成稿 → 配置表 → 定稿），不是四条并列的路。
		*
		* `hint` 是"跑什么"，`needs` 是前置（缺了就在界面上说缺，不发指令），`output` 是产出落点。
		*
		* ★ 工单 24c 把它拆成**两个阶段**（`DRAFT_PHASES`）：
		*   ① `card` —— 成稿纸面上的动作（写成稿 / 改成稿）：Y 形之外，落在「看正文」那一折里；
		*   ② `wire` —— Y 形那两条支线（配置表 / 线框图）各自的出口。
		*   `DRAFT_PHASES[1]` 里的 `integrate`（发起整合定稿）就是 Y 形底部的**唯一主按钮**。
		*   **表只有这一份**（面板的按钮、指令的前置、"这一步产出什么"全读它），
		*   阶段只是"这一条画在哪一层"的标注，不是第二份定义。
		*/
		const DRAFT_ACTIONS = [
			{
				id: "create",
				label: "写成稿",
				hint: "跑 /sr-gdd-human",
				needs: "主题 + 上游材料（sr-concept 设计稿 / sr-analysis 复刻规格 / 旧案）",
				output: "gdd\\<主题>_<日期>.md（`doc_type: draft_gdd` / `status: draft`；结果章 §1–§12 只有纯规则，决策留痕在附录 A）",
				handoff: "阶段交给了 skill：成稿门（approve / approve_with_conditions / revise / reject）由你在那个会话里拍板"
			},
			{
				id: "revise",
				label: "改成稿",
				hint: "就着现状原文定向修订",
				needs: "成稿在盘上 + 你要改的那一条（建议带上它在成稿里的章 / 组号）",
				output: "就地改成稿（不改配置表；改到规则就走这条）",
				handoff: "阶段交给了 skill：它按撰写纪律闭合影响面，成稿门由你在那个会话里拍板"
			},
			{
				id: "config",
				label: "配置表",
				hint: "跑 /sr-config",
				needs: "成稿的 §4 规则已定 + 定稿 §6 已读回（缺的那处「待配表」要能点到行与原文）",
				output: "改配置表本身（面板不改表：指令只把「§4 的哪条规则 → 哪张表 / 哪个字段 → 缺口在哪」说到不用再找）",
				handoff: "阶段交给了 skill：字段与记录的落地、读回验收（`evidence\\readback_*`）都在那个会话里做"
			},
			{
				id: "wireframe",
				label: "线框图",
				hint: "把 §5 的 ASCII 占位换成真实界面图",
				needs: "至少一条界面图路径（粘贴的 http/https/本地路径，或从 gdd\\UI\\ 里挑）",
				output: "就地改 §5：把对应的 ```text ASCII 段换成 <img src=…>，并同步该 UI-M 组下的条目",
				handoff: "阶段交给了 skill：图能不能用、要不要重画由你在那个会话里定；这一步只把图落到 §5 上"
			},
			{
				id: "integrate",
				label: "发起整合定稿",
				hint: "跑 /sr-gdd-ai",
				needs: "成稿已过门（规则不再变）+ 配置表已派生（缺的字段有「待配表」结论也行，但要你知道缺在哪）",
				output: "gdd\\<主题>_<日期>_定稿.md（`doc_type: final_gdd` / `status: pending` → `active`；§6 配置契约 + §7 多语言文本）",
				handoff: "阶段交给了 skill：sr-gdd-ai 第 5 步先跑 /sr-gdd-review 出审查报告，再呈定稿门——合流结果由工单 25 承接"
			}
		];
		/** 三个动作（**表只有这一份**：面板的卡、指令的前置、"这一步产出什么"都读它） */
		const DRAFT_ACTIONS_TABLE = DRAFT_ACTIONS;
		/**
		* 「这一条画在哪一层」—— 工单 24c 的 Y 形分层（**引用 `DRAFT_ACTIONS_TABLE` 的 id，不重写定义**）。
		*
		* `card`  = Y 形之外（成稿纸面上的动作，落在「看正文」那一折里）
		* `wire`  = Y 形的两条支线 + 底部合流（`integrate` 就是那一屏**唯一的主按钮**）
		*/
		const DRAFT_PHASES = [{
			key: "card",
			ids: ["create", "revise"]
		}, {
			key: "wire",
			ids: [
				"config",
				"wireframe",
				"integrate"
			]
		}];
		/** 路径里最后一段（用于把工作簿文件名念给人听；空串进 → 空串出） */
		function tailOf(p) {
			const s = String(p == null ? "" : p);
			const parts = s.split(/[\\/]/).filter((x) => x !== "");
			return parts.length ? parts[parts.length - 1] : s;
		}
		/**
		* 支线 A（配置表）→ **一句话人话状态**。
		*
		* ★ 为什么不让界面自己看着 `ConfigBranch` 拼：口径只能有一份。这里是它唯一的成形地，
		*   有真数据回归网（`test/pure-draftstep.test.ts`），界面只念结果。
		* ★ **机器口径不丢**：`mis.stage` 与 `mis.label`（`configBranchState` 的结论原文）逐字带上，
		*   界面把它们放进「详情」里 —— 人话给人看，机器口径留给核对。
		* ★ **不讲面板看不见的话**：表的存在性只说"按主题挂上来的真实文件名"（`configFiles`），
		*   不解析工作簿、不猜字段落地情况（`spec.md:212`）。
		*/
		function configBranchStory(state) {
			const c = state || {};
			const stage = String(c.stage || "");
			const label = String(c.label || "");
			const ctr = c.facts && c.facts.contract ? c.facts.contract : {
				fields: [],
				pending: [],
				notedGaps: [],
				workbooks: []
			};
			const fields = ctr.fields || [];
			const pending = ctr.pending || [];
			const notedGaps = ctr.notedGaps || [];
			const books = (ctr.workbooks || []).map(tailOf);
			const gapCount = pending.length + notedGaps.length;
			const mis = {
				stage,
				label,
				gapCount
			};
			if (!ctr.present || stage === "before-draft" || stage === "rules-ready" || stage === "integrating") return {
				story: {
					label: label || "配置支线还没开始",
					tone: stage === "before-draft" ? "info" : "warn",
					gap: true
				},
				mis
			};
			if (fields.length === 0) return {
				story: {
					label: "配置契约是空的 —— §6 有章但没有字段行",
					tone: "warn",
					gap: true
				},
				mis
			};
			return {
				story: {
					label: (books.length ? "规则已派生成 " + books.length + " 张表（" + books.join(" · ") + "），字段都齐" : "规则已派生，" + fields.length + " 个字段行都齐（章引言里没写工作簿名，表名读不到）") + (gapCount ? "；还有 " + gapCount + " 处「待配表」没填" : "；没有待配表缺口"),
					tone: gapCount ? "warn" : "ok",
					gap: gapCount > 0
				},
				mis
			};
		}
		/**
		* 支线 B → **一句话人话状态**（线框 A 的原话：`§5 里现在是 ASCII 图占位；7 张界面图提交后可替换`）。
		*
		* ★ 数字全部从真数据来：`ascii.length` 是 §5 里认出来的 ASCII 段数，`images.length` 是
		*   `gdd\UI\` 里真实存在的界面图数。两样都认不出来时**照实说认不出来**，不假装。
		*/
		function wireBranchStory(facts) {
			const f = facts || {};
			const ascii = Array.isArray(f.ascii) ? f.ascii : [];
			const images = Array.isArray(f.images) ? f.images : [];
			const label = "§5 里现在是 " + ascii.length + " 处 ASCII 占位；" + images.length + " 张界面图提交后可替换";
			return {
				story: {
					label,
					tone: images.length ? "warn" : "info",
					gap: images.length > 0
				},
				label
			};
		}
		/** 一个输入项 → 单行文本（去掉换行与多余空白） */
		function oneLine(v) {
			return String(v == null ? "" : v).replace(/\s+/g, " ").trim();
		}
		/** 路径显示统一成 `\`（只改显示的字符串；与 `client.js` 的 `winPath` 同口径） */
		function winOf(p) {
			return String(p == null ? "" : p).replace(/[\\/]+$/, "").replace(/\//g, "\\");
		}
		/**
		* 文档生成工作面的指令组装（三段式，逐字：**改哪儿 → 现状 → 要改成什么 → 连带影响**）。
		*
		* ★ **为什么是这三段**（与 `instruction.ts` / `intake.ts` 同一条产品契约）：
		*   面板不写文件，它只把意图说到 agent 不用再找的程度 —— 改哪儿（章 / 组号或绝对路径）、
		*   现状原文（行号会漂，原文不会）、连带影响（面板扫得出的那部分）。语义影响留给 skill。
		* ★ **缺前提不静默**：`blocked` + `next` 两个字段一起给，界面照原样显示，**不发指令**。
		* ★ 产出落点由 `root` 派生（`gdd\`），不在两处各写一份路径。
		*/
		function buildDraftInstruction(input) {
			const inp = input || {};
			const a = DRAFT_ACTIONS.filter((x) => x.id === inp.action)[0];
			if (!a) return {
				instruction: "",
				blocked: "未知的文档生成动作：" + String(inp.action),
				next: "五个动作是：写成稿 / 改成稿 / 配置表 / 线框图 / 发起整合定稿。"
			};
			const root = winOf(inp.root);
			if (root === "") return {
				instruction: "",
				blocked: "拿不到这个功能的功能目录（`features\\<主题>\\`）。",
				next: "从「功能详情 › 文档生成」进来再发一次 —— 指令要发给该功能的专属工作会话（cwd = 功能目录）。"
			};
			const topic = oneLine(inp.topic);
			const date = oneLine(inp.date);
			const gddDir = root + "\\gdd";
			const tail = "阶段交给了 skill：" + a.handoff.replace(/^阶段交给了 skill：?/, "") + " —— 有决策门就停下来等我拍板，不要自己往下走。";
			if (a.id === "create") {
				const mats = (Array.isArray(inp.materials) ? inp.materials : []).map(oneLine).filter((x) => x !== "");
				const seed = oneLine(inp.intent);
				if (topic === "" && seed === "") return {
					instruction: "",
					blocked: "「写成稿」需要主题，或者至少一句要写什么。",
					next: "在「主题」里写功能名（比如：联盟悬赏），再在「要写成什么」里写一句方向；有上游材料就把路径一并粘上。"
				};
				const L = [
					"【文档生成 · 写成稿】请执行 `/sr-gdd-human`（走 `/sr-gdd-human <主题或材料路径>` 的正常调用，不要改动该 skill）。",
					"主题：" + (topic || "（未指定 —— 按上游材料推导）"),
					"要写成什么（我的意图；没写就按上游材料与 VOI 门现场确认）：" + (seed || "（未指定）")
				];
				L.push(mats.length ? "上游材料（有就给路径）：" : "上游材料：没有（那就以主题与我的意图为准，缺到会改变决策再问我）。");
				for (const m of mats) L.push("  · " + m);
				L.push("产出：" + gddDir + "\\" + (topic || "<主题>") + "_" + (date || "<YYYYMMDD>") + ".md", "格式：以 `resources/templates/feature-gdd-human.md` 为形态基准；顶部 `doc_type: draft_gdd` + `status: draft`；结果章 §1–§12 在前、附录 A 在后。", "硬口径：**结果章只有纯规则与设计** —— 不出现字段名、表名、\"对应哪个字段\"式中文字（配置内容一律不进成稿）；数值一律写成机制表述或\"（参考值 X，待定）\"，未定数值集中在 §11；决策留痕全在附录 A。", "上游含 sr-gdd-handoff_*.json / 功能设计稿 / 复刻规格时：其中已拍板的取舍直接作为既定口径（不重新问、不写拍板过程）；其\"配置项预测\"**不进本成稿**。", tail);
				return {
					instruction: L.join("\n"),
					blocked: "",
					next: ""
				};
			}
			if (a.id === "revise") {
				const where = oneLine(inp.where);
				const before = String(inp.before == null ? "" : inp.before).trim();
				const intent = oneLine(inp.intent);
				const path = winOf(inp.draftPath);
				if (path === "") return {
					instruction: "",
					blocked: "「改成稿」需要成稿的路径 —— 但盘上还没有成稿，没有可改的现状原文。",
					next: "先走「写成稿」把这份成稿写出来；或者把要改的那一条的**现状原文**粘进「现状原文」框（面板会照它组装）。"
				};
				if (where === "" && before === "") return {
					instruction: "",
					blocked: "「改成稿」需要知道改哪儿：条目引用 / 章组号，或那一条的现状原文。",
					next: "在「改哪儿」里写条目引用（比如 §4 R6 奖励 / §5 UI-M1），或在左树上点一条把它的原文带进来。"
				};
				if (intent === "") return {
					instruction: "",
					blocked: "「改成稿」需要知道要改成什么。",
					next: "在「要改成什么」里写一句话（比如：终结奖励与通关奖励合并为一个宝箱入口）。"
				};
				const L = [
					"/sr-gdd-human " + path,
					"改 " + (where || "（未给条目引用 —— 按下面的现状原文定位）") + "。",
					"现状：" + (before || "（面板没拿到这一条的原文 —— 请在成稿里按上面的条目引用定位）"),
					"要改成：" + intent
				];
				if (before && before.indexOf("|") === 0) L.push("（现状那一行是表格行，请按表格口径整行替换；编号/列序不要顺手改。）");
				const miss = (Array.isArray(inp.configMissing) ? inp.configMissing : []).map(oneLine).filter((x) => x !== "");
				if (oneLine(inp.configLabel) || miss.length) {
					L.push("留意（配置支线的现状，面板只报状态、不改表）：");
					if (oneLine(inp.configLabel)) L.push("  · " + oneLine(inp.configLabel));
					for (const m of miss.slice(0, 8)) L.push("  · " + m);
					L.push("  —— 若这次改动牵动规则，配置字段的重新派生由 /sr-config 承接（面板不重做 Excel）。");
				}
				L.push("连带影响（工作台只报**结构引用**扫得出的那部分；语义影响请按撰写纪律的影响面闭合自行扫全）：");
				L.push("  · 成稿的 §4 规则 / §5 界面流程 / §9 验收标准 三处要一起看（改一条规则通常牵到界面与验收）。");
				L.push(tail);
				return {
					instruction: L.join("\n"),
					blocked: "",
					next: ""
				};
			}
			if (a.id === "config") {
				const path = winOf(inp.draftPath);
				if (path === "" && topic === "") return {
					instruction: "",
					blocked: "「配置表」需要成稿 —— 配置字段是从成稿 §4 的规则派生的，规则文档拿不到。",
					next: "先走「写成稿」把这份成稿写出来；或从「功能详情 › 文档生成」进来（面板会带上成稿路径）。"
				};
				const contract = inp.contract || {};
				const pend = (contract.pending || []).slice();
				const noted = (contract.notedGaps || []).slice();
				const books = (contract.workbooks || []).map(oneLine).filter((x) => x !== "");
				const rulePart = (inp.parts || []).filter((p) => p && p.key === "rules")[0] || null;
				const L = [
					"【文档生成 · 配置表】请执行 `/sr-config`（走 `/sr-config` 的正常调用，不要改动该 skill）。",
					"主题：" + (topic || "（按成稿推导）"),
					"改哪儿（配置字段的设计依据 —— 成稿 §4 的规则）：" + (rulePart ? "§" + rulePart.no + " " + rulePart.label + "（" + winOf(path || gddDir + "\\" + (topic || "<主题>") + "_*（按日期取最新）") + "　L" + rulePart.line + "–L" + rulePart.endLine + "）" : winOf(path || gddDir + "\\" + (topic || "<主题>") + "_*（按日期取最新）") + " 的 §4 功能规则")
				];
				L.push("现状（定稿 §6 配置契约读回的字段行 —— 面板只读、不改表）：");
				if (contract.present && (contract.fields || []).length) {
					L.push("  · §6 共 " + (contract.fields || []).length + " 个字段行" + (books.length ? "，涉及 " + books.length + " 张表：" + books.join(" / ") : "（章引言里没写工作簿名）") + "。");
					for (const r of (contract.fields || []).slice(0, 6)) L.push("  · L" + r.line + " " + r.group + " · " + r.cn + "（`" + r.field + "`）状态：" + r.status);
					if ((contract.fields || []).length > 6) L.push("  · （其余 " + ((contract.fields || []).length - 6) + " 行按 §6 原文看，面板只报前 6 行）");
				} else if (contract.present) L.push("  · §6 有章但没有可解析的字段行（认得出却没解析的行 " + (contract.otherRows || 0) + " 条）。");
				else L.push("  · 面板没读到定稿 §6（还没有定稿，或定稿里没有 `## 6. 配置契约`）。");
				if (pend.length + noted.length) {
					L.push("还有没填的（**是缺口** —— §6.5 的状态列写着「待配表」，不是「面板看不到」）：");
					for (const r of pend) L.push("  · L" + r.line + " " + r.group + " · " + r.cn + "（`" + r.field + "`）：" + r.status);
					for (const g of noted) L.push("  · L" + g.line + " " + g.group + " · " + g.cn + "：" + g.status);
					L.push("  ⇒ 请把这几处**落到表里**（或明确告诉我它要挂在哪张表的哪个字段上）；落不下来的，请在回话里逐条说明卡在哪。");
				} else L.push("没有「待配表」缺口 —— 这一轮要改的是规则变动牵动的字段（若有）。");
				const rb = inp.readbacks || [];
				L.push("读回验收（`evidence\\readback_*`）：" + (rb.length ? rb.map((r) => r.name).join(" / ") : "面板看不到读回回执（**不等于**没验收过 —— 只代表 evidence\\ 里没有 `readback_*`）"));
				if (inp.intent) L.push("这次要改的（我的一句话）：" + oneLine(inp.intent));
				L.push("要求：", "  · 字段名 / 表名 / 结构以配置表的**实际落地**为准；面板给的 §4 规则是设计依据，不是字段清单。", "  · 改了字段就同步 INDEX 与配置说明 / 字段批注（按 /sr-config 的既定纪律）。", "  · 落表之后跑一次读回验收并留 `evidence\\readback_<表>_<主题>_<日期>.md` —— 面板看的就是它。", "  · 面板**不重做 Excel、不改任何表**：它只显示这条支线走到哪。", tail);
				return {
					instruction: L.join("\n"),
					blocked: "",
					next: ""
				};
			}
			if (a.id === "wireframe") {
				const imgs = (Array.isArray(inp.images) ? inp.images : []).map((x) => {
					const s = String(x == null ? "" : x).trim();
					return {
						raw: s,
						win: /^https?:\/\//i.test(s) ? s : winOf(s === "" ? "" : s.replace(/^file:\/\/\/?/i, ""))
					};
				}).filter((x) => x.raw !== "");
				if (imgs.length === 0) return {
					instruction: "",
					blocked: "「线框图」需要至少一条界面图路径 —— 面板拿不到二进制，路径是唯一的可靠输入。",
					next: "在下面粘一条路径（本机文件 / 目录 / 链接都行，可多行），或从 `gdd\\UI\\` 里已备好的那几张里点一个。"
				};
				const ascii = (inp.ascii || []).filter((x) => x && (x.no || x.id));
				const where = oneLine(inp.where);
				const uiPart = (() => {
					const m = /UI-M\d+/i.exec(where || "") || (ascii.length === 1 ? /UI-M\d+/i.exec(ascii[0].id || "") : null);
					return m ? m[0] : "";
				})();
				const path = winOf(inp.draftPath) || gddDir + "\\" + (topic || "<主题>") + "_*（按日期取最新）";
				const L = [
					"【文档生成 · 线框图】请把界面图落到成稿 §5（该功能目录下 `gdd\\` 里那一份成稿），**不要动任何别的章**。",
					"主题：" + (topic || "（按成稿推导）"),
					"改哪儿：" + (where || (ascii.length ? "§5 里那 " + ascii.length + " 处 ASCII 占位（" + ascii.map((x) => "§" + x.no + (x.id ? " " + x.id : "") + " L" + x.line).join(" · ") + "）" : "§5（面板这次没在 §5 里认出 ASCII 占位 —— 请按下面的现状原文自行核对）")) + "；成稿：" + path
				];
				L.push("现状原文（面板读出来的 ASCII 占位；行号会漂、原文不会）：");
				if (ascii.length) {
					for (const x of ascii) L.push("  · §" + x.no + (x.id ? " " + x.id : "") + " " + x.title + "　L" + x.line + "　（约 " + x.lines + " 行）");
					L.push("  · 这些段在成稿里都是 ```text 围栏 —— 替换时**整段换掉**，不要把 ASCII 留在下面当备份。");
				} else L.push("  · （没认出 ASCII 占位：可能 §5 里已经是图片引用了。若是，请只补/换下面这些图，不要重排 §5 的组与条目。）");
				L.push("要换成什么（界面图，逐条给路径）：");
				for (const im of imgs) L.push("  · " + im.win);
				L.push("要求：", "  · §5 是**用户体验与界面流程**章（`#5`）—— 换图时保留原有的 §5.x 组号、UI-M* 标识与 UE* 条目，不要顺手改编号或列序。", uiPart ? "  · " + uiPart + " 组的图请跟着该组的条目走：图换了但条目还对不上图的，逐条指出哪几条要跟着改。" : "  · 图与条目要对得上：换了图之后如果 UE* 条目说的和图上不一致，逐条列出来（不要自己顺手改规则）。", "  · §5 的条目是**界面流程与交互规则**（纯设计），不要在这里写字段名 / 表名——配置内容一律不进成稿。", "  · 若图里有面板看不清的东西（缺状态、缺文案、缺边界），**先问我**，不要自己猜着补。", "  · 面板不做这件事：它只把「现状原文 + 图路径 + 落点」说到不用再找，落纸与对账都在那个会话里。", tail);
				return {
					instruction: L.join("\n"),
					blocked: "",
					next: ""
				};
			}
			const label = oneLine(inp.configLabel);
			const miss = (Array.isArray(inp.configMissing) ? inp.configMissing : []).map(oneLine).filter((x) => x !== "");
			if (topic === "" && winOf(inp.draftPath) === "") return {
				instruction: "",
				blocked: "「发起整合定稿」需要成稿 —— 主题与成稿路径都拿不到。",
				next: "先走「写成稿」，或在「主题」里写功能名。"
			};
			const L = [
				"【文档生成 · 发起整合定稿】请执行 `/sr-gdd-ai`（走 `/sr-gdd-ai` 的正常调用，不要改动该 skill）。",
				"主题：" + (topic || "（按成稿推导）"),
				"成稿（整合的规则侧；这份是设计内容的撰写地）：" + (winOf(inp.draftPath) || gddDir + "\\" + (topic || "<主题>") + "_*（按日期取最新）"),
				"现状（配置支线走到哪 —— 面板读自定稿 §6，只报状态）：" + (label || "（面板没读到定稿 §6：还没有定稿，或定稿里没有配置契约）")
			];
			if (miss.length) {
				L.push("配置侧的缺口（整合时要一并处置或明确列为待办）：");
				for (const m of miss.slice(0, 10)) L.push("  · " + m);
			}
			L.push("整合要求（`gdd-pipeline.md` §二的章节对应）：", "  · §4 保留成稿的规则与组号，把每条规则**对应到配置表里实际落地的字段/记录**（整合结果，不是另写一套规则）。", "  · §5 界面流程按成稿口径搬；§6 范围门 → §8、§7 埋点 → §9、§9 验收 → §10、§10 交接 → §11。", "  · 新增 §6 配置契约：从配置表**读回**（中文字段 / 英文字段 / 结构 / 含义 / 状态：已有、新增、新增命名待定、待配表）。", "  · 新增 §7 多语言文本：据定稿列出**普通文本**条目（键 + 中文文案 + 状态）；文本表的增删改由用户自行发起，本步不落表。", "  · §8 验证计划与 §12 已废弃口径**不进定稿**（只留在成稿）。", "  · 产出顶部 `doc_type: final_gdd` + `status: pending`；第 5 步先调 `/sr-gdd-review` 出审查报告，再呈定稿门（审查是质量意见，不是通过凭证）。", tail);
			return {
				instruction: L.join("\n"),
				blocked: "",
				next: ""
			};
		}
		//#endregion
		//#region src/pure/intake.ts
		/**
		* 收件箱纯逻辑：素材解析 / 主题派生 / 四种输入方式的指令组装
		*
		* ★ 工单 03（WorkspacePort 接缝）从 `src/client.js` **逐字搬来**，只做了整体去缩进与补 export；
		*   正文一字未改（行为不变的证据：临时 harness 对真实工作区数据做迁移前后 deepEqual）。
		* 这一份原来内联在 client.js 里（因为当时只能有一个文件）；现在它是真模块，legacy 的两份副本与防漂移比对脚本随之删除。
		*
		* ★ 工单 23（头脑风暴工作面）**加了一组新入口**（`buildBrainstormInstruction`）：
		*   竞品分析 / 问答式访谈 / 旧文档分析 / 人工补充 —— 与老收件箱的四种方式**不是同一套语义**
		*   （老方式 3/4 只登记进 `inbox\`；新入口的产出全部落功能目录的 `analysis\`，且旧文档分析 / 人工补充
		*   有**固定格式**，见设计 §4.2）。老的那一组**原样保留**：设计资产屏还在用，改它就是行为回归。
		*
		* ★ 工单 24（文档生成工作面）继续照这条纪律走：动作表与三段式组装器都在 `./draftstep.ts`，
		*   这里只 **re-export**（`DRAFT_ACTIONS` / `buildDraftInstruction`）—— 面板侧读 `INTAKE` 就够，
		*   不会出现"client.js 里再抄一份"的第二份实现。
		*/
		const INTAKE = (function() {
			/** 文档类扩展名（导入时只复制这些，跳过图片/视频等大文件） */
			const DOC_EXT = [
				"md",
				"markdown",
				"txt",
				"json",
				"jsonc",
				"yaml",
				"yml",
				"csv",
				"tsv",
				"html",
				"htm",
				"xml",
				"doc",
				"docx",
				"xls",
				"xlsx",
				"xlsm",
				"ppt",
				"pptx",
				"pdf"
			];
			/** 浏览器能直接读成文本的扩展名（拖进来即可内联，不需要 agent 再读盘） */
			const TEXT_EXT = [
				"md",
				"markdown",
				"txt",
				"json",
				"jsonc",
				"yaml",
				"yml",
				"csv",
				"tsv",
				"html",
				"htm",
				"xml",
				"log",
				"ini",
				"conf",
				"css",
				"js",
				"svg"
			];
			/** 四种输入方式的元数据（UI 与测试共用一份口径） */
			const INTAKE_KINDS = [
				{
					id: "analysis",
					label: "竞品分析",
					hint: "跑 sr-analysis",
					needs: "素材：目录 / 文件路径 / 链接（截图、录屏、PV、商店页）"
				},
				{
					id: "concept",
					label: "问答式访谈",
					hint: "跑 sr-concept",
					needs: "一句话创意（可附参考素材路径）"
				},
				{
					id: "import",
					label: "旧文档导入",
					hint: "只登记进收集箱",
					needs: "旧方案 / 旧文档的目录或文件路径"
				},
				{
					id: "manual",
					label: "人工补充",
					hint: "只登记进收集箱",
					needs: "标题 + 正文（想到什么写什么）"
				}
			];
			const isWinAbs = (p) => /^[A-Za-z]:[\\/]/.test(p) || /^\\\\/.test(p) || /^[\\/]/.test(p);
			const isHttp = (p) => /^https?:\/\//i.test(p);
			/** 路径统一成 Windows 反斜杠（指令里给 agent 看的形态） */
			const winOf = (p) => String(p == null ? "" : p).replace(/\//g, "\\").replace(/\\+$/, "");
			/** 单个素材字符串 → [{ kind, path|text }] */
			function parseMaterial(raw) {
				const s = String(raw == null ? "" : raw).trim();
				if (s === "") return [];
				if (isHttp(s)) return [{
					kind: "url",
					path: s
				}];
				if (isWinAbs(s)) {
					const bare = s.replace(/[\\/]+$/, "");
					return [{
						kind: /^[A-Za-z]:$/.test(bare) || /^\\\\[^\\]+$/.test(bare) || !/\.[A-Za-z0-9]{1,8}$/.test(bare) ? "dir" : "file",
						path: bare
					}];
				}
				return [{
					kind: "text",
					text: s
				}];
			}
			/** 文本块 → 素材数组（按行拆：绝对路径/URL 逐行成项，其余并为 text） */
			function parseMaterials(raw) {
				const out = [];
				const pending = [];
				const flush = () => {
					const t = pending.join("\n").trim();
					if (t !== "") out.push({
						kind: "text",
						text: t
					});
					pending.length = 0;
				};
				for (const line of String(raw == null ? "" : raw).split(/\r?\n/)) {
					const t = line.trim();
					if (t !== "" && (isWinAbs(t) || isHttp(t))) {
						flush();
						for (const it of parseMaterial(t)) out.push(it);
					} else pending.push(line);
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
			/** 扩展名（小写，无点；没有则空串） */
			function extOf(name) {
				const m = /\.([A-Za-z0-9]{1,8})$/.exec(String(name == null ? "" : name));
				return m ? m[1].toLowerCase() : "";
			}
			/** 是不是文档类（导入时用它决定复制哪些） */
			function isDoc(name) {
				return DOC_EXT.indexOf(extOf(name)) >= 0;
			}
			/** 浏览器能否直接读成文本 */
			function isTextExt(name) {
				return TEXT_EXT.indexOf(extOf(name)) >= 0;
			}
			/** 从素材派生功能主题（去扩展名、去日期、去尾部噪音） */
			function deriveTopic(materials) {
				const list = materials || [];
				const pick = list.filter((m) => m && (m.kind === "file" || m.kind === "dir"))[0] || list.filter((m) => m && m.kind === "url")[0] || list.filter((m) => m && m.kind === "text")[0];
				if (!pick) return "";
				let n;
				if (pick.kind === "url") n = String(pick.path).replace(/^https?:\/\//i, "").split(/[/?#]/).filter((x) => x !== "")[0] || "";
				else if (pick.kind === "text") n = String(pick.text || "").split(/\r?\n/)[0];
				else n = baseName(pick.path || "");
				if (pick.kind === "dir") return n;
				n = n.replace(/\.[A-Za-z0-9]{1,8}$/, "");
				n = n.replace(/[_\-\s]*\d{8}(?:[_\-\s.]|$)/, " ");
				n = n.replace(/[_\-\s]*(定稿_审查|定稿|审查|宣讲|修订点|UIUE|UI|md版本|人读版|设计稿|初稿|草案)$/, "");
				n = n.replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();
				return n;
			}
			/** 文件名/标题里的非法字符 → _（写盘用） */
			function safeName(p, limit) {
				const s = String(p == null ? "" : p).replace(/[\\/:*?"<>|]/g, "_").replace(/[\r\n\t]/g, " ").replace(/\s+/g, " ").trim();
				const cap = limit || 60;
				return s.length > cap ? s.slice(0, cap) : s;
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
			/** 组装四种输入方式各自发给 agent 的指令 */
			function buildInstruction(kind, input) {
				const inp = input || {};
				const materials = inp.materials || [];
				const topic = String(inp.topic || "").trim() || deriveTopic(materials);
				const note = String(inp.note == null ? "" : inp.note).trim();
				const root = String(inp.srWs || "").replace(/\//g, "\\").replace(/\\+$/, "");
				const inbox = root + "\\inbox";
				const NOT_A_SKILL = "注意：不要改动任何 sr skill；只登记为 inbox / needs_review，不提升为正式资产。";
				if (kind === "analysis") {
					if (!hasPathMaterial(materials)) return {
						instruction: "",
						blocked: "「竞品分析」需要一份素材：目录、文件路径或链接（截图、录屏、PV、商店页 / 视频链接）。"
					};
					const lines = [
						"【输入方式 1 · 竞品分析】请执行 `/sr-analysis`（走 `/sr-analysis <素材路径或链接>` 的正常调用，不要改动该 skill）。",
						"素材：",
						describeMaterials(materials),
						"分析目标：" + (note || "（未指定——按 sr-analysis 第 1 步 VOI 门现场确认）")
					];
					if (topic) lines.push("功能主题（用于产出命名与归档）：" + topic);
					lines.push("按 sr-analysis 的既有流程执行，在它的决策门停下来等我拍板。");
					return {
						instruction: lines.join("\n"),
						blocked: ""
					};
				}
				if (kind === "concept") {
					const seed = note || (materials.filter((m) => m.kind === "text")[0] || {}).text || "";
					if (String(seed).trim() === "") return {
						instruction: "",
						blocked: "「问答式访谈」需要一句创意：在输入框里写下你想做的玩法或功能。"
					};
					const pathMats = materials.filter((m) => m.kind !== "text");
					const lines = ["【输入方式 2 · 问答式访谈】请执行 `/sr-concept`（走 `/sr-concept <一句话创意>` 的正常调用，不要改动该 skill）。", "创意：" + String(seed).replace(/\s+/g, " ").trim()];
					if (pathMats.length > 0) {
						lines.push("已有材料（有就给路径）：");
						lines.push(describeMaterials(pathMats));
					} else lines.push("已有材料：没有。");
					if (topic) lines.push("功能主题（用于产出命名与归档）：" + topic);
					lines.push("定位：本项目（文明之跃）新功能/新玩法。");
					lines.push("按 sr-concept 的既有流程执行，在它的决策门停下来等我拍板。");
					return {
						instruction: lines.join("\n"),
						blocked: ""
					};
				}
				if (kind === "import") {
					const pathMats = materials.filter((m) => m.kind === "file" || m.kind === "dir");
					if (pathMats.length === 0) return {
						instruction: "",
						blocked: "「旧文档导入」需要至少一个目录或文件路径（可拖进来，也可直接粘贴）。"
					};
					const lines = [
						"【输入方式 3 · 旧文档导入】把下列资料作为**参考材料**导入工作区：",
						describeMaterials(pathMats),
						"步骤：",
						"1) 逐条处理：目录 → 在 " + inbox + "\\imported\\ 下建一个以该目录名命名的子目录，递归复制其中的文档（只复制文档类文件：" + DOC_EXT.join(" / ") + "；跳过图片、视频等大文件；不转换格式、不改内容）；文件 → 在 " + inbox + "\\imported\\<文件名（去扩展名）>\\ 下复制这一个文件。",
						"2) 在 " + root + " 下运行 `python scripts/refresh_asset_index.py` 重新生成索引（相对路径以 " + root + " 为基准，不要依赖当前工作目录）。",
						"3) 报告导入了哪些文件、索引新增了几条。"
					];
					if (note) lines.push("补充说明：" + note);
					lines.push(NOT_A_SKILL);
					return {
						instruction: lines.join("\n"),
						blocked: ""
					};
				}
				if (kind === "manual") {
					const title = String(inp.title || "").trim() || topic;
					if (title === "") return {
						instruction: "",
						blocked: "「人工补充」需要一个标题。"
					};
					if (note === "") return {
						instruction: "",
						blocked: "「人工补充」需要正文。"
					};
					const lines = [
						"【输入方式 4 · 人工补充】在 " + inbox + "\\manual\\ 下新建 " + safeName(title) + ".md，内容如下：",
						"---",
						"title: " + title,
						"source: human"
					];
					if (inp.upstream) lines.push("upstream_asset: " + String(inp.upstream));
					lines.push("---", "", note, "");
					lines.push("然后运行 `python scripts/refresh_asset_index.py` 重新生成索引，并报告新增条目。");
					lines.push(NOT_A_SKILL);
					return {
						instruction: lines.join("\n"),
						blocked: ""
					};
				}
				return {
					instruction: "",
					blocked: "未知的输入方式：" + String(kind)
				};
			}
			/**
			* ★ 工单 23 · 头脑风暴四入口各自的指令（设计 §4.1 / §4.2）。
			*
			* 与 `buildInstruction` 的三点不同（这是**新语义**，不是老方式的改写）：
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
				if (!e) return {
					instruction: "",
					blocked: "未知的头脑风暴入口：" + String(kind),
					next: "四个入口是：竞品分析 / 问答式访谈 / 旧文档分析 / 人工补充。"
				};
				const materials = inp.materials || [];
				const note = String(inp.note == null ? "" : inp.note).trim();
				const root = winOf(inp.root);
				const date = String(inp.date || "");
				const topic = String(inp.topic || "").trim() || deriveTopic(materials);
				if (root === "") return {
					instruction: "",
					blocked: "拿不到这个功能的功能目录（`features\\<主题>\\`）。",
					next: "从「功能详情 › 头脑风暴」进来再发一次 —— 指令要发给该功能的专属工作会话（cwd = 功能目录）。"
				};
				const outDir = root + "\\analysis";
				const srcDir = root + "\\source";
				const tail = "阶段交给了 skill / 会话里的 AI：" + e.handoff.replace(/（面板不重画流程）$/, "") + " —— 有决策门就停下来等我拍板，不要自己往下走。";
				if (kind === "analysis") {
					if (!hasPathMaterial(materials)) return {
						instruction: "",
						blocked: "「竞品分析」需要一份素材：目录、文件路径或链接（截图 / 录屏 / PV / 商店页）。",
						next: "在「素材」里粘一条本机绝对路径或链接；纯文字不会被当成素材（要写文字请走「人工补充」或「问答式访谈」）。"
					};
					const L = [
						"【头脑风暴 · 竞品分析】请执行 `/sr-analysis`（走 `/sr-analysis <素材路径或链接>` 的正常调用，不要改动该 skill）。",
						"素材：",
						describeMaterials(materials),
						"分析目标：" + (note || "（未指定——按 sr-analysis 第 1 步 VOI 门现场确认）")
					];
					if (topic) L.push("功能主题（用于产出命名与归档）：" + topic);
					L.push("产出落点：" + outDir + "\\（文件名按 sr-analysis 自己的产出规范：experience-report_*.md / issue-cards_*.json / replication-spec_*.md / sr-gdd-handoff_*.json；证据包落 " + root + "\\evidence\\）");
					L.push(tail);
					return {
						instruction: L.join("\n"),
						blocked: "",
						next: ""
					};
				}
				if (kind === "concept") {
					const seed = note || (materials.filter((m) => m.kind === "text")[0] || {}).text || "";
					if (String(seed).trim() === "") return {
						instruction: "",
						blocked: "「问答式访谈」需要一句创意：在输入框里写下你想做的玩法或功能。",
						next: "在「一句话创意」里写一句（比如：联盟成员一起打 BOSS，血量全盟共享）；有参考素材就把路径一并粘上。"
					};
					const pathMats = materials.filter((m) => m.kind !== "text");
					const L = ["【头脑风暴 · 问答式访谈】请执行 `/sr-concept`（走 `/sr-concept <一句话创意>` 的正常调用，不要改动该 skill）。", "创意：" + String(seed).replace(/\s+/g, " ").trim()];
					L.push(pathMats.length > 0 ? "已有材料（有就给路径）：" : "已有材料：没有。");
					if (pathMats.length > 0) L.push(describeMaterials(pathMats));
					if (topic) L.push("功能主题（用于产出命名与归档）：" + topic);
					L.push("产出落点：" + outDir + "\\（concept-triage_*.md → feature-concept_*.md → sr-gdd-handoff_*.json，文件名按 sr-concept 自己的产出规范）");
					L.push("定位：本项目（文明之跃）新功能/新玩法。");
					L.push(tail);
					return {
						instruction: L.join("\n"),
						blocked: "",
						next: ""
					};
				}
				if (kind === "legacy") {
					const pathMats = materials.filter((m) => m.kind === "file" || m.kind === "dir");
					if (pathMats.length === 0) return {
						instruction: "",
						blocked: "「旧文档分析」需要旧文档的路径（旧策划案 / 脑图 / 表格；目录或单个文件都行）。",
						next: "把旧文档拖进来，或粘它的本机绝对路径（.docx / .xlsx / .md / .pdf 都可）。"
					};
					const produced = legacyDocName(String(inp.name || "").trim() || deriveTopic(pathMats) || "旧文档", date);
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
					return {
						instruction: L.join("\n"),
						blocked: "",
						next: ""
					};
				}
				if (kind === "humannote") {
					const title = String(inp.title || "").trim();
					const quote = String(inp.quote == null ? "" : inp.quote).trim();
					if (title === "") return {
						instruction: "",
						blocked: "「人工补充」需要一个标题（它同时是产出文件名与文档一级标题）。",
						next: "在「标题」里写一句话，比如：BOSS 血量按联盟共享。"
					};
					if (quote === "") return {
						instruction: "",
						blocked: "「人工补充」需要你的原话 —— 原话是这份文档唯一的结论来源。",
						next: "把你想说的那句原话写进「原话（逐字保留）」；AI 只整理格式，不改你的结论。"
					};
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
					L.push("产出格式：", "---", "doc_type: human_note", "topic: " + (topic || "<功能主题>"), "confidence: " + confidence + "          # high | pending（pending = 需补证据或验证，下游引用时要带标记）", "date: " + (date || "<YYYYMMDD>"), "author: " + (author || "<谁说的>"), "---", "", "# " + title, "", "> 原话：「" + quote + "」", "", "## 结论", "<把原话整理成可被下游消费的规则口径 —— 原话本身就是结论，你只能让它更清楚，不能改它的意思>", "", "## 边界", "- <我给了就照抄；没给写「（待定）」并在会话里问我>", "", "## 落点", "- <条目引用，如 §4 R2 BOSS 与难度推进 / §5 UI-M1 UE2 血条区；没给写「（待定）」>", "要求：", "1) `> 原话：…` 那一行**逐字保留**；它与「结论」在面板上是**并排显示**的 —— 我一眼就能看出你有没有改动结论。", "2) 结论里若必须补推断（原话没说到的部分），单独写清补的是哪一步，不要混进原话里。", "3) 边界 / 落点我没给就写「（待定）」并问我，别自己编。", tail);
					return {
						instruction: L.join("\n"),
						blocked: "",
						next: ""
					};
				}
				return {
					instruction: "",
					blocked: "未知的头脑风暴入口：" + String(kind),
					next: "四个入口是：竞品分析 / 问答式访谈 / 旧文档分析 / 人工补充。"
				};
			}
			return {
				INTAKE_KINDS,
				BRAINSTORM_KINDS: ENTRANCES,
				DRAFT_ACTIONS: DRAFT_ACTIONS_TABLE,
				DRAFT_PHASES,
				parseMaterial,
				parseMaterials,
				baseName,
				extOf,
				isDoc,
				isTextExt,
				deriveTopic,
				safeName,
				describeMaterials,
				hasPathMaterial,
				buildInstruction,
				buildBrainstormInstruction,
				buildDraftInstruction
			};
		})();
		//#endregion
		//#region src/load/brainstorm.ts
		/**
		* 头脑风暴工作面加载器（工单 23）—— 「已有的分析结论」+ 两种新格式的解析结果。
		*
		* 口径：
		*   · **只吃 port**，只读；不写任何东西（"面板只读、agent 执行"）。
		*   · 产物清单**不在这里重新列目录** —— 它由 `loadFeatureDetail`（工单 12）给，本加载器只拿
		*     `analysis` 组的文件清单做事：这样"面板列出的产物"与"工作面认出的结论"**同一份来源**，
		*     不会出现两处列举结果不一致。
		*   · 两种新格式（`legacy-analysis_*` / `human-note_*`）读**全文**再解析（原文段可能在文件末尾）；
		*     交接件 JSON 只读**开头**（只要 `source_skill` 一个字段，不把 5KB JSON 整个拉进来）。
		*   · 读不动的文件**如实报出来**（`unreadable`），不静默当成"没有"。
		*
		* 纯函数部分在 `../pure/analysisdoc.ts`（归类 / 解析 / 文件名规则），这里只做 IO 与编排。
		*/
		/** 一个文件 → 绝对路径（`analysis` 组的子目录也认） */
		function absOf$1(root, f) {
			const rel = String(f && f.rel || "").replace(/\\/g, "/");
			if (rel !== "") return root.replace(/\\+$/, "") + "/" + rel;
			const sub = String(f && f.subdir || "");
			return root.replace(/\\+$/, "") + "/" + (sub ? sub + "/" : "") + String(f.name || "");
		}
		/**
		* 读一个功能的 `analysis\` → 工作面视图模型。
		*
		* @returns `{ root, groups, legacy, humannote, unreadable, notes }`
		*   · `groups` —— 按四入口分组（`groupAnalyses` 的结论：恒四组，空组也出现）
		*   · `legacy` / `humannote` —— 两种新格式的解析结果（含 `name` / `rel`，面板点开就渲染它）
		*   · `unreadable` —— 读不动的文件（如实列出，不当成"没有"）
		*   · `notes` —— 出口判据等提示（来自 `stage.note`，**不在这一层重算**）
		*/
		async function loadBrainstorm(port, options) {
			const root = String(options.root || "").replace(/\\+$/, "");
			const files = Array.isArray(options.files) ? options.files.filter((f) => f && f.name) : [];
			const maxDocs = Math.max(1, Math.trunc(Number(options.maxDocs) || 12));
			const signal = options.signal;
			const notes = [];
			const unreadable = [];
			/** 交接件的 `source_skill`（只这几份：文件名前缀能认出来） */
			const skills = {};
			for (const f of files.filter((x) => /^sr-gdd-handoff_/i.test(x.name))) {
				const head = await readHead$1(port, absOf$1(root, f), signal);
				if (head === null) unreadable.push({
					name: f.name,
					why: "读不到开头（拿不到交接件的 source_skill）"
				});
				else skills[f.name] = sourceSkillOf(head);
			}
			const legacy = [];
			const humannote = [];
			const docs = files.filter((f) => analysisDocKind(f.name) !== "");
			for (const f of docs.slice(0, maxDocs)) {
				const k = analysisDocKind(f.name);
				const text = await readAllText$1(port, absOf$1(root, f), signal, 4e3);
				if (text === null) {
					unreadable.push({
						name: f.name,
						why: "读不到正文"
					});
					continue;
				}
				const parsed = k === "legacy" ? parseLegacyAnalysis(text, f.name) : parseHumanNote(text, f.name);
				parsed.rel = String(f.rel || f.name);
				parsed.abs = absOf$1(root, f);
				if (k === "legacy") legacy.push(parsed);
				else humannote.push(parsed);
			}
			if (docs.length > maxDocs) notes.push("新格式产物共 " + docs.length + " 份，只解析了最新的 " + maxDocs + " 份（点文件名可打开看全文）。");
			return {
				root,
				groups: groupAnalyses(files.map((f) => ({
					name: f.name,
					rel: f.rel || f.name,
					subdir: f.subdir || "",
					skill: skills[f.name] || ""
				}))),
				legacy,
				humannote,
				unreadable,
				notes: (options.stage && options.stage.note ? [options.stage.note] : []).concat(notes)
			};
		}
		//#endregion
		//#region src/pure/drafttree.ts
		/**
		* 文档生成工作面的**结构数据**（工单 24）—— 纯函数：`parseFinalGdd` 的结果 → 左树 + **两大部分**。
		*
		* ── 为什么是"复用定稿那套解析能力"而不是另写一份（工单 24 第 5 条）────────────
		*   成稿与定稿是**同一个模板**的两种形态（`sr-gdd-human/SKILL.md` §功能说明：
		*   「结果章 §1–§12」；`gdd-pipeline.md` §二的章节对应表就是成稿章 → 定稿章的一一对应）。
		*   所以章 / 组 / 条目 + 1-based 行号的解析**只有一份实现**：`finalgdd.parseFinalGdd`。
		*   本模块只做两件它不做的事：
		*     ① 把树**按模板语义分组**（章不引用 ⇒ 传 `graph = null`，`finaltree` 已经支持）；
		*     ② 标出**两大部分**（§4 功能规则 / §5 用户体验与界面流程）—— 它们是成稿里唯一被语言部分
		*        （"用户体验与界面流程"）与格式部分（11 个 `UI-M*` 组名）**双重证明**存在的两块。
		*
		* ── "两大部分"的口径出处（逐条引原文）──────────────────────────────────────
		*   · 工单 24 第 1 条：「能读成稿并按其**两大部分**定位：功能规则、用户体验与界面流程
		*     （这是后续两条支线的依据）」。
		*   · `gdd-pipeline.md` §一·三份产出的「内容」列，成稿那一格逐字列出：
		*     「功能意图、玩家动词、核心循环、**功能规则**、**界面流程**、范围门、埋点、验证计划、
		*       验收标准、交接清单、数值待定项；决策留痕在附录 A」；
		*     定稿那一格是「**功能规则**、**界面流程**、§6 配置契约、§7 多语言文本、…」。
		*   · `spec.md` 的 Y 形（工单 24 引用它）：「成稿 → 配置支线 / 线框图支线 → 合流 → 整合定稿 → 必经审查」，
		*     两条支线的**依据**正是 §4（配置支线：规则是配置字段的唯一设计依据）与 §5（界面支线：线框图替换）。
		*   · `gdd-pipeline.md` §二：#4 功能规则 → 定稿 #4；#5 用户体验与界面流程 → 定稿 #5（**一一对应、原样保留组号**）。
		*
		* ── 章号是**读出来的，不是写死的**──────────────────────────────────────────
		*   `locateParts` 按章标题里的关键词认这两部分，同时把行号算出来 —— 章号若变（模板加了新章），
		*   面板跟着变而不是硬指向 §4/§5。两条都没认出来时 `complete: false`，面板**如实说没认出来**。
		*/
		/** 两大部分的判据（标题关键词；与 `gdd-pipeline.md` 的章节名同源） */
		const PARTS = [{
			key: "rules",
			label: "功能规则",
			re: /功能规则/
		}, {
			key: "ux",
			label: "用户体验与界面流程",
			re: /用户体验|界面流程/
		}];
		/** 文本 + 解析结果 → 两大部分的数据。`doc` 可传（复用一次解析），不传就现场解析。 */
		function draftDocOf(text, parsed) {
			const src = String(text == null ? "" : text);
			const doc = parsed || parseFinalGdd(src);
			const lines = src === "" ? 0 : src.split(/\r?\n/).length;
			const tree = buildFinalTree(doc, null);
			const outline = doc.outline || [];
			/** 章号 → 它的树节点（items/groups/skipped 都在树上，不重算） */
			const nodeOf = (no) => tree.chapters.filter((c) => c.no === no)[0] || null;
			/**
			* 章节点 → 条目数 / 不可引用行数。
			* ★ 章的 `skipped` 分两处记账：章级条目自己的（`c.skipped`）+ **组内的**（`g.skipped`）——
			*   `finaltree` 里 §5.0 的界面清单是"组内不可引用"，不加起来就会算成 0（实测踩过）。
			*/
			const totalsOf = (n) => {
				if (!n) return {
					items: 0,
					skipped: 0
				};
				let items = (n.items || []).length, skipped = Number(n.skipped) || 0;
				for (const g of n.groups || []) {
					items += (g.items || []).length;
					skipped += Number(g.skipped) || 0;
				}
				return {
					items,
					skipped
				};
			};
			const parts = [];
			const found = {};
			for (const c of outline) {
				const hit = PARTS.filter((p) => p.re.test(String(c.title || "")))[0];
				if (!hit || found[hit.key]) continue;
				found[hit.key] = true;
				const n = nodeOf(String(c.no));
				let endLine = lines;
				for (const o of outline) {
					const ol = Number(o.line) || 0;
					if (ol > Number(c.line)) {
						endLine = ol - 1;
						break;
					}
				}
				const tt = totalsOf(n);
				parts.push({
					key: hit.key,
					label: hit.label,
					no: String(c.no),
					title: String(c.title || ""),
					line: Number(c.line) || 0,
					endLine,
					idx: Number(c.idx) || 0,
					groups: n && n.groups.length || 0,
					items: tt.items,
					skipped: tt.skipped,
					note: hit.key === "rules" ? "配置支线的依据：/sr-config 从这些规则**派生**配置字段与记录（规则没写清，字段就落不了地）" : "界面支线的依据：线框图 / 界面图替换与 §5 的界面组 + 条目（UI-M* / UE*）"
				});
			}
			const order = PARTS.map((p) => p.key);
			parts.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
			const partOf = (no) => (parts.filter((p) => p.no === no)[0] || { key: "" }).key;
			const chapters = outline.map((c) => {
				let endLine = lines;
				for (const o of outline) {
					const ol = Number(o.line) || 0;
					if (ol > Number(c.line)) {
						endLine = ol - 1;
						break;
					}
				}
				return {
					no: String(c.no),
					title: String(c.title || ""),
					line: Number(c.line) || 0,
					endLine,
					idx: Number(c.idx) || 0,
					part: partOf(String(c.no))
				};
			});
			const rules = parts.filter((p) => p.key === "rules")[0];
			const ux = parts.filter((p) => p.key === "ux")[0];
			return {
				title: String(doc.title || ""),
				parts,
				ascii: asciiOf(doc),
				complete: parts.length === PARTS.length,
				missingParts: PARTS.filter((p) => !found[p.key]).map((p) => p.label),
				tree,
				chapters,
				lines,
				counts: {
					chapters: tree.counts.chapters,
					groups: tree.counts.groups,
					ruleGroups: rules && rules.groups || 0,
					rules: rules && rules.items || 0,
					uiGroups: ux && ux.groups || 0,
					ues: ux && ux.items || 0
				},
				doc
			};
		}
		/** ```text 围栏（ASCII 骨架图的既有写法；成稿 §5 的 5.1–5.4 都用它） */
		const FENCE_TEXT_RE = /```text[^\n]*\n([\s\S]*?)```/g;
		/**
		* `parseFinalGdd` 的块 → §5 里的 ASCII 占位处（**支线 B 的现状**）。
		*
		* 只认 `level === 3` 且**组号是 5.x** 的块；行数只数围栏内非空行（如实量"这一处占位画了多少行"）。
		* 一条都认不出来就返回空数组 —— 界面照实说"§5 里没有 ASCII 占位了"，**不假装还有**。
		*/
		function asciiOf(doc) {
			const blocks = doc && doc.blocks || [];
			const out = [];
			for (const b of blocks) {
				if (!b || Number(b.level) !== 3) continue;
				const no = String(b.no || "");
				if (!/^5\./.test(no)) continue;
				const text = String(b.text || "");
				FENCE_TEXT_RE.lastIndex = 0;
				let m;
				let lines = 0;
				while ((m = FENCE_TEXT_RE.exec(text)) !== null) lines += (m[1] || "").split("\n").filter((x) => x.trim() !== "").length;
				if (lines === 0) continue;
				out.push({
					no,
					id: String(b.id || ""),
					title: String(b.title || ""),
					line: Number(b.line) || 0,
					lines
				});
			}
			return out.sort((a, b) => a.line - b.line);
		}
		//#endregion
		//#region src/load/draft.ts
		/**
		* 文档生成工作面加载器（工单 24）—— 这一屏的全部数据，**只吃 port、只读**。
		*
		* 三件事，一件都不多：
		*   ① **读成稿**：`gdd\<主题>_<日期>.md`（`doc_type: draft_gdd`，**文件名不带 `成稿` 后缀**）
		*      → `draftDocOf`（`../pure/drafttree.ts`）给出两大部分 + 左树（章 / 组 / 条目 + 1-based 行号）。
		*   ② **配置支线走到哪**：定稿 §6 配置契约（`parseConfigContract`）+ 读回回执（`evidence\readback_*`）
		*      + 配置表存在性（看板按主题挂上来的真实文件名）→ `configBranchState` 给一句话 + 四步 + 缺口。
		*      面板**不解析任何工作簿**（spec.md:212：这里只显示状态）。
		*   ③ 缺件如实报：没有成稿 / 没有定稿 / 读不动 / 认不出两大部分 —— 全进 `notes`，不静默。
		*
		* ── 清单**不在这里重新列目录**──────────────────────────────────────────────
		*   `gdd\` 的文件清单与头部分类（`kind === "draft"` / `"final"`）由 `loadFeatureDetail`（工单 12）
		*   给，本加载器只拿它做事 —— 这样"面板列出的产物"与"工作面读的那份成稿"**同一份来源**，
		*   不会出现两处列举结果不一致（与工单 23 的 `brainstorm.ts` 同一条纪律）。
		*
		* ── 只读前 14 行拿头部 ────────────────────────────────────────────────────
		*   成稿 / 定稿的 `doc_type` / `status` 都在头部（`gdd-pipeline.md` §一·补）⇒ 用 `readHead`，
		*   不必为了两个字段把 40KB 正文拉两次。
		*/
		/** 界面图的扩展名（`gdd\UI\` 里能当"界面图"用的那些；与 `split.ts` 认的图片类型同口径） */
		const IMAGE_RE = /\.(png|jpe?g|gif|webp|svg)$/i;
		/** 字节数 → KB 一位小数（`39495` → `38.6`；0 就是 `0.0`，不编） */
		function kbOf(bytes) {
			return Math.round((Number(bytes) || 0) / 1024 * 10) / 10;
		}
		/**
		* 文本的 **UTF-8 字节数**。
		*
		* ★ 这一层跑在**浏览器半侧**（`lib/client.js` 里那个 bundle）—— **没有 `Buffer`、没有 `node:*`**，
		*   所以既不能 `Buffer.byteLength`，也不该去 import node 的东西。优先用平台自带的 `TextEncoder`
		*   （浏览器与 Node 都有；`TextEncoder` 只吃 string，不看 BOM），拿不到时退回**数码点**：
		*   非 ASCII 按 3 字节算 —— 这是**如实标注的近似**（真实工作区里的成稿是纯中文 markdown，
		*   中文在 UTF-8 里就是 3 字节；emoji 这类 4 字节的会低估，界面上"约"的口径与它一致）。
		*/
		function utf8BytesOf(text) {
			const s = String(text == null ? "" : text);
			try {
				const TE = globalThis.TextEncoder;
				if (typeof TE === "function") return new TE().encode(s).length;
			} catch (e) {}
			let n = 0;
			for (const ch of s) n += ch.codePointAt(0) < 128 ? 1 : 3;
			return n;
		}
		/** `20260918` → `2026-09-18`（认不出就原样返回，不编日期） */
		function dashDate(ymd) {
			const s = String(ymd == null ? "" : ymd);
			return /^\d{8}$/.test(s) ? s.slice(0, 4) + "-" + s.slice(4, 6) + "-" + s.slice(6, 8) : s;
		}
		/** 绝对路径（功能根 + 相对路径，正斜杠） */
		function joinAbs(root, rel) {
			return String(root).replace(/\\+$/, "") + "/" + String(rel).replace(/\\/g, "/");
		}
		const absOf = (root, rel) => String(root).replace(/\\+$/, "") + "/" + String(rel).replace(/\\/g, "/");
		/** 成稿候选：`gdd\` 顶层里 `gddKindOf` 判为 `draft` 的那些（**不按文件名猜**） */
		function draftsOf(files) {
			return (Array.isArray(files) ? files : []).filter((f) => f && f.name && !f.subdir && f.kind === "draft").sort((a, b) => dateOf(a.name) < dateOf(b.name) ? 1 : -1);
		}
		/**
		* 读一个功能的成稿 → 文档生成工作面的视图模型。
		*
		* @returns `{ root, doc, path, name, head, config, configFiles, notes }`
		*   · `doc` —— `draftDocOf` 的结论（两大部分 + 左树 + 章清单）；没有成稿时为 `null`
		*   · `path` / `name` / `head` —— 当前这份成稿（面板上"读的是哪一版"要看得见）
		*   · `config` —— `configBranchState` 的结论（配置支线走到哪）
		*   · `notes` —— 缺件与降级说明（如实列出）
		*/
		async function loadDraftWorkface(port, options) {
			const root = String(options && options.root || "").replace(/\\+$/, "");
			const signal = options && options.signal;
			const notes = [];
			const drafts = draftsOf(options && options.gddFiles || []);
			const current = drafts[0] || null;
			let path = "";
			let name = "";
			let head = null;
			let doc = null;
			/** 成稿全文（字节数进"人话"里的 KB；读不到就是空串） */
			let raw = "";
			if (!current) notes.push("gdd\\ 里没有成稿（`<主题>_<日期>.md`，头部 `doc_type: draft_gdd`）—— 这一屏的第一个动作就是「写成稿」。");
			else {
				name = current.name;
				path = absOf(root, String(current.rel || "gdd/" + current.name));
				const h = await readHead$1(port, path, signal);
				if (h === null) notes.push("成稿 `" + name + "` 读不到开头（拿不到 doc_type / status）。");
				else {
					head = parseFrontmatter$1(h) || null;
					if (head && head.doc_type && String(head.doc_type) !== "draft_gdd") notes.push("这份文件的 `doc_type` 是 `" + String(head.doc_type) + "`，不是 `draft_gdd` —— 面板按 `gddKindOf`（文件名）把它当成了成稿，两者不一致时界面上的状态以头部字段为准。");
				}
				const text = await readAllText$1(port, path, signal, 3e3);
				if (text === null) notes.push("成稿 `" + name + "` 读不动正文 —— 两大部分与左树本屏为空。");
				else {
					raw = text;
					doc = draftDocOf(text, void 0);
					if (!doc.complete) notes.push("没认出「" + doc.missingParts.join("」与「") + "」这两大部分里的全部 —— 面板按章标题关键词认，认不出来就如实说认不出来（不硬指一个章号）。");
					if (drafts.length > 1) notes.push("gdd\\ 里有 " + drafts.length + " 份成稿（" + drafts.map((d) => d.name).join(" / ") + "）—— 本屏读的是**日期最新**的那一份。");
				}
			}
			const finals = (Array.isArray(options && options.gddFiles) ? options.gddFiles : []).filter((f) => f && f.name && !f.subdir && f.kind === "final").sort((a, b) => dateOf(a.name) < dateOf(b.name) ? 1 : -1);
			const cur = options && options.finalCheck && options.finalCheck.current || "";
			const finalName = cur || (finals[0] ? finals[0].name : "");
			let finalHead = null;
			let contract = parseConfigContract("");
			if (finalName) {
				const fp = absOf(root, "gdd/" + finalName);
				const fh = await readHead$1(port, fp, signal);
				if (fh === null) notes.push("定稿 `" + finalName + "` 读不到开头（拿不到 doc_type / status）。");
				else finalHead = parseFrontmatter$1(fh) || null;
				const ftext = await readAllText$1(port, fp, signal, 3e3);
				if (ftext === null) notes.push("定稿 `" + finalName + "` 读不动正文 —— 配置支线只能报到「有定稿」为止。");
				else contract = parseConfigContract(ftext);
				if (finals.length > 1 && cur) notes.push("gdd\\ 里有 " + finals.length + " 份定稿 —— 配置契约读的是**当前有效**那一份（`" + cur + "`，" + String((options.finalCheck && options.finalCheck.currentFrom) === "active" ? "按 active 标记判定" : "按文件名日期判定") + "）。");
			}
			const rbs = readbacksOf(options && options.evidenceFiles || []);
			/**
			* 配置表文件名：**以配置目录的实际列举为准**（`configRoot` 由看板从 sr 配置里取）。
			* 列不出来时退回看板按主题挂上来的那份，并在 `notes` 里如实说明 —— 不假装核过了。
			*
			* ★ 工单 07：这里多了 `configListed` 这一位 —— **列不出来时不许报"缺件"**。
			*   根因：host 的目录列举圈定在**会话 cwd** 之内（`dsh-api-workspace-files/lib/index.js:411/500`），
			*   而索引会话的 cwd = SR 工作区根，`config_root`（`D:\TimeMachine\planner\策划配置`）在它外面；
			*   列举失败时 `listFiles(…, optional=true)` 返回空数组（不抛），于是
			*   `referencedMissing` 会把**每一个** §6 工作簿都报成"配置目录里没有同名文件" ——
			*   正好和上面那句"按核不了处理（不编缺件）"相反。现在：没列出来 ⇒ 这一项按"核不了"处理（空数组）。
			*/
			let configFiles = (options && options.configFiles || []).map(String).filter((x) => x !== "");
			let configListed = false;
			const cfgRoot = String(options && options.configRoot || "").replace(/[\\/]+$/, "");
			if (cfgRoot !== "") try {
				const sheets = (await listFiles(port, cfgRoot, signal, true)).filter((n) => /\.xlsx?m?$/i.test(n));
				if (sheets.length === 0) notes.push("配置目录 `" + cfgRoot + "` 里一个工作簿都没列到 —— 工作簿存在性这一项按“核不了”处理（不编缺件）。");
				else {
					configFiles = sheets;
					configListed = true;
				}
			} catch (e) {
				notes.push("配置目录 `" + cfgRoot + "` 列举失败：" + String(e && e.message || e) + " —— 工作簿存在性退回看板给的清单。");
			}
			/**
			* §6 引用的工作簿 → 配置目录里有没有同名文件（**只比文件名**，不解析工作簿）。
			* ★ 只有**真的列过配置目录**（`configListed`）才敢报"缺件"；否则这一项一律空 —— 宁可不说，
			*   也不把"列不出来"说成"文件不存在"。
			*/
			const referencedMissing = configListed ? (contract.workbooks || []).filter((w) => configFiles.indexOf(w) < 0) : [];
			const branch = configBranchState({
				draft: {
					exists: !!doc,
					name,
					status: String(head && head.status || ""),
					docType: String(head && head.doc_type || ""),
					line: doc && (doc.chapters[0] || {}).line || 1,
					archived: String(head && head.status || "").toLowerCase() === "archived"
				},
				final: {
					exists: !!finalName,
					name: finalName,
					status: String(finalHead && finalHead.status || ""),
					docType: String(finalHead && finalHead.doc_type || ""),
					line: contract.line || 1
				},
				contract,
				referencedMissing,
				readbacks: rbs,
				configFiles
			});
			const topic = name ? topicOf(name) : "";
			const storyA = configBranchStory(branch);
			let images = (options && options.gddFiles || []).filter((f) => f && f.name && String(f.subdir || "") !== "" && /^ui$/i.test(String(f.subdir)) && IMAGE_RE.test(f.name)).map((f) => {
				const rel = String(f.rel || "gdd/" + f.subdir + "/" + f.name);
				return {
					name: String(f.name),
					rel,
					abs: joinAbs(root, rel)
				};
			});
			let uiWhy = "";
			if (root !== "") try {
				const imgs = (await listFiles(port, root + "/gdd/UI", signal, false)).filter((n) => IMAGE_RE.test(n));
				if (imgs.length) {
					const have = {};
					for (const x of images) have[x.name] = true;
					images = images.concat(imgs.filter((n) => !have[n]).map((n) => ({
						name: n,
						rel: "gdd/UI/" + n,
						abs: joinAbs(root, "gdd/UI/" + n)
					})));
				}
			} catch (e) {
				uiWhy = "`gdd/UI/` 这次列不出来（" + String(e && e.message || e) + "）—— 界面图清单用的是产物清单里的那些。";
				if (images.length === 0) uiWhy = "`gdd/UI/` 这次列不出来（" + String(e && e.message || e) + "），产物清单里也没有 `gdd\\UI\\` 的图片 —— 这一项**没核到**。";
			}
			images = images.sort((a, b) => a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0);
			const storyB = wireBranchStory({
				ascii: doc && doc.ascii || [],
				images,
				why: uiWhy
			});
			return {
				root,
				path,
				name,
				head,
				topic,
				doc,
				/** 成稿的 1-based 行数 / 字节数 / KB（人话里的「39 KB」）与文件名里的日期（人话里的「2026-09-18」） */
				lines: doc && doc.lines || 0,
				bytes: utf8BytesOf(raw),
				kb: kbOf(utf8BytesOf(raw)),
				date: dashDate(dateOf(name)),
				/** ★ 两条支线的人话状态（界面直接念；`mis` 里保留机器口径供「详情」核对） */
				story: {
					config: storyA.story,
					wire: storyB.story
				},
				configMis: storyA.mis,
				wireLabel: storyB.label,
				/** §5 里的 ASCII 占位（支线 B 的现状原文） */
				ascii: doc && doc.ascii || [],
				/** `gdd\UI\` 里的界面图（支线 B 的唯一可靠输入） */
				uiImages: images,
				uiWhy,
				drafts: drafts.map((d) => d.name),
				finalName,
				finalHead,
				/** ★ 工单 25 · 定稿门（能不能交程序）—— 原样来自 `loadFeatureDetail` 的 `gate` */
				gate: options && options.gate || null,
				config: branch,
				configFiles,
				evidence: rbs,
				notes
			};
		}
		//#endregion
		//#region src/pure/refresh.ts
		/**
		* 自动刷新与版本指纹（工单 16）—— **纯函数层**（零 IO、零时钟、零全局）。
		*
		* 这一层只回答四件事，全部可对着真实帧与真实路径断言：
		*   ① 一帧是什么（`parseFrame`）
		*   ② 该盯哪些目标、为什么（`watchPlan`）
		*   ③ 这一帧要**重读哪些部件**（`planReload` / `unionParts`）
		*   ④ 屏幕上的内容是不是最新（`acceptFrame` / `fingerprintOf` / `freshnessOf` / `stalePaths`）
		*
		* ── 通道的真实形状（**2026-09-30 在真机 DSH 0.2.0-rc.2 上实测**，证据 `_16-channel-evidence.txt`）──
		* `remote.workspaceFiles.changes(sessionId, path, signal)` 在 0.2.0 是**目标定向**的：
		* 一个目标（文件或目录）一条流。宿主侧 `WorkspaceChangeFeed.follow()` → `ctx.fs.watch()` 是
		* **OS 监视**（`dsh-fs-local` 用 chokidar，`depth: 0`）⇒
		*   · 任何写入者都会产生帧：`dsh-tool-fs` 的 write/edit、会话里的 `pwsh`、外部编辑器保存、
		*     原子替换（tmp + rename）——**工单 01 在 0.1.5 上测到的"只有 tool-fs 写入才发帧"在 0.2.0 已不成立**；
		*   · 覆盖面 = **被订阅目标的直接子项**（两层深的写入不发帧）⇒ 必须**逐个桶目录订阅**，
		*     只订阅功能根是看不见 `gdd\` 里的写入的；
		*   · 一次原子替换会产生**两条**帧（目录一条、文件一条）⇒ 必须去抖合批，不能一帧一读。
		*
		* 由此得出面板能承诺什么、不能承诺什么（报告里逐字写清，这里不重复）。
		*/
		/** 解析一帧。**认不出来就返回 null** —— 不猜、不假装。 */
		function parseFrame(raw) {
			const f = raw;
			if (!f || typeof f !== "object") return null;
			if (f.kind === "ready") return { kind: "ready" };
			if (f.kind === "change" && f.change && typeof f.change.absolutePath === "string") {
				const c = f.change;
				return {
					kind: "change",
					change: {
						path: c.absolutePath,
						version: typeof c.version === "string" ? c.version : "",
						absent: c.absent === true
					}
				};
			}
			return null;
		}
		/**
		* 订阅计划。
		* ★ 目录要**逐个**给（`depth: 0` 的覆盖语义）：功能根 + 各桶 + 各桶下面那一层。
		*   只给功能根 = 看不见 `gdd\` 里的写入 —— 那是实测出来的，不是推测。
		* ★ 文件目标 = 当前正在看的那一个文件（详情里的最终版）。它在被订阅的目录里时是
		*   **冗余但有用**：内容变了能给一条只属于它的帧，且它带 version ⇒ 自激防护就靠它。
		*/
		function watchPlan(opts) {
			const o = opts || {};
			const root = String(o.root || "").replace(/[\\/]+$/, "");
			const max = Math.max(1, Math.trunc(Number(o.max) || 14));
			const seen = /* @__PURE__ */ new Set();
			const cands = [];
			const push = (p) => {
				const s = String(p || "").replace(/[\\/]+$/, "");
				if (s === "") return;
				const k = normPath(s);
				if (seen.has(k)) return;
				seen.add(k);
				cands.push(s);
			};
			const under = (d) => {
				const rel = String(d || "").replace(/^[\\/]+/, "").replace(/[\\/]/g, "\\");
				if (rel === "") return "";
				return root === "" ? rel : root + "\\" + rel;
			};
			const file = String(o.file || "").replace(/[\\/]+$/, "");
			if (root !== "") push(root);
			if (file !== "") push(file);
			for (const d of o.dirs || []) push(under(d));
			for (const d of o.nested || []) push(under(d));
			const targets = cands.slice(0, max);
			const dropped = cands.slice(max);
			return {
				dirs: targets.filter((p) => !(file !== "" && normPath(p) === normPath(file))),
				file: file !== "" && targets.some((p) => normPath(p) === normPath(file)) ? file : "",
				targets,
				dropped
			};
		}
		/** 全部部件（手动刷新用） */
		const RELOAD_PARTS = [
			"board",
			"detail",
			"ledger",
			"brain",
			"final",
			"ui",
			"draft"
		];
		/** 功能根下的七个固定桶（与 `DIR_BUCKET` 同源；这里只用来判断"改动落在哪个桶"） */
		const BUCKETS = [
			"analysis",
			"gdd",
			"decisions",
			"evidence",
			"source",
			"delivery"
		];
		/** 相对功能根的第一段（小写）；`""` = 就是功能根本身 */
		function firstSeg(rel) {
			const i = rel.indexOf("\\");
			return (i < 0 ? rel : rel.slice(0, i)).toLowerCase();
		}
		/** 相对段数（`""` → 0） */
		function depthOf(rel) {
			if (rel === "") return 0;
			return rel.split("\\").length;
		}
		/**
		* 一条变更 → 要重读哪些部件（**只重读受影响的那几处**）。
		*
		* 判据只有一条：改动落在**哪个桶**里 ⇒ 那个桶参与哪几个部件。
		*   桶                 → 部件
		*   `analysis\`        → detail + brain      （头脑风暴工作面读的就是 analysis）
		*   `decisions\`       → detail + ledger     （决策台账读 decision_*.json）
		*   `evidence\`        → detail + ledger + draft（校准流水在台账里；**读回回执 readback_* 在文档生成工作面里**）
		*   `gdd\`（顶层）     → detail + final + ui + draft（当前定稿 / 界面图 / **成稿与定稿 §6（配置支线）**）
		*   `gdd\<子目录>\`    → detail + ui         （界面图）
		*   其余桶 / 其它     → detail
		*   功能根自己（rel = ""）→ detail + board    （feature.json / 设计台账 / 新增桶会影响卡片）
		*   别的功能 / 工作区外 → board / 忽略
		*
		* ★ 工单 24 加的 `draft`（文档生成工作面：成稿 + 定稿 §6 配置支线 + 读回回执）落在**两个桶**上：
		*   `gdd\`（成稿与定稿都在那儿）与 `evidence\`（`readback_*` 回执在那儿）。
		*   ★ 它**不**跟 `analysis\` 走：这一屏读的是 `gdd\` 里的成稿，不是 `analysis\` 里的分析产物 ——
		*     多挂一个桶 = 别人改一份分析产物就把这一屏也重读一遍，那是白读。
		*/
		function planReload(notice, scope) {
			const c = scope || {};
			const root = String(c.root || "").replace(/\\+$/, "");
			const p = String(notice && notice.path || "").replace(/\\+$/, "");
			if (root === "" || p === "") return {
				parts: [],
				reason: "拿不到功能根或路径，忽略"
			};
			const gone = !!(notice && notice.absent);
			if (!containsPath(root, p)) {
				const srWs = String(c.srWs || "").replace(/\\+$/, "");
				if (srWs !== "" && containsPath(srWs + "\\features", p)) return {
					parts: ["board"],
					reason: gone ? "别的功能里少了东西（看板计数会变）" : "别的功能被改动（看板计数会变）"
				};
				return {
					parts: [],
					reason: "不在 SR 工作区里，忽略"
				};
			}
			const rel = normPath(p) === normPath(root) ? "" : normPath(p).slice(normPath(root).length + 1);
			const suffix = gone ? "（目标已不在）" : "";
			if (rel === "") return {
				parts: ["detail", "board"],
				reason: "功能根的直接子项变了（产物桶 / 身份文件 / 台账）" + suffix
			};
			const seg = firstSeg(rel);
			const depth = depthOf(rel);
			if (seg === "analysis") return {
				parts: ["detail", "brain"],
				reason: "analysis 桶变了（头脑风暴工作面的来源）" + suffix
			};
			if (seg === "decisions") return {
				parts: ["detail", "ledger"],
				reason: seg + " 桶变了（决策台账的来源）" + suffix
			};
			if (seg === "evidence") return {
				parts: [
					"detail",
					"ledger",
					"draft"
				],
				reason: seg + " 桶变了（决策台账 + 文档生成工作面的读回回执）" + suffix
			};
			if (seg === "gdd") {
				if (depth <= 2) return {
					parts: [
						"detail",
						"final",
						"ui",
						"draft"
					],
					reason: "gdd 顶层变了（当前定稿 / 成稿 / 界面图都从这儿来）" + suffix
				};
				return {
					parts: ["detail", "ui"],
					reason: "gdd 里的子目录变了（界面图）" + suffix
				};
			}
			if (BUCKETS.indexOf(seg) >= 0) return {
				parts: ["detail"],
				reason: seg + " 桶变了（只影响产物清单）" + suffix
			};
			return {
				parts: ["detail"],
				reason: "功能目录里的其它改动" + suffix
			};
		}
		/** 一批变更 → 部件的**并集**（保持 `RELOAD_PARTS` 的稳定顺序，方便断言与显示） */
		function unionParts(plans) {
			const has = {};
			for (const pl of plans || []) for (const p of pl && pl.parts || []) has[p] = true;
			return RELOAD_PARTS.filter((p) => has[p]);
		}
		/**
		* 这一帧值不值得重读。
		*
		* ★ **目录目标永不按版本去重** —— DSH 的原话：目录消费者"每一次帧都要重列，
		*   因为**子项的元数据变了而目录版本可以不变**"（`types.d.ts` 的 `WorkspaceFileChange` 注释）。
		*   按版本去重目录 = 后续所有"改已有文件内容"的写入都静默看不见。
		* ★ **文件目标按版本去重**（这就是自激防护）：帧里的 `version` 等于我们**已经读到的**那个版本
		*   ⇒ 这次重读学不到任何新东西 ⇒ 丢掉。（官方 `provider.js` 也是这么做的：
		*   "holding this version already means the consumer learns nothing new"。）
		*/
		function acceptFrame(frame, st) {
			const s = st || {};
			const p = String(frame && frame.path || "").replace(/\\+$/, "");
			if (p === "") return {
				accept: false,
				reason: "帧里没有路径"
			};
			const key = normPath(p);
			const applied = s.applied || {};
			const file = String(s.file || "");
			if (!(file !== "" && normPath(file) === key)) return {
				accept: true,
				reason: "目录目标：每次重列（子项内容变了目录版本可能不变）"
			};
			const known = applied[key];
			if (frame && frame.absent) return known === void 0 ? {
				accept: false,
				reason: "这个文件本来就没有（读不到，不必重读）"
			} : {
				accept: true,
				reason: "当前这个文件没了"
			};
			const v = typeof frame.version === "string" ? frame.version : "";
			if (v === "") return {
				accept: true,
				reason: "帧里没有 version（照读一次）"
			};
			if (known !== void 0 && known === v) return {
				accept: false,
				reason: "版本没变（= 自激防护：读完自己又收到同一版本）"
			};
			return {
				accept: true,
				reason: known === void 0 ? "第一次见到这个文件" : "当前这个文件的版本变了"
			};
		}
		/** FNV-1a 32 位（无符号） */
		function fnv1a(s) {
			let h = 2166136261;
			for (let i = 0; i < s.length; i++) {
				h ^= s.charCodeAt(i);
				h = h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24) >>> 0;
			}
			return h >>> 0;
		}
		/**
		* 版本指纹：路径 → version 的有序哈希。
		*
		* ★ `version` 是宿主的不透明新鲜度串（`dev:ino:size:mtime:ctime` 那种形状），**不解析**，
		*   只当"这两个东西是不是同一份内容"的判据 —— 与 `WorkspaceFileStat.version` 的口径一致。
		* ★ 传了 `paths`（= 面板正在展示的那份产物清单）就只统计清单里的文件：
		*   指纹只覆盖"屏幕上有的东西"，换个页签多读几个文件不会把指纹搅乱。
		*/
		function fingerprintOf(applied, paths) {
			const all = applied || {};
			let keys;
			let total;
			let list = null;
			if (paths && paths.length) {
				list = paths;
				const seen = {};
				keys = [];
				for (const p of paths) {
					const k = normPath(p);
					if (k === "" || seen[k]) continue;
					seen[k] = true;
					if (typeof all[k] === "string" && all[k] !== "") keys.push(k);
				}
				total = Object.keys(seen).length;
			} else {
				keys = Object.keys(all).filter((k) => typeof all[k] === "string" && all[k] !== "");
				total = keys.length;
			}
			keys.sort();
			let acc = "";
			for (const k of keys) acc += k + "	" + all[k] + "\n";
			const missing = [];
			if (list) {
				const have = {};
				for (const k of keys) have[k] = true;
				for (const p of list) {
					const k = normPath(p);
					if (k !== "" && !have[k] && missing.length < 12) missing.push(String(p));
				}
			}
			return {
				digest: keys.length ? ("00000000" + fnv1a(acc).toString(16)).slice(-8) : "",
				known: keys.length,
				total,
				missing
			};
		}
		/** 指纹短串（展示用；拿不到就是 `——`） */
		function shortDigest(d) {
			const s = String(d || "");
			return s === "" ? "——" : s;
		}
		/**
		* "面板现在展示的是不是最新"（一眼能看出的那一句）。
		* `pending` = 已收到但**还没并进屏幕**的变更条数（按路径去重后的批大小）。
		*/
		function freshnessOf(o) {
			const phase = String(o && o.phase || "off");
			const pending = Math.max(0, Math.trunc(Number(o && o.pending) || 0));
			const digest = String(o && o.digest || "");
			if (phase === "down") {
				const why = String(o && o.reason || "").trim();
				return {
					state: "down",
					text: "变更订阅不可用" + (why ? "：" + why : "") + " —— 面板**不会**自动跟随；点「刷新」或按 F5",
					pending,
					digest
				};
			}
			if (phase === "off" || phase === "idle") return {
				state: "off",
				text: "未订阅变更（不在功能里）",
				pending,
				digest
			};
			if (pending > 0) return {
				state: "stale",
				text: "有 " + pending + " 处新变化，正在重读…",
				pending,
				digest
			};
			if (digest === "") return {
				state: "unknown",
				text: "指纹待建立（还没有读到内容）",
				pending,
				digest
			};
			return {
				state: "fresh",
				text: "已是最新",
				pending,
				digest
			};
		}
		/**
		* 现在该不该落一次重读。
		* ★ 一次原子替换会产生两条帧（目录 + 文件），连续保存会产生很多条；
		*   合批 = 只用一轮重读覆盖这一批，界面既不闪也不重复读盘。
		*/
		function shouldFlush(batch, now, opts) {
			const b = batch || {};
			const quiet = Math.max(0, Math.trunc(Number((opts && opts.quietMs) ?? 300)));
			const maxWait = Math.max(quiet, Math.trunc(Number((opts && opts.maxWaitMs) ?? 1500)));
			const first = Number(b.firstAt) || 0;
			const last = Number(b.lastAt) || 0;
			if (first === 0) return false;
			if (now - last >= quiet) return true;
			return now - first >= maxWait;
		}
		/**
		* stat 核对（切回面板 / 切功能 / 切页签 / 低频轮询的**正确性底线**）：
		* 返回"与屏幕上那份不一致"的路径 —— 空数组 = 屏幕上就是最新的。
		* ★ 这里**只看版本**：帧通道可能不可用（或漏了），这条是兜底；也不依赖帧里的 version。
		*/
		function stalePaths(applied, current) {
			const a = applied || {};
			const c = current || {};
			const out = [];
			for (const raw of Object.keys(c)) {
				const k = normPath(raw);
				const v = c[raw];
				if (typeof v !== "string" || v === "") continue;
				if (a[k] !== v) out.push(raw);
			}
			return out.sort();
		}
		/** 批量合并两个 路径 → version 表（`put` 赢；用于把读到的版本并进"已应用"） */
		function mergeApplied(applied, add) {
			const out = {};
			for (const k of Object.keys(applied || {})) out[k] = applied[k];
			for (const raw of Object.keys(add || {})) {
				const v = add[raw];
				if (typeof v !== "string" || v === "") continue;
				out[normPath(raw)] = v;
			}
			return out;
		}
		//#endregion
		//#region src/client.js
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
		const h = react.createElement;
		/**
		* DSH 的静态 UI 库（`@deepseek-ai/dsh-client-ui-primitives`）在外壳播种的**冻结模块表**里，
		* 可以直接 require —— 不需要改 package.json、不需要重启。
		* ★ 但取不到时**不能让插件挂掉**：整块降级成 <pre> 纯文本渲染。
		*/
		let primitives = null;
		try {
			primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		} catch (e) {
			primitives = null;
		}
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
		/** 二进制 → base64（分块，避免 String.fromCharCode.apply 在大文件上爆栈） */
		function bytesToBase64(bytes) {
			const CH = 32768;
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
				fr.onerror = () => reject(/* @__PURE__ */ new Error("读取文件失败"));
				fr.onload = () => {
					const buf = fr.result;
					if (cap && buf.byteLength > cap) {
						reject(/* @__PURE__ */ new Error("文件超过 " + Math.round(cap / 1024) + " KB 上限"));
						return;
					}
					resolve(new Uint8Array(buf));
				};
				fr.readAsArrayBuffer(file);
			});
		}
		/** 读文件文本（浏览器能读就内联，省掉 agent 再读一次盘） */
		function readFileText(file, cap) {
			return new Promise((resolve, reject) => {
				const fr = new FileReader();
				fr.onerror = () => reject(/* @__PURE__ */ new Error("读取文件失败"));
				fr.onload = () => resolve(String(fr.result || "").slice(0, cap || 2e5));
				fr.readAsText(file);
			});
		}
		/** 面板 id：main keyed slot 与 sidebar.panellist 用同一个 id 关联 */
		const PANEL_ID = "sr-workbench";
		/** sr 工作区与配置表目录，相对会话 workspace 根 */
		const SR_WS = "GameDesignOS/workspace";
		const CONFIG_DIR = "planner/策划配置";
		const DIR_BUCKET = {
			analysis: "analysis",
			gdd: "gdd",
			decisions: "decisions",
			evidence: "evidence",
			source: "source",
			delivery: "delivery"
		};
		/** 桶 → byTopic 里的数组字段名（没有字段的进 others） */
		const BUCKET_FIELD = {
			final: "finals",
			review: "reviews",
			speech: "speeches",
			analysis: "concept",
			evidence: "evidence",
			decisions: "decisions",
			source: "source",
			draft: "drafts",
			gdd: "drafts"
		};
		/** 旧结构：文件名前缀 → 桶。sr-* 各 skill 的产出全在这里 */
		const PREFIX_BUCKET = [
			["concept-triage_", "analysis"],
			["feature-concept_", "analysis"],
			["experience-report_", "analysis"],
			["issue-cards_", "analysis"],
			["replication-spec_", "analysis"],
			["sr-gdd-handoff_", "analysis"],
			["evidence-index_", "evidence"],
			["calibration_", "evidence"],
			["readback_", "evidence"],
			["decision_", "decisions"],
			["smoke_", "others"],
			["write_CS-", "others"]
		];
		/** 文件名 → 产物桶。**旧结构用**；新结构的 gdd\ 子目录里也要再细分，所以也会用到 */
		function artifactBucket(name) {
			const n = String(name || "");
			if (!n) return "others";
			if (/_定稿\.md$/i.test(n)) return "final";
			if (/_定稿_审查\.md$/i.test(n) || /_审查\.md$/i.test(n)) return "review";
			if (/_宣讲_.*\.html$/i.test(n)) return "speech";
			if (/_宣讲_.*\.content\.json$/i.test(n)) return "speechSrc";
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
			for (const extra of extraPaths || []) if (extra) cands.push(extra);
			cands.push(".agents/skills/sr-askme/config.local.json");
			for (const p of cands) {
				const text = await readAllText(read, sid, p, signal, 200);
				if (!text) continue;
				try {
					const cfg = JSON.parse(text);
					if (cfg && cfg.sr_workspace) return {
						srWs: String(cfg.sr_workspace).replace(/[\\/]+$/, ""),
						configRoot: String(cfg.config_root || "").replace(/[\\/]+$/, ""),
						skillsRoot: p.replace(/[\\/]sr-askme[\\/]config\.local\.json$/i, ""),
						configFile: p
					};
				} catch (e) {}
			}
			return {
				srWs: "",
				configRoot: "",
				configFile: "(未找到 sr 配置)"
			};
		}
		/** 从各种目录列举返回值里取出文件名 */
		function fileNamesOf(v) {
			return (v && (v.entries || v.children || v.items) || []).filter((x) => {
				const k = x && (x.type || x.kind);
				return k === "file" || k === void 0;
			}).map((x) => x.name).filter((n) => typeof n === "string" && n.length > 0);
		}
		/** 只取**子目录**名（fileNamesOf 只取文件，两者互补） */
		function dirNamesOf(v) {
			return (v && (v.entries || v.children || v.items) || []).filter((x) => x && (x.type === "directory" || x.kind === "directory")).map((x) => x.name).filter((n) => typeof n === "string" && n.length > 0);
		}
		/** 列子目录：与 listDir 同两条通道，但取目录 */
		async function listDirs(ctx, sid, absPath, signal, optional) {
			const ns = ctx && ctx.remote || {};
			if (ns.workspaceFiles && typeof ns.workspaceFiles.list === "function") try {
				const r = await ns.workspaceFiles.list(sid, absPath, signal);
				if (r && r.ok === true) return dirNamesOf(r.value);
			} catch (e) {}
			if (ns.workspace && typeof ns.workspace.list === "function") try {
				const r = await ns.workspace.list(absPath, signal);
				if (r && r.ok === true) return dirNamesOf(r.value);
			} catch (e) {}
			if (optional) return [];
			throw new Error("无法列举目录：" + absPath);
		}
		/**
		* 列一层目录的**原始条目**（文件与子目录都要）。
		* ★ 工单 12 新增：产物清单必须同时看到"文件"与"子目录"（`gdd\UI\`、`evidence\frames\`），
		*   而 listDir / listDirs 各自只取一半。条目形状照 `WorkspacePort` 的 `ListResult`。
		*/
		async function listEntries(ctx, sid, absPath, signal) {
			const ns = ctx && ctx.remote || {};
			const norm = (v) => {
				return {
					entries: (v && (v.entries || v.children || v.items) || []).map((x) => {
						const k = x && (x.type || x.kind);
						return {
							name: x && x.name,
							type: k === "directory" ? "directory" : k === void 0 ? "unknown" : k
						};
					}).filter((x) => typeof x.name === "string" && x.name.length > 0),
					truncated: !!(v && v.truncated)
				};
			};
			if (ns.workspaceFiles && typeof ns.workspaceFiles.list === "function") try {
				const r = await ns.workspaceFiles.list(sid, absPath, signal);
				if (r && r.ok === true) return norm(r.value);
			} catch (e) {}
			if (ns.workspace && typeof ns.workspace.list === "function") try {
				const r = await ns.workspace.list(absPath, signal);
				if (r && r.ok === true) return norm(r.value);
			} catch (e) {}
			throw new Error("无法列举目录：" + absPath);
		}
		/**
		* `workspaceFiles.list` 被 host 圈定在**会话 cwd** 之内（见 `listDir` 的注释），
		* 而面板的索引会话 cwd = SR 工作区根 —— 所以 SR 工作区**之外**的目录
		* （本机就是 `config_root` = `D:\TimeMachine\planner\策划配置`）要另借一条只读会话来列。
		* 这个变量就是那条会话的 id（由 `resolveIndexSession` 每次解析时刷新；空 = 借不到）。
		*/
		let LIST_SID = "";
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
						throw new Error("读不到文件：" + (e && (e.message || e.code) || path));
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
					const wf = (ctx && ctx.remote || {}).workspaceFiles;
					if (!wf || typeof wf.stat !== "function") throw new Error("remote.workspaceFiles.stat 不可用");
					const r = await wf.stat(sid, absPath, signal);
					if (!r || r.ok !== true) {
						const e = r && r.error;
						throw new Error("取不到文件版本：" + (e && (e.message || e.code) || absPath));
					}
					return r.value;
				}
			};
		}
		/**
		* 目录列举：三条通道依次试。
		*   ① workspaceFiles.list(sessionId, path) —— 会话端口，**仅当该目录在该会话的 cwd 之内**才可列
		*      （host：`workspaceRoot = header.cwd ?? sandboxPolicy.workspaceRoot`，
		*       `dsh-api-workspace-files/lib/index.js:411` / `:500`；越界报 `workspace-file/outside-workspace`）
		*   ①' workspaceFiles.list(LIST_SID, path) —— **借来的只读会话**，只为列 SR 工作区**之外**的目录
		*      （`config_root` 就是这种；工单 07 把索引会话的 cwd 收紧到 SR 根之后才需要这一刀，
		*       它是**列举**的兜底，不是认领：见 `pickListingSession`）
		*   ② workspace.list(path) —— 工作区无关端口（**本机 0.2.0 没有这个方法**：`workspace` 命名空间
		*      只有 archiveSession/create/delete/follow/… 没有 list，所以这一条按"有就用"处理）
		*/
		async function listDir(ctx, sid, absPath, signal, optional) {
			const ns = ctx && ctx.remote || {};
			if (ns.workspaceFiles && typeof ns.workspaceFiles.list === "function") {
				const sids = [sid];
				if (LIST_SID && LIST_SID !== sid) sids.push(LIST_SID);
				for (const one of sids) try {
					const r = await ns.workspaceFiles.list(one, absPath, signal);
					if (r && r.ok === true) return fileNamesOf(r.value);
				} catch (e) {}
			}
			if (ns.workspace && typeof ns.workspace.list === "function") try {
				const r = await ns.workspace.list(absPath, signal);
				if (r && r.ok === true) return fileNamesOf(r.value);
			} catch (e) {}
			if (optional) return [];
			throw new Error("无法列举目录：" + absPath);
		}
		async function readHead(read, sid, path, signal) {
			try {
				const r = await read(sid, path, {
					offset: 1,
					limit: 14
				}, signal);
				if (!r || r.ok !== true) return null;
				return r.value.text;
			} catch (e) {
				return null;
			}
		}
		/** 分页读完整文本（read 按行分页，maxLines 默认 5000） */
		async function readAllText(read, sid, path, signal, capLines) {
			const cap = capLines || 2e4;
			let offset = 1, out = [], guard = 0;
			while (guard++ < 40) {
				let r;
				try {
					r = await read(sid, path, {
						offset,
						limit: 2e3
					}, signal);
				} catch (e) {
					return null;
				}
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
				const text = await readAllText(read, sid, p, signal, 2e3);
				if (!text) continue;
				try {
					return JSON.parse(text);
				} catch (e) {}
			}
			return null;
		}
		/**
		* 按 schema 校验一条决策记录（JSON Schema 的实用子集：
		* required / enum / const / pattern / minItems / 数组元素 pattern / additionalProperties）
		*/
		function validateDecision(doc, schema) {
			const issues = [];
			const push = (field, value, rule) => issues.push({
				field,
				value,
				rule
			});
			if (!schema) return issues;
			const P = schema.properties || {};
			for (const k of schema.required || []) if (doc[k] === void 0) push(k, "(缺失)", "必填字段缺失");
			for (const k of Object.keys(P)) {
				const spec = P[k];
				const v = doc[k];
				if (v === void 0) continue;
				if (spec.const !== void 0 && v !== spec.const) push(k, JSON.stringify(v), "必须为 " + JSON.stringify(spec.const));
				if (spec.enum && spec.enum.indexOf(v) < 0) push(k, JSON.stringify(v), "枚举外 · 合法值：" + spec.enum.join(" / "));
				if (spec.pattern && typeof v === "string" && !new RegExp(spec.pattern).test(v)) push(k, JSON.stringify(v), "不匹配 " + spec.pattern);
				if (spec.minItems !== void 0 && Array.isArray(v) && v.length < spec.minItems) push(k, v.length + " 条", "少于下限 minItems: " + spec.minItems);
				const itemPat = spec.items && spec.items.pattern;
				if (itemPat && Array.isArray(v)) {
					for (const item of v) if (typeof item === "string" && !new RegExp(itemPat).test(item)) push(k, JSON.stringify(item), "元素不匹配 " + itemPat);
				}
			}
			if (schema.additionalProperties === false) {
				for (const k of Object.keys(doc)) if (!P[k]) push(k, JSON.stringify(doc[k]).slice(0, 40), "schema 未声明的字段（additionalProperties: false）");
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
			const mine = (await listDir(ctx, sid, dir, signal, true)).filter((n) => /^decision_.*\.json$/i.test(n));
			const schema = await loadDecisionSchema(read, sid, skillsRoot, signal);
			const records = [];
			for (const n of mine.slice().sort().reverse()) {
				const text = await readAllText(read, sid, dir + "/" + n, signal, 2e3);
				let doc = null, parseErr = null;
				try {
					doc = JSON.parse(text);
				} catch (e) {
					parseErr = String(e && e.message || e);
				}
				records.push({
					file: n,
					doc,
					parseErr,
					issues: doc ? validateDecision(doc, schema) : []
				});
			}
			const calFiles = (await listDir(ctx, sid, root + "/evidence", signal, true)).filter((n) => /^calibration_.*\.jsonl$/i.test(n));
			const calibration = [];
			for (const n of calFiles) {
				const text = await readAllText(read, sid, root + "/evidence/" + n, signal, 2e3);
				if (!text) continue;
				for (const line of text.split(/\r?\n/)) {
					const s = line.trim();
					if (!s) continue;
					try {
						calibration.push({
							file: n,
							row: JSON.parse(s)
						});
					} catch (e) {}
				}
			}
			const an = await listDir(ctx, sid, root + "/analysis", signal, true);
			const handoffs = [];
			for (const n of an.filter((x) => /^sr-gdd-handoff_.*\.json$/i.test(x))) {
				const text = await readAllText(read, sid, root + "/analysis/" + n, signal, 2e3);
				if (text) handoffs.push({
					name: n,
					text
				});
			}
			return {
				records,
				schema,
				schemaOk: !!schema,
				calibration,
				calFiles,
				handoffs
			};
		}
		/** 从 loadLedger 的产物派生设计台账 —— 实现与理由见 `src/pure/ledger.ts` 的 `ledgerOf`（工单 32 接线） */
		/** 扫工作区 → 功能列表 */
		async function loadDashboard(ctx, read, sid, cwd, configPath, signal, extraPaths) {
			const P = await loadSrPaths(read, sid, configPath, signal, extraPaths);
			const srWs = P.srWs || SR_WS;
			const cfgDir = P.configRoot || CONFIG_DIR;
			if (!P.srWs) {
				const rel = await loadDashboardInner(ctx, read, sid, SR_WS, CONFIG_DIR, signal);
				rel.pathNote = "未读到 sr 配置（试过 " + P.configFile + "），已退回相对路径 GameDesignOS/workspace";
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
			const [featDirs, configNames] = await Promise.all([listDirs(ctx, sid, srWs + "/features", signal, true), listDir(ctx, sid, cfgDir, signal, true)]);
			const feats = [];
			for (const t of featDirs) {
				if (isNoise(t)) continue;
				const root = srWs + "/features/" + t;
				const f = {
					topic: t,
					root,
					ledgerFile: null,
					concept: [],
					drafts: [],
					finals: [],
					reviews: [],
					speeches: [],
					decisions: [],
					evidence: [],
					source: [],
					evPacks: [],
					others: 0
				};
				for (const sub in DIR_BUCKET) {
					const names = await listDir(ctx, sid, root + "/" + sub, signal, true);
					for (const n of names) {
						const bucket = sub === "gdd" ? artifactBucket(n) : DIR_BUCKET[sub];
						const field = BUCKET_FIELD[bucket];
						if (field) f[field].push(n);
						else f.others += 1;
					}
				}
				f.ledgerFile = (await listDir(ctx, sid, root, signal, true)).filter((n) => /^设计台账.*\.md$/i.test(n))[0] || null;
				for (const d of await listDirs(ctx, sid, root + "/evidence", signal, true)) {
					const inside = await listDir(ctx, sid, root + "/evidence/" + d, signal, true);
					f.evPacks.push({
						dir: d,
						files: inside.length,
						sample: inside.slice(0, 6)
					});
				}
				feats.push(f);
			}
			let legacyLeft = 0;
			for (const d of [
				"proposals",
				"analysis",
				"decisions",
				"evidence",
				"inbox"
			]) legacyLeft += (await listDir(ctx, sid, srWs + "/" + d, signal, true)).length;
			const configByTopic = /* @__PURE__ */ new Map();
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
				f.finals.sort((a, b) => dateOf(a) < dateOf(b) ? 1 : -1);
				f.reviews.sort().reverse();
				f.decisions.sort().reverse();
				const latest = f.finals[0] || null;
				const finalHeads = await Promise.all(f.finals.map(async (name) => {
					const h = parseFrontmatter(await readHead(read, sid, finalAbs(f, name), signal));
					return {
						name,
						doc_type: h ? h.doc_type : null,
						status: h ? h.status : null
					};
				}));
				const finalCheck = checkFinals(finalHeads);
				const head = finalHeads.length ? finalHeads[0] : null;
				features.push({
					topic: f.topic,
					root: f.root,
					ledgerFile: f.ledgerFile,
					docType: head ? head.doc_type : null,
					status: head ? head.status : null,
					finalCheck,
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
					files: {
						concept: f.concept.slice().sort(),
						draft: f.drafts.slice().sort(),
						final: f.finals.slice(),
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
			features.sort((a, b) => a.latestDate < b.latestDate ? 1 : -1);
			return {
				features,
				legacyLeft,
				counts: {
					features: features.length,
					configs: configNames.length
				},
				srWs,
				configRoot: cfgDir
			};
		}
		const C = {
			ink: "#1a1a1a",
			soft: "#c8c8c8",
			faint: "#e8e8e8",
			panel: "#fff",
			bg: "#fafafa",
			warn: "#b45309",
			bad: "#b91c1c",
			ok: "#15803d",
			muted: "#6b6b6b",
			link: "#2b6cb0"
		};
		function badge(text, tone) {
			const color = tone === "ok" ? C.ok : tone === "warn" ? C.warn : tone === "bad" ? C.bad : C.muted;
			return h("span", {
				key: "b:" + text,
				style: {
					display: "inline-block",
					fontFamily: "monospace",
					fontSize: "10px",
					border: "1px solid " + (tone ? color : C.soft),
					color: tone ? color : C.muted,
					borderRadius: "3px",
					padding: "0 5px",
					marginRight: "4px",
					whiteSpace: "nowrap"
				}
			}, text);
		}
		const STAGE_LABELS = [
			["concept", "概念"],
			["draft", "成稿"],
			["config", "配置"],
			["final", "定稿"],
			["review", "审查"],
			["speech", "宣讲"]
		];
		function Glyph({ size }) {
			return h("span", { style: {
				fontSize: (size === void 0 ? 16 : size) + "px",
				lineHeight: 1,
				fontWeight: 700
			} }, "策");
		}
		/** 阶段进度：六段小徽章，完成的实心 */
		function StageBar(props) {
			const stages = props.stages || {};
			return h("div", { style: {
				display: "flex",
				gap: "3px",
				marginBottom: "7px",
				flexWrap: "wrap"
			} }, STAGE_LABELS.map(([k, label]) => {
				const on = !!stages[k];
				return h("span", {
					key: k,
					style: {
						fontSize: "10px",
						fontFamily: "monospace",
						borderRadius: "3px",
						padding: "1px 5px",
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
			const [hover, setHover] = react.useState(false);
			const clickable = !!f.openPath;
			const finalActive = f.status === "active";
			const waiting = props.attention === "pending";
			const stuck = !f.latestFinal ? "卡在：尚未出定稿" : finalActive ? "已定稿 · 可交程序" : "最终版状态：" + (f.status || "?");
			return h("div", {
				onMouseEnter: () => setHover(true),
				onMouseLeave: () => setHover(false),
				style: {
					border: "1px solid " + (waiting ? C.warn : C.faint),
					borderLeft: "3px solid " + (waiting ? C.warn : finalActive ? C.ok : C.soft),
					borderRadius: "4px",
					padding: "10px 12px",
					background: C.panel,
					minWidth: "250px",
					flex: "1 1 250px"
				}
			}, [
				waiting ? h("div", {
					key: "attn",
					onClick: (e) => {
						e.stopPropagation();
						props.onAttention(f);
					},
					title: "点这里去回答",
					style: {
						margin: "-10px -12px 9px",
						padding: "7px 12px",
						background: C.warn,
						color: "#fff",
						fontSize: "12px",
						fontWeight: 600,
						cursor: "pointer",
						borderRadius: "3px 3px 0 0",
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						gap: "8px"
					}
				}, [h("span", { key: "t" }, "⚠ 等你拍板"), h("span", {
					key: "g",
					style: {
						fontWeight: 400,
						fontSize: "11px",
						opacity: .9
					}
				}, "去回答 ›")]) : null,
				h("div", {
					key: "n",
					style: {
						display: "flex",
						alignItems: "center",
						gap: "6px",
						marginBottom: "6px",
						flexWrap: "wrap"
					}
				}, [h("b", {
					key: "t",
					style: { fontSize: "13px" }
				}, f.topic), f.docType ? badge(f.docType + " / " + (f.status || "?"), finalActive ? "ok" : null) : badge("无定稿", "warn")]),
				h(StageBar, {
					key: "s",
					stages: f.stages
				}),
				h("div", {
					key: "m",
					style: {
						fontSize: "11px",
						color: finalActive ? C.ok : C.muted,
						marginBottom: "5px"
					}
				}, stuck),
				h("div", {
					key: "c",
					style: {
						fontSize: "11px",
						color: C.muted
					}
				}, "定稿 " + f.finals + " · 审查 " + f.reviews + " · 宣讲 " + f.speeches + " · 配置表 " + f.configs.length + " · 决策 " + f.decisions),
				f.latestFinal ? h("div", {
					key: "v",
					style: {
						fontSize: "11px",
						color: C.muted,
						marginTop: "4px",
						borderTop: "1px solid " + C.faint,
						paddingTop: "4px"
					}
				}, [h("span", {
					key: "a",
					style: { fontFamily: "monospace" }
				}, "最终版 " + f.latestDate.slice(0, 4) + "-" + f.latestDate.slice(4, 6) + "-" + f.latestDate.slice(6, 8)), f.historyCount > 0 ? h("span", {
					key: "b",
					style: { color: "#999" }
				}, " · 另有 " + f.historyCount + " 个历史版本") : null]) : null,
				h("div", {
					key: "o",
					style: {
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						marginTop: "6px",
						gap: "8px",
						borderTop: "1px solid " + C.faint,
						paddingTop: "5px"
					}
				}, [clickable ? h("button", {
					key: "lnk",
					type: "button",
					onClick: () => onOpen(f),
					title: "点击打开：" + f.openPath,
					style: {
						font: "inherit",
						fontSize: "11px",
						fontFamily: "monospace",
						padding: 0,
						border: "none",
						background: "none",
						color: hover ? C.link : "#3b6ea5",
						cursor: "pointer",
						textDecoration: hover ? "underline" : "none",
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
						maxWidth: "175px"
					}
				}, "📄 " + f.latestFinal) : h("span", {
					key: "none",
					style: {
						fontSize: "11px",
						color: "#bbb"
					}
				}, "（无可打开文件）"), h("button", {
					key: "d",
					type: "button",
					onClick: () => props.onDetail(f),
					style: {
						font: "inherit",
						fontSize: "10px",
						padding: "1px 7px",
						border: "1px solid " + C.soft,
						background: "#fff",
						borderRadius: "3px",
						cursor: "pointer",
						color: C.ink,
						whiteSpace: "nowrap"
					}
				}, "详情 ›")])
			]);
		}
		/** 打开结果提示（成功/失败/诊断都显示在面板上，不藏 console） */
		function NoticeBar(props) {
			const n = props.notice;
			if (!n) return null;
			const isErr = n.kind === "err";
			return h("div", { style: {
				border: "1px solid " + (isErr ? C.bad : C.faint),
				borderLeft: "3px solid " + (isErr ? C.bad : n.kind === "ok" ? C.ok : C.soft),
				background: "#fff",
				borderRadius: "4px",
				padding: "8px 11px",
				fontSize: "12px",
				marginBottom: "12px",
				color: isErr ? C.bad : n.kind === "ok" ? C.ok : C.muted
			} }, [h("div", {
				key: "t",
				style: {
					wordBreak: "break-all",
					lineHeight: 1.7
				}
			}, n.text), n.diag ? h("pre", {
				key: "d",
				style: {
					marginTop: "7px",
					marginBottom: 0,
					padding: "8px",
					fontSize: "11px",
					whiteSpace: "pre-wrap",
					background: C.bg,
					border: "1px solid " + C.faint,
					borderRadius: "3px",
					color: C.ink,
					fontFamily: "monospace",
					lineHeight: 1.65,
					userSelect: "text"
				}
			}, n.diag) : null]);
		}
		function RiskBar(d) {
			const noFinal = d.features.filter((f) => !f.latestFinal).length;
			const multi = d.features.filter((f) => f.historyCount > 0).length;
			const waiting = (d.features || []).filter((f) => d.attentionOf && d.attentionOf(f.topic) === "pending");
			const hasIssue = (f, code) => !!(f.finalCheck && f.finalCheck.issues.some((i) => i.code === code));
			const dupActive = (d.features || []).filter((f) => f.finalCheck && f.finalCheck.actives.length > 1);
			const noActive = (d.features || []).filter((f) => hasIssue(f, "V1b"));
			const unarchived = (d.features || []).filter((f) => hasIssue(f, "V1c"));
			const items = [];
			if (dupActive.length) items.push("⛔ " + dupActive.length + " 个功能有多份 active 定稿：" + dupActive.map((f) => f.topic + "（" + f.finalCheck.actives.length + " 份）").join("、"));
			if (waiting.length) items.push("⚠ " + waiting.length + " 个功能在等你拍板：" + waiting.map((f) => f.topic).join("、"));
			if (noActive.length) items.push(noActive.length + " 个功能没有 active 定稿");
			if (unarchived.length) items.push(unarchived.length + " 个功能的旧定稿未标 archived");
			if (noFinal) items.push("尚未出定稿 " + noFinal + " 个");
			if (multi) items.push("有历史版本的 " + multi + " 个（以最新为最终版）");
			if (!items.length) items.push("未发现待办风险");
			const bad = dupActive.length > 0;
			const warn = bad || noFinal > 0 || waiting.length > 0;
			return h("div", { style: {
				border: "1px solid " + (bad ? C.bad : waiting.length ? C.warn : C.faint),
				borderLeft: "3px solid " + (bad ? C.bad : warn ? C.warn : C.ok),
				background: bad ? "#fef2f2" : waiting.length ? "#fff7ed" : "#fffdf7",
				borderRadius: "4px",
				padding: "9px 12px",
				fontSize: "12px",
				marginBottom: "12px",
				fontWeight: bad || waiting.length ? 600 : 400
			} }, items.join(" · "));
		}
		/** 错误边界：任何渲染异常都显示在面板里，而不是白屏 */
		var PanelErrorBoundary = class extends react.Component {
			constructor(props) {
				super(props);
				this.state = { err: null };
			}
			static getDerivedStateFromError(err) {
				return { err };
			}
			componentDidCatch(err, info) {
				console.error("[sr-workbench] 渲染失败", err, info);
			}
			render() {
				const e = this.state.err;
				if (!e) return this.props.children;
				return h("div", { style: {
					padding: "20px 24px",
					fontFamily: "system-ui, monospace",
					color: C.bad,
					height: "100%",
					overflow: "auto",
					boxSizing: "border-box",
					background: C.bg
				} }, [
					h("h1", {
						key: "t",
						style: {
							fontSize: "16px",
							margin: "0 0 10px",
							color: C.ink
						}
					}, "策划工作台 · 渲染失败"),
					h("div", {
						key: "m",
						style: {
							fontSize: "13px",
							marginBottom: "10px"
						}
					}, String(e && e.message || e)),
					h("pre", {
						key: "s",
						style: {
							fontSize: "11px",
							whiteSpace: "pre-wrap",
							background: "#fff",
							border: "1px solid " + C.faint,
							borderRadius: "4px",
							padding: "10px",
							color: C.muted
						}
					}, String(e && e.stack || "").slice(0, 3e3))
				]);
			}
		};
		const NAV = [
			{
				id: "dashboard",
				label: "功能看板"
			},
			{
				id: "assets",
				label: "设计资产"
			},
			{
				id: "config",
				label: "配置表与多语言",
				soon: true
			},
			{
				id: "knowledge",
				label: "知识库",
				soon: true
			}
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
			{
				id: "brainstorm",
				label: "头脑风暴"
			},
			{
				id: "draft",
				label: "文档生成"
			},
			{
				id: "final",
				label: "定稿修订"
			}
		];
		/** 进功能时落在哪一屏 = **第一个工作面**（工单 23：功能内部先走阶段，再看资料） */
		const ENTRY_TAB = "brainstorm";
		/** 功能详情的**资料页签**（旁挂：过程 / 产物 / 界面图，不是阶段） */
		const DETAIL_TABS = [
			{
				id: "design",
				label: "设计台账"
			},
			{
				id: "ledger",
				label: "决策台账"
			},
			{
				id: "pipeline",
				label: "流水线"
			},
			{
				id: "artifacts",
				label: "产物"
			},
			{
				id: "ui",
				label: "界面图"
			}
		];
		function TabBar(props) {
			return h("div", { style: {
				display: "flex",
				gap: "4px",
				marginBottom: "14px",
				borderBottom: "1px solid " + C.faint,
				paddingBottom: "8px",
				flexWrap: "wrap"
			} }, props.items.map((it) => {
				const on = props.view === it.id;
				const soon = !!it.soon;
				return h("button", {
					key: it.id,
					type: "button",
					disabled: soon,
					onClick: soon ? void 0 : () => props.onPick(it.id),
					style: {
						font: "inherit",
						fontSize: "12px",
						padding: "4px 10px",
						border: "1px solid " + (on ? C.ink : C.faint),
						background: on ? C.ink : "transparent",
						color: soon ? "#c0c0c0" : on ? "#fff" : C.ink,
						borderRadius: "4px",
						cursor: soon ? "default" : "pointer"
					}
				}, it.label + (soon ? " · 未实现" : ""));
			}));
		}
		const TH = {
			border: "1px solid " + C.faint,
			background: "#f7f7f7",
			padding: "5px 7px",
			textAlign: "left",
			fontSize: "11px",
			fontWeight: 600
		};
		const TD = {
			border: "1px solid " + C.faint,
			padding: "5px 7px",
			verticalAlign: "top",
			fontSize: "11px"
		};
		function IssueTable(issues) {
			return h("table", { style: {
				width: "100%",
				borderCollapse: "collapse",
				marginTop: "6px"
			} }, [h("thead", { key: "h" }, h("tr", null, [
				h("th", {
					key: "f",
					style: Object.assign({}, TH, { width: "22%" })
				}, "字段"),
				h("th", {
					key: "v",
					style: Object.assign({}, TH, { width: "26%" })
				}, "实际值"),
				h("th", {
					key: "r",
					style: TH
				}, "违反")
			])), h("tbody", { key: "b" }, issues.map((it, i) => h("tr", { key: i }, [
				h("td", {
					key: "f",
					style: Object.assign({}, TD, { fontFamily: "monospace" })
				}, it.field),
				h("td", {
					key: "v",
					style: Object.assign({}, TD, { fontFamily: "monospace" })
				}, String(it.value)),
				h("td", {
					key: "r",
					style: Object.assign({}, TD, { color: C.bad })
				}, it.rule)
			])))]);
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
			return h("div", {
				key: title,
				style: { marginTop: "12px" }
			}, [h("div", {
				key: "t",
				style: {
					fontSize: "11px",
					fontWeight: 600,
					marginBottom: "5px",
					color: C.ink
				}
			}, title), h("div", {
				key: "c",
				style: {
					fontSize: "12px",
					lineHeight: 1.75
				}
			}, content)]);
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
			if (r.chosen) {
				const hit = (doc && Array.isArray(doc.options) ? doc.options : []).filter((o) => o && o.option_id === r.chosen)[0];
				out.push(blk("结论", [
					h("div", {
						key: "id",
						style: {
							fontFamily: "monospace",
							color: C.ok,
							marginBottom: "3px"
						}
					}, String(r.chosen)),
					hit && hit.action ? h("div", { key: "a" }, String(hit.action)) : null,
					hit && hit.expected_benefit ? h("div", {
						key: "b",
						style: {
							color: C.muted,
							fontSize: "11px",
							marginTop: "3px"
						}
					}, "预期收益：" + hit.expected_benefit) : null,
					hit && hit.main_risk ? h("div", {
						key: "c",
						style: {
							color: C.warn,
							fontSize: "11px"
						}
					}, "主要风险：" + hit.main_risk) : null
				]));
			}
			const cond = Array.isArray(r.conditions_completed) ? r.conditions_completed : [];
			if (cond.length) {
				const done = cond.filter((c) => c && c.done).length;
				out.push(blk("条件（已完成 " + done + " / " + cond.length + "）", cond.map((c, i) => h("div", {
					key: i,
					style: { marginBottom: "6px" }
				}, [
					h("span", {
						key: "m",
						style: {
							color: c && c.done ? C.ok : C.warn,
							fontFamily: "monospace"
						}
					}, c && c.done ? "✓ " : "○ "),
					h("span", { key: "i" }, String(c && c.item || "")),
					c && c.note ? h("div", {
						key: "n",
						style: {
							marginLeft: "17px",
							color: C.muted,
							fontSize: "11px"
						}
					}, String(c.note)) : null
				]))));
			}
			const rem = Array.isArray(r.remaining_items) ? r.remaining_items : [];
			if (rem.length) out.push(blk("剩余待办（" + rem.length + "）", rem.map((x, i) => h("div", {
				key: i,
				style: { marginBottom: "3px" }
			}, "· " + String(x && x.item || x)))));
			if (r.files && typeof r.files === "object" && !Array.isArray(r.files)) {
				const LBL = {
					final_gdd: "定稿",
					archived_draft: "已归档成稿",
					final_review: "审查报告",
					config_changed: "改动配置表"
				};
				out.push(blk("涉及文件", Object.keys(r.files).map((k) => h("div", {
					key: k,
					style: { marginBottom: "3px" }
				}, [h("span", {
					key: "k",
					style: { color: C.muted }
				}, (LBL[k] || k) + "："), h("span", {
					key: "v",
					style: { fontFamily: "monospace" }
				}, Array.isArray(r.files[k]) ? r.files[k].join(" · ") : String(r.files[k]))]))));
			}
			if (r.next_step) out.push(blk("下一步", h("div", null, String(r.next_step))));
			const fixes = Array.isArray(r.post_gate_fixes) ? r.post_gate_fixes : [];
			if (fixes.length) out.push(blk("定稿门之后的修改（" + fixes.length + " 条）", fixes.map((x, i) => h("div", {
				key: i,
				style: {
					marginBottom: "7px",
					paddingLeft: "8px",
					borderLeft: "2px solid " + C.faint
				}
			}, [
				h("div", {
					key: "d",
					style: {
						fontFamily: "monospace",
						fontSize: "11px",
						color: C.muted
					}
				}, String(x && x.date || "")),
				h("div", { key: "c" }, String(x && x.change || "")),
				x && Array.isArray(x.sections) && x.sections.length ? h("div", {
					key: "s",
					style: { marginTop: "3px" }
				}, x.sections.map((s, j) => h("span", {
					key: j,
					style: {
						fontSize: "10px",
						fontFamily: "monospace",
						border: "1px solid " + C.faint,
						borderRadius: "3px",
						padding: "0 4px",
						marginRight: "3px",
						color: C.muted
					}
				}, String(s)))) : null
			]))));
			if (!out.length) return h("div", { style: {
				fontSize: "12px",
				color: C.muted
			} }, "（这条记录的 decision_result 没有可读结论）");
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
			const [folded, setFolded] = react.useState({});
			const [showSrc, setShowSrc] = react.useState(false);
			if (!led) return h("p", { style: {
				color: C.muted,
				fontSize: "12px"
			} }, "正在读设计台账…");
			if (led.error) return h("p", { style: {
				color: C.bad,
				fontSize: "12px",
				userSelect: "text"
			} }, "读台账失败：" + led.error);
			if (!led.total) return h("p", { style: {
				color: C.muted,
				fontSize: "12px"
			} }, "台账为空 —— 这个功能还没有决策记录或校准流水。");
			const fmtDate = (d) => d && d.length === 8 ? d.slice(0, 4) + "-" + d.slice(4, 6) + "-" + d.slice(6, 8) : d || "（无日期）";
			const blocks = [];
			for (const st of led.stages) {
				if (!st.count) continue;
				blocks.push(h("div", {
					key: "s" + st.id,
					style: {
						marginTop: blocks.length ? "24px" : "0",
						fontSize: "13px",
						fontWeight: 700,
						color: C.ink,
						paddingBottom: "6px",
						borderBottom: "2px solid " + C.faint
					}
				}, st.name + "（" + st.count + " 条）"));
				for (const day of st.days) {
					const dk = st.id + "|" + day.date;
					const isFolded = !!folded[dk];
					const kids = [h("div", {
						key: "dt",
						onClick: () => {
							const nx = Object.assign({}, folded);
							nx[dk] = !isFolded;
							setFolded(nx);
						},
						style: {
							fontSize: "12px",
							fontWeight: 600,
							color: C.muted,
							marginTop: "12px",
							marginBottom: isFolded ? "0" : "5px",
							cursor: "pointer",
							userSelect: "none"
						}
					}, (isFolded ? "▸ " : "▾ ") + fmtDate(day.date) + "（" + day.items.length + " 条）")];
					if (!isFolded) for (let i = 0; i < day.items.length; i++) kids.push(h("div", {
						key: "i" + i,
						style: {
							fontSize: "12.5px",
							lineHeight: 1.75,
							color: C.ink,
							paddingLeft: "15px",
							marginBottom: "2px",
							userSelect: "text"
						}
					}, "· " + day.items[i].text));
					blocks.push(h("div", { key: "d" + dk }, kids));
				}
			}
			const st2 = led.stats || {
				fromDecision: 0,
				fromJsonl: 0
			};
			blocks.push(h("div", {
				key: "src",
				style: {
					marginTop: "28px",
					paddingTop: "10px",
					borderTop: "1px dashed " + C.faint
				}
			}, [h("div", {
				key: "t",
				onClick: () => setShowSrc(!showSrc),
				style: {
					fontSize: "11px",
					color: C.muted,
					cursor: "pointer",
					userSelect: "none"
				}
			}, (showSrc ? "▾ " : "▸ ") + "来源校验 —— 决策记录汇总 " + st2.fromDecision + " 条 · 校准流水补录 " + st2.fromJsonl + " 条（校验信息，不是台账内容）"), showSrc ? h("div", {
				key: "b",
				style: {
					fontSize: "11px",
					color: C.muted,
					marginTop: "6px",
					lineHeight: 1.75
				}
			}, ["两个源缺一不可：决策记录的 calibrations 是权威汇总，但实测会漏——联盟悬赏的 round 18（把 UI 文案改回）就只在校准 jsonl 里；校准 jsonl 是 Gate 前的实时留痕，收口后归档。", led.notes && led.notes.length ? h("div", {
				key: "n",
				style: {
					marginTop: "4px",
					color: C.warn
				}
			}, led.notes.join("；")) : null]) : null]));
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
			return h("pre", { style: {
				margin: "6px 0",
				padding: "9px 11px",
				background: C.bg,
				border: "1px solid " + C.faint,
				borderRadius: "4px",
				fontSize: "11.5px",
				lineHeight: 1.65,
				fontFamily: "monospace",
				whiteSpace: "pre",
				overflowX: "auto",
				color: C.ink,
				userSelect: "text"
			} }, props.text);
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
			const [bad, setBad] = react.useState(false);
			const abs = props.pathImages && props.pathImages.abs ? props.pathImages.abs(props.src) : void 0;
			const url = abs ? fileUrl(abs) : void 0;
			const canOpen = !!(abs && typeof props.onOpen === "function");
			if (!url || bad) return h("div", { style: {
				fontSize: "11px",
				color: C.muted,
				padding: "7px 10px",
				margin: "6px 0",
				border: "1px dashed " + C.soft,
				borderRadius: "4px",
				background: C.bg,
				userSelect: "text"
			} }, [
				h("div", { key: "t" }, "🖼 " + (props.alt || props.src) + (url ? "（面板内显示失败）" : "（路径没解析出来）")),
				abs ? h("div", {
					key: "p",
					style: {
						fontFamily: "monospace",
						fontSize: "10px",
						marginTop: "2px",
						wordBreak: "break-all"
					}
				}, abs) : null,
				canOpen ? h("button", {
					key: "o",
					type: "button",
					"data-open": abs,
					onClick: () => props.onOpen(abs),
					style: {
						font: "inherit",
						fontSize: "11px",
						marginTop: "6px",
						padding: "3px 10px",
						border: "1px solid " + C.ink,
						background: "#fff",
						borderRadius: "3px",
						cursor: "pointer"
					}
				}, "用默认程序打开") : null
			]);
			return h("img", {
				src: url,
				alt: props.alt || "",
				"data-abs": abs,
				onError: () => setBad(true),
				style: {
					maxWidth: "440px",
					width: "100%",
					display: "block",
					margin: "6px 0",
					border: "1px solid " + C.faint,
					borderRadius: "4px",
					background: "#fff"
				}
			});
		}
		/** 块级错误边界：一块崩了不影响其他块，并且**说出是哪一块崩的** */
		var BlockBoundary = class extends react.Component {
			constructor(props) {
				super(props);
				this.state = { err: null };
			}
			static getDerivedStateFromError(err) {
				return { err };
			}
			componentDidCatch(err) {
				console.error("[sr-workbench] 块渲染失败", this.props.label, err);
			}
			render() {
				if (this.state.err) return h("div", { style: {
					fontSize: "11px",
					color: C.bad,
					padding: "6px 9px",
					margin: "4px 0",
					border: "1px solid " + C.bad,
					borderRadius: "4px",
					background: "#fef2f2",
					userSelect: "text",
					lineHeight: 1.7
				} }, "⚠ 这一块渲染失败 · " + this.props.label + " —— " + String(this.state.err && this.state.err.message || this.state.err));
				return this.props.children;
			}
		};
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
			const [sel, setSel] = react.useState(null);
			const [openGrp, setOpenGrp] = react.useState({});
			const [item, setItem] = react.useState(null);
			const [intent, setIntent] = react.useState("");
			const [sendMsg, setSendMsg] = react.useState(null);
			const bodyRef = react.useRef(null);
			const graph = react.useMemo(() => d && d.blocks ? buildRefGraph(d) : null, [d]);
			const tree = react.useMemo(() => d && d.outline ? buildFinalTree(d, graph) : null, [d, graph]);
			if (!d) return h("p", { style: {
				color: C.muted,
				fontSize: "12px"
			} }, "正在读定稿…");
			if (d.empty) return h("p", { style: {
				color: C.muted,
				fontSize: "12px"
			} }, d.empty);
			if (d.error) return h("p", { style: {
				color: C.bad,
				fontSize: "12px",
				userSelect: "text"
			} }, d.error);
			if (!d.blocks || !d.blocks.length) return h("p", { style: {
				color: C.muted,
				fontSize: "12px"
			} }, "定稿里没解析出章节结构。");
			if (!tree || !tree.counts.chapters) return h("p", { style: {
				color: C.muted,
				fontSize: "12px"
			} }, "定稿里没解析出章节结构。");
			/** 相对路径 → **绝对路径**：按定稿所在目录解析（含空格与中点号也照原样拼，不做转义） */
			const absOf = (v) => {
				if (!v || typeof v !== "string") return void 0;
				if (!/\.(png|jpe?g|gif|webp|svg)$/i.test(v)) return void 0;
				return /^[A-Za-z]:[\\/]/.test(v) || v.charAt(0) === "/" ? v : String(d.dir).replace(/[\\/]+$/, "") + "/" + v;
			};
			const pathImages = {
				abs: absOf,
				resolve: (v) => {
					const a = absOf(v);
					return a ? fileUrl(a) : void 0;
				}
			};
			const goto = (idx) => {
				setSel(idx);
				const box = bodyRef.current;
				if (!box || !box.querySelector || idx < 0) return;
				const el = box.querySelector("[data-blk=\"" + idx + "\"]");
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
			const pick = (o, idx) => {
				setItem(o);
				setSendMsg(null);
				goto(idx);
			};
			const pickItem = (it, grpIdx) => pick({
				ref: it.ref,
				line: it.line,
				text: it.text,
				self: it.line,
				exclude: it.line,
				grain: it.grain,
				note: ""
			}, grpIdx);
			const pickGroup = (g) => {
				const names = g.items.map((x) => x.label);
				pick({
					ref: g.ref,
					line: g.line,
					text: g.text,
					self: g.line,
					exclude: null,
					grain: g.grain,
					note: !g.ref ? "这一组不是引用图的实体（§4 到规则组、§5 到界面组、§6 到行）—— 只能定位，没有影响范围。" : "组内 " + g.items.length + " 条：" + names.slice(0, 14).join(" / ") + (names.length > 14 ? " …" : "")
				}, g.idx);
			};
			const pickChapter = (c) => pick({
				ref: "",
				line: c.line,
				text: c.text,
				self: c.line,
				exclude: null,
				grain: c.grain,
				note: "章不单独引用：改动按条落在组/条目上（§4 到规则组、§5 到界面组+条目、§6 到行、§7 到键、§10 到条目）。"
			}, c.idx);
			const impact = item && item.ref && graph ? impactOf(graph, item.ref, item.exclude) : [];
			const impactArg = impact.filter((h) => h.line !== (item && item.self)).map((h) => ({
				line: h.line,
				where: h.where,
				kind: h.kind || ""
			}));
			const preview = item && item.ref ? buildFixInstruction({
				path: d.path,
				ref: item.ref,
				before: item.text,
				intent: intent.trim(),
				impact: impactArg
			}) : "";
			const send = () => {
				if (!item || !item.ref || !intent.trim() || !props.onFix) return;
				setSendMsg({
					kind: "pending",
					text: "正在发给工作会话…"
				});
				props.onFix({
					path: d.path,
					ref: item.ref,
					before: item.text,
					intent: intent.trim(),
					impact: impactArg,
					root: props.featureRoot || ""
				}).then((r) => setSendMsg(r && r.ok ? {
					kind: "ok",
					text: "已交给工作会话。",
					sid: r.sid || "",
					target: r.target || null,
					healed: !!r.healed,
					queued: !!r.queued,
					note: r.note || ""
				} : {
					kind: "err",
					text: r && (r.message || r.note) || "发送失败",
					next: r && r.next || "再按一次；仍失败就把这条错误发给开发者。",
					sid: r && r.sid || ""
				}), (e) => setSendMsg({
					kind: "err",
					text: String(e && e.message || e),
					next: "再按一次。"
				}));
			};
			/** 跳到某个会话（DSH 自己的 uiWorkspace.openSession）—— 失败也要说话 */
			const jump = (sid) => {
				if (!sid || !props.onOpenSession) {
					setSendMsg((m) => Object.assign({}, m || {}, { jumpErr: "面板拿不到「跳会话」的通道（onOpenSession 没挂上）。" }));
					return;
				}
				const r = props.onOpenSession(sid);
				if (r && r.ok === false) setSendMsg((m) => Object.assign({}, m || {}, { jumpErr: "跳转失败：" + (r.error && (r.error.message || r.error.code) || "未知原因") + "　—— 你可以在左侧列表里按标题找到它。" }));
			};
			const LNUM = {
				fontSize: "9.5px",
				color: C.muted,
				fontFamily: "monospace",
				marginLeft: "6px",
				flex: "0 0 auto"
			};
			const lnum = (line) => h("span", {
				key: "L",
				style: LNUM
			}, "L" + line);
			const toc = [h("div", {
				key: "head",
				style: {
					fontSize: "11px",
					color: C.muted,
					marginBottom: "8px",
					lineHeight: 1.6,
					userSelect: "text"
				}
			}, [h("div", { key: "a" }, d.name + " · " + tree.counts.chapters + " 章 / " + tree.counts.groups + " 组 / " + tree.counts.items + " 个可引用条目"), h("div", { key: "b" }, "点条目 → 出定位卡（条目引用 + 原文 + 影响范围）；组级默认展开、章级默认收起")])];
			const itemRow = (it, grpIdx) => {
				const on = !!item && !!it.ref && item.ref === it.ref && item.line === it.line;
				const dead = !it.ref;
				return h("div", {
					key: "it" + it.line + "-" + (it.ref || it.label),
					onClick: dead ? void 0 : () => pickItem(it, grpIdx),
					title: dead ? it.why || "这一行不可单独引用" : it.ref,
					"data-ref": it.ref || "",
					"data-line": String(it.line),
					style: {
						display: "flex",
						alignItems: "baseline",
						fontSize: "11px",
						cursor: dead ? "default" : "pointer",
						userSelect: "none",
						padding: "1px 4px 1px 22px",
						borderRadius: "3px",
						color: dead ? C.soft : on ? "#fff" : C.muted,
						background: on ? C.link : "transparent",
						fontWeight: on ? 600 : 400,
						whiteSpace: "nowrap",
						overflow: "hidden"
					}
				}, [
					h("span", {
						key: "l",
						style: {
							overflow: "hidden",
							textOverflow: "ellipsis"
						}
					}, it.label),
					it.sub ? h("span", {
						key: "s",
						style: {
							color: dead ? C.soft : C.muted,
							marginLeft: "5px",
							fontSize: "10px"
						}
					}, it.sub) : null,
					h("span", {
						key: "sp",
						style: { flex: "1 1 auto" }
					}, ""),
					lnum(it.line)
				]);
			};
			for (const c of tree.chapters) {
				const chKey = "ch" + c.no;
				const chOpen = openGrp[chKey] === void 0 ? c.open : !!openGrp[chKey];
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
						display: "flex",
						alignItems: "baseline",
						cursor: "pointer",
						userSelect: "none",
						fontSize: "12px",
						fontWeight: 600,
						margin: "8px 0 3px",
						color: sel === c.idx ? C.link : C.ink
					}
				}, [
					h("span", {
						key: "t",
						style: {
							fontSize: "9px",
							color: C.muted,
							marginRight: "4px",
							width: "9px",
							flex: "0 0 9px",
							textAlign: "center"
						}
					}, c.items.length ? chOpen ? "▾" : "▸" : "·"),
					h("span", { key: "l" }, "§" + c.no + " " + c.title + (!chOpen && cnt.length ? "  (" + cnt.join(" · ") + ")" : "")),
					h("span", {
						key: "sp",
						style: { flex: "1 1 auto" }
					}, ""),
					lnum(c.line)
				]));
				if (chOpen) for (const it of c.items) toc.push(itemRow(it, c.idx));
				for (const g of c.groups) {
					const tag = g.id || g.no || "";
					const gkey = "g" + g.idx;
					const isOpen = openGrp[gkey] === void 0 ? g.open : !!openGrp[gkey];
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
							if (tag) pickGroup(g);
							else goto(g.idx);
						},
						title: g.text,
						"data-group": tag,
						style: {
							display: "flex",
							alignItems: "baseline",
							cursor: "pointer",
							userSelect: "none",
							padding: "2px 0 2px 10px",
							borderRadius: "3px",
							borderLeft: "2px solid " + (sel === g.idx ? C.link : "transparent")
						}
					}, [
						h("span", {
							key: "t",
							style: {
								fontSize: "9px",
								color: C.muted,
								marginRight: "4px",
								width: "9px",
								flex: "0 0 9px",
								textAlign: "center"
							}
						}, g.items.length ? isOpen ? "▾" : "▸" : "·"),
						h("span", {
							key: "l",
							style: {
								fontSize: "11.5px",
								color: sel === g.idx ? C.link : C.muted
							}
						}, (tag ? tag + "  " : "") + g.title + (gc || gs ? "  (" + gc + gs + ")" : "")),
						h("span", {
							key: "sp",
							style: { flex: "1 1 auto" }
						}, ""),
						lnum(g.line)
					]));
					if (isOpen) for (const it of g.items) toc.push(itemRow(it, g.idx));
				}
			}
			const labelOf = (b) => {
				if (b.level === 2) return "§" + b.no + " " + (b.title || "");
				const id = b.id || b.no || "";
				return (b.no && b.chNo && String(b.no).indexOf(String(b.chNo) + ".") === 0 ? "" : "§" + (b.chNo || "?") + " ") + id + " " + (b.title || "");
			};
			/** 边类别标签的颜色：⑥ 契约单独一个醒目的红，其余各有色调（用户能一眼分辨"这条算不算数"） */
			const EDGE_TONE = {
				引用: C.link,
				同族: "#7c3aed",
				归属: "#0f766e",
				验收: C.ok,
				文本: C.warn,
				契约: C.bad
			};
			const edgeTag = (k, label) => h("span", {
				key: "k" + k,
				style: {
					fontSize: "10px",
					fontWeight: label === "契约" ? 700 : 400,
					color: label === "契约" ? "#fff" : EDGE_TONE[label] || C.muted,
					background: label === "契约" ? C.bad : "transparent",
					borderRadius: "3px",
					padding: label === "契约" ? "0 4px" : 0,
					marginRight: "4px",
					flex: "0 0 auto"
				}
			}, "[" + label + "]");
			const card = item ? h("div", {
				key: "card",
				style: {
					border: "1px solid " + C.soft,
					borderLeft: "3px solid " + C.link,
					background: "#f8fbff",
					borderRadius: "4px",
					padding: "9px 11px",
					marginBottom: "10px",
					maxHeight: "42vh",
					overflow: "auto",
					flex: "0 0 auto"
				}
			}, [
				h("div", {
					key: "h",
					style: {
						display: "flex",
						justifyContent: "space-between",
						alignItems: "baseline",
						marginBottom: "3px"
					}
				}, [h("b", {
					key: "r",
					style: {
						fontSize: "12.5px",
						color: C.ink,
						fontFamily: "monospace"
					}
				}, item.ref || "（不可单独引用）"), h("span", {
					key: "x",
					onClick: () => {
						setItem(null);
						setIntent("");
						setSendMsg(null);
					},
					style: {
						fontSize: "11px",
						color: C.muted,
						cursor: "pointer",
						userSelect: "none"
					}
				}, "✕ 取消选择")]),
				h("div", {
					key: "g",
					style: {
						fontSize: "10.5px",
						color: C.muted,
						marginBottom: "6px"
					}
				}, "引用粒度：" + item.grain + (item.note ? "　·　" + item.note : "")),
				h("div", {
					key: "b",
					style: {
						fontSize: "11.5px",
						marginBottom: "7px",
						userSelect: "text"
					}
				}, [h("div", {
					key: "t",
					style: { color: C.muted }
				}, "原文（L" + item.line + "）"), h("div", {
					key: "v",
					style: {
						color: C.ink,
						background: "#fff",
						border: "1px solid " + C.faint,
						borderRadius: "3px",
						padding: "5px 7px",
						marginTop: "3px",
						lineHeight: 1.7
					}
				}, item.text)]),
				h("div", {
					key: "i",
					style: {
						fontSize: "11.5px",
						marginBottom: "7px"
					}
				}, [
					h("div", {
						key: "t",
						style: { color: C.muted }
					}, item.ref ? "影响范围 —— " + impact.length + " 处" + (item.exclude === null && item.self ? "（含它自己那一行 L" + item.self + "）" : "") + "；面板只扫**结构引用**，语义影响由 sr-gdd-fix 的 D11 负责" : "影响范围 —— 无（章不是引用图的实体）"),
					item.ref ? h("div", {
						key: "gz",
						style: {
							fontSize: "10px",
							color: C.muted,
							marginTop: "2px",
							lineHeight: 1.7
						}
					}, "边类别：" + EDGE_LEGEND.join("　")) : null,
					impact.length ? h("div", {
						key: "l",
						style: { marginTop: "3px" }
					}, impact.map((hh, ii) => {
						const lab = edgeLabelOf(graph, item.ref, hh);
						return h("div", {
							key: ii,
							onClick: () => goto(blockIdxOfLine(hh.line)),
							title: "点它跳到正文里这一处",
							style: {
								display: "flex",
								alignItems: "baseline",
								cursor: "pointer",
								color: C.link,
								lineHeight: 1.75,
								userSelect: "text"
							}
						}, [
							edgeTag(ii, lab),
							h("span", {
								key: "L",
								style: {
									fontFamily: "monospace",
									flex: "0 0 auto"
								}
							}, "L" + hh.line + (item.self === hh.line ? "（自身）" : "") + " "),
							h("span", {
								key: "w",
								style: { flex: "0 0 auto" }
							}, hh.where),
							h("span", {
								key: "x",
								style: {
									color: C.muted,
									marginLeft: "6px",
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap"
								}
							}, "—— " + String(hh.text || "").slice(0, 64))
						]);
					})) : h("div", {
						key: "n",
						style: {
							color: C.muted,
							marginTop: "3px"
						}
					}, item.ref ? "· 全文没有其他地方提到它（空集就如实报空，不硬凑关联）" : "· 请选章里的组或条目")
				]),
				preview ? h("div", {
					key: "pv",
					style: {
						fontSize: "11px",
						marginBottom: "7px"
					}
				}, [h("div", {
					key: "t",
					style: { color: C.muted }
				}, "三段式（改哪儿 / 现状原文 / 影响范围）—— 下面这段就是发给工作会话的原文："), h("pre", {
					key: "v",
					style: {
						margin: "3px 0 0",
						padding: "6px 8px",
						background: C.bg,
						border: "1px solid " + C.faint,
						borderRadius: "3px",
						fontFamily: "monospace",
						fontSize: "10.5px",
						lineHeight: 1.6,
						whiteSpace: "pre-wrap",
						color: C.ink,
						userSelect: "text",
						maxHeight: "16vh",
						overflow: "auto"
					}
				}, preview)]) : null,
				h("div", {
					key: "act",
					style: {
						display: "flex",
						gap: "6px",
						alignItems: "center"
					}
				}, [h("input", {
					key: "in",
					value: intent,
					placeholder: "要改成什么（一句话）",
					onChange: (e) => setIntent(e.target.value),
					style: {
						flex: "1 1 auto",
						font: "inherit",
						fontSize: "11.5px",
						padding: "5px 8px",
						border: "1px solid " + C.soft,
						borderRadius: "4px"
					}
				}), h("button", {
					key: "go",
					type: "button",
					disabled: !intent.trim() || !item.ref,
					onClick: send,
					style: {
						font: "inherit",
						fontSize: "11.5px",
						padding: "5px 12px",
						borderRadius: "4px",
						border: "1px solid " + (intent.trim() && item.ref ? C.link : C.soft),
						background: intent.trim() && item.ref ? C.link : "#fff",
						color: intent.trim() && item.ref ? "#fff" : C.muted,
						cursor: intent.trim() && item.ref ? "pointer" : "default"
					}
				}, "发到工作会话")]),
				item.ref && preview ? h("div", {
					key: "tg",
					"data-target": "work-session",
					style: {
						fontSize: "10px",
						color: C.muted,
						marginTop: "5px",
						lineHeight: 1.7,
						userSelect: "text"
					}
				}, "发到：本功能的专属工作会话" + (props.featureRoot ? "（cwd " + winPath(props.featureRoot) + "）" : "") + "　—— 不占用你自己的对话；发出去之后这里会给出「跳到那个会话」。") : null,
				sendMsg ? h("div", {
					key: "m",
					style: {
						fontSize: "11px",
						marginTop: "6px",
						lineHeight: 1.7,
						userSelect: "text",
						color: sendMsg.kind === "err" ? C.bad : sendMsg.kind === "ok" ? C.ok : C.muted
					}
				}, [
					h("div", { key: "t" }, (sendMsg.kind === "ok" ? "✓ " : sendMsg.kind === "err" ? "✗ " : "") + sendMsg.text),
					sendMsg.kind === "ok" ? h("div", {
						key: "d",
						"data-sent": "ok",
						style: {
							color: C.muted,
							userSelect: "text"
						}
					}, [
						"目标：" + (sendMsg.target && sendMsg.target.title || "工作会话") + (sendMsg.sid ? "　会话 " + String(sendMsg.sid).slice(0, 12) + "…" : "") + (sendMsg.target && sendMsg.target.root ? "　cwd " + winPath(sendMsg.target.root) : "") + "　（" + pickSourceText(sendMsg.target && sendMsg.target.source) + "）",
						sendMsg.healed ? h("div", {
							key: "h",
							style: { color: C.warn }
						}, "上一轮记的那条会话已经不在了 —— 已自动重建一条并重发。") : null,
						sendMsg.queued ? h("div", {
							key: "q",
							style: { color: C.warn }
						}, "它正在跑别的活，这条指令排在队列里，等它跑完当前这一轮就会处理。") : null
					]) : null,
					sendMsg.kind === "err" ? h("div", {
						key: "n",
						"data-sent": "fail",
						style: { color: C.ink }
					}, "下一步：" + (sendMsg.next || "再按一次。")) : null,
					sendMsg.sid && props.onOpenSession ? h("button", {
						key: "j",
						type: "button",
						"data-jump": sendMsg.sid,
						onClick: () => jump(sendMsg.sid),
						style: {
							font: "inherit",
							fontSize: "11px",
							padding: "2px 9px",
							marginTop: "3px",
							border: "1px solid " + C.soft,
							background: "#fff",
							borderRadius: "4px",
							cursor: "pointer"
						}
					}, "跳到那个会话 ›") : null,
					sendMsg.jumpErr ? h("div", {
						key: "je",
						style: { color: C.bad }
					}, sendMsg.jumpErr) : null
				]) : null
			]) : null;
			const body = d.blocks.map((b, i) => h("div", {
				key: "b" + i,
				"data-blk": String(i),
				style: {
					padding: "2px 8px 4px 10px",
					marginBottom: "6px",
					borderRadius: "3px",
					borderLeft: "3px solid " + (sel === i ? C.link : "transparent"),
					background: sel === i ? "#f0f7ff" : "transparent"
				}
			}, h(BlockBoundary, {
				key: "bb",
				label: labelOf(b).trim() + "（L" + b.line + "）"
			}, splitSpecial(b.text).map((p, j) => {
				if (p.t === "img") return h(ImgTag, {
					key: "i" + j,
					src: p.v,
					alt: p.alt,
					pathImages,
					onOpen: props.onOpen || null
				});
				if (p.t === "code") return h(CodeBlock, {
					key: "c" + j,
					text: p.v
				});
				return h(Md, {
					key: "m" + j,
					text: p.v,
					pathImages
				});
			}))));
			return h("div", { style: {
				display: "flex",
				gap: "16px",
				alignItems: "flex-start"
			} }, [h("div", {
				key: "toc",
				style: {
					flex: "0 0 272px",
					width: "272px",
					maxHeight: "68vh",
					overflow: "auto",
					borderRight: "1px solid " + C.faint,
					paddingRight: "10px"
				}
			}, toc), h("div", {
				key: "right",
				style: {
					flex: "1 1 auto",
					minWidth: 0,
					display: "flex",
					flexDirection: "column"
				}
			}, [card, h("div", {
				key: "body",
				ref: bodyRef,
				onScroll: onBodyScroll,
				style: {
					flex: "1 1 auto",
					minHeight: 0,
					maxHeight: "68vh",
					overflow: "auto"
				}
			}, body)])]);
		}
		function DecisionLedger(props) {
			const L = props.ledger;
			const [open, setOpen] = react.useState(null);
			if (!L) return h("p", { style: {
				color: C.muted,
				fontSize: "12px"
			} }, "正在读决策台账…");
			const bad = L.records.filter((r) => r.issues.length > 0 || r.parseErr);
			const sel = open === null ? null : L.records[open];
			const d = sel && sel.doc;
			const cov = props.coverage || null;
			return h("div", null, [
				cov ? h("div", {
					key: "cov",
					style: {
						border: "1px solid " + C.faint,
						borderLeft: "3px solid " + (cov.ok ? C.ok : C.bad),
						background: cov.ok ? "#f0fdf4" : "#fef2f2",
						borderRadius: "4px",
						padding: "10px 12px",
						marginBottom: "12px"
					}
				}, [
					h("div", {
						key: "t",
						style: { fontSize: "12px" }
					}, [h("b", { key: "a" }, "字段覆盖检查"), h("span", {
						key: "b",
						style: { color: C.muted }
					}, "　" + L.records.length + " 份决策 + " + L.calibration.length + " 行校准 + " + L.handoffs.length + " 份交接　检查 " + cov.checked + " 个键实例 / " + cov.distinct + " 个不同键　悬空 " + cov.dangling.length + " · 待判定 " + cov.pending.length)]),
					cov.ok ? h("div", {
						key: "ok",
						style: {
							fontSize: "11px",
							color: C.ok,
							marginTop: "4px"
						}
					}, "每个键都已显式归类（收 / 不收 / 容器）—— 上游新增字段而没归类时会在这里**报 error**并指出是哪个文件。") : h("div", {
						key: "bad",
						style: { marginTop: "6px" }
					}, cov.issues.map((it, i) => h("div", {
						key: i,
						style: {
							fontSize: "11px",
							color: C.bad
						}
					}, "[" + it.code + "/" + it.level + "] " + it.msg + (it.files && it.files.length ? "　→ " + it.files.join("、") : "")))),
					h("div", {
						key: "cls",
						style: {
							fontSize: "10px",
							color: C.muted,
							fontFamily: "monospace",
							marginTop: "4px"
						}
					}, "归类分布 " + Object.keys(cov.classes).sort().map((k) => k + " " + cov.classes[k]).join(" · "))
				]) : null,
				h("div", {
					key: "v",
					style: {
						border: "1px solid " + C.faint,
						borderLeft: "3px solid " + (bad.length ? C.bad : C.ok),
						background: "#fff",
						borderRadius: "4px",
						padding: "10px 12px",
						marginBottom: "12px"
					}
				}, [h("div", {
					key: "t",
					style: {
						fontSize: "12px",
						marginBottom: "4px"
					}
				}, [h("b", { key: "a" }, "契约校验"), h("span", {
					key: "b",
					style: { color: C.muted }
				}, "　对照 " + (L.schemaOk ? "sr-askme/references/decision.schema.json" : "（schema 读不到，仅列结构问题）") + "　共 " + L.records.length + " 条，不合规 " + bad.length + " 条")]), bad.length ? h("div", { key: "l" }, bad.map((r) => h("div", {
					key: r.file,
					style: { marginTop: "6px" }
				}, [h("div", {
					key: "n",
					style: {
						fontFamily: "monospace",
						fontSize: "11px",
						color: C.bad
					}
				}, r.file + (r.parseErr ? "（JSON 解析失败：" + r.parseErr + "）" : "")), r.issues.length ? IssueTable(r.issues) : null]))) : h("div", {
					key: "ok",
					style: {
						fontSize: "11px",
						color: C.ok
					}
				}, "全部记录符合契约。")]),
				h("div", {
					key: "list",
					style: {
						background: "#fff",
						border: "1px solid " + C.faint,
						borderRadius: "4px",
						padding: "10px 12px",
						marginBottom: "12px"
					}
				}, [h("div", {
					key: "t",
					style: {
						fontSize: "12px",
						fontWeight: 600,
						marginBottom: "6px"
					}
				}, "已拍板列表（点一行看详情）"), L.records.length ? h("table", {
					key: "tb",
					style: {
						width: "100%",
						borderCollapse: "collapse"
					}
				}, [h("thead", { key: "h" }, h("tr", null, [
					h("th", {
						key: "1",
						style: TH
					}, "decision_id"),
					h("th", {
						key: "2",
						style: TH
					}, "标题"),
					h("th", {
						key: "3",
						style: Object.assign({}, TH, { width: "15%" })
					}, "type"),
					h("th", {
						key: "4",
						style: Object.assign({}, TH, { width: "12%" })
					}, "status"),
					h("th", {
						key: "5",
						style: Object.assign({}, TH, { width: "11%" })
					}, "日期")
				])), h("tbody", { key: "b" }, L.records.map((r, i) => {
					const dd = r.doc || {};
					const tOk = L.schemaOk && L.schema.properties && L.schema.properties.decision_type && L.schema.properties.decision_type.enum.indexOf(dd.decision_type) >= 0;
					const on = open === i;
					return h("tr", {
						key: r.file,
						onClick: () => setOpen(on ? null : i),
						style: {
							cursor: "pointer",
							background: on ? "#f0f6ff" : "transparent"
						}
					}, [
						h("td", {
							key: "1",
							style: Object.assign({}, TD, { fontFamily: "monospace" })
						}, String(dd.decision_id || "—")),
						h("td", {
							key: "2",
							style: TD
						}, String(dd.title || r.file)),
						h("td", {
							key: "3",
							style: Object.assign({}, TD, {
								fontFamily: "monospace",
								color: tOk ? C.ink : C.bad
							})
						}, String(dd.decision_type || "—") + (tOk ? "" : " ✗")),
						h("td", {
							key: "4",
							style: Object.assign({}, TD, { fontFamily: "monospace" })
						}, String(dd.status || "—")),
						h("td", {
							key: "5",
							style: Object.assign({}, TD, { fontFamily: "monospace" })
						}, String(dd.updated_at || dd.created_at || "").slice(0, 10))
					]);
				}))]) : h("div", {
					key: "n",
					style: {
						fontSize: "12px",
						color: C.muted
					}
				}, "本功能没有决策记录。")]),
				sel ? h("div", {
					key: "detail",
					style: {
						background: "#fff",
						border: "1px solid " + C.faint,
						borderRadius: "4px",
						padding: "10px 12px",
						marginBottom: "12px"
					}
				}, [
					h("div", {
						key: "t",
						style: {
							fontSize: "12px",
							fontWeight: 600,
							marginBottom: "6px"
						}
					}, "决策详情 · " + sel.file),
					d ? h("table", {
						key: "tb",
						style: {
							width: "100%",
							borderCollapse: "collapse"
						}
					}, h("tbody", null, [
						["决策问题", d.decision_question],
						["当前默认动作", d.current_default_action],
						["边界状态", d.boundary_status],
						["stakes", d.stakes],
						["reversibility", d.reversibility],
						["owner", d.owner],
						["rollback_trigger", d.rollback_trigger]
					].map(([k, v]) => h("tr", { key: k }, [h("th", {
						key: "k",
						style: Object.assign({}, TH, { width: "20%" })
					}, k), h("td", {
						key: "v",
						style: TD
					}, String(v === void 0 || v === null ? "—" : v))])))) : h("div", {
						key: "e",
						style: {
							fontSize: "12px",
							color: C.bad
						}
					}, "JSON 解析失败：" + sel.parseErr),
					d && Array.isArray(d.options) ? h("div", {
						key: "opt",
						style: { marginTop: "10px" }
					}, [h("div", {
						key: "t",
						style: {
							fontSize: "11px",
							fontWeight: 600,
							marginBottom: "4px"
						}
					}, "选项（" + d.options.length + " 条）"), h("table", {
						key: "tb",
						style: {
							width: "100%",
							borderCollapse: "collapse"
						}
					}, [h("thead", { key: "h" }, h("tr", null, [
						h("th", {
							key: "1",
							style: TH
						}, "option_id"),
						h("th", {
							key: "2",
							style: TH
						}, "action"),
						h("th", {
							key: "3",
							style: TH
						}, "expected_benefit"),
						h("th", {
							key: "4",
							style: TH
						}, "main_risk")
					])), h("tbody", { key: "b" }, d.options.map((o, i) => h("tr", { key: i }, [
						h("td", {
							key: "1",
							style: Object.assign({}, TD, { fontFamily: "monospace" })
						}, String(o.option_id || "")),
						h("td", {
							key: "2",
							style: TD
						}, String(o.action || "")),
						h("td", {
							key: "3",
							style: TD
						}, String(o.expected_benefit || "")),
						h("td", {
							key: "4",
							style: TD
						}, String(o.main_risk || ""))
					])))])]) : null,
					d ? h(ResultView, {
						key: "res",
						result: d.decision_result,
						doc: d
					}) : null
				]) : null,
				h("div", {
					key: "cal",
					style: {
						background: "#fff",
						border: "1px solid " + C.faint,
						borderRadius: "4px",
						padding: "10px 12px"
					}
				}, [
					h("div", {
						key: "t",
						style: {
							fontSize: "12px",
							fontWeight: 600,
							marginBottom: "6px"
						}
					}, "校准流水（" + L.calibration.length + " 条 · " + L.calFiles.length + " 个文件）"),
					L.calibration.length ? h("div", { key: "tb" }, L.calibration.map((c, i) => {
						const row = c.row || {};
						return h("div", {
							key: i,
							style: {
								padding: "7px 0",
								borderTop: i ? "1px solid " + C.faint : "none"
							}
						}, [
							h("div", {
								key: "h",
								style: {
									fontSize: "10px",
									color: C.muted,
									fontFamily: "monospace",
									marginBottom: "3px"
								}
							}, "第 " + (row.round === void 0 ? "?" : row.round) + " 轮 · " + String(row.gate || "") + " · " + String(row.ts || "").slice(0, 16) + " · " + String(row.status || "")),
							h("div", {
								key: "i",
								style: {
									fontSize: "12px",
									lineHeight: 1.7
								}
							}, String(row.input || "(无描述)")),
							Array.isArray(row.affected) && row.affected.length ? h("div", {
								key: "a",
								style: { marginTop: "4px" }
							}, row.affected.map((x, j) => h("span", {
								key: j,
								style: {
									fontSize: "10px",
									fontFamily: "monospace",
									border: "1px solid " + C.faint,
									borderRadius: "3px",
									padding: "0 5px",
									marginRight: "3px",
									color: C.muted
								}
							}, String(x)))) : null
						]);
					})) : h("div", {
						key: "n",
						style: {
							fontSize: "12px",
							color: C.muted
						}
					}, "本功能没有校准流水。"),
					h("div", {
						key: "w",
						style: {
							marginTop: "8px",
							padding: "8px 10px",
							background: "#fff7ed",
							borderLeft: "3px solid " + C.warn,
							fontSize: "11px"
						}
					}, "⚠️ 校准流水不逐字存原话（sr 的既定口径）。这里能看到「第几轮、哪道门、影响了哪些条目」，看不到当时逐字的答复。")
				])
			]);
		}
		const STAGE_ORDER = [
			"concept",
			"draft",
			"config",
			"final",
			"review",
			"speech"
		];
		const STAGE_META = {
			concept: {
				label: "概念",
				cmd: "/sr-concept",
				desc: "创意评估与设计核三角"
			},
			draft: {
				label: "成稿",
				cmd: "/sr-gdd-human",
				desc: "写成稿（只有纯规则与设计）"
			},
			config: {
				label: "配置",
				cmd: "/sr-config",
				desc: "把规则落成配置表"
			},
			final: {
				label: "定稿",
				cmd: "/sr-gdd-ai",
				desc: "整合定稿，交程序"
			},
			review: {
				label: "审查",
				cmd: "/sr-gdd-review",
				desc: "只读审查定稿"
			},
			speech: {
				label: "宣讲",
				cmd: "/sr-gdd-html",
				desc: "出宣讲 HTML"
			}
		};
		/**
		* 工作会话缓存：**可响应**，跨组件重挂载保留。
		* key = `<预设>|<功能名>`；值 = 会话 id。
		* 看板要靠它把「哪个功能在等你拍板」显示出来，所以写入时必须通知订阅者
		* （否则在详情页建的会话，看板不知道）。
		*/
		const WORK_SESSIONS = /* @__PURE__ */ new Map();
		const WORK_LISTENERS = /* @__PURE__ */ new Set();
		const workKey = (presetId, topic) => presetId + "|" + (topic || "");
		const setWorkSession = (key, sid) => {
			if (!key) return;
			WORK_SESSIONS.set(key, sid);
			for (const l of [...WORK_LISTENERS]) try {
				l();
			} catch (e) {}
		};
		/** 订阅工作会话缓存（返回 Map；写入时会触发重渲染） */
		function useWorkSessions() {
			const [, bump] = react.useState(0);
			react.useEffect(() => {
				const l = () => bump((n) => n + 1);
				WORK_LISTENERS.add(l);
				return () => {
					WORK_LISTENERS.delete(l);
				};
			}, []);
			return WORK_SESSIONS;
		}
		/** 把 Remote 的原始错误翻成人话 */
		function humanError(r) {
			const m = String(r && r.error && (r.error.message || r.error.code) || r || "");
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
			const summary = useSessions ? useSessions((s) => sid ? s.byId[sid] : void 0) : void 0;
			const pending = usePending ? usePending((m) => sid ? m.get(sid) : void 0) : void 0;
			if (!sid) return null;
			const running = !!(summary && summary.running);
			const blank = !!(summary && summary.blank);
			const proj = summary && summary.projections && summary.projections.values || {};
			const title = typeof proj.title === "string" ? proj.title : "";
			const lastAt = (proj.sessionListMetadata || {}).lastPromptAt || summary && summary.updatedAt || 0;
			const fmt = (t) => {
				if (!t) return "—";
				try {
					const d = new Date(t);
					const p = (n) => (n < 10 ? "0" : "") + n;
					return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
				} catch (e) {
					return "—";
				}
			};
			const state = running ? {
				text: "运行中",
				color: C.ok,
				dot: "●"
			} : pending ? {
				text: "等你回答",
				color: C.warn,
				dot: "⚠"
			} : blank ? {
				text: "空白（还没开始）",
				color: C.muted,
				dot: "○"
			} : {
				text: "空闲",
				color: C.muted,
				dot: "○"
			};
			const row = (k, v, color) => h("div", {
				key: k,
				style: {
					display: "flex",
					gap: "8px",
					fontSize: "12px",
					lineHeight: 1.95
				}
			}, [h("span", {
				key: "k",
				style: {
					color: C.muted,
					minWidth: "62px",
					flex: "0 0 auto"
				}
			}, k), h("span", {
				key: "v",
				style: {
					color: color || C.ink,
					wordBreak: "break-all"
				}
			}, v)]);
			return h("div", { style: {
				border: "1px solid " + C.faint,
				borderRadius: "4px",
				background: "#fff",
				padding: "10px 13px",
				marginTop: "12px"
			} }, [
				h("div", {
					key: "t",
					style: {
						fontSize: "12px",
						fontWeight: 600,
						marginBottom: "5px"
					}
				}, "工作会话"),
				row("状态", state.dot + " " + state.text, state.color),
				title ? row("标题", title) : null,
				pending ? row("待回答", "有 1 项在等你（" + String(pending.kind || "未知类型") + "）", C.warn) : null,
				row("最近活动", fmt(lastAt)),
				row("会话 id", h("span", { style: {
					fontFamily: "monospace",
					fontSize: "11px"
				} }, String(sid))),
				h("div", {
					key: "act",
					style: { marginTop: "8px" }
				}, h("button", {
					type: "button",
					onClick: () => onOpen(sid),
					style: {
						font: "inherit",
						fontSize: "12px",
						padding: "4px 12px",
						border: "1px solid " + C.ink,
						background: "#fff",
						color: C.ink,
						borderRadius: "4px",
						cursor: "pointer"
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
			const questions = pending && Array.isArray(pending.questions) ? pending.questions : [];
			const [sel, setSel] = react.useState({});
			const [text, setText] = react.useState({});
			const [busy, setBusy] = react.useState(false);
			const [err, setErr] = react.useState("");
			const [done, setDone] = react.useState("");
			if (!questions.length) return null;
			const submit = (answers) => {
				setBusy(true);
				setErr("");
				setDone("");
				let r;
				try {
					r = pending.answer({ answers });
				} catch (e) {
					setBusy(false);
					setErr(String(e && e.message || e));
					return;
				}
				Promise.resolve(r).then(() => {
					setBusy(false);
					setDone("已提交，等 skill 继续");
				}, (e) => {
					setBusy(false);
					setErr(String(e && e.message || e));
				});
			};
			const pickSingle = (q, label) => submit([{
				id: q.id,
				selected: [label]
			}]);
			const submitMulti = (q) => submit([{
				id: q.id,
				selected: sel[q.id] || [],
				custom: (text[q.id] || "").trim() || void 0
			}]);
			const toggle = (qid, label) => setSel((s) => {
				const cur = s[qid] || [];
				const next = cur.indexOf(label) >= 0 ? cur.filter((x) => x !== label) : cur.concat([label]);
				const out = {};
				for (const k in s) out[k] = s[k];
				out[qid] = next;
				return out;
			});
			return h("div", { style: {
				border: "1px solid " + C.warn,
				borderLeft: "3px solid " + C.warn,
				background: "#fffdf7",
				borderRadius: "4px",
				padding: "11px 13px",
				marginTop: "12px"
			} }, [
				h("div", {
					key: "h",
					style: {
						fontSize: "12px",
						fontWeight: 600,
						marginBottom: "7px",
						color: C.warn
					}
				}, "⚠ 等你拍板（" + questions.length + " 个问题）"),
				...questions.map((q, qi) => {
					const opts = Array.isArray(q.options) ? q.options : [];
					const picked = sel[q.id] || [];
					return h("div", {
						key: "q" + qi,
						style: {
							borderTop: qi ? "1px solid " + C.faint : "none",
							paddingTop: qi ? "9px" : "0",
							marginTop: qi ? "9px" : "0"
						}
					}, [
						q.header ? h("div", {
							key: "hd",
							style: {
								fontSize: "11px",
								color: C.muted,
								fontFamily: "monospace",
								marginBottom: "2px"
							}
						}, String(q.header)) : null,
						h("div", {
							key: "q",
							style: {
								fontSize: "13px",
								lineHeight: 1.7,
								marginBottom: q.detail ? "3px" : "7px"
							}
						}, String(q.question || "")),
						q.detail ? h("div", {
							key: "d",
							style: {
								fontSize: "11px",
								color: C.muted,
								lineHeight: 1.7,
								marginBottom: "7px",
								whiteSpace: "pre-wrap"
							}
						}, String(q.detail)) : null,
						opts.length ? h("div", {
							key: "opts",
							style: {
								display: "flex",
								flexDirection: "column",
								gap: "5px"
							}
						}, opts.map((o, oi) => {
							const label = typeof o === "string" ? o : String(o && (o.label || o.value) || "");
							const desc = o && typeof o === "object" && o.description ? String(o.description) : "";
							const on = picked.indexOf(label) >= 0;
							return h("button", {
								key: oi,
								type: "button",
								disabled: busy,
								onClick: () => q.multiSelect ? toggle(q.id, label) : pickSingle(q, label),
								style: {
									font: "inherit",
									textAlign: "left",
									padding: "7px 10px",
									border: "1px solid " + (on ? C.ink : C.soft),
									background: on ? "#eef4ff" : "#fff",
									borderRadius: "4px",
									cursor: busy ? "default" : "pointer",
									opacity: busy ? .6 : 1
								}
							}, [h("div", {
								key: "l",
								style: {
									fontSize: "12px",
									fontWeight: on ? 600 : 400
								}
							}, (q.multiSelect ? on ? "☑ " : "☐ " : "") + label), desc ? h("div", {
								key: "dd",
								style: {
									fontSize: "11px",
									color: C.muted,
									marginTop: "2px",
									lineHeight: 1.6
								}
							}, desc) : null]);
						})) : null,
						h("div", {
							key: "free",
							style: {
								display: "flex",
								gap: "6px",
								marginTop: "7px",
								alignItems: "center"
							}
						}, [h("input", {
							key: "i",
							value: text[q.id] || "",
							placeholder: opts.length ? "或直接写你的决定…" : "写下你的决定…",
							onChange: (e) => {
								const v = e.target.value;
								setText((t) => {
									const o = {};
									for (const k in t) o[k] = t[k];
									o[q.id] = v;
									return o;
								});
							},
							style: {
								flex: "1 1 220px",
								fontSize: "12px",
								padding: "5px 8px",
								border: "1px solid " + C.soft,
								borderRadius: "4px",
								outline: "none",
								background: "#fff"
							}
						}), h("button", {
							key: "s",
							type: "button",
							disabled: busy || !(text[q.id] || "").trim(),
							onClick: () => submit([{
								id: q.id,
								selected: [],
								custom: (text[q.id] || "").trim()
							}]),
							style: {
								font: "inherit",
								fontSize: "12px",
								padding: "5px 12px",
								border: "1px solid " + C.ink,
								background: "#fff",
								color: C.ink,
								borderRadius: "4px",
								cursor: busy ? "default" : "pointer"
							}
						}, "提交")]),
						q.multiSelect ? h("div", {
							key: "ms",
							style: { marginTop: "6px" }
						}, h("button", {
							type: "button",
							disabled: busy || !picked.length,
							onClick: () => submitMulti(q),
							style: {
								font: "inherit",
								fontSize: "12px",
								padding: "5px 12px",
								border: "1px solid " + C.ink,
								background: C.ink,
								color: "#fff",
								borderRadius: "4px",
								cursor: busy ? "default" : "pointer"
							}
						}, "提交所选（" + picked.length + "）")) : null
					]);
				}),
				done ? h("div", {
					key: "ok",
					style: {
						marginTop: "8px",
						fontSize: "12px",
						color: C.ok
					}
				}, done) : null,
				err ? h("div", {
					key: "er",
					style: {
						marginTop: "8px",
						fontSize: "12px",
						color: C.bad
					}
				}, "提交失败：" + err) : null
			]);
		}
		const ARTIFACT_GROUPS = [
			{
				key: "concept",
				label: "概念",
				sub: "analysis"
			},
			{
				key: "draft",
				label: "成稿",
				sub: "gdd"
			},
			{
				key: "final",
				label: "定稿",
				sub: "gdd"
			},
			{
				key: "review",
				label: "审查",
				sub: "gdd"
			},
			{
				key: "speech",
				label: "宣讲",
				sub: "delivery"
			},
			{
				key: "evidence",
				label: "证据",
				sub: "evidence"
			},
			{
				key: "source",
				label: "源文件",
				sub: "source"
			},
			{
				key: "config",
				label: "配置表",
				sub: null
			},
			{
				key: "decision",
				label: "决策",
				sub: "decisions"
			}
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
			const [fold, setFold] = react.useState({});
			if (!f || !f.files) return h("div", { style: {
				color: C.muted,
				fontSize: "12px"
			} }, "没有产物数据。");
			const absOf = (groupKey, name) => {
				const g = ARTIFACT_GROUPS.filter((x) => x.key === groupKey)[0];
				if (!g) return "";
				if (g.sub === null) return (configRoot || srWs) + "/" + name;
				return (f.root || srWs) + "/" + g.sub + "/" + name;
			};
			const total = ARTIFACT_GROUPS.reduce((n, g) => n + (f.files[g.key] || []).length, 0);
			const notes = [];
			if ((f.files.speech || []).length > 1) notes.push("有 " + f.files.speech.length + " 份宣讲 HTML —— 源一致性需人工确认（工作台不解析 HTML 页脚）");
			if ((f.files.final || []).length > 1) notes.push("有 " + f.files.final.length + " 个定稿版本 —— 按日期，最新的是最终版");
			return h("div", null, [
				h("div", {
					key: "sum",
					style: {
						fontSize: "12px",
						color: C.muted,
						marginBottom: "10px"
					}
				}, "共 " + total + " 个产物　" + ARTIFACT_GROUPS.map((g) => g.label + " " + (f.files[g.key] || []).length).filter((s) => !/ 0$/.test(s)).join(" · ")),
				...notes.map((t, i) => h("div", {
					key: "n" + i,
					style: {
						border: "1px solid " + C.faint,
						borderLeft: "3px solid " + C.warn,
						background: "#fffdf7",
						borderRadius: "4px",
						padding: "8px 11px",
						fontSize: "12px",
						marginBottom: "8px"
					}
				}, "⚠ " + t)),
				...ARTIFACT_GROUPS.map((g) => {
					const names = f.files[g.key] || [];
					if (!names.length) return null;
					const isFinal = g.key === "final";
					return h("div", {
						key: g.key,
						style: {
							border: "1px solid " + C.faint,
							borderRadius: "4px",
							background: "#fff",
							marginBottom: "9px",
							overflow: "hidden"
						}
					}, [h("div", {
						key: "h",
						onClick: () => setFold((s) => {
							const o = {};
							for (const k in s) o[k] = s[k];
							o[g.key] = !s[g.key];
							return o;
						}),
						style: {
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
							padding: "7px 11px",
							background: C.bg,
							cursor: "pointer",
							borderBottom: fold[g.key] ? "none" : "1px solid " + C.faint
						}
					}, [h("span", {
						key: "l",
						style: {
							fontSize: "12px",
							fontWeight: 600
						}
					}, g.label + "（" + names.length + "）"), h("span", {
						key: "t",
						style: {
							fontSize: "10px",
							color: C.muted
						}
					}, fold[g.key] ? "展开 ▸" : "收起 ▾")]), fold[g.key] ? null : h("div", {
						key: "b",
						style: { padding: "4px 0" }
					}, names.map((n, i) => {
						const abs = absOf(g.key, n);
						const st = isFinal && n === f.latestFinal ? f.status || "" : "";
						return h("div", {
							key: i,
							style: {
								display: "flex",
								alignItems: "center",
								gap: "8px",
								padding: "5px 11px",
								borderTop: i ? "1px solid " + C.faint : "none"
							}
						}, [
							h("span", {
								key: "b",
								style: {
									fontSize: "10px",
									fontFamily: "monospace",
									padding: "0 5px",
									border: "1px solid " + C.soft,
									borderRadius: "3px",
									color: isFinal && n === f.latestFinal ? C.ok : C.muted,
									whiteSpace: "nowrap"
								}
							}, isFinal && n === f.latestFinal ? "最终版" : g.label),
							h("button", {
								key: "n",
								type: "button",
								onClick: () => onOpen(abs),
								title: "点击打开：" + abs,
								style: {
									font: "inherit",
									fontSize: "12px",
									fontFamily: "monospace",
									padding: 0,
									border: "none",
									background: "none",
									color: "#3b6ea5",
									cursor: "pointer",
									textAlign: "left",
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap",
									flex: "1 1 auto",
									textDecoration: "none"
								}
							}, n),
							st ? h("span", {
								key: "s",
								style: {
									fontSize: "10px",
									color: C.ok,
									fontFamily: "monospace"
								}
							}, st) : null,
							fmtNameDate(n) ? h("span", {
								key: "d",
								style: {
									fontSize: "10px",
									color: C.muted,
									fontFamily: "monospace",
									whiteSpace: "nowrap"
								}
							}, fmtNameDate(n)) : null
						]);
					}))]);
				}),
				h("div", {
					key: "foot",
					style: {
						marginTop: "12px",
						fontSize: "11px",
						color: C.muted,
						lineHeight: 1.85
					}
				}, [h("div", { key: "a" }, "产物来自工作区实时读取；类型由文件名派生，不另存索引。"), h("div", { key: "b" }, "点文件名用系统默认程序打开。")])
			]);
		}
		/** 定稿有效性 / V 校验清单的严重程度 → 颜色与词 */
		const CHECK_TONE = {
			error: {
				c: C.bad,
				t: "error"
			},
			warn: {
				c: C.warn,
				t: "warn"
			},
			info: {
				c: C.muted,
				t: "info"
			}
		};
		/** 定稿有效性的**一句话结论**（"现在能用吗"） */
		function finalVerdict(finalCheck) {
			if (!finalCheck) return {
				text: "（还没读）",
				tone: null
			};
			if (!finalCheck.all || !finalCheck.all.length) return {
				text: "没有定稿 —— 这个功能还交不了程序",
				tone: "warn"
			};
			if ((finalCheck.issues || []).some((i) => i.level === "error")) return {
				text: "有阻断问题：" + finalCheck.issues.filter((i) => i.level === "error").map((i) => i.code).join(" / "),
				tone: "bad"
			};
			if (finalCheck.currentFrom === "date") return {
				text: "没有 active 定稿（按日期取最新：" + finalCheck.current + "）",
				tone: "warn"
			};
			return {
				text: "可用：" + finalCheck.current + "（active）",
				tone: "ok"
			};
		}
		/** 今天（YYYYMMDD）—— 产出文件名里的日期由面板给定，纯函数那头不吃时钟 */
		function todayYmd() {
			const d = /* @__PURE__ */ new Date();
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
			const exits = data && data.notes || [];
			const kinds = INTAKE && INTAKE.BRAINSTORM_KINDS || [];
			const [kind, setKind] = react.useState("analysis");
			const [mats, setMats] = react.useState("");
			const [goal, setGoal] = react.useState("");
			const [seed, setSeed] = react.useState("");
			const [seedMats, setSeedMats] = react.useState("");
			const [legacyPath, setLegacyPath] = react.useState("");
			const [legacyName, setLegacyName] = react.useState("");
			const [legacyNote, setLegacyNote] = react.useState("");
			const [title, setTitle] = react.useState("");
			const [quote, setQuote] = react.useState("");
			const [bounds, setBounds] = react.useState("");
			const [landing, setLanding] = react.useState("");
			const [author, setAuthor] = react.useState("");
			const [confidence, setConfidence] = react.useState("high");
			const [sendMsg, setSendMsg] = react.useState(null);
			const [opened, setOpened] = react.useState(null);
			const e = kinds.filter((x) => x.id === kind)[0] || kinds[0] || {
				id: "",
				label: "",
				hint: "",
				needs: "",
				output: "",
				handoff: ""
			};
			const materials = kind === "analysis" ? INTAKE.parseMaterials(mats) : kind === "legacy" ? INTAKE.parseMaterials(legacyPath) : kind === "concept" ? INTAKE.parseMaterials(seedMats) : [];
			const noteText = kind === "concept" ? seed : kind === "legacy" ? legacyNote : goal;
			const built = INTAKE && e.id ? INTAKE.buildBrainstormInstruction(e.id, {
				root,
				date: todayYmd(),
				topic: f.topic || "",
				materials,
				note: noteText,
				name: legacyName,
				title,
				quote,
				bounds,
				landing,
				author,
				confidence
			}) : {
				instruction: "",
				blocked: "头脑风暴的组装器没加载上（intake 模块缺失）。",
				next: ""
			};
			const send = () => {
				if (built.blocked) {
					setSendMsg({
						kind: "blocked",
						text: built.blocked,
						next: built.next || ""
					});
					return;
				}
				if (typeof props.onSend !== "function") {
					setSendMsg({
						kind: "err",
						text: "发送通道没挂上（onSend 缺失）。",
						next: "刷新页面；仍失败就把这条发给开发者。"
					});
					return;
				}
				setSendMsg({
					kind: "pending",
					text: "正在发给该功能的专属工作会话…"
				});
				props.onSend(e.id, {
					text: built.instruction,
					materials,
					note: noteText,
					name: legacyName,
					title,
					quote,
					bounds,
					landing,
					author,
					confidence,
					root
				}).then((r) => setSendMsg(r && r.ok ? {
					kind: "ok",
					text: "已交给工作会话。",
					sid: r.sid || "",
					target: r.target || null,
					healed: !!r.healed,
					queued: !!r.queued,
					note: r.note || ""
				} : {
					kind: "err",
					text: r && (r.message || r.blocked || r.note) || "发送失败",
					next: r && r.next || "再按一次；仍失败就把这条错误发给开发者。",
					sid: r && r.sid || ""
				}), (err) => setSendMsg({
					kind: "err",
					text: String(err && err.message || err),
					next: "再按一次。"
				}));
			};
			const jump = (sid) => {
				if (!sid || typeof props.onOpenSession !== "function") {
					setSendMsg((m) => Object.assign({}, m || {}, { jumpErr: "面板拿不到「跳会话」的通道（onOpenSession 没挂上）。" }));
					return;
				}
				const r = props.onOpenSession(sid);
				if (r && r.ok === false) setSendMsg((m) => Object.assign({}, m || {}, { jumpErr: "跳转失败：" + (r.error && (r.error.message || r.error.code) || "未知原因") + "　—— 你可以在左侧列表里按标题找到它。" }));
			};
			const IN = {
				flex: "1 1 auto",
				font: "inherit",
				fontSize: "11.5px",
				padding: "5px 8px",
				border: "1px solid " + C.soft,
				borderRadius: "4px",
				boxSizing: "border-box"
			};
			const LABEL = {
				fontSize: "10.5px",
				color: C.muted,
				marginBottom: "3px"
			};
			const field = (key, label, value, set, placeholder, rows) => h("div", {
				key,
				style: { marginBottom: "7px" }
			}, [h("div", {
				key: "l",
				style: LABEL
			}, label), rows ? h("textarea", {
				key: "i",
				value,
				placeholder,
				rows,
				onChange: (ev) => set(ev.target.value),
				style: Object.assign({}, IN, {
					width: "100%",
					resize: "vertical",
					fontFamily: "inherit"
				})
			}) : h("input", {
				key: "i",
				value,
				placeholder,
				onChange: (ev) => set(ev.target.value),
				style: Object.assign({}, IN, { width: "100%" })
			})]);
			const form = () => {
				if (e.id === "analysis") return [field("m", "素材（目录 / 文件路径 / 链接，可多行）", mats, setMats, "D:\\素材\\竞品_联盟 或 https://…", 2), field("g", "分析目标（选填）", goal, setGoal, "比如：看它的奖池概率与保底怎么配", 2)];
				if (e.id === "concept") return [field("s", "一句话创意（必填）", seed, setSeed, "比如：联盟成员一起打 BOSS，血量全盟共享", 2), field("m", "参考素材（选填，路径 / 链接）", seedMats, setSeedMats, "D:\\素材\\参考.png", 2)];
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
					h("div", {
						key: "row",
						style: {
							display: "flex",
							gap: "7px"
						}
					}, [h("div", {
						key: "a",
						style: { flex: "1 1 auto" }
					}, field("au", "谁说的（选填）", author, setAuthor, "祖海潮")), h("div", {
						key: "c",
						style: { flex: "0 0 130px" }
					}, [h("div", {
						key: "cc",
						style: LABEL
					}, "可信度"), h("select", {
						key: "cs",
						value: confidence,
						onChange: (ev) => setConfidence(ev.target.value),
						style: Object.assign({}, IN, { width: "100%" })
					}, [h("option", {
						key: "h",
						value: "high"
					}, "high（可直接当规则口径）"), h("option", {
						key: "p",
						value: "pending"
					}, "pending（需补证据）")])])])
				];
			};
			const card = (k) => {
				const on = k.id === e.id;
				return h("button", {
					key: "card-" + k.id,
					type: "button",
					"data-card": k.id,
					"data-active": on ? "1" : "0",
					onClick: () => {
						setKind(k.id);
						setSendMsg(null);
					},
					style: {
						flex: "1 1 168px",
						minWidth: "168px",
						textAlign: "left",
						font: "inherit",
						cursor: "pointer",
						border: "1px solid " + (on ? C.ink : C.faint),
						borderTop: "3px solid " + (on ? C.ink : C.soft),
						background: on ? "#fff" : C.bg,
						borderRadius: "4px",
						padding: "7px 9px"
					}
				}, [
					h("div", {
						key: "t",
						style: {
							fontSize: "12px",
							fontWeight: 600,
							color: C.ink
						}
					}, k.label),
					h("div", {
						key: "h",
						style: {
							fontSize: "10px",
							color: C.link,
							fontFamily: "monospace",
							marginTop: "2px"
						}
					}, k.hint),
					h("div", {
						key: "n",
						style: {
							fontSize: "10px",
							color: C.muted,
							marginTop: "4px",
							lineHeight: 1.65
						}
					}, "前置：" + k.needs),
					h("div", {
						key: "o",
						style: {
							fontSize: "10px",
							color: C.muted,
							marginTop: "3px",
							lineHeight: 1.65
						}
					}, "产出：" + k.output)
				]);
			};
			const secTitle = {
				fontSize: "11px",
				fontWeight: 600,
				color: C.ink,
				marginBottom: "2px"
			};
			const secBody = {
				fontSize: "11px",
				color: C.ink,
				whiteSpace: "pre-wrap",
				userSelect: "text",
				lineHeight: 1.7,
				background: "#fff",
				border: "1px solid " + C.faint,
				borderRadius: "3px",
				padding: "5px 7px"
			};
			const legacyView = (doc) => h("div", {
				key: "lv",
				"data-doc": "legacy",
				"data-name": doc.name
			}, [
				h("div", {
					key: "meta",
					style: {
						fontSize: "10.5px",
						color: C.muted,
						marginBottom: "6px",
						lineHeight: 1.7
					}
				}, [h("div", { key: "a" }, "原件：" + (doc.source || "(frontmatter 里没写 source)") + "　（原件存 source\\ —— 产出文档的身份信息指回原件）"), h("div", { key: "b" }, "topic：" + (doc.topic || "(空)") + "　analyzed_at：" + (doc.analyzedAt || "(空)"))]),
				doc.missing && doc.missing.length ? h("div", {
					key: "miss",
					"data-missing": doc.missing.join("|"),
					style: {
						fontSize: "11px",
						color: C.warn,
						marginBottom: "6px"
					}
				}, "⚠ 缺 " + doc.missing.length + " 段固定章节：" + doc.missing.join(" / ") + " —— 这份产出不完整（四段一个都不能少）") : null,
				doc.sections.map((s, i) => h("div", {
					key: "s" + i,
					"data-sec": s.key,
					style: { marginBottom: "6px" }
				}, [h("div", {
					key: "t",
					style: secTitle
				}, (s.present ? "## " : "##（缺）") + s.label), s.key === "reuse" && s.present ? h("table", {
					key: "tb",
					style: {
						width: "100%",
						borderCollapse: "collapse",
						fontSize: "10.5px"
					}
				}, [h("thead", { key: "h" }, h("tr", null, doc.reuse.header.map((c, j) => h("th", {
					key: j,
					style: TH
				}, c)))), h("tbody", { key: "b" }, doc.reuse.rows.map((r, j) => h("tr", { key: j }, r.map((c, m) => h("td", {
					key: m,
					style: TD
				}, c)))))]) : h("div", {
					key: "b",
					style: secBody
				}, s.present ? s.body || "（空）" : "（这一段没有）")])),
				doc.extra && doc.extra.length ? h("div", {
					key: "ex",
					"data-extra": String(doc.extra.length),
					style: {
						fontSize: "10.5px",
						color: C.muted,
						marginTop: "4px"
					}
				}, "其他章节（不认识的标题也不丢）：" + doc.extra.map((x) => x.title).join(" / ")) : null
			]);
			/**
			* 人工补充：**原话与结论并排**。
			* 左列是原话那一行（逐字，`userSelect: text`），右列是 AI 整理的结论 —— 两列是同一个
			* flex 行里的兄弟节点，所以"一眼能看出有没有被改动"这件事在界面上是物理成立的。
			*/
			const noteView = (doc) => h("div", {
				key: "hn",
				"data-doc": "humannote",
				"data-name": doc.name
			}, [
				h("div", {
					key: "meta",
					style: {
						fontSize: "10.5px",
						color: C.muted,
						marginBottom: "6px",
						lineHeight: 1.7
					}
				}, [h("div", { key: "a" }, "confidence：" + (doc.confidence || "(空)") + "　date：" + (doc.date || "(空)") + "　author：" + (doc.author || "(空)") + "　（confidence 是唯一的可信度字段：high = 可直接当规则口径；pending = 下游引用要带标记）"), h("div", { key: "b" }, "topic：" + (doc.topic || "(空)") + "　标题：" + (doc.title || "(空)"))]),
				doc.quote.found ? h("div", {
					key: "pair",
					"data-pair": "quote|conclusion",
					style: {
						display: "flex",
						gap: "10px",
						alignItems: "stretch",
						marginBottom: "7px"
					}
				}, [h("div", {
					key: "q",
					"data-side": "quote",
					style: {
						flex: "1 1 50%",
						minWidth: 0
					}
				}, [h("div", {
					key: "t",
					style: secTitle
				}, "我说的话（原话 · 逐字）"), h("div", {
					key: "b",
					style: Object.assign({}, secBody, { borderLeft: "3px solid " + C.link })
				}, doc.quote.raw)]), h("div", {
					key: "c",
					"data-side": "conclusion",
					style: {
						flex: "1 1 50%",
						minWidth: 0
					}
				}, [h("div", {
					key: "t",
					style: secTitle
				}, "AI 整理的结论（并排比对：有没有改动我的结论）"), h("div", {
					key: "b",
					style: secBody
				}, doc.conclusion || "（这一段没有）")])]) : h("div", {
					key: "noq",
					"data-side": "quote-missing",
					style: {
						fontSize: "11px",
						color: C.warn,
						marginBottom: "6px"
					}
				}, "⚠ 这份产出里没有 `> 原话：…` 那一行 —— 按格式要求它必须逐字保留，否则看不出 AI 有没有改动结论。"),
				doc.sections.filter((s) => s.key !== "conclusion").map((s, i) => h("div", {
					key: "s" + i,
					"data-sec": s.key,
					style: { marginBottom: "6px" }
				}, [h("div", {
					key: "t",
					style: secTitle
				}, (s.present ? "## " : "##（缺）") + s.label), h("div", {
					key: "b",
					style: secBody
				}, s.present ? s.body || "（空）" : "（这一段没有）")])),
				doc.extra && doc.extra.length ? h("div", {
					key: "ex",
					"data-extra": String(doc.extra.length),
					style: {
						fontSize: "10.5px",
						color: C.muted,
						marginTop: "4px"
					}
				}, "其他章节（不丢）：" + doc.extra.map((x) => x.title).join(" / ")) : null
			]);
			const groups = data && data.groups || {
				entries: [],
				other: [],
				total: 0
			};
			const docById = (id, name) => {
				return (id === "legacy" ? data && data.legacy || [] : data && data.humannote || []).filter((x) => x.name === name)[0] || null;
			};
			const fileRow = (g, file, i) => {
				const isNew = g.id === "legacy" || g.id === "humannote";
				const open = opened && opened.id === g.id && opened.name === file.name;
				return h("div", {
					key: "f" + g.id + i,
					"data-file": file.name,
					onClick: () => {
						if (isNew) setOpened(open ? null : {
							id: g.id,
							name: file.name
						});
						else if (props.onOpen) props.onOpen(root.replace(/\\+$/, "") + "\\" + String(file.rel || file.name).replace(/\//g, "\\"));
					},
					style: {
						fontSize: "11px",
						padding: "2px 4px",
						borderRadius: "3px",
						cursor: "pointer",
						background: open ? "#f0f7ff" : "transparent",
						color: C.ink
					}
				}, (isNew ? open ? "▾ " : "▸ " : "· ") + file.name + (isNew ? "　（新格式：点开看渲染）" : ""));
			};
			return h("div", { "data-workface": "brainstorm" }, [
				exits.length ? h("div", {
					key: "exit",
					"data-exit": "note",
					style: {
						fontSize: "11.5px",
						color: C.warn,
						border: "1px solid " + C.faint,
						borderLeft: "3px solid " + C.warn,
						background: "#fffdf7",
						borderRadius: "4px",
						padding: "7px 10px",
						marginBottom: "10px"
					}
				}, exits.map((x, i) => h("div", { key: i }, "⚠ " + x))) : null,
				h("div", {
					key: "row",
					"data-row": "entrances",
					style: {
						display: "flex",
						gap: "8px",
						flexWrap: "wrap",
						marginBottom: "10px"
					}
				}, kinds.map(card)),
				h("div", {
					key: "detail",
					"data-entrance": e.id,
					style: {
						border: "1px solid " + C.faint,
						borderRadius: "4px",
						background: "#fff",
						padding: "9px 11px",
						marginBottom: "10px"
					}
				}, [
					h("div", {
						key: "h",
						style: {
							fontSize: "12px",
							marginBottom: "6px"
						}
					}, [h("b", { key: "b" }, e.label + "　"), h("span", {
						key: "s",
						style: {
							color: C.muted,
							fontSize: "10.5px"
						}
					}, e.hint + "　前置：" + e.needs + "　产出：" + e.output)]),
					h("div", { key: "f" }, form()),
					built.blocked ? h("div", {
						key: "blk",
						"data-blocked": e.id,
						style: {
							fontSize: "11.5px",
							color: C.bad,
							background: "#fef2f2",
							border: "1px solid " + C.faint,
							borderRadius: "3px",
							padding: "6px 8px",
							marginBottom: "7px",
							lineHeight: 1.75
						}
					}, [h("div", { key: "a" }, "✗ " + built.blocked), built.next ? h("div", {
						key: "b",
						style: { color: C.ink }
					}, "下一步：" + built.next) : null]) : null,
					built.instruction ? h("div", {
						key: "pv",
						style: { marginBottom: "7px" }
					}, [h("div", {
						key: "t",
						style: LABEL
					}, "这条入口组装出来的指令 —— 下面这段就是发给工作会话的原文（卡上看到的 = 发出去的）："), h("pre", {
						key: "v",
						"data-kind": e.id,
						style: {
							margin: "3px 0 0",
							padding: "6px 8px",
							background: C.bg,
							border: "1px solid " + C.faint,
							borderRadius: "3px",
							fontFamily: "monospace",
							fontSize: "10.5px",
							lineHeight: 1.6,
							whiteSpace: "pre-wrap",
							color: C.ink,
							userSelect: "text",
							maxHeight: "26vh",
							overflow: "auto"
						}
					}, built.instruction)]) : null,
					h("div", {
						key: "act",
						style: {
							display: "flex",
							gap: "8px",
							alignItems: "center"
						}
					}, [h("button", {
						key: "go",
						type: "button",
						"data-send": e.id,
						onClick: send,
						style: {
							font: "inherit",
							fontSize: "11.5px",
							padding: "5px 12px",
							borderRadius: "4px",
							border: "1px solid " + (built.blocked ? C.soft : C.link),
							background: built.blocked ? "#fff" : C.link,
							color: built.blocked ? C.muted : "#fff",
							cursor: "pointer"
						}
					}, "发到工作会话"), h("span", {
						key: "n",
						style: {
							fontSize: "10.5px",
							color: C.muted
						}
					}, "发到：本功能的专属工作会话" + (root ? "（cwd " + winPath(root) + "）" : "") + "　—— 不占用你自己的对话")]),
					h("div", {
						key: "ho",
						"data-handoff": e.id,
						style: {
							fontSize: "10.5px",
							color: C.muted,
							marginTop: "5px",
							lineHeight: 1.7
						}
					}, "发起后：" + e.handoff + " —— 面板只给「跳到那个会话」。"),
					sendMsg ? h("div", {
						key: "m",
						style: {
							fontSize: "11px",
							marginTop: "6px",
							lineHeight: 1.75,
							color: sendMsg.kind === "err" || sendMsg.kind === "blocked" ? C.bad : sendMsg.kind === "ok" ? C.ok : C.muted
						}
					}, [
						h("div", { key: "t" }, (sendMsg.kind === "ok" ? "✓ " : sendMsg.kind === "pending" ? "" : "✗ ") + sendMsg.text),
						sendMsg.kind === "ok" ? h("div", {
							key: "d",
							"data-sent": "ok",
							style: {
								color: C.muted,
								userSelect: "text"
							}
						}, [
							h("div", { key: "s" }, "阶段交给了 skill，进度与提问都在那个会话里 —— 面板不重画流程，跑完回本页重进就能看到产物。"),
							h("div", { key: "g" }, "目标：" + (sendMsg.target && sendMsg.target.title || "工作会话") + (sendMsg.sid ? "　会话 " + String(sendMsg.sid).slice(0, 12) + "…" : "") + (sendMsg.target && sendMsg.target.root ? "　cwd " + winPath(sendMsg.target.root) : "") + "　（" + pickSourceText(sendMsg.target && sendMsg.target.source) + "）"),
							sendMsg.healed ? h("div", {
								key: "h",
								style: { color: C.warn }
							}, "上一轮记的那条会话已经不在了 —— 已自动重建一条并重发。") : null,
							sendMsg.queued ? h("div", {
								key: "q",
								style: { color: C.warn }
							}, "它正在跑别的活，这条指令排在队列里，等它跑完当前这一轮就会处理。") : null
						]) : null,
						sendMsg.kind === "err" || sendMsg.kind === "blocked" ? h("div", {
							key: "n",
							"data-sent": "fail",
							style: { color: C.ink }
						}, "下一步：" + (sendMsg.next || "再按一次。")) : null,
						sendMsg.sid && props.onOpenSession ? h("button", {
							key: "j",
							type: "button",
							"data-jump": sendMsg.sid,
							onClick: () => jump(sendMsg.sid),
							style: {
								font: "inherit",
								fontSize: "11px",
								padding: "2px 9px",
								marginTop: "3px",
								border: "1px solid " + C.soft,
								background: "#fff",
								borderRadius: "4px",
								cursor: "pointer"
							}
						}, "跳到那个会话 ›") : null,
						sendMsg.jumpErr ? h("div", {
							key: "je",
							style: { color: C.bad }
						}, sendMsg.jumpErr) : null
					]) : null
				]),
				h("div", {
					key: "have",
					style: {
						border: "1px solid " + C.faint,
						borderRadius: "4px",
						background: C.bg,
						padding: "8px 10px"
					}
				}, [
					h("div", {
						key: "t",
						style: {
							fontSize: "11.5px",
							fontWeight: 600,
							marginBottom: "5px"
						}
					}, "已有的分析结论（" + (groups.total || 0) + " 件，按入口分）" + (f && f.topic ? "　功能：" + f.topic : "")),
					!data ? h("div", {
						key: "ld",
						style: {
							fontSize: "11px",
							color: C.muted
						}
					}, "正在读 analysis\\ 里的产物…") : null,
					data && data.error ? h("div", {
						key: "er",
						style: {
							fontSize: "11px",
							color: C.bad
						}
					}, data.error) : null,
					data && !data.error ? h("div", { key: "g" }, (groups.entries || []).map((g) => h("div", {
						key: "e" + g.id,
						"data-group": g.id,
						style: {
							marginBottom: "5px",
							borderTop: "1px solid " + C.faint,
							paddingTop: "5px"
						}
					}, [h("div", {
						key: "h",
						style: { fontSize: "11px" }
					}, [h("b", { key: "b" }, g.label), h("span", {
						key: "c",
						style: { color: C.muted }
					}, "　" + g.count + " 件" + (g.count === 0 ? "（这一路还没走过）" : ""))]), h("div", { key: "f" }, (g.files || []).map((file, i) => fileRow(g, file, i)))])).concat(groups.other && groups.other.length ? [h("div", {
						key: "eother",
						"data-group": "other",
						style: {
							marginBottom: "5px",
							borderTop: "1px solid " + C.faint,
							paddingTop: "5px"
						}
					}, [h("div", {
						key: "h",
						style: { fontSize: "11px" }
					}, [h("b", { key: "b" }, "其他 / 来源未知"), h("span", {
						key: "c",
						style: { color: C.muted }
					}, "　" + groups.other.length + " 件（认不出属于哪一路，如实列出）")]), h("div", { key: "f" }, groups.other.map((file, i) => fileRow({ id: "other" }, file, i)))])] : [])) : null,
					data && (data.unreadable || []).length ? h("div", {
						key: "un",
						style: {
							fontSize: "10.5px",
							color: C.warn,
							marginTop: "4px"
						}
					}, (data.unreadable || []).map((x, i) => h("div", { key: i }, "⚠ 读不动：" + x.name + "（" + x.why + "）"))) : null,
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
			const doc = data && data.doc || null;
			const config = data && data.config || null;
			const notes = data && data.notes || [];
			const actions = INTAKE && INTAKE.DRAFT_ACTIONS || [];
			const phases = INTAKE && INTAKE.DRAFT_PHASES || [];
			const story = data && data.story || {};
			/** Y 形两层的动作 id（`DRAFT_PHASES`；表只有一份，这里只是按阶段取） */
			const cardIds = (phases.filter((p) => p.key === "card")[0] || {}).ids || [];
			const defOf = (id) => actions.filter((x) => x.id === id)[0] || {
				id,
				label: id,
				hint: "",
				needs: "",
				output: "",
				handoff: ""
			};
			const [act, setAct] = react.useState("create");
			const [seed, setSeed] = react.useState("");
			const [mats, setMats] = react.useState("");
			const [where, setWhere] = react.useState("");
			const [before, setBefore] = react.useState("§5");
			const [intent, setIntent] = react.useState("");
			/** 支线 B 的图路径（粘的 + 从 `gdd\UI\` 里挑的，逐行） */
			const [wirePaste, setWirePaste] = react.useState("");
			const [picked, setPicked] = react.useState([]);
			/** 三个「先展开输入/预览，再发」的入口 + 三个折叠区（两大部分 / 看正文 / 详情） */
			const [openCfg, setOpenCfg] = react.useState(false);
			const [openWire, setOpenWire] = react.useState(false);
			const [openInt, setOpenInt] = react.useState(false);
			const [openParts, setOpenParts] = react.useState(false);
			const [openBody, setOpenBody] = react.useState(false);
			const [openMachine, setOpenMachine] = react.useState(false);
			/** ★ 工单 25 · 定稿门（合流之后的落点）：首屏只给一行人话，明细折在这里 */
			const [openGate, setOpenGate] = react.useState(false);
			const [sendMsg, setSendMsg] = react.useState({});
			const [openG, setOpenG] = react.useState({});
			const [sel, setSel] = react.useState(-1);
			const bodyRef = react.useRef(null);
			const e = actions.filter((x) => x.id === act)[0] || actions[0] || {
				id: "",
				label: "",
				hint: "",
				needs: "",
				output: "",
				handoff: ""
			};
			/** 今天，`YYYY-MM-DD`（**只有一处**：指令预览与真正发出去的必须是同一天） */
			const today = (() => {
				const s = todayYmd();
				return s.slice(0, 4) + "-" + s.slice(4, 6) + "-" + s.slice(6, 8);
			})();
			/** 组标识：有 `id`（R1 / UI-M1）用它，否则退回组号（5.0）——与 `finaltree.groupKey` 同口径 */
			const gk = (g) => String(g.id || g.no || "");
			/** 章号 → 它在哪一部分（两大部分高亮 + 组行上的归属标记） */
			const partOfNo = (no) => {
				const hit = (doc && doc.parts || []).filter((p) => p.no === String(no))[0] || null;
				return hit ? hit.key : "";
			};
			/** 组行上标 §4 / §5（只标两大部分里的组，别处不标） */
			const partTag = (no) => {
				const k = partOfNo(no);
				return k === "rules" ? "§4 规则" : k === "ux" ? "§5 界面" : "";
			};
			const common = {
				root,
				topic: data && data.topic || "",
				date: today,
				draftPath: data && data.path || "",
				configLabel: config && config.label || "",
				configMissing: config && config.missing || [],
				contract: config && config.facts && config.facts.contract || null,
				parts: doc && doc.parts || [],
				readbacks: config && config.facts && config.facts.readbacks || [],
				ascii: data && data.ascii || []
			};
			const build = (over) => INTAKE && INTAKE.buildDraftInstruction ? INTAKE.buildDraftInstruction(Object.assign({}, common, { action: "create" }, over || {})) : {
				instruction: "",
				blocked: "文档生成的组装器没加载上（draftstep 模块缺失）。",
				next: ""
			};
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
				if (id === "create") return build({
					action: "create",
					intent: seed,
					materials: INTAKE.parseMaterials(mats)
				});
				if (id === "revise") return build({
					action: "revise",
					where,
					before,
					intent
				});
				if (id === "config") return build({
					action: "config",
					where,
					intent
				});
				if (id === "wireframe") return build({
					action: "wireframe",
					where,
					images: wirePaths
				});
				return build({ action: "integrate" });
			};
			const built = builtOf(e.id);
			const builtWire = builtOf("wireframe");
			const builtCfg = builtOf("config");
			const builtInt = builtOf("integrate");
			/** 发一条指令（正文由上面的组装器给；`built.blocked` 时**不发**，原样显示提示） */
			const sendOne = (id, b, tag) => {
				if (b.blocked) {
					setSendMsg((m) => Object.assign({}, m || {}, { [id]: {
						kind: "blocked",
						text: b.blocked,
						next: b.next || ""
					} }));
					return;
				}
				if (typeof props.onSend !== "function") {
					setSendMsg((m) => Object.assign({}, m || {}, { [id]: {
						kind: "err",
						text: "发送通道没挂上（onSend 缺失）。",
						next: "刷新页面；仍失败就把这条发给开发者。"
					} }));
					return;
				}
				setSendMsg((m) => Object.assign({}, m || {}, { [id]: {
					kind: "pending",
					text: "正在发给该功能的专属工作会话…"
				} }));
				props.onSend(id, {
					text: b.instruction,
					root
				}).then((r) => setSendMsg((m) => Object.assign({}, m || {}, { [id]: r && r.ok ? {
					kind: "ok",
					text: "已交给工作会话。",
					sid: r.sid || "",
					target: r.target || null,
					healed: !!r.healed,
					queued: !!r.queued,
					note: r.note || ""
				} : {
					kind: "err",
					text: r && (r.message || r.blocked || r.note) || "发送失败",
					next: r && r.next || "再按一次；仍失败就把这条错误发给开发者。",
					sid: r && r.sid || ""
				} })), (err) => setSendMsg((m) => Object.assign({}, m || {}, { [id]: {
					kind: "err",
					text: String(err && err.message || err),
					next: "再按一次。"
				} })));
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
				if (r && r.ok === false) setSendMsg((m) => Object.assign({}, m || {}, { jumpErr: "跳转失败：" + (r.error && (r.error.message || r.error.code) || "未知原因") + "　—— 你可以在左侧列表里按标题找到它。" }));
			};
			/** 点一条 → 正文滚到那一块（不依赖 markdown 渲染器支持行锚点） */
			const goto = (idx) => {
				setSel(Number(idx));
				const box = bodyRef.current;
				if (!box || !box.querySelector || Number(idx) < 0) return;
				const el = box.querySelector("[data-blk=\"" + Number(idx) + "\"]");
				if (el && el.scrollIntoView) el.scrollIntoView({ block: "start" });
			};
			const IN = {
				flex: "1 1 auto",
				font: "inherit",
				fontSize: "11.5px",
				padding: "5px 8px",
				border: "1px solid " + C.soft,
				borderRadius: "4px",
				boxSizing: "border-box"
			};
			const LABEL = {
				fontSize: "10.5px",
				color: C.muted,
				marginBottom: "3px"
			};
			const field = (key, label, value, set, placeholder, rows) => h("div", {
				key,
				style: { marginBottom: "7px" }
			}, [h("div", {
				key: "l",
				style: LABEL
			}, label), rows ? h("textarea", {
				key: "i",
				value,
				placeholder,
				rows,
				onChange: (ev) => set(ev.target.value),
				style: Object.assign({}, IN, {
					width: "100%",
					resize: "vertical",
					fontFamily: "inherit"
				})
			}) : h("input", {
				key: "i",
				value,
				placeholder,
				onChange: (ev) => set(ev.target.value),
				style: Object.assign({}, IN, { width: "100%" })
			})]);
			const fold = (key, title, open, onToggle, kids, extra) => h("div", {
				key,
				style: Object.assign({ marginTop: "10px" }, extra && extra.style || {})
			}, [h("button", {
				key: "s",
				type: "button",
				"data-fold": key,
				"data-open": open ? "1" : "0",
				"data-btn": extra && extra.btn ? extra.btn : "link",
				onClick: onToggle,
				"aria-expanded": open ? "true" : "false",
				style: {
					font: "inherit",
					fontSize: "12.5px",
					textAlign: "left",
					cursor: "pointer",
					border: "1px solid " + (extra && extra.solid ? C.soft : "transparent"),
					background: "#fff",
					borderRadius: "4px",
					padding: extra && extra.solid ? "4px 10px" : "0",
					color: extra && extra.tone || C.muted,
					textDecoration: extra && extra.solid ? "none" : "underline"
				}
			}, [
				h("span", {
					key: "a",
					"data-fold-arrow": open ? "1" : "0"
				}, open ? "▾ " : "▸ "),
				h("span", { key: "b" }, title),
				open && extra && extra.openHint ? h("span", {
					key: "c",
					style: {
						color: C.muted,
						marginLeft: "6px"
					}
				}, extra.openHint) : null
			]), open ? h("div", {
				key: "b",
				"data-fold-body": key
			}, kids) : null]);
			/** 一行状态 + 一个小标记（**人话**：不带 `missing-pending` 这种机器口径） */
			const sayLine = (key, text, tone, chip) => h("div", {
				key,
				"data-say": key,
				style: {
					display: "flex",
					gap: "8px",
					alignItems: "baseline",
					flexWrap: "wrap"
				}
			}, [h("span", {
				key: "t",
				"data-say-text": key,
				style: {
					fontSize: "12.5px",
					lineHeight: "1.75",
					color: tone === "warn" ? C.ink : C.ink
				}
			}, text), chip ? h("span", {
				key: "c",
				"data-chip": key,
				style: {
					fontSize: "11.5px",
					color: tone === "ok" ? C.ok : tone === "warn" ? C.warn : C.muted,
					border: "1px solid " + (tone === "ok" ? C.ok : tone === "warn" ? C.warn : C.soft),
					borderRadius: "2px",
					padding: "0 5px",
					whiteSpace: "nowrap"
				}
			}, chip) : null]);
			/** 次按钮（首屏上除主按钮之外的一切动作都必须是它或链接） */
			const ghost = (key, label, onClick, title, dis) => h("button", {
				key,
				type: "button",
				"data-btn": "ghost",
				onClick,
				title: title || "",
				style: {
					font: "inherit",
					fontSize: "11.5px",
					padding: "4px 11px",
					borderRadius: "4px",
					border: "1px solid " + (dis ? C.faint : C.soft),
					background: "#fff",
					color: dis ? C.muted : C.ink,
					cursor: "pointer"
				}
			}, label);
			/** 指令预览 + 发送 + 回报（**预览就是发出去的原文**；卡上看到的 = 发出去的） */
			const actBlock = (key, id, b, goLabel, hint) => {
				const m = (sendMsg || {})[id];
				return h("div", {
					key,
					"data-actbox": id,
					style: {
						marginTop: "8px",
						borderTop: "1px solid " + C.faint,
						paddingTop: "7px"
					}
				}, [
					b.blocked ? h("div", {
						key: "blk",
						"data-blocked": id,
						style: {
							fontSize: "11.5px",
							color: C.bad,
							background: "#fef2f2",
							border: "1px solid " + C.faint,
							borderRadius: "3px",
							padding: "6px 8px",
							marginBottom: "7px",
							lineHeight: 1.75
						}
					}, [h("div", { key: "a" }, "✗ " + b.blocked), b.next ? h("div", {
						key: "b",
						style: { color: C.ink }
					}, "下一步：" + b.next) : null]) : null,
					b.instruction ? h("div", {
						key: "pv",
						style: { marginBottom: "7px" }
					}, [h("div", {
						key: "t",
						style: LABEL
					}, "组出来的指令 —— 下面这段就是发给工作会话的原文（卡上看到的 = 发出去的）："), h("pre", {
						key: "v",
						"data-kind": id,
						style: {
							margin: "3px 0 0",
							padding: "6px 8px",
							background: C.bg,
							border: "1px solid " + C.faint,
							borderRadius: "3px",
							fontFamily: "monospace",
							fontSize: "10.5px",
							lineHeight: 1.6,
							whiteSpace: "pre-wrap",
							color: C.ink,
							userSelect: "text",
							maxHeight: "26vh",
							overflow: "auto"
						}
					}, b.instruction)]) : null,
					h("div", {
						key: "act",
						style: {
							display: "flex",
							gap: "8px",
							alignItems: "center",
							flexWrap: "wrap"
						}
					}, [h("button", {
						key: "go",
						type: "button",
						"data-send": id,
						onClick: b === builtWire ? sendWire : b === builtCfg ? sendCfg : b === builtInt ? sendInt : sendOne.bind(null, id, b),
						style: {
							font: "inherit",
							fontSize: "11.5px",
							padding: "5px 12px",
							borderRadius: "4px",
							border: "1px solid " + (b.blocked ? C.soft : C.link),
							background: b.blocked ? "#fff" : C.link,
							color: b.blocked ? C.muted : "#fff",
							cursor: "pointer"
						}
					}, goLabel), h("span", {
						key: "n",
						style: {
							fontSize: "10.5px",
							color: C.muted
						}
					}, hint || "发到：本功能的专属工作会话" + (root ? "（cwd " + winPath(root) + "）" : "") + "　—— 不占用你自己的对话")]),
					m ? h("div", {
						key: "m",
						style: {
							fontSize: "11px",
							marginTop: "6px",
							lineHeight: 1.75,
							color: m.kind === "err" || m.kind === "blocked" ? C.bad : m.kind === "ok" ? C.ok : C.muted
						}
					}, [
						h("div", { key: "t" }, (m.kind === "ok" ? "✓ " : m.kind === "pending" ? "" : "✗ ") + m.text),
						m.kind === "ok" ? h("div", {
							key: "d",
							"data-sent": "ok",
							style: {
								color: C.muted,
								userSelect: "text"
							}
						}, [
							h("div", { key: "s" }, "阶段交给了 skill，进度与提问都在那个会话里 —— 面板不重画流程，跑完回本页重进就能看到产物。"),
							h("div", { key: "g" }, "目标：" + (m.target && m.target.title || "工作会话") + (m.sid ? "　会话 " + String(m.sid).slice(0, 12) + "…" : "") + (m.target && m.target.root ? "　cwd " + winPath(m.target.root) : "") + "　（" + pickSourceText(m.target && m.target.source) + "）"),
							m.healed ? h("div", {
								key: "h",
								style: { color: C.warn }
							}, "上一轮记的那条会话已经不在了 —— 已自动重建一条并重发。") : null,
							m.queued ? h("div", {
								key: "q",
								style: { color: C.warn }
							}, "它正在跑别的活，这条指令排在队列里，等它跑完当前这一轮就会处理。") : null
						]) : null,
						m.kind === "err" || m.kind === "blocked" ? h("div", {
							key: "n",
							"data-sent": "fail",
							style: { color: C.ink }
						}, "下一步：" + (m.next || "再按一次。")) : null,
						m.sid && props.onOpenSession ? h("button", {
							key: "j",
							type: "button",
							"data-jump": m.sid,
							onClick: () => jump(m.sid),
							style: {
								font: "inherit",
								fontSize: "11px",
								padding: "2px 9px",
								marginTop: "3px",
								border: "1px solid " + C.soft,
								background: "#fff",
								borderRadius: "4px",
								cursor: "pointer"
							}
						}, "跳到那个会话 ›") : null
					]) : null
				]);
			};
			const form = () => {
				if (e.id === "create") return [field("s", "要写成什么（我的意图；选填 —— 空着就按上游材料与 VOI 门现场确认）", seed, setSeed, "比如：把 sr-analysis 的复刻规格落成成稿，重点写清出刀时机与难度推进", 2), field("m", "上游材料（选填，目录 / 文件路径 / 链接，可多行）", mats, setMats, "D:\\TimeMachine\\GameDesignOS\\workspace\\features\\联盟悬赏\\analysis\\feature-concept_联盟悬赏_20260918.md", 2)];
				if (e.id === "revise") return [
					field("w", "改哪儿（条目引用 / 章组号）", where, setWhere, "§4 R6 奖励　或　§5 UI-M1", 1),
					field("b", "现状原文（逐字 —— 行号会漂，原文不会）", before, setBefore, "| 终结奖励 | 击杀 BOSS（打出终结一击）的玩家获得… |", 3),
					field("t", "要改成什么（一句话）", intent, setIntent, "终结奖励与通关奖励合并为一个宝箱入口", 1)
				];
				return [];
			};
			const card = (a) => {
				const on = a.id === e.id;
				return h("button", {
					key: "card-" + a.id,
					type: "button",
					"data-dcard": a.id,
					"data-active": on ? "1" : "0",
					onClick: () => {
						setAct(a.id);
						setSendMsg(null);
					},
					style: {
						flex: "1 1 200px",
						minWidth: "200px",
						textAlign: "left",
						font: "inherit",
						cursor: "pointer",
						border: "1px solid " + (on ? C.ink : C.faint),
						borderTop: "3px solid " + (on ? C.ink : C.soft),
						background: on ? "#fff" : C.bg,
						borderRadius: "4px",
						padding: "7px 9px"
					}
				}, [
					h("div", {
						key: "t",
						style: {
							fontSize: "12px",
							fontWeight: 600,
							color: C.ink
						}
					}, a.label),
					h("div", {
						key: "h",
						style: {
							fontSize: "10px",
							color: C.link,
							fontFamily: "monospace",
							marginTop: "2px"
						}
					}, a.hint),
					h("div", {
						key: "n",
						style: {
							fontSize: "10px",
							color: C.muted,
							marginTop: "4px",
							lineHeight: 1.65
						}
					}, "前置：" + a.needs),
					h("div", {
						key: "o",
						style: {
							fontSize: "10px",
							color: C.muted,
							marginTop: "3px",
							lineHeight: 1.65
						}
					}, "产出：" + a.output)
				]);
			};
			const STAGE_TONE = {
				"before-draft": C.muted,
				"rules-ready": C.link,
				"integrating": C.warn,
				"missing-pending": C.warn,
				"missing-nofields": C.warn,
				landed: C.ok
			};
			const tone = config && STAGE_TONE[config.stage] || C.muted;
			const cfgBox = config ? h("div", {
				key: "cfg",
				"data-config-stage": config.stage,
				"data-config-label": config.label,
				style: {
					border: "1px solid " + C.faint,
					borderLeft: "3px solid " + tone,
					background: "#fff",
					borderRadius: "4px",
					padding: "8px 11px",
					marginBottom: "10px"
				}
			}, [
				h("div", {
					key: "h",
					style: {
						display: "flex",
						alignItems: "baseline",
						gap: "8px",
						flexWrap: "wrap"
					}
				}, [
					h("b", {
						key: "t",
						style: { fontSize: "12px" }
					}, "配置支线走到哪"),
					h("span", {
						key: "v",
						style: {
							fontSize: "12px",
							color: tone,
							fontWeight: 600
						}
					}, config.label),
					h("span", {
						key: "m",
						style: {
							fontSize: "10.5px",
							color: C.muted,
							fontFamily: "monospace"
						}
					}, "（机器口径 " + String(data && data.configMis && data.configMis.stage || config.stage) + "）")
				]),
				h("div", {
					key: "r",
					"data-config-reason": config.reason,
					style: {
						fontSize: "10.5px",
						color: C.muted,
						marginTop: "4px",
						lineHeight: 1.75,
						userSelect: "text"
					}
				}, "依据：" + config.reason),
				h("div", {
					key: "s",
					"data-config-steps": config.steps.map((x) => (x.done ? "✔" : "○") + x.key).join(","),
					style: {
						display: "flex",
						gap: "8px",
						flexWrap: "wrap",
						marginTop: "6px"
					}
				}, config.steps.map((x, i) => h("div", {
					key: i,
					"data-step": x.key,
					"data-done": x.done ? "1" : "0",
					style: {
						flex: "1 1 190px",
						minWidth: "190px",
						border: "1px solid " + (x.done ? C.ok : C.soft),
						borderLeft: "3px solid " + (x.done ? C.ok : C.soft),
						background: x.done ? "#f0fdf4" : "#fff",
						borderRadius: "4px",
						padding: "4px 8px"
					}
				}, [h("div", {
					key: "l",
					style: {
						fontSize: "10.5px",
						fontWeight: 600,
						color: x.done ? C.ok : C.muted
					}
				}, (x.done ? "✔ " : "○ ") + x.label), h("div", {
					key: "e",
					style: {
						fontSize: "10px",
						color: C.muted,
						fontFamily: "monospace",
						lineHeight: 1.6,
						wordBreak: "break-all"
					}
				}, x.evidence)]))),
				(config.missing || []).length ? h("div", {
					key: "m",
					"data-config-missing": String(config.missing.length),
					style: {
						marginTop: "6px",
						borderTop: "1px solid " + C.faint,
						paddingTop: "5px"
					}
				}, [h("div", {
					key: "t",
					style: {
						fontSize: "11px",
						color: C.warn
					}
				}, "⚠ 缺口 / 缺件 " + config.missing.length + " 条（逐条）"), h("div", {
					key: "l",
					style: { marginTop: "3px" }
				}, config.missing.map((m, i) => h("div", {
					key: i,
					"data-missing": String(i),
					style: {
						fontSize: "10.5px",
						color: C.ink,
						lineHeight: 1.75,
						userSelect: "text"
					}
				}, "· " + m)))]) : h("div", {
					key: "nm",
					style: {
						fontSize: "11px",
						color: C.ok,
						marginTop: "5px"
					}
				}, "✔ 没有待配表缺口、没有缺件"),
				h("div", {
					key: "n",
					style: {
						fontSize: "10px",
						color: C.muted,
						marginTop: "5px",
						lineHeight: 1.7
					}
				}, "面板只显示配置支线走到哪（读定稿 §6 + `evidence\\readback_*` + 配置表文件名的存在性）—— **配置表的读写仍在 /sr-config 与配置表工具侧**，这里不解析工作簿、不改表。"),
				h("div", {
					key: "p",
					style: {
						fontSize: "10px",
						color: C.muted,
						marginTop: "4px",
						lineHeight: 1.7
					}
				}, "措辞上的两种缺口（别混）：①「**是缺口**」= §6 / §6.5 里状态列确实写着「待配表」（上面缺口清单第 1 条那种）；②「**面板看不到读回回执**」= `evidence\\readback_*` 一份都没有 —— **不等于**没验收过（回执可能还没落盘）。")
			]) : null;
			const partCard = (p) => h("button", {
				key: "part-" + p.key,
				type: "button",
				"data-part": p.key,
				onClick: () => goto(p.idx),
				title: "点它跳到正文里的这一部分",
				style: {
					flex: "1 1 320px",
					minWidth: "300px",
					textAlign: "left",
					font: "inherit",
					cursor: "pointer",
					border: "1px solid " + C.faint,
					borderLeft: "3px solid " + C.link,
					background: "#fff",
					borderRadius: "4px",
					padding: "7px 10px"
				}
			}, [
				h("div", {
					key: "t",
					style: {
						fontSize: "12px",
						fontWeight: 600,
						color: C.ink
					}
				}, "§" + p.no + " " + p.label + "　"),
				h("div", {
					key: "n",
					style: {
						fontSize: "10.5px",
						color: C.muted,
						fontFamily: "monospace",
						marginTop: "2px"
					}
				}, "L" + p.line + "–L" + p.endLine + "　" + p.groups + " 组 / " + p.items + " 条" + (p.skipped ? " / " + p.skipped + " 行不可引用" : "")),
				h("div", {
					key: "d",
					style: {
						fontSize: "10px",
						color: C.muted,
						marginTop: "3px",
						lineHeight: 1.65
					}
				}, p.note)
			]);
			const LNUM = {
				fontSize: "9.5px",
				color: C.muted,
				fontFamily: "monospace",
				marginLeft: "6px",
				flex: "0 0 auto"
			};
			const lnum = (line) => h("span", {
				key: "L",
				style: LNUM
			}, "L" + line);
			const toc = [];
			if (doc && doc.tree) {
				toc.push(h("div", {
					key: "head",
					style: {
						fontSize: "11px",
						color: C.muted,
						marginBottom: "8px",
						lineHeight: 1.6,
						userSelect: "text"
					}
				}, [h("div", { key: "a" }, (data && data.name) + " · " + doc.counts.chapters + " 章 / " + doc.counts.groups + " 组 / " + (doc.counts.rules + doc.counts.ues) + " 条（两大部分）"), h("div", { key: "b" }, "点任一行 → 右边正文滚到那一块；§4 / §5 是后面两条支线的依据")]));
				for (const c of doc.tree.chapters) {
					const ck = "ch" + c.no;
					const cOpen = openG[ck] === void 0 ? c.open : !!openG[ck];
					const pk = partOfNo(c.no);
					const cnt = [];
					if (c.groups.length) cnt.push(c.groups.length + " 组");
					if (c.items.length) cnt.push(c.items.length + " 条");
					if (c.skipped) cnt.push(c.skipped + " 行不可引用");
					toc.push(h("div", {
						key: ck,
						"data-ch": c.no,
						"data-part": pk,
						title: c.text,
						onClick: () => {
							if (c.items.length) {
								const nx = Object.assign({}, openG);
								nx[ck] = !cOpen;
								setOpenG(nx);
							}
							goto(c.idx);
						},
						style: {
							display: "flex",
							alignItems: "baseline",
							cursor: "pointer",
							userSelect: "none",
							fontSize: "12px",
							fontWeight: 600,
							margin: "8px 0 3px",
							color: sel === c.idx ? C.link : pk ? C.ink : C.muted
						}
					}, [
						h("span", {
							key: "t",
							style: {
								fontSize: "9px",
								color: C.muted,
								marginRight: "4px",
								width: "9px",
								flex: "0 0 9px",
								textAlign: "center"
							}
						}, c.items.length ? cOpen ? "▾" : "▸" : "·"),
						h("span", { key: "l" }, "§" + c.no + " " + c.title + (pk ? "  ★" : "") + (!cOpen && cnt.length ? "  (" + cnt.join(" · ") + ")" : "")),
						h("span", {
							key: "sp",
							style: { flex: "1 1 auto" }
						}, ""),
						lnum(c.line)
					]));
					if (cOpen) for (const it of c.items) toc.push(tocItem(it, c.idx, c.no));
					for (const g of c.groups) {
						const tag = gk(g);
						const gkey = "g" + g.idx;
						const isOpen = openG[gkey] === void 0 ? g.open : !!openG[gkey];
						const gc = g.items.length ? g.items.length + " 条" : "";
						const gs = g.skipped ? (gc ? " · " : "") + g.skipped + " 行不可引用" : "";
						toc.push(h("div", {
							key: gkey,
							"data-group": tag,
							"data-ch": c.no,
							title: g.text,
							onClick: () => {
								if (g.items.length) {
									const nx = Object.assign({}, openG);
									nx[gkey] = !isOpen;
									setOpenG(nx);
								}
								goto(g.idx);
							},
							style: {
								display: "flex",
								alignItems: "baseline",
								cursor: "pointer",
								userSelect: "none",
								padding: "2px 0 2px 10px",
								borderRadius: "3px",
								borderLeft: "2px solid " + (sel === g.idx ? C.link : "transparent")
							}
						}, [
							h("span", {
								key: "t",
								style: {
									fontSize: "9px",
									color: C.muted,
									marginRight: "4px",
									width: "9px",
									flex: "0 0 9px",
									textAlign: "center"
								}
							}, g.items.length ? isOpen ? "▾" : "▸" : "·"),
							h("span", {
								key: "l",
								style: {
									fontSize: "11.5px",
									color: sel === g.idx ? C.link : C.muted
								}
							}, (tag ? tag + "  " : "") + g.title + (gc || gs ? "  (" + gc + gs + ")" : "")),
							h("span", {
								key: "sp",
								style: { flex: "1 1 auto" }
							}, ""),
							lnum(g.line)
						]));
						if (isOpen) for (const it of g.items) toc.push(tocItem(it, g.idx, c.no));
					}
				}
			}
			function tocItem(it, idx, chNo) {
				const tag = partTag(chNo);
				return h("div", {
					key: "it" + chNo + "-" + it.line + "-" + it.label,
					"data-line": String(it.line),
					"data-label": String(it.label),
					"data-part": partOfNo(chNo),
					title: "L" + it.line + "　" + it.text,
					onClick: () => goto(idx),
					style: {
						display: "flex",
						alignItems: "baseline",
						fontSize: "11px",
						cursor: "pointer",
						userSelect: "none",
						padding: "1px 4px 1px 22px",
						borderRadius: "3px",
						color: C.muted,
						background: "transparent",
						whiteSpace: "nowrap",
						overflow: "hidden"
					}
				}, [
					h("span", {
						key: "l",
						style: {
							overflow: "hidden",
							textOverflow: "ellipsis"
						}
					}, it.label),
					tag ? h("span", {
						key: "p",
						style: {
							color: C.muted,
							marginLeft: "5px",
							fontSize: "9.5px"
						}
					}, tag) : null,
					h("span", {
						key: "sp",
						style: { flex: "1 1 auto" }
					}, ""),
					lnum(it.line)
				]);
			}
			const labelOf = (b) => {
				if (b.level === 2) return "§" + b.no + " " + (b.title || "");
				const id = b.id || b.no || "";
				return (b.no && b.chNo && String(b.no).indexOf(String(b.chNo) + ".") === 0 ? "" : "§" + (b.chNo || "?") + " ") + id + " " + (b.title || "");
			};
			const absOf = (v) => {
				if (!v || typeof v !== "string") return void 0;
				if (!/\.(png|jpe?g|gif|webp|svg)$/i.test(v)) return void 0;
				const isAbs = /^[A-Za-z]:[\\/]/.test(v) || v.charAt(0) === "/";
				const dir = String(data && data.path || "").replace(/[\\/][^\\/]*$/, "");
				return isAbs ? v : dir + "/" + v;
			};
			const pathImages = {
				abs: absOf,
				resolve: (v) => {
					const a = absOf(v);
					return a ? fileUrl(a) : void 0;
				}
			};
			const body = doc && doc.doc && (doc.doc.blocks || []).length ? doc.doc.blocks.map((b, i) => h("div", {
				key: "b" + i,
				"data-blk": String(i),
				style: {
					padding: "2px 8px 4px 10px",
					marginBottom: "6px",
					borderRadius: "3px",
					borderLeft: "3px solid " + (sel === i ? C.link : "transparent"),
					background: sel === i ? "#f0f7ff" : "transparent"
				}
			}, h(BlockBoundary, {
				key: "bb",
				label: labelOf(b).trim() + "（L" + b.line + "）"
			}, splitSpecial(b.text).map((p, j) => {
				if (p.t === "img") return h(ImgTag, {
					key: "i" + j,
					src: p.v,
					alt: p.alt,
					pathImages,
					onOpen: props.onOpen || null
				});
				if (p.t === "code") return h(CodeBlock, {
					key: "c" + j,
					text: p.v
				});
				return h(Md, {
					key: "m" + j,
					text: p.v,
					pathImages
				});
			})))) : null;
			const paperActs = h("div", {
				key: "acts",
				"data-row": "actions",
				style: {
					border: "1px solid " + C.faint,
					borderRadius: "4px",
					background: "#fff",
					padding: "9px 11px",
					marginBottom: "10px"
				}
			}, [
				h("div", {
					key: "h",
					style: {
						fontSize: "11.5px",
						fontWeight: 600,
						marginBottom: "6px"
					}
				}, "成稿纸面上的动作（一条链，有先后：写成稿 → 改成稿）—— 它们改的是**规则与界面流程本身**"),
				h("div", {
					key: "row",
					"data-row": "actioncards",
					style: {
						display: "flex",
						gap: "8px",
						flexWrap: "wrap",
						marginBottom: "8px"
					}
				}, cardIds.map((id) => defOf(id)).map(card)),
				h("div", {
					key: "d",
					"data-action": e.id,
					style: {
						borderTop: "1px solid " + C.faint,
						paddingTop: "8px"
					}
				}, [
					h("div", {
						key: "t",
						style: {
							fontSize: "11.5px",
							marginBottom: "6px"
						}
					}, [h("b", { key: "b" }, e.label + "　"), h("span", {
						key: "s",
						style: {
							color: C.muted,
							fontSize: "10.5px"
						}
					}, e.hint + "　前置：" + e.needs)]),
					h("div", { key: "f" }, form()),
					actBlock("ab", e.id, built, "发到工作会话"),
					h("div", {
						key: "ho",
						"data-handoff": e.id,
						style: {
							fontSize: "10.5px",
							color: C.muted,
							marginTop: "5px",
							lineHeight: 1.7
						}
					}, "发起后：" + e.handoff + " —— 面板只给「跳到那个会话」。")
				])
			]);
			/** 「看正文」折里的内容：标题一栏 + 左树 + 分块正文（**默认收起**，点开才渲染） */
			const foldBody = doc && doc.tree ? h("div", { style: {
				display: "flex",
				flexDirection: "column",
				gap: "12px",
				marginTop: "4px"
			} }, [paperActs, h("div", {
				key: "cols",
				style: {
					display: "flex",
					gap: "16px",
					alignItems: "flex-start"
				}
			}, [h("div", {
				key: "toc",
				style: {
					flex: "0 0 272px",
					width: "272px",
					maxHeight: "62vh",
					overflow: "auto",
					borderRight: "1px solid " + C.faint,
					paddingRight: "10px"
				}
			}, [h("div", {
				key: "head",
				style: {
					fontSize: "11px",
					color: C.muted,
					marginBottom: "8px",
					lineHeight: 1.7,
					userSelect: "text"
				}
			}, [h("div", { key: "a" }, (data && data.name) + " · " + doc.counts.chapters + " 章 / " + doc.counts.groups + " 组 / " + (doc.counts.rules + doc.counts.ues) + " 条（两大部分）"), h("div", { key: "b" }, "点任一行 → 右边正文滚到那一块；§4 / §5 是后面两条支线的依据")]), toc]), h("div", {
				key: "body",
				ref: bodyRef,
				style: {
					flex: "1 1 auto",
					minWidth: 0,
					maxHeight: "62vh",
					overflow: "auto"
				}
			}, body)])]) : null;
			const wireInput = h("div", {
				key: "wi",
				"data-wire-input": "1",
				style: { marginTop: "7px" }
			}, [
				h("div", {
					key: "t",
					style: {
						fontSize: "11px",
						color: C.muted,
						lineHeight: 1.7,
						marginBottom: "5px"
					}
				}, "面板拿不到二进制 —— **路径是唯一的可靠输入**。粘进下面这一框，或从 `gdd\\UI\\` 已备好的图里点一个（可多选）。"),
				field("wp", "界面图路径（一行一条；本机文件 / 目录 / 链接都行）", wirePaste, setWirePaste, "D:\\…\\features\\联盟悬赏\\gdd\\UI\\UI-M1 联盟悬赏主面板 · 常规难度.png", 2),
				data && (data.uiImages || []).length ? h("div", {
					key: "pk",
					style: { marginBottom: "7px" }
				}, [h("div", {
					key: "l",
					style: LABEL
				}, "从 `gdd\\UI\\` 里挑（" + (data.uiImages || []).length + " 张；点一下加入/移出）"), h("div", {
					key: "r",
					style: {
						display: "flex",
						gap: "6px",
						flexWrap: "wrap"
					}
				}, (data.uiImages || []).map((im, i) => {
					const on = picked.indexOf(im.abs) >= 0;
					return h("button", {
						key: "p" + i,
						type: "button",
						"data-pick": im.name,
						"data-picked": on ? "1" : "0",
						title: im.abs,
						onClick: () => setPicked((prev) => prev.indexOf(im.abs) >= 0 ? prev.filter((x) => x !== im.abs) : prev.concat([im.abs])),
						style: {
							font: "inherit",
							fontSize: "11px",
							padding: "3px 9px",
							borderRadius: "4px",
							cursor: "pointer",
							border: "1px solid " + (on ? C.ink : C.soft),
							background: on ? C.ink : "#fff",
							color: on ? "#fff" : C.ink
						}
					}, (on ? "✓ " : "") + im.name);
				}))]) : h("div", {
					key: "np",
					"data-wire-none": "1",
					style: {
						fontSize: "11px",
						color: C.warn,
						marginBottom: "7px",
						lineHeight: 1.7
					}
				}, "`gdd\\UI\\` 里这次没列到界面图" + (data && data.uiWhy ? "（" + data.uiWhy + "）" : "") + " —— 那就把图**放进去**再回来，或直接粘一个别的路径。"),
				h("div", {
					key: "c",
					"data-wire-count": String(wirePaths.length),
					style: {
						fontSize: "11px",
						color: C.muted
					}
				}, "已经给了 " + wirePaths.length + " 条路径。"),
				h("div", {
					key: "f",
					style: {
						fontSize: "10.5px",
						color: C.muted,
						marginTop: "4px",
						lineHeight: 1.7
					}
				}, "现状原文（面板读出来的 §5 ASCII 占位，会一并带进指令）：" + (data && (data.ascii || []).length ? (data.ascii || []).map((x) => "§" + x.no + (x.id ? " " + x.id : "") + " L" + x.line + "（约 " + x.lines + " 行）").join(" · ") : "这次没在 §5 里认出 ASCII 占位（可能已经是图片引用了）"))
			]);
			const noDoc = !(data && data.path);
			const topExtra = doc ? "已就绪 · " + (data && data.kb || 0) + " KB · " + doc.counts.chapters + " 章" : notes.length ? "还没读到成稿 —— 先看下面的说明" : "还没读到成稿";
			const top = h("div", {
				key: "top",
				"data-node": "top",
				style: {
					border: "1px solid " + C.faint,
					borderRadius: "4px",
					background: "#fff",
					padding: "11px 13px"
				}
			}, [
				h("div", {
					key: "r",
					style: {
						display: "flex",
						gap: "10px",
						alignItems: "baseline",
						flexWrap: "wrap",
						justifyContent: "space-between"
					}
				}, [h("span", {
					key: "t",
					"data-node-title": "top",
					style: {
						fontSize: "14px",
						fontWeight: 600,
						color: C.ink
					}
				}, data && data.date ? "成稿 · " + data.date : doc ? "成稿" : "成稿（还没有）"), h("span", {
					key: "m",
					"data-node-meta": "top",
					style: {
						fontSize: "12px",
						color: C.muted
					}
				}, topExtra)]),
				noDoc ? h("div", {
					key: "n",
					style: {
						fontSize: "11.5px",
						color: C.muted,
						marginTop: "6px",
						lineHeight: 1.75
					}
				}, "这个功能目录的 `gdd\\` 里还没有成稿 —— 这一屏的第一个动作就是「写成稿」（在下面的〔看正文〕里）。") : null,
				doc && doc.parts.length ? fold("parts", openParts ? "收起两大部分" : "两大部分（点开看，默认收起）", openParts, () => setOpenParts(!openParts), h("div", {
					key: "pp",
					style: { marginTop: "8px" }
				}, [h("div", {
					key: "row",
					"data-row": "parts",
					style: {
						display: "flex",
						gap: "8px",
						flexWrap: "wrap"
					}
				}, doc.parts.map(partCard)), h("div", {
					key: "n",
					style: {
						fontSize: "10.5px",
						color: C.muted,
						marginTop: "7px",
						lineHeight: 1.75
					}
				}, "这两部分是下面两条支线的依据：配置表从「功能规则」派生，线框图替换针对「用户体验与界面流程」。")])) : h("div", {
					key: "pn",
					style: {
						fontSize: "11.5px",
						color: doc ? C.warn : C.muted,
						marginTop: "8px",
						lineHeight: 1.75
					}
				}, doc ? "⚠ 没认出两大部分（缺：" + doc.missingParts.join(" / ") + "）—— 面板不硬指一个章号，请核对成稿的章标题。" : "（还没读到成稿，两大部分为空）"),
				doc && doc.tree && (doc.tree.chapters || []).length ? fold("body", openBody ? "收起正文" : "看正文（" + (data && data.kb || 0) + " KB / " + doc.lines + " 行 / " + doc.counts.chapters + " 章 —— 左树 + 分块正文，点开才读）", openBody, () => setOpenBody(!openBody), foldBody, { style: { marginTop: "8px" } }) : null
			]);
			const branches = h("div", {
				key: "br",
				"data-node": "mid",
				style: {
					display: "grid",
					gap: "12px",
					gridTemplateColumns: "1fr 1fr"
				}
			}, [h("div", {
				key: "a",
				"data-branch": "config",
				style: {
					border: "1px solid " + C.faint,
					borderRadius: "4px",
					background: "#fff",
					padding: "11px 13px"
				}
			}, [
				h("div", {
					key: "h",
					style: {
						display: "flex",
						gap: "8px",
						alignItems: "baseline",
						justifyContent: "space-between",
						flexWrap: "wrap"
					}
				}, [h("span", {
					key: "n",
					style: {
						fontSize: "12.5px",
						fontWeight: 600
					}
				}, "支线 A · 配置表"), h("span", {
					key: "s",
					"data-branch-state": "config",
					style: {
						fontSize: "11px",
						color: (story.config && story.config.tone) === "warn" ? C.warn : (story.config && story.config.tone) === "ok" ? C.ok : C.muted
					}
				}, story.config && story.config.gap ? "还有没填的" : "已就绪")]),
				sayLine("config", story.config && story.config.label || "（还没读到配置支线的状态）", story.config && story.config.tone || "info", data && data.configMis && data.configMis.gapCount ? "缺 " + data.configMis.gapCount + " 处" : ""),
				h("div", {
					key: "b",
					style: {
						marginTop: "9px",
						display: "flex",
						gap: "8px",
						alignItems: "center",
						flexWrap: "wrap"
					}
				}, [ghost("gc", openCfg ? "收起" : "去配表", () => setOpenCfg(!openCfg), "把「§4 的规则 → 哪张表 / 哪个字段 → 缺口在哪」组装成指令，发给本功能的专属工作会话"), h("span", {
					key: "h",
					style: {
						fontSize: "10.5px",
						color: C.muted
					}
				}, "跑 /sr-config：字段落表在那边做，面板不改表")]),
				openCfg ? h("div", {
					key: "oc",
					"data-wire-input": "config",
					style: { marginTop: "7px" }
				}, [field("ci", "这次要改的（选填，一句话）", intent, setIntent, "比如：把 §6.5 L363 的活动周期 / 排行过滤门槛 / 展示上限落到 A012-全局变量表", 2), actBlock("cb", "config", builtCfg, "发「去配表」到工作会话")]) : null
			]), h("div", {
				key: "b",
				"data-branch": "wire",
				style: {
					border: "1px solid " + C.faint,
					borderRadius: "4px",
					background: "#fff",
					padding: "11px 13px"
				}
			}, [
				h("div", {
					key: "h",
					style: {
						display: "flex",
						gap: "8px",
						alignItems: "baseline",
						justifyContent: "space-between",
						flexWrap: "wrap"
					}
				}, [h("span", {
					key: "n",
					style: {
						fontSize: "12.5px",
						fontWeight: 600
					}
				}, "支线 B · 线框图"), h("span", {
					key: "s",
					"data-branch-state": "wire",
					style: {
						fontSize: "11px",
						color: (story.wire && story.wire.tone) === "warn" ? C.warn : C.muted
					}
				}, data && (data.uiImages || []).length ? "待提交 " + data.uiImages.length + " 张" : "还没有图")]),
				sayLine("wire", story.wire && story.wire.label || "（还没读到线框图支线的状态）", story.wire && story.wire.tone || "info", wirePaths.length ? "已给 " + wirePaths.length + " 条路径" : ""),
				h("div", {
					key: "b2",
					style: {
						marginTop: "9px",
						display: "flex",
						gap: "8px",
						alignItems: "center",
						flexWrap: "wrap"
					}
				}, [ghost("gw", openWire ? "收起" : "提交线框图", () => setOpenWire(!openWire), "先展开输入（粘路径，或从 gdd\\UI\\ 里挑），有输入才发指令"), h("span", {
					key: "h",
					style: {
						fontSize: "10.5px",
						color: C.muted
					}
				}, "落 §5：把 ASCII 占位换成 <img src=…>")]),
				openWire ? h("div", {
					key: "ow",
					style: { marginTop: "7px" }
				}, [wireInput, actBlock("wb", "wireframe", builtWire, "发「提交线框图」到工作会话")]) : null
			])]);
			/**
			* ★ 工单 25 · **定稿门**（合流之后的落点）：这份定稿能不能交给程序。
			*
			* 三条口径（与本票的工单逐条对应）：
			*   ① **审查是必经的一步** —— 没跑审查 / 报告比定稿旧 / 看不到时间，一律**不标为可用**（`gate.canHandOff`）；
			*   ② **人话在首屏、口径在门里** —— 首屏只有一行 `定稿门 · <headline>`，三种告警与时间折进〔看定稿门〕；
			*   ③ 判据**不在这里算** —— `gate` 是 `loadFeatureDetail` 里 `finalGate()` 的返回值（纯函数、有回归网）。
			*/
			const gate = data && data.gate || null;
			const gateLine = gate ? h("div", {
				key: "g",
				"data-gate": gate.state,
				style: {
					marginTop: "5px",
					display: "flex",
					gap: "8px",
					alignItems: "baseline",
					flexWrap: "wrap"
				}
			}, [h("span", {
				key: "s",
				"data-gate-say": "1",
				style: {
					fontSize: "12.5px",
					lineHeight: 1.7,
					color: gate.state === "ok" ? C.ok : C.ink
				}
			}, "定稿门 · " + gate.headline), gate.review && gate.review.state === "unknown-time" ? h("span", {
				key: "u",
				"data-gate-notime": "1",
				style: {
					fontSize: "11px",
					color: C.warn
				}
			}, "看不到时间") : null]) : null;
			const gateBody = gate ? h("div", {
				key: "gb",
				"data-gate-body": "1",
				style: {
					fontSize: "12px",
					lineHeight: 1.85,
					border: "1px solid " + C.faint,
					borderRadius: "4px",
					background: "#fff",
					padding: "9px 12px"
				}
			}, [
				h("div", {
					key: "s",
					style: { color: C.ink }
				}, gate.say),
				gate.alarms.length ? h("div", {
					key: "a",
					style: { marginTop: "7px" }
				}, gate.alarms.map((al, i) => h("div", {
					key: i,
					"data-gate-alarm": al.code,
					style: { color: al.level === "error" ? C.bad : C.ink }
				}, "· " + al.say))) : h("div", {
					key: "a0",
					style: {
						marginTop: "7px",
						color: C.ok
					}
				}, "· 没有告警：结构 / 审查 / 正文校验三条关都过了。"),
				h("div", {
					key: "r",
					"data-gate-review": gate.review.state,
					style: {
						marginTop: "7px",
						color: C.muted
					}
				}, "审查关：" + gate.review.say + (gate.review.finalAt ? "　（定稿 " + gate.review.finalAt + (gate.review.reportAt ? " · 报告 " + gate.review.reportAt : "") + "）" : "")),
				gate.next ? h("div", {
					key: "n",
					style: { marginTop: "7px" }
				}, "下一步：" + gate.next) : null,
				h("div", {
					key: "fp",
					style: {
						marginTop: "7px",
						fontSize: "10.5px",
						color: C.muted
					}
				}, "判据来自 `finalgdd.checkFinals`（结构）/ `vchecks.checkV11`（审查）/ `vchecks`（正文校验）；时间取自宿主 `stat` 的版本串。")
			]) : null;
			const merge = h("div", {
				key: "mg",
				"data-node": "bottom",
				style: {
					border: "1px solid " + C.ink,
					borderRadius: "4px",
					padding: "13px 15px",
					display: "flex",
					gap: "12px",
					alignItems: "center",
					justifyContent: "space-between",
					flexWrap: "wrap"
				}
			}, [h("div", { key: "t" }, [
				h("div", {
					key: "a",
					style: {
						fontSize: "14px",
						fontWeight: 600
					}
				}, "合流 → 定稿"),
				h("div", {
					key: "b",
					style: {
						fontSize: "12px",
						color: C.muted,
						marginTop: "2px"
					}
				}, "先整合（sr-gdd-ai），必经审查（sr-gdd-review），再成立定稿。"),
				gateLine,
				openInt ? h("div", {
					key: "c",
					style: {
						fontSize: "10.5px",
						color: C.muted,
						marginTop: "4px",
						lineHeight: 1.7
					}
				}, "这个动作不发新东西 —— 它把「整合定稿」连同配置支线的现状（逐条带缺口）交给该功能的专属工作会话。整合结果（定稿与审查报告）由后续那一票承接，本屏不重画流程。") : null
			]), h("button", {
				key: "go",
				type: "button",
				"data-send": "integrate",
				"data-btn": "primary",
				onClick: () => {
					if (!openInt) setOpenInt(true);
					else sendInt();
				},
				style: {
					font: "inherit",
					fontSize: "13px",
					fontWeight: 600,
					padding: "8px 18px",
					borderRadius: "4px",
					border: "1px solid " + C.ink,
					background: C.ink,
					color: "#fff",
					cursor: "pointer"
				}
			}, openInt ? "发到工作会话" : "发起整合定稿")]);
			const mergeBlock = h("div", {
				key: "mgb",
				"data-merge": "1"
			}, [
				merge,
				openInt ? h("div", {
					key: "pv",
					"data-integrate-open": "1",
					style: {
						border: "1px solid " + C.faint,
						borderTop: "none",
						borderRadius: "0 0 4px 4px",
						background: "#fff",
						padding: "9px 13px"
					}
				}, [actBlock("ib", "integrate", builtInt, "发到工作会话")]) : null,
				gate ? fold("gate", openGate ? "收起定稿门" : "看定稿门（" + (gate.alarms.length ? gate.alarms.length + " 处要处理" : "为什么可以交") + "）", openGate, () => setOpenGate(!openGate), gateBody, { style: { marginTop: "6px" } }) : null
			]);
			const machine = h("div", {
				key: "mc",
				style: { marginTop: "8px" }
			}, [
				notes.length ? h("div", {
					key: "nt",
					"data-notes": String(notes.length),
					style: {
						fontSize: "11px",
						color: C.warn,
						border: "1px solid " + C.faint,
						borderLeft: "3px solid " + C.warn,
						background: "#fffdf7",
						borderRadius: "4px",
						padding: "7px 10px",
						marginBottom: "9px",
						lineHeight: 1.75
					}
				}, notes.map((x, i) => h("div", { key: i }, "⚠ " + x))) : null,
				cfgBox,
				h("dl", {
					key: "kv",
					style: {
						margin: "0 0 10px",
						display: "grid",
						gridTemplateColumns: "max-content 1fr",
						gap: "4px 12px",
						fontSize: "11px",
						color: C.ink,
						lineHeight: 1.8
					}
				}, [
					h("dt", {
						key: "d1",
						style: { color: C.muted }
					}, "这一屏读的是"),
					h("dd", {
						key: "v1",
						style: {
							margin: 0,
							userSelect: "text"
						}
					}, (data && data.name || "（没有成稿）") + (data && data.path ? "　" + winPath(data.path) : "")),
					h("dt", {
						key: "d2",
						style: { color: C.muted }
					}, "会话"),
					h("dd", {
						key: "v2",
						style: {
							margin: 0,
							userSelect: "text"
						}
					}, "目标：本功能的专属工作会话" + (root ? "（cwd " + winPath(root) + "）" : "") + "　—— 面板只给「跳到那个会话」"),
					h("dt", {
						key: "d3",
						style: { color: C.muted }
					}, "内容指纹"),
					h("dd", {
						key: "v3",
						style: {
							margin: 0,
							userSelect: "text"
						}
					}, props.live ? shortDigest(props.live.digest) + " · " + freshnessOf({
						phase: props.live.phase,
						pending: props.live.pending,
						digest: props.live.digest,
						reason: props.live.reason
					}).text + " · 订阅 " + (Number(props.live.ready) || 0) + "/" + (Number(props.live.total) || 0) : "（这一屏没拿到订阅实况）"),
					h("dt", {
						key: "d4",
						style: { color: C.muted }
					}, "两大部分"),
					h("dd", {
						key: "v4",
						style: {
							margin: 0,
							userSelect: "text"
						}
					}, doc && doc.parts.length ? doc.parts.map((p) => "§" + p.no + " " + p.label + "　L" + p.line + "–L" + p.endLine + "　" + p.groups + " 组 / " + p.items + " 条").join("　·　") : "（没认出两大部分）"),
					h("dt", {
						key: "d5",
						style: { color: C.muted }
					}, "§5 的 ASCII 占位"),
					h("dd", {
						key: "v5",
						style: {
							margin: 0,
							userSelect: "text"
						}
					}, data && (data.ascii || []).length ? (data.ascii || []).map((x) => "§" + x.no + (x.id ? " " + x.id : "") + " L" + x.line + "（约 " + x.lines + " 行）").join("　·　") : "（§5 里没认出 ASCII 占位）"),
					h("dt", {
						key: "d6",
						style: { color: C.muted }
					}, "gdd\\UI\\ 里的图"),
					h("dd", {
						key: "v6",
						style: {
							margin: 0,
							userSelect: "text"
						}
					}, data && (data.uiImages || []).length ? (data.uiImages || []).length + " 张：" + (data.uiImages || []).map((x) => x.name).join(" / ") : "（没列到" + (data && data.uiWhy ? "：" + data.uiWhy : "") + "）"),
					h("dt", {
						key: "d7",
						style: { color: C.muted }
					}, "动作表"),
					h("dd", {
						key: "v7",
						style: {
							margin: 0,
							userSelect: "text"
						}
					}, actions.map((a) => a.label + "（" + a.hint + "）").join("　·　"))
				]),
				h("div", {
					key: "fp",
					style: {
						fontSize: "10px",
						color: C.muted,
						lineHeight: 1.8
					}
				}, "面板只显示状态、不改文件；所有动作的指令都由 `src/pure/draftstep.ts` 组装，与卡上预览逐字相同。")
			]);
			return h("div", { "data-workface": "draft" }, [
				data && data.error ? h("div", {
					key: "er",
					style: {
						fontSize: "12px",
						color: C.bad,
						marginBottom: "9px"
					}
				}, data.error) : null,
				!data ? h("div", {
					key: "ld",
					style: {
						fontSize: "12px",
						color: C.muted,
						marginBottom: "9px"
					}
				}, "正在读成稿…") : null,
				h("div", {
					key: "y",
					"data-y": "1",
					style: {
						display: "grid",
						gap: "14px",
						margin: "4px 0 14px"
					}
				}, [
					h("div", {
						key: "stem",
						"aria-hidden": "true",
						style: {
							height: "12px",
							borderLeft: "1px dashed " + C.soft,
							marginLeft: "26px"
						}
					}),
					top,
					h("div", {
						key: "fork",
						"aria-hidden": "true",
						style: {
							height: "12px",
							borderTop: "1px dashed " + C.soft,
							margin: "0 25% 0 26px"
						}
					}),
					branches,
					mergeBlock
				]),
				h("div", {
					key: "strip",
					style: {
						display: "flex",
						gap: "10px",
						alignItems: "flex-start",
						justifyContent: "space-between",
						flexWrap: "wrap",
						borderTop: "1px solid " + C.faint,
						paddingTop: "9px",
						fontSize: "11px",
						color: C.muted
					}
				}, [h("span", {
					key: "t",
					"data-strip": "1",
					style: { lineHeight: 2 }
				}, props.live ? "内容指纹 " + shortDigest(props.live.digest) + " · " + freshnessOf({
					phase: props.live.phase,
					pending: props.live.pending,
					digest: props.live.digest,
					reason: props.live.reason
				}).text : "（没有订阅实况）"), fold("machine", openMachine ? "收起详情" : "详情（展开看落到哪一步 / 缺在哪 / 这一屏读的是哪一版）", openMachine, () => setOpenMachine(!openMachine), machine, {
					style: {
						marginTop: 0,
						flex: "1 1 auto"
					},
					btn: "link"
				})])
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
			const f = freshnessOf({
				phase: live.phase,
				pending: live.pending,
				digest: live.digest,
				reason: live.reason
			});
			const tone = f.state === "fresh" ? C.ok : f.state === "stale" ? C.warn : f.state === "down" ? C.bad : C.muted;
			const skipped = Number(live.skipped) || 0;
			const changed = live.changed || [];
			return h("div", {
				"data-live": f.state,
				"data-digest": live.digest || "",
				"data-pending": String(live.pending || 0),
				"data-ready": String(live.ready || 0) + "/" + String(live.total || 0),
				"data-reloads": String(live.reloads || 0),
				"data-skipped": String(skipped),
				"data-rev": [
					"detail",
					"ledger",
					"final",
					"ui",
					"brain",
					"draft"
				].map((p) => p + ":" + ((props.rev || {})[p] || 0)).join(","),
				style: {
					display: "flex",
					alignItems: "center",
					gap: "10px",
					flexWrap: "wrap",
					border: "1px solid " + C.faint,
					borderLeft: "3px solid " + tone,
					borderRadius: "4px",
					padding: "5px 10px",
					marginBottom: "8px",
					background: "#fff",
					fontSize: "11px"
				}
			}, [
				h("span", {
					key: "fp",
					style: {
						fontFamily: "monospace",
						color: C.ink
					},
					title: "内容指纹 = 详情清单里每个文件的宿主版本（不透明串）的有序哈希；变了就说明磁盘上那份内容变了"
				}, "内容指纹 " + shortDigest(live.digest)),
				h("span", {
					key: "st",
					"data-live-text": f.text,
					style: {
						color: tone,
						fontWeight: 600
					}
				}, f.text),
				h("span", {
					key: "tgt",
					style: { color: C.muted }
				}, live.phase === "off" ? "" : "订阅 " + (Number(live.ready) || 0) + "/" + (Number(live.total) || 0) + " 个目标" + (skipped ? "　跳过 " + skipped + " 帧（不是新内容）" : "")),
				props.onRefresh ? h("button", {
					key: "rf",
					type: "button",
					"data-refresh": "manual",
					onClick: () => props.onRefresh(),
					title: "手动重读这个功能的全部数据（变更订阅不可用时的兜底）",
					style: {
						font: "inherit",
						fontSize: "11px",
						padding: "2px 9px",
						border: "1px solid " + C.soft,
						background: "#fff",
						borderRadius: "4px",
						cursor: "pointer"
					}
				}, "刷新") : null,
				changed.length ? h("span", {
					key: "ch",
					style: { color: C.muted }
				}, "刚重读：" + changed.map((x) => String(x).split(/[\\/]/).slice(-2).join("/")).join("、")) : null,
				live.reason ? h("span", {
					key: "rs",
					style: { color: C.muted }
				}, live.reason) : null,
				live.frame ? h("details", {
					key: "fr",
					style: { width: "100%" }
				}, [h("summary", {
					key: "s",
					style: {
						cursor: "pointer",
						color: C.muted
					}
				}, "最近一帧（原始 JSON" + (live.at ? " · " + new Date(live.at).toLocaleTimeString() : "") + "）"), h("pre", {
					key: "p",
					style: {
						margin: "4px 0 0",
						padding: "6px",
						background: C.bg,
						border: "1px solid " + C.faint,
						borderRadius: "3px",
						fontSize: "10.5px",
						overflowX: "auto",
						whiteSpace: "pre-wrap"
					}
				}, live.frame)]) : null
			]);
		}
		/**
		* 功能详情 · 状态块：三阶段进度 + "现在能用吗" + V 校验清单。
		* 放在**所有页签之上**，所以切到哪一屏都能看到（工单 12 的"详情页要能看到阶段进度与定稿有效性"）。
		*/
		function DetailStatus(props) {
			const d = props.detail;
			const onOpenFix = props.onOpenFix;
			if (!d) return h("div", { style: {
				fontSize: "12px",
				color: C.muted,
				marginBottom: "10px"
			} }, "正在读产物清单与校验清单…");
			if (d.error) return h("div", { style: {
				fontSize: "12px",
				color: C.bad,
				marginBottom: "10px",
				padding: "8px 11px",
				border: "1px solid " + C.faint,
				borderLeft: "3px solid " + C.bad,
				background: "#fef2f2",
				borderRadius: "4px"
			} }, d.error);
			const art = d.artifacts || {
				counts: {},
				total: 0
			};
			const cl = d.checklist || {
				issues: [],
				counts: {}
			};
			const v = finalVerdict(d.finalCheck);
			/** ★ 工单 25 · 定稿门（loadFeatureDetail 给的；拿不到才退回 `finalVerdict` 的老口径） */
			const g = d.gate || null;
			const tone = g ? g.state === "ok" ? C.ok : g.state === "blocked" ? C.warn : C.warn : v.tone === "bad" ? C.bad : v.tone === "warn" ? C.warn : v.tone === "ok" ? C.ok : C.muted;
			const usableTone = g && g.state === "blocked" ? C.bad : tone;
			return h("div", { style: { marginBottom: "12px" } }, [
				h("div", {
					key: "stage",
					style: {
						display: "flex",
						gap: "8px",
						flexWrap: "wrap",
						marginBottom: "9px"
					}
				}, (d.stage ? d.stage.stages : []).map((s) => h("div", {
					key: s.key,
					style: {
						border: "1px solid " + (s.done ? C.ok : C.soft),
						borderLeft: "3px solid " + (s.done ? C.ok : C.soft),
						background: s.done ? "#f0fdf4" : "#fff",
						borderRadius: "4px",
						padding: "5px 10px",
						minWidth: "150px"
					}
				}, [h("div", {
					key: "l",
					style: {
						fontSize: "11px",
						fontWeight: 600,
						color: s.done ? C.ok : C.muted
					}
				}, (s.done ? "✔ " : "○ ") + s.label), h("div", {
					key: "e",
					style: {
						fontSize: "10px",
						color: C.muted,
						fontFamily: "monospace"
					}
				}, s.evidence)]))),
				h("div", {
					key: "sum",
					style: {
						fontSize: "11px",
						color: C.muted,
						marginBottom: "9px"
					}
				}, "产物 " + (art.total || 0) + " 个　" + (art.meanings || []).map((m) => m.label + " " + ((art.counts || {})[m.key] || 0)).join("　")),
				h("div", {
					key: "usable",
					"data-gate": g ? g.state : "none",
					style: {
						border: "1px solid " + C.faint,
						borderLeft: "3px solid " + usableTone,
						background: (g ? g.state === "ok" : v.tone === "ok") ? "#f0fdf4" : "#fffdf7",
						borderRadius: "4px",
						padding: "8px 11px",
						fontSize: "12px",
						marginBottom: "8px"
					}
				}, g ? [
					h("div", { key: "t" }, [
						h("b", { key: "a" }, "现在能用吗："),
						h("span", {
							key: "b",
							"data-gate-say": "1",
							style: {
								color: usableTone,
								fontWeight: 600
							}
						}, g.state === "ok" ? "可以交给程序" : g.state === "blocked" ? "还不能交给程序" : "还没有定稿"),
						h("span", {
							key: "c",
							style: { color: C.muted }
						}, "　" + g.say)
					]),
					g.alarms.length ? h("div", {
						key: "al",
						style: { marginTop: "4px" }
					}, g.alarms.map((al, i) => h("div", {
						key: "a" + i,
						"data-gate-alarm": al.code,
						style: {
							fontSize: "11.5px",
							lineHeight: 1.8,
							color: al.level === "error" ? C.bad : C.ink
						}
					}, "· " + al.say))) : null,
					h("div", {
						key: "rv",
						"data-gate-review": g.review.state,
						style: {
							marginTop: "4px",
							fontSize: "11.5px",
							color: C.muted
						}
					}, "审查关：" + g.review.say + (g.review.finalAt ? "　（定稿 " + g.review.finalAt + (g.review.reportAt ? " · 报告 " + g.review.reportAt : "") + "）" : "")),
					g.next ? h("div", {
						key: "nx",
						style: {
							marginTop: "4px",
							fontSize: "11.5px"
						}
					}, "下一步：" + g.next) : null,
					h(Fold, {
						key: "raw",
						title: "原始判据（V1 的机器口径：" + (d.finalCheck && d.finalCheck.issues || []).length + " 条）",
						defaultOpen: false,
						children: h("div", null, (d.finalCheck && d.finalCheck.issues || []).length ? (d.finalCheck && d.finalCheck.issues || []).map((it, i) => h("div", {
							key: "i" + i,
							style: {
								fontSize: "11px",
								color: it.level === "error" ? C.bad : C.warn,
								marginTop: "3px",
								fontFamily: "monospace"
							}
						}, "[" + it.code + "/" + it.level + "] " + it.msg + (it.files && it.files.length ? "　→ " + it.files.join("、") : ""))) : h("div", { style: {
							fontSize: "11px",
							color: C.muted
						} }, "（V1 没有报问题）"))
					})
				] : [h("div", { key: "t" }, [
					h("b", { key: "a" }, "现在能用吗："),
					h("span", {
						key: "b",
						style: {
							color: tone,
							fontWeight: 600
						}
					}, v.text),
					h("span", {
						key: "c",
						style: { color: C.muted }
					}, "　（按" + (d.finalCheck && d.finalCheck.currentFrom === "active" ? "active 标记" : "文件名日期") + "判定）")
				]), (d.finalCheck && d.finalCheck.issues || []).map((it, i) => h("div", {
					key: "i" + i,
					style: {
						fontSize: "11px",
						color: it.level === "error" ? C.bad : C.warn,
						marginTop: "3px"
					}
				}, "[" + it.code + "/" + it.level + "] " + it.msg + (it.files && it.files.length ? "　→ " + it.files.join("、") : "")))]),
				h("div", {
					key: "checks",
					style: {
						border: "1px solid " + C.faint,
						borderRadius: "4px",
						background: "#fff",
						overflow: "hidden",
						marginBottom: "8px"
					}
				}, h(Fold, {
					title: "只读校验清单　error " + ((cl.counts || {}).error || 0) + " · warn " + ((cl.counts || {}).warn || 0) + " · info " + ((cl.counts || {}).info || 0) + "　（V1+V3+V5+V6+V8+V11；V5 是待办计数、V6/V8 干净时不出现在这里）",
					defaultOpen: !!(cl.counts && (cl.counts.error || cl.counts.warn)),
					children: h("div", null, (cl.issues || []).length ? (cl.issues || []).map((it, i) => {
						const tt = CHECK_TONE[it.level] || CHECK_TONE.info;
						return h("div", {
							key: "ck" + i,
							style: {
								display: "flex",
								gap: "8px",
								fontSize: "11px",
								padding: "4px 0",
								borderTop: i ? "1px solid " + C.faint : "none",
								alignItems: "baseline"
							}
						}, [
							h("span", {
								key: "b",
								style: {
									fontFamily: "monospace",
									whiteSpace: "nowrap",
									border: "1px solid " + C.soft,
									borderRadius: "3px",
									padding: "0 5px",
									color: tt.c
								}
							}, it.code + " · " + tt.t),
							h("span", {
								key: "m",
								style: {
									flex: "1 1 auto",
									color: it.level === "info" ? C.muted : C.ink
								}
							}, it.msg),
							it.lines && it.lines.length ? h("button", {
								key: "l",
								type: "button",
								onClick: () => onOpenFix && onOpenFix(),
								title: "点开定稿，按这些行号定位",
								style: {
									font: "inherit",
									fontSize: "10px",
									fontFamily: "monospace",
									whiteSpace: "nowrap",
									border: "1px solid " + C.soft,
									background: "#fff",
									borderRadius: "3px",
									padding: "0 5px",
									cursor: "pointer",
									color: C.link
								}
							}, "L" + it.lines.join(" · L")) : null
						]);
					}) : h("div", { style: {
						fontSize: "11px",
						color: C.ok
					} }, "六条校验都没有问题（真实数据上 V6/V8 干净时就是这个样子）。"))
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
			const [fold, setFold] = react.useState({});
			if (!d) return h("div", { style: {
				color: C.muted,
				fontSize: "12px"
			} }, "正在读产物清单…");
			if (d.error) return h("div", { style: {
				color: C.bad,
				fontSize: "12px"
			} }, d.error);
			const art = d.artifacts || {};
			const groups = art.groups || [];
			const meanings = art.meanings || [];
			const configs = f && f.configs || [];
			const absOf = (file) => (f && f.root ? f.root : srWs) + "/" + file.rel;
			const rowOf = (file, i, clickAbs) => h("div", {
				key: "f" + i,
				style: {
					display: "flex",
					alignItems: "center",
					gap: "8px",
					padding: "5px 11px",
					borderTop: i ? "1px solid " + C.faint : "none"
				}
			}, [
				file.kindLabel ? h("span", {
					key: "b",
					style: {
						fontSize: "10px",
						fontFamily: "monospace",
						padding: "0 5px",
						whiteSpace: "nowrap",
						border: "1px solid " + C.soft,
						borderRadius: "3px",
						color: file.kind === "final" ? C.ok : C.muted
					}
				}, file.kindLabel) : null,
				h("button", {
					key: "n",
					type: "button",
					onClick: () => onOpen(clickAbs),
					title: "点击打开：" + clickAbs,
					style: {
						font: "inherit",
						fontSize: "12px",
						fontFamily: "monospace",
						padding: 0,
						border: "none",
						background: "none",
						color: "#3b6ea5",
						cursor: "pointer",
						textAlign: "left",
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
						flex: "1 1 auto"
					}
				}, file.rel),
				file.spec ? h("span", {
					key: "s",
					style: {
						fontSize: "10px",
						color: C.muted
					}
				}, "规范：" + file.spec) : null,
				file.note ? h("span", {
					key: "nt",
					whiteSpace: "nowrap",
					style: {
						fontSize: "10px",
						color: /当前有效/.test(file.note) ? C.ok : C.warn,
						fontFamily: "monospace"
					}
				}, file.note) : null,
				fmtNameDate(file.name) ? h("span", {
					key: "d",
					style: {
						fontSize: "10px",
						color: C.muted,
						fontFamily: "monospace",
						whiteSpace: "nowrap"
					}
				}, fmtNameDate(file.name)) : null
			]);
			const groupBox = (g) => h("div", {
				key: g.key,
				style: {
					border: "1px solid " + C.faint,
					borderRadius: "4px",
					background: "#fff",
					marginBottom: "9px",
					overflow: "hidden"
				}
			}, [h("div", {
				key: "h",
				onClick: () => setFold((s) => {
					const o = {};
					for (const k in s) o[k] = s[k];
					o[g.key] = !s[g.key];
					return o;
				}),
				style: {
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					padding: "7px 11px",
					background: C.bg,
					cursor: "pointer",
					borderBottom: fold[g.key] ? "none" : "1px solid " + C.faint
				}
			}, [h("span", {
				key: "l",
				style: {
					fontSize: "12px",
					fontWeight: 600
				}
			}, [g.label + "（" + g.count + "）", h("span", {
				key: "d",
				style: {
					fontWeight: 400,
					fontSize: "11px",
					color: C.muted,
					fontFamily: "monospace"
				}
			}, g.dir ? "　" + g.dir + "/" : "")]), h("span", {
				key: "t",
				style: {
					fontSize: "10px",
					color: C.muted,
					maxWidth: "58%",
					textAlign: "right"
				}
			}, g.note + (fold[g.key] ? "　展开 ▸" : "　收起 ▾"))]), fold[g.key] ? null : g.count ? h("div", {
				key: "b",
				style: { padding: "4px 0" }
			}, g.files.map((x, i) => rowOf(x, i, absOf(x)))) : h("div", {
				key: "e",
				style: {
					padding: "7px 11px",
					fontSize: "11px",
					color: C.muted
				}
			}, "（空）")]);
			return h("div", null, [
				h("div", {
					key: "sum",
					style: {
						fontSize: "12px",
						color: C.muted,
						marginBottom: "10px"
					}
				}, "共 " + (art.total || 0) + " 个产物　" + meanings.map((m) => m.label + " " + ((art.counts || {})[m.key] || 0)).join("　")),
				(art.notes || []).map((t, i) => h("div", {
					key: "n" + i,
					style: {
						border: "1px solid " + C.faint,
						borderLeft: "3px solid " + C.warn,
						background: "#fffdf7",
						borderRadius: "4px",
						padding: "7px 11px",
						fontSize: "11px",
						marginBottom: "8px"
					}
				}, "⚠ " + t)),
				h("div", {
					key: "hint",
					style: {
						fontSize: "11px",
						color: C.muted,
						marginBottom: "9px"
					}
				}, "分组按**子目录**判（桶就是答案）；只有 gdd\\ 内部按文件名再细分一次。清单与磁盘逐条一致 —— 不是白名单过滤出来的。"),
				...meanings.map((m) => {
					const mine = groups.filter((g) => g.meaning === m.key);
					if (!mine.length) return null;
					return h("div", {
						key: "sec" + m.key,
						style: { marginBottom: "12px" }
					}, [h("div", {
						key: "t",
						style: {
							fontSize: "12px",
							fontWeight: 600,
							marginBottom: "6px"
						}
					}, m.label + h("span", {
						key: "c",
						style: {
							fontWeight: 400,
							color: C.muted
						}
					}, "　" + mine.reduce((n, g) => n + g.count, 0) + " 个")), ...mine.map(groupBox)]);
				}),
				configs.length ? h("div", {
					key: "cfg",
					style: {
						border: "1px solid " + C.faint,
						borderLeft: "3px solid " + C.soft,
						borderRadius: "4px",
						background: "#fff",
						padding: "8px 11px",
						marginBottom: "9px"
					}
				}, [h("div", {
					key: "t",
					style: {
						fontSize: "12px",
						fontWeight: 600,
						marginBottom: "4px"
					}
				}, "配置表（" + configs.length + "）　按主题挂靠，不在功能目录内"), ...configs.map((n, i) => h("div", {
					key: i,
					style: { padding: "2px 0" }
				}, h("button", {
					type: "button",
					onClick: () => onOpen((configRoot || srWs) + "/" + n),
					style: {
						font: "inherit",
						fontSize: "12px",
						fontFamily: "monospace",
						padding: 0,
						border: "none",
						background: "none",
						color: "#3b6ea5",
						cursor: "pointer"
					}
				}, n)))]) : null,
				h("div", {
					key: "old",
					style: {
						border: "1px solid " + C.faint,
						borderRadius: "4px",
						background: "#fff",
						overflow: "hidden"
					}
				}, h(Fold, {
					title: "按阶段看（旧的读法：概念 / 成稿 / 定稿 / 审查 / 宣讲 / 证据 / 决策）",
					children: h(ArtifactList, {
						feature: f,
						srWs,
						configRoot,
						onOpen
					})
				})),
				h("div", {
					key: "foot",
					style: {
						marginTop: "12px",
						fontSize: "11px",
						color: C.muted,
						lineHeight: 1.85
					}
				}, [h("div", { key: "a" }, "产物来自工作区实时读取（列目录，不读索引文件）。"), h("div", { key: "b" }, "点一行用系统默认程序打开；失败会依次试「DSH 内置 openFile → 默认应用 → 文件管理器 reveal」并给出诊断。")])
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
			let s = -1, e = all.length;
			for (let i = 0; i < all.length; i++) {
				if (s < 0 && /^##\s*5[.、\s]/.test(all[i])) {
					s = i;
					continue;
				}
				if (s >= 0 && /^##\s/.test(all[i])) {
					e = i;
					break;
				}
			}
			if (s < 0) return null;
			const sec = all.slice(s, e);
			const uiRows = [];
			let boundary = "";
			let on = false;
			for (let i = 0; i < sec.length; i++) {
				const t = sec[i].trim();
				if (/^###\s*5\.0/.test(t)) {
					on = true;
					continue;
				}
				if (!on) continue;
				if (/^###\s/.test(t)) break;
				if (t.startsWith("|")) {
					const cells = t.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
					const isSep = cells.every((c) => /^:?-{2,}:?$/.test(c));
					if (cells.length >= 4 && !isSep && cells[0] !== "界面ID") uiRows.push({
						id: cells[0],
						name: cells[1],
						enter: cells[2],
						exit: cells[3]
					});
				} else if (uiRows.length && t && !boundary) boundary = t.replace(/^边界声明\s*[:：]\s*/, "");
			}
			const uis = [];
			for (let i = 0; i < sec.length; i++) {
				const m = /^###\s*5\.\d+\s+(UI-\S+)\s*(.*)$/.exec(sec[i].trim());
				if (!m) continue;
				let end = sec.length;
				for (let j = i + 1; j < sec.length; j++) if (/^###\s/.test(sec[j].trim())) {
					end = j;
					break;
				}
				const body = sec.slice(i + 1, end);
				const images = [];
				let ueCount = 0;
				for (const l of body) {
					const im = /<img[^>]*\bsrc\s*=\s*["']([^"']+)["']/i.exec(l);
					if (im) images.push(im[1]);
					if (/^\|\s*UE\d+/i.test(l.trim())) ueCount += 1;
				}
				uis.push({
					id: m[1],
					title: m[2].trim(),
					images,
					ueCount
				});
			}
			return {
				uiRows,
				boundary,
				uis,
				found: true
			};
		}
		/** 读某功能最新定稿的 §5 界面章（A5 数据源） */
		/** 读定稿的 §5（界面图用）。收**绝对路径** —— 只有 `features\<主题>\gdd\` 一种结构 */
		async function loadInterface(read, sid, absPath, signal) {
			if (!absPath) return { empty: "本功能还没有定稿，界面图在定稿的 §5。" };
			const text = await readAllText(read, sid, absPath, signal, 4e3);
			if (!text) return { error: "读不到定稿：" + absPath };
			let parsed = null;
			try {
				parsed = parseInterfaceSection(text);
			} catch (e) {
				return { error: "解析 §5 失败：" + String(e && e.message || e) };
			}
			if (!parsed) return { empty: "定稿里没有 §5 界面章。" };
			parsed.file = String(absPath).split(/[\\/]/).pop();
			return parsed;
		}
		/** 本机图片 → 同源 URL（DSH 的 /api/file 路由；Windows 盘符绝对路径服务端也接受） */
		function fileUrl(abs) {
			try {
				return (typeof window !== "undefined" && window.location && window.location.origin || "") + "/api/file?path=" + encodeURIComponent(abs);
			} catch (e) {
				return "";
			}
		}
		/** 读资产索引（第一部分的数据源；由 scripts/refresh_asset_index.py 生成） */
		/**
		* 读定稿全文并解析结构（设计 §6.2 定稿工作面）。
		* ★ 收**绝对路径**（= 功能的 `openPath`）—— 面板不自己拼路径，
		*   路径由调用方从功能目录算出来，所以目录结构怎么变都不用改这里。
		*/
		async function loadFinal(read, sid, absPath, signal) {
			if (!absPath) return { empty: "这个功能还没有定稿。" };
			const text = await readAllText(read, sid, absPath, signal, 6e3);
			if (!text) return { error: "读不到定稿：" + absPath };
			const g = parseFinalGdd(text);
			g.path = absPath;
			g.dir = String(absPath).replace(/[\\/][^\\/]*$/, "");
			g.name = String(absPath).split(/[\\/]/).pop();
			return g;
		}
		async function loadIndex(read, sid, srWs, signal) {
			const text = await readAllText(read, sid, srWs + "/design-asset-index.json", signal, 8e3);
			if (!text) return { error: "读不到 design-asset-index.json。先点「刷新索引」让 agent 生成它。" };
			let j = null;
			try {
				j = JSON.parse(text);
			} catch (e) {
				return { error: "索引 JSON 解析失败：" + String(e && e.message || e) };
			}
			if (!j || !Array.isArray(j.assets)) return { error: "索引结构不对：assets 不是数组。" };
			return {
				assets: j.assets,
				schemaVersion: j.schema_version,
				workspaceId: j.workspace_id,
				srWs
			};
		}
		const ASSET_TYPE_LABEL = {
			concept: "概念",
			analysis: "分析",
			proposal: "成稿文档",
			decision: "决策",
			evidence: "证据",
			validation: "验证",
			inbox: "收集箱",
			assumption: "假设",
			experiment: "实验",
			"gate-result": "门结果",
			"workflow-run": "工作流",
			learning: "复盘规则",
			retrospective: "复盘",
			knowledge: "知识",
			"information-assessment": "信息评估"
		};
		const REVIEW_TONE = {
			accepted: "ok",
			reviewed: "ok",
			draft: null,
			needs_review: "warn",
			rejected: "bad",
			superseded: "warn"
		};
		const REVIEW_LABEL = {
			draft: "草稿",
			needs_review: "待审",
			reviewed: "已审",
			accepted: "已接受",
			rejected: "已驳回",
			superseded: "已被取代"
		};
		/** 收件箱允许内联的文本文件大小上限（超过就不内联，只记路径） */
		const INLINE_TEXT_CAP = 2e5;
		/**
		* 一个待发送的素材 → 显示用的 { name, size, err }
		* 文本文件用 FileReader 读出来内联（浏览器自己就能读，省掉 agent 再读一次盘）；
		* 二进制只记 fullPath（agent 读盘），拿不到路径就退化成大小未知的上传件。
		*/
		async function ingestFile(file) {
			const name = String(file && file.name || "未命名文件");
			const size = Number(file && file.size || 0);
			const fullPath = String(file && file.path || "");
			const C0 = contract;
			const textExt = C0 ? C0.isTextExt(name) : false;
			const docExt = C0 ? C0.isDoc(name) : false;
			if (textExt) try {
				return {
					name,
					size,
					fullPath,
					isText: true,
					text: await readFileText(file, INLINE_TEXT_CAP),
					orig: file
				};
			} catch (e) {
				return {
					name,
					size,
					fullPath,
					isText: false,
					isDoc: docExt,
					upload: !fullPath,
					orig: file,
					err: "读取失败：" + String(e && e.message || e)
				};
			}
			return {
				name,
				size,
				fullPath,
				isText: false,
				isDoc: docExt,
				upload: !fullPath,
				orig: file
			};
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
			const [raw, setRaw] = react.useState("");
			const [note, setNote] = react.useState("");
			const [files, setFiles] = react.useState([]);
			const [busyId, setBusyId] = react.useState("");
			const [msg, setMsg] = react.useState(null);
			const [drag, setDrag] = react.useState(false);
			const fileRef = react.useRef(null);
			if (!contract) return h("div", { style: {
				border: "1px solid " + C.faint,
				borderLeft: "3px solid " + C.bad,
				background: "#fff",
				borderRadius: "4px",
				padding: "10px 12px",
				marginBottom: "12px",
				fontSize: "12px",
				color: C.bad
			} }, "收件箱逻辑没加载上（intake-parse.js）：未知原因　—— 其余屏不受影响。");
			const materials = contract.parseMaterials(raw);
			const pathMats = materials.filter((m) => m.kind !== "text");
			const textMats = materials.filter((m) => m.kind === "text");
			files.filter((f) => f.fullPath).length;
			const noPath = files.filter((f) => !f.fullPath).map((f) => f.name);
			const derived = contract.deriveTopic(materials.concat(files.filter((f) => f.fullPath).map((f) => ({
				kind: "file",
				path: f.fullPath
			}))));
			const noteAuto = note.trim() === "" && textMats.length > 0;
			const effectiveNote = noteAuto ? textMats.map((m) => m.text).join("\n\n") : note;
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
				let p;
				try {
					p = props.onSubmit({
						kind: id,
						materials,
						topic: derived,
						note: effectiveNote,
						files,
						upstream: ""
					});
				} catch (e) {
					setBusyId("");
					setMsg({
						ok: false,
						text: "提交失败（同步抛错）：" + String(e && e.message || e)
					});
					return;
				}
				Promise.resolve(p).then((r) => {
					setBusyId("");
					if (r && r.ok) {
						setMsg({
							ok: true,
							text: r.note
						});
						setRaw("");
						setNote("");
						setFiles([]);
					} else setMsg({
						ok: false,
						text: r && r.note || "没能发出指令。"
					});
				}, (e) => {
					setBusyId("");
					setMsg({
						ok: false,
						text: "失败：" + String(e && e.message || e)
					});
				});
			};
			const zone = {
				border: "1px dashed " + (drag ? C.ink : C.soft),
				background: drag ? "#f2f2f2" : "#fff",
				borderRadius: "4px",
				padding: "9px 11px",
				marginTop: "8px",
				fontSize: "11px",
				color: C.muted,
				textAlign: "center",
				cursor: "pointer"
			};
			const kb = (n) => n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
			return h("div", {
				key: "intake",
				style: {
					border: "1px solid " + C.ink,
					borderRadius: "6px",
					padding: "12px 14px",
					marginBottom: "13px",
					background: "#fff"
				}
			}, [
				h("div", {
					key: "hd",
					style: {
						display: "flex",
						alignItems: "baseline",
						gap: "9px",
						flexWrap: "wrap",
						marginBottom: "8px"
					}
				}, [h("span", {
					key: "t",
					style: {
						fontSize: "13px",
						fontWeight: 600
					}
				}, "收件箱"), h("span", {
					key: "s",
					style: {
						fontSize: "11px",
						color: C.muted
					}
				}, "四种输入方式都从这里进 —— 按你要做的那一种，别猜它算哪类")]),
				h("textarea", {
					key: "raw",
					value: raw,
					rows: 3,
					placeholder: "粘路径 / 贴链接 / 直接写一段话（多个路径请各占一行）",
					onChange: (e) => {
						setRaw(e.target.value);
						setMsg(null);
					},
					style: {
						width: "100%",
						boxSizing: "border-box",
						fontSize: "12px",
						lineHeight: 1.7,
						padding: "7px 9px",
						border: "1px solid " + C.soft,
						borderRadius: "4px",
						outline: "none",
						resize: "vertical",
						fontFamily: "inherit",
						background: "#fff"
					}
				}),
				h("div", {
					key: "zone",
					style: zone,
					onClick: () => {
						if (fileRef.current) fileRef.current.click();
					},
					onDragOver: (e) => {
						e.preventDefault();
						if (!drag) setDrag(true);
					},
					onDragLeave: () => setDrag(false),
					onDrop: (e) => {
						e.preventDefault();
						setDrag(false);
						const dt = e.dataTransfer;
						if (dt && dt.files && dt.files.length > 0) addFiles(dt.files);
					}
				}, "把文件 / 文件夹拖到这里，或点这里选择文件（文本类自动读成内容；其余记路径，由 agent 去读）"),
				h("input", {
					key: "fi",
					type: "file",
					multiple: true,
					ref: fileRef,
					style: { display: "none" },
					onChange: (e) => {
						addFiles(e.target.files || []);
						e.target.value = "";
					}
				}),
				files.length > 0 ? h("div", {
					key: "fl",
					style: {
						display: "flex",
						gap: "6px",
						flexWrap: "wrap",
						marginTop: "7px"
					}
				}, files.map((f, i) => h("span", {
					key: "f" + i,
					style: {
						display: "inline-flex",
						alignItems: "center",
						gap: "6px",
						fontSize: "11px",
						padding: "3px 8px",
						borderRadius: "12px",
						border: "1px solid " + (f.err ? C.bad : C.soft),
						background: f.err ? "#fff" : "#f7f7f7",
						color: f.err ? C.bad : C.ink
					}
				}, [h("span", { key: "n" }, f.name + "　" + (f.size ? kb(f.size) : "大小未知") + (f.isText ? "　已读入" : f.fullPath ? "　记路径" : "　上传")), h("button", {
					key: "x",
					type: "button",
					onClick: () => removeFile(i),
					style: {
						font: "inherit",
						border: "none",
						background: "transparent",
						cursor: "pointer",
						color: C.muted,
						padding: 0
					}
				}, "✕")]))) : null,
				h("input", {
					key: "nt",
					value: note,
					placeholder: "备注 / 分析目标 / 正文（可空；空则自动取输入框里的散文）",
					onChange: (e) => {
						setNote(e.target.value);
						setMsg(null);
					},
					style: {
						width: "100%",
						boxSizing: "border-box",
						fontSize: "12px",
						padding: "5px 8px",
						border: "1px solid " + C.soft,
						borderRadius: "4px",
						outline: "none",
						background: "#fff",
						marginTop: "7px"
					}
				}),
				h("div", {
					key: "meta",
					style: {
						fontSize: "11px",
						color: C.muted,
						lineHeight: 1.9,
						marginTop: "6px"
					}
				}, [
					h("div", { key: "a" }, "识别到的素材：" + materials.length + " 项（其中路径/链接 " + pathMats.length + " 项，散文 " + textMats.length + " 段）" + (files.length > 0 ? "，文件 " + files.length + " 个" : "")),
					h("div", { key: "b" }, "将归档到功能主题：" + (derived || "（还看不出来 —— 给个素材或写一句标题）")),
					noteAuto ? h("div", { key: "c" }, "备注自动取输入框里的散文：" + String(effectiveNote).replace(/\s+/g, " ").slice(0, 80) + (String(effectiveNote).length > 80 ? "…" : "")) : null,
					noPath.length > 0 ? h("div", {
						key: "d",
						style: { color: C.warn }
					}, "⚠ 这些文件拿不到本机路径，只能作为会话附件上传（agent 读不到内容）：" + noPath.join("、")) : null
				]),
				h("div", {
					key: "btns",
					style: {
						display: "flex",
						gap: "8px",
						flexWrap: "wrap",
						marginTop: "10px"
					}
				}, contract.INTAKE_KINDS.map((k) => h("button", {
					key: k.id,
					type: "button",
					disabled: !!busyId,
					title: k.needs,
					onClick: () => go(k.id),
					style: {
						font: "inherit",
						textAlign: "left",
						cursor: busyId ? "default" : "pointer",
						padding: "7px 11px",
						borderRadius: "4px",
						border: "1px solid " + (busyId === k.id ? C.ink : C.soft),
						background: busyId === k.id ? C.ink : "#fff",
						color: busyId === k.id ? "#fff" : C.ink
					}
				}, [h("div", {
					key: "l",
					style: {
						fontSize: "12px",
						fontWeight: 600
					}
				}, (busyId === k.id ? "已发出 · " : "") + k.label), h("div", {
					key: "h",
					style: {
						fontSize: "10px",
						color: busyId === k.id ? "#ddd" : C.muted
					}
				}, k.hint)]))),
				msg ? h("div", {
					key: "m",
					style: {
						marginTop: "9px",
						padding: "7px 10px",
						borderRadius: "4px",
						fontSize: "11px",
						lineHeight: 1.85,
						border: "1px solid " + (msg.ok ? C.ok : C.bad),
						color: msg.ok ? C.ok : C.bad,
						background: "#fff"
					}
				}, msg.text) : null,
				props.refs ? h("div", {
					key: "rf",
					style: {
						marginTop: "9px",
						paddingTop: "8px",
						borderTop: "1px solid " + C.faint,
						fontSize: "11px",
						color: C.muted,
						lineHeight: 1.9
					}
				}, [h("div", { key: "a" }, "跑这一趟的下游产物（点开看）："), props.refs.map((x, i) => h("div", { key: "r" + i }, [h("button", {
					key: "b",
					type: "button",
					onClick: () => props.onOpenRef(x.abs),
					style: {
						font: "inherit",
						fontSize: "11px",
						border: "none",
						background: "transparent",
						color: C.ink,
						cursor: "pointer",
						padding: 0,
						textDecoration: "underline"
					}
				}, x.label)]))]) : null
			]);
		}
		/**
		* B1 · 设计资产列表
		* 数据源：workspace/design-asset-index.json（由 refresh_asset_index.py 生成）
		*/
		function AssetsPanel(props) {
			const data = props.data;
			const [type, setType] = react.useState("__all__");
			const [rev, setRev] = react.useState("__all__");
			const [q, setQ] = react.useState("");
			const [busy, setBusy] = react.useState(false);
			const [note, setNote] = react.useState(null);
			const [openAsset, setOpenAsset] = react.useState(null);
			const [tool, setTool] = react.useState("");
			const [impPath, setImpPath] = react.useState("");
			const [impNote, setImpNote] = react.useState("");
			const [mTitle, setMTitle] = react.useState("");
			const [mBody, setMBody] = react.useState("");
			const [mUp, setMUp] = react.useState("");
			const onOpen = props.onOpen;
			const onRefresh = props.onRefresh;
			const tbtn = (key, label, active, onPick) => h("button", {
				key,
				type: "button",
				disabled: busy,
				onClick: onPick,
				style: {
					font: "inherit",
					fontSize: "12px",
					padding: "5px 13px",
					border: "1px solid " + (active ? C.ink : C.soft),
					background: active ? C.ink : "#fff",
					color: active ? "#fff" : C.ink,
					borderRadius: "4px",
					cursor: busy ? "default" : "pointer"
				}
			}, label);
			if (!data) return h("div", { style: {
				color: C.muted,
				fontSize: "12px"
			} }, "正在读资产索引…");
			if (openAsset) return h(AssetReader, {
				asset: openAsset,
				srWs: data.srWs,
				read: props.read,
				onBack: () => setOpenAsset(null),
				onOpen
			});
			if (data.error) return h("div", null, [
				h("div", {
					key: "e",
					style: {
						border: "1px solid " + C.bad,
						borderLeft: "3px solid " + C.bad,
						background: "#fff",
						borderRadius: "4px",
						padding: "10px 12px",
						fontSize: "12px",
						color: C.bad,
						marginBottom: "10px"
					}
				}, data.error),
				props.onRefresh ? h("div", { key: "a" }, h("button", {
					type: "button",
					onClick: () => {
						setBusy(true);
						setNote(null);
						props.onRefresh().then((t) => {
							setBusy(false);
							setNote(t);
						});
					},
					disabled: busy,
					style: {
						font: "inherit",
						fontSize: "12px",
						padding: "6px 14px",
						border: "1px solid " + C.ink,
						background: C.ink,
						color: "#fff",
						borderRadius: "4px",
						cursor: "pointer"
					}
				}, busy ? "已发出指令，等 agent 跑完…" : "刷新资产索引")) : null,
				note ? h("div", {
					key: "n",
					style: {
						marginTop: "9px",
						fontSize: "12px",
						color: C.muted
					}
				}, note) : null
			]);
			const all = data.assets;
			const byId = {};
			for (const a of all) byId[a.asset_id] = a;
			const typeCounts = {}, revCounts = {};
			for (const a of all) {
				typeCounts[a.asset_type] = (typeCounts[a.asset_type] || 0) + 1;
				revCounts[a.review_status] = (revCounts[a.review_status] || 0) + 1;
			}
			const filtered = all.filter((a) => {
				if (type !== "__all__" && a.asset_type !== type) return false;
				if (rev !== "__all__" && a.review_status !== rev) return false;
				if (q) {
					if ((a.asset_id + " " + a.path + " " + (a.title || "")).toLowerCase().indexOf(q.toLowerCase()) < 0) return false;
				}
				return true;
			}).sort((x, y) => x.asset_id < y.asset_id ? -1 : 1);
			const chip = (label, count, active, onPick, key) => h("button", {
				key,
				type: "button",
				onClick: onPick,
				style: {
					font: "inherit",
					fontSize: "11px",
					padding: "3px 10px",
					border: "1px solid " + (active ? C.ink : C.faint),
					background: active ? C.ink : "#fff",
					color: active ? "#fff" : C.ink,
					borderRadius: "12px",
					cursor: "pointer",
					whiteSpace: "nowrap"
				}
			}, label + (count === void 0 ? "" : " " + count));
			const linkRefs = (refs) => (refs || []).map((r) => {
				const t = byId[r];
				return t ? (ASSET_TYPE_LABEL[t.asset_type] || t.asset_type) + " " + r : r;
			}).join("、");
			return h("div", null, [
				h("div", {
					key: "sum",
					style: {
						fontSize: "12px",
						color: C.muted,
						marginBottom: "10px"
					}
				}, "索引 schema " + (data.schemaVersion || "?") + " · 工作区 " + (data.workspaceId || "?") + "　共 " + all.length + " 条资产"),
				props.onIntake ? h(IntakeBox, {
					key: "intake",
					onSubmit: props.onIntake,
					refs: props.intakeRefs,
					onOpenRef: onOpen
				}) : null,
				onRefresh && tool === "__legacy__" ? h("div", {
					key: "rf",
					style: { marginBottom: "11px" }
				}, [h("div", {
					key: "btns",
					style: {
						display: "flex",
						gap: "7px",
						flexWrap: "wrap",
						marginBottom: "7px"
					}
				}, [
					tbtn("b1", busy ? "已发出指令…" : "刷新资产索引", tool === "", () => {
						setTool("");
						setNote(null);
						setBusy(true);
						props.onRefresh().then((t) => {
							setBusy(false);
							setNote(t);
						});
					}),
					tbtn("b2", "导入旧文档", tool === "import", () => {
						setTool(tool === "import" ? "" : "import");
						setNote(null);
					}),
					tbtn("b3", "人工补充", tool === "manual", () => {
						setTool(tool === "manual" ? "" : "manual");
						setNote(null);
					})
				]), h("div", {
					key: "hint",
					style: {
						fontSize: "11px",
						color: C.muted
					}
				}, "工作台不自己改文件 —— 这三个动作都只是把意图发给 agent，由它执行")]) : null,
				tool === "import" ? h("div", {
					key: "imp",
					style: {
						border: "1px solid " + C.faint,
						borderLeft: "3px solid " + C.ink,
						background: "#fff",
						borderRadius: "4px",
						padding: "11px 13px",
						marginBottom: "11px"
					}
				}, [
					h("div", {
						key: "t",
						style: {
							fontSize: "12px",
							fontWeight: 600,
							marginBottom: "6px"
						}
					}, "方式 3 · 导入旧文档"),
					h("div", {
						key: "d",
						style: {
							fontSize: "11px",
							color: C.muted,
							lineHeight: 1.8,
							marginBottom: "8px"
						}
					}, [h("div", { key: "a" }, "选一个旧方案 / 旧文档所在目录（本机任意位置）。"), h("div", { key: "b" }, "导入件放 inbox/imported/，登记为 inbox / 待审，**不提升为正式资产**（旧文档是参考材料，供成稿时按章节对照）。")]),
					h("div", {
						key: "row",
						style: {
							display: "flex",
							gap: "7px",
							alignItems: "center",
							flexWrap: "wrap",
							marginBottom: "7px"
						}
					}, [h("button", {
						key: "p",
						type: "button",
						disabled: busy || !props.onPickDir,
						onClick: () => {
							setBusy(true);
							props.onPickDir().then((r) => {
								setBusy(false);
								if (r && r.ok && r.value) {
									setImpPath(String(r.value));
									setNote(null);
								} else if (r && r.ok && !r.value) setNote("已取消选择。");
								else setNote("选择目录失败：" + humanError(r));
							});
						},
						style: {
							font: "inherit",
							fontSize: "12px",
							padding: "5px 12px",
							border: "1px solid " + C.ink,
							background: "#fff",
							borderRadius: "4px",
							cursor: "pointer"
						}
					}, "选择目录…"), h("input", {
						key: "i",
						value: impPath,
						placeholder: "或直接粘贴目录路径",
						onChange: (e) => setImpPath(e.target.value),
						style: {
							flex: "1 1 260px",
							fontSize: "12px",
							padding: "5px 8px",
							border: "1px solid " + C.soft,
							borderRadius: "4px",
							outline: "none",
							fontFamily: "monospace",
							background: "#fff"
						}
					})]),
					h("input", {
						key: "n",
						value: impNote,
						placeholder: "备注（可选，例如：V0.3 完整策划案，成稿时按章节对照）",
						onChange: (e) => setImpNote(e.target.value),
						style: {
							width: "100%",
							boxSizing: "border-box",
							fontSize: "12px",
							padding: "5px 8px",
							border: "1px solid " + C.soft,
							borderRadius: "4px",
							outline: "none",
							background: "#fff",
							marginBottom: "8px"
						}
					}),
					h("button", {
						key: "go",
						type: "button",
						disabled: busy || !impPath,
						onClick: () => {
							setBusy(true);
							setNote(null);
							props.onImport(impPath, impNote).then((t) => {
								setBusy(false);
								setNote(t);
								setTool("");
							});
						},
						style: {
							font: "inherit",
							fontSize: "12px",
							padding: "6px 15px",
							border: "1px solid " + C.ink,
							background: busy || !impPath ? "#888" : C.ink,
							color: "#fff",
							borderRadius: "4px",
							cursor: busy || !impPath ? "default" : "pointer"
						}
					}, "确认导入")
				]) : null,
				tool === "manual" ? h("div", {
					key: "man",
					style: {
						border: "1px solid " + C.faint,
						borderLeft: "3px solid " + C.ink,
						background: "#fff",
						borderRadius: "4px",
						padding: "11px 13px",
						marginBottom: "11px"
					}
				}, [
					h("div", {
						key: "t",
						style: {
							fontSize: "12px",
							fontWeight: 600,
							marginBottom: "6px"
						}
					}, "方式 4 · 人工补充"),
					h("div", {
						key: "d",
						style: {
							fontSize: "11px",
							color: C.muted,
							lineHeight: 1.8,
							marginBottom: "8px"
						}
					}, "写入 inbox/manual/，登记为 inbox / 待审。想到一条规则、边界情况或口径，随手记下来即可 —— 不用先想归类。"),
					h("input", {
						key: "ti",
						value: mTitle,
						placeholder: "标题（例如：联盟榜同分时的排序口径）",
						onChange: (e) => setMTitle(e.target.value),
						style: {
							width: "100%",
							boxSizing: "border-box",
							fontSize: "12px",
							padding: "5px 8px",
							border: "1px solid " + C.soft,
							borderRadius: "4px",
							outline: "none",
							background: "#fff",
							marginBottom: "7px"
						}
					}),
					h("textarea", {
						key: "bo",
						value: mBody,
						placeholder: "正文（自由文本）",
						onChange: (e) => setMBody(e.target.value),
						rows: 7,
						style: {
							width: "100%",
							boxSizing: "border-box",
							fontSize: "12px",
							lineHeight: 1.7,
							padding: "7px 9px",
							border: "1px solid " + C.soft,
							borderRadius: "4px",
							outline: "none",
							background: "#fff",
							resize: "vertical",
							fontFamily: "inherit",
							marginBottom: "7px"
						}
					}),
					h("div", {
						key: "up",
						style: {
							display: "flex",
							gap: "7px",
							alignItems: "center",
							flexWrap: "wrap",
							marginBottom: "8px"
						}
					}, [h("span", {
						key: "l",
						style: {
							fontSize: "11px",
							color: C.muted
						}
					}, "补充的是哪份资产（可选）"), h("select", {
						key: "s",
						value: mUp,
						onChange: (e) => setMUp(e.target.value),
						style: {
							flex: "1 1 280px",
							fontSize: "12px",
							padding: "4px 7px",
							border: "1px solid " + C.soft,
							borderRadius: "4px",
							background: "#fff"
						}
					}, [h("option", {
						key: "",
						value: ""
					}, "（不指定）"), ...all.filter((a) => a.asset_type !== "inbox").map((a) => h("option", {
						key: a.asset_id,
						value: a.asset_id
					}, a.asset_id + "　" + String(a.path)))])]),
					h("button", {
						key: "go",
						type: "button",
						disabled: busy || !mTitle.trim() || !mBody.trim(),
						onClick: () => {
							setBusy(true);
							setNote(null);
							props.onManual(mTitle.trim(), mBody, mUp).then((t) => {
								setBusy(false);
								setNote(t);
								setTool("");
								setMTitle("");
								setMBody("");
								setMUp("");
							});
						},
						style: {
							font: "inherit",
							fontSize: "12px",
							padding: "6px 15px",
							border: "1px solid " + C.ink,
							background: busy || !mTitle.trim() || !mBody.trim() ? "#888" : C.ink,
							color: "#fff",
							borderRadius: "4px",
							cursor: "pointer"
						}
					}, "保存到收集箱")
				]) : null,
				note ? h("div", {
					key: "nt",
					style: {
						border: "1px solid " + C.faint,
						borderLeft: "3px solid " + C.ok,
						background: "#fff",
						borderRadius: "4px",
						padding: "8px 11px",
						fontSize: "12px",
						marginBottom: "11px",
						color: C.ok
					}
				}, note) : null,
				h("div", {
					key: "f1",
					style: {
						display: "flex",
						gap: "6px",
						flexWrap: "wrap",
						marginBottom: "7px"
					}
				}, [chip("全部", all.length, type === "__all__", () => setType("__all__"), "t0"), ...Object.keys(typeCounts).sort().map((k) => chip(ASSET_TYPE_LABEL[k] || k, typeCounts[k], type === k, () => setType(k), "t" + k))]),
				h("div", {
					key: "f2",
					style: {
						display: "flex",
						gap: "6px",
						flexWrap: "wrap",
						marginBottom: "9px",
						alignItems: "center"
					}
				}, [
					chip("全部审核态", void 0, rev === "__all__", () => setRev("__all__"), "r0"),
					...Object.keys(revCounts).sort().map((k) => chip(REVIEW_LABEL[k] || k, revCounts[k], rev === k, () => setRev(k), "r" + k)),
					h("input", {
						key: "q",
						value: q,
						placeholder: "搜索 id / 路径 / 标题…",
						onChange: (e) => setQ(e.target.value),
						style: {
							flex: "1 1 180px",
							maxWidth: "280px",
							fontSize: "12px",
							padding: "3px 8px",
							border: "1px solid " + C.soft,
							borderRadius: "12px",
							outline: "none",
							background: "#fff"
						}
					}),
					h("span", {
						key: "n",
						style: {
							fontSize: "11px",
							color: C.muted
						}
					}, "显示 " + filtered.length + " / " + all.length)
				]),
				filtered.length ? h("div", {
					key: "list",
					style: {
						border: "1px solid " + C.faint,
						borderRadius: "4px",
						background: "#fff",
						overflow: "hidden"
					}
				}, filtered.map((a, i) => {
					const tone = REVIEW_TONE[a.review_status] === void 0 ? null : REVIEW_TONE[a.review_status];
					const refs = [];
					if (a.supersedes && a.supersedes.length) refs.push("取代 " + linkRefs(a.supersedes));
					if (a.upstream_assets && a.upstream_assets.length) refs.push("上游 " + linkRefs(a.upstream_assets));
					if (a.downstream_assets && a.downstream_assets.length) refs.push("下游 " + linkRefs(a.downstream_assets));
					return h("div", {
						key: a.asset_id || i,
						style: {
							padding: "8px 11px",
							borderTop: i ? "1px solid " + C.faint : "none"
						}
					}, [
						h("div", {
							key: "r1",
							style: {
								display: "flex",
								gap: "8px",
								alignItems: "center",
								flexWrap: "wrap"
							}
						}, [
							h("span", {
								key: "id",
								style: {
									fontFamily: "monospace",
									fontSize: "11px",
									color: C.muted,
									minWidth: "150px"
								}
							}, String(a.asset_id || "")),
							badge(ASSET_TYPE_LABEL[a.asset_type] || a.asset_type, null),
							a.review_status ? badge(REVIEW_LABEL[a.review_status] || a.review_status, tone) : null,
							a.format ? badge(a.format, null) : null,
							a.source_skill ? h("span", {
								key: "sk",
								style: {
									fontSize: "10px",
									color: C.muted,
									fontFamily: "monospace"
								}
							}, a.source_skill) : null
						]),
						h("div", {
							key: "r2",
							style: { marginTop: "3px" }
						}, h("button", {
							type: "button",
							onClick: () => setOpenAsset(a),
							title: "在面板里阅读：" + a.path,
							style: {
								font: "inherit",
								fontSize: "12px",
								fontFamily: "monospace",
								padding: 0,
								border: "none",
								background: "none",
								color: "#3b6ea5",
								cursor: "pointer",
								textAlign: "left",
								maxWidth: "100%",
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap"
							}
						}, String(a.path || ""))),
						refs.length ? h("div", {
							key: "r3",
							style: {
								marginTop: "3px",
								fontSize: "11px",
								color: C.muted
							}
						}, refs.join("　·　")) : null
					]);
				})) : h("div", {
					key: "none",
					style: {
						color: C.muted,
						fontSize: "12px"
					}
				}, "没有匹配的资产。"),
				h("div", {
					key: "foot",
					style: {
						marginTop: "12px",
						fontSize: "11px",
						color: C.muted,
						lineHeight: 1.85
					}
				}, [h("div", { key: "a" }, "资产索引由 scripts/refresh_asset_index.py 生成；工作台只读它，不自己维护。"), h("div", { key: "b" }, "扫描范围：analysis / decisions / evidence / proposals 四个目录。运行包与副本不在索引内。")])
			]);
		}
		/** 按扩展名判类型 */
		function extOf(p) {
			const m = /\.([A-Za-z0-9]+)$/.exec(String(p || ""));
			return m ? m[1].toLowerCase() : "";
		}
		const IMG_EXT = {
			png: 1,
			jpg: 1,
			jpeg: 1,
			gif: 1,
			webp: 1,
			svg: 1,
			bmp: 1
		};
		const MD_EXT = {
			md: 1,
			markdown: 1
		};
		const JSON_EXT = { json: 1 };
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
			if (isScalar(v)) return h("div", { style: {
				fontSize: "12px",
				lineHeight: 1.75,
				whiteSpace: "pre-wrap",
				wordBreak: "break-word"
			} }, shortVal(v));
			if (Array.isArray(v)) {
				if (v.length === 0) return h("div", { style: {
					fontSize: "12px",
					color: C.muted
				} }, "（空）");
				if (isObjArray(v)) {
					const keys = [];
					for (const it of v) for (const k of Object.keys(it)) if (keys.indexOf(k) < 0) keys.push(k);
					return h("div", { style: { overflowX: "auto" } }, h("table", { style: {
						borderCollapse: "collapse",
						width: "100%",
						fontSize: "11px"
					} }, [h("thead", { key: "h" }, h("tr", null, keys.map((k) => h("th", {
						key: k,
						style: {
							border: "1px solid " + C.faint,
							background: C.bg,
							padding: "4px 7px",
							textAlign: "left",
							whiteSpace: "nowrap"
						}
					}, k)))), h("tbody", { key: "b" }, v.map((it, i) => h("tr", { key: i }, keys.map((k) => {
						const cell = it[k];
						return h("td", {
							key: k,
							style: {
								border: "1px solid " + C.faint,
								padding: "4px 7px",
								verticalAlign: "top",
								maxWidth: "320px"
							}
						}, isScalar(cell) ? h("span", { style: {
							whiteSpace: "pre-wrap",
							wordBreak: "break-word"
						} }, shortVal(cell)) : h("span", { style: { color: C.muted } }, shortVal(cell)));
					}))))]));
				}
				return h("div", { style: {
					display: "flex",
					flexDirection: "column",
					gap: "4px"
				} }, v.map((x, i) => h("div", {
					key: i,
					style: {
						display: "flex",
						gap: "7px"
					}
				}, [h("span", {
					key: "i",
					style: {
						color: C.muted,
						fontFamily: "monospace",
						fontSize: "11px"
					}
				}, String(i + 1) + "."), h("span", {
					key: "v",
					style: { flex: "1 1 auto" }
				}, isScalar(x) ? h("span", { style: {
					fontSize: "12px",
					whiteSpace: "pre-wrap",
					wordBreak: "break-word"
				} }, shortVal(x)) : h(ReadableJson, {
					value: x,
					depth: depth + 1
				}))])));
			}
			const keys = Object.keys(v);
			if (!keys.length) return h("div", { style: {
				fontSize: "12px",
				color: C.muted
			} }, "（空对象）");
			return h("div", null, keys.map((k) => {
				const val = v[k];
				const scalar = isScalar(val);
				return h("div", {
					key: k,
					style: {
						display: "flex",
						gap: "9px",
						paddingLeft: pad + "px",
						marginBottom: "3px",
						alignItems: "flex-start"
					}
				}, [h("span", {
					key: "k",
					style: {
						fontSize: "11px",
						fontFamily: "monospace",
						color: C.muted,
						minWidth: "120px",
						flex: "0 0 auto",
						paddingTop: scalar ? "1px" : "0"
					}
				}, k), h("span", {
					key: "v",
					style: {
						flex: "1 1 auto",
						minWidth: 0
					}
				}, scalar ? h("span", { style: {
					fontSize: "12px",
					whiteSpace: "pre-wrap",
					wordBreak: "break-word",
					display: "block",
					lineHeight: 1.7
				} }, shortVal(val)) : h(ReadableJson, {
					value: val,
					depth: depth + 1
				}))]);
			}));
		}
		/** 单个资产的内容阅读器（B2）*/
		function AssetReader(props) {
			const a = props.asset;
			const srWs = props.srWs || "";
			const onBack = props.onBack;
			const onOpen = props.onOpen;
			const [text, setText] = react.useState(void 0);
			const [docDir, setDocDir] = react.useState("");
			const read = props.read;
			const abs = a ? srWs + "/" + a.path : "";
			const ext = extOf(a ? a.path : "");
			react.useEffect(() => {
				if (!a || !read || !srWs) {
					setText(null);
					return;
				}
				if (IMG_EXT[ext]) {
					setText("");
					return;
				}
				let cancelled = false;
				setText(void 0);
				const dir = String(a.path).replace(/[^\\/]+$/, "");
				setDocDir(dir);
				read(srWs + "/" + a.path).then((t) => {
					if (!cancelled) setText(t);
				}, () => {
					if (!cancelled) setText(null);
				});
				return () => {
					cancelled = true;
				};
			}, [
				a ? a.asset_id : "",
				a ? a.path : "",
				srWs
			]);
			if (!a) return null;
			const body = [];
			if (IMG_EXT[ext]) body.push(h("img", {
				key: "img",
				src: fileUrl(abs),
				alt: a.path,
				style: {
					maxWidth: "100%",
					border: "1px solid " + C.faint,
					borderRadius: "4px",
					background: C.bg,
					display: "block"
				}
			}));
			else if (ext === "html" || ext === "htm") body.push(h("div", {
				key: "html",
				style: {
					border: "1px solid " + C.faint,
					borderLeft: "3px solid " + C.warn,
					background: "#fffdf7",
					borderRadius: "4px",
					padding: "11px 13px",
					fontSize: "12px",
					lineHeight: 1.8
				}
			}, [
				h("div", { key: "a" }, "HTML 交付物不在面板里内嵌渲染。"),
				h("div", {
					key: "b",
					style: { color: C.muted }
				}, "原因：/api/file 路由带 `Content-Security-Policy: sandbox; default-src 'none'`，内嵌会丢掉全部样式。"),
				h("div", {
					key: "c",
					style: { color: C.muted }
				}, "点上面的「用默认程序打开」会在浏览器里正常显示。")
			]));
			else if (MD_EXT[ext] && typeof text === "string") {
				const absDir = srWs + (docDir ? "/" + String(docDir).replace(/\/$/, "") : "");
				const pathImages = { resolve: (v) => {
					if (!v || typeof v !== "string") return void 0;
					if (!/\.(png|jpe?g|gif|webp|svg)$/i.test(v)) return void 0;
					return fileUrl(/^[A-Za-z]:[\\/]/.test(v) || v.charAt(0) === "/" ? v : absDir.replace(/[\\/]+$/, "") + "/" + v);
				} };
				const spec = mdSpecOf(a.path);
				body.push(h("div", {
					key: "note",
					style: {
						fontSize: "11px",
						marginBottom: "9px",
						padding: "6px 10px",
						border: "1px solid " + C.faint,
						borderLeft: "3px solid " + (spec ? C.ok : C.soft),
						background: spec ? "#f0fdf4" : C.bg,
						borderRadius: "4px",
						color: spec ? C.ok : C.muted
					}
				}, spec ? "按产出规范渲染 · " + spec.name + "（治理/备料/样本元信息已折叠；未见过的章节收进「其他章节」不会丢）" : "这类产出还没有规范，按原文渲染"));
				body.push(spec ? h(SpecMdView, {
					key: "md",
					text,
					spec,
					pathImages
				}) : h(Md, {
					key: "md",
					text,
					pathImages
				}));
			} else if ((JSON_EXT[ext] || ext === "jsonl") && typeof text === "string") {
				if (ext === "jsonl") {
					const rows = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
					body.push(h("div", {
						key: "l",
						style: {
							fontSize: "11px",
							color: C.muted,
							marginBottom: "7px"
						}
					}, rows.length + " 行"));
					body.push(h("div", { key: "r" }, rows.map((l, i) => {
						let v = null, bad = false;
						try {
							v = JSON.parse(l);
						} catch (e) {
							bad = true;
						}
						return h("div", {
							key: i,
							style: {
								border: "1px solid " + C.faint,
								borderRadius: "4px",
								background: "#fff",
								padding: "8px 10px",
								marginBottom: "6px"
							}
						}, bad ? h("pre", { style: PRESTYLE }, l) : h(ReadableJson, { value: v }));
					})));
				} else {
					let v = null, bad = false;
					try {
						v = JSON.parse(text);
					} catch (e) {
						bad = true;
					}
					const base = String(a.path).split("/").pop() || "";
					if (bad) body.push(h("div", {
						key: "j",
						style: {
							border: "1px solid " + C.faint,
							borderRadius: "4px",
							background: "#fff",
							padding: "11px 13px"
						}
					}, [h("div", {
						key: "e",
						style: {
							fontSize: "12px",
							color: C.bad,
							marginBottom: "6px"
						}
					}, "JSON 解析失败，原始文本如下："), h("pre", {
						key: "p",
						style: PRESTYLE
					}, text)]));
					else if (/^issue-cards_/i.test(base)) {
						body.push(h("div", {
							key: "note",
							style: {
								fontSize: "11px",
								marginBottom: "9px",
								padding: "6px 10px",
								border: "1px solid " + C.faint,
								borderLeft: "3px solid " + C.ok,
								background: "#f0fdf4",
								borderRadius: "4px",
								color: C.ok
							}
						}, "按产出规范渲染 · 问题卡（只显示设计相关字段；路径与素材源已省略）"));
						body.push(h(IssueCardsView, {
							key: "ic",
							data: v
						}));
					} else if (/^sr-gdd-handoff_/i.test(base)) {
						body.push(h("div", {
							key: "note",
							style: {
								fontSize: "11px",
								marginBottom: "9px",
								padding: "6px 10px",
								border: "1px solid " + C.faint,
								borderLeft: "3px solid " + C.ok,
								background: "#f0fdf4",
								borderRadius: "4px",
								color: C.ok
							}
						}, "按产出规范渲染 · 交接件（设计核 / 已拍板事实 / 未闭合假设 / 待决问题 / 已闭合假设；路径与 id 收进溯源）"));
						body.push(h(HandoffView, {
							key: "ho",
							data: v
						}));
					} else {
						body.push(h("div", {
							key: "note",
							style: {
								fontSize: "11px",
								marginBottom: "9px",
								padding: "6px 10px",
								border: "1px solid " + C.faint,
								borderLeft: "3px solid " + C.warn,
								background: "#fffdf7",
								borderRadius: "4px",
								color: C.warn
							}
						}, "这类 JSON 还没有产出规范，按结构渲染（可能含元数据噪声）"));
						body.push(h("div", {
							key: "j",
							style: {
								border: "1px solid " + C.faint,
								borderRadius: "4px",
								background: "#fff",
								padding: "11px 13px"
							}
						}, h(ReadableJson, { value: v })));
					}
				}
			} else if (typeof text === "string") body.push(h("pre", {
				key: "t",
				style: PRESTYLE
			}, text.slice(0, 2e5)));
			else if (text === void 0) body.push(h("div", {
				key: "l",
				style: {
					color: C.muted,
					fontSize: "12px"
				}
			}, "正在读取…"));
			else body.push(h("div", {
				key: "n",
				style: {
					color: C.muted,
					fontSize: "12px"
				}
			}, "读不到内容（可能不是文本文件）。用默认程序打开试试。"));
			const refLine = [];
			if (a.supersedes && a.supersedes.length) refLine.push("取代 " + a.supersedes.join("、"));
			if (a.upstream_assets && a.upstream_assets.length) refLine.push("上游 " + a.upstream_assets.join("、"));
			if (a.downstream_assets && a.downstream_assets.length) refLine.push("下游 " + a.downstream_assets.join("、"));
			return h("div", null, [
				h("div", {
					key: "bar",
					style: {
						display: "flex",
						gap: "8px",
						alignItems: "center",
						marginBottom: "10px",
						flexWrap: "wrap"
					}
				}, [
					h("button", {
						key: "b",
						type: "button",
						onClick: onBack,
						style: {
							font: "inherit",
							fontSize: "12px",
							padding: "4px 11px",
							border: "1px solid " + C.soft,
							background: "#fff",
							borderRadius: "4px",
							cursor: "pointer"
						}
					}, "‹ 返回列表"),
					badge(ASSET_TYPE_LABEL[a.asset_type] || a.asset_type, null),
					a.review_status ? badge(REVIEW_LABEL[a.review_status] || a.review_status, REVIEW_TONE[a.review_status]) : null,
					h("button", {
						key: "o",
						type: "button",
						onClick: () => onOpen(abs),
						style: {
							font: "inherit",
							fontSize: "12px",
							padding: "4px 11px",
							border: "1px solid " + C.ink,
							background: "#fff",
							borderRadius: "4px",
							cursor: "pointer"
						}
					}, "用默认程序打开")
				]),
				h("div", {
					key: "meta",
					style: {
						fontSize: "11px",
						color: C.muted,
						marginBottom: "10px",
						lineHeight: 1.8
					}
				}, [
					h("div", {
						key: "p",
						style: {
							fontFamily: "monospace",
							wordBreak: "break-all"
						}
					}, String(a.asset_id || "") + "　" + a.path),
					a.source_skill ? h("div", { key: "s" }, "来源技能：" + a.source_skill) : null,
					refLine.length ? h("div", { key: "r" }, refLine.join("　·　")) : null
				]),
				...body
			]);
		}
		const PRESTYLE = {
			fontSize: "11px",
			fontFamily: "monospace",
			whiteSpace: "pre-wrap",
			wordBreak: "break-word",
			background: C.bg,
			border: "1px solid " + C.faint,
			borderRadius: "3px",
			padding: "10px",
			margin: 0,
			maxHeight: "70vh",
			overflow: "auto",
			userSelect: "text",
			lineHeight: 1.6
		};
		/** 一段 markdown（用 DSH 的 MarkdownText；取不到则降级 <pre>） */
		function Md(props) {
			const text = props.text || "";
			if (primitives && primitives.MarkdownText) return h("div", { style: {
				fontSize: "13px",
				lineHeight: 1.85,
				color: C.ink
			} }, h(primitives.MarkdownText, {
				text,
				pathImages: props.pathImages
			}));
			return h("pre", { style: PRESTYLE }, text);
		}
		function SectionBlock(props) {
			const s = props.section;
			return h("div", {
				key: props.k,
				style: { marginBottom: "14px" }
			}, [h("div", {
				key: "h",
				style: {
					fontSize: "13px",
					fontWeight: 600,
					marginBottom: "6px",
					color: C.ink,
					borderBottom: "1px solid " + C.faint,
					paddingBottom: "4px"
				}
			}, s.title), h(Md, {
				key: "b",
				text: s.body,
				pathImages: props.pathImages
			})]);
		}
		/**
		* 按规范渲染一份 markdown 产出：
		* 置顶区 → 主体区 → 折叠区（治理/备料）→「其他章节」（未知的不丢）
		*/
		function SpecMdView(props) {
			const text = props.text;
			const spec = props.spec;
			const pathImages = props.pathImages;
			const [open, setOpen] = react.useState({});
			const sections = parseMdSections(text);
			if (!sections.length) return h("pre", { style: PRESTYLE }, text);
			const top = [], body = [], fold = [], unknown = [];
			for (const s of sections) {
				const cls = classifyHeading(s.title, spec ? spec.sections : []);
				if (cls === "skip") continue;
				if (cls === "top") top.push(s);
				else if (cls === "body") body.push(s);
				else if (cls === "fold") fold.push(s);
				else unknown.push(s);
			}
			const foldGroup = (label, items, keyPrefix, tone) => items.length ? h("div", {
				key: keyPrefix,
				style: {
					border: "1px solid " + C.faint,
					borderRadius: "4px",
					background: "#fff",
					marginBottom: "9px",
					overflow: "hidden"
				}
			}, [h("div", {
				key: "h",
				onClick: () => setOpen((o) => {
					const n = {};
					for (const k in o) n[k] = o[k];
					n[keyPrefix] = !o[keyPrefix];
					return n;
				}),
				style: {
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					padding: "7px 11px",
					background: C.bg,
					cursor: "pointer",
					borderBottom: open[keyPrefix] ? "1px solid " + C.faint : "none"
				}
			}, [h("span", {
				key: "t",
				style: {
					fontSize: "11px",
					color: tone || C.muted
				}
			}, label + "（" + items.length + " 节）"), h("span", {
				key: "g",
				style: {
					fontSize: "10px",
					color: C.muted
				}
			}, open[keyPrefix] ? "收起 ▾" : "展开 ▸")]), open[keyPrefix] ? h("div", {
				key: "b",
				style: { padding: "10px 11px" }
			}, items.map((s, i) => h(SectionBlock, {
				key: i,
				k: keyPrefix + i,
				section: s,
				pathImages
			}))) : null]) : null;
			return h("div", null, [
				top.length ? h("div", {
					key: "top",
					style: {
						border: "1px solid " + C.faint,
						borderLeft: "3px solid " + C.ink,
						background: "#fff",
						borderRadius: "4px",
						padding: "11px 13px",
						marginBottom: "12px"
					}
				}, top.map((s, i) => h(SectionBlock, {
					key: i,
					k: "top" + i,
					section: s,
					pathImages
				}))) : null,
				body.map((s, i) => h(SectionBlock, {
					key: i,
					k: "b" + i,
					section: s,
					pathImages
				})),
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
			const row = (k, v, color) => v ? h("div", {
				key: k,
				style: {
					display: "flex",
					gap: "9px",
					fontSize: "12px",
					lineHeight: 1.8
				}
			}, [h("span", {
				key: "k",
				style: {
					color: C.muted,
					minWidth: "78px",
					flex: "0 0 auto"
				}
			}, k), h("span", {
				key: "v",
				style: {
					color: color || C.ink,
					flex: "1 1 auto",
					whiteSpace: "pre-wrap",
					wordBreak: "break-word"
				}
			}, v)]) : null;
			return h("div", null, [
				h("div", {
					key: "m",
					style: {
						border: "1px solid " + C.faint,
						borderRadius: "4px",
						background: "#fff",
						padding: "10px 13px",
						marginBottom: "12px"
					}
				}, [
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
						borderRadius: "4px",
						background: "#fff",
						padding: "10px 13px",
						marginBottom: "9px"
					}
				}, [
					h("div", {
						key: "h",
						style: {
							display: "flex",
							gap: "8px",
							alignItems: "center",
							marginBottom: "6px",
							flexWrap: "wrap"
						}
					}, [
						badge(String(c.priority || ""), c.priority === "P1" ? "bad" : c.priority === "P2" ? "warn" : null),
						h("span", {
							key: "i",
							style: {
								fontFamily: "monospace",
								fontSize: "11px",
								color: C.muted
							}
						}, String(c.issue_id || "")),
						c.owner ? badge(c.owner, null) : null,
						c.unsupported_by_sample ? badge("无样本支持", "warn") : null
					]),
					cardRow("症状", c.symptom, C.ink),
					cardRow("根因假设", c.root_cause_hypothesis),
					cardRow("影响", c.impact),
					cardRow("修法", c.fix_action, C.ok),
					c.validation ? h("div", {
						key: "v",
						style: {
							marginTop: "5px",
							borderTop: "1px solid " + C.faint,
							paddingTop: "5px"
						}
					}, [h("div", {
						key: "t",
						style: {
							fontSize: "11px",
							color: C.muted,
							marginBottom: "2px"
						}
					}, "验证方案"), h("div", {
						key: "b",
						style: {
							fontSize: "12px",
							lineHeight: 1.8,
							paddingLeft: "9px"
						}
					}, [
						cardRow("指标", c.validation.metric, C.ink, true),
						cardRow("方法", c.validation.method, C.ink, true),
						cardRow("通过线", c.validation.pass_threshold, C.ok, true),
						cardRow("停止条件", c.validation.stop_condition, C.bad, true)
					])]) : null,
					c.evidence_refs && c.evidence_refs.length ? h("div", {
						key: "e",
						style: {
							marginTop: "5px",
							fontSize: "11px",
							color: C.muted,
							fontFamily: "monospace"
						}
					}, "证据：" + c.evidence_refs.join("　")) : null
				])),
				unc.length ? h("div", {
					key: "u",
					style: {
						border: "1px solid " + C.faint,
						borderLeft: "3px solid " + C.warn,
						background: "#fffdf7",
						borderRadius: "4px",
						padding: "10px 13px"
					}
				}, [h("div", {
					key: "t",
					style: {
						fontSize: "12px",
						fontWeight: 600,
						marginBottom: "5px"
					}
				}, "不确定观察（" + unc.length + "）"), ...unc.map((u, i) => h("div", {
					key: i,
					style: {
						fontSize: "12px",
						lineHeight: 1.8
					}
				}, [h("span", {
					key: "i",
					style: {
						fontFamily: "monospace",
						fontSize: "11px",
						color: C.muted
					}
				}, String(u.evidence_id || "") + "　"), h("span", { key: "n" }, String(u.note || ""))]))]) : null
			]);
		}
		function cardRow(k, v, color, compact) {
			if (!v) return null;
			return h("div", {
				key: k,
				style: {
					display: "flex",
					gap: "8px",
					fontSize: compact ? "11px" : "12px",
					lineHeight: 1.8,
					alignItems: "flex-start"
				}
			}, [h("span", {
				key: "k",
				style: {
					color: C.muted,
					minWidth: compact ? "52px" : "60px",
					flex: "0 0 auto"
				}
			}, k), h("span", {
				key: "v",
				style: {
					color: color || C.ink,
					flex: "1 1 auto",
					whiteSpace: "pre-wrap",
					wordBreak: "break-word"
				}
			}, String(v))]);
		}
		/** 交接件（sr-gdd-handoff_*.json 规范）：5 区块，其余折叠 */
		function HandoffView(props) {
			const d = props.data || {};
			const [showSrc, setShowSrc] = react.useState(false);
			const nucleus = d.chosen_nucleus || {};
			const al = d.assumption_ledger || {};
			const facts = Array.isArray(d.calibrated_facts) ? d.calibrated_facts : [];
			const openA = Array.isArray(al.open) ? al.open : [];
			const closedA = Array.isArray(al.closed) ? al.closed : [];
			const questions = Array.isArray(d.open_questions_for_gdd) ? d.open_questions_for_gdd : [];
			const materials = d.materials || {};
			const block = (key, title, tone, children) => children ? h("div", {
				key,
				style: {
					border: "1px solid " + C.faint,
					borderLeft: "3px solid " + (tone || C.soft),
					borderRadius: "4px",
					background: "#fff",
					padding: "10px 13px",
					marginBottom: "10px"
				}
			}, [h("div", {
				key: "t",
				style: {
					fontSize: "12px",
					fontWeight: 600,
					marginBottom: "6px"
				}
			}, title), ...children]) : null;
			return h("div", null, [
				h("div", {
					key: "top",
					style: {
						fontSize: "12px",
						color: C.muted,
						marginBottom: "10px"
					}
				}, (d.topic || "") + "　" + (d.source_skill || "") + " → " + (d.target_skill || "")),
				block("n", "① 设计核" + (nucleus.id ? "（" + nucleus.id + "）" : ""), C.ink, [
					nucleus.statement ? h("div", {
						key: "s",
						style: {
							fontSize: "13px",
							lineHeight: 1.85,
							marginBottom: "6px"
						}
					}, String(nucleus.statement)) : null,
					cardRow("核心张力", nucleus.key_tension),
					cardRow("组合", nucleus.combination),
					nucleus.kill_signal ? h("div", {
						key: "k",
						style: {
							marginTop: "6px",
							borderTop: "1px solid " + C.faint,
							paddingTop: "6px",
							fontSize: "12px",
							lineHeight: 1.8,
							color: C.bad
						}
					}, [h("span", {
						key: "l",
						style: { color: C.muted }
					}, "Kill Signal　"), String(nucleus.kill_signal)]) : null
				]),
				block("f", "② 已拍板事实（" + facts.length + "）", C.ok, facts.map((t, i) => h("div", {
					key: i,
					style: {
						fontSize: "12px",
						lineHeight: 1.85,
						marginBottom: "4px",
						paddingLeft: "9px",
						borderLeft: "2px solid " + C.faint
					}
				}, String(t)))),
				block("o", "③ 未闭合假设（" + openA.length + "）", C.warn, openA.map((a, i) => h("div", {
					key: i,
					style: {
						fontSize: "12px",
						lineHeight: 1.8,
						marginBottom: "7px"
					}
				}, [h("div", { key: "d" }, [h("span", {
					key: "i",
					style: {
						fontFamily: "monospace",
						color: C.muted
					}
				}, String(a.id || "") + "　"), h("span", { key: "t" }, String(a.desc || ""))]), h("div", {
					key: "m",
					style: {
						marginLeft: "9px",
						color: C.muted,
						fontSize: "11px"
					}
				}, "影响 " + String(a.impact || "?") + "　·　怎么验：" + String(a.validate || "?"))]))),
				block("q", "④ 留给成稿的待决问题（" + questions.length + "）", C.ink, questions.map((t, i) => h("div", {
					key: i,
					style: {
						fontSize: "12px",
						lineHeight: 1.85,
						marginBottom: "4px"
					}
				}, "· " + String(t)))),
				closedA.length ? h("div", {
					key: "c",
					style: {
						fontSize: "11px",
						color: C.muted,
						marginBottom: "10px"
					}
				}, "⑤ 已闭合假设：" + closedA.join("、")) : null,
				d.next_step ? h("div", {
					key: "ns",
					style: {
						fontSize: "12px",
						lineHeight: 1.8,
						marginBottom: "10px"
					}
				}, [h("span", {
					key: "l",
					style: { color: C.muted }
				}, "下一步　"), String(d.next_step)]) : null,
				h("div", {
					key: "src",
					style: {
						border: "1px solid " + C.faint,
						borderRadius: "4px",
						background: C.bg,
						overflow: "hidden"
					}
				}, [h("div", {
					key: "h",
					onClick: () => setShowSrc(!showSrc),
					style: {
						padding: "7px 11px",
						cursor: "pointer",
						display: "flex",
						justifyContent: "space-between",
						fontSize: "11px",
						color: C.muted
					}
				}, [h("span", { key: "t" }, "溯源（路径 / id / 引用）"), h("span", { key: "g" }, showSrc ? "收起 ▾" : "展开 ▸")]), showSrc ? h("div", {
					key: "b",
					style: {
						padding: "0 11px 10px",
						fontSize: "11px",
						fontFamily: "monospace",
						color: C.muted,
						lineHeight: 1.8,
						wordBreak: "break-all"
					}
				}, [
					h("div", { key: "i" }, "handoff_id: " + String(d.handoff_id || "") + "　created_at: " + String(d.created_at || "")),
					Object.keys(materials).filter((k) => k !== "original_brief_note").map((k, i) => h("div", { key: "m" + i }, k + ": " + String(materials[k]))),
					d.risk_register_ref ? h("div", { key: "r" }, "risk_register_ref: " + String(d.risk_register_ref)) : null,
					d.config_prediction_ref ? h("div", { key: "p" }, "config_prediction_ref: " + String(d.config_prediction_ref)) : null
				]) : null]),
				materials.original_brief_note ? h("div", {
					key: "obn",
					style: {
						marginTop: "9px",
						border: "1px solid " + C.faint,
						borderLeft: "3px solid " + C.warn,
						background: "#fffdf7",
						borderRadius: "4px",
						padding: "9px 12px",
						fontSize: "12px",
						lineHeight: 1.8
					}
				}, ["旧文档说明　", String(materials.original_brief_note)]) : null
			]);
		}
		/** 折叠块（A5 用） */
		function Fold(props) {
			const [open, setOpen] = react.useState(!!props.defaultOpen);
			return h("div", { style: props.style }, [h("div", {
				key: "h",
				onClick: () => setOpen(!open),
				style: {
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					padding: "7px 11px",
					background: C.bg,
					cursor: "pointer",
					borderBottom: open ? "1px solid " + C.faint : "none"
				}
			}, [h("span", {
				key: "t",
				style: {
					fontSize: "12px",
					fontWeight: 600
				}
			}, props.title), h("span", {
				key: "g",
				style: {
					fontSize: "10px",
					color: C.muted
				}
			}, open ? "收起 ▾" : "展开 ▸")]), open ? h("div", {
				key: "b",
				style: { padding: "9px 11px" }
			}, props.children) : null]);
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
			const [broken, setBroken] = react.useState({});
			if (!data) return h("div", { style: {
				color: C.muted,
				fontSize: "12px"
			} }, "正在读定稿的 §5…");
			if (data.error) return h("div", { style: {
				color: C.bad,
				fontSize: "12px"
			} }, data.error);
			if (data.empty) return h("div", { style: {
				color: C.muted,
				fontSize: "12px"
			} }, data.empty);
			const rows = data.uiRows || [];
			const uis = data.uis || [];
			const imgTotal = uis.reduce((n, u) => n + u.images.length, 0);
			const ueTotal = uis.reduce((n, u) => n + u.ueCount, 0);
			const markBroken = (k) => setBroken((s) => {
				const o = {};
				for (const x in s) o[x] = s[x];
				o[k] = true;
				return o;
			});
			return h("div", null, [
				h("div", {
					key: "sum",
					style: {
						fontSize: "12px",
						color: C.muted,
						marginBottom: "10px"
					}
				}, "来自定稿 " + (data.file || "") + "　界面 " + rows.length + " 个 · 骨架图 " + imgTotal + " 张 · UE 规则 " + ueTotal + " 条"),
				h("div", {
					key: "figma",
					style: {
						border: "1px solid " + C.faint,
						borderLeft: "3px solid " + C.warn,
						background: "#fffdf7",
						borderRadius: "4px",
						marginBottom: "11px"
					}
				}, h(Fold, {
					title: "本节含 " + imgTotal + " 张界面图 · 可用 Figma MCP 生成线框图 · 手工触发",
					children: h("div", { style: {
						fontSize: "12px",
						lineHeight: 1.9,
						color: C.ink
					} }, [
						h("div", { key: "a" }, "工作台**不代跑**这一步（成本、TTY 授权与外部副作用都由你决定）。"),
						h("div", { key: "b" }, "做法：把上面对应 UI 的 ASCII 图/骨架图交给 Figma MCP，新建 Figma Draft；生成后把 Draft 链接记回 §5。"),
						h("div", {
							key: "c",
							style: { color: C.muted }
						}, "参考：成稿到线框图-提示方案.md · S0 实测报告.md")
					])
				})),
				rows.length ? h("div", {
					key: "tbl",
					style: {
						border: "1px solid " + C.faint,
						borderRadius: "4px",
						background: "#fff",
						overflow: "hidden",
						marginBottom: "11px"
					}
				}, [h("div", {
					key: "t",
					style: {
						fontSize: "12px",
						fontWeight: 600,
						padding: "7px 11px",
						background: C.bg,
						borderBottom: "1px solid " + C.faint
					}
				}, "§5.0 界面清单（" + rows.length + "）"), h("div", {
					key: "b",
					style: { padding: "0" }
				}, rows.map((r, i) => h("div", {
					key: i,
					style: {
						display: "flex",
						gap: "9px",
						padding: "6px 11px",
						borderTop: i ? "1px solid " + C.faint : "none",
						fontSize: "12px",
						lineHeight: 1.7
					}
				}, [
					h("span", {
						key: "i",
						style: {
							fontFamily: "monospace",
							fontSize: "11px",
							color: C.muted,
							minWidth: "52px",
							flex: "0 0 auto"
						}
					}, r.id),
					h("span", {
						key: "n",
						style: {
							fontWeight: 600,
							minWidth: "110px",
							flex: "0 0 auto"
						}
					}, r.name),
					h("span", {
						key: "e",
						style: {
							flex: "1 1 200px",
							color: C.muted
						}
					}, "进入：" + r.enter),
					h("span", {
						key: "x",
						style: {
							flex: "0 1 160px",
							color: C.muted
						}
					}, "退出：" + r.exit)
				])))]) : null,
				...uis.map((u) => h("div", {
					key: u.id,
					style: {
						border: "1px solid " + C.faint,
						borderRadius: "4px",
						background: "#fff",
						marginBottom: "10px",
						overflow: "hidden"
					}
				}, [h("div", {
					key: "h",
					style: {
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						padding: "7px 11px",
						background: C.bg,
						borderBottom: "1px solid " + C.faint
					}
				}, [h("span", {
					key: "t",
					style: {
						fontSize: "12px",
						fontWeight: 600
					}
				}, u.id + "　" + (u.title || "")), h("span", {
					key: "c",
					style: {
						fontSize: "10px",
						color: C.muted,
						fontFamily: "monospace"
					}
				}, "UE " + u.ueCount + " 条 · 图 " + u.images.length)]), h("div", {
					key: "b",
					style: {
						padding: "10px 11px",
						display: "flex",
						flexWrap: "wrap",
						gap: "10px"
					}
				}, u.images.length ? u.images.map((rel, i) => {
					const abs = srWs + "/proposals/" + rel;
					const name = String(rel).split("/").pop();
					return h("div", {
						key: i,
						style: {
							flex: "1 1 300px",
							maxWidth: "460px"
						}
					}, [broken[abs] ? h("div", {
						key: "f",
						style: {
							border: "1px dashed " + C.soft,
							borderRadius: "4px",
							padding: "18px",
							textAlign: "center",
							fontSize: "11px",
							color: C.muted
						}
					}, [h("div", { key: "a" }, "图片未能在面板内显示"), h("button", {
						key: "b",
						type: "button",
						onClick: () => onOpen(abs),
						style: {
							font: "inherit",
							fontSize: "11px",
							marginTop: "6px",
							padding: "3px 10px",
							border: "1px solid " + C.ink,
							background: "#fff",
							borderRadius: "3px",
							cursor: "pointer"
						}
					}, "用默认程序打开")]) : h("img", {
						key: "i",
						src: fileUrl(abs),
						alt: name,
						onError: () => markBroken(abs),
						style: {
							width: "100%",
							border: "1px solid " + C.faint,
							borderRadius: "4px",
							background: C.bg,
							display: "block"
						}
					}), h("div", {
						key: "n",
						style: { marginTop: "4px" }
					}, h("button", {
						type: "button",
						onClick: () => onOpen(abs),
						title: abs,
						style: {
							font: "inherit",
							fontSize: "10px",
							fontFamily: "monospace",
							padding: 0,
							border: "none",
							background: "none",
							color: "#3b6ea5",
							cursor: "pointer",
							textAlign: "left",
							maxWidth: "100%",
							overflow: "hidden",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap"
						}
					}, name))]);
				}) : [h("span", {
					key: "none",
					style: {
						fontSize: "11px",
						color: C.muted
					}
				}, "该界面还没有骨架图引用")])])),
				data.boundary ? h("div", {
					key: "bd",
					style: {
						border: "1px solid " + C.faint,
						borderLeft: "3px solid " + C.soft,
						background: C.bg,
						borderRadius: "4px",
						padding: "9px 11px",
						fontSize: "11px",
						lineHeight: 1.8,
						color: C.ink
					}
				}, [h("div", {
					key: "t",
					style: {
						fontWeight: 600,
						marginBottom: "3px"
					}
				}, "边界声明（§5.0）"), h("div", { key: "b" }, data.boundary)]) : null,
				h("div", {
					key: "foot",
					style: {
						marginTop: "12px",
						fontSize: "11px",
						color: C.muted,
						lineHeight: 1.85
					}
				}, [h("div", { key: "a" }, "界面清单与骨架图引用**从定稿 §5 现场解析**，不另存索引。"), h("div", { key: "b" }, "「Draft 记账表」与「漏画/多画对账」还没做——那需要 §5 里记回 Draft 链接，目前定稿里没有这个字段。")])
			]);
		}
		/** 折叠起来的原始返回，给需要深究时看 */
		function RawDetail(props) {
			const [open, setOpen] = react.useState(false);
			if (!props.text) return null;
			return h("div", { style: { marginTop: "6px" } }, [h("button", {
				key: "b",
				type: "button",
				onClick: () => setOpen(!open),
				style: {
					font: "inherit",
					fontSize: "10px",
					padding: "1px 7px",
					border: "1px solid " + C.soft,
					background: "#fff",
					borderRadius: "3px",
					cursor: "pointer",
					color: C.muted
				}
			}, open ? "收起技术详情" : "技术详情"), open ? h("pre", {
				key: "p",
				style: {
					marginTop: "5px",
					marginBottom: 0,
					padding: "8px",
					fontSize: "10px",
					whiteSpace: "pre-wrap",
					background: C.bg,
					border: "1px solid " + C.faint,
					borderRadius: "3px",
					maxHeight: "240px",
					overflow: "auto",
					fontFamily: "monospace",
					userSelect: "text",
					color: C.muted
				}
			}, props.text) : null]);
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
			const projectRoot = props.projectRoot || "";
			const cacheKey = workKey(presetId, f ? f.topic : "");
			const [workSid, setWorkSidState] = react.useState(() => WORK_SESSIONS.get(cacheKey) || "");
			const setWorkSid = (v) => {
				setWorkSidState(v);
				setWorkSession(cacheKey, v);
			};
			const [busy, setBusy] = react.useState(false);
			const [msg, setMsg] = react.useState(null);
			const [detail, setDetail] = react.useState("");
			const [wsNote, setWsNote] = react.useState("");
			const usePending = props.useSessionPendingInteraction;
			const pending = usePending ? usePending((m) => workSid ? m.get(workSid) : void 0) : void 0;
			if (!f) return h("div", { style: {
				color: C.muted,
				fontSize: "12px"
			} }, "没有选中功能。");
			const stages = f.stages || {};
			const doneCount = STAGE_ORDER.filter((k) => stages[k]).length;
			const nextKey = STAGE_ORDER.filter((k) => !stages[k])[0] || null;
			const meta = nextKey ? STAGE_META[nextKey] : null;
			const setErr = (text, raw) => {
				setMsg({
					kind: "err",
					text
				});
				setDetail(raw || "");
			};
			const setOk = (text) => {
				setMsg({
					kind: "ok",
					text
				});
				setDetail("");
			};
			/** 推进一步：确保工作会话 → 执行该阶段的斜杠命令 */
			const advance = () => {
				if (!meta) return;
				setBusy(true);
				setMsg({
					kind: "pending",
					text: "正在准备…"
				});
				setDetail("");
				(workSid ? Promise.resolve({
					ok: true,
					value: { sessionId: workSid }
				}) : typeof props.__ensureWork === "function" ? props.__ensureWork(f.root, props.rows || [], {}).then((got) => {
					if (got && got.ok && got.sid) {
						setWsNote((got.source === "created" ? "新建于 " : "复用 ") + winPath(f.root) + ((got.note || []).length ? "　" + got.note.join("；") : ""));
						return {
							ok: true,
							value: { sessionId: got.sid },
							note: (got.note || []).join("；")
						};
					}
					return {
						ok: false,
						error: { message: got && got.error || "拿不到该功能的工作会话。" },
						note: (got && got.note || []).join("；")
					};
				}) : Promise.resolve({
					ok: false,
					error: { message: "统一的工作会话通道没挂上（__ensureWork 缺失）—— 刷新页面再试。" },
					note: ""
				})).then((cr) => {
					if (!cr.ok) {
						setBusy(false);
						setErr("无法为工作台创建会话：" + humanError(cr) + "（工作区 " + (projectRoot || "(未配置 projectRoot)") + "）。" + (cr.note ? "　" + cr.note : ""), JSON.stringify(cr, null, 1));
						return;
					}
					const sid = idText(cr.value && cr.value.sessionId) || workSid;
					setWorkSid(sid);
					const line = meta.cmd + " " + f.topic;
					setMsg({
						kind: "pending",
						text: "已启动「" + meta.label + "」，正在把 " + line + " 交给会话…"
					});
					probe.prompt(sid, line).then((er) => {
						setBusy(false);
						if (er.ok) {
							setOk("已把「" + meta.label + "」交给工作会话（" + line + "）。进度与提问在那个会话里看——在左侧列表点开它即可。");
							setDetail(JSON.stringify(er.value, null, 1));
						} else setErr("无法启动「" + meta.label + "」：" + humanError(er), JSON.stringify(er, null, 1));
					});
				});
			};
			return h("div", null, [
				h("div", {
					key: "bar",
					style: {
						display: "flex",
						gap: "6px",
						flexWrap: "wrap",
						marginBottom: "12px",
						alignItems: "center"
					}
				}, STAGE_ORDER.map((k) => {
					const on = !!stages[k];
					const isNext = k === nextKey;
					return h("div", {
						key: k,
						style: {
							fontSize: "12px",
							padding: "5px 12px",
							borderRadius: "4px",
							border: "1px solid " + (on ? C.ok : isNext ? C.ink : C.soft),
							background: on ? "#f0fdf4" : isNext ? "#fff" : "#fafafa",
							color: on ? C.ok : isNext ? C.ink : "#aaa",
							fontWeight: isNext ? 600 : 400
						}
					}, (on ? "✓ " : "") + STAGE_META[k].label);
				})),
				h("div", {
					key: "sum",
					style: {
						border: "1px solid " + C.faint,
						borderRadius: "4px",
						background: "#fff",
						padding: "11px 13px",
						marginBottom: "12px",
						fontSize: "12px",
						lineHeight: 1.9
					}
				}, [h("div", { key: "a" }, "已完成 " + doneCount + " / 6 个阶段" + (f.latestDate ? "　最终版 " + f.latestDate.slice(0, 4) + "-" + f.latestDate.slice(4, 6) + "-" + f.latestDate.slice(6, 8) : "")), h("div", {
					key: "b",
					style: { color: meta ? C.ink : C.ok }
				}, meta ? "下一步：「" + meta.label + "」——" + meta.desc : "已走完六个阶段，可以交程序了。")]),
				meta ? h("div", {
					key: "act",
					style: {
						display: "flex",
						gap: "8px",
						alignItems: "center",
						flexWrap: "wrap",
						marginBottom: "12px"
					}
				}, [h("button", {
					key: "go",
					type: "button",
					disabled: busy,
					onClick: advance,
					style: {
						font: "inherit",
						fontSize: "13px",
						padding: "7px 16px",
						border: "1px solid " + C.ink,
						background: busy ? "#888" : C.ink,
						color: "#fff",
						borderRadius: "4px",
						cursor: busy ? "default" : "pointer"
					}
				}, busy ? "执行中…" : "推进一步：「" + meta.label + "」"), h("span", {
					key: "w",
					style: {
						fontSize: "11px",
						color: C.muted
					}
				}, "会在工作会话里执行 " + meta.cmd + " " + f.topic)]) : null,
				msg ? h("div", {
					key: "msg",
					style: {
						border: "1px solid " + (msg.kind === "err" ? C.bad : C.faint),
						borderLeft: "3px solid " + (msg.kind === "err" ? C.bad : msg.kind === "ok" ? C.ok : C.soft),
						background: "#fff",
						borderRadius: "4px",
						padding: "10px 12px",
						fontSize: "12px",
						lineHeight: 1.75,
						color: msg.kind === "err" ? C.bad : msg.kind === "ok" ? C.ok : C.muted
					}
				}, [h("div", { key: "t" }, msg.text), h(RawDetail, {
					key: "d",
					text: detail
				})]) : null,
				workSid ? h(WorkSessionStatus, {
					key: "ws",
					sessionId: workSid,
					useSessions: props.useSessions,
					useSessionPendingInteraction: props.useSessionPendingInteraction,
					onOpen: (sid) => {
						const r = probe.openSession(sid);
						if (!r.ok) setErr("无法打开会话：" + humanError(r), JSON.stringify(r, null, 1));
					}
				}) : null,
				h(PendingQuestionCard, {
					key: "pq",
					pending
				}),
				h("div", {
					key: "foot",
					style: {
						marginTop: "14px",
						fontSize: "11px",
						color: C.muted,
						lineHeight: 1.85
					}
				}, [
					h("div", { key: "a" }, "工作台不在这里重画流程——它把阶段交给 sr 的 skill，进度与提问都在那个会话里。"),
					h("div", { key: "b" }, "预设：" + presetId + (projectRoot ? "　兜底工作区根：" + projectRoot : "")),
					wsNote ? h("div", {
						key: "d",
						style: { color: C.ink }
					}, "工作区归属：" + wsNote) : null
				])
			]);
		}
		/**
		* 索引会话的来源（面板要**如实说出**"这条会话是怎么来的" —— 排障全靠它）。
		* 与 pure 层 `SessionPick.source` 一一对应，外加组合根自己的 "created"。
		*/
		function sessionSourceText(s) {
			if (!s) return "(未解析)";
			return ({
				cache: "上次那条（本地缓存）",
				title: "按标题「策划工作台·索引」认回",
				cwd: "按 cwd 覆盖 sr 工作区根匹配",
				main: "用户当前选中的那条（兜底）",
				recent: "最近更新的那条（兜底）",
				created: "新建（已登记工作区并命名）"
			}[s.source] || String(s.source || "?")) + (s.sid ? "：" + String(s.sid).slice(0, 14) + "…" : "") + (s.sessionTitle ? "「" + s.sessionTitle + "」" : "");
		}
		/**
		* **工作会话**的来源（工单 15）—— 与索引会话那套分开写，因为来源不同：
		* 工作会话按"每个功能一条"认，认领凭据是标题 `策划工作台·工作（主题）`。
		*/
		function pickSourceText(s) {
			return {
				memory: "这次页面里已经认过它",
				cache: "上次那条（本地缓存）",
				title: "按标题「策划工作台·工作」认回",
				created: "新建（已登记功能工作区并命名）"
			}[s] || String(s || "?");
		}
		/**
		* 显示用路径：混合分隔符统一成 `\`。
		* ★ 只改**显示**，不改传给 Remote 的字符串（`workspace.create` / `session.create` 收到的一字不动）——
		*   那串路径是工单 12 就存在的既有形状（`D:\…\workspace/features/…`，两种分隔符 Windows 都认），
		*   本票不借机改行为。
		*/
		function winPath(p) {
			return String(p === null || p === void 0 ? "" : p).replace(/\//g, "\\");
		}
		/** 全局面板：A1 功能看板 */ function Panel(props) {
			const useSessions = props.useSessions;
			const useWorkspaces = props.useWorkspaces;
			const sessionsSnap = useSessions ? useSessions((s) => s) : null;
			const wsSnap = useWorkspaces ? useWorkspaces((s) => s) : null;
			const sessionRows = react.useMemo(() => rowsFromStore(sessionsSnap), [sessionsSnap]);
			const wsPaths = react.useMemo(() => (wsSnap && wsSnap.items || []).map((w) => w && w.path).filter(Boolean), [wsSnap]);
			const [idx, setIdx] = react.useState(null);
			const sessionId = idx && idx.sid ? idx.sid : void 0;
			const cwd = idx && idx.cwd ? idx.cwd : void 0;
			const [state, setState] = react.useState({ phase: "idle" });
			const [q, setQ] = react.useState("");
			const [notice, setNotice] = react.useState(null);
			const [view, setView] = react.useState("dashboard");
			const [detailTopic, setDetailTopic] = react.useState(null);
			const [dtab, setDtab] = react.useState(ENTRY_TAB);
			const [ledger, setLedger] = react.useState(null);
			const [iface, setIface] = react.useState(null);
			const [finalDoc, setFinalDoc] = react.useState(null);
			const [indexData, setIndexData] = react.useState(null);
			const [detail, setDetail] = react.useState(null);
			const [brain, setBrain] = react.useState(null);
			const [draft, setDraft] = react.useState(null);
			/**
			* ★ 工单 16：详情里每一份数据都盖一个"这是哪个功能的"戳（`__topic`），渲染时对不上
			*   当前功能就**不当数**。两个作用合在一起：
			*     ① 换功能时**不需要任何清空动作**（旧数据自动失效，不会闪一个上一个功能的内容）；
			*     ② 重读（自动刷新）时**保留屏幕上的旧数据** —— 不整屏重挂、不丢用户选中的条目。
			*/
			const ofTopic = (r) => r && r.__topic !== void 0 && r.__topic !== detailTopic ? null : r;
			/** 盖上当前功能的戳（组合根该干的事：结果属于哪一次请求由调用方知道） */
			const stamped = (r) => Object.assign({}, r, { __topic: detailTopic });
			/** 详情数据中"属于当前功能的那一份"（下面所有渲染与判断都用它，不再直接用 detail） */
			const dview = ofTopic(detail);
			const designLedger = react.useMemo(() => ledgerOf(ofTopic(ledger)), [ledger, detailTopic]);
			const [rev, setRev] = react.useState({
				detail: 0,
				ledger: 0,
				final: 0,
				ui: 0,
				brain: 0,
				draft: 0
			});
			const [live, setLive] = react.useState({
				phase: "off",
				reason: "",
				ready: 0,
				total: 0,
				digest: "",
				pending: 0,
				changed: [],
				frame: "",
				at: 0,
				reloads: 0,
				skipped: 0
			});
			/** 读文件时收下的版本袋（`portOf` 往里写）—— 指纹与自激防护的凭据 */
			const bagRef = react.useRef({});
			/** 已经"读进屏幕"的 路径 → version */
			const appliedRef = react.useRef({});
			/** stat 核对时"上次看见的目录版本"（目录版本只在这里记，见 `checkNow`） */
			const dirSeenRef = react.useRef({});
			/** 当前这一批待落的变更（去抖用） */
			const batchRef = react.useRef(null);
			const timerRef = react.useRef(null);
			/** 渲染期把"最新一次的落盘实施"和"当前上下文"挂上，定时器回调不必重造闭包 */
			const flushRef = react.useRef(null);
			const ctxRef = react.useRef({});
			/** 当前订阅计划（轮询核对要知道盯了哪些目录） */
			const planRef = react.useRef(null);
			/**
			* ★ 工单 24：**这一批变更碰到的是不是文档生成工作面依赖的桶**（`gdd\` / `evidence\`）。
			*   判据 = 帧里的路径是不是那两份订阅目标之一 —— 订阅目标是**逐个目录**给的
			*   （见 `watchPlan`），所以"帧长什么样"就能说出"哪个桶变了"。
			*   `detail`（产物清单）是**所有桶的共主**：任何桶变了它都会换，只盯着它就会在
			*   `analysis\` 变了的时候也把 39 KB 的成稿白读一遍（实测踩过）。
			*   `false` = 这一轮的变更不在这一屏依赖的桶里（跳过）；其余情况（进功能 / 手动刷新 /
			*   切页签 / stat 核对）一律照读。
			*/
			const draftBucketRef = react.useRef(true);
			/** 这一轮订阅已经 ready 了几个目标（判"帧永不 ready"的降级） */
			const readyCountRef = react.useRef(0);
			/** 订阅回调的**最新**一份（换一次渲染就换一个闭包，但不能因此重开订阅） */
			const onLiveEventRef = react.useRef(null);
			const loader = props.__loader;
			const remoteOpen = props.__remoteOpen;
			const ledgerLoader = props.__ledger;
			const finalLoader = props.__final;
			const fixRunner = props.__fix;
			const interfaceLoader = props.__interfaces;
			const indexLoader = props.__index;
			const detailLoader = props.__detail;
			const brainstormLoader = props.__brainstorm;
			const brainstormRunner = props.__sendBrainstorm;
			const draftLoader = props.__draft;
			const draftRunner = props.__sendDraft;
			const diagnose = props.__diagnose;
			const probe = props.__probe;
			const watchRunner = props.__watch;
			const statManyRunner = props.__statMany;
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
				try {
					p = Promise.resolve(fn());
				} catch (e) {
					return Promise.reject(/* @__PURE__ */ new Error(name + "：同步抛错 " + String(e && e.message || e)));
				}
				return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(/* @__PURE__ */ new Error(name + "：超过 " + Math.round((ms || STEP_MS) / 1e3) + " 秒未响应")), ms || STEP_MS))]);
			};
			const handleOpen = (f, relOverride) => {
				const rel = relOverride || f && f.openPath;
				if (!rel) {
					setNotice({
						kind: "err",
						text: "没有可打开的文件"
					});
					return;
				}
				const abs = toAbs(cwd, rel);
				setNotice({
					kind: "pending",
					text: "正在打开：" + abs
				});
				const builtin = props.openFile;
				const hasBuiltin = typeof builtin === "function";
				const steps = [];
				if (hasBuiltin) steps.push(["DSH 内置 openFile", () => builtin(rel)]);
				steps.push(["默认应用", () => remoteOpen({ path: abs }, "默认应用")]);
				steps.push(["文件管理器 reveal", () => remoteOpen({
					path: abs,
					action: "reveal"
				}, "reveal")]);
				const errs = [];
				const next = (i) => {
					if (i >= steps.length) {
						setNotice({
							kind: "err",
							text: "三种方式都失败 ｜ " + errs.join(" ｜ "),
							diag: "探测中…"
						});
						Promise.resolve().then(() => diagnose ? diagnose() : Promise.resolve("(无诊断)")).then((t) => setNotice({
							kind: "err",
							text: "三种方式都失败 ｜ " + errs.join(" ｜ "),
							diag: "typeof props.openFile = " + typeof builtin + "\n" + String(t || "")
						}), (e) => setNotice({
							kind: "err",
							text: "三种方式都失败 ｜ " + errs.join(" ｜ "),
							diag: "typeof props.openFile = " + typeof builtin + "\n诊断本身失败：" + String(e && e.message || e)
						}));
						return;
					}
					const name = steps[i][0];
					withTimeout(name, steps[i][1]).then(() => setNotice({
						kind: "ok",
						text: "已打开（" + name + "）：" + rel
					}), (e) => {
						errs.push(String(e && e.message || e));
						next(i + 1);
					});
				};
				next(0);
			};
			/**
			* ① 解析索引会话 → ② 扫看板。
			* ★ 依赖数组是空的：解析在**面板挂载时做一次**（结果进 localStorage 缓存，
			*   下次直接认回来）。跟着会话快照重算会让看板每次有会话更新就重扫一遍。
			*/
			react.useEffect(() => {
				let cancelled = false;
				const ac = new AbortController();
				setState({ phase: "loading" });
				const resolve = props.__resolve;
				if (typeof resolve !== "function") {
					setState({
						phase: "error",
						error: "索引会话解析器没挂上（__resolve 缺失）。"
					});
					return () => {
						cancelled = true;
						ac.abort();
					};
				}
				Promise.resolve().then(() => resolve({
					rows: sessionRows,
					wsPaths,
					signal: ac.signal
				})).then((res) => {
					if (cancelled) return;
					if (!res || res.ok !== true || !res.sid) {
						setState({
							phase: "nosession",
							error: res && res.error || "",
							note: res && res.note || []
						});
						return;
					}
					setIdx(res);
					return loader(res.sid, res.cwd, ac.signal, res.extraPaths).then((data) => {
						if (!cancelled) setState({
							phase: "ready",
							data,
							session: res
						});
					}, (err) => {
						if (!cancelled) setState({
							phase: "error",
							error: String(err && err.message || err),
							session: res
						});
					});
				}).then(void 0, (err) => {
					if (!cancelled) setState({
						phase: "error",
						error: "解析索引会话失败：" + String(err && err.message || err)
					});
				});
				return () => {
					cancelled = true;
					ac.abort();
				};
			}, []);
			/** 当前功能卡（看板数据里那一条）—— 功能根与"当前最终版"都从它来 */
			const curFeature = react.useMemo(() => {
				const d0 = state.phase === "ready" ? state.data : null;
				if (!d0 || !detailTopic) return null;
				return (d0.features || []).filter((x) => x.topic === detailTopic)[0] || null;
			}, [state, detailTopic]);
			const featureRoot = curFeature && curFeature.root || "";
			/** 当前正在看的那一个文件（详情里的最终版）—— 窄订阅 + 低频轮询的对象 */
			const openFinal = curFeature && curFeature.openPath || "";
			/** 渲染期把最新上下文挂上：定时器与订阅回调不在渲染闭包里，但读的必须是这一刻的值 */
			ctxRef.current = {
				view,
				dtab,
				topic: detailTopic,
				root: featureRoot,
				srWs: state.phase === "ready" && state.data ? state.data.srWs || "" : "",
				openPath: openFinal
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
				for (const p of [
					"detail",
					"ledger",
					"final",
					"ui",
					"brain",
					"draft"
				]) if ((parts || []).indexOf(p) >= 0) bump[p] = 1;
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
				loader(sessionId, cwd, ac.signal, idx && idx.extraPaths || []).then((data) => setState((prev) => prev.phase === "ready" ? Object.assign({}, prev, { data }) : prev), () => {});
			};
			/**
			* 落一次重读（自动与手动共用一个出口）。
			* @param parts 要重读的部件（`unionParts` 的结论，或手动刷新时给全集）
			*/
			const applyReload = (parts) => {
				if ((parts || []).indexOf("board") >= 0) reloadBoard();
				bumpParts(parts);
				setLive((prev) => Object.assign({}, prev, {
					pending: 0,
					reloads: prev.reloads + 1
				}));
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
				statManyRunner(sessionId, paths, ac.signal).then((map) => {
					appliedRef.current = mergeApplied(appliedRef.current, map);
					const fp = fingerprintOf(appliedRef.current, paths);
					setLive((prev) => Object.assign({}, prev, { digest: fp.digest }));
				}, () => {});
			};
			/** 去抖合批：静默 300ms 落一次；一直在写也不能超过 1.5s（判据在纯函数里） */
			const scheduleFlush = () => {
				if (timerRef.current) clearTimeout(timerRef.current);
				const tick = () => {
					const b = batchRef.current;
					if (!b) {
						timerRef.current = null;
						return;
					}
					if (!shouldFlush(b, Date.now())) {
						timerRef.current = setTimeout(tick, 120);
						return;
					}
					timerRef.current = null;
					batchRef.current = null;
					const parts = unionParts(b.plans);
					setLive((prev) => Object.assign({}, prev, {
						changed: b.why.slice(-8),
						at: Date.now()
					}));
					if (flushRef.current) flushRef.current(parts);
				};
				timerRef.current = setTimeout(tick, 300);
			};
			/** 把一条"该重读了"的路径塞进当前批（帧与 stat 核对共用） */
			const enqueueChange = (path, version, reason) => {
				if (version && planRef.current && (planRef.current.dirs || []).some((d) => normPath(d) === normPath(path))) dirSeenRef.current = mergeApplied(dirSeenRef.current, { [path]: version });
				const b = batchRef.current || (batchRef.current = {
					firstAt: Date.now(),
					lastAt: 0,
					plans: [],
					paths: {},
					why: []
				});
				b.lastAt = Date.now();
				b.paths[normPath(path)] = version || "";
				b.plans.push(planReload({ path }, {
					root: ctxRef.current.root,
					srWs: ctxRef.current.srWs
				}));
				const hit = (planRef.current && planRef.current.targets || []).filter((tp) => normPath(tp) === normPath(path))[0] || "";
				if (hit !== "") {
					const rel = String(ctxRef.current.root || "") !== "" && containsPath(ctxRef.current.root, hit) ? normPath(hit).slice(normPath(ctxRef.current.root).length + 1) : "";
					const seg = String(rel).split("\\")[0].toLowerCase();
					draftBucketRef.current = seg === "gdd" || seg === "evidence";
				} else draftBucketRef.current = false;
				b.why.push(path + (reason ? "（" + reason + "）" : ""));
				setLive((prev) => Object.assign({}, prev, {
					phase: "on",
					pending: Object.keys(b.paths).length
				}));
				scheduleFlush();
			};
			/** 收到一帧（或一条订阅状态）—— 组合根回调，可能在 React 之外 */
			const onLiveEvent = (ev) => {
				const e = ev || {};
				if (e.kind === "ready") {
					readyCountRef.current = Number(e.ready) || readyCountRef.current + 1;
					setLive((prev) => Object.assign({}, prev, {
						phase: "on",
						ready: readyCountRef.current,
						total: Number(e.total) || prev.total,
						reason: ""
					}));
					return;
				}
				if (e.kind === "down") {
					setLive((prev) => Object.assign({}, prev, {
						phase: "down",
						reason: e.reason || "订阅建立失败"
					}));
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
					setLive((prev) => Object.assign({}, prev, {
						phase: "down",
						reason: "订阅被宿主结束（目标可能被删了）"
					}));
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
					setLive((prev) => Object.assign({}, prev, {
						phase: "on",
						ready: readyCountRef.current
					}));
					return;
				}
				const notice = parsed.change;
				if (!acceptFrame(notice, {
					applied: appliedRef.current,
					file: ctxRef.current.openPath
				}).accept) {
					setLive((prev) => Object.assign({}, prev, { skipped: prev.skipped + 1 }));
					return;
				}
				setLive((prev) => Object.assign({}, prev, {
					frame: JSON.stringify(e.frame),
					at: Date.now()
				}));
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
				const dirs = (planRef.current && planRef.current.dirs || []).slice();
				const files = ctxRef.current.openPath ? [ctxRef.current.openPath] : [];
				if (dirs.length === 0 && files.length === 0) return;
				const ac = new AbortController();
				statManyRunner(sessionId, files.concat(dirs), ac.signal).then((map) => {
					const dirKeys = {};
					for (const d of dirs) dirKeys[normPath(d)] = true;
					const fileMap = {}, dirMap = {};
					for (const p of Object.keys(map)) if (dirKeys[normPath(p)]) dirMap[p] = map[p];
					else fileMap[p] = map[p];
					const staleFiles = stalePaths(appliedRef.current, fileMap);
					const staleDirs = stalePaths(dirSeenRef.current, dirMap);
					if (staleFiles.length === 0 && staleDirs.length === 0) return;
					for (const p of staleDirs.concat(staleFiles)) enqueueChange(p, map[p], "stat 核对发现不一致");
				}, () => {});
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
			const watchKey = dview && !dview.error && String(dview.root || "") === String(featureRoot || "") && featureRoot !== "" ? "d:" + (dview.dirs || []).join("|") + "#n:" + (dview.nestedDirs || []).join("|") : "";
			react.useEffect(() => {
				if (view !== "detail" || !detailTopic || !sessionId || state.phase !== "ready" || !featureRoot || watchKey === "") {
					setLive((prev) => Object.assign({}, prev, {
						phase: "off",
						ready: 0,
						total: 0
					}));
					return;
				}
				if (typeof watchRunner !== "function") {
					setLive((prev) => Object.assign({}, prev, {
						phase: "down",
						reason: "订阅器没挂上（__watch 缺失）"
					}));
					return;
				}
				const plan = watchPlan({
					root: featureRoot,
					dirs: dview && dview.dirs || [],
					nested: dview && dview.nestedDirs || [],
					file: openFinal
				});
				planRef.current = plan;
				readyCountRef.current = 0;
				setLive((prev) => Object.assign({}, prev, {
					phase: "connecting",
					ready: 0,
					total: plan.targets.length,
					reason: plan.dropped.length ? "有 " + plan.dropped.length + " 个目标超出订阅上限（这些位置不会自动跟随）" : ""
				}));
				const ac = new AbortController();
				const handle = watchRunner(sessionId, plan.targets, onLiveEventRef.current, ac.signal);
				const t = setTimeout(() => {
					if (ac.signal.aborted || readyCountRef.current > 0) return;
					setLive((prev) => Object.assign({}, prev, {
						phase: "down",
						reason: "订阅建起来了但一直没有就绪帧（宿主可能不支持 watch）"
					}));
				}, 8e3);
				return () => {
					ac.abort();
					clearTimeout(t);
					if (handle && typeof handle.dispose === "function") handle.dispose();
				};
			}, [
				view,
				detailTopic,
				sessionId,
				state.phase,
				featureRoot,
				watchKey,
				openFinal
			]);
			/** 低频轮询 + 焦点回来核对：用户盯着改的就是"当前这一个文件" */
			react.useEffect(() => {
				if (view !== "detail" || !sessionId || state.phase !== "ready") return;
				const id = setInterval(() => checkNow(), 15e3);
				const onFocus = () => {
					try {
						if (typeof document !== "undefined" && document.hidden) return;
					} catch (e) {}
					checkNow();
				};
				try {
					window.addEventListener("focus", onFocus);
					document.addEventListener("visibilitychange", onFocus);
				} catch (e) {}
				return () => {
					clearInterval(id);
					try {
						window.removeEventListener("focus", onFocus);
						document.removeEventListener("visibilitychange", onFocus);
					} catch (e) {}
				};
			}, [
				view,
				detailTopic,
				sessionId,
				state.phase,
				openFinal
			]);
			/** 换功能就把版本与订阅状态清干净（否则新功能的指纹会掺进上一个功能的文件） */
			const topicSeenRef = react.useRef("");
			react.useEffect(() => {
				if (topicSeenRef.current === detailTopic) return;
				topicSeenRef.current = detailTopic;
				appliedRef.current = {};
				dirSeenRef.current = {};
				bagRef.current = {};
				batchRef.current = null;
				planRef.current = null;
				draftSigRef.current = "";
				setLive({
					phase: "off",
					reason: "",
					ready: 0,
					total: 0,
					digest: "",
					pending: 0,
					changed: [],
					frame: "",
					at: 0,
					reloads: 0,
					skipped: 0
				});
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
			react.useEffect(() => {
				if (view !== "detail" || !detailTopic || !sessionId || state.phase !== "ready") {
					setDetail(null);
					return;
				}
				const feat = (state.data.features || []).filter((x) => x.topic === detailTopic)[0];
				if (!feat || !feat.root) {
					setDetail({ error: "拿不到功能根目录：详情读不了。" });
					return;
				}
				let cancelled = false;
				const ac = new AbortController();
				if (typeof detailLoader !== "function") {
					setDetail({ error: "详情加载器没挂上（__detail 缺失）。" });
					return () => {
						cancelled = true;
						ac.abort();
					};
				}
				detailLoader(sessionId, feat.root, ac.signal, bagRef.current).then((r) => {
					if (cancelled) return;
					setDetail(stamped(r));
					commitBag(r);
					sweepVersions(r);
				}, (e) => {
					if (!cancelled) setDetail(stamped({ error: "读产物清单失败：" + String(e && e.message || e) }));
				});
				return () => {
					cancelled = true;
					ac.abort();
				};
			}, [
				view,
				detailTopic,
				sessionId,
				state.phase,
				rev.detail
			]);
			/**
			* ★ 工单 23：进「头脑风暴」工作面时读**已有的分析结论** + 两种新格式的解析。
			*
			* 依赖 `detail`：产物清单是工单 12 那份（**同一份来源**），这里只拿 `analysis` 组做事 ——
			* 不重新列目录，免得"面板列出的产物"与"工作面认出的结论"两处对不上。
			* 出口判据那一句话也是搬 `detail.stage.note`（在 `artifacts.ts` 里算的），这一层不重算。
			*/
			react.useEffect(() => {
				if (view !== "detail" || dtab !== "brainstorm" || !sessionId || state.phase !== "ready") {
					setBrain(null);
					return;
				}
				const dready = ofTopic(detail);
				if (!dready || dready.error) {
					setBrain(null);
					return;
				}
				if (typeof brainstormLoader !== "function") {
					setBrain({ error: "头脑风暴加载器没挂上（__brainstorm 缺失）。" });
					return;
				}
				const root = dready.root || "";
				if (!root) {
					setBrain({ error: "拿不到功能根目录：头脑风暴读不了。" });
					return;
				}
				const group = (dready.artifacts && dready.artifacts.groups || []).filter((g) => g.key === "analysis")[0];
				const files = group && group.files || [];
				let cancelled = false;
				const ac = new AbortController();
				brainstormLoader(sessionId, {
					root,
					files,
					stage: dready.stage
				}, ac.signal, bagRef.current).then((r) => {
					if (!cancelled) setBrain(stamped(r));
				}, (e) => {
					if (!cancelled) setBrain(stamped({ error: "读分析产物失败：" + String(e && e.message || e) }));
				});
				return () => {
					cancelled = true;
					ac.abort();
				};
			}, [
				view,
				dtab,
				detailTopic,
				sessionId,
				state.phase,
				detail
			]);
			/** ★ 工单 24：文档生成工作面已经读过的**那一批变更的签名**（同一批只读一遍盘） */
			const draftSigRef = react.useRef("");
			/** ★ 工单 24：文档生成工作面的**重读代数**（`rev.detail + rev.draft`，只增不减） */
			const draftGenRef = react.useRef(-1);
			/**
			* ★ 工单 24：进「文档生成」工作面时读**成稿（两大部分 + 左树）**与**配置支线走到哪**。
			*
			* 依赖 `detail`（工单 12 的产物清单是**同一份来源**：`gdd\` 与 `evidence\` 组的文件清单）——
			* 不重新列目录，免得"面板列出的产物"与"工作面读的那份成稿"两处对不上（与头脑风暴同一条纪律）。
			* 另见下面 effect 里的两处说明：为什么**不把 `rev.draft` 当依赖**、以及那道"输入清单没变就不重读"的闸门。
			*/
			react.useEffect(() => {
				if (view !== "detail" || dtab !== "draft" || !sessionId || state.phase !== "ready") {
					setDraft(null);
					draftSigRef.current = "";
					draftGenRef.current = -1;
					return;
				}
				const dready = ofTopic(detail);
				if (!dready || dready.error) {
					setDraft(null);
					draftSigRef.current = "";
					draftGenRef.current = -1;
					return;
				}
				if (typeof draftLoader !== "function") {
					setDraft({ error: "文档生成加载器没挂上（__draft 缺失）。" });
					return;
				}
				const root = dready.root || "";
				if (!root) {
					setDraft({ error: "拿不到功能根目录：这一屏读不了。" });
					return;
				}
				const groups = dready.artifacts && dready.artifacts.groups || [];
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
				const gddFiles = gdd && gdd.files || [];
				const evFiles = ev && ev.files || [];
				/**
				* ★ `gen` = **这一批变更的代数**（`rev.detail + rev.draft`）：一次重读只算一代，
				*   所以"同一批里被调用两次"的第二跳会被闸门挡掉（内容没变，白读一遍盘）。
				*   而 `rev` 每次重读都 +1 ⇒ 下一批的 `gen` 更大 ⇒ **原地改文件名不变**也照读。
				*/
				const gen = (Number(rev.detail) || 0) + (Number(rev.draft) || 0);
				const sig = gen + "" + root + "" + (gdd && gdd.count) + "" + gddFiles.map((x) => x.name + "@" + verOf(x.rel || "gdd/" + x.name)).join(",") + "" + evFiles.map((x) => x.name + "@" + verOf(x.rel || "evidence/" + x.name)).join(",") + "" + String(dready.finalCheck && dready.finalCheck.current || "") + "" + (curFeature && curFeature.configs || []).join(",");
				if (draftGenRef.current === gen && !!draft && dready.root === (draft && draft.root) || draftBucketRef.current === false) return;
				draftBucketRef.current = true;
				draftGenRef.current = gen;
				draftSigRef.current = sig;
				let cancelled = false;
				const ac = new AbortController();
				draftLoader(sessionId, {
					root,
					gddFiles,
					evidenceFiles: evFiles.map((x) => x.name),
					finalCheck: dready.finalCheck,
					gate: dready.gate,
					configFiles: curFeature && curFeature.configs || [],
					configRoot: d && d.configRoot || ""
				}, ac.signal, bagRef.current).then((r) => {
					if (!cancelled) setDraft(stamped(r));
				}, (e) => {
					if (!cancelled) setDraft(stamped({ error: "读成稿失败：" + String(e && e.message || e) }));
				});
				return () => {
					cancelled = true;
					ac.abort();
				};
			}, [
				view,
				dtab,
				detailTopic,
				sessionId,
				state.phase,
				detail
			]);
			react.useEffect(() => {
				if (view !== "detail" || !detailTopic || !sessionId) {
					setLedger(null);
					return;
				}
				let cancelled = false;
				const ac = new AbortController();
				const d = state.phase === "ready" ? state.data : null;
				const feat = (d && d.features || []).filter((x) => x.topic === detailTopic)[0];
				if (!feat || !feat.root) {
					setLedger(null);
					return;
				}
				ledgerLoader(sessionId, feat.root, d && d.skillsRoot, ac.signal, bagRef.current).then((L) => {
					if (!cancelled) setLedger(stamped(L));
				}, (e) => {
					if (!cancelled) setLedger(stamped({
						records: [],
						calibration: [],
						calFiles: [],
						schemaOk: false,
						error: String(e && e.message || e)
					}));
				});
				return () => {
					cancelled = true;
					ac.abort();
				};
			}, [
				view,
				detailTopic,
				sessionId,
				state.phase,
				rev.ledger
			]);
			react.useEffect(() => {
				if (view !== "detail" || dtab !== "final" || !sessionId || state.phase !== "ready") {
					setFinalDoc(null);
					return;
				}
				const feat = (state.data.features || []).filter((x) => x.topic === detailTopic)[0];
				if (!feat || !feat.openPath) {
					setFinalDoc({ empty: "本功能还没有定稿。" });
					return;
				}
				let cancelled = false;
				const ac = new AbortController();
				finalLoader(sessionId, feat.openPath, ac.signal, bagRef.current).then((g) => {
					if (!cancelled) setFinalDoc(stamped(g));
				}, (e) => {
					if (!cancelled) setFinalDoc(stamped({ error: "读定稿失败：" + String(e && e.message || e) }));
				});
				return () => {
					cancelled = true;
					ac.abort();
				};
			}, [
				view,
				detailTopic,
				dtab,
				sessionId,
				state.phase,
				rev.final
			]);
			react.useEffect(() => {
				if (view !== "detail" || dtab !== "ui" || !sessionId || state.phase !== "ready") {
					setIface(null);
					return;
				}
				const feat = (state.data.features || []).filter((x) => x.topic === detailTopic)[0];
				if (!feat || !feat.openPath) {
					setIface({ empty: "本功能还没有定稿，界面图在定稿的 §5。" });
					return;
				}
				let cancelled = false;
				const ac = new AbortController();
				interfaceLoader(sessionId, feat.openPath, ac.signal, bagRef.current).then((r) => {
					if (!cancelled) setIface(stamped(r));
				}, (e) => {
					if (!cancelled) setIface(stamped({ error: "读取失败：" + String(e && e.message || e) }));
				});
				return () => {
					cancelled = true;
					ac.abort();
				};
			}, [
				view,
				dtab,
				detailTopic,
				sessionId,
				state.phase,
				rev.ui
			]);
			react.useEffect(() => {
				if (view !== "assets" || !sessionId || state.phase !== "ready") {
					setIndexData(null);
					return;
				}
				let cancelled = false;
				const ac = new AbortController();
				setIndexData(null);
				indexLoader(sessionId, state.data.srWs, ac.signal).then((r) => {
					if (!cancelled) setIndexData(r);
				}, (e) => {
					if (!cancelled) setIndexData({ error: "读取失败：" + String(e && e.message || e) });
				});
				return () => {
					cancelled = true;
					ac.abort();
				};
			}, [
				view,
				sessionId,
				state.phase
			]);
			const shell = (children) => h("div", { style: {
				padding: "18px 22px",
				fontFamily: "system-ui, 'Microsoft YaHei', sans-serif",
				color: C.ink,
				height: "100%",
				overflow: "auto",
				boxSizing: "border-box",
				background: C.bg
			} }, children);
			/** 一级导航当前项：功能详情归在「功能看板」下 */
			const navView = view === "detail" ? "dashboard" : view;
			/** 标题 + 一级导航（做进 head，所有分支自动带上） */
			const head = (sub) => h("div", { key: "hd" }, [h("div", {
				key: "row",
				style: {
					display: "flex",
					alignItems: "baseline",
					gap: "10px",
					marginBottom: "12px"
				}
			}, [h("h1", {
				key: "t",
				style: {
					fontSize: "18px",
					margin: 0
				}
			}, "策划工作台"), h("span", {
				key: "s",
				style: {
					fontSize: "12px",
					color: C.muted
				}
			}, sub)]), h(TabBar, {
				key: "nav",
				items: NAV,
				view: navView,
				onPick: (id) => {
					setView(id);
					setDetailTopic(null);
				}
			})]);
			if (state.phase === "nosession") return shell([
				head("功能看板 · A1"),
				h("p", {
					key: "p",
					style: { color: C.bad }
				}, "工作台没能拿到可用会话（索引会话没解析出来）。"),
				h("div", {
					key: "e",
					style: {
						color: C.muted,
						fontSize: "12px",
						lineHeight: 1.9,
						marginTop: "8px"
					}
				}, (state.error ? ["原因：" + state.error] : []).concat(state.note || [])),
				h("div", {
					key: "h",
					style: {
						color: C.muted,
						fontSize: "12px",
						lineHeight: 1.95,
						marginTop: "10px"
					}
				}, [h("div", { key: "a" }, "① 索引会话的取法：缓存 → 标题「策划工作台·索引」→ cwd 覆盖 sr 根 → 新建；都不成才会到这里。"), h("div", { key: "b" }, "② 目录列举限定在会话工作区内（文件读取不受限）——所以索引会话的 cwd 必须覆盖 sr 工作区根。")])
			]);
			if (state.phase === "idle" || state.phase === "loading") return shell([head("功能看板 · A1"), h("p", {
				key: "p",
				style: { color: C.muted }
			}, "正在解析索引会话并读工作区…")]);
			if (state.phase === "error") return shell([
				head("功能看板 · A1"),
				h("p", {
					key: "p",
					style: { color: C.bad }
				}, "读取失败：" + state.error),
				h("div", {
					key: "h",
					style: {
						color: C.muted,
						fontSize: "12px",
						lineHeight: 1.95,
						marginTop: "10px"
					}
				}, [
					h("div", { key: "a" }, "① 面板锚定方式：读 sr 配置的 sr_workspace 字段（绝对路径），不跟当前选中会话走。"),
					h("div", { key: "b" }, "② 索引会话：" + sessionSourceText(state.session) + "　cwd = " + (cwd || "(未解析)")),
					h("div", { key: "c" }, "③ 常见原因：sr 配置没读到（候选根里没有 .agents\\skills\\sr-askme\\config.local.json），或锚点不在索引会话的工作区内。"),
					h("div", { key: "d" }, "④ 目录列举限定在工作区内；文件读取不受限。")
				])
			]);
			const d = state.data;
			if (view === "detail") {
				const f = d.features.filter((x) => x.topic === detailTopic)[0];
				const brainV = ofTopic(brain);
				const draftV = ofTopic(draft);
				const ledgerV = ofTopic(ledger);
				const finalV = ofTopic(finalDoc);
				const ifaceV = ofTopic(iface);
				return shell([
					head("功能详情 · " + detailTopic),
					h("div", {
						key: "sub",
						style: {
							display: "flex",
							alignItems: "center",
							gap: "10px",
							marginBottom: "10px",
							flexWrap: "wrap"
						}
					}, [
						h("button", {
							key: "back",
							type: "button",
							onClick: () => setView("dashboard"),
							style: {
								font: "inherit",
								fontSize: "12px",
								padding: "3px 9px",
								border: "1px solid " + C.soft,
								background: "#fff",
								borderRadius: "4px",
								cursor: "pointer"
							}
						}, "‹ 返回功能看板"),
						f ? badge(f.docType ? f.docType + " / " + (f.status || "?") : "无定稿", f.status === "active" ? "ok" : null) : null,
						f && f.latestFinal ? h("span", {
							key: "v",
							style: {
								fontSize: "11px",
								color: C.muted,
								fontFamily: "monospace"
							}
						}, "最终版 " + f.latestFinal) : null,
						f && f.openPath ? h("button", {
							key: "open",
							type: "button",
							onClick: () => handleOpen(f),
							style: {
								font: "inherit",
								fontSize: "11px",
								padding: "3px 9px",
								border: "1px solid " + C.soft,
								background: "#fff",
								borderRadius: "4px",
								cursor: "pointer"
							}
						}, "打开最终版") : null
					]),
					h(LiveBar, {
						key: "live",
						live,
						rev,
						onRefresh: onManualRefresh
					}),
					h(NoticeBar, {
						key: "nt",
						notice
					}),
					h(DetailStatus, {
						key: "st",
						detail: dview,
						feature: f,
						onOpenFix: () => {
							setDtab("final");
							if (f && f.openPath) handleOpen(f);
						}
					}),
					h("div", {
						key: "stages",
						style: {
							display: "flex",
							alignItems: "center",
							gap: "8px",
							marginBottom: "6px"
						}
					}, [h("span", {
						key: "l",
						style: {
							fontSize: "10.5px",
							color: C.muted,
							flex: "0 0 auto"
						}
					}, "工作面"), h(TabBar, {
						key: "b",
						items: DETAIL_STAGES,
						view: dtab,
						onPick: setDtab
					})]),
					h("div", {
						key: "mtabs",
						style: {
							display: "flex",
							alignItems: "center",
							gap: "8px"
						}
					}, [h("span", {
						key: "l",
						style: {
							fontSize: "10.5px",
							color: C.muted,
							flex: "0 0 auto"
						}
					}, "资料"), h(TabBar, {
						key: "b",
						items: DETAIL_TABS,
						view: dtab,
						onPick: setDtab
					})]),
					dtab === "brainstorm" ? h(BrainstormWorkface, {
						key: "bw",
						data: brainV,
						feature: f,
						root: dview && dview.root || "",
						srWs: d.srWs,
						onSend: typeof brainstormRunner === "function" ? (kind, input) => brainstormRunner(d && d.srWs, kind, input, { rows: sessionRows }) : null,
						onOpenSession: (sid) => probe.openSession(sid),
						onOpen: (abs) => handleOpen(null, abs)
					}) : dtab === "draft" ? h(DraftWorkface, {
						key: "dw",
						data: draftV,
						feature: f,
						live,
						root: dview && dview.root || "",
						srWs: d.srWs,
						onSend: typeof draftRunner === "function" ? (action, input) => draftRunner(d && d.srWs, action, input, { rows: sessionRows }) : null,
						onOpenSession: (sid) => probe.openSession(sid),
						onOpen: (abs) => handleOpen(null, abs)
					}) : dtab === "ledger" ? h(DecisionLedger, {
						key: "lg",
						ledger: ledgerV,
						coverage: designLedger ? designLedger.fieldCheck : null
					}) : dtab === "pipeline" ? h(PipelinePanel, {
						key: "pp-" + (f ? f.topic : ""),
						feature: f,
						probe,
						projectRoot: props.__projectRoot,
						__ensureWork: props.__ensureWork,
						rows: sessionRows,
						useSessions: props.useSessions,
						useSessionPendingInteraction: props.useSessionPendingInteraction
					}) : dtab === "artifacts" ? h(ArtifactBuckets, {
						key: "ab",
						feature: f,
						detail: dview,
						srWs: d.srWs,
						configRoot: d.configRoot,
						onOpen: (abs) => handleOpen(null, abs)
					}) : dtab === "ui" ? h(InterfacePanel, {
						key: "if",
						data: ifaceV,
						srWs: d.srWs,
						onOpen: (abs) => handleOpen(null, abs)
					}) : dtab === "design" ? h(DesignLedger, {
						key: "dl",
						ledger: designLedger
					}) : dtab === "final" ? h(FinalDoc, {
						key: "fd",
						doc: finalV,
						featureRoot: dview && dview.root || "",
						onFix: (req) => fixRunner(d && d.srWs, req, {
							root: dview && dview.root || "",
							rows: sessionRows
						}),
						onOpenSession: (sid) => probe.openSession(sid),
						onOpen: (abs) => handleOpen(null, abs)
					}) : h("div", {
						key: "soon",
						style: {
							color: C.muted,
							fontSize: "12px"
						}
					}, "这一屏还没做。")
				]);
			}
			if (view === "assets") {
				const wsPath = indexData && indexData.srWs || (state.phase === "ready" ? state.data.srWs : "");
				return shell([
					head("设计资产"),
					h(NoticeBar, {
						key: "nt",
						notice
					}),
					h(AssetsPanel, {
						key: "ap",
						data: indexData,
						onOpen: (abs) => handleOpen(null, abs),
						read: props.__readText ? (abs) => props.__readText(sessionId, abs) : null,
						onRefresh: props.__refreshIndex ? () => props.__refreshIndex(wsPath) : null,
						onPickDir: props.__pickDir || null,
						onImport: props.__importDocs ? (p, n) => props.__importDocs(wsPath, p, n) : null,
						onManual: props.__addManual ? (t, b, u) => props.__addManual(wsPath, t, b, u) : null,
						onIntake: props.__intake ? (src) => props.__intake(Object.assign({}, src, { srWs: wsPath })) : null,
						intakeRefs: props.__intakeRefs && wsPath ? props.__intakeRefs(wsPath) : null
					})
				]);
			}
			if (view !== "dashboard") {
				const label = (NAV.filter((x) => x.id === view)[0] || {}).label || view;
				return shell([head(label), h("div", {
					key: "soon",
					style: {
						border: "1px dashed " + C.soft,
						borderRadius: "4px",
						padding: "30px",
						textAlign: "center",
						color: C.muted,
						fontSize: "12px"
					}
				}, "「" + label + "」还没做 —— 屏清单见 工作台界面清单.md")]);
			}
			const filtered = q ? d.features.filter((f) => f.topic.toLowerCase().indexOf(q.toLowerCase()) >= 0) : d.features;
			return shell([
				head("功能看板 · A1"),
				h("div", {
					key: "top",
					style: {
						display: "flex",
						gap: "8px",
						alignItems: "center",
						marginBottom: "12px",
						flexWrap: "wrap"
					}
				}, [
					h("span", {
						key: "p",
						title: d.srWs || "(未读到 sr 配置)",
						style: {
							fontSize: "11px",
							fontFamily: "monospace",
							color: C.muted,
							maxWidth: "360px",
							overflow: "hidden",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap"
						}
					}, "锚点 " + (d.srWs || "(相对路径兜底)")),
					h("input", {
						key: "q",
						value: q,
						placeholder: "搜索功能名…",
						onChange: (e) => setQ(e.target.value),
						style: {
							flex: "1 1 200px",
							maxWidth: "300px",
							fontSize: "12px",
							padding: "4px 8px",
							border: "1px solid " + C.soft,
							borderRadius: "4px",
							outline: "none",
							background: "#fff"
						}
					}),
					h("span", {
						key: "n",
						style: {
							fontSize: "11px",
							color: C.muted
						}
					}, filtered.length + " / " + d.features.length + " 个功能"),
					h("button", {
						key: "rf",
						type: "button",
						"data-refresh": "manual",
						onClick: () => onManualRefresh(),
						title: "重读工作区（看板 + 当前功能）",
						style: {
							font: "inherit",
							fontSize: "11px",
							padding: "3px 9px",
							border: "1px solid " + C.soft,
							background: "#fff",
							borderRadius: "4px",
							cursor: "pointer"
						}
					}, "刷新看板")
				]),
				h(NoticeBar, {
					key: "nt",
					notice
				}),
				h(RiskBar, {
					key: "risk",
					features: d.features,
					attentionOf
				}),
				h("div", {
					key: "grid",
					style: {
						display: "flex",
						flexWrap: "wrap",
						gap: "10px"
					}
				}, filtered.length ? filtered.map((f) => h(FeatureCard, {
					key: f.topic,
					feature: f,
					attention: attentionOf(f.topic),
					onOpen: handleOpen,
					onDetail: (x) => {
						setDetailTopic(x.topic);
						setDtab(ENTRY_TAB);
						setView("detail");
					},
					onAttention: (x) => {
						setDetailTopic(x.topic);
						setDtab("pipeline");
						setView("detail");
					}
				})) : [h("div", {
					key: "none",
					style: {
						color: C.muted,
						fontSize: "12px"
					}
				}, "没有匹配的功能。")]),
				h("div", {
					key: "foot",
					style: {
						marginTop: "16px",
						fontSize: "11px",
						color: C.muted,
						lineHeight: 1.8
					}
				}, [
					h("div", { key: "a" }, "锚点：sr 配置 " + (d.configFile || "?") + (d.pathNote ? " · " + d.pathNote : "")),
					h("div", { key: "b" }, "扫描：" + (d.srWs || SR_WS) + "\\features\\ → **" + d.counts.features + " 个功能** · 配置表 " + d.counts.configs + (d.legacyLeft ? "　｜　旧结构还剩 " + d.legacyLeft + " 个文件（素材，确认后可删）" : "")),
					h("div", { key: "c" }, "状态派生自定稿头部 doc_type/status，工作台不另存状态；底部 📄 链接打开最终版。"),
					h("div", { key: "d" }, "索引会话：" + sessionSourceText(state.session) + "　cwd " + (cwd || "(未解析)") + (state.session && state.session.note && state.session.note.length ? "　｜　" + state.session.note.join("；") : "")),
					h("div", { key: "e" }, "自动刷新：进功能后订阅该功能的目录变更（宿主的目标级文件监视，写入者不限 —— agent 工具、脚本、外部编辑器都算）；看板不订阅，用「刷新看板」或 F5。")
				])
			]);
		}
		/**
		* ★ Cordis 要求**服务必须声明注入**；未注入的服务**访问即同步抛错**。
		* 但反过来：把可选依赖写进 inject，一旦它没被提供，**整个插件就不激活（面板消失）**。
		* 折中：核心服务（slots/remote）写进 inject 保证插件一定能装上；
		* 可选依赖（sessions/workspaces/uiWorkspace）用 `ctx.get(name)` 取——返回 undefined 而不抛，
		* 功能降级但插件照常工作。
		*/
		const inject = [
			"slots",
			"remote",
			"remote.workspaceFiles",
			"remote.session",
			"remote.agentPresets",
			"remote.commands",
			"remote.workspace",
			"remote.directoryPicker",
			"remote.fileUploads"
		];
		/** 安全取一个可选服务（可能为 undefined，不抛） */
		const svc = (ctx, name) => {
			try {
				return ctx.get(name);
			} catch (e) {
				return;
			}
		};
		/** 把一次 Remote 调用的结果原样收成可显示对象（同步抛错也接住） */
		const safeCall = (name, fn) => {
			let p;
			try {
				p = Promise.resolve(fn());
			} catch (e) {
				return Promise.resolve({
					name,
					ok: false,
					error: { message: "同步抛错 " + String(e && e.message || e) }
				});
			}
			return p.then((r) => ({
				name,
				ok: !!(r && r.ok),
				value: r && r.value,
				error: r && r.error
			}), (e) => ({
				name,
				ok: false,
				error: { message: String(e && e.message || e) }
			}));
		};
		/**
		* ★ 插件配置是 apply 的**第二个参数**（cordis 核心：`runtime.callback(this.ctx, this.config)`）。
		*   从 ctx 上取 config 会抛 `cannot get property "config" without inject`——config 不是服务。
		*/
		function apply(ctx, config) {
			const read = (sid, path, range, signal) => ctx.remote.workspaceFiles.read(sid, path, range, signal);
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
			const readWith = (bag) => bag ? (sid, p, range, signal) => read(sid, p, range, signal).then((r) => {
				if (r && r.ok === true && r.value && typeof r.value.version === "string" && r.value.version !== "") bag[String(r.value.absolutePath || p)] = r.value.version;
				return r;
			}) : read;
			const ledgerLoader = (sid, root, skillsRoot, signal, bag) => loadLedger(ctx, readWith(bag), sid, root, skillsRoot, signal);
			const interfaceLoader = (sid, absPath, signal, bag) => loadInterface(readWith(bag), sid, absPath, signal);
			/** 定稿工作面（§6.2）：收**绝对路径**（= 功能的 openPath） */
			const finalLoader = (sid, absPath, signal, bag) => loadFinal(readWith(bag), sid, absPath, signal);
			/**
			* ★ 工单 12 · 功能详情：产物清单（按桶）+ 三阶段 + 定稿有效性 + V 校验清单。
			* 收**功能根目录**（`features\<主题>\`）—— 功能 = 目录，所以不再需要 topicOf 过滤。
			* 这里只把 ctx 包成端口（`portOf`），实现全在 `src/load/feature.ts` + `src/pure/artifacts.ts`。
			* ★ 工单 16：`portOf` 的 `read` 换成 `readWith(bag)` —— 端口照旧只认 `{listDir, readText}`，
			*   版本收集发生在它下面一层。
			*/
			const detailLoader = (sid, root, signal, bag) => loadFeatureDetail(portOf(ctx, sid, readWith(bag)), {
				root,
				signal
			});
			/**
			* ★ 工单 23 · 头脑风暴工作面：把产物清单里 `analysis` 组交给加载器（只读那一个桶），
			*   出口判据那句话也是搬 `detail.stage`。这里只做编排，判据全在 `src/load/brainstorm.ts`
			*   + `src/pure/analysisdoc.ts`（有测试）。
			*/
			const brainstormLoader = (sid, opts, signal, bag) => loadBrainstorm(portOf(ctx, sid, readWith(bag)), Object.assign({}, opts, { signal }));
			/**
			* ★ 工单 24 · 文档生成工作面：把 `gdd\` 与 `evidence\` 的产物清单交给加载器（只读那两个桶），
			*   配置表**存在性**用看板按主题挂上来的真实文件名（既有通道，不重新列配置目录）。
			*   判据全在 `src/load/draft.ts` + `src/pure/drafttree.ts` / `draftstep.ts`（有测试）。
			*/
			const draftLoader = (sid, opts, signal, bag) => loadDraftWorkface(portOf(ctx, sid, readWith(bag)), Object.assign({}, opts, { signal }));
			const indexLoader = (sid, srWs, signal) => loadIndex(read, sid, srWs, signal);
			/** 按绝对路径读文本（阅读器用） */
			const readTextFile = (sid, abs) => readAllText(read, sid, abs, void 0, 4e3);
			/** `remote.workspaceFiles` 命名空间（未注入/宿主没提供时返回 null，不抛） */
			const workspaceFilesNs = () => {
				try {
					return ctx.remote && ctx.remote.workspaceFiles || null;
				} catch (e) {
					return null;
				}
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
				for (const p of paths || []) {
					if (signal && signal.aborted) break;
					try {
						const r = await ns.stat(sid, p, signal);
						if (r && r.ok === true && r.value && typeof r.value.version === "string" && r.value.version !== "") out[String(r.value.absolutePath || p)] = r.value.version;
					} catch (e) {}
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
					onEvent({
						kind: "down",
						reason: "remote.workspaceFiles.changes 不可用（没注入或宿主没提供）"
					});
					return { dispose: () => {} };
				}
				for (const target of (targets || []).slice()) {
					const run = async () => {
						let iter = null;
						try {
							iter = ns.changes(sid, target, signal);
							if (!iter || typeof iter[Symbol.asyncIterator] !== "function") {
								onEvent({
									kind: "down",
									reason: "changes 没有返回可迭代对象（宿主版本可能不匹配）"
								});
								return;
							}
						} catch (e) {
							onEvent({
								kind: "down",
								reason: "调 changes 就抛错：" + String(e && e.message || e)
							});
							return;
						}
						iters.push(iter);
						try {
							for await (const frame of iter) {
								if (signal && signal.aborted) break;
								onEvent({
									kind: "frame",
									target,
									frame
								});
							}
							if (!signal || !signal.aborted) onEvent({
								kind: "end",
								target
							});
						} catch (e) {
							if (signal && signal.aborted) return;
							const err = e && (e.code || e.message) || e;
							onEvent({
								kind: "error",
								target,
								error: String(err)
							});
						}
					};
					run();
				}
				return { dispose: () => {
					for (const it of iters) try {
						if (it && typeof it.return === "function") it.return();
					} catch (e) {}
				} };
			};
			/**
			* ═══ 工单 07 · 会话地基：三类会话，一套「认领 → 新建」流程 ═══
			*
			* 三层会话（CONTEXT.md「索引会话 / 工作会话」）与它们的**所有权凭据**：
			*
			* | 会话 | cwd | 标题 | 认领凭据 | 收指令？ |
			* | --- | --- | --- | --- | --- |
			* | 索引会话 | SR workspace 根 | `策划工作台·索引（<工作区名>）` | 标题前缀 / 自己写的缓存 | ✗（只读+订阅） |
			* | 功能工作会话 | `features\<主题>\` | `策划工作台·工作（<主题>）` | 标题前缀 / 功能缓存 | ✓ |
			* | 无归属工作会话 | SR workspace 根 | `策划工作台·工作（SR 工作区）` | 标题前缀 | ✓ |
			*
			* ★ 为什么所有权只能靠**标题 + 自己写的缓存**（工单第 3 条）：会话列表里
			*   `agentPreset` 不下发，而"cwd 相同/覆盖"根本不是所有权证据 ——
			*   用户自己的会话 cwd = `D:\TimeMachine`，它**是** SR 根的祖先目录，
			*   一样"覆盖 sr 根"。旧版本按"cwd 覆盖"认领，于是把**用户的会话**当成了
			*   面板的扫描口径（2026-10-08 实测）。现在：cwd 只是"**能不能用**"的条件
			*   （`list` 限定在会话工作区内），"是不是我的"只看标题与缓存。
			*/
			/**
			* 单航班锁（工单第 5 条：连点两次 / 同一页两次挂载 ⇒ 只建一条）。
			*
			* ★ 为什么必须有：`ensureFeatureWorkSession` 是"查缓存 → 查列表 → 建"的三段异步 —
			*   两次调用交错时会**都**走到"建"，于是堆出两条同名会话（改前实测形状）。
			*   同一个 key 的后来者直接**复用同一个 promise**（连结果对象都是同一个）。
			* ★ 它只在**一个页面实例内**有效（模块级 Map）。跨标签页只靠"每次建之前先拉一次
			*   列表现场认领"收敛：真正的并发首建（两个标签页同一毫秒）无法在客户端彻底排除，
			*   见报告「残留风险」；这里至少有两条防线 —— 认领优先、重复时收敛到**最新那条**。
			*/
			const INFLIGHT = /* @__PURE__ */ new Map();
			const singleFlight = (key, fn) => {
				const prev = INFLIGHT.get(key);
				if (prev) return prev;
				const p = Promise.resolve().then(fn).then((v) => {
					INFLIGHT.delete(key);
					return v;
				}, (e) => {
					INFLIGHT.delete(key);
					throw e;
				});
				INFLIGHT.set(key, p);
				return p;
			};
			/**
			* 本机的权限预设目录（`remote.permissionPresets.catalog()`）。
			* 返回 promise；**拿不到就 `null`** —— 调用方按最坏情况处理（切一次），不装"我知道"。
			* ★ 一次页面只读一次（它在一页里不会变），结果缓存在这个变量里。
			*/
			let permCatalog = null;
			let permCatalogDone = false;
			const permissionCatalog = () => {
				if (permCatalogDone) return Promise.resolve(permCatalog);
				let p = null;
				try {
					const svc = (ctx && ctx.remote || {}).permissionPresets;
					p = svc && typeof svc.catalog === "function" ? svc.catalog() : null;
				} catch (e) {
					p = null;
				}
				return Promise.resolve(p).then((v) => {
					permCatalogDone = true;
					permCatalog = v && v.ok === true ? v.value : v && typeof v === "object" && v.ok === void 0 ? v : null;
					return permCatalog;
				}, () => {
					permCatalogDone = true;
					permCatalog = null;
					return null;
				});
			};
			/**
			* 把一条会话切到「完全权限」并**读回**结果（工单第 7 条）。
			*
			* 通道：官方注册的斜杠命令 `/permission <preset>`（依据见纯函数 `permissionCommandLine`）
			* —— `commands.execute(sid, line, [])`，与官方 plan 插件同一用法。
			* 读回：命令返回后**再拉一次会话列表**，读这条会话的 `permissions` 投影 ——
			* "切没切成功"以读回为准（`permissionResultNote`），不是"命令没报错就算了"。
			*
			* @param sid   要切的那条会话
			* @param plan  `permissionPlanOf(catalog)` 的结论（`needed:false` 时原样返回它那句人话）
			* @returns 一句给人看的话（空 = 没什么可说）
			*/
			const ensureFullAccess = async (sid, plan, signal) => {
				const p = plan || {
					needed: true,
					preset: "danger-full-access",
					note: ""
				};
				if (!sid || !p.needed) return p.note || "";
				const r = await probe.exec(sid, permissionCommandLine(p.preset));
				const execText = r && r.ok ? r.value && (r.value.text || r.value.kind) || "" : humanError(r);
				let back = "";
				try {
					const L = await probe.listSessions(signal);
					if (L.ok) {
						const found = rowsFromList(L.value).filter((x) => x.id === sid)[0];
						back = presetOfRow(found);
					}
				} catch (e) {
					back = "";
				}
				return permissionResultNote(!!(r && r.ok), execText, back);
			};
			/**
			* 低层：在 `root` 这个目录上**建一条带可识别标题的会话**（工作区 → 会话 → 改名 → 权限）。
			* ★ 顺序里踩过的坑只留一处（开发笔记坑 8）：`session.create` 的 `workspaceId` 与 `cwd`
			*   **互斥** —— 拿不到 workspaceId 时才退回给 cwd（会话会落进「未分组」，但可用）。
			* ★ 工单 07：三类会话**都走这里**（唯一的建会话出口），于是"按 workspace 归属建"
			*   与"建完切权限"只有一份实现 —— 不会某一条路漏掉。
			*/
			const createSessionAt = async (root, title, preset, opts) => {
				const o = opts || {};
				const note = [];
				const ws = await probe.ensureWorkspace(root);
				const wsId = ws.ok && ws.value && ws.value.workspace ? ws.value.workspace.workspaceId : "";
				if (!ws.ok) note.push("按路径登记工作区失败（改用 cwd 建会话）：" + humanError(ws));
				const cr = await probe.create(wsId, root, preset || "sr-workbench");
				if (!cr.ok) return {
					sid: "",
					error: humanError(cr),
					outcome: cr,
					note
				};
				const sid = idText(cr.value && cr.value.sessionId);
				if (!sid) return {
					sid: "",
					error: "会话已创建，但拿不到 sessionId。",
					outcome: cr,
					note
				};
				if (title) {
					const rn = await probe.renameSession(sid, title);
					if (!rn.ok) note.push("会话建好了但改名失败（下次按缓存认回来）：" + humanError(rn));
				}
				if (o.fullAccess) {
					const cat = await permissionCatalog();
					const perm = await ensureFullAccess(sid, permissionPlanOf(cat), o.signal);
					if (perm) note.push(perm);
				}
				const sync = await syncSidebarStores(root);
				for (const n of sync.notes) note.push(n);
				return {
					sid,
					error: "",
					outcome: cr,
					note,
					title: title || ""
				};
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
				const key0 = normPath(root);
				if (key0 === "") return {
					ok: false,
					sid: "",
					error: "算不出这个功能的工作目录。",
					root,
					note: []
				};
				return await singleFlight("work:" + key0, async () => {
					try {
						return await withFeatureWorkSession(root, rowsIn, o);
					} catch (e) {
						return {
							ok: false,
							sid: "",
							error: "认领/创建工作会话失败：" + String(e && e.message || e),
							root,
							note: []
						};
					}
				});
			};
			/** 上面那把锁里的正文（单独一个函数只为"抛错也要把锁解开"，语义与 15 那一版一致） */
			const withFeatureWorkSession = async (root, rowsIn, o) => {
				const note = [];
				const title = o.title || workTitleFor(root);
				const key = workKey("sr-workbench", root);
				const arch = sidebarArchived();
				if (arch.ids === null) note.push(NO_ARCHIVE_INFO_NOTE + "（" + arch.reason + "）");
				const staleMemory = o.fresh ? "" : WORK_SESSIONS.get(key) || "";
				const staleCache = o.fresh ? "" : workCacheGet(workCacheRaw(), root);
				if (isArchivedId(arch.ids, staleMemory) || isArchivedId(arch.ids, staleCache)) {
					WORK_SESSIONS.delete(key);
					workCacheSet(root, null);
					note.push(ARCHIVED_CACHED_NOTE);
				}
				if (o.fresh) {
					WORK_SESSIONS.delete(key);
					workCacheSet(root, null);
				} else if (staleMemory !== "" && !isArchivedId(arch.ids, staleMemory)) return {
					ok: true,
					sid: staleMemory,
					source: "memory",
					title,
					root,
					running: false,
					note
				};
				let rows = (rowsIn || []).filter((r) => r && r.id && r.id !== o.exclude);
				const cached = isArchivedId(arch.ids, staleCache) ? "" : staleCache;
				let hit = pickWorkSession(rows, root, {
					cachedId: cached,
					archived: arch.ids
				});
				if (!hit) {
					const L = await probe.listSessions(o.signal);
					if (L.ok) {
						rows = mergeRows(rows, rowsFromList(L.value).filter((r) => r.id !== o.exclude));
						hit = pickWorkSession(rows, root, {
							cachedId: cached,
							archived: arch.ids
						});
					} else if (rows.length === 0) note.push("会话列表读取失败：" + humanError(L));
				}
				if (hit) {
					setWorkSession(key, hit.id);
					workCacheSet(root, hit.id);
					if (needsFullAccess(hit.row.preset)) {
						const perm = await ensureFullAccess(hit.id, {
							needed: true,
							preset: PERMISSION_FULL,
							note: ""
						}, o.signal);
						if (perm) note.push(perm);
					}
					if (hit.others > 0) note.push("侧边栏里有 " + (hit.others + 1) + " 条「" + title + "」（多半是并行刷新时各建了一条）：这次用**最近更新的那条**（" + hit.id + "），其余几条可在侧边栏归档。");
					return {
						ok: true,
						sid: hit.id,
						source: hit.source,
						root,
						title: titleOf(hit.row) || title,
						running: !!hit.row.running,
						row: hit.row,
						note
					};
				}
				const made = await createSessionAt(root, title, "sr-workbench", {
					fullAccess: true,
					signal: o.signal
				});
				for (const n of made.note) note.push(n);
				if (made.error) return {
					ok: false,
					sid: "",
					error: made.error,
					outcome: made.outcome,
					root,
					note
				};
				setWorkSession(key, made.sid);
				workCacheSet(root, made.sid);
				return {
					ok: true,
					sid: made.sid,
					source: "created",
					root,
					title: made.title,
					running: false,
					note
				};
			};
			/**
			* 在（复用的）工作会话里跑一条指令。
			* ★ 所有"改文件"的动作都走这里 —— 工作台在 Remote 层没有写能力，
			*   只能把意图交给 agent，由它用工具去写。
			*/
			/**
			* 确保有一个可用的「无归属工作会话」（不属于任何功能的入口专用：
			* 资产索引刷新 / 收件箱导入 / 人工补充）。
			*
			* ★ 工单 07 第 2/3 条把这一条也并进了统一链路：
			*   · 归属：`createSessionAt` 里先 `workspace.create({path = srWs})` 再
			*     `session.create({workspaceId})` —— 不再用"当前选中会话所属的工作区"
			*     （那会让它落进用户当时所在的分组，或干脆落进「未分组」）；
			*   · 标题：`策划工作台·工作（SR 工作区）` —— **认领凭据**。
			*     改前这条会话没有标题、也没有 localStorage 缓存（只有内存），
			*     于是**每次刷新页面后第一次点"刷新资产索引"都会新建一条**（实测形状：会话数只增不减）。
			*   · 权限：建完切「完全权限」（它会把索引写到 srWs 之外的地方，例如 gtgenerator 工作目录）。
			*
			* @returns `{ sid, error, note, source }`
			*/
			const ensureWorkSession = async (srWs) => {
				try {
					const root = String(srWs || "").replace(/[\\/]+$/, "");
					if (root === "") return {
						sid: "",
						error: "拿不到 sr 工作区路径（工作台锚点配置读不到）。",
						note: []
					};
					const got = await ensureFeatureWorkSession(root, [], { title: WORK_ROOT_TITLE });
					if (!got || !got.ok) return {
						sid: "",
						error: got && got.error || "拿不到工作会话。",
						note: got && got.note || []
					};
					return {
						sid: got.sid,
						error: "",
						note: got.note || [],
						source: got.source
					};
				} catch (e) {
					return {
						sid: "",
						error: "建会话失败：" + String(e && e.message || e),
						note: []
					};
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
					root,
					title: got && got.title || workTitleFor(root),
					source: got && got.source || "",
					running: !!(got && got.running)
				});
				const attempt = async (fresh, exclude) => {
					const got = await ensureFeatureWorkSession(root, cc.rows, {
						fresh,
						exclude,
						signal: cc.signal
					});
					if (!got.ok) return {
						got,
						r: null
					};
					return {
						got,
						r: await probe.prompt(got.sid, text)
					};
				};
				let a = await attempt(false, "");
				let healed = false;
				if (a.got && a.got.ok && a.r && a.r.ok !== true && isSessionGone(a.r)) {
					a = await attempt(true, a.got.sid);
					healed = true;
				}
				if (!a.got.ok) {
					const f = explainSendFailure(a.got.outcome || { message: a.got.error });
					return {
						ok: false,
						sid: "",
						sent: text,
						target: targetOf(a.got),
						healed,
						message: f.message,
						next: f.next,
						note: f.message + "　" + f.next
					};
				}
				if (!a.r || a.r.ok !== true) {
					const f = explainSendFailure(a.r);
					return {
						ok: false,
						sid: a.got.sid,
						sent: text,
						target: targetOf(a.got),
						healed,
						message: f.message,
						next: f.next,
						note: f.message + "　" + f.next
					};
				}
				return {
					ok: true,
					sid: a.got.sid,
					sent: text,
					healed,
					queued: !!a.got.running,
					target: targetOf(a.got),
					note: "已交给工作会话。" + (a.got.running ? "它正在跑别的活，这条指令排在队列里。" : "") + (a.got.note && a.got.note.length ? "　" + a.got.note.join("；") : "")
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
				if (!req || !req.path || !req.ref) return {
					ok: false,
					note: "缺少定稿路径或条目引用。"
				};
				const text = buildFixInstruction({
					path: req.path,
					ref: req.ref,
					before: req.before,
					intent: req.intent,
					impact: req.impact
				});
				const root = c.root || featureRootOf(req.path) || srWs || "";
				if (!root) return {
					ok: false,
					sent: text,
					message: "算不出这条定稿属于哪个功能目录。",
					next: "从「功能详情 › 定稿」页签进来再发一次（工作会话要建在 `features\\<主题>\\` 下）。",
					note: "算不出这条定稿属于哪个功能目录。"
				};
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
				if (!root) return {
					ok: false,
					sent: "",
					blocked: "拿不到这个功能的功能目录（`features\\<主题>\\`）。",
					next: "从「功能详情 › 头脑风暴」进来再发一次 —— 指令要发给该功能的专属工作会话（cwd = 功能目录）。"
				};
				let text = String(inp.text || "");
				if (text === "") {
					const built = INTAKE.buildBrainstormInstruction(kind, Object.assign({}, inp, { root }));
					if (built.blocked) return {
						ok: false,
						sent: "",
						blocked: built.blocked,
						next: built.next || ""
					};
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
				if (!root) return {
					ok: false,
					sent: "",
					blocked: "拿不到这个功能的功能目录（`features\\<主题>\\`）。",
					next: "从「功能详情 › 文档生成」进来再发一次 —— 指令要发给该功能的专属工作会话（cwd = 功能目录）。"
				};
				const text = String(inp.text || "");
				if (text === "") return {
					ok: false,
					sent: "",
					blocked: "这条指令是空的（界面没有把组装好的正文传过来）。",
					next: "刷新页面再试一次；仍失败就把这条发给开发者。"
				};
				return sendFeatureInstruction(root, text, c);
			};
			/**
			* 在「无归属工作会话」里跑一条指令（资产索引刷新 / 导入旧文档 / 人工补充）。
			* ★ 工单 07：这里原来**自己又建一遍会话**（`probe.create(info.id, …)`，没有标题、
			*   没有认领、没有权限切换）—— 现在只剩"调 `ensureWorkSession` + prompt"。
			*   会话的归属/标题/认领/权限**只有一份实现**（见 `createSessionAt`）。
			*/
			const runInWorkSession = async (instruction, srWs) => {
				try {
					const got = await ensureWorkSession(srWs);
					if (!got.sid) return got.error || "拿不到工作会话。";
					const r = await probe.prompt(got.sid, instruction);
					if (!r.ok) return "指令发送失败：" + humanError(r);
					const note = (got.note || []).filter(Boolean);
					return "已交给工作会话。跑完后回本页重进即可看到新索引。" + (note.length ? "　" + note.join("；") : "");
				} catch (e) {
					return "失败：" + String(e && e.message || e);
				}
			};
			const REFRESH_LINE = (win) => "请在 " + win + " 下运行 `python scripts/refresh_asset_index.py`，刷新 design-asset-index.json，并报告：新增了哪些资产、移除了哪些、哪些被新版本取代。";
			/** 刷新资产索引 */
			const refreshIndex = async (srWs) => {
				if (!srWs) return "拿不到工作区路径，无法刷新。";
				return runInWorkSession(REFRESH_LINE(String(srWs).replace(/\//g, "\\")), srWs);
			};
			/** 方式 3 · 导入旧文档（落 inbox/imported/，只登记不提升） */
			const importOldDocs = async (srWs, srcPath, note) => {
				if (!srWs) return "拿不到工作区路径。";
				if (!srcPath) return "没有选择目录。";
				const win = String(srWs).replace(/\//g, "\\");
				const line = "【导入旧文档】把 " + srcPath + " 作为参考资料导入工作区：\n1) 在 " + win + "\\inbox\\imported\\ 下建一个以该目录名命名的子目录，把其中的文档复制进去（只复制文档，跳过图片/视频等大文件；不转换格式、不改内容）；\n2) 运行 `python scripts/refresh_asset_index.py` 重新生成索引；\n3) 报告导入了哪些文件、索引新增了几条。\n注意：导入件只登记为 inbox / needs_review，**不要**提升为正式资产，也**不要**改动任何 sr skill。" + (note ? "\n补充说明：" + note : "");
				return runInWorkSession(line, srWs);
			};
			/** 方式 4 · 人工补充（落 inbox/manual/，只登记不提升） */
			const addManualNote = async (srWs, title, body, upstream) => {
				if (!srWs) return "拿不到工作区路径。";
				if (!title || !body) return "标题与正文都要填。";
				const win = String(srWs).replace(/\//g, "\\");
				const safe = String(title).replace(/[\\/:*?"<>|]/g, "_").slice(0, 60);
				const line = "【人工补充】在 " + win + "\\inbox\\manual\\ 下新建 " + safe + ".md，内容如下：\n---\ntitle: " + String(title) + "\nsource: human" + (upstream ? "\nupstream_asset: " + upstream : "") + "\n---\n\n" + String(body) + "\n\n然后运行 `python scripts/refresh_asset_index.py` 重新生成索引，并报告新增条目。\n注意：只登记为 inbox / needs_review，**不要**提升为正式资产，也**不要**改动任何 sr skill。";
				return runInWorkSession(line, srWs);
			};
			/**
			* 上传一个文件到**当前会话**（拿不到本机路径时的退路 —— **只留收据，内容读不到**）。
			* ★ 返回的 attachmentId 是不透明 id，**没有宿主路径**（`fileHostPath` 只给可信同进程消费方）。
			*   所以上传件 agent 读不到内容：这里**不把它挂进 prompt 的 content**，
			*   只在指令里写明"收到过、读不到、需要就向我要路径"（见 intakeByKind 第 2 步）。
			*/
			const uploadForSession = async (sid, f) => {
				const bytes = await readFileBytes(f, 67108864);
				const r = await safeCall("fileUploads.upload", () => ctx.remote.fileUploads.upload(sid, {
					data: bytesToBase64(bytes),
					name: String(f.name || "upload.bin")
				}));
				if (!r.ok) return {
					name: String(f.name || ""),
					error: humanError(r)
				};
				const file = r.value && (r.value.file || r.value) || {};
				return {
					name: file.name || String(f.name || ""),
					attachmentId: file.attachmentId,
					bytes: file.bytes
				};
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
				if (!contract) return {
					ok: false,
					note: "收件箱逻辑没加载上（intake-parse.js）。"
				};
				const srWs = src && src.srWs || "";
				if (!srWs) return {
					ok: false,
					note: "拿不到 sr 工作区路径（工作台锚点配置读不到）。"
				};
				const uploads = [];
				const upErr = [];
				const pathFiles = (input.files || []).filter((f) => f.fullPath && !f.err);
				const noPathFiles = (input.files || []).filter((f) => !f.fullPath && !f.err);
				let sid = null;
				if (noPathFiles.length > 0) {
					const got = await ensureWorkSession(srWs);
					if (got.error) return {
						ok: false,
						note: got.error
					};
					sid = got.sid;
					for (const f of noPathFiles) {
						const u = await uploadForSession(sid, f.orig || {
							name: f.name,
							size: f.size
						});
						if (u.attachmentId) uploads.push(u);
						else upErr.push(u.name + "（" + u.error + "）");
					}
				}
				const rawTexts = (input.materials || []).filter((m) => m.kind === "text").map((m) => m.text);
				const inline = (input.files || []).filter((f) => f.isText && !f.err).map((f) => "【文件：" + f.name + "】\n" + String(f.text || "").slice(0, INLINE_TEXT_CAP));
				const note = [String(input.note || "").trim()].concat(inline).filter((x) => x !== "").join("\n\n");
				const materialPaths = (input.materials || []).concat(pathFiles.map((f) => ({
					kind: "file",
					path: f.fullPath
				})));
				const built = contract.buildInstruction(input.kind, {
					materials: materialPaths,
					note,
					title: input.topic,
					upstream: input.upstream,
					srWs
				});
				if (built.blocked) return {
					ok: false,
					note: built.blocked
				};
				let instruction = built.instruction;
				if (inline.length > 0) instruction += "\n\n以下是随指令内联的文件内容（浏览器已读出，不必再读盘）：\n" + inline.join("\n\n");
				if (rawTexts.length > 0 && pathRefsOf(materialPaths) === 0) instruction += "\n\n我在输入框里写的原文：\n" + rawTexts.join("\n\n");
				if (uploads.length > 0) instruction += "\n\n另：本次随消息收到 " + uploads.length + " 个文件（会话附件：" + uploads.map((u) => u.name).join("、") + "）。\n**这些文件没有可用路径，你读不到它们的内容** —— 不要假装读过。若这个文件对本次任务必要，请告诉我要它做什么、并请我补一个本机绝对路径。";
				if (upErr.length > 0) instruction += "\n注意：这些文件上传失败，本次没有带上：" + upErr.join("、") + "。";
				if (sid === null) {
					const got = await ensureWorkSession(srWs);
					if (got.error) return {
						ok: false,
						note: got.error
					};
					sid = got.sid;
				}
				const sent = await probe.prompt(sid, instruction);
				if (!sent.ok) return {
					ok: false,
					note: "指令发送失败：" + humanError(sent)
				};
				const warn = uploads.length > 0 ? "　⚠ 其中 " + uploads.length + " 个文件没有本机路径，agent 读不到内容（已如实写在指令里）；要用它们请补一个绝对路径。" : "";
				return {
					ok: true,
					sid,
					kind: input.kind,
					note: "已交给工作会话" + (sid ? "（" + String(sid).slice(0, 8) + "…）" : "") + "。它在那个会话里跑，跑完回本页重进就能看到；会话里有决策门时，进度与提问都在那儿。" + warn
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
					{
						label: "决策记录目录：" + abs + "\\decisions",
						abs: abs + "\\decisions"
					},
					{
						label: "分析产出目录：" + abs + "\\analysis",
						abs: abs + "\\analysis"
					},
					{
						label: "收集箱：" + abs + "\\inbox",
						abs: abs + "\\inbox"
					}
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
				let sessionNs;
				try {
					sessionNs = ctx.remote && ctx.remote.session;
				} catch (e) {
					return Promise.reject(/* @__PURE__ */ new Error(label + "：remote.session 未注入（" + String(e && e.message || e) + "）"));
				}
				if (!sessionNs || typeof sessionNs.openWorkspacePath !== "function") return Promise.reject(/* @__PURE__ */ new Error(label + "：remote.session.openWorkspacePath 不可用 · 可用命名空间：" + Object.keys(ctx.remote || {}).join(", ")));
				const ac = new AbortController();
				return Promise.resolve(sessionNs.openWorkspacePath(req, ac.signal)).then((r) => {
					if (!r || r.ok !== true) {
						const e = r && r.error;
						throw new Error(label + "：" + (e && (e.message || e.code) || "返回失败"));
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
				try {
					L.push("remote 命名空间：" + Object.keys(ctx.remote || {}).join(", "));
				} catch (e) {
					L.push("列命名空间抛错：" + String(e && e.message || e));
				}
				let s = null;
				try {
					s = ctx.remote && ctx.remote.session;
				} catch (e) {
					L.push("访问 remote.session 抛错：" + String(e && e.message || e));
				}
				L.push("typeof remote.session = " + typeof s);
				if (!s) return L.join("\n");
				L.push("typeof session.openWorkspacePath = " + typeof s.openWorkspacePath);
				L.push("typeof session.canOpenWorkspacePath = " + typeof s.canOpenWorkspacePath);
				try {
					if (typeof s.canOpenWorkspacePath === "function") {
						const r = await s.canOpenWorkspacePath();
						L.push("canOpenWorkspacePath() = " + (r && r.ok === true ? String(r.value) : "失败 " + JSON.stringify(r && r.error)));
					}
				} catch (e) {
					L.push("canOpenWorkspacePath() 抛错：" + String(e && e.message || e));
				}
				try {
					if (typeof s.workspaceDesktop === "function") {
						const r = await s.workspaceDesktop();
						L.push("workspaceDesktop() = " + JSON.stringify(r && r.ok === true ? r.value : r && r.error));
					} else L.push("workspaceDesktop：客户端无此方法");
				} catch (e) {
					L.push("workspaceDesktop() 抛错：" + String(e && e.message || e));
				}
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
					if (!store) return {
						ids: null,
						reason: "取不到官方 workspaces 客户端服务"
					};
					const ids = archivedFromSnapshot(store.getSnapshot());
					if (ids === null) return {
						ids: null,
						reason: "快照里没有 archivedSessionIds"
					};
					return {
						ids,
						reason: ""
					};
				} catch (e) {
					return {
						ids: null,
						reason: String(e && e.message || e)
					};
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
				try {
					snap = store.getSnapshot();
				} catch (e) {
					return "";
				}
				if (!snap) return "";
				if (typeof snap.current === "string" && snap.current) return snap.current;
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
					if (!store) return {
						id: "",
						title: "",
						path: "",
						error: "workspaces 服务不可用"
					};
					const ws = store.getSnapshot();
					const cur = currentSessionId();
					if (!cur) return {
						id: "",
						title: "",
						path: ""
					};
					const hit = (ws.items || []).filter((it) => it && Array.isArray(it.sessionIds) && it.sessionIds.indexOf(cur) >= 0)[0];
					return hit ? {
						id: hit.workspaceId,
						title: hit.title || "",
						path: hit.path || ""
					} : {
						id: "",
						title: "",
						path: ""
					};
				} catch (e) {
					return {
						id: "",
						title: "",
						path: "",
						error: String(e && e.message || e)
					};
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
				try {
					workspacesSvc = svc(ctx, "workspaces");
				} catch (e) {
					workspacesSvc = null;
				}
				try {
					sessionsSvc = svc(ctx, "sessions");
				} catch (e) {
					sessionsSvc = null;
				}
				const plan = planSidebarSync({
					path: path || "",
					services: {
						workspaces: !!(workspacesSvc && typeof workspacesSvc.create === "function"),
						sessions: !!(sessionsSvc && typeof sessionsSvc.refresh === "function")
					}
				});
				const notes = plan.notes.slice();
				if (!sidebarSyncNeeded(plan)) return {
					plan,
					notes
				};
				const tryCall = async (name, fn) => {
					try {
						return {
							name,
							ok: true,
							value: await fn()
						};
					} catch (e) {
						return {
							name,
							ok: false,
							error: { message: String(e && e.message || e) }
						};
					}
				};
				for (const step of plan.steps) if (step === "workspaces.create") {
					const r = await tryCall("workspaces.create", () => workspacesSvc.create({ path: plan.resolvePath }));
					if (!r.ok) notes.push("工作区分组没能即时并进侧边栏（" + humanError(r) + "）。");
				} else {
					const r = await tryCall("sessions.refresh", () => sessionsSvc.refresh());
					if (!r.ok) notes.push("会话行没能即时并进侧边栏（" + humanError(r) + "）。");
				}
				return {
					plan,
					notes
				};
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
				listSessions: (signal) => safeCall("session.list", () => ctx.remote.session.list({}, signal)),
				/** 给会话改名 —— 索引会话的「可识别标题」凭据（`{ sessionId, title }`） */
				renameSession: (sid, title) => safeCall("session.rename", () => ctx.remote.session.rename({
					sessionId: sid,
					title
				})),
				/** 按路径查/建工作区 —— 已存在时返回 created:false 并给出 workspaceId */
				ensureWorkspace: (path) => safeCall("workspace.create", () => ctx.remote.workspace.create({ path })),
				create: (workspaceId, cwd, preset) => safeCall("session.create", () => {
					const req = workspaceId ? {
						workspaceId,
						agentPreset: preset
					} : {
						cwd: cwd || void 0,
						agentPreset: preset
					};
					return ctx.remote.session.create(req);
				}),
				exec: (sid, line) => safeCall("commands.execute", () => ctx.remote.commands.execute(sid, line, [])),
				prompt: (sid, text) => safeCall("session.prompt", () => ctx.remote.session.prompt({
					requestId: "wb-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
					sessionId: sid,
					mode: "queue",
					content: [{
						type: "text",
						text
					}]
				})),
				workspaceInfo,
				/** 原生目录选择器（用于"导入旧文档"） */
				pickDirectory: () => safeCall("directoryPicker.pick", () => ctx.remote.directoryPicker.pick()),
				/** 跳到某个会话（DSH 自己的服务；会把中栏切回对话） */
				openSession: (sid) => {
					try {
						if (!sid) return {
							ok: false,
							error: { message: "没有会话 id" }
						};
						const uw = svc(ctx, "uiWorkspace");
						if (!uw || typeof uw.openSession !== "function") return {
							ok: false,
							error: { message: "uiWorkspace 服务不可用" }
						};
						uw.openSession(sid);
						return {
							ok: true,
							value: { opened: true }
						};
					} catch (e) {
						return {
							ok: false,
							error: { message: String(e && e.message || e) }
						};
					}
				}
			};
			/**
			* 本机兜底工作区根。
			* ★ 浏览器半侧**收不到**插件 config（开发笔记坑 7），所以 `configPath` / `projectRoot`
			*   在浏览器里都是空的 —— 绝对路径只能自己推。候选根（见下）来自
			*   ① 工作区列表 ② 每个会话的 cwd ③ 这个兜底。
			*/
			const DEFAULT_ROOT = "D:\\TimeMachine";
			/** 索引会话用的预设（随包分发，见 cordis.patch.yml 的 sr-workbench 行） */
			const INDEX_PRESET = "sr-workbench";
			/**
			* 上一次用的索引会话。形状与判定**全在纯函数里**
			* （`indexCacheParse` / `indexCacheOwned` / `indexCacheSerialize`），这里只碰 localStorage。
			* ★ 关键：只有**面板自己写的**（`mine:true`）缓存才算所有权凭据 ——
			*   旧版本（工单 32）在"cwd 覆盖 sr 根"命中时也写过缓存，而那可能正是**用户的会话**。
			*/
			const cacheRaw = () => {
				try {
					if (typeof localStorage === "undefined" || !localStorage) return null;
					return localStorage.getItem(indexCacheKey());
				} catch (e) {
					return null;
				}
			};
			/** 只在**自己建完**（或认领到自己的那条）之后写 —— 这就是 `mine` 的来源 */
			const cacheWrite = (srWs, sid, title) => {
				try {
					if (typeof localStorage === "undefined" || !localStorage) return;
					localStorage.setItem(indexCacheKey(), indexCacheSerialize(srWs, sid, title || ""));
				} catch (e) {}
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
				} catch (e) {
					return null;
				}
			};
			/** 写/删一条（`sid` 传 null = 删掉这个功能的记录，会话失效自愈时用） */
			const workCacheSet = (root, sid) => {
				try {
					if (typeof localStorage === "undefined" || !localStorage) return;
					const raw = workCacheRaw();
					const next = sid === null || sid === void 0 ? workCacheDrop(raw, root) : workCachePut(raw, root, sid);
					localStorage.setItem(workCacheKey(), next);
				} catch (e) {}
			};
			/** 从配置路径反推 skills 根（形状：`<X>/.agents/skills`） */
			const skillsRootOf = (p) => String(p).replace(/[\\/]sr-askme[\\/]config\.local\.json$/i, "");
			/**
			* 解析「索引会话」—— 面板**自己持有**它（ADR 0005 / 工单 07）。
			*
			* 顺序（每步都有理由，别简化）：
			*   1. 先借一条**任何可用**的会话：只为读 sr 配置 —— `read` 不受工作区限制（坑 3）。
			*      ★ "借"只在这**一步**允许，而且它只被 `read` 用：不显示、不订阅、不发指令。
			*   2. 按候选根读 `config.local.json`（绝对值优先）→ 拿到绝对锚点 `sr_workspace`。
			*   3. **正式认领**：只有**面板自己的**会话才算（标题以 `策划工作台·索引` 开头，或
			*      自己写下的缓存），且必须**能列出 root**（`workspaceFiles.list` 限定在会话工作区内）。
			*      认不着时的顺序是"**先拉一次 `session.list`** → 再认 → 都没有才新建"——
			*      少了那一次 list 就会"每次刷新新建一条"：刷新后客户端 store 里
			*      `title` 还没投影下来（`SessionSummary.title` 是 absent until the host projects one），
			*      而标题正是唯一的认领凭据。
			*   4. 新建 = `createSessionAt(root, 索引标题, preset)` —— 与工作会话**同一条出口**
			*      （`workspace/create` → `session.create({workspaceId})` → `rename` → 并 store），
			*      所以它同样**不会落进「未分组」**、同样建完侧边栏立刻看得见。
			*      ★ 索引会话**不切权限预设**：它只被读、被订阅，不接任何指令（权限面越小越好）。
			*
			* ★ 为什么"cwd 覆盖 sr 根"**不再**是认领条件：用户自己的会话 cwd = `D:\TimeMachine`
			*   正是 sr 根的祖先目录 —— 旧版本就是这样把**用户的会话**当成了面板的扫描口径
			*   （2026-10-08 实测：`source = "cwd"`，sid 指向用户会话）。
			*
			* 返回：`{ ok, sid, cwd, root, srWs, source, extraPaths, configFile, skillsRoot, configRoot, note }`
			*/
			const resolveIndexSession = async (opts) => {
				const o = opts || {};
				const signal = o.signal;
				const note = [];
				let rows = (o.rows || []).filter((r) => r && r.id);
				const storeRowCount = rows.length;
				const arch = sidebarArchived();
				if (arch.ids === null) note.push(NO_ARCHIVE_INFO_NOTE + "（" + arch.reason + "）");
				const cached = indexCacheParse(cacheRaw());
				const cachedMine = indexCacheOwned(cached);
				if (cached && !cachedMine) note.push(FOREIGN_CACHE_NOTE);
				const cachedSid = cached && cached.sid ? String(cached.sid) : "";
				const cachedArchived = isArchivedId(arch.ids, cachedSid);
				if (cachedMine && cachedArchived) note.push(ARCHIVED_CACHED_NOTE);
				const ownCachedSid = cachedMine && !cachedArchived ? cachedSid : "";
				const roots = [];
				if (o.rootHint) roots.push(o.rootHint);
				for (const p of o.wsPaths || []) roots.push(p);
				for (const r of rows) if (r.cwd) roots.push(r.cwd);
				roots.push(DEFAULT_ROOT);
				let listOk = rows.length > 0;
				if (rows.length === 0) {
					const L = await probe.listSessions(signal);
					if (L.ok) {
						rows = rowsFromList(L.value);
						listOk = true;
					} else note.push("会话列表读取失败：" + humanError(L));
				}
				const boot = pickIndexSession(rows, "", {
					cachedId: cachedArchived ? "" : cachedSid,
					allowForeign: true,
					borrow: true
				});
				const cands = configPathCandidates(roots);
				let cfgPath = "";
				let cfg = null;
				if (boot) for (const p of cands) {
					const text = await readAllText(read, boot.id, p, signal, 200);
					if (!text) continue;
					try {
						const parsed = JSON.parse(text);
						if (parsed && parsed.sr_workspace) {
							cfg = parsed;
							cfgPath = p;
							break;
						}
					} catch (e) {}
				}
				const srWs = cfg ? String(cfg.sr_workspace).replace(/[\\/]+$/, "") : "";
				const root = srWs || o.rootHint || DEFAULT_ROOT;
				const cfgRoot = cfg ? String(cfg.config_root || "").replace(/[\\/]+$/, "") : "";
				if (!cfg) note.push("没读到 sr 配置（试过 " + cands.length + " 个候选路径），锚点退回 " + root);
				if (storeRowCount === 0) note.push("客户端会话快照为空，已走 remote.session.list。");
				/**
				* ★ 列举会话（工单 07）：索引会话的 cwd = SR 工作区根 ⇒ 它**列不出** SR 工作区之外的目录
				*   （host 把目录列举圈定在会话 cwd 之内）。`config_root` 就在外面，而看板的配置表清单、
				*   配置支线的"工作簿有没有同名文件"都要列它 —— 所以这里借一条 **cwd 覆盖它** 的只读会话。
				*   ★ 只是**列举**用的兜底：不订阅、不发指令、不显示；认领的纪律（标题 + 自己写的缓存）不变。
				*/
				LIST_SID = "";
				if (cfgRoot !== "" && !containsPath(root, cfgRoot)) {
					const lh = pickListingSession(rows, cfgRoot, { archived: arch.ids });
					if (lh) LIST_SID = lh.id;
					else note.push(noListingSessionNote(cfgRoot));
				}
				const pickOwn = () => pickIndexSession(rows, root, {
					cachedId: ownCachedSid,
					archived: arch.ids
				});
				let hit = pickOwn();
				if (!hit) {
					const L = await probe.listSessions(signal);
					if (L.ok) {
						rows = mergeRows(rows, rowsFromList(L.value));
						listOk = true;
						hit = pickOwn();
					} else note.push("会话列表读取失败：" + humanError(L));
				}
				if (hit) {
					if (hit.others > 0) note.push("侧边栏里有 " + (hit.others + 1) + " 条索引会话（多半是并行刷新时各建了一条）：这次用**最近更新的那条**（" + hit.id + "），其余几条可在侧边栏归档。");
					const stale = staleIndexRows(rows, root, arch.ids).filter((r) => r.id !== hit.id);
					if (stale.length > 0) note.push(staleIndexNote(stale[0].cwd));
					cacheWrite(root, hit.id, titleOf(hit.row));
					return {
						ok: true,
						sid: hit.id,
						cwd: hit.row.cwd || root,
						root,
						srWs,
						source: hit.source,
						sessionTitle: titleOf(hit.row),
						extraPaths: cfgPath ? [cfgPath] : [],
						configFile: cfgPath,
						skillsRoot: cfgPath ? skillsRootOf(cfgPath) : "",
						configRoot: cfg ? String(cfg.config_root || "").replace(/[\\/]+$/, "") : "",
						note
					};
				}
				if (!listOk) return {
					ok: false,
					sid: "",
					error: "读不到会话列表：" + note.join("；"),
					note
				};
				const title = indexTitleFor(root);
				const made = await singleFlight("index:" + normPath(root), () => createSessionAt(root, title, INDEX_PRESET, {
					fullAccess: false,
					signal
				}));
				for (const n of made.note) note.push(n);
				if (made.error) return {
					ok: false,
					sid: "",
					error: "无法创建索引会话：" + made.error,
					note
				};
				cacheWrite(root, made.sid, title);
				return {
					ok: true,
					sid: made.sid,
					cwd: root,
					root,
					srWs,
					source: "created",
					sessionTitle: title,
					extraPaths: cfgPath ? [cfgPath] : [],
					configFile: cfgPath,
					skillsRoot: cfgPath ? skillsRootOf(cfgPath) : "",
					configRoot: cfg ? String(cfg.config_root || "").replace(/[\\/]+$/, "") : "",
					note
				};
			};
			function PanelBound(props) {
				return h(PanelErrorBoundary, null, h(Panel, Object.assign({}, props, {
					__loader: loader,
					__remoteOpen: remoteOpen,
					__ledger: ledgerLoader,
					__final: finalLoader,
					__fix: fixRunner,
					__brainstorm: brainstormLoader,
					__sendBrainstorm: brainstormRunner,
					__draft: draftLoader,
					__sendDraft: draftRunner,
					__diagnose: diagnose,
					__probe: probe,
					__projectRoot: projectRoot,
					__interfaces: interfaceLoader,
					__index: indexLoader,
					__detail: detailLoader,
					__resolve: resolveIndexSession,
					__ensureWork: ensureFeatureWorkSession,
					__watch: watchTargets,
					__statMany: statMany,
					__refreshIndex: refreshIndex,
					__readText: readTextFile,
					__pickDir: probe.pickDirectory,
					__importDocs: importOldDocs,
					__addManual: addManualNote,
					__intake: intakeByKind,
					__intakeRefs: intakeRefs
				})));
			}
			ctx.slots.inject("main", function* () {
				yield ctx.slots.register({
					name: "main",
					key: PANEL_ID
				}, PanelBound);
			});
			ctx.slots.inject("sidebar.panellist", function* () {
				yield ctx.slots.register({
					name: "sidebar.panellist",
					id: PANEL_ID,
					order: 100,
					label: "策划工作台"
				}, Glyph);
			});
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
