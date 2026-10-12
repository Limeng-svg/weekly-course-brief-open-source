# 每周课程与作业周报

`weekly-course-brief` 是一个 Codex skill，用于核查大学课程的 Lecture、Tutorial/Lab、作业与项目截止时间，并生成中文黑色科技风看板。

支持 Moodle、WebCMS3 和 Canvas LMS 的资料核查流程。附带 Canvas 日历（`.ics`）与已整理课程周报（`.json`）的本地导入页面。

## 安装

把整个仓库作为一个 skill 文件夹放入个人 skills 目录。例如：

```bash
git clone https://github.com/Limeng-svg/weekly-course-brief-open-source.git ~/.codex/skills/weekly-course-brief
```

目标目录已存在时，先备份或更新已有副本。不同 Codex 客户端也可使用它支持的个人 skills 目录。

在 Codex 中调用：

```text
使用 $weekly-course-brief 更新本周课程总结和作业截止时间。
```

## 看板内容

- 每门课的 Lecture 关键知识与 Tutorial/Lab 练习。
- 本周作业、项目节点、现场展示与个人互评。
- 全部大作业的准确日期、时分、时区、权重和官方来源。
- 最新公告、下周事项、日期冲突和缺失资料。

固定纯黑背景、深色面板、青蓝色重点、等宽辅助标签，并支持手机单列布局。

## 配置与资源

- `SKILL.md`：资料核查与交付流程。
- `references/student-profile.json`：学校、学期、课程入口、时区及更新偏好。仓库提供空白模板，首次运行填写自己的本机配置，每次运行仍须重新核实正式选课。
- `references/lms-sources.md`：各平台资料入口和截止时间差异。
- `references/report-format.md`：周报 JSON 字段与生成方法。
- `scripts/render_report.py`：使用 Python 3 标准库生成看板，无第三方运行依赖。
- `assets/`：科技风样式与 Canvas LMS 本地导入器。

生成已核实资料的看板：

```bash
python3 scripts/render_report.py \
  --input /path/to/verified-report.json \
  --output-dir /path/to/outputs \
  --name course-week-05
```

输出 HTML、JSON 快照和 `canvas-university.html`。日历导入不包含讲义全文；课程内容复盘仍需读取实际教学材料。

## 每周运行

Skill 保存操作流程，自动任务负责定时调用。安装 skill 本身不会创建自动任务。可在 Codex 中设置每周触发并指定调用 `$weekly-course-brief`。

课程网站访问依赖已有授权和登录状态。本流程只读课程资料，不代写或提交作业、不修改选课、不发送课程论坛消息。

## 许可证

本项目采用 [MIT License](LICENSE)，允许使用、修改和分发；分发时须保留版权声明与许可证。
