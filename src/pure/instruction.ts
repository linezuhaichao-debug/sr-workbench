/**
 * 指令文本构造（纯函数）—— 「把改哪儿、改成什么、现状原文、连带影响组装成一条能直接发出的指令」。
 *
 * ★ 面板不写文件：它只把意图说到 agent 不用再找的程度（条目引用 + 现状原文 + 结构影响范围）。
 *   语义影响仍交给 sr-gdd-fix 的 D11 影响面闭合 —— 面板不越界。
 * ★ 工单 03 把这段从 `fixRunner` 里抽出来，逐字保留每一条措辞：它是产品契约的一部分，
 *   所以它必须有回归网（test/instruction.test.ts 断言逐行文本）。
 */

export interface ImpactHit {
	line: number;
	where: string;
	/** `family` = 编号同族的边（UE3 ↔ UE3a）· `contract` = 契约关联的边（§4 配置字段 ↔ §6 字段行） */
	kind?: string;
}

/**
 * 影响范围里要标出来的边类别 —— 用户得能判断"这条算不算数"（工单 14）。
 * ★ 其余五类边的命中是"全文提到它的位置"，没有 kind（指令里也就不加标签），逐字保持原样。
 */
const KIND_LABEL: Record<string, string> = { family: "同族", contract: "契约" };

export interface FixRequest {
	/** 定稿绝对路径 */
	path?: string;
	/** 条目引用（如 `§5 UI-M1 UE3`） */
	ref?: string;
	/** 现状原文（行号会漂，原文不会） */
	before?: string;
	/** 要改成什么 */
	intent?: string;
	/** 工作台按结构引用扫出的连带影响（不是语义影响） */
	impact?: ImpactHit[];
}

export function buildFixInstruction(req: FixRequest): string {
	const L: string[] = [];
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
