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
			cur = { title: m[2].trim(), body: [] };
			continue;
		}
		if (cur) cur.body.push(line);
		// `# ` 一级标题（文档标题）不进章节
	}
	if (cur) out.push(cur);
	return out.map((s) => ({ title: s.title, body: s.body.join("\n").replace(/^\s+|\s+$/g, "") }));
}

/** 标题 → 归类；cls: top(置顶) / body(主体) / fold(折叠) / skip(省略) */
function classifyHeading(title, rules) {
	for (const r of rules) if (r.re.test(title)) return r.cls;
	return null;   // 未知 → 收进「其他章节」，绝不丢弃
}

// 每种产出的章节规范（正则按真实标题写，见规范文档 §二 §三）
const MD_SPECS = [
	{
		name: "体验报告", match: /^experience-report_/i, sections: [
			{ re: /一句话总评/, cls: "top" },
			{ re: /是否值得复刻/, cls: "top" },
			{ re: /核心机制拆解/, cls: "body" },
			{ re: /功能账本/, cls: "body" },
			{ re: /问题列表与问题卡/, cls: "body" },
			{ re: /画面序列拆解/, cls: "body" },
			{ re: /验证计划/, cls: "body" },
			{ re: /样本边界门|决策声明|品类路由|工具与访问状态/, cls: "fold" },
			{ re: /治理检查/, cls: "fold" },
			{ re: /样本元信息|结构化输出/, cls: "skip" }
		]
	},
	{
		name: "复刻规格", match: /^replication-spec_/i, sections: [
			{ re: /待裁决取舍清单/, cls: "top" },
			{ re: /迁移边界/, cls: "top" },
			{ re: /功能规则候选/, cls: "body" },
			{ re: /UI 结构与交互流程/, cls: "body" },
			{ re: /数值表现/, cls: "fold" },
			{ re: /推断配置项/, cls: "fold" },
			{ re: /样本边界/, cls: "fold" }
		]
	},
	{
		name: "设计核三角报告", match: /^concept-triage_/i, sections: [
			{ re: /Design Nucleus Options/, cls: "top" },
			{ re: /Assumption Ledger/, cls: "top" },
			{ re: /Original Idea/, cls: "body" },
			{ re: /Concept Seed Extraction/, cls: "body" },
			{ re: /Player Verb Inventory/, cls: "body" },
			{ re: /Action-Goal Alignment/, cls: "body" },
			{ re: /Recommended Next Step/, cls: "body" },
			{ re: /Case Visibility|External Evidence Status|Quality Gate/, cls: "fold" },
			{ re: /治理引用/, cls: "skip" }
		]
	},
	{
		name: "功能设计稿", match: /^feature-concept_/i, sections: [
			{ re: /Player Promise/, cls: "top" },
			{ re: /Core Loop/, cls: "top" },
			{ re: /Validation Plan/, cls: "top" },
			{ re: /Key Systems/, cls: "body" },
			{ re: /Uncertainty Calibration/, cls: "body" },
			{ re: /Scope Gate/, cls: "body" },
			{ re: /Assumption Ledger/, cls: "body" },
			{ re: /Risk Register/, cls: "body" },
			{ re: /下一步/, cls: "body" },
			{ re: /Production Feasibility/, cls: "fold" },
			{ re: /配置项预测/, cls: "fold" }
		]
	},
	{
		name: "证据索引", match: /^evidence-index_/i, sections: [
			{ re: /Evidence Index/, cls: "top" },
			{ re: /置信度说明/, cls: "body" },
			{ re: /时间戳账本/, cls: "fold" }
		]
	},
	{
		name: "读回验收报告", match: /^readback_/i, sections: [
			{ re: /结论/, cls: "top" },
			{ re: /必达项对照/, cls: "body" },
			{ re: /追加项/, cls: "fold" },
			{ re: /报告头/, cls: "fold" }
		]
	}
];

function mdSpecOf(path) {
	// ★ 修复（工单 03 收尾）：原来只按 "/" 切，Windows 反斜杠路径会整条落进 `name`，六种规范一个都匹配不上。
	//   同一仓库的其它路径工具（intake.baseName）都用 `[\\/]`；这里跟齐，正斜杠路径行为不变。
	const name = String(path || "").split(/[\\/]/).pop() || "";
	for (const s of MD_SPECS) if (s.match.test(name)) return s;
	return null;
}

export { parseMdSections, classifyHeading, MD_SPECS, mdSpecOf };
