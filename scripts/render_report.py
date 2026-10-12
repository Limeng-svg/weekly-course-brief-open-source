#!/usr/bin/env python3
"""Render a verified course brief using only Python's standard library."""
import argparse
import html
import json
import re
from pathlib import Path
from urllib.parse import urlsplit


def esc(value):
    return html.escape(str(value or ''))


def safe_url(value):
    value = str(value or '')
    try:
        parsed = urlsplit(value)
        return value if parsed.scheme in ('https', 'http') and parsed.netloc and not parsed.username and not parsed.password else ''
    except ValueError:
        return ''


def links(items):
    result = []
    for label, url in items:
        url = safe_url(url)
        if url:
            result.append(f'<a href="{esc(url)}" target="_blank" rel="noopener noreferrer">{esc(label)} ↗</a>')
    return '<div class="sources">' + ' '.join(result) + '</div>' if result else ''


def ul(items):
    return '<ul>' + ''.join('<li>' + esc(x) + '</li>' for x in items) + '</ul>' if items else ''


def validate(data):
    if not isinstance(data, dict):
        raise ValueError('Report must be a JSON object.')
    arrays = ('courses', 'thisWeek', 'deadlines', 'needsCheck', 'notices', 'notes')
    for key in arrays:
        if not isinstance(data.get(key, []), list):
            raise ValueError(f'{key} must be an array.')
    if not any(data.get(k) for k in arrays[:-1]):
        raise ValueError('Report has no verified content; do not render a blank dashboard.')
    for key in arrays[:-1]:
        if not all(isinstance(item, dict) for item in data.get(key, [])):
            raise ValueError(f'{key} entries must be objects.')
    for course in data.get('courses', []):
        for key in ('lecture', 'tutorial', 'tasks'):
            if not isinstance(course.get(key, []), list) or not all(isinstance(x, str) for x in course.get(key, [])):
                raise ValueError(f'Course {key} must be an array of strings.')
        for item in course.get('links', []):
            if not isinstance(item, list) or len(item) != 2:
                raise ValueError('Course links must be [label, url] pairs.')
    if not all(isinstance(x, str) for x in data.get('notes', [])):
        raise ValueError('notes must contain strings.')


def render(data):
    p = [f'<header><div class="masthead"><span>COURSE / INTELLIGENCE</span><span>WEEKLY BRIEF</span></div><div class="eyebrow">{esc(data.get("term"))} · {esc(data.get("period"))}</div><h1>{esc(data.get("title", "每周课程看板"))}</h1><p class="meta">资料核查：{esc(data.get("checked"))} · 更新安排：{esc(data.get("schedule"))}</p><p>{esc(data.get("scope"))}</p><div class="platforms"><span>课程与作业周报</span><a href="canvas-university.html">Canvas 大学版 ↗</a></div></header>']
    nav = []
    for key, title in [('weekly', '本周作业'), ('courses', '课程解析'), ('deadlines', '大作业截止'), ('notices', '公告与下周')]:
        if data.get({'weekly': 'thisWeek', 'courses': 'courses', 'deadlines': 'deadlines', 'notices': 'notices'}[key]) or (key == 'deadlines' and data.get('needsCheck')):
            nav.append(f'<a href="#{key}">{title}</a>')
    if nav:
        p.append('<nav aria-label="看板板块">' + ''.join(nav) + '</nav>')
    for key, ident, title, datekey, rowclass in [('thisWeek', 'weekly', '本周作业与提交节点', 'when', 'task'), ('courses', 'courses', '课程 · Lecture 与 Tutorial', '', ''), ('deadlines', 'deadlines', '大作业与项目 · 截止日程', 'date', 'deadline')]:
        items = data.get(key, [])
        if not items and not (key == 'deadlines' and data.get('needsCheck')):
            continue
        p.append(f'<section id="{ident}"><h2>{title}</h2>')
        if key == 'thisWeek':
            p.append(f'<p class="meta">{esc(data.get("period"))} · 具体时区见任务说明 · 提交状态以实际核查为准</p><div class="weekly-list">')
        if key == 'courses':
            p.append('<div class="courses">')
            for c in items:
                p.append(f'<article class="course"><div class="course-head"><div class="code">{esc(c.get("code"))}</div><h3>{esc(c.get("name"))}</h3></div><div class="course-content">')
                for typ, label in [('lecture', 'Lecture'), ('tutorial', 'Tutorial / Lab')]:
                    if c.get(typ):
                        p.append(f'<h4>{label} · {esc(c.get(typ+"Title"))}</h4>')
                        if typ == 'lecture' and c.get('lectureStatus'):
                            p.append(f'<p class="meta">{esc(c["lectureStatus"])}</p>')
                        p.append(ul(c[typ]))
                if c.get('tasks'):
                    p.append('<details><summary>本周行动与作业联系</summary>' + ul(c['tasks']) + '</details>')
                p.append(links(c.get('links', [])) + '</div></article>')
            p.append('</div>')
        else:
            for x in items:
                p.append(f'<article class="{rowclass}"><div class="date">{esc(x.get(datekey))}</div><div><div class="eyebrow">{esc(x.get("course"))} · {esc(x.get("weight"))}</div><h3>{esc(x.get("task"))}</h3><p>{esc(x.get("detail"))}</p>{links([["官方要求 / 来源", x.get("url")]])}</div></article>')
        if key == 'thisWeek':
            p.append('</div>')
        if key == 'deadlines' and data.get('needsCheck'):
            p.append('<h3 class="subsection">仍需核实的提交时间</h3>')
            for x in data['needsCheck']:
                p.append(f'<article class="pending"><h4>{esc(x.get("course"))} · {esc(x.get("task"))}</h4><p>{esc(x.get("detail"))}</p>{links([["当前官方资料", x.get("url")]])}</article>')
        p.append('</section>')
    if data.get('notices'):
        p.append('<section id="notices"><h2>公告与下周关注</h2>')
        for x in data['notices']:
            p.append(f'<article class="notice"><h3>{esc(x.get("title"))}</h3><p>{esc(x.get("detail"))}</p>{links([["公告 / 课表", x.get("url")]])}</article>')
        p.append('</section>')
    if data.get('notes') or data.get('portal'):
        p.append('<footer><h3>核查说明</h3>' + ul(data.get('notes', [])) + links([['正式选课来源', data.get('portal')]]) + '</footer>')
    return '\n'.join(p)


def page(title, css, body, script=''):
    return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(title) + '</title><style>' + css + '</style></head><body><main>' + body + '</main>' + ('<script>' + script + '</script>' if script else '') + '</body></html>'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True, type=Path)
    parser.add_argument('--output-dir', required=True, type=Path)
    parser.add_argument('--name', default='course-weekly-brief')
    args = parser.parse_args()
    if not re.fullmatch(r'[A-Za-z0-9_-]+', args.name):
        parser.error('--name accepts only letters, numbers, underscore and hyphen.')
    try:
        data = json.loads(args.input.read_text(encoding='utf-8'))
        validate(data)
        assets = Path(__file__).resolve().parent.parent / 'assets'
        css = (assets / 'tech-theme.css').read_text(encoding='utf-8')
        board = page(data.get('title', '每周课程看板'), css, render(data))
        canvas_body = (assets / 'canvas-university-body.html').read_text(encoding='utf-8').replace('unsw-week-05.html', args.name+'.html').replace('返回 UNSW 周报', '返回课程周报')
        week_start = data.get('weekStart', '')
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', week_start):
            week_start = ''
        canvas_body = canvas_body.replace('value="2026-10-12"', 'value="'+week_start+'"')
        canvas = page('Canvas 大学课程看板', css, canvas_body, (assets / 'canvas-adapter.js').read_text(encoding='utf-8'))
        args.output_dir.mkdir(parents=True, exist_ok=True)
        (args.output_dir / (args.name+'.html')).write_text(board, encoding='utf-8')
        (args.output_dir / (args.name+'.json')).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
        (args.output_dir / 'canvas-university.html').write_text(canvas, encoding='utf-8')
        print(args.output_dir / (args.name+'.html'))
    except (OSError, ValueError) as error:
        parser.exit(1, f'Report could not be generated: {error}\n')


if __name__ == '__main__':
    main()
