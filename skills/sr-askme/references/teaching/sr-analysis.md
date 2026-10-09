# sr-analysis 使用卡：分析素材 / 拆解竞品

**职责**：从游戏素材（截图、录屏、PV、商店页、视频链接）出证据链诊断，你判定可参考后拆成可复刻的规格，交 `sr-gdd-human` 出成稿。

**什么时候用**："分析这段录屏"、"拆一下这个竞品玩法"、"这个功能能不能复刻"。

**怎么用**：

```
/sr-analysis D:\recordings\新手期首战.mp4
```

**产出**（本功能目录 `<功能目录>\` 下）：证据包落 `evidence\`；`analysis\` 下 experience-report（体验报告）、issue-cards（问题卡）、replication-spec（复刻规格）、sr-gdd-handoff（交接 JSON）；每次拍板追加一条 `decisions\决策记录.md`。
