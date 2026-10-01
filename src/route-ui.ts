import { checkRouteSite, getRouteContext, preferredRoute, rememberRoute, routesForPlatform, routeUrl } from './download-routes.ts';
import type { ShortVideoPlatform } from './types.ts';

/** 使用普通链接打开网站，保留新标签页和键盘操作的浏览器原生行为。 */
export function renderRouteSection(container: HTMLElement, platform: ShortVideoPlatform, sourceUrl: string, externalOnly: boolean): void {
  container.replaceChildren();
  const routes = routesForPlatform(platform);
  container.hidden = !routes.length;
  if (!routes.length) return;

  const title = document.createElement('h3');
  title.className = 'bdl-section-title';
  title.textContent = externalOnly ? '下载网站' : '备用下载网站';
  const context = getRouteContext(sourceUrl, platform);
  const note = document.createElement('p');
  note.className = 'bdl-route-note';
  note.textContent = context ? '在新标签页打开所选网站，并传入当前内容链接。' : '请先打开具体视频、帖子或音频页面。';
  container.append(title, note);
  if (!context) return;

  const controls = document.createElement('div');
  controls.className = 'bdl-route-controls';
  const select = document.createElement('select');
  select.setAttribute('aria-label', '下载网站');
  for (const route of routes) {
    const option = document.createElement('option');
    option.value = route.id;
    option.textContent = route.name;
    select.appendChild(option);
  }
  select.value = preferredRoute(platform);
  const link = document.createElement('a');
  link.className = 'bdl-route-open';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = '打开下载网站 ↗';
  const currentPageUrl = location.href;
  const updateLink = () => { link.href = routeUrl(select.value, context)!; };
  updateLink();
  const status = document.createElement('p');
  status.className = 'bdl-route-note';
  status.setAttribute('role', 'status');
  let checkId = 0;
  const check = document.createElement('button');
  check.type = 'button';
  check.className = 'bdl-route-check';
  check.textContent = '检查网站响应';
  select.addEventListener('change', () => {
    checkId++;
    check.disabled = false;
    status.textContent = '';
    rememberRoute(platform, select.value);
    updateLink();
  });
  const open = (event: MouseEvent) => {
    if (location.href !== currentPageUrl) {
      event.preventDefault();
      renderRouteSection(container, platform, location.href, externalOnly);
      return;
    }
    rememberRoute(platform, select.value);
  };
  link.addEventListener('click', open);
  link.addEventListener('auxclick', open);
  check.addEventListener('click', async () => {
    const id = ++checkId;
    check.disabled = true;
    status.textContent = '正在检查网站响应…';
    const result = await checkRouteSite(select.value);
    if (id !== checkId || !check.isConnected) return;
    status.textContent = result;
    check.disabled = false;
  });
  controls.append(select, link);
  container.append(controls, check, status);
}
