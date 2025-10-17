<?php
// 消息模板与构造拆分：严格保留拆分前 api.php 的原始提示词内容
function build_messages(array $data) {
    // 若外部已传入 messages，直接使用（维持原有优先级）
    $incoming = (isset($data['messages']) && is_array($data['messages']) && count($data['messages']) > 0)
        ? $data['messages'] : null;
    if ($incoming) { return $incoming; }

    // 请求参数解析（与原 api.php 一致）
    $date = isset($data['date']) ? (string)$data['date'] : '';
    $time = isset($data['time']) ? (string)$data['time'] : '';
    $timezone = isset($data['timezone']) ? (string)$data['timezone'] : '';
    $region = isset($data['region']) ? (string)$data['region'] : '';
    $gender = isset($data['gender']) ? (string)$data['gender'] : '未知';
    $useTrueSolar = !empty($data['use_true_solar']);

    $mode = isset($data['mode']) ? (string)$data['mode'] : 'general';
    $systemOverride = isset($data['system']) ? (string)$data['system'] : null;
    $systemMsg = $systemOverride ?: '你是一位专业的命理师，精通四柱八字、十神、五行与格局分析。请在输出中保持严谨、结构清晰，并明确不确定性。';

    $location = $region ?: '未知';

    // 以下两段模板为拆分前 api.php 的原文，保持完全一致
    $templatePromptGeneral =
      "你是一名资深的八字命理师，请基于以下信息进行‘常规分析’，输出采用 Markdown，结构清晰：\n" .
      "- 公历：{$date} {$time} ({$timezone})\n" .
      "- 性别：{$gender}\n" .
      "- 地区：{$location}\n" .
      "- 是否使用真太阳时：" . ($useTrueSolar ? '是' : '否') . "\n" .
      "请按以下结构分节输出（二级标题##，分点列举，必要处可用表格）：\n" .
      "1. 八字排盘与日主（含地支藏干、十神概览）\n" .
      "2. 五行/用神分析（用神、忌神、喜忌与依据）\n" .
      "3. 性格特征（结合日主与格局，适度考虑性别差异）\n" .
      "4. 学业与事业（阶段与长期趋势、方向建议）\n" .
      "5. 财运与理财（渠道、风险与建议）\n" .
      "6. 感情与婚姻（择偶建议、婚期参考、相处建议）\n" .
      "7. 健康与作息（体质倾向、易出问题与预防）\n" .
      "8. 流年分析（近3-5年逐年或分阶段的重要与建议）\n" .
      "9. 总结与行动建议（可执行步骤与不确定性来源说明)";

    $templatePromptDayun =
      "你是一名资深的八字命理师，请基于以下信息进行‘大运分析’，只聚焦大运并给出策略，使用 Markdown 输出：\n" .
      "- 公历：{$date} {$time} ({$timezone})\n" .
      "- 性别：{$gender}\n" .
      "- 地区：{$location}\n" .
      "- 是否使用真太阳时：" . ($useTrueSolar ? '是' : '否') . "\n" .
      "分析要点：\n" .
      "1. 当前或即将进入的两步（或三步）大运的起止年份与换运节点（说明起运规则）\n" .
      "2. 每步大运的五行倾向、十神作用与可能的机遇/风险（分面：事业/财运/感情/健康）\n" .
      "3. 关键年份或阶段的提醒与策略\n" .
      "4. 综合建议与注意事项（保持克制并说明不确定性的来源）\n" .
      "如遇信息不足请声明合理假设；必要处可用表格（| 分隔）呈现。";

    $userPrompt = ($mode === 'dayun') ? $templatePromptDayun : $templatePromptGeneral;
    return [
        [ 'role' => 'system', 'content' => $systemMsg ],
        [ 'role' => 'user', 'content' => $userPrompt ]
    ];
}
?>