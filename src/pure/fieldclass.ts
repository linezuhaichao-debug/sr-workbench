/**
 * 工单 17 · 设计台账的**字段归类表**与**字段覆盖检查**
 *
 * 17 的原文：「字段覆盖检查：遍历所有决策记录的键，每个键必须显式归类为收或不收，**悬空即报错**」。
 * 所以这张表不是文档，是**可执行的数据**：上游新增一个字段，如果没在这张表里加一行，
 * 覆盖检查就会把它报成 **error**（不是警告）——这正是"上游新增字段时不会漏掉一类决定"的机制。
 *
 * 归类取值（六值，与 17 的交付物 17-ledger-field-classification.md 一致）：
 *   collect            收 —— 人做的决定，进设计台账
 *   container          容器 —— **不给容器本身归类**，检查器递归进去看它的子键（`decision_result` 等）
 *   exclude_agent      不收 —— agent 的动作/产物（改了哪些文件、验证记录、下一步动作…）
 *   exclude_meta       不收 —— 元数据与排序/判阶段用的键（ID、时间戳、轮次、门名…）
 *   exclude_proposal   不收 —— agent 提的候选；只有被人选中的那条以"结论"形态出现在别处
 *   pending_user       待判定 —— 视同"尚未归类"，覆盖检查同样报错
 *
 * ── 覆盖深度（**与交付物 17-classification 的统计口径一致，别偷偷改深**）────────────
 *   顶层键 + 一级子键（`decision_result.*`）+ **顶层**数组的元素键（`options[] .*`）。
 *   再往下（`decision_result.calibrations[].round`、`decision_result.changes[].编号` 这些）
 *   本轮**不检查**——那条边界是上一轮交付物定的，改深会同时改变那 79 个键的统计。
 *   这是**已知盲区**，写在报告里留给后续票（要改深就得同时扩表）。
 *
 * 纯函数、零 IO：doc / jsonl 原文由调用方读进来。
 */

/** 归类六值 */
type FieldClass = "collect" | "container" | "exclude_agent" | "exclude_meta" | "exclude_proposal" | "pending_user";

interface FieldRule {
	klass: FieldClass;
	/** 为什么这么归（给人看的一句话，也是评审时的依据） */
	why: string;
	/** 台账里从哪儿取（`—` = 不进台账文本） */
	take: string;
}

const FIELD_CLASSES: FieldClass[] = ["collect", "container", "exclude_agent", "exclude_meta", "exclude_proposal", "pending_user"];

/**
 * 字段归类表（79 个真实键 + 4 个"代码在读但本功能数据里没有"的键）。
 *
 * 来源：`17-classify-fields.mjs`（工单 17 的交付物，已在真实数据上跑出「悬空 0」）
 * → 这里**逐行搬成仓库内的数据模块**，`why` / `take` 一字不改，便于与本仓库的检查结果对账。
 */
const LEDGER_FIELD_CLASSIFICATION: Record<string, FieldRule> = {
	// ⓿ 容器：不归类自己，检查器递归进去看子键
	"decision_result": { klass: "container", why: "容器：它的每个子键各自归类", take: "—" },
	"options": { klass: "container", why: "容器：候选集合；子键一律 exclude_proposal", take: "—" },
	"options[].*": { klass: "container", why: "容器（数组元素）：子键一律 exclude_proposal", take: "—" },
	"materials": { klass: "container", why: "容器：输入材料清单", take: "—" },
	"assumption_ledger": { klass: "container", why: "容器：假设台账", take: "—" },
	"chosen_nucleus": { klass: "container", why: "容器：设计核", take: "—" },

	// ① collect —— 决策记录里"人拍板"的结论
	"title": { klass: "collect", why: "决策记录标题本身就是一句完整的拍板结论（旧实现已在收）", take: "j.title" },
	"decision_question": { klass: "collect", why: "摆给人选的那个问题——台账叙述的起点（与结论成对可读）", take: "j.decision_question（可与 title 同行合并展示）" },
	"decision_type": { klass: "collect", why: "判阶段的依据（门名缺失时按它判阶段）", take: "用于 stageOfDecision，不单独成行" },
	"gate": { klass: "collect", why: "判阶段的依据（有门名则按门名判阶段）", take: "用于 stageOfGate，不单独成行" },
	"owner": { klass: "collect", why: "谁负责这次决定（人）——与 accepted_by 同类", take: "j.owner" },
	"accepted_by": { klass: "collect", why: "谁拍的板（人做的决定的第一要件）", take: "j.accepted_by" },
	"accepted_reason": { klass: "collect", why: "接受理由——人给的理由就该进叙述", take: "j.accepted_reason" },
	"current_default_action": { klass: "collect", why: "门内「不改会怎样」的默认动作，是本次拍板的对照物", take: "j.current_default_action" },
	"reversibility": { klass: "collect", why: "可逆性由门内定（决策属性）", take: "j.reversibility" },
	"stakes": { klass: "collect", why: "赌注大小由门内定（决策属性）", take: "j.stakes" },
	"boundary_status": { klass: "collect", why: "边界状态由门内定（决策属性）", take: "j.boundary_status" },
	"rollback_trigger": { klass: "collect", why: "回滚触发条件属设计约束", take: "j.rollback_trigger" },
	"decision_result.combination": { klass: "collect", why: "选定设计核组合（旧实现已在收）", take: "r.combination" },
	"decision_result.chosen": { klass: "collect", why: "被选中的候选编号（配合 options 才能读成人话）", take: "r.chosen（不单独成行，用于定位被选项）" },
	"decision_result.gate": { klass: "collect", why: "门名（判阶段用）", take: "用于 stageOfGate，不单独成行" },
	"decision_result.note": { klass: "collect", why: "为什么这么选（旧实现已在收）", take: "r.note" },
	"decision_result.kill_signal": { klass: "collect", why: "证伪条件属设计约束（旧实现已在收）", take: "r.kill_signal" },
	"decision_result.calibrations": { klass: "collect", why: "**台账主体**：门内每一轮用户拍板要点（旧实现已在收）", take: "r.calibrations[].input + .gate + .ts" },
	"decision_result.gdd_draft_gate": { klass: "collect", why: "成稿门结果（旧实现已在收）", take: "r.gdd_draft_gate.{chosen,result,handoff_target,note}" },
	"decision_result.settled_choices": { klass: "collect", why: "逐条拍板选择（代码在读；本功能数据里没有，诸神降临有 T1–T7）", take: "r.settled_choices.*（value/text/note）" },
	"decision_result.settled_choices.*": { klass: "collect", why: "逐条拍板选择（代码在读）", take: "r.settled_choices.*（value/text/note）" },
	"decision_result.handoff_gate": { klass: "collect", why: "交接门结果（代码在读）", take: "r.handoff_gate.{chosen,result,handoff_target,note}" },
	"handoff_gate.handoff_target": { klass: "collect", why: "交接门结果（代码在读）", take: "r.handoff_gate.handoff_target" },

	"chosen_nucleus.statement": { klass: "collect", why: "设计核一句话（旧实现已在收）", take: "cn.statement" },
	"chosen_nucleus.combination": { klass: "collect", why: "设计核组合", take: "cn.combination" },
	"chosen_nucleus.key_tension": { klass: "collect", why: "设计核的核心张力（拍板依据）", take: "cn.key_tension" },
	"chosen_nucleus.kill_signal": { klass: "collect", why: "设计核的证伪信号", take: "cn.kill_signal" },
	"chosen_nucleus.id": { klass: "collect", why: "设计核编号（定位用）", take: "cn.id（不单独成行）" },
	"calibrated_facts": { klass: "collect", why: "已确认下来的设计口径（旧实现已在收，是头脑风暴阶段的主要载体）", take: "j.calibrated_facts[]" },
	"assumption_ledger.closed": { klass: "collect", why: "已确认假设（旧实现已在收）", take: "al.closed[]" },
	"assumption_ledger.open": { klass: "collect", why: "未决假设——它是「当时还没定」的如实记录", take: "al.open[]" },
	"open_questions_for_gdd": { klass: "collect", why: "留给成稿的未决问题（人当时认下的待办性结论）", take: "j.open_questions_for_gdd[]" },
	"input": { klass: "collect", why: "校准流水里的用户原话（旧实现已在收）", take: "calibration.jsonl 的 input" },
	"affected": { klass: "collect", why: "该轮拍板影响了哪些条目——「这条决定牵动了什么」的结构信息", take: "calibration.affected[]（可作同行后缀）" },

	// ② exclude_agent —— agent 的动作 / 产物（留在决策记录里，但不进设计台账）
	"next_step": { klass: "exclude_agent", why: "交接口径的下一步动作", take: "—" },
	"decision_result.files": { klass: "exclude_agent", why: "agent 改了哪些文件", take: "—" },
	"decision_result.changes": { klass: "exclude_agent", why: "agent 的技术改动清单（代码注释已明确不收）", take: "—" },
	"decision_result.post_gate_fixes": { klass: "exclude_agent", why: "门后修复改动汇总（审计面）", take: "—" },
	"decision_result.post_gate_fix_20260929": { klass: "exclude_agent", why: "同上（按日期分文件）", take: "—" },
	"decision_result.conditions_completed": { klass: "exclude_agent", why: "执行细节（代码注释已明确不收）", take: "—" },
	"decision_result.remaining_items": { klass: "exclude_agent", why: "执行细节（代码注释已明确不收）", take: "—" },
	"decision_result.open_items": { klass: "exclude_agent", why: "落地待办（审计面）", take: "—" },
	"decision_result.diagram_swap": { klass: "exclude_agent", why: "线框图替换动作（代码注释已明确不收）", take: "—" },
	"decision_result.config_action": { klass: "exclude_agent", why: "配置侧动作记录", take: "—" },
	"decision_result.impact_scan": { klass: "exclude_agent", why: "影响面扫描结果（工具产物）", take: "—" },
	"decision_result.verification": { klass: "exclude_agent", why: "验证动作记录", take: "—" },
	"decision_result.report_path": { klass: "exclude_agent", why: "产物路径", take: "—" },
	"decision_result.handoff_json": { klass: "exclude_agent", why: "产物路径", take: "—" },
	"decision_result.feature_concept": { klass: "exclude_agent", why: "产物路径", take: "—" },
	"decision_result.gdd_draft": { klass: "exclude_agent", why: "产物路径", take: "—" },
	"decision_result.knowledge_base_note": { klass: "exclude_agent", why: "知识库笔记指针", take: "—" },
	"decision_result.next_step": { klass: "exclude_agent", why: "下一步动作（不是已做的决定）", take: "—" },
	"decision_result.mode": { klass: "exclude_agent", why: "运行模式（工具参数）", take: "—" },

	// ③ exclude_meta —— 元数据 / 排序键 / 引用指针
	"schema_version": { klass: "exclude_meta", why: "契约版本", take: "—" },
	"decision_id": { klass: "exclude_meta", why: "ID（台账按设计要求不显示 ID）", take: "—" },
	"handoff_id": { klass: "exclude_meta", why: "ID", take: "—" },
	"status": { klass: "exclude_meta", why: "状态词（台账明确不加状态词）", take: "—" },
	"topic": { klass: "exclude_meta", why: "主题名", take: "—" },
	"source_skill": { klass: "exclude_meta", why: "来源 skill", take: "—" },
	"target_skill": { klass: "exclude_meta", why: "去向 skill", take: "—" },
	"created_at": { klass: "exclude_meta", why: "时间戳（排序/分组用）", take: "—" },
	"updated_at": { klass: "exclude_meta", why: "时间戳（排序/分组用）", take: "—" },
	"ts": { klass: "exclude_meta", why: "排序/分组键", take: "—" },
	"round": { klass: "exclude_meta", why: "排序键（去重要用），不是台账内容", take: "—" },
	"evidence_refs": { klass: "exclude_meta", why: "引用列表（空值多）", take: "—" },
	"assumption_refs": { klass: "exclude_meta", why: "引用列表", take: "—" },
	"experiment_refs": { klass: "exclude_meta", why: "引用列表", take: "—" },
	"gate_refs": { klass: "exclude_meta", why: "引用列表", take: "—" },
	"config_prediction_ref": { klass: "exclude_meta", why: "引用指针", take: "—" },
	"risk_register_ref": { klass: "exclude_meta", why: "引用指针", take: "—" },
	"materials.concept_triage_report": { klass: "exclude_meta", why: "输入材料路径", take: "—" },
	"materials.decision_record": { klass: "exclude_meta", why: "输入材料路径", take: "—" },
	"materials.feature_concept": { klass: "exclude_meta", why: "输入材料路径", take: "—" },
	"materials.original_brief": { klass: "exclude_meta", why: "输入材料路径", take: "—" },
	"materials.original_brief_note": { klass: "exclude_meta", why: "输入材料备注", take: "—" },

	// ④ exclude_proposal —— agent 提的候选（人没选的那几条坚决不收）
	"options[].option_id": { klass: "exclude_proposal", why: "候选编号", take: "—（只用于解析 chosen）" },
	"options[].action": { klass: "exclude_proposal", why: "候选动作描述；**只当 chosen 指向它时**才以「结论」形态出现", take: "—（经 r.chosen 定位后由 combination/title 表达）" },
	"options[].expected_benefit": { klass: "exclude_proposal", why: "候选的预期收益（agent 说的）", take: "—" },
	"options[].main_risk": { klass: "exclude_proposal", why: "候选的主要风险（agent 说的）", take: "—" }
};

/** 键的归一：`options[] . action` / `options[]. action` → `options[].action`（交付物表格排版会多空格） */
function normalizeFieldKey(key: unknown): string {
	return String(key).replace(/\[\]\s*\.\s*/g, "[].").trim();
}

/** 查归类表：先精确，再数组元素通配（`options[].action` → `options[].*`），最后父级通配（`a.b.C` → `a.b.*`） */
function classifyField(key: unknown): FieldRule | null {
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
function fieldKeysOf(doc: unknown): string[] {
	const out: string[] = [];
	if (!doc || typeof doc !== "object" || Array.isArray(doc)) return out;
	const obj = doc as Record<string, unknown>;
	for (const k of Object.keys(obj)) {
		out.push(k);
		const v = obj[k];
		if (Array.isArray(v)) {
			const first = v.find((x) => x && typeof x === "object" && !Array.isArray(x));
			if (first) for (const k2 of Object.keys(first as Record<string, unknown>)) out.push(k + "[]." + k2);
		} else if (v && typeof v === "object") {
			for (const k2 of Object.keys(v as Record<string, unknown>)) out.push(k + "." + k2);
		}
	}
	return out;
}

interface CoverageSource {
	/** 这个键是从哪儿读到的（决策记录文件名 / 校准 jsonl 文件名 / 交接 JSON 名）——报错时要能指回去 */
	where: string;
	/** 已解析的记录；没有就现解析 text */
	doc?: unknown;
	/** 记录原文（jsonl 的一行也能这么传） */
	text?: string;
}

function docOf(src: CoverageSource): unknown {
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
function checkFieldCoverage(input: { sources?: CoverageSource[] }) {
	const sources = (input && input.sources) || [];
	const dangling: Array<{ key: string; where: string }> = [];
	const pending: Array<{ key: string; where: string }> = [];
	const classes: Record<string, number> = {};
	const distinct = new Set<string>();
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
			if (!rule) { dangling.push({ key: k, where: src.where }); continue; }
			if (rule.klass === "pending_user") { pending.push({ key: k, where: src.where }); continue; }
			classes[rule.klass] = (classes[rule.klass] || 0) + 1;
		}
	}
	const unknown = dangling.concat(pending);
	return {
		checked: checked,               // 键实例总数（同一键出现在两个文件里算两次）
		distinct: distinct.size,        // 不同键个数（真实数据 79）
		keys: Array.from(distinct).sort(),   // 不同键清单（对账/排查用）
		classes: classes,               // collect / container / exclude_* 的分布
		dangling: dangling,             // 表里没有的键 —— **悬空即报错**
		pending: pending,               // 归为 pending_user 的键 —— 视同尚未归类
		unknown: unknown,
		ok: unknown.length === 0,
		issues: unknown.map((u) => ({
			code: "V17", level: "error",
			msg: "字段 `" + u.key + "` 未归类（" + u.where + "）——谁来读它、收不收必须显式判定：" +
				"不归类就不允许落库，先在 src/pure/fieldclass.ts 的归类表里加一行",
			lines: [] as number[],
			files: [u.where]
		}))
	};
}

export { FIELD_CLASSES, LEDGER_FIELD_CLASSIFICATION, normalizeFieldKey, classifyField, fieldKeysOf, checkFieldCoverage };
export type { FieldClass, FieldRule };
