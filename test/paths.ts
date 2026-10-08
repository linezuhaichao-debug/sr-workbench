/**
 * 测试用的真实数据坐标 —— **不录制 fixture**。
 *
 * 口径（spec「Testing Decisions」）：加载器与纯函数层都对着**真实工作区**跑，
 * 因为"真实定稿里有 4 处 fenced code 会崩"这类问题，录制件会把它录成"正常"。
 *
 * 换机器时用环境变量 `SR_WB_WORKSPACE` / `SR_WB_SR_CONFIG` 覆盖即可。
 */

import fs from "node:fs";
import path from "node:path";

import { createFsPort, type FsPort } from "../src/port/fs.ts";

export const WORKSPACE = process.env.SR_WB_WORKSPACE || "D:\\TimeMachine\\GameDesignOS\\workspace";
/**
 * ★ 2026-10-08 身份迁移（`identity-rename-merge-report.md`）：目录名从 `联盟悬赏` 改成 **`讨伐`**
 *   （`feature_id=feat-20261008-001`，name 联盟讨伐，aliases 保留旧名）。
 *   **文档文件名没变**（正文改名要走 `/sr-gdd-fix`，不在那次范围里）—— 所以只改目录这一段。
 */
export const FEATURE_TOPIC = process.env.SR_WB_FEATURE || "讨伐";
/** `features\` 根（设计 §3.2：**目录即功能**）——看板的功能数就是它下面有几个目录 */
export const FEATURES_ROOT = path.join(WORKSPACE, "features");
export const FEATURE_ROOT = path.join(WORKSPACE, "features", FEATURE_TOPIC);
/** 策划配置目录（配置表）。看板的 `counts.configs` 与文档生成面的配置支线都读它 */
export const PLANNER_CONFIG_DIR = process.env.SR_WB_PLANNER_CONFIG || "D:\\TimeMachine\\planner\\策划配置";
/** 当前有效定稿（功能身份 + 日期判定；实测 488 行 / doc_type: final_gdd / status: active） */
export const FINAL_GDD = path.join(FEATURE_ROOT, "gdd", "联盟悬赏_20260923_定稿.md");
/** 上一份定稿：仍标 active —— 这是真实存在的 V1 缺陷，用例把它断言下来 */
export const PREV_FINAL_GDD = path.join(FEATURE_ROOT, "gdd", "联盟悬赏_20260921_定稿.md");
export const SR_CONFIG = process.env.SR_WB_SR_CONFIG || "D:\\TimeMachine\\.agents\\skills\\sr-askme\\config.local.json";
export const SKILLS_ROOT = "D:\\TimeMachine\\.agents\\skills";
export const WORKSPACE_ROOT_FOR_SESSION = "D:\\TimeMachine";

/** 读一个真实文件（读不到就让用例红，不静默跳过） */
export function readText(p: string): string {
	return fs.readFileSync(p, "utf8");
}

/** 文件侧直读 node:fs 的端口替身；指令侧是记录器。roots = 替身的工作区（列举限定在其中）。 */
export function testPort(options: { roots?: string[] } = {}): FsPort {
	return createFsPort({ roots: options.roots || [WORKSPACE_ROOT_FOR_SESSION] });
}

/** 断言真实数据在位 —— 数据不在就直接红，避免"全绿但什么都没测" */
export function requireRealData(): void {
	const missing = [FINAL_GDD, SR_CONFIG].filter((p) => !fs.existsSync(p));
	if (missing.length) throw new Error("真实数据不在位（本套件刻意不录制 fixture）：" + missing.join(" / "));
}
