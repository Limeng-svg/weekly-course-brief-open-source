# 周报数据与生成

生成器仅用 Python 3 标准库，生成本地文件，不联网、不连接账户、不创建自动任务。

根对象字符串：`title`、`term`、`period`、`weekStart`（YYYY-MM-DD）、`checked`（核查日期）、`schedule`、`scope`（证据范围）。可用 `portal` 记录选课来源。不要把未观看的录像标为已观看。

数组字段：

- `courses`：`code`、`name`、`lectureTitle`、`lectureStatus`、`tutorialTitle`；`lecture`、`tutorial`、`tasks` 为中文字符串数组；`links` 为 `[标签, HTTPS地址]` 数组。
- `thisWeek`：`course`、`task`、`when`、`weight`、`detail`、`url`。when 写准确日期或已核实个人lab时段，缺失时分写清原因。
- `deadlines`：`date`（完整日期、星期、时分）、`course`、`task`、`weight`、`detail`、`url`。按真实截止排序；时区、日期冲突放 detail；缺失精确日期的任务放 needsCheck。
- `needsCheck`：`course`、`task`、`detail`、`url`。
- `notices`：`title`、`detail`、`url`。
- `notes`：核查说明字符串数组，含时区、换算依据、授课证据和缺失项。

无内容可用空数组，生成器省略空板块；整个周报无内容则报错。材料未发布时，可在对应课程写明确的缺失说明与核查日期，不创造课题填充。

```bash
python3 <skill-directory>/scripts/render_report.py --input work/verified-report.json --output-dir outputs --name course-week-05
```

name 仅接受字母、数字、下划线和连字符。输出 `<name>.html`、`<name>.json`、`canvas-university.html`。固定科技风样式和Canvas本地导入器从 assets 读取。

可直接打开 HTML，或用仅监听127.0.0.1的临时服务预览。复用本任务服务，不依赖其他聊天旧端口。导入态仅在浏览器内存在，刷新清空；“保存当前整理结果”导出JSON。

已有自动任务显式读取本 skill，而不是每次重建自动任务。重新核查后生成当周快照，通知链接当前周报。
