export const STYLES = `
        :host {
            all: initial;
            color-scheme: light;
            font-family: "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif;
            line-height: 1.4;
            -webkit-font-smoothing: antialiased;
            text-rendering: optimizeLegibility;
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
            background: linear-gradient(135deg, #00a1d6 0%, #0081b3 100%);
            border: none;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(0, 161, 214, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
        }

        #bdl-main-btn:hover {
            transform: scale(1.08) translateY(-2px);
            box-shadow: 0 6px 25px rgba(0, 161, 214, 0.6);
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
            background: linear-gradient(180deg, #fb7299 0%, #f25d8e 100%);
            transition: height 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            height: 0%;
            border-radius: 0 0 30px 30px;
            overflow: hidden;
            box-shadow: 0 -2px 10px rgba(251, 114, 153, 0.3) inset;
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
            background: #fff;
            border-radius: 16px;
            box-shadow: 0 10px 50px rgba(0, 0, 0, 0.2);
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
            background: linear-gradient(135deg, #00a1d6 0%, #0081b3 100%);
            color: white;
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
            background: #f8f9fa;
            border-radius: 12px;
            padding: 15px;
            margin-bottom: 18px;
        }

        .bdl-info-title {
            font-size: 15px;
            font-weight: 600;
            color: #333;
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
            color: #666;
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
            background: #ccc;
            color: #666;
        }

        .bdl-vip-badge.normal {
            background: #ff9eb5;
            color: white;
        }

        .bdl-vip-badge.vip {
            background: #fb7299;
            color: white;
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
            color: #444;
        }

        .bdl-pages-container {
            max-height: 200px;
            overflow-y: auto;
            border: 1px solid #e8e8e8;
            border-radius: 10px;
            padding: 10px;
            background: #fafafa;
        }

        .bdl-page-item {
            display: flex;
            align-items: center;
            padding: 10px;
            margin-bottom: 8px;
            border: 2px solid #e8e8e8;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
            background: white;
        }

        .bdl-page-item:last-child {
            margin-bottom: 0;
        }

        .bdl-page-item:hover {
            border-color: #00a1d6;
        }

        .bdl-page-item.active {
            border-color: #00a1d6;
            background: linear-gradient(135deg, rgba(0,161,214,0.08) 0%, rgba(0,129,179,0.08) 100%);
        }

        .bdl-page-checkbox {
            width: 18px;
            height: 18px;
            margin-right: 12px;
            cursor: pointer;
            accent-color: #00a1d6;
        }

        .bdl-page-info {
            flex: 1;
            min-width: 0;
        }

        .bdl-page-num {
            font-size: 12px;
            color: #999;
            margin-bottom: 3px;
        }

        .bdl-page-title {
            font-size: 13px;
            color: #333;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .bdl-page-duration {
            font-size: 12px;
            color: #999;
            margin-left: 10px;
        }

        .bdl-short-items-section {
            display: none;
        }

        .bdl-short-items-section.show {
            display: block;
        }

        .bdl-short-items {
            max-height: 180px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 10px;
            border: 1px solid #e8e8e8;
            border-radius: 10px;
            background: #fafafa;
        }

        .bdl-short-item {
            width: 100%;
            min-height: 44px;
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px;
            border: 2px solid #e8e8e8;
            border-radius: 10px;
            background: #fff;
            color: #333;
            cursor: pointer;
            text-align: left;
            transition: all 0.2s;
        }

        .bdl-short-item:hover {
            border-color: #00a1d6;
            color: #00a1d6;
        }

        .bdl-short-item.active {
            border-color: #00a1d6;
            background: linear-gradient(135deg, rgba(0,161,214,0.08) 0%, rgba(0,129,179,0.08) 100%);
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
            background: rgba(0, 161, 214, 0.1);
            color: #0081b3;
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

        .bdl-pages-actions {
            display: flex;
            gap: 10px;
            margin-top: 10px;
        }

        .bdl-pages-actions button {
            flex: 1;
            padding: 8px;
            border: 1px solid #00a1d6;
            border-radius: 6px;
            background: white;
            color: #00a1d6;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .bdl-pages-actions button:hover {
            background: #00a1d6;
            color: white;
        }

        .bdl-quality-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
        }

        .bdl-quality-btn {
            padding: 10px 8px;
            border: 2px solid #e8e8e8;
            border-radius: 10px;
            background: white;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
            text-align: center;
            color: #555;
        }

        .bdl-quality-btn:hover {
            border-color: #00a1d6;
            color: #00a1d6;
        }

        .bdl-quality-btn.active {
            border-color: #00a1d6;
            background: #00a1d6;
            color: white;
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
            color: #666;
            font-weight: 500;
        }

        .bdl-codec-select {
            padding: 8px 10px;
            border: 2px solid #e8e8e8;
            border-radius: 8px;
            background: white;
            font-size: 13px;
            color: #333;
            cursor: pointer;
            transition: all 0.2s;
        }

        .bdl-codec-select:hover {
            border-color: #00a1d6;
        }

        .bdl-codec-select:focus {
            outline: none;
            border-color: #00a1d6;
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
            border: 2px solid #e8e8e8;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s;
            background: white;
        }

        .bdl-method-item:hover {
            border-color: #00a1d6;
        }

        .bdl-method-item.active {
            border-color: #00a1d6;
            background: linear-gradient(135deg, rgba(0,161,214,0.08) 0%, rgba(0,129,179,0.08) 100%);
        }

        .bdl-method-radio {
            width: 20px;
            height: 20px;
            border: 2px solid #ccc;
            border-radius: 50%;
            margin-right: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }

        .bdl-method-item.active .bdl-method-radio {
            border-color: #00a1d6;
        }

        .bdl-method-item.active .bdl-method-radio::after {
            content: '';
            width: 10px;
            height: 10px;
            background: #00a1d6;
            border-radius: 50%;
        }

        .bdl-method-content {
            flex: 1;
        }

        .bdl-method-name {
            font-size: 14px;
            font-weight: 600;
            color: #333;
            margin-bottom: 3px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .bdl-method-desc {
            font-size: 12px;
            color: #888;
        }

        .bdl-method-status {
            font-size: 11px;
            padding: 3px 8px;
            border-radius: 10px;
            font-weight: 500;
        }

        .bdl-method-status.ready {
            background: #d4edda;
            color: #155724;
        }

        .bdl-method-status.loading {
            background: #fff3cd;
            color: #856404;
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
            border: 2px solid #e8e8e8;
            border-radius: 8px;
            background: white;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
        }

        .bdl-extra-btn:hover {
            border-color: #00a1d6;
            color: #00a1d6;
        }

        .bdl-progress-section {
            background: #f8f9fa;
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
            color: #555;
            font-weight: 500;
        }

        .bdl-progress-value {
            color: #888;
        }

        .bdl-progress-track {
            height: 10px;
            background: #e0e0e0;
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
            background: linear-gradient(90deg, #fb7299, #ff9eb5);
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
            background: linear-gradient(90deg, #fb7299, #ff9eb5);
        }

        .bdl-progress-bar.audio {
            background: linear-gradient(90deg, #00a1d6, #66d4ff);
        }

        .bdl-progress-bar.merge {
            background: linear-gradient(90deg, #fb7299, #00a1d6);
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
            background: #e6f7ff;
            border: 1px solid #91d5ff;
            color: #0050b3;
        }

        .bdl-alert.success {
            background: #fff0f6;
            border: 1px solid #ffadd2;
            color: #c41d7f;
        }

        .bdl-alert.warning {
            background: #fffbe6;
            border: 1px solid #ffe58f;
            color: #ad6800;
        }

        .bdl-alert.error {
            background: #fff1f0;
            border: 1px solid #ffa39e;
            color: #cf1322;
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
            background: linear-gradient(135deg, #00a1d6 0%, #0081b3 100%);
            color: white;
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
            box-shadow: 0 5px 20px rgba(0, 161, 214, 0.4);
        }

        .bdl-download-btn:disabled {
            background: linear-gradient(135deg, #ccc 0%, #aaa 100%);
            cursor: not-allowed;
            transform: none;
        }

        .bdl-footer {
            text-align: center;
            padding: 15px 20px;
            background: #f8f9fa;
            font-size: 12px;
            color: #999;
            line-height: 1.6;
            cursor: pointer;
            user-select: none;
            transition: all 0.2s;
        }

        .bdl-footer:hover {
            background: #f0f1f2;
            color: #666;
        }

        .bdl-tips {
            background: #fffbe6;
            border: 1px solid #ffe58f;
            border-radius: 10px;
            padding: 12px 15px;
            margin-bottom: 18px;
            font-size: 12px;
            color: #ad6800;
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
            border: 2px solid #fff;
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
            background: radial-gradient(circle at center, rgba(251, 114, 153, 0.15) 0%, rgba(0, 161, 214, 0.15) 100%);
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
            background: linear-gradient(135deg, #fb7299 0%, #f25d8e 50%, #00a1d6 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: bdlIconPop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            box-shadow: 
                0 20px 60px rgba(251, 114, 153, 0.4),
                0 0 0 0 rgba(251, 114, 153, 0.4);
            position: relative;
            z-index: 2;
        }

        .bdl-complete-icon::before {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: 50%;
            background: linear-gradient(135deg, #fb7299 0%, #00a1d6 100%);
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
                box-shadow: 0 0 0 0 rgba(251, 114, 153, 0.7);
            }
            50% {
                box-shadow: 0 0 0 30px rgba(251, 114, 153, 0);
            }
        }

        .bdl-complete-icon svg {
            width: 80px;
            height: 80px;
            fill: none;
            stroke: white;
            stroke-width: 5;
            stroke-linecap: round;
            stroke-linejoin: round;
            filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.2));
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
            border: 3px solid #fb7299;
            animation: bdlRippleOut 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
            z-index: 1;
        }

        .bdl-complete-ripple:nth-child(2) {
            border-color: #00a1d6;
            animation-delay: 0.15s;
        }

        .bdl-complete-ripple:nth-child(3) {
            border-color: #fb7299;
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
            animation: bdlParticleFly 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
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
            background: linear-gradient(135deg, #fb7299 0%, #00a1d6 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            text-shadow: 0 2px 20px rgba(251, 114, 153, 0.3);
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
            background: linear-gradient(135deg, #fb7299, #00a1d6);
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

        #bdl-panel,
        #bdl-entry {
            --bdl-brand: #fb7299;
            --bdl-brand-deep: #e85f8c;
            --bdl-brand-soft: rgba(251, 114, 153, 0.12);
            --bdl-border: rgba(24, 25, 28, 0.08);
            --bdl-border-strong: rgba(24, 25, 28, 0.12);
            --bdl-text: #18191c;
            --bdl-subtext: #61666d;
            --bdl-soft-text: #9499a0;
            --bdl-surface: #f6f7f8;
            --bdl-surface-strong: #f1f2f3;
            font-family: "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif;
        }

        #bdl-entry {
            display: none;
            flex: none;
            position: relative;
            margin-right: 16px;
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
            color: var(--bdl-subtext);
            font-size: 13px;
            font-weight: 500;
            overflow: hidden;
        }

        #bdl-entry[data-mode="bangumi"] #bdl-main-btn {
            height: 30px;
            padding: 0 12px 0 8px;
        }

        /* 浮动按钮：做成克制的深色半透明胶囊，默认低透明度，
           hover 才完全显现。目的是「在场但不抢戏」——
           短视频站点多为深色界面，粉色渐变按钮会非常突兀。 */
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

        /* 下载进行中必须清晰可见，不再压低透明度 */
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
            border-color: rgba(251, 114, 153, 0.2);
        }

        #bdl-main-btn:active {
            transform: scale(0.98);
        }

        #bdl-main-btn[aria-expanded="true"] {
            color: var(--bdl-brand);
            background: var(--bdl-brand-soft);
            border-color: rgba(251, 114, 153, 0.22);
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
            /* 继承站点字体，避免字形不一致露馅 */
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
            background: var(--bdl-skin-color-hover, #00aeec);
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
            background: #fff;
            box-shadow: 0 24px 56px rgba(0, 0, 0, 0.18);
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
            background: linear-gradient(180deg, rgba(251, 114, 153, 0.12) 0%, rgba(251, 114, 153, 0.04) 100%);
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
            background: rgba(24, 25, 28, 0.05);
            color: var(--bdl-subtext);
            border-radius: 50%;
        }

        .bdl-close:hover {
            background: rgba(251, 114, 153, 0.12);
            color: var(--bdl-brand);
            transform: none;
        }

        .bdl-body {
            padding: 16px 18px 18px;
            max-height: min(70vh, 660px);
            overflow-y: auto;
            background: #fff;
        }

        .bdl-body::-webkit-scrollbar,
        .bdl-pages-container::-webkit-scrollbar {
            width: 6px;
        }

        .bdl-body::-webkit-scrollbar-thumb,
        .bdl-pages-container::-webkit-scrollbar-thumb {
            background: rgba(24, 25, 28, 0.14);
            border-radius: 999px;
        }

        .bdl-info-card {
            background: linear-gradient(180deg, #fff 0%, #fafbfc 100%);
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
            color: var(--bdl-subtext);
        }

        .bdl-info-meta-item {
            gap: 6px;
            padding: 6px 10px;
            border-radius: 999px;
            background: #fff;
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
            background: rgba(251, 114, 153, 0.12);
            color: var(--bdl-brand-deep);
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
            background: rgba(251, 114, 153, 0.12);
            color: var(--bdl-brand-deep);
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
            color: var(--bdl-soft-text);
        }

        .bdl-pages-container {
            max-height: 208px;
            padding: 10px;
            border: 1px solid var(--bdl-border);
            border-radius: 14px;
            background: var(--bdl-surface);
        }

        .bdl-page-item {
            padding: 11px 12px;
            margin-bottom: 8px;
            border: 1px solid transparent;
            border-radius: 12px;
            background: #fff;
        }

        .bdl-page-item:hover {
            border-color: rgba(251, 114, 153, 0.24);
            background: rgba(251, 114, 153, 0.04);
        }

        .bdl-page-item.active {
            border-color: rgba(251, 114, 153, 0.28);
            background: rgba(251, 114, 153, 0.08);
        }

        .bdl-page-checkbox {
            accent-color: var(--bdl-brand);
        }

        .bdl-page-num,
        .bdl-page-duration {
            color: var(--bdl-soft-text);
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
            background: #fff;
            color: var(--bdl-subtext);
        }

        .bdl-pages-actions button {
            padding: 9px 8px;
            color: var(--bdl-subtext);
        }

        .bdl-pages-actions button:hover,
        .bdl-quality-btn:hover,
        .bdl-extra-btn:hover {
            background: var(--bdl-brand-soft);
            border-color: rgba(251, 114, 153, 0.24);
            color: var(--bdl-brand);
        }

        .bdl-quality-grid {
            gap: 8px;
        }

        .bdl-quality-btn {
            min-height: 40px;
            border-width: 1px;
            color: var(--bdl-subtext);
        }

        .bdl-quality-btn.active {
            border-color: transparent;
            background: var(--bdl-brand);
            color: #fff;
        }

        .bdl-codec-label {
            color: var(--bdl-subtext);
        }

        .bdl-codec-select {
            min-height: 40px;
            border-width: 1px;
            color: var(--bdl-text);
        }

        .bdl-codec-select:hover,
        .bdl-codec-select:focus {
            border-color: rgba(251, 114, 153, 0.24);
        }

        .bdl-method-item {
            padding: 12px 14px;
            border-width: 1px;
            border-radius: 14px;
            background: #fff;
        }

        .bdl-method-item:hover {
            border-color: rgba(251, 114, 153, 0.24);
        }

        .bdl-method-item.active {
            border-color: rgba(251, 114, 153, 0.3);
            background: rgba(251, 114, 153, 0.06);
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
            color: var(--bdl-soft-text);
        }

        .bdl-method-status.ready {
            background: rgba(35, 173, 100, 0.12);
            color: #1f8a57;
        }

        .bdl-method-status.loading {
            background: rgba(255, 184, 72, 0.16);
            color: #b06f00;
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
            background: rgba(251, 114, 153, 0.12);
            color: var(--bdl-brand-deep);
            font-size: 11px;
            font-weight: 600;
        }

        .bdl-progress-section {
            padding: 14px;
            border: 1px solid var(--bdl-border);
            border-radius: 16px;
            background: linear-gradient(180deg, #fff 0%, #fafbfc 100%);
            margin-bottom: 16px;
        }

        .bdl-progress-label {
            color: var(--bdl-subtext);
        }

        .bdl-progress-track {
            background: rgba(24, 25, 28, 0.08);
        }

        .bdl-alert {
            border-radius: 14px;
            margin-bottom: 16px;
        }

        .bdl-download-btn {
            min-height: 46px;
            border-radius: 14px;
            background: linear-gradient(180deg, #fb7299 0%, #f46290 100%);
            box-shadow: 0 10px 24px rgba(251, 114, 153, 0.22);
        }

        .bdl-download-btn:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 12px 28px rgba(251, 114, 153, 0.28);
        }

        .bdl-footer {
            padding: 12px 18px 16px;
            background: #fff;
            border-top: 1px solid var(--bdl-border);
            color: var(--bdl-soft-text);
            cursor: default;
        }

        .bdl-footer:hover {
            background: #fff;
            color: var(--bdl-soft-text);
        }

        .bdl-tips {
            border-radius: 14px;
            margin-bottom: 16px;
        }

        .bdl-tips-title {
            gap: 0;
            color: #8a5a00;
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
            background: rgba(0, 0, 0, 0.05);
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
            background: #fff;
            border-radius: 16px;
            box-shadow: 0 24px 60px rgba(0, 0, 0, 0.28);
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
            border-bottom: 1px solid #eef0f3;
            background: linear-gradient(180deg, #fafbfc 0%, #fff 100%);
        }

        .bdl-diag-title {
            font-size: 15px;
            font-weight: 600;
            color: #1f2937;
        }

        .bdl-diag-close {
            background: none;
            border: none;
            font-size: 22px;
            line-height: 1;
            color: #6b7280;
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 8px;
        }

        .bdl-diag-close:hover {
            background: rgba(0, 0, 0, 0.05);
            color: #1f2937;
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
            color: #6b7280;
            line-height: 1.6;
        }

        .bdl-diag-note-label {
            font-size: 12px;
            font-weight: 600;
            color: #374151;
        }

        .bdl-diag-note {
            width: 100%;
            min-height: 72px;
            resize: vertical;
            padding: 10px 12px;
            border: 1px solid #d1d5db;
            border-radius: 10px;
            font: inherit;
            font-size: 13px;
            color: #111827;
            background: #fff;
            outline: none;
            transition: border-color 0.15s, box-shadow 0.15s;
        }

        .bdl-diag-note:focus {
            border-color: #00a1d6;
            box-shadow: 0 0 0 3px rgba(0, 161, 214, 0.16);
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
            border: 1px solid #d1d5db;
            background: #fff;
            color: #1f2937;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.15s, border-color 0.15s, color 0.15s;
        }

        .bdl-diag-btn:hover {
            background: #f3f4f6;
            border-color: #9ca3af;
        }

        .bdl-diag-btn.primary {
            background: linear-gradient(135deg, #00a1d6 0%, #0081b3 100%);
            border-color: transparent;
            color: #fff;
            box-shadow: 0 6px 14px rgba(0, 129, 179, 0.28);
        }

        .bdl-diag-btn.primary:hover {
            transform: translateY(-1px);
            box-shadow: 0 8px 18px rgba(0, 129, 179, 0.34);
            background: linear-gradient(135deg, #00b1e6 0%, #008fc0 100%);
        }

        .bdl-diag-btn.danger {
            color: #b91c1c;
            border-color: #fca5a5;
            background: #fff5f5;
        }

        .bdl-diag-btn.danger:hover {
            background: #fee2e2;
        }

        .bdl-diag-toast {
            font-size: 12px;
            color: #047857;
            padding: 4px 0;
            min-height: 20px;
        }

        .bdl-diag-toast.error { color: #b91c1c; }

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
            #bdl-entry {
                margin-right: 10px;
            }

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
