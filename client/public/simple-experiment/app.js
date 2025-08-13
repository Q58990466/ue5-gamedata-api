(function () {
  const qs = new URLSearchParams(window.location.search);
  const sessionIdParam = (qs.get('sessionId') || '').trim();
  const apiBaseOverride = (qs.get('api') || '').trim();
  const linkToken = (qs.get('token') || '').trim();

  // 默认将 API_BASE 指向同源，可通过 ?api= 覆盖
  const DEFAULT_API_BASE = window.location.origin;
  const API_BASE = apiBaseOverride || DEFAULT_API_BASE;

  // 5-10s 超时建议，这里取 8s
  const REQUEST_TIMEOUT_MS = 8000;

  // 需求：接口不可用时使用示例数据
  const FALLBACK_SAMPLE = {
    success: true,
    data: {
      _id: '685df5cc14155de914b91550',
      sessionId: 'D615030F4886915F8327D59DD37C30FE',
      userId: '136cf93a47d49c15fdd34ebdd9fc162c',
      sessionName: 'Complete Session',
      smilePercentage: 70.21138,
      neutralPercentage: 1.07317,
      surprisedPercentage: 28.71545,
      totalExpressionCount: 3075,
      chatMessages: [
        { speaker: '李老师', message: '你这边啥情况？ 小孩子磕着了。', timestamp: '2025.06.27-09.37.14' }
      ],
      createdAt: '2025-06-27T01:37:16.335Z',
      metadata: { dataType: 'completeSession' },
      source: 'UE5',
      serverInfo: { environment: 'production' }
    }
  };

  const dom = {
    banner: document.getElementById('top-banner'),
    subtitle: document.getElementById('subtitle'),
    sessionId: document.getElementById('sessionId'),
    userId: document.getElementById('userId'),
    sessionName: document.getElementById('sessionName'),
    timeInfo: document.getElementById('timeInfo'),
    sourceInfo: document.getElementById('sourceInfo'),
    smileBar: document.getElementById('smileBar'),
    neutralBar: document.getElementById('neutralBar'),
    surprisedBar: document.getElementById('surprisedBar'),
    smileValue: document.getElementById('smileValue'),
    neutralValue: document.getElementById('neutralValue'),
    surprisedValue: document.getElementById('surprisedValue'),
    totalExpressionCount: document.getElementById('totalExpressionCount'),
    chatList: document.getElementById('chatList')
  };

  function showBanner(message) {
    dom.banner.textContent = message;
    dom.banner.classList.remove('hidden');
  }

  function hideBanner() {
    dom.banner.classList.add('hidden');
    dom.banner.textContent = '';
  }

  function pickFirstDefined(...values) {
    for (const v of values) {
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    return undefined;
  }

  function normalizeExperimentData(raw) {
    const d = raw || {};
    // 兼容大小写/历史字段
    const normalized = {
      _id: d._id || d.id,
      sessionId: pickFirstDefined(d.sessionId, d.SessionId),
      userId: pickFirstDefined(d.userId, d.UserId),
      sessionName: d.sessionName,
      smilePercentage: pickFirstDefined(d.smilePercentage, d.SmilePercentage),
      neutralPercentage: pickFirstDefined(d.neutralPercentage, d.NeutralPercentage),
      surprisedPercentage: pickFirstDefined(d.surprisedPercentage, d.SurprisedPercentage),
      totalExpressionCount: pickFirstDefined(d.totalExpressionCount, d.TotalExpressionCount),
      chatMessages: Array.isArray(d.chatMessages) ? d.chatMessages : [],
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      startTime: d.startTime,
      endTime: d.endTime,
      metadata: d.metadata,
      source: d.source,
      serverInfo: d.serverInfo
    };
    return normalized;
  }

  function fmtPercent(n) {
    if (typeof n !== 'number' || Number.isNaN(n)) return '-';
    return `${n.toFixed(2)}%`;
  }

  function clamp01(n) {
    if (typeof n !== 'number' || Number.isNaN(n)) return 0;
    return Math.max(0, Math.min(100, n));
  }

  function fmtTime(raw) {
    if (!raw) return '-';
    try {
      const dt = new Date(raw);
      if (isNaN(dt.getTime())) return String(raw);
      return dt.toLocaleString();
    } catch (e) {
      return String(raw);
    }
  }

  function setText(el, value) {
    const v = (value === undefined || value === null || String(value).trim() === '') ? '-' : String(value);
    el.textContent = v;
  }

  function render(data) {
    const d = normalizeExperimentData(data);

    // 副标题：显示 API 与环境来源
    const envText = d?.serverInfo?.environment ? ` · ${d.serverInfo.environment}` : '';
    const apiText = API_BASE ? `API: ${API_BASE}${envText}` : '';
    dom.subtitle.textContent = `用于展示单个实验会话详情${apiText ? '（' + apiText + '）' : ''}`;

    setText(dom.sessionId, d.sessionId);
    setText(dom.userId, d.userId);
    setText(dom.sessionName, d.sessionName);

    const timeCandidate = pickFirstDefined(d.createdAt, d.updatedAt, d.startTime, d.endTime);
    dom.timeInfo.textContent = fmtTime(timeCandidate);

    const sourceBits = [d.source, d?.metadata?.dataType].filter(Boolean);
    setText(dom.sourceInfo, sourceBits.join(' / '));

    const smile = clamp01(d.smilePercentage);
    const neutral = clamp01(d.neutralPercentage);
    const surprised = clamp01(d.surprisedPercentage);

    dom.smileBar.style.width = `${smile}%`;
    dom.neutralBar.style.width = `${neutral}%`;
    dom.surprisedBar.style.width = `${surprised}%`;

    setText(dom.smileValue, fmtPercent(smile));
    setText(dom.neutralValue, fmtPercent(neutral));
    setText(dom.surprisedValue, fmtPercent(surprised));

    setText(dom.totalExpressionCount, d.totalExpressionCount);

    renderChat(d.chatMessages);
  }

  function renderChat(list) {
    const container = dom.chatList;
    container.innerHTML = '';

    if (!Array.isArray(list) || list.length === 0) {
      container.classList.add('empty');
      container.textContent = '无记录';
      return;
    }

    container.classList.remove('empty');

    list.forEach((row) => {
      const item = document.createElement('div');
      item.className = 'chat-item';

      const meta = document.createElement('div');
      meta.className = 'chat-meta';

      const speaker = document.createElement('span');
      speaker.className = 'chat-speaker';
      speaker.textContent = row?.speaker || '-';

      const time = document.createElement('span');
      time.className = 'chat-time';
      time.textContent = row?.timestamp ? String(row.timestamp) : '-';

      meta.appendChild(speaker);
      meta.appendChild(document.createTextNode(' · '));
      meta.appendChild(time);

      const msg = document.createElement('div');
      msg.className = 'chat-message';
      msg.textContent = row?.message || '-';

      item.appendChild(meta);
      item.appendChild(msg);
      container.appendChild(item);
    });
  }

  async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
      if (linkToken) headers['Authorization'] = `Bearer ${linkToken}`;
      const res = await fetch(url, { ...options, signal: controller.signal, headers });
      clearTimeout(id);
      return res;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  }

  async function loadAndRender() {
    if (!sessionIdParam && !linkToken) {
      showBanner('未提供 sessionId 或 token，已使用示例数据展示');
      render(FALLBACK_SAMPLE.data);
      return;
    }

    hideBanner();

    const id = sessionIdParam || 'placeholder';
    const url = `${API_BASE.replace(/\/$/, '')}/api/experiments/external/${encodeURIComponent(id)}`;
    try {
      const res = await fetchWithTimeout(url, { method: 'GET' });
      if (!res.ok) {
        throw new Error(`请求失败：HTTP ${res.status}`);
      }
      const json = await res.json();
      if (!json || json.success === false || !json.data) {
        showBanner('接口返回异常，已使用示例数据展示');
        render(FALLBACK_SAMPLE.data);
        return;
      }
      render(json.data);
    } catch (err) {
      console.error(err);
      showBanner('接口不可达，已使用示例数据展示');
      render(FALLBACK_SAMPLE.data);
    }
  }

  // 启动
  window.addEventListener('DOMContentLoaded', loadAndRender);
})(); 