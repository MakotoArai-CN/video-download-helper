export const STYLES = `
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
    `;;
