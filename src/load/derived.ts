/**
 * 派生物加载器（工单 28）—— **只吃 port**，只读。
 *
 * 它只做 IO 与编排，判定全在 `../pure/derived.ts`（有测试）：
 *   ① 交付桶（`delivery\`）的文件清单由**调用方**从工单 12 的产物清单里给（不重新列目录 ——
 *      与头脑风暴 / 文档生成同一条纪律：「面板列出的产物」与「工作面读的那份」必须同一来源）；
 *   ② 本层做两件真需要 IO 的事：**读每一份产物对应的侧车文本**、**拿当前定稿的版本指纹**；
 *   ③ 判过期、拼人话、组装指令，全部交给纯函数。
 *
 * ★ 面板**不写盘**（`CONTEXT.md`「面板只读 / agent 执行」）：侧车是 agent 按指令写下去的，
 *   这一层永远只读它。读不到就是读不到 —— 如实交给纯函数判成 `unknown`，不猜、不默认最新。
 */

import { derivedRows, kindOfDeliveryFile, sidecarNameOf } from "../pure/derived.ts";
import type { CurrentFinal, DerivedRows } from "../pure/derived.ts";
import type { WorkspacePort } from "../port/types.ts";
import { readAllText } from "./read.ts";

export interface DerivedOptions {
	/** 功能根目录（绝对路径） */
	root: string;
	/** 功能主题（目录名；拼产物名用） */
	topic?: string;
	/** 面板给的今天（`YYYYMMDD`）—— 纯函数不吃时钟 */
	compact?: string;
	/** 交付桶里的文件名（可含 `子目录/文件名`） */
	files?: unknown[];
	/** 当前有效定稿；`null` = 这个功能没有可派生的定稿 */
	final?: CurrentFinal | null;
	/** 技能根（`…\.agents\skills`）；拿不到就给空串（纯函数会写成相对提示） */
	skillsRoot?: string;
	/** 界面图目录与张数（宣讲页的图源；没有就说没有） */
	uiDir?: string;
	uiCount?: number;
	/** `gdd\` 里的定稿派生 HTML（放错桶的既有派生物；如实报一句） */
	gddFinalHtml?: string[];
	signal?: AbortSignal;
}

/**
 * 读侧车（拿不到给 `null` —— **同一个 `null` 表示"读不到"**，与纯函数的 `parseProvenance` 约定一致）。
 * 单个侧车读失败**不拖垮整批**：那一份就按"看不到依据"显示。
 */
async function readSidecar(port: WorkspacePort, absPath: string, signal?: AbortSignal): Promise<string | null> {
	try {
		return await readAllText(port, absPath, signal, 200);
	} catch (e) {
		return null;
	}
}

/**
 * 加载派生物行视图。
 *
 * @returns `derivedRows(...)` 的结果（`kinds` / `current` / `notes` / `counts`）
 *   · `kinds[].state` —— `none`（还没有）/ `fresh`（已是最新）/ `stale`（已过期）/ `unknown`（看不到依据）
 *   · `kinds[].instruction` —— 与界面预览**逐字相同**的那一段（缺前提时是空串，另有 `blocked` + `next`）
 */
export async function loadDerived(port: WorkspacePort, options: DerivedOptions): Promise<DerivedRows & { root: string }> {
	const root = String(options.root || "").replace(/[\\/]+$/, "");
	const signal = options.signal;
	/**
	 * ★ 只认**交付桶顶层**的文件名。
	 *   面板那一层给的是产物清单里 `delivery` 组的 `f.name`（不带 `subdir`），但这一层不指望调用方
	 *   一定规规矩矩：**带分隔符的（`delivery/UE交付_20260928/01_宣讲会交付.html` 这种子目录里的东西）
	 *   一律不当派生物** —— 它们是外部交付包，不是这份面板派生的产物；混进来还会让侧车路径拼错。
	 *   （实测踩过：一开始把 `rel` 直接喂进来，侧车里那一段就变成了
	 *   `<root>\delivery\delivery\xxx.provenance.json` ⇒ 永远"读不到"。）
	 */
	const files = (Array.isArray(options.files) ? options.files : [])
		.map((x) => String(x == null ? "" : x).trim())
		.filter((x) => x !== "" && x.indexOf("/") < 0 && x.indexOf("\\") < 0);

	// 只读"可能存在的侧车"：按交付桶里那些**派生物本体**逐个算出侧车名（不给整桶每个都来一遍）
	const sidecars: Record<string, string | null> = {};
	const wanted: string[] = [];
	for (const f of files) {
		const k = kindOfDeliveryFile(f);
		if (k !== "speech" && k !== "aiv") continue;
		const sc = sidecarNameOf(f);
		if (sc !== "" && wanted.indexOf(sc) < 0) wanted.push(sc);
	}
	for (const sc of wanted) {
		sidecars[sc] = await readSidecar(port, root + "/delivery/" + sc, signal);
	}

	const rows = derivedRows({
		files: files,
		sidecars: sidecars,
		final: options.final || null,
		root: root,
		topic: options.topic || "",
		compact: options.compact || "",
		skillsRoot: options.skillsRoot || "",
		uiDir: options.uiDir || "",
		uiCount: options.uiCount || 0,
		gddFinalHtml: options.gddFinalHtml || []
	});
	return Object.assign({ root: root }, rows);
}
