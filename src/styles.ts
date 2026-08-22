export const STYLES = `
        :host {
            all: initial;
            color-scheme: light;
            font-family: "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif;
            line-height: 1.4;
            -webkit-font-smoothing: antialiased;
            text-rendering: optimizeLegibility;

            /* 品牌色令牌声明在 :host 而非 #bdl-panel：完成动画等浮层挂在
               shadow root 下但不在面板子树内，只有 :host 能覆盖整个根节点。
               此处的值是 syncBrand() 执行前的兜底，与 platforms.ts 的
               BILIBILI_BRAND 保持一致；applyBrand() 写在宿主元素的行内样式上，
               优先级高于本规则，因此按平台改色不会被这里覆盖。 */
            --bdl-brand: #ff6699;
            --bdl-brand-deep: #e84b85;
            --bdl-brand-accent: #00aeec;
            --bdl-brand-contrast: #ffffff;
            --bdl-brand-spark: var(--bdl-brand);
            --bdl-brand-soft: color-mix(in srgb, var(--bdl-brand) 12%, transparent);
            --bdl-brand-light: color-mix(in srgb, var(--bdl-brand) 55%, white);
            --bdl-brand-accent-deep: color-mix(in srgb, var(--bdl-brand-accent) 82%, black);
            --bdl-brand-accent-light: color-mix(in srgb, var(--bdl-brand-accent) 45%, white);

            /* 中性色令牌，浅色为默认值。 */
            --bdl-surface: #ffffff;
            --bdl-surface-sub: #fafafa;
            --bdl-surface-raise: #ffffff;
            --bdl-border: #e8e8e8;
            --bdl-border-soft: #f0f0f0;
            --bdl-text: #333333;
            --bdl-text-sub: #666666;
            --bdl-text-weak: #999999;
            --bdl-overlay: rgba(0, 0, 0, 0.18);
            /* 完成动画的全屏底色，只取中性值：站点主色偏黑时染色会让整屏发脏。 */
            --bdl-veil: rgba(255, 255, 255, 0.72);

            /* 状态色令牌，浅色为默认值。文字色需与同组底色叠在 --bdl-surface 上
               仍满足 4.5:1，故深浅两套各自给出，不由单侧值推算。 */
            --bdl-info-bg: #e6f7ff;
            --bdl-info-border: #91d5ff;
            --bdl-info-text: #0050b3;
            --bdl-success-bg: #f6ffed;
            --bdl-success-border: #b7eb8f;
            --bdl-success-text: #389e0d;
            --bdl-warning-bg: #fffbe6;
            --bdl-warning-border: #ffe58f;
            --bdl-warning-text: #ad6800;
            --bdl-danger-bg: #fff1f0;
            --bdl-danger-border: #ffa39e;
            --bdl-danger-text: #cf1322;

            /* --bdl-brand-soft 底色上的文字色。深色面板下压暗的品牌色对比度不足，
               改用提亮值。 */
            --bdl-brand-on-soft: var(--bdl-brand-deep);
        }

        /* 深色站点的面板配色，由 applySurface() 在宿主元素上加 .bdl-dark 触发。 */
        :host(.bdl-dark) {
            color-scheme: dark;
            --bdl-surface: #1c1c22;
            --bdl-surface-sub: #16161b;
            --bdl-surface-raise: #26262d;
            --bdl-border: #34343d;
            --bdl-border-soft: #2a2a32;
            --bdl-text: #f5f5f5;
            --bdl-text-sub: #b8b8c0;
            --bdl-text-weak: #85858f;
            --bdl-overlay: rgba(0, 0, 0, 0.55);
            --bdl-veil: rgba(10, 10, 14, 0.66);
            --bdl-info-bg: rgba(56, 139, 253, 0.16);
            --bdl-info-border: rgba(56, 139, 253, 0.42);
            --bdl-info-text: #79c0ff;
            --bdl-success-bg: rgba(63, 185, 80, 0.16);
            --bdl-success-border: rgba(63, 185, 80, 0.42);
            --bdl-success-text: #56d364;
            --bdl-warning-bg: rgba(227, 179, 65, 0.16);
            --bdl-warning-border: rgba(227, 179, 65, 0.42);
            --bdl-warning-text: #e3b341;
            --bdl-danger-bg: rgba(248, 81, 73, 0.16);
            --bdl-danger-border: rgba(248, 81, 73, 0.45);
            --bdl-danger-text: #ff7b72;
            --bdl-brand-on-soft: color-mix(in srgb, var(--bdl-brand) 55%, white);
        }

        :host,
        :host * {
            box-sizing: border-box;
        }

        :host button,
        :host input,
        :host select {
            font: inherit;
        }

        #bdl-entry,
        .bdl-popup,
        .bdl-complete-overlay {
            pointer-events: auto;
        }

        #bdl-panel {
            position: fixed;
            right: 20px;
            bottom: 80px;
            z-index: 100000;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        }

        #bdl-main-btn {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--bdl-brand-accent) 0%, var(--bdl-brand-accent-deep) 100%);
            border: none;
            cursor: pointer;
            box-shadow: 0 4px 15px color-mix(in srgb, var(--bdl-brand-accent) 50%, transparent);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
        }

        #bdl-main-btn:hover {
            transform: scale(1.08) translateY(-2px);
            box-shadow: 0 6px 25px color-mix(in srgb, var(--bdl-brand-accent) 60%, transparent);
        }

        #bdl-main-btn:active {
            transform: scale(1.02);
        }

        #bdl-main-btn:disabled {
            cursor: not-allowed;
        }

        #bdl-main-btn svg {
            width: 30px;
            height: 30px;
            fill: white;
            position: relative;
            z-index: 2;
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        #bdl-main-btn:hover svg {
            transform: translateY(-1px);
        }

        #bdl-progress-circle {
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            background: linear-gradient(180deg, var(--bdl-brand) 0%, var(--bdl-brand-deep) 100%);
            transition: height 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            height: 0%;
            border-radius: 0 0 30px 30px;
            overflow: hidden;
            box-shadow: 0 -2px 10px color-mix(in srgb, var(--bdl-brand) 30%, transparent) inset;
        }

        #bdl-progress-circle::before {
            content: '';
            position: absolute;
            top: -15px;
            left: -50%;
            width: 200%;
            height: 30px;
            background: radial-gradient(ellipse at center, rgba(255, 255, 255, 0.5) 0%, transparent 50%);
            border-radius: 45%;
            animation: bdlCircleWave 2.5s ease-in-out infinite;
        }

        #bdl-progress-circle::after {
            content: '';
            position: absolute;
            top: -12px;
            left: -50%;
            width: 200%;
            height: 25px;
            background: radial-gradient(ellipse at center, rgba(255, 255, 255, 0.3) 0%, transparent 50%);
            border-radius: 40%;
            animation: bdlCircleWave 3s ease-in-out infinite reverse;
        }

        @keyframes bdlCircleWave {
            0%, 100% {
                transform: translateX(0) translateY(0) rotate(0deg);
            }
            25% {
                transform: translateX(-15%) translateY(-2px) rotate(-2deg);
            }
            50% {
                transform: translateX(-25%) translateY(-4px) rotate(0deg);
            }
            75% {
                transform: translateX(-35%) translateY(-2px) rotate(2deg);
            }
        }

        .bdl-progress-bubble {
            position: absolute;
            bottom: 0;
            width: 4px;
            height: 4px;
            background: rgba(255, 255, 255, 0.6);
            border-radius: 50%;
            animation: bdlBubbleRise 3s ease-in infinite;
            opacity: 0;
        }

        .bdl-progress-bubble:nth-child(1) {
            left: 20%;
            animation-delay: 0s;
            animation-duration: 2.5s;
        }

        .bdl-progress-bubble:nth-child(2) {
            left: 50%;
            animation-delay: 0.8s;
            animation-duration: 3s;
        }

        .bdl-progress-bubble:nth-child(3) {
            left: 70%;
            animation-delay: 1.5s;
            animation-duration: 2.8s;
        }

        @keyframes bdlBubbleRise {
            0% {
                bottom: 0;
                opacity: 0;
                transform: translateX(0) scale(0.5);
            }
            10% {
                opacity: 1;
            }
            50% {
                opacity: 0.8;
                transform: translateX(10px) scale(1);
            }
            100% {
                bottom: 100%;
                opacity: 0;
                transform: translateX(-10px) scale(0.5);
            }
        }

        .bdl-popup {
            position: absolute;
            bottom: 75px;
            right: 0;
            width: 420px;
            background: var(--bdl-surface);
            border-radius: 16px;
            box-shadow: 0 10px 50px var(--bdl-overlay);
            display: none;
            overflow: hidden;
        }

        .bdl-popup.show {
            display: block;
            animation: bdlFadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes bdlFadeIn {
            from { 
                opacity: 0; 
                transform: translateY(10px) scale(0.98); 
            }
            to { 
                opacity: 1; 
                transform: translateY(0) scale(1); 
            }
        }

        @keyframes bdlFadeOut {
            from { opacity: 1; transform: scale(1); }
            to { opacity: 0; transform: scale(0.95); }
        }

        .bdl-header {
            background: linear-gradient(135deg, var(--bdl-brand-accent) 0%, var(--bdl-brand-accent-deep) 100%);
            color: var(--bdl-brand-contrast);
            padding: 18px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .bdl-header-title {
            font-size: 17px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .bdl-close {
            width: 30px;
            height: 30px;
            border: none;
            background: rgba(255,255,255,0.2);
            border-radius: 50%;
            cursor: pointer;
            font-size: 18px;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }

        .bdl-close:hover {
            background: rgba(255,255,255,0.3);
            transform: rotate(90deg);
        }

        .bdl-body {
            padding: 20px;
            max-height: 65vh;
            overflow-y: auto;
        }

        .bdl-info-card {
            background: var(--bdl-surface-sub);
            border-radius: 12px;
            padding: 15px;
            margin-bottom: 18px;
        }

        .bdl-info-title {
            font-size: 15px;
            font-weight: 600;
            color: var(--bdl-text);
            margin-bottom: 10px;
            line-height: 1.5;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }

        .bdl-info-meta {
            display: flex;
            gap: 15px;
            font-size: 13px;
            color: var(--bdl-text-sub);
        }

        .bdl-info-meta-item {
            display: flex;
            align-items: center;
            gap: 5px;
        }

        .bdl-vip-badge {
            display: inline-block;
            padding: 2px 6px;
            font-size: 10px;
            border-radius: 4px;
            font-weight: 600;
            margin-left: 5px;
        }

        .bdl-vip-badge.guest {
            background: var(--bdl-border);
            color: var(--bdl-text-sub);
        }

        .bdl-vip-badge.normal {
            background: var(--bdl-brand-light);
            color: var(--bdl-brand-contrast);
        }

        .bdl-vip-badge.vip {
            background: var(--bdl-brand);
            color: var(--bdl-brand-contrast);
        }

        .bdl-section {
            margin-bottom: 18px;
        }

        .bdl-section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }

        .bdl-section-title {
            font-size: 14px;
            font-weight: 600;
            color: var(--bdl-text);
        }

        .bdl-pages-container {
            max-height: 200px;
            overflow-y: auto;
            border: 1px solid var(--bdl-border);
            border-radius: 10px;
            padding: 10px;
            background: var(--bdl-surface-sub);
        }

        .bdl-page-item {
            display: flex;
            align-items: center;
            padding: 10px;
            margin-bottom: 8px;
            border: 2px solid var(--bdl-border);
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
            background: var(--bdl-surface-raise);
        }

        .bdl-page-item:last-child {
            margin-bottom: 0;
        }

        .bdl-page-item:hover {
            border-color: var(--bdl-brand-accent);
        }

        .bdl-page-item.active {
            border-color: var(--bdl-brand-accent);
            background: linear-gradient(135deg, color-mix(in srgb, var(--bdl-brand-accent) 8%, transparent) 0%, color-mix(in srgb, var(--bdl-brand-accent-deep) 8%, transparent) 100%);
        }

        .bdl-page-checkbox {
            width: 18px;
            height: 18px;
            margin-right: 12px;
            cursor: pointer;
            accent-color: var(--bdl-brand-accent);
        }

        .bdl-page-info {
            flex: 1;
            min-width: 0;
        }

        .bdl-page-num {
            font-size: 12px;
            color: var(--bdl-text-weak);
            margin-bottom: 3px;
        }

        .bdl-page-title {
            font-size: 13px;
            color: var(--bdl-text);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .bdl-page-duration {
            font-size: 12px;
            color: var(--bdl-text-weak);
            margin-left: 10px;
        }

        .bdl-short-items-section {
            display: none;
        }

        .bdl-short-items-section.show {
            display: block;
        }

        .bdl-short-items-toolbar {
            display: flex;
            gap: 8px;
            margin-bottom: 8px;
        }

        .bdl-short-select-btn {
            flex: 1;
            height: 28px;
            border: 1px solid var(--bdl-border);
            border-radius: 8px;
            background: var(--bdl-surface-raise);
            color: var(--bdl-text-sub);
            font-size: 12px;
            font-family: inherit;
            cursor: pointer;
            transition: all 0.2s;
        }

        .bdl-short-select-btn:hover {
            border-color: var(--bdl-brand-accent);
            color: var(--bdl-brand-accent);
        }

        .bdl-short-items {
            max-height: 240px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 10px;
            border: 1px solid var(--bdl-border);
            border-radius: 10px;
            background: var(--bdl-surface-sub);
        }

        .bdl-short-item-row {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .bdl-short-assets {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
            gap: 6px;
            padding: 8px;
            border: 1px solid var(--bdl-border);
            border-radius: 8px;
            background: var(--bdl-surface-raise);
        }

        .bdl-short-asset {
            position: relative;
            display: block;
            width: 100%;
            aspect-ratio: 1;
            padding: 0;
            border: 2px solid var(--bdl-border);
            border-radius: 6px;
            overflow: hidden;
            background: var(--bdl-surface-sub);
            font-family: inherit;
            cursor: pointer;
            opacity: 0.5;
            transition: opacity 0.2s, border-color 0.2s;
        }

        .bdl-short-asset:hover {
            opacity: 0.8;
        }

        .bdl-short-asset.selected {
            border-color: var(--bdl-brand-accent);
            opacity: 1;
        }

        .bdl-short-asset-thumb {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }

        .bdl-short-asset-index {
            position: absolute;
            right: 3px;
            bottom: 3px;
            padding: 0 4px;
            border-radius: 4px;
            background: rgba(0, 0, 0, 0.55);
            color: #fff;
            font-size: 10px;
            line-height: 14px;
        }

        .bdl-short-item {
            width: 100%;
            min-height: 44px;
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px;
            border: 2px solid var(--bdl-border);
            border-radius: 10px;
            background: var(--bdl-surface-raise);
            color: var(--bdl-text);
            cursor: pointer;
            text-align: left;
            transition: all 0.2s;
        }

        .bdl-short-item:hover {
            border-color: var(--bdl-brand-accent);
            color: var(--bdl-brand-accent);
        }

        .bdl-short-item.selected {
            border-color: var(--bdl-brand-accent);
            background: linear-gradient(135deg, color-mix(in srgb, var(--bdl-brand-accent) 8%, transparent) 0%, color-mix(in srgb, var(--bdl-brand-accent-deep) 8%, transparent) 100%);
        }

        /* 图集内只选了一部分：虚线外框区别于整项选中 */
        .bdl-short-item.partial {
            border-style: dashed;
            border-color: var(--bdl-brand-accent);
        }

        /* 信息区当前展示的媒体项 */
        .bdl-short-item.previewing {
            box-shadow: inset 3px 0 0 var(--bdl-brand-accent-deep);
        }

        .bdl-short-item-mark {
            flex: 0 0 auto;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 42px;
            height: 24px;
            padding: 0 8px;
            border-radius: 999px;
            background: color-mix(in srgb, var(--bdl-brand-accent) 10%, transparent);
            color: var(--bdl-brand-accent-deep);
            font-size: 11px;
            font-weight: 600;
        }

        .bdl-short-item-title {
            min-width: 0;
            flex: 1;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
            font-size: 13px;
        }

        /* 同一作品的多路清晰度标题相同，靠右侧标识区分 */
        .bdl-short-item-label {
            flex: 0 0 auto;
            max-width: 45%;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
            color: var(--bdl-text-weak);
            font-size: 11px;
            font-weight: 600;
        }

        .bdl-pages-actions {
            display: flex;
            gap: 10px;
            margin-top: 10px;
        }

        .bdl-pages-actions button {
            flex: 1;
            padding: 8px;
            border: 1px solid var(--bdl-brand-accent);
            border-radius: 6px;
            background: var(--bdl-surface-raise);
            color: var(--bdl-brand-accent);
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .bdl-pages-actions button:hover {
            background: var(--bdl-brand-accent);
            color: var(--bdl-brand-contrast);
        }

        .bdl-quality-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
        }

        .bdl-quality-btn {
            padding: 10px 8px;
            border: 2px solid var(--bdl-border);
            border-radius: 10px;
            background: var(--bdl-surface-raise);
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
            text-align: center;
            color: var(--bdl-text-sub);
        }

        .bdl-quality-btn:hover {
            border-color: var(--bdl-brand-accent);
            color: var(--bdl-brand-accent);
        }

        .bdl-quality-btn.active {
            border-color: var(--bdl-brand-accent);
            background: var(--bdl-brand-accent);
            color: var(--bdl-brand-contrast);
        }

        .bdl-quality-btn.disabled {
            opacity: 0.4;
            cursor: not-allowed;
        }

        .bdl-codec-selector {
            margin-bottom: 18px;
        }

        .bdl-codec-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
        }

        .bdl-codec-item {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .bdl-codec-label {
            font-size: 12px;
            color: var(--bdl-text-sub);
            font-weight: 500;
        }

        .bdl-codec-select {
            padding: 8px 10px;
            border: 2px solid var(--bdl-border);
            border-radius: 8px;
            background: var(--bdl-surface-raise);
            font-size: 13px;
            color: var(--bdl-text);
            cursor: pointer;
            transition: all 0.2s;
        }

        .bdl-codec-select:hover {
            border-color: var(--bdl-brand-accent);
        }

        .bdl-codec-select:focus {
            outline: none;
            border-color: var(--bdl-brand-accent);
        }

        .bdl-method-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .bdl-method-item {
            display: flex;
            align-items: center;
            padding: 12px 15px;
            border: 2px solid var(--bdl-border);
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s;
            background: var(--bdl-surface-raise);
        }

        .bdl-method-item:hover {
            border-color: var(--bdl-brand-accent);
        }

        .bdl-method-item.active {
            border-color: var(--bdl-brand-accent);
            background: linear-gradient(135deg, color-mix(in srgb, var(--bdl-brand-accent) 8%, transparent) 0%, color-mix(in srgb, var(--bdl-brand-accent-deep) 8%, transparent) 100%);
        }

        .bdl-method-radio {
            width: 20px;
            height: 20px;
            border: 2px solid var(--bdl-border);
            border-radius: 50%;
            margin-right: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }

        .bdl-method-item.active .bdl-method-radio {
            border-color: var(--bdl-brand-accent);
        }

        .bdl-method-item.active .bdl-method-radio::after {
            content: '';
            width: 10px;
            height: 10px;
            background: var(--bdl-brand-accent);
            border-radius: 50%;
        }

        .bdl-method-content {
            flex: 1;
        }

        .bdl-method-name {
            font-size: 14px;
            font-weight: 600;
            color: var(--bdl-text);
            margin-bottom: 3px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .bdl-method-desc {
            font-size: 12px;
            color: var(--bdl-text-weak);
        }

        .bdl-method-status {
            font-size: 11px;
            padding: 3px 8px;
            border-radius: 10px;
            font-weight: 500;
        }

        .bdl-method-status.ready {
            background: color-mix(in srgb, var(--bdl-success-text) 14%, transparent);
            color: var(--bdl-success-text);
        }

        .bdl-method-status.loading {
            background: color-mix(in srgb, var(--bdl-warning-text) 16%, transparent);
            color: var(--bdl-warning-text);
        }

        .bdl-extra-downloads {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 18px;
        }

        .bdl-extra-btn {
            flex: 1;
            min-width: calc(50% - 4px);
            padding: 10px;
            border: 2px solid var(--bdl-border);
            border-radius: 8px;
            background: var(--bdl-surface-raise);
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
        }

        .bdl-extra-btn:hover {
            border-color: var(--bdl-brand-accent);
            color: var(--bdl-brand-accent);
        }

        .bdl-progress-section {
            background: var(--bdl-surface-sub);
            border-radius: 12px;
            padding: 15px;
            margin-bottom: 18px;
            display: none;
        }

        .bdl-progress-section.show {
            display: block;
        }

        .bdl-progress-row {
            margin-bottom: 12px;
        }

        .bdl-progress-row:last-child {
            margin-bottom: 0;
        }

        .bdl-progress-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
            font-size: 13px;
        }

        .bdl-progress-label {
            color: var(--bdl-text-sub);
            font-weight: 500;
        }

        .bdl-progress-value {
            color: var(--bdl-text-weak);
        }

        .bdl-progress-track {
            height: 10px;
            background: var(--bdl-surface-sub);
            border-radius: 5px;
            overflow: hidden;
            position: relative;
        }

        .bdl-progress-bar {
            height: 100%;
            border-radius: 5px;
            transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            width: 0%;
            position: relative;
            overflow: hidden;
            background: linear-gradient(90deg, var(--bdl-brand), var(--bdl-brand-light));
        }

        .bdl-progress-bar::before {
            content: '';
            position: absolute;
            top: -50%;
            left: 0;
            width: 100%;
            height: 200%;
            background: repeating-linear-gradient(
                90deg,
                transparent,
                transparent 10px,
                rgba(255,255,255,0.15) 10px,
                rgba(255,255,255,0.15) 20px
            );
            animation: bdlStripe 1s linear infinite;
        }

        .bdl-progress-bar::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 50%;
            background: linear-gradient(to bottom, rgba(255,255,255,0.3), transparent);
            border-radius: 5px 5px 0 0;
        }

        @keyframes bdlStripe {
            0% {
                transform: translateX(-20px);
            }
            100% {
                transform: translateX(0);
            }
        }

        .bdl-progress-bar.video {
            background: linear-gradient(90deg, var(--bdl-brand), var(--bdl-brand-light));
        }

        .bdl-progress-bar.audio {
            background: linear-gradient(90deg, var(--bdl-brand-accent), var(--bdl-brand-accent-light));
        }

        .bdl-progress-bar.merge {
            background: linear-gradient(90deg, var(--bdl-brand), var(--bdl-brand-accent));
        }

        .bdl-alert {
            padding: 12px 15px;
            border-radius: 10px;
            font-size: 13px;
            margin-bottom: 18px;
            display: none;
            line-height: 1.5;
        }

        .bdl-alert.show {
            display: block;
        }

        .bdl-alert.info {
            background: var(--bdl-info-bg);
            border: 1px solid var(--bdl-info-border);
            color: var(--bdl-info-text);
        }

        .bdl-alert.success {
            background: var(--bdl-success-bg);
            border: 1px solid var(--bdl-success-border);
            color: var(--bdl-success-text);
        }

        .bdl-alert.warning {
            background: var(--bdl-warning-bg);
            border: 1px solid var(--bdl-warning-border);
            color: var(--bdl-warning-text);
        }

        .bdl-alert.error {
            background: var(--bdl-danger-bg);
            border: 1px solid var(--bdl-danger-border);
            color: var(--bdl-danger-text);
        }

        .bdl-download-btn {
            width: 100%;
            padding: 15px;
            border: none;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            background: linear-gradient(135deg, var(--bdl-brand-accent) 0%, var(--bdl-brand-accent-deep) 100%);
            color: var(--bdl-brand-contrast);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            position: relative;
            overflow: hidden;
        }

        .bdl-download-progress-fill {
            position: absolute;
            inset: 0 auto 0 0;
            width: var(--bdl-download-progress, 0%);
            background: linear-gradient(90deg, rgba(255,255,255,0.24), rgba(255,255,255,0.36));
            transition: width 0.25s ease;
            pointer-events: none;
        }

        .bdl-download-label {
            position: relative;
            z-index: 1;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
        }

        .bdl-download-btn.is-active.can-queue {
            cursor: pointer;
        }

        .bdl-download-btn:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 5px 20px color-mix(in srgb, var(--bdl-brand-accent) 40%, transparent);
        }

        .bdl-download-btn:disabled {
            background: linear-gradient(135deg, var(--bdl-border) 0%, var(--bdl-text-weak) 100%);
            cursor: not-allowed;
            transform: none;
        }

        .bdl-footer {
            text-align: center;
            padding: 15px 20px;
            background: var(--bdl-surface-sub);
            font-size: 12px;
            color: var(--bdl-text-weak);
            line-height: 1.6;
            cursor: pointer;
            user-select: none;
            transition: all 0.2s;
        }

        .bdl-footer:hover {
            background: var(--bdl-surface-sub);
            color: var(--bdl-text-sub);
        }

        .bdl-tips {
            background: var(--bdl-warning-bg);
            border: 1px solid var(--bdl-warning-border);
            border-radius: 10px;
            padding: 12px 15px;
            margin-bottom: 18px;
            font-size: 12px;
            color: var(--bdl-warning-text);
            line-height: 1.6;
        }

        .bdl-tips-title {
            font-weight: 600;
            margin-bottom: 5px;
            display: flex;
            align-items: center;
            gap: 5px;
        }

        .bdl-spinner {
            display: inline-block;
            width: 14px;
            height: 14px;
            border: 2px solid var(--bdl-brand-contrast);
            border-radius: 50%;
            border-top-color: transparent;
            animation: bdlSpin 0.8s linear infinite;
        }

        @keyframes bdlSpin {
            to { transform: rotate(360deg); }
        }

        .bdl-badge {
            display: inline-block;
            padding: 2px 6px;
            font-size: 10px;
            border-radius: 4px;
            font-weight: 600;
        }

        .bdl-badge.recommended {
            background: #52c41a;
            color: white;
        }

        .bdl-complete-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: var(--bdl-veil);
            backdrop-filter: blur(8px);
            z-index: 100001;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: bdlOverlayIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes bdlOverlayIn {
            from { 
                opacity: 0;
                backdrop-filter: blur(0px);
            }
            to { 
                opacity: 1;
                backdrop-filter: blur(8px);
            }
        }

        .bdl-complete-container {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .bdl-complete-icon {
            width: 140px;
            height: 140px;
            background: var(--bdl-brand);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: bdlIconPop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            box-shadow: 0 12px 32px color-mix(in srgb, var(--bdl-brand) 24%, transparent);
            position: relative;
            z-index: 2;
        }

        /* 单色描边环，靠缩放与透明度做呼吸感，不叠第二种颜色。 */
        .bdl-complete-icon::before {
            content: '';
            position: absolute;
            inset: -10px;
            border-radius: 50%;
            border: 2px solid color-mix(in srgb, var(--bdl-brand) 34%, transparent);
            animation: bdlIconPulse 2s ease-in-out infinite;
            z-index: -1;
        }

        @keyframes bdlIconPop {
            0% {
                transform: scale(0) rotate(-180deg);
                opacity: 0;
            }
            50% {
                transform: scale(1.15) rotate(10deg);
            }
            100% {
                transform: scale(1) rotate(0deg);
                opacity: 1;
            }
        }

        @keyframes bdlIconPulse {
            0%, 100% {
                transform: scale(1);
                opacity: 0.9;
            }
            50% {
                transform: scale(1.12);
                opacity: 0.2;
            }
        }

        .bdl-complete-icon svg {
            width: 80px;
            height: 80px;
            fill: none;
            stroke: var(--bdl-brand-contrast);
            stroke-width: 5;
            stroke-linecap: round;
            stroke-linejoin: round;
        }

        .bdl-complete-icon svg path {
            stroke-dasharray: 80;
            stroke-dashoffset: 80;
            animation: bdlCheckDraw 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.3s forwards;
        }

        @keyframes bdlCheckDraw {
            to {
                stroke-dashoffset: 0;
            }
        }

        .bdl-complete-ripple {
            position: absolute;
            top: 50%;
            left: 50%;
            width: 140px;
            height: 140px;
            margin: -70px 0 0 -70px;
            border-radius: 50%;
            border: 2px solid color-mix(in srgb, var(--bdl-brand) 40%, transparent);
            animation: bdlRippleOut 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
            z-index: 1;
        }

        .bdl-complete-ripple:nth-child(2) {
            border-color: color-mix(in srgb, var(--bdl-brand-spark) 40%, transparent);
            animation-delay: 0.15s;
        }

        .bdl-complete-ripple:nth-child(3) {
            border-color: color-mix(in srgb, var(--bdl-brand) 24%, transparent);
            animation-delay: 0.3s;
        }

        @keyframes bdlRippleOut {
            0% {
                transform: scale(1);
                opacity: 1;
            }
            100% {
                transform: scale(2.8);
                opacity: 0;
            }
        }

        .bdl-complete-particles {
            position: absolute;
            top: 50%;
            left: 50%;
            width: 0;
            height: 0;
            z-index: 3;
        }

        .bdl-particle {
            position: absolute;
            border-radius: 50%;
            background: var(--bdl-brand);
            animation: bdlParticleFly 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        .bdl-particle.is-light {
            background: var(--bdl-brand-light);
        }

        .bdl-particle.is-spark {
            background: var(--bdl-brand-spark);
        }

        /* 深色底上主色为黑的站点（X 暗色主题）粒子会看不见，改用前景色一族。 */
        :host(.bdl-dark) .bdl-particle {
            background: var(--bdl-brand-contrast);
        }

        :host(.bdl-dark) .bdl-particle.is-light {
            background: color-mix(in srgb, var(--bdl-brand-contrast) 55%, transparent);
        }

        :host(.bdl-dark) .bdl-particle.is-spark {
            background: var(--bdl-brand-spark);
        }

        /* 主色为黑的站点在深色底上圆盘与底色几乎同色，靠一圈前景色描边界定形状。 */
        :host(.bdl-dark) .bdl-complete-icon {
            box-shadow:
                0 12px 32px rgba(0, 0, 0, 0.45),
                0 0 0 2px color-mix(in srgb, var(--bdl-brand-contrast) 45%, transparent);
        }

        :host(.bdl-dark) .bdl-complete-icon::before {
            border-color: color-mix(in srgb, var(--bdl-brand-contrast) 32%, transparent);
        }

        :host(.bdl-dark) .bdl-complete-ripple,
        :host(.bdl-dark) .bdl-complete-ripple:nth-child(3) {
            border-color: color-mix(in srgb, var(--bdl-brand-contrast) 26%, transparent);
        }

        @keyframes bdlParticleFly {
            0% {
                transform: translate(0, 0) scale(1) rotate(0deg);
                opacity: 1;
            }
            100% {
                transform: translate(var(--tx), var(--ty)) scale(0) rotate(360deg);
                opacity: 0;
            }
        }

        .bdl-complete-text {
            position: absolute;
            top: calc(50% + 110px);
            left: 50%;
            transform: translateX(-50%);
            font-size: 24px;
            font-weight: 700;
            color: var(--bdl-text);
            animation: bdlTextFade 0.5s cubic-bezier(0.4, 0, 0.2, 1) 0.5s both;
            white-space: nowrap;
            letter-spacing: 2px;
        }

        @keyframes bdlTextFade {
            from {
                opacity: 0;
                transform: translateX(-50%) translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
        }

        .bdl-complete-sparkles {
            position: absolute;
            top: 50%;
            left: 50%;
            width: 200px;
            height: 200px;
            margin: -100px 0 0 -100px;
            z-index: 4;
        }

        .bdl-sparkle {
            position: absolute;
            width: 6px;
            height: 6px;
            background: var(--bdl-brand-spark);
            clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
            animation: bdlSparkle 1.5s ease-in-out infinite;
            opacity: 0;
        }

        @keyframes bdlSparkle {
            0%, 100% {
                opacity: 0;
                transform: scale(0) rotate(0deg);
            }
            50% {
                opacity: 1;
                transform: scale(1) rotate(180deg);
            }
        }

        #bdl-pages-section {
            max-height: 0;
            overflow: hidden;
            opacity: 0;
            transition: max-height 0.5s cubic-bezier(0.4, 0, 0.2, 1), 
                        opacity 0.3s ease, 
                        margin-bottom 0.3s ease;
            margin-bottom: 0;
        }

        #bdl-pages-section.show {
            max-height: 500px;
            opacity: 1;
            margin-bottom: 18px;
        }

        #bdl-ugc-section {
            max-height: 0;
            overflow: hidden;
            opacity: 0;
            transition: max-height 0.5s cubic-bezier(0.4, 0, 0.2, 1), 
                        opacity 0.3s ease, 
                        margin-bottom 0.3s ease;
            margin-bottom: 0;
        }

        #bdl-ugc-section.show {
            max-height: 500px;
            opacity: 1;
            margin-bottom: 18px;
        }

        /* 中性色令牌统一声明在 :host，此处不再重复声明，
           否则会遮蔽 :host(.bdl-dark) 的深色取值。 */
        #bdl-panel,
        #bdl-entry {
            font-family: "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif;
        }

        #bdl-entry {
            display: none;
            flex: none;
            position: relative;
        }

        #bdl-entry[data-mounted="true"] {
            display: flex;
        }

        #bdl-entry[data-mode="bangumi"] {
            align-items: center;
        }

        #bdl-entry[data-mode="video"],
        #bdl-entry[data-mode="bangumi"] {
            position: fixed;
            margin-right: 0;
            z-index: 100000;
        }

        #bdl-entry[data-mode="floating"] {
            position: fixed;
            right: 24px;
            bottom: 112px;
            margin-right: 0;
            z-index: 100000;
            touch-action: none;
            cursor: grab;
            user-select: none;
        }

        #bdl-entry[data-mode="floating"].is-dragging {
            cursor: grabbing;
        }

        #bdl-entry[data-mode="floating"] #bdl-main-btn {
            cursor: grab;
        }

        #bdl-entry[data-mode="floating"].is-dragging #bdl-main-btn {
            cursor: grabbing;
        }

        #bdl-main-btn {
            width: auto;
            height: 32px;
            padding: 0 14px 0 10px;
            border-radius: 999px;
            border: 1px solid transparent;
            background: transparent;
            box-shadow: none;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            color: var(--bdl-text-sub);
            font-size: 13px;
            font-weight: 500;
            overflow: hidden;
        }

        #bdl-entry[data-mode="bangumi"] #bdl-main-btn {
            height: 30px;
            padding: 0 12px 0 8px;
        }

        /* 浮动按钮：深色半透明胶囊，默认低透明度，hover 才完全显现。
           短视频站点多为深色界面，故不使用品牌色渐变。 */
        #bdl-entry[data-mode="floating"] #bdl-main-btn {
            min-width: 88px;
            height: 40px;
            padding: 0 16px 0 12px;
            background: rgba(22, 24, 28, 0.72);
            -webkit-backdrop-filter: blur(12px) saturate(150%);
            backdrop-filter: blur(12px) saturate(150%);
            border: 1px solid rgba(255, 255, 255, 0.14);
            color: rgba(255, 255, 255, 0.92);
            box-shadow: 0 6px 18px rgba(0, 0, 0, 0.22);
            opacity: 0.66;
            transition: opacity 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
        }

        #bdl-entry[data-mode="floating"] #bdl-main-btn:hover {
            background: rgba(22, 24, 28, 0.9);
            color: #fff;
            border-color: rgba(255, 255, 255, 0.22);
            box-shadow: 0 10px 24px rgba(0, 0, 0, 0.3);
            opacity: 1;
        }

        /* 下载中与面板展开时保持完全不透明 */
        #bdl-entry[data-mode="floating"].is-downloading #bdl-main-btn,
        #bdl-entry[data-mode="floating"] #bdl-main-btn[aria-expanded="true"] {
            opacity: 1;
            background: rgba(22, 24, 28, 0.9);
            color: #fff;
        }

        #bdl-main-btn:hover {
            transform: none;
            box-shadow: none;
            color: var(--bdl-brand);
            background: var(--bdl-brand-soft);
            border-color: color-mix(in srgb, var(--bdl-brand) 20%, transparent);
        }

        #bdl-main-btn:active {
            transform: scale(0.98);
        }

        #bdl-main-btn[aria-expanded="true"] {
            color: var(--bdl-brand);
            background: var(--bdl-brand-soft);
            border-color: color-mix(in srgb, var(--bdl-brand) 22%, transparent);
        }

        #bdl-main-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        #bdl-main-btn svg {
            width: 18px;
            height: 18px;
            fill: currentColor;
            z-index: 2;
            position: relative;
        }

        /* ── 无缝集成模式 ──────────────────────────────────────────
           按钮已插进站点自己的操作栏，视觉完全由 --bdl-skin-* 变量驱动，
           这些变量来自实测数值或运行时对相邻原生按钮的取样。
           这里刻意不设任何品牌色/阴影/渐变，让它看起来就是站点自带的。 */
        #bdl-entry[data-mode="native-bar"] {
            display: inline-flex;
            align-items: center;
            position: static;
        }

        #bdl-entry[data-mode="native-bar"] #bdl-main-btn {
            height: var(--bdl-skin-height, 28px);
            padding: var(--bdl-skin-padding, 0);
            border-radius: var(--bdl-skin-radius, 0);
            gap: var(--bdl-skin-gap, 4px);
            font-size: var(--bdl-skin-font-size, 13px);
            font-weight: var(--bdl-skin-font-weight, 500);
            color: var(--bdl-skin-color, inherit);
            background: var(--bdl-skin-bg, transparent);
            border: none;
            box-shadow: none;
            /* 继承站点字体，与相邻原生按钮字形一致 */
            font-family: inherit;
            white-space: nowrap;
        }

        #bdl-entry[data-mode="native-bar"] #bdl-main-btn:hover {
            color: var(--bdl-skin-color-hover, inherit);
            background: var(--bdl-skin-bg-hover, transparent);
            border-color: transparent;
            box-shadow: none;
            transform: none;
        }

        #bdl-entry[data-mode="native-bar"] #bdl-main-btn:active {
            transform: none;
        }

        #bdl-entry[data-mode="native-bar"] #bdl-main-btn[aria-expanded="true"] {
            color: var(--bdl-skin-color-hover, inherit);
            background: var(--bdl-skin-bg-hover, transparent);
            border-color: transparent;
        }

        #bdl-entry[data-mode="native-bar"] #bdl-main-btn svg {
            width: var(--bdl-skin-icon-size, 20px);
            height: var(--bdl-skin-icon-size, 20px);
            fill: currentColor;
        }

        /* 下载进度：不铺满整个按钮，只在底部走一条细线，
           跟站点原生按钮的克制风格一致 */
        #bdl-entry[data-mode="native-bar"] #bdl-progress-circle {
            inset: auto 0 0;
            height: 2px;
            border-radius: 0;
            background: var(--bdl-skin-color-hover, var(--bdl-brand-accent));
            opacity: 0;
            transition: opacity 0.2s ease, width 0.3s ease;
        }

        #bdl-entry[data-mode="native-bar"].has-entry-progress #bdl-progress-circle {
            opacity: 1;
        }

        #bdl-main-btn:hover svg {
            transform: none;
        }

        .bdl-toolbar-icon,
        .bdl-toolbar-text {
            position: relative;
            z-index: 2;
        }

        .bdl-toolbar-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }

        .bdl-toolbar-text {
            letter-spacing: 0.2px;
        }

        #bdl-progress-circle {
            position: absolute;
            inset: auto 0 0;
            width: 100%;
            height: 0%;
            border-radius: inherit;
            background: linear-gradient(180deg, rgba(16, 185, 129, 0.42) 0%, rgba(5, 150, 105, 0.86) 100%);
            box-shadow: 0 -1px 0 rgba(255, 255, 255, 0.55) inset;
            transition: height 0.25s ease;
            z-index: 1;
            pointer-events: none;
        }

        #bdl-entry.has-entry-progress[data-mode="floating"] #bdl-main-btn {
            background: linear-gradient(180deg, #111827 0%, #1f2937 100%);
            box-shadow: 0 14px 28px rgba(17, 24, 39, 0.3);
        }

        #bdl-entry.has-entry-progress[data-mode="floating"] #bdl-main-btn:hover {
            background: linear-gradient(180deg, #111827 0%, #263244 100%);
            box-shadow: 0 16px 32px rgba(17, 24, 39, 0.36);
        }

        #bdl-progress-circle::before,
        #bdl-progress-circle::after {
            display: none;
        }

        #bdl-panel {
            position: static;
            inset: auto;
            z-index: 100000;
        }

        .bdl-popup {
            position: fixed;
            top: 0;
            left: 0;
            right: auto;
            bottom: auto;
            width: min(432px, calc(100vw - 24px));
            max-height: min(78vh, 760px);
            border-radius: 18px;
            border: 1px solid var(--bdl-border);
            background: var(--bdl-surface);
            box-shadow: 0 24px 56px var(--bdl-overlay);
            overflow: hidden;
            display: none;
            transform-origin: top right;
            z-index: 100001;
        }

        .bdl-popup.is-dragging {
            user-select: none;
            transition: none;
            cursor: grabbing;
        }

        .bdl-popup.show {
            display: flex;
            flex-direction: column;
            animation: bdlFadeIn 0.18s ease-out;
        }

        .bdl-header {
            background: linear-gradient(180deg, color-mix(in srgb, var(--bdl-brand) 12%, transparent) 0%, color-mix(in srgb, var(--bdl-brand) 4%, transparent) 100%);
            color: var(--bdl-text);
            border-bottom: 1px solid var(--bdl-border);
            padding: 16px 18px 14px;
            cursor: grab;
            user-select: none;
            touch-action: none;
        }

        .bdl-popup.is-dragging .bdl-header {
            cursor: grabbing;
        }

        .bdl-header-title {
            font-size: 16px;
            font-weight: 600;
            color: var(--bdl-text);
            gap: 0;
        }

        .bdl-close {
            width: 30px;
            height: 30px;
            background: color-mix(in srgb, var(--bdl-text) 8%, transparent);
            color: var(--bdl-text-sub);
            border-radius: 50%;
        }

        .bdl-close:hover {
            background: color-mix(in srgb, var(--bdl-brand) 12%, transparent);
            color: var(--bdl-brand);
            transform: none;
        }

        .bdl-body {
            --bdl-body-pad-x: 18px;
            padding: 16px var(--bdl-body-pad-x) 0;
            max-height: min(70vh, 660px);
            overflow-y: auto;
            background: var(--bdl-surface);
        }

        .bdl-body::-webkit-scrollbar,
        .bdl-pages-container::-webkit-scrollbar {
            width: 6px;
        }

        .bdl-body::-webkit-scrollbar-thumb,
        .bdl-pages-container::-webkit-scrollbar-thumb {
            background: var(--bdl-border);
            border-radius: 999px;
        }

        .bdl-info-card {
            background: linear-gradient(180deg, var(--bdl-surface-raise) 0%, var(--bdl-surface-sub) 100%);
            border: 1px solid var(--bdl-border);
            border-radius: 16px;
            padding: 14px 14px 12px;
            margin-bottom: 16px;
        }

        .bdl-info-title {
            font-size: 16px;
            line-height: 1.6;
            color: var(--bdl-text);
            margin-bottom: 12px;
        }

        .bdl-info-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            font-size: 12px;
            color: var(--bdl-text-sub);
        }

        .bdl-info-meta-item {
            gap: 6px;
            padding: 6px 10px;
            border-radius: 999px;
            background: var(--bdl-surface-raise);
            border: 1px solid var(--bdl-border);
        }

        .bdl-meta-label {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 28px;
            height: 20px;
            padding: 0 6px;
            border-radius: 999px;
            background: color-mix(in srgb, var(--bdl-brand) 12%, transparent);
            color: var(--bdl-brand-on-soft);
            font-size: 11px;
            font-weight: 600;
            line-height: 20px;
        }

        .bdl-vip-badge {
            margin-left: 0;
            padding: 4px 8px;
            border-radius: 999px;
            font-size: 11px;
            line-height: 1;
        }

        .bdl-vip-badge.site {
            background: color-mix(in srgb, var(--bdl-brand) 12%, transparent);
            color: var(--bdl-brand-on-soft);
        }

        .bdl-section {
            margin-bottom: 16px;
        }

        .bdl-section-header {
            margin-bottom: 10px;
        }

        .bdl-section-title {
            font-size: 13px;
            font-weight: 600;
            color: var(--bdl-text);
        }

        .bdl-section-count {
            font-size: 12px;
            color: var(--bdl-text-weak);
        }

        .bdl-pages-container {
            max-height: 208px;
            padding: 10px;
            border: 1px solid var(--bdl-border);
            border-radius: 14px;
            background: var(--bdl-surface-sub);
        }

        .bdl-page-item {
            padding: 11px 12px;
            margin-bottom: 8px;
            border: 1px solid transparent;
            border-radius: 12px;
            background: var(--bdl-surface-raise);
        }

        .bdl-page-item:hover {
            border-color: color-mix(in srgb, var(--bdl-brand) 24%, transparent);
            background: color-mix(in srgb, var(--bdl-brand) 4%, transparent);
        }

        .bdl-page-item.active {
            border-color: color-mix(in srgb, var(--bdl-brand) 28%, transparent);
            background: color-mix(in srgb, var(--bdl-brand) 8%, transparent);
        }

        .bdl-page-checkbox {
            accent-color: var(--bdl-brand);
        }

        .bdl-page-num,
        .bdl-page-duration {
            color: var(--bdl-text-weak);
        }

        .bdl-page-title {
            color: var(--bdl-text);
        }

        .bdl-pages-actions {
            gap: 8px;
            margin-top: 10px;
        }

        .bdl-pages-actions button,
        .bdl-quality-btn,
        .bdl-extra-btn,
        .bdl-codec-select {
            border-radius: 12px;
            border: 1px solid var(--bdl-border);
            background: var(--bdl-surface-raise);
            color: var(--bdl-text-sub);
        }

        .bdl-pages-actions button {
            padding: 9px 8px;
            color: var(--bdl-text-sub);
        }

        .bdl-pages-actions button:hover,
        .bdl-quality-btn:hover,
        .bdl-extra-btn:hover {
            background: var(--bdl-brand-soft);
            border-color: color-mix(in srgb, var(--bdl-brand) 24%, transparent);
            color: var(--bdl-brand);
        }

        .bdl-quality-grid {
            gap: 8px;
        }

        .bdl-quality-btn {
            min-height: 40px;
            border-width: 1px;
            color: var(--bdl-text-sub);
        }

        .bdl-quality-btn.active {
            border-color: transparent;
            background: var(--bdl-brand);
            color: var(--bdl-brand-contrast);
        }

        .bdl-codec-label {
            color: var(--bdl-text-sub);
        }

        .bdl-codec-select {
            min-height: 40px;
            border-width: 1px;
            color: var(--bdl-text);
        }

        .bdl-codec-select:hover,
        .bdl-codec-select:focus {
            border-color: color-mix(in srgb, var(--bdl-brand) 24%, transparent);
        }

        .bdl-method-item {
            padding: 12px 14px;
            border-width: 1px;
            border-radius: 14px;
            background: var(--bdl-surface-raise);
        }

        .bdl-method-item:hover {
            border-color: color-mix(in srgb, var(--bdl-brand) 24%, transparent);
        }

        .bdl-method-item.active {
            border-color: color-mix(in srgb, var(--bdl-brand) 30%, transparent);
            background: color-mix(in srgb, var(--bdl-brand) 6%, transparent);
        }

        .bdl-method-radio {
            margin-right: 10px;
        }

        .bdl-method-item.active .bdl-method-radio {
            border-color: var(--bdl-brand);
        }

        .bdl-method-item.active .bdl-method-radio::after {
            background: var(--bdl-brand);
        }

        .bdl-method-name,
        .bdl-method-desc {
            color: var(--bdl-text);
        }

        .bdl-method-desc {
            color: var(--bdl-text-weak);
        }

        .bdl-method-status.ready {
            background: color-mix(in srgb, var(--bdl-success-text) 14%, transparent);
            color: var(--bdl-success-text);
        }

        .bdl-method-status.loading {
            background: color-mix(in srgb, var(--bdl-warning-text) 16%, transparent);
            color: var(--bdl-warning-text);
        }

        .bdl-extra-downloads {
            gap: 8px;
            margin-bottom: 16px;
        }

        .bdl-extra-btn {
            min-width: calc(50% - 4px);
            min-height: 42px;
            padding: 10px 12px;
            justify-content: flex-start;
            gap: 10px;
        }

        .bdl-extra-btn-mark {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 34px;
            height: 22px;
            padding: 0 8px;
            border-radius: 999px;
            background: color-mix(in srgb, var(--bdl-brand) 12%, transparent);
            color: var(--bdl-brand-deep);
            font-size: 11px;
            font-weight: 600;
        }

        .bdl-progress-section {
            padding: 14px;
            border: 1px solid var(--bdl-border);
            border-radius: 16px;
            background: linear-gradient(180deg, var(--bdl-surface-raise) 0%, var(--bdl-surface-sub) 100%);
            margin-bottom: 16px;
        }

        .bdl-progress-label {
            color: var(--bdl-text-sub);
        }

        .bdl-progress-track {
            background: var(--bdl-border);
        }

        .bdl-alert {
            border-radius: 14px;
            margin-bottom: 16px;
        }

        .bdl-download-btn {
            min-height: 46px;
            border-radius: 14px;
            background: linear-gradient(180deg, var(--bdl-brand) 0%, var(--bdl-brand-deep) 100%);
            box-shadow: 0 10px 24px color-mix(in srgb, var(--bdl-brand) 22%, transparent);
        }

        .bdl-download-btn:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 12px 28px color-mix(in srgb, var(--bdl-brand) 28%, transparent);
        }

        /* 操作栏吸底：选项区滚动时提示条与开始下载按钮始终留在面板底部 */
        .bdl-action-bar {
            position: sticky;
            bottom: 0;
            z-index: 3;
            margin: 0 calc(-1 * var(--bdl-body-pad-x));
            padding: 12px var(--bdl-body-pad-x) 18px;
            background: var(--bdl-surface);
        }

        /* 上边缘渐隐，提示上方仍有可滚动内容 */
        .bdl-action-bar::before {
            content: '';
            position: absolute;
            left: 0;
            right: 0;
            bottom: 100%;
            height: 16px;
            background: linear-gradient(to top, var(--bdl-surface), transparent);
            pointer-events: none;
        }

        .bdl-footer {
            padding: 12px 18px 16px;
            background: var(--bdl-surface);
            border-top: 1px solid var(--bdl-border);
            color: var(--bdl-text-weak);
            cursor: default;
        }

        .bdl-footer:hover {
            background: var(--bdl-surface);
            color: var(--bdl-text-weak);
        }

        .bdl-tips {
            border-radius: 14px;
            margin-bottom: 16px;
        }

        .bdl-tips-title {
            gap: 0;
            color: var(--bdl-warning-text);
        }

        #bdl-pages-section,
        #bdl-ugc-section {
            transition: max-height 0.25s ease, opacity 0.2s ease, margin-bottom 0.2s ease;
        }

        /* ========== 诊断面板 ========== */
        .bdl-diag-trigger {
            background: none;
            border: none;
            padding: 4px 8px;
            border-radius: 8px;
            color: inherit;
            font: inherit;
            cursor: pointer;
            opacity: 0.7;
            transition: opacity 0.2s, background 0.2s;
        }

        .bdl-diag-trigger:hover {
            opacity: 1;
            background: color-mix(in srgb, var(--bdl-text) 8%, transparent);
        }

        .bdl-diag-modal {
            position: fixed;
            inset: 0;
            display: none;
            align-items: center;
            justify-content: center;
            background: rgba(15, 20, 30, 0.55);
            z-index: 2147483647;
            pointer-events: auto;
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
        }

        .bdl-diag-modal.show {
            display: flex;
            animation: bdlFadeIn 0.2s ease;
        }

        .bdl-diag-card {
            width: min(720px, calc(100vw - 32px));
            max-height: calc(100vh - 48px);
            background: var(--bdl-surface);
            border-radius: 16px;
            box-shadow: 0 24px 60px var(--bdl-overlay);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        }

        .bdl-diag-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px 18px;
            border-bottom: 1px solid var(--bdl-border-soft);
            background: linear-gradient(180deg, var(--bdl-surface-sub) 0%, var(--bdl-surface) 100%);
        }

        .bdl-diag-title {
            font-size: 15px;
            font-weight: 600;
            color: var(--bdl-text);
        }

        .bdl-diag-close {
            background: none;
            border: none;
            font-size: 22px;
            line-height: 1;
            color: var(--bdl-text-sub);
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 8px;
        }

        .bdl-diag-close:hover {
            background: color-mix(in srgb, var(--bdl-text) 8%, transparent);
            color: var(--bdl-text);
        }

        .bdl-diag-body {
            flex: 1;
            overflow: auto;
            padding: 16px 18px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .bdl-diag-desc {
            font-size: 12px;
            color: var(--bdl-text-sub);
            line-height: 1.6;
        }

        .bdl-diag-note-label {
            font-size: 12px;
            font-weight: 600;
            color: var(--bdl-text);
        }

        .bdl-diag-note {
            width: 100%;
            min-height: 72px;
            resize: vertical;
            padding: 10px 12px;
            border: 1px solid var(--bdl-border);
            border-radius: 10px;
            font: inherit;
            font-size: 13px;
            color: var(--bdl-text);
            background: var(--bdl-surface-sub);
            outline: none;
            transition: border-color 0.15s, box-shadow 0.15s;
        }

        .bdl-diag-note:focus {
            border-color: var(--bdl-brand-accent);
            box-shadow: 0 0 0 3px color-mix(in srgb, var(--bdl-brand-accent) 16%, transparent);
        }

        .bdl-diag-toolbar {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            align-items: center;
        }

        .bdl-diag-toolbar-spacer {
            flex: 1;
        }

        .bdl-diag-log {
            background: #0f172a;
            color: #d5dbe7;
            border-radius: 10px;
            padding: 10px 12px;
            font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
            font-size: 11.5px;
            line-height: 1.55;
            max-height: 260px;
            overflow: auto;
            white-space: pre-wrap;
            word-break: break-word;
        }

        .bdl-diag-log-empty {
            color: #6b7280;
            font-style: italic;
        }

        .bdl-diag-log-line {
            display: block;
            padding: 2px 0;
        }

        .bdl-diag-log-line.level-info { color: #a7d4ff; }
        .bdl-diag-log-line.level-warn { color: #ffd28a; }
        .bdl-diag-log-line.level-error { color: #ff8a8a; }
        .bdl-diag-log-line.level-debug { color: #a3a3a3; }

        .bdl-diag-log-detail {
            display: block;
            color: #9ca3af;
            padding-left: 12px;
            border-left: 2px solid #1f2937;
            margin: 2px 0 4px 4px;
        }

        .bdl-diag-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 8px 14px;
            border-radius: 10px;
            border: 1px solid var(--bdl-border);
            background: var(--bdl-surface-raise);
            color: var(--bdl-text);
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.15s, border-color 0.15s, color 0.15s;
        }

        .bdl-diag-btn:hover {
            background: var(--bdl-surface-sub);
            border-color: var(--bdl-text-weak);
        }

        .bdl-diag-btn.primary {
            background: linear-gradient(135deg, var(--bdl-brand-accent) 0%, var(--bdl-brand-accent-deep) 100%);
            border-color: transparent;
            color: var(--bdl-brand-contrast);
            box-shadow: 0 6px 14px color-mix(in srgb, var(--bdl-brand-accent-deep) 28%, transparent);
        }

        .bdl-diag-btn.primary:hover {
            transform: translateY(-1px);
            box-shadow: 0 8px 18px color-mix(in srgb, var(--bdl-brand-accent-deep) 34%, transparent);
            background: linear-gradient(135deg, color-mix(in srgb, var(--bdl-brand-accent) 90%, white) 0%, var(--bdl-brand-accent) 100%);
        }

        .bdl-diag-btn.danger {
            color: var(--bdl-danger-text);
            border-color: var(--bdl-danger-border);
            background: var(--bdl-danger-bg);
        }

        .bdl-diag-btn.danger:hover {
            background: color-mix(in srgb, var(--bdl-danger-text) 22%, transparent);
        }

        .bdl-diag-toast {
            font-size: 12px;
            color: var(--bdl-success-text);
            padding: 4px 0;
            min-height: 20px;
        }

        .bdl-diag-toast.error { color: var(--bdl-danger-text); }

        @media (max-width: 720px) {
            .bdl-diag-card {
                width: calc(100vw - 20px);
                max-height: calc(100vh - 32px);
            }
            .bdl-diag-log {
                max-height: 200px;
            }
        }

        @media (max-width: 720px) {

            #bdl-entry[data-mode="floating"] {
                right: 16px;
                bottom: 92px;
            }

            #bdl-main-btn {
                padding: 0 10px;
            }

            .bdl-toolbar-text {
                display: none;
            }

            .bdl-popup {
                width: calc(100vw - 20px);
                max-height: calc(100vh - 24px);
                border-radius: 16px;
            }

            .bdl-body {
                max-height: calc(100vh - 100px);
            }
        }
    `;;
