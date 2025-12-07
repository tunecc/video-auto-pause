// ==UserScript==
// @name         Video Focus Guard: Auto Pause Background Tabs
// @namespace    https://github.com/tunecc/video-auto-pause
// @version      0.5
// @description  [ZH] 仅允许当前有焦点的页面继续播放 Bilibili / YouTube 视频，自动暂停其他后台或失焦标签页，防止刷新或切换窗口抢占播放。
// @description:en  Only allow the focused tab to keep playing videos on Bilibili / YouTube. Automatically pauses videos in background or unfocused tabs to prevent playback hijacking.
// @author       Tune (tunecc)
// @homepage     https://github.com/tunecc/video-auto-pause
// @source       https://github.com/tunecc/video-auto-pause
// @downloadURL  https://raw.githubusercontent.com/tunecc/video-auto-pause/refs/heads/main/video-auto-pause.js
// @downloadURL  https://raw.githubusercontent.com/tunecc/video-auto-pause/refs/heads/main/video-auto-pause.js
// @match        https://*.bilibili.com/*
// @match        https://*.youtube.com/*
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @run-at       document-start
// @license      MIT
// @icon         https://raw.githubusercontent.com/tunecc/video-auto-pause/master/logo.png
// ==/UserScript==

(function() {
    'use strict';

    // --- 全局配置 ---
    const SCRIPT_ID = `${Date.now()}-${Math.random()}`;
    const GM_CHANNEL_KEY = 'universalVideoControlChannel';

    let currentVideo = null;

    // --- 辅助函数 ---

    function waitForElement(selector, callback) {
        const element = document.querySelector(selector);
        if (element) {
            callback(element);
            return;
        }

        const observer = new MutationObserver((mutations, obs) => {
            const el = document.querySelector(selector);
            if (el) {
                obs.disconnect();
                callback(el);
            }
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    // --- 核心逻辑 ---

    /**
     * 当视频尝试播放时触发
     */
    function onPlay() {
        // 1. 如果页面完全不可见（最小化或后台标签），强制暂停
        if (document.visibilityState !== 'visible') { 
            this.pause(); 
            return; 
        }

        // 2. 【新增逻辑】如果页面可见（例如双窗口并排），但没有焦点（Focus），
        //    说明用户当前没有在操作这个窗口。
        //    此时我们允许它播放（因为用户可能想同时看两个），
        //    但在任何情况下，不应该发送信号去打断拥有焦点的窗口。
        if (!document.hasFocus()) {
            // console.log('Background play detected (visible but not focused), not broadcasting.');
            return; 
        }
        
        // 3. 只有当页面既可见又拥有焦点时，才通知其他页面暂停
        GM_setValue(GM_CHANNEL_KEY, { sender: SCRIPT_ID, action: 'play_started', timestamp: Date.now() });
    }

    /**
     * 接收来自其他标签页的消息
     */
    function onMessage(name, oldValue, newValue, remote) {
        if (!remote || !newValue || newValue.sender === SCRIPT_ID) return;

        if (newValue.action === 'play_started') {
            // 【新增逻辑】自我保护机制
            // 如果我当前拥有焦点（我是前台正在看的窗口），
            // 即使收到了别人的暂停信号，也忽略它。
            if (document.hasFocus()) {
                // console.log('Ignored pause signal because I have focus.');
                return;
            }

            if (currentVideo && !currentVideo.paused) {
                currentVideo.pause();
            }
        }
    }

    /**
     * 绑定视频事件
     */
    function setupVideo(videoElement) {
        if (videoElement === currentVideo) return;

        if (currentVideo) {
            currentVideo.removeEventListener('play', onPlay);
        }

        currentVideo = videoElement;

        if (currentVideo) {
            currentVideo.addEventListener('play', onPlay);
        }
    }
    
    // --- 网站适配层 ---
    const siteAdapters = {
        'bilibili.com': {
            playerContainerSelector: '#bilibili-player'
        },
        'youtube.com': {
            playerContainerSelector: '#movie_player'
        }
    };

    /**
     * 初始化脚本
     */
    function initialize() {
        const currentHostname = window.location.hostname;
        const adapterKey = Object.keys(siteAdapters).find(key => currentHostname.includes(key));
        
        if (!adapterKey) return; 

        const adapter = siteAdapters[adapterKey];
        
        waitForElement(adapter.playerContainerSelector, (playerContainer) => {
            const videoObserver = new MutationObserver(() => {
                const video = playerContainer.querySelector('video');
                if (video) setupVideo(video);
            });
            videoObserver.observe(playerContainer, { childList: true, subtree: true });
            
            const initialVideo = playerContainer.querySelector('video');
            if (initialVideo) {
                setupVideo(initialVideo);
            }
        });

        GM_addValueChangeListener(GM_CHANNEL_KEY, onMessage);
    }

    initialize();
})();