import { REGIONS, CATEGORIES, OPERATION, OPERATION_LABEL, CHANNEL, CHANNEL_LABEL, formatManwon } from './domain.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function fillSelect(select, values, { placeholder = '', labels = null } = {}) {
  select.innerHTML = '';
  if (placeholder !== null) {
    const o = document.createElement('option');
    o.value = '';
    o.textContent = placeholder;
    select.appendChild(o);
  }
  for (const v of values) {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = labels ? labels[v] : v;
    select.appendChild(o);
  }
}

export function fillRegion(select, placeholder = '시/도 선택') { fillSelect(select, REGIONS, { placeholder }); }
export function fillCategory(select, placeholder = '업종 선택') { fillSelect(select, CATEGORIES, { placeholder }); }
export function fillOperation(select, values = [OPERATION.OWNER, OPERATION.AUTO, OPERATION.ANY]) {
  fillSelect(select, values, { placeholder: null, labels: OPERATION_LABEL });
}

export function formData(form) {
  const fd = new FormData(form);
  const out = {};
  for (const [k, v] of fd.entries()) out[k] = v;
  for (const cb of $$('input[type=checkbox]', form)) out[cb.name] = cb.checked;
  return out;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function channelBadge(channel) {
  const cls = channel === CHANNEL.DIRECT ? 'badge direct' : 'badge consulting';
  return `<span class="${cls}">${CHANNEL_LABEL[channel] || channel}</span>`;
}

export function listingCard(l, extraHtml = '') {
  return `
  <article class="card listing" data-id="${esc(l.id)}">
    <div class="row between">
      <h3>${esc(l.name)}</h3>
      ${channelBadge(l.channel)}
    </div>
    <div class="meta">${esc(l.sido)} ${esc(l.sigungu)} · ${esc(l.category)} · ${esc(OPERATION_LABEL[l.operation] || '')}</div>
    <div class="nums">
      <div><span>총 양도가</span><b>${formatManwon(l.totalPrice)}</b></div>
      <div><span>보증금</span><b>${formatManwon(l.deposit)}</b></div>
      <div><span>권리금</span><b>${formatManwon(l.premium)}</b></div>
      <div><span>월세</span><b>${formatManwon(l.rent)}</b></div>
      <div><span>월매출</span><b>${formatManwon(l.monthlySales)}</b></div>
      <div><span>월순이익</span><b>${formatManwon(l.monthlyProfit)}</b></div>
    </div>
    ${l.description ? `<p class="desc">${esc(l.description)}</p>` : ''}
    ${extraHtml}
  </article>`;
}

export function toast(msg, kind = 'ok') {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.className = `toast ${kind} show`;
  el.textContent = msg;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3200);
}

export function nav(active) {
  const items = [
    ['index.html', '홈'],
    ['sell.html', '매도 등록'],
    ['buy.html', '매수 등록'],
    ['direct.html', '직거래 매물'],
    ['my.html', '내 매물'],
    ['crm.html', '컨설팅 CRM'],
  ];
  return `<nav class="topnav">${items.map(([href, label]) =>
    `<a href="${href}" class="${href === active ? 'on' : ''}">${label}</a>`).join('')}</nav>`;
}

export function mountNav(active) {
  const holder = $('#nav');
  if (holder) holder.innerHTML = nav(active);
}
