/**
 * 决策台账加载器（审计面）：决策记录 + 契约校验 + 校准流水 + 交接 JSON。
 *
 * ★ 收**功能根目录**而不是 srWs —— 功能 = 目录（§3.2），所以**不再需要 topicOf 过滤**：
 *   目录已经天然隔离了。这是"新结构做扎实"的直接收益，少一层猜测、少一类错。
 */

import { validateDecision } from "../pure/validate.ts";
import type { WorkspacePort } from "../port/types.ts";
import { loadDecisionSchema } from "./paths.ts";
import { listFiles, readAllText } from "./read.ts";

export interface LedgerLoadOptions {
	/** 功能根目录绝对路径 */
	root: string;
	/** skills 根（用来找 decision.schema.json） */
	skillsRoot?: string;
	signal?: AbortSignal;
}

export async function loadLedger(port: WorkspacePort, options: LedgerLoadOptions): Promise<any> {
	const root = options.root;
	const signal = options.signal;
	const dir = root + "/decisions";
	const names = await listFiles(port, dir, signal, true);
	const mine = names.filter((n) => /^decision_.*\.json$/i.test(n));

	const schema = await loadDecisionSchema(port, options.skillsRoot || "", signal);
	const records: any[] = [];
	for (const n of mine.slice().sort().reverse()) {
		const text = await readAllText(port, dir + "/" + n, signal, 2000);
		let doc = null;
		let parseErr = null;
		try {
			doc = JSON.parse(text as string);
		} catch (e) {
			parseErr = String((e && (e as Error).message) || e);
		}
		records.push({
			file: n,
			doc: doc,
			parseErr: parseErr,
			issues: doc ? validateDecision(doc, schema) : [],
		});
	}

	// 校准流水（evidence\calibration_*.jsonl）
	const ev = await listFiles(port, root + "/evidence", signal, true);
	const calFiles = ev.filter((n) => /^calibration_.*\.jsonl$/i.test(n));
	const calibration: any[] = [];
	for (const n of calFiles) {
		const text = await readAllText(port, root + "/evidence/" + n, signal, 2000);
		if (!text) continue;
		for (const line of text.split(/\r?\n/)) {
			const s = line.trim();
			if (!s) continue;
			try {
				calibration.push({ file: n, row: JSON.parse(s) });
			} catch (e) {
				/* 跳过坏行 */
			}
		}
	}

	// ★ 交接 JSON（analysis\sr-gdd-handoff_*.json）—— 头脑风暴结论的主要载体
	const an = await listFiles(port, root + "/analysis", signal, true);
	const handoffs: any[] = [];
	for (const n of an.filter((x) => /^sr-gdd-handoff_.*\.json$/i.test(x))) {
		const text = await readAllText(port, root + "/analysis/" + n, signal, 2000);
		if (text) handoffs.push({ name: n, text: text });
	}

	return {
		records: records, schema: schema, schemaOk: !!schema,
		calibration: calibration, calFiles: calFiles,
		handoffs: handoffs,
	};
}
