<?php
// 后端配置拆分：统一读取环境变量与默认值
function get_config() {
    $apiKey = getenv('DEEPSEEK_API_KEY');
    if (!$apiKey) {
        // 保留原默认值以兼容现有部署方式
        $apiKey = 'api配置';
    }

    $baseUrl = getenv('DEEPSEEK_BASE_URL');
    if (!$baseUrl) {
        $baseUrl = 'https://api.deepseek.com/v1';
    }

    $model = getenv('DEEPSEEK_MODEL');
    if (!$model) {
        $model = 'deepseek-chat';
    }

    // 按模型限制最大 tokens，并允许通过环境变量覆盖（受上限约束）
    $maxTokensEnv = getenv('DEEPSEEK_MAX_TOKENS');
    $defaultMax = ($model === 'deepseek-reasoner') ? 65536 : 4096;
    $maxTokens = $maxTokensEnv ? min(intval($maxTokensEnv), 65536) : $defaultMax;

    return [
        'api_key' => $apiKey,
        'base_url' => $baseUrl,
        'model' => $model,
        'max_tokens' => $maxTokens,
    ];
}
?>