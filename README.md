【ai八字算命PHP网站源码演示-通过对接DEEPSEEK api实现流式输出】 
https://www.bilibili.com/video/BV1nnWezgEsn/?share_source=copy_web&vd_source=dd99361baf92e05ccc328d50a74d61e5

# AI 玄学（八字分析）

一个前后端一体的示例应用，用于将出生信息转发到后端，再由后端以 SSE 流式调用推理服务，返回“常规分析”或“大运分析”等结构化结果。项目强调：提示词由后端统一构造，支持前端覆盖；已移除前/后端的续写拼接逻辑，确保一次性调用、一次性输出。

## 目录结构

```
d:\测试\ai玄学
├── index.html                # 页面与表单（引用外部 CSS/JS）
├── assets/
│   ├── styles.css            # 抽离的样式
│   └── main.js               # 抽离的脚本（事件绑定、流式渲染）
├── api.php                   # 后端入口（SSE，调用推理服务）
└── backend/
    ├── config.php            # 配置集中管理（环境变量与默认值）
    ├── messages.php          # 消息模板统一构造（保留原文提示词）
    └── sse_forward.php       # SSE 流式转发封装
```

## 功能说明

- 前端表单
  - 字段：`出生日期`、`时辰`（24 小时制）、`时区`、`地区`、`性别`、`使用真太阳时（校正）`。
  - 操作：`开始分析`、`复制结果`、`重置输入`；前端通过 `fetch('api.php')` 发起请求并以 SSE 流式显示。

- 分析模式
  - 支持两种分析类型：`常规分析`（general）与 `大运分析`（dayun）。
  - 前端可按需求触发其中一种或分别触发两路分析；后端依据 `mode` 选择提示词模板。

- 流式显示（SSE）
  - 后端以事件流形式返回：逐条输出 `data: {json}`，并以 `data: [DONE]` 结束。
  - 前端逐块渲染，体验类似“实时输出”。

- 续写逻辑
  - 已移除前端“被截断后续写”的循环与 `prev_assistant` 参数传递；后端也去除相应入口与提示拼接。
  - 现在每次分析只调用一次推理接口，输出不再进行拼接续写。

- 提示词管理（关键）
  - 后端统一构造消息：`backend/messages.php`。
  - 若前端显式传入 `messages`，后端优先使用前端内容，不改写；否则按 `mode` 使用后端模板。
  - 模板内容已恢复并严格保持为拆分前 `api.php` 的原文，确保输出风格与功能不变。

## 后端实现概览

- `backend/config.php`
  - 统一读取配置：`DEEPSEEK_API_KEY`、`DEEPSEEK_BASE_URL`、`DEEPSEEK_MODEL`、`DEEPSEEK_MAX_TOKENS`。
  - 提供合理默认值与最大 token 上限约束（不同模型使用不同上限）。

- `backend/messages.php`
  - 若请求体包含 `messages`，直接使用（优先级最高）；否则根据 `mode` 构造：
    - 常规分析模板：包含九个小节（排盘与日主、五行用神、性格、学业与事业、财运、感情与婚姻、健康、流年、总结与行动建议），要求“二级标题##、分点列举、必要处可用表格”。
    - 大运分析模板：四条“分析要点”（起止与换运节点、每步大运的倾向与风险、关键年份、综合建议与注意事项），末尾提示“必要处可用表格（| 分隔）”。

- `backend/sse_forward.php`
  - 发起 `POST` 调用推理服务的 `/chat/completions` 并处理分块响应。
  - 解析为标准 SSE 事件：透传 `data:` 行、处理 `[DONE]`、兼容不带前缀的纯 JSON 行。

- `api.php`
  - 设置 SSE 头（含 `X-Accel-Buffering: no`），降低缓冲、启用实时输出。
  - 引入配置、消息构造与流式转发模块，构造 `payload` 后调用 `forward_stream(...)`。
  - 消除旧的“续写拼接”逻辑；仅一次性转发完整流式响应。

## 请求参数

- 通用字段（JSON 请求体）：
  - `date`：公历日期，格式如 `YYYY-MM-DD`。
  - `time`：24 小时时辰，格式如 `HH:MM`。
  - `timezone`：时区字符串，例如 `中国标准时间 (UTC+8)` 或 `UTC+8`。
  - `region`：地区或经纬度字符串，例如 `北京市` 或 `39.9042,116.4074`。
  - `gender`：`男` / `女` / 其他字符串。
  - `use_true_solar`：布尔，是否使用真太阳时校正。
  - `mode`：`general` 或 `dayun`（分析类型）。
  - `system`：可选，覆盖后端系统消息。
  - `messages`：可选，直接传入完整的消息数组以覆盖后端构造。
  - `model`：可选，覆盖默认模型。
  - `max_tokens`：可选，覆盖最大 token（受上限约束）。

## 请求示例

### curl（SSE）

```bash
curl -N -H "Content-Type: application/json" \
     -H "Accept: text/event-stream" \
     -d '{
       "date": "1990-01-01",
       "time": "08:30",
       "timezone": "UTC+8",
       "region": "北京市",
       "gender": "男",
       "use_true_solar": false,
       "mode": "general"
     }' \
     http://localhost:8000/api.php
```

### 前端（示意）

```js
fetch('api.php', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ date, time, timezone, region, gender, use_true_solar, mode: 'dayun' })
});
```

## 运行与部署

- 本地开发（完整联调）
  - 安装并启用 PHP（支持 7.4+）。
  - 在项目根目录运行：`php -S localhost:8000`。
  - 打开浏览器：`http://localhost:8000/`。

- 仅静态预览（不调用后端）
  - 可用 `python -m http.server 8000` 启动静态服务器预览前端，但无法访问 `api.php`。

- 环境变量（建议在生产环境设置）
  - `DEEPSEEK_API_KEY`：推理服务密钥（必需）。
  - `DEEPSEEK_BASE_URL`：服务基地址，默认 `https://api.deepseek.com/v1`。
  - `DEEPSEEK_MODEL`：模型名，默认 `deepseek-chat`。
  - `DEEPSEEK_MAX_TOKENS`：最大 tokens，上限受模型限制（例如 `deepseek-reasoner` 更高）。

- 反向代理注意事项
  - 若使用 Nginx 等，请关闭缓冲：设置 `X-Accel-Buffering: no`；确保后端使用 HTTP/1.1 以避免 SSE 被缓冲。

## 修改提示词的正确位置

- 仅在 `backend/messages.php` 修改提示词；若前端希望完全控制消息，请向后端传入 `messages` 字段。
- 已恢复并锁定拆分前 `api.php` 的提示词原文，避免非必要改动影响输出风格或功能。

## 变更说明（重要）

- 已移除“续写”相关逻辑（前端 `prev_assistant` 与后端续写提示拼接），确保每次分析只调用一次接口。
- 将配置、消息构造与流式转发分别拆分到独立文件，提升可维护性与复用性。

## 免责声明

- 本项目为示例用途，默认值与回退设置仅用于开发环境；生产环境请务必使用真实密钥并妥善配置代理与安全策略。