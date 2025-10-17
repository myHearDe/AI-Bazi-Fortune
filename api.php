<?php
// 八字分析后端：将前端请求转发到 DeepSeek R1 API（流式）并逐步输出
// 使用说明：将 DEEPSEEK_API_KEY 设置为你的密钥。生产环境不要将密钥暴露到前端！

header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Connection: keep-alive');
header('X-Accel-Buffering: no'); // 关闭 Nginx 反向代理缓冲（如适用）

// 尽可能降低缓冲，增强 SSE 实时性
@ini_set('output_buffering', 'off');
@ini_set('zlib.output_compression', '0');
@ini_set('implicit_flush', '1');
ob_implicit_flush(true);
ignore_user_abort(true);

// 引入拆分后的后端模块
require_once __DIR__ . '/backend/config.php';
require_once __DIR__ . '/backend/messages.php';
require_once __DIR__ . '/backend/sse_forward.php';

// 统一从配置模块读取（仍支持环境变量覆盖）
$config = get_config();
$API_KEY = $config['api_key'];
$BASE_URL = $config['base_url'];

// 兼容其他代理服务（例如 alayanew 或阿里云等）。你可以通过设置 BASE_URL 实现。
// $BASE_URL = 'https://deepseek.alayanew.com/v1';

// 读取请求体
$input = file_get_contents('php://input');
$data = json_decode($input, true);
if (!$data) {
  http_response_code(400);
  echo 'data: ' . json_encode(['error' => 'Invalid JSON payload']) . "\n\n";
  exit;
}

$date = $data['date'] ?? '';
$time = $data['time'] ?? '';
$timezone = $data['timezone'] ?? '';
$region = $data['region'] ?? '';
$useTrueSolar = !empty($data['use_true_solar']);
$prompt = $data['prompt'] ?? '';
$incomingMessages = isset($data['messages']) && is_array($data['messages']) ? $data['messages'] : null;
$gender = $data['gender'] ?? '未知';
// 后端整合前端的 messages 逻辑，支持 mode 与 system 消息覆盖
 $mode = $data['mode'] ?? 'general';
 $systemOverride = isset($data['system']) ? (string)$data['system'] : null;

// 解析日期时间为模板字段
$year = $month = $day = '未知';
$hour = $minute = '未知';
if ($date) {
  $parts = explode('-', $date);
  if (count($parts) === 3) { $year = $parts[0]; $month = $parts[1]; $day = $parts[2]; }
}
if ($time) {
  $tparts = explode(':', $time);
  if (count($tparts) >= 2) { $hour = $tparts[0]; $minute = $tparts[1]; }
}
$location = $region ?: '未知';

if (!$API_KEY) {
  http_response_code(500);
  echo 'data: ' . json_encode(['error' => 'Missing DEEPSEEK_API_KEY in environment']) . "\n\n";
  exit;
}

// 构造消息（优先使用前端显式传入的 messages；否则用新的模板生成提示词）
// 统一由后端模块生成消息（支持前端传入 messages 覆盖）
$messages = build_messages($data);

// 设置模型与启用流式，R1 模型支持 reasoning_content 字段输出思考过程
$model = getenv('DEEPSEEK_MODEL');
if (!$model) { $model = 'deepseek-chat'; }

// 根据模型或环境变量设置更高的输出上限，避免因 finish_reason=length 导致中途截断
$maxTokensEnv = getenv('DEEPSEEK_MAX_TOKENS');
$maxTokens = $maxTokensEnv ? min(intval($maxTokensEnv), 65536) : ($model === 'deepseek-reasoner' ? 65536 : 4096);

$payload = [
  'model' => $model,
  'messages' => $messages,
  'stream' => true,
  // reasoning 模型可能使用 reasoning_content；有些平台需要额外开启思考模式参数
  // 'enable_thinking' => true,
  'max_tokens' => $maxTokens,
  // 深度推理模型不支持 temperature/top_p 等采样参数，设置也不会生效，这里移除以减少困惑
];

// 通过后端模块进行流式转发
forward_stream($payload, $BASE_URL, $API_KEY);
?>