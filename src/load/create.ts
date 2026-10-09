/**
 * 新建功能的**只读一侧**（加载层，只吃 `WorkspacePort`）：建之前要知道的事实。
 *
 * 事实有两样：① `features\` 下已经有哪些目录（撞名要当场拒绝 —— **目录存在就是功能**）；
 * ② 某个功能目录的现状（`inspectFeatureDir`：**只有 4 个桶的空脚手架** 与 **真功能** 要分开）。
 * 客户端 store 里的工作区表由组合根直接给（它拿得到 store，加载层拿不到），这里不读。
 *
 * ★ 这里**一个字节都不写**。建目录在组合根里做，而且**不是只有一条路**：
 *   `uiWorkspace.createDirectory` 只在 browse 后端存在，**Windows 上没有** ⇒ 要退到
 *   "让会话跑 PowerShell" 或 "用户手工建"（判据与理由见 `pure/createfeature.ts` 那一节）。
 */

import { isBareScaffold } from "../pure/createfeature.ts";
import type { EntryType, WorkspacePort } from "../port/types.ts";
import { listDirs } from "./read.ts";

export interface CreateFacts {
	/** `features\` 下已存在的目录名（不过滤噪音 —— 目录存在就不能往里建东西）。 */
	dirNames: string[];
	/** 读不到目录列表时的如实说明（空 = 列到了）。 */
	note: string;
}

/** 一个功能目录的现状（区分**空脚手架**与**真功能**）。 */
export interface FeatureDirState {
	/** 目录在不在（列不出来 = 不在）。 */
	exists: boolean;
	/** 直接子项（名字 + 类型）。 */
	entries: Array<{ name: string; type: EntryType }>;
	/** 是不是"只有几个桶目录、一个文件都没有"的空脚手架（那种才允许接着往下建）。 */
	bare: boolean;
}

/**
 * 看一个功能目录的现状。**只读**；列不出来就是 `exists:false`（不抛）。
 * ★ 判据 `bare` 在纯函数 `isBareScaffold` 里（有测试），这里只做 IO。
 */
export async function inspectFeatureDir(port: WorkspacePort, root: string, signal?: AbortSignal): Promise<FeatureDirState> {
	const r = String(root || "").replace(/[\\/]+$/, "");
	let entries: Array<{ name: string; type: EntryType }> = [];
	try {
		const l = await port.listDir(r, signal);
		entries = (l && l.entries ? l.entries : []).map((e) => ({ name: e.name, type: e.type }));
	} catch (e) {
		return { exists: false, entries: [], bare: false };
	}
	return { exists: true, entries: entries, bare: isBareScaffold(entries) };
}

/**
 * 建之前的事实（**只读**）。
 * ★ 要分清两种情况：**全新工作区（还没有 `features\`）** 与 **列不出来（越界/通道坏）**。
 *   判据：SR 工作区根列得出来 ⇒ 只是还没有功能目录（可以建第一个）；
 *   根也列不出来 ⇒ 核不了冲突，**如实说、让界面别建**。
 */
export async function loadCreateFacts(
	port: WorkspacePort,
	options: { srWs: string; signal?: AbortSignal },
): Promise<CreateFacts> {
	const srWs = String(options.srWs || "").replace(/[\\/]+$/, "");
	if (srWs === "") {
		return { dirNames: [], note: "拿不到 SR 工作区锚点，读不了已有的功能目录 —— 先解决锚点再建。" };
	}
	try {
		const dirNames = await listDirs(port, srWs + "\\features", options.signal, false);
		return { dirNames: dirNames, note: "" };
	} catch (e) {
		let rootOk = false;
		try {
			await port.listDir(srWs, options.signal);
			rootOk = true;
		} catch (e2) {
			rootOk = false;
		}
		if (!rootOk) {
			return {
				dirNames: [],
				note: "读不到 SR 工作区（列不出 " + srWs + "）—— 已有的功能目录核不了，先别建。"
			};
		}
		return { dirNames: [], note: "" };
	}
}
