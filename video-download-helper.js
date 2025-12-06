// ==UserScript==
// @name         视频下载助手 - 哔哩哔哩
// @namespace    https://github.com/MakotoArai-CN/video-download-helper
// @version      0.1.1
// @description  纯本地的视频下载器，使用原生JavaScript对视频音频进行合并并输出，支持登录账号可以观看的最高分辨率视频下载（非破解，下载的清晰度等取决于账号权限），脚本仅供学习研究使用。
// @author       Makoto
// @match        *://www.bilibili.com/video/*
// @match        *://www.bilibili.com/bangumi/play/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @icon         https://www.bilibili.com/favicon.ico
// @grant        unsafeWindow
// @connect      api.bilibili.com
// @connect      bilivideo.com
// @connect      bilivideo.cn
// @connect      bilivideo.net
// @connect      akamaized.net
// @connect      *
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    const LEARNING_DISCLAIMER = '本视频通过学习工具下载，仅供个人学习研究使用，请勿用于商业用途，请支持正版内容创作者。';

    const CONFIG = {
        QUALITY_MAP: {
            127: '8K 超高清',
            126: '杜比视界',
            125: 'HDR 真彩色',
            120: '4K 超清',
            116: '1080P 60帧',
            112: '1080P 高码率',
            80: '1080P 高清',
            74: '720P 60帧',
            64: '720P 高清',
            32: '480P 清晰',
            16: '360P 流畅'
        },
        MERGE_METHODS: {
            JSMERGE: 'js-merge',
            SEPARATE: 'separate'
        }
    };

    const STYLES = `
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
    `;

    const Utils = {
        getVideoId: function () {
            var pathname = window.location.pathname;
            var bvidMatch = pathname.match(/\/video\/(BV[\w]+)/i);
            if (bvidMatch) {
                return { type: 'video', id: bvidMatch[1] };
            }

            var epMatch = pathname.match(/\/bangumi\/play\/ep(\d+)/i);
            if (epMatch) {
                return { type: 'bangumi', id: 'ep' + epMatch[1] };
            }

            var ssMatch = pathname.match(/\/bangumi\/play\/ss(\d+)/i);
            if (ssMatch) {
                return { type: 'bangumi', id: 'ss' + ssMatch[1] };
            }

            return null;
        },

        getCurrentPage: function () {
            var urlParams = new URLSearchParams(window.location.search);
            return parseInt(urlParams.get('p')) || 1;
        },

        formatDuration: function (seconds) {
            if (!seconds) return '00:00';
            var h = Math.floor(seconds / 3600);
            var m = Math.floor((seconds % 3600) / 60);
            var s = Math.floor(seconds % 60);
            if (h > 0) {
                return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
            }
            return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
        },

        formatBytes: function (bytes) {
            if (!bytes) return '0 B';
            var k = 1024;
            var sizes = ['B', 'KB', 'MB', 'GB'];
            var i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        },

        sanitizeFilename: function (filename) {
            return filename
                .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
                .replace(/\s+/g, ' ')
                .trim()
                .substring(0, 180);
        },

        delay: function (ms) {
            return new Promise(function (resolve) {
                setTimeout(resolve, ms);
            });
        }
    };

    const Network = {
        fetchJSON: function (url) {
            return new Promise(function (resolve, reject) {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    headers: {
                        'Referer': 'https://www.bilibili.com',
                        'User-Agent': navigator.userAgent
                    },
                    responseType: 'json',
                    onload: function (res) {
                        if (res.status >= 200 && res.status < 300) {
                            var data = res.response;
                            if (typeof data === 'string') {
                                data = JSON.parse(data);
                            }
                            resolve(data);
                        } else {
                            reject(new Error('HTTP ' + res.status));
                        }
                    },
                    onerror: function () {
                        reject(new Error('网络错误'));
                    },
                    ontimeout: function () {
                        reject(new Error('请求超时'));
                    }
                });
            });
        },

        downloadBuffer: function (url, onProgress) {
            return new Promise(function (resolve, reject) {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    headers: {
                        'Referer': 'https://www.bilibili.com',
                        'Origin': 'https://www.bilibili.com',
                        'User-Agent': navigator.userAgent
                    },
                    responseType: 'arraybuffer',
                    onprogress: function (e) {
                        if (e.lengthComputable && onProgress) {
                            onProgress(e.loaded, e.total);
                        }
                    },
                    onload: function (res) {
                        if (res.status >= 200 && res.status < 300) {
                            resolve(res.response);
                        } else {
                            reject(new Error('下载失败: ' + res.status));
                        }
                    },
                    onerror: function () {
                        reject(new Error('下载网络错误'));
                    },
                    ontimeout: function () {
                        reject(new Error('下载超时'));
                    }
                });
            });
        }
    };

    const BiliAPI = {
        getVideoInfo: function (bvid) {
            return Network.fetchJSON('https://api.bilibili.com/x/web-interface/view?bvid=' + bvid).then(function (res) {
                if (res.code !== 0) {
                    throw new Error(res.message || '获取视频信息失败');
                }
                return res.data;
            });
        },

        getBangumiInfo: function (videoId) {
            var self = this;
            var isEp = videoId.indexOf('ep') === 0;
            var id = videoId.replace(/^(ep|ss)/, '');
            var url = 'https://api.bilibili.com/pgc/view/web/season?';
            if (isEp) {
                url += 'ep_id=' + id;
            } else {
                url += 'season_id=' + id;
            }

            return Network.fetchJSON(url).then(function (res) {
                if (res.code !== 0) {
                    throw new Error(res.message || '获取番剧信息失败');
                }

                var result = res.result;
                var episodes = result.episodes || [];
                var pages = [];
                var currentEpId = null;

                if (isEp) {
                    currentEpId = parseInt(id);
                } else {
                    var urlMatch = window.location.pathname.match(/ep(\d+)/);
                    if (urlMatch) {
                        currentEpId = parseInt(urlMatch[1]);
                    }
                }

                for (var i = 0; i < episodes.length; i++) {
                    var ep = episodes[i];
                    pages.push({
                        cid: ep.cid,
                        page: i + 1,
                        part: ep.long_title || ep.title || ('第' + (i + 1) + '集'),
                        duration: ep.duration / 1000,
                        ep_id: ep.id,
                        bvid: ep.bvid
                    });
                }

                var currentIndex = 0;
                if (currentEpId) {
                    for (var j = 0; j < pages.length; j++) {
                        if (pages[j].ep_id === currentEpId) {
                            currentIndex = j;
                            break;
                        }
                    }
                }

                var totalDuration = 0;
                for (var k = 0; k < episodes.length; k++) {
                    totalDuration += episodes[k].duration / 1000;
                }

                return {
                    title: result.season_title || result.title,
                    pages: pages,
                    owner: {
                        name: result.up_info ? result.up_info.uname : '番剧'
                    },
                    duration: totalDuration,
                    desc: result.evaluate || '',
                    currentPage: currentIndex + 1,
                    type: 'bangumi'
                };
            });
        },

        getPlayUrl: function (params) {
            var url;
            if (params.type === 'bangumi') {
                url = 'https://api.bilibili.com/pgc/player/web/playurl?ep_id=' + params.ep_id + '&cid=' + params.cid + '&qn=' + params.qn + '&fnval=4048&fnver=0&fourk=1';
            } else {
                url = 'https://api.bilibili.com/x/player/playurl?bvid=' + params.bvid + '&cid=' + params.cid + '&qn=' + params.qn + '&fnval=4048&fnver=0&fourk=1';
            }

            return Network.fetchJSON(url).then(function (res) {
                if (res.code !== 0) {
                    throw new Error(res.message || '获取播放地址失败');
                }
                return res.result || res.data;
            });
        },

        getAvailableQualities: function (playData) {
            var list = [];
            if (playData.accept_quality && playData.accept_description) {
                for (var i = 0; i < playData.accept_quality.length; i++) {
                    list.push({
                        qn: playData.accept_quality[i],
                        desc: playData.accept_description[i] || CONFIG.QUALITY_MAP[playData.accept_quality[i]] || playData.accept_quality[i] + 'P'
                    });
                }
            }
            return list;
        },

        getStreams: function (playData, targetQn) {
            var dash = playData.dash;
            if (!dash) {
                throw new Error('该视频不支持DASH格式');
            }

            var video = null;
            var audio = null;

            if (dash.video && dash.video.length > 0) {
                var sortedVideo = dash.video.slice().sort(function (a, b) {
                    if (b.id !== a.id) return b.id - a.id;
                    return b.bandwidth - a.bandwidth;
                });
                for (var i = 0; i < sortedVideo.length; i++) {
                    if (sortedVideo[i].id === targetQn) {
                        video = sortedVideo[i];
                        break;
                    }
                }
                if (!video) {
                    for (var j = 0; j < sortedVideo.length; j++) {
                        if (sortedVideo[j].id <= targetQn) {
                            video = sortedVideo[j];
                            break;
                        }
                    }
                }
                if (!video) {
                    video = sortedVideo[sortedVideo.length - 1];
                }
            }

            if (dash.audio && dash.audio.length > 0) {
                var sortedAudio = dash.audio.slice().sort(function (a, b) {
                    return b.bandwidth - a.bandwidth;
                });
                audio = sortedAudio[0];
            }

            if (dash.dolby && dash.dolby.audio && dash.dolby.audio[0]) {
                var dolby = dash.dolby.audio[0];
                if (!audio || dolby.bandwidth > audio.bandwidth) {
                    audio = dolby;
                }
            }

            if (dash.flac && dash.flac.audio) {
                if (!audio || dash.flac.audio.bandwidth > audio.bandwidth) {
                    audio = dash.flac.audio;
                }
            }

            return { video: video, audio: audio };
        }
    };

    const JSMerger = {
        name: 'JS原生合并',
        status: 'ready',

        readBox: function (buffer, offset) {
            var view = new DataView(buffer);
            if (offset + 8 > buffer.byteLength) return null;

            var size = view.getUint32(offset);
            var type = String.fromCharCode(
                view.getUint8(offset + 4),
                view.getUint8(offset + 5),
                view.getUint8(offset + 6),
                view.getUint8(offset + 7)
            );

            var headerSize = 8;
            if (size === 1 && offset + 16 <= buffer.byteLength) {
                size = Number(view.getBigUint64(offset + 8));
                headerSize = 16;
            } else if (size === 0) {
                size = buffer.byteLength - offset;
            }

            return { size: size, type: type, headerSize: headerSize, offset: offset };
        },

        parseBoxes: function (buffer) {
            var boxes = [];
            var offset = 0;
            while (offset < buffer.byteLength) {
                var box = this.readBox(buffer, offset);
                if (!box || box.size < 8) break;
                boxes.push({
                    size: box.size,
                    type: box.type,
                    headerSize: box.headerSize,
                    offset: box.offset,
                    data: new Uint8Array(buffer, offset, box.size)
                });
                offset += box.size;
            }
            return boxes;
        },

        findBox: function (boxes, type) {
            for (var i = 0; i < boxes.length; i++) {
                if (boxes[i].type === type) {
                    return boxes[i];
                }
            }
            return null;
        },

        findAllBoxes: function (boxes, type) {
            var result = [];
            for (var i = 0; i < boxes.length; i++) {
                if (boxes[i].type === type) {
                    result.push(boxes[i]);
                }
            }
            return result;
        },

        parseContainerBox: function (boxData, headerOffset) {
            if (headerOffset === undefined) {
                headerOffset = 8;
            }
            var childBoxes = [];
            var offset = headerOffset;
            while (offset < boxData.length) {
                if (offset + 8 > boxData.length) break;
                var view = new DataView(boxData.buffer, boxData.byteOffset + offset);
                var size = view.getUint32(0);
                var type = String.fromCharCode(
                    boxData[offset + 4],
                    boxData[offset + 5],
                    boxData[offset + 6],
                    boxData[offset + 7]
                );
                if (size === 0) size = boxData.length - offset;
                if (size < 8 || offset + size > boxData.length) break;

                childBoxes.push({
                    size: size,
                    type: type,
                    offset: offset,
                    data: boxData.slice(offset, offset + size)
                });
                offset += size;
            }
            return childBoxes;
        },

        createBox: function (type, content) {
            var size = 8 + content.length;
            var box = new Uint8Array(size);
            var view = new DataView(box.buffer);
            view.setUint32(0, size);
            box[4] = type.charCodeAt(0);
            box[5] = type.charCodeAt(1);
            box[6] = type.charCodeAt(2);
            box[7] = type.charCodeAt(3);
            box.set(content, 8);
            return box;
        },

        concat: function () {
            var arrays = Array.prototype.slice.call(arguments);
            var totalLen = 0;
            for (var i = 0; i < arrays.length; i++) {
                totalLen += arrays[i].length;
            }
            var result = new Uint8Array(totalLen);
            var offset = 0;
            for (var j = 0; j < arrays.length; j++) {
                result.set(arrays[j], offset);
                offset += arrays[j].length;
            }
            return result;
        },

        modifyTrackId: function (trakData, newId) {
            var result = new Uint8Array(trakData);
            var trakBoxes = this.parseContainerBox(result);

            for (var i = 0; i < trakBoxes.length; i++) {
                var box = trakBoxes[i];
                if (box.type === 'tkhd') {
                    var version = result[box.offset + 8];
                    var trackIdOffset = box.offset + 8 + (version === 0 ? 12 : 20);
                    var view = new DataView(result.buffer, result.byteOffset + trackIdOffset);
                    view.setUint32(0, newId);
                }
            }
            return result;
        },

        modifyTrexTrackId: function (trexData, newId) {
            var result = new Uint8Array(trexData);
            var view = new DataView(result.buffer, result.byteOffset + 12);
            view.setUint32(0, newId);
            return result;
        },

        getTrackType: function (trakData) {
            var boxes = this.parseContainerBox(trakData);
            for (var i = 0; i < boxes.length; i++) {
                var box = boxes[i];
                if (box.type === 'mdia') {
                    var mdiaBoxes = this.parseContainerBox(box.data);
                    for (var j = 0; j < mdiaBoxes.length; j++) {
                        var mdiaBox = mdiaBoxes[j];
                        if (mdiaBox.type === 'hdlr') {
                            var handlerType = String.fromCharCode(
                                mdiaBox.data[16],
                                mdiaBox.data[17],
                                mdiaBox.data[18],
                                mdiaBox.data[19]
                            );
                            return handlerType;
                        }
                    }
                }
            }
            return null;
        },

        buildMoov: function (videoMoov, audioMoov, metadata) {
            var videoMoovBoxes = this.parseContainerBox(videoMoov.data);
            var audioMoovBoxes = this.parseContainerBox(audioMoov.data);

            var mvhd = this.findBox(videoMoovBoxes, 'mvhd');
            if (!mvhd) throw new Error('找不到mvhd box');

            var videoTrak = null;
            for (var i = 0; i < videoMoovBoxes.length; i++) {
                var vbox = videoMoovBoxes[i];
                if (vbox.type === 'trak') {
                    var trackType = this.getTrackType(vbox.data);
                    if (trackType === 'vide') {
                        videoTrak = vbox;
                        break;
                    }
                }
            }

            var audioTrak = null;
            for (var j = 0; j < audioMoovBoxes.length; j++) {
                var abox = audioMoovBoxes[j];
                if (abox.type === 'trak') {
                    var aTrackType = this.getTrackType(abox.data);
                    if (aTrackType === 'soun') {
                        audioTrak = abox;
                        break;
                    }
                }
            }

            if (!videoTrak) throw new Error('找不到视频轨道');

            var videoTrakData = this.modifyTrackId(videoTrak.data, 1);
            var audioTrakData = null;
            if (audioTrak) {
                audioTrakData = this.modifyTrackId(audioTrak.data, 2);
            }

            var mvhdData = new Uint8Array(mvhd.data);
            var mvhdVersion = mvhdData[8];
            var nextTrackIdOffset = mvhdVersion === 0 ? 8 + 96 : 8 + 108;
            var mvhdView = new DataView(mvhdData.buffer, mvhdData.byteOffset + nextTrackIdOffset - 4);
            mvhdView.setUint32(0, audioTrakData ? 3 : 2);

            var videoMvex = this.findBox(videoMoovBoxes, 'mvex');
            var audioMvex = this.findBox(audioMoovBoxes, 'mvex');
            var mvexData = null;

            if (videoMvex || audioMvex) {
                mvexData = this.buildMvex(videoMvex, audioMvex);
            }

            var udtaContent = this.buildUdta(metadata);

            var moovParts = [mvhdData, videoTrakData];
            if (audioTrakData) {
                moovParts.push(audioTrakData);
            }
            if (mvexData) {
                moovParts.push(mvexData);
            }
            moovParts.push(udtaContent);

            var moovContent = this.concat.apply(this, moovParts);
            return this.createBox('moov', moovContent);
        },

        buildMvex: function (videoMvex, audioMvex) {
            var mvexParts = [];

            if (videoMvex) {
                var videoMvexBoxes = this.parseContainerBox(videoMvex.data);
                for (var i = 0; i < videoMvexBoxes.length; i++) {
                    var box = videoMvexBoxes[i];
                    if (box.type === 'trex') {
                        var modifiedTrex = this.modifyTrexTrackId(box.data, 1);
                        mvexParts.push(modifiedTrex);
                    } else if (box.type === 'mehd') {
                        mvexParts.push(box.data);
                    }
                }
            }

            if (audioMvex) {
                var audioMvexBoxes = this.parseContainerBox(audioMvex.data);
                for (var j = 0; j < audioMvexBoxes.length; j++) {
                    var abox = audioMvexBoxes[j];
                    if (abox.type === 'trex') {
                        var modifiedAudioTrex = this.modifyTrexTrackId(abox.data, 2);
                        mvexParts.push(modifiedAudioTrex);
                    }
                }
            }

            if (mvexParts.length > 0) {
                var mvexContent = this.concat.apply(this, mvexParts);
                return this.createBox('mvex', mvexContent);
            }

            return null;
        },

        buildUdta: function (metadata) {
            var encoder = new TextEncoder();
            var self = this;

            var buildDataBox = function (value) {
                if (!value) return null;
                var valueBytes = encoder.encode(value);
                var payload = new Uint8Array(8 + valueBytes.length);
                var view = new DataView(payload.buffer);
                view.setUint32(0, 1);
                view.setUint32(4, 0);
                payload.set(valueBytes, 8);
                return self.createBox('data', payload);
            };

            var buildMetaTag = function (tag, value) {
                if (!value) return new Uint8Array(0);
                var dataBox = buildDataBox(value);
                if (!dataBox) return new Uint8Array(0);
                return self.createBox(tag, dataBox);
            };

            var titleTag = buildMetaTag('\xa9nam', metadata.title);
            var artistTag = buildMetaTag('\xa9ART', metadata.author);
            var albumTag = buildMetaTag('\xa9alb', 'Bilibili');
            var yearTag = buildMetaTag('\xa9day', new Date().getFullYear().toString());
            var commentText = metadata.description ? (metadata.description + '\n\n' + LEARNING_DISCLAIMER) : LEARNING_DISCLAIMER;
            var commentTag = buildMetaTag('\xa9cmt', commentText);
            var encoderTag = buildMetaTag('\xa9too', 'Bilibili Video Downloader');

            var ilstContent = self.concat(
                titleTag,
                artistTag,
                albumTag,
                yearTag,
                commentTag,
                encoderTag
            );

            var ilstBox = self.createBox('ilst', ilstContent);

            var hdlrContent = new Uint8Array(24);
            var hdlrView = new DataView(hdlrContent.buffer);
            hdlrView.setUint32(0, 0);
            hdlrView.setUint32(4, 0);
            hdlrContent.set([0x6d, 0x64, 0x69, 0x72], 8);
            hdlrContent.set([0x61, 0x70, 0x70, 0x6c], 12);
            hdlrView.setUint32(16, 0);
            hdlrView.setUint32(20, 0);

            var hdlrBox = self.createBox('hdlr', hdlrContent);

            var metaContent = self.concat(
                new Uint8Array([0, 0, 0, 0]),
                hdlrBox,
                ilstBox
            );

            var metaBox = self.createBox('meta', metaContent);
            return self.createBox('udta', metaBox);
        },

        merge: function (videoBuffer, audioBuffer, metadata) {
            var self = this;
            return new Promise(function (resolve, reject) {
                try {
                    var videoBoxes = self.parseBoxes(videoBuffer);
                    var audioBoxes = self.parseBoxes(audioBuffer);

                    var videoFtyp = self.findBox(videoBoxes, 'ftyp');
                    var videoMoov = self.findBox(videoBoxes, 'moov');
                    var videoMdat = self.findAllBoxes(videoBoxes, 'mdat');
                    var videoMoof = self.findAllBoxes(videoBoxes, 'moof');

                    var audioMoov = self.findBox(audioBoxes, 'moov');
                    var audioMdat = self.findAllBoxes(audioBoxes, 'mdat');
                    var audioMoof = self.findAllBoxes(audioBoxes, 'moof');

                    if (!videoFtyp || !videoMoov) {
                        throw new Error('视频文件结构不完整');
                    }

                    var isFragmented = videoMoof.length > 0 || audioMoof.length > 0;

                    if (isFragmented) {
                        console.log('检测到fMP4格式');

                        var parts = [videoFtyp.data];

                        if (audioMoov) {
                            var newMoov = self.buildMoov(videoMoov, audioMoov, metadata);
                            parts.push(newMoov);
                        } else {
                            parts.push(videoMoov.data);
                        }

                        for (var i = 0; i < videoMoof.length; i++) {
                            parts.push(videoMoof[i].data);
                            if (videoMdat[i]) {
                                parts.push(videoMdat[i].data);
                            }
                        }

                        for (var j = 0; j < audioMoof.length; j++) {
                            var modifiedMoof = self.modifyMoofTrackId(audioMoof[j].data, 2);
                            parts.push(modifiedMoof);
                            if (audioMdat[j]) {
                                parts.push(audioMdat[j].data);
                            }
                        }

                        resolve(self.concat.apply(self, parts).buffer);
                    } else {
                        var mergedMoov;
                        if (audioMoov) {
                            mergedMoov = self.buildMoov(videoMoov, audioMoov, metadata);
                        } else {
                            mergedMoov = videoMoov.data;
                        }

                        var allMdat = [];
                        for (var k = 0; k < videoMdat.length; k++) {
                            allMdat.push(videoMdat[k].data);
                        }
                        if (audioMdat.length > 0) {
                            for (var l = 0; l < audioMdat.length; l++) {
                                allMdat.push(audioMdat[l].data);
                            }
                        }

                        var mdatParts = [];
                        for (var m = 0; m < allMdat.length; m++) {
                            mdatParts.push(allMdat[m].slice(8));
                        }
                        var mdatContent = self.concat.apply(self, mdatParts);
                        var mergedMdat = self.createBox('mdat', mdatContent);

                        resolve(self.concat(videoFtyp.data, mergedMoov, mergedMdat).buffer);
                    }
                } catch (error) {
                    console.error('JS合并失败:', error);
                    reject(error);
                }
            });
        },

        modifyMoofTrackId: function (moofData, newId) {
            var result = new Uint8Array(moofData);
            var boxes = this.parseContainerBox(result);

            for (var i = 0; i < boxes.length; i++) {
                var box = boxes[i];
                if (box.type === 'traf') {
                    var trafBoxes = this.parseContainerBox(box.data);
                    for (var j = 0; j < trafBoxes.length; j++) {
                        var trafBox = trafBoxes[j];
                        if (trafBox.type === 'tfhd') {
                            var offset = box.offset + trafBox.offset + 12;
                            var view = new DataView(result.buffer, result.byteOffset + offset);
                            view.setUint32(0, newId);
                        }
                    }
                }
            }
            return result;
        }
    };

    const MergeManager = {
        currentMethod: CONFIG.MERGE_METHODS.JSMERGE,

        methods: {
            'js-merge': {
                name: 'JS原生合并',
                desc: '浏览器内直接合并，兼容性好',
                handler: JSMerger,
                recommended: true
            },
            'separate': {
                name: '分离下载',
                desc: '分别保存视频和音频文件',
                handler: null
            }
        },

        setMethod: function (method) {
            this.currentMethod = method;
        },

        merge: function (videoBuffer, audioBuffer, metadata) {
            var self = this;
            var method = this.methods[this.currentMethod];

            if (this.currentMethod === CONFIG.MERGE_METHODS.SEPARATE) {
                return Promise.resolve({ separate: true, video: videoBuffer, audio: audioBuffer });
            }

            if (!method.handler) {
                return Promise.reject(new Error('未找到合并处理器'));
            }

            return method.handler.merge(videoBuffer, audioBuffer, metadata).then(function (result) {
                return { separate: false, data: result };
            }).catch(function (error) {
                console.error(method.name + ' 合并失败:', error);
                throw error;
            });
        }
    };

    const CompleteEffect = {
        show: function () {
            var overlay = document.createElement('div');
            overlay.className = 'bdl-complete-overlay';
            
            var html = '<div class="bdl-complete-container">' +
                '<div class="bdl-complete-ripple"></div>' +
                '<div class="bdl-complete-ripple"></div>' +
                '<div class="bdl-complete-ripple"></div>' +
                '<div class="bdl-complete-particles"></div>' +
                '<div class="bdl-complete-sparkles"></div>' +
                '<div class="bdl-complete-icon">' +
                '<svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg>' +
                '</div>' +
                '</div>' +
                '<div class="bdl-complete-text">✨ 下载完成 ✨</div>';
            
            overlay.innerHTML = html;
            document.body.appendChild(overlay);

            var particlesContainer = overlay.querySelector('.bdl-complete-particles');
            var sparklesContainer = overlay.querySelector('.bdl-complete-sparkles');
            this.createParticles(particlesContainer);
            this.createSparkles(sparklesContainer);

            this.addBubbles();

            var self = this;
            setTimeout(function () {
                overlay.style.animation = 'bdlFadeOut 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards';
                setTimeout(function () {
                    if (overlay.parentNode) {
                        overlay.parentNode.removeChild(overlay);
                    }
                }, 500);
            }, 2500);
        },

        createParticles: function (container) {
            var particleCount = 30;
            var colors = ['#fb7299', '#ff9eb5', '#00a1d6', '#66d4ff', '#f25d8e', '#0081b3'];

            for (var i = 0; i < particleCount; i++) {
                var particle = document.createElement('div');
                particle.className = 'bdl-particle';

                var angle = (Math.PI * 2 * i) / particleCount;
                var velocity = 120 + Math.random() * 80;
                var tx = Math.cos(angle) * velocity;
                var ty = Math.sin(angle) * velocity;

                var size = 6 + Math.random() * 10;
                var colorIndex = Math.floor(Math.random() * colors.length);
                var delay = Math.random() * 0.3;

                particle.style.width = size + 'px';
                particle.style.height = size + 'px';
                particle.style.background = colors[colorIndex];
                particle.style.boxShadow = '0 0 10px ' + colors[colorIndex];
                particle.style.setProperty('--tx', tx + 'px');
                particle.style.setProperty('--ty', ty + 'px');
                particle.style.animationDelay = delay + 's';

                container.appendChild(particle);
            }
        },

        createSparkles: function (container) {
            var sparkleCount = 8;
            var positions = [
                { top: '10%', left: '15%', delay: 0.2, duration: 1.5 },
                { top: '20%', right: '20%', delay: 0.4, duration: 1.8 },
                { top: '40%', left: '10%', delay: 0.6, duration: 1.6 },
                { top: '60%', right: '15%', delay: 0.3, duration: 1.7 },
                { bottom: '30%', left: '25%', delay: 0.5, duration: 1.9 },
                { bottom: '20%', right: '25%', delay: 0.7, duration: 1.4 },
                { top: '30%', left: '50%', delay: 0.1, duration: 2.0 },
                { bottom: '40%', right: '50%', delay: 0.8, duration: 1.3 }
            ];

            for (var i = 0; i < positions.length; i++) {
                var sparkle = document.createElement('div');
                sparkle.className = 'bdl-sparkle';
                var pos = positions[i];
                
                if (pos.top) sparkle.style.top = pos.top;
                if (pos.bottom) sparkle.style.bottom = pos.bottom;
                if (pos.left) sparkle.style.left = pos.left;
                if (pos.right) sparkle.style.right = pos.right;
                
                sparkle.style.animationDelay = pos.delay + 's';
                sparkle.style.animationDuration = pos.duration + 's';
                
                container.appendChild(sparkle);
            }
        },

        addBubbles: function () {
            var circleProgress = document.getElementById('bdl-progress-circle');
            if (!circleProgress) return;

            for (var i = 1; i <= 3; i++) {
                var bubble = document.createElement('div');
                bubble.className = 'bdl-progress-bubble';
                circleProgress.appendChild(bubble);
            }
        }
    };

    const Downloader = {
        isDownloading: false,
        videoInfo: null,
        playData: null,
        selectedQuality: 80,
        selectedPages: [],
        videoType: 'video',

        refreshInfo: function () {
            var self = this;
            var videoId = Utils.getVideoId();
            if (!videoId) {
                UI.showAlert('无法识别视频ID', 'error');
                return Promise.resolve();
            }

            self.videoType = videoId.type;

            var infoPromise;
            if (videoId.type === 'bangumi') {
                infoPromise = BiliAPI.getBangumiInfo(videoId.id);
            } else {
                infoPromise = BiliAPI.getVideoInfo(videoId.id);
            }

            return infoPromise.then(function (videoInfo) {
                self.videoInfo = videoInfo;
                var page = videoInfo.currentPage || Utils.getCurrentPage();
                var pageInfo = videoInfo.pages[page - 1];

                if (!pageInfo) {
                    UI.showAlert('无法获取分P信息', 'error');
                    return;
                }

                var playParams = {
                    type: videoId.type,
                    cid: pageInfo.cid,
                    qn: 127
                };

                if (videoId.type === 'bangumi') {
                    playParams.ep_id = pageInfo.ep_id;
                } else {
                    playParams.bvid = videoId.id;
                }

                return BiliAPI.getPlayUrl(playParams).then(function (playData) {
                    self.playData = playData;
                    var qualities = BiliAPI.getAvailableQualities(playData);

                    UI.updateVideoInfo(videoInfo, pageInfo);
                    UI.updateQualities(qualities, playData.quality);

                    if (videoInfo.pages.length > 1) {
                        UI.preparePagesSection(videoInfo.pages, page - 1);
                        self.selectedPages = [page - 1];
                    } else {
                        UI.hidePagesSection();
                        self.selectedPages = [0];
                    }

                    if (qualities.length > 0) {
                        self.selectedQuality = qualities[0].qn;
                    }
                });
            }).catch(function (error) {
                console.error('获取视频信息失败:', error);
                UI.showAlert('获取视频信息失败: ' + error.message, 'error');
            });
        },

        start: function () {
            var self = this;
            if (this.isDownloading) return;

            if (this.selectedPages.length === 0) {
                UI.showAlert('请至少选择一个分P', 'warning');
                return;
            }

            this.isDownloading = true;
            UI.setDownloading(true);
            UI.showProgress(true);
            UI.hideAlert();

            var downloadNext = function (index) {
                if (index >= self.selectedPages.length) {
                    UI.showAlert('全部下载完成！', 'success');
                    CompleteEffect.show();
                    self.isDownloading = false;
                    UI.setDownloading(false);
                    setTimeout(function () {
                        UI.updateCircleProgress(0);
                    }, 1000);
                    setTimeout(function () {
                        UI.showProgress(false);
                    }, 3000);
                    return;
                }

                var pageIndex = self.selectedPages[index];
                var pageInfo = self.videoInfo.pages[pageIndex];

                if (self.selectedPages.length > 1) {
                    UI.showAlert('正在下载 ' + (index + 1) + '/' + self.selectedPages.length + ': ' + (pageInfo.part || pageInfo.page), 'info');
                }

                self.downloadSinglePage(pageInfo).then(function () {
                    if (index < self.selectedPages.length - 1) {
                        return Utils.delay(1000).then(function () {
                            downloadNext(index + 1);
                        });
                    } else {
                        downloadNext(index + 1);
                    }
                }).catch(function (error) {
                    console.error('下载失败:', error);
                    UI.showAlert('下载失败: ' + error.message, 'error');
                    self.isDownloading = false;
                    UI.setDownloading(false);
                    UI.updateCircleProgress(0);
                    setTimeout(function () {
                        UI.showProgress(false);
                    }, 2000);
                });
            };

            downloadNext(0);
        },

        downloadSinglePage: function (pageInfo) {
            var self = this;
            var videoId = Utils.getVideoId();

            UI.updateProgress('video', 0, '获取下载地址...');
            UI.updateProgress('audio', 0);
            UI.updateProgress('merge', 0);

            var playParams = {
                type: self.videoType,
                cid: pageInfo.cid,
                qn: this.selectedQuality
            };

            if (self.videoType === 'bangumi') {
                playParams.ep_id = pageInfo.ep_id;
            } else {
                playParams.bvid = videoId.id;
            }

            return BiliAPI.getPlayUrl(playParams).then(function (playData) {
                var streams = BiliAPI.getStreams(playData, self.selectedQuality);

                if (!streams.video) {
                    throw new Error('无法获取视频流');
                }

                var videoUrl = streams.video.baseUrl || streams.video.base_url;
                var audioUrl = streams.audio ? (streams.audio.baseUrl || streams.audio.base_url) : null;

                UI.updateProgress('video', 0, '下载视频...');
                UI.updateCircleProgress(0);

                return Network.downloadBuffer(videoUrl, function (loaded, total) {
                    var pct = Math.round(loaded / total * 100);
                    UI.updateProgress('video', pct);
                    UI.updateCircleProgress(pct * 0.4);
                }).then(function (videoBuffer) {
                    UI.updateProgress('video', 100);

                    if (!audioUrl) {
                        return { videoBuffer: videoBuffer, audioBuffer: null };
                    }

                    UI.updateProgress('audio', 0, '下载音频...');
                    return Network.downloadBuffer(audioUrl, function (loaded, total) {
                        var pct = Math.round(loaded / total * 100);
                        UI.updateProgress('audio', pct);
                        UI.updateCircleProgress(40 + pct * 0.4);
                    }).then(function (audioBuffer) {
                        UI.updateProgress('audio', 100);
                        return { videoBuffer: videoBuffer, audioBuffer: audioBuffer };
                    });
                });
            }).then(function (buffers) {
                var metadata = {
                    title: self.videoInfo.title + (pageInfo.part ? (' - ' + pageInfo.part) : ''),
                    author: self.videoInfo.owner.name,
                    description: self.videoInfo.desc,
                    duration: pageInfo.duration
                };

                var filename = self.videoInfo.title;
                if (self.videoInfo.pages.length > 1 && pageInfo.part) {
                    filename += ' - ' + pageInfo.part;
                }
                filename += ' - ' + self.videoInfo.owner.name;
                filename = Utils.sanitizeFilename(filename);

                if (buffers.audioBuffer && MergeManager.currentMethod !== CONFIG.MERGE_METHODS.SEPARATE) {
                    UI.updateProgress('merge', 0, '合并中...');

                    return MergeManager.merge(buffers.videoBuffer, buffers.audioBuffer, metadata).then(function (result) {
                        if (result.separate) {
                            self.saveSeparate(buffers.videoBuffer, buffers.audioBuffer, filename);
                        } else {
                            UI.updateProgress('merge', 100);
                            UI.updateCircleProgress(100);
                            self.saveFile(result.data, filename + '.mp4');
                        }
                    }).catch(function (mergeError) {
                        console.error('合并失败:', mergeError);
                        UI.showAlert('合并失败，已分别保存视频和音频。错误: ' + mergeError.message, 'warning');
                        self.saveSeparate(buffers.videoBuffer, buffers.audioBuffer, filename);
                    });
                } else if (buffers.audioBuffer) {
                    self.saveSeparate(buffers.videoBuffer, buffers.audioBuffer, filename);
                } else {
                    self.saveFile(buffers.videoBuffer, filename + '.mp4');
                }
            });
        },

        saveSeparate: function (videoBuffer, audioBuffer, filename) {
            var self = this;
            this.saveFile(videoBuffer, filename + '_video.mp4');
            setTimeout(function () {
                self.saveFile(audioBuffer, filename + '_audio.m4a');
            }, 500);
        },

        saveFile: function (buffer, filename) {
            var blob = new Blob([buffer], { type: 'video/mp4' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            setTimeout(function () {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 1000);
        }
    };

    const UI = {
        elements: {},
        pagesSectionEnabled: false,

        init: function () {
            GM_addStyle(STYLES);
            this.createPanel();
            this.bindEvents();
        },

        createPanel: function () {
            var panel = document.createElement('div');
            panel.id = 'bdl-panel';
            panel.innerHTML = '<button id="bdl-main-btn" title="下载视频">' +
                '<div id="bdl-progress-circle"></div>' +
                '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14l-4-4h3V8h2v4h3l-4 4z"/></svg>' +
                '</button>' +
                '<div class="bdl-popup" id="bdl-popup">' +
                '<div class="bdl-header">' +
                '<span class="bdl-header-title"><span>📥</span><span>视频下载助手</span></span>' +
                '<button class="bdl-close" id="bdl-close">×</button>' +
                '</div>' +
                '<div class="bdl-body">' +
                '<div class="bdl-info-card">' +
                '<div class="bdl-info-title" id="bdl-title">加载中...</div>' +
                '<div class="bdl-info-meta">' +
                '<span class="bdl-info-meta-item" id="bdl-author"><span>👤</span><span>--</span></span>' +
                '<span class="bdl-info-meta-item" id="bdl-duration"><span>⏱</span><span>--</span></span>' +
                '</div>' +
                '</div>' +
                '<div class="bdl-section" id="bdl-pages-section">' +
                '<div class="bdl-section-header">' +
                '<span class="bdl-section-title">选择分P</span>' +
                '<span style="font-size: 12px; color: #999;" id="bdl-pages-count"></span>' +
                '</div>' +
                '<div class="bdl-pages-container" id="bdl-pages-list"></div>' +
                '<div class="bdl-pages-actions">' +
                '<button id="bdl-select-all">全选</button>' +
                '<button id="bdl-select-none">取消全选</button>' +
                '<button id="bdl-select-reverse">反选</button>' +
                '</div>' +
                '</div>' +
                '<div class="bdl-section">' +
                '<div class="bdl-section-header"><span class="bdl-section-title">选择清晰度</span></div>' +
                '<div class="bdl-quality-grid" id="bdl-qualities"><button class="bdl-quality-btn">加载中</button></div>' +
                '</div>' +
                '<div class="bdl-section">' +
                '<div class="bdl-section-header"><span class="bdl-section-title">合并方式</span></div>' +
                '<div class="bdl-method-list" id="bdl-methods">' +
                '<div class="bdl-method-item active" data-method="js-merge">' +
                '<div class="bdl-method-radio"></div>' +
                '<div class="bdl-method-content">' +
                '<div class="bdl-method-name">JS原生合并<span class="bdl-badge recommended">推荐</span></div>' +
                '<div class="bdl-method-desc">浏览器内直接合并，无需加载额外资源</div>' +
                '</div>' +
                '<span class="bdl-method-status ready">就绪</span>' +
                '</div>' +
                '<div class="bdl-method-item" data-method="separate">' +
                '<div class="bdl-method-radio"></div>' +
                '<div class="bdl-method-content">' +
                '<div class="bdl-method-name">分离下载</div>' +
                '<div class="bdl-method-desc">分别保存视频和音频，可用其他工具合并</div>' +
                '</div>' +
                '<span class="bdl-method-status ready">就绪</span>' +
                '</div>' +
                '</div>' +
                '</div>' +
                '<div class="bdl-tips" id="bdl-tips" style="display:none;">' +
                '<div class="bdl-tips-title">💡 提示</div>' +
                '<div id="bdl-tips-content"></div>' +
                '</div>' +
                '<div class="bdl-progress-section" id="bdl-progress">' +
                '<div class="bdl-progress-row">' +
                '<div class="bdl-progress-header">' +
                '<span class="bdl-progress-label">📹 视频</span>' +
                '<span class="bdl-progress-value" id="bdl-progress-video-text">0%</span>' +
                '</div>' +
                '<div class="bdl-progress-track"><div class="bdl-progress-bar video" id="bdl-progress-video"></div></div>' +
                '</div>' +
                '<div class="bdl-progress-row">' +
                '<div class="bdl-progress-header">' +
                '<span class="bdl-progress-label">🎵 音频</span>' +
                '<span class="bdl-progress-value" id="bdl-progress-audio-text">0%</span>' +
                '</div>' +
                '<div class="bdl-progress-track"><div class="bdl-progress-bar audio" id="bdl-progress-audio"></div></div>' +
                '</div>' +
                '<div class="bdl-progress-row" id="bdl-merge-row">' +
                '<div class="bdl-progress-header">' +
                '<span class="bdl-progress-label">🔧 合并</span>' +
                '<span class="bdl-progress-value" id="bdl-progress-merge-text">0%</span>' +
                '</div>' +
                '<div class="bdl-progress-track"><div class="bdl-progress-bar merge" id="bdl-progress-merge"></div></div>' +
                '</div>' +
                '</div>' +
                '<div class="bdl-alert" id="bdl-alert"></div>' +
                '<button class="bdl-download-btn" id="bdl-download"><span>开始下载</span></button>' +
                '</div>' +
                '<div class="bdl-footer" id="bdl-footer">本工具仅供学习研究使用，请支持正版内容创作者</div>' +
                '</div>';

            document.body.appendChild(panel);

            this.elements = {
                panel: panel,
                btn: document.getElementById('bdl-main-btn'),
                popup: document.getElementById('bdl-popup'),
                close: document.getElementById('bdl-close'),
                title: document.getElementById('bdl-title'),
                author: document.getElementById('bdl-author'),
                duration: document.getElementById('bdl-duration'),
                pagesSection: document.getElementById('bdl-pages-section'),
                pagesList: document.getElementById('bdl-pages-list'),
                pagesCount: document.getElementById('bdl-pages-count'),
                selectAll: document.getElementById('bdl-select-all'),
                selectNone: document.getElementById('bdl-select-none'),
                selectReverse: document.getElementById('bdl-select-reverse'),
                qualities: document.getElementById('bdl-qualities'),
                methods: document.getElementById('bdl-methods'),
                progress: document.getElementById('bdl-progress'),
                progressVideo: document.getElementById('bdl-progress-video'),
                progressVideoText: document.getElementById('bdl-progress-video-text'),
                progressAudio: document.getElementById('bdl-progress-audio'),
                progressAudioText: document.getElementById('bdl-progress-audio-text'),
                progressMerge: document.getElementById('bdl-progress-merge'),
                progressMergeText: document.getElementById('bdl-progress-merge-text'),
                mergeRow: document.getElementById('bdl-merge-row'),
                alert: document.getElementById('bdl-alert'),
                download: document.getElementById('bdl-download'),
                tips: document.getElementById('bdl-tips'),
                tipsContent: document.getElementById('bdl-tips-content'),
                progressCircle: document.getElementById('bdl-progress-circle'),
                footer: document.getElementById('bdl-footer')
            };
        },

        bindEvents: function () {
            var self = this;

            this.elements.btn.addEventListener('click', function () {
                self.elements.popup.classList.toggle('show');
                if (self.elements.popup.classList.contains('show')) {
                    Downloader.refreshInfo();
                }
            });

            this.elements.close.addEventListener('click', function () {
                self.elements.popup.classList.remove('show');
            });

            document.addEventListener('click', function (e) {
                if (!self.elements.panel.contains(e.target)) {
                    self.elements.popup.classList.remove('show');
                }
            });

            this.elements.methods.addEventListener('click', function (e) {
                var item = e.target.closest('.bdl-method-item');
                if (item) {
                    var method = item.dataset.method;
                    var items = document.querySelectorAll('.bdl-method-item');
                    for (var i = 0; i < items.length; i++) {
                        items[i].classList.remove('active');
                    }
                    item.classList.add('active');
                    MergeManager.setMethod(method);
                    self.hideTips();
                    self.elements.mergeRow.style.display = method === 'separate' ? 'none' : 'block';
                }
            });

            this.elements.download.addEventListener('click', function () {
                Downloader.start();
            });

            this.elements.selectAll.addEventListener('click', function () {
                var checkboxes = self.elements.pagesList.querySelectorAll('.bdl-page-checkbox');
                for (var i = 0; i < checkboxes.length; i++) {
                    checkboxes[i].checked = true;
                }
                self.updateSelectedPages();
            });

            this.elements.selectNone.addEventListener('click', function () {
                var checkboxes = self.elements.pagesList.querySelectorAll('.bdl-page-checkbox');
                for (var i = 0; i < checkboxes.length; i++) {
                    checkboxes[i].checked = false;
                }
                self.updateSelectedPages();
            });

            this.elements.selectReverse.addEventListener('click', function () {
                var checkboxes = self.elements.pagesList.querySelectorAll('.bdl-page-checkbox');
                for (var i = 0; i < checkboxes.length; i++) {
                    checkboxes[i].checked = !checkboxes[i].checked;
                }
                self.updateSelectedPages();
            });

            this.elements.footer.addEventListener('click', function () {
                if (self.pagesSectionEnabled) {
                    self.togglePagesSection();
                }
            });

            var lastUrl = location.href;
            var observer = new MutationObserver(function () {
                if (location.href !== lastUrl) {
                    lastUrl = location.href;
                    setTimeout(function () {
                        Downloader.refreshInfo();
                    }, 1500);
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        },

        updateVideoInfo: function (videoInfo, pageInfo) {
            var title = videoInfo.title;
            if (videoInfo.pages.length > 1 && pageInfo.part) {
                title += ' - ' + pageInfo.part;
            }
            this.elements.title.textContent = title;
            this.elements.title.title = title;
            this.elements.author.innerHTML = '<span>👤</span><span>' + videoInfo.owner.name + '</span>';
            this.elements.duration.innerHTML = '<span>⏱</span><span>' + Utils.formatDuration(videoInfo.duration) + '</span>';
        },

        preparePagesSection: function (pages, currentIndex) {
            var self = this;
            this.pagesSectionEnabled = true;
            this.elements.pagesCount.textContent = '共' + pages.length + '个分P';
            this.elements.pagesList.innerHTML = '';

            for (var i = 0; i < pages.length; i++) {
                (function (index) {
                    var page = pages[index];
                    var item = document.createElement('div');
                    item.className = 'bdl-page-item';
                    if (index === currentIndex) {
                        item.classList.add('active');
                    }

                    var checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.className = 'bdl-page-checkbox';
                    checkbox.dataset.index = index;
                    checkbox.checked = index === currentIndex;

                    var info = document.createElement('div');
                    info.className = 'bdl-page-info';

                    var num = document.createElement('div');
                    num.className = 'bdl-page-num';
                    num.textContent = 'P' + page.page;

                    var pageTitle = document.createElement('div');
                    pageTitle.className = 'bdl-page-title';
                    pageTitle.textContent = page.part || '第' + page.page + '话';
                    pageTitle.title = page.part || '第' + page.page + '话';

                    info.appendChild(num);
                    info.appendChild(pageTitle);

                    var duration = document.createElement('span');
                    duration.className = 'bdl-page-duration';
                    duration.textContent = Utils.formatDuration(page.duration);

                    item.appendChild(checkbox);
                    item.appendChild(info);
                    item.appendChild(duration);

                    checkbox.addEventListener('change', function () {
                        self.updateSelectedPages();
                    });

                    item.addEventListener('click', function (e) {
                        if (e.target !== checkbox) {
                            checkbox.checked = !checkbox.checked;
                            self.updateSelectedPages();
                        }
                    });

                    self.elements.pagesList.appendChild(item);
                })(i);
            }

            this.updateSelectedPages();
        },

        togglePagesSection: function () {
            if (this.elements.pagesSection.classList.contains('show')) {
                this.elements.pagesSection.classList.remove('show');
            } else {
                this.elements.pagesSection.classList.add('show');
            }
        },

        hidePagesSection: function () {
            this.pagesSectionEnabled = false;
            this.elements.pagesSection.classList.remove('show');
        },

        updateSelectedPages: function () {
            var checkboxes = this.elements.pagesList.querySelectorAll('.bdl-page-checkbox');
            Downloader.selectedPages = [];
            for (var i = 0; i < checkboxes.length; i++) {
                if (checkboxes[i].checked) {
                    Downloader.selectedPages.push(parseInt(checkboxes[i].dataset.index));
                }
            }
        },

        updateQualities: function (qualities, currentQn) {
            var self = this;
            this.elements.qualities.innerHTML = '';

            for (var i = 0; i < qualities.length; i++) {
                (function (index) {
                    var q = qualities[index];
                    var btn = document.createElement('button');
                    btn.className = 'bdl-quality-btn';
                    if (q.qn === currentQn || index === 0) {
                        btn.classList.add('active');
                        Downloader.selectedQuality = q.qn;
                    }
                    btn.textContent = q.desc;
                    btn.dataset.qn = q.qn;

                    btn.addEventListener('click', function () {
                        var btns = document.querySelectorAll('.bdl-quality-btn');
                        for (var j = 0; j < btns.length; j++) {
                            btns[j].classList.remove('active');
                        }
                        btn.classList.add('active');
                        Downloader.selectedQuality = q.qn;
                    });

                    self.elements.qualities.appendChild(btn);
                })(i);
            }
        },

        showProgress: function (show) {
            if (show) {
                this.elements.progress.classList.add('show');
                this.updateProgress('video', 0);
                this.updateProgress('audio', 0);
                this.updateProgress('merge', 0);
            } else {
                this.elements.progress.classList.remove('show');
            }
        },

        updateProgress: function (type, percent, label) {
            var barId = 'progress' + type.charAt(0).toUpperCase() + type.slice(1);
            var textId = barId + 'Text';
            var bar = this.elements[barId];
            var text = this.elements[textId];

            if (bar) {
                bar.style.width = percent + '%';
            }
            if (text) {
                text.textContent = label || (percent + '%');
            }
        },

        updateCircleProgress: function (percent) {
            if (this.elements.progressCircle) {
                this.elements.progressCircle.style.height = percent + '%';
            }
        },

        showAlert: function (message, type) {
            this.elements.alert.textContent = message;
            this.elements.alert.className = 'bdl-alert show ' + type;
        },

        hideAlert: function () {
            this.elements.alert.className = 'bdl-alert';
        },

        showTips: function (message) {
            this.elements.tipsContent.textContent = message;
            this.elements.tips.style.display = 'block';
        },

        hideTips: function () {
            this.elements.tips.style.display = 'none';
        },

        setDownloading: function (isDownloading) {
            this.elements.download.disabled = isDownloading;
            if (isDownloading) {
                this.elements.download.innerHTML = '<span class="bdl-spinner"></span><span>下载中...</span>';
            } else {
                this.elements.download.innerHTML = '<span>开始下载</span>';
            }
            this.elements.btn.disabled = isDownloading;
        }
    };

    function init() {
        Utils.delay(1000).then(function () {
            UI.init();
            setTimeout(function () {
                Downloader.refreshInfo();
            }, 500);
            console.log('[video-download-helper] 初始化完成'+GM_info(version));
        });
    }

    if (document.readyState === 'complete') {
        init();
    } else {
        window.addEventListener('load', init);
    }

})();