'use strict';

const form = document.getElementById('bazi-form');
const submitBtn = document.getElementById('submitBtn');
const copyBtn = document.getElementById('copyBtn');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const analysisEl = document.getElementById('analysis');
const dayunEl = document.getElementById('dayun');
const thinkingEl = document.getElementById('thinking');
const resetBtn = document.getElementById('resetBtn');
const regionInput = document.getElementById('region');
const regionError = document.getElementById('regionError');
const regionHint = document.getElementById('regionHint');
let analysisRaw = '';
let dayunRaw = '';
let thinkingRaw = '';

// 初始禁用复制按钮，待有结果后启用
copyBtn.disabled = true;
// Tabs 切换逻辑（修复“大运分析”标签点击无效问题）
const thinkingTab = document.querySelector('.tab[data-tab="thinking"]');
document.querySelectorAll('.tab').forEach(t => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    const tab = t.dataset.tab;
    document.getElementById('analysisPanel').style.display = tab === 'analysis' ? 'block' : 'none';
    document.getElementById('dayunPanel').style.display = tab === 'dayun' ? 'block' : 'none';
    document.getElementById('thinkingPanel').style.display = tab === 'thinking' ? 'block' : 'none';
  });
});
function escapeHtml(str){
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function renderMarkdown(md){
  if(!md) return '';
  let text = md.replace(/\r\n/g,'\n');
  // 代码块 ```
  text = text.replace(/```([\s\S]*?)```/g, (m, p1)=>`<pre><code>${escapeHtml(p1)}</code></pre>`);
  // 标题
  text = text.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  text = text.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  text = text.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
  // 水平分割线
  text = text.replace(/^\s*-{3,}\s*$/gm, '<hr/>');
  // 链接 [text](url)
  text = text.replace(/\[([^\]]+)\]\((https?:[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  // 加粗与斜体
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  
  // 逐行处理：支持无序/有序列表、引用、表格
  const lines = text.split('\n');
  let html = '';
  let inUl = false, inOl = false, inTable = false, tableRows = [], inBlockquote = false;
  
  function closeLists(){
    if(inUl){ html += '</ul>'; inUl=false; }
    if(inOl){ html += '</ol>'; inOl=false; }
  }
  function flushTable(){
    if(!inTable) return;
    if(tableRows.length){
      html += '<table>';
      const header = tableRows[0];
      html += '<tr>' + header.map(h=>`<th>${h}</th>`).join('') + '</tr>';
      for(let i=1;i<tableRows.length;i++){
        const row = tableRows[i];
        html += '<tr>' + row.map(c=>`<td>${c}</td>`).join('') + '</tr>';
      }
      html += '</table>';
    }
    inTable=false; tableRows=[];
  }
  function closeBlockquote(){
    if(inBlockquote){ html += '</blockquote>'; inBlockquote=false; }
  }
  
  for (let i=0;i<lines.length;i++){
    const line = lines[i];
    // 表格行：以 | 开头并以 | 结尾
    const mTable = /^\|(.+)\|\s*$/.exec(line);
    if(mTable){
      closeLists(); closeBlockquote();
      inTable = true;
      const cells = mTable[1].split('|').map(s=>s.trim());
      tableRows.push(cells);
      continue;
    } else if(inTable && !/^\|(.+)\|\s*$/.test(line)){
      flushTable();
    }
  
    // 引用块 >
    const mQuote = /^>\s*(.+)$/.exec(line);
    if(mQuote){
      closeLists();
      if(!inBlockquote){ html += '<blockquote>'; inBlockquote=true; }
      html += mQuote[1] + '\n';
      continue;
    } else {
      closeBlockquote();
    }
  
    // 有序列表 1. 2. ...
    const mOl = /^\s*\d+\.\s+(.+)/.exec(line);
    if(mOl){
      if(!inOl){ closeLists(); html += '<ol>'; inOl = true; }
      html += `<li>${mOl[1]}</li>`;
      continue;
    } else if(inOl && !/^\s*\d+\.\s+/.test(line)){
      html += '</ol>'; inOl=false;
    }
  
    // 无序列表 - 或 *
    const mUl = /^\s*[-\*]\s+(.+)/.exec(line);
    if(mUl){
      if(!inUl){ closeLists(); html += '<ul>'; inUl = true; }
      html += `<li>${mUl[1]}</li>`;
      continue;
    } else if(inUl && !/^\s*[-\*]\s+/.test(line)){
      html += '</ul>'; inUl=false;
    }
  
    // 其他：空行转 <br/>
    if (/^\s*$/.test(line)) { html += '<br/>'; }
    else { html += line + '\n'; }
  }
  closeLists(); flushTable(); closeBlockquote();
  return html;
}

function setBusy(busy) {
  submitBtn.disabled = busy;
  copyBtn.disabled = busy || (analysisRaw.trim() === '' && dayunRaw.trim() === '');
  resetBtn.disabled = busy;
  statusDot.classList.toggle('live', busy);
  statusText.textContent = busy ? '正在深度分析（流式输出）' : '待机';
}

// 已移除：buildGeneralPrompt 与 buildDayunPrompt，提示词统一由后端构建

async function streamTo(payload, onContent, onReasoning) {
  const res = await fetch('api.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let finishReason = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    buffer += chunk;
    const parts = buffer.split('\n\n');
    buffer = parts.pop();
    for (const part of parts) {
      const lines = part.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payloadStr = trimmed.slice(5).trim();
        if (payloadStr === '[DONE]') {
          return finishReason;
        }
        try {
          const json = JSON.parse(payloadStr);
          const obj = json.object;
          if (obj !== 'chat.completion' && obj !== 'chat.completion.chunk') continue;
          const choice = (json.choices && json.choices[0]) || {};
          const delta = choice.delta || {};
          const msg = choice.message || {};
          const fr = choice.finish_reason || delta.finish_reason || null;
          if (fr) finishReason = fr;
          const rcDelta = typeof delta.reasoning_content === 'string' ? delta.reasoning_content : '';
          const rcMsg = typeof msg.reasoning_content === 'string' ? msg.reasoning_content : '';
          if (rcDelta || rcMsg) onReasoning?.(rcDelta + rcMsg);
          const cDelta = typeof delta.content === 'string' ? delta.content : '';
          const cMsg = typeof msg.content === 'string' ? msg.content : '';
          if (cDelta || cMsg) onContent?.(cDelta + cMsg);
        } catch(_){}
      }
    }
  }
  return finishReason;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (submitBtn.disabled) return; // 防止重复提交
  // 校验地区经纬度格式（若包含逗号则必须为合法经纬度）
  const regionVal = regionInput.value.trim();
  regionError.style.display = 'none';
  regionInput.classList.remove('error');
  if (regionVal && regionVal.includes(',')) {
    const parts = regionVal.split(',').map(s=>s.trim());
    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);
    const valid = parts.length === 2 && isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
    if (!valid) {
      regionError.textContent = '经纬度格式不正确，请输入 “纬度,经度”，例如 39.9042,116.4074';
      regionError.style.display = 'block';
      regionInput.classList.add('error');
      regionInput.focus();
      return;
    }
  }

  analysisRaw = '';
  dayunRaw = '';
  thinkingRaw = '';
  analysisEl.innerHTML = '';
  dayunEl.innerHTML = '';
  thinkingEl.innerHTML = '';
  setBusy(true);

  const date = document.getElementById('date').value;
  const time = document.getElementById('time').value;
  const tz = document.getElementById('timezone').value;
  const region = document.getElementById('region').value.trim();
  const gender = document.getElementById('gender').value;
  const useTrueSolar = document.getElementById('trueSolar').checked;

  const systemMsg = '你是一位专业的命理师，精通四柱八字、十神、五行与格局分析。请在输出中保持严谨、结构清晰，并明确不确定性。';

  try {
    // 并行调用两次 API：常规分析与大运分析
    const [finishGeneral, finishDayun] = await Promise.all([
      streamTo({ mode: 'general', date, time, timezone: tz, region, gender, use_true_solar: useTrueSolar, system: systemMsg },
        (chunk) => { analysisRaw += chunk; analysisEl.innerHTML = renderMarkdown(analysisRaw); copyBtn.disabled = submitBtn.disabled || (analysisRaw.trim() === '' && dayunRaw.trim() === ''); },
        (rc) => { thinkingTab.style.display = ''; thinkingRaw += rc; thinkingEl.innerHTML = renderMarkdown(thinkingRaw); }
      ),
      streamTo({ mode: 'dayun', date, time, timezone: tz, region, gender, use_true_solar: useTrueSolar, system: systemMsg },
        (chunk) => { dayunRaw += chunk; dayunEl.innerHTML = renderMarkdown(dayunRaw); copyBtn.disabled = submitBtn.disabled || (analysisRaw.trim() === '' && dayunRaw.trim() === ''); },
        (rc) => { thinkingTab.style.display = ''; thinkingRaw += rc; thinkingEl.innerHTML = renderMarkdown(thinkingRaw); }
      )
    ]);
    
    // 移除续写：只调用一次，不再根据 finish_reason 做二次或多次调用
    // 已删除 general/dayun 的 while 续写块与 prev_assistant 使用

  } catch (err) {
    analysisRaw = `发生错误：${err.message}`;
    analysisEl.innerHTML = renderMarkdown(analysisRaw);
  } finally {
    setBusy(false);
  }
});

copyBtn.addEventListener('click', async () => {
  const text = `【常规分析】\n${analysisRaw}\n\n【大运分析】\n${dayunRaw}\n\n【思考过程】\n${thinkingRaw}`.trim();
  try {
    await navigator.clipboard.writeText(text);
    statusText.textContent = '已复制到剪贴板';
    setTimeout(() => statusText.textContent = submitBtn.disabled ? '正在深度分析（流式输出）' : '待机', 1500);
  } catch {
    statusText.textContent = '复制失败，请手动选择文本';
  }
});

resetBtn.addEventListener('click', () => {
  form.reset();
  analysisRaw = '';
  dayunRaw = '';
  thinkingRaw = '';
  analysisEl.innerHTML = '';
  dayunEl.innerHTML = '';
  thinkingEl.innerHTML = '';
  copyBtn.disabled = true;
  // 清除地区错误提示与示例
  regionError.textContent = '';
  regionError.style.display = 'none';
  regionInput.classList.remove('error');
  regionHint.style.display = 'none';
  // 恢复思考过程标签隐藏
  thinkingTab.style.display = 'none';
  // 恢复状态
  submitBtn.disabled = false;
  resetBtn.disabled = false;
  statusDot.classList.remove('live');
  statusText.textContent = '待机';
  // 切回常规分析面板
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  document.querySelector('.tab[data-tab="analysis"]').classList.add('active');
  document.getElementById('analysisPanel').style.display = 'block';
  document.getElementById('dayunPanel').style.display = 'none';
  document.getElementById('thinkingPanel').style.display = 'none';
});