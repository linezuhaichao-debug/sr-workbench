/**
 * 测试用的真实数据坐标 —— **不录制 fixture**。
 *
 * 口径：加载器与纯函数层都对着**真实工作区**跑。录制件会把"真实数据的怪形状"一起录成"正常"，
 * 而真实数据恰恰是本工作台唯一要面对的输入。
 *
 * 换机器时用环境变量 `SR_WB_WORKSPACE` / `SR_WB_SR_CONFIG` 覆盖即可。
 * ★ 条数一律**不写死**：与"同一时刻从磁盘按同一口径算出来的真值"比（少列 / 多列才红）。
 */

import fs from "node:fs";
import path from "node:path";

import { createFsPort, type FsPort } from "../src/port/fs.ts";

/** SR 工作区根（`config.local.json` 里的 `sr_workspace`）。 */
export const WORKSPACE = process.env.SR_WB_WORKSPACE || "D:\\TimeMachine\\GameDesignOS\\workspace";
/** `features\` 根（**目录即功能**）——看板的功能数就是它下面有几个目录。 */
export const FEATURES_ROOT = path.join(WORKSPACE, "features");
/** sr 本地配置（锚点与 config_root 都在里面）。 */
export const SR_CONFIG =
	process.env.SR_WB_SR_CONFIG ||
	path.join(process.env.USERPROFILE || "C:\\Users\\<你>", ".dsh", "sr-workbench", "config.local.json");   // ★ 6.0.0：配置落用户目录（原来在 .agents\\skills\\sr-askme\\ 旁）
/** 策划配置目录（配置表）—— `topicOf` 要对着**真实表名**跑。 */
export const PLANNER_CONFIG_DIR = process.env.SR_WB_PLANNER_CONFIG || "D:\\TimeMachine\\planner\\策划配置";
/** 会话能列举的工作区根（替身用它模拟 DSH「列举限定在会话工作区内」）。 */
export const WORKSPACE_ROOT_FOR_SESSION = "D:\\TimeMachine";

/** 一个功能的根目录。 */
export function featureRoot(topic: string): string {
	return path.join(FEATURES_ROOT, topic);
}

/** `features\` 下的目录名（**目录即功能**，不过滤噪音）。 */
export function featureTopics(): string[] {
	try {
		return fs.readdirSync(FEATURES_ROOT, { withFileTypes: true })
			.filter((d) => d.isDirectory())
			.map((d) => d.name)
			.sort();
	} catch (e) {
		return [];
	}
}

/** 一个功能里某个桶的文件名（只列直接子文件；目录跳过）。 */
export function bucketFiles(topic: string, bucket: string): string[] {
	try {
		return fs.readdirSync(path.join(featureRoot(topic), bucket), { withFileTypes: true })
			.filter((d) => d.isFile())
			.map((d) => d.name)
			.sort();
	} catch (e) {
		return [];
	}
}

/** 读一个真实文件（读不到就让用例红，不静默跳过）。 */
export function readText(p: string): string {
	return fs.readFileSync(p, "utf8");
}

/** 文件侧直读 node:fs 的端口替身；指令侧是记录器。roots = 替身的工作区（列举限定在其中）。 */
export function testPort(options: { roots?: string[] } = {}): FsPort {
	return createFsPort({ roots: options.roots || [WORKSPACE_ROOT_FOR_SESSION] });
}

/** 断言真实数据在位 —— 数据不在就直接红，避免"全绿但什么都没测"。 */
export function requireRealData(): void {
	const missing = [FEATURES_ROOT, SR_CONFIG].filter((p) => !fs.existsSync(p));
	if (missing.length) throw new Error("真实数据不在位（本套件刻意不录制 fixture）：" + missing.join(" / "));
}
