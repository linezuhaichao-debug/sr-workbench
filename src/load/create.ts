/**
 * 新建功能的**只读两侧**（加载层，只吃 `WorkspacePort`）：
 *
 *   ① `loadCreateFacts` —— 建之前要读的事实：`features\` 下已有哪些目录、每个目录的身份声明
 *      （用于"这个名字是不是别人的身份/别名"与"下一个 `feature_id` 取几号"）。
 *      ★ 面板自身的工作区表由组合根从 store 里给（`wsPaths`），这里不读 store。
 *   ② `readBackCreated` —— 建之后的**窄回读**：列一下功能根 + 读一下 `feature.json`（两次调用）。
 *      判定在纯函数 `createfeature.verifyCreated` 里，这里只负责把两样东西取回来。
 *
 * ★ 这里**一个字节都不写**（端口只有读法 + 指令侧五法；本票不用指令侧）。
 * ★ 列举/读取失败一律降级成"读不到"，由纯函数如实说出来 —— 不抛给界面、更不编缺件。
 */

import { type CreatedReadBack, verifyCreated, type CreatedVerdict } from "../pure/createfeature.ts";
import { identityOf, type IdentityHolder } from "../pure/featureid.ts";
import type { WorkspacePort } from "../port/types.ts";
import { listDirs, readIdentityText } from "./read.ts";

export interface CreateFacts {
	/** `features\` 下已存在的目录名（不过滤噪音 —— 目录存在就不能往里建东西） */
	dirNames: string[];
	/** 每个功能目录的身份视图（没有 `feature.json` 的按目录名认，`present:false`） */
	features: IdentityHolder[];
	/** 读不到目录列表时的如实说明（空 = 列到了） */
	note: string;
}

export interface CreateFactsOptions {
	srWs: string;
	signal?: AbortSignal;
}

/**
 * 建之前的事实（**只读**）。
 * ★ `features\` 列不到（工作区还没建 / 越界）时返回空清单 + note ——
 *   界面据此如实说"读不到已有的功能目录"，**不假装没有冲突**。
 */
export async function loadCreateFacts(port: WorkspacePort, options: CreateFactsOptions): Promise<CreateFacts> {
	const srWs = String(options.srWs || "").replace(/[\\/]+$/, "");
	if (srWs === "") return { dirNames: [], features: [], note: "拿不到 sr 工作区锚点，读不了已有的功能目录。" };
	let dirNames: string[] = [];
	try {
		dirNames = await listDirs(port, srWs + "/features", options.signal, false);
	} catch (e) {
		// ★ 要分清两种情况：**全新工作区（还没有 features\）** 与 **列不出来（越界/通道坏）**。
		//   判据：工作区根列得出来 ⇒ 只是还没有功能目录（可以建第一个）；
		//   根也列不出来 ⇒ 核不了冲突，**如实说、让界面别建**（宁可让人先解决"读不到"）。
		let rootOk = false;
		try {
			await port.listDir(srWs, options.signal);
			rootOk = true;
		} catch (e2) {
			rootOk = false;
		}
		if (!rootOk) {
			return { dirNames: [], features: [], note: "读不到 sr 工作区（列不出 " + srWs + "）—— 已有的功能目录核不了，先别建。" };
		}
		return { dirNames: [], features: [], note: "" };
	}
	const features: IdentityHolder[] = [];
	for (const t of dirNames) {
		const root = srWs + "/features/" + t;
		features.push({ topic: t, root: root, identity: identityOf(await readIdentityText(port, root, options.signal), t) });
	}
	return { dirNames: dirNames, features: features, note: "" };
}

/**
 * 建之后的窄回读：`{ entries, identityText }`（两次调用）。
 * 判定交给 `verifyCreated`（纯函数，**同一份判定在测试与面板里跑的是同一段**）。
 */
export async function readBackCreated(port: WorkspacePort, root: string, expectId: string, signal?: AbortSignal): Promise<CreatedVerdict> {
	const rb: CreatedReadBack = { entries: null, identityText: null, expectId: expectId };
	try {
		const l = await port.listDir(String(root).replace(/[\\/]+$/, ""), signal);
		rb.entries = (l && l.entries ? l.entries : []).map((e) => e.name);
	} catch (e) {
		rb.entries = null;     // 目录还不存在（这就是"还没建"的正常形状）
	}
	rb.identityText = await readIdentityText(port, root, signal);
	return verifyCreated(rb);
}
