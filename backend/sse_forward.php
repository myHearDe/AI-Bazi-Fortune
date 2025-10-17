<?php
// 流式转发拆分：封装与 DeepSeek 的 SSE 转发逻辑
function forward_stream(array $payload, string $baseUrl, string $apiKey): void {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, rtrim($baseUrl, '/') . '/chat/completions');
    curl_setopt($ch, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_1_1);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Accept: text/event-stream',
        'Authorization: Bearer ' . $apiKey,
    ]);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload, JSON_UNESCAPED_UNICODE));

    // 处理 SSE 的分块数据，并按 data: 逐条透传
    $sseBuffer = '';
    curl_setopt($ch, CURLOPT_WRITEFUNCTION, function ($ch, $chunk) use (&$sseBuffer) {
        $sseBuffer .= $chunk;
        while (true) {
            $posLF = strpos($sseBuffer, "\n\n");
            $posCRLF = strpos($sseBuffer, "\r\n\r\n");
            if ($posLF === false && $posCRLF === false) break;
            $useCRLF = false;
            if ($posLF !== false && $posCRLF !== false) {
                $pos = ($posLF < $posCRLF) ? $posLF : $posCRLF;
                $useCRLF = ($posCRLF !== false && $posCRLF <= $posLF);
            } else if ($posLF !== false) {
                $pos = $posLF;
            } else {
                $pos = $posCRLF;
                $useCRLF = true;
            }
            $boundaryLen = $useCRLF ? 4 : 2;
            $event = substr($sseBuffer, 0, $pos);
            $sseBuffer = substr($sseBuffer, $pos + $boundaryLen);
            $lines = preg_split("/\r?\n/", $event);
            foreach ($lines as $line) {
                $line = trim($line);
                if ($line === '') continue;
                if (stripos($line, 'data:') === 0) {
                    echo $line . "\n\n"; @ob_flush(); @flush();
                    continue;
                }
                if (isset($line[0]) && $line[0] === '{') {
                    echo 'data: ' . $line . "\n\n"; @ob_flush(); @flush();
                    continue;
                }
                if ($line === '[DONE]') {
                    echo "data: [DONE]\n\n"; @ob_flush(); @flush();
                    continue;
                }
            }
        }
        return strlen($chunk);
    });
    curl_setopt($ch, CURLOPT_HEADERFUNCTION, function ($ch, $header) { return strlen($header); });
    curl_setopt($ch, CURLOPT_BUFFERSIZE, 1024);
    curl_setopt($ch, CURLOPT_TIMEOUT, 0);
    curl_setopt($ch, CURLOPT_TCP_KEEPALIVE, 1);

    $exec = curl_exec($ch);
    if ($exec === false) {
        $err = curl_error($ch);
        echo 'data: ' . json_encode(['error' => $err], JSON_UNESCAPED_UNICODE) . "\n\n";
    }

    if (!empty($sseBuffer)) {
        $remaining = $sseBuffer;
        $lines = preg_split("/\r?\n/", $remaining);
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '') continue;
            if (stripos($line, 'data:') === 0) { echo $line . "\n\n"; @ob_flush(); @flush(); continue; }
            if (isset($line[0]) && $line[0] === '{') { echo 'data: ' . $line . "\n\n"; @ob_flush(); @flush(); continue; }
        }
    }

    curl_close($ch);
    echo "data: [DONE]\n\n"; @ob_flush(); @flush();
}
?>